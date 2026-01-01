// Define BountySubmission interface here instead of importing it to avoid circular dependencies
export interface BountySubmission {
  id: string;
  walletAddress: string;
  title: string;
  description: string;
  severity: string;
  imageUrl: string | null;
  status: "pending" | "confirmed";
  reward: number | null;
  timestamp: string;
  txHash?: string;
}

// Function to format wallet addresses for display
export const formatWalletAddress = (address: string, length: number = 4): string => {
  if (!address) return '';
  return `${address.substring(0, length)}...${address.substring(address.length - length)}`;
};

// Function to check if Phantom wallet is installed (handles both old and new detection methods)
export const isPhantomInstalled = (): boolean => {
  if (typeof window === 'undefined') return false;
  // Check new method first (window.phantom.solana), then fall back to old method (window.solana)
  const hasNewPhantom = !!(window as any).phantom?.solana?.isPhantom;
  const hasOldPhantom = !!(window as any).solana?.isPhantom;
  return hasNewPhantom || hasOldPhantom;
};

// Generate a random contract address for test tokens
export const generateRandomContractAddress = (): string => {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 44; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Generate random token holdings for testing
export const getRandomTokenHoldings = (symbol: string): number => {
  // Generate a base amount between 5,000 and 100,000
  const baseAmount = Math.floor(Math.random() * 95000) + 5000;
  // Make it more realistic by adding some variance based on the token symbol
  const seed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const variance = (seed % 10) / 10; // Between 0 and 1
  
  return Math.floor(baseAmount * (1 + variance));
};

// Function to get all bounty submissions
export const getBountySubmissions = (): BountySubmission[] => {
  try {
    const submissions = localStorage.getItem("bountySubmissions");
    if (submissions) {
      return JSON.parse(submissions);
    }
    return [];
  } catch (error) {
    console.error("Error fetching bounty submissions:", error);
    return [];
  }
};

// Function to update bounty submission status and reward
export const updateBountySubmission = (id: string, status: "pending" | "confirmed", reward: number, txHash?: string) => {
  try {
    const allSubmissions = localStorage.getItem("bountySubmissions");
    if (allSubmissions) {
      const parsed = JSON.parse(allSubmissions);
      const updatedSubmissions = parsed.map((item: BountySubmission) => {
        if (item.id === id) {
          return {
            ...item,
            status,
            reward,
            txHash: txHash || null,
          };
        }
        return item;
      });
      
      localStorage.setItem("bountySubmissions", JSON.stringify(updatedSubmissions));
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error updating bounty submission:", error);
    return false;
  }
};

// Function to delete bounty submission
export const deleteBountySubmission = (id: string) => {
  try {
    const allSubmissions = localStorage.getItem("bountySubmissions");
    if (allSubmissions) {
      const parsed = JSON.parse(allSubmissions);
      const updatedSubmissions = parsed.filter((item: BountySubmission) => item.id !== id);
      
      localStorage.setItem("bountySubmissions", JSON.stringify(updatedSubmissions));
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error deleting bounty submission:", error);
    return false;
  }
};

// Function to calculate total SOL staked across all users
export const calculateTotalStakedSOL = (): number => {
  try {
    const stakersData = localStorage.getItem('stakers');
    
    if (!stakersData) {
      return 0;
    }
    
    const stakers = JSON.parse(stakersData);
    
    if (!stakers || !Array.isArray(stakers) || stakers.length === 0) {
      return 0;
    }
    
    return stakers.reduce((sum: number, staker: any) => {
      // Ensure we're handling valid numbers only
      const stakedAmount = staker && staker.totalStaked ? parseFloat(staker.totalStaked) : 0;
      // Only add if it's a valid number
      return sum + (isNaN(stakedAmount) ? 0 : stakedAmount);
    }, 0);
  } catch (error) {
    console.error("Error calculating total staked SOL:", error);
    return 0;
  }
};

/**
 * Safely format a number value to a string with thousands separators
 * @param value - The number to format
 * @param digits - The number of decimal places (default: 4)
 * @returns Formatted string
 */
export const safeFormatNumber = (value: number | string | undefined | null, digits = 4): string => {
  if (value === undefined || value === null) return "0";
  
  let numValue: number;
  
  // Convert string to number if needed
  if (typeof value === 'string') {
    numValue = parseFloat(value);
    if (isNaN(numValue)) return "0";
  } else {
    numValue = value;
  }
  
  // Handle potential NaN after conversion
  if (isNaN(numValue)) return "0";
  
  try {
    // Try to use toLocaleString with the specified number of decimal places
    return numValue.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits
    });
  } catch (error) {
    console.error("Error formatting number:", error);
    
    // Fallback formatting without locale
    const fixed = numValue.toFixed(digits);
    const parts = fixed.toString().split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }
};

/**
 * Initialize reward settings in localStorage
 */
export const initializeRewardSettings = () => {
  // Check if we're in a reset state (APR is 0 or dataResetFlag is set)
  const isResetState = localStorage.getItem('stakingApr') === '0' || 
                      localStorage.getItem('dataResetFlag') !== null;
  
  console.log("Initializing reward settings, reset state:", isResetState);
  
  // If we're in reset state, don't re-initialize with default values
  if (isResetState) {
    console.log("System in reset state - keeping all zeros");
    return;
  }
  
  // Initialize claim time settings if they don't exist
  if (!localStorage.getItem('claimTimeHours')) {
    localStorage.setItem('claimTimeHours', '3');
  }
  
  if (!localStorage.getItem('claimTimeMinutes')) {
    localStorage.setItem('claimTimeMinutes', '0');
  }
  
  if (!localStorage.getItem('claimTimeSeconds')) {
    localStorage.setItem('claimTimeSeconds', '0');
  }
  
  // Initialize reward update settings if they don't exist - default to 1 hour
  if (!localStorage.getItem('rewardUpdateHours')) {
    localStorage.setItem('rewardUpdateHours', '1');
  }
  
  if (!localStorage.getItem('rewardUpdateMinutes')) {
    localStorage.setItem('rewardUpdateMinutes', '0');
  }
  
  if (!localStorage.getItem('rewardUpdateSeconds')) {
    localStorage.setItem('rewardUpdateSeconds', '0');
  }
  
  // Initialize min/max staking amounts
  if (!localStorage.getItem('minStakingAmount')) {
    localStorage.setItem('minStakingAmount', '0.1');
  }
  
  if (!localStorage.getItem('maxStakingAmount')) {
    localStorage.setItem('maxStakingAmount', '100');
  }
  
  // Initialize APR if it doesn't exist
  if (!localStorage.getItem('stakingApr')) {
    localStorage.setItem('stakingApr', '3666');
  }
  
  // Create consistent demo data for all environments if not in reset state
  if (!isResetState) {
    createConsistentDefaultData();
  }
  
  // Set logging flag to allow one log message
  localStorage.setItem('isLoggingRewards', 'true');
  
  // Dispatch an event to notify components that localStorage has been updated
  window.dispatchEvent(new Event('localStorageUpdated'));
};

// Function to completely reset all staking data and reward timers
export const resetAllStakingData = (): void => {
  try {
    console.log("STARTING COMPLETE DATA RESET");
    
    // Create a list of all keys to clear
    const keysToReset = [
      // Core staking data
      'stakers',
      'pendingClaims',
      'pendingUnstakes',
      'completedTransactions',
      'stakingApr',
      'minStakingAmount',
      'maxStakingAmount',
      
      // Timing settings
      'claimTimeHours',
      'claimTimeMinutes',
      'claimTimeSeconds',
      'rewardUpdateHours',
      'rewardUpdateMinutes',
      'rewardUpdateSeconds',
      
      // Pool and metrics data
      'joinedPools',
      'createdPools',
      'totalValueLocked',
      'totalStaked',
      'totalClaimed',
      'totalUnstaked',
      'totalStakers',
      'bountySubmissions',
      'isLoggingRewards',
      'lastRewardUpdate',
      'userStakingPositions',
      'userStakingData'
    ];
    
    // Clear all listed keys
    keysToReset.forEach(key => {
      console.log(`Removing ${key} from localStorage`);
      localStorage.removeItem(key);
    });
    
    // Re-initialize with zeros but ensure we have minimal values for reward timing
    localStorage.setItem('stakers', JSON.stringify([]));
    localStorage.setItem('pendingClaims', JSON.stringify([]));
    localStorage.setItem('pendingUnstakes', JSON.stringify([]));
    localStorage.setItem('completedTransactions', JSON.stringify([]));
    localStorage.setItem('stakingApr', '0');
    localStorage.setItem('minStakingAmount', '0');
    localStorage.setItem('maxStakingAmount', '0');
    localStorage.setItem('joinedPools', JSON.stringify([]));
    localStorage.setItem('createdPools', JSON.stringify([]));
    localStorage.setItem('userStakingPositions', JSON.stringify([]));
    localStorage.setItem('totalValueLocked', '0');
    localStorage.setItem('totalStaked', '0');
    localStorage.setItem('userStakingData', JSON.stringify({}));
    
    // Set default reward update to 5 seconds
    localStorage.setItem('rewardUpdateHours', '0');
    localStorage.setItem('rewardUpdateMinutes', '0');
    localStorage.setItem('rewardUpdateSeconds', '5');
    
    localStorage.setItem('bountySubmissions', JSON.stringify([]));
    
    // Reset any past reward times that might be causing issues
    const now = new Date();
    localStorage.setItem('lastRewardUpdate', now.toISOString());
    
    // Set a flag to indicate we've reset data with the current timestamp
    localStorage.setItem('dataResetFlag', Date.now().toString());
    
    // Find all localStorage keys
    const allKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        allKeys.push(key);
      }
    }
    
    // Clear all user staking positions and any user-related data
    const userKeysPattern = /(staking_|user_|stake_|wallet_|reward_|position_|pool_)/;
    const keysToRemove = allKeys.filter(key => userKeysPattern.test(key));
    
    // Remove all the keys we found
    keysToRemove.forEach(key => {
      console.log(`Removing user data: ${key}`);
      localStorage.removeItem(key);
    });
    
    // Force data reload by dispatching events
    console.log("Dispatching data update events");
    
    // First trigger localStorage event
    window.dispatchEvent(new Event('localStorageUpdated'));
    
    // Then trigger other events to ensure all components update
    window.dispatchEvent(new Event('dataSynced'));
    window.dispatchEvent(new CustomEvent('stakingReset', { detail: { timestamp: Date.now() } }));
    window.dispatchEvent(new CustomEvent('userDataReset', { detail: { timestamp: Date.now() } }));
    window.dispatchEvent(new CustomEvent('aprUpdated', { detail: { newApr: 0 } }));
    window.dispatchEvent(new CustomEvent('stakingDataReset', { detail: { timestamp: Date.now() } }));
    
    // Trigger staking UI update event
    window.dispatchEvent(new CustomEvent('stakingPositionReset', { 
      detail: { timestamp: Date.now() } 
    }));
    
    // This is a special event that will trigger a full page reload in the Admin Dashboard
    window.dispatchEvent(new CustomEvent('dataReset', { 
      detail: { 
        timestamp: Date.now(),
        success: true 
      } 
    }));
    
    console.log('All staking data has been completely reset to zero!');
  } catch (error) {
    console.error("Error resetting staking data:", error);
    
    // Dispatch event with error status
    window.dispatchEvent(new CustomEvent('dataReset', { 
      detail: { 
        timestamp: Date.now(),
        success: false,
        error: error instanceof Error ? error.message : String(error)
      } 
    }));
  }
};

// Creates consistent default data for demonstration purposes
// to ensure the app looks the same on all environments
export const createConsistentDefaultData = () => {
  // Only initialize if no stakers data exists
  if (!localStorage.getItem('stakers')) {
    localStorage.setItem('stakers', JSON.stringify([]));
  }

  // Only initialize if no transactions data exists
  if (!localStorage.getItem('completedTransactions')) {
    localStorage.setItem('completedTransactions', JSON.stringify([]));
  }

  // Create a default pool for demonstration
  if (!localStorage.getItem('createdPools')) {
    localStorage.setItem('createdPools', JSON.stringify([]));
  }
};

/**
 * Check if a user has active staking
 * @param walletAddress User's wallet address 
 * @returns boolean indicating if user has active staking
 */
export const hasActiveStaking = (walletAddress: string): boolean => {
  if (!walletAddress) return false;
  
  try {
    const userStakingKey = `staking_${walletAddress}`;
    const storedUserData = localStorage.getItem(userStakingKey);
    
    if (!storedUserData) return false;
    
    const userData = JSON.parse(storedUserData);
    return userData.stakedAmount > 0;
  } catch (error) {
    console.error("Error checking active staking status:", error);
    return false;
  }
};
