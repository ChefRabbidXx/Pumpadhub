import React, { useState, createContext, useContext } from 'react';
import { MobileAppHeader } from '@/components/mobile-app/MobileAppHeader';
import { MobileBottomNav } from '@/components/mobile-app/MobileBottomNav';
import { MobileHomeTab } from '@/components/mobile-app/tabs/MobileHomeTab';
import { MobileStakingTab } from '@/components/mobile-app/tabs/MobileStakingTab';
import { MobileRaceTab } from '@/components/mobile-app/tabs/MobileRaceTab';
import { MobileBurnTab } from '@/components/mobile-app/tabs/MobileBurnTab';
import { MobileFarmTab } from '@/components/mobile-app/tabs/MobileFarmTab';
import { MobileSwapTab } from '@/components/mobile-app/tabs/MobileSwapTab';
import { MobileFeaturesTab } from '@/components/mobile-app/tabs/MobileFeaturesTab';
import { MobileChatTab } from '@/components/mobile-app/tabs/MobileChatTab';
import { MobileProfileTab } from '@/components/mobile-app/tabs/MobileProfileTab';
import { MobileSettingsSheet } from '@/components/mobile-app/MobileSettingsSheet';
import { MobilePoolDetail, PoolType } from '@/components/mobile-app/MobilePoolDetail';

export type MobileTab = 'home' | 'features' | 'chat' | 'swap' | 'portfolio' | 'profile' | 'settings' | 'staking' | 'race' | 'burn' | 'farm' | 'pool-detail';

// Theme context for mobile app
interface MobileThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
}

export const MobileThemeContext = createContext<MobileThemeContextType>({
  isDark: true,
  toggleTheme: () => {},
});

export const useMobileTheme = () => useContext(MobileThemeContext);

const MobileApp = () => {
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [isDark, setIsDark] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedPool, setSelectedPool] = useState<{ id: string; type: PoolType } | null>(null);

  const toggleTheme = () => setIsDark(!isDark);

  const handleTabChange = (tab: MobileTab) => {
    if (tab === 'settings') {
      setSettingsOpen(true);
    } else if (tab === 'portfolio') {
      // Map portfolio to profile
      setActiveTab('profile');
      setSelectedPool(null);
    } else {
      setActiveTab(tab);
      setSelectedPool(null);
    }
  };

  const handleOpenPool = (poolId: string, poolType: PoolType) => {
    setSelectedPool({ id: poolId, type: poolType });
    setActiveTab('pool-detail');
  };

  const handleBackFromPool = () => {
    setSelectedPool(null);
    setActiveTab('home');
  };

  const renderTab = () => {
    // Show pool detail if selected
    if (activeTab === 'pool-detail' && selectedPool) {
      return (
        <MobilePoolDetail 
          poolId={selectedPool.id} 
          poolType={selectedPool.type} 
          onBack={handleBackFromPool}
        />
      );
    }

    switch (activeTab) {
      case 'home':
        return <MobileHomeTab onNavigate={setActiveTab} onOpenPool={handleOpenPool} />;
      case 'features':
        return <MobileFeaturesTab onNavigate={setActiveTab} onOpenPool={handleOpenPool} />;
      case 'chat':
        return <MobileChatTab />;
      case 'swap':
        return <MobileSwapTab />;
      case 'profile':
        return <MobileProfileTab onOpenPool={handleOpenPool} />;
      case 'staking':
        return <MobileStakingTab />;
      case 'race':
        return <MobileRaceTab />;
      case 'burn':
        return <MobileBurnTab />;
      case 'farm':
        return <MobileFarmTab />;
      default:
        return <MobileHomeTab onNavigate={setActiveTab} onOpenPool={handleOpenPool} />;
    }
  };

  return (
    <MobileThemeContext.Provider value={{ isDark, toggleTheme }}>
      <div className={isDark ? "min-h-screen bg-[#0a0a0a] text-white" : "min-h-screen bg-gray-50 text-gray-900"}>
        {activeTab !== 'pool-detail' && <MobileAppHeader onNavigate={handleTabChange} />}
        
        <main className={activeTab === 'pool-detail' ? "" : "pb-24 pt-2"}>
          {renderTab()}
        </main>
        
        {activeTab !== 'pool-detail' && (
          <MobileBottomNav activeTab={activeTab === 'profile' ? 'portfolio' : activeTab} onTabChange={handleTabChange} />
        )}
        
        <MobileSettingsSheet 
          open={settingsOpen} 
          onOpenChange={setSettingsOpen}
          onNavigate={(tab) => {
            setActiveTab(tab);
            setSettingsOpen(false);
          }}
        />
      </div>
    </MobileThemeContext.Provider>
  );
};

export default MobileApp;
