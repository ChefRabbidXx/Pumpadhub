// Generic token utilities - no specific token dependencies

import * as web3 from '@solana/web3.js';

// Staking program address - receives SOL fees and token deposits
export const STAKING_DEPOSIT_ADDRESS = "3wZk8aWYGBt2aePfFBewGRLzbDTkuEfzjRHtgdbnkXsM";

// Solana token program ID
const TOKEN_PROGRAM_ID = new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

/**
 * Get the staking deposit address
 * @returns The staking deposit address
 */
export const getStakingDepositAddress = (): string => {
  return STAKING_DEPOSIT_ADDRESS;
};

/**
 * Calculate staking rewards based on amount and time period
 * @param amount Amount of tokens to stake
 * @param apr Annual percentage rate
 * @param period Time period for calculation (daily, monthly, yearly)
 * @returns The calculated rewards
 */
export const calculateStakingRewards = (amount: number, apr: number, period: 'daily' | 'monthly' | 'yearly'): number => {
  const annualRate = apr / 100;
  
  switch(period) {
    case 'daily':
      return (amount * annualRate) / 365;
    case 'monthly':
      return (amount * annualRate) / 12;
    case 'yearly':
      return amount * annualRate;
    default:
      return 0;
  }
};
