
// This file contains utilities for calculating and managing rewards

// Default APR value
let stakingAPR = 3600;
let lastRewardUpdateTime: Date | null = null;
let rewardUpdateInterval: ReturnType<typeof setInterval> | null = null;

// Initialize the reward settings from localStorage or set defaults
export const initializeRewardSettings = (resetState = false) => {
  console.log("Initializing reward settings, reset state:", resetState);
  
  // Set default APR if not already set
  if (!localStorage.getItem('stakingApr') || resetState) {
    localStorage.setItem('stakingApr', '3600');
  }
  
  stakingAPR = parseInt(localStorage.getItem('stakingApr') || '3600');
  
  if (resetState) {
    lastRewardUpdateTime = null;
  } else {
    // Try to recover last update time from localStorage
    const savedTime = localStorage.getItem('lastRewardUpdateTime');
    if (savedTime) {
      try {
        lastRewardUpdateTime = new Date(savedTime);
        // Check if the date is valid
        if (isNaN(lastRewardUpdateTime.getTime())) {
          lastRewardUpdateTime = new Date();
          localStorage.setItem('lastRewardUpdateTime', lastRewardUpdateTime.toISOString());
        }
      } catch (error) {
        console.error("Error parsing saved reward update time:", error);
        lastRewardUpdateTime = new Date();
        localStorage.setItem('lastRewardUpdateTime', lastRewardUpdateTime.toISOString());
      }
    } else {
      lastRewardUpdateTime = new Date();
      localStorage.setItem('lastRewardUpdateTime', lastRewardUpdateTime.toISOString());
    }
  }
  
  // Load existing reward update frequency settings
  const hours = localStorage.getItem('rewardUpdateHours');
  const minutes = localStorage.getItem('rewardUpdateMinutes');
  const seconds = localStorage.getItem('rewardUpdateSeconds');
  
  // Only set defaults if ALL values are missing
  if (!hours && !minutes && !seconds) {
    localStorage.setItem('rewardUpdateHours', '0');
    localStorage.setItem('rewardUpdateMinutes', '0');
    localStorage.setItem('rewardUpdateSeconds', '1');
  }
  
  // Set up a listener for localStorage changes
  setupRewardIntervalListener();
  
  // Set up the reward update interval
  setupRewardUpdateInterval();
};

// Setup a listener for localStorage changes (for when reward interval is updated)
const setupRewardIntervalListener = () => {
  window.addEventListener('localStorageUpdated', (event: any) => {
    console.log("Storage updated event detected in reward-utils", event.detail);
    
    // Only reset last reward time if the reward frequency was changed
    if (event.detail?.type === 'rewardFrequency') {
      console.log("Reward frequency updated, reconfiguring interval");
      
      // When settings change, reset the last reward update time to now
      lastRewardUpdateTime = new Date();
      localStorage.setItem('lastRewardUpdateTime', lastRewardUpdateTime.toISOString());
      
      // Reconfigure the interval immediately
      setupRewardUpdateInterval();
      
      // Force a rewardsUpdated event to refresh UI displays
      window.dispatchEvent(new Event('rewardsUpdated'));
    }
  });
};

// Setup the interval for updating rewards
const setupRewardUpdateInterval = () => {
  // Clear any existing interval
  if (rewardUpdateInterval) {
    clearInterval(rewardUpdateInterval);
  }
  
  // Get the update frequency directly from localStorage to ensure we always have the latest values
  const hours = parseInt(localStorage.getItem('rewardUpdateHours') || '0');
  const minutes = parseInt(localStorage.getItem('rewardUpdateMinutes') || '0');
  const seconds = parseInt(localStorage.getItem('rewardUpdateSeconds') || '1');
  
  // Calculate the interval in milliseconds (default to 1 second if all are 0)
  const intervalMs = Math.max((hours * 3600 + minutes * 60 + seconds) * 1000, 1000);
  
  console.log(`Setting up reward update interval: ${intervalMs}ms (${hours}h ${minutes}m ${seconds}s)`);
  
  // Set up the new interval
  rewardUpdateInterval = setInterval(() => {
    updateRewards();
  }, intervalMs);
};

// Update rewards for all stakers
export const updateRewards = () => {
  const now = new Date();
  
  // If this is the first update, set the last update time to now
  if (!lastRewardUpdateTime) {
    lastRewardUpdateTime = now;
    localStorage.setItem('lastRewardUpdateTime', now.toISOString());
    return;
  }
  
  try {
    // Get all stakers
    const stakersData = localStorage.getItem('stakers');
    if (!stakersData) {
      console.log("No stakers found, skipping reward update");
      lastRewardUpdateTime = now;
      localStorage.setItem('lastRewardUpdateTime', now.toISOString());
      return;
    }
    
    const stakers = JSON.parse(stakersData);
    if (!stakers || stakers.length === 0) {
      console.log("Empty stakers array, skipping reward update");
      lastRewardUpdateTime = now;
      localStorage.setItem('lastRewardUpdateTime', now.toISOString());
      return;
    }
    
    // Calculate time difference in hours
    const timeDiffMs = now.getTime() - lastRewardUpdateTime.getTime();
    const timeDiffHours = timeDiffMs / (1000 * 60 * 60);
    
    console.log(`Updating rewards: time difference ${timeDiffMs}ms (${timeDiffHours} hours)`);
    
    // Update rewards for each staker
    stakers.forEach((staker: any) => {
      const walletAddress = staker.walletAddress;
      const stakedAmount = staker.totalStaked || 0;
      
      if (stakedAmount <= 0) {
        console.log(`Skipping ${walletAddress}: no staked amount`);
        return;
      }
      
      // Calculate rewards for this update period
      const aprPercentage = stakingAPR;
      const yearlyReward = stakedAmount * (aprPercentage / 100);
      const rewardForPeriod = yearlyReward * (timeDiffHours / 8760); // 8760 hours in a year
      
      console.log(`Reward calculation for ${walletAddress}: 
        - Staked: ${stakedAmount} SOL
        - APR: ${aprPercentage}%
        - Yearly reward: ${yearlyReward} SOL
        - Reward for period: ${rewardForPeriod} SOL`);
      
      // Get current user data
      const userStakingKey = `staking_${walletAddress}`;
      const userData = localStorage.getItem(userStakingKey);
      
      if (userData) {
        const parsedUserData = JSON.parse(userData);
        const currentRewards = parsedUserData.availableRewards || 0;
        const newRewards = currentRewards + rewardForPeriod;
        
        console.log(`Adding rewards for ${walletAddress}: ${currentRewards} + ${rewardForPeriod} = ${newRewards}`);
        
        // Update available rewards
        parsedUserData.availableRewards = newRewards;
        
        // Save updated user data
        localStorage.setItem(userStakingKey, JSON.stringify(parsedUserData));
      } else {
        // Create new user data
        const newUserData = {
          stakedAmount: stakedAmount,
          availableRewards: rewardForPeriod,
          totalClaimedRewards: 0,
          lastStakeTime: now.toISOString()
        };
        
        console.log(`Creating new user data for ${walletAddress} with initial rewards: ${rewardForPeriod}`);
        
        // Save new user data
        localStorage.setItem(userStakingKey, JSON.stringify(newUserData));
      }
    });
    
    // Update last reward update time
    lastRewardUpdateTime = now;
    localStorage.setItem('lastRewardUpdateTime', now.toISOString());
    
    // Dispatch an event to notify UI components
    window.dispatchEvent(new Event('rewardsUpdated'));
    
    console.log("Rewards update completed successfully at", now.toISOString());
  } catch (error) {
    console.error("Error updating rewards:", error);
  }
};

// Calculate rewards for a specific wallet
export const calculateRewards = (walletAddress: string) => {
  try {
    const userStakingKey = `staking_${walletAddress}`;
    const userData = localStorage.getItem(userStakingKey);
    
    if (!userData) return 0;
    
    const parsedUserData = JSON.parse(userData);
    return parsedUserData.availableRewards || 0;
  } catch (error) {
    console.error("Error calculating rewards:", error);
    return 0;
  }
};

// Claim rewards for a user
export const claimUserRewards = (walletAddress: string) => {
  try {
    const userStakingKey = `staking_${walletAddress}`;
    const userData = localStorage.getItem(userStakingKey);
    
    if (!userData) return 0;
    
    const parsedUserData = JSON.parse(userData);
    const availableRewards = parsedUserData.availableRewards || 0;
    
    if (availableRewards <= 0) return 0;
    
    // Update user data
    const totalClaimed = (parsedUserData.totalClaimedRewards || 0) + availableRewards;
    parsedUserData.availableRewards = 0;
    parsedUserData.totalClaimedRewards = totalClaimed;
    
    // Save updated user data
    localStorage.setItem(userStakingKey, JSON.stringify(parsedUserData));
    
    // Record the transaction
    const newTransaction = {
      id: `tx-${Date.now()}`,
      type: "claim",
      walletAddress: walletAddress,
      amount: availableRewards,
      tokenSymbol: "SOL",
      timestamp: new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).replace(',', ''),
      status: "completed",
      txHash: `simulated-${Date.now()}`
    };
    
    const completedTransactionsData = localStorage.getItem('completedTransactions');
    const completedTransactions = completedTransactionsData ? JSON.parse(completedTransactionsData) : [];
    completedTransactions.unshift(newTransaction);
    localStorage.setItem('completedTransactions', JSON.stringify(completedTransactions));
    
    // Update stakers data
    const stakersData = localStorage.getItem('stakers');
    if (stakersData) {
      const stakers = JSON.parse(stakersData);
      const stakerIndex = stakers.findIndex((s: any) => s.walletAddress === walletAddress);
      
      if (stakerIndex >= 0) {
        stakers[stakerIndex].totalClaimed = (stakers[stakerIndex].totalClaimed || 0) + availableRewards;
        localStorage.setItem('stakers', JSON.stringify(stakers));
      }
    }
    
    // Dispatch an event to notify UI components
    window.dispatchEvent(new Event('rewardsUpdated'));
    
    return availableRewards;
  } catch (error) {
    console.error("Error claiming rewards:", error);
    return 0;
  }
};

// Get the APR value
export const getAPR = () => {
  try {
    const storedAPR = localStorage.getItem('stakingApr');
    if (storedAPR) {
      return parseInt(storedAPR);
    }
  } catch (error) {
    console.error("Error getting APR:", error);
  }
  
  return stakingAPR;
};

// Get the time interval between reward distributions
export const getClaimInterval = () => {
  // Get the update frequency from localStorage
  const hours = parseInt(localStorage.getItem('rewardUpdateHours') || '0');
  const minutes = parseInt(localStorage.getItem('rewardUpdateMinutes') || '0');
  const seconds = parseInt(localStorage.getItem('rewardUpdateSeconds') || '1');
  
  // Format string for display
  let intervalStr = '';
  if (hours > 0) intervalStr += `${hours}h `;
  if (minutes > 0) intervalStr += `${minutes}m `;
  if (seconds > 0) intervalStr += `${seconds}s`;
  
  return intervalStr.trim() || '1s';
};

// Get the next reward time - FIXED to properly calculate time intervals
export const getNextRewardTime = () => {
  // Always read directly from localStorage to ensure freshness
  const savedLastUpdateTime = localStorage.getItem('lastRewardUpdateTime');
  const lastUpdate = savedLastUpdateTime ? new Date(savedLastUpdateTime) : new Date();
  
  // If lastUpdate is invalid, return current time as fallback
  if (isNaN(lastUpdate.getTime())) {
    console.error("Invalid lastRewardUpdateTime in localStorage:", savedLastUpdateTime);
    return new Date();
  }
  
  // IMPORTANT: Always fetch settings directly from localStorage
  const hours = parseInt(localStorage.getItem('rewardUpdateHours') || '0');
  const minutes = parseInt(localStorage.getItem('rewardUpdateMinutes') || '0');
  const seconds = parseInt(localStorage.getItem('rewardUpdateSeconds') || '1');
  
  // Calculate interval in milliseconds (minimum 1 second)
  const intervalMs = Math.max((hours * 3600 + minutes * 60 + seconds) * 1000, 1000);
  
  // Create a new date object for the next reward time
  const now = new Date();
  const nextRewardTime = new Date(lastUpdate.getTime() + intervalMs);
  
  console.log(`Next reward calculation:
  - Update interval: ${hours}h ${minutes}m ${seconds}s (${intervalMs}ms)
  - Last update: ${lastUpdate.toISOString()}
  - Now: ${now.toISOString()}
  - Next update: ${nextRewardTime.toISOString()}
  - Time until next: ${nextRewardTime.getTime() - now.getTime()}ms`);
  
  return nextRewardTime;
};

// Format the time until next reward - FIXED to properly handle negative times
export const formatTimeUntilNextReward = (nextTime: Date | null) => {
  if (!nextTime) return "Calculating...";
  
  try {
    const now = new Date();
    
    // Ensure nextTime is valid
    if (isNaN(nextTime.getTime())) {
      return "Calculating...";
    }
    
    // Calculate time difference in milliseconds
    const timeDiffMs = nextTime.getTime() - now.getTime();
    
    if (timeDiffMs <= 0) {
      // Trigger reward update immediately if timer goes negative
      console.log("Timer reached zero or negative, triggering reward update");
      updateRewards();
      return "processing...";
    } else if (timeDiffMs < 1000) {
      // Less than 1 second
      return "< 1s";
    }
    
    // Convert to seconds
    const timeDiffSecs = Math.floor(timeDiffMs / 1000);
    
    // Format for display
    if (timeDiffSecs < 60) {
      return `${timeDiffSecs}s`;
    } else if (timeDiffSecs < 3600) {
      const minutes = Math.floor(timeDiffSecs / 60);
      const seconds = timeDiffSecs % 60;
      return `${minutes}m ${seconds}s`;
    } else {
      const hours = Math.floor(timeDiffSecs / 3600);
      const minutes = Math.floor((timeDiffSecs % 3600) / 60);
      const seconds = timeDiffSecs % 60;
      return `${hours}h ${minutes}m ${seconds}s`;
    }
  } catch (error) {
    console.error("Error formatting time until next reward:", error);
    return "Calculating...";
  }
};
