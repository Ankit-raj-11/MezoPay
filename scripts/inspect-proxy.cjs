const https = require('https');

const RPC_URL = 'https://rpc.test.mezo.org';
const IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

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

async function inspectProxy(name, addr) {
  const implRaw = await rpcCall('eth_getStorageAt', [addr, IMPLEMENTATION_SLOT, 'latest']);
  const implAddr = '0x' + implRaw.slice(26);
  console.log(`${name} Proxy (${addr}) -> Implementation: ${implAddr}`);
  const code = await rpcCall('eth_getCode', [implAddr, 'latest']);
  console.log(`  Impl Code Size: ${code.length / 2 - 1} bytes`);
}

async function main() {
  await inspectProxy('TroveManager', '0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0');
  await inspectProxy('BorrowerOperations', '0xCdF7028ceAB81fA0C6971208e83fa7872994beE5');
  await inspectProxy('PriceFeed', '0x86bCF0841622a5dAC14A313a15f96A95421b9366');
}

main().catch(console.error);
