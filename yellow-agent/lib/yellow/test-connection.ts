/**
 * Yellow Network Integration Test
 * 
 * Tests the Yellow client connection and basic operations.
 * Run with: npx tsx lib/yellow/test-connection.ts
 */

import { YellowClient, CLEARNODE_URLS } from './index';
import type { Hex, Address } from 'viem';

// Test wallet (using the same as in .env for testing)
const TEST_PRIVATE_KEY = process.env.PRIVATE_KEY as Hex 
  || '0x31307de5d7e16af19e7cc08c7b4461e5b03db47a2a16c8efa5721f54f8518a5f' as Hex;

// A second test address to create a session with
const TEST_PARTNER = '0x742d35Cc6634C0532925a3b844Bc9e7595f5bE5b' as Address;

async function testYellowConnection() {
  console.log('🧪 Yellow Network Integration Test\n');
  console.log('=' .repeat(50));
  
  // Step 1: Create client
  console.log('\n📋 Step 1: Creating Yellow client...');
  const client = new YellowClient({
    privateKey: TEST_PRIVATE_KEY,
    clearNodeUrl: CLEARNODE_URLS.SANDBOX,
    networkId: 'base-sepolia',
  });
  
  console.log(`   ✅ Client created for address: ${client.address}`);
  
  // Step 2: Connect to ClearNode
  console.log('\n📋 Step 2: Connecting to ClearNode sandbox...');
  try {
    await client.connect();
    console.log('   ✅ Connected to ClearNode!');
    console.log(`   📍 URL: ${CLEARNODE_URLS.SANDBOX}`);
  } catch (error) {
    console.error('   ❌ Connection failed:', error);
    process.exit(1);
  }
  
  // Step 3: Check connection status
  console.log('\n📋 Step 3: Checking connection status...');
  console.log(`   isConnected: ${client.isConnected}`);
  
  // Step 4: List current sessions
  console.log('\n📋 Step 4: Listing current sessions...');
  const sessions = client.listSessions();
  console.log(`   Found ${sessions.length} active session(s)`);
  sessions.forEach(s => {
    console.log(`   - ${s.sessionId} (status: ${s.status})`);
  });
  
  // Step 5: Try to open a session (this might fail if no funds/not set up)
  console.log('\n📋 Step 5: Attempting to open a test session...');
  console.log(`   Partner address: ${TEST_PARTNER}`);
  console.log(`   Initial funding: 1000000 units (1 USDC)`);
  
  try {
    const sessionId = await client.openSession(
      TEST_PARTNER,
      BigInt(1000000) // 1 USDC
    );
    console.log(`   ✅ Session opened: ${sessionId}`);
    
    // Step 6: Get session info
    console.log('\n📋 Step 6: Getting session info...');
    const session = client.getSession(sessionId);
    if (session) {
      console.log(`   Session ID: ${session.sessionId}`);
      console.log(`   Status: ${session.status}`);
      console.log(`   Participants: ${session.participants.join(', ')}`);
      console.log(`   Sequence: ${session.sequenceNumber}`);
      console.log(`   Allocations:`);
      session.allocations.forEach(a => {
        console.log(`     - ${a.participant}: ${a.amount} ${a.asset}`);
      });
    }
    
    // Step 7: Try a micropayment
    console.log('\n📋 Step 7: Attempting micropayment...');
    console.log(`   Amount: 100000 units (0.1 USDC)`);
    
    const proof = await client.pay(sessionId, BigInt(100000), 'test-payment');
    console.log(`   ✅ Payment sent!`);
    console.log(`   New sequence: ${proof.sequenceNumber}`);
    console.log(`   New allocations: [${proof.allocation[0]}, ${proof.allocation[1]}]`);
    
    // Step 8: Close session
    console.log('\n📋 Step 8: Closing session...');
    await client.closeSession(sessionId);
    console.log('   ✅ Session close initiated');
    
  } catch (error) {
    console.log('   ⚠️  Session operation failed (expected if no funds deposited):');
    console.log(`   ${error instanceof Error ? error.message : error}`);
    console.log('\n   💡 To fully test, you need to:');
    console.log('      1. Deposit USDC to Yellow custody contract on Base Sepolia');
    console.log('      2. The custody contract is: 0x490fb189DdE3a01B00be9BA5F41e3447FbC838b6');
    console.log('      3. Then retry opening a session');
  }
  
  // Cleanup
  console.log('\n📋 Cleanup: Disconnecting...');
  client.disconnect();
  console.log('   ✅ Disconnected');
  
  console.log('\n' + '=' .repeat(50));
  console.log('🧪 Test completed!\n');
}

// Run the test
testYellowConnection().catch(console.error);
