const https = require('https');

const RPC_URL = 'https://rpc.test.mezo.org';
const BORROWER_OPS_IMPL = '0xc05bf344bd5b58825784326dd3112fb6cc160dcc';
const BORROWER_OPS_PROXY = '0xCdF7028ceAB81fA0C6971208e83fa7872994beE5';

function rpcCall(method, params = []) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
    const url = new URL(RPC_URL);
    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data).result));
    });
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('--- Inspecting BorrowerOperations implementation ---');
  const code = await rpcCall('eth_getCode', [BORROWER_OPS_IMPL, 'latest']);
  const hex = code.slice(2);
  const selectors = [];
  for (let i = 0; i < hex.length - 10; i += 2) {
    if (hex.slice(i, i + 2) === '63') {
      const sel = '0x' + hex.slice(i + 2, i + 10);
      if (!selectors.includes(sel)) selectors.push(sel);
    }
  }
  console.log(`Found ${selectors.length} selectors in BorrowerOperations implementation:`);
  console.log(selectors.slice(0, 30));

  // Let's check common Liquity BorrowerOperations functions:
  // openTrove(uint256,uint256,address,address)
  // addColl(address,address)
  // withdrawColl(uint256,address,address)
  // withdrawMUSD(uint256,uint256,address,address)
  // repayMUSD(uint256,address,address)
  // closeTrove()
  // adjustTrove(uint256,uint256,uint256,bool,address,address)
}

main().catch(console.error);
