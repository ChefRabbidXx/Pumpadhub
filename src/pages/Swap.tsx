import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, RefreshCw, TrendingUp, ExternalLink, Wallet, CircleDollarSign, BarChart3, Award, ArrowDownUp, AlertCircle, Gift } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { useJupiterSwap, JupiterQuote } from '@/hooks/use-jupiter-swap';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { SwapConfirmDialog } from '@/components/swap/SwapConfirmDialog';

const PUMPAD_CONTRACT = "2FWWHi5NLVj6oXkAyWAtqjBZ6CNRCX8QM8yUtRVNpump";
const SOL_PRICE_USD = 180;

interface TokenDisplay {
  symbol: string;
  name: string;
  logo: string;
  decimals: number;
  mint: string;
}

interface SwapTransaction {
  id: string;
  wallet_address: string;
  from_token: string;
  to_token: string;
  from_amount: number;
  to_amount: number;
  sol_value: number;
  usd_value: number;
  reward_amount: number;
  tx_hash: string | null;
  created_at: string;
}

interface UserStats {
  totalTrades: number;
  totalSol: number;
  totalRewards: number;
  claimedRewards: number;
}

const SOL_TOKEN: TokenDisplay = {
  symbol: 'SOL',
  name: 'Solana',
  logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  decimals: 9,
  mint: 'So11111111111111111111111111111111111111112',
};

const PUMPAD_TOKEN: TokenDisplay = {
  symbol: 'PUMPAD',
  name: 'Pumpad Token',
  logo: '/pumpad-logo.png',
  decimals: 6,
  mint: PUMPAD_CONTRACT,
};

const Swap = () => {
  const { connected, connectWallet, balance, walletAddress } = useWallet();
  const { getSOLToPumpadQuote, getPumpadToSOLQuote, executeSwap, formatOutputAmount } = useJupiterSwap();

  const [isSolToToken, setIsSolToToken] = useState(true);
  const [amount, setAmount] = useState<string>('');
  const [outputAmount, setOutputAmount] = useState<string>('');
  const [swapping, setSwapping] = useState(false);
  const [slippage, setSlippage] = useState(0.5);
  const [currentQuote, setCurrentQuote] = useState<JupiterQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [priceImpact, setPriceImpact] = useState<string>('0');
  const [pumpadBalance, setPumpadBalance] = useState<number>(0);
  const [pumpadPrice, setPumpadPrice] = useState<number>(0.00015);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [userStats, setUserStats] = useState<UserStats>({
    totalTrades: 0,
    totalSol: 0,
    totalRewards: 0,
    claimedRewards: 0,
  });
  const [tradeHistory, setTradeHistory] = useState<SwapTransaction[]>([]);
  const [claiming, setClaiming] = useState(false);

  const fromToken = isSolToToken ? SOL_TOKEN : PUMPAD_TOKEN;
  const toToken = isSolToToken ? PUMPAD_TOKEN : SOL_TOKEN;
  const fromBalance = isSolToToken ? balance : pumpadBalance;
  const toBalance = isSolToToken ? pumpadBalance : balance;

  // Fetch user stats and trade history on wallet connect
  useEffect(() => {
    const fetchUserData = async () => {
      if (!walletAddress) {
        setUserStats({ totalTrades: 0, totalSol: 0, totalRewards: 0, claimedRewards: 0 });
        setTradeHistory([]);
        return;
      }
      try {
        const { data: statsData } = await supabase
          .from('swap_user_stats')
          .select('*')
          .eq('wallet_address', walletAddress)
          .single();
        if (statsData) {
          setUserStats({
            totalTrades: statsData.total_trades || 0,
            totalSol: statsData.total_sol_volume || 0,
            totalRewards: statsData.total_rewards || 0,
            claimedRewards: statsData.claimed_rewards || 0,
          });
        }
        const { data: historyData } = await supabase
          .from('swap_transactions')
          .select('*')
          .eq('wallet_address', walletAddress)
          .order('created_at', { ascending: false })
          .limit(10);
        if (historyData) {
          setTradeHistory(historyData);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };
    fetchUserData();
  }, [walletAddress]);

  // Fetch PUMPAD price
  useEffect(() => {
    const fetchPumpadPrice = async () => {
      try {
        const { data } = await supabase.functions.invoke('fetch-token-info', {
          body: { tokenAddress: PUMPAD_CONTRACT }
        });
        if (data?.success && data?.data?.pricePerToken) {
          setPumpadPrice(data.data.pricePerToken);
        }
      } catch (error) {
        console.error('Error fetching PUMPAD price:', error);
      }
    };
    fetchPumpadPrice();
    const interval = setInterval(fetchPumpadPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch PUMPAD balance
  useEffect(() => {
    const fetchPumpadBalance = async () => {
      if (!walletAddress) {
        setPumpadBalance(0);
        return;
      }
      try {
        const { data } = await supabase.functions.invoke('fetch-token-balance', {
          body: { walletAddress, tokenAddress: PUMPAD_CONTRACT }
        });
        if (data?.success && data?.balance !== undefined) {
          setPumpadBalance(data.balance);
        }
      } catch (error) {
        console.error('Error fetching PUMPAD balance:', error);
      }
    };
    fetchPumpadBalance();
    const interval = setInterval(fetchPumpadBalance, 30000);
    return () => clearInterval(interval);
  }, [walletAddress]);

  const fetchUserData = useCallback(async () => {
    if (!walletAddress) {
      setUserStats({ totalTrades: 0, totalSol: 0, totalRewards: 0, claimedRewards: 0 });
      setTradeHistory([]);
      return;
    }
    try {
      const { data: statsData } = await supabase
        .from('swap_user_stats')
        .select('*')
        .eq('wallet_address', walletAddress)
        .single();
      if (statsData) {
        setUserStats({
          totalTrades: statsData.total_trades || 0,
          totalSol: statsData.total_sol_volume || 0,
          totalRewards: statsData.total_rewards || 0,
          claimedRewards: statsData.claimed_rewards || 0,
        });
      }
      const { data: historyData } = await supabase
        .from('swap_transactions')
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('created_at', { ascending: false })
        .limit(10);
      if (historyData) {
        setTradeHistory(historyData);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // Fetch quote from Jupiter Swap
  useEffect(() => {
    const fetchQuote = async () => {
      if (!amount || parseFloat(amount) <= 0) {
        setOutputAmount('');
        setCurrentQuote(null);
        setPriceImpact('0');
        return;
      }
      setQuoteLoading(true);
      try {
        const slippageBps = Math.round(slippage * 100);
        const quoteData = isSolToToken 
          ? await getSOLToPumpadQuote(parseFloat(amount), slippageBps)
          : await getPumpadToSOLQuote(parseFloat(amount), slippageBps);
        if (quoteData) {
          setCurrentQuote(quoteData);
          const formattedOutput = formatOutputAmount(quoteData, toToken.decimals);
          setOutputAmount(formattedOutput);
          setPriceImpact(quoteData.priceImpactPct || '0');
        } else {
          setOutputAmount('');
          setCurrentQuote(null);
          setPriceImpact('0');
        }
      } catch (error) {
        console.error('Quote fetch error:', error);
        setOutputAmount('');
        setCurrentQuote(null);
      } finally {
        setQuoteLoading(false);
      }
    };
    const debounceTimer = setTimeout(fetchQuote, 500);
    return () => clearTimeout(debounceTimer);
  }, [amount, isSolToToken, slippage, getSOLToPumpadQuote, getPumpadToSOLQuote, formatOutputAmount, toToken.decimals]);

  const handleSwitch = () => {
    setIsSolToToken(!isSolToToken);
    setAmount('');
    setOutputAmount('');
    setCurrentQuote(null);
  };

  const recordSwapTransaction = async (fromAmount: number, toAmount: number, txHash: string | null) => {
    if (!walletAddress) return;
    try {
      const solValue = isSolToToken ? fromAmount : toAmount;
      const usdValue = solValue * SOL_PRICE_USD;
      const rewardUsdValue = usdValue * 0.01;
      const rewardInPumpad = rewardUsdValue / pumpadPrice;

      await supabase.from('swap_transactions').insert({
        wallet_address: walletAddress,
        from_token: fromToken.symbol,
        to_token: toToken.symbol,
        from_amount: fromAmount,
        to_amount: toAmount,
        sol_value: solValue,
        usd_value: usdValue,
        reward_amount: rewardInPumpad,
        tx_hash: txHash,
      });

      const { data: existingStats } = await supabase
        .from('swap_user_stats')
        .select('*')
        .eq('wallet_address', walletAddress)
        .single();

      if (existingStats) {
        await supabase
          .from('swap_user_stats')
          .update({
            total_trades: existingStats.total_trades + 1,
            total_sol_volume: existingStats.total_sol_volume + solValue,
            total_usd_volume: existingStats.total_usd_volume + usdValue,
            total_rewards: existingStats.total_rewards + rewardInPumpad,
          })
          .eq('wallet_address', walletAddress);
      } else {
        await supabase.from('swap_user_stats').insert({
          wallet_address: walletAddress,
          total_trades: 1,
          total_sol_volume: solValue,
          total_usd_volume: usdValue,
          total_rewards: rewardInPumpad,
          claimed_rewards: 0,
        });
      }
      await fetchUserData();
    } catch (error) {
      console.error('Error recording swap transaction:', error);
    }
  };

  const handleSwap = async () => {
    if (!amount || parseFloat(amount) <= 0 || !currentQuote) return;
    setConfirmOpen(true);
  };

  const confirmSwap = async () => {
    if (!amount || parseFloat(amount) <= 0 || !currentQuote) return;
    setConfirmOpen(false);
    setSwapping(true);
    try {
      const result = await executeSwap(currentQuote);
      const fromAmount = parseFloat(amount);
      const toAmount = parseFloat(outputAmount.replace(/,/g, ''));
      if (result.success) {
        await recordSwapTransaction(fromAmount, toAmount, result.txHash || null);
        const solValue = isSolToToken ? fromAmount : toAmount;
        const usdValue = solValue * SOL_PRICE_USD;
        const rewardUsd = usdValue * 0.01;
        const rewardPumpad = rewardUsd / pumpadPrice;
        toast.success('Swap successful!', {
          description: `Swapped ${amount} ${fromToken.symbol} for ${outputAmount} ${toToken.symbol}. +${rewardPumpad.toLocaleString(undefined, { maximumFractionDigits: 2 })} PUMPAD rewards!`,
          action: result.txHash ? {
            label: 'View TX',
            onClick: () => window.open(`https://solscan.io/tx/${result.txHash}`, '_blank')
          } : undefined
        });
        setAmount('');
        setOutputAmount('');
        setCurrentQuote(null);
      } else {
        toast.error('Swap failed', { description: result.error || 'Transaction was not completed' });
      }
    } catch (error: any) {
      toast.error('Swap failed', { description: error.message || 'An error occurred' });
    } finally {
      setSwapping(false);
    }
  };

  const handleRefreshQuote = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setQuoteLoading(true);
    try {
      const slippageBps = Math.round(slippage * 100);
      const quoteData = isSolToToken 
        ? await getSOLToPumpadQuote(parseFloat(amount), slippageBps)
        : await getPumpadToSOLQuote(parseFloat(amount), slippageBps);
      if (quoteData) {
        setCurrentQuote(quoteData);
        const formattedOutput = formatOutputAmount(quoteData, toToken.decimals);
        setOutputAmount(formattedOutput);
        setPriceImpact(quoteData.priceImpactPct || '0');
        toast.success('Quote refreshed');
      }
    } catch (error) {
      toast.error('Failed to refresh quote');
    } finally {
      setQuoteLoading(false);
    }
  };

  const getRate = () => {
    if (!currentQuote) return null;
    const inAmount = parseInt(currentQuote.inAmount) / Math.pow(10, fromToken.decimals);
    const outAmount = parseInt(currentQuote.outAmount) / Math.pow(10, toToken.decimals);
    const rate = outAmount / inAmount;
    return rate.toLocaleString(undefined, { maximumFractionDigits: 6 });
  };

  const getEstimatedReward = () => {
    if (!amount || parseFloat(amount) <= 0) return 0;
    const fromAmount = parseFloat(amount);
    const solValue = isSolToToken ? fromAmount : (parseFloat(outputAmount.replace(/,/g, '')) || 0);
    const usdValue = solValue * SOL_PRICE_USD;
    const rewardUsd = usdValue * 0.01;
    return rewardUsd / pumpadPrice;
  };

  const priceImpactNum = parseFloat(priceImpact);
  const isPriceImpactHigh = priceImpactNum > 1;
  const isPriceImpactVeryHigh = priceImpactNum > 5;
  const availableRewards = userStats.totalRewards - userStats.claimedRewards;

  return (
    <div className="min-h-screen bg-background">
      <SwapConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        fromToken={fromToken}
        toToken={toToken}
        fromAmount={amount || '0'}
        toAmount={outputAmount || '0'}
        priceImpactPct={priceImpact}
        slippagePct={slippage}
        estimatedNetworkFeeSol={0.000005}
        estimatedPriorityFeeSolMax={0.001}
        onConfirm={confirmSwap}
        confirmDisabled={swapping || !currentQuote || !amount}
      />

      {/* Hero Section */}
      <div className="border-b-2 border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 flex items-center justify-center border-2 border-cyan-400 bg-cyan-400/10">
              <ArrowDownUp className="w-7 h-7 text-cyan-400" />
            </div>
            <div>
              <h1 className="font-pixel text-xl text-foreground">SWAP</h1>
              <p className="text-sm text-muted-foreground font-mono">Trade tokens with rewards</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            <div className="p-3 border-2 border-border bg-background">
              <p className="font-pixel text-[8px] text-muted-foreground mb-1">YOUR TRADES</p>
              <p className="font-pixel text-lg text-cyan-400">{userStats.totalTrades}</p>
            </div>
            <div className="p-3 border-2 border-border bg-background">
              <p className="font-pixel text-[8px] text-muted-foreground mb-1">VOLUME</p>
              <p className="font-pixel text-lg text-foreground">{userStats.totalSol.toFixed(2)} SOL</p>
            </div>
            <div className="p-3 border-2 border-border bg-background">
              <p className="font-pixel text-[8px] text-muted-foreground mb-1">REWARDS</p>
              <p className="font-pixel text-lg text-green-400">{availableRewards.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="p-3 border-2 border-border bg-background">
              <p className="font-pixel text-[8px] text-muted-foreground mb-1">SOL BALANCE</p>
              <p className="font-pixel text-lg text-foreground">{balance.toFixed(4)}</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 py-8">
        {/* Swap Card */}
        <div className="border-2 border-border bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-pixel text-sm text-foreground">SWAP TOKENS</h2>
            <div className="flex items-center gap-1">
              <span className="font-pixel text-[8px] text-muted-foreground">SLIPPAGE:</span>
              {[0.5, 1, 2].map((val) => (
                <button
                  key={val}
                  onClick={() => setSlippage(val)}
                  className={`px-2 py-1 font-pixel text-[8px] border-2 transition-all ${
                    slippage === val 
                      ? 'bg-cyan-400 border-cyan-400 text-primary-foreground' 
                      : 'border-border text-muted-foreground hover:border-cyan-400'
                  }`}
                >
                  {val}%
                </button>
              ))}
            </div>
          </div>

          {/* From Token */}
          <div className="border-2 border-border bg-background p-4 mb-2">
            <div className="flex justify-between mb-2">
              <span className="font-pixel text-[8px] text-muted-foreground">FROM</span>
              <span className="font-mono text-xs text-muted-foreground">
                Balance: {fromBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 border-2 border-border px-3 py-2 bg-muted/50">
                <img src={fromToken.logo} alt={fromToken.symbol} className="w-6 h-6" />
                <span className="font-pixel text-[10px]">{fromToken.symbol}</span>
              </div>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 border-2 border-border bg-transparent font-mono text-lg text-right"
              />
            </div>
            <div className="flex gap-2 mt-2">
              {[25, 50, 75, 100].map(pct => (
                <button
                  key={pct}
                  onClick={() => setAmount((fromBalance * pct / 100).toString())}
                  className="px-2 py-1 font-pixel text-[7px] border border-border text-muted-foreground hover:border-cyan-400 hover:text-cyan-400 transition-all"
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Switch Button */}
          <div className="flex justify-center -my-1 relative z-10">
            <button
              onClick={handleSwitch}
              className="w-10 h-10 border-2 border-cyan-400 bg-background flex items-center justify-center hover:bg-cyan-400/20 transition-all"
            >
              <ArrowDownUp className="w-5 h-5 text-cyan-400" />
            </button>
          </div>

          {/* To Token */}
          <div className="border-2 border-border bg-background p-4 mt-2">
            <div className="flex justify-between mb-2">
              <span className="font-pixel text-[8px] text-muted-foreground">TO</span>
              <span className="font-mono text-xs text-muted-foreground">
                Balance: {toBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 border-2 border-border px-3 py-2 bg-muted/50">
                <img src={toToken.logo} alt={toToken.symbol} className="w-6 h-6" />
                <span className="font-pixel text-[10px]">{toToken.symbol}</span>
              </div>
              <div className="flex-1 text-right font-mono text-lg text-foreground">
                {quoteLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin ml-auto" />
                ) : outputAmount || '0.00'}
              </div>
            </div>
          </div>

          {/* Quote Info */}
          {currentQuote && (
            <div className="mt-4 p-3 border-2 border-border bg-muted/20 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-pixel text-[8px] text-muted-foreground">RATE</span>
                <span className="font-mono text-foreground">1 {fromToken.symbol} = {getRate()} {toToken.symbol}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="font-pixel text-[8px] text-muted-foreground">PRICE IMPACT</span>
                <span className={`font-mono ${isPriceImpactVeryHigh ? 'text-red-400' : isPriceImpactHigh ? 'text-yellow-400' : 'text-green-400'}`}>
                  {priceImpactNum.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="font-pixel text-[8px] text-muted-foreground">REWARD</span>
                <span className="font-mono text-green-400">+{getEstimatedReward().toLocaleString(undefined, { maximumFractionDigits: 0 })} PUMPAD</span>
              </div>
            </div>
          )}

          {/* Swap Button */}
          <Button
            onClick={connected ? handleSwap : connectWallet}
            disabled={connected && (swapping || !currentQuote || !amount)}
            className="w-full mt-6 h-12 font-pixel text-sm bg-cyan-400 hover:bg-cyan-500 text-primary-foreground border-2 border-cyan-400"
          >
            {!connected ? (
              <>
                <Wallet className="w-4 h-4 mr-2" />
                CONNECT WALLET
              </>
            ) : swapping ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                SWAPPING...
              </>
            ) : (
              'SWAP'
            )}
          </Button>
        </div>

        {/* Trade History */}
        {connected && tradeHistory.length > 0 && (
          <div className="mt-6 border-2 border-border bg-card">
            <div className="p-4 border-b-2 border-border">
              <h3 className="font-pixel text-sm text-foreground">RECENT TRADES</h3>
            </div>
            <div className="divide-y-2 divide-border">
              {tradeHistory.slice(0, 5).map((trade) => (
                <div key={trade.id} className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm text-foreground">
                      {trade.from_amount.toFixed(4)} {trade.from_token} → {trade.to_amount.toFixed(4)} {trade.to_token}
                    </p>
                    <p className="font-pixel text-[8px] text-muted-foreground">
                      {formatDistanceToNow(new Date(trade.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {trade.tx_hash && (
                    <a
                      href={`https://solscan.io/tx/${trade.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Swap;
