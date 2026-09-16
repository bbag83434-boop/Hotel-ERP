'use client';

import React from 'react';
import { useOutlet } from '@/context/OutletContext';
import { useAuth } from '@/context/AuthContext';
import { usePWA } from '@/context/PWAContext';
import { SystemHealth } from '@/types';
import { WorkspaceId } from '@/components/common/Sidebar';
import OutletDashboard from '@/components/workspaces/OutletDashboard';
import AdminOwnerDashboard from '@/components/workspaces/AdminOwnerDashboard';
import CentralStoreDashboard from '@/components/workspaces/CentralStoreDashboard';

interface DashboardOverviewProps {
  health: SystemHealth | null;
  setActiveWorkspace: (id: WorkspaceId) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  health: _health,
  setActiveWorkspace,
}) => {
  const { activeOutlet } = useOutlet();
  const { isOnline: _isOnline } = usePWA();
  const { user } = useAuth();

  const userRole =
    typeof user?.role === 'object'
      ? user.role.name
      : user?.role || '';

  const isAdmin = [
    'SUPER_ADMIN',
    'SUPERADMIN',
    'OWNER',
    'ADMIN',
    'HQ_ADMIN',
    'HEAD_OFFICE_ADMIN',
  ].includes(String(userRole).toUpperCase());

  const activeOutletAny = activeOutlet as any;

  /*
   * IMPORTANT:
   * An outlet is considered selected only when it has a real outlet ID.
   * "all" and empty ID mean no single outlet is selected.
   */
  const hasSelectedOutlet = Boolean(
    activeOutlet?.id &&
    activeOutlet.id !== 'all'
  );

  /*
   * Central Store has its own dashboard.
   */
  const isCentralStore =
    String(
      activeOutletAny?.type ||
      activeOutletAny?.branch_type ||
      ''
    ).toUpperCase() === 'CENTRAL_STORE';

  /*
   * 1. CENTRAL STORE
   *
   * Central Store must always use Central Store Dashboard.
   */
  if (isCentralStore) {
    return (
      <CentralStoreDashboard
        setActiveWorkspace={setActiveWorkspace}
      />
    );
  }

  /*
   * 2. SINGLE OUTLET SELECTED
   *
   * THIS IS THE IMPORTANT FIX.
   *
   * Even when the logged-in user is ADMIN,
   * selecting an outlet means the dashboard must become
   * that outlet's operational dashboard.
   *
   * Example:
   * Salt Lake selected
   *   -> Salt Lake Dashboard
   *
   * Digha selected
   *   -> Digha Dashboard
   */
  if (hasSelectedOutlet) {
    return (
      <OutletDashboard
        branchId={activeOutlet!.id}
        setActiveWorkspace={setActiveWorkspace}
      />
    );
  }

  /*
   * 3. NO SINGLE OUTLET SELECTED
   *
   * Admin / Owner sees the group Executive Dashboard.
   */
  if (isAdmin) {
    return (
      <AdminOwnerDashboard
        setActiveWorkspace={setActiveWorkspace}
      />
    );
  }

  /*
   * 4. NON-ADMIN USER WITHOUT A SELECTED OUTLET
   *
   * Keep the existing OutletDashboard fallback.
   */
  return (
    <OutletDashboard
      branchId={undefined}
      setActiveWorkspace={setActiveWorkspace}
    />
  );
};

export default DashboardOverview;