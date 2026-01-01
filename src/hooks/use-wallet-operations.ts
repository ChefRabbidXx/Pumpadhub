
import { useCallback } from 'react';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { useToast } from '@/hooks/use-toast';
import { isPhantomInstalled } from '@/utils/wallet-utils';

/**
 * Hook to provide wallet connection and disconnection methods
 */
export const useWalletOperations = () => {
  const { 
    connected, 
    connecting, 
    disconnecting,
    select,
    wallet,
    wallets,
    connect,
    disconnect
  } = useSolanaWallet();
  const { toast } = useToast();

  // Connect wallet handler
  const connectWallet = useCallback(async () => {
    if (!connected && !connecting) {
      try {
        console.log("Attempting to connect wallet...");
        
        // Check if Phantom is available in the browser
        if (!isPhantomInstalled()) {
          throw new Error("Phantom wallet not detected. Please install the Phantom wallet extension.");
        }
        
        // Try to connect directly - the wallet should already be pre-selected
        await connect();
        
        toast({
          title: "Wallet Connected",
          description: "Your wallet has been connected successfully.",
        });
      } catch (error: any) {
        console.error("Error connecting wallet:", error);
        
        let errorMessage = "Failed to connect wallet. Please try again.";
        
        // If connection failed, try to select and connect again
        if (error.name === "WalletNotSelectedError") {
          try {
            // Explicitly select Phantom again
            const phantomWallet = wallets.find(w => w.adapter.name === 'Phantom');
            if (phantomWallet) {
              await select(phantomWallet.adapter.name);
              // Small delay to ensure selection is processed
              await new Promise(resolve => setTimeout(resolve, 150));
              // Try connecting again
              await connect();
              
              toast({
                title: "Wallet Connected",
                description: "Your wallet has been connected successfully.",
              });
              
              return;
            }
          } catch (retryError) {
            console.error("Error during retry:", retryError);
            errorMessage = "Please make sure Phantom wallet is installed and try again.";
          }
        } else if (error.name === "WalletNotFoundError" || !wallets.length) {
          errorMessage = "Phantom wallet not found. Please install the Phantom wallet extension.";
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        toast({
          title: "Connection Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    }
  }, [connected, connecting, connect, select, toast, wallets]);

  // Disconnect wallet handler with localStorage cleanup
  const disconnectWallet = useCallback(async () => {
    if (connected && !disconnecting) {
      try {
        console.log("Attempting to disconnect wallet...");
        
        // First perform the disconnect operation
        await disconnect();
        
        // Clear wallet-specific localStorage data
        if (wallet && wallet.adapter.publicKey) {
          const walletAddress = wallet.adapter.publicKey.toString();
          console.log("Cleaning up localStorage data for wallet:", walletAddress);
          
          // Clean up localStorage wallet data when disconnecting
          const userStakingKey = `staking_${walletAddress}`;
          const joinedPoolsKey = `joinedPools_${walletAddress}`;
          
          localStorage.removeItem(userStakingKey);
          localStorage.removeItem(joinedPoolsKey);
        }
        
        // Display success toast
        toast({
          title: "Wallet Disconnected",
          description: "Your wallet has been disconnected.",
        });
      } catch (error) {
        console.error("Error disconnecting wallet:", error);
        toast({
          title: "Disconnection Failed",
          description: "Failed to disconnect wallet. Please try again.",
          variant: "destructive",
        });
      }
    }
  }, [connected, disconnecting, disconnect, toast, wallet]);

  return {
    connectWallet,
    disconnectWallet
  };
};
