const https = require('https');

const RPC_URL = 'https://rpc.test.mezo.org';
const PRICE_FEED_IMPL = '0xec42b37c12b8d73d320f4075a1bcd58b306629c1';

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

// Extract 4-byte selectors from EVM bytecode (PUSH4 0xXXXXXXXX followed by EQ)
async function main() {
  const code = await rpcCall('eth_getCode', [PRICE_FEED_IMPL, 'latest']);
  const hex = code.slice(2);
  const selectors = [];
  for (let i = 0; i < hex.length - 10; i += 2) {
    // PUSH4 opcode is 63
    if (hex.slice(i, i + 2) === '63') {
      const sel = '0x' + hex.slice(i + 2, i + 10);
      if (!selectors.includes(sel)) selectors.push(sel);
    }
  }
  console.log('PriceFeed Selectors found:', selectors);

  // Try calling each selector on PriceFeed proxy (0x86bCF0841622a5dAC14A313a15f96A95421b9366)
  const proxy = '0x86bCF0841622a5dAC14A313a15f96A95421b9366';
  for (const sel of selectors) {
    try {
      const res = await rpcCall('eth_call', [{ to: proxy, data: sel }, 'latest']);
      if (res && res !== '0x') {
        const val = BigInt(res);
        console.log(`Selector ${sel} returned: ${val.toString()} (USD: ${Number(val)/1e18})`);
      }
    } catch (e) {
      // ignore
    }
  }
}

main().catch(console.error);
