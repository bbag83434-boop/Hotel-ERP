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
    <div className="space-y-6">
      {/* Top Banner / Executive Hero */}
      <div className="relative overflow-hidden luxury-card p-6 md:p-8 bg-gradient-to-br from-white via-white/95 to-[#FAF8F5] border border-[rgba(45,45,45,0.08)] shadow-[0_4px_24px_rgba(45,45,45,0.04)]">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-[#C79A3B]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#F1E4C5] text-[#B8862D] border border-[#B8862D]/30 shadow-sm">
              <Sparkles className="w-3.5 h-3.5" />
              <span>APEX RESTAURANT ENTERPRISE ERP · MULTI-OUTLET CORE</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1C1C1C] font-['Outfit']">
              Executive Control Cockpit
            </h1>
            <p className="text-sm text-[#707070] max-w-xl">
              Active Operational Scope:{' '}
              <span className="text-[#1C1C1C] font-bold">{activeOutlet.name}</span>{' '}
              <Badge variant="outlet">[{activeOutlet.code}]</Badge>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/90 border border-[rgba(45,45,45,0.08)] shadow-sm">
              <Server className="w-4 h-4 text-[#C79A3B]" />
              <div className="text-xs text-left">
                <p className="text-[#707070] font-medium">Backend Engine</p>
                <p className="font-semibold text-[#1C1C1C]">Python 3.14 · FastAPI</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/90 border border-[rgba(45,45,45,0.08)] shadow-sm">
              <Activity className="w-4 h-4 text-[#2E8B57]" />
              <div className="text-xs text-left">
                <p className="text-[#707070] font-medium">Database Cluster</p>
                <p className="font-semibold text-[#1C1C1C]">Neon PostgreSQL</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metric Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Outlets"
          value={outlets.length}
          subtitle="14 Outlets + 2 Central Hubs"
          icon={<Building2 className="w-4 h-4 text-[#C79A3B]" />}
          iconBgColor="bg-[#FAF8F5] text-[#C79A3B]"
          onClick={() => setActiveWorkspace('organization')}
        />

        <StatCard
          title="Purchase Pipeline"
          value="Direct PO"
          subtitle="Outlet PR ➔ Direct Vendor GRN"
          icon={<Truck className="w-4 h-4 text-[#3978B8]" />}
          iconBgColor="bg-blue-50 text-[#3978B8]"
          onClick={() => setActiveWorkspace('purchase')}
        />

        <StatCard
          title="Closing Cycle"
          value={closingInfo.periodType === 'FIRST_HALF' ? '1st–15th' : '16th–End'}
          subtitle={`${closingInfo.daysRemaining} days remaining in cycle`}
          icon={<CalendarCheck className="w-4 h-4 text-[#B8862D]" />}
          iconBgColor="bg-[#F1E4C5]/40 text-[#B8862D]"
          onClick={() => setActiveWorkspace('closing')}
        />

        <StatCard
          title="System Health"
          value={health?.database?.status === 'connected' ? 'Healthy' : 'Active'}
          subtitle={health?.database?.latencyMs ? `${health.database.latencyMs}ms DB latency` : 'Strict multi-tenant security'}
          icon={<Cpu className="w-4 h-4 text-[#2E8B57]" />}
          iconBgColor="bg-[#2E8B57]/10 text-[#2E8B57]"
          onClick={() => setActiveWorkspace('telemetry')}
        />
      </div>

      {/* Quick Launch Workspaces Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#C79A3B]" />
            Enterprise Function Workspaces
          </h2>
          <span className="text-xs text-[#707070]">Select a workspace to open dedicated operations</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <div
                key={action.id}
                onClick={() => setActiveWorkspace(action.id)}
                className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm hover:shadow-md hover:border-[#C79A3B]/40 transition-all cursor-pointer group flex items-start justify-between"
              >
                <div className="flex items-start gap-3.5">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${action.color} border border-black/5 flex items-center justify-center shrink-0`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#1C1C1C] font-['Outfit'] group-hover:text-[#B8862D] transition-colors">
                      {action.title}
                    </h3>
                    <p className="text-xs text-[#707070] mt-0.5">{action.desc}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#707070] group-hover:text-[#B8862D] group-hover:translate-x-0.5 transition-all mt-1" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Operational Principles Card */}
      <div className="p-5 rounded-2xl bg-white/85 border border-[rgba(45,45,45,0.08)] space-y-3 shadow-sm">
        <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#2E8B57]" />
          Multi-Outlet Scoping & Food Cost Control Architecture
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-[#707070]">
          <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] space-y-1">
            <span className="font-bold text-[#1C1C1C] block">Strict Outlet Isolation</span>
            <p>Every query, request, and stock transfer enforces authorized outlet context. Head Office retains consolidated oversight.</p>
          </div>
          <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] space-y-1">
            <span className="font-bold text-[#1C1C1C] block">Direct Destination Delivery</span>
            <p>Purchase Orders direct suppliers to deliver straight to retail outlets, generating local GRN with zero intermediate double-handling.</p>
          </div>
          <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] space-y-1">
            <span className="font-bold text-[#1C1C1C] block">Bi-Monthly Closing Verification</span>
            <p>Rigorous 1st–15th & 16th–End physical stock audits computing exact variances against POS theoretical consumption.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
