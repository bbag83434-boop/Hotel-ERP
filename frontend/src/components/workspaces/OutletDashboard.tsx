'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useOutlet } from '@/context/OutletContext';
import { useAuth } from '@/context/AuthContext';
import { reportsApi } from '@/api/reports';
import { procurementApi } from '@/api/procurement';
import { inventoryApi } from '@/api/inventory';
import {
  OutletDashboardResponse,
  LowStockAlertItem,
  OutletActivityItem,
} from '@/types/reports.types';
import { SmartRequirementDraft, SmartRequirementItem } from '@/types/purchase.types';
import { Item as CatalogItem } from '@/types/inventory.types';
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
  RefreshCw,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  LogOut,
  Plus,
  Edit3,
  Save,
  Send,
  Check,
  X,
  Layers,
} from 'lucide-react';

interface OutletDashboardProps {
  branchId?: string;
  setActiveWorkspace?: (id: WorkspaceId) => void;
}

export const OutletDashboard: React.FC<OutletDashboardProps> = ({ branchId, setActiveWorkspace }) => {
  const { activeOutlet, closingInfo, refreshOutlets } = useOutlet();
  const { user, logout } = useAuth();
  const userRole = typeof user?.role === 'object' ? user.role.name : (user?.role || 'OUTLET_STAFF');

  const [dashboardData, setDashboardData] = useState<OutletDashboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // AI Purchase Assistant State
  const [smartDraft, setSmartDraft] = useState<SmartRequirementDraft | null>(null);
  const [smartItems, setSmartItems] = useState<SmartRequirementItem[]>([]);
  const [loadingSmart, setLoadingSmart] = useState<boolean>(false);
  const [savingSmart, setSavingSmart] = useState<boolean>(false);
  const [confirmingSmart, setConfirmingSmart] = useState<boolean>(false);
  const [smartSuccessMsg, setSmartSuccessMsg] = useState<string | null>(null);
  const [smartErrorMsg, setSmartErrorMsg] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [addQty, setAddQty] = useState<string>('10');

  const targetOutletId = branchId || (activeOutlet?.id !== 'all' ? activeOutlet?.id : undefined);

  const loadSmartRequirementDraft = useCallback(async (bId?: string) => {
    const effectiveBranchId = bId || targetOutletId;
    if (!effectiveBranchId) return;
    setLoadingSmart(true);
    setSmartErrorMsg(null);
    try {
      let draft: SmartRequirementDraft | null = null;
      try {
        draft = await procurementApi.getSmartRequirementDraft(effectiveBranchId);
      } catch (err: any) {
        if (err?.response?.status === 404) {
          draft = await procurementApi.generateSmartRequirement({ branch_id: effectiveBranchId });
        } else {
          throw err;
        }
      }
      if (draft) {
        setSmartDraft(draft);
        setSmartItems(draft.items || []);
      }
    } catch (err: any) {
      console.warn('Could not load smart requirement draft:', err);
      setSmartErrorMsg(err?.response?.data?.detail || 'Unable to load AI purchase recommendations.');
    } finally {
      setLoadingSmart(false);
    }
  }, [targetOutletId]);

  const loadCatalogItems = useCallback(async () => {
    try {
      const items = await inventoryApi.getItems({ is_active: true });
      setCatalogItems(items || []);
      if (items && items.length > 0) {
        setSelectedItemId(items[0].id);
      }
    } catch (err) {
      console.warn('Could not load catalog items for assistant:', err);
    }
  }, []);

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
  }, [activeOutlet?.id, branchId]);

  useEffect(() => {
    setLoading(true);
    fetchDashboardData();
    if (targetOutletId) {
      loadSmartRequirementDraft(targetOutletId);
    }
    loadCatalogItems();
  }, [fetchDashboardData, loadSmartRequirementDraft, loadCatalogItems, targetOutletId]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
    if (targetOutletId) {
      loadSmartRequirementDraft(targetOutletId);
    }
    refreshOutlets();
  };

  // AI Assistant: Update Quantity
  const handleItemQtyChange = async (itemId: string, newQty: number) => {
    const updated = smartItems.map((item) =>
      item.item_id === itemId
        ? { ...item, final_order_qty: Math.max(0, newQty), is_user_modified: true }
        : item
    );
    setSmartItems(updated);
    if (smartDraft?.id) {
      setSavingSmart(true);
      try {
        const saved = await procurementApi.updateSmartRequirementDraftItems(smartDraft.id, {
          items: updated,
        });
        setSmartDraft(saved);
      } catch (err: any) {
        console.error('Failed to auto-save item quantity:', err);
      } finally {
        setSavingSmart(false);
      }
    }
  };

  // AI Assistant: Remove Item
  const handleRemoveItem = async (itemId: string) => {
    const updated = smartItems.filter((item) => item.item_id !== itemId);
    setSmartItems(updated);
    if (smartDraft?.id) {
      setSavingSmart(true);
      try {
        const saved = await procurementApi.updateSmartRequirementDraftItems(smartDraft.id, {
          items: updated,
        });
        setSmartDraft(saved);
      } catch (err: any) {
        console.error('Failed to remove item from draft:', err);
      } finally {
        setSavingSmart(false);
      }
    }
  };

  // AI Assistant: Add Item to Draft
  const handleAddItemToDraft = async () => {
    if (!selectedItemId || !smartDraft?.id) return;
    const catItem = catalogItems.find((c) => c.id === selectedItemId);
    if (!catItem) return;

    const qty = Number(addQty) || 1;
    const existingIndex = smartItems.findIndex((i) => i.item_id === selectedItemId);
    let updated: SmartRequirementItem[];

    if (existingIndex >= 0) {
      updated = [...smartItems];
      updated[existingIndex] = {
        ...updated[existingIndex],
        final_order_qty: Number(updated[existingIndex].final_order_qty || 0) + qty,
        is_user_modified: true,
      };
    } else {
      const newItem: SmartRequirementItem = {
        item_id: catItem.id,
        item_name: catItem.name,
        item_code: catItem.code,
        unit_symbol: (catItem as any)?.unit?.symbol || (catItem as any)?.unit_symbol || 'units',
        supplier_id: (catItem as any)?.supplier_id || undefined,
        current_stock: 0,
        min_stock: (catItem as any)?.min_stock_level || (catItem as any)?.min_stock || 0,
        target_stock: ((catItem as any)?.min_stock_level || (catItem as any)?.min_stock || 0) * 2,
        pending_incoming: 0,
        daily_consumption: 0,
        short_qty: qty,
        system_suggested_qty: qty,
        final_order_qty: qty,
        priority: 'MEDIUM',
        is_user_modified: true,
        is_manually_added: true,
        reason: 'Manually added by outlet operator for urgent replenishment',
      };
      updated = [newItem, ...smartItems];
    }

    setSmartItems(updated);
    setShowAddModal(false);
    setAddQty('10');

    setSavingSmart(true);
    try {
      const saved = await procurementApi.updateSmartRequirementDraftItems(smartDraft.id, {
        items: updated,
      });
      setSmartDraft(saved);
    } catch (err: any) {
      console.error('Failed to save added item:', err);
    } finally {
      setSavingSmart(false);
    }
  };

  // AI Assistant: Regenerate
  const handleRegenerateRecommendations = async () => {
    if (!targetOutletId) return;
    setLoadingSmart(true);
    setSmartSuccessMsg(null);
    setSmartErrorMsg(null);
    try {
      const draft = await procurementApi.generateSmartRequirement({
        branch_id: targetOutletId,
        force_regenerate: true,
      });
      setSmartDraft(draft);
      setSmartItems(draft.items || []);
      setSmartSuccessMsg('AI Replenishment recommendations updated from live stock & consumption.');
    } catch (err: any) {
      setSmartErrorMsg(err?.response?.data?.detail || 'Failed to regenerate recommendations.');
    } finally {
      setLoadingSmart(false);
    }
  };

  // AI Assistant: One-Click Create PO / Indent
  const handleOneClickCreatePO = async () => {
    if (!smartDraft?.id) return;
    const activeItems = smartItems.filter((i) => Number(i.final_order_qty) > 0);
    if (activeItems.length === 0) {
      setSmartErrorMsg('Cannot create PO: Please ensure at least one item has an order quantity greater than 0.');
      return;
    }

    setConfirmingSmart(true);
    setSmartSuccessMsg(null);
    setSmartErrorMsg(null);
    try {
      const result = await procurementApi.confirmSmartRequirementDraft(smartDraft.id, {
        notes: `AI Purchase Order created from outlet cockpit on ${new Date().toLocaleDateString()}`,
      });
      setSmartSuccessMsg(
        result?.message || `Purchase Order / Indent (${result?.request_number || 'Confirmed'}) successfully created with ${activeItems.length} items.`
      );
      // Refresh dashboard metrics
      fetchDashboardData();
      // Reload draft (which will now show as confirmed or allow next cycle)
      if (targetOutletId) {
        loadSmartRequirementDraft(targetOutletId);
      }
    } catch (err: any) {
      setSmartErrorMsg(err?.response?.data?.detail || 'Failed to create Purchase Order. Please try again.');
    } finally {
      setConfirmingSmart(false);
    }
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
      badgeColor: dashboardData?.stock && dashboardData.stock.lowStockCount > 0 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
      allowed: !dashboardData || dashboardData.allowedModules.includes('inventory'),
    },
    {
      id: 'purchase' as WorkspaceId,
      name: 'Purchase & PR',
      desc: 'Replenishment requests, approvals & GRN',
      icon: ShoppingCart,
      badge: dashboardData?.procurement ? `${dashboardData.procurement.pendingPrCount} Pending` : undefined,
      badgeColor: 'bg-[#F1E4C5] text-[#B8862D] border-[#B8862D]/30',
      allowed: !dashboardData || dashboardData.allowedModules.includes('purchase'),
    },
    {
      id: 'production' as WorkspaceId,
      name: 'Kitchen & Production',
      desc: 'Recipe standard cost, batches & yield logs',
      icon: ChefHat,
      badge: dashboardData?.production ? `${dashboardData.production.todayProductionBatches} Batches` : undefined,
      badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
      allowed: !dashboardData || dashboardData.allowedModules.includes('production'),
    },
    {
      id: 'transfers' as WorkspaceId,
      name: 'Store Transfers',
      desc: 'Inter-warehouse dispatch & branch receipts',
      icon: Truck,
      badge: dashboardData?.transfers ? `${dashboardData.transfers.pendingInboundTransfers} Inbound` : undefined,
      badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
      allowed: !dashboardData || dashboardData.allowedModules.includes('transfers'),
    },
    {
      id: 'wastage' as WorkspaceId,
      name: 'Wastage Control',
      desc: 'Daily spoiled stock logs & approval queue',
      icon: Trash2,
      badge: dashboardData?.wastage ? `${dashboardData.wastage.todayWastageEntries} Logs` : undefined,
      badgeColor: dashboardData?.wastage && dashboardData.wastage.todayWastageCost > 0 ? 'bg-red-100 text-red-700 border-red-200' : 'bg-gray-100 text-gray-700 border-gray-200',
      allowed: !dashboardData || dashboardData.allowedModules.includes('wastage'),
    },
    {
      id: 'assistant' as WorkspaceId,
      name: 'AI Operations Copilot',
      desc: 'Automated insights, forecast & inventory Q&A',
      icon: Sparkles,
      badge: 'Smart AI',
      badgeColor: 'bg-[#F1E4C5] text-[#B8862D] border-[#B8862D]/30',
      allowed: true,
    },
    {
      id: 'closing' as WorkspaceId,
      name: 'Bi-Monthly Closing',
      desc: '15-day financial reconciliation & variance',
      icon: CalendarCheck,
      badge: dashboardData?.closingCycle ? `${dashboardData.closingCycle.daysRemaining}d Left` : undefined,
      badgeColor: 'bg-[#F1E4C5] text-[#B8862D] border-[#B8862D]/30',
      allowed: !dashboardData || dashboardData.allowedModules.includes('closing'),
    },
    {
      id: 'reports' as WorkspaceId,
      name: 'Outlet Analytics',
      desc: 'Detailed sales, consumption & margin reports',
      icon: BarChart3,
      badge: 'Deep Dive',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      allowed: !dashboardData || dashboardData.allowedModules.includes('reports'),
    },
  ];

  // Render Skeletons during loading
  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6 w-full min-w-0 animate-pulse">
        {/* Header Skeleton */}
        <div className="h-28 bg-white border border-[rgba(45,45,45,0.08)] rounded-2xl sm:rounded-3xl p-6 flex items-center justify-between shadow-xs">
          <div className="space-y-2">
            <div className="h-4 w-32 bg-[#FAF8F5] rounded-md" />
            <div className="h-7 w-64 bg-[#FAF8F5] rounded-md" />
          </div>
          <div className="h-10 w-28 bg-[#FAF8F5] rounded-xl" />
        </div>

        {/* 6 Stats Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-36 bg-white border border-[rgba(45,45,45,0.08)] rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="flex justify-between items-center">
                <div className="h-4 w-28 bg-[#FAF8F5] rounded" />
                <div className="h-8 w-8 bg-[#FAF8F5] rounded-lg" />
              </div>
              <div className="h-8 w-36 bg-[#FAF8F5] rounded" />
              <div className="h-3 w-48 bg-[#FAF8F5] rounded" />
            </div>
          ))}
        </div>

        {/* Launchpad Skeleton */}
        <div className="h-48 bg-white border border-[rgba(45,45,45,0.08)] rounded-2xl p-6 shadow-xs" />
      </div>
    );
  }

  // Render Error Notice
  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="bg-white border border-red-200 rounded-3xl p-8 max-w-lg w-full text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto text-red-600">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-[#1C1C1C] font-['Outfit']">Outlet Dashboard Notice</h2>
            <p className="text-xs text-[#707070] leading-relaxed">{error}</p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={handleManualRefresh}
              className="px-4 py-2 rounded-xl bg-[#1C1C1C] hover:bg-[#2D2D2D] text-white font-bold text-xs transition-all shadow-xs flex items-center gap-2 active:scale-[0.98]"
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
    <div className="space-y-4 sm:space-y-6 w-full min-w-0">
      {/* ========================================================================= */}
      {/* 1. HERO BANNER: ACTIVE SCOPE & BI-MONTHLY CYCLE                           */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden luxury-card p-4 sm:p-6 md:p-8 bg-gradient-to-br from-white via-white/95 to-[#FAF8F5] border border-[rgba(45,45,45,0.08)] shadow-[0_4px_24px_rgba(45,45,45,0.04)] rounded-2xl sm:rounded-3xl">
        {/* Subtle Luxury Gradient Accent */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#C79A3B]/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          {/* Left: Outlet Profile & Active Badge */}
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-[#FAF8F5] text-[#B8862D] border border-[rgba(45,45,45,0.1)]">
                [{outlet?.code || 'OUTLET'}]
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FAF8F5] text-[#707070] border border-[rgba(45,45,45,0.08)]">
                {outlet?.type || 'RESTAURANT'}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#2E8B57]/15 text-[#2E8B57] border border-[#2E8B57]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2E8B57] animate-pulse" />
                Live Operational Scope
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#1C1C1C] tracking-tight font-['Outfit'] flex items-center gap-2">
              <Building2 className="w-6 h-6 sm:w-7 sm:h-7 text-[#C79A3B]" />
              {outlet?.name || 'CB Hotel Management Outlet'}
            </h1>
            <p className="text-xs text-[#707070]">
              Operational Command Cockpit · Logged in as <strong className="text-[#1C1C1C]">{user?.first_name || user?.firstName || user?.username || 'Authorized Staff'}</strong> ({userRole || 'OUTLET_STAFF'})
            </p>
          </div>

          {/* Right: Closing Cycle Status & Refresh Action */}
          <div className="flex items-center gap-3 shrink-0">
            {/* 15-Day Cycle Pill */}
            <div className="bg-white border border-[rgba(45,45,45,0.08)] rounded-xl px-4 py-2 text-right shadow-xs hidden sm:block">
              <div className="text-[11px] font-bold text-[#B8862D] flex items-center justify-end gap-1.5">
                <CalendarCheck className="w-3.5 h-3.5 text-[#C79A3B]" />
                {cycleLabel}
              </div>
              <div className="text-[11px] text-[#707070] mt-0.5">
                <span className="text-[#1C1C1C] font-bold">{cycleDaysRemaining} days</span> remaining · {formatCurrency(cycleSales)}
              </div>
            </div>

            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] hover:bg-[#FAF8F5] text-[#707070] hover:text-[#1C1C1C] transition-all shadow-xs active:scale-[0.98] disabled:opacity-50"
              title="Refresh Live Outlet Data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#B8862D]' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => logout()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#D9534F]/10 hover:bg-[#D9534F]/20 text-[#D9534F] border border-[#D9534F]/30 text-xs font-bold transition-all shadow-xs active:scale-[0.98]"
              title="Sign Out of Outlet Session"
              aria-label="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. OPERATIONAL KPI SUMMARY CARDS (6 Metrics Grid)                         */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Metric 1: Today's POS Sales */}
        <div className="bg-white border border-[rgba(45,45,45,0.08)] hover:border-[#C79A3B]/40 rounded-2xl p-4 sm:p-5 transition-all shadow-xs group">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#707070]">Today's POS Sales</span>
            <div className="p-2 rounded-xl bg-[#2E8B57]/10 text-[#2E8B57] border border-[#2E8B57]/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#1C1C1C] font-['Outfit'] tracking-tight">
            {formatCurrency(sales?.todaySales)}
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-[#707070] border-t border-[rgba(45,45,45,0.06)] pt-2.5">
            <span>{sales?.todayOrdersCount || 0} Orders logged</span>
            <span className="text-[#1C1C1C] font-medium">
              Tables: {sales?.activeTablesOccupied || 0}/{sales?.totalDiningTables || 0}
            </span>
          </div>
        </div>

        {/* Metric 2: Live Stock Valuation & Low Stock */}
        <div className="bg-white border border-[rgba(45,45,45,0.08)] hover:border-[#C79A3B]/40 rounded-2xl p-4 sm:p-5 transition-all shadow-xs group">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#707070]">Stock Valuation</span>
            <div className="p-2 rounded-xl bg-blue-50 text-[#3978B8] border border-blue-100">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#1C1C1C] font-['Outfit'] tracking-tight">
            {formatCurrency(stock?.totalStockValue)}
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-[#707070] border-t border-[rgba(45,45,45,0.06)] pt-2.5">
            <span>{stock?.totalItemsInStock || 0} SKUs Stocked</span>
            {stock && stock.lowStockCount > 0 ? (
              <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full text-[10px] font-bold border border-amber-200 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {stock.lowStockCount} Low Stock
              </span>
            ) : (
              <span className="text-[#2E8B57] bg-[#2E8B57]/10 px-2 py-0.5 rounded-full text-[10px] font-bold border border-[#2E8B57]/20 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Optimal
              </span>
            )}
          </div>
        </div>

        {/* Metric 3: Procurement & Purchase Requests */}
        <div className="bg-white border border-[rgba(45,45,45,0.08)] hover:border-[#C79A3B]/40 rounded-2xl p-4 sm:p-5 transition-all shadow-xs group">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#707070]">Procurement PRs</span>
            <div className="p-2 rounded-xl bg-[#F1E4C5]/60 text-[#B8862D] border border-[#B8862D]/20">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#1C1C1C] font-['Outfit'] tracking-tight flex items-baseline gap-2">
            <span>{proc?.pendingPrCount || 0}</span>
            <span className="text-xs font-normal text-[#707070]">Pending Approvals</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-[#707070] border-t border-[rgba(45,45,45,0.06)] pt-2.5">
            <span>{proc?.approvedPrCount || 0} In PO Pipeline</span>
            <span className="text-[#1C1C1C] font-medium">Month PO: {formatCurrency(proc?.monthPoSpend)}</span>
          </div>
        </div>

        {/* Metric 4: Kitchen Batches & Production */}
        <div className="bg-white border border-[rgba(45,45,45,0.08)] hover:border-[#C79A3B]/40 rounded-2xl p-4 sm:p-5 transition-all shadow-xs group">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#707070]">Kitchen Production</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-100">
              <ChefHat className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#1C1C1C] font-['Outfit'] tracking-tight flex items-baseline gap-2">
            <span>{prod?.todayProductionBatches || 0}</span>
            <span className="text-xs font-normal text-[#707070]">Batches Today</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-[#707070] border-t border-[rgba(45,45,45,0.06)] pt-2.5">
            <span>{prod?.activeRecipesCount || 0} Active Recipes</span>
            <span className="text-[#1C1C1C] font-medium">{prod?.todayProducedQty || 0} units yield</span>
          </div>
        </div>

        {/* Metric 5: Store Transfers Inbound / Outbound */}
        <div className="bg-white border border-[rgba(45,45,45,0.08)] hover:border-[#C79A3B]/40 rounded-2xl p-4 sm:p-5 transition-all shadow-xs group">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#707070]">Store Transfers</span>
            <div className="p-2 rounded-xl bg-blue-50 text-[#3978B8] border border-blue-100">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#1C1C1C] font-['Outfit'] tracking-tight flex items-baseline gap-2">
            <span>{transfers?.pendingInboundTransfers || 0}</span>
            <span className="text-xs font-normal text-[#707070]">Inbound Pending</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-[#707070] border-t border-[rgba(45,45,45,0.06)] pt-2.5">
            <span>Outbound: {transfers?.pendingOutboundTransfers || 0}</span>
            <span className="text-[#2E8B57] font-medium">{transfers?.todayCompletedTransfers || 0} Received</span>
          </div>
        </div>

        {/* Metric 6: Wastage Today */}
        <div className="bg-white border border-[rgba(45,45,45,0.08)] hover:border-[#C79A3B]/40 rounded-2xl p-4 sm:p-5 transition-all shadow-xs group">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#707070]">Wastage Today</span>
            <div className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-100">
              <Trash2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#1C1C1C] font-['Outfit'] tracking-tight">
            {formatCurrency(wastage?.todayWastageCost)}
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-[#707070] border-t border-[rgba(45,45,45,0.06)] pt-2.5">
            <span>{wastage?.todayWastageEntries || 0} Logged Incidents</span>
            {wastage && wastage.pendingWastageApprovals > 0 ? (
              <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded-full text-[10px] font-bold border border-red-200">
                {wastage.pendingWastageApprovals} Pending
              </span>
            ) : (
              <span className="text-[#707070]">Period: {formatCurrency(wastage?.periodWastageCost)}</span>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. QUICK-ACCESS OUTLET MODULE LAUNCHPAD (Role-Gated)                      */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#C79A3B]" />
            Outlet Module Launchpad
          </h2>
          <span className="text-xs text-[#707070]">Direct 1-tap navigation for {outlet?.name || 'this outlet'}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
          {outletModules.filter((m) => m.allowed).map((mod) => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                onClick={() => setActiveWorkspace?.(mod.id)}
                className="bg-white border border-[rgba(45,45,45,0.08)] hover:border-[#C79A3B]/50 hover:shadow-md rounded-2xl p-4 text-left transition-all duration-150 flex flex-col justify-between h-32 shadow-xs group cursor-pointer active:scale-[0.99]"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-9 h-9 rounded-xl bg-[#FAF8F5] group-hover:bg-[#F1E4C5] text-[#707070] group-hover:text-[#B8862D] transition-colors flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </div>
                  {mod.badge && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${mod.badgeColor}`}>
                      {mod.badge}
                    </span>
                  )}
                </div>

                <div>
                  <div className="text-xs sm:text-sm font-bold text-[#1C1C1C] group-hover:text-[#B8862D] font-['Outfit'] transition-colors flex items-center justify-between">
                    <span>{mod.name}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#B8862D]" />
                  </div>
                  <div className="text-[11px] text-[#707070] line-clamp-1 mt-0.5">{mod.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. LOWER SECTION: OUTLET AI PURCHASE ASSISTANT & OPERATIONAL FEED         */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Left (7 cols): Interactive Outlet AI Purchase Order Assistant */}
        <div className="lg:col-span-7 bg-white border border-[rgba(45,45,45,0.08)] rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between border-b border-[rgba(45,45,45,0.06)] pb-3 gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#F1E4C5] text-[#B8862D] flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-[#1C1C1C] font-['Outfit']">
                  Outlet AI Purchase Assistant
                </h3>
                <span className="text-[10px] text-[#707070]">
                  Deterministic replenishment for {outlet?.name || 'this outlet'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="px-2.5 py-1 rounded-lg border border-[rgba(45,45,45,0.15)] hover:bg-[#FAF8F5] text-xs font-bold text-[#1C1C1C] flex items-center gap-1 transition-all"
              >
                <Plus className="w-3.5 h-3.5 text-[#B8862D]" />
                <span>Add Item</span>
              </button>
              <button
                type="button"
                onClick={handleRegenerateRecommendations}
                disabled={loadingSmart}
                className="p-1.5 rounded-lg border border-[rgba(45,45,45,0.15)] hover:bg-[#FAF8F5] text-[#707070] hover:text-[#1C1C1C] transition-all disabled:opacity-50"
                title="Regenerate AI recommendations from live stock"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingSmart ? 'animate-spin text-[#B8862D]' : ''}`} />
              </button>
            </div>
          </div>

          {/* Feedback messages */}
          {smartSuccessMsg && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="flex-1">{smartSuccessMsg}</span>
              <button onClick={() => setSmartSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {smartErrorMsg && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span className="flex-1">{smartErrorMsg}</span>
              <button onClick={() => setSmartErrorMsg(null)} className="text-red-700 hover:text-red-900">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* AI Recommended Replenishment Items List */}
          {loadingSmart && smartItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#707070] space-y-2">
              <RefreshCw className="w-5 h-5 mx-auto text-[#B8862D] animate-spin" />
              <p>Analyzing outlet stock ledger, consumption & reorder targets…</p>
            </div>
          ) : smartItems.length > 0 ? (
            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {smartItems.map((item) => {
                const isCritical = item.priority === 'CRITICAL';
                const isHigh = item.priority === 'HIGH';
                const hasSupplier = Boolean(item.supplier_name || item.supplier_id);

                return (
                  <div
                    key={item.item_id}
                    className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)] hover:border-[#C79A3B]/40 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[#B8862D] text-[10px] font-bold bg-white px-1.5 py-0.5 rounded border border-[rgba(45,45,45,0.08)]">
                          [{item.item_code || 'SKU'}]
                        </span>
                        <span className="font-bold text-[#1C1C1C] truncate">{item.item_name}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            isCritical
                              ? 'bg-red-100 text-red-700 border border-red-200'
                              : isHigh
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-blue-100 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {item.priority}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-[#707070]">
                        <span>
                          Stock: <strong className="text-[#1C1C1C]">{item.current_stock}</strong> / Min:{' '}
                          {item.min_stock} {item.unit_symbol}
                        </span>
                        <span>·</span>
                        {hasSupplier ? (
                          <span className="text-[#2E8B57] font-medium">
                            Vendor: {item.supplier_name || 'Mapped Vendor'}
                          </span>
                        ) : (
                          <span className="text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 text-[10px] font-semibold">
                            No vendor mapped
                          </span>
                        )}
                        {item.is_manually_added && (
                          <span className="text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200 text-[10px] font-semibold">
                            Manual Add
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <div className="flex items-center gap-1 bg-white border border-[rgba(45,45,45,0.15)] rounded-lg px-2 py-1">
                        <label className="text-[10px] text-[#707070] font-semibold">Order:</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.final_order_qty}
                          onChange={(e) => handleItemQtyChange(item.item_id, parseFloat(e.target.value) || 0)}
                          className="w-16 text-right text-xs font-bold text-[#1C1C1C] focus:outline-hidden font-mono"
                        />
                        <span className="text-[10px] text-[#707070] font-mono">{item.unit_symbol}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.item_id)}
                        className="p-1.5 rounded-lg text-[#707070] hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Remove from PO list"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-[#707070] space-y-1.5">
              <CheckCircle2 className="w-7 h-7 mx-auto text-[#2E8B57] mb-1" />
              <p className="text-xs sm:text-sm text-[#1C1C1C] font-bold">Outlet inventory levels optimal</p>
              <p className="text-[11px]">No items currently require replenishment. Use "+ Add Item" for special orders.</p>
            </div>
          )}

          {/* AI PO Confirmation Action Footer */}
          {smartItems.length > 0 && (
            <div className="border-t border-[rgba(45,45,45,0.06)] pt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs text-[#707070]">
                <span>{smartItems.filter((i) => Number(i.final_order_qty) > 0).length} items prepared</span>
                {savingSmart && <span className="text-[#B8862D] ml-2 text-[11px] animate-pulse">Saving…</span>}
              </div>

              <button
                type="button"
                onClick={handleOneClickCreatePO}
                disabled={confirmingSmart || smartItems.filter((i) => Number(i.final_order_qty) > 0).length === 0}
                className="px-4 py-2 bg-[#1C1C1C] hover:bg-[#2D2D2D] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <ShoppingCart className="w-4 h-4 text-[#C79A3B]" />
                <span>{confirmingSmart ? 'Creating PO…' : 'Create Purchase Order / Indent'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Right (5 cols): Live Operational Activity Feed */}
        <div className="lg:col-span-5 bg-white border border-[rgba(45,45,45,0.08)] rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between border-b border-[rgba(45,45,45,0.06)] pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#C79A3B]" />
              <h3 className="text-xs sm:text-sm font-bold text-[#1C1C1C] font-['Outfit']">Live Operational Feed</h3>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FAF8F5] text-[#707070] font-bold border border-[rgba(45,45,45,0.08)]">
              Realtime
            </span>
          </div>

          {dashboardData?.recentActivities && dashboardData.recentActivities.length > 0 ? (
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {dashboardData.recentActivities.map((act: OutletActivityItem) => (
                <div
                  key={act.id}
                  className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[#1C1C1C] truncate">{act.title}</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-white text-[#707070] font-bold border border-[rgba(45,45,45,0.08)]">
                        {act.type}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#707070] truncate mt-0.5">{act.description}</div>
                  </div>

                  <div className="text-right shrink-0">
                    {act.amount !== null && act.amount !== undefined && (
                      <div className="font-bold text-[#1C1C1C] font-mono">{formatCurrency(act.amount)}</div>
                    )}
                    <div className="text-[10px] text-[#707070]">{formatTime(act.timestamp)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-[#707070] space-y-1">
              <Clock className="w-7 h-7 mx-auto text-[#707070]/60 mb-1.5" />
              <p className="text-xs sm:text-sm text-[#1C1C1C] font-bold">No activity logged today</p>
              <p className="text-[11px]">Transactions will automatically appear here as operations run.</p>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. ADD ITEM MODAL FOR AI PURCHASE ASSISTANT                               */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white border border-[rgba(45,45,45,0.1)] rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[rgba(45,45,45,0.06)] pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#B8862D]" />
                <h4 className="text-sm font-bold text-[#1C1C1C] font-['Outfit']">Add Item to Purchase Order</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-[#707070] hover:text-[#1C1C1C]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#707070] font-semibold mb-1">Select Item from Catalog</label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[rgba(45,45,45,0.15)] bg-white text-[#1C1C1C] font-medium focus:outline-hidden"
                >
                  {catalogItems.map((c) => (
                    <option key={c.id} value={c.id}>
                      [{c.code}] {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#707070] font-semibold mb-1">Order Quantity</label>
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  value={addQty}
                  onChange={(e) => setAddQty(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full p-2.5 rounded-xl border border-[rgba(45,45,45,0.15)] bg-white text-[#1C1C1C] font-bold focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[rgba(45,45,45,0.06)]">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3.5 py-1.5 rounded-xl border border-[rgba(45,45,45,0.15)] hover:bg-[#FAF8F5] text-xs font-bold text-[#707070]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddItemToDraft}
                className="px-4 py-1.5 rounded-xl bg-[#1C1C1C] hover:bg-[#2D2D2D] text-white text-xs font-bold shadow-xs"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutletDashboard;
