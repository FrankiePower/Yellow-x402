/**
 * yellow-client.ts (Browser version)
 *
 * Reusable ClearNode WebSocket client for browser environments.
 *   - Authenticates via EIP-712 challenge/verify (user signs in MetaMask)
 *   - Uses ephemeral session key for transfers (no popup per transfer)
 *   - Exposes transfer() to send funds via the ClearNode ledger
 *   - Emits "tr" events when an incoming transfer notification arrives
 *
 * Usage:
 *   const walletClient = createWalletClient({ chain, transport: custom(window.ethereum), account });
 *   const client = new YellowClient(walletClient, { appName: 'my-app' });
 *   await client.connect();  // User signs EIP-712 auth in MetaMask
 *   const txs = await client.transfer({ … });  // No popup - uses session key
 *   client.on('tr', (payload) => { … });
 *   client.close();
 */

import { EventEmitter } from 'events';
import {
  createAuthRequestMessage,
  createECDSAMessageSigner,
  createEIP712AuthMessageSigner,
  createAuthVerifyMessageFromChallenge,
  createTransferMessage,
  createCreateChannelMessage,
  createCloseChannelMessage,
  createGetConfigMessage,
  createResizeChannelMessage,
  createGetLedgerBalancesMessage,
  createGetChannelsMessage,
} from '@erc7824/nitrolite';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import type { Address, WalletClient } from 'viem';

// ── public types ───────────────────────────────────────────

export interface TransferTx {
  id: number;
  tx_type: string;
  from_account: string;
  to_account: string;
  from_account_tag?: string;
  to_account_tag?: string;
  asset: string;
  amount: string;
  created_at: string;
}

export interface TransferParams {
  /** Recipient wallet address.  Exactly one of destination / destination_user_tag required. */
  destination?: Address;
  /** Recipient ClearNode user-tag (alternative to address). */
  destination_user_tag?: string;
  /** Asset identifier, e.g. "ytest.usd" */
  asset: string;
  /** Amount as decimal string in base units */
  amount: string;
}

/** Shape of the create_channel / close_channel response from ClearNode. */
export interface ChannelInfo {
  channel_id: string;
  /** Only present on create_channel — the channel fixture (participants, adjudicator, nonce). */
  channel?: {
    participants: string[];
    adjudicator: string;
    challenge: number;
    nonce: number;
  };
  /** The state ClearNode prepared (allocations, version, intent). */
  state: {
    intent: number;
    version: number;
    state_data: string;
    allocations: Array<{
      destination: string;
      token: string;
      amount: string;
    }>;
  };
  /** ClearNode's signature over the state — can be submitted on-chain for settlement. */
  server_signature: string;
}

// ── constants ──────────────────────────────────────────────

const CLEARNET_DEFAULT = 'wss://clearnet-sandbox.yellow.com/ws';

// ── client ─────────────────────────────────────────────────

export class YellowClient extends EventEmitter {
  // ── private state ────────────────────────────────────────
  private ws!: WebSocket;
  private readonly walletClient: WalletClient;
  private sessionSigner!: ReturnType<typeof createECDSAMessageSigner>;
  private sessionAddress!: Address;
  private authPartial!: Record<string, unknown>; // persisted for challenge signing
  private _authenticated = false;
  private readonly debug: boolean;

  // ── ctor ─────────────────────────────────────────────────
  constructor(
    walletClient: WalletClient,
    private readonly opts: { appName?: string; clearnetUrl?: string } = {}
  ) {
    super();
    this.debug = false; // Can be set via opts if needed
    if (!walletClient.account) {
      throw new Error('[YellowClient] walletClient must have an account');
    }
    this.walletClient = walletClient;
    // Generate ephemeral session key for signing transfers (no MetaMask popup needed)
    const sessionPk = generatePrivateKey();
    this.sessionAddress = privateKeyToAccount(sessionPk).address;
    this.sessionSigner = createECDSAMessageSigner(sessionPk);
  }

  // ── public ───────────────────────────────────────────────
  get address(): Address {
    return this.walletClient.account!.address;
  }
  get isAuth(): boolean {
    return this._authenticated;
  }

  /** Open WebSocket and complete EIP-712 auth handshake. */
  async connect(): Promise<void> {
    this.ws = new WebSocket(this.opts.clearnetUrl || CLEARNET_DEFAULT);
    await this.awaitOpen();
    this.ws.addEventListener('message', (event) =>
      this.onMessage(event.data.toString())
    );
    await this.doAuth();
  }

  /**
   * Send funds via the ClearNode ledger.
   * Returns the transaction receipt(s) from ClearNode.
   */
  async transfer(params: TransferParams): Promise<TransferTx[]> {
    if (!this._authenticated)
      throw new Error('[YellowClient] not authenticated');

    const rpc: Record<string, unknown> = {
      allocations: [{ asset: params.asset, amount: params.amount }],
    };
    if (params.destination) rpc.destination = params.destination;
    if (params.destination_user_tag)
      rpc.destination_user_tag = params.destination_user_tag;

    const msg = await createTransferMessage(this.sessionSigner, rpc as any);
    this.ws.send(msg);

    // ClearNode responds with method "transfer" containing { transactions: [...] }
    const data = await this.waitFor('transfer');
    return (data.transactions ??
      (Array.isArray(data) ? data : [data])) as TransferTx[];
  }

  /**
   * Open a state channel via ClearNode RPC.
   * ClearNode returns the channel fixture + initial state + its signature.
   * That signed state can later be submitted on-chain to lock funds.
   */
  async createChannel(params: {
    chain_id: number;
    token: string;
  }): Promise<ChannelInfo> {
    if (!this._authenticated)
      throw new Error('[YellowClient] not authenticated');
    const msg = await createCreateChannelMessage(this.sessionSigner, {
      chain_id: params.chain_id,
      token: params.token as Address,
    });
    this.ws.send(msg);
    return this.waitFor('create_channel') as Promise<ChannelInfo>;
  }

  /**
   * Close a state channel via ClearNode RPC.
   * ClearNode returns the signed final state — submitting it on-chain
   * settles the channel and sends remaining funds to fundDestination.
   */
  async closeChannel(
    channelId: string,
    fundDestination: Address
  ): Promise<ChannelInfo> {
    if (!this._authenticated)
      throw new Error('[YellowClient] not authenticated');
    const msg = await createCloseChannelMessage(
      this.sessionSigner,
      channelId as `0x${string}`,
      fundDestination
    );
    this.ws.send(msg);
    return this.waitFor('close_channel') as Promise<ChannelInfo>;
  }

  /**
   * Fetch ClearNode supported assets.
   * createGetConfigMessage fires two responses: "assets" (the list we need)
   * and "get_config" (networks/broker).  We only need "assets".
   * Call after connect() — uses the session signer.
   */
  async getConfig(): Promise<{
    assets?: Array<{
      token: string;
      chain_id?: number;
      chainId?: number;
      symbol?: string;
      decimals?: number;
    }>;
    [k: string]: any;
  }> {
    if (!this._authenticated)
      throw new Error('[YellowClient] not authenticated');
    const msg = await createGetConfigMessage(this.sessionSigner);
    this.ws.send(msg);
    return this.waitFor('assets'); // first response; "get_config" follows but has no asset list
  }

  /**
   * Resize (fund) a state channel by moving funds from Unified Balance.
   * Uses allocate_amount to pull from off-chain ledger balance (from faucet).
   */
  async resizeChannel(params: {
    channel_id: string;
    allocate_amount: bigint;
  }): Promise<{
    channel_id: string;
    state: ChannelInfo['state'];
    server_signature: string;
  }> {
    if (!this._authenticated)
      throw new Error('[YellowClient] not authenticated');
    const msg = await createResizeChannelMessage(this.sessionSigner, {
      channel_id: params.channel_id as `0x${string}`,
      allocate_amount: params.allocate_amount,
      funds_destination: this.address,
    });
    this.ws.send(msg);
    return this.waitFor('resize_channel');
  }

  /**
   * Get ledger balances (off-chain Unified Balance).
   * This shows funds available from faucet that can be allocated to channels.
   */
  async getLedgerBalances(): Promise<{
    balances: Array<{ asset: string; amount: string }>;
  }> {
    if (!this._authenticated)
      throw new Error('[YellowClient] not authenticated');
    const msg = await createGetLedgerBalancesMessage(
      this.sessionSigner,
      this.address,
      Date.now()
    );
    this.ws.send(msg);
    return this.waitFor('ledger_balances');
  }

  /**
   * Get all channels involving this user.
   * Useful for finding existing open channels and checking their balance.
   */
  async getChannels(status?: 'open' | 'closed'): Promise<{
    channels: Array<any>; // Using any for simplicity as ChannelInfo structure varies
  }> {
    if (!this._authenticated)
      throw new Error('[YellowClient] not authenticated');
    
    // Status 2 = ACTIVE/OPEN in Nitrolite enum (roughly)
    // Passing undefined fetches all
    const msg = await createGetChannelsMessage(
      this.sessionSigner,
      this.address,
      undefined // status
    );
    this.ws.send(msg);
    return this.waitFor('get_channels');
  }

  close() {
    this.ws?.close();
  }

  // ── message router ───────────────────────────────────────
  private async onMessage(raw: string): Promise<void> {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (this.debug || true) console.log('[YellowClient][raw]', raw);

    // Top-level error envelope  { error: { code, message } }
    if (msg.error) {
      console.error('[YellowClient] RPC error:', msg.error);
      this.emit('rpc_error', msg.error);
      return;
    }

    // Standard envelope  { res: [ reqId, method, payload ] }
    if (!Array.isArray(msg.res) || msg.res.length < 2) return;

    const method = msg.res[1] as string;
    const payload = msg.res[2] ?? {};

    // ── auto-handle auth challenge ──────────────────────
    if (method === 'auth_challenge') {
      try {
        const challengeStr =
          payload.challenge_message ?? payload.challengeMessage;
        await this.respondToChallenge(challengeStr);
      } catch (e) {
        console.error('[YellowClient] challenge-sign failed:', e);
        this.emit('rpc_error', e);
      }
      return;
    }

    // ── auth success ────────────────────────────────────
    if (method === 'auth_verify') {
      this._authenticated = true;
      this.emit('authenticated');
      return;
    }

    // ── method-level error  { res: [id, "error", { error: "…" }] } ──
    // Must NOT fall through to emit('error') — Node throws on unhandled 'error' events.
    if (method === 'error') {
      console.error('[YellowClient] RPC error:', payload);
      this.emit('rpc_error', payload);
      return;
    }

    // ── everything else → emit by method name ──────────
    // Covers: "transfer", "tr" (TransferNotification),
    //         "channels", "bu", "cu", etc.
    this.emit(method, payload);
  }

  // ── auth internals ───────────────────────────────────────
  private async doAuth(): Promise<void> {
    this.authPartial = {
      session_key: this.sessionAddress,
      allowances: [{ asset: 'ytest.usd', amount: '1000000000' }],
      expires_at: BigInt(Math.floor(Date.now() / 1000) + 3600),
      scope: 'x402.app',
    };

    const msg = await createAuthRequestMessage({
      address: this.walletClient.account!.address,
      application: this.appName,
      ...this.authPartial,
    } as any);

    this.ws.send(msg);
    await this.waitFor('authenticated', 30_000);
  }

  private async respondToChallenge(challenge: string): Promise<void> {
    const signer = createEIP712AuthMessageSigner(
      this.walletClient as any,
      this.authPartial as any,
      { name: this.appName }
    );
    const msg = await createAuthVerifyMessageFromChallenge(signer, challenge);
    this.ws.send(msg);
  }

  // ── helpers ──────────────────────────────────────────────
  private get appName() {
    return this.opts.appName || 'x402-yellow';
  }

  private awaitOpen(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const onOpen = () => {
        this.ws.removeEventListener('open', onOpen);
        this.ws.removeEventListener('error', onError);
        resolve();
      };
      const onError = (err: Event) => {
        this.ws.removeEventListener('open', onOpen);
        this.ws.removeEventListener('error', onError);
        reject(err);
      };
      this.ws.addEventListener('open', onOpen);
      this.ws.addEventListener('error', onError);
    });
  }

  /**
   * Wait for a single named event.  Races against timeout AND rpc_error
   * so auth/transfer failures surface immediately instead of hanging.
   */
  private waitFor(event: string, ms = 30_000): Promise<any> {
    return new Promise((resolve, reject) => {
      let done = false;

      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        this.removeListener(event, onOk);
        this.removeListener('rpc_error', onErr);
        reject(
          new Error(
            `[YellowClient] timeout waiting for "${event}" (${ms} ms)`
          )
        );
      }, ms);

      const onOk = (data: any) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        this.removeListener('rpc_error', onErr);
        resolve(data);
      };

      const onErr = (err: any) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        this.removeListener(event, onOk);
        reject(new Error(err?.message ?? JSON.stringify(err)));
      };

      this.once(event, onOk);
      this.once('rpc_error', onErr);
    });
  }
}
