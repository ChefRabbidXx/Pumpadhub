
export interface FarmingPoolProps {
  id: string;
  pairName: string;
  pairSymbol: string;
  token1Symbol: string;
  token1Logo: string;
  token2Symbol: string;
  token2Logo: string;
  apr: number;
  totalStaked: number;
  rewardToken: string;
  rewardTokenLogo: string;
  rewardRate: string;
  status: 'active' | 'ended';
  endDate?: string;
  isStaked?: boolean;
  userStaked?: string;
  userShare?: string;
  pendingRewards?: string;
  marketCap?: number; // Added for sorting by market cap
  createdAt: string; // Added for sorting by date (newest/oldest)
}
