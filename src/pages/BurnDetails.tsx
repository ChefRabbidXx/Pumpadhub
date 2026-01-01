import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Flame, Copy, ExternalLink, Loader2, Trophy, Skull, Wallet, Gift, Clock, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useWallet } from '@/contexts/WalletContext';
import { useTokenBalance } from '@/hooks/use-token-balance';
import { burnSplTokens } from '@/utils/spl-token-utils';
import { usePoolActions } from '@/hooks/use-pool-actions';

interface BurnPoolData {
  id: string;
  total_burned: number;
  burn_value: number;
  participants: number;
  status: string;
  reward_supply: number;
  total_paid_out: number;
  contract_address: string;
  token_name: string;
  token_symbol: string;
  token_logo_url: string;
  token_decimals: number;
  token_total_supply: number;
}

interface BurnTransaction {
  id: string;
  wallet_address: string;
  burn_amount: number;
  result: 'win' | 'lose';
  reward_amount: number;
  created_at: string;
}

interface UserRewards {
  claimable_balance: number;
  total_burned: number;
  total_won: number;
  total_lost: number;
  wins_count: number;
  losses_count: number;
}

type GameResult = 'pending' | 'win' | 'lose' | null;

const BurnDetails = () => {
  const { contractAddress } = useParams<{ contractAddress: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { connected, walletAddress } = useWallet();
  const { claimRewards } = usePoolActions();

  const [pool, setPool] = useState<BurnPoolData | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<BurnTransaction[]>([]);
  const [userRewards, setUserRewards] = useState<UserRewards | null>(null);
  const [burnAmount, setBurnAmount] = useState("");
  const [isGambling, setIsGambling] = useState(false);
  const [gameResult, setGameResult] = useState<GameResult>(null);
  const [lastWinAmount, setLastWinAmount] = useState<number>(0);
  const [isClaiming, setIsClaiming] = useState(false);
  const [activeTab, setActiveTab] = useState("burn");
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [hasPendingClaim, setHasPendingClaim] = useState(false);

  useEffect(() => {
    const fetchPool = async () => {
      if (!contractAddress) return;
      setLoading(true);
      
      // Fetch pool - include both active and completed to show history
      const { data, error } = await supabase
        .from('burn_pools')
        .select('*')
        .eq('contract_address', contractAddress)
        .maybeSingle();

      if (error) {
        console.error('Error fetching burn pool:', error);
        setLoading(false);
        return;
      }
      if (data) setPool(data as BurnPoolData);
      setLoading(false);
    };

    fetchPool();

    const channel = supabase
      .channel(`burn-pool-${contractAddress}-${Date.now()}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'burn_pools'
      }, async () => {
          const { data } = await supabase.from('burn_pools')
            .select('*')
            .eq('contract_address', contractAddress)
            .maybeSingle();
          if (data) setPool(data as BurnPoolData);
        }
      ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [contractAddress]);

  useEffect(() => {
    if (!pool) return;
    
    const fetchTransactions = async () => {
      const { data, error } = await supabase.from('burn_transactions').select('*')
        .eq('pool_id', pool.id).order('created_at', { ascending: false }).limit(15);
      if (!error && data) {
        setTransactions(data as BurnTransaction[]);
      }
    };
    
    fetchTransactions();
  }, [pool?.id]);

  useEffect(() => {
    if (!pool || !walletAddress) return;
    
    const fetchUserRewards = async () => {
      const { data, error } = await supabase.from('burn_rewards').select('*')
        .eq('pool_id', pool.id).eq('wallet_address', walletAddress).maybeSingle();
      if (!error && data) {
        setUserRewards(data as UserRewards);
      } else {
        setUserRewards(null);
      }
    };
    
    fetchUserRewards();
  }, [pool?.id, walletAddress]);

  useEffect(() => {
    if (!pool || !walletAddress) return;
    let cancelled = false;
    
    const fetchWithdrawals = async () => {
      const { data, error } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('wallet_address', walletAddress)
        .eq('pool_id', pool.id)
        .eq('feature', 'burn')
        .order('created_at', { ascending: false });
      
      if (!error && data && !cancelled) {
        setPendingWithdrawals(data);
        const hasPending = data.some((w: any) => w.status === 'pending' || w.status === 'processing');
        setHasPendingClaim(hasPending);
      }
    };
    
    fetchWithdrawals();

    const channel = supabase
      .channel(`burn-withdrawals-${pool.id}-${walletAddress}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'withdrawal_requests',
      }, fetchWithdrawals)
      .subscribe();

    const rewardsChannel = supabase
      .channel(`burn-rewards-${pool.id}-${walletAddress}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'burn_rewards',
      }, async () => {
        const { data } = await supabase.from('burn_rewards').select('*')
          .eq('pool_id', pool.id).eq('wallet_address', walletAddress).maybeSingle();
        if (data && !cancelled) setUserRewards(data as UserRewards);
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      supabase.removeChannel(rewardsChannel);
    };
  }, [pool?.id, walletAddress]);

  const { balance, loading: balanceLoading, refetch: refetchBalance } = useTokenBalance(pool?.contract_address);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toLocaleString();
  };

  const formatTimeAgo = (dateString: string) => {
    const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!" });
  };

  const handleDoubleOrNothing = async () => {
    if (!pool || !burnAmount || !walletAddress) return;
    const amount = parseFloat(burnAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid Amount", variant: "destructive" });
      return;
    }
    if (amount > balance) {
      toast({ title: "Insufficient Balance", variant: "destructive" });
      return;
    }

    if (pool.status === 'completed') {
      toast({ title: "Pool Completed", description: "No more rewards available", variant: "destructive" });
      return;
    }

    const potentialWin = amount * 2;
    const availableRewards = pool.reward_supply - pool.total_paid_out;
    
    if (potentialWin > availableRewards) {
      const maxBurnAmount = availableRewards / 2;
      toast({ 
        title: "Amount Too High", 
        description: `Max burn: ${formatNumber(maxBurnAmount)} (based on available rewards)`,
        variant: "destructive" 
      });
      return;
    }

    setIsGambling(true);
    setGameResult('pending');

    const burnResult = await burnSplTokens(
      { publicKey: walletAddress },
      pool.contract_address,
      amount,
      pool.token_decimals || 6
    );

    if (!burnResult.success) {
      setGameResult(null);
      setIsGambling(false);
      toast({ 
        title: "Burn Failed", 
        description: burnResult.message || "Transaction failed", 
        variant: "destructive" 
      });
      return;
    }

    refetchBalance();
    toast({ title: "Tokens Burned!", description: `TX: ${burnResult.txHash.slice(0, 8)}...` });
    
    const { data: gambleResult, error: gambleError } = await supabase.functions.invoke('burn-gamble', {
      body: {
        poolId: pool.id,
        walletAddress,
        burnAmount: amount,
        burnTxHash: burnResult.txHash,
      },
    });

    if (gambleError || !gambleResult?.success) {
      console.error('Gamble error:', gambleError, gambleResult);
      setGameResult(null);
      setIsGambling(false);
      toast({ 
        title: "Game Error", 
        description: gambleResult?.error || "Failed to process gamble", 
        variant: "destructive" 
      });
      return;
    }

    const { won, rewardAmount } = gambleResult;

    if (won) {
      setGameResult('win');
      setLastWinAmount(rewardAmount);
      toast({ title: "DOUBLED!", description: `+${formatNumber(rewardAmount)} ${pool.token_symbol}` });
    } else {
      setGameResult('lose');
      toast({ title: "BURNED!", description: "Gone forever", variant: "destructive" });
    }

    const { data: updatedRewards } = await supabase.from('burn_rewards').select('*')
      .eq('pool_id', pool.id).eq('wallet_address', walletAddress).maybeSingle();
    if (updatedRewards) setUserRewards(updatedRewards as UserRewards);

    const { data: updatedTx } = await supabase.from('burn_transactions').select('*')
      .eq('pool_id', pool.id).order('created_at', { ascending: false }).limit(15);
    if (updatedTx) setTransactions(updatedTx as BurnTransaction[]);

    const { data: updatedPool } = await supabase.from('burn_pools').select('status').eq('id', pool.id).single();
    if (updatedPool?.status === 'completed') {
      setTimeout(() => {
        toast({ title: "Pool Completed!", description: "All rewards have been distributed" });
      }, 3500);
    }

    setBurnAmount("");
    refetchBalance();
    setTimeout(() => refetchBalance(), 2000);
    setTimeout(() => { setGameResult(null); setIsGambling(false); }, 3000);
  };

  const handleClaimRewards = async () => {
    if (!userRewards || !walletAddress || !pool) return;
    const totalClaimable = userRewards.claimable_balance;
    if (totalClaimable <= 0) return;

    if (hasPendingClaim) {
      toast({ title: 'Claim already in progress', description: 'Please wait for the pending claim to finish.', variant: 'destructive' });
      return;
    }

    setIsClaiming(true);
    setHasPendingClaim(true);
    
    const success = await claimRewards(pool.id, 'burn', totalClaimable);

    if (success) {
      setUserRewards(prev => prev ? { ...prev, claimable_balance: 0 } : null);
    } else {
      setHasPendingClaim(false);
    }
    
    setIsClaiming(false);
  };

  const burnPercentage = pool?.token_total_supply ? ((pool.total_burned / pool.token_total_supply) * 100).toFixed(4) : '0';
  const remainingRewards = pool ? pool.reward_supply - pool.total_paid_out : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center h-[80vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex flex-col items-center justify-center h-[80vh] gap-4">
          <div className="w-16 h-16 flex items-center justify-center bg-muted border-2 border-border">
            <Flame className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="font-pixel text-lg text-foreground">POOL NOT FOUND</h1>
          <p className="text-sm text-muted-foreground">The burn pool doesn't exist.</p>
          <Button variant="pixel" onClick={() => navigate('/burn')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            BACK
          </Button>
        </div>
      </div>
    );
  }

  const netPL = userRewards ? userRewards.total_won - userRewards.total_burned : 0;
  const totalClaimable = userRewards?.claimable_balance || 0;
  const isPoolCompleted = pool.status === 'completed';

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Back Button */}
        <Button variant="ghost" size="sm" onClick={() => navigate('/burn')} className="mb-6 font-pixel text-[9px]">
          <ArrowLeft className="w-4 h-4 mr-2" />
          BACK
        </Button>

        {/* Header */}
        <div className="text-center mb-8">
          {pool.token_logo_url && (
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 border-2 border-orange-400/50 bg-card p-2">
                <img src={pool.token_logo_url} alt={pool.token_name} className="w-full h-full object-contain" />
              </div>
            </div>
          )}

          <h1 className="font-pixel text-xl sm:text-2xl text-foreground mb-2">
            BURN <span className="text-orange-400">{pool.token_symbol}</span>
          </h1>
          <p className="text-sm text-muted-foreground mb-4">Double or nothing gamble</p>
          
          {isPoolCompleted && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted border-2 border-border mb-4">
              <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
              <span className="font-pixel text-[9px] text-muted-foreground">POOL COMPLETED</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button 
              className="flex items-center gap-2 px-4 py-2 bg-muted border-2 border-border hover:border-orange-400/50 transition-colors group font-mono text-sm"
              onClick={() => copyToClipboard(pool.contract_address || '')}
            >
              <span className="text-muted-foreground">CA:</span>
              <span className="text-foreground">{(pool.contract_address || '').slice(0, 6)}...{(pool.contract_address || '').slice(-4)}</span>
              <Copy className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-orange-400" />
            </button>
            
            <a
              href={`https://pump.fun/${pool.contract_address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-orange-400 hover:bg-orange-500 text-black font-pixel text-[9px] transition-colors"
            >
              PUMP.FUN
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="p-4 bg-card border-2 border-orange-400/30 text-center">
            <div className="flex items-center justify-center mb-2">
              <div className="w-8 h-8 flex items-center justify-center bg-orange-400/10 border border-orange-400/30">
                <Flame className="w-4 h-4 text-orange-400" />
              </div>
            </div>
            <p className="font-pixel text-[8px] text-muted-foreground mb-1">BURNED</p>
            <p className="font-pixel text-sm text-orange-400">{formatNumber(pool.total_burned)}</p>
            <p className="font-pixel text-[7px] text-muted-foreground">{burnPercentage}%</p>
          </div>
          
          <div className="p-4 bg-card border-2 border-border text-center">
            <div className="flex items-center justify-center mb-2">
              <div className="w-8 h-8 flex items-center justify-center bg-muted border border-border">
                <Gift className="w-4 h-4 text-foreground" />
              </div>
            </div>
            <p className="font-pixel text-[8px] text-muted-foreground mb-1">REWARDS</p>
            <p className="font-pixel text-sm text-foreground">{formatNumber(remainingRewards)}</p>
          </div>
          
          <div className="p-4 bg-card border-2 border-border text-center">
            <div className="flex items-center justify-center mb-2">
              <div className="w-8 h-8 flex items-center justify-center bg-muted border border-border">
                <Trophy className="w-4 h-4 text-foreground" />
              </div>
            </div>
            <p className="font-pixel text-[8px] text-muted-foreground mb-1">PLAYERS</p>
            <p className="font-pixel text-sm text-foreground">{pool.participants}</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 bg-muted border-2 border-border h-auto p-1">
            <TabsTrigger value="burn" className="font-pixel text-[8px] data-[state=active]:bg-card data-[state=active]:text-orange-400 py-2">
              <Flame className="w-3 h-3 mr-1" />
              BURN
            </TabsTrigger>
            <TabsTrigger value="rewards" className="font-pixel text-[8px] data-[state=active]:bg-card data-[state=active]:text-orange-400 py-2">
              <Gift className="w-3 h-3 mr-1" />
              REWARDS
            </TabsTrigger>
            <TabsTrigger value="history" className="font-pixel text-[8px] data-[state=active]:bg-card data-[state=active]:text-orange-400 py-2">
              <Clock className="w-3 h-3 mr-1" />
              HISTORY
            </TabsTrigger>
          </TabsList>

          <TabsContent value="burn">
            <div className="bg-card border-2 border-border p-6">
              {/* Game Result Overlay */}
              {gameResult && (
                <div className={`mb-6 p-6 border-2 text-center ${
                  gameResult === 'win' ? 'border-green-400 bg-green-400/10' : 
                  gameResult === 'lose' ? 'border-red-400 bg-red-400/10' : 
                  'border-border bg-muted'
                }`}>
                  {gameResult === 'pending' && (
                    <>
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-orange-400" />
                      <p className="font-pixel text-[9px] text-muted-foreground">BURNING...</p>
                    </>
                  )}
                  {gameResult === 'win' && (
                    <>
                      <Trophy className="w-10 h-10 mx-auto mb-2 text-green-400" />
                      <p className="font-pixel text-lg text-green-400">DOUBLED!</p>
                      <p className="font-pixel text-[9px] text-muted-foreground">+{formatNumber(lastWinAmount)} {pool.token_symbol}</p>
                    </>
                  )}
                  {gameResult === 'lose' && (
                    <>
                      <Skull className="w-10 h-10 mx-auto mb-2 text-red-400" />
                      <p className="font-pixel text-lg text-red-400">BURNED!</p>
                      <p className="font-pixel text-[9px] text-muted-foreground">Gone forever</p>
                    </>
                  )}
                </div>
              )}

              {!gameResult && (
                <>
                  {/* Balance */}
                  <div className="flex items-center justify-between mb-4 p-3 bg-muted border border-border">
                    <span className="font-pixel text-[8px] text-muted-foreground">YOUR BALANCE</span>
                    <span className="font-pixel text-[9px] text-foreground">
                      {balanceLoading ? '...' : formatNumber(balance)} {pool.token_symbol}
                    </span>
                  </div>

                  {/* Burn Input */}
                  <div className="space-y-4">
                    <div>
                      <label className="font-pixel text-[8px] text-muted-foreground mb-2 block">BURN AMOUNT</label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={burnAmount}
                        onChange={(e) => setBurnAmount(e.target.value)}
                        className="font-mono text-lg h-12 bg-muted border-2 border-border"
                        disabled={isGambling || isPoolCompleted}
                      />
                      <div className="flex gap-2 mt-2">
                        {[25, 50, 75, 100].map(pct => (
                          <button
                            key={pct}
                            onClick={() => setBurnAmount(String(Math.floor(balance * pct / 100)))}
                            className="flex-1 py-1 font-pixel text-[8px] bg-muted border border-border hover:border-orange-400/50 transition-colors"
                            disabled={isGambling || isPoolCompleted}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    </div>

                    <Button
                      onClick={handleDoubleOrNothing}
                      disabled={!connected || isGambling || !burnAmount || parseFloat(burnAmount) <= 0 || isPoolCompleted}
                      className="w-full h-14 bg-orange-400 hover:bg-orange-500 text-black font-pixel text-sm"
                    >
                      {isGambling ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : isPoolCompleted ? (
                        'POOL COMPLETED'
                      ) : (
                        <>
                          <Flame className="w-5 h-5 mr-2" />
                          DOUBLE OR NOTHING
                        </>
                      )}
                    </Button>

                    <p className="text-center font-pixel text-[8px] text-muted-foreground">
                      50% chance to double • 50% chance to lose all
                    </p>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="rewards">
            <div className="bg-card border-2 border-border p-6 space-y-4">
              {/* Your Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted border border-border text-center">
                  <p className="font-pixel text-[8px] text-muted-foreground mb-1">WINS</p>
                  <p className="font-pixel text-lg text-green-400">{userRewards?.wins_count || 0}</p>
                </div>
                <div className="p-3 bg-muted border border-border text-center">
                  <p className="font-pixel text-[8px] text-muted-foreground mb-1">LOSSES</p>
                  <p className="font-pixel text-lg text-red-400">{userRewards?.losses_count || 0}</p>
                </div>
              </div>

              <div className="p-4 bg-muted border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-pixel text-[8px] text-muted-foreground">NET P/L</span>
                  <span className={`font-pixel text-sm ${netPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {netPL >= 0 ? '+' : ''}{formatNumber(netPL)} {pool.token_symbol}
                  </span>
                </div>
              </div>

              {/* Claimable */}
              <div className="p-4 bg-orange-400/10 border-2 border-orange-400/30">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-pixel text-[9px] text-foreground">CLAIMABLE</span>
                  <span className="font-pixel text-lg text-orange-400">{formatNumber(totalClaimable)} {pool.token_symbol}</span>
                </div>
                <Button
                  onClick={handleClaimRewards}
                  disabled={totalClaimable <= 0 || isClaiming || hasPendingClaim}
                  className="w-full bg-orange-400 hover:bg-orange-500 text-black font-pixel text-[9px]"
                >
                  {isClaiming ? <Loader2 className="w-4 h-4 animate-spin" /> : hasPendingClaim ? 'CLAIM PENDING...' : 'CLAIM REWARDS'}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="bg-card border-2 border-border p-4">
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {transactions.length === 0 ? (
                  <p className="text-center py-8 font-pixel text-[9px] text-muted-foreground">No burns yet</p>
                ) : (
                  transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-3 bg-muted border border-border">
                      <div className="flex items-center gap-3">
                        {tx.result === 'win' ? (
                          <Trophy className="w-4 h-4 text-green-400" />
                        ) : (
                          <Skull className="w-4 h-4 text-red-400" />
                        )}
                        <div>
                          <p className="font-mono text-xs text-foreground">
                            {tx.wallet_address.slice(0, 4)}...{tx.wallet_address.slice(-4)}
                          </p>
                          <p className="font-pixel text-[7px] text-muted-foreground">{formatTimeAgo(tx.created_at)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-pixel text-[9px] ${tx.result === 'win' ? 'text-green-400' : 'text-red-400'}`}>
                          {tx.result === 'win' ? `+${formatNumber(tx.reward_amount)}` : `-${formatNumber(tx.burn_amount)}`}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BurnDetails;
