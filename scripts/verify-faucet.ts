
import { NitroliteClient, WalletStateSigner } from '@erc7824/nitrolite';
import { createPublicClient, createWalletClient, http, formatUnits } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import fetch from 'node-fetch';

const CUSTODY_ADDRESS = "0x019B65A265EB3363822f2752141b3dF16131b262";
const ADJUDICATOR_ADDRESS = "0x7c7ccbc98469190849BCC6c926307794fDfB11F2";
const YTEST_USD_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

async function main() {
    console.log("Starting Faucet Verification...");

    // 1. Generate Test Account
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    console.log(`Generated Test Account: ${account.address}`);

    // 2. Setup Clients
    const publicClient = createPublicClient({
        chain: sepolia,
        transport: http("https://1rpc.io/sepolia") // Public RPC
    });

    const walletClient = createWalletClient({
        account,
        chain: sepolia,
        transport: http("https://1rpc.io/sepolia")
    });

    const client = new NitroliteClient({
        publicClient,
        walletClient,
        stateSigner: new WalletStateSigner(walletClient),
        addresses: {
            custody: CUSTODY_ADDRESS,
            adjudicator: ADJUDICATOR_ADDRESS,
        },
        chainId: sepolia.id,
        challengeDuration: 3600n,
    });

    // 3. Check Initial Balance
    console.log("Checking initial Off-Chain Balance...");
    try {
        const initialBal = await client.getAccountBalance(YTEST_USD_ADDRESS);
        console.log(`Initial Balance: ${formatUnits(initialBal, 6)} ytest.usd`);
    } catch (e) {
        console.log("Error checking initial balance (expected if account is new/empty):", e);
    }

    // 4. Request Tokens from Faucet
    console.log("Requesting tokens from Faucet...");
    try {
        const response = await fetch("https://clearnet-sandbox.yellow.com/faucet/requestTokens", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userAddress: account.address }),
        });

        const data = await response.json();
        console.log("Faucet Response:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Failed to request tokens:", e);
        process.exit(1);
    }

    // 5. Wait for processing (L1 might take time)
    console.log("Waiting 30 seconds for L1 confirmation...");
    await new Promise(r => setTimeout(r, 30000));

    // 6. Check Final Balance
    console.log("Checking final Off-Chain Balance...");
    try {
        const finalBal = await client.getAccountBalance(YTEST_USD_ADDRESS);
        console.log(`Final Account Balance (Off-Chain?): ${formatUnits(finalBal, 6)} ytest.usd`);

        const tokenBal = await client.getTokenBalance(YTEST_USD_ADDRESS);
        console.log(`Final Token Balance (L1?): ${formatUnits(tokenBal, 6)} ytest.usd`);

        if (finalBal > 0n || tokenBal > 0n) {
            console.log("SUCCESS: Balance increased!");
        } else {
            console.error("FAILURE: Balance did not increase.");
        }
    } catch (e) {
        console.error("Error checking final balance:", e);
    }
}

main().catch(console.error);
