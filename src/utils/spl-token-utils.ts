import { 
  PublicKey, 
  Transaction
} from '@solana/web3.js';
import {
  createTransferInstruction,
  createBurnInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { supabase } from "@/integrations/supabase/client";

export interface TokenTransferResult {
  success: boolean;
  txHash: string;
  message?: string;
}

import { HELIUS_RPC_URL, FALLBACK_RPCS } from './rpc-config';

// Fallback public RPCs - Helius is primary
const PUBLIC_RPCS = [
  HELIUS_RPC_URL,
  ...FALLBACK_RPCS
];

/**
 * Delay helper for retry logic
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Make RPC call with retry and fallback logic
 */
const rpcCall = async (method: string, params: any[] = [], retries = 3): Promise<any> => {
  let lastError: Error | null = null;
  
  // Try edge function first with retries
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke('solana-rpc', {
        body: { method, params }
      });
      
      if (error) throw error;
      
      // Check for rate limit error
      if (data.error) {
        const errorCode = data.error.code;
        const errorMessage = data.error.message || JSON.stringify(data.error);
        
        // If rate limited, wait and retry or fallback
        if (errorCode === -32429 || errorMessage.includes('rate limit')) {
          console.log(`Rate limited on attempt ${attempt + 1}, waiting before retry...`);
          await delay(1000 * (attempt + 1)); // Exponential backoff
          continue;
        }
        
        throw new Error(errorMessage);
      }
      
      return data.result;
    } catch (err: any) {
      console.log(`Edge function RPC attempt ${attempt + 1} failed:`, err.message);
      lastError = err;
      
      if (attempt < retries - 1) {
        await delay(500 * (attempt + 1));
      }
    }
  }
  
  // Fallback to public RPCs
  console.log("All edge function attempts failed, trying public RPCs...");
  
  for (const rpcUrl of PUBLIC_RPCS) {
    try {
      console.log(`Trying public RPC: ${rpcUrl}`);
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method,
          params
        })
      });
      
      const data = await response.json();
      
      if (data.error) {
        console.log(`Public RPC ${rpcUrl} error:`, data.error);
        continue;
      }
      
      return data.result;
    } catch (err: any) {
      console.log(`Public RPC ${rpcUrl} failed:`, err.message);
    }
  }
  
  throw lastError || new Error('All RPC endpoints failed');
};

/**
 * Detect which token program a mint uses (Token or Token-2022)
 */
const getTokenProgramForMint = async (mintAddress: string): Promise<PublicKey> => {
  try {
    const accountInfo = await rpcCall('getAccountInfo', [mintAddress, { encoding: 'base64' }]);
    
    if (accountInfo?.value?.owner) {
      const owner = accountInfo.value.owner;
      console.log("Mint owner program:", owner);
      
      if (owner === TOKEN_2022_PROGRAM_ID.toString()) {
        console.log("Using Token-2022 program");
        return TOKEN_2022_PROGRAM_ID;
      }
    }
    
    console.log("Using legacy Token program");
    return TOKEN_PROGRAM_ID;
  } catch (error) {
    console.error("Error detecting token program:", error);
    return TOKEN_PROGRAM_ID;
  }
};

/**
 * Get token account for a wallet address
 */
export const getTokenAccount = async (
  walletAddress: string,
  mintAddress: string
): Promise<PublicKey | null> => {
  try {
    const wallet = new PublicKey(walletAddress);
    const mint = new PublicKey(mintAddress);
    const tokenProgram = await getTokenProgramForMint(mintAddress);
    
    const associatedTokenAddress = await getAssociatedTokenAddress(
      mint,
      wallet,
      false,
      tokenProgram,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    return associatedTokenAddress;
  } catch (error) {
    console.error("Error getting token account:", error);
    return null;
  }
};

/**
 * Send SPL tokens from user wallet to recipient
 */
export const sendSplTokenTransaction = async (
  wallet: any,
  mintAddress: string,
  recipientAddress: string,
  amount: number,
  decimals: number = 6
): Promise<TokenTransferResult> => {
  try {
    if (!wallet?.publicKey) {
      return { success: false, txHash: '', message: 'Wallet not connected' };
    }

    const provider = window?.phantom?.solana;
    if (!provider?.isPhantom) {
      return { success: false, txHash: '', message: 'Phantom wallet not found' };
    }

    const senderPublicKey = new PublicKey(wallet.publicKey.toString());
    const recipientPublicKey = new PublicKey(recipientAddress);
    const mintPublicKey = new PublicKey(mintAddress);

    // Detect token program (Token or Token-2022)
    const tokenProgram = await getTokenProgramForMint(mintAddress);
    console.log("Token program:", tokenProgram.toString());

    // Get associated token addresses with correct program
    const senderATA = await getAssociatedTokenAddress(
      mintPublicKey,
      senderPublicKey,
      false,
      tokenProgram,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const recipientATA = await getAssociatedTokenAddress(
      mintPublicKey,
      recipientPublicKey,
      false,
      tokenProgram,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    console.log("Preparing SPL token transfer...");
    console.log("Mint:", mintAddress);
    console.log("Token Program:", tokenProgram.toString());
    console.log("Sender:", senderPublicKey.toString());
    console.log("Sender ATA:", senderATA.toString());
    console.log("Recipient ATA:", recipientATA.toString());
    console.log("Amount:", amount, "Decimals:", decimals);

    // Get latest blockhash
    const blockhashResult = await rpcCall('getLatestBlockhash', [{ commitment: 'confirmed' }]);
    const blockhash = blockhashResult.value.blockhash;
    console.log("Got blockhash:", blockhash);

    // Check if recipient ATA exists
    const recipientAccountInfo = await rpcCall('getAccountInfo', [recipientATA.toString(), { encoding: 'base64' }]);
    const recipientATAExists = recipientAccountInfo?.value !== null;
    console.log("Recipient ATA exists:", recipientATAExists);

    // Calculate the raw amount based on decimals
    const rawAmount = BigInt(Math.floor(amount * Math.pow(10, decimals)));
    console.log("Raw amount (BigInt):", rawAmount.toString());

    // Create transaction
    const transaction = new Transaction();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = senderPublicKey;

    // Add create ATA instruction if recipient doesn't have token account
    if (!recipientATAExists) {
      console.log("Adding create ATA instruction for recipient...");
      transaction.add(
        createAssociatedTokenAccountInstruction(
          senderPublicKey,      // payer
          recipientATA,          // ata
          recipientPublicKey,    // owner
          mintPublicKey,         // mint
          tokenProgram,          // Use correct token program!
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }

    // Add the token transfer instruction with correct program
    console.log("Adding transfer instruction...");
    transaction.add(
      createTransferInstruction(
        senderATA,              // source
        recipientATA,           // destination
        senderPublicKey,        // owner
        rawAmount,              // amount as BigInt
        [],                     // multiSigners
        tokenProgram            // Use correct token program!
      )
    );

    console.log("Transaction has", transaction.instructions.length, "instructions");
    transaction.instructions.forEach((ix, i) => {
      console.log(`Instruction ${i}: Program ${ix.programId.toString()}`);
    });

    // Sign transaction using Phantom
    console.log("Requesting Phantom to sign transaction...");
    const signedTransaction = await provider.signTransaction(transaction);
    
    // Serialize and send
    console.log("Sending signed transaction...");
    const rawTransaction = signedTransaction.serialize();
    const base64Tx = Buffer.from(rawTransaction).toString('base64');
    
    const sendResult = await rpcCall('sendTransaction', [base64Tx, {
      encoding: 'base64',
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    }]);
    
    const signature = sendResult;
    console.log("Transaction sent! Signature:", signature);

    // Wait for confirmation
    console.log("Waiting for confirmation...");
    let confirmed = false;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const status = await rpcCall('getSignatureStatuses', [[signature]]);
      const confirmationStatus = status?.value?.[0]?.confirmationStatus;
      
      if (confirmationStatus === 'confirmed' || confirmationStatus === 'finalized') {
        confirmed = true;
        break;
      }
      
      if (status?.value?.[0]?.err) {
        console.error("Transaction failed:", status.value[0].err);
        return { success: false, txHash: signature, message: 'Transaction failed on chain' };
      }
      
      console.log(`Confirmation attempt ${i + 1}/30...`);
    }

    if (!confirmed) {
      return { success: false, txHash: signature, message: 'Transaction not confirmed in time' };
    }

    console.log("Transaction confirmed!");
    return { success: true, txHash: signature };

  } catch (error: any) {
    console.error("SPL Token transfer error:", error);
    
    if (error.message?.includes('User rejected') || error.message?.includes('rejected')) {
      return { success: false, txHash: '', message: 'Transaction rejected by user' };
    }
    
    if (error.message?.includes('insufficient') || error.message?.includes('Insufficient')) {
      return { success: false, txHash: '', message: 'Insufficient token balance' };
    }

    if (error.message?.includes('0x1')) {
      return { success: false, txHash: '', message: 'Insufficient token balance for this transfer' };
    }
    
    return { 
      success: false, 
      txHash: '', 
      message: error.message || 'Token transfer failed' 
    };
  }
};

/**
 * Burn SPL tokens - permanently destroys tokens
 */
export const burnSplTokens = async (
  wallet: any,
  mintAddress: string,
  amount: number,
  decimals: number = 6
): Promise<TokenTransferResult> => {
  try {
    if (!wallet?.publicKey) {
      return { success: false, txHash: '', message: 'Wallet not connected' };
    }

    const provider = window?.phantom?.solana;
    if (!provider?.isPhantom) {
      return { success: false, txHash: '', message: 'Phantom wallet not found' };
    }

    const ownerPublicKey = new PublicKey(wallet.publicKey.toString());
    const mintPublicKey = new PublicKey(mintAddress);

    // Detect token program
    const tokenProgram = await getTokenProgramForMint(mintAddress);
    console.log("Token program for burn:", tokenProgram.toString());

    const tokenAccount = await getAssociatedTokenAddress(
      mintPublicKey,
      ownerPublicKey,
      false,
      tokenProgram,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    console.log("Preparing SPL token burn...");
    console.log("Mint:", mintAddress);
    console.log("Token Program:", tokenProgram.toString());
    console.log("Owner:", ownerPublicKey.toString());
    console.log("Token Account:", tokenAccount.toString());
    console.log("Amount:", amount, "Decimals:", decimals);

    const blockhashResult = await rpcCall('getLatestBlockhash', [{ commitment: 'confirmed' }]);
    const blockhash = blockhashResult.value.blockhash;
    console.log("Got blockhash:", blockhash);

    const rawAmount = BigInt(Math.floor(amount * Math.pow(10, decimals)));
    console.log("Raw amount to burn (BigInt):", rawAmount.toString());

    const transaction = new Transaction();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = ownerPublicKey;

    console.log("Adding burn instruction...");
    transaction.add(
      createBurnInstruction(
        tokenAccount,
        mintPublicKey,
        ownerPublicKey,
        rawAmount,
        [],
        tokenProgram  // Use correct token program!
      )
    );

    console.log("Requesting Phantom to sign burn transaction...");
    const signedTransaction = await provider.signTransaction(transaction);
    
    console.log("Sending signed burn transaction...");
    const rawTransaction = signedTransaction.serialize();
    const base64Tx = Buffer.from(rawTransaction).toString('base64');
    
    const sendResult = await rpcCall('sendTransaction', [base64Tx, {
      encoding: 'base64',
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    }]);
    
    const signature = sendResult;
    console.log("Burn transaction sent! Signature:", signature);

    // Wait for confirmation
    let confirmed = false;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const status = await rpcCall('getSignatureStatuses', [[signature]]);
      const confirmationStatus = status?.value?.[0]?.confirmationStatus;
      
      if (confirmationStatus === 'confirmed' || confirmationStatus === 'finalized') {
        confirmed = true;
        break;
      }
      
      if (status?.value?.[0]?.err) {
        return { success: false, txHash: signature, message: 'Burn transaction failed on chain' };
      }
    }

    if (!confirmed) {
      return { success: false, txHash: signature, message: 'Transaction not confirmed in time' };
    }

    console.log("Burn transaction confirmed!");
    return { success: true, txHash: signature };

  } catch (error: any) {
    console.error("SPL Token burn error:", error);
    
    if (error.message?.includes('User rejected') || error.message?.includes('rejected')) {
      return { success: false, txHash: '', message: 'Transaction rejected by user' };
    }
    
    if (error.message?.includes('insufficient') || error.message?.includes('Insufficient')) {
      return { success: false, txHash: '', message: 'Insufficient token balance' };
    }
    
    return { 
      success: false, 
      txHash: '', 
      message: error.message || 'Token burn failed' 
    };
  }
};

/**
 * Check transaction status
 */
export const checkTransactionStatus = async (
  txHash: string
): Promise<{ confirmed: boolean; error?: string }> => {
  if (!txHash) {
    return { confirmed: false, error: 'No transaction hash provided' };
  }

  try {
    const status = await rpcCall('getSignatureStatuses', [[txHash], { searchTransactionHistory: true }]);
    
    if (!status?.value?.[0]) {
      return { confirmed: false, error: 'Transaction not found' };
    }

    if (status.value[0].err) {
      return { confirmed: false, error: 'Transaction failed on-chain' };
    }

    const isConfirmed = status.value[0].confirmationStatus === 'confirmed' || 
                        status.value[0].confirmationStatus === 'finalized';
    
    return { confirmed: isConfirmed };
  } catch (err: any) {
    console.error("Transaction status check failed:", err);
    return { confirmed: false, error: err.message };
  }
};

/**
 * Verify a transaction hash manually
 */
export const verifyTransactionManually = async (
  txHash: string
): Promise<{ success: boolean; confirmed: boolean; message: string }> => {
  if (!txHash || txHash.length < 80) {
    return { success: false, confirmed: false, message: 'Invalid transaction hash' };
  }

  try {
    const status = await checkTransactionStatus(txHash);
    
    if (status.confirmed) {
      return { 
        success: true, 
        confirmed: true, 
        message: 'Transaction confirmed on-chain!' 
      };
    }
    
    return { 
      success: true, 
      confirmed: false, 
      message: status.error || 'Transaction not yet confirmed' 
    };
  } catch (err: any) {
    return { 
      success: false, 
      confirmed: false, 
      message: err.message || 'Failed to verify transaction' 
    };
  }
};
