import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

interface CreateWithdrawalRequestParams {
  walletAddress: string;
  feature: 'staking' | 'race' | 'burn' | 'social_farming';
  amount: number;
  tokenSymbol: string;
  tokenAddress: string;
  poolId: string;
}

interface WithdrawalRequest {
  id: string;
  wallet_address: string;
  feature: string;
  request_type: string;
  amount: number;
  token_symbol: string;
  token_address: string;
  pool_id: string;
  status: string;
  tx_hash: string | null;
  created_at: string;
}

export function useWithdrawalRequest() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const createWithdrawalRequest = async (params: CreateWithdrawalRequestParams): Promise<WithdrawalRequest | null> => {
    setIsLoading(true);

    try {
      // Prevent duplicate claims while one is pending/processing
      const { data: existing } = await supabase
        .from('withdrawal_requests')
        .select('id, status, created_at')
        .eq('wallet_address', params.walletAddress)
        .eq('pool_id', params.poolId)
        .eq('feature', params.feature)
        .eq('request_type', 'claim')
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (existing) {
        toast({
          title: 'Claim already in progress',
          description: 'Please wait — a previous claim is still pending/processing.',
        });
        return null;
      }

      const { data, error } = await supabase
        .from('withdrawal_requests')
        .insert({
          wallet_address: params.walletAddress,
          feature: params.feature,
          request_type: 'claim',
          amount: params.amount,
          token_symbol: params.tokenSymbol,
          token_address: params.tokenAddress,
          pool_id: params.poolId,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Claim Request Submitted',
        description: 'Your claim request has been submitted.',
      });

      return data;
    } catch (error: any) {
      console.error('Error creating withdrawal request:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit withdrawal request. Please try again.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };
  const getWithdrawalRequests = async (walletAddress: string): Promise<WithdrawalRequest[]> => {
    try {
      const { data, error } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching withdrawal requests:', error);
      return [];
    }
  };

  const getRequestStatus = async (requestId: string): Promise<WithdrawalRequest | null> => {
    try {
      const { data, error } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error fetching request status:', error);
      return null;
    }
  };

  return {
    isLoading,
    createWithdrawalRequest,
    getWithdrawalRequests,
    getRequestStatus
  };
}
