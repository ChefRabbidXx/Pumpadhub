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
  Loader2,
  TrendingUp,
  Users,
  BarChart3,
  Shield
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

interface MarketData {
  marketCap: number | null;
  volume24h: number | null;
  holders: number | null;
  price: number | null;
}

interface TokenFeatures {
  staking: boolean;
  race: boolean;
  farming: boolean;
  burn: boolean;
}

const SafuDetails = () => {
  const { contractAddress } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeFeature, setActiveFeature] = useState<FeatureView>('staking');
  const [token, setToken] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [marketData, setMarketData] = useState<MarketData>({
    marketCap: null,
    volume24h: null,
    holders: null,
    price: null
  });
  const [marketLoading, setMarketLoading] = useState(true);
  const [features, setFeatures] = useState<TokenFeatures>({
    staking: false,
    race: false,
    farming: false,
    burn: false
  });
  const [featuresLoading, setFeaturesLoading] = useState(true);

  const effectiveContractAddress = contractAddress;

  useEffect(() => {
    const fetchToken = async () => {
      if (!effectiveContractAddress) {
        setLoading(false);
        return;
      }

      // Try to find token info from any pool that has this contract address
      // Check staking_pools first
      const { data: stakingPool } = await supabase
        .from('staking_pools')
        .select('token_name, token_symbol, token_logo_url, token_decimals, contract_address')
        .eq('contract_address', effectiveContractAddress)
        .maybeSingle();

      if (stakingPool) {
        setToken({
          id: effectiveContractAddress,
          name: stakingPool.token_name || 'Unknown',
          symbol: stakingPool.token_symbol || 'UNK',
          logo_url: stakingPool.token_logo_url,
          contract_address: stakingPool.contract_address,
          decimals: stakingPool.token_decimals
        });
        setLoading(false);
        return;
      }

      // Check safu_pools
      const { data: safuPool } = await supabase
        .from('safu_pools')
        .select('token_name, token_symbol, token_logo_url, token_decimals, contract_address')
        .eq('contract_address', effectiveContractAddress)
        .maybeSingle();

      if (safuPool) {
        setToken({
          id: effectiveContractAddress,
          name: safuPool.token_name,
          symbol: safuPool.token_symbol,
          logo_url: safuPool.token_logo_url,
          contract_address: safuPool.contract_address,
          decimals: safuPool.token_decimals
        });
        setLoading(false);
        return;
      }

      setLoading(false);
    };

    fetchToken();
  }, [effectiveContractAddress]);

  // Fetch available features for this token
  useEffect(() => {
    const fetchFeatures = async () => {
      if (!effectiveContractAddress) {
        setFeaturesLoading(false);
        return;
      }

      setFeaturesLoading(true);
      try {
        const [stakingRes, raceRes, farmingRes, burnRes] = await Promise.all([
          supabase.from('staking_pools').select('id').eq('contract_address', effectiveContractAddress).eq('status', 'active').maybeSingle(),
          supabase.from('race_pools').select('id').eq('contract_address', effectiveContractAddress).eq('status', 'active').maybeSingle(),
          supabase.from('social_farming_pools').select('id').eq('contract_address', effectiveContractAddress).eq('status', 'active').maybeSingle(),
          supabase.from('burn_pools').select('id').eq('contract_address', effectiveContractAddress).eq('status', 'active').maybeSingle()
        ]);

        const newFeatures = {
          staking: !!stakingRes.data,
          race: !!raceRes.data,
          farming: !!farmingRes.data,
          burn: !!burnRes.data
        };

        setFeatures(newFeatures);

        // Set active feature to first available one
        if (newFeatures.staking) setActiveFeature('staking');
        else if (newFeatures.race) setActiveFeature('race');
        else if (newFeatures.farming) setActiveFeature('farming');
        else if (newFeatures.burn) setActiveFeature('burn');
      } catch (err) {
        console.error('Error fetching features:', err);
      } finally {
        setFeaturesLoading(false);
      }
    };

    fetchFeatures();
  }, [effectiveContractAddress]);

  // Fetch market data from pump.fun API
  useEffect(() => {
    const fetchMarketData = async () => {
      if (!effectiveContractAddress) return;

      setMarketLoading(true);
      try {
        // Fetch token info from pump.fun via edge function
        const { data, error } = await supabase.functions.invoke('fetch-token-info', {
          body: { tokenAddress: effectiveContractAddress }
        });

        if (!error && data?.success && data.data) {
          setMarketData({
            marketCap: data.data.marketCap || null,
            volume24h: data.data.volume24h || null,
            holders: data.data.holders || null,
            price: data.data.pricePerToken || null
          });
        }
      } catch (err) {
        console.error('Error fetching market data:', err);
      } finally {
        setMarketLoading(false);
      }
    };

    fetchMarketData();
  }, [effectiveContractAddress]);

  const formatNumber = (num: number | null) => {
    if (num === null) return '-';
    if (num >= 1000000000) return `$${(num / 1000000000).toFixed(2)}B`;
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatHolders = (num: number | null) => {
    if (num === null) return '-';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

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
            <Button onClick={() => navigate('/safu')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Safu
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      
      <main className="pb-20 md:pb-0">
        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Back Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/safu')}
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
                  <div className="flex items-center gap-2 mb-0.5">
                    <h1 className="text-xl font-bold font-rajdhani">{token.name}</h1>
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 border border-primary/30">
                      <Shield className="w-3 h-3 text-primary" />
                      <span className="text-[10px] font-bold text-primary uppercase">SAFU</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground font-rajdhani">${token.symbol}</span>
                    <Badge variant="secondary" className="text-xs h-5 px-1.5 font-rajdhani">SOL</Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Market Stats Row */}
            <div className="relative grid grid-cols-3 gap-3 mb-4">
              <div className="p-3 bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20 rounded-xl">
                <div className="flex items-center gap-1.5 mb-1">
                  <BarChart3 className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Market Cap</span>
                </div>
                <p className="text-lg font-bold text-green-400">
                  {marketLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : formatNumber(marketData.marketCap)}
                </p>
              </div>
              
              <div className="p-3 bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20 rounded-xl">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">24h Volume</span>
                </div>
                <p className="text-lg font-bold text-blue-400">
                  {marketLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : formatNumber(marketData.volume24h)}
                </p>
              </div>
              
              <div className="p-3 bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20 rounded-xl">
                <div className="flex items-center gap-1.5 mb-1">
                  <Users className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Holders</span>
                </div>
                <p className="text-lg font-bold text-purple-400">
                  {marketLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : formatHolders(marketData.holders)}
                </p>
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
              onClick={() => features.staking && setActiveFeature('staking')}
              disabled={!features.staking}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-lg font-rajdhani font-bold text-sm transition-all duration-300 relative overflow-hidden group",
                !features.staking && "opacity-40 cursor-not-allowed",
                activeFeature === 'staking' && features.staking
                  ? "bg-gradient-to-br from-orange-500/20 via-orange-600/20 to-red-500/20 text-orange-400 shadow-lg shadow-orange-500/20 border border-orange-500/30"
                  : features.staking 
                    ? "text-muted-foreground hover:text-orange-400 hover:bg-orange-500/10"
                    : "text-muted-foreground/50"
              )}
            >
              {activeFeature === 'staking' && features.staking && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-400/10 to-transparent animate-[slide-in-right_2s_ease-in-out_infinite]" />
              )}
              <Coins className={cn("w-4 h-4 transition-transform duration-300", activeFeature === 'staking' && features.staking ? "animate-pulse" : features.staking ? "group-hover:scale-110" : "")} />
              <span className="relative">Staking</span>
            </button>

            <button
              onClick={() => features.race && setActiveFeature('race')}
              disabled={!features.race}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-lg font-rajdhani font-bold text-sm transition-all duration-300 relative overflow-hidden group",
                !features.race && "opacity-40 cursor-not-allowed",
                activeFeature === 'race' && features.race
                  ? "bg-gradient-to-br from-yellow-500/20 via-amber-600/20 to-orange-500/20 text-yellow-400 shadow-lg shadow-yellow-500/20 border border-yellow-500/30"
                  : features.race
                    ? "text-muted-foreground hover:text-yellow-400 hover:bg-yellow-500/10"
                    : "text-muted-foreground/50"
              )}
            >
              {activeFeature === 'race' && features.race && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-400/10 to-transparent animate-[slide-in-right_2s_ease-in-out_infinite]" />
              )}
              <Trophy className={cn("w-4 h-4 transition-transform duration-300", activeFeature === 'race' && features.race ? "animate-pulse" : features.race ? "group-hover:scale-110" : "")} />
              <span className="relative">Race</span>
            </button>

            <button
              onClick={() => features.farming && setActiveFeature('farming')}
              disabled={!features.farming}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-lg font-rajdhani font-bold text-sm transition-all duration-300 relative overflow-hidden group",
                !features.farming && "opacity-40 cursor-not-allowed",
                activeFeature === 'farming' && features.farming
                  ? "bg-gradient-to-br from-green-500/20 via-emerald-600/20 to-teal-500/20 text-green-400 shadow-lg shadow-green-500/20 border border-green-500/30"
                  : features.farming
                    ? "text-muted-foreground hover:text-green-400 hover:bg-green-500/10"
                    : "text-muted-foreground/50"
              )}
            >
              {activeFeature === 'farming' && features.farming && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-400/10 to-transparent animate-[slide-in-right_2s_ease-in-out_infinite]" />
              )}
              <Activity className={cn("w-4 h-4 transition-transform duration-300", activeFeature === 'farming' && features.farming ? "animate-pulse" : features.farming ? "group-hover:scale-110" : "")} />
              <span className="relative">Social</span>
            </button>

            <button
              onClick={() => features.burn && setActiveFeature('burn')}
              disabled={!features.burn}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-lg font-rajdhani font-bold text-sm transition-all duration-300 relative overflow-hidden group",
                !features.burn && "opacity-40 cursor-not-allowed",
                activeFeature === 'burn' && features.burn
                  ? "bg-gradient-to-br from-red-500/20 via-rose-600/20 to-pink-500/20 text-red-400 shadow-lg shadow-red-500/20 border border-red-500/30"
                  : features.burn
                    ? "text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                    : "text-muted-foreground/50"
              )}
            >
              {activeFeature === 'burn' && features.burn && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-400/10 to-transparent animate-[slide-in-right_2s_ease-in-out_infinite]" />
              )}
              <Flame className={cn("w-4 h-4 transition-transform duration-300", activeFeature === 'burn' && features.burn ? "animate-pulse" : features.burn ? "group-hover:scale-110" : "")} />
              <span className="relative">Burn</span>
            </button>
          </div>

          {/* Feature Content */}
          <div className="animate-fade-in">
            {activeFeature === 'staking' && features.staking && (
              <StakingTab tokenSymbol={token.symbol} contractAddress={token.contract_address} />
            )}

            {activeFeature === 'race' && features.race && (
              <RaceTab tokenSymbol={token.symbol} contractAddress={token.contract_address} />
            )}

            {activeFeature === 'farming' && features.farming && (
              <SocialFarmingTab tokenSymbol={token.symbol} contractAddress={token.contract_address} />
            )}

            {activeFeature === 'burn' && features.burn && (
              <BurnTab tokenSymbol={token.symbol} contractAddress={token.contract_address} />
            )}

            {/* No features available */}
            {!featuresLoading && !features.staking && !features.race && !features.farming && !features.burn && (
              <div className="text-center py-12 bg-card border border-border rounded-2xl">
                <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-bold mb-2">No Features Available</h3>
                <p className="text-muted-foreground text-sm">This token doesn't have any active pools yet.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default SafuDetails;
