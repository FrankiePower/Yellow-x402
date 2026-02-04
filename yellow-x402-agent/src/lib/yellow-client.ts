/**
 * yellow-client.ts
 *
 * Reusable ClearNode WebSocket client.
 *   - Authenticates via EIP-712 challenge/verify (same flow as yellow-app)
 *   - Exposes transfer() to send funds via the ClearNode ledger
 *   - Emits "tr" events when an incoming transfer notification arrives
 *       (ClearNode push method is literally "tr", confirmed from SDK enum)
 *
 * Usage:
 *   const client = new YellowClient('0x…privateKey', { appName: 'my-app' });
 *   await client.connect();                        // connect + auth
 *   const txs = await client.transfer({ … });      // pay someone
 *   client.on('tr', (payload) => { … });           // incoming transfer notif
 *   client.close();
 */

import WebSocket          from 'ws';
import { EventEmitter }   from 'events';
import {
  createAuthRequestMessage,
  createECDSAMessageSigner,
  createEIP712AuthMessageSigner,
  createAuthVerifyMessageFromChallenge,
  createTransferMessage,
} from '@erc7824/nitrolite';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { createWalletClient, http }                from 'viem';
import { sepolia }                                 from 'viem/chains';
import type { Address, Hex }                       from 'viem';

// ── public types ───────────────────────────────────────────

export interface TransferTx {
  id              : number;
  tx_type         : string;
  from_account    : string;
  to_account      : string;
  from_account_tag?: string;
  to_account_tag? : string;
  asset           : string;
  amount          : string;
  created_at      : string;
}

export interface TransferParams {
  /** Recipient wallet address.  Exactly one of destination / destination_user_tag required. */
  destination?         : Address;
  /** Recipient ClearNode user-tag (alternative to address). */
  destination_user_tag?: string;
  /** Asset identifier, e.g. "ytest.usd" */
  asset                : string;
  /** Amount as decimal string in base units */
  amount               : string;
}

// ── constants ──────────────────────────────────────────────

const CLEARNET_DEFAULT = 'wss://clearnet-sandbox.yellow.com/ws';

// ── client ─────────────────────────────────────────────────

export class YellowClient extends EventEmitter {
  // ── private state ────────────────────────────────────────
  private ws!             : WebSocket;
  private readonly account: ReturnType<typeof privateKeyToAccount>;
  private readonly walletClient: ReturnType<typeof createWalletClient>;
  private sessionSigner!  : ReturnType<typeof createECDSAMessageSigner>;
  private sessionAddress! : Address;
  private authPartial!    : Record<string, unknown>;   // persisted for challenge signing
  private _authenticated    = false;
  private readonly debug    : boolean;

  // ── ctor ─────────────────────────────────────────────────
  constructor(
    privateKey: Hex,
    private readonly opts: { appName?: string; clearnetUrl?: string } = {},
  ) {
    super();
    this.debug          = !!process.env.DEBUG;
    this.account        = privateKeyToAccount(privateKey);
    // Signing is fully local — transport URL is irrelevant.
    this.walletClient   = createWalletClient({
      chain:     sepolia,
      transport: http(),
      account:   this.account,
    });
    const sessionPk     = generatePrivateKey();
    this.sessionAddress = privateKeyToAccount(sessionPk).address;
    this.sessionSigner  = createECDSAMessageSigner(sessionPk);
  }

  // ── public ───────────────────────────────────────────────
  get address(): Address { return this.account.address; }
  get isAuth() : boolean { return this._authenticated;  }

  /** Open WebSocket and complete EIP-712 auth handshake. */
  async connect(): Promise<void> {
    this.ws = new WebSocket(this.opts.clearnetUrl || CLEARNET_DEFAULT);
    await this.awaitOpen();
    this.ws.on('message', (raw) => this.onMessage(raw.toString()));
    await this.doAuth();
  }

  /**
   * Send funds via the ClearNode ledger.
   * Returns the transaction receipt(s) from ClearNode.
   */
  async transfer(params: TransferParams): Promise<TransferTx[]> {
    if (!this._authenticated) throw new Error('[YellowClient] not authenticated');

    const rpc: Record<string, unknown> = {
      allocations: [{ asset: params.asset, amount: params.amount }],
    };
    if (params.destination)          rpc.destination          = params.destination;
    if (params.destination_user_tag) rpc.destination_user_tag = params.destination_user_tag;

    const msg = await createTransferMessage(this.sessionSigner, rpc as any);
    this.ws.send(msg);

    // ClearNode responds with method "transfer" containing { transactions: [...] }
    const data = await this.waitFor('transfer');
    return (data.transactions ?? (Array.isArray(data) ? data : [data])) as TransferTx[];
  }

  close() { this.ws?.close(); }

  // ── message router ───────────────────────────────────────
  private async onMessage(raw: string): Promise<void> {
    let msg: any;
    try { msg = JSON.parse(raw); } catch { return; }

    if (this.debug) console.log('[YellowClient][raw]', raw);

    // Top-level error envelope  { error: { code, message } }
    if (msg.error) {
      console.error('[YellowClient] RPC error:', msg.error);
      this.emit('rpc_error', msg.error);
      return;
    }

    // Standard envelope  { res: [ reqId, method, payload ] }
    if (!Array.isArray(msg.res) || msg.res.length < 2) return;

    const method  = msg.res[1] as string;
    const payload = msg.res[2] ?? {};

    // ── auto-handle auth challenge ──────────────────────
    if (method === 'auth_challenge') {
      try {
        const challengeStr = payload.challenge_message ?? payload.challengeMessage;
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

    // ── everything else → emit by method name ──────────
    // Covers: "transfer", "tr" (TransferNotification),
    //         "channels", "bu", "cu", etc.
    this.emit(method, payload);
  }

  // ── auth internals ───────────────────────────────────────
  private async doAuth(): Promise<void> {
    this.authPartial = {
      session_key : this.sessionAddress,
      allowances  : [{ asset: 'ytest.usd', amount: '1000000000' }],
      expires_at  : BigInt(Math.floor(Date.now() / 1000) + 3600),
      scope       : 'x402.app',
    };

    const msg = await createAuthRequestMessage({
      address     : this.account.address,
      application : this.appName,
      ...this.authPartial,
    } as any);

    this.ws.send(msg);
    await this.waitFor('authenticated', 30_000);
  }

  private async respondToChallenge(challenge: string): Promise<void> {
    const signer = createEIP712AuthMessageSigner(
      this.walletClient as any,
      this.authPartial   as any,
      { name: this.appName },
    );
    const msg = await createAuthVerifyMessageFromChallenge(signer, challenge);
    this.ws.send(msg);
  }

  // ── helpers ──────────────────────────────────────────────
  private get appName() { return this.opts.appName || 'x402-yellow'; }

  private awaitOpen(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.ws.once('open',  resolve);
      this.ws.once('error', reject);
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
        this.removeListener(event,     onOk);
        this.removeListener('rpc_error', onErr);
        reject(new Error(`[YellowClient] timeout waiting for "${event}" (${ms} ms)`));
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

      this.once(event,     onOk);
      this.once('rpc_error', onErr);
    });
  }
}
