import React, { useState } from 'react';
import { PWAProvider } from './context/PWAContext';
import { OutletProvider } from './context/OutletContext';
import { Header } from './components/common/Header';
import { BottomNav } from './components/common/BottomNav';
import { PWAInstallBanner } from './components/common/PWAInstallBanner';
import { OfflineBanner } from './components/common/OfflineBanner';
import { Dashboard } from './pages/Dashboard';

export const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-white flex flex-col font-['Inter'] selection:bg-[#d4a437]/20 selection:text-[#d4a437]">
      {/* Top Fixed Header */}
      <Header />

      {/* Offline Alert Banner */}
      <OfflineBanner />

      {/* Main Body Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-5 pb-16">
        <PWAInstallBanner />
        <Dashboard activeTab={activeTab} />
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <PWAProvider>
      <OutletProvider>
        <AppContent />
      </OutletProvider>
    </PWAProvider>
  );
};

export default App;
