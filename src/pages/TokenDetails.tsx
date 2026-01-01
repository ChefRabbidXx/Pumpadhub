import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Copy,
  Activity,
  ExternalLink,
  Flame,
  Trophy,
  Coins,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { StakingTab } from '@/components/token-details/StakingTab';
import { SocialFarmingTab } from '@/components/token-details/SocialFarmingTab';
import { RaceTab } from '@/components/token-details/RaceTab';
import { BurnTab } from '@/components/token-details/BurnTab';
import { supabase } from '@/integrations/supabase/client';

type FeatureView = 'staking' | 'farming' | 'burn' | 'race';

interface TokenData {
  id: string;
  name: string;
  symbol: string;
  logo_url: string | null;
  contract_address: string;
  decimals: number | null;
}

const TokenDetails = () => {
  const { id: contractAddress } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeFeature, setActiveFeature] = useState<FeatureView>('staking');
  const [token, setToken] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchToken = async () => {
      if (!contractAddress) {
        setLoading(false);
        return;
      }

      const { data: stakingPool } = await supabase
        .from('staking_pools')
        .select('token_name, token_symbol, token_logo_url, token_decimals, contract_address')
        .eq('contract_address', contractAddress)
        .maybeSingle();

      if (stakingPool) {
        setToken({
          id: contractAddress,
          name: stakingPool.token_name || 'Unknown',
          symbol: stakingPool.token_symbol || 'UNK',
          logo_url: stakingPool.token_logo_url,
          contract_address: stakingPool.contract_address,
          decimals: stakingPool.token_decimals
        });
        setLoading(false);
        return;
      }

      const { data: racePool } = await supabase
        .from('race_pools')
        .select('token_name, token_symbol, token_logo_url, token_decimals, contract_address')
        .eq('contract_address', contractAddress)
        .maybeSingle();

      if (racePool) {
        setToken({
          id: contractAddress,
          name: racePool.token_name || 'Unknown',
          symbol: racePool.token_symbol || 'UNK',
          logo_url: racePool.token_logo_url,
          contract_address: racePool.contract_address || contractAddress,
          decimals: racePool.token_decimals
        });
        setLoading(false);
        return;
      }

      const { data: burnPool } = await supabase
        .from('burn_pools')
        .select('token_name, token_symbol, token_logo_url, token_decimals, contract_address')
        .eq('contract_address', contractAddress)
        .maybeSingle();

      if (burnPool) {
        setToken({
          id: contractAddress,
          name: burnPool.token_name || 'Unknown',
          symbol: burnPool.token_symbol || 'UNK',
          logo_url: burnPool.token_logo_url,
          contract_address: burnPool.contract_address || contractAddress,
          decimals: burnPool.token_decimals
        });
        setLoading(false);
        return;
      }

      const { data: farmingPool } = await supabase
        .from('social_farming_pools')
        .select('token_name, token_symbol, token_logo_url, token_decimals, contract_address')
        .eq('contract_address', contractAddress)
        .maybeSingle();

      if (farmingPool) {
        setToken({
          id: contractAddress,
          name: farmingPool.token_name || 'Unknown',
          symbol: farmingPool.token_symbol || 'UNK',
          logo_url: farmingPool.token_logo_url,
          contract_address: farmingPool.contract_address || contractAddress,
          decimals: farmingPool.token_decimals
        });
        setLoading(false);
        return;
      }

      setLoading(false);
    };

    fetchToken();
  }, [contractAddress]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Address copied to clipboard",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="pb-20 md:pb-0">
          <div className="flex items-center justify-center h-[80vh]">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-background">
        <main className="pb-20 md:pb-0">
          <div className="flex flex-col items-center justify-center h-[80vh] gap-4">
            <h1 className="text-2xl font-bold">Token Not Found</h1>
            <p className="text-muted-foreground">The token you're looking for doesn't exist.</p>
            <Button onClick={() => navigate('/staking')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Staking
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="pb-20 md:pb-0">
        <div className="max-w-2xl mx-auto p-4 space-y-3">
          {/* Back Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/staking')}
            className="mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          {/* Compact Hero Section */}
          <div className="relative bg-gradient-to-br from-primary/5 via-background to-background border border-primary/20 rounded-2xl p-5 overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
            
            <div className="relative flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  {token.logo_url ? (
                    <img 
                      src={token.logo_url} 
                      alt={token.name} 
                      className="w-14 h-14 rounded-xl border-2 border-primary/30"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl border-2 border-primary/30 bg-muted flex items-center justify-center">
                      <span className="text-xl font-bold">{token.symbol.charAt(0)}</span>
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center animate-pulse">
                    <Flame className="w-3 h-3 text-primary-foreground" />
                  </div>
                </div>
                <div>
                  <h1 className="text-xl font-bold font-rajdhani mb-0.5">{token.name}</h1>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground font-rajdhani">${token.symbol}</span>
                    <Badge variant="secondary" className="text-xs h-5 px-1.5 font-rajdhani">SOL</Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Contract & Actions */}
            <div className="relative flex items-center justify-between gap-2">
              <button 
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/50 hover:bg-muted transition-all group"
                onClick={() => copyToClipboard(token.contract_address)}
              >
                <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground">
                  {token.contract_address.slice(0, 6)}...{token.contract_address.slice(-4)}
                </span>
                <Copy className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
              </button>

              <a
                href={`https://pump.fun/${token.contract_address}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <button className="flex items-center gap-2 px-6 py-2 text-sm font-bold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-all">
                  <ExternalLink className="w-4 h-4" />
                  View on pump.fun
                </button>
              </a>
            </div>
          </div>

          {/* Feature Tabs */}
          <div className="flex gap-2 p-1.5 bg-gradient-to-r from-muted/30 via-muted/50 to-muted/30 rounded-xl backdrop-blur-sm border border-border/50">
            <button
              onClick={() => setActiveFeature('staking')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-lg font-rajdhani font-bold text-sm transition-all duration-300 relative overflow-hidden group",
                activeFeature === 'staking'
                  ? "bg-gradient-to-br from-orange-500/20 via-orange-600/20 to-red-500/20 text-orange-400 shadow-lg shadow-orange-500/20 border border-orange-500/30"
                  : "text-muted-foreground hover:text-orange-400 hover:bg-orange-500/10"
              )}
            >
              {activeFeature === 'staking' && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-400/10 to-transparent animate-[slide-in-right_2s_ease-in-out_infinite]" />
              )}
              <Coins className={cn("w-4 h-4 transition-transform duration-300", activeFeature === 'staking' ? "animate-pulse" : "group-hover:scale-110")} />
              <span className="relative">Staking</span>
            </button>

            <button
              onClick={() => setActiveFeature('race')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-lg font-rajdhani font-bold text-sm transition-all duration-300 relative overflow-hidden group",
                activeFeature === 'race'
                  ? "bg-gradient-to-br from-yellow-500/20 via-amber-600/20 to-orange-500/20 text-yellow-400 shadow-lg shadow-yellow-500/20 border border-yellow-500/30"
                  : "text-muted-foreground hover:text-yellow-400 hover:bg-yellow-500/10"
              )}
            >
              {activeFeature === 'race' && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-400/10 to-transparent animate-[slide-in-right_2s_ease-in-out_infinite]" />
              )}
              <Trophy className={cn("w-4 h-4 transition-transform duration-300", activeFeature === 'race' ? "animate-pulse" : "group-hover:scale-110")} />
              <span className="relative">Race</span>
            </button>

            <button
              onClick={() => setActiveFeature('farming')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-lg font-rajdhani font-bold text-sm transition-all duration-300 relative overflow-hidden group",
                activeFeature === 'farming'
                  ? "bg-gradient-to-br from-green-500/20 via-emerald-600/20 to-teal-500/20 text-green-400 shadow-lg shadow-green-500/20 border border-green-500/30"
                  : "text-muted-foreground hover:text-green-400 hover:bg-green-500/10"
              )}
            >
              {activeFeature === 'farming' && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-400/10 to-transparent animate-[slide-in-right_2s_ease-in-out_infinite]" />
              )}
              <Activity className={cn("w-4 h-4 transition-transform duration-300", activeFeature === 'farming' ? "animate-pulse" : "group-hover:scale-110")} />
              <span className="relative">Social Farming</span>
            </button>

            <button
              onClick={() => setActiveFeature('burn')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-lg font-rajdhani font-bold text-sm transition-all duration-300 relative overflow-hidden group",
                activeFeature === 'burn'
                  ? "bg-gradient-to-br from-red-500/20 via-rose-600/20 to-pink-500/20 text-red-400 shadow-lg shadow-red-500/20 border border-red-500/30"
                  : "text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
              )}
            >
              {activeFeature === 'burn' && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-400/10 to-transparent animate-[slide-in-right_2s_ease-in-out_infinite]" />
              )}
              <Flame className={cn("w-4 h-4 transition-transform duration-300", activeFeature === 'burn' ? "animate-pulse" : "group-hover:scale-110")} />
              <span className="relative">Burn</span>
            </button>
          </div>

          {/* Feature Content */}
          <div className="animate-fade-in">
            {activeFeature === 'staking' && (
              <StakingTab tokenSymbol={token.symbol} contractAddress={token.contract_address} />
            )}

            {activeFeature === 'race' && (
              <RaceTab tokenSymbol={token.symbol} contractAddress={token.contract_address} />
            )}

            {activeFeature === 'farming' && (
              <SocialFarmingTab tokenSymbol={token.symbol} contractAddress={token.contract_address} />
            )}

            {activeFeature === 'burn' && (
              <BurnTab tokenSymbol={token.symbol} contractAddress={token.contract_address} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default TokenDetails;
