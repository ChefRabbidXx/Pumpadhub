import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Copy, ExternalLink, Loader2, Coins, TrendingUp, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { StakingContent } from '@/components/shared/StakingContent';
import { useStakingPool } from '@/hooks/use-pool-data';

const StakingDetails = () => {
  const navigate = useNavigate();
  const { contractAddress } = useParams<{ contractAddress: string }>();
  const { toast } = useToast();

  const { pool, loading: poolLoading } = useStakingPool(contractAddress);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Contract address copied to clipboard",
    });
  };

  if (poolLoading) {
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
            <Coins className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="font-pixel text-lg text-foreground">POOL NOT FOUND</h1>
          <p className="text-sm text-muted-foreground">The staking pool doesn't exist.</p>
          <Button variant="pixel" onClick={() => navigate('/staking')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            BACK
          </Button>
        </div>
      </div>
    );
  }

  const tokenSymbol = pool.token_symbol || 'TOKEN';
  const tokenName = pool.token_name || 'Unknown Token';
  const tokenAddress = pool.contract_address || contractAddress || '';
  const rewardsDistributed = pool.rewards_distributed || 0;
  const distributionProgress = pool.allocation > 0 ? Math.min(100, (rewardsDistributed / pool.allocation) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/staking')}
          className="mb-6 font-pixel text-[9px]"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          BACK
        </Button>

        {/* Header */}
        <div className="text-center mb-8">
          {/* Token Logo */}
          {pool.token_logo_url && (
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 border-2 border-green-400/50 bg-card p-2">
                <img 
                  src={pool.token_logo_url} 
                  alt={tokenName}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          )}

          <h1 className="font-pixel text-xl sm:text-2xl text-foreground mb-2">
            STAKE <span className="text-green-400">{tokenSymbol}</span>
          </h1>
          <p className="text-sm text-muted-foreground mb-4">
            Grow your digital assets effortlessly through staking
          </p>
          
          {/* Contract Address */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button 
              className="flex items-center gap-2 px-4 py-2 bg-muted border-2 border-border hover:border-green-400/50 transition-colors group font-mono text-sm"
              onClick={() => copyToClipboard(tokenAddress)}
            >
              <span className="text-muted-foreground">CA:</span>
              <span className="text-foreground">{tokenAddress.slice(0, 6)}...{tokenAddress.slice(-4)}</span>
              <Copy className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-green-400" />
            </button>
            
            <a
              href={`https://pump.fun/${tokenAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-green-400 hover:bg-green-500 text-black font-pixel text-[9px] transition-colors"
            >
              PUMP.FUN
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="p-4 bg-card border-2 border-green-400/30 text-center">
            <div className="flex items-center justify-center mb-2">
              <div className="w-8 h-8 flex items-center justify-center bg-green-400/10 border border-green-400/30">
                <TrendingUp className="w-4 h-4 text-green-400" />
              </div>
            </div>
            <p className="font-pixel text-[8px] text-muted-foreground mb-1">APR</p>
            <p className="font-pixel text-lg text-green-400">{pool.apr}%</p>
          </div>
          
          <div className="p-4 bg-card border-2 border-border text-center">
            <div className="flex items-center justify-center mb-2">
              <div className="w-8 h-8 flex items-center justify-center bg-muted border border-border">
                <Coins className="w-4 h-4 text-foreground" />
              </div>
            </div>
            <p className="font-pixel text-[8px] text-muted-foreground mb-1">POOL SIZE</p>
            <p className="font-pixel text-sm text-foreground truncate">{pool.allocation > 0 ? pool.allocation.toLocaleString() : '0'}</p>
          </div>
          
          <div className="p-4 bg-card border-2 border-border text-center">
            <div className="flex items-center justify-center mb-2">
              <div className="w-8 h-8 flex items-center justify-center bg-muted border border-border">
                <Users className="w-4 h-4 text-foreground" />
              </div>
            </div>
            <p className="font-pixel text-[8px] text-muted-foreground mb-1">STAKED</p>
            <p className="font-pixel text-sm text-foreground truncate">{pool.total_staked.toLocaleString()}</p>
          </div>
        </div>

        {/* Rewards Progress */}
        <div className="p-4 bg-card border-2 border-border mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="font-pixel text-[9px] text-foreground">REWARDS POOL</span>
            <span className="font-pixel text-[8px] text-muted-foreground">
              {rewardsDistributed.toLocaleString(undefined, { maximumFractionDigits: 2 })} / {pool.allocation.toLocaleString()} {tokenSymbol}
            </span>
          </div>
          <div className="h-3 bg-muted border border-border overflow-hidden">
            <div 
              className="h-full bg-green-400 transition-all duration-500" 
              style={{ width: `${distributionProgress}%` }} 
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="font-pixel text-[8px] text-green-400">
              {distributionProgress < 0.1 && distributionProgress > 0 
                ? `${distributionProgress.toFixed(4)}%` 
                : `${distributionProgress.toFixed(1)}%`} DISTRIBUTED
            </span>
          </div>
        </div>

        {/* Main Staking Content */}
        <div className="bg-card border-2 border-border p-6">
          <StakingContent 
            tokenSymbol={tokenSymbol}
            contractAddress={contractAddress || ''}
            variant="full"
          />
        </div>
      </div>
    </div>
  );
};

export default StakingDetails;
