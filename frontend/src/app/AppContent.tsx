'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useOutlet } from '@/context/OutletContext';
import { usePWA } from '@/context/PWAContext';
import { apiClient } from '@/api/client';
import { SystemHealth } from '@/types';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Sidebar, { WorkspaceId } from '@/components/common/Sidebar';

// Workspaces
import DashboardOverview from '@/components/workspaces/DashboardOverview';
import UserManagementWorkspace from '@/components/workspaces/UserManagementWorkspace';
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
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { activeOutlet, isHeadOffice, canInitiateTransfers } = useOutlet();
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loadingHealth, setLoadingHealth] = useState<boolean>(true);

  const isAllowedWorkspace = (ws: WorkspaceId): boolean => {
    if (isHeadOffice) return true;
    if (ws === 'dashboard' || ws === 'assistant' || ws === 'purchase' || ws === 'wastage') return true;
    if (ws === 'transfers' && canInitiateTransfers) return true;
    return false;
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Guard tier-restricted navigation: redirect to dashboard if workspace is not permitted
  useEffect(() => {
    if (!isHeadOffice && !isAllowedWorkspace(activeWorkspace)) {
      setActiveWorkspace('dashboard');
    }
  }, [isHeadOffice, canInitiateTransfers, activeWorkspace]);

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
    if (isAuthenticated) {
      fetchHealth();
    }
  }, [fetchHealth, isAuthenticated]);

  if (authLoading || !isAuthenticated) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F5F3EE]">Loading...</div>;
  }

  return (
    <div className="flex min-h-screen bg-[#F5F3EE] text-[#1C1C1C] overflow-x-hidden w-full max-w-full">
      <Sidebar
        activeWorkspace={activeWorkspace}
        setActiveWorkspace={setActiveWorkspace}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
      />

      <div className="flex-1 flex flex-col min-w-0 w-full overflow-x-hidden">
        <Header onMenuClick={() => setMobileSidebarOpen(true)} setActiveWorkspace={setActiveWorkspace} />

        <main className="flex-1 p-3 sm:p-5 lg:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-12 min-w-0 overflow-x-hidden">
          {/* Dashboard and other workspaces render here */}
          {(activeWorkspace === 'dashboard' || !isAllowedWorkspace(activeWorkspace)) && (
            <div className="w-full min-w-0">
              <DashboardOverview health={health} setActiveWorkspace={setActiveWorkspace} />
            </div>
          )}

          {activeWorkspace === 'users' && isAllowedWorkspace('users') && (
            <div className="w-full min-w-0">
              <UserManagementWorkspace />
            </div>
          )}

          {activeWorkspace === 'organization' && isAllowedWorkspace('organization') && (
            <div className="w-full min-w-0">
              <OrganizationManager />
            </div>
          )}

          {activeWorkspace === 'inventory' && isAllowedWorkspace('inventory') && (
            <div className="w-full min-w-0">
              <InventoryManager />
            </div>
          )}

          {activeWorkspace === 'transfers' && isAllowedWorkspace('transfers') && (
            <div className="w-full min-w-0">
              <TransfersWorkspace />
            </div>
          )}

          {activeWorkspace === 'purchase' && isAllowedWorkspace('purchase') && (
            <div className="w-full min-w-0">
              <PurchaseWorkspace />
            </div>
          )}

          {activeWorkspace === 'production' && isAllowedWorkspace('production') && (
            <div className="w-full min-w-0">
              <ProductionWorkspace />
            </div>
          )}

          {activeWorkspace === 'wastage' && isAllowedWorkspace('wastage') && (
            <div className="w-full min-w-0">
              <WastageWorkspace />
            </div>
          )}

          {activeWorkspace === 'hr' && isAllowedWorkspace('hr') && (
            <div className="w-full min-w-0">
              <HRWorkspace />
            </div>
          )}

          {activeWorkspace === 'closing' && isAllowedWorkspace('closing') && (
            <div className="w-full min-w-0">
              <ClosingWorkspace />
            </div>
          )}

          {activeWorkspace === 'reports' && isAllowedWorkspace('reports') && (
            <div className="w-full min-w-0">
              <ReportsWorkspace />
            </div>
          )}

          {activeWorkspace === 'telemetry' && isAllowedWorkspace('telemetry') && (
            <div className="w-full min-w-0">
              <TelemetryWorkspace
                health={health}
                loading={loadingHealth}
                onRefresh={fetchHealth}
              />
            </div>
          )}

          {activeWorkspace === 'assistant' && isAllowedWorkspace('assistant') && (
            <div className="w-full min-w-0">
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
