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
    const { launchId, walletAddress, amount } = await req.json();

    console.log(`Processing contribution: ${amount} SOL from ${walletAddress} for launch ${launchId}`);

    if (!launchId || !walletAddress || !amount) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (amount <= 0 || amount > 1) {
      return new Response(
        JSON.stringify({ success: false, error: 'Amount must be between 0 and 1 SOL' }),
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

    if (launch.status !== 'pending_contributions') {
      return new Response(
        JSON.stringify({ success: false, error: 'Launch is not accepting contributions' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if hardcap would be exceeded
    const remaining = launch.hardcap - launch.total_contributed;
    if (amount > remaining) {
      return new Response(
        JSON.stringify({ success: false, error: `Maximum contribution is ${remaining.toFixed(2)} SOL` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check existing contribution
    const { data: existingContribution } = await supabase
      .from('safu_contributions')
      .select('amount')
      .eq('launch_id', launchId)
      .eq('wallet_address', walletAddress)
      .single();

    const currentUserContribution = existingContribution?.amount || 0;
    const newTotal = currentUserContribution + amount;

    if (newTotal > 1) {
      return new Response(
        JSON.stringify({ success: false, error: `Maximum contribution per user is 1 SOL. You have already contributed ${currentUserContribution} SOL` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return the deposit wallet address
    return new Response(
      JSON.stringify({ 
        success: true, 
        depositWallet: launch.deposit_wallet_address,
        message: 'Ready to receive contribution'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Contribution error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
