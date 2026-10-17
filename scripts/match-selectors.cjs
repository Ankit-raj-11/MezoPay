const { execSync } = require('child_process');
const https = require('https');

const RPC_URL = 'https://rpc.test.mezo.org';
const BORROWER_OPS_IMPL = '0xc05bf344bd5b58825784326dd3112fb6cc160dcc';

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
  const code = await rpcCall('eth_getCode', [BORROWER_OPS_IMPL, 'latest']);
  const hex = code.slice(2);
  const selectors = [];
  for (let i = 0; i < hex.length - 10; i += 2) {
    if (hex.slice(i, i + 2) === '63') {
      const sel = '0x' + hex.slice(i + 2, i + 10);
      if (!selectors.includes(sel)) selectors.push(sel);
    }
  }

  console.log(`Searching signatures for ${selectors.length} selectors...`);
  for (const sel of selectors) {
    try {
      const out = execSync(`cast 4byte ${sel}`, { timeout: 2000, stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
      if (out && !out.includes('Error')) {
        const firstLine = out.split('\n')[0];
        if (firstLine.includes('Trove') || firstLine.includes('Coll') || firstLine.includes('MUSD') || firstLine.includes('Fee') || firstLine.includes('open') || firstLine.includes('close') || firstLine.includes('repay')) {
          console.log(`${sel} => ${firstLine}`);
        }
      }
    } catch (e) {}
  }
}

main().catch(console.error);
