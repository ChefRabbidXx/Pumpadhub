import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Coins, ArrowRight, RefreshCw, Plus, ChevronRight, Search, Info, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useWallet } from '@solana/wallet-adapter-react';

interface StakingPool {
  id: string;
  contract_address: string;
  token_name: string | null;
  token_symbol: string | null;
  token_logo_url: string | null;
  status: string;
  apr: number;
  total_staked: number;
  allocation: number;
  min_stake: number;
  lock_period_days: number;
}

const Staking = () => {
  const navigate = useNavigate();
  const { connected } = useWallet();
  const [pools, setPools] = useState<StakingPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'ended'>('active');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchPools();
  }, []);

  const fetchPools = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('staking_pools').select('*');
      const sortedData = (data || []).sort((a, b) => {
        const aIsPumpad = a.token_symbol?.toUpperCase() === 'PUMPAD' ? 0 : 1;
        const bIsPumpad = b.token_symbol?.toUpperCase() === 'PUMPAD' ? 0 : 1;
        return aIsPumpad - bIsPumpad;
      });
      setPools(sortedData);
    } catch (error) {
      console.error('Error fetching pools:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const filteredPools = pools.filter(pool => {
    const matchesFilter = pool.status === filter;
    const matchesSearch = !search || 
      pool.token_name?.toLowerCase().includes(search.toLowerCase()) ||
      pool.token_symbol?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="bg-background min-h-screen">
      {/* Hero Section - Gamified */}
      <div className="relative overflow-hidden border-b-2 border-border">
        <div className="absolute inset-0 bg-pixel-grid opacity-20" />
        <div className="relative max-w-4xl mx-auto px-4 py-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary border-2 border-primary mb-4">
            <Coins className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="font-pixel text-xl md:text-2xl mb-3">
            <span className="text-primary">STAKING</span>{' '}
            <span className="text-foreground">POOLS</span>
          </h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
            Stake tokens. Earn rewards. Level up your portfolio.
          </p>
          <Link to="/create">
            <Button variant="game" size="lg" className="gap-2">
              <Plus className="w-4 h-4" />
              CREATE POOL
            </Button>
          </Link>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Filter Tabs - Gamified */}
        <div className="flex items-center border-2 border-border overflow-hidden mb-4">
          <button
            onClick={() => setFilter('active')}
            className={cn(
              "flex-1 py-3 font-pixel text-[9px] transition-colors flex items-center justify-center gap-2",
              filter === 'active' 
                ? "bg-primary text-primary-foreground" 
                : "bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="w-2 h-2 bg-current" />
            ACTIVE
          </button>
          <button
            onClick={() => setFilter('ended')}
            className={cn(
              "flex-1 py-3 font-pixel text-[9px] transition-colors flex items-center justify-center gap-2 border-l-2 border-border",
              filter === 'ended' 
                ? "bg-primary text-primary-foreground" 
                : "bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="w-2 h-2 bg-muted-foreground" />
            ENDED
          </button>
        </div>

        {/* Search and Refresh */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search pools..." 
              className="pl-9 bg-card border-2 border-border font-mono text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="pixel" size="icon" onClick={fetchPools} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>

        {/* Wallet Connect Banner */}
        {!connected && (
          <div className="flex items-center justify-between p-4 border-2 border-border bg-card mb-4">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Info className="w-4 h-4" />
              <span className="text-sm">Connect wallet to stake tokens.</span>
            </div>
            <Button size="sm" variant="game" className="gap-2">
              <Wallet className="w-4 h-4" />
              CONNECT
            </Button>
          </div>
        )}

        {/* Pool List */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 border-2 border-border bg-card animate-pulse" />
            ))}
          </div>
        ) : filteredPools.length === 0 ? (
          <div className="text-center py-16 border-2 border-border bg-card">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-primary mb-4">
              <Coins className="w-7 h-7 text-primary-foreground" />
            </div>
            <h3 className="font-pixel text-sm mb-2">NO POOLS FOUND</h3>
            <p className="text-muted-foreground text-sm mb-4">Create a staking pool to get started.</p>
            <Link to="/create">
              <Button variant="game" size="sm">
                CREATE POOL <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredPools.map((pool) => (
              <div
                key={pool.id}
                onClick={() => navigate(`/staking/${pool.contract_address}`)}
                className="group flex items-center justify-between p-4 bg-card border-2 border-border cursor-pointer hover:border-primary transition-colors"
              >
                {/* Token Info */}
                <div className="flex items-center gap-3">
                  {pool.token_logo_url ? (
                    <img src={pool.token_logo_url} alt="" className="w-10 h-10 border-2 border-border object-cover" />
                  ) : (
                    <div className="w-10 h-10 border-2 border-border bg-muted flex items-center justify-center">
                      <Coins className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-pixel text-[10px] group-hover:text-primary transition-colors">
                      {pool.token_symbol || 'TOKEN'}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {pool.token_name || 'Unknown'}
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div className="hidden sm:flex items-center gap-6">
                  <div className="text-right">
                    <p className="font-pixel text-[8px] text-muted-foreground">APR</p>
                    <p className="font-pixel text-sm text-primary">{pool.apr}%</p>
                  </div>
                  <div className="text-right">
                    <p className="font-pixel text-[8px] text-muted-foreground">STAKED</p>
                    <p className="font-mono text-sm">{formatNumber(pool.total_staked)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-pixel text-[8px] text-muted-foreground">MIN</p>
                    <p className="font-mono text-sm text-muted-foreground">{formatNumber(pool.min_stake)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className={cn("w-2 h-2", pool.status === 'active' ? "bg-primary" : "bg-muted-foreground")} />
                    <span className="font-pixel text-[8px] text-muted-foreground uppercase">{pool.status}</span>
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Staking;