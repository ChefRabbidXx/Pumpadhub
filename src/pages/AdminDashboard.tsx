import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Shield, RefreshCw, Bug, Wallet, BarChart3, Rocket, Newspaper, Ban } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { WithdrawalRequestsTable } from '@/components/admin/WithdrawalRequestsTable';
import { BountyManagement } from '@/components/admin/BountyManagement';
import { WalletManagement } from '@/components/admin/WalletManagement';
import { PendingRewardsOverview } from '@/components/admin/PendingRewardsOverview';
import { SafuLaunchManagement } from '@/components/admin/SafuLaunchManagement';
import { TweetManagement } from '@/components/admin/TweetManagement';
import { BlockedWallets } from '@/components/admin/BlockedWallets';

interface WithdrawalRequest {
  id: string;
  wallet_address: string;
  feature: string;
  request_type: string;
  amount: number;
  token_symbol: string;
  token_address: string;
  pool_id: string;
  status: string;
  tx_hash: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface BountySubmission {
  id: string;
  wallet_address: string;
  title: string;
  description: string;
  severity: string;
  image_url: string | null;
  status: string;
  reward_amount: number;
  admin_response: string | null;
  tx_hash: string | null;
  created_at: string;
}

export const AdminDashboard: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [bountySubmissions, setBountySubmissions] = useState<BountySubmission[]>([]);
  const [activeTab, setActiveTab] = useState('withdrawals');
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check authentication
  useEffect(() => {
    const checkAuth = () => {
      const sessionToken = sessionStorage.getItem('adminSessionToken');
      const expiresAt = sessionStorage.getItem('adminExpiresAt');
      
      if (!sessionToken || !expiresAt || parseInt(expiresAt) < Date.now()) {
        sessionStorage.removeItem('adminSessionToken');
        sessionStorage.removeItem('adminExpiresAt');
        navigate('/admin-login');
        return;
      }
      
      setIsAuthenticated(true);
      setIsLoading(false);
    };

    checkAuth();
  }, [navigate]);

  // Fetch data
  useEffect(() => {
    if (isAuthenticated) {
      fetchWithdrawalRequests();
      fetchBountySubmissions();
    }
  }, [isAuthenticated]);

  const fetchWithdrawalRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWithdrawalRequests(data || []);
    } catch (error: any) {
      console.error('Error fetching withdrawal requests:', error);
      toast({
        title: "Error",
        description: "Failed to fetch withdrawal requests",
        variant: "destructive"
      });
    }
  };

  const fetchBountySubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('bounty_submissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBountySubmissions(data || []);
    } catch (error: any) {
      console.error('Error fetching bounty submissions:', error);
      toast({
        title: "Error",
        description: "Failed to fetch bounty submissions",
        variant: "destructive"
      });
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('adminSessionToken');
    sessionStorage.removeItem('adminExpiresAt');
    toast({
      title: "Logged Out",
      description: "You have been logged out from the admin dashboard"
    });
    navigate('/admin-login');
  };

  const handleRefresh = () => {
    fetchWithdrawalRequests();
    fetchBountySubmissions();
  };

  const handleApprove = async (id: string, txHash: string) => {
    try {
      // First get the withdrawal request details
      const { data: request } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('id', id)
        .single();

      if (!request) throw new Error('Request not found');

      // Update withdrawal request status
      const { error } = await supabase
        .from('withdrawal_requests')
        .update({ 
          status: 'completed', 
          tx_hash: txHash,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      // Also update the corresponding transaction in transactions table
      // Find the pending claim transaction closest to the withdrawal request time
      const { data: pendingTx } = await supabase
        .from('transactions')
        .select('id')
        .eq('wallet_address', request.wallet_address)
        .eq('pool_id', request.pool_id)
        .eq('type', 'claim')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pendingTx) {
        await supabase
          .from('transactions')
          .update({ 
            status: 'completed',
            tx_hash: txHash
          })
          .eq('id', pendingTx.id);
      }

      toast({
        title: "Request Approved",
        description: "Withdrawal request has been approved and marked as completed"
      });

      fetchWithdrawalRequests();
    } catch (error: any) {
      console.error('Error approving request:', error);
      toast({
        title: "Error",
        description: "Failed to approve request",
        variant: "destructive"
      });
    }
  };

  const handleReject = async (id: string, notes: string) => {
    try {
      const { error } = await supabase
        .from('withdrawal_requests')
        .update({ 
          status: 'rejected', 
          admin_notes: notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Request Rejected",
        description: "Withdrawal request has been rejected"
      });

      fetchWithdrawalRequests();
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      toast({
        title: "Error",
        description: "Failed to reject request",
        variant: "destructive"
      });
    }
  };

  const [withdrawalTab, setWithdrawalTab] = useState('all');

  const filteredRequests = withdrawalTab === 'all' 
    ? withdrawalRequests 
    : withdrawalRequests.filter(r => r.feature === withdrawalTab);

  const pendingWithdrawals = withdrawalRequests.filter(r => r.status === 'pending').length;
  const pendingBounties = bountySubmissions.filter(b => b.status === 'pending').length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">Manage requests & bounties</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRefresh}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button 
              variant="destructive" 
              size="sm"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-2">
              <CardDescription>Pending Withdrawals</CardDescription>
              <CardTitle className="text-3xl text-yellow-500">{pendingWithdrawals}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Bug className="w-4 h-4" />
                Pending Bounties
              </CardDescription>
              <CardTitle className="text-3xl text-orange-500">{pendingBounties}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="withdrawals">Withdrawal Requests</TabsTrigger>
            <TabsTrigger value="bounties" className="flex items-center gap-1">
              <Bug className="w-4 h-4" />
              Bounty Submissions
              {pendingBounties > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-orange-500 text-white rounded-full">
                  {pendingBounties}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="wallets" className="flex items-center gap-1">
              <Wallet className="w-4 h-4" />
              Pool Wallets
            </TabsTrigger>
            <TabsTrigger value="rewards" className="flex items-center gap-1">
              <BarChart3 className="w-4 h-4" />
              Pending Rewards
            </TabsTrigger>
            <TabsTrigger value="safu" className="flex items-center gap-1">
              <Rocket className="w-4 h-4" />
              Safu Launches
            </TabsTrigger>
            <TabsTrigger value="tweets" className="flex items-center gap-1">
              <Newspaper className="w-4 h-4" />
              Updates
            </TabsTrigger>
            <TabsTrigger value="blocked" className="flex items-center gap-1">
              <Ban className="w-4 h-4" />
              Blocked Wallets
            </TabsTrigger>
          </TabsList>

          <TabsContent value="withdrawals">
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle>Withdrawal Requests</CardTitle>
                <CardDescription>
                  Manage and process user withdrawal requests
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={withdrawalTab} onValueChange={setWithdrawalTab}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="staking">Staking</TabsTrigger>
                    <TabsTrigger value="race">Race</TabsTrigger>
                    <TabsTrigger value="burn">Burn</TabsTrigger>
                  </TabsList>
                  <TabsContent value={withdrawalTab}>
                    <WithdrawalRequestsTable
                      requests={filteredRequests}
                      onApprove={handleApprove}
                      onReject={handleReject}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bounties">
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bug className="w-5 h-5" />
                  Bounty Submissions
                </CardTitle>
                <CardDescription>
                  Review and manage bug bounty submissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BountyManagement 
                  submissions={bountySubmissions} 
                  onUpdate={fetchBountySubmissions} 
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wallets">
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  Pool Wallet Management
                </CardTitle>
                <CardDescription>
                  Access and manage platform pool wallet addresses and private keys
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WalletManagement />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rewards">
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Pending Rewards Overview
                </CardTitle>
                <CardDescription>
                  View all pending rewards and balances across all features
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PendingRewardsOverview />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="safu">
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="w-5 h-5" />
                  Safu Launch Management
                </CardTitle>
                <CardDescription>
                  View all Safu launches, deposit wallets, and created tokens
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SafuLaunchManagement />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tweets">
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Newspaper className="w-5 h-5" />
                  Tweet Updates Management
                </CardTitle>
                <CardDescription>
                  Add and manage tweet updates shown on the Updates page
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TweetManagement />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="blocked">
            <BlockedWallets />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;
