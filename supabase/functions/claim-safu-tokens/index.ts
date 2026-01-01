import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Connection, Keypair, PublicKey, Transaction } from 'https://esm.sh/@solana/web3.js@1.87.6';
import { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction, getAccount, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from 'https://esm.sh/@solana/spl-token@0.3.11';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 2000;

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

// Sleep helper
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry wrapper with exponential backoff
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`${operationName}: Attempt ${attempt}/${maxRetries}`);
      const result = await operation();
      return result;
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`${operationName}: Attempt ${attempt} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
        console.log(`${operationName}: Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

// Decryption function - using base64 decode compatible with Deno
function decrypt(encryptedData: string, key: string): string {
  // Decode base64
  const binaryString = atob(encryptedData);
  const encrypted = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    encrypted[i] = binaryString.charCodeAt(i);
  }
  
  // XOR decrypt
  const keyBytes = new TextEncoder().encode(key);
  const decrypted = new Uint8Array(encrypted.length);
  
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return new TextDecoder().decode(decrypted);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { launchId, walletAddress } = await req.json();
    console.log(`=== Claiming tokens for wallet ${walletAddress} from launch ${launchId} ===`);

    if (!launchId || !walletAddress) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: launchId and walletAddress' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const heliusApiKey = Deno.env.get('HELIUS_API_KEY');
    const encryptionKey = Deno.env.get('WALLET_ENCRYPTION_KEY')!;

    if (!encryptionKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // SECURITY: Check if wallet is blocked
    const blockCheck = await isWalletBlocked(supabase, walletAddress);
    if (blockCheck.blocked) {
      console.error(`SECURITY: Blocked wallet ${walletAddress} attempted SAFU token claim`);
      return new Response(
        JSON.stringify({ success: false, error: 'This wallet has been suspended' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the launch
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

    // Check if token has been created
    if (launch.status !== 'created') {
      return new Response(
        JSON.stringify({ success: false, error: `Token has not been launched yet. Current status: ${launch.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!launch.contract_address) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token contract address not available' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch contribution
    const { data: contribution, error: contribError } = await supabase
      .from('safu_contributions')
      .select('*')
      .eq('launch_id', launchId)
      .eq('wallet_address', walletAddress)
      .single();

    if (contribError || !contribution) {
      console.error('Contribution not found:', contribError);
      return new Response(
        JSON.stringify({ success: false, error: 'You have not contributed to this launch' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already claimed
    if (contribution.claimed) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tokens already claimed', claimedAt: contribution.claimed_at }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check token share
    if (!contribution.token_share || contribution.token_share <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No tokens allocated for this contribution' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Token share to claim: ${contribution.token_share} tokens`);

    // Get the pool wallet that holds contributor tokens
    const { data: poolWallet, error: walletError } = await supabase
      .from('pool_wallets')
      .select('*')
      .eq('pool_id', launchId)
      .eq('pool_type', 'safu_contributor')
      .single();

    if (walletError || !poolWallet) {
      console.error('Pool wallet not found:', walletError);
      return new Response(
        JSON.stringify({ success: false, error: 'Contributor pool wallet not found. Please contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decrypt the private key
    let senderKeypair: Keypair;
    try {
      const privateKeyString = decrypt(poolWallet.encrypted_private_key, encryptionKey);
      const privateKeyArray = JSON.parse(privateKeyString);
      senderKeypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
      console.log('Pool wallet decrypted successfully');
    } catch (decryptError) {
      console.error('Failed to decrypt pool wallet:', decryptError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to access contributor pool wallet' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Setup connection
    const rpcEndpoint = heliusApiKey 
      ? `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`
      : 'https://api.mainnet-beta.solana.com';
    
    const connection = new Connection(rpcEndpoint, 'confirmed');
    const tokenMint = new PublicKey(launch.contract_address);
    const recipientPubkey = new PublicKey(walletAddress);

    // Get token accounts
    const senderAta = await getAssociatedTokenAddress(tokenMint, senderKeypair.publicKey);
    const recipientAta = await getAssociatedTokenAddress(tokenMint, recipientPubkey);

    // Pump.fun tokens have 6 decimals
    const tokenDecimals = 6;
    const tokenAmount = BigInt(Math.floor(contribution.token_share * Math.pow(10, tokenDecimals)));

    console.log(`Transferring ${contribution.token_share} tokens (${tokenAmount} smallest units) to ${walletAddress}`);

    // Check if sender has enough tokens
    try {
      const senderAccount = await getAccount(connection, senderAta);
      console.log(`Sender token balance: ${senderAccount.amount}`);
      
      if (senderAccount.amount < tokenAmount) {
        console.error(`Insufficient tokens. Have: ${senderAccount.amount}, Need: ${tokenAmount}`);
        return new Response(
          JSON.stringify({ success: false, error: 'Insufficient tokens in pool. Please contact support.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (ataError) {
      console.error('Sender ATA not found or empty:', ataError);
      return new Response(
        JSON.stringify({ success: false, error: 'Pool token account not found. Tokens may not be deposited yet.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build transaction
    const transaction = new Transaction();

    // Check if recipient ATA exists, create if needed
    let recipientAtaExists = false;
    try {
      await getAccount(connection, recipientAta);
      recipientAtaExists = true;
      console.log('Recipient ATA exists');
    } catch {
      console.log('Creating recipient ATA...');
      transaction.add(
        createAssociatedTokenAccountInstruction(
          senderKeypair.publicKey, // payer
          recipientAta,
          recipientPubkey,
          tokenMint
        )
      );
    }

    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        senderAta,
        recipientAta,
        senderKeypair.publicKey,
        tokenAmount
      )
    );

    // Send transaction with retry
    let signature: string;
    try {
      signature = await withRetry(async () => {
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = senderKeypair.publicKey;
        transaction.sign(senderKeypair);

        const sig = await connection.sendRawTransaction(transaction.serialize(), {
          skipPreflight: false,
          maxRetries: 3
        });
        console.log(`Transaction sent: ${sig}`);

        await connection.confirmTransaction({
          signature: sig,
          blockhash,
          lastValidBlockHeight
        }, 'confirmed');

        return sig;
      }, 'Token transfer');
      
      console.log('Transaction confirmed!');
    } catch (txError) {
      console.error('Transaction failed:', txError);
      return new Response(
        JSON.stringify({ success: false, error: `Token transfer failed: ${txError instanceof Error ? txError.message : 'Unknown error'}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark as claimed
    const { error: updateError } = await supabase
      .from('safu_contributions')
      .update({
        claimed: true,
        claimed_at: new Date().toISOString(),
        tx_hash: signature
      })
      .eq('id', contribution.id);

    if (updateError) {
      console.error('Failed to update claim status:', updateError);
      // Don't fail the request since tokens were transferred
    }

    console.log(`=== Claim successful! TX: ${signature} ===`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        txHash: signature,
        tokensClaimed: contribution.token_share,
        tokenSymbol: launch.token_symbol
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Claim error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Failed to claim tokens' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
