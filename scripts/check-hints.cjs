const https = require('https');

const RPC_URL = 'https://rpc.test.mezo.org';
const SORTED_TROVES_PROXY = '0x722E4D24FD6Ff8b0AC679450F3D91294607268fA';
const HINT_HELPERS_PROXY = '0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6';
const IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

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
  const stImpl = await rpcCall('eth_getStorageAt', [SORTED_TROVES_PROXY, IMPLEMENTATION_SLOT, 'latest']);
  console.log('SortedTroves Impl:', '0x' + stImpl.slice(26));
  const hhImpl = await rpcCall('eth_getStorageAt', [HINT_HELPERS_PROXY, IMPLEMENTATION_SLOT, 'latest']);
  console.log('HintHelpers Impl:', '0x' + hhImpl.slice(26));

  // Check findInsertPosition on SortedTroves
  // findInsertPosition(uint256 _NICR, address _prevId, address _nextId) external view returns (address, address)
  // selector for findInsertPosition(uint256,address,address)
}

main().catch(console.error);
