import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Copy, ExternalLink, Users, TrendingUp, Award, Sparkles, Twitter, Heart, Share2, MessageSquare, Send, Check, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useWallet } from '@/contexts/WalletContext';

interface Task {
  id: string;
  title: string;
  description: string;
  platform: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  points: number;
  link?: string;
  completed?: boolean;
}

interface DbTask {
  id: string;
  title: string;
  platform: string;
  icon: string;
  points: number;
  link: string;
  isCustom: boolean;
}

interface SocialPoolDetails {
  id: string;
  tokenName: string;
  symbol: string;
  logo: string;
  totalPoints: number;
  participants: number;
  rewardPool: number;
  contractAddress: string;
  status: string;
  tasks: DbTask[];
}

const getIconForPlatform = (iconName: string, platform: string): React.ElementType => {
  const iconMap: { [key: string]: React.ElementType } = {
    'Twitter': Twitter,
    'Heart': Heart,
    'Repeat': Share2,
    'MessageCircle': MessageSquare,
    'Send': Send,
    'MessageSquare': MessageSquare,
    'TrendingUp': TrendingUp,
    'Flame': TrendingUp,
    'Globe': ExternalLink,
    'Youtube': ExternalLink,
    'ThumbsUp': Heart,
    'Link': ExternalLink,
  };
  return iconMap[iconName] || ExternalLink;
};

const getIconStyles = (platform: string): { bg: string; color: string } => {
  const styleMap: { [key: string]: { bg: string; color: string } } = {
    'Twitter/X': { bg: 'bg-blue-500/20', color: 'text-blue-400' },
    'Telegram': { bg: 'bg-sky-500/20', color: 'text-sky-400' },
    'Discord': { bg: 'bg-indigo-500/20', color: 'text-indigo-400' },
    'Dexscreener': { bg: 'bg-emerald-500/20', color: 'text-emerald-400' },
    'Pump.fun': { bg: 'bg-orange-500/20', color: 'text-orange-400' },
    'YouTube': { bg: 'bg-red-500/20', color: 'text-red-400' },
    'Website': { bg: 'bg-purple-500/20', color: 'text-purple-400' },
  };
  return styleMap[platform] || { bg: 'bg-primary/20', color: 'text-primary' };
};

const SocialFarmingDetails = () => {
  const { contractAddress } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { connected, walletAddress } = useWallet();
  const [pool, setPool] = useState<SocialPoolDetails | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionCooldown, setActionCooldown] = useState<{ [key: string]: boolean }>({});
  const [awaitingConfirm, setAwaitingConfirm] = useState<{ [key: string]: boolean }>({});
  const [countdown, setCountdown] = useState<{ [key: string]: number }>({});
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [userPoints, setUserPoints] = useState(0);
  const [pendingRewards, setPendingRewards] = useState(0);
  const [isClaiming, setIsClaiming] = useState(false);

  // Fetch pool details
  useEffect(() => {
    const fetchPoolDetails = async () => {
      if (!contractAddress) return;

      try {
        setIsLoading(true);
        
        // Get pool by contract address directly (embedded token data)
        const { data: poolData, error: poolError } = await supabase
          .from('social_farming_pools')
          .select('*')
          .eq('contract_address', contractAddress)
          .eq('status', 'active')
          .maybeSingle();

        if (poolError) {
          console.error("Error fetching pool details:", poolError);
          setIsLoading(false);
          return;
        }

        if (poolData) {
          // Parse tasks from database
          const dbTasks = (poolData.tasks as unknown as DbTask[]) || [];
          
          setPool({
            id: poolData.id,
            tokenName: poolData.token_name || 'Unknown',
            symbol: poolData.token_symbol || 'UNK',
            logo: poolData.token_logo_url || '',
            totalPoints: poolData.total_points || 0,
            participants: poolData.participants || 0,
            rewardPool: poolData.reward_pool || 0,
            contractAddress: poolData.contract_address || '',
            status: poolData.status,
            tasks: dbTasks
          });

          // Convert DB tasks to UI tasks
          const uiTasks: Task[] = dbTasks.map((dbTask) => {
            const styles = getIconStyles(dbTask.platform);
            return {
              id: dbTask.id,
              title: dbTask.title,
              description: `Complete this task on ${dbTask.platform}`,
              platform: dbTask.platform,
              icon: getIconForPlatform(dbTask.icon, dbTask.platform),
              iconBg: styles.bg,
              iconColor: styles.color,
              points: dbTask.points,
              link: dbTask.link
            };
          });
          setTasks(uiTasks);
        }
      } catch (error) {
        console.error("Error loading pool details:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPoolDetails();
  }, [contractAddress]);

  // Fetch user's completed tasks
  useEffect(() => {
    const fetchUserCompletions = async () => {
      if (!pool?.id || !walletAddress) return;

      try {
        const { data: completions, error } = await supabase
          .from('social_farming_completions')
          .select('task_id, points_earned')
          .eq('pool_id', pool.id)
          .eq('wallet_address', walletAddress);

        if (error) {
          console.error("Error fetching completions:", error);
          return;
        }

        if (completions && completions.length > 0) {
          const completedTaskIds = new Set(completions.map(c => c.task_id));
          const totalPoints = completions.reduce((sum, c) => sum + c.points_earned, 0);
          
          setCompletedTasks(completedTaskIds);
          setUserPoints(totalPoints);
          setPendingRewards(totalPoints * 0.1);
        }
      } catch (error) {
        console.error("Error loading user completions:", error);
      }
    };

    fetchUserCompletions();
  }, [pool?.id, walletAddress]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Contract address copied to clipboard",
    });
  };

  const handleTaskAction = (task: Task) => {
    if (!connected) {
      toast({
        title: "Connect Wallet",
        description: "Please connect your wallet to complete tasks",
        variant: "destructive"
      });
      return;
    }

    if (actionCooldown[task.id] || awaitingConfirm[task.id]) {
      return;
    }

    // Open the task link in a new tab
    if (task.link) {
      window.open(task.link, '_blank');
    }

    // Start cooldown with countdown
    setActionCooldown(prev => ({ ...prev, [task.id]: true }));
    setCountdown(prev => ({ ...prev, [task.id]: 10 }));

    // Countdown timer
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        const newValue = (prev[task.id] || 10) - 1;
        if (newValue <= 0) {
          clearInterval(countdownInterval);
          setActionCooldown(prevCooldown => ({ ...prevCooldown, [task.id]: false }));
          setAwaitingConfirm(prevConfirm => ({ ...prevConfirm, [task.id]: true }));
          return { ...prev, [task.id]: 0 };
        }
        return { ...prev, [task.id]: newValue };
      });
    }, 1000);
  };

  const handleConfirmTask = async (task: Task) => {
    if (!pool?.id || !walletAddress) {
      toast({
        title: "Error",
        description: "Please connect your wallet",
        variant: "destructive"
      });
      return;
    }

    try {
      // Save completion to database
      const { error } = await supabase
        .from('social_farming_completions')
        .insert({
          pool_id: pool.id,
          wallet_address: walletAddress,
          task_id: task.id,
          points_earned: task.points
        });

      if (error) {
        // Check if it's a duplicate (already completed)
        if (error.code === '23505') {
          toast({
            title: "Already Completed",
            description: "You have already completed this task",
            variant: "destructive"
          });
          setAwaitingConfirm(prev => ({ ...prev, [task.id]: false }));
          setCompletedTasks(prev => new Set([...prev, task.id]));
          return;
        }
        throw error;
      }

      // Update local state
      setAwaitingConfirm(prev => ({ ...prev, [task.id]: false }));
      setCompletedTasks(prev => new Set([...prev, task.id]));
      setUserPoints(prev => prev + task.points);
      setPendingRewards(prev => prev + (task.points * 0.1));

      // Update pool total points
      await supabase
        .from('social_farming_pools')
        .update({ total_points: (pool.totalPoints || 0) + task.points })
        .eq('id', pool.id);
      
      toast({
        title: "Task Completed!",
        description: `+${task.points} points earned`,
      });
    } catch (error: any) {
      console.error("Error saving completion:", error);
      toast({
        title: "Error",
        description: "Failed to save task completion",
        variant: "destructive"
      });
    }
  };

  const handleClaimRewards = async () => {
    if (pendingRewards === 0) {
      toast({
        title: "No Rewards",
        description: "Complete tasks to earn rewards",
        variant: "destructive"
      });
      return;
    }

    setIsClaiming(true);
    
    setTimeout(() => {
      toast({
        title: "Rewards Claimed!",
        description: `${pendingRewards.toFixed(2)} ${pool?.symbol} claimed successfully`,
      });
      setPendingRewards(0);
      setIsClaiming(false);
    }, 2000);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="pb-20 md:pb-0">
          <div className="flex flex-col items-center justify-center h-[80vh] gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="min-h-screen bg-background">
        <main className="pb-20 md:pb-0">
          <div className="flex flex-col items-center justify-center h-[80vh] gap-4">
            <div className="p-4 bg-yellow-500/10 rounded-full">
              <Sparkles className="h-12 w-12 text-yellow-500/50" />
            </div>
            <h1 className="text-2xl font-bold">Pool Not Found</h1>
            <p className="text-muted-foreground">This social farming pool doesn't exist.</p>
            <Button onClick={() => navigate('/')} className="bg-yellow-600 hover:bg-yellow-700">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const completedCount = completedTasks.size;
  const totalTasks = tasks.length;
  const progressPercent = (completedCount / totalTasks) * 100;

  return (
    <div className="min-h-screen bg-background">
      
      <main className="pb-20 md:pb-0">
        {/* Header */}
        <div className="border-b border-yellow-500/20 bg-gradient-to-b from-yellow-500/5 to-background">
          <div className="max-w-5xl mx-auto px-4 py-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="mb-4 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            <div className="flex items-start gap-4 mb-6">
              <img 
                src={pool.logo} 
                alt={pool.tokenName}
                className="w-16 h-16 rounded-full object-cover ring-2 ring-yellow-500/30"
                onError={(e) => {
                  e.currentTarget.src = "/assets/default-token.png";
                }}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold">{pool.tokenName}</h1>
                  <span className="text-sm font-bold text-yellow-400">${pool.symbol}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button 
                    className="flex items-center gap-1.5 px-2 py-1 bg-muted/50 hover:bg-muted rounded text-xs font-mono transition-colors group"
                    onClick={() => copyToClipboard(pool.contractAddress)}
                  >
                    <span className="text-muted-foreground">{pool.contractAddress.slice(0, 6)}...{pool.contractAddress.slice(-4)}</span>
                    <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <a
                    href={`https://pump.fun/${pool.contractAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-xs transition-colors"
                  >
                    Pump.fun <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container max-w-5xl mx-auto px-4 py-6">
          <div className="grid lg:grid-cols-3 gap-6">
            
            {/* Left Column - User Stats & Claim */}
            <div className="space-y-4">
              {/* Your Rewards Card */}
              <Card className="border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 to-transparent overflow-hidden">
                <div className="p-4 border-b border-yellow-500/20">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-yellow-400" />
                    <h2 className="font-bold">Your Rewards</h2>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-background/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Your Points</p>
                      <p className="text-2xl font-bold text-yellow-400">{formatNumber(userPoints)}</p>
                    </div>
                    <div className="bg-background/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Pending</p>
                      <p className="text-2xl font-bold text-green-400">N/A</p>
                    </div>
                  </div>
                  
                  <Button 
                    disabled
                    className="w-full bg-muted text-muted-foreground font-bold h-12 cursor-not-allowed"
                  >
                    <Award className="w-4 h-4 mr-2" />
                    Claim Coming Soon
                  </Button>
                  
                  <p className="text-xs text-center text-muted-foreground">Token claiming will be available soon</p>
                </div>
              </Card>

              {/* Pool Stats */}
              <Card className="border-border">
                <div className="p-4 border-b border-border">
                  <h2 className="font-bold">Pool Stats</h2>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Reward Pool</span>
                    <span className="font-bold text-yellow-400">${formatNumber(pool.rewardPool)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Points</span>
                    <span className="font-bold">{formatNumber(pool.totalPoints)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Farmers</span>
                    <span className="font-bold">{formatNumber(pool.participants)}</span>
                  </div>
                </div>
              </Card>

              {/* Progress */}
              <Card className="border-border">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Task Progress</span>
                    <span className="text-sm text-muted-foreground">{completedCount}/{totalTasks}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-yellow-500 transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </Card>
            </div>

            {/* Right Column - Tasks */}
            <div className="lg:col-span-2">
              <Card className="border-yellow-500/20">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-yellow-400" />
                    <h2 className="font-bold text-lg">Farming Tasks</h2>
                  </div>
                  <span className="text-xs text-muted-foreground">Complete tasks to earn {pool.symbol}</span>
                </div>
                
                <div className="p-4 space-y-3">
                  {tasks.map((task) => {
                    const isCompleted = completedTasks.has(task.id);
                    const isLoading = actionCooldown[task.id];
                    const isAwaitingConfirm = awaitingConfirm[task.id];
                    const taskCountdown = countdown[task.id] || 0;
                    const IconComponent = task.icon;
                    
                    return (
                      <div 
                        key={task.id}
                        className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                          isCompleted 
                            ? 'bg-yellow-500/5 border-yellow-500/30' 
                            : isAwaitingConfirm
                            ? 'bg-green-500/5 border-green-500/30'
                            : 'bg-card border-border hover:border-yellow-500/20'
                        }`}
                      >
                        <div className={`p-3 rounded-xl ${task.iconBg}`}>
                          <IconComponent className={`w-5 h-5 ${task.iconColor}`} />
                        </div>
                        
                        <div className="flex-1">
                          <h3 className="font-semibold">{task.title}</h3>
                          <p className="text-xs text-muted-foreground">{task.description}</p>
                        </div>
                        
                        <div className="text-right mr-2">
                          <p className="text-lg font-bold text-yellow-400">+{task.points}</p>
                          <p className="text-xs text-muted-foreground">points</p>
                        </div>
                        
                        {isCompleted ? (
                          <Button 
                            variant="outline"
                            disabled
                            className="border-yellow-500/30 bg-yellow-500/10 w-24"
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Done
                          </Button>
                        ) : isAwaitingConfirm ? (
                          <Button 
                            onClick={() => handleConfirmTask(task)}
                            className="bg-green-500 hover:bg-green-600 text-white font-semibold w-24"
                          >
                            Confirm
                          </Button>
                        ) : isLoading ? (
                          <Button 
                            disabled
                            className="bg-yellow-500/50 text-black font-semibold w-24"
                          >
                            {taskCountdown}s
                          </Button>
                        ) : (
                          <Button 
                            onClick={() => handleTaskAction(task)}
                            disabled={!connected}
                            className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold w-24"
                          >
                            Start
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SocialFarmingDetails;
