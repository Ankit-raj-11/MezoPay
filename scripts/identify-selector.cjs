const crypto = require('crypto');

const signatures = [
  'getPrice()',
  'fetchPrice()',
  'lastGoodPrice()',
  'getLatestPrice()',
  'price()',
  'latestRoundData()',
  'decimals()',
  'owner()',
  'priceSource()'
];

for (const s of signatures) {
  const hash = crypto.createHash('sha3-256'); // Note: Ethereum uses keccak-256
  // let's do keccak
}

// Keccak-256 implementation helper
const { ethers } = require('ethers') || {};
console.log('Testing selector 0x0fdb11cf...');
