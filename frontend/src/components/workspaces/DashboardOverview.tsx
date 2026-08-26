'use client';

import React from 'react';
import { useOutlet } from '@/context/OutletContext';
import { usePWA } from '@/context/PWAContext';
import { SystemHealth } from '@/types';
import { WorkspaceId } from '@/components/common/Sidebar';
import {
  Building2,
  Cpu,
  Layers,
  CalendarCheck,
  TrendingUp,
  ShieldCheck,
  Zap,
  ArrowRight,
  Server,
  Activity,
  CheckCircle2,
  AlertCircle,
  Truck,
  Sparkles,
  Boxes,
  ShoppingCart,
  ChefHat,
  Users,
  BarChart3,
  CalendarDays,
  ExternalLink,
  Bot,
} from 'lucide-react';
import { Badge, Button, StatCard } from '@/components/ui';
import OutletDashboard from '@/components/workspaces/OutletDashboard';
import AdminOwnerDashboard from '@/components/workspaces/AdminOwnerDashboard';

interface DashboardOverviewProps {
  health: SystemHealth | null;
  setActiveWorkspace: (id: WorkspaceId) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ health, setActiveWorkspace }) => {
  const { activeOutlet, isHeadOffice } = useOutlet();

  if (isHeadOffice) {
    return <AdminOwnerDashboard setActiveWorkspace={setActiveWorkspace} />;
  }

  return (
    <OutletDashboard
      branchId={activeOutlet.id !== 'all' ? activeOutlet.id : undefined}
      setActiveWorkspace={setActiveWorkspace}
    />
  );
};

export default DashboardOverview;