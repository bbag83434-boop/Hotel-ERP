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
  Building2,
  TrendingUp,
  ShoppingCart,
  Boxes,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Bot,
  CalendarDays,
  UtensilsCrossed,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
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
  if (val === null || val === undefined || isNaN(Number(val))) return '₹0.00';
  return `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatShortCurrency = (val?: number | null) => {
  if (val === null || val === undefined || isNaN(Number(val))) return '₹0';
  const num = Number(val);
  if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)}k`;
  return `₹${num.toFixed(0)}`;
};

const formatDateLabel = (dateStr: string) => {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const mIdx = parseInt(parts[1], 10) - 1;
      return `${monthNames[mIdx]} ${parseInt(parts[2], 10)}`;
    }
  } catch {
    // fallback
  }
  return dateStr;
};

// Custom recharts tooltip mimicking high-precision dark financial charts
const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const salesVal = payload.find((p: any) => p.dataKey === 'sales')?.value ?? 0;
    const purchaseVal = payload.find((p: any) => p.dataKey === 'purchase')?.value ?? 0;

    return (
      <div className="bg-[#1B1B1F] border border-[rgba(255,255,255,0.12)] rounded-lg p-2.5 shadow-xl text-xs space-y-1.5 min-w-[130px]">
        <p className="text-[10px] text-[#9A9A9E] font-medium border-b border-[rgba(255,255,255,0.08)] pb-1">
          {label ? formatDateLabel(String(label)) : ''}
        </p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-[#C9A24B] font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C9A24B]" />
            Sales
          </span>
          <span className="font-mono font-bold text-[#F2F0EA] tabular-nums">
            {formatCurrency(salesVal)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-[#9A9A9E] font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#9A9A9E]" />
            Purchase
          </span>
          <span className="font-mono font-bold text-[#F2F0EA] tabular-nums">
            {formatCurrency(purchaseVal)}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export const AdminOwnerDashboard: React.FC<AdminOwnerDashboardProps> = ({ setActiveWorkspace }) => {
  const { outlets, activeOutlet, isHeadOffice } = useOutlet();
  const { user, logout } = useAuth();

  const [trendData, setTrendData] = useState<DailyTrendItem[]>([]);
  const [todaySummary, setTodaySummary] = useState<ExecutiveDashboardResponse | null>(null);
  const [inventory, setInventory] = useState<InventoryValuationResponse | null>(null);
  const [aiRecs, setAiRecs] = useState<AIRecommendation[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
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

  const loadData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    const targetBranchId = (!isHeadOffice && activeOutlet?.id) ? activeOutlet.id : undefined;

    try {
      const [trendRes, execRes, invRes] = await Promise.allSettled([
        dashboardApi.getTrend(30, targetBranchId),
        reportsApi.getExecutiveSummary({ startDate: todayStart(), endDate: todayEnd(), branchId: targetBranchId }),
        reportsApi.getInventoryValuation({ branchId: targetBranchId }),
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

      // Fetch AI stock recommendations from existing endpoint
      try {
        const aiRes = await apiClient.get('/ai/recommendations/stock', {
          params: targetBranchId ? { branch_id: targetBranchId } : {},
        });
        if (aiRes.data?.recommendations) {
          setAiRecs(aiRes.data.recommendations);
        } else if (Array.isArray(aiRes.data)) {
          setAiRecs(aiRes.data);
        }
      } catch {
        // AI suggestions optional
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Dashboard data could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isHeadOffice, activeOutlet?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived figures
  const todaySales = todaySummary?.kpis?.totalRevenue ?? 0;
  const todayOrdersCount = todaySummary?.kpis?.totalOrders ?? 0;
  const todayPurchases = todaySummary?.kpis?.totalProcurementSpend ?? 0;
  const totalStockVal = inventory?.totalValuation ?? 0;
  const lowStockCount = inventory?.lowStockItemsCount ?? 0;

  const criticalAiRec = useMemo(() => {
    return aiRecs.find((r) => r.priority === 'HIGH' || r.priority === 'CRITICAL') || aiRecs[0];
  }, [aiRecs]);

  return (
    <div className="w-full max-w-[430px] sm:max-w-md mx-auto space-y-3.5 text-[#F2F0EA] pb-16 font-sans">
      {/* ===== 1. HEADER (Minimal, Single Row) ===== */}
      <header className="flex items-center justify-between pt-1 pb-0.5 px-0.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#C9A24B]/15 border border-[#C9A24B]/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-[#C9A24B]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-semibold tracking-tight text-[#F2F0EA] truncate">
              CB Hotel Management
            </h1>
            <p className="text-[10px] text-[#9A9A9E] truncate">
              {isHeadOffice ? 'Head Office & Central Commissary' : (activeOutlet?.name || 'Head Office scope')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-1.5 rounded-lg text-[#9A9A9E] hover:text-[#F2F0EA] hover:bg-[#1B1B1F] border border-[rgba(255,255,255,0.06)] transition-all active:scale-95"
            title="Refresh dashboard data"
            aria-label="Refresh data"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#C9A24B]' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => logout()}
            className="text-[11px] text-[#9A9A9E] hover:text-[#E0574C] transition-colors py-1 px-1"
          >
            Logout
          </button>
        </div>
      </header>

      {error && (
        <div className="p-3 rounded-lg bg-[#E0574C]/10 border border-[#E0574C]/25 text-[#E0574C] text-xs">
          {error}
        </div>
      )}

      {/* ===== 2. HERO CARD: BUSINESS PULSE ===== */}
      <section className="bg-[#1B1B1F] border border-[rgba(255,255,255,0.08)] rounded-[12px] p-3.5 sm:p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-[#C9A24B]" />
            <h2 className="text-xs font-semibold text-[#F2F0EA]">
              Business pulse
            </h2>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1 text-[#C9A24B]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C9A24B]" />
              Sales (30d)
            </span>
            <span className="flex items-center gap-1 text-[#9A9A9E]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#9A9A9E]" />
              Purchase
            </span>
          </div>
        </div>

        {/* Recharts Area Chart */}
        <div className="w-full h-44 sm:h-48 pt-1">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-xs text-[#9A9A9E]">
                <RotateCcw className="w-4 h-4 animate-spin text-[#C9A24B]" />
                <span>Loading 30-day trend...</span>
              </div>
            </div>
          ) : trendData.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-xs text-[#9A9A9E]">
              No trend data available for this period.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C9A24B" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#C9A24B" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="purchaseGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9A9A9E" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#9A9A9E" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#25252A" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateLabel}
                  stroke="#55555C"
                  tick={{ fill: '#7C7C82', fontSize: 9 }}
                  tickLine={false}
                  axisLine={{ stroke: '#25252A' }}
                  interval="preserveStartEnd"
                  minTickGap={28}
                />
                <YAxis
                  stroke="#55555C"
                  tickFormatter={formatShortCurrency}
                  tick={{ fill: '#7C7C82', fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomChartTooltip />} cursor={{ stroke: 'rgba(201, 162, 75, 0.3)', strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="purchase"
                  stroke="#9A9A9E"
                  strokeWidth={1.75}
                  strokeDasharray="4 2"
                  fill="url(#purchaseGlow)"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#C9A24B"
                  strokeWidth={2.25}
                  fill="url(#salesGlow)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Inline Stats (Number above, label below) */}
        <div className="pt-2 border-t border-[rgba(255,255,255,0.06)] grid grid-cols-2 gap-3 sm:gap-4">
          <div>
            <p className="text-base sm:text-lg font-bold font-mono tracking-tight tabular-nums text-[#F2F0EA]">
              {formatCurrency(todaySales)}
            </p>
            <p className="text-[11px] text-[#9A9A9E]">
              Today&apos;s sales ({todayOrdersCount} orders)
            </p>
          </div>

          <div>
            <p className="text-base sm:text-lg font-bold font-mono tracking-tight tabular-nums text-[#F2F0EA]">
              {formatCurrency(todayPurchases)}
            </p>
            <p className="text-[11px] text-[#9A9A9E]">
              Purchase today
            </p>
          </div>

          <div>
            <p className="text-sm font-bold font-mono tracking-tight tabular-nums text-[#F2F0EA]">
              {formatCurrency(totalStockVal)}
            </p>
            <p className="text-[11px] text-[#9A9A9E]">
              Stock value
            </p>
          </div>

          <div>
            <p className={`text-sm font-bold font-mono tracking-tight tabular-nums ${lowStockCount > 0 ? 'text-[#E0574C]' : 'text-[#3EAE72]'}`}>
              {lowStockCount} items
            </p>
            <p className="text-[11px] text-[#9A9A9E]">
              Low stock alerts
            </p>
          </div>
        </div>
      </section>

      {/* ===== 3. AI INTEL ROW (Max 2-3 compact cards, surface bg, thin left border #C9A24B, rounded 4px) ===== */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-[#9A9A9E] px-0.5">
          AI intel
        </h3>

        <div className="space-y-2">
          {/* Card 1: Low Stock & Reorder Intelligence */}
          <div
            onClick={() => setActiveWorkspace('inventory')}
            className="bg-[#1B1B1F] border border-[rgba(255,255,255,0.06)] border-l-2 border-l-[#C9A24B] rounded-[4px] p-2.5 hover:bg-[#222228] transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#F2F0EA] truncate">
                  {lowStockCount > 0
                    ? `${lowStockCount} items at or below minimum threshold`
                    : 'All inventory items within safe stock levels'}
                </p>
                <p className="text-[10px] text-[#9A9A9E] truncate mt-0.5">
                  {criticalAiRec
                    ? `Suggested: order ${criticalAiRec.suggested_order_quantity} of ${criticalAiRec.item_name}`
                    : 'Automated requirement calculation active'}
                </p>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#C9A24B] shrink-0 mt-0.5" />
            </div>
          </div>

          {/* Card 2: AI Procurement & Operations Assistant */}
          <div
            onClick={() => setActiveWorkspace('assistant')}
            className="bg-[#1B1B1F] border border-[rgba(255,255,255,0.06)] border-l-2 border-l-[#C9A24B] rounded-[4px] p-2.5 hover:bg-[#222228] transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#F2F0EA] truncate">
                  Procurement and operations copilot
                </p>
                <p className="text-[10px] text-[#9A9A9E] truncate mt-0.5">
                  Ask AI for daily purchase plans, vendor quotes, and food cost analysis
                </p>
              </div>
              <Bot className="w-3.5 h-3.5 text-[#C9A24B] shrink-0 mt-0.5" />
            </div>
          </div>
        </div>
      </section>

      {/* ===== 4. SHORTCUT ROW (4 icon-only items: Purchase, Stock, Orders, Closing — no card background, 48px min tap target) ===== */}
      <section className="pt-1 px-1">
        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => setActiveWorkspace('purchase')}
            className="flex flex-col items-center justify-center min-h-[48px] min-w-[48px] py-2 rounded-xl text-[#9A9A9E] hover:text-[#C9A24B] active:text-[#C9A24B] active:scale-95 transition-all group"
            aria-label="Purchase"
          >
            <ShoppingCart className="w-5 h-5 group-hover:text-[#C9A24B] transition-colors stroke-[1.75]" />
            <span className="text-[10px] mt-1 text-[#9A9A9E] group-hover:text-[#F2F0EA] font-medium">
              Purchase
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveWorkspace('inventory')}
            className="flex flex-col items-center justify-center min-h-[48px] min-w-[48px] py-2 rounded-xl text-[#9A9A9E] hover:text-[#C9A24B] active:text-[#C9A24B] active:scale-95 transition-all group"
            aria-label="Stock"
          >
            <Boxes className="w-5 h-5 group-hover:text-[#C9A24B] transition-colors stroke-[1.75]" />
            <span className="text-[10px] mt-1 text-[#9A9A9E] group-hover:text-[#F2F0EA] font-medium">
              Stock
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveWorkspace('orders')}
            className="flex flex-col items-center justify-center min-h-[48px] min-w-[48px] py-2 rounded-xl text-[#9A9A9E] hover:text-[#C9A24B] active:text-[#C9A24B] active:scale-95 transition-all group"
            aria-label="Orders"
          >
            <UtensilsCrossed className="w-5 h-5 group-hover:text-[#C9A24B] transition-colors stroke-[1.75]" />
            <span className="text-[10px] mt-1 text-[#9A9A9E] group-hover:text-[#F2F0EA] font-medium">
              Orders
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveWorkspace('closing')}
            className="flex flex-col items-center justify-center min-h-[48px] min-w-[48px] py-2 rounded-xl text-[#9A9A9E] hover:text-[#C9A24B] active:text-[#C9A24B] active:scale-95 transition-all group"
            aria-label="Closing"
          >
            <CalendarDays className="w-5 h-5 group-hover:text-[#C9A24B] transition-colors stroke-[1.75]" />
            <span className="text-[10px] mt-1 text-[#9A9A9E] group-hover:text-[#F2F0EA] font-medium">
              Closing
            </span>
          </button>
        </div>
      </section>
    </div>
  );
};

export default AdminOwnerDashboard;