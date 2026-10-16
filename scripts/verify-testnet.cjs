const https = require('https');

const RPC_URL = 'https://rpc.test.mezo.org';
const CONTRACTS = {
  MUSD: '0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503',
  BorrowerOperations: '0xCdF7028ceAB81fA0C6971208e83fa7872994beE5',
  TroveManager: '0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0',
  SortedTroves: '0x722E4D24FD6Ff8b0AC679450F3D91294607268fA',
  HintHelpers: '0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6',
  PriceFeed: '0x86bCF0841622a5dAC14A313a15f96A95421b9366'
};

function rpcCall(method, params = []) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params
    });

    const url = new URL(RPC_URL);
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) reject(parsed.error);
            else resolve(parsed.result);
          } catch (e) {
            reject(new Error(`Failed to parse RPC response: ${data}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('=== Verifying Mezo Protocol Core Contracts ===\n');

  for (const [name, addr] of Object.entries(CONTRACTS)) {
    try {
      const code = await rpcCall('eth_getCode', [addr, 'latest']);
      if (!code || code === '0x' || code === '0x0') {
        console.log(`[-] ${name} (${addr}): EMPTY CODE`);
      } else {
        console.log(`[x] ${name} (${addr}): ACTIVE (${code.length / 2 - 1} bytes)`);
      }
    } catch (e) {
      console.error(`[-] ${name} error:`, e.message);
    }
  }

  // Test reading the live PriceFeed oracle (fetchPrice() or lastGoodPrice())
  console.log('\n--- Checking PriceFeed Oracle ---');
  // lastGoodPrice(): 0xbe8058a7
  // fetchPrice(): 0xa5ffde82
  const selectors = [
    { name: 'fetchPrice()', sel: '0xa5ffde82' },
    { name: 'lastGoodPrice()', sel: '0xbe8058a7' },
    { name: 'price()', sel: '0xa035b1fe' }
  ];

  for (const s of selectors) {
    try {
      const res = await rpcCall('eth_call', [{ to: CONTRACTS.PriceFeed, data: s.sel }, 'latest']);
      if (res && res !== '0x') {
        const priceBig = BigInt(res);
        const priceUsd = Number(priceBig) / 1e18;
        console.log(`[x] PriceFeed.${s.name} returned: ${priceUsd} USD (${priceBig} raw wei)`);
        break;
      }
    } catch (e) {
      // try next selector
    }
  }

  // Check TroveManager MCR (110%) and CCR (150%)
  console.log('\n--- Checking TroveManager Parameters ---');
  // MCR(): 0xdaaa391c
  // CCR(): 0x82b9a101
  try {
    const mcrHex = await rpcCall('eth_call', [{ to: CONTRACTS.TroveManager, data: '0xdaaa391c' }, 'latest']);
    if (mcrHex && mcrHex !== '0x') {
      const mcr = Number(BigInt(mcrHex)) / 1e16; // 1e18 = 100% -> 1.1e18 = 110%
      console.log(`[x] TroveManager.MCR: ${mcr}%`);
    }
  } catch (e) {
    console.log('[-] TroveManager.MCR query skipped:', e.message);
  }

  try {
    const ccrHex = await rpcCall('eth_call', [{ to: CONTRACTS.TroveManager, data: '0x82b9a101' }, 'latest']);
    if (ccrHex && ccrHex !== '0x') {
      const ccr = Number(BigInt(ccrHex)) / 1e16; // 1.5e18 = 150%
      console.log(`[x] TroveManager.CCR: ${ccr}%`);
    }
  } catch (e) {
    console.log('[-] TroveManager.CCR query skipped:', e.message);
  }
}

main().catch(console.error);
