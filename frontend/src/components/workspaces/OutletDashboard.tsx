'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useOutlet } from '@/context/OutletContext';
import { useAuth } from '@/context/AuthContext';
import { reportsApi } from '@/api/reports';
import {
  OutletDashboardResponse,
  LowStockAlertItem,
  OutletActivityItem,
} from '@/types/reports.types';
import { WorkspaceId } from '@/components/common/Sidebar';
import {
  Building2,
  TrendingUp,
  AlertTriangle,
  Boxes,
  ShoppingCart,
  ChefHat,
  Truck,
  Trash2,
  CalendarCheck,
  BarChart3,
  Bot,
  RefreshCw,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Users,
  UtensilsCrossed,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';

interface OutletDashboardProps {
  branchId?: string;
  setActiveWorkspace?: (id: WorkspaceId) => void;
}

export const OutletDashboard: React.FC<OutletDashboardProps> = ({ branchId, setActiveWorkspace }) => {
  const { activeOutlet, closingInfo, refreshOutlets } = useOutlet();
  const { user } = useAuth();
  const userRole = typeof user?.role === 'object' ? user.role.name : (user?.role || 'OUTLET_STAFF');

  const [dashboardData, setDashboardData] = useState<OutletDashboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      setError(null);
      const targetBranchId = branchId || (activeOutlet?.id !== 'all' ? activeOutlet?.id : undefined);
      const data = await reportsApi.getOutletDashboard(targetBranchId);
      setDashboardData(data);
    } catch (err: any) {
      console.error('Failed to load outlet dashboard:', err);
      if (err?.response?.status === 401) {
        setError('Session expired. Please log in again.');
      } else if (err?.response?.status === 403) {
        setError('Access denied: You do not have permission to view this outlet.');
      } else {
        setError(err?.response?.data?.detail || 'Unable to connect to ERP server. Please verify your connection.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeOutlet?.id]);

  useEffect(() => {
    setLoading(true);
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
    refreshOutlets();
  };

  // Format currency in INR
  const formatCurrency = (val?: number | null) => {
    if (val === undefined || val === null) return '₹0.00';
    return `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Format relative or standard timestamp
  const formatTime = (isoString?: string) => {
    if (!isoString) return '--';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  // Quick Action Modules definition
  const outletModules = [
    {
      id: 'inventory' as WorkspaceId,
      name: 'Stock & Inventory',
      desc: 'Live stock valuation, items & batch tracking',
      icon: Boxes,
      badge: dashboardData?.stock ? `${dashboardData.stock.lowStockCount} Low` : undefined,
      badgeColor: dashboardData?.stock && dashboardData.stock.lowStockCount > 0 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      allowed: !dashboardData || dashboardData.allowedModules.includes('inventory'),
    },
    {
      id: 'purchase' as WorkspaceId,
      name: 'Purchase & PR',
      desc: 'Replenishment requests, approvals & GRN',
      icon: ShoppingCart,
      badge: dashboardData?.procurement ? `${dashboardData.procurement.pendingPrCount} Pending` : undefined,
      badgeColor: 'bg-[#d4a437]/20 text-[#d4a437] border-[#d4a437]/40',
      allowed: !dashboardData || dashboardData.allowedModules.includes('purchase'),
    },
    {
      id: 'production' as WorkspaceId,
      name: 'Kitchen & Production',
      desc: 'Recipe standard cost, batches & yield logs',
      icon: ChefHat,
      badge: dashboardData?.production ? `${dashboardData.production.todayProductionBatches} Batches` : undefined,
      badgeColor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
      allowed: !dashboardData || dashboardData.allowedModules.includes('production'),
    },
    {
      id: 'transfers' as WorkspaceId,
      name: 'Store Transfers',
      desc: 'Inter-warehouse dispatch & branch receipts',
      icon: Truck,
      badge: dashboardData?.transfers ? `${dashboardData.transfers.pendingInboundTransfers} Inbound` : undefined,
      badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      allowed: !dashboardData || dashboardData.allowedModules.includes('transfers'),
    },
    {
      id: 'wastage' as WorkspaceId,
      name: 'Wastage Control',
      desc: 'Daily spoiled stock logs & approval queue',
      icon: Trash2,
      badge: dashboardData?.wastage ? `${dashboardData.wastage.todayWastageEntries} Logs` : undefined,
      badgeColor: dashboardData?.wastage && dashboardData.wastage.todayWastageCost > 0 ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-zinc-800 text-zinc-400 border-zinc-700',
      allowed: !dashboardData || dashboardData.allowedModules.includes('wastage'),
    },
    {
      id: 'assistant' as WorkspaceId,
      name: 'AI Operations Copilot',
      desc: 'Automated insights, forecast & inventory Q&A',
      icon: Sparkles,
      badge: 'Active AI',
      badgeColor: 'bg-gradient-to-r from-[#d4a437]/30 to-amber-500/30 text-[#d4a437] border-[#d4a437]/50',
      allowed: true,
    },
    {
      id: 'closing' as WorkspaceId,
      name: 'Bi-Monthly Closing',
      desc: '15-day financial reconciliation & variance',
      icon: CalendarCheck,
      badge: dashboardData?.closingCycle ? `${dashboardData.closingCycle.daysRemaining}d Left` : undefined,
      badgeColor: 'bg-[#d4a437]/20 text-[#d4a437] border-[#d4a437]/30',
      allowed: !dashboardData || dashboardData.allowedModules.includes('closing'),
    },
    {
      id: 'reports' as WorkspaceId,
      name: 'Outlet Analytics',
      desc: 'Detailed sales, consumption & margin reports',
      icon: BarChart3,
      badge: 'Deep Dive',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      allowed: !dashboardData || dashboardData.allowedModules.includes('reports'),
    },
  ];

  // Render Skeletons during loading
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0c0e] text-[#f3f4f6] p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-pulse">
        {/* Header Skeleton */}
        <div className="h-28 bg-[#17171b] border border-[#26262e] rounded-2xl p-6 flex items-center justify-between">
          <div className="space-y-3">
            <div className="h-4 w-32 bg-[#26262e] rounded" />
            <div className="h-7 w-64 bg-[#26262e] rounded" />
          </div>
          <div className="h-10 w-28 bg-[#26262e] rounded-xl" />
        </div>

        {/* 6 Stats Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-36 bg-[#17171b] border border-[#26262e] rounded-xl p-5 space-y-4">
              <div className="flex justify-between items-center">
                <div className="h-4 w-28 bg-[#26262e] rounded" />
                <div className="h-8 w-8 bg-[#26262e] rounded-lg" />
              </div>
              <div className="h-8 w-36 bg-[#26262e] rounded" />
              <div className="h-3 w-48 bg-[#26262e] rounded" />
            </div>
          ))}
        </div>

        {/* Launchpad Skeleton */}
        <div className="h-48 bg-[#17171b] border border-[#26262e] rounded-xl p-6" />
      </div>
    );
  }

  // Render Error Banner
  if (error) {
    return (
      <div className="min-h-screen bg-[#0c0c0e] text-[#f3f4f6] p-4 md:p-8 flex items-center justify-center">
        <div className="bg-[#17171b] border border-rose-500/30 rounded-2xl p-8 max-w-lg w-full text-center space-y-4 shadow-2xl shadow-rose-950/20">
          <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-wide">Outlet Dashboard Notice</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">{error}</p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={handleManualRefresh}
              className="px-5 py-2.5 bg-[#d4a437] hover:bg-[#b8862d] text-black font-semibold text-sm rounded-xl transition-all shadow-lg shadow-[#d4a437]/20 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  const outlet = dashboardData?.outlet || activeOutlet;
  const sales = dashboardData?.todaySales;
  const stock = dashboardData?.stock;
  const proc = dashboardData?.procurement;
  const prod = dashboardData?.production;
  const transfers = dashboardData?.transfers;
  const wastage = dashboardData?.wastage;
  const cycleLabel = dashboardData?.closingCycle?.periodLabel || closingInfo?.label || 'Current Cycle';
  const cycleDaysRemaining = dashboardData?.closingCycle?.daysRemaining ?? closingInfo?.daysRemaining ?? 0;
  const cycleSales = dashboardData?.closingCycle?.periodSales ?? 0;

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-[#f3f4f6] p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* ========================================================================= */}
      {/* 1. HERO BANNER: ACTIVE SCOPE & BI-MONTHLY CYCLE                           */}
      {/* ========================================================================= */}
      <div className="bg-[#17171b] border border-[#26262e] rounded-2xl p-5 md:p-6 shadow-xl relative overflow-hidden">
        {/* Subtle Luxury Gradient Accent */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#d4a437]/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          {/* Left: Outlet Profile & Active Badge */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#d4a437]/15 text-[#d4a437] border border-[#d4a437]/30 tracking-wider">
                {outlet?.code || 'ACTIVE OUTLET'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                {outlet?.type || 'HOTEL RESORT'}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Operational
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
              <Building2 className="w-7 h-7 text-[#d4a437]" />
              {outlet?.name || 'Grand Heritage Resort & Palace'}
            </h1>
            <p className="text-xs md:text-sm text-zinc-400">
              Single-Outlet Operational Command Cockpit · Logged in as <span className="text-zinc-200 font-medium">{user?.first_name || user?.firstName || user?.username || 'Authorized Staff'}</span> ({userRole || 'OUTLET_STAFF'})
            </p>
          </div>

          {/* Right: Closing Cycle Status & Refresh Action */}
          <div className="flex items-center gap-3">
            {/* 15-Day Cycle Pill */}
            <div className="bg-[#202026] border border-[#2e2e38] rounded-xl px-4 py-2.5 text-right hidden sm:block">
              <div className="text-xs font-semibold text-[#d4a437] flex items-center justify-end gap-1.5">
                <CalendarCheck className="w-3.5 h-3.5" />
                {cycleLabel}
              </div>
              <div className="text-xs text-zinc-400">
                <span className="text-white font-bold">{cycleDaysRemaining} days</span> remaining · {formatCurrency(cycleSales)}
              </div>
            </div>

            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-[#202026] border border-[#2e2e38] hover:border-[#d4a437]/40 text-zinc-300 hover:text-white transition-all disabled:opacity-50"
              title="Refresh Live Outlet Data"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin text-[#d4a437]' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. OPERATIONAL KPI SUMMARY CARDS (6 Metrics Grid)                         */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Metric 1: Today's POS Sales */}
        <div className="bg-[#17171b] border border-[#26262e] hover:border-[#d4a437]/40 rounded-xl p-5 transition-all shadow-md group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Today's POS Sales</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {formatCurrency(sales?.todaySales)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-zinc-400 border-t border-zinc-800/80 pt-2.5">
            <span>{sales?.todayOrdersCount || 0} Orders logged</span>
            <span className="text-zinc-300 font-medium">
              Tables: {sales?.activeTablesOccupied || 0}/{sales?.totalDiningTables || 0}
            </span>
          </div>
        </div>

        {/* Metric 2: Live Stock Valuation & Low Stock */}
        <div className="bg-[#17171b] border border-[#26262e] hover:border-[#d4a437]/40 rounded-xl p-5 transition-all shadow-md group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Stock Valuation</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {formatCurrency(stock?.totalStockValue)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-zinc-400 border-t border-zinc-800/80 pt-2.5">
            <span>{stock?.totalItemsInStock || 0} SKUs Stocked</span>
            {stock && stock.lowStockCount > 0 ? (
              <span className="text-amber-400 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {stock.lowStockCount} Critical Low
              </span>
            ) : (
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Optimal
              </span>
            )}
          </div>
        </div>

        {/* Metric 3: Procurement & Purchase Requests */}
        <div className="bg-[#17171b] border border-[#26262e] hover:border-[#d4a437]/40 rounded-xl p-5 transition-all shadow-md group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Procurement PRs</span>
            <div className="p-2 rounded-lg bg-[#d4a437]/10 text-[#d4a437] border border-[#d4a437]/20">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight flex items-baseline gap-2">
            <span>{proc?.pendingPrCount || 0}</span>
            <span className="text-xs font-normal text-zinc-400">Pending Approvals</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-zinc-400 border-t border-zinc-800/80 pt-2.5">
            <span>{proc?.approvedPrCount || 0} In PO Pipeline</span>
            <span className="text-zinc-300 font-medium">Month PO: {formatCurrency(proc?.monthPoSpend)}</span>
          </div>
        </div>

        {/* Metric 4: Kitchen Batches & Production */}
        <div className="bg-[#17171b] border border-[#26262e] hover:border-[#d4a437]/40 rounded-xl p-5 transition-all shadow-md group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Kitchen Production</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <ChefHat className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight flex items-baseline gap-2">
            <span>{prod?.todayProductionBatches || 0}</span>
            <span className="text-xs font-normal text-zinc-400">Batches Today</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-zinc-400 border-t border-zinc-800/80 pt-2.5">
            <span>{prod?.activeRecipesCount || 0} Active Recipes</span>
            <span className="text-zinc-300 font-medium">{prod?.todayProducedQty || 0} units yield</span>
          </div>
        </div>

        {/* Metric 5: Store Transfers Inbound / Outbound */}
        <div className="bg-[#17171b] border border-[#26262e] hover:border-[#d4a437]/40 rounded-xl p-5 transition-all shadow-md group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Store Transfers</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight flex items-baseline gap-2">
            <span>{transfers?.pendingInboundTransfers || 0}</span>
            <span className="text-xs font-normal text-zinc-400">Inbound Pending</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-zinc-400 border-t border-zinc-800/80 pt-2.5">
            <span>Outbound: {transfers?.pendingOutboundTransfers || 0}</span>
            <span className="text-emerald-400 font-medium">{transfers?.todayCompletedTransfers || 0} Received</span>
          </div>
        </div>

        {/* Metric 6: Wastage Today */}
        <div className="bg-[#17171b] border border-[#26262e] hover:border-[#d4a437]/40 rounded-xl p-5 transition-all shadow-md group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Wastage Today</span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Trash2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {formatCurrency(wastage?.todayWastageCost)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-zinc-400 border-t border-zinc-800/80 pt-2.5">
            <span>{wastage?.todayWastageEntries || 0} Logged Incidents</span>
            {wastage && wastage.pendingWastageApprovals > 0 ? (
              <span className="text-rose-400 font-semibold">{wastage.pendingWastageApprovals} Pending Approval</span>
            ) : (
              <span className="text-zinc-400">Period: {formatCurrency(wastage?.periodWastageCost)}</span>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. QUICK-ACCESS OUTLET MODULE LAUNCHPAD (Role-Gated)                      */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#d4a437]" />
            Outlet Module Launchpad
          </h2>
          <span className="text-xs text-zinc-400">Direct 1-tap navigation for {outlet?.name || 'this outlet'}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {outletModules.filter((m) => m.allowed).map((mod) => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                onClick={() => setActiveWorkspace?.(mod.id)}
                className="bg-[#17171b] border border-[#26262e] hover:border-[#d4a437] hover:bg-[#202026] rounded-xl p-4 text-left transition-all duration-200 group flex flex-col justify-between h-32 shadow-md relative overflow-hidden"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-9 h-9 rounded-lg bg-[#26262e] group-hover:bg-[#d4a437]/20 flex items-center justify-center text-zinc-300 group-hover:text-[#d4a437] transition-all">
                    <Icon className="w-5 h-5" />
                  </div>
                  {mod.badge && (
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${mod.badgeColor}`}>
                      {mod.badge}
                    </span>
                  )}
                </div>

                <div>
                  <div className="text-sm font-bold text-white group-hover:text-[#d4a437] transition-colors flex items-center justify-between">
                    {mod.name}
                    <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-xs text-zinc-400 line-clamp-1 mt-0.5">{mod.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. LOWER SECTION: URGENT LOW STOCK ALERTS & RECENT ACTIVITY FEED          */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left (7 cols): Low Stock Action Widget */}
        <div className="lg:col-span-7 bg-[#17171b] border border-[#26262e] rounded-xl p-5 space-y-4 shadow-md">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-bold text-white tracking-wide">Urgent Stock Replenishment</h3>
            </div>
            <button
              onClick={() => setActiveWorkspace?.('purchase')}
              className="text-xs font-semibold text-[#d4a437] hover:underline flex items-center gap-1"
            >
              Raise PR <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {stock && stock.lowStockItems && stock.lowStockItems.length > 0 ? (
            <div className="divide-y divide-zinc-800/60 overflow-hidden">
              {stock.lowStockItems.slice(0, 5).map((item: LowStockAlertItem) => (
                <div key={item.itemId} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-zinc-400 text-[11px] bg-zinc-800/80 px-1.5 py-0.5 rounded">
                        {item.code}
                      </span>
                      <span className="font-semibold text-white truncate">{item.name}</span>
                    </div>
                    <div className="text-zinc-500 text-[11px] mt-0.5">
                      Category: {item.categoryName} · Standard Cost: {formatCurrency(item.costPrice)}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-bold text-amber-400">
                      {item.currentStock} {item.unitSymbol}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      Min: {item.minStockLevel} {item.unitSymbol}
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveWorkspace?.('purchase')}
                    className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-[11px] font-medium transition-all"
                  >
                    Order
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-zinc-500 space-y-1">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400/60 mb-2" />
              <p className="text-sm text-zinc-300 font-medium">All item inventory levels optimal</p>
              <p className="text-xs">No SKUs currently below minimum replenishment thresholds.</p>
            </div>
          )}
        </div>

        {/* Right (5 cols): Live Operational Activity Feed */}
        <div className="lg:col-span-5 bg-[#17171b] border border-[#26262e] rounded-xl p-5 space-y-4 shadow-md">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#d4a437]" />
              <h3 className="text-sm font-bold text-white tracking-wide">Live Outlet Activity</h3>
            </div>
            <span className="text-[11px] font-mono text-zinc-400">Realtime</span>
          </div>

          {dashboardData?.recentActivities && dashboardData.recentActivities.length > 0 ? (
            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
              {dashboardData.recentActivities.map((act: OutletActivityItem) => (
                <div
                  key={act.id}
                  className="p-2.5 rounded-lg bg-[#202026] border border-[#2e2e38] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white truncate">{act.title}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-medium">
                        {act.type}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400 truncate mt-0.5">{act.description}</div>
                  </div>

                  <div className="text-right shrink-0">
                    {act.amount !== null && act.amount !== undefined && (
                      <div className="font-bold text-white">{formatCurrency(act.amount)}</div>
                    )}
                    <div className="text-[10px] text-zinc-500">{formatTime(act.timestamp)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-zinc-500 space-y-1">
              <Clock className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
              <p className="text-sm text-zinc-300 font-medium">No activity logged today</p>
              <p className="text-xs">Transactions will automatically appear here as operations run.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OutletDashboard;
