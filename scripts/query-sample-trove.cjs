const https = require('https');

const RPC_URL = 'https://rpc.test.mezo.org';
const TROVE_MANAGER = '0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0';
const PRICE_FEED = '0x86bCF0841622a5dAC14A313a15f96A95421b9366';
const SAMPLE_USER = '0xda04759e54728b6636fe48f7c9795c7b609baaaa';

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

// ABI encoding helper: pad address to 32 bytes
function padAddress(addr) {
  return addr.toLowerCase().replace('0x', '').padStart(64, '0');
}

async function main() {
  console.log('--- Inspecting Sample Live Trove on Mezo Testnet ---');
  console.log('User Address:', SAMPLE_USER);

  // getTroveDebt(address): selector 0xd66a2553
  const debtData = '0xd66a2553' + padAddress(SAMPLE_USER);
  const debtHex = await rpcCall('eth_call', [{ to: TROVE_MANAGER, data: debtData }, 'latest']);
  const debtWei = BigInt(debtHex);
  const debtMUSD = Number(debtWei) / 1e18;

  // getTroveColl(address): selector 0x480cd578
  const collData = '0x480cd578' + padAddress(SAMPLE_USER);
  const collHex = await rpcCall('eth_call', [{ to: TROVE_MANAGER, data: collData }, 'latest']);
  const collWei = BigInt(collHex);
  const collBTC = Number(collWei) / 1e18;

  // PriceFeed fetchPrice(): 0x0fdb11cf
  const priceHex = await rpcCall('eth_call', [{ to: PRICE_FEED, data: '0x0fdb11cf' }, 'latest']);
  const priceUSD = Number(BigInt(priceHex)) / 1e18;

  // Calculate ICR
  // ICR = (coll * price) / debt
  const icr = (collBTC * priceUSD / debtMUSD) * 100;
  const liqPrice = (debtMUSD * 1.10) / collBTC;

  console.log(`[x] Total Debt: ${debtMUSD.toFixed(2)} MUSD`);
  console.log(`[x] Locked Collateral: ${collBTC.toFixed(6)} BTC`);
  console.log(`[x] Current BTC Price: $${priceUSD.toFixed(2)} USD`);
  console.log(`[x] Live ICR: ${icr.toFixed(2)}% (${icr >= 150 ? 'SAFE' : icr >= 110 ? 'WATCH' : 'LIQUIDATABLE'})`);
  console.log(`[x] Liquidation Price: $${liqPrice.toFixed(2)} USD`);
}

main().catch(console.error);
