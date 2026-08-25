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
  const { activeOutlet, outlets, closingInfo, isHeadOffice } = useOutlet();
  const { isOnline } = usePWA();
  const [viewMode, setViewMode] = React.useState<'outlet' | 'executive'>(() => {
    return isHeadOffice ? 'executive' : 'outlet';
  });

  // If user is scoped to a specific outlet or non-head-office, default to Outlet Dashboard
  if (!isHeadOffice || viewMode === 'outlet') {
    return (
      <div className="space-y-4">
        {isHeadOffice && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] text-xs shadow-xs">
            <div className="flex items-center gap-2 text-[#707070]">
              <Building2 className="w-4 h-4 text-[#C79A3B] shrink-0" />
              <span>
                <strong className="text-[#1C1C1C]">Head Office Mode:</strong> Viewing single outlet operational command cockpit
              </span>
            </div>
            <button
              onClick={() => setViewMode('executive')}
              className="px-3.5 py-1.5 rounded-xl bg-[#1C1C1C] hover:bg-[#2D2D2D] text-white font-bold text-xs transition-all shadow-xs active:scale-[0.98] shrink-0 text-center"
            >
              Switch to Group Executive View
            </button>
          </div>
        )}
        <OutletDashboard
          branchId={activeOutlet.id !== 'all' ? activeOutlet.id : undefined}
          setActiveWorkspace={setActiveWorkspace}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] text-xs shadow-xs">
        <div className="flex items-center gap-2 text-[#707070]">
          <Building2 className="w-4 h-4 text-[#C79A3B] shrink-0" />
          <span>
            <strong className="text-[#1C1C1C]">Head Office Mode:</strong> Admin / Owner dashboard across all outlets
          </span>
        </div>
        <button
          onClick={() => setViewMode('outlet')}
          className="px-3.5 py-1.5 rounded-xl bg-[#1C1C1C] hover:bg-[#2D2D2D] text-white font-bold text-xs transition-all shadow-xs active:scale-[0.98] shrink-0 text-center"
        >
          Open Single-Outlet Cockpit
        </button>
      </div>
      <AdminOwnerDashboard setActiveWorkspace={setActiveWorkspace} />
    </div>
  );
};

export default DashboardOverview;