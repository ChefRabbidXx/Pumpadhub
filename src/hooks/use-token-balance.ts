import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { supabase } from '@/integrations/supabase/client';

export const useTokenBalance = (contractAddress?: string) => {
  const { walletAddress, connected } = useWallet();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [tokenMintAddress, setTokenMintAddress] = useState<string | null>(null);

  // First, resolve the token mint address from the pool's contract_address
  useEffect(() => {
    const resolveTokenAddress = async () => {
      if (!contractAddress) {
        setTokenMintAddress(null);
        setLoading(false);
        return;
      }
      
      // Check if it's a staking pool contract_address and get the token mint
      const { data: poolData } = await supabase
        .from('staking_pools')
        .select('contract_address')
        .eq('contract_address', contractAddress)
        .maybeSingle();

      if (poolData) {
        setTokenMintAddress(poolData.contract_address);
      } else {
        // Fallback to the provided contractAddress
        setTokenMintAddress(contractAddress);
      }
    };

    resolveTokenAddress();
  }, [contractAddress]);

  const fetchBalance = useCallback(async () => {
    if (!walletAddress || !connected || !tokenMintAddress) {
      setBalance(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Call the edge function to fetch balance using Helius API
      const { data, error } = await supabase.functions.invoke('fetch-token-balance', {
        body: {
          walletAddress,
          tokenAddress: tokenMintAddress
        }
      });

      if (error) {
        console.error('Error fetching token balance:', error);
        setBalance(0);
      } else if (data?.success) {
        setBalance(data.balance || 0);
      } else {
        console.error('Balance fetch failed:', data?.error);
        setBalance(0);
      }
    } catch (error) {
      console.error('Error fetching token balance:', error);
      setBalance(0);
    } finally {
      setLoading(false);
    }
  }, [walletAddress, connected, tokenMintAddress]);

  useEffect(() => {
    fetchBalance();

    // Refresh balance every 30 seconds
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  return { balance, loading, connected, refetch: fetchBalance };
};
