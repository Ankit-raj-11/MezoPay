export interface VerifiedMerchant {
  name: string;
  handle: string;
  category: string;
  logo: string;
  verified: boolean;
}

export const VERIFIED_MERCHANTS: Record<string, VerifiedMerchant> = {
  chaipoint: {
    name: 'Chai Point',
    handle: 'chaipoint',
    category: 'Food & Beverage',
    logo: '☕',
    verified: true,
  },
  blue_tokai: {
    name: 'Blue Tokai Coffee',
    handle: 'blue_tokai',
    category: 'Café & Roastery',
    logo: '☕',
    verified: true,
  },
  satoshi_books: {
    name: 'Satoshi Books & Cafe',
    handle: 'satoshi_books',
    category: 'Books & Stationery',
    logo: '📚',
    verified: true,
  },
  mezo_merch: {
    name: 'Mezo Swag & Hardware',
    handle: 'mezo_merch',
    category: 'Official Merchandise',
    logo: '⚡',
    verified: true,
  },
};
