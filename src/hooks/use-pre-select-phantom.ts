
import { useEffect } from 'react';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';

/**
 * Hook to pre-select the Phantom wallet when the app loads
 */
export const usePreSelectPhantom = () => {
  const { select, wallet, wallets } = useSolanaWallet();

  useEffect(() => {
    const preSelectPhantomWallet = async () => {
      try {
        const phantomWallet = wallets.find(w => w.adapter.name === 'Phantom');
        if (phantomWallet && !wallet) {
          console.log("Pre-selecting Phantom wallet...");
          await select(phantomWallet.adapter.name);
        }
      } catch (error) {
        console.error("Error pre-selecting Phantom wallet:", error);
      }
    };
    
    preSelectPhantomWallet();
  }, [select, wallet, wallets]);
};
