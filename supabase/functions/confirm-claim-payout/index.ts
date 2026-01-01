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
    const { withdrawalRequestId, txHash, walletAddress } = await req.json();

    if (!withdrawalRequestId || !txHash) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing withdrawalRequestId or txHash' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the withdrawal request
    const { data: request, error: requestError } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('id', withdrawalRequestId)
      .single();

    if (requestError || !request) {
      console.error('Withdrawal request not found:', requestError);
      return new Response(
        JSON.stringify({ success: false, error: 'Withdrawal request not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Verify wallet address matches the request
    if (walletAddress && request.wallet_address !== walletAddress) {
      console.error(`SECURITY: Wallet mismatch. Request wallet: ${request.wallet_address}, Provided: ${walletAddress}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Wallet address mismatch' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Check if wallet is blocked
    const blockCheck = await isWalletBlocked(supabase, request.wallet_address);
    if (blockCheck.blocked) {
      console.error(`SECURITY: Blocked wallet ${request.wallet_address} attempted to confirm claim`);
      return new Response(
        JSON.stringify({ success: false, error: 'This wallet has been suspended' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Only allow confirmation of 'processing' requests
    if (request.status !== 'processing' && request.status !== 'pending') {
      console.warn(`Attempt to confirm request with status: ${request.status}`);
      return new Response(
        JSON.stringify({ success: false, error: `Cannot confirm request with status: ${request.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Validate txHash format (basic Solana signature check)
    if (!txHash || txHash.length < 80 || txHash.length > 100) {
      console.error('SECURITY: Invalid txHash format');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid transaction hash format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update withdrawal request as completed
    const { error: updateError } = await supabase
      .from('withdrawal_requests')
      .update({ 
        status: 'completed',
        tx_hash: txHash,
        admin_notes: 'User signed and submitted transaction',
        updated_at: new Date().toISOString()
      })
      .eq('id', withdrawalRequestId);

    if (updateError) {
      console.error('Error updating withdrawal request:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update request' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update transaction record
    await supabase
      .from('transactions')
      .update({ 
        status: 'completed',
        tx_hash: txHash
      })
      .eq('pool_id', request.pool_id)
      .eq('wallet_address', request.wallet_address)
      .eq('type', 'claim')
      .eq('status', 'pending');

    console.log(`Claim payout confirmed for ${request.wallet_address}: ${txHash}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        txHash,
        message: 'Payout confirmed successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Confirm payout error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
