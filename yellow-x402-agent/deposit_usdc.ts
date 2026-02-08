/**
 * deposit_usdc.ts - Deposit Base USDC to Yellow custody contract
 * 
 * This enables funding channels with real on-chain USDC for production-ready demos.
 */

import { config } from 'dotenv';
import { createPublicClient, createWalletClient, formatUnits, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { NitroliteClient, WalletStateSigner } from '@erc7824/nitrolite';

config();

const BASE_CHAIN_ID = baseSepolia.id; // Base Sepolia testnet
const USDC_TOKEN_BASE = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // USDC on Base Sepolia
const USDC_DECIMALS = 6;

// Yellow custody contract on Base (from SDK tutorials)
const CUSTODY_ADDRESS = '0x490fb189DdE3a01B00be9BA5F41e3447FbC838b6';
const ADJUDICATOR_ADDRESS = '0x7de4A0736Cf5740fD3Ca2F2e9cc85c9AC223eF0C';

async function main() {
  const buyerPrivateKey = process.env.BUYER_PRIVATE_KEY;
  if (!buyerPrivateKey) {
    throw new Error('BUYER_PRIVATE_KEY not found in .env');
  }

  const account = privateKeyToAccount(buyerPrivateKey as `0x${string}`);
  console.log(`📍 Buyer address: ${account.address}`);

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  });

  // Check USDC balance on Base
  const balance = await publicClient.readContract({
    address: USDC_TOKEN_BASE as `0x${string}`,
    abi: [{
      name: 'balanceOf',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'account', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }],
    }],
    functionName: 'balanceOf',
    args: [account.address],
  });

  console.log(`💰 Available USDC on Base: ${formatUnits(balance, USDC_DECIMALS)}`);

  if (balance === 0n) {
    console.log('\n❌ No USDC found on Base Sepolia network.');
    console.log('📝 To get Base Sepolia USDC:');
    console.log('   1. Get ETH from faucet: https://www.alchemy.com/faucets/base-sepolia');
    console.log('   2. Swap ETH → USDC on testnet Uniswap');
    console.log(`   3. USDC contract: ${USDC_TOKEN_BASE}`);
    process.exit(1);
  }

  // Deposit amount (default: 1 USDC)
  const depositAmount = process.env.DEPOSIT_AMOUNT || '1.0';
  const depositAmountInUnits = parseUnits(depositAmount, USDC_DECIMALS);

  if (balance < depositAmountInUnits) {
    console.log(`\n❌ Insufficient USDC. Have: ${formatUnits(balance, USDC_DECIMALS)}, Need: ${depositAmount}`);
    process.exit(1);
  }

  console.log(`\n💸 Depositing ${depositAmount} USDC to Yellow custody...`);

  const nitroliteClient = new NitroliteClient({
    walletClient,
    publicClient: publicClient as any,
    stateSigner: new WalletStateSigner(walletClient),
    addresses: {
      custody: CUSTODY_ADDRESS as `0x${string}`,
      adjudicator: ADJUDICATOR_ADDRESS as `0x${string}`,
    },
    chainId: BASE_CHAIN_ID,
    challengeDuration: 3600n,
  });

  const depositHash = await nitroliteClient.deposit(USDC_TOKEN_BASE, depositAmountInUnits);
  console.log(`✅ Deposit tx: ${depositHash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: depositHash });
  console.log(`✅ Confirmed in block ${receipt.blockNumber}`);
  console.log(`\n🎉 Successfully deposited ${depositAmount} USDC to Yellow custody!`);
  console.log(`   You can now use this in channels for high-frequency payments.`);
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
