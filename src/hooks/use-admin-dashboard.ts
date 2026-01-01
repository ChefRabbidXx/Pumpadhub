import { useState, useEffect, useCallback } from "react";
import { useToast } from "./use-toast";
import { 
  Connection, 
  PublicKey, 
  clusterApiUrl, 
  LAMPORTS_PER_SOL 
} from "@solana/web3.js";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { GlobalLoadingManager, useSyncedData } from "@/utils/loading-utils";

// Types for stakers
export interface Staker {
  id: string;
  walletAddress: string;
  totalStaked: number;
  totalClaimed: number;
  firstStakeDate: string;
  tokenSymbol: string;
}

// Types for claim requests
export interface ClaimRequest {
  id: string;
  walletAddress: string;
  amount: number;
  tokenSymbol: string;
  timestamp: string;
  status: "pending" | "approved" | "rejected";
  totalStaked: number;
  totalClaimed: number;
}

// Types for unstake requests
export interface UnstakeRequest {
  id: string;
  walletAddress: string;
  amount: number;
  tokenSymbol: string;
  timestamp: string;
  status: "pending" | "approved" | "rejected";
  totalStaked: number;
  totalClaimed: number;
}

// Types for completed transactions
export interface Transaction {
  id: string;
  type: "stake" | "unstake" | "claim";
  walletAddress: string;
  amount: number;
  tokenSymbol: string;
  timestamp: string;
  status: "completed" | "rejected";
  txHash?: string;
}

// Types for staking statistics
export interface StakingStats {
  totalStaked: number;
  activeStakers: number;
  pendingRewards: number;
  avgStakeAmount: number;
  totalClaimed: number;
  totalUnstaked: number;
  totalValueLocked: number;
}

export function useAdminDashboard() {
  const { toast } = useToast();
  
  // Use useSyncedData hook for cross-browser synchronization
  const [stakers, setStakers] = useSyncedData<Staker[]>('stakers', []);
  const [pendingClaims, setPendingClaims] = useSyncedData<ClaimRequest[]>('pendingClaims', []);
  const [pendingUnstakes, setPendingUnstakes] = useSyncedData<UnstakeRequest[]>('pendingUnstakes', []);
  const [completedTransactions, setCompletedTransactions] = useSyncedData<Transaction[]>('completedTransactions', []);
  
  const [stakingStats, setStakingStats] = useState<StakingStats>({
    totalStaked: 0,
    activeStakers: 0,
    pendingRewards: 0,
    avgStakeAmount: 0,
    totalClaimed: 0,
    totalUnstaked: 0,
    totalValueLocked: 0
  });
  const [connection, setConnection] = useState<Connection | null>(null);

  // Initialize Solana connection
  useEffect(() => {
    const conn = new Connection(clusterApiUrl(WalletAdapterNetwork.Devnet), "confirmed");
    setConnection(conn);
    console.log("Solana connection established to Devnet");
    
    // Load data
    fetchStakingData();
    
    // Listen for data sync events
    const handleSyncEvent = () => {
      fetchStakingData();
    };
    
    window.addEventListener('localStorageUpdated', handleSyncEvent);
    window.addEventListener('dataSynced', handleSyncEvent);
    
    return () => {
      window.removeEventListener('localStorageUpdated', handleSyncEvent);
      window.removeEventListener('dataSynced', handleSyncEvent);
    };
  }, []);

  // Calculate staking statistics
  const calculateStakingStatistics = useCallback(() => {
    try {
      let totalStaked = 0;
      let totalClaimed = 0;
      let totalUnstaked = 0;
      let pendingRewards = 0;
      
      // Calculate from stakers
      if (stakers.length > 0) {
        stakers.forEach(staker => {
          totalStaked += staker.totalStaked;
        });
      }
      
      // Calculate from completed transactions
      if (completedTransactions.length > 0) {
        completedTransactions.forEach(tx => {
          if (tx.status === "completed") {
            if (tx.type === "claim") {
              totalClaimed += tx.amount;
            } else if (tx.type === "unstake") {
              totalUnstaked += tx.amount;
            }
          }
        });
      }
      
      // Calculate pending rewards from pending claims
      if (pendingClaims.length > 0) {
        pendingClaims.forEach(claim => {
          pendingRewards += claim.amount;
        });
      }
      
      // Calculate average stake amount
      const avgStake = stakers.length > 0 ? totalStaked / stakers.length : 0;
      
      // Calculate total value locked (assuming 1 SOL = $40)
      const solToUsd = 40;
      const totalValueLocked = totalStaked * solToUsd;
      
      const newStats: StakingStats = {
        totalStaked,
        activeStakers: stakers.length,
        pendingRewards,
        avgStakeAmount: avgStake,
        totalClaimed,
        totalUnstaked,
        totalValueLocked
      };
      
      setStakingStats(newStats);
      return newStats;
      
    } catch (error) {
      console.error("Error calculating staking statistics:", error);
      return stakingStats;
    }
  }, [stakers, completedTransactions, pendingClaims, stakingStats]);

  // Fetch staking data using GlobalLoadingManager
  const fetchStakingData = useCallback(async () => {
    try {
      console.log("Fetching staking data...");
      
      // Get data using GlobalLoadingManager for cross-browser synchronization
      const parsedStakers = GlobalLoadingManager.getData<Staker[]>('stakers', []);
      const parsedClaims = GlobalLoadingManager.getData<ClaimRequest[]>('pendingClaims', []);
      const parsedUnstakes = GlobalLoadingManager.getData<UnstakeRequest[]>('pendingUnstakes', []);
      const parsedTransactions = GlobalLoadingManager.getData<Transaction[]>('completedTransactions', []);
      
      console.log("Staking data loaded:", {
        stakers: parsedStakers.length,
        claims: parsedClaims.length,
        unstakes: parsedUnstakes.length,
        transactions: parsedTransactions.length
      });
      
      // Calculate staking statistics after data is loaded
      setTimeout(() => {
        calculateStakingStatistics();
      }, 100);
      
    } catch (error) {
      console.error("Error fetching staking data:", error);
      toast({
        title: "Data Loading Error",
        description: "Failed to load staking data. Please refresh the page.",
        variant: "destructive"
      });
    }
  }, [toast, calculateStakingStatistics]);

  // Update staking APR
  const updateStakingApr = useCallback((newApr: number) => {
    if (newApr <= 0) {
      toast({
        title: "Invalid APR",
        description: "APR must be greater than 0",
        variant: "destructive"
      });
      return;
    }
    
    // Use GlobalLoadingManager for cross-browser synchronization
    GlobalLoadingManager.setData('stakingApr', newApr.toString());
    
    console.log("Staking APR updated to:", newApr);
    
    // Notify components
    window.dispatchEvent(new CustomEvent('aprUpdated', { 
      detail: { newApr } 
    }));
    
    return newApr;
  }, [toast]);

  // Approve a claim request
  const approveClaim = useCallback(async (id: string, txHash: string) => {
    try {
      if (!txHash || txHash.trim() === '') {
        toast({
          title: "Transaction Hash Required",
          description: "Please provide a valid transaction hash",
          variant: "destructive"
        });
        return;
      }
      
      // Find the claim request
      const claimRequest = pendingClaims.find(claim => claim.id === id);
      
      if (claimRequest) {
        console.log(`Approving claim ${id} with hash ${txHash}`);
        
        // Update pending claims
        const updatedClaims = pendingClaims.filter(claim => claim.id !== id);
        setPendingClaims(updatedClaims);
        
        // Add to completed transactions
        const newTransaction: Transaction = {
          id: `tx-${Date.now()}`,
          type: "claim",
          walletAddress: claimRequest.walletAddress,
          amount: claimRequest.amount,
          tokenSymbol: claimRequest.tokenSymbol,
          timestamp: new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }).replace(',', ''),
          status: "completed",
          txHash
        };
        
        const updatedTransactions = [newTransaction, ...completedTransactions];
        setCompletedTransactions(updatedTransactions);
        
        // Update staking stats
        setStakingStats(prev => ({
          ...prev,
          pendingRewards: prev.pendingRewards - claimRequest.amount
        }));
        
        // Update staker's claimed amount
        const updatedStakers = stakers.map(staker => 
          staker.walletAddress === claimRequest.walletAddress 
            ? {
                ...staker,
                totalClaimed: staker.totalClaimed + claimRequest.amount
              }
            : staker
        );
        
        setStakers(updatedStakers);
        
        // Update user's staking data using GlobalLoadingManager
        const userStakingKey = `staking_${claimRequest.walletAddress}`;
        const userData = GlobalLoadingManager.getData(userStakingKey, JSON.stringify({ 
          availableRewards: 0,
          totalClaimedRewards: 0
        }));
        
        let parsedUserData;
        try {
          parsedUserData = typeof userData === 'string' ? JSON.parse(userData) : userData;
        } catch (e) {
          parsedUserData = { availableRewards: 0, totalClaimedRewards: 0 };
        }
        
        parsedUserData.availableRewards = 0;
        parsedUserData.totalClaimedRewards = (parsedUserData.totalClaimedRewards || 0) + claimRequest.amount;
        GlobalLoadingManager.setData(userStakingKey, JSON.stringify(parsedUserData));
        
        toast({
          title: "Claim Approved",
          description: `Approved claim of ${claimRequest.amount.toLocaleString()} ${claimRequest.tokenSymbol} for ${formatWalletAddress(claimRequest.walletAddress)}`,
        });
      }
    } catch (error) {
      console.error("Error approving claim:", error);
      toast({
        title: "Approval Failed",
        description: "Failed to approve claim. Please try again.",
        variant: "destructive"
      });
    }
  }, [pendingClaims, completedTransactions, stakers, toast, setPendingClaims, setCompletedTransactions, setStakers]);
  
  // Approve an unstake request
  const approveUnstake = useCallback(async (id: string, txHash: string) => {
    try {
      if (!txHash || txHash.trim() === '') {
        toast({
          title: "Transaction Hash Required",
          description: "Please provide a valid transaction hash",
          variant: "destructive"
        });
        return;
      }
      
      // Find the unstake request
      const unstakeRequest = pendingUnstakes.find(unstake => unstake.id === id);
      
      if (unstakeRequest) {
        console.log(`Approving unstake ${id} with hash ${txHash}`);
        
        // Update pending unstakes
        const updatedUnstakes = pendingUnstakes.filter(unstake => unstake.id !== id);
        setPendingUnstakes(updatedUnstakes);
        
        // Add to completed transactions
        const newTransaction: Transaction = {
          id: `tx-${Date.now()}`,
          type: "unstake",
          walletAddress: unstakeRequest.walletAddress,
          amount: unstakeRequest.amount,
          tokenSymbol: unstakeRequest.tokenSymbol,
          timestamp: new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }).replace(',', ''),
          status: "completed",
          txHash
        };
        
        const updatedTransactions = [newTransaction, ...completedTransactions];
        setCompletedTransactions(updatedTransactions);
        
        // Update staking stats
        setStakingStats(prev => ({
          ...prev,
          totalStaked: Math.max(0, prev.totalStaked - unstakeRequest.amount),
          avgStakeAmount: prev.activeStakers > 1 
            ? (prev.totalStaked - unstakeRequest.amount) / (prev.activeStakers - 1)
            : 0
        }));
        
        // Update staker's staked amount or remove if fully unstaked
        let updatedStakers = stakers.map(staker => 
          staker.walletAddress === unstakeRequest.walletAddress 
            ? {
                ...staker,
                totalStaked: 0
              }
            : staker
        );
        
        // Filter out stakers who have 0 tokens staked
        updatedStakers = updatedStakers.filter(staker => staker.totalStaked > 0);
        
        setStakers(updatedStakers);
        
        // Update user's staking data using GlobalLoadingManager
        const userStakingKey = `staking_${unstakeRequest.walletAddress}`;
        const userData = GlobalLoadingManager.getData(userStakingKey, JSON.stringify({
          stakedAmount: 0,
          availableRewards: 0
        }));
        
        let parsedUserData;
        try {
          parsedUserData = typeof userData === 'string' ? JSON.parse(userData) : userData;
        } catch (e) {
          parsedUserData = { stakedAmount: 0, availableRewards: 0 };
        }
        
        parsedUserData.stakedAmount = 0;
        parsedUserData.availableRewards = 0;
        GlobalLoadingManager.setData(userStakingKey, JSON.stringify(parsedUserData));
        
        toast({
          title: "Unstake Approved",
          description: `Approved unstake of ${unstakeRequest.amount.toLocaleString()} ${unstakeRequest.tokenSymbol} for ${formatWalletAddress(unstakeRequest.walletAddress)}`,
        });
      }
    } catch (error) {
      console.error("Error approving unstake:", error);
      toast({
        title: "Approval Failed",
        description: "Failed to approve unstake. Please try again.",
        variant: "destructive"
      });
    }
  }, [pendingUnstakes, completedTransactions, stakers, toast, setPendingUnstakes, setCompletedTransactions, setStakers]);
  
  // Reject a request (claim or unstake)
  const rejectRequest = useCallback((id: string, requestType: "claim" | "unstake") => {
    try {
      if (requestType === "claim") {
        // Find the claim request
        const claimRequest = pendingClaims.find(claim => claim.id === id);
        
        if (claimRequest) {
          console.log(`Rejecting claim ${id}`);
          
          // Update pending claims
          const updatedClaims = pendingClaims.filter(claim => claim.id !== id);
          setPendingClaims(updatedClaims);
          
          // Add to completed transactions as rejected
          const newTransaction: Transaction = {
            id: `tx-${Date.now()}`,
            type: "claim",
            walletAddress: claimRequest.walletAddress,
            amount: claimRequest.amount,
            tokenSymbol: claimRequest.tokenSymbol,
            timestamp: new Date().toLocaleString('en-US', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            }).replace(',', ''),
            status: "rejected"
          };
          
          const updatedTransactions = [newTransaction, ...completedTransactions];
          setCompletedTransactions(updatedTransactions);
          
          // Return rewards to user's available balance using GlobalLoadingManager
          const userStakingKey = `staking_${claimRequest.walletAddress}`;
          const userData = GlobalLoadingManager.getData(userStakingKey, JSON.stringify({
            availableRewards: 0
          }));
          
          let parsedUserData;
          try {
            parsedUserData = typeof userData === 'string' ? JSON.parse(userData) : userData;
          } catch (e) {
            parsedUserData = { availableRewards: 0 };
          }
          
          parsedUserData.availableRewards = claimRequest.amount;
          GlobalLoadingManager.setData(userStakingKey, JSON.stringify(parsedUserData));
          
          toast({
            title: "Claim Rejected",
            description: `Rejected claim of ${claimRequest.amount.toLocaleString()} ${claimRequest.tokenSymbol} for ${formatWalletAddress(claimRequest.walletAddress)}`,
            variant: "destructive"
          });
        }
      } else if (requestType === "unstake") {
        // Find the unstake request
        const unstakeRequest = pendingUnstakes.find(unstake => unstake.id === id);
        
        if (unstakeRequest) {
          console.log(`Rejecting unstake ${id}`);
          
          // Update pending unstakes
          const updatedUnstakes = pendingUnstakes.filter(unstake => unstake.id !== id);
          setPendingUnstakes(updatedUnstakes);
          
          // Add to completed transactions as rejected
          const newTransaction: Transaction = {
            id: `tx-${Date.now()}`,
            type: "unstake",
            walletAddress: unstakeRequest.walletAddress,
            amount: unstakeRequest.amount,
            tokenSymbol: unstakeRequest.tokenSymbol,
            timestamp: new Date().toLocaleString('en-US', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            }).replace(',', ''),
            status: "rejected"
          };
          
          const updatedTransactions = [newTransaction, ...completedTransactions];
          setCompletedTransactions(updatedTransactions);
          
          toast({
            title: "Unstake Rejected",
            description: `Rejected unstake of ${unstakeRequest.amount.toLocaleString()} ${unstakeRequest.tokenSymbol} for ${formatWalletAddress(unstakeRequest.walletAddress)}`,
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast({
        title: "Rejection Failed",
        description: "Failed to reject request. Please try again.",
        variant: "destructive"
      });
    }
  }, [pendingClaims, pendingUnstakes, completedTransactions, toast, setPendingClaims, setPendingUnstakes, setCompletedTransactions]);

  // Helper function to format wallet address
  const formatWalletAddress = (address: string, length = 6) => {
    if (!address) return '';
    return `${address.substring(0, length)}...${address.substring(address.length - 4)}`;
  };

  return {
    stakers,
    pendingClaims,
    pendingUnstakes,
    completedTransactions,
    stakingStats,
    approveClaim,
    approveUnstake,
    rejectRequest,
    updateStakingApr,
    calculateStakingStatistics,
    fetchStakingData  // Export this function to allow manual data refreshes
  };
}
