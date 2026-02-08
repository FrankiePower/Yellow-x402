
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';
import dotenv from 'dotenv';
dotenv.config();

const pk = "0x6932053d4a1763d008389480ce9365f3fa64711de0cef820bba1e5af5ead3713"; // SERVICE_PRIVATE_KEY from yellow-x402-agent/.env
const account = privateKeyToAccount(pk);
console.log(`Address from SERVICE_PRIVATE_KEY: ${account.address}`);
