import { supabase } from '@/integrations/supabase/client';
import { useWallet } from '@/contexts/WalletContext';
import { toast } from 'sonner';
import { useWithdrawalRequest } from './use-withdrawal-request';

export const usePoolActions = () => {
  const { createWithdrawalRequest } = useWithdrawalRequest();
  const { walletAddress, connected } = useWallet();

  const stake = async (poolId: string, poolType: string, amount: number) => {
    if (!connected || !walletAddress) {
      toast.error('Please connect your wallet');
      return false;
    }

    try {
      toast.loading('Validating stake...', { id: 'stake' });

      // Use secure edge function that validates on-chain balance
      const { data, error } = await supabase.functions.invoke('stake-tokens', {
        body: {
          walletAddress,
          poolId,
          poolType,
          amount
        }
      });

      toast.dismiss('stake');

      if (error || !data?.success) {
        toast.error(data?.error || 'Failed to stake');
        return false;
      }

      toast.success('Staked successfully!');
      return true;
    } catch (error) {
      toast.dismiss('stake');
      console.error('Stake error:', error);
      toast.error('Failed to stake');
      return false;
    }
  };

  const unstake = async (poolId: string, poolType: string, amount: number) => {
    // Unstaking is handled automatically - when users sell tokens, 
    // the distribute-rewards function auto-adjusts their staked position
    toast.info('Your staking position auto-adjusts based on your wallet balance');
    return true;
  };

  const claimRewards = async (poolId: string, poolType: string, amount?: number) => {
    if (!connected || !walletAddress) {
      toast.error('Please connect your wallet');
      return false;
    }

    // Check for Phantom wallet
    const phantom = (window as any).phantom?.solana;
    if (!phantom?.isPhantom) {
      toast.error('Phantom wallet required to claim rewards');
      return false;
    }

    try {
      let rewardsAmount = amount || 0;
      let tokenSymbol = '';
      let tokenAddress = '';

      // Handle different pool types - GET INFO ONLY, don't modify yet
      if (poolType === 'staking') {
        const { data: stake } = await supabase
          .from('user_stakes')
          .select('*')
          .eq('wallet_address', walletAddress)
          .eq('pool_type', poolType)
          .eq('pool_id', poolId)
          .single();

        if (!stake || stake.pending_rewards <= 0) {
          toast.error('No rewards to claim');
          return false;
        }

        rewardsAmount = stake.pending_rewards;

        const { data: pool } = await supabase
          .from('staking_pools')
          .select('token_symbol, contract_address')
          .eq('id', poolId)
          .single();
        tokenSymbol = pool?.token_symbol || '';
        tokenAddress = pool?.contract_address || '';

      } else if (poolType === 'burn') {
        const { data: burnReward } = await supabase
          .from('burn_rewards')
          .select('claimable_balance')
          .eq('pool_id', poolId)
          .eq('wallet_address', walletAddress)
          .single();

        if (!burnReward || burnReward.claimable_balance <= 0) {
          toast.error('No rewards to claim');
          return false;
        }

        rewardsAmount = amount || burnReward.claimable_balance;

        const { data: pool } = await supabase
          .from('burn_pools')
          .select('token_symbol, contract_address')
          .eq('id', poolId)
          .single();
        tokenSymbol = pool?.token_symbol || '';
        tokenAddress = pool?.contract_address || '';

      } else if (poolType === 'race') {
        const { data: pool } = await supabase
          .from('race_pools')
          .select('token_symbol, contract_address')
          .eq('id', poolId)
          .single();
        tokenSymbol = pool?.token_symbol || '';
        tokenAddress = pool?.contract_address || '';

      } else if (poolType === 'social_farming') {
        const { data: stake } = await supabase
          .from('user_stakes')
          .select('*')
          .eq('wallet_address', walletAddress)
          .eq('pool_type', poolType)
          .eq('pool_id', poolId)
          .single();

        if (!stake || stake.pending_rewards <= 0) {
          toast.error('No rewards to claim');
          return false;
        }

        rewardsAmount = stake.pending_rewards;

        const { data: pool } = await supabase
          .from('social_farming_pools')
          .select('token_symbol, contract_address')
          .eq('id', poolId)
          .single();
        tokenSymbol = pool?.token_symbol || '';
        tokenAddress = pool?.contract_address || '';
      }

      if (rewardsAmount <= 0) {
        toast.error('No rewards to claim');
        return false;
      }

      // Create withdrawal request
      const result = await createWithdrawalRequest({
        walletAddress,
        feature: poolType as 'staking' | 'race' | 'burn' | 'social_farming',
        amount: rewardsAmount,
        tokenSymbol,
        tokenAddress,
        poolId
      });

       if (!result) {
         return false;
       }

       // Record transaction as pending
       await supabase.from('transactions').insert({
         wallet_address: walletAddress,
         pool_type: poolType,
         pool_id: poolId,
         type: 'claim',
         amount: rewardsAmount,
         status: 'pending',
       });

      // Get partially-signed transaction from edge function
      toast.loading('Preparing transaction...', { id: 'payout' });
      
      const { data: payoutResult, error: payoutError } = await supabase.functions.invoke('process-claim-payout', {
        body: { 
          withdrawalRequestId: result.id,
          userWalletAddress: walletAddress
        }
      });

      if (payoutError || !payoutResult?.success) {
        toast.dismiss('payout');
        console.error('Payout error:', payoutError || payoutResult?.error);

        // Sometimes the payout actually succeeds but the response errors/timeouts.
        // Before cancelling, re-check the request status.
        const { data: latestRequest } = await supabase
          .from('withdrawal_requests')
          .select('status, tx_hash, admin_notes')
          .eq('id', result.id)
          .maybeSingle();

        if (latestRequest?.status === 'completed' && latestRequest?.tx_hash) {
          toast.success(`Rewards claimed! TX: ${latestRequest.tx_hash.slice(0, 8)}...`);
          return true;
        }

        if (latestRequest?.status === 'processing' && latestRequest?.tx_hash) {
          toast.message('Claim submitted — waiting for confirmation', {
            description: `TX: ${latestRequest.tx_hash.slice(0, 8)}...`,
          });
          return true;
        }

        // Only cancel if backend never submitted anything.
        await supabase
          .from('withdrawal_requests')
          .update({
            status: 'cancelled',
            admin_notes: payoutResult?.error || 'Payout preparation failed',
          })
          .eq('id', result.id);

        toast.error(payoutResult?.error || 'Failed to prepare transaction');
        return false;
      }

      toast.dismiss('payout');

      // Backend now handles everything: sign, submit, confirm, reset balances
      if (payoutResult?.txHash) {
        const signature = payoutResult.txHash as string;
        toast.success(`Rewards claimed! TX: ${signature.slice(0, 8)}...`);
        return true;
      }

      // If no txHash, something went wrong
      toast.error('Payout failed - no transaction returned');
      return false;

    } catch (error) {
      console.error('Claim error:', error);
      toast.error('Failed to claim rewards');
      return false;
    }
  };

  const burn = async (poolId: string, amount: number) => {
    if (!connected || !walletAddress) {
      toast.error('Please connect your wallet');
      return false;
    }

    try {
      // Update burn pool stats
      const { data: pool } = await supabase
        .from('burn_pools')
        .select('*')
        .eq('id', poolId)
        .single();

      if (pool) {
        // Check if user already burned in this pool
        const { data: existingStake } = await supabase
          .from('user_stakes')
          .select('*')
          .eq('wallet_address', walletAddress)
          .eq('pool_type', 'burn')
          .eq('pool_id', poolId)
          .maybeSingle();

        const isNewParticipant = !existingStake;

        await supabase
          .from('burn_pools')
          .update({ 
            total_burned: pool.total_burned + amount,
            participants: isNewParticipant ? pool.participants + 1 : pool.participants
          })
          .eq('id', poolId);

        if (existingStake) {
          await supabase
            .from('user_stakes')
            .update({ amount: existingStake.amount + amount })
            .eq('id', existingStake.id);
        } else {
          await supabase.from('user_stakes').insert({
            wallet_address: walletAddress,
            pool_type: 'burn',
            pool_id: poolId,
            amount: amount,
            pending_rewards: 0,
            points: 0
          });
        }
      }

      // Record transaction
      await supabase.from('transactions').insert({
        wallet_address: walletAddress,
        pool_type: 'burn',
        pool_id: poolId,
        type: 'burn',
        amount: amount,
        status: 'completed'
      });

      toast.success(`Burned ${amount} tokens!`);
      return true;
    } catch (error) {
      console.error('Burn error:', error);
      toast.error('Failed to burn tokens');
      return false;
    }
  };

  return { stake, unstake, claimRewards, burn };
};
