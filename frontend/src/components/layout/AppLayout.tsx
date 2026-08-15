import React from 'react';
import { Outlet } from 'react-router-dom';
import { TopAppBar } from './TopAppBar';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { PwaInstallBanner } from './PwaInstallBanner';

export const AppLayout: React.FC = () => {
  return (
    <div className="h-full flex flex-col bg-[#0c0c0e] text-white overflow-hidden select-none">
      <PwaInstallBanner />
      <TopAppBar />
      <div className="flex-1 flex overflow-hidden">
        <DesktopSidebar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 lg:pb-8 bg-[#0c0c0e]">
          <div className="max-w-7xl mx-auto space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
};
