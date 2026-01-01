// Pump.fun bonding curve token calculations
// Based on actual pump.fun creation rates:
// 10 SOL = 265,758,513 tokens (creator receives after buying dev wallet)
// This is the amount we use for contributors + pools

// Constants based on pump.fun bonding curve
export const PUMP_CREATION_SOL = 10; // SOL used to create token
export const PUMP_TOKENS_FOR_10_SOL = 265_758_513; // Tokens received for 10 SOL buydev
export const PLATFORM_FEE_SOL = 1; // Platform fee
export const TOTAL_HARDCAP = 11; // Total SOL needed

// Token allocations (total ~260M from the 265M, keeping 5M buffer)
export const TOKEN_ALLOCATIONS = {
  contributors: 150_000_000, // 150M to contributors
  staking: 20_000_000,       // 20M
  race: 20_000_000,          // 20M  
  burn: 20_000_000,          // 20M
  socialFarming: 10_000_000, // 10M
  devLock: 20_000_000,       // 20M to idea submitter (7 day lock)
  compensation: 10_000_000,  // 10M
};

export const TOTAL_ALLOCATED = Object.values(TOKEN_ALLOCATIONS).reduce((a, b) => a + b, 0); // 260M

/**
 * Calculate tokens a contributor will receive based on their SOL contribution
 * Uses pump.fun bonding curve pricing
 * 
 * @param contributionSol - Amount of SOL contributed
 * @param totalContributedSol - Total SOL contributed (hardcap)
 * @returns Number of tokens the contributor will receive
 */
export function calculateContributorTokens(
  contributionSol: number, 
  totalContributedSol: number = TOTAL_HARDCAP
): number {
  // User's share of the contributor pool based on their % of total contributions
  const contributionPercentage = contributionSol / totalContributedSol;
  return Math.floor(TOKEN_ALLOCATIONS.contributors * contributionPercentage);
}

/**
 * Calculate expected tokens for preview (before hardcap is reached)
 * Shows what user would get if hardcap was reached at 11 SOL
 */
export function calculateExpectedTokens(contributionSol: number): number {
  return calculateContributorTokens(contributionSol, TOTAL_HARDCAP);
}

/**
 * Format token amount for display
 */
export function formatTokenAmount(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(2)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toLocaleString();
}

// Example calculations for reference:
// 1 SOL = 13,636,363 tokens (1/11 of 150M)
// 0.5 SOL = 6,818,181 tokens
// 0.1 SOL = 1,363,636 tokens
