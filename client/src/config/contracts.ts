import nameRegistryAbi from '../abis/MezoNameRegistry.json';
import paymentCoreAbi from '../abis/MezoPaymentCore.json';

export const MEZO_TESTNET_CHAIN_ID = 31611;

export const CONTRACT_ADDRESSES = {
  // Verified native Mezo testnet protocol contracts
  MUSD: '0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503' as `0x${string}`,
  BORROWER_OPERATIONS: '0xCdF7028ceAB81fA0C6971208e83fa7872994beE5' as `0x${string}`,
  TROVE_MANAGER: '0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0' as `0x${string}`,
  PRICE_FEED: '0x86bCF0841622a5dAC14A313a15f96A95421b9366' as `0x${string}`,
  SORTED_TROVES: '0x722E4D24FD6Ff8b0AC679450F3D91294607268fA' as `0x${string}`,
  HINT_HELPERS: '0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6' as `0x${string}`,

  // MezoPay custom contracts deployed live on Mezo Testnet (Chain ID 31611)
  NAME_REGISTRY: (import.meta.env.VITE_NAME_REGISTRY_ADDRESS || '0x2068372B91fa992Ac01277F27835244530A46299') as `0x${string}`,
  PAYMENT_CORE: (import.meta.env.VITE_PAYMENT_CORE_ADDRESS || '0x9c09b398d34481Dd65CdCDB07090FF2F2CC9E5f6') as `0x${string}`,
  MOCK_TARGET: (import.meta.env.VITE_MOCK_TARGET_ADDRESS || '0x7617Bbb75f203c7d181B45B632F548eF1406A26d') as `0x${string}`,
};

export const NAME_REGISTRY_ABI = nameRegistryAbi;
export const PAYMENT_CORE_ABI = paymentCoreAbi;

export const ERC20_ABI = [
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const;

export const TROVE_MANAGER_ABI = [
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
  {
    type: 'function',
    name: 'getCurrentICR',
    inputs: [
      { name: '_borrower', type: 'address' },
      { name: '_price', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTroveStatus',
    inputs: [{ name: '_borrower', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

export const PRICE_FEED_ABI = [
  {
    type: 'function',
    name: 'fetchPrice',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'lastGoodPrice',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;
