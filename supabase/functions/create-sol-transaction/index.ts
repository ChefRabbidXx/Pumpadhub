import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HELIUS_API_KEY = Deno.env.get('HELIUS_API_KEY');
const HELIUS_RPC = HELIUS_API_KEY 
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}` 
  : null;

const RPC_ENDPOINTS = [
  ...(HELIUS_RPC ? [HELIUS_RPC] : []),
  'https://rpc.ankr.com/solana'
];

const SOL_TO_LAMPORTS = 1000000000;

async function getWorkingRpc(): Promise<string | null> {
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getHealth'
        })
      });
      if (response.ok) {
        console.log('Connected to:', endpoint);
        return endpoint;
      }
    } catch (e) {
      console.log('Failed to connect to:', endpoint);
    }
  }
  return null;
}

async function getLatestBlockhash(rpcUrl: string): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getLatestBlockhash',
      params: [{ commitment: 'confirmed' }]
    })
  });
  
  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message);
  }
  
  return {
    blockhash: data.result.value.blockhash,
    lastValidBlockHeight: data.result.value.lastValidBlockHeight
  };
}

async function sendRawTransaction(rpcUrl: string, signedTx: string): Promise<string> {
  console.log("Sending raw transaction to Solana...");
  
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'sendTransaction',
      params: [
        signedTx,
        {
          encoding: 'base64',
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        }
      ],
    }),
  });

  const data = await response.json();
  console.log("Send transaction response:", JSON.stringify(data));
  
  if (data.error) {
    throw new Error(data.error.message || 'Transaction send failed');
  }

  return data.result;
}

async function confirmTransaction(rpcUrl: string, signature: string, maxRetries = 30): Promise<boolean> {
  console.log(`Confirming transaction: ${signature}`);
  
  for (let i = 0; i < maxRetries; i++) {
    await new Promise(r => setTimeout(r, 1000));
    
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignatureStatuses',
        params: [[signature]],
      }),
    });

    const data = await response.json();
    const status = data.result?.value?.[0];
    
    if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') {
      console.log(`Transaction confirmed: ${status.confirmationStatus}`);
      return true;
    }
    
    if (status?.err) {
      console.error("Transaction error:", status.err);
      return false;
    }
    
    console.log(`Waiting for confirmation... attempt ${i + 1}/${maxRetries}`);
  }
  
  return false;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { fromPubkey, toPubkey, amount, signedTransaction } = body;
    
    // If signed transaction is provided, send it to the network
    if (signedTransaction) {
      console.log("Received signed transaction, broadcasting to network...");
      
      const rpcUrl = await getWorkingRpc();
      if (!rpcUrl) {
        return new Response(
          JSON.stringify({ success: false, error: 'Could not connect to Solana network' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 }
        );
      }
      
      const signature = await sendRawTransaction(rpcUrl, signedTransaction);
      console.log("Transaction sent, signature:", signature);
      
      // Confirm the transaction
      const confirmed = await confirmTransaction(rpcUrl, signature);
      
      if (!confirmed) {
        return new Response(
          JSON.stringify({ success: false, error: 'Transaction not confirmed in time', signature }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: true, signature, confirmed: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Otherwise, prepare transaction parameters
    console.log(`Creating SOL transaction: ${amount} SOL from ${fromPubkey} to ${toPubkey}`);

    if (!fromPubkey || !toPubkey || !amount) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const rpcUrl = await getWorkingRpc();
    if (!rpcUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Could not connect to Solana network' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 }
      );
    }

    const { blockhash, lastValidBlockHeight } = await getLatestBlockhash(rpcUrl);
    console.log('Got blockhash:', blockhash);

    const lamports = Math.round(amount * SOL_TO_LAMPORTS);

    // Return the transaction parameters for the client to construct and sign
    return new Response(
      JSON.stringify({ 
        success: true, 
        blockhash,
        lastValidBlockHeight,
        lamports,
        fromPubkey,
        toPubkey
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
