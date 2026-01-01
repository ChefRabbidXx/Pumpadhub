import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HELIUS_API_KEY = Deno.env.get('HELIUS_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Error recovery constants
const MAX_RETRY_COUNT = 3;
const RETRY_DELAY_MINUTES = 5;
const STUCK_THRESHOLD_MINUTES = 10;

// Helper to add delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface RacePool {
  id: string;
  token_id: string | null;
  contract_address: string | null;
  token_symbol: string | null;
  token_decimals: number | null;
  status: string;
  prize_pool: number;
  daily_reward_amount: number | null;
  total_rounds: number | null;
  current_round: number | null;
  round_started_at: string | null;
  entry_snapshot_at: string | null;
  snapshot_status: string | null;
  snapshot_error: string | null;
  retry_count: number | null;
  last_retry_at: string | null;
  updated_at: string;
}

// Mark race with error status
async function markRaceError(
  supabase: any, 
  raceId: string, 
  error: string, 
  currentRetryCount: number
): Promise<boolean> {
  const newRetryCount = currentRetryCount + 1;
  const hitMaxRetries = newRetryCount >= MAX_RETRY_COUNT;
  
  console.log(`Race ${raceId}: Error (attempt ${newRetryCount}/${MAX_RETRY_COUNT}): ${error}`);
  
  await supabase
    .from('race_pools')
    .update({
      snapshot_status: hitMaxRetries ? 'error' : 'pending',
      snapshot_error: error,
      retry_count: newRetryCount,
      last_retry_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', raceId);
    
  return hitMaxRetries;
}

// Recover stuck races that have been in_progress for too long
async function recoverStuckRaces(supabase: any) {
  const stuckThreshold = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000).toISOString();
  
  const { data: stuckRaces } = await supabase
    .from('race_pools')
    .select('id, snapshot_status, retry_count')
    .eq('status', 'active')
    .in('snapshot_status', ['entry_in_progress', 'end_in_progress'])
    .lt('updated_at', stuckThreshold);
  
  if (stuckRaces && stuckRaces.length > 0) {
    console.log(`Recovering ${stuckRaces.length} stuck races`);
    
    for (const race of stuckRaces) {
      await supabase
        .from('race_pools')
        .update({
          snapshot_status: 'pending',
          snapshot_error: `Recovered from stuck: ${race.snapshot_status}`,
          retry_count: (race.retry_count || 0) + 1,
          last_retry_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', race.id);
      
      console.log(`Recovered stuck race ${race.id}`);
    }
  }
}

// Check if race should be retried
function shouldRetryRace(race: RacePool): boolean {
  if ((race.retry_count || 0) >= MAX_RETRY_COUNT) return false;
  if (!race.last_retry_at) return true;
  
  const lastRetry = new Date(race.last_retry_at).getTime();
  const retryAfter = lastRetry + RETRY_DELAY_MINUTES * 60 * 1000;
  return Date.now() > retryAfter;
}

async function fetchTopHolders(
  tokenAddress: string, 
  limit: number, 
  decimals: number = 6
): Promise<Array<{wallet: string, balance: number}>> {
  console.log(`Fetching holders for: ${tokenAddress} (decimals: ${decimals})`);
  
  if (!HELIUS_API_KEY) {
    throw new Error('HELIUS_API_KEY not configured');
  }
  
  let allAccounts: Array<{ wallet: string; balance: number }> = [];
  let cursor: string | undefined;
  let page = 0;
  const maxPages = 50;
  let retryCount = 0;

  while (page < maxPages) {
    const requestBody: any = {
      jsonrpc: '2.0',
      id: `page-${page}`,
      method: 'getTokenAccounts',
      params: {
        mint: tokenAddress,
        limit: 1000,
        options: { showZeroBalance: false }
      }
    };

    if (cursor) {
      requestBody.params.cursor = cursor;
    }

    const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    
    if (data.error) {
      // Rate limit - retry with backoff
      if (data.error.code === -32429 && retryCount < 3) {
        retryCount++;
        console.log(`Rate limited, waiting before retry ${retryCount}/3...`);
        await delay(2000 * retryCount);
        continue;
      }
      throw new Error(`Helius API error: ${JSON.stringify(data.error)}`);
    }
    
    retryCount = 0; // Reset on success
    
    if (!data.result?.token_accounts?.length) {
      break;
    }

    for (const acc of data.result.token_accounts) {
      const balance = acc.amount / Math.pow(10, decimals);
      if (balance > 0) {
        allAccounts.push({
          wallet: acc.owner,
          balance
        });
      }
    }

    cursor = data.result.cursor;
    if (!cursor) break;
    page++;
    
    // Small delay to avoid rate limits
    await delay(100);
  }

  console.log(`Fetched ${allAccounts.length} accounts`);

  allAccounts.sort((a, b) => b.balance - a.balance);
  const topHolders = allAccounts.slice(0, limit);
  
  if (topHolders.length > 0) {
    console.log(`#1: ${topHolders[0].balance.toFixed(0)} tokens, #${topHolders.length}: ${topHolders[topHolders.length - 1].balance.toFixed(0)} tokens`);
  }

  return topHolders;
}

// SECURITY: Maximum reward cap per participant per round (prevents overflow exploits)
const MAX_REWARD_PER_PARTICIPANT = 10000000; // 10M tokens max per participant per round
const MAX_DAILY_POOL = 100000000; // 100M tokens max per day

function calculateRewardDistribution(
  eligibleParticipants: Array<{wallet: string, rank: number}>, 
  dailyPool: number
): Array<{wallet: string, rank: number, reward: number}> {
  // SECURITY: Cap the daily pool to prevent overflow exploits
  const cappedDailyPool = Math.min(dailyPool, MAX_DAILY_POOL);
  
  if (cappedDailyPool !== dailyPool) {
    console.warn(`SECURITY: Daily pool capped from ${dailyPool} to ${cappedDailyPool}`);
  }

  const tier1Pool = cappedDailyPool * 0.60; // Top 10
  const tier2Pool = cappedDailyPool * 0.30; // 11-50
  const tier3Pool = cappedDailyPool * 0.10; // 51-100

  const tier1Eligible = eligibleParticipants.filter(p => p.rank <= 10).length;
  const tier2Eligible = eligibleParticipants.filter(p => p.rank > 10 && p.rank <= 50).length;
  const tier3Eligible = eligibleParticipants.filter(p => p.rank > 50 && p.rank <= 100).length;

  return eligibleParticipants.map(participant => {
    let reward = 0;

    if (participant.rank <= 10 && tier1Eligible > 0) {
      reward = tier1Pool / tier1Eligible;
    } else if (participant.rank <= 50 && tier2Eligible > 0) {
      reward = tier2Pool / tier2Eligible;
    } else if (participant.rank <= 100 && tier3Eligible > 0) {
      reward = tier3Pool / tier3Eligible;
    }

    // SECURITY: Cap individual rewards
    const cappedReward = Math.min(reward, MAX_REWARD_PER_PARTICIPANT);
    if (cappedReward !== reward) {
      console.warn(`SECURITY: Reward for ${participant.wallet} capped from ${reward} to ${cappedReward}`);
    }

    return {
      wallet: participant.wallet,
      rank: participant.rank,
      reward: cappedReward
    };
  });
}

// Process entry snapshot (1 hour after round start)
async function processEntrySnapshot(supabase: any, race: RacePool): Promise<{success: boolean, error?: string}> {
  console.log(`Processing ENTRY snapshot for race ${race.id}`);
  
  // Mark as in-progress
  await supabase
    .from('race_pools')
    .update({ 
      snapshot_status: 'entry_in_progress',
      updated_at: new Date().toISOString()
    })
    .eq('id', race.id);
  
  try {
    const tokenAddress = race.contract_address;
    if (!tokenAddress) {
      throw new Error('No token address found');
    }
    
    const decimals = race.token_decimals || 6;
    const holders = await fetchTopHolders(tokenAddress, 100, decimals);
    
    if (holders.length === 0) {
      throw new Error('No holders found for token');
    }
    
    console.log(`Entry snapshot: ${holders.length} holders found`);
    
    // Insert participants with upsert to handle any duplicates
    let insertedCount = 0;
    for (let i = 0; i < holders.length; i++) {
      const holder = holders[i];
      const { error: insertError } = await supabase
        .from('race_participants')
        .upsert({
          race_id: race.id,
          wallet_address: holder.wallet,
          round_number: race.current_round || 1,
          rank: i + 1,
          token_balance: holder.balance,
          entry_balance: holder.balance,
          reward_amount: 0,
          claimed: false,
          is_eligible: true
        }, {
          onConflict: 'race_id,wallet_address,round_number'
        });

      if (insertError) {
        console.error(`Error inserting participant ${i + 1}:`, insertError);
      } else {
        insertedCount++;
      }
    }
    
    // Mark entry snapshot complete
    await supabase
      .from('race_pools')
      .update({ 
        entry_snapshot_at: new Date().toISOString(),
        snapshot_status: 'entry_complete',
        snapshot_error: null,
        total_participants: holders.length,
        updated_at: new Date().toISOString()
      })
      .eq('id', race.id);

    console.log(`Entry snapshot complete: ${insertedCount} participants recorded`);
    return { success: true };
    
  } catch (error: any) {
    await markRaceError(supabase, race.id, `Entry snapshot failed: ${error.message}`, race.retry_count || 0);
    return { success: false, error: error.message };
  }
}

// Process end snapshot and distribute rewards (24 hours after round start)
async function processEndSnapshot(supabase: any, race: RacePool): Promise<{success: boolean, error?: string}> {
  console.log(`Processing END snapshot for race ${race.id}`);
  
  // Mark as in-progress
  await supabase
    .from('race_pools')
    .update({ 
      snapshot_status: 'end_in_progress',
      updated_at: new Date().toISOString()
    })
    .eq('id', race.id);
  
  try {
    const tokenAddress = race.contract_address;
    if (!tokenAddress) {
      throw new Error('No token address found');
    }
    
    const decimals = race.token_decimals || 6;
    
    // Get entry participants first to verify snapshot exists
    const { data: entryParticipants, error: entryError } = await supabase
      .from('race_participants')
      .select('*')
      .eq('race_id', race.id)
      .eq('round_number', race.current_round || 1);

    if (entryError) {
      throw new Error(`Failed to fetch participants: ${entryError.message}`);
    }

    if (!entryParticipants || entryParticipants.length === 0) {
      throw new Error('No entry participants found - entry snapshot may have failed');
    }

    console.log(`Found ${entryParticipants.length} entry participants`);

    // Fetch current holders
    const currentHolders = await fetchTopHolders(tokenAddress, 100, decimals);
    console.log(`End snapshot: ${currentHolders.length} current holders`);

    // Create balance map
    const currentBalanceMap = new Map<string, number>();
    currentHolders.forEach(h => currentBalanceMap.set(h.wallet, h.balance));

    // Calculate eligibility and update participants
    const eligibleParticipants: Array<{wallet: string, rank: number}> = [];

    for (const participant of entryParticipants) {
      const currentBalance = currentBalanceMap.get(participant.wallet_address) || 0;
      const entryBalance = participant.entry_balance || participant.token_balance;
      const isEligible = entryBalance > 0 && currentBalance >= entryBalance * 0.9;
      
      await supabase
        .from('race_participants')
        .update({
          token_balance: currentBalance,
          is_eligible: isEligible
        })
        .eq('id', participant.id);
      
      if (isEligible) {
        eligibleParticipants.push({
          wallet: participant.wallet_address,
          rank: participant.rank
        });
      }
    }

    console.log(`${eligibleParticipants.length}/${entryParticipants.length} participants eligible`);

    // Calculate and distribute rewards
    const dailyPool = race.daily_reward_amount || (race.prize_pool / (race.total_rounds || 1));
    const rewardDistribution = calculateRewardDistribution(eligibleParticipants, dailyPool);

    for (const reward of rewardDistribution) {
      await supabase
        .from('race_participants')
        .update({ reward_amount: reward.reward })
        .eq('race_id', race.id)
        .eq('wallet_address', reward.wallet)
        .eq('round_number', race.current_round || 1);
    }

    console.log(`Distributed rewards to ${rewardDistribution.length} participants`);

    // Advance round or complete race
    const currentRound = race.current_round || 1;
    const totalRounds = race.total_rounds || 1;

    if (currentRound >= totalRounds) {
      await supabase
        .from('race_pools')
        .update({ 
          status: 'completed',
          snapshot_status: 'completed',
          snapshot_error: null,
          time_remaining_hours: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', race.id);

      console.log(`Race ${race.id} completed after ${totalRounds} rounds`);
    } else {
      await supabase
        .from('race_pools')
        .update({ 
          current_round: currentRound + 1,
          round_started_at: new Date().toISOString(),
          entry_snapshot_at: null,
          snapshot_status: 'pending',
          snapshot_error: null,
          retry_count: 0,
          time_remaining_hours: (totalRounds - currentRound) * 24,
          updated_at: new Date().toISOString()
        })
        .eq('id', race.id);

      console.log(`Race ${race.id} advanced to round ${currentRound + 1}`);
    }

    return { success: true };
    
  } catch (error: any) {
    await markRaceError(supabase, race.id, `End snapshot failed: ${error.message}`, race.retry_count || 0);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting race reward distribution check...");
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Step 1: Recover any stuck races first
    await recoverStuckRaces(supabase);

    // Step 2: Get all active races ready for processing (token info is embedded in table)
    const { data: races, error: racesError } = await supabase
      .from('race_pools')
      .select('*')
      .eq('status', 'active')
      .or('snapshot_status.eq.pending,snapshot_status.eq.entry_complete,snapshot_status.is.null');

    if (racesError) {
      console.error("Error fetching races:", racesError);
      throw racesError;
    }

    console.log(`Found ${races?.length || 0} active races`);

    const results: Array<{raceId: string, action: string, success: boolean, error?: string}> = [];

    for (const race of races || []) {
      // Skip if max retries exceeded
      if ((race.retry_count || 0) >= MAX_RETRY_COUNT) {
        console.log(`Race ${race.id}: Max retries exceeded, skipping`);
        continue;
      }
      
      // Check retry delay
      if ((race.retry_count || 0) > 0 && !shouldRetryRace(race)) {
        console.log(`Race ${race.id}: Waiting for retry delay`);
        continue;
      }

      const roundStartedAt = new Date(race.round_started_at);
      const now = new Date();
      const hoursSinceStart = (now.getTime() - roundStartedAt.getTime()) / (1000 * 60 * 60);

      console.log(`Race ${race.id}: Round ${race.current_round}/${race.total_rounds}, Hours: ${hoursSinceStart.toFixed(2)}, Status: ${race.snapshot_status || 'null'}`);

      const tokenAddress = race.contract_address;
      if (!tokenAddress) {
        console.log(`Race ${race.id}: No token address, skipping`);
        continue;
      }

      const snapshotStatus = race.snapshot_status || 'pending';

      // Entry snapshot: 1 hour after round start
      if (snapshotStatus === 'pending' && hoursSinceStart >= 1) {
        const result = await processEntrySnapshot(supabase, race);
        results.push({
          raceId: race.id,
          action: 'entry_snapshot',
          success: result.success,
          error: result.error
        });
      }
      // End snapshot: 24 hours after round start
      else if (snapshotStatus === 'entry_complete' && hoursSinceStart >= 24) {
        const result = await processEndSnapshot(supabase, race);
        results.push({
          raceId: race.id,
          action: 'end_snapshot',
          success: result.success,
          error: result.error
        });
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      processed: results.length,
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Error in distribute-race-rewards:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
