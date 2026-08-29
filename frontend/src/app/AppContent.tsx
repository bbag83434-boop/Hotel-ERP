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
import AIAgentWorkspace from '@/components/workspaces/AIAgentWorkspace';
import OrdersWorkspace from '@/components/workspaces/OrdersWorkspace';
import KDSWorkspace from '@/components/workspaces/KDSWorkspace';
import AutomationWorkspace from '@/components/workspaces/AutomationWorkspace';
import SecurityWorkspace from '@/components/workspaces/SecurityWorkspace';
import CRMWorkspace from '@/components/workspaces/CRMWorkspace';
import MaintenanceWorkspace from '@/components/workspaces/MaintenanceWorkspace';
import BeverageWorkspace from '@/components/workspaces/BeverageWorkspace';
import FinanceWorkspace from '@/components/workspaces/FinanceWorkspace';
import HotelOperationsWorkspace from '@/components/workspaces/HotelOperationsWorkspace';
import ApprovalCenterWorkspace from '@/components/workspaces/ApprovalCenterWorkspace';
import MultiOutletIntelligenceWorkspace from '@/components/workspaces/MultiOutletIntelligenceWorkspace';
import CashierShiftWorkspace from '@/components/workspaces/CashierShiftWorkspace';
import FinanceControlWorkspace from '@/components/workspaces/FinanceControlWorkspace';
import ScheduledReportsAlertsWorkspace from '@/components/workspaces/ScheduledReportsAlertsWorkspace';
import SupplierPerformanceWorkspace from '@/components/workspaces/SupplierPerformanceWorkspace';
import AIProviderWorkspace from '@/components/workspaces/AIProviderWorkspace';
import AIControlledToolsWorkspace from '@/components/workspaces/AIControlledToolsWorkspace';
import TelegramNotificationWorkspace from '@/components/workspaces/TelegramNotificationWorkspace';
import AIDocumentProcessingWorkspace from '@/components/workspaces/AIDocumentProcessingWorkspace';
import AIWastageSalesIntelligenceWorkspace from '@/components/workspaces/AIWastageSalesIntelligenceWorkspace';
import WhatsAppBusinessWorkspace from '@/components/workspaces/WhatsAppBusinessWorkspace';

export const AppContent = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { activeOutlet } = useOutlet();
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loadingHealth, setLoadingHealth] = useState<boolean>(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

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
        <Header onMenuClick={() => setMobileSidebarOpen(true)} />

        <main className="flex-1 p-3 sm:p-5 lg:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-12 min-w-0 overflow-x-hidden">
          {/* Dashboard and other workspaces render here */}
          {activeWorkspace === 'supplierPerformance' && (
            <div className="w-full min-w-0"><SupplierPerformanceWorkspace /></div>
          )}

          {activeWorkspace === 'scheduledReports' && (
            <div className="w-full min-w-0"><ScheduledReportsAlertsWorkspace /></div>
          )}

          {activeWorkspace === 'multiOutlet' && (
            <div className="w-full min-w-0"><MultiOutletIntelligenceWorkspace /></div>
          )}

          {activeWorkspace === 'financeControl' && (
            <div className="w-full min-w-0"><FinanceControlWorkspace /></div>
          )}

          {activeWorkspace === 'dashboard' && (
            <div className="w-full min-w-0">
              <DashboardOverview health={health} setActiveWorkspace={setActiveWorkspace} />
            </div>
          )}

          {activeWorkspace === 'users' && (
            <div className="w-full min-w-0">
              <UserManagementWorkspace />
            </div>
          )}

          {activeWorkspace === 'organization' && (
            <div className="w-full min-w-0">
              <OrganizationManager />
            </div>
          )}

          {activeWorkspace === 'kds' && (
            <div className="w-full min-w-0">
              <KDSWorkspace />
            </div>
          )}

          {activeWorkspace === 'cashierShift' && (
            <div className="w-full min-w-0"><CashierShiftWorkspace /></div>
          )}

          {activeWorkspace === 'orders' && (
            <div className="w-full min-w-0">
              <OrdersWorkspace />
            </div>
          )}

          {activeWorkspace === 'inventory' && (
            <div className="w-full min-w-0">
              <InventoryManager />
            </div>
          )}

          {activeWorkspace === 'transfers' && (
            <div className="w-full min-w-0">
              <TransfersWorkspace />
            </div>
          )}

          {activeWorkspace === 'purchase' && (
            <div className="w-full min-w-0">
              <PurchaseWorkspace onNavigateWorkspace={setActiveWorkspace} />
            </div>
          )}

          {activeWorkspace === 'production' && (
            <div className="w-full min-w-0">
              <ProductionWorkspace />
            </div>
          )}

          {activeWorkspace === 'wastage' && (
            <div className="w-full min-w-0">
              <WastageWorkspace />
            </div>
          )}

          {activeWorkspace === 'hr' && (
            <div className="w-full min-w-0">
              <HRWorkspace />
            </div>
          )}

          {activeWorkspace === 'closing' && (
            <div className="w-full min-w-0">
              <ClosingWorkspace />
            </div>
          )}

          {activeWorkspace === 'crm' && (
            <div className="w-full min-w-0">
              <CRMWorkspace />
            </div>
          )}

          {activeWorkspace === 'maintenance' && (
            <div className="w-full min-w-0">
              <MaintenanceWorkspace />
            </div>
          )}

          {activeWorkspace === 'beverage' && (
            <div className="w-full min-w-0"><BeverageWorkspace /></div>
          )}

          {activeWorkspace === 'hotel' && (
            <div className="w-full min-w-0"><HotelOperationsWorkspace /></div>
          )}

          {activeWorkspace === 'finance' && (
            <div className="w-full min-w-0"><FinanceWorkspace /></div>
          )}

          {activeWorkspace === 'approvals' && (
            <div className="w-full min-w-0"><ApprovalCenterWorkspace /></div>
          )}

          {activeWorkspace === 'security' && (
            <div className="w-full min-w-0">
              <SecurityWorkspace />
            </div>
          )}

          {activeWorkspace === 'automation' && (
            <div className="w-full min-w-0">
              <AutomationWorkspace />
            </div>
          )}

          {activeWorkspace === 'reports' && (
            <div className="w-full min-w-0">
              <ReportsWorkspace />
            </div>
          )}

          {activeWorkspace === 'telemetry' && (
            <div className="w-full min-w-0">
              <TelemetryWorkspace
                health={health}
                loading={loadingHealth}
                onRefresh={fetchHealth}
              />
            </div>
          )}

          {activeWorkspace === 'aiAgent' && (
            <div className="w-full min-w-0">
              <AIAgentWorkspace activeOutlet={activeOutlet} />
            </div>
          )}

          {activeWorkspace === 'aiProvider' && (
            <div className="w-full min-w-0"><AIProviderWorkspace /></div>
          )}
          {activeWorkspace === 'aiTools' && (
            <div className="w-full min-w-0"><AIControlledToolsWorkspace /></div>
          )}
          {activeWorkspace === 'aiDocuments' && (
            <div className="w-full min-w-0"><AIDocumentProcessingWorkspace /></div>
          )}

          {activeWorkspace === 'telegramNotifications' && (
            <div className="w-full min-w-0"><TelegramNotificationWorkspace /></div>
          )}

          {activeWorkspace === 'aiWastageSales' && (
            <div className="w-full min-w-0"><AIWastageSalesIntelligenceWorkspace /></div>
          )}

          {activeWorkspace === 'whatsappBusiness' && (
            <div className="w-full min-w-0"><WhatsAppBusinessWorkspace /></div>
          )}

          {activeWorkspace === 'assistant' && (
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
