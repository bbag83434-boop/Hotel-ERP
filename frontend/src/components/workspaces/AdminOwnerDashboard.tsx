'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useOutlet } from '@/context/OutletContext';
import { useAuth } from '@/context/AuthContext';
import { reportsApi } from '@/api/reports';
import { dashboardApi } from '@/api/dashboard';
import { apiClient } from '@/api/client';
import { WorkspaceId } from '@/components/common/Sidebar';
import { DailyTrendItem } from '@/types/dashboard.types';
import {
  ExecutiveDashboardResponse,
  InventoryValuationResponse,
} from '@/types/reports.types';

import {
  Sparkles,
  TrendingUp,
  ShoppingCart,
  Boxes,
  AlertTriangle,
  RotateCcw,
  Bot,
  CalendarDays,
  UtensilsCrossed,
  ArrowUpRight,
  CheckSquare,
  ChefHat,
  Truck,
  BookOpen,
  Building2,
  Users,
  BarChart3,
  Settings,
} from 'lucide-react';

interface AdminOwnerDashboardProps {
  setActiveWorkspace: (id: WorkspaceId) => void;
}

interface AIRecommendation {
  item_id: string;
  item_name: string;
  current_quantity: number;
  min_stock_level: number;
  suggested_order_quantity: number;
  priority: string;
  recommendation: string;
}

const formatCurrency = (val?: number | null) => {
  if (val === null || val === undefined || isNaN(Number(val))) {
    return '₹0.00';
  }

  return `₹${Number(val).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatShortCurrency = (val?: number | null) => {
  if (val === null || val === undefined || isNaN(Number(val))) {
    return '₹0';
  }

  const num = Number(val);

  if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)}k`;

  return `₹${num.toFixed(0)}`;
};

const formatDateLabel = (dateStr: string) => {
  try {
    const parts = dateStr.split('-');

    if (parts.length === 3) {
      const monthNames = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];

      const mIdx = parseInt(parts[1], 10) - 1;

      return `${monthNames[mIdx]} ${parseInt(parts[2], 10)}`;
    }
  } catch {
    // fallback
  }

  return dateStr;
};

const CustomChartTooltip = ({
  active,
  payload,
  label,
}: any) => {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const salesVal =
    payload.find((p: any) => p.dataKey === 'sales')?.value ?? 0;

  const purchaseVal =
    payload.find((p: any) => p.dataKey === 'purchase')?.value ?? 0;

  return (
    <div className="bg-white border border-[#E8E1D5] rounded-xl p-3 shadow-xl text-xs space-y-2 min-w-[145px]">
      <p className="text-[10px] text-[#77736B] font-medium border-b border-[#EEE9DF] pb-1.5">
        {label ? formatDateLabel(String(label)) : ''}
      </p>

      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-[#B8862D] font-medium flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#C79A3B]" />
          Sales
        </span>

        <span className="font-mono font-bold text-[#18233A]">
          {formatCurrency(salesVal)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-[#77736B] font-medium flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#A7A7AD]" />
          Purchase
        </span>

        <span className="font-mono font-bold text-[#18233A]">
          {formatCurrency(purchaseVal)}
        </span>
      </div>
    </div>
  );
};

export const AdminOwnerDashboard: React.FC<
  AdminOwnerDashboardProps
> = ({ setActiveWorkspace }) => {
  const { activeOutlet, isHeadOffice } = useOutlet();
  const { logout } = useAuth();

  const [trendData, setTrendData] = useState<DailyTrendItem[]>([]);
  const [todaySummary, setTodaySummary] =
    useState<ExecutiveDashboardResponse | null>(null);

  const [inventory, setInventory] =
    useState<InventoryValuationResponse | null>(null);

  const [aiRecs, setAiRecs] = useState<AIRecommendation[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayStart = () => {
    const s = new Date();

    s.setHours(0, 0, 0, 0);

    return s.toISOString();
  };

  const todayEnd = () => {
    const e = new Date();

    e.setHours(23, 59, 59, 999);

    return e.toISOString();
  };

  const loadData = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      const targetBranchId =
        !isHeadOffice && activeOutlet?.id
          ? activeOutlet.id
          : undefined;

      try {
        const [
          trendRes,
          execRes,
          invRes,
        ] = await Promise.allSettled([
          dashboardApi.getTrend(30, targetBranchId),

          reportsApi.getExecutiveSummary({
            startDate: todayStart(),
            endDate: todayEnd(),
            branchId: targetBranchId,
          }),

          reportsApi.getInventoryValuation({
            branchId: targetBranchId,
          }),
        ]);

        if (trendRes.status === 'fulfilled') {
          setTrendData(trendRes.value.trend || []);
        }

        if (execRes.status === 'fulfilled') {
          setTodaySummary(execRes.value);
        }

        if (invRes.status === 'fulfilled') {
          setInventory(invRes.value);
        }

        /*
         * Existing AI endpoint.
         * Optional: dashboard must continue working even if AI endpoint
         * returns 401/403 or is unavailable.
         */
        try {
          const aiRes = await apiClient.get(
            '/ai/recommendations/stock',
            {
              params: targetBranchId
                ? { branch_id: targetBranchId }
                : {},
            },
          );

          if (aiRes.data?.recommendations) {
            setAiRecs(aiRes.data.recommendations);
          } else if (Array.isArray(aiRes.data)) {
            setAiRecs(aiRes.data);
          }
        } catch {
          // AI recommendations are optional for dashboard rendering.
        }
      } catch (err: any) {
        setError(
          err?.response?.data?.detail ||
            'Dashboard data could not be loaded.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isHeadOffice, activeOutlet?.id],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const todaySales =
    todaySummary?.kpis?.totalRevenue ?? 0;

  const todayOrdersCount =
    todaySummary?.kpis?.totalOrders ?? 0;

  const todayPurchases =
    todaySummary?.kpis?.totalProcurementSpend ?? 0;

  const totalStockVal =
    inventory?.totalValuation ?? 0;

  const lowStockCount =
    inventory?.lowStockItemsCount ?? 0;

  const criticalAiRec = useMemo(() => {
    return (
      aiRecs.find(
        (r) =>
          r.priority === 'HIGH' ||
          r.priority === 'CRITICAL',
      ) || aiRecs[0]
    );
  }, [aiRecs]);

  /*
   * IMPORTANT:
   * These IDs are taken from the existing WorkspaceId definition.
   * No new workspace IDs are introduced here.
   */
  const systemModules: Array<{
    id: WorkspaceId;
    title: string;
    description: string;
    icon: React.ElementType;
  }> = [
    {
      id: 'purchase',
      title: 'Purchase',
      description: 'Create & manage purchases',
      icon: ShoppingCart,
    },
    {
      id: 'inventory',
      title: 'Stock',
      description: 'Manage inventory & stock levels',
      icon: Boxes,
    },
    {
      id: 'production',
      title: 'Production',
      description: 'Recipe & kitchen production',
      icon: ChefHat,
    },
    {
      id: 'orders',
      title: 'Orders',
      description: 'Manage customer orders',
      icon: UtensilsCrossed,
    },
    {
      id: 'transfers',
      title: 'Dispatch',
      description: 'Order dispatch & delivery',
      icon: Truck,
    },
    {
      id: 'approvals',
      title: 'Approvals',
      description: 'Pending approvals & workflow',
      icon: CheckSquare,
    },
    {
      id: 'foodCost',
      title: 'Menu & Recipes',
      description: 'Manage menu and recipe costing',
      icon: BookOpen,
    },
    {
      id: 'multiOutlet',
      title: 'Outlets',
      description: 'Manage branches & outlets',
      icon: Building2,
    },
    {
      id: 'users',
      title: 'Users & Roles',
      description: 'Manage staff & permissions',
      icon: Users,
    },
    {
      id: 'reports',
      title: 'Reports',
      description: 'Sales, purchase & stock reports',
      icon: BarChart3,
    },
    {
      id: 'organization',
      title: 'Settings',
      description: 'System settings & configurations',
      icon: Settings,
    },
    {
      id: 'assistant',
      title: 'AI Intel',
      description: 'AI insights & recommendations',
      icon: Sparkles,
    },
  ];

  return (
    <div className="w-full max-w-[1180px] mx-auto px-3 sm:px-5 lg:px-6 pb-20 text-[#18233A]">

      {/* =========================================================
          HEADER
      ========================================================== */}

      <header className="flex items-center justify-between gap-4 py-3 sm:py-4">
        <div className="flex items-center gap-3 min-w-0">

          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#FFF7E3] border border-[#E8D6A8] flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-[#C79A3B]" />
          </div>

          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#18233A] truncate">
              Admin Dashboard
            </h1>

            <p className="text-xs sm:text-sm text-[#7C7B78] truncate">
              {isHeadOffice
                ? 'Manage your entire hotel operations'
                : activeOutlet?.name ||
                  'Manage your hotel operations'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">

          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="w-9 h-9 rounded-xl border border-[#E4DED2] bg-white text-[#77736B] hover:text-[#B8862D] hover:bg-[#FFF9EC] transition-all flex items-center justify-center"
            title="Refresh dashboard"
            aria-label="Refresh dashboard"
          >
            <RotateCcw
              className={`w-4 h-4 ${
                refreshing ? 'animate-spin text-[#C79A3B]' : ''
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => logout()}
            className="hidden sm:block text-sm font-medium text-[#77736B] hover:text-[#D9534F] transition-colors px-2"
          >
            Logout
          </button>
        </div>
      </header>

      {/* =========================================================
          ERROR
      ========================================================== */}

      {error && (
        <div className="mb-3 p-3 rounded-xl bg-[#FFF2F1] border border-[#F0C7C3] text-[#C84C45] text-xs sm:text-sm">
          {error}
        </div>
      )}

      {/* =========================================================
          KPI CARDS
      ========================================================== */}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-3">

        {/* Sales */}

        <button
          type="button"
          onClick={() => setActiveWorkspace('outletSales')}
          className="text-left rounded-xl border border-[#D9EBDD] bg-[#F1FBF7] p-3 sm:p-4 hover:shadow-md transition-all"
        >
          <div className="flex items-start justify-between gap-2">

            <div className="w-9 h-9 rounded-xl bg-[#CFF4E3] flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[#15915F]" />
            </div>

            <ArrowUpRight className="w-4 h-4 text-[#15915F]" />
          </div>

          <p className="mt-3 text-xs sm:text-sm font-medium text-[#355B4A]">
            Today&apos;s Sales
          </p>

          <p className="mt-0.5 text-lg sm:text-xl font-bold text-[#18233A]">
            {formatCurrency(todaySales)}
          </p>

          <p className="text-[10px] sm:text-xs text-[#718078]">
            {todayOrdersCount} orders
          </p>
        </button>

        {/* Purchase */}

        <button
          type="button"
          onClick={() => setActiveWorkspace('purchase')}
          className="text-left rounded-xl border border-[#D9E4F4] bg-[#F1F7FF] p-3 sm:p-4 hover:shadow-md transition-all"
        >
          <div className="flex items-start justify-between gap-2">

            <div className="w-9 h-9 rounded-xl bg-[#D9E8FF] flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-[#2864B8]" />
            </div>

            <ArrowUpRight className="w-4 h-4 text-[#2864B8]" />
          </div>

          <p className="mt-3 text-xs sm:text-sm font-medium text-[#35527A]">
            Today&apos;s Purchase
          </p>

          <p className="mt-0.5 text-lg sm:text-xl font-bold text-[#18233A]">
            {formatCurrency(todayPurchases)}
          </p>

          <p className="text-[10px] sm:text-xs text-[#718078]">
            {todayPurchases > 0 ? 'Purchase spend' : '0 items'}
          </p>
        </button>

        {/* Stock */}

        <button
          type="button"
          onClick={() => setActiveWorkspace('inventory')}
          className="text-left rounded-xl border border-[#E3D8F2] bg-[#F8F2FF] p-3 sm:p-4 hover:shadow-md transition-all"
        >
          <div className="flex items-start justify-between gap-2">

            <div className="w-9 h-9 rounded-xl bg-[#E8D5FF] flex items-center justify-center">
              <Boxes className="w-5 h-5 text-[#7C22C9]" />
            </div>

            <ArrowUpRight className="w-4 h-4 text-[#7C22C9]" />
          </div>

          <p className="mt-3 text-xs sm:text-sm font-medium text-[#5E4675]">
            Total Stock Value
          </p>

          <p className="mt-0.5 text-lg sm:text-xl font-bold text-[#18233A]">
            {formatCurrency(totalStockVal)}
          </p>

          <p className="text-[10px] sm:text-xs text-[#718078]">
            Current valuation
          </p>
        </button>

        {/* Low stock */}

        <button
          type="button"
          onClick={() => setActiveWorkspace('inventory')}
          className="text-left rounded-xl border border-[#F0D5D8] bg-[#FFF3F4] p-3 sm:p-4 hover:shadow-md transition-all"
        >
          <div className="flex items-start justify-between gap-2">

            <div className="w-9 h-9 rounded-xl bg-[#FFD9DE] flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-[#D12B45]" />
            </div>

            <ArrowUpRight className="w-4 h-4 text-[#A52338]" />
          </div>

          <p className="mt-3 text-xs sm:text-sm font-medium text-[#78404A]">
            Low Stock Alerts
          </p>

          <p className="mt-0.5 text-lg sm:text-xl font-bold text-[#A52338]">
            {lowStockCount} items
          </p>

          <p className="text-[10px] sm:text-xs text-[#718078]">
            Attention required
          </p>
        </button>
      </section>

      {/* =========================================================
          BUSINESS OVERVIEW
      ========================================================== */}

      <section className="rounded-2xl border border-[#E4DED3] bg-white shadow-sm overflow-hidden mb-4">

        <div className="px-4 sm:px-5 pt-4 sm:pt-5 flex items-center justify-between gap-3">

          <div className="flex items-center gap-2.5">

            <div className="w-9 h-9 rounded-xl bg-[#FFF5DC] flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[#C79A3B]" />
            </div>

            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#18233A]">
                Business Overview
              </h2>

              <p className="text-[10px] sm:text-xs text-[#88847C]">
                Last 30 Days
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[10px] sm:text-xs">

            <span className="flex items-center gap-1.5 text-[#B8862D]">
              <span className="w-2 h-2 rounded-full bg-[#C79A3B]" />
              Sales
            </span>

            <span className="flex items-center gap-1.5 text-[#88847C]">
              <span className="w-2 h-2 rounded-full bg-[#A7A7AD]" />
              Purchase
            </span>
          </div>
        </div>

        <div className="w-full h-56 sm:h-64 px-2 sm:px-3 pt-2">

          {loading ? (
            <div className="w-full h-full flex items-center justify-center">

              <div className="flex flex-col items-center gap-2 text-xs text-[#88847C]">

                <RotateCcw className="w-5 h-5 animate-spin text-[#C79A3B]" />

                <span>
                  Loading 30-day trend...
                </span>
              </div>
            </div>
          ) : trendData.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-xs text-[#88847C]">
              No trend data available for this period.
            </div>
          ) : (
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <AreaChart
                data={trendData}
                margin={{
                  top: 8,
                  right: 12,
                  left: -12,
                  bottom: 4,
                }}
              >
                <defs>

                  <linearGradient
                    id="salesGlowLight"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="#C79A3B"
                      stopOpacity={0.18}
                    />

                    <stop
                      offset="95%"
                      stopColor="#C79A3B"
                      stopOpacity={0}
                    />
                  </linearGradient>

                  <linearGradient
                    id="purchaseGlowLight"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="#A7A7AD"
                      stopOpacity={0.12}
                    />

                    <stop
                      offset="95%"
                      stopColor="#A7A7AD"
                      stopOpacity={0}
                    />
                  </linearGradient>

                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#EEEAE2"
                  vertical={false}
                />

                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateLabel}
                  stroke="#D8D3CA"
                  tick={{
                    fill: '#8B877F',
                    fontSize: 10,
                  }}
                  tickLine={false}
                  axisLine={{
                    stroke: '#E8E3DA',
                  }}
                  interval="preserveStartEnd"
                  minTickGap={28}
                />

                <YAxis
                  stroke="#D8D3CA"
                  tickFormatter={formatShortCurrency}
                  tick={{
                    fill: '#8B877F',
                    fontSize: 10,
                  }}
                  tickLine={false}
                  axisLine={false}
                />

                <Tooltip
                  content={
                    <CustomChartTooltip />
                  }
                  cursor={{
                    stroke:
                      'rgba(199,154,59,0.25)',
                    strokeWidth: 1,
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="purchase"
                  stroke="#A7A7AD"
                  strokeWidth={1.75}
                  strokeDasharray="4 2"
                  fill="url(#purchaseGlowLight)"
                  isAnimationActive={false}
                />

                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#C79A3B"
                  strokeWidth={2.25}
                  fill="url(#salesGlowLight)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Overview values */}

        <div className="border-t border-[#EEEAE2] mx-4 sm:mx-5 py-4 grid grid-cols-2 lg:grid-cols-4 gap-4">

          <div>
            <p className="text-lg font-bold font-mono text-[#18233A]">
              {formatCurrency(todaySales)}
            </p>

            <p className="text-[11px] text-[#88847C]">
              Today&apos;s sales
            </p>
          </div>

          <div>
            <p className="text-lg font-bold font-mono text-[#18233A]">
              {formatCurrency(todayPurchases)}
            </p>

            <p className="text-[11px] text-[#88847C]">
              Purchase today
            </p>
          </div>

          <div>
            <p className="text-lg font-bold font-mono text-[#18233A]">
              {formatCurrency(totalStockVal)}
            </p>

            <p className="text-[11px] text-[#88847C]">
              Stock value
            </p>
          </div>

          <div>
            <p
              className={`text-lg font-bold font-mono ${
                lowStockCount > 0
                  ? 'text-[#C52D43]'
                  : 'text-[#15915F]'
              }`}
            >
              {lowStockCount}
            </p>

            <p className="text-[11px] text-[#88847C]">
              Low stock alerts
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================
          SYSTEM MODULES
      ========================================================== */}

      <section className="mb-4">

        <div className="flex items-center gap-3 mb-3">

          <div className="w-10 h-10 rounded-xl bg-[#FFF5DC] border border-[#E8D6A8] flex items-center justify-center">
            <Building2 className="w-5 h-5 text-[#C79A3B]" />
          </div>

          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#18233A]">
              System Modules
            </h2>

            <p className="text-[10px] sm:text-xs text-[#88847C]">
              Access all features of your hotel management system
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">

          {systemModules.map((module) => {
            const Icon = module.icon;

            return (
              <button
                key={module.id}
                type="button"
                onClick={() =>
                  setActiveWorkspace(module.id)
                }
                className="group text-left min-h-[118px] sm:min-h-[132px] rounded-xl border border-[#E7E1D7] bg-white p-3.5 sm:p-4 shadow-sm hover:shadow-md hover:border-[#D8B96C] transition-all relative overflow-hidden"
              >

                {/* Gold accent */}

                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#C79A3B] opacity-90" />

                <div className="flex items-start justify-between gap-2">

                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#FFF5DC] border border-[#E8D6A8] flex items-center justify-center group-hover:bg-[#FBEBC0] transition-colors">

                    <Icon className="w-5 h-5 sm:w-5.5 sm:h-5.5 text-[#B8862D]" />

                  </div>

                  <ArrowUpRight className="w-4 h-4 text-[#C79A3B] opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </div>

                <h3 className="mt-3 text-sm sm:text-[15px] font-bold text-[#18233A]">
                  {module.title}
                </h3>

                <p className="mt-0.5 text-[10px] sm:text-xs leading-4 text-[#858178] line-clamp-2">
                  {module.description}
                </p>

              </button>
            );
          })}

        </div>
      </section>

      {/* =========================================================
          AI INTEL
      ========================================================== */}

      <section className="mb-2">

        <div className="flex items-center gap-2 mb-2.5">

          <Sparkles className="w-4 h-4 text-[#C79A3B]" />

          <h2 className="text-sm font-bold text-[#18233A]">
            AI Intel
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">

          {/* Stock Intelligence */}

          <button
            type="button"
            onClick={() =>
              setActiveWorkspace('inventory')
            }
            className="text-left rounded-xl border border-[#E7E1D7] border-l-4 border-l-[#C79A3B] bg-white p-3.5 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between gap-3">

              <div className="min-w-0">

                <p className="text-xs sm:text-sm font-bold text-[#18233A]">
                  {lowStockCount > 0
                    ? `${lowStockCount} items need stock attention`
                    : 'All inventory items within safe stock levels'}
                </p>

                <p className="text-[10px] sm:text-xs text-[#88847C] mt-1">
                  {criticalAiRec
                    ? `Suggested: order ${criticalAiRec.suggested_order_quantity} of ${criticalAiRec.item_name}`
                    : 'Automated requirement calculation active'}
                </p>

              </div>

              <ArrowUpRight className="w-4 h-4 text-[#C79A3B] shrink-0" />

            </div>
          </button>

          {/* AI Assistant */}

          <button
            type="button"
            onClick={() =>
              setActiveWorkspace('assistant')
            }
            className="text-left rounded-xl border border-[#E7E1D7] border-l-4 border-l-[#C79A3B] bg-white p-3.5 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between gap-3">

              <div className="min-w-0">

                <p className="text-xs sm:text-sm font-bold text-[#18233A]">
                  Procurement and operations copilot
                </p>

                <p className="text-[10px] sm:text-xs text-[#88847C] mt-1">
                  Ask AI for daily purchase plans, vendor quotes, and food cost analysis
                </p>

              </div>

              <Bot className="w-4 h-4 text-[#C79A3B] shrink-0" />

            </div>
          </button>

        </div>
      </section>

    </div>
  );
};

export default AdminOwnerDashboard;