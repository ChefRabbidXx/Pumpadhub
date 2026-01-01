import React from 'react';
import { Routes, Route } from 'react-router-dom';
import './App.css';
import { Toaster } from "sonner";
import { TransactionLoading } from './components/wallet/TransactionLoading';
import { useWallet } from './contexts/WalletContext';
import { AppLayout } from './components/layout/AppLayout';

// Import pages
import Index from './pages/Index';
import CreatePool from './pages/CreatePool';
import Safu from './pages/Safu';
import SafuDetails from './pages/SafuDetails';
import TokenDetails from './pages/TokenDetails';
import StakingDetails from './pages/StakingDetails';
import Race from './pages/Race';
import RaceDetails from './pages/RaceDetails';
import Staking from './pages/Staking';
import Bounty from './pages/Bounty';
import Docs from './pages/Docs';
import NotFound from './pages/NotFound';

import Burn from './pages/Burn';
import BurnDetails from './pages/BurnDetails';
import SocialFarming from './pages/SocialFarming';
import SocialFarmingDetails from './pages/SocialFarmingDetails';
import Lock from './pages/Lock';
import LockTokens from './pages/LockTokens';
import Compensation from './pages/Compensation';
import KYD from './pages/KYD';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import Chat from './pages/Chat';
import Updates from './pages/Updates';
import Swap from './pages/Swap';
import MobileApp from './pages/MobileApp';

function App() {
  const { isConfirmingTransaction } = useWallet();
  
  return (
    <>
      <Toaster richColors position="top-right" />
      <TransactionLoading isVisible={isConfirmingTransaction} />
      <Routes>
        {/* Admin routes without sidebar */}
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        
        {/* Main app routes with sidebar layout */}
        <Route path="/*" element={
          <AppLayout>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/create" element={<CreatePool />} />
              <Route path="/safu" element={<Safu />} />
              <Route path="/safu/:contractAddress" element={<SafuDetails />} />
              <Route path="/token/:id" element={<TokenDetails />} />
              <Route path="/race" element={<Race />} />
              <Route path="/race/:contractAddress" element={<RaceDetails />} />
              <Route path="/staking" element={<Staking />} />
              <Route path="/staking/:contractAddress" element={<StakingDetails />} />
              <Route path="/burn" element={<Burn />} />
              <Route path="/burn/:contractAddress" element={<BurnDetails />} />
              <Route path="/social-farming" element={<SocialFarming />} />
              <Route path="/social/:contractAddress" element={<SocialFarmingDetails />} />
              <Route path="/lock" element={<Lock />} />
              <Route path="/lock-tokens" element={<LockTokens />} />
              <Route path="/compensation" element={<Compensation />} />
              <Route path="/kyd" element={<KYD />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/bounty" element={<Bounty />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/updates" element={<Updates />} />
              <Route path="/swap" element={<Swap />} />
              <Route path="/mobile-app" element={<MobileApp />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        } />
      </Routes>
    </>
  );
}

export default App;
