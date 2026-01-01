import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { toast } from "sonner";
import { formatSolAmount, simulateTransaction, recordTransaction, sendSolanaTransaction, getSolanaBalance } from '../utils/solana-utils';
import { PublicKey } from '@solana/web3.js';
import { TransactionLoading } from '@/components/wallet/TransactionLoading';
import { WalletSelectModal } from '@/components/wallet/WalletSelectModal';

export interface JoinedPool {
  id: string;
  tokenName: string;
  tokenSymbol: string;
  depositAmount: number;
  poolSize?: number;
  tokenLogo?: string;
  walletAddress?: string;
  poolStatus?: 'active' | 'ended' | 'cancelled';
  createdAt?: string;
  endDate?: string;
}

interface WalletOption {
  name: string;
  icon: string;
  provider: any;
  installed: boolean;
}

interface WalletContextType {
  connected: boolean;
  connecting: boolean;
  walletAddress: string | null;
  balance: number;
  publicKey: PublicKey | null;
  joinedPools: JoinedPool[];
  isConfirmingTransaction: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  formatAddress: (address: string | null) => string;
  isPoolJoined: (poolId: string) => boolean;
  joinPool: (poolData: any, depositAmount: number) => void;
  withdrawFromPool: (poolId: string, withdrawAmount: number) => void;
  sendSolTransaction: (amount: number, recipient: string) => Promise<boolean>;
  updateRewards: () => void;
  lastRewardUpdate: Date | null;
  nextRewardTime: Date | null;
  wallet: any;
  getPumpHoldings: (symbol: string) => number;
  connectedWalletName: string | null;
}

const WalletContext = createContext<WalletContextType>({
  connected: false,
  connecting: false,
  walletAddress: null,
  balance: 0,
  publicKey: null,
  joinedPools: [],
  isConfirmingTransaction: false,
  connectWallet: async () => {},
  disconnectWallet: () => {},
  formatAddress: () => '',
  isPoolJoined: () => false,
  joinPool: () => {},
  withdrawFromPool: () => {},
  sendSolTransaction: async () => false,
  updateRewards: () => {},
  lastRewardUpdate: null,
  nextRewardTime: null,
  wallet: null,
  getPumpHoldings: () => 0,
  connectedWalletName: null,
});

// Get all wallet options (installed or not)
const getAllWalletOptions = (): WalletOption[] => {
  const wallets: WalletOption[] = [];
  
  // Phantom
  const phantomInstalled = !!(window?.phantom?.solana?.isPhantom);
  wallets.push({ 
    name: 'Phantom', 
    provider: phantomInstalled ? window.phantom.solana : null, 
    icon: '👻',
    installed: phantomInstalled 
  });
  
  // Solflare
  const solflareInstalled = !!((window as any)?.solflare?.isSolflare);
  wallets.push({ 
    name: 'Solflare', 
    provider: solflareInstalled ? (window as any).solflare : null, 
    icon: '🔆',
    installed: solflareInstalled 
  });
  
  // Backpack
  const backpackInstalled = !!((window as any)?.backpack?.isBackpack);
  wallets.push({ 
    name: 'Backpack', 
    provider: backpackInstalled ? (window as any).backpack : null, 
    icon: '🎒',
    installed: backpackInstalled 
  });
  
  // Glow
  const glowInstalled = !!((window as any)?.glow?.solana);
  wallets.push({ 
    name: 'Glow', 
    provider: glowInstalled ? (window as any).glow.solana : null, 
    icon: '✨',
    installed: glowInstalled 
  });
  
  return wallets;
};

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [balance, setBalance] = useState(0);
  const [joinedPools, setJoinedPools] = useState<JoinedPool[]>([]);
  const [isConfirmingTransaction, setIsConfirmingTransaction] = useState(false);
  const [lastRewardUpdate, setLastRewardUpdate] = useState<Date | null>(null);
  const [nextRewardTime, setNextRewardTime] = useState<Date | null>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [activeProvider, setActiveProvider] = useState<any>(null);
  const [connectedWalletName, setConnectedWalletName] = useState<string | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletOptions, setWalletOptions] = useState<WalletOption[]>([]);

  const updateBalance = useCallback(async (address: string) => {
    try {
      const solBalance = await getSolanaBalance(address);
      if (solBalance !== null && !isNaN(solBalance)) {
        setBalance(solBalance);
        window.dispatchEvent(new CustomEvent('walletBalanceUpdated', { detail: { balance: solBalance } }));
      }
    } catch (error) {
      console.error("Error updating SOL balance:", error);
      setBalance(0);
    }
  }, []);

  // Load saved wallet on mount
  useEffect(() => {
    const savedWallet = localStorage.getItem('walletAddress');
    const savedWalletName = localStorage.getItem('connectedWalletName');
    
    if (savedWallet) {
      setWalletAddress(savedWallet);
      setConnectedWalletName(savedWalletName);
      try {
        setPublicKey(new PublicKey(savedWallet));
        setConnected(true);
        updateBalance(savedWallet);
        
        const savedPools = localStorage.getItem(`joinedPools_${savedWallet}`);
        if (savedPools) setJoinedPools(JSON.parse(savedPools));
        
        // Try to reconnect to the same wallet provider
        if (savedWalletName) {
          const wallets = getAllWalletOptions();
          const savedWalletOption = wallets.find(w => w.name === savedWalletName && w.installed);

          // If the previously connected wallet is no longer available, clear the stale session
          if (!savedWalletOption?.provider) {
            setConnected(false);
            setWalletAddress(null);
            setConnectedWalletName(null);
            setPublicKey(null);
            localStorage.removeItem('walletAddress');
            localStorage.removeItem('connectedWalletName');
            return;
          }

          setActiveProvider(savedWalletOption.provider);
          setWallet({
            address: savedWallet,
            publicKey: new PublicKey(savedWallet),
            signTransaction: savedWalletOption.provider.signTransaction?.bind(savedWalletOption.provider),
            signAllTransactions: savedWalletOption.provider.signAllTransactions?.bind(savedWalletOption.provider)
          });
        }
      } catch (error) {
        localStorage.removeItem('walletAddress');
        localStorage.removeItem('connectedWalletName');
      }
    }
  }, [updateBalance]);

  // Balance update interval
  useEffect(() => {
    if (!walletAddress) return;
    const interval = setInterval(() => updateBalance(walletAddress), 30000);
    return () => clearInterval(interval);
  }, [walletAddress, updateBalance]);

  const connectWallet = async () => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      // On mobile, try to detect installed wallet or redirect to Phantom app
      const wallets = getAllWalletOptions();
      const installedWallet = wallets.find(w => w.installed);
      
      if (installedWallet) {
        await handleWalletSelect(installedWallet);
      } else {
        // Redirect to Phantom mobile browser
        const currentUrl = encodeURIComponent(window.location.href);
        window.location.href = `https://phantom.app/ul/browse/${currentUrl}`;
      }
      return;
    }
    
    // On desktop, show wallet selection modal
    const wallets = getAllWalletOptions();
    setWalletOptions(wallets);
    setShowWalletModal(true);
  };

  const handleWalletSelect = async (selectedWallet: WalletOption) => {
    if (!selectedWallet.installed || !selectedWallet.provider) {
      return;
    }
    
    setShowWalletModal(false);
    setConnecting(true);
    
    try {
      const provider = selectedWallet.provider;

      if (!provider?.connect && !provider?.publicKey) {
        throw new Error(`${selectedWallet.name} provider not available`);
      }

      // Connect to the selected wallet - different wallets return publicKey differently
      // Some wallets (especially Phantom) may already be connected; in that case, avoid calling connect() again.
      let pubKey: PublicKey | null = null;

      const providerHasKeyAlready = !!provider?.publicKey;
      const providerIsConnected = !!(provider?.isConnected || provider?.connected);

      if (providerHasKeyAlready && providerIsConnected) {
        pubKey = provider.publicKey;
      } else {
        if (selectedWallet.name === 'Solflare') {
          // Solflare: connect() returns void, publicKey is available on provider after connect
          await provider.connect();
          pubKey = provider.publicKey;
        } else if (selectedWallet.name === 'Backpack') {
          // Backpack: similar to Phantom
          const response = await provider.connect();
          pubKey = response?.publicKey || provider.publicKey;
        } else if (selectedWallet.name === 'Glow') {
          // Glow: returns publicKey in response
          const response = await provider.connect();
          pubKey = response?.publicKey || provider.publicKey;
        } else {
          // Phantom and others: returns { publicKey } from connect()
          const response = await provider.connect();
          pubKey = response?.publicKey || provider.publicKey;
        }
      }

      // Fallback: check if publicKey is directly on provider
      if (!pubKey && provider.publicKey) {
        pubKey = provider.publicKey;
      }

      if (!pubKey) throw new Error("Failed to get public key from wallet");
      
      const address = pubKey.toString();
      setWalletAddress(address);
      setPublicKey(pubKey);
      setConnected(true);
      setActiveProvider(provider);
      setConnectedWalletName(selectedWallet.name);
      setWallet({ 
        address, 
        publicKey: pubKey, 
        signTransaction: provider.signTransaction?.bind(provider), 
        signAllTransactions: provider.signAllTransactions?.bind(provider) 
      });
      
      localStorage.setItem('walletAddress', address);
      localStorage.setItem('connectedWalletName', selectedWallet.name);
      await updateBalance(address);
      
      toast.success(`${selectedWallet.name} Connected`, { 
        description: `${address.slice(0, 4)}...${address.slice(-4)}` 
      });
    } catch (error: any) {
      console.error("Connection error:", error);
      if (!error.message?.includes("User rejected")) {
        toast.error("Connection Failed", { description: error.message || "Could not connect" });
      }
    } finally {
      setConnecting(false);
    }
  };

  const disconnectWallet = async () => {
    try {
      if (activeProvider?.disconnect) await activeProvider.disconnect();
    } catch (e) {}
    
    setConnected(false);
    setWalletAddress(null);
    setPublicKey(null);
    setBalance(0);
    setJoinedPools([]);
    setWallet(null);
    setActiveProvider(null);
    setConnectedWalletName(null);
    localStorage.removeItem('walletAddress');
    localStorage.removeItem('connectedWalletName');
    toast.success("Wallet Disconnected");
  };

  const formatAddress = (address: string | null) => {
    if (!address) return '';
    return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
  };

  const isPoolJoined = (poolId: string) => joinedPools.some(pool => pool.id === poolId || pool.tokenSymbol === poolId);

  const joinPool = (poolData: any, depositAmount: number) => {
    if (!connected || !walletAddress) {
      toast.error("Wallet not connected");
      return;
    }
    
    const poolEntry: JoinedPool = {
      id: poolData.id,
      tokenName: poolData.tokenName || poolData.name,
      tokenSymbol: poolData.tokenSymbol || poolData.symbol,
      depositAmount,
      poolSize: poolData.poolSize || 10000000,
      tokenLogo: poolData.logo,
      walletAddress
    };
    
    const updatedPools = [...joinedPools, poolEntry];
    setJoinedPools(updatedPools);
    localStorage.setItem(`joinedPools_${walletAddress}`, JSON.stringify(updatedPools));
    
    setIsConfirmingTransaction(true);
    simulateTransaction(depositAmount, walletAddress, "SHARE", "stake", true)
      .then(result => {
        if (result.success) {
          recordTransaction(walletAddress, "stake", depositAmount, result.txHash, "SHARE");
          window.dispatchEvent(new Event('joinedPoolsUpdated'));
          updateBalance(walletAddress);
        }
      })
      .finally(() => setIsConfirmingTransaction(false));
  };

  const withdrawFromPool = (poolId: string, withdrawAmount: number) => {
    if (!connected || !walletAddress) return;
    
    const pool = joinedPools.find(p => p.id === poolId);
    if (!pool) return;
    
    const updatedPools = joinedPools.filter(p => p.id !== poolId);
    setJoinedPools(updatedPools);
    localStorage.setItem(`joinedPools_${walletAddress}`, JSON.stringify(updatedPools));
    
    if (withdrawAmount === 0 || withdrawAmount >= pool.depositAmount) {
      setIsConfirmingTransaction(true);
      simulateTransaction(pool.depositAmount, walletAddress, "SHARE", "unstake", true)
        .then(result => {
          if (result.success) recordTransaction(walletAddress, "unstake", pool.depositAmount, result.txHash, "SHARE");
        })
        .finally(() => setIsConfirmingTransaction(false));
    }
    
    window.dispatchEvent(new Event('joinedPoolsUpdated'));
  };

  const sendSolTransaction = async (amount: number, recipient: string): Promise<boolean> => {
    if (!connected || !walletAddress) {
      toast.error("Wallet not connected");
      return false;
    }

    setIsConfirmingTransaction(true);
    try {
      const result = await sendSolanaTransaction(wallet, recipient, amount);
      if (result.success) {
        setTimeout(() => updateBalance(walletAddress), 1000);
        toast.success("Transaction successful", { description: `Sent ${amount} SOL` });
        recordTransaction(walletAddress, "stake", amount, result.txHash, "SOL");
        return true;
      }
      toast.error("Transaction failed", { description: result.message });
      return false;
    } catch (error: any) {
      toast.error("Transaction error", { description: error.message });
      return false;
    } finally {
      setIsConfirmingTransaction(false);
    }
  };

  const updateRewards = () => {
    setLastRewardUpdate(new Date());
    const next = new Date();
    next.setHours(next.getHours() + 24);
    setNextRewardTime(next);
  };

  const getPumpHoldings = () => 1000;

  return (
    <WalletContext.Provider value={{
      connected, connecting, walletAddress, balance, publicKey, joinedPools, isConfirmingTransaction,
      connectWallet, disconnectWallet, formatAddress, isPoolJoined, joinPool, withdrawFromPool,
      sendSolTransaction, updateRewards, lastRewardUpdate, nextRewardTime, wallet, getPumpHoldings,
      connectedWalletName,
    }}>
      {children}
      <TransactionLoading isVisible={isConfirmingTransaction} />
      <WalletSelectModal
        open={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        onSelect={handleWalletSelect}
        wallets={walletOptions}
      />
    </WalletContext.Provider>
  );
};

export const useWallet = () => useContext(WalletContext);
