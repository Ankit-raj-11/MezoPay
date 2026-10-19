const fs = require('fs');
const path = require('path');
const { createPublicClient, createWalletClient, http, formatUnits, parseUnits, defineChain } = require('../client/node_modules/viem');
const { privateKeyToAccount } = require('../client/node_modules/viem/accounts');

// Read contracts/.env
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
  rpcUrls: { default: { http: ['https://rpc.test.mezo.org'] } },
});

const CONTRACTS = {
  BORROWER_OPERATIONS: '0xCdF7028ceAB81fA0C6971208e83fa7872994beE5',
  TROVE_MANAGER: '0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0',
  SORTED_TROVES: '0x722E4D24FD6Ff8b0AC679450F3D91294607268fA',
  HINT_HELPERS: '0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6',
};

const BORROWER_OPERATIONS_ABI = [
  {
    type: 'function',
    name: 'openTrove',
    inputs: [
      { name: '_maxFeePercentage', type: 'uint256' },
      { name: '_MUSDAmount', type: 'uint256' },
      { name: '_upperHint', type: 'address' },
      { name: '_lowerHint', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
];

const HINT_HELPERS_ABI = [
  {
    type: 'function',
    name: 'getApproxHint',
    inputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }, { name: '', type: 'uint256' }, { name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
];

const SORTED_TROVES_ABI = [
  {
    type: 'function',
    name: 'findInsertPosition',
    inputs: [{ type: 'uint256' }, { type: 'address' }, { type: 'address' }],
    outputs: [{ name: '', type: 'address' }, { name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'validInsertPosition',
    inputs: [{ type: 'uint256' }, { type: 'address' }, { type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
];

async function main() {
  console.log('========================================================');
  console.log('Mezo Testnet: openTrove & Hint Investigation Script');
  console.log('========================================================');

  const publicClient = createPublicClient({ chain: mezoTestnet, transport: http() });
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ account, chain: mezoTestnet, transport: http() });

  console.log(`Caller Address: ${account.address}`);
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Native BTC Balance: ${formatUnits(balance, 18)} BTC`);

  const coll = parseUnits('0.04', 18);
  const netDebt = parseUnits('1800', 18);
  const compositeDebt = parseUnits('2009', 18); // 1800 + 200 gas compensation + 9 fee
  const maxFeePercentage = parseUnits('0.05', 18);

  // 1. Test with Zero Hints
  console.log('\n--- 1. Testing openTrove with Zero Hints ---');
  try {
    await publicClient.simulateContract({
      account,
      address: CONTRACTS.BORROWER_OPERATIONS,
      abi: BORROWER_OPERATIONS_ABI,
      functionName: 'openTrove',
      args: [
        maxFeePercentage,
        netDebt,
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
      ],
      value: coll,
    });
    console.log('✓ Result: Zero hints simulation SUCCEEDED');
  } catch (errZero) {
    console.log(`✗ Result: Zero hints REVERTED: ${errZero.message?.slice(0, 150)}`);
  }

  // 2. Compute Valid Hints
  console.log('\n--- 2. Computing Verified Hints from HintHelpers & SortedTroves ---');
  const nicr = (coll * 100000000000000000000n) / compositeDebt;
  console.log('Computed NICR:', nicr.toString());

  const approx = await publicClient.readContract({
    address: CONTRACTS.HINT_HELPERS,
    abi: HINT_HELPERS_ABI,
    functionName: 'getApproxHint',
    args: [nicr, 100n, 42n],
  });

  const [upperHint, lowerHint] = await publicClient.readContract({
    address: CONTRACTS.SORTED_TROVES,
    abi: SORTED_TROVES_ABI,
    functionName: 'findInsertPosition',
    args: [nicr, approx[0], approx[0]],
  });

  const isValid = await publicClient.readContract({
    address: CONTRACTS.SORTED_TROVES,
    abi: SORTED_TROVES_ABI,
    functionName: 'validInsertPosition',
    args: [nicr, upperHint, lowerHint],
  });

  console.log(`Computed hints: upper=${upperHint}, lower=${lowerHint}, validInSortedTroves=${isValid}`);

  // 3. Test with Verified Hints
  console.log('\n--- 3. Testing openTrove with Verified Hints ---');
  try {
    await publicClient.simulateContract({
      account,
      address: CONTRACTS.BORROWER_OPERATIONS,
      abi: BORROWER_OPERATIONS_ABI,
      functionName: 'openTrove',
      args: [maxFeePercentage, netDebt, upperHint, lowerHint],
      value: coll,
    });
    console.log('✓ Result: Verified hints simulation SUCCEEDED!');

    // 4. Execute on-chain
    console.log('\n--- 4. Broadcasting openTrove to Mezo Testnet ---');
    const hash = await walletClient.writeContract({
      account,
      address: CONTRACTS.BORROWER_OPERATIONS,
      abi: BORROWER_OPERATIONS_ABI,
      functionName: 'openTrove',
      args: [maxFeePercentage, netDebt, upperHint, lowerHint],
      value: coll,
    });
    console.log(`Transaction sent! TxHash: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`✓ Mined in block #${receipt.blockNumber}, status: ${receipt.status}`);
  } catch (errHints) {
    console.log(`Result with hints: ${errHints.message?.slice(0, 300)}`);
  }
}

main().catch(console.error);
