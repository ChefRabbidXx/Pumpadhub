import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Trophy, ArrowLeft, TrendingUp, Award, ExternalLink, Loader2, Clock, Users, Gift, CheckCircle2, Copy, Zap, Target, Flame, History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { usePoolActions } from "@/hooks/use-pool-actions";

interface RaceData {
  id: string;
  prize_pool: number;
  total_participants: number;
  time_remaining_hours: number;
  status: string;
  created_at: string;
  current_round: number;
  total_rounds: number;
  daily_reward_amount: number;
  round_started_at: string;
  contract_address: string;
  entry_snapshot_at: string | null;
  snapshot_status: string | null;
  snapshot_error: string | null;
  retry_count: number | null;
  // Embedded token fields
  token_name: string | null;
  token_symbol: string | null;
  token_logo_url: string | null;
  token_decimals: number | null;
  token_total_supply: number | null;
}

interface Holder {
  rank: number;
  address: string;
  balance: number;
  dailyReward: number;
  percentage: number;
}

interface LockedParticipant {
  rank: number;
  wallet_address: string;
  entry_balance: number;
  current_balance: number;
  is_eligible: boolean;
  retention_percentage: number;
  dailyReward: number;
}

interface UserReward {
  id: string;
  round_number: number;
  rank: number;
  reward_amount: number;
  claimed: boolean;
  created_at: string;
  is_eligible: boolean | null;
}

interface WithdrawalRequest {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  tx_hash: string | null;
}

const RaceDetails = () => {
  const { contractAddress } = useParams<{ contractAddress: string }>();
  const navigate = useNavigate();
  const { walletAddress, connected } = useWallet();
  const { toast } = useToast();
  const { claimRewards } = usePoolActions();
  
  const [raceData, setRaceData] = useState<RaceData | null>(null);
  const [raceId, setRaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [lockedParticipants, setLockedParticipants] = useState<LockedParticipant[]>([]);
  const [userRewards, setUserRewards] = useState<UserReward[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [timeRemaining, setTimeRemaining] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [entryTimeRemaining, setEntryTimeRemaining] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [racePhase, setRacePhase] = useState<'entry' | 'holding' | 'ended'>('entry');
  const [isClaiming, setIsClaiming] = useState<string | null>(null);

  // Fetch race data and real holders from Helius
  useEffect(() => {
    const fetchRaceData = async () => {
      if (!contractAddress) return;

      try {
        setIsLoading(true);
        
        // Get the race pool by contract address with embedded token data
        const { data, error } = await supabase
          .from('race_pools')
          .select('*')
          .eq('contract_address', contractAddress)
          .eq('status', 'active')
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          setIsLoading(false);
          return;
        }

        setRaceData(data as RaceData);
        setRaceId(data.id);

        // Get token address for fetching real holders
        const tokenAddress = data.contract_address;
        
        // First check if there are already participants for current round in database
        const { data: existingParticipants } = await supabase
          .from('race_participants')
          .select('*')
          .eq('race_id', data.id)
          .eq('round_number', data.current_round)
          .order('rank', { ascending: true });

        if (existingParticipants && existingParticipants.length > 0) {
          console.log(`Using ${existingParticipants.length} existing participants from database for round ${data.current_round}`);
          const dailyPool = data.daily_reward_amount || (data.prize_pool / (data.total_rounds || 1));
          const tier1Pool = dailyPool * 0.60;
          const tier2Pool = dailyPool * 0.30;
          const tier3Pool = dailyPool * 0.10;
          
          const dbHolders: Holder[] = existingParticipants.map((p: any) => {
            // Calculate estimated reward based on tier if not yet distributed
            let estimatedReward = p.reward_amount;
            if (estimatedReward === 0) {
              if (p.rank <= 10) estimatedReward = tier1Pool / 10;
              else if (p.rank <= 50) estimatedReward = tier2Pool / 40;
              else if (p.rank <= 100) estimatedReward = tier3Pool / 50;
            }
            return {
              rank: p.rank,
              address: p.wallet_address,
              balance: p.token_balance,
              dailyReward: estimatedReward,
              percentage: 0
            };
          });
          setHolders(dbHolders);
        } else if (tokenAddress) {
          console.log("Fetching real holders for token:", tokenAddress);
          
          try {
            const tokenDecimals = data.token_decimals || 6;
            const { data: holdersData, error: holdersError } = await supabase.functions.invoke('fetch-race-holders', {
              body: { tokenAddress, limit: 100, decimals: tokenDecimals }
            });

            console.log("Holders response:", { holdersData, holdersError });

            if (!holdersError && holdersData?.success && holdersData.holders?.length > 0) {
              const dailyPool = data.daily_reward_amount || (data.prize_pool / (data.total_rounds || 1));
              const tier1Pool = dailyPool * 0.60;
              const tier2Pool = dailyPool * 0.30;
              const tier3Pool = dailyPool * 0.10;

              const realHolders: Holder[] = holdersData.holders.map((h: any) => {
                let reward = 0;
                if (h.rank <= 10) reward = tier1Pool / 10;
                else if (h.rank <= 50) reward = tier2Pool / 40;
                else reward = tier3Pool / 50;

                return {
                  rank: h.rank,
                  address: h.wallet,
                  balance: h.balance,
                  dailyReward: reward,
                  percentage: 0
                };
              });
              setHolders(realHolders);
              console.log(`Loaded ${realHolders.length} real holders from Helius`);
            } else {
              console.log("Holders fetch failed or empty, error:", holdersError);
              const dailyPool = data.daily_reward_amount || (data.prize_pool / (data.total_rounds || 1));
              const mockHolders: Holder[] = generateMockHolders(dailyPool, data.token_symbol || 'TOKEN');
              setHolders(mockHolders);
            }
          } catch (fetchError) {
            console.error("Edge function call failed:", fetchError);
            const dailyPool = data.daily_reward_amount || (data.prize_pool / (data.total_rounds || 1));
            const mockHolders: Holder[] = generateMockHolders(dailyPool, data.token_symbol || 'TOKEN');
            setHolders(mockHolders);
          }
        } else {
          console.log("No token address found");
          const dailyPool = data.daily_reward_amount || (data.prize_pool / (data.total_rounds || 1));
          const mockHolders: Holder[] = generateMockHolders(dailyPool, data.token_symbol || 'TOKEN');
          setHolders(mockHolders);
        }

      } catch (error) {
        console.error("Error fetching race data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRaceData();
  }, [contractAddress]);

  // Fetch user rewards
  useEffect(() => {
    const fetchUserRewards = async () => {
      if (!raceId || !walletAddress) return;

      const { data, error } = await supabase
        .from('race_participants')
        .select('*')
        .eq('race_id', raceId)
        .eq('wallet_address', walletAddress)
        .order('round_number', { ascending: false });

      if (!error && data) {
        setUserRewards(data);
      }
    };

    fetchUserRewards();

    const channel = supabase
      .channel('race-rewards')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'race_participants',
        filter: `race_id=eq.${raceId}`
      }, () => {
        fetchUserRewards();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [raceId, walletAddress]);

  // Fetch locked participants during holding phase
  const fetchLockedParticipants = async (currentPhase: 'entry' | 'holding' | 'ended') => {
    if (!raceId || !raceData || currentPhase !== 'holding') {
      setLockedParticipants([]);
      return;
    }

    try {
      const { data: participants, error } = await supabase
        .from('race_participants')
        .select('*')
        .eq('race_id', raceId)
        .eq('round_number', raceData.current_round)
        .order('rank', { ascending: true });

      if (error || !participants || participants.length === 0) {
        console.log('No locked participants found for current round');
        return;
      }

      const tokenAddress = raceData.contract_address;
      const tokenDecimals = raceData.token_decimals || 6;
      const walletAddresses = participants.map(p => p.wallet_address);

      let currentBalances: Record<string, number> = {};

      try {
        const { data: balancesData, error: balancesError } = await supabase.functions.invoke('fetch-wallet-balances', {
          body: { tokenAddress, walletAddresses, decimals: tokenDecimals }
        });

        if (!balancesError && balancesData?.success && balancesData.balances) {
          balancesData.balances.forEach((b: { wallet: string; balance: number }) => {
            currentBalances[b.wallet] = b.balance;
          });
          console.log(`Fetched current balances for ${Object.keys(currentBalances).length} wallets`);
        }
      } catch (err) {
        console.error('Failed to fetch current balances:', err);
      }

      const dailyPool = raceData.daily_reward_amount || (raceData.prize_pool / (raceData.total_rounds || 1));
      const tier1Pool = dailyPool * 0.60;
      const tier2Pool = dailyPool * 0.30;
      const tier3Pool = dailyPool * 0.10;

      const locked: LockedParticipant[] = participants.map((p) => {
        const currentBalance = currentBalances[p.wallet_address] || 0;
        const entryBalance = p.entry_balance || 0;
        const retentionPercentage = entryBalance > 0 ? (currentBalance / entryBalance) * 100 : 0;
        const isEligible = retentionPercentage >= 90;

        let reward = 0;
        if (p.rank <= 10) reward = tier1Pool / 10;
        else if (p.rank <= 50) reward = tier2Pool / 40;
        else reward = tier3Pool / 50;

        return {
          rank: p.rank,
          wallet_address: p.wallet_address,
          entry_balance: entryBalance,
          current_balance: currentBalance,
          is_eligible: isEligible,
          retention_percentage: retentionPercentage,
          dailyReward: reward
        };
      });

      setLockedParticipants(locked);
      console.log(`Loaded ${locked.length} locked participants for holding phase`);

    } catch (error) {
      console.error('Error fetching locked participants:', error);
    }
  };

  useEffect(() => {
    fetchLockedParticipants(racePhase);
  }, [raceId, raceData, racePhase]);

  // Refresh balances every hour during holding phase
  useEffect(() => {
    if (racePhase !== 'holding' || !raceId || !raceData) return;

    // Refresh immediately when entering holding phase
    fetchLockedParticipants('holding');

    // Set up hourly refresh (every 60 minutes)
    const hourlyInterval = setInterval(() => {
      console.log('Hourly balance check during holding phase...');
      fetchLockedParticipants('holding');
    }, 60 * 60 * 1000); // 1 hour

    return () => clearInterval(hourlyInterval);
  }, [racePhase, raceId, raceData]);

  // Realtime subscription for participants
  useEffect(() => {
    if (!raceId) return;

    const channel = supabase
      .channel('race-participants-updates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'race_participants',
        filter: `race_id=eq.${raceId}`
      }, () => {
        console.log('New participants detected, refreshing leaderboard...');
        fetchLockedParticipants(racePhase);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [raceId, raceData, racePhase]);

  useEffect(() => {
    if (!raceData?.round_started_at) return;

    const updateCountdown = () => {
      const roundStart = new Date(raceData.round_started_at);
      const entryEnd = new Date(roundStart.getTime() + 1 * 60 * 60 * 1000);
      const roundEnd = new Date(roundStart.getTime() + 24 * 60 * 60 * 1000);
      const now = new Date();

      if (now < entryEnd) {
        setRacePhase('entry');
        const diff = entryEnd.getTime() - now.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setEntryTimeRemaining({ hours, minutes, seconds });
        
        const totalDiff = roundEnd.getTime() - now.getTime();
        const totalHours = Math.floor(totalDiff / (1000 * 60 * 60));
        const totalMinutes = Math.floor((totalDiff % (1000 * 60 * 60)) / (1000 * 60));
        const totalSeconds = Math.floor((totalDiff % (1000 * 60)) / 1000);
        setTimeRemaining({ hours: totalHours, minutes: totalMinutes, seconds: totalSeconds });
      } else if (now < roundEnd) {
        setRacePhase('holding');
        const diff = roundEnd.getTime() - now.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeRemaining({ hours, minutes, seconds });
        setEntryTimeRemaining({ hours: 0, minutes: 0, seconds: 0 });
      } else {
        setRacePhase('ended');
        setTimeRemaining({ hours: 0, minutes: 0, seconds: 0 });
        setEntryTimeRemaining({ hours: 0, minutes: 0, seconds: 0 });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [raceData?.round_started_at]);

  // Fetch pending withdrawals
  useEffect(() => {
    const fetchWithdrawals = async () => {
      if (!raceId || !walletAddress) return;

      const { data } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('wallet_address', walletAddress)
        .eq('pool_id', raceId)
        .eq('feature', 'race')
        .order('created_at', { ascending: false });

      if (data) setPendingWithdrawals(data);
    };

    fetchWithdrawals();
  }, [raceId, walletAddress]);

  const handleClaimReward = async (rewardId: string) => {
    if (!connected || !walletAddress || !raceData) {
      toast({ title: "Wallet Required", description: "Please connect your wallet to claim rewards", variant: "destructive" });
      return;
    }

    const reward = userRewards.find(r => r.id === rewardId);
    if (!reward) return;

    setIsClaiming(rewardId);
    try {
      const success = await claimRewards(raceData.id, 'race', reward.reward_amount);

      if (success) {
        // Mark as claimed in race_participants
        await supabase
          .from('race_participants')
          .update({ claimed: true, claimed_at: new Date().toISOString() })
          .eq('id', rewardId)
          .eq('wallet_address', walletAddress);

        setUserRewards(prev => prev.map(r => 
          r.id === rewardId ? { ...r, claimed: true } : r
        ));

        // Refresh withdrawals
        const { data: withdrawals } = await supabase
          .from('withdrawal_requests')
          .select('*')
          .eq('wallet_address', walletAddress)
          .eq('pool_id', raceData.id)
          .eq('feature', 'race')
          .order('created_at', { ascending: false });
        if (withdrawals) setPendingWithdrawals(withdrawals);
      }
    } catch (error: any) {
      console.error("Error claiming reward:", error);
      toast({ title: "Claim Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsClaiming(null);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  };

  const generateMockHolders = (dailyPool: number, symbol: string): Holder[] => {
    const tier1Pool = dailyPool * 0.60;
    const tier2Pool = dailyPool * 0.30;
    const tier3Pool = dailyPool * 0.10;

    return Array.from({ length: 100 }, (_, i) => {
      const rank = i + 1;
      let reward = 0;

      if (rank <= 10) reward = tier1Pool / 10;
      else if (rank <= 50) reward = tier2Pool / 40;
      else reward = tier3Pool / 50;

      return {
        rank,
        address: `${Math.random().toString(36).substring(2, 8)}...${Math.random().toString(36).substring(2, 6)}`,
        balance: Math.floor(Math.random() * 100000) + 1000,
        dailyReward: reward,
        percentage: Math.floor((100 / Math.pow(rank, 1.2)) * 100) / 100
      };
    });
  };

  const getRankBg = (rank: number) => {
    if (rank === 1) return "bg-gradient-to-r from-yellow-500/20 to-amber-500/10 border-yellow-500/40";
    if (rank === 2) return "bg-gradient-to-r from-slate-400/20 to-slate-500/10 border-slate-400/40";
    if (rank === 3) return "bg-gradient-to-r from-orange-500/20 to-amber-500/10 border-orange-500/40";
    return "bg-muted/30 border-border/50";
  };

  const formatNumber = (num: number): string => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const formatAddress = (address: string) => {
    if (address.length > 12) return `${address.slice(0, 4)}...${address.slice(-4)}`;
    return address;
  };

  // Only show actually claimable rewards (not claimed AND reward_amount > 0)
  const unclaimedRewards = userRewards.filter(r => !r.claimed && r.reward_amount > 0);
  const totalUnclaimedAmount = unclaimedRewards.reduce((sum, r) => sum + r.reward_amount, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="pb-20 md:pb-0">
          <div className="flex items-center justify-center h-[80vh]">
            <Loader2 className="h-8 w-8 animate-spin text-green-500" />
          </div>
        </main>
      </div>
    );
  }

  if (!raceData) {
    return (
      <div className="min-h-screen bg-background">
        <main className="pb-20 md:pb-0">
          <div className="flex flex-col items-center justify-center h-[80vh] gap-4">
            <Trophy className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Race not found</p>
            <Button onClick={() => navigate("/")} variant="outline">Back to Home</Button>
          </div>
        </main>
      </div>
    );
  }

  const dailyPool = raceData.daily_reward_amount || (raceData.prize_pool / raceData.total_rounds);
  const userHolder = connected && walletAddress ? holders.find(h => h.address === walletAddress) : null;

  return (
    <div className="min-h-screen bg-background">
      
      <main className="pb-20 md:pb-0">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Back Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Races
          </Button>

          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            {raceData.token_logo_url && (
              <img 
                src={raceData.token_logo_url} 
                alt={raceData.token_name || ''} 
                className="w-16 h-16 rounded-full border-2 border-green-500/30"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold">{raceData.token_name} Race</h1>
              <p className="text-muted-foreground">${raceData.token_symbol} • Round {raceData.current_round}/{raceData.total_rounds}</p>
            </div>
            <Badge className={`ml-auto ${racePhase === 'entry' ? 'bg-green-500' : racePhase === 'holding' ? 'bg-yellow-500' : 'bg-red-500'}`}>
              {racePhase === 'entry' ? 'Entry Phase' : racePhase === 'holding' ? 'Holding Phase' : 'Round Ended'}
            </Badge>
          </div>

          {/* Round Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Round Progress</span>
              <span className="font-medium">
                {racePhase === 'entry' ? 'Entry Phase (1h)' : racePhase === 'holding' ? 'Holding Phase (23h)' : 'Round Complete'}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${
                  racePhase === 'entry' ? 'bg-green-500' : racePhase === 'holding' ? 'bg-yellow-500' : 'bg-primary'
                }`}
                style={{
                  width: racePhase === 'ended' ? '100%' : 
                    racePhase === 'entry' 
                      ? `${((60 - entryTimeRemaining.minutes) / 60) * 4.17}%`  // Entry is ~4.17% of 24h
                      : `${4.17 + ((23 - timeRemaining.hours) / 23) * 95.83}%` // Holding is remaining 95.83%
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Start</span>
              <span>Entry Closes (1h)</span>
              <span>Round Ends (24h)</span>
            </div>
          </div>

          {/* Timer Cards */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card className="p-4 border-green-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-green-400" />
                <span className="text-sm text-muted-foreground">Round Ends In</span>
              </div>
              <p className="text-2xl font-bold font-mono">
                {String(timeRemaining.hours).padStart(2, '0')}:{String(timeRemaining.minutes).padStart(2, '0')}:{String(timeRemaining.seconds).padStart(2, '0')}
              </p>
            </Card>
            
            {racePhase === 'entry' && (
              <Card className="p-4 border-yellow-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm text-muted-foreground">Entry Closes In</span>
                </div>
                <p className="text-2xl font-bold font-mono text-yellow-400">
                  {String(entryTimeRemaining.hours).padStart(2, '0')}:{String(entryTimeRemaining.minutes).padStart(2, '0')}:{String(entryTimeRemaining.seconds).padStart(2, '0')}
                </p>
              </Card>
            )}
            
            {racePhase !== 'entry' && (
              <Card className="p-4 border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Round Prize Pool</span>
                </div>
                <p className="text-2xl font-bold">
                  {formatNumber(dailyPool)} <span className="text-sm text-muted-foreground">{raceData.token_symbol}</span>
                </p>
              </Card>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Card className="p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Prize Pool</p>
              <p className="font-bold text-green-400">{formatNumber(raceData.prize_pool)}</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Participants</p>
              <p className="font-bold">{raceData.total_participants}</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Rounds Left</p>
              <p className="font-bold">{raceData.total_rounds - raceData.current_round + 1}</p>
            </Card>
          </div>

          {/* Reward Tiers - Compact */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-center">
              <p className="text-[10px] text-muted-foreground">Top 10</p>
              <p className="text-sm font-bold text-yellow-400">{formatNumber(dailyPool * 0.6 / 10)}</p>
              <p className="text-[10px] text-muted-foreground">60% pool</p>
            </div>
            <div className="p-2 bg-slate-500/10 border border-slate-500/20 rounded-lg text-center">
              <p className="text-[10px] text-muted-foreground">Rank 11-50</p>
              <p className="text-sm font-bold text-slate-400">{formatNumber(dailyPool * 0.3 / 40)}</p>
              <p className="text-[10px] text-muted-foreground">30% pool</p>
            </div>
            <div className="p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg text-center">
              <p className="text-[10px] text-muted-foreground">Rank 51-100</p>
              <p className="text-sm font-bold text-orange-400">{formatNumber(dailyPool * 0.1 / 50)}</p>
              <p className="text-[10px] text-muted-foreground">10% pool</p>
            </div>
          </div>

          {/* User Rewards */}
          {connected && unclaimedRewards.length > 0 && (
            <Card className="p-4 mb-6 border-green-500/30 bg-green-500/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-green-400" />
                  <span className="font-bold">Your Unclaimed Rewards</span>
                </div>
                <span className="text-xl font-bold text-green-400">{formatNumber(totalUnclaimedAmount)} {raceData.token_symbol}</span>
              </div>
              <div className="mt-3 space-y-2">
                {unclaimedRewards.map(reward => (
                  <div key={reward.id} className="flex items-center justify-between p-2 bg-background/50 rounded-lg">
                    <span className="text-sm">Round {reward.round_number} • Rank #{reward.rank}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{formatNumber(reward.reward_amount)}</span>
                      <Button 
                        size="sm" 
                        onClick={() => handleClaimReward(reward.id)}
                        disabled={isClaiming === reward.id}
                      >
                        {isClaiming === reward.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Claim'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Leaderboard */}
          <Tabs defaultValue="leaderboard" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="leaderboard">
                <Trophy className="w-4 h-4 mr-2" />
                Leaderboard
              </TabsTrigger>
              <TabsTrigger value="my-rewards">
                <Gift className="w-4 h-4 mr-2" />
                My Rewards
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="w-4 h-4 mr-2" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="leaderboard" className="mt-4">
              <Card className="border-green-500/20 overflow-hidden">
                <div className="max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="w-16">Rank</TableHead>
                        <TableHead>Wallet</TableHead>
                        {racePhase === 'holding' && <TableHead className="text-center">Status</TableHead>}
                        <TableHead className="text-right">Balance</TableHead>
                        {racePhase === 'holding' && <TableHead className="text-right">Retention</TableHead>}
                        <TableHead className="text-right">Daily Reward</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(racePhase === 'holding' ? lockedParticipants : holders).slice(0, 100).map((holder, index) => {
                        const isLocked = 'wallet_address' in holder;
                        const address = isLocked ? (holder as LockedParticipant).wallet_address : (holder as Holder).address;
                        const entryBalance = isLocked ? (holder as LockedParticipant).entry_balance : 0;
                        const currentBalance = isLocked ? (holder as LockedParticipant).current_balance : (holder as Holder).balance;
                        const retentionPct = isLocked ? (holder as LockedParticipant).retention_percentage : 100;
                        const isEligible = isLocked ? (holder as LockedParticipant).is_eligible : true;
                        const reward = holder.dailyReward;
                        const isUser = address === walletAddress;
                        
                        return (
                          <TableRow key={index} className={`${getRankBg(holder.rank)} ${isUser ? 'ring-2 ring-green-500' : ''} ${!isEligible && racePhase === 'holding' ? 'opacity-60' : ''}`}>
                            <TableCell className="font-bold">
                              {holder.rank <= 3 ? (
                                <span className={`${holder.rank === 1 ? 'text-yellow-400' : holder.rank === 2 ? 'text-slate-300' : 'text-orange-400'}`}>
                                  #{holder.rank}
                                </span>
                              ) : (
                                `#${holder.rank}`
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-sm">{formatAddress(address)}</span>
                              {isUser && <Badge className="ml-2 bg-green-500">You</Badge>}
                            </TableCell>
                            {racePhase === 'holding' && (
                              <TableCell className="text-center">
                                {isEligible ? (
                                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Eligible
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/30">
                                    Sold
                                  </Badge>
                                )}
                              </TableCell>
                            )}
                            <TableCell className="text-right font-mono">{formatNumber(currentBalance)}</TableCell>
                            {racePhase === 'holding' && (
                              <TableCell className="text-right">
                                <span className={`font-mono text-sm ${retentionPct >= 90 ? 'text-green-400' : 'text-red-400'}`}>
                                  {retentionPct.toFixed(1)}%
                                </span>
                              </TableCell>
                            )}
                            <TableCell className={`text-right font-bold ${isEligible ? 'text-green-400' : 'text-muted-foreground line-through'}`}>
                              +{formatNumber(reward)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="my-rewards" className="mt-4">
              {!connected ? (
                <Card className="p-8 text-center border-border">
                  <Gift className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">Connect your wallet to view your rewards</p>
                </Card>
              ) : userRewards.length === 0 ? (
                <Card className="p-8 text-center border-border">
                  <Gift className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No rewards yet. Participate in the race to earn rewards!</p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {/* Summary Card */}
                  <Card className="p-4 border-green-500/30 bg-green-500/5">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Total Unclaimed</p>
                        <p className="text-2xl font-bold text-green-400">
                          {formatNumber(totalUnclaimedAmount)} <span className="text-sm">{raceData.token_symbol}</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Total Claimed</p>
                        <p className="text-2xl font-bold">
                          {formatNumber(userRewards.filter(r => r.claimed).reduce((sum, r) => sum + r.reward_amount, 0))} <span className="text-sm text-muted-foreground">{raceData.token_symbol}</span>
                        </p>
                      </div>
                    </div>
                  </Card>

                  {/* Rewards List */}
                  <Card className="border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Round</TableHead>
                          <TableHead>Rank</TableHead>
                          <TableHead className="text-right">Reward</TableHead>
                          <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userRewards.map((reward) => {
                          const withdrawal = pendingWithdrawals.find(w => 
                            Math.abs(w.amount - reward.reward_amount) < 0.01 && 
                            new Date(w.created_at) >= new Date(reward.created_at)
                          );
                          
                          return (
                            <TableRow key={reward.id}>
                              <TableCell className="font-bold">Round {reward.round_number}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={reward.rank <= 10 ? 'border-yellow-500 text-yellow-400' : reward.rank <= 50 ? 'border-slate-400 text-slate-400' : 'border-orange-500 text-orange-400'}>
                                  #{reward.rank}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold text-green-400">
                                +{formatNumber(reward.reward_amount)}
                              </TableCell>
                              <TableCell className="text-right">
                                {reward.claimed ? (
                                  withdrawal ? (
                                    <div className="flex items-center justify-end gap-2">
                                      <Badge 
                                        className={
                                          withdrawal.status === 'completed' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                          withdrawal.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                                          'bg-red-500/20 text-red-400 border-red-500/30'
                                        }
                                      >
                                        {withdrawal.status === 'completed' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                                        {withdrawal.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                                        {withdrawal.status.charAt(0).toUpperCase() + withdrawal.status.slice(1)}
                                      </Badge>
                                      {withdrawal.tx_hash && (
                                        <a
                                          href={`https://solscan.io/tx/${withdrawal.tx_hash}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-primary hover:underline"
                                        >
                                          <ExternalLink className="w-4 h-4" />
                                        </a>
                                      )}
                                    </div>
                                  ) : (
                                    <Badge className="bg-muted text-muted-foreground">
                                      <CheckCircle2 className="w-3 h-3 mr-1" />
                                      Claimed
                                    </Badge>
                                  )
                                ) : reward.reward_amount === 0 || reward.is_eligible === false ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/30">
                                          Ineligible
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>You sold or dropped below 90% of entry balance</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : (
                                  <Button 
                                    size="sm" 
                                    onClick={() => handleClaimReward(reward.id)}
                                    disabled={isClaiming === reward.id}
                                    className="bg-green-500 hover:bg-green-600"
                                  >
                                    {isClaiming === reward.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Claim'}
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              {!connected ? (
                <Card className="p-8 text-center border-border">
                  <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Connect your wallet to view your race history</p>
                </Card>
              ) : userRewards.length === 0 ? (
                <Card className="p-8 text-center border-border">
                  <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No race history yet. Participate in rounds to earn rewards!</p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {/* Summary Stats */}
                  <Card className="p-4 border-primary/20 bg-primary/5">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-1">Rounds Participated</p>
                        <p className="text-2xl font-bold">{userRewards.length}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-1">Total Earned</p>
                        <p className="text-2xl font-bold text-green-400">
                          {formatNumber(userRewards.reduce((sum, r) => sum + r.reward_amount, 0))}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-1">Best Rank</p>
                        <p className="text-2xl font-bold text-yellow-400">
                          #{Math.min(...userRewards.map(r => r.rank))}
                        </p>
                      </div>
                    </div>
                  </Card>

                  {/* Round History */}
                  <Card className="border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Round</TableHead>
                          <TableHead>Rank</TableHead>
                          <TableHead>Reward</TableHead>
                          <TableHead className="text-right">Claim Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userRewards.map((reward) => {
                          const withdrawal = pendingWithdrawals.find(w => 
                            Math.abs(w.amount - reward.reward_amount) < 0.01 && 
                            new Date(w.created_at) >= new Date(reward.created_at)
                          );
                          
                          return (
                            <TableRow key={reward.id} className={reward.rank <= 10 ? 'bg-yellow-500/5' : ''}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Trophy className={`w-4 h-4 ${reward.rank <= 3 ? 'text-yellow-400' : 'text-muted-foreground'}`} />
                                  <span className="font-bold">Round {reward.round_number}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant="outline" 
                                  className={
                                    reward.rank <= 10 ? 'border-yellow-500 text-yellow-400' : 
                                    reward.rank <= 50 ? 'border-slate-400 text-slate-400' : 
                                    'border-orange-500 text-orange-400'
                                  }
                                >
                                  #{reward.rank}
                                  {reward.rank === 1 && ' 🥇'}
                                  {reward.rank === 2 && ' 🥈'}
                                  {reward.rank === 3 && ' 🥉'}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono font-bold text-green-400">
                                +{formatNumber(reward.reward_amount)} {raceData?.token_symbol}
                              </TableCell>
                              <TableCell className="text-right">
                                {reward.is_eligible === false || reward.reward_amount === 0 ? (
                                  <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/30">
                                    Ineligible
                                  </Badge>
                                ) : reward.claimed ? (
                                  withdrawal ? (
                                    <div className="flex items-center justify-end gap-2">
                                      <Badge 
                                        className={
                                          withdrawal.status === 'completed' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                          withdrawal.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                                          'bg-red-500/20 text-red-400 border-red-500/30'
                                        }
                                      >
                                        {withdrawal.status === 'completed' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                                        {withdrawal.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                                        {withdrawal.status.charAt(0).toUpperCase() + withdrawal.status.slice(1)}
                                      </Badge>
                                      {withdrawal.tx_hash && (
                                        <a
                                          href={`https://solscan.io/tx/${withdrawal.tx_hash}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-primary hover:underline"
                                        >
                                          <ExternalLink className="w-4 h-4" />
                                        </a>
                                      )}
                                    </div>
                                  ) : (
                                    <Badge className="bg-muted text-muted-foreground">
                                      <CheckCircle2 className="w-3 h-3 mr-1" />
                                      Claimed
                                    </Badge>
                                  )
                                ) : (
                                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                                    <Clock className="w-3 h-3 mr-1" />
                                    Pending
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </Card>
                </div>
              )}
            </TabsContent>

          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default RaceDetails;
