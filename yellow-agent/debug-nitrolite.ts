
import * as Nitrolite from '@erc7824/nitrolite';

console.log('Keys exported by Nitrolite:', Object.keys(Nitrolite));
try {
  console.log('parseRPCResponse:', Nitrolite.parseRPCResponse);
} catch (e) {
  console.log('parseRPCResponse not found');
}
