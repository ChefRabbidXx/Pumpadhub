import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Keypair } from 'https://esm.sh/@solana/web3.js@1.87.6';
import { encode as base64Encode } from 'https://deno.land/std@0.208.0/encoding/base64.ts';

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

// Simple XOR encryption with the key
function encrypt(data: string, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const dataBytes = new TextEncoder().encode(data);
  const encrypted = new Uint8Array(dataBytes.length);
  
  for (let i = 0; i < dataBytes.length; i++) {
    encrypted[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return base64Encode(encrypted);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      creatorWallet,
      tokenName,
      tokenSymbol,
      description,
      tokenImageUrl,
      websiteUrl,
      telegramUrl,
      twitterUrl
    } = await req.json();

    console.log(`Creating Safu Launch idea for ${tokenName} (${tokenSymbol}) by ${creatorWallet}`);

    if (!creatorWallet || !tokenName || !tokenSymbol) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const encryptionKey = Deno.env.get('WALLET_ENCRYPTION_KEY');
    if (!encryptionKey) {
      console.error('WALLET_ENCRYPTION_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Encryption not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // SECURITY: Check if wallet is blocked
    const blockCheck = await isWalletBlocked(supabase, creatorWallet);
    if (blockCheck.blocked) {
      console.error(`SECURITY: Blocked wallet ${creatorWallet} attempted to create SAFU launch`);
      return new Response(
        JSON.stringify({ success: false, error: 'This wallet has been suspended' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Input validation
    if (tokenName.length > 50 || tokenSymbol.length > 10) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token name or symbol too long' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a new Solana keypair for deposit (will receive contributions AND create token)
    const keypair = Keypair.generate();
    const depositWalletAddress = keypair.publicKey.toBase58();
    const privateKeyArray = Array.from(keypair.secretKey);
    const privateKeyString = JSON.stringify(privateKeyArray);
    
    // Encrypt the private key for secure storage
    const encryptedPrivateKey = encrypt(privateKeyString, encryptionKey);

    console.log(`Generated deposit wallet: ${depositWalletAddress}`);

    // Create the safu launch record with fixed allocations
    // Community model: 150M to contributors, 110M to features
    const { data: launch, error: insertError } = await supabase
      .from('safu_launches')
      .insert({
        creator_wallet: creatorWallet,
        token_name: tokenName,
        token_symbol: tokenSymbol,
        description: description || null,
        token_image_url: tokenImageUrl,
        website_url: websiteUrl,
        telegram_url: telegramUrl,
        twitter_url: twitterUrl,
        // Fixed allocations (in millions) - cannot be changed
        stake_allocation: 20,
        race_allocation: 20,
        burn_allocation: 20,
        social_farm_allocation: 10,
        dev_lock_allocation: 20,
        compensation_allocation: 10,
        dev_lock_duration: 7,
        dev_lock_unit: 'days',
        // Deposit wallet for contributions
        deposit_wallet_address: depositWalletAddress,
        encrypted_private_key: encryptedPrivateKey,
        status: 'pending_contributions',
        total_contributed: 0,
        hardcap: 11, // 10 SOL for token + 1 SOL platform fee
        contributor_count: 0
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating launch:', insertError);
      throw insertError;
    }

    console.log(`Safu Launch created with ID: ${launch.id}`);
    console.log(`Deposit wallet generated: ${depositWalletAddress}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        launchId: launch.id,
        depositWalletAddress,
        message: 'Token idea submitted! Now accepting community contributions.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Create Safu Launch error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
