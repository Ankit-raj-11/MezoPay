const https = require('https');

const RPC_URL = 'https://rpc.test.mezo.org';
const TROVE_MANAGER_IMPL = '0x9aab567966983e95536fc460c12266fb0cc10b07';
const TROVE_MANAGER_PROXY = '0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0';

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
  const code = await rpcCall('eth_getCode', [TROVE_MANAGER_IMPL, 'latest']);
  const hex = code.slice(2);
  const selectors = [];
  for (let i = 0; i < hex.length - 10; i += 2) {
    if (hex.slice(i, i + 2) === '63') {
      const sel = '0x' + hex.slice(i + 2, i + 10);
      if (!selectors.includes(sel)) selectors.push(sel);
    }
  }
  console.log(`Found ${selectors.length} selectors in TroveManager implementation`);

  // Test constant view functions
  for (const sel of selectors) {
    try {
      const res = await rpcCall('eth_call', [{ to: TROVE_MANAGER_PROXY, data: sel }, 'latest']);
      if (res && res !== '0x' && res.length === 66) {
        const val = BigInt(res);
        if (val > 0n && val < 100000000000000000000n) {
          console.log(`Selector ${sel} returned: ${val.toString()} (raw: ${res})`);
        }
      }
    } catch (e) {}
  }
}

main().catch(console.error);
