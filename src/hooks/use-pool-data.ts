import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWallet as useCustomWallet } from '@/contexts/WalletContext';

// Token info is now embedded in each pool table

interface StakingPool {
  id: string;
  token_id: string | null;
  contract_address: string;
  apr: number;
  total_staked: number;
  allocation: number;
  min_stake: number;
  lock_period_days: number;
  reward_frequency_value: number;
  reward_frequency_unit: string;
  status: string;
  rewards_distributed: number;
  last_distribution_at: string;
  // Embedded token fields
  token_name: string | null;
  token_symbol: string | null;
  token_logo_url: string | null;
  token_decimals: number | null;
  token_total_supply: number | null;
}

interface BurnPool {
  id: string;
  token_id: string | null;
  contract_address: string | null;
  total_burned: number;
  burn_value: number;
  participants: number;
  status: string;
  reward_supply: number;
  total_paid_out: number;
  creator_wallet: string | null;
  // Embedded token fields
  token_name: string | null;
  token_symbol: string | null;
  token_logo_url: string | null;
  token_decimals: number | null;
  token_total_supply: number | null;
}

interface RacePool {
  id: string;
  token_id: string | null;
  prize_pool: number;
  total_participants: number;
  time_remaining_hours: number;
  status: string;
  contract_address: string | null;
  current_round: number | null;
  total_rounds: number | null;
  daily_reward_amount: number | null;
  round_started_at: string | null;
  entry_snapshot_at: string | null;
  snapshot_status: string | null;
  creator_wallet: string | null;
  // Embedded token fields
  token_name: string | null;
  token_symbol: string | null;
  token_logo_url: string | null;
  token_decimals: number | null;
  token_total_supply: number | null;
}

interface SocialFarmingPool {
  id: string;
  token_id: string | null;
  total_points: number;
  reward_pool: number;
  participants: number;
  status: string;
  contract_address: string | null;
  creator_wallet: string | null;
  tasks: unknown;
  default_points_per_task: number | null;
  custom_points_per_task: number | null;
  // Embedded token fields
  token_name: string | null;
  token_symbol: string | null;
  token_logo_url: string | null;
  token_decimals: number | null;
  token_total_supply: number | null;
}

interface SafuPool {
  id: string;
  contract_address: string;
  token_name: string;
  token_symbol: string;
  token_logo_url: string | null;
  token_decimals: number | null;
  token_total_supply: number | null;
  creator_wallet: string | null;
  locked_amount: number;
  lock_percentage: number;
  lock_duration_days: number;
  unlock_date: string | null;
  status: string;
  participants: number;
  total_value_locked: number;
}

interface UserStake {
  id: string;
  wallet_address: string;
  pool_type: string;
  pool_id: string;
  amount: number;
  pending_rewards: number;
  points: number;
  rank: number | null;
  joined_at: string;
}

interface Transaction {
  id: string;
  wallet_address: string;
  pool_type: string;
  pool_id: string;
  type: string;
  amount: number;
  tx_hash: string | null;
  status: string;
  created_at: string;
}

// Helper to get token info from any pool type
export const usePoolToken = (poolType: string, identifier?: string) => {
  const [tokenInfo, setTokenInfo] = useState<{
    name: string;
    symbol: string;
    logo_url: string | null;
    contract_address: string;
    decimals: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTokenInfo = async () => {
      if (!identifier) {
        setTokenInfo(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      let poolData = null;

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

      try {
        if (poolType === 'staking') {
          const { data } = await supabase
            .from('staking_pools')
            .select('token_name, token_symbol, token_logo_url, token_decimals, contract_address')
            .or(isUUID ? `id.eq.${identifier}` : `contract_address.eq.${identifier}`)
            .maybeSingle();
          poolData = data;
        } else if (poolType === 'burn') {
          const { data } = await supabase
            .from('burn_pools')
            .select('token_name, token_symbol, token_logo_url, token_decimals, contract_address')
            .or(isUUID ? `id.eq.${identifier}` : `contract_address.eq.${identifier}`)
            .maybeSingle();
          poolData = data;
        } else if (poolType === 'race') {
          const { data } = await supabase
            .from('race_pools')
            .select('token_name, token_symbol, token_logo_url, token_decimals, contract_address')
            .or(isUUID ? `id.eq.${identifier}` : `contract_address.eq.${identifier}`)
            .maybeSingle();
          poolData = data;
        } else if (poolType === 'social') {
          const { data } = await supabase
            .from('social_farming_pools')
            .select('token_name, token_symbol, token_logo_url, token_decimals, contract_address')
            .or(isUUID ? `id.eq.${identifier}` : `contract_address.eq.${identifier}`)
            .maybeSingle();
          poolData = data;
        } else if (poolType === 'safu') {
          const { data } = await supabase
            .from('safu_pools')
            .select('token_name, token_symbol, token_logo_url, token_decimals, contract_address')
            .or(isUUID ? `id.eq.${identifier}` : `contract_address.eq.${identifier}`)
            .maybeSingle();
          poolData = data;
        }

        if (poolData) {
          setTokenInfo({
            name: poolData.token_name || 'Unknown',
            symbol: poolData.token_symbol || 'UNK',
            logo_url: poolData.token_logo_url,
            contract_address: poolData.contract_address || '',
            decimals: poolData.token_decimals || 9
          });
        } else {
          setTokenInfo(null);
        }
      } catch (error) {
        console.error('Error fetching token info:', error);
        setTokenInfo(null);
      }

      setLoading(false);
    };

    fetchTokenInfo();
  }, [poolType, identifier]);

  return { tokenInfo, loading };
};

// Deprecated - kept for backward compatibility, now returns null
export const useMainToken = (identifier?: string) => {
  return { token: null, loading: false };
};

export const useStakingPool = (identifier?: string) => {
  const [pool, setPool] = useState<StakingPool | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!identifier) {
      setPool(null);
      setLoading(false);
      return;
    }

    const fetchPool = async () => {
      setLoading(true);
      
      let data = null;
      let error = null;
      
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
      
      if (isUUID) {
        const result = await supabase
          .from('staking_pools')
          .select('*')
          .eq('id', identifier)
          .maybeSingle();
        data = result.data;
        error = result.error;
      }
      
      if (!data) {
        const result = await supabase
          .from('staking_pools')
          .select('*')
          .eq('contract_address', identifier)
          .eq('status', 'active')
          .maybeSingle();
        data = result.data;
        error = result.error;
      }

      if (!error && data) {
        setPool(data as StakingPool);
      } else {
        setPool(null);
      }
      setLoading(false);
    };

    fetchPool();

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    const filterField = isUUID ? 'id' : 'contract_address';
    
    const channel = supabase
      .channel(`staking-pool-${identifier}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'staking_pools',
          filter: `${filterField}=eq.${identifier}`
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setPool(payload.new as StakingPool);
          } else if (payload.eventType === 'DELETE') {
            setPool(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [identifier]);

  return { pool, loading };
};

export const useBurnPool = (identifier?: string) => {
  const [pool, setPool] = useState<BurnPool | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPool = async () => {
      if (!identifier) {
        setPool(null);
        setLoading(false);
        return;
      }

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

      let data = null;
      
      if (isUUID) {
        const result = await supabase
          .from('burn_pools')
          .select('*')
          .eq('id', identifier)
          .maybeSingle();
        data = result.data;
      }
      
      if (!data) {
        const result = await supabase
          .from('burn_pools')
          .select('*')
          .eq('contract_address', identifier)
          .eq('status', 'active')
          .maybeSingle();
        data = result.data;
      }

      if (data) {
        setPool(data as BurnPool);
      } else {
        setPool(null);
      }
      setLoading(false);
    };

    fetchPool();
  }, [identifier]);

  return { pool, loading };
};

export const useRacePool = (identifier?: string) => {
  const [pool, setPool] = useState<RacePool | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPool = async () => {
      if (!identifier) {
        setPool(null);
        setLoading(false);
        return;
      }

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

      let data = null;
      
      if (isUUID) {
        const result = await supabase
          .from('race_pools')
          .select('*')
          .eq('id', identifier)
          .maybeSingle();
        data = result.data;
      }
      
      if (!data) {
        const result = await supabase
          .from('race_pools')
          .select('*')
          .eq('contract_address', identifier)
          .eq('status', 'active')
          .maybeSingle();
        data = result.data;
      }

      if (data) {
        setPool(data as RacePool);
      } else {
        setPool(null);
      }
      setLoading(false);
    };

    fetchPool();
  }, [identifier]);

  return { pool, loading };
};

export const useSocialFarmingPool = (identifier?: string) => {
  const [pool, setPool] = useState<SocialFarmingPool | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPool = async () => {
      if (!identifier) {
        setPool(null);
        setLoading(false);
        return;
      }

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

      let data = null;
      
      if (isUUID) {
        const result = await supabase
          .from('social_farming_pools')
          .select('*')
          .eq('id', identifier)
          .maybeSingle();
        data = result.data;
      }
      
      if (!data) {
        const result = await supabase
          .from('social_farming_pools')
          .select('*')
          .eq('contract_address', identifier)
          .eq('status', 'active')
          .maybeSingle();
        data = result.data;
      }

      if (data) {
        setPool(data as SocialFarmingPool);
      } else {
        setPool(null);
      }
      setLoading(false);
    };

    fetchPool();
  }, [identifier]);

  return { pool, loading };
};

export const useSafuPool = (identifier?: string) => {
  const [pool, setPool] = useState<SafuPool | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPool = async () => {
      if (!identifier) {
        setPool(null);
        setLoading(false);
        return;
      }

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

      let data = null;
      
      if (isUUID) {
        const result = await supabase
          .from('safu_pools')
          .select('*')
          .eq('id', identifier)
          .maybeSingle();
        data = result.data;
      }
      
      if (!data) {
        const result = await supabase
          .from('safu_pools')
          .select('*')
          .eq('contract_address', identifier)
          .maybeSingle();
        data = result.data;
      }

      if (data) {
        setPool(data as SafuPool);
      } else {
        setPool(null);
      }
      setLoading(false);
    };

    fetchPool();
  }, [identifier]);

  return { pool, loading };
};

export const useUserStake = (poolType: string, poolId: string | undefined) => {
  const { walletAddress } = useCustomWallet();
  const [stake, setStake] = useState<UserStake | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!walletAddress || !poolId) {
      setStake(null);
      setLoading(false);
      return;
    }

    const fetchStake = async () => {
      const { data, error } = await supabase
        .from('user_stakes')
        .select('*')
        .eq('wallet_address', walletAddress)
        .eq('pool_type', poolType)
        .eq('pool_id', poolId)
        .maybeSingle();

      if (!error && data) {
        setStake(data as UserStake);
      } else {
        setStake(null);
      }
      setLoading(false);
    };

    fetchStake();

    const channel = supabase
      .channel(`user-stake-${poolId}-${walletAddress}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_stakes',
          filter: `pool_id=eq.${poolId}`
        },
        (payload) => {
          const newData = payload.new as UserStake;
          if (newData && newData.wallet_address === walletAddress && newData.pool_type === poolType) {
            if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
              setStake(newData);
            } else if (payload.eventType === 'DELETE') {
              setStake(null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [walletAddress, poolType, poolId]);

  return { stake, loading };
};

export const useUserTransactions = (poolType: string, poolId: string | undefined) => {
  const { walletAddress } = useCustomWallet();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = async () => {
    if (!walletAddress || !poolId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('wallet_address', walletAddress)
      .eq('pool_type', poolType)
      .eq('pool_id', poolId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTransactions(data as Transaction[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTransactions();

    if (walletAddress && poolId) {
      const channel = supabase
        .channel(`transactions-${poolId}-${walletAddress}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'transactions',
            filter: `pool_id=eq.${poolId}`
          },
          (payload) => {
            const newTx = payload.new as Transaction;
            if (newTx.wallet_address === walletAddress && newTx.pool_type === poolType) {
              setTransactions(prev => [newTx, ...prev]);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'transactions',
            filter: `pool_id=eq.${poolId}`
          },
          (payload) => {
            const updatedTx = payload.new as Transaction;
            if (updatedTx.wallet_address === walletAddress && updatedTx.pool_type === poolType) {
              setTransactions(prev => 
                prev.map(tx => tx.id === updatedTx.id ? updatedTx : tx)
              );
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [walletAddress, poolType, poolId]);

  return { transactions, loading, refetch: fetchTransactions };
};
