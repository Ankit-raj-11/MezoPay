const { createPublicClient, http, defineChain, parseUnits } = require('../client/node_modules/viem');

const mezoTestnet = defineChain({
  id: 31611,
  name: 'Mezo Testnet',
  nativeCurrency: { name: 'Bitcoin', symbol: 'BTC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.test.mezo.org'] } },
});

const client = createPublicClient({ chain: mezoTestnet, transport: http() });

const HINT_HELPERS = '0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6';
const SORTED_TROVES = '0x722E4D24FD6Ff8b0AC679450F3D91294607268fA';

const abiHH = [
  {
    type: 'function',
    name: 'getApproxHint',
    inputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
    outputs: [{ type: 'address' }, { type: 'uint256' }, { type: 'uint256' }],
    stateMutability: 'view',
  },
];

const abiST = [
  {
    type: 'function',
    name: 'findInsertPosition',
    inputs: [{ type: 'uint256' }, { type: 'address' }, { type: 'address' }],
    outputs: [{ type: 'address' }, { type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'validInsertPosition',
    inputs: [{ type: 'uint256' }, { type: 'address' }, { type: 'address' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
];

async function main() {
  const coll = parseUnits('0.04', 18);
  const totalDebt = parseUnits('2009', 18);
  const nicr = (coll * 100000000000000000000n) / totalDebt;
  console.log('Target NICR:', nicr.toString());

  for (let seed = 1n; seed <= 5n; seed++) {
    const approx = await client.readContract({
      address: HINT_HELPERS,
      abi: abiHH,
      functionName: 'getApproxHint',
      args: [nicr, 100n, seed],
    });

    const pos = await client.readContract({
      address: SORTED_TROVES,
      abi: abiST,
      functionName: 'findInsertPosition',
      args: [nicr, approx[0], approx[0]],
    });

    const isValid = await client.readContract({
      address: SORTED_TROVES,
      abi: abiST,
      functionName: 'validInsertPosition',
      args: [nicr, pos[0], pos[1]],
    });

    console.log(`Seed ${seed}: approx=${approx[0]}, upper=${pos[0]}, lower=${pos[1]}, valid=${isValid}`);
    if (isValid) {
      console.log('SUCCESS: Valid hints verified by SortedTroves!');
      return;
    }
  }
}

main().catch(console.error);
