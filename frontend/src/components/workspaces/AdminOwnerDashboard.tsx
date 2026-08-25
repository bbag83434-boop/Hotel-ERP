'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutlet } from '@/context/OutletContext';
import { useAuth } from '@/context/AuthContext';
import { usePWA } from '@/context/PWAContext';
import { reportsApi } from '@/api/reports';
import { apiClient } from '@/api/client';
import { procurementApi } from '@/api/procurement';
import { WorkspaceId } from '@/components/common/Sidebar';
import {
  Building2,
  TrendingUp,
  ShoppingCart,
  Boxes,
  AlertTriangle,
  Trash2,
  BarChart3,
  Users,
  Truck,
  Settings,
  Info,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Hourglass,
  Sparkles,
  Bot,
  Wallet,
  X,
} from 'lucide-react';
import { StatCard, Badge, Button, EmptyState, AlertBanner, FeedbackState } from '@/components/ui';
import { LowStockAlertItem, InventoryValuationResponse, ExecutiveDashboardResponse } from '@/types/reports.types';
import { SmartAIAskResponse } from '@/types/purchase.types';

interface AdminOwnerDashboardProps {
  setActiveWorkspace: (id: WorkspaceId) => void;
}

interface OutletPerfRow {
  outletId: string;
  outletName: string;
  outletCode: string;
  todaySales: number;
  orders: number;
  stockValue: number;
  lowStock: number;
  outOfStock: number;
  wastageCost: number;
  wastageEntries: number;
  closingLabel: string;
  closingDaysLeft: number | null;
  lowItems: LowStockAlertItem[];
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

interface CriticalStockAlert {
  item: string;
  outlet: string;
  current: number;
  min: number;
  unit: string;
}

interface HighWastageAlert {
  outlet: string;
  cost: number;
  pct: number;
  reason: string;
}

const formatCurrency = (val?: number | null) => {
  if (val === null || val === undefined || isNaN(Number(val))) return '₹0.00';
  return `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatQty = (val?: number | null) => {
  if (val === null || val === undefined || isNaN(Number(val))) return '0';
  return Number(val).toLocaleString('en-IN', { maximumFractionDigits: 2 });
};
export const AdminOwnerDashboard: React.FC<AdminOwnerDashboardProps> = ({ setActiveWorkspace }) => {
  const { outlets, activeOutlet } = useOutlet();
  const { user } = useAuth();
  const { isOnline } = usePWA();

  const adminName =
    user?.first_name || user?.firstName || user?.last_name || user?.lastName || user?.username || 'Administrator';
  const adminRole = typeof user?.role === 'object' ? user.role.name : (user?.role || 'ADMIN');

  const [businessName, setBusinessName] = useState<string | null>(null);
  const [today, setToday] = useState<ExecutiveDashboardResponse | null>(null);
  const [inventory, setInventory] = useState<InventoryValuationResponse | null>(null);
  const [outletRows, setOutletRows] = useState<OutletPerfRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // --- Existing AI functionality (reused, not modified) ---
  const [aiRecs, setAiRecs] = useState<AIRecommendation[]>([]);
  const [aiLoading, setAiLoading] = useState<boolean>(true);
  const [aiQuestion, setAiQuestion] = useState<string>('');
  const [aiAnswer, setAiAnswer] = useState<SmartAIAskResponse | null>(null);
  const [aiAsking, setAiAsking] = useState<boolean>(false);
  const [aiFeedback, setAiFeedback] = useState<FeedbackState | null>(null);

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

  const load = useCallback(async () => {
    setError(null);
    const sellingOutlets = outlets.filter((o) => o.type !== 'HEAD_OFFICE');

    // Business Overview: today's sales + purchase (executive summary) & consolidated stock value
    try {
      const [execRes, invRes] = await Promise.all([
        reportsApi.getExecutiveSummary({ startDate: todayStart(), endDate: todayEnd() }),
        reportsApi.getInventoryValuation(),
      ]);
      setToday(execRes);
      setInventory(invRes);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Business overview could not be loaded.');
      setToday(null);
      setInventory(null);
    }

    // Outlet Performance: per-outlet live dashboard aggregation (tolerant of single-outlet failures)
    const results = await Promise.allSettled(sellingOutlets.map((o) => reportsApi.getOutletDashboard(o.id)));
    const rows: OutletPerfRow[] = [];
    let capturedCompany: string | null = null;
    results.forEach((r) => {
      if (r.status === 'fulfilled') {
        const d = r.value;
        if (!capturedCompany && d.outlet.companyName) capturedCompany = d.outlet.companyName;
        rows.push({
          outletId: d.outlet.id,
          outletName: d.outlet.name,
          outletCode: d.outlet.code,
          todaySales: Number(d.todaySales.todaySales || 0),
          orders: d.todaySales.todayOrdersCount || 0,
          stockValue: Number(d.stock.totalStockValue || 0),
          lowStock: d.stock.lowStockCount || 0,
          outOfStock: d.stock.outOfStockCount || 0,
          wastageCost: Number(d.wastage.todayWastageCost || 0),
          wastageEntries: d.wastage.todayWastageEntries || 0,
          closingLabel: d.closingCycle.periodLabel || 'Cycle in progress',
          closingDaysLeft: d.closingCycle.daysRemaining ?? null,
          lowItems: d.stock.lowStockItems || [],
        });
      }
    });
    setOutletRows(rows);
    setBusinessName(capturedCompany);
  }, [outlets]);

// --- Existing AI stock recommendations (reused from AIAssistantWorkspace pattern) ---
  const fetchAiRecommendations = useCallback(async () => {
    setAiLoading(true);
    setAiFeedback(null);
    try {
      const res = await apiClient.get('/ai/recommendations/stock');
      const dataList = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
      setAiRecs(dataList as AIRecommendation[]);
    } catch (err: any) {
      setAiFeedback({
        type: 'error',
        message: err?.response?.data?.detail || err?.message || 'Failed to fetch AI recommendations',
      });
    } finally {
      setAiLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAiRecommendations();
  }, [fetchAiRecommendations, activeOutlet.id]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => {
      setLoading(false);
      setRefreshing(false);
    });
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
    fetchAiRecommendations();
  };

  const handleAskAI = async (questionText?: string) => {
    const q = (questionText || aiQuestion).trim();
    if (!q) return;
    setAiAsking(true);
    setAiFeedback(null);
    try {
      const res = await procurementApi.askSmartRequirementAssistant({
        branch_id: activeOutlet.id,
        question: q,
      });
      setAiAnswer(res);
      setAiQuestion('');
    } catch (err: any) {
      setAiFeedback({
        type: 'error',
        message: err?.response?.data?.message || err?.message || 'AI Assistant query failed.',
      });
    } finally {
      setAiAsking(false);
    }
  };

  // Alerts computed purely from existing live data (no fake/invented values)
  const criticalStockAlerts: CriticalStockAlert[] = useMemo(() => {
    const alerts: CriticalStockAlert[] = [];
    outletRows.forEach((r) => {
      r.lowItems.forEach((it) => {
        const current = Number(it.currentStock || 0);
        const min = Number(it.minStockLevel || 0);
        const isCritical = current <= 0 || (min > 0 && current <= min * 0.5);
        if (isCritical) {
          alerts.push({ item: it.name, outlet: r.outletName, current, min, unit: it.unitSymbol || 'units' });
        }
      });
    });
    return alerts.slice(0, 10);
  }, [outletRows]);

  const highWastageAlerts: HighWastageAlert[] = useMemo(() => {
    const alerts: HighWastageAlert[] = [];
    outletRows.forEach((r) => {
      const w = r.wastageCost;
      const sales = r.todaySales;
      const pct = sales > 0 ? (w / sales) * 100 : w > 0 ? 100 : 0;
      if (w > 0 && (pct >= 5 || w >= 1000)) {
        const reason = pct >= 5
          ? `${pct.toFixed(1)}% of today's sales (≥ 5%)`
          : `₹${w.toLocaleString('en-IN')} in today's wastage loss`;
        alerts.push({ outlet: r.outletName, cost: w, pct, reason });
      }
    });
    return alerts.slice(0, 10);
  }, [outletRows]);

  const totalStockValue = outletRows.reduce((sum, r) => sum + r.stockValue, 0);
  const totalSales = outletRows.reduce((sum, r) => sum + r.todaySales, 0);
  const criticalRecCount = aiRecs.filter((r) => r.priority === 'HIGH').length;

  const quickAccess = [
    { id: 'reports' as WorkspaceId, label: 'Reports', desc: 'Analytics & cost control', icon: BarChart3, color: 'bg-[#2E8B57]/12 text-[#2E8B57]' },
    { id: 'organization' as WorkspaceId, label: 'Outlets', desc: 'Topology & masters', icon: Building2, color: 'bg-[#F1E4C5]/60 text-[#B8862D]' },
    { id: 'hr' as WorkspaceId, label: 'Staff', desc: 'HR, shifts & payroll', icon: Users, color: 'bg-blue-50 text-[#3978B8]' },
    { id: 'purchase' as WorkspaceId, label: 'Suppliers', desc: 'Vendors & purchase', icon: Truck, color: 'bg-purple-50 text-[#6B5B95]' },
    { id: 'users' as WorkspaceId, label: 'Settings', desc: 'User & admin mgmt', icon: Settings, color: 'bg-gray-100 text-[#707070]' },
  ];

  const displayBusinessName = businessName || 'Multi-Outlet Business';
return (
    <div className="space-y-4 sm:space-y-6 w-full min-w-0">
      {/* ===== 1. HEADER ===== */}
      <div className="relative overflow-hidden p-4 sm:p-6 bg-gradient-to-br from-white via-white/95 to-[#FAF8F5] border border-[rgba(45,45,45,0.08)] shadow-xs rounded-2xl sm:rounded-3xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-[#C79A3B]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-[#F1E4C5] text-[#B8862D] border border-[#B8862D]/30 shadow-xs">
              <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="truncate">ADMIN / OWNER DASHBOARD</span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-[#1C1C1C] font-['Outfit'] truncate">
              {displayBusinessName}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#707070]">
              <span className="inline-flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#C79A3B]" />
                Welcome, <strong className="text-[#1C1C1C]">{adminName}</strong>
              </span>
              <Badge variant="outlet">{adminRole}</Badge>
              {activeOutlet && (
                <span className="inline-flex items-center gap-1">
                  <span className="text-[#707070]">Scope:</span>
                  <span className="text-[#1C1C1C] font-bold truncate max-w-[180px]">{activeOutlet.name}</span>
                </span>
              )}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  isOnline
                    ? 'bg-[#2E8B57]/10 text-[#2E8B57] border-[#2E8B57]/20'
                    : 'bg-[#D9534F]/10 text-[#D9534F] border-[#D9534F]/20'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-[#2E8B57]' : 'bg-[#D9534F]'}`} />
                {isOnline ? 'Live' : 'Offline'}
              </span>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            loading={refreshing}
            icon={<RefreshCw className="w-3.5 h-3.5 text-[#B8862D]" />}
            className="self-start sm:self-auto"
          >
            Refresh
          </Button>
        </div>
      </div>

      <AlertBanner feedback={error ? { type: 'error', message: error } : null} onClose={() => setError(null)} />

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 animate-pulse">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-xs" />
          ))}
        </div>
      ) : (
        <>
          {/* ===== 2. BUSINESS OVERVIEW ===== */}
          <div className="space-y-2.5 sm:space-y-3">
            <h2 className="text-xs sm:text-sm font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#C79A3B]" /> Business Overview
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
              <StatCard
                title="Today's Sales"
                value={today ? formatCurrency(today.kpis?.totalRevenue) : formatCurrency(totalSales)}
                subtitle={`${today?.kpis?.totalOrders ?? 0} orders today`}
                icon={<TrendingUp className="w-4 h-4 text-[#2E8B57]" />}
                iconBgColor="bg-[#2E8B57]/10 text-[#2E8B57]"
              />
              <StatCard
                title="Purchase (Today)"
                value={today ? formatCurrency(today.kpis?.totalProcurementSpend) : '—'}
                subtitle={today ? 'APPROVED/ISSUED PO spend' : 'Purchase data unavailable'}
                icon={<ShoppingCart className="w-4 h-4 text-[#3978B8]" />}
                iconBgColor="bg-blue-50 text-[#3978B8]"
              />
              <StatCard
                title="Stock Value"
                value={inventory ? formatCurrency(inventory.totalValuation) : formatCurrency(totalStockValue)}
                subtitle={inventory ? `${inventory.totalItemsCount} items tracked` : 'Live inventory valuation'}
                icon={<Boxes className="w-4 h-4 text-[#B8862D]" />}
                iconBgColor="bg-[#F1E4C5]/40 text-[#B8862D]"
                onClick={() => setActiveWorkspace('inventory')}
              />
              <StatCard
                title="Low Stock Items"
                value={inventory?.lowStockItemsCount ?? outletRows.reduce((s, r) => s + r.lowStock, 0)}
                subtitle="At/below minimum thresholds"
                icon={<AlertTriangle className="w-4 h-4 text-red-600" />}
                iconBgColor="bg-red-50 text-red-600"
                onClick={() => setActiveWorkspace('inventory')}
              />
            </div>
            <div className="flex items-start gap-2 p-3 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] text-[11px] text-[#707070]">
              <Info className="w-3.5 h-3.5 text-[#C79A3B] shrink-0 mt-0.5" />
              <span>
                Expense &amp; Outstanding figures are not shown because the required accounting data APIs are not yet
                available.
              </span>
            </div>
          </div>
{/* ===== 3. OUTLET PERFORMANCE ===== */}
          <div className="space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs sm:text-sm font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#C79A3B]" /> Outlet Performance
              </h2>
              <button
                onClick={() => setActiveWorkspace('organization')}
                className="text-[11px] font-bold text-[#B8862D] hover:text-[#9E7326] flex items-center gap-1"
              >
                All Outlets <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {outletRows.length === 0 ? (
              <EmptyState
                title="No outlet data available"
                description="No operational outlets could be loaded. Check backend connectivity or your assigned outlet scope."
                icon={<Building2 className="w-6 h-6 text-[#C79A3B]" />}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-4">
                {outletRows.map((row) => {
                  const wastagePct = row.todaySales > 0 ? (row.wastageCost / row.todaySales) * 100 : 0;
                  return (
                    <div
                      key={row.outletId}
                      className="bg-white border border-[rgba(45,45,45,0.08)] hover:border-[#C79A3B]/40 rounded-2xl p-4 sm:p-5 shadow-xs transition-all"
                    >
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="min-w-0">
                          <h3 className="font-bold text-xs sm:text-sm text-[#1C1C1C] font-['Outfit'] truncate">
                            {row.outletName}
                          </h3>
                          <p className="text-[10px] text-[#707070] font-mono truncate">[{row.outletCode}]</p>
                        </div>
                        <Badge variant="outlet">Sales: {formatCurrency(row.todaySales)}</Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 text-xs">
                        <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)]">
                          <span className="text-[10px] text-[#707070] block">Sales</span>
                          <span className="font-bold text-[#1C1C1C]">{formatCurrency(row.todaySales)}</span>
                          <span className="text-[10px] text-[#707070] block mt-0.5">{row.orders} orders</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)]">
                          <span className="text-[10px] text-[#707070] block">Stock Status</span>
                          <span className="font-bold text-[#1C1C1C]">{formatCurrency(row.stockValue)}</span>
                          <span className="text-[10px] text-[#707070] block mt-0.5">
                            {row.lowStock} low · {row.outOfStock} out
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)]">
                          <span className="text-[10px] text-[#707070] block">Wastage</span>
                          <span className={`font-bold ${row.wastageCost > 0 ? 'text-red-600' : 'text-[#2E8B57]'}`}>
                            {formatCurrency(row.wastageCost)}
                          </span>
                          <span className="text-[10px] text-[#707070] block mt-0.5">
                            {row.wastageEntries} entries · {wastagePct.toFixed(1)}% of sales
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)]">
                          <span className="text-[10px] text-[#707070] block">Closing Status</span>
                          <span className="font-bold text-[#1C1C1C] leading-tight block">{row.closingLabel}</span>
                          {row.closingDaysLeft !== null && (
                            <span className="text-[10px] text-[#B8862D] font-semibold block mt-0.5">
                              Cycle in progress · {row.closingDaysLeft} days left
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] text-[11px] text-[#707070]">
              <Hourglass className="w-3.5 h-3.5 text-[#C79A3B] shrink-0 mt-0.5" />
              <span>
                Closing shows the current bi-monthly cycle window &amp; days left. Completion status is not exposed by
                the API, so closure-complete is not marked.
              </span>
            </div>
          </div>
{/* ===== 4. BUSINESS ALERTS ===== */}
          <div className="space-y-2.5 sm:space-y-3">
            <h2 className="text-xs sm:text-sm font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" /> Business Alerts
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-4">
              {/* Critical Stock */}
              <div className="bg-white border border-[rgba(45,45,45,0.08)] rounded-2xl p-4 shadow-xs space-y-2.5">
                <div className="flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-red-600" />
                  <h3 className="font-bold text-xs text-[#1C1C1C]">Critical Stock ({criticalStockAlerts.length})</h3>
                </div>
                {criticalStockAlerts.length === 0 ? (
                  <div className="py-6 text-center text-[#707070] space-y-1">
                    <CheckCircle2 className="w-6 h-6 mx-auto text-[#2E8B57] mb-1" />
                    <p className="text-xs text-[#1C1C1C] font-bold">No critical stock</p>
                    <p className="text-[11px]">No items at or below 50% of min stock level.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {criticalStockAlerts.map((a, i) => (
                      <div
                        key={`${a.item}-${a.outlet}-${i}`}
                        className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-[#1C1C1C] truncate">{a.item}</p>
                          <p className="text-[10px] text-[#707070] truncate">{a.outlet}</p>
                        </div>
                        <span className="shrink-0 text-[10px] font-bold text-red-600">
                          {formatQty(a.current)} / min {formatQty(a.min)} {a.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* High Wastage */}
              <div className="bg-white border border-[rgba(45,45,45,0.08)] rounded-2xl p-4 shadow-xs space-y-2.5">
                <div className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-red-600" />
                  <h3 className="font-bold text-xs text-[#1C1C1C]">High Wastage ({highWastageAlerts.length})</h3>
                </div>
                {highWastageAlerts.length === 0 ? (
                  <div className="py-6 text-center text-[#707070] space-y-1">
                    <CheckCircle2 className="w-6 h-6 mx-auto text-[#2E8B57] mb-1" />
                    <p className="text-xs text-[#1C1C1C] font-bold">No high wastage</p>
                    <p className="text-[11px]">No outlet exceeded the daily wastage threshold.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {highWastageAlerts.map((a, i) => (
                      <div
                        key={`${a.outlet}-${i}`}
                        className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-[#1C1C1C] truncate">{a.outlet}</p>
                          <p className="text-[10px] text-[#707070] truncate">{a.reason}</p>
                        </div>
                        <span className="shrink-0 text-[10px] font-bold text-red-600">{formatCurrency(a.cost)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-[#707070]">
                  Threshold: wastage ≥ 5% of today's sales OR ≥ ₹1,000 (matches backend approval threshold). Unusual
                  Expense / Missing Closing alerts are pending backend data.
                </p>
              </div>
            </div>
          </div>
{/* ===== 5. AI BUSINESS INTELLIGENCE ===== */}
          <div className="space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs sm:text-sm font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#C79A3B]" /> AI Business Intelligence
              </h2>
              <button
                onClick={() => setActiveWorkspace('assistant')}
                className="text-[11px] font-bold text-[#B8862D] hover:text-[#9E7326] flex items-center gap-1"
              >
                Open AI Assistant <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 sm:gap-4">
              {/* Existing AI: Stock Recommendations */}
              <div className="bg-white border border-[rgba(45,45,45,0.08)] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-[#3978B8]" />
                    <h3 className="font-bold text-xs text-[#1C1C1C]">Existing AI — Stock Recommendations</h3>
                  </div>
                  <Badge variant={criticalRecCount > 0 ? 'danger' : 'success'}>{criticalRecCount} critical</Badge>
                </div>
                <p className="text-[11px] text-[#707070]">
                  Reorder intelligence for <strong className="text-[#1C1C1C]">{activeOutlet?.name}</strong> via the
                  existing stock AI endpoint.
                </p>

                <AlertBanner feedback={aiFeedback} onClose={() => setAiFeedback(null)} />

                {aiLoading ? (
                  <div className="space-y-2 animate-pulse">
                    <div className="h-14 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)]" />
                    <div className="h-14 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)]" />
                  </div>
                ) : aiRecs.length === 0 ? (
                  <EmptyState
                    title="No AI recommendations"
                    description={`No stock reorder recommendations for ${activeOutlet?.name} right now.`}
                    icon={<CheckCircle2 className="w-6 h-6 text-[#2E8B57]" />}
                  />
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {aiRecs.slice(0, 5).map((rec) => (
                      <div
                        key={rec.item_id}
                        className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-[#1C1C1C] truncate">{rec.item_name}</p>
                          <p className="text-[10px] text-[#707070] truncate">
                            {formatQty(rec.current_quantity)} on hand · suggest {formatQty(rec.suggested_order_quantity)}
                          </p>
                        </div>
                        <Badge variant={rec.priority === 'HIGH' ? 'danger' : 'warning'}>{rec.priority}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
{/* Existing AI: Ask Assistant */}
              <div className="bg-white border border-[rgba(45,45,45,0.08)] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-[#6B5B95]" />
                  <h3 className="font-bold text-xs text-[#1C1C1C]">Existing AI — Ask Assistant</h3>
                </div>
                <p className="text-[11px] text-[#707070]">
                  Natural-language requirement assistant for <strong className="text-[#1C1C1C]">{activeOutlet?.name}</strong>{' '}
                  via the existing procurement AI endpoint.
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAskAI();
                    }}
                    placeholder="e.g. What stock should I order this week?"
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] focus:border-[#C79A3B]/50 focus:outline-none text-xs text-[#1C1C1C] placeholder-[#A0A0A0]"
                  />
                  <Button
                    variant="gold"
                    size="md"
                    onClick={() => handleAskAI()}
                    loading={aiAsking}
                    disabled={!aiQuestion.trim()}
                  >
                    Ask
                  </Button>
                </div>

                {aiAnswer && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outlet">{aiAnswer.intent || 'Answer'}</Badge>
                      <button
                        onClick={() => setAiAnswer(null)}
                        aria-label="Dismiss AI answer"
                        className="p-1 rounded-lg text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="p-3 rounded-lg bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] text-xs leading-relaxed whitespace-pre-line">
                      {aiAnswer.answer_text}
                    </div>
                    {aiAnswer.metrics && (
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="p-2 rounded-lg bg-white border border-[rgba(45,45,45,0.06)]">
                          <span className="text-[10px] text-[#707070] block truncate">Monitored</span>
                          <span className="font-bold text-[#1C1C1C]">{aiAnswer.metrics.total_monitored_items ?? 0}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-white border border-[rgba(45,45,45,0.06)]">
                          <span className="text-[10px] text-red-600 block truncate">Critical</span>
                          <span className="font-bold text-red-600">{aiAnswer.metrics.critical_count ?? 0}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-white border border-[rgba(45,45,45,0.06)]">
                          <span className="text-[10px] text-amber-700 block truncate">Below Min</span>
                          <span className="font-bold text-amber-700">{aiAnswer.metrics.low_stock_count ?? 0}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Explicit separation: future AI (no backend yet) */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-[#FAF8F5] border border-dashed border-[#C79A3B]/30 text-[11px] text-[#707070]">
              <Info className="w-3.5 h-3.5 text-[#C79A3B] shrink-0 mt-0.5" />
              <span>
                <strong className="text-[#1C1C1C]">Coming soon:</strong> AI Business Summary &amp; Important Insights
                require a dedicated business-intelligence backend which is not yet available. The two existing AI
                capabilities above are shown as-is.
              </span>
            </div>
          </div>
{/* ===== 6. QUICK ACCESS ===== */}
          <div className="space-y-2.5 sm:space-y-3">
            <h2 className="text-xs sm:text-sm font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[#C79A3B]" /> Quick Access
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4">
              {quickAccess.map((qa) => {
                const Icon = qa.icon;
                return (
                  <div
                    key={qa.id}
                    onClick={() => setActiveWorkspace(qa.id)}
                    className="p-3.5 sm:p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-xs hover:shadow-md hover:border-[#C79A3B]/40 transition-all cursor-pointer group flex items-center gap-3 sm:flex-col sm:items-start active:scale-[0.99]"
                  >
                    <div className={`w-10 h-10 rounded-xl ${qa.color} flex items-center justify-center shrink-0`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-xs sm:text-sm text-[#1C1C1C] font-['Outfit'] group-hover:text-[#B8862D] transition-colors truncate">
                        {qa.label}
                      </h3>
                      <p className="text-[10px] sm:text-[11px] text-[#707070] truncate">{qa.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminOwnerDashboard;