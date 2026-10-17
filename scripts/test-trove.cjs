const fs = require('fs');
const path = require('path');
const { createPublicClient, http, formatUnits, parseUnits, defineChain } = require('../client/node_modules/viem');
const { privateKeyToAccount } = require('../client/node_modules/viem/accounts');

// Read contracts/.env manually if exists
let privateKey = null;
const envPath = path.join(__dirname, '../contracts/.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  const match = content.match(/PRIVATE_KEY\s*=\s*(0x[a-fA-F0-9]{64}|[a-fA-F0-9]{64})/);
  if (match) {
    privateKey = match[1].startsWith('0x') ? match[1] : `0x${match[1]}`;
  }
}

const mezoTestnet = defineChain({
  id: 31611,
  name: 'Mezo Testnet',
  nativeCurrency: { name: 'Bitcoin', symbol: 'BTC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.test.mezo.org'] },
  },
});

const CONTRACTS = {
  MUSD: '0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503',
  BORROWER_OPERATIONS: '0xCdF7028ceAB81fA0C6971208e83fa7872994beE5',
  TROVE_MANAGER: '0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0',
  PRICE_FEED: '0x86bCF0841622a5dAC14A313a15f96A95421b9366',
};

const PRICE_FEED_ABI = [
  {
    type: 'function',
    name: 'fetchPrice',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'lastGoodPrice',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
];

const TROVE_MANAGER_ABI = [
  {
    type: 'function',
    name: 'getTroveStatus',
    inputs: [{ name: '_borrower', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTroveDebt',
    inputs: [{ name: '_borrower', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTroveColl',
    inputs: [{ name: '_borrower', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
];

async function main() {
  console.log('====================================================');
  console.log('Mezo Testnet Trove & BorrowerOperations Verification');
  console.log('====================================================');

  const client = createPublicClient({
    chain: mezoTestnet,
    transport: http(),
  });

  const blockNumber = await client.getBlockNumber();
  console.log(`✓ Connected to Mezo Testnet (Block #${blockNumber})`);

  // 1. Oracle Price Feed
  try {
    const priceRaw = await client.readContract({
      address: CONTRACTS.PRICE_FEED,
      abi: PRICE_FEED_ABI,
      functionName: 'fetchPrice',
    });
    console.log(`✓ BTC Oracle Price: $${Number(formatUnits(priceRaw, 18)).toFixed(2)} USD`);
  } catch (err) {
    console.warn(`! PriceFeed read note: ${err.message?.slice(0, 80)}`);
  }

  // 2. Check Wallet
  if (!privateKey) {
    console.log('! No private key found in contracts/.env. Read-only checks completed.');
    return;
  }

  const account = privateKeyToAccount(privateKey);
  console.log(`✓ Deployer Wallet Address: ${account.address}`);

  const balance = await client.getBalance({ address: account.address });
  console.log(`✓ Native BTC Balance: ${formatUnits(balance, 18)} BTC`);

  // 3. Read Trove State
  try {
    const status = await client.readContract({
      address: CONTRACTS.TROVE_MANAGER,
      abi: TROVE_MANAGER_ABI,
      functionName: 'getTroveStatus',
      args: [account.address],
    });
    const debt = await client.readContract({
      address: CONTRACTS.TROVE_MANAGER,
      abi: TROVE_MANAGER_ABI,
      functionName: 'getTroveDebt',
      args: [account.address],
    });
    const coll = await client.readContract({
      address: CONTRACTS.TROVE_MANAGER,
      abi: TROVE_MANAGER_ABI,
      functionName: 'getTroveColl',
      args: [account.address],
    });

    const statusMap = ['Non-Existent', 'Active', 'Closed by Owner', 'Closed by Liquidation', 'Closed by Redemption'];
    console.log(`✓ Trove Status: ${statusMap[Number(status)] || status}`);
    console.log(`✓ Trove Collateral: ${formatUnits(coll, 18)} BTC`);
    console.log(`✓ Trove Debt: ${formatUnits(debt, 18)} MUSD`);
  } catch (err) {
    console.warn(`! Trove read error: ${err.message?.slice(0, 100)}`);
  }
}

main().catch(console.error);
