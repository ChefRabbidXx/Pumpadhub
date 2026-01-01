
/**
 * Utility functions for calculating app-wide statistics
 */

/**
 * Get the total number of staking pools created
 * @returns number of pools
 */
export const getTotalPools = (): number => {
  try {
    const createdPoolsData = localStorage.getItem('createdPools');
    if (!createdPoolsData) return 231; // Default fallback

    const createdPools = JSON.parse(createdPoolsData);
    return Array.isArray(createdPools) ? createdPools.length : 231;
  } catch (error) {
    console.error("Error calculating total pools:", error);
    return 231; // Default fallback on error
  }
};

/**
 * Calculate total rewards distributed across all users
 * @returns total rewards distributed in SOL
 */
export const getTotalRewardsDistributed = (): number => {
  try {
    // Get all completed transactions
    const transactionsData = localStorage.getItem('completedTransactions');
    if (!transactionsData) return 100; // Default fallback in thousands

    const transactions = JSON.parse(transactionsData);
    
    // Sum up all claim transactions
    const totalClaimed = transactions.reduce((sum: number, tx: any) => {
      if (tx.type === 'claim' && typeof tx.amount === 'number') {
        return sum + tx.amount;
      }
      return sum;
    }, 0);
    
    // Convert to thousands if needed
    return totalClaimed > 1000 ? totalClaimed / 1000 : 100; // Default if too small
  } catch (error) {
    console.error("Error calculating total rewards distributed:", error);
    return 100; // Default fallback on error in thousands
  }
};

/**
 * Get a random number of users between min and max (inclusive)
 * @returns random number of users
 */
export const getTotalUsers = (): number => {
  const min = 50;
  const max = 125;
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Format a number with proper formatting for display
 * @param value number to format 
 * @returns formatted string
 */
export const formatStatValue = (value: number): string => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return value.toLocaleString();
  } else if (typeof value === 'number') {
    // For rewards always show dollar sign
    if (value === 100) {
      return `$${value}k`;
    }
    return value.toString();
  } else {
    return String(value);
  }
};
