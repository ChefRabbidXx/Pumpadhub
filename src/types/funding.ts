export interface FundingPoolProps {
  id: string;
  tokenName: string;
  tokenSymbol: string;
  tokenLogo: string;
  purpose: string;
  fundingGoal: number;
  currentFunding: number;
  expectedROI: number;
  contributors: number;
  status: 'active' | 'funded';
  isContributed?: boolean;
  userContribution?: string;
  userShare?: string;
  expectedReturn?: string;
  marketCap?: number;
  minContribution: number;
  endDate?: string;
  createdAt: string;
}
