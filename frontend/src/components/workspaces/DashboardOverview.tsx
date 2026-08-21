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

interface DashboardOverviewProps {
  health: SystemHealth | null;
  setActiveWorkspace: (id: WorkspaceId) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ health, setActiveWorkspace }) => {
  const { activeOutlet, outlets, closingInfo, isHeadOffice } = useOutlet();
  const { isOnline } = usePWA();

  const quickActions = [
    {
      id: 'assistant' as WorkspaceId,
      title: 'Smart AI Assistant',
      desc: 'Stock intelligence & conversational queries',
      icon: Sparkles,
      color: 'from-[#C79A3B]/20 to-[#B8862D]/15 text-[#B8862D]',
    },
    {
      id: 'organization' as WorkspaceId,
      title: '14+ Outlets Matrix',
      desc: 'Inspect corporate topology & rosters',
      icon: Building2,
      color: 'from-[#C79A3B]/15 to-[#B8862D]/15 text-[#B8862D]',
    },
    {
      id: 'inventory' as WorkspaceId,
      title: 'Stock & Inventory',
      desc: 'Verify balances & physical stock',
      icon: Boxes,
      color: 'from-[#3978B8]/15 to-[#3978B8]/5 text-[#3978B8]',
    },
    {
      id: 'purchase' as WorkspaceId,
      title: 'Central Purchase PO',
      desc: 'Review outlet PRs & direct supplier PO',
      icon: ShoppingCart,
      color: 'from-[#2E8B57]/15 to-[#2E8B57]/5 text-[#2E8B57]',
    },
    {
      id: 'production' as WorkspaceId,
      title: 'Recipes & Production',
      desc: 'Commissary BOM & batch orders',
      icon: ChefHat,
      color: 'from-[#D99625]/15 to-[#D99625]/5 text-[#D99625]',
    },
    {
      id: 'transfers' as WorkspaceId,
      title: 'Store Transfers',
      desc: 'Commissary to outlet stock dispatch',
      icon: Truck,
      color: 'from-[#6B5B95]/15 to-[#6B5B95]/5 text-[#6B5B95]',
    },
    {
      id: 'closing' as WorkspaceId,
      title: 'Bi-Monthly Closing',
      desc: 'Reconciliation & food cost variance',
      icon: CalendarDays,
      color: 'from-[#C79A3B]/20 to-[#FAF8F5] text-[#B8862D]',
    },
    {
      id: 'reports' as WorkspaceId,
      title: 'Executive Analytics',
      desc: 'Food cost variance, sales & spend',
      icon: BarChart3,
      color: 'from-[#2E8B57]/20 to-[#FAF8F5] text-[#2E8B57]',
    },
    {
      id: 'hr' as WorkspaceId,
      title: 'HR & Personnel Roster',
      desc: 'Staff profiles, shifts & payroll math',
      icon: Users,
      color: 'from-[#3978B8]/20 to-[#FAF8F5] text-[#3978B8]',
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 w-full min-w-0">
      {/* Top Banner / Executive Hero */}
      <div className="relative overflow-hidden luxury-card p-4 sm:p-6 md:p-8 bg-gradient-to-br from-white via-white/95 to-[#FAF8F5] border border-[rgba(45,45,45,0.08)] shadow-[0_4px_24px_rgba(45,45,45,0.04)] rounded-2xl sm:rounded-3xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-[#C79A3B]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 sm:gap-6">
          <div className="space-y-1.5 sm:space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-[#F1E4C5] text-[#B8862D] border border-[#B8862D]/30 shadow-xs">
              <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="truncate">APEX ENTERPRISE ERP · MULTI-OUTLET CORE</span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-[#1C1C1C] font-['Outfit']">
              Executive Control Cockpit
            </h1>
            <p className="text-xs sm:text-sm text-[#707070] flex flex-wrap items-center gap-1.5">
              <span>Active Scope:</span>
              <span className="text-[#1C1C1C] font-bold">{activeOutlet.name}</span>
              <Badge variant="outlet">[{activeOutlet.code}]</Badge>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
            <div className="flex items-center gap-2 p-2.5 sm:px-4 sm:py-2.5 rounded-xl bg-white border border-[rgba(45,45,45,0.08)] shadow-xs">
              <Server className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#C79A3B] shrink-0" />
              <div className="text-[11px] sm:text-xs text-left min-w-0">
                <p className="text-[#707070] font-medium text-[10px] sm:text-[11px] truncate">Backend Engine</p>
                <p className="font-semibold text-[#1C1C1C] truncate">FastAPI · Python</p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2.5 sm:px-4 sm:py-2.5 rounded-xl bg-white border border-[rgba(45,45,45,0.08)] shadow-xs">
              <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#2E8B57] shrink-0" />
              <div className="text-[11px] sm:text-xs text-left min-w-0">
                <p className="text-[#707070] font-medium text-[10px] sm:text-[11px] truncate">Database</p>
                <p className="font-semibold text-[#1C1C1C] truncate">PostgreSQL</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metric Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
        <StatCard
          title="Total Outlets"
          value={outlets.length}
          subtitle="14 Outlets + 2 Hubs"
          icon={<Building2 className="w-4 h-4 text-[#C79A3B]" />}
          iconBgColor="bg-[#FAF8F5] text-[#C79A3B]"
          onClick={() => setActiveWorkspace('organization')}
        />

        <StatCard
          title="Purchase PO"
          value="Direct PO"
          subtitle="Direct Vendor GRN"
          icon={<Truck className="w-4 h-4 text-[#3978B8]" />}
          iconBgColor="bg-blue-50 text-[#3978B8]"
          onClick={() => setActiveWorkspace('purchase')}
        />

        <StatCard
          title="Closing Cycle"
          value={closingInfo.periodType === 'FIRST_HALF' ? '1st–15th' : '16th–End'}
          subtitle={`${closingInfo.daysRemaining} days remaining`}
          icon={<CalendarCheck className="w-4 h-4 text-[#B8862D]" />}
          iconBgColor="bg-[#F1E4C5]/40 text-[#B8862D]"
          onClick={() => setActiveWorkspace('closing')}
        />

        <StatCard
          title="Health"
          value={health?.database?.status === 'connected' ? 'Healthy' : 'Active'}
          subtitle={health?.database?.latencyMs ? `${health.database.latencyMs}ms DB latency` : 'Strict multi-tenant'}
          icon={<Cpu className="w-4 h-4 text-[#2E8B57]" />}
          iconBgColor="bg-[#2E8B57]/10 text-[#2E8B57]"
          onClick={() => setActiveWorkspace('telemetry')}
        />
      </div>

      {/* Quick Launch Workspaces Grid */}
      <div className="space-y-2.5 sm:space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#C79A3B]" />
            Enterprise Function Workspaces
          </h2>
          <span className="text-[11px] text-[#707070] hidden sm:inline">Select a workspace to open dedicated operations</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <div
                key={action.id}
                onClick={() => setActiveWorkspace(action.id)}
                className="p-3.5 sm:p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-xs hover:shadow-md hover:border-[#C79A3B]/40 transition-all cursor-pointer group flex items-center justify-between active:scale-[0.99]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br ${action.color} border border-black/5 flex items-center justify-center shrink-0`}>
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-xs sm:text-sm text-[#1C1C1C] font-['Outfit'] group-hover:text-[#B8862D] transition-colors truncate">
                      {action.title}
                    </h3>
                    <p className="text-[11px] text-[#707070] truncate mt-0.5">{action.desc}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#707070] group-hover:text-[#B8862D] group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Operational Principles Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white/85 border border-[rgba(45,45,45,0.08)] space-y-2.5 sm:space-y-3 shadow-xs">
        <h3 className="text-xs sm:text-sm font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#2E8B57] shrink-0" />
          Multi-Outlet Scoping & Food Cost Control Architecture
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3 text-xs text-[#707070]">
          <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] space-y-1">
            <span className="font-bold text-[#1C1C1C] text-xs block">Strict Outlet Isolation</span>
            <p className="text-[11px] leading-relaxed">Every query, request, and stock transfer enforces authorized outlet context. Head Office retains consolidated oversight.</p>
          </div>
          <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] space-y-1">
            <span className="font-bold text-[#1C1C1C] text-xs block">Direct Destination Delivery</span>
            <p className="text-[11px] leading-relaxed">Purchase Orders direct suppliers to deliver straight to retail outlets, generating local GRN with zero intermediate double-handling.</p>
          </div>
          <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] space-y-1">
            <span className="font-bold text-[#1C1C1C] text-xs block">Bi-Monthly Closing Verification</span>
            <p className="text-[11px] leading-relaxed">Rigorous 1st–15th & 16th–End physical stock audits computing exact variances against POS theoretical consumption.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
