import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { getSolanaBalance } from '@/utils/solana-utils';
import { toast } from 'sonner';

/**
 * Hook to fetch and track a wallet's SOL balance
 */
export const useWalletBalance = (publicKey: PublicKey | null) => {
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    
    const getBalance = async () => {
      if (publicKey) {
        try {
          console.log(`Checking SOL balance for wallet: ${publicKey.toString()}`);
          const solBalance = await getSolanaBalance(publicKey.toString());
          
          console.log(`Updated wallet SOL balance: ${solBalance} SOL`);
          if (isMounted) {
            setBalance(solBalance);
            setIsLoading(false);
          }
        } catch (err) {
          console.error('Error getting wallet SOL balance:', err);
          if (isMounted) {
            toast.error("Failed to fetch SOL balance", {
              description: "Could not connect to Solana network"
            });
            setBalance(0);
            setIsLoading(false);
          }
        }
      } else {
        if (isMounted) {
          console.log("No wallet connected, setting balance to 0");
          setBalance(0);
          setIsLoading(false);
        }
      }
    };

    getBalance();
    
    // Set up an interval to refresh the balance
    const intervalId = setInterval(getBalance, 30000); // every 30 seconds
    
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [publicKey]);

  return { balance, isLoading };
};
