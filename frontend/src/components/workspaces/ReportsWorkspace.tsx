'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useOutlet } from '@/context/OutletContext';
import { reportsApi } from '@/api/reports';
import {
  ExecutiveDashboardResponse,
  SalesSummaryResponse,
  InventoryValuationResponse,
  FoodCostVarianceResponse,
  WastageSummaryReportResponse,
  ProcurementSummaryResponse,
  VendorReportResponse,
} from '@/types/reports.types';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  PieChart,
  Calendar,
  Building2,
  Download,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  Percent,
  ShoppingCart,
  Trash2,
  Clock,
  CheckCircle2,
  RefreshCw,
  Search,
  Filter,
} from 'lucide-react';
import { Badge, Button, StatCard, SearchInput, AlertBanner, EmptyState } from '@/components/ui';

type ReportTab =
  | 'EXECUTIVE'
  | 'SALES'
  | 'INVENTORY'
  | 'FOOD_COST'
  | 'WASTAGE'
  | 'PROCUREMENT'
  | 'VENDOR'
  | 'EXPORT';

export const ReportsWorkspace: React.FC = () => {
  const { activeOutlet, isHeadOffice, outlets } = useOutlet();
  const [activeTab, setActiveTab] = useState<ReportTab>('EXECUTIVE');
  const [datePreset, setDatePreset] = useState<'7D' | '30D' | '90D'>('30D');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Report States
  const [executiveData, setExecutiveData] = useState<ExecutiveDashboardResponse | null>(null);
  const [salesData, setSalesData] = useState<SalesSummaryResponse | null>(null);
  const [inventoryData, setInventoryData] = useState<InventoryValuationResponse | null>(null);
  const [foodCostData, setFoodCostData] = useState<FoodCostVarianceResponse | null>(null);
  const [wastageData, setWastageData] = useState<WastageSummaryReportResponse | null>(null);
  const [procurementData, setProcurementData] = useState<ProcurementSummaryResponse | null>(null);
  const [vendorData, setVendorData] = useState<VendorReportResponse | null>(null);

  const getDateRange = () => {
    const end = new Date();
    const start = new Date();
    if (datePreset === '7D') start.setDate(end.getDate() - 7);
    else if (datePreset === '30D') start.setDate(end.getDate() - 30);
    else if (datePreset === '90D') start.setDate(end.getDate() - 90);
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  };

  const fetchReports = async () => {
    setLoading(true);
    const { startDate, endDate } = getDateRange();
    const branchParam = selectedBranchId || (isHeadOffice ? undefined : activeOutlet.id);

    try {
      if (activeTab === 'EXECUTIVE') {
        const data = await reportsApi.getExecutiveSummary({ startDate, endDate });
        setExecutiveData(data);
      } else if (activeTab === 'SALES') {
        const data = await reportsApi.getSalesSummary({ branchId: branchParam, startDate, endDate });
        setSalesData(data);
      } else if (activeTab === 'INVENTORY') {
        const data = await reportsApi.getInventoryValuation({ branchId: branchParam });
        setInventoryData(data);
      } else if (activeTab === 'FOOD_COST') {
        const data = await reportsApi.getFoodCostVariance({ startDate, endDate });
        setFoodCostData(data);
      } else if (activeTab === 'WASTAGE') {
        const data = await reportsApi.getWastageSummary({ branchId: branchParam, startDate, endDate });
        setWastageData(data);
      } else if (activeTab === 'PROCUREMENT') {
        const data = await reportsApi.getProcurementSummary({ startDate, endDate });
        setProcurementData(data);
      } else if (activeTab === 'VENDOR') {
        const data = await reportsApi.getVendorReport({ branchId: branchParam, startDate, endDate });
        setVendorData(data);
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || err?.message || 'Failed to load report analytics',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    startTransition(() => {
      fetchReports();
    });
  }, [activeTab, datePreset, selectedBranchId, activeOutlet.id]);

  const handleExport = async (type: 'EXECUTIVE_SUMMARY' | 'SALES_SUMMARY' | 'INVENTORY_VALUATION', format: 'CSV' | 'JSON') => {
    setExporting(true);
    setFeedback(null);
    const { startDate, endDate } = getDateRange();
    const branchParam = selectedBranchId || (isHeadOffice ? undefined : activeOutlet.id);

    try {
      const resp = await reportsApi.exportReport({
        reportType: type,
        format,
        branchId: branchParam,
        startDate,
        endDate,
      });

      // Create download blob
      const blob = new Blob([resp.data], { type: resp.contentType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = resp.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setFeedback({
        type: 'success',
        message: `Successfully generated and downloaded ${resp.filename}`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || 'Failed to generate export file. Please try again.',
      });
    } finally {
      setExporting(false);
    }
  };

  const tabs = [
    { id: 'EXECUTIVE', label: 'Executive Overview', icon: Layers },
    { id: 'SALES', label: 'Sales & Revenue', icon: TrendingUp },
    { id: 'INVENTORY', label: 'Inventory Valuation', icon: DollarSign },
    { id: 'FOOD_COST', label: 'Food Cost & Margins', icon: Percent },
    { id: 'WASTAGE', label: 'Wastage & Loss Audit', icon: Trash2 },
    { id: 'PROCUREMENT', label: 'Procurement & Spend', icon: ShoppingCart },
    { id: 'VENDOR', label: 'Vendor Report', icon: Building2 },
    { id: 'EXPORT', label: 'Export Center', icon: Download },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#C79A3B]" />
              Enterprise Reporting & Business Intelligence
            </h2>
            <Badge variant="outlet">[{activeOutlet.code}]</Badge>
          </div>
          <p className="text-xs text-[#707070] mt-0.5">
            Consolidated multi-dimensional analytics, theoretical vs actual food costs, stock valuation, and loss audits.
          </p>
        </div>

        {/* Global Filter Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Selector */}
          <div className="flex items-center bg-[#FAF8F5] rounded-xl p-1 border border-[rgba(45,45,45,0.08)]">
            {(['7D', '30D', '90D'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setDatePreset(p)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  datePreset === p
                    ? 'bg-white text-[#1C1C1C] shadow-xs'
                    : 'text-[#707070] hover:text-[#1C1C1C]'
                }`}
              >
                {p === '7D' ? 'Last 7 Days' : p === '30D' ? 'Last 30 Days' : 'Quarter (90D)'}
              </button>
            ))}
          </div>

          {/* Outlet Selector (For HQ View) */}
          {isHeadOffice && (
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="text-xs border border-[rgba(45,45,45,0.12)] rounded-xl px-3 py-1.5 bg-white text-[#1C1C1C] focus:outline-none focus:border-[#C79A3B]"
            >
              <option value="">All Outlets (Consolidated HQ)</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} [{o.code}]
                </option>
              ))}
            </select>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={fetchReports}
            loading={loading}
            icon={<RefreshCw className="w-3.5 h-3.5 text-[#C79A3B]" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Feedback Banner */}
      <AlertBanner feedback={feedback} onClose={() => setFeedback(null)} />

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-white border border-[rgba(45,45,45,0.08)] rounded-2xl shadow-xs overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ReportTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-[#F1E4C5] text-[#B8862D] shadow-xs'
                  : 'text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="p-12 text-center rounded-2xl bg-white border border-[rgba(45,45,45,0.08)]">
          <RefreshCw className="w-8 h-8 text-[#C79A3B] animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-[#1C1C1C] font-['Outfit']">Compiling Real-Time Multi-Outlet Data...</p>
          <p className="text-xs text-[#707070] mt-1">Aggregating sales, stock ledger movements, and variance matrix</p>
        </div>
      )}

      {/* TAB 1: EXECUTIVE DASHBOARD */}
      {!loading && activeTab === 'EXECUTIVE' && executiveData && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <StatCard
              title="Total Gross Sales"
              value={`$${executiveData.kpis.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              subtitle={`${executiveData.kpis.totalOrders} orders (AOV: $${executiveData.kpis.averageOrderValue.toFixed(2)})`}
              icon={<TrendingUp className="w-4 h-4 text-[#2E8B57]" />}
              iconBgColor="bg-[#2E8B57]/10 text-[#2E8B57]"
            />

            <StatCard
              title="Gross Profit Margin"
              value={`${executiveData.kpis.grossProfitMargin.toFixed(1)}%`}
              subtitle={`Gross Profit: $${executiveData.kpis.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              icon={<Percent className="w-4 h-4 text-[#C79A3B]" />}
              iconBgColor="bg-[#FAF8F5] text-[#C79A3B]"
            />

            <StatCard
              title="Consolidated COGS"
              value={`${executiveData.kpis.foodCostPercentage.toFixed(1)}%`}
              subtitle={`Food Cost: $${executiveData.kpis.totalCogs.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              icon={<DollarSign className="w-4 h-4 text-[#3978B8]" />}
              iconBgColor="bg-blue-50 text-[#3978B8]"
            />

            <StatCard
              title="Wastage & Loss Rate"
              value={`${executiveData.kpis.wastagePercentage.toFixed(2)}%`}
              subtitle={`Loss: $${executiveData.kpis.totalWastageLoss.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              icon={<AlertTriangle className="w-4 h-4 text-[#D9534F]" />}
              iconBgColor="bg-red-50 text-[#D9534F]"
            />
          </div>

          {/* 14-Outlet Performance Leaderboard */}
          <div className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#C79A3B]" />
                14-Outlet Performance Matrix & Revenue Leaderboard
              </h3>
              <p className="text-xs text-[#707070]">
                Comparative ranking by gross revenue, food cost percentage, and wastage loss
              </p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[rgba(45,45,45,0.08)]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[rgba(45,45,45,0.08)] text-[#707070] bg-[#FAF8F5]">
                    <th className="p-3 font-semibold">Rank</th>
                    <th className="p-3 font-semibold">Outlet Name</th>
                    <th className="p-3 font-semibold text-right">Revenue ($)</th>
                    <th className="p-3 font-semibold text-center">Orders</th>
                    <th className="p-3 font-semibold text-right">Food Cost %</th>
                    <th className="p-3 font-semibold text-right">Wastage ($)</th>
                    <th className="p-3 font-semibold text-right">Gross Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(45,45,45,0.06)] text-[#1C1C1C]">
                  {executiveData.outletRankings.map((r) => (
                    <tr key={r.branchId} className="hover:bg-[#FAF8F5] transition-colors">
                      <td className="p-3 font-mono font-bold">
                        <span
                          className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] ${
                            r.rank === 1
                              ? 'bg-[#C79A3B] text-white'
                              : r.rank === 2
                              ? 'bg-gray-400 text-white'
                              : r.rank === 3
                              ? 'bg-[#B8862D] text-white'
                              : 'bg-[#FAF8F5] text-[#707070]'
                          }`}
                        >
                          {r.rank}
                        </span>
                      </td>
                      <td className="p-3 font-medium">
                        <div className="font-bold">{r.branchName}</div>
                        <Badge variant="outlet">[{r.branchCode}]</Badge>
                      </td>
                      <td className="p-3 text-right font-mono font-semibold">
                        ${r.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-center font-mono">{r.ordersCount}</td>
                      <td className="p-3 text-right">
                        <Badge variant={r.foodCostPercentage > 33 ? 'danger' : 'success'}>
                          {r.foodCostPercentage.toFixed(1)}%
                        </Badge>
                      </td>
                      <td className="p-3 text-right text-[#D9534F] font-mono font-semibold">
                        ${r.wastageCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-semibold text-[#2E8B57] font-mono">
                        {r.grossMarginPercentage.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SALES & REVENUE REPORT */}
      {!loading && activeTab === 'SALES' && salesData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
            <StatCard
              title="Gross Sales"
              value={`$${salesData.grossSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              subtitle={`Net Sales: $${salesData.netSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              icon={<TrendingUp className="w-4 h-4 text-[#2E8B57]" />}
              iconBgColor="bg-[#2E8B57]/10 text-[#2E8B57]"
            />

            <StatCard
              title="Guest Covers"
              value={salesData.totalGuests}
              subtitle={`${salesData.totalOrders} total completed orders`}
              icon={<Layers className="w-4 h-4 text-[#C79A3B]" />}
              iconBgColor="bg-[#FAF8F5] text-[#C79A3B]"
            />

            <StatCard
              title="Avg Order Value"
              value={`$${salesData.averageOrderValue.toFixed(2)}`}
              subtitle="Per order ticket average"
              icon={<DollarSign className="w-4 h-4 text-[#3978B8]" />}
              iconBgColor="bg-blue-50 text-[#3978B8]"
            />

            <StatCard
              title="Taxes & Discounts"
              value={`$${salesData.totalTax.toFixed(2)}`}
              subtitle={`Discounts: $${salesData.totalDiscount.toFixed(2)}`}
              icon={<Percent className="w-4 h-4 text-[#B8862D]" />}
              iconBgColor="bg-[#F1E4C5]/40 text-[#B8862D]"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
                <PieChart className="w-4 h-4 text-[#C79A3B]" />
                Sales Contribution by Menu Category
              </h3>
              <div className="space-y-3">
                {salesData.byCategory.map((c) => (
                  <div key={c.categoryName} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-[#1C1C1C]">
                      <span>{c.categoryName} ({c.itemCountSold} sold)</span>
                      <span>${c.grossSales.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({c.percentageOfTotal.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-[#FAF8F5] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#C79A3B] h-full rounded-full transition-all"
                        style={{ width: `${Math.min(c.percentageOfTotal, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#2E8B57]" />
                Top Selling Menu Items
              </h3>
              <div className="overflow-y-auto max-h-[300px]">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[rgba(45,45,45,0.08)] text-[#707070]">
                      <th className="py-2">Item</th>
                      <th className="py-2 text-center">Qty</th>
                      <th className="py-2 text-right">Price</th>
                      <th className="py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
                    {salesData.topSellingItems.map((it) => (
                      <tr key={it.itemId}>
                        <td className="py-2 font-medium">{it.itemName}</td>
                        <td className="py-2 text-center font-mono">{it.quantitySold}</td>
                        <td className="py-2 text-right font-mono">${it.unitPrice.toFixed(2)}</td>
                        <td className="py-2 text-right font-semibold font-mono">${it.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: INVENTORY VALUATION */}
      {!loading && activeTab === 'INVENTORY' && inventoryData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
            <StatCard
              title="Total Stock Valuation"
              value={`$${inventoryData.totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              subtitle="Calculated at purchase cost"
              icon={<DollarSign className="w-4 h-4 text-[#1C1C1C]" />}
              iconBgColor="bg-[#FAF8F5] text-[#1C1C1C]"
            />

            <StatCard
              title="Monitored SKUs"
              value={inventoryData.totalItemsCount}
              subtitle="Across commissary & kitchens"
              icon={<Layers className="w-4 h-4 text-[#3978B8]" />}
              iconBgColor="bg-blue-50 text-[#3978B8]"
            />

            <StatCard
              title="Low Stock Alerts"
              value={inventoryData.lowStockItemsCount}
              subtitle="Below minimum threshold"
              icon={<AlertTriangle className="w-4 h-4 text-[#D9534F]" />}
              iconBgColor="bg-red-50 text-[#D9534F]"
            />
          </div>

          <div className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit']">
                Warehouse Stock Valuation Ledger
              </h3>
              <SearchInput
                value={searchTerm}
                onChangeValue={setSearchTerm}
                placeholder="Filter inventory..."
                className="w-full sm:w-72"
              />
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[rgba(45,45,45,0.08)]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[rgba(45,45,45,0.08)] text-[#707070] bg-[#FAF8F5]">
                    <th className="p-3">Item Name</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Warehouse</th>
                    <th className="p-3 text-right">On-Hand Qty</th>
                    <th className="p-3 text-right">Cost Price</th>
                    <th className="p-3 text-right">Total Valuation</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
                  {inventoryData.items
                    .filter((it) => it.itemName.toLowerCase().includes(searchTerm.toLowerCase()) || it.itemCode.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map((it) => (
                      <tr key={it.itemId + it.warehouseName} className="hover:bg-[#FAF8F5]">
                        <td className="p-3 font-medium">
                          <div>{it.itemName}</div>
                          <Badge variant="outlet">[{it.itemCode}]</Badge>
                        </td>
                        <td className="p-3 text-[#707070]">{it.categoryName}</td>
                        <td className="p-3 text-[#707070]">{it.warehouseName}</td>
                        <td className="p-3 text-right font-mono font-semibold">
                          {it.currentStock} {it.unitSymbol}
                        </td>
                        <td className="p-3 text-right font-mono">${it.costPrice.toFixed(2)}</td>
                        <td className="p-3 text-right font-mono font-semibold text-[#1C1C1C]">
                          ${it.totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant={it.isLowStock ? 'danger' : 'success'}>
                            {it.isLowStock ? 'Low Stock' : 'Healthy'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: FOOD COST & MARGIN VARIANCE */}
      {!loading && activeTab === 'FOOD_COST' && foodCostData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
            <StatCard
              title="Theoretical COGS"
              value={`$${foodCostData.consolidatedTheoreticalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              subtitle="Recipe BOM standard usage"
              icon={<Percent className="w-4 h-4 text-[#1C1C1C]" />}
              iconBgColor="bg-[#FAF8F5] text-[#1C1C1C]"
            />

            <StatCard
              title="Actual Consumption"
              value={`$${foodCostData.consolidatedActualCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              subtitle="Physical stock ledger usage"
              icon={<DollarSign className="w-4 h-4 text-[#3978B8]" />}
              iconBgColor="bg-blue-50 text-[#3978B8]"
            />

            <StatCard
              title="Variance Loss"
              value={`$${foodCostData.consolidatedVariance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              subtitle="Portion & spoilage variance"
              icon={<AlertTriangle className="w-4 h-4 text-[#D9534F]" />}
              iconBgColor="bg-red-50 text-[#D9534F]"
            />

            <StatCard
              title="Overall Food Cost %"
              value={`${foodCostData.consolidatedFoodCostPercentage.toFixed(1)}%`}
              subtitle="Target benchmark: 28.5%"
              icon={<CheckCircle2 className="w-4 h-4 text-[#2E8B57]" />}
              iconBgColor="bg-[#2E8B57]/10 text-[#2E8B57]"
            />
          </div>

          {/* Outlet Variance Table */}
          <div className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit']">
              14-Outlet Food Cost Variance Audit
            </h3>
            <div className="overflow-x-auto rounded-2xl border border-[rgba(45,45,45,0.08)]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[rgba(45,45,45,0.08)] text-[#707070] bg-[#FAF8F5]">
                    <th className="p-3">Outlet Name</th>
                    <th className="p-3 text-right">Total Sales</th>
                    <th className="p-3 text-right">Theoretical %</th>
                    <th className="p-3 text-right">Actual %</th>
                    <th className="p-3 text-right">Variance ($)</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
                  {foodCostData.outlets.map((o) => (
                    <tr key={o.branchId} className="hover:bg-[#FAF8F5]">
                      <td className="p-3 font-medium">{o.branchName}</td>
                      <td className="p-3 text-right font-mono">${o.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right font-mono">{o.theoreticalPercentage.toFixed(1)}%</td>
                      <td className="p-3 text-right font-mono font-semibold">{o.actualPercentage.toFixed(1)}%</td>
                      <td className="p-3 text-right text-[#D9534F] font-mono font-semibold">
                        ${o.varianceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-center">
                        <Badge
                          variant={
                            o.status === 'CRITICAL'
                              ? 'danger'
                              : o.status === 'ALERT'
                              ? 'warning'
                              : 'success'
                          }
                        >
                          {o.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: WASTAGE & LOSS AUDIT */}
      {!loading && activeTab === 'WASTAGE' && wastageData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
            <StatCard
              title="Total Wastage Loss"
              value={`$${wastageData.totalLossCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              subtitle={`${wastageData.totalEntriesCount} approved loss incidents`}
              icon={<Trash2 className="w-4 h-4 text-[#D9534F]" />}
              iconBgColor="bg-red-50 text-[#D9534F]"
            />

            <StatCard
              title="Primary Cause of Loss"
              value={Object.keys(wastageData.byReason)[0] || 'NONE'}
              subtitle="Highest contributing reason code"
              icon={<AlertTriangle className="w-4 h-4 text-[#D99625]" />}
              iconBgColor="bg-amber-50 text-[#D99625]"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit']">
                Highest Loss Ingredients & Products
              </h3>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[rgba(45,45,45,0.08)] text-[#707070]">
                    <th className="py-2">Item</th>
                    <th className="py-2 text-center">Wasted Qty</th>
                    <th className="py-2 text-right">Loss Cost ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
                  {wastageData.topWastedSkus.map((sku) => (
                    <tr key={sku.item_id}>
                      <td className="py-2 font-medium">{sku.item_name}</td>
                      <td className="py-2 text-center font-mono">{sku.quantity}</td>
                      <td className="py-2 text-right font-semibold text-[#D9534F] font-mono">
                        ${sku.loss_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit']">
                Wastage Reason Breakdown
              </h3>
              <div className="space-y-3">
                {Object.entries(wastageData.byReason).map(([reason, cost]) => (
                  <div key={reason} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span>{reason.replace('_', ' ')}</span>
                      <span className="text-[#D9534F] font-mono">${cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="w-full bg-[#FAF8F5] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#D9534F] h-full rounded-full"
                        style={{ width: `${Math.min((cost / (wastageData.totalLossCost || 1)) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: PROCUREMENT & SUPPLIER SUMMARY */}
      {!loading && activeTab === 'PROCUREMENT' && procurementData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
            <StatCard
              title="Total Purchase Spend"
              value={`$${procurementData.totalPoSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              subtitle={`${procurementData.totalPoCount} purchase orders issued`}
              icon={<ShoppingCart className="w-4 h-4 text-[#1C1C1C]" />}
              iconBgColor="bg-[#FAF8F5] text-[#1C1C1C]"
            />

            <StatCard
              title="Fulfilled Deliveries"
              value={procurementData.fulfilledPoCount}
              subtitle="GRN verified & received"
              icon={<CheckCircle2 className="w-4 h-4 text-[#2E8B57]" />}
              iconBgColor="bg-[#2E8B57]/10 text-[#2E8B57]"
            />

            <StatCard
              title="Pending In-Transit"
              value={procurementData.pendingPoCount}
              subtitle="Awaiting supplier dispatch"
              icon={<Clock className="w-4 h-4 text-[#B8862D]" />}
              iconBgColor="bg-[#F1E4C5]/40 text-[#B8862D]"
            />

            <StatCard
              title="PO Fulfillment Rate"
              value={`${procurementData.fulfillmentRatePercentage.toFixed(1)}%`}
              subtitle="On-time supplier delivery"
              icon={<Percent className="w-4 h-4 text-[#3978B8]" />}
              iconBgColor="bg-blue-50 text-[#3978B8]"
            />
          </div>

          <div className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit']">
              Top Suppliers by Procurement Volume
            </h3>
            <div className="overflow-x-auto rounded-2xl border border-[rgba(45,45,45,0.08)]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[rgba(45,45,45,0.08)] text-[#707070] bg-[#FAF8F5]">
                    <th className="p-3">Supplier Name</th>
                    <th className="p-3 text-center">Orders Count</th>
                    <th className="p-3 text-right">Total Spend ($)</th>
                    <th className="p-3 text-right">% of Total Spend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
                  {procurementData.topSuppliers.map((s) => (
                    <tr key={s.supplierId} className="hover:bg-[#FAF8F5]">
                      <td className="p-3 font-medium">{s.supplierName}</td>
                      <td className="p-3 text-center font-mono">{s.totalOrdersCount}</td>
                      <td className="p-3 text-right font-semibold font-mono">
                        ${s.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right text-[#C79A3B] font-semibold font-mono">
                        {s.percentageOfTotalSpend.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: VENDOR REPORT */}
      {!loading && activeTab === 'VENDOR' && vendorData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 sm:gap-4">
            <StatCard title="Vendors" value={vendorData.totalVendors} subtitle="Active suppliers in period" icon={<Building2 className="w-4 h-4 text-[#C79A3B]" />} iconBgColor="bg-[#FAF8F5] text-[#C79A3B]" />
            <StatCard title="PO Spend" value={`$${vendorData.totalPoSpend.toLocaleString(undefined,{minimumFractionDigits:2})}`} subtitle="Purchase order value" icon={<ShoppingCart className="w-4 h-4" />} iconBgColor="bg-[#FAF8F5]" />
            <StatCard title="Billed" value={`$${vendorData.totalBilledAmount.toLocaleString(undefined,{minimumFractionDigits:2})}`} subtitle="Vendor invoices" icon={<FileSpreadsheet className="w-4 h-4" />} iconBgColor="bg-[#FAF8F5]" />
            <StatCard title="Paid" value={`$${vendorData.totalPaidAmount.toLocaleString(undefined,{minimumFractionDigits:2})}`} subtitle="Recorded payments" icon={<CheckCircle2 className="w-4 h-4" />} iconBgColor="bg-[#2E8B57]/10 text-[#2E8B57]" />
            <StatCard title="Outstanding" value={`$${vendorData.totalOutstandingAmount.toLocaleString(undefined,{minimumFractionDigits:2})}`} subtitle="Billed less payments" icon={<Clock className="w-4 h-4" />} iconBgColor="bg-[#F1E4C5]/40 text-[#B8862D]" />
          </div>

          <div className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit']">Vendor Spend, Billing & Payment Report</h3>
              <p className="text-xs text-[#707070] mt-1">Compare purchase volume, invoicing, payments, outstanding balances and PO fulfillment by supplier.</p>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-[rgba(45,45,45,0.08)]">
              <table className="w-full text-left text-xs">
                <thead><tr className="border-b border-[rgba(45,45,45,0.08)] text-[#707070] bg-[#FAF8F5]">
                  <th className="p-3">Vendor</th><th className="p-3 text-center">POs</th><th className="p-3 text-right">PO Spend</th><th className="p-3 text-right">Billed</th><th className="p-3 text-right">Paid</th><th className="p-3 text-right">Outstanding</th><th className="p-3 text-right">Fulfillment</th>
                </tr></thead>
                <tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
                  {vendorData.vendors.map((v) => <tr key={v.supplierId} className="hover:bg-[#FAF8F5]">
                    <td className="p-3 font-semibold">{v.supplierName}<div className="text-[10px] text-[#707070]">{v.billCount} bills</div></td>
                    <td className="p-3 text-center font-mono">{v.poCount}</td>
                    <td className="p-3 text-right font-mono">${v.poSpend.toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                    <td className="p-3 text-right font-mono">${v.billedAmount.toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                    <td className="p-3 text-right font-mono text-[#2E8B57]">${v.paidAmount.toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                    <td className="p-3 text-right font-mono font-semibold text-[#D9534F]">${v.outstandingAmount.toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                    <td className="p-3 text-right"><Badge variant={v.fulfillmentRatePercentage >= 90 ? 'success' : v.fulfillmentRatePercentage >= 70 ? 'outlet' : 'danger'}>{v.fulfillmentRatePercentage.toFixed(1)}%</Badge></td>
                  </tr>)}
                  {!vendorData.vendors.length && <tr><td colSpan={7} className="p-8 text-center text-[#707070]">No vendor activity found for this period.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: EXPORT CENTER */}
      {activeTab === 'EXPORT' && (
        <div className="p-6 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-6 max-w-2xl mx-auto">
          <div>
            <h3 className="text-base font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
              <Download className="w-5 h-5 text-[#C79A3B]" />
              Data Export & Compliance Reports Center
            </h3>
            <p className="text-xs text-[#707070] mt-1">
              Export high-resolution audit reports in structured CSV spreadsheet or raw JSON formats.
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-[rgba(45,45,45,0.08)] bg-[#FAF8F5] flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#1C1C1C] font-['Outfit']">Executive Summary & 14-Outlet Matrix</p>
                <p className="text-xs text-[#707070]">Consolidated group P&L snapshot, revenue rankings, and margin KPIs</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={exporting}
                  onClick={() => handleExport('EXECUTIVE_SUMMARY', 'CSV')}
                  icon={<FileSpreadsheet className="w-3.5 h-3.5 text-[#2E8B57]" />}
                >
                  CSV
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={exporting}
                  onClick={() => handleExport('EXECUTIVE_SUMMARY', 'JSON')}
                >
                  JSON
                </Button>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[rgba(45,45,45,0.08)] bg-[#FAF8F5] flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#1C1C1C] font-['Outfit']">Sales & Daily Revenue Breakdown</p>
                <p className="text-xs text-[#707070]">Daily ticket covers, average order value, category splits, and tax summary</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={exporting}
                  onClick={() => handleExport('SALES_SUMMARY', 'CSV')}
                  icon={<FileSpreadsheet className="w-3.5 h-3.5 text-[#2E8B57]" />}
                >
                  CSV
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={exporting}
                  onClick={() => handleExport('SALES_SUMMARY', 'JSON')}
                >
                  JSON
                </Button>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[rgba(45,45,45,0.08)] bg-[#FAF8F5] flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#1C1C1C] font-['Outfit']">Inventory Valuation & Asset Health</p>
                <p className="text-xs text-[#707070]">On-hand physical stock valuation, SKU cost basis, and reorder levels</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={exporting}
                  onClick={() => handleExport('INVENTORY_VALUATION', 'CSV')}
                  icon={<FileSpreadsheet className="w-3.5 h-3.5 text-[#2E8B57]" />}
                >
                  CSV
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={exporting}
                  onClick={() => handleExport('INVENTORY_VALUATION', 'JSON')}
                >
                  JSON
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsWorkspace;
