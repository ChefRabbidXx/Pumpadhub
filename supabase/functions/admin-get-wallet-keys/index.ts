import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decode as base64Decode } from 'https://deno.land/std@0.208.0/encoding/base64.ts';
import bs58 from 'https://esm.sh/bs58@5.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// XOR decryption matching the encryption in generate-pool-wallet
function decrypt(encryptedData: string, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const encryptedBytes = base64Decode(encryptedData);
  const decrypted = new Uint8Array(encryptedBytes.length);
  
  for (let i = 0; i < encryptedBytes.length; i++) {
    decrypted[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return new TextDecoder().decode(decrypted);
}

// Convert the stored JSON array back to base58 private key
function toBase58PrivateKey(jsonArrayString: string): string {
  try {
    const byteArray = JSON.parse(jsonArrayString);
    const uint8Array = new Uint8Array(byteArray);
    return bs58.encode(uint8Array);
  } catch (error) {
    console.error('Error converting to base58:', error);
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { adminPassword, poolId, poolType, includeType } = await req.json();

    // Verify admin password
    const storedAdminPassword = Deno.env.get('ADMIN_PASSWORD');
    if (!storedAdminPassword || adminPassword !== storedAdminPassword) {
      console.error('Invalid admin password attempt');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - Invalid admin credentials' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const encryptionKey = Deno.env.get('WALLET_ENCRYPTION_KEY');
    if (!encryptionKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Encryption key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const result: {
      poolWallets: any[];
      safuDepositWallets: any[];
    } = {
      poolWallets: [],
      safuDepositWallets: []
    };

    // Fetch pool wallets if not specifically requesting safu only
    if (!includeType || includeType === 'all' || includeType === 'pool') {
      let query = supabase.from('pool_wallets').select('*');
      
      if (poolId) {
        query = query.eq('pool_id', poolId);
      }
      if (poolType) {
        query = query.eq('pool_type', poolType);
      }

      const { data: wallets, error: fetchError } = await query;

      if (fetchError) {
        console.error('Error fetching pool wallets:', fetchError);
      } else if (wallets && wallets.length > 0) {
        // Fetch token info for each pool type
        const poolIds = wallets.map(w => w.pool_id);
        
        const [stakingPools, burnPools, racePools, farmingPools] = await Promise.all([
          supabase.from('staking_pools').select('id, token_name, token_symbol, token_logo_url, contract_address').in('id', poolIds),
          supabase.from('burn_pools').select('id, token_name, token_symbol, token_logo_url, contract_address').in('id', poolIds),
          supabase.from('race_pools').select('id, token_name, token_symbol, token_logo_url, contract_address').in('id', poolIds),
          supabase.from('social_farming_pools').select('id, token_name, token_symbol, token_logo_url, contract_address').in('id', poolIds)
        ]);

        const tokenInfoMap: Record<string, any> = {};
        [...(stakingPools.data || []), ...(burnPools.data || []), ...(racePools.data || []), ...(farmingPools.data || [])].forEach(pool => {
          tokenInfoMap[pool.id] = {
            token_name: pool.token_name,
            token_symbol: pool.token_symbol,
            token_logo_url: pool.token_logo_url,
            contract_address: pool.contract_address
          };
        });

        // Also check safu_contributor pool type and get info from safu_launches
        const safuContributorWallets = wallets.filter(w => w.pool_type === 'safu_contributor');
        if (safuContributorWallets.length > 0) {
          const safuLaunchIds = safuContributorWallets.map(w => w.pool_id);
          const { data: safuLaunches } = await supabase
            .from('safu_launches')
            .select('id, token_name, token_symbol, token_image_url, contract_address')
            .in('id', safuLaunchIds);
          
          if (safuLaunches) {
            safuLaunches.forEach(launch => {
              tokenInfoMap[launch.id] = {
                token_name: launch.token_name,
                token_symbol: launch.token_symbol,
                token_logo_url: launch.token_image_url,
                contract_address: launch.contract_address
              };
            });
          }
        }

        // Decrypt private keys
        result.poolWallets = wallets.map(wallet => {
          const tokenInfo = tokenInfoMap[wallet.pool_id] || {};
          try {
            const decryptedJsonArray = decrypt(wallet.encrypted_private_key, encryptionKey);
            const base58PrivateKey = toBase58PrivateKey(decryptedJsonArray);
            return {
              id: wallet.id,
              pool_id: wallet.pool_id,
              pool_type: wallet.pool_type,
              public_key: wallet.public_key,
              private_key: base58PrivateKey,
              created_at: wallet.created_at,
              token_name: tokenInfo.token_name || null,
              token_symbol: tokenInfo.token_symbol || null,
              token_logo_url: tokenInfo.token_logo_url || null,
              contract_address: tokenInfo.contract_address || null
            };
          } catch (decryptError) {
            console.error(`Error decrypting wallet ${wallet.id}:`, decryptError);
            return {
              id: wallet.id,
              pool_id: wallet.pool_id,
              pool_type: wallet.pool_type,
              public_key: wallet.public_key,
              private_key: null,
              error: 'Decryption failed',
              created_at: wallet.created_at,
              ...tokenInfo
            };
          }
        });
      }
    }

    // Fetch SAFU deposit wallets if not specifically requesting pool only
    if (!includeType || includeType === 'all' || includeType === 'safu') {
      const { data: safuLaunches, error: safuError } = await supabase
        .from('safu_launches')
        .select('id, token_name, token_symbol, token_image_url, deposit_wallet_address, encrypted_private_key, contract_address, status, total_contributed, hardcap, contributor_count, created_at')
        .not('encrypted_private_key', 'is', null);

      if (safuError) {
        console.error('Error fetching SAFU launches:', safuError);
      } else if (safuLaunches && safuLaunches.length > 0) {
        result.safuDepositWallets = safuLaunches.map(launch => {
          try {
            const decryptedJsonArray = decrypt(launch.encrypted_private_key!, encryptionKey);
            const base58PrivateKey = toBase58PrivateKey(decryptedJsonArray);
            return {
              id: launch.id,
              token_name: launch.token_name,
              token_symbol: launch.token_symbol,
              token_logo_url: launch.token_image_url,
              deposit_wallet_address: launch.deposit_wallet_address,
              private_key: base58PrivateKey,
              contract_address: launch.contract_address,
              status: launch.status,
              total_contributed: launch.total_contributed,
              hardcap: launch.hardcap,
              contributor_count: launch.contributor_count,
              created_at: launch.created_at
            };
          } catch (decryptError) {
            console.error(`Error decrypting SAFU wallet ${launch.id}:`, decryptError);
            return {
              id: launch.id,
              token_name: launch.token_name,
              token_symbol: launch.token_symbol,
              token_logo_url: launch.token_image_url,
              deposit_wallet_address: launch.deposit_wallet_address,
              private_key: null,
              error: 'Decryption failed',
              contract_address: launch.contract_address,
              status: launch.status,
              total_contributed: launch.total_contributed,
              hardcap: launch.hardcap,
              contributor_count: launch.contributor_count,
              created_at: launch.created_at
            };
          }
        });
      }
    }

    // For backward compatibility, also return 'wallets' array (pool wallets)
    const totalCount = result.poolWallets.length + result.safuDepositWallets.length;
    console.log(`Admin retrieved ${result.poolWallets.length} pool wallet(s) and ${result.safuDepositWallets.length} SAFU deposit wallet(s)`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        wallets: result.poolWallets, // backward compatibility
        poolWallets: result.poolWallets,
        safuDepositWallets: result.safuDepositWallets,
        count: totalCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Admin wallet access error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
