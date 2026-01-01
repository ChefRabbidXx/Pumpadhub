// Helius RPC configuration for Solana mainnet
// Using Helius for reliable RPC access and to avoid Phantom spam detection

export const HELIUS_RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=548076a1-3518-4df1-96c3-f4ee39feee3a';

// Fallback RPCs (used if Helius fails)
export const FALLBACK_RPCS = [
  'https://rpc.ankr.com/solana',
  'https://solana-mainnet.g.alchemy.com/v2/demo'
];

export const getMainnetRpcUrl = (): string => {
  return HELIUS_RPC_URL;
};
