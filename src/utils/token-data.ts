
// src/utils/token-data.ts

export interface Token {
  id: string;
  name: string;
  symbol: string;
  description: string;
  logo: string;
  price: number;
  marketCap: number;
  volume24h: number;
  circulatingSupply: number;
  maxSupply: number;
  stakingAPR: string;
  totalStaked: number;
  holders: number;
  website: string;
  twitter: string;
  telegram: string;
  stakingOpen: boolean;
  poolSize: number;
  totalRewards: number;
  raydiumListed: boolean;
  onJupiter: boolean;
  stakingMinAmount: number;
  stakingLockPeriod: number;
  stakingRewardEmission: string;
  aprTier1: number;
  aprTier2: number;
  aprTier3: number;
}

// Define the TokenMetadata interface for token submission
export interface TokenMetadata {
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals?: number;
  totalSupply: string;
  holders: number;
  transactions?: number;
  price?: number;
  marketCap?: number;
  volume?: number;
  status: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  image?: string;
  createdAt?: string;
  lastActivity?: string;
  tokenAddress?: string;
}

// Function to fetch token metadata from API
export const fetchTokenMetadata = async (address: string): Promise<TokenMetadata> => {
  console.log(`Fetching metadata for token at address: ${address}`);
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Return data based on the address
  const data: TokenMetadata = {
    tokenName: `Token_${address.substring(0, 6)}`,
    tokenSymbol: address.substring(0, 4).toUpperCase(),
    tokenDecimals: 9,
    totalSupply: "1,000,000,000",
    holders: Math.floor(Math.random() * 5000) + 100,
    transactions: Math.floor(Math.random() * 10000) + 500,
    price: Math.random() * 0.1,
    marketCap: Math.random() * 5000000,
    volume: Math.floor(Math.random() * 1000000) + 10000,
    status: Math.random() > 0.7 ? "On Raydium" : "Pre-Raydium",
    website: "https://example.com",
    twitter: "https://twitter.com/example",
    telegram: "https://t.me/example",
    image: `https://picsum.photos/200/200?random=${Math.floor(Math.random() * 100)}`,
    createdAt: new Date().toISOString().split('T')[0],
    lastActivity: new Date().toISOString().split('T')[0]
  };
  
  return data;
};

// Empty arrays - tokens are now fetched from database
export const generateMockTokens = () => [];
export const mockTokens: Token[] = [];
