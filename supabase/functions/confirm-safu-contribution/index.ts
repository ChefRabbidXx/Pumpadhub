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
    const { launchId, walletAddress, amount, txHash } = await req.json();

    console.log(`Confirming contribution: ${amount} SOL from ${walletAddress} for launch ${launchId}, tx: ${txHash}`);

    if (!launchId || !walletAddress || !amount || !txHash) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Validate amount range
    if (amount <= 0 || amount > 1.01) {
      console.error(`SECURITY: Invalid amount: ${amount}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Amount must be between 0 and 1 SOL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Validate txHash format
    if (!txHash || txHash.length < 80 || txHash.length > 100) {
      console.error('SECURITY: Invalid txHash format');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid transaction hash format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // SECURITY: Check if wallet is blocked
    const blockCheck = await isWalletBlocked(supabase, walletAddress);
    if (blockCheck.blocked) {
      console.error(`SECURITY: Blocked wallet ${walletAddress} attempted SAFU contribution`);
      return new Response(
        JSON.stringify({ success: false, error: 'This wallet has been suspended' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Check for duplicate txHash to prevent replay attacks
    const { data: existingTxHash } = await supabase
      .from('safu_contributions')
      .select('id')
      .eq('tx_hash', txHash)
      .single();

    if (existingTxHash) {
      console.error(`SECURITY: Duplicate txHash detected: ${txHash}`);
      return new Response(
        JSON.stringify({ success: false, error: 'This transaction has already been processed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get launch details
    const { data: launch, error: launchError } = await supabase
      .from('safu_launches')
      .select('*')
      .eq('id', launchId)
      .single();

    if (launchError || !launch) {
      console.error('Launch not found:', launchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Launch not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Verify launch is accepting contributions
    if (launch.status !== 'pending_contributions') {
      console.error(`SECURITY: Attempt to contribute to launch with status: ${launch.status}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Launch is not accepting contributions' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check existing contribution
    const { data: existingContribution } = await supabase
      .from('safu_contributions')
      .select('*')
      .eq('launch_id', launchId)
      .eq('wallet_address', walletAddress)
      .single();

    // SECURITY: Enforce 1 SOL max per user
    const currentUserContribution = existingContribution?.amount || 0;
    const newTotalUserContribution = currentUserContribution + amount;
    
    if (newTotalUserContribution > 1.01) { // Small tolerance for rounding
      console.error(`SECURITY: User ${walletAddress} exceeded 1 SOL limit. Current: ${currentUserContribution}, Attempting: ${amount}`);
      return new Response(
        JSON.stringify({ success: false, error: `Maximum contribution per user is 1 SOL. You have already contributed ${currentUserContribution.toFixed(2)} SOL` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Check if hardcap would be exceeded
    if (launch.total_contributed + amount > launch.hardcap + 0.01) { // Small tolerance
      console.error(`SECURITY: Contribution would exceed hardcap. Total: ${launch.total_contributed}, Amount: ${amount}, Hardcap: ${launch.hardcap}`);
      return new Response(
        JSON.stringify({ success: false, error: `Maximum remaining contribution is ${(launch.hardcap - launch.total_contributed).toFixed(2)} SOL` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate expected token share based on hardcap (11 SOL)
    const CONTRIBUTOR_TOKENS = 150_000_000;
    const HARDCAP = 11;
    const sharePercentage = newTotalUserContribution / HARDCAP;
    const expectedTokenShare = Math.floor(CONTRIBUTOR_TOKENS * sharePercentage);

    if (existingContribution) {
      // Update existing contribution
      const { error: updateError } = await supabase
        .from('safu_contributions')
        .update({
          amount: newTotalUserContribution,
          tx_hash: txHash,
          token_share: expectedTokenShare
        })
        .eq('id', existingContribution.id);

      if (updateError) throw updateError;
      console.log(`Updated contribution for ${walletAddress}: ${newTotalUserContribution} SOL -> ${expectedTokenShare} tokens`);
    } else {
      // Create new contribution
      const { error: insertError } = await supabase
        .from('safu_contributions')
        .insert({
          launch_id: launchId,
          wallet_address: walletAddress,
          amount: amount,
          tx_hash: txHash,
          token_share: expectedTokenShare
        });

      if (insertError) throw insertError;
      console.log(`New contribution from ${walletAddress}: ${amount} SOL -> ${expectedTokenShare} tokens`);
    }

    // Update launch totals
    const newTotal = launch.total_contributed + amount;
    const newContributorCount = existingContribution 
      ? launch.contributor_count 
      : launch.contributor_count + 1;

    const updateData: any = {
      total_contributed: newTotal,
      contributor_count: newContributorCount,
      updated_at: new Date().toISOString()
    };

    // Check if hardcap reached
    if (newTotal >= launch.hardcap) {
      updateData.status = 'ready_to_launch';
      console.log('Hardcap reached! Launch is ready to execute.');
    }

    const { error: launchUpdateError } = await supabase
      .from('safu_launches')
      .update(updateData)
      .eq('id', launchId);

    if (launchUpdateError) throw launchUpdateError;

    // If hardcap reached, trigger the launch execution
    if (newTotal >= launch.hardcap) {
      console.log('Triggering token creation...');
      // Fire and forget - don't wait for response
      supabase.functions.invoke('execute-safu-launch', {
        body: { launchId }
      }).catch(err => console.error('Execute launch error:', err));
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Contribution confirmed',
        newTotal,
        hardcapReached: newTotal >= launch.hardcap
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Confirm contribution error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
