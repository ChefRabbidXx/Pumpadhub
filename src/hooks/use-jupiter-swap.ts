import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useWallet } from '@/contexts/WalletContext';
import { supabase } from '@/integrations/supabase/client';
import { VersionedTransaction } from '@solana/web3.js';

// Token mint addresses
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const PUMPAD_MINT = '2FWWHi5NLVj6oXkAyWAtqjBZ6CNRCX8QM8yUtRVNpump';

export interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  routePlan: any[];
}

interface SwapResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

export const useJupiterSwap = () => {
  const { connected, walletAddress, wallet, connectedWalletName } = useWallet();
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<JupiterQuote | null>(null);

  // Get quote from Jupiter
  const getQuote = useCallback(async (
    inputMint: string,
    outputMint: string,
    amount: number,
    decimals: number = 9,
    slippageBps: number = 50
  ): Promise<JupiterQuote | null> => {
    if (!amount || amount <= 0) return null;

    setLoading(true);
    try {
      const amountInSmallestUnit = Math.floor(amount * Math.pow(10, decimals));
      
      console.log('Getting Jupiter quote:', { inputMint, outputMint, amount, amountInSmallestUnit });

      const { data, error } = await supabase.functions.invoke('jupiter-swap', {
        body: {
          action: 'quote',
          inputMint,
          outputMint,
          amount: amountInSmallestUnit,
          slippageBps,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      console.log('Quote received:', data.quote);
      setQuote(data.quote);
      return data.quote;
    } catch (error: any) {
      console.error('Quote error:', error);
      setQuote(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Execute swap
  const executeSwap = useCallback(async (quoteResponse: JupiterQuote): Promise<SwapResult> => {
    if (!connected || !walletAddress || !wallet) {
      toast.error('Wallet not connected');
      return { success: false, error: 'Wallet not connected' };
    }

    if (!quoteResponse) {
      toast.error('No quote available');
      return { success: false, error: 'No quote available' };
    }

    // Currently only Phantom supported for swaps
    if (connectedWalletName && connectedWalletName !== 'Phantom') {
      toast.error('Please connect Phantom wallet to swap');
      return { success: false, error: 'Please connect Phantom to swap' };
    }

    const provider = window?.phantom?.solana;
    if (!provider?.isPhantom) {
      toast.error('Phantom wallet not detected');
      return { success: false, error: 'Phantom wallet not detected' };
    }

    setLoading(true);
    try {
      console.log('Executing swap for wallet:', walletAddress);

      // Ensure Phantom is connected
      if (!(provider as any).publicKey) {
        console.log('Connecting Phantom...');
        await provider.connect();
      }

      // Get swap transaction from edge function
      const { data, error } = await supabase.functions.invoke('jupiter-swap', {
        body: {
          action: 'swap',
          inputMint: quoteResponse.inputMint,
          outputMint: quoteResponse.outputMint,
          amount: quoteResponse.inAmount,
          userPublicKey: walletAddress,
          slippageBps: quoteResponse.slippageBps || 50,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      const { swapTransaction } = data;

      if (!swapTransaction || typeof swapTransaction !== 'string') {
        throw new Error('No swap transaction received');
      }

      // Decode base64 to bytes (avoid Buffer inconsistencies in browsers)
      const raw = atob(swapTransaction);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

      const versionedTx = VersionedTransaction.deserialize(bytes);

      // Basic sanity check – empty tx often indicates a bad decode
      const ixCount = (versionedTx as any)?.message?.compiledInstructions?.length ?? 0;
      console.log('Swap tx decoded', { ixCount });
      if (!ixCount) {
        throw new Error('Decoded an empty transaction (please retry)');
      }

      // Sign and send the transaction using Phantom
      console.log('Requesting Phantom to sign and send transaction...');
      const result = await provider.signAndSendTransaction(versionedTx as any);
      const signature = result.signature;

      console.log('Transaction sent:', signature);
      toast.success('Swap successful!', {
        description: `Transaction: ${signature.slice(0, 8)}...`,
      });

      return { success: true, txHash: signature };
    } catch (error: any) {
      console.error('Swap error:', error);
      const errorMessage = error.message || 'Swap failed';

      if (
        errorMessage.toLowerCase().includes('user rejected') ||
        errorMessage.toLowerCase().includes('rejected the request')
      ) {
        toast.info('Transaction cancelled');
        return { success: false, error: 'Transaction cancelled by user' };
      }

      toast.error('Swap failed', { description: errorMessage });
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [connected, walletAddress, wallet, connectedWalletName]);

  // Helper to get SOL -> PUMPAD quote
  const getSOLToPumpadQuote = useCallback(async (solAmount: number, slippageBps: number = 50) => {
    return getQuote(SOL_MINT, PUMPAD_MINT, solAmount, 9, slippageBps);
  }, [getQuote]);

  // Helper to get PUMPAD -> SOL quote
  const getPumpadToSOLQuote = useCallback(async (pumpadAmount: number, slippageBps: number = 50) => {
    return getQuote(PUMPAD_MINT, SOL_MINT, pumpadAmount, 6, slippageBps);
  }, [getQuote]);

  // Format output amount from quote
  const formatOutputAmount = useCallback((quoteData: JupiterQuote | null, outputDecimals: number = 6): string => {
    if (!quoteData) return '0';
    const amount = parseInt(quoteData.outAmount) / Math.pow(10, outputDecimals);
    return amount.toLocaleString(undefined, { maximumFractionDigits: 6 });
  }, []);

  return {
    loading,
    quote,
    getQuote,
    executeSwap,
    getSOLToPumpadQuote,
    getPumpadToSOLQuote,
    formatOutputAmount,
    SOL_MINT,
    PUMPAD_MINT,
  };
};