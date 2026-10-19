const fs = require('fs');
const path = require('path');
const { createPublicClient, createWalletClient, http, formatUnits, parseUnits, defineChain } = require('../client/node_modules/viem');
const { privateKeyToAccount } = require('../client/node_modules/viem/accounts');

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

const BORROWER_OPERATIONS = '0xCdF7028ceAB81fA0C6971208e83fa7872994beE5';
const HINT_HELPERS = '0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6';
const SORTED_TROVES = '0x722E4D24FD6Ff8b0AC679450F3D91294607268fA';
const TROVE_MANAGER = '0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0';

const client = createPublicClient({ chain: mezoTestnet, transport: http() });

async function run() {
  console.log('=== Pikolo Hint Computation & High Gas openTrove Retry ===');
  const account = privateKeyToAccount(privateKey);
  const wallet = createWalletClient({ account, chain: mezoTestnet, transport: http() });

  const bal = await client.getBalance({ address: account.address });
  console.log(`Payer: ${account.address}, Balance: ${formatUnits(bal, 18)} BTC`);

  // 1. Collateral and MUSD amount
  const collAmount = parseUnits('0.05', 18); // 0.05 BTC
  const musdAmount = parseUnits('1800', 18); // 1,800 MUSD (minimum is usually 1,800)

  // In Pikolo/Liquity:
  // Composite debt = musdAmount + 200 (gas compensation) + borrowing fee (0.5% default = 9 MUSD) = ~2,009 MUSD
  // NICR = (coll * 1e20) / compositeDebt
  const compositeDebt = parseUnits('2009', 18);
  const nicr = (collAmount * 100000000000000000000n) / compositeDebt;
  console.log('NICR:', nicr.toString());

  // 2. Query HintHelpers for approx hint
  const approx = await client.readContract({
    address: HINT_HELPERS,
    abi: [{
      type: 'function',
      name: 'getApproxHint',
      inputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
      outputs: [{ type: 'address' }, { type: 'uint256' }, { type: 'uint256' }],
      stateMutability: 'view'
    }],
    functionName: 'getApproxHint',
    args: [nicr, 100n, 42n]
  });
  console.log('Approx hint from HintHelpers:', approx[0]);

  // 3. Find exact insertion position from SortedTroves
  const [upperHint, lowerHint] = await client.readContract({
    address: SORTED_TROVES,
    abi: [{
      type: 'function',
      name: 'findInsertPosition',
      inputs: [{ type: 'uint256' }, { type: 'address' }, { type: 'address' }],
      outputs: [{ type: 'address' }, { type: 'address' }],
      stateMutability: 'view'
    }],
    functionName: 'findInsertPosition',
    args: [nicr, approx[0], approx[0]]
  });
  console.log(`Pikolo insert hints: upper=${upperHint}, lower=${lowerHint}`);

  // 4. Verify validInsertPosition
  const isValid = await client.readContract({
    address: SORTED_TROVES,
    abi: [{
      type: 'function',
      name: 'validInsertPosition',
      inputs: [{ type: 'uint256' }, { type: 'address' }, { type: 'address' }],
      outputs: [{ type: 'bool' }],
      stateMutability: 'view'
    }],
    functionName: 'validInsertPosition',
    args: [nicr, upperHint, lowerHint]
  });
  console.log('Are hints verified valid in SortedTroves?', isValid);

  const abiBO = [{
    type: 'function',
    name: 'openTrove',
    inputs: [
      { name: '_MUSDAmount', type: 'uint256' },
      { name: '_upperHint', type: 'address' },
      { name: '_lowerHint', type: 'address' }
    ],
    outputs: [],
    stateMutability: 'payable'
  }];

  // 5. Test with High Gas Limits (e.g. 5M, 10M, 15M)
  for (const gasLimit of [2000000n, 5000000n, 10000000n, 15000000n]) {
    console.log(`\n--- Attempting simulation with gasLimit=${gasLimit.toString()} ---`);
    try {
      const res = await client.simulateContract({
        account,
        address: BORROWER_OPERATIONS,
        abi: abiBO,
        functionName: 'openTrove',
        args: [musdAmount, upperHint, lowerHint],
        value: collAmount,
        gas: gasLimit
      });
      console.log(`✓ SUCCESS at gasLimit ${gasLimit}!`, res);
      
      console.log('Broadcasting transaction to Mezo Testnet...');
      const tx = await wallet.writeContract({
        account,
        address: BORROWER_OPERATIONS,
        abi: abiBO,
        functionName: 'openTrove',
        args: [musdAmount, upperHint, lowerHint],
        value: collAmount,
        gas: gasLimit
      });
      console.log('Tx sent:', tx);
      const receipt = await client.waitForTransactionReceipt({ hash: tx });
      console.log('Receipt status:', receipt.status, 'block:', receipt.blockNumber);
      return;
    } catch (e) {
      console.log(`Revert/Error with gasLimit ${gasLimit}:`);
      console.log(e.shortMessage || e.message);
      if (e.cause) {
        console.log('Cause:', e.cause.message || e.cause);
      }
    }
  }
}

run().catch(console.error);
