import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowUpDown, 
  ChevronDown,
  ChevronRight,
  Search, 
  Shield,
  BarChart3,
  Coins,
  Trophy,
  Users,
  Flame,
  TrendingUp,
  Rocket,
  Loader2,
  ExternalLink,
  Gift,
  CheckCircle2,
  MessageCircle,
  Send,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWallet } from "@/contexts/WalletContext";
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { toast } from "sonner";
import { getMainnetRpcUrl } from "@/utils/rpc-config";

interface SafuToken {
  id: string;
  name: string;
  symbol: string;
  logo: string;
  contractAddress: string;
  marketCap: number | null;
  price: number | null;
  holders: number | null;
  features: {
    staking: boolean;
    race: boolean;
    socialFarming: boolean;
    burn: boolean;
  };
  sharedCompetition?: boolean;
}

interface SafuLaunch {
  id: string;
  token_name: string;
  token_symbol: string;
  token_image_url: string | null;
  description: string | null;
  creator_wallet: string;
  total_contributed: number;
  hardcap: number;
  contributor_count: number;
  status: string;
  created_at: string;
  contract_address: string | null;
  deposit_wallet_address: string | null;
  website_url: string | null;
  telegram_url: string | null;
  twitter_url: string | null;
}

interface SafuContribution {
  id: string;
  launch_id: string;
  wallet_address: string;
  amount: number;
  token_share: number;
  created_at: string;
  claimed: boolean;
  claimed_at: string | null;
}

interface SafuChatMessage {
  id: string;
  launch_id: string;
  wallet_address: string;
  message: string;
  created_at: string;
}

const CONTRIBUTOR_TOKENS = 150_000_000;
const HARDCAP_SOL = 11;

const Safu = () => {
  const navigate = useNavigate();
  const { publicKey, walletAddress, wallet, connected } = useWallet();
  
  const [activeTab, setActiveTab] = useState("funding");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [tokens, setTokens] = useState<SafuToken[]>([]);
  const [launches, setLaunches] = useState<SafuLaunch[]>([]);
  const [contributions, setContributions] = useState<Record<string, SafuContribution>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [contributingTo, setContributingTo] = useState<string | null>(null);
  const [contributionAmounts, setContributionAmounts] = useState<Record<string, string>>({});
  const [claimingFrom, setClaimingFrom] = useState<string | null>(null);
  const [refundingFrom, setRefundingFrom] = useState<string | null>(null);
  const [expandedLaunch, setExpandedLaunch] = useState<string | null>(null);
  const [expandedTab, setExpandedTab] = useState<Record<string, 'contributors' | 'chat'>>({});
  const [launchContributors, setLaunchContributors] = useState<Record<string, SafuContribution[]>>({});
  const [launchChats, setLaunchChats] = useState<Record<string, SafuChatMessage[]>>({});
  const [chatInputs, setChatInputs] = useState<Record<string, string>>({});
  const [sendingChat, setSendingChat] = useState<string | null>(null);
  const chatScrollRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [walletBalance, setWalletBalance] = useState<number>(0);

  // Fetch wallet balance when connected
  useEffect(() => {
    const fetchWalletBalance = async () => {
      if (connected && publicKey) {
        try {
          const connection = new Connection(getMainnetRpcUrl(), 'confirmed');
          const balance = await connection.getBalance(publicKey);
          setWalletBalance(balance / LAMPORTS_PER_SOL);
        } catch (error) {
          console.error('Failed to fetch wallet balance:', error);
          setWalletBalance(0);
        }
      } else {
        setWalletBalance(0);
      }
    };

    fetchWalletBalance();
    const interval = setInterval(fetchWalletBalance, 30000);
    return () => clearInterval(interval);
  }, [connected, publicKey]);

  // $PUMPAD token - native token with all features
  const pumpadToken: SafuToken = {
    id: 'pumpad-native',
    name: 'Pumpad',
    symbol: 'PUMPAD',
    logo: 'https://ipfs.io/ipfs/bafkreiaejnjbcxfdt5xmqcsykkuactyknzlevyss34e5ny55lkprilvqza',
    contractAddress: '2FWWHi5NLVj6oXkAyWAtqjBZ6CNRCX8QM8yUtRVNpump',
    marketCap: null,
    price: null,
    holders: null,
    features: {
      staking: true,
      race: true,
      socialFarming: false,
      burn: true,
    },
    sharedCompetition: true,
  };

  const fetchTokensWithAllFeatures = async () => {
    try {
      const [stakingPools, racePools, socialPools, burnPools] = await Promise.all([
        supabase.from('staking_pools').select('contract_address, token_name, token_symbol, token_logo_url, status').eq('status', 'active'),
        supabase.from('race_pools').select('contract_address, token_name, token_symbol, token_logo_url, status').eq('status', 'active'),
        supabase.from('social_farming_pools').select('contract_address, token_name, token_symbol, token_logo_url, status').eq('status', 'active'),
        supabase.from('burn_pools').select('contract_address, token_name, token_symbol, token_logo_url, status').eq('status', 'active')
      ]);

      const stakingAddresses = new Set(stakingPools.data?.map(p => p.contract_address).filter(Boolean) || []);
      const raceAddresses = new Set(racePools.data?.map(p => p.contract_address).filter(Boolean) || []);
      const socialAddresses = new Set(socialPools.data?.map(p => p.contract_address).filter(Boolean) || []);
      const burnAddresses = new Set(burnPools.data?.map(p => p.contract_address).filter(Boolean) || []);

      const allAddresses = new Set([...stakingAddresses, ...raceAddresses, ...socialAddresses, ...burnAddresses]);

      const safuTokens: SafuToken[] = [];
      
      for (const address of allAddresses) {
        const hasAllFeatures = 
          stakingAddresses.has(address) &&
          raceAddresses.has(address) &&
          socialAddresses.has(address) &&
          burnAddresses.has(address);

        if (hasAllFeatures) {
          const tokenInfo = stakingPools.data?.find(p => p.contract_address === address) ||
                           racePools.data?.find(p => p.contract_address === address);

          if (tokenInfo) {
            let marketCap = null;
            let price = null;
            let holders = null;

            try {
              const { data: tokenData } = await supabase.functions.invoke('fetch-token-info', {
                body: { tokenAddress: address }
              });
              
              if (tokenData?.success && tokenData?.data) {
                marketCap = tokenData.data.marketCap || null;
                price = tokenData.data.pricePerToken || null;
                holders = tokenData.data.holders || null;
              }
            } catch (err) {
              console.error('Error fetching token info:', err);
            }

            safuTokens.push({
              id: address,
              name: tokenInfo.token_name || 'Unknown',
              symbol: tokenInfo.token_symbol || 'UNK',
              logo: tokenInfo.token_logo_url || '/assets/default-token.png',
              contractAddress: address,
              marketCap,
              price,
              holders,
              features: { staking: true, race: true, socialFarming: true, burn: true }
            });
          }
        }
      }

      setTokens([pumpadToken, ...safuTokens]);
    } catch (error) {
      console.error("Error loading tokens:", error);
      setTokens([pumpadToken]);
    }
  };

  const fetchLaunches = async () => {
    try {
      const { data, error } = await supabase
        .from('safu_launches')
        .select('*')
        .in('status', ['pending_contributions', 'ready_to_launch', 'launching', 'created'])
        .order('total_contributed', { ascending: false });

      if (error) throw error;
      setLaunches(data || []);

      if (walletAddress) {
        const { data: userContributions } = await supabase
          .from('safu_contributions')
          .select('*')
          .eq('wallet_address', walletAddress);

        if (userContributions) {
          const contribMap: Record<string, SafuContribution> = {};
          userContributions.forEach(c => {
            contribMap[c.launch_id] = c;
          });
          setContributions(contribMap);
        }
      }
    } catch (error) {
      console.error("Error loading launches:", error);
    }
  };

  const fetchLaunchContributors = async (launchId: string) => {
    try {
      const { data, error } = await supabase
        .from('safu_contributions')
        .select('*')
        .eq('launch_id', launchId)
        .order('amount', { ascending: false });

      if (error) throw error;
      setLaunchContributors(prev => ({ ...prev, [launchId]: data || [] }));
    } catch (error) {
      console.error('Error fetching contributors:', error);
    }
  };

  const fetchLaunchChat = async (launchId: string) => {
    try {
      const { data, error } = await supabase
        .from('safu_launch_chats')
        .select('*')
        .eq('launch_id', launchId)
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) throw error;
      setLaunchChats(prev => ({ ...prev, [launchId]: data || [] }));
    } catch (error) {
      console.error('Error fetching chat:', error);
    }
  };

  const toggleExpandLaunch = async (launchId: string, tab: 'contributors' | 'chat') => {
    if (expandedLaunch === launchId && expandedTab[launchId] === tab) {
      setExpandedLaunch(null);
    } else {
      setExpandedLaunch(launchId);
      setExpandedTab(prev => ({ ...prev, [launchId]: tab }));
      
      if (tab === 'contributors' && !launchContributors[launchId]) {
        await fetchLaunchContributors(launchId);
      } else if (tab === 'chat' && !launchChats[launchId]) {
        await fetchLaunchChat(launchId);
      }
    }
  };

  const handleSendChat = async (launchId: string) => {
    if (!connected || !walletAddress) {
      toast.error('Please connect your wallet');
      return;
    }

    const message = chatInputs[launchId]?.trim();
    if (!message) return;

    setSendingChat(launchId);
    try {
      const { error } = await supabase.from('safu_launch_chats').insert({
        launch_id: launchId,
        wallet_address: walletAddress,
        message
      });

      if (error) throw error;

      setChatInputs(prev => ({ ...prev, [launchId]: '' }));
      await fetchLaunchChat(launchId);

      setTimeout(() => {
        const ref = chatScrollRefs.current[launchId];
        if (ref) ref.scrollTop = ref.scrollHeight;
      }, 100);
    } catch (error: any) {
      console.error('Chat error:', error);
      toast.error('Failed to send message');
    } finally {
      setSendingChat(null);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchTokensWithAllFeatures(), fetchLaunches()]);
      setIsLoading(false);
    };
    loadData();
  }, [walletAddress]);

  useEffect(() => {
    const channel = supabase
      .channel('safu-launch-chats')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'safu_launch_chats'
        },
        (payload) => {
          const newMessage = payload.new as SafuChatMessage;
          setLaunchChats(prev => {
            const currentChats = prev[newMessage.launch_id] || [];
            if (currentChats.some(msg => msg.id === newMessage.id)) {
              return prev;
            }
            return {
              ...prev,
              [newMessage.launch_id]: [...currentChats, newMessage]
            };
          });

          setTimeout(() => {
            const ref = chatScrollRefs.current[newMessage.launch_id];
            if (ref) ref.scrollTop = ref.scrollHeight;
          }, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleContribute = async (launch: SafuLaunch) => {
    if (!connected || !walletAddress || !wallet) {
      toast.error('Please connect your wallet');
      return;
    }

    const amountStr = contributionAmounts[launch.id];
    const amount = parseFloat(amountStr);
    
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const userContribution = contributions[launch.id]?.amount || 0;
    const maxAllowed = Math.min(1 - userContribution, launch.hardcap - launch.total_contributed);

    if (amount > maxAllowed) {
      toast.error(`Maximum contribution is ${maxAllowed.toFixed(2)} SOL`);
      return;
    }

    const estimatedFee = 0.001;
    if (amount + estimatedFee > walletBalance) {
      toast.error(`Insufficient balance. You have ${walletBalance.toFixed(4)} SOL but need ${(amount + estimatedFee).toFixed(4)} SOL (including fees)`);
      return;
    }

    if (!launch.deposit_wallet_address) {
      toast.error('Deposit wallet not available');
      return;
    }

    setContributingTo(launch.id);
    try {
      const { data: validateData, error: validateError } = await supabase.functions.invoke('contribute-safu-launch', {
        body: {
          launchId: launch.id,
          walletAddress: walletAddress,
          amount
        }
      });

      if (validateError) throw validateError;
      if (!validateData.success) throw new Error(validateData.error);

      const connection = new Connection(getMainnetRpcUrl(), 'confirmed');
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey!,
          toPubkey: new PublicKey(launch.deposit_wallet_address),
          lamports: Math.floor(amount * LAMPORTS_PER_SOL)
        })
      );

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey!;

      const signedTx = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(signature, 'confirmed');

      const { error: confirmError } = await supabase.functions.invoke('confirm-safu-contribution', {
        body: {
          launchId: launch.id,
          walletAddress: walletAddress,
          amount,
          txHash: signature
        }
      });

      if (confirmError) throw confirmError;

      toast.success(`Contributed ${amount} SOL successfully!`);
      setContributionAmounts(prev => ({ ...prev, [launch.id]: '' }));
      fetchLaunches();
    } catch (error: any) {
      console.error('Contribution error:', error);
      toast.error(error.message || 'Failed to contribute');
    } finally {
      setContributingTo(null);
    }
  };

  const handleRefund = async (launch: SafuLaunch) => {
    if (!connected || !walletAddress) {
      toast.error('Please connect your wallet');
      return;
    }

    const userContribution = contributions[launch.id];
    if (!userContribution) {
      toast.error('No contribution to refund');
      return;
    }

    setRefundingFrom(launch.id);
    try {
      const { data, error } = await supabase.functions.invoke('refund-safu-contribution', {
        body: {
          launchId: launch.id,
          walletAddress: walletAddress,
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast.success(`Refund of ${userContribution.amount} SOL processed! TX: ${data.txHash.slice(0, 8)}...`);
      fetchLaunches();
    } catch (error: any) {
      console.error('Refund error:', error);
      toast.error(error.message || 'Failed to process refund');
    } finally {
      setRefundingFrom(null);
    }
  };

  const handleClaimTokens = async (launch: SafuLaunch) => {
    if (!connected || !walletAddress) {
      toast.error('Please connect your wallet');
      return;
    }

    const userContribution = contributions[launch.id];
    if (!userContribution || userContribution.claimed) {
      toast.error('No tokens to claim');
      return;
    }

    setClaimingFrom(launch.id);
    try {
      const { data, error } = await supabase.functions.invoke('claim-safu-tokens', {
        body: {
          launchId: launch.id,
          walletAddress: walletAddress,
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast.success(`Claimed ${data.tokenAmount.toLocaleString()} ${launch.token_symbol}! TX: ${data.txHash.slice(0, 8)}...`);
      fetchLaunches();
    } catch (error: any) {
      console.error('Claim error:', error);
      toast.error(error.message || 'Failed to claim tokens');
    } finally {
      setClaimingFrom(null);
    }
  };

  const formatAddress = (address: string) => `${address.slice(0, 4)}...${address.slice(-4)}`;
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(2);
  };

  const filteredTokens = tokens.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLaunches = launches.filter(l =>
    l.token_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.token_symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="border-b-2 border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 flex items-center justify-center border-2 border-pink-400 bg-pink-400/10">
              <Rocket className="w-7 h-7 text-pink-400" />
            </div>
            <div>
              <h1 className="font-pixel text-xl text-foreground">SAFU LAUNCH</h1>
              <p className="text-sm text-muted-foreground font-mono">Fair launch platform for Solana tokens</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            <div className="p-3 border-2 border-border bg-background">
              <p className="font-pixel text-[8px] text-muted-foreground mb-1">TOTAL LAUNCHED</p>
              <p className="font-pixel text-lg text-pink-400">{tokens.length}</p>
            </div>
            <div className="p-3 border-2 border-border bg-background">
              <p className="font-pixel text-[8px] text-muted-foreground mb-1">ACTIVE FUNDING</p>
              <p className="font-pixel text-lg text-foreground">{launches.length}</p>
            </div>
            <div className="p-3 border-2 border-border bg-background">
              <p className="font-pixel text-[8px] text-muted-foreground mb-1">TOTAL RAISED</p>
              <p className="font-pixel text-lg text-green-400">{formatNumber(launches.reduce((a, l) => a + l.total_contributed, 0))} SOL</p>
            </div>
            <div className="p-3 border-2 border-border bg-background">
              <p className="font-pixel text-[8px] text-muted-foreground mb-1">CONTRIBUTORS</p>
              <p className="font-pixel text-lg text-foreground">{launches.reduce((a, l) => a + l.contributor_count, 0)}</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("funding")}
            className={cn(
              "px-4 py-2 font-pixel text-[10px] border-2 transition-all",
              activeTab === "funding"
                ? "bg-pink-400 border-pink-400 text-primary-foreground"
                : "border-border text-muted-foreground hover:border-pink-400 hover:text-pink-400"
            )}
          >
            FUNDING
          </button>
          <button
            onClick={() => setActiveTab("launched")}
            className={cn(
              "px-4 py-2 font-pixel text-[10px] border-2 transition-all",
              activeTab === "launched"
                ? "bg-pink-400 border-pink-400 text-primary-foreground"
                : "border-border text-muted-foreground hover:border-pink-400 hover:text-pink-400"
            )}
          >
            LAUNCHED
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search tokens..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-2 border-border bg-background font-mono text-sm"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-pink-400" />
          </div>
        ) : activeTab === "funding" ? (
          <div className="space-y-4">
            {filteredLaunches.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-border">
                <Rocket className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="font-pixel text-sm text-muted-foreground">No active funding rounds</p>
              </div>
            ) : (
              filteredLaunches.map((launch) => {
                const progress = (launch.total_contributed / launch.hardcap) * 100;
                const userContribution = contributions[launch.id];
                const isExpanded = expandedLaunch === launch.id;
                const currentTab = expandedTab[launch.id] || 'contributors';
                
                return (
                  <div key={launch.id} className="border-2 border-border bg-card overflow-hidden">
                    {/* Launch Header */}
                    <div className="p-4 flex items-start gap-4">
                      <div className="w-14 h-14 border-2 border-border bg-muted flex items-center justify-center shrink-0">
                        {launch.token_image_url ? (
                          <img src={launch.token_image_url} alt={launch.token_name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-pixel text-lg">{launch.token_symbol.charAt(0)}</span>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-pixel text-sm text-foreground truncate">{launch.token_name}</h3>
                          <span className="font-pixel text-[8px] text-pink-400">${launch.token_symbol}</span>
                        </div>
                        
                        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{launch.description || 'No description'}</p>
                        
                        {/* Progress */}
                        <div className="mb-3">
                          <div className="flex justify-between text-[10px] font-pixel mb-1">
                            <span className="text-muted-foreground">PROGRESS</span>
                            <span className="text-foreground">{progress.toFixed(1)}%</span>
                          </div>
                          <div className="h-2 bg-muted border border-border">
                            <div 
                              className="h-full bg-pink-400 transition-all"
                              style={{ width: `${Math.min(100, progress)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] font-mono mt-1">
                            <span className="text-muted-foreground">{launch.total_contributed.toFixed(2)} SOL</span>
                            <span className="text-muted-foreground">{launch.hardcap} SOL</span>
                          </div>
                        </div>

                        {/* Stats Row */}
                        <div className="flex gap-4 text-[10px] font-mono text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {launch.contributor_count} contributors
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* User Contribution */}
                    {connected && (
                      <div className="px-4 pb-4">
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            placeholder="SOL amount"
                            value={contributionAmounts[launch.id] || ''}
                            onChange={(e) => setContributionAmounts(prev => ({ ...prev, [launch.id]: e.target.value }))}
                            className="flex-1 border-2 border-border bg-background font-mono text-sm"
                            step="0.1"
                            min="0"
                            max="1"
                          />
                          <Button
                            onClick={() => handleContribute(launch)}
                            disabled={contributingTo === launch.id}
                            className="bg-pink-400 hover:bg-pink-500 text-primary-foreground font-pixel text-[10px] border-2 border-pink-400"
                          >
                            {contributingTo === launch.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              'CONTRIBUTE'
                            )}
                          </Button>
                        </div>
                        
                        {userContribution && (
                          <div className="mt-3 p-2 border-2 border-green-400/30 bg-green-400/5">
                            <div className="flex items-center justify-between">
                              <span className="font-pixel text-[8px] text-green-400">YOUR CONTRIBUTION</span>
                              <span className="font-mono text-sm text-green-400">{userContribution.amount} SOL</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Expandable Section */}
                    <div className="border-t-2 border-border">
                      <div className="flex">
                        <button
                          onClick={() => toggleExpandLaunch(launch.id, 'contributors')}
                          className={cn(
                            "flex-1 px-4 py-2 font-pixel text-[8px] border-r-2 border-border transition-all",
                            isExpanded && currentTab === 'contributors'
                              ? "bg-pink-400/20 text-pink-400"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Users className="w-3 h-3 inline mr-1" />
                          CONTRIBUTORS
                        </button>
                        <button
                          onClick={() => toggleExpandLaunch(launch.id, 'chat')}
                          className={cn(
                            "flex-1 px-4 py-2 font-pixel text-[8px] transition-all",
                            isExpanded && currentTab === 'chat'
                              ? "bg-pink-400/20 text-pink-400"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <MessageCircle className="w-3 h-3 inline mr-1" />
                          CHAT
                        </button>
                      </div>
                      
                      {isExpanded && (
                        <div className="p-4 bg-muted/20">
                          {currentTab === 'contributors' ? (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {launchContributors[launch.id]?.map((c, i) => (
                                <div key={c.id} className="flex justify-between text-xs font-mono">
                                  <span className="text-muted-foreground">{formatAddress(c.wallet_address)}</span>
                                  <span className="text-foreground">{c.amount} SOL</span>
                                </div>
                              )) || (
                                <p className="text-xs text-muted-foreground">Loading...</p>
                              )}
                            </div>
                          ) : (
                            <div>
                              <ScrollArea 
                                ref={(el) => { chatScrollRefs.current[launch.id] = el as any; }}
                                className="h-48 mb-3"
                              >
                                <div className="space-y-2">
                                  {launchChats[launch.id]?.map((msg) => (
                                    <div key={msg.id} className="text-xs">
                                      <span className="font-mono text-pink-400">{formatAddress(msg.wallet_address)}</span>
                                      <span className="text-muted-foreground mx-1">:</span>
                                      <span className="text-foreground">{msg.message}</span>
                                    </div>
                                  )) || (
                                    <p className="text-xs text-muted-foreground">No messages yet</p>
                                  )}
                                </div>
                              </ScrollArea>
                              
                              {connected && (
                                <div className="flex gap-2">
                                  <Input
                                    placeholder="Type a message..."
                                    value={chatInputs[launch.id] || ''}
                                    onChange={(e) => setChatInputs(prev => ({ ...prev, [launch.id]: e.target.value }))}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSendChat(launch.id)}
                                    className="flex-1 border-2 border-border bg-background font-mono text-xs"
                                  />
                                  <Button
                                    size="sm"
                                    onClick={() => handleSendChat(launch.id)}
                                    disabled={sendingChat === launch.id}
                                    className="bg-pink-400 hover:bg-pink-500 border-2 border-pink-400"
                                  >
                                    <Send className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTokens.length === 0 ? (
              <div className="col-span-full text-center py-16 border-2 border-dashed border-border">
                <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="font-pixel text-sm text-muted-foreground">No launched tokens found</p>
              </div>
            ) : (
              filteredTokens.map((token) => (
                <div 
                  key={token.id}
                  onClick={() => navigate(`/token/${token.contractAddress}`)}
                  className="border-2 border-border bg-card p-4 cursor-pointer hover:border-pink-400 transition-all"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <img 
                      src={token.logo} 
                      alt={token.name}
                      className="w-12 h-12 border-2 border-border"
                    />
                    <div>
                      <h3 className="font-pixel text-sm text-foreground">{token.name}</h3>
                      <span className="font-pixel text-[8px] text-pink-400">${token.symbol}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 flex-wrap">
                    {token.features.staking && (
                      <span className="font-pixel text-[7px] px-2 py-1 bg-green-400/20 text-green-400 border border-green-400/30">STAKE</span>
                    )}
                    {token.features.race && (
                      <span className="font-pixel text-[7px] px-2 py-1 bg-yellow-400/20 text-yellow-400 border border-yellow-400/30">RACE</span>
                    )}
                    {token.features.burn && (
                      <span className="font-pixel text-[7px] px-2 py-1 bg-orange-400/20 text-orange-400 border border-orange-400/30">BURN</span>
                    )}
                    {token.features.socialFarming && (
                      <span className="font-pixel text-[7px] px-2 py-1 bg-purple-400/20 text-purple-400 border border-purple-400/30">FARM</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Safu;
