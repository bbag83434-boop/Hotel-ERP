'use client';

import React from 'react';
import { useOutlet } from '@/context/OutletContext';
import { useAuth } from '@/context/AuthContext';
import { WorkspaceId } from '@/components/common/Sidebar';
import OutletDashboard from '@/components/workspaces/OutletDashboard';
import AdminOwnerDashboard from '@/components/workspaces/AdminOwnerDashboard';
import { SystemHealth } from '@/types';

interface DashboardOverviewProps {
  health: SystemHealth | null;
  setActiveWorkspace: (id: WorkspaceId) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ setActiveWorkspace }) => {
  const { activeOutlet, isHeadOffice } = useOutlet();
  const { user } = useAuth();

  const userRole = typeof user?.role === 'object' ? user.role.name : (user?.role || '');
  const isAdmin = [
    'SUPER_ADMIN',
    'SUPERADMIN',
    'OWNER',
    'ADMIN',
    'HQ_ADMIN',
    'HEAD_OFFICE_ADMIN',
  ].includes(userRole.toUpperCase());

  if (!isAdmin && !isHeadOffice) {
    return (
      <div className="w-full">
        <OutletDashboard
          branchId={activeOutlet.id !== 'all' ? activeOutlet.id : undefined}
          setActiveWorkspace={setActiveWorkspace}
        />
      </div>
    );
  }

  return (
    <div className="w-full">
      <AdminOwnerDashboard setActiveWorkspace={setActiveWorkspace} />
    </div>
  );
};

export default DashboardOverview;