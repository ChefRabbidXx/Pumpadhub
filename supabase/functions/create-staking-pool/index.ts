import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { 
      tokenAddress,
      name,
      symbol,
      logoUrl,
      decimals,
      apr,
      minStake,
      lockPeriodDays,
      allocation,
      rewardFrequencyValue,
      rewardFrequencyUnit,
      walletAddress
    } = body;

    console.log("Creating staking pool for token:", symbol, tokenAddress);
    console.log("Request body:", JSON.stringify({ tokenAddress, name, symbol, apr, minStake, lockPeriodDays, allocation }));

    if (!tokenAddress || !name || !symbol) {
      console.error("Missing required fields:", { tokenAddress: !!tokenAddress, name: !!name, symbol: !!symbol });
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: tokenAddress, name, and symbol are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // SECURITY: Wallet address is REQUIRED for pool creation
    if (!walletAddress) {
      console.error("SECURITY: No wallet address provided for pool creation");
      return new Response(
        JSON.stringify({ success: false, error: 'Wallet address is required to create a pool' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Check if wallet is blocked
    const blockCheck = await isWalletBlocked(supabase, walletAddress);
    if (blockCheck.blocked) {
      console.error(`SECURITY: Blocked wallet ${walletAddress} attempted to create staking pool`);
      return new Response(
        JSON.stringify({ success: false, error: 'This wallet has been suspended' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if staking pool already exists for this token
    const { data: existingPool } = await supabase
      .from('staking_pools')
      .select('id')
      .eq('contract_address', tokenAddress)
      .maybeSingle();

    if (existingPool) {
      console.log("Staking pool already exists for this token");
      return new Response(
        JSON.stringify({ 
          success: true, 
          poolId: existingPool.id, 
          message: 'Pool already exists'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Validate allocation amount - cap at reasonable limits
    const validatedAllocation = Math.min(Math.max(0, allocation || 0), 1000000000); // Max 1B tokens

    // SECURITY: Pools ALWAYS start as 'pending' until deposit is verified
    // Never allow client to set status to 'active' directly
    const { data: newPool, error: poolError } = await supabase
      .from('staking_pools')
      .insert({
        contract_address: tokenAddress,
        token_name: name,
        token_symbol: symbol,
        token_logo_url: logoUrl || null,
        token_decimals: decimals || 6,
        apr: Math.min(Math.max(0, apr || 365), 10000), // Cap APR at 10000%
        min_stake: Math.max(0, minStake || 50000),
        lock_period_days: Math.max(1, lockPeriodDays || 30),
        allocation: validatedAllocation,
        reward_frequency_value: Math.max(1, rewardFrequencyValue || 1),
        reward_frequency_unit: rewardFrequencyUnit || 'hours',
        total_staked: 0,
        rewards_distributed: 0,
        status: 'pending', // ALWAYS pending - requires deposit verification
        creator_wallet: walletAddress,
        deposit_confirmed: false // ALWAYS false until verified
      })
      .select('id')
      .single();

    if (poolError) {
      console.error("Error creating staking pool:", poolError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create pool: ' + poolError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log("Created staking pool:", newPool.id, "- status: pending (awaiting deposit verification)");

    return new Response(
      JSON.stringify({ 
        success: true, 
        poolId: newPool.id,
        message: 'Staking pool created. Please deposit tokens to activate.',
        requiresDeposit: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Operation failed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
