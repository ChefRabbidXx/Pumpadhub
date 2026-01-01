import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const PUMPAD_TOKEN_ADDRESS = '2FWWHi5NLVj6oXkAyWAtqjBZ6CNRCX8QM8yUtRVNpump';
const TOKEN_DECIMALS = 6;

export interface HolderInfo {
  balance: number;
  badge: string;
  emoji: string;
  color: string;
  tier: number;
  bgGlow: string;
  borderColor: string;
}

export const getHolderBadge = (balance: number): { badge: string; emoji: string; color: string; tier: number; bgGlow: string; borderColor: string } => {
  if (balance >= 10_000_000) {
    return { 
      badge: 'Whale', 
      emoji: '🐋', 
      color: 'text-blue-400',
      tier: 4,
      bgGlow: 'bg-gradient-to-br from-blue-500/30 via-cyan-500/20 to-blue-600/30 shadow-[0_0_20px_rgba(59,130,246,0.5)]',
      borderColor: 'border-blue-400/60'
    };
  } else if (balance >= 5_000_000) {
    return { 
      badge: 'Shark', 
      emoji: '🦈', 
      color: 'text-cyan-400',
      tier: 3,
      bgGlow: 'bg-gradient-to-br from-cyan-500/25 via-teal-500/15 to-cyan-600/25 shadow-[0_0_15px_rgba(34,211,238,0.4)]',
      borderColor: 'border-cyan-400/50'
    };
  } else if (balance >= 1_000_000) {
    return { 
      badge: 'Fish', 
      emoji: '🐟', 
      color: 'text-green-400',
      tier: 2,
      bgGlow: 'bg-gradient-to-br from-green-500/20 via-emerald-500/10 to-green-600/20 shadow-[0_0_10px_rgba(34,197,94,0.3)]',
      borderColor: 'border-green-400/40'
    };
  } else if (balance >= 100_000) {
    return { 
      badge: 'Shrimp', 
      emoji: '🦐', 
      color: 'text-yellow-400',
      tier: 1,
      bgGlow: 'bg-card',
      borderColor: 'border-yellow-400/30'
    };
  }
  return { badge: '', emoji: '', color: '', tier: 0, bgGlow: 'bg-card', borderColor: 'border-border' };
};

export const formatBalance = (balance: number): string => {
  if (balance >= 1_000_000) return `${(balance / 1_000_000).toFixed(1)}M`;
  if (balance >= 1_000) return `${(balance / 1_000).toFixed(1)}K`;
  return balance.toLocaleString();
};

export const useHolderBadges = (walletAddresses: string[]) => {
  const [holders, setHolders] = useState<Record<string, HolderInfo>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchBalances = async () => {
      if (walletAddresses.length === 0) return;
      
      // Get unique addresses
      const uniqueAddresses = [...new Set(walletAddresses)];
      
      // Skip if we already have all addresses cached
      const uncachedAddresses = uniqueAddresses.filter(addr => !holders[addr]);
      if (uncachedAddresses.length === 0) return;
      
      setLoading(true);
      
      try {
        const { data, error } = await supabase.functions.invoke('fetch-wallet-balances', {
          body: {
            tokenAddress: PUMPAD_TOKEN_ADDRESS,
            walletAddresses: uncachedAddresses,
            decimals: TOKEN_DECIMALS
          }
        });

        if (!error && data?.success && data.balances) {
          const newHolders: Record<string, HolderInfo> = { ...holders };
          
          data.balances.forEach((item: { wallet: string; balance: number }) => {
            const badgeInfo = getHolderBadge(item.balance);
            newHolders[item.wallet] = {
              balance: item.balance,
              ...badgeInfo
            };
          });
          
          // Mark addresses with 0 balance
          uncachedAddresses.forEach(addr => {
            if (!newHolders[addr]) {
              newHolders[addr] = {
                balance: 0,
                badge: '',
                emoji: '',
                color: '',
                tier: 0,
                bgGlow: 'bg-card',
                borderColor: 'border-border'
              };
            }
          });
          
          setHolders(newHolders);
        }
      } catch (err) {
        console.error('Error fetching holder balances:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBalances();
  }, [walletAddresses.join(',')]);

  return { holders, loading };
};
