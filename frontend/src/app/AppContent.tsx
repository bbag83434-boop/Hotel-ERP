'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useOutlet } from '@/context/OutletContext';
import { usePWA } from '@/context/PWAContext';
import { apiClient } from '@/api/client';
import { SystemHealth } from '@/types';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Sidebar, { WorkspaceId } from '@/components/common/Sidebar';

// Workspaces
import DashboardOverview from '@/components/workspaces/DashboardOverview';
import OrganizationManager from '@/components/organization/OrganizationManager';
import InventoryManager from '@/components/inventory/InventoryManager';
import TransfersWorkspace from '@/components/workspaces/TransfersWorkspace';
import PurchaseWorkspace from '@/components/workspaces/PurchaseWorkspace';
import ProductionWorkspace from '@/components/workspaces/ProductionWorkspace';
import WastageWorkspace from '@/components/workspaces/WastageWorkspace';
import HRWorkspace from '@/components/workspaces/HRWorkspace';
import ClosingWorkspace from '@/components/workspaces/ClosingWorkspace';
import ReportsWorkspace from '@/components/workspaces/ReportsWorkspace';
import TelemetryWorkspace from '@/components/workspaces/TelemetryWorkspace';
import AIAssistantWorkspace from '@/components/workspaces/AIAssistantWorkspace';

export const AppContent = () => {
  const { activeOutlet } = useOutlet();
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loadingHealth, setLoadingHealth] = useState<boolean>(true);

  const fetchHealth = useCallback(async () => {
    try {
      setLoadingHealth(true);
      const res = await apiClient.get('/health');
      if (res.data?.data) {
        setHealth(res.data.data);
      }
    } catch (err) {
      console.warn('Backend telemetry unreachable or offline:', err);
    } finally {
      setLoadingHealth(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  return (
    <div className="flex min-h-screen bg-[#F5F3EE] text-[#1C1C1C]">
      <Sidebar
        activeWorkspace={activeWorkspace}
        setActiveWorkspace={setActiveWorkspace}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setMobileSidebarOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-12">
          {activeWorkspace === 'dashboard' && (
            <DashboardOverview health={health} setActiveWorkspace={setActiveWorkspace} />
          )}

          {activeWorkspace === 'organization' && (
            <div className="luxury-card p-6 bg-white/85 border border-[rgba(45,45,45,0.08)] shadow-[0_4px_24px_rgba(45,45,45,0.03)]">
              <OrganizationManager />
            </div>
          )}

          {activeWorkspace === 'inventory' && (
            <div className="luxury-card p-6 bg-white/85 border border-[rgba(45,45,45,0.08)] shadow-[0_4px_24px_rgba(45,45,45,0.03)]">
              <InventoryManager />
            </div>
          )}

          {activeWorkspace === 'transfers' && (
            <div className="luxury-card p-6 bg-white/85 border border-[rgba(45,45,45,0.08)] shadow-[0_4px_24px_rgba(45,45,45,0.03)]">
              <TransfersWorkspace />
            </div>
          )}

          {activeWorkspace === 'purchase' && (
            <div className="luxury-card p-6 bg-white/85 border border-[rgba(45,45,45,0.08)] shadow-[0_4px_24px_rgba(45,45,45,0.03)]">
              <PurchaseWorkspace />
            </div>
          )}

          {activeWorkspace === 'production' && (
            <div className="luxury-card p-6 bg-white/85 border border-[rgba(45,45,45,0.08)] shadow-[0_4px_24px_rgba(45,45,45,0.03)]">
              <ProductionWorkspace />
            </div>
          )}

          {activeWorkspace === 'wastage' && (
            <div className="luxury-card p-6 bg-white/85 border border-[rgba(45,45,45,0.08)] shadow-[0_4px_24px_rgba(45,45,45,0.03)]">
              <WastageWorkspace />
            </div>
          )}

          {activeWorkspace === 'hr' && (
            <div className="luxury-card p-6 bg-white/85 border border-[rgba(45,45,45,0.08)] shadow-[0_4px_24px_rgba(45,45,45,0.03)]">
              <HRWorkspace />
            </div>
          )}

          {activeWorkspace === 'closing' && (
            <div className="luxury-card p-6 bg-white/85 border border-[rgba(45,45,45,0.08)] shadow-[0_4px_24px_rgba(45,45,45,0.03)]">
              <ClosingWorkspace />
            </div>
          )}

          {activeWorkspace === 'reports' && (
            <div className="luxury-card p-6 bg-white/85 border border-[rgba(45,45,45,0.08)] shadow-[0_4px_24px_rgba(45,45,45,0.03)]">
              <ReportsWorkspace />
            </div>
          )}

          {activeWorkspace === 'telemetry' && (
            <div className="luxury-card p-6 bg-white/85 border border-[rgba(45,45,45,0.08)] shadow-[0_4px_24px_rgba(45,45,45,0.03)]">
              <TelemetryWorkspace
                health={health}
                loading={loadingHealth}
                onRefresh={fetchHealth}
              />
            </div>
          )}

          {activeWorkspace === 'assistant' && (
            <div className="luxury-card p-6 bg-white/85 border border-[rgba(45,45,45,0.08)] shadow-[0_4px_24px_rgba(45,45,45,0.03)]">
              <AIAssistantWorkspace activeOutlet={activeOutlet} />
            </div>
          )}
        </main>

        <BottomNav
          activeTab={activeWorkspace}
          setActiveTab={(tab) => setActiveWorkspace(tab as WorkspaceId)}
        />
      </div>
    </div>
  );
};
