import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SECURITY: Check if wallet is blocked
async function isWalletBlocked(supabase: any, walletAddress: string): Promise<{ blocked: boolean; reason?: string }> {
  const { data } = await supabase
    .from('blocked_wallets')
    .select('reason')
    .eq('wallet_address', walletAddress)
    .eq('is_active', true)
    .single();
  
  if (data) {
    return { blocked: true, reason: data.reason };
  }
  return { blocked: false };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { poolId, walletAddress, burnAmount, burnTxHash } = await req.json();

    console.log('Burn gamble request:', { poolId, walletAddress, burnAmount, burnTxHash });

    // Validate required fields
    if (!poolId || !walletAddress || !burnAmount || !burnTxHash) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Validate burnAmount is positive and reasonable
    if (burnAmount <= 0 || burnAmount > 1000000000) { // Max 1B tokens per burn
      console.error(`SECURITY: Invalid burn amount: ${burnAmount}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid burn amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Validate txHash format
    if (!burnTxHash || burnTxHash.length < 80 || burnTxHash.length > 100) {
      console.error('SECURITY: Invalid txHash format');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid transaction hash format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // SECURITY: Check if wallet is blocked
    const blockCheck = await isWalletBlocked(supabase, walletAddress);
    if (blockCheck.blocked) {
      console.error(`SECURITY: Blocked wallet ${walletAddress} attempted burn gamble`);
      return new Response(
        JSON.stringify({ success: false, error: 'This wallet has been suspended' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    // Verify the pool exists and is active
    const { data: pool, error: poolError } = await supabase
      .from('burn_pools')
      .select('*')
      .eq('id', poolId)
      .single();

    if (poolError || !pool) {
      console.error('Pool not found:', poolError);
      return new Response(
        JSON.stringify({ success: false, error: 'Pool not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (pool.status === 'completed') {
      return new Response(
        JSON.stringify({ success: false, error: 'Pool is completed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this burn tx has already been processed (prevent replay attacks)
    const { data: existingTx } = await supabase
      .from('burn_transactions')
      .select('id')
      .eq('pool_id', poolId)
      .eq('wallet_address', walletAddress)
      .eq('burn_amount', burnAmount)
      .gte('created_at', new Date(Date.now() - 60000).toISOString()) // Within last minute
      .limit(1);

    if (existingTx && existingTx.length > 0) {
      console.warn('Duplicate burn transaction detected');
      return new Response(
        JSON.stringify({ success: false, error: 'Transaction already processed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate potential win against available rewards
    const potentialWin = burnAmount * 2;
    const availableRewards = pool.reward_supply - pool.total_paid_out;
    
    if (potentialWin > availableRewards) {
      return new Response(
        JSON.stringify({ success: false, error: 'Insufficient rewards in pool' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate secure random outcome using crypto API (server-side only)
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    
    // Use multiple bytes for better randomness distribution
    const randomValue = randomBytes.reduce((acc, byte) => acc + byte, 0) / (32 * 255);
    const won = randomValue >= 0.5;
    const result = won ? 'win' : 'lose';
    const rewardAmount = won ? burnAmount * 2 : 0;

    console.log('Game result:', { result, randomValue: randomValue.toFixed(4), rewardAmount });

    // Record the burn transaction
    const { error: txError } = await supabase
      .from('burn_transactions')
      .insert({
        pool_id: poolId,
        wallet_address: walletAddress,
        burn_amount: burnAmount,
        result,
        reward_amount: rewardAmount,
      });

    if (txError) {
      console.error('Failed to record transaction:', txError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to record transaction' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update or create user rewards
    const { data: existingRewards } = await supabase
      .from('burn_rewards')
      .select('*')
      .eq('pool_id', poolId)
      .eq('wallet_address', walletAddress)
      .single();

    if (existingRewards) {
      await supabase
        .from('burn_rewards')
        .update({
          claimable_balance: existingRewards.claimable_balance + rewardAmount,
          total_burned: existingRewards.total_burned + burnAmount,
          total_won: existingRewards.total_won + (won ? rewardAmount : 0),
          total_lost: existingRewards.total_lost + (won ? 0 : burnAmount),
          wins_count: existingRewards.wins_count + (won ? 1 : 0),
          losses_count: existingRewards.losses_count + (won ? 0 : 1),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingRewards.id);
    } else {
      await supabase
        .from('burn_rewards')
        .insert({
          pool_id: poolId,
          wallet_address: walletAddress,
          claimable_balance: rewardAmount,
          total_burned: burnAmount,
          total_won: won ? rewardAmount : 0,
          total_lost: won ? 0 : burnAmount,
          wins_count: won ? 1 : 0,
          losses_count: won ? 0 : 1,
        });

      // Increment participants count
      await supabase
        .from('burn_pools')
        .update({ participants: pool.participants + 1 })
        .eq('id', poolId);
    }

    // Update pool stats
    const newTotalBurned = pool.total_burned + burnAmount;
    const newTotalPaidOut = pool.total_paid_out + rewardAmount;
    const poolUpdate: Record<string, unknown> = {
      total_burned: newTotalBurned,
      total_paid_out: newTotalPaidOut,
      updated_at: new Date().toISOString(),
    };

    // Check if pool should be marked as completed
    if (newTotalPaidOut >= pool.reward_supply) {
      poolUpdate.status = 'completed';
    }

    await supabase
      .from('burn_pools')
      .update(poolUpdate)
      .eq('id', poolId);

    console.log('Burn gamble completed successfully:', { result, rewardAmount });

    return new Response(
      JSON.stringify({
        success: true,
        result,
        won,
        rewardAmount,
        burnAmount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Burn gamble error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
