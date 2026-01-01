import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, ArrowRight, RefreshCw, Plus, Timer, ChevronRight, Search, Info, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useWallet } from '@solana/wallet-adapter-react';

interface RacePool {
  id: string;
  contract_address: string;
  token_name: string | null;
  token_symbol: string | null;
  token_logo_url: string | null;
  status: string;
  prize_pool: number;
  total_participants: number;
  time_remaining_hours: number;
  current_round: number | null;
  total_rounds: number | null;
}

const Race = () => {
  const navigate = useNavigate();
  const { connected } = useWallet();
  const [pools, setPools] = useState<RacePool[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'ended'>('active');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchPools();
  }, []);

  const fetchPools = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('race_pools').select('*');
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
          <div className="inline-flex items-center justify-center w-14 h-14 bg-yellow-400 border-2 border-yellow-400 mb-4">
            <Trophy className="w-7 h-7 text-black" />
          </div>
          <h1 className="font-pixel text-xl md:text-2xl mb-3">
            <span className="text-yellow-400">RACE</span>{' '}
            <span className="text-foreground">POOLS</span>
          </h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
            Compete with holders. Win prizes. Climb the leaderboard.
          </p>
          <Link to="/create">
            <Button variant="game" size="lg" className="gap-2 bg-yellow-400 border-yellow-400 hover:bg-yellow-500">
              <Plus className="w-4 h-4" />
              CREATE RACE
            </Button>
          </Link>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Filter Tabs */}
        <div className="flex items-center border-2 border-border overflow-hidden mb-4">
          <button
            onClick={() => setFilter('active')}
            className={cn(
              "flex-1 py-3 font-pixel text-[9px] transition-colors flex items-center justify-center gap-2",
              filter === 'active' 
                ? "bg-yellow-400 text-black" 
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
                ? "bg-yellow-400 text-black" 
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
              placeholder="Search races..." 
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
              <span className="text-sm">Connect wallet to join races.</span>
            </div>
            <Button size="sm" variant="game" className="gap-2 bg-yellow-400 border-yellow-400">
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
            <div className="inline-flex items-center justify-center w-14 h-14 bg-yellow-400 mb-4">
              <Trophy className="w-7 h-7 text-black" />
            </div>
            <h3 className="font-pixel text-sm mb-2">NO RACES FOUND</h3>
            <p className="text-muted-foreground text-sm mb-4">Create a race to get started.</p>
            <Link to="/create">
              <Button variant="game" size="sm" className="bg-yellow-400 border-yellow-400">
                CREATE RACE <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredPools.map((pool) => (
              <div
                key={pool.id}
                onClick={() => navigate(`/race/${pool.contract_address}`)}
                className="group flex items-center justify-between p-4 bg-card border-2 border-border cursor-pointer hover:border-yellow-400 transition-colors"
              >
                {/* Token Info */}
                <div className="flex items-center gap-3">
                  {pool.token_logo_url ? (
                    <img src={pool.token_logo_url} alt="" className="w-10 h-10 border-2 border-border object-cover" />
                  ) : (
                    <div className="w-10 h-10 border-2 border-border bg-muted flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-yellow-400" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-pixel text-[10px] group-hover:text-yellow-400 transition-colors">
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
                    <p className="font-pixel text-[8px] text-muted-foreground">PRIZE</p>
                    <p className="font-pixel text-sm text-yellow-400">{formatNumber(pool.prize_pool)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-pixel text-[8px] text-muted-foreground">RACERS</p>
                    <p className="font-mono text-sm">{pool.total_participants}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-pixel text-[8px] text-muted-foreground">ROUND</p>
                    <p className="font-mono text-sm text-muted-foreground">{pool.current_round || 1}/{pool.total_rounds || 1}</p>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Timer className="w-3 h-3" />
                    <span className="font-pixel text-[9px]">{pool.time_remaining_hours}H</span>
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-yellow-400 transition-colors" />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Race;