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
  ReportExportRequest,
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
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  ShoppingCart,
  Trash2,
  Clock,
  CheckCircle2,
  RefreshCw,
  Search,
  Filter,
} from 'lucide-react';

type ReportTab =
  | 'EXECUTIVE'
  | 'SALES'
  | 'INVENTORY'
  | 'FOOD_COST'
  | 'WASTAGE'
  | 'PROCUREMENT'
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
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  // Report States
  const [executiveData, setExecutiveData] = useState<ExecutiveDashboardResponse | null>(null);
  const [salesData, setSalesData] = useState<SalesSummaryResponse | null>(null);
  const [inventoryData, setInventoryData] = useState<InventoryValuationResponse | null>(null);
  const [foodCostData, setFoodCostData] = useState<FoodCostVarianceResponse | null>(null);
  const [wastageData, setWastageData] = useState<WastageSummaryReportResponse | null>(null);
  const [procurementData, setProcurementData] = useState<ProcurementSummaryResponse | null>(null);

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
      }
    } catch (err) {
      console.error('Failed to load report data:', err);
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
    setExportMessage(null);
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

      setExportMessage(`Successfully generated and downloaded ${resp.filename}`);
      setTimeout(() => setExportMessage(null), 4000);
    } catch (err) {
      console.error('Export error:', err);
      setExportMessage('Failed to generate export file. Please try again.');
    } finally {
      setExporting(false);
    }
  };

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
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF8F5] text-[#B8862D] font-bold border border-[rgba(45,45,45,0.1)]">
              [{activeOutlet.code}]
            </span>
          </div>
          <p className="text-xs text-[#707070] mt-0.5">
            Consolidated 14-outlet multi-dimensional analytics, theoretical vs actual food costs, stock valuation, and loss audits.
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
                    ? 'bg-white text-[#1C1C1C] shadow-sm'
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
              className="text-xs border border-[rgba(45,45,45,0.12)] rounded-xl px-3 py-1.5 bg-white text-[#1C1C1C] focus:outline-none focus:ring-1 focus:ring-[#C79A3B]"
            >
              <option value="">All 14 Outlets (Consolidated HQ)</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} [{o.code}]
                </option>
              ))}
            </select>
          )}

          <button
            onClick={fetchReports}
            className="p-2 text-[#707070] hover:text-[#1C1C1C] rounded-xl hover:bg-[#FAF8F5] transition-colors border border-[rgba(45,45,45,0.08)]"
            title="Refresh Report Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b border-[rgba(45,45,45,0.08)] pb-1">
        {[
          { id: 'EXECUTIVE', label: 'Executive Overview', icon: Layers },
          { id: 'SALES', label: 'Sales & Revenue', icon: TrendingUp },
          { id: 'INVENTORY', label: 'Inventory Valuation', icon: DollarSign },
          { id: 'FOOD_COST', label: 'Food Cost & Margins', icon: Percent },
          { id: 'WASTAGE', label: 'Wastage & Loss Audit', icon: Trash2 },
          { id: 'PROCUREMENT', label: 'Procurement & Spend', icon: ShoppingCart },
          { id: 'EXPORT', label: 'Export Center', icon: Download },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ReportTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-[#1C1C1C] text-white shadow-sm'
                  : 'text-[#707070] hover:bg-[#FAF8F5] hover:text-[#1C1C1C]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="p-12 text-center rounded-2xl bg-white border border-[rgba(45,45,45,0.08)]">
          <RefreshCw className="w-8 h-8 text-[#C79A3B] animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-[#1C1C1C]">Compiling Real-Time Multi-Outlet Data...</p>
          <p className="text-xs text-[#707070] mt-1">Aggregating sales, stock ledger movements, and variance matrix</p>
        </div>
      )}

      {/* TAB 1: EXECUTIVE DASHBOARD */}
      {!loading && activeTab === 'EXECUTIVE' && executiveData && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-1">
              <div className="flex items-center justify-between text-xs text-[#707070]">
                <span>Total Gross Sales</span>
                <TrendingUp className="w-4 h-4 text-[#2E8B57]" />
              </div>
              <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">
                ₹{executiveData.kpis.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-[#707070]">
                {executiveData.kpis.totalOrders} orders (AOV: ₹{executiveData.kpis.averageOrderValue.toFixed(2)})
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-1">
              <div className="flex items-center justify-between text-xs text-[#707070]">
                <span>Gross Profit Margin</span>
                <Percent className="w-4 h-4 text-[#C79A3B]" />
              </div>
              <p className="text-2xl font-bold text-[#2E8B57] font-['Outfit']">
                {executiveData.kpis.grossProfitMargin.toFixed(1)}%
              </p>
              <p className="text-[10px] text-[#707070]">
                Gross Profit: ₹{executiveData.kpis.grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-1">
              <div className="flex items-center justify-between text-xs text-[#707070]">
                <span>Consolidated COGS</span>
                <DollarSign className="w-4 h-4 text-[#3978B8]" />
              </div>
              <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">
                {executiveData.kpis.foodCostPercentage.toFixed(1)}%
              </p>
              <p className="text-[10px] text-[#707070]">
                Food Cost: ₹{executiveData.kpis.totalCogs.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-1">
              <div className="flex items-center justify-between text-xs text-[#707070]">
                <span>Wastage & Loss Rate</span>
                <AlertTriangle className="w-4 h-4 text-[#D9534F]" />
              </div>
              <p className="text-2xl font-bold text-[#D9534F] font-['Outfit']">
                {executiveData.kpis.wastagePercentage.toFixed(2)}%
              </p>
              <p className="text-[10px] text-[#707070]">
                Loss: ₹{executiveData.kpis.totalWastageLoss.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* 14-Outlet Performance Leaderboard */}
          <div className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#C79A3B]" />
                  14-Outlet Performance Matrix & Revenue Leaderboard
                </h3>
                <p className="text-xs text-[#707070]">
                  Comparative ranking by gross revenue, food cost percentage, and wastage loss
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[rgba(45,45,45,0.08)] text-[#707070] bg-[#FAF8F5]">
                    <th className="py-2.5 px-3 font-semibold">Rank</th>
                    <th className="py-2.5 px-3 font-semibold">Outlet Name</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Revenue (INR)</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Orders</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Food Cost %</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Wastage (INR)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Gross Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(45,45,45,0.06)] text-[#1C1C1C]">
                  {executiveData.outletRankings.map((r) => (
                    <tr key={r.branchId} className="hover:bg-[#FAF8F5] transition-colors">
                      <td className="py-3 px-3 font-mono font-bold">
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] ${
                          r.rank === 1 ? 'bg-[#C79A3B] text-white' : r.rank === 2 ? 'bg-[#999] text-white' : r.rank === 3 ? 'bg-[#B8862D] text-white' : 'bg-[#FAF8F5] text-[#707070]'
                        }`}>
                          {r.rank}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-medium">
                        <div>{r.branchName}</div>
                        <span className="text-[10px] font-mono text-[#707070]">[{r.branchCode}]</span>
                      </td>
                      <td className="py-3 px-3 text-right font-semibold">
                        ₹{r.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-center">{r.ordersCount}</td>
                      <td className="py-3 px-3 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          r.foodCostPercentage > 33 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          {r.foodCostPercentage.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-[#D9534F]">
                        ₹{r.wastageCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-[#2E8B57]">
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
          {/* Sales Summary Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-1">
              <span className="text-xs text-[#707070]">Gross Sales</span>
              <p className="text-xl font-bold text-[#1C1C1C]">₹{salesData.grossSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              <p className="text-[10px] text-[#707070]">Net Sales: ₹{salesData.netSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-1">
              <span className="text-xs text-[#707070]">Total Guest Covers</span>
              <p className="text-xl font-bold text-[#1C1C1C]">{salesData.totalGuests}</p>
              <p className="text-[10px] text-[#707070]">{salesData.totalOrders} total completed orders</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-1">
              <span className="text-xs text-[#707070]">Average Order Value (AOV)</span>
              <p className="text-xl font-bold text-[#2E8B57]">₹{salesData.averageOrderValue.toFixed(2)}</p>
              <p className="text-[10px] text-[#707070]">Per order average ticket</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-1">
              <span className="text-xs text-[#707070]">Taxes & Discounts</span>
              <p className="text-xl font-bold text-[#3978B8]">₹{salesData.totalTax.toFixed(2)}</p>
              <p className="text-[10px] text-[#707070]">Discounts Given: ₹{salesData.totalDiscount.toFixed(2)}</p>
            </div>
          </div>

          {/* Category Sales & Top Selling Dishes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Breakdown */}
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
                      <span>₹{c.grossSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({c.percentageOfTotal.toFixed(1)}%)</span>
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

            {/* Top 10 Best Sellers */}
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
                        <td className="py-2 text-center">{it.quantitySold}</td>
                        <td className="py-2 text-right">₹{it.unitPrice.toFixed(2)}</td>
                        <td className="py-2 text-right font-semibold">₹{it.totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
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
          {/* Inventory Valuation Header Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-1">
              <span className="text-xs text-[#707070]">Total Stock Valuation</span>
              <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">
                ₹{inventoryData.totalValuation.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-[#707070]">Calculated at current purchase cost</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-1">
              <span className="text-xs text-[#707070]">Total Monitored SKUs</span>
              <p className="text-2xl font-bold text-[#3978B8] font-['Outfit']">
                {inventoryData.totalItemsCount}
              </p>
              <p className="text-[10px] text-[#707070]">Across commissary & kitchen store locations</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-1">
              <span className="text-xs text-[#707070]">Critical Low Stock Alerts</span>
              <p className="text-2xl font-bold text-[#D9534F] font-['Outfit']">
                {inventoryData.lowStockItemsCount}
              </p>
              <p className="text-[10px] text-[#707070]">Items below minimum threshold</p>
            </div>
          </div>

          {/* Itemized Inventory Valuation Table */}
          <div className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit']">
                Warehouse Stock Valuation Ledger
              </h3>
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#707070]" />
                <input
                  type="text"
                  placeholder="Filter inventory..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#FAF8F5] border border-[rgba(45,45,45,0.1)] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#C79A3B]"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[rgba(45,45,45,0.08)] text-[#707070] bg-[#FAF8F5]">
                    <th className="py-2.5 px-3">Item Name</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Warehouse</th>
                    <th className="py-2.5 px-3 text-right">On-Hand Qty</th>
                    <th className="py-2.5 px-3 text-right">Cost Price</th>
                    <th className="py-2.5 px-3 text-right">Total Valuation</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
                  {inventoryData.items
                    .filter((it) => it.itemName.toLowerCase().includes(searchTerm.toLowerCase()) || it.itemCode.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map((it) => (
                      <tr key={it.itemId + it.warehouseName} className="hover:bg-[#FAF8F5]">
                        <td className="py-2.5 px-3 font-medium">
                          <div>{it.itemName}</div>
                          <span className="text-[10px] font-mono text-[#707070]">[{it.itemCode}]</span>
                        </td>
                        <td className="py-2.5 px-3 text-[#707070]">{it.categoryName}</td>
                        <td className="py-2.5 px-3 text-[#707070]">{it.warehouseName}</td>
                        <td className="py-2.5 px-3 text-right font-semibold">
                          {it.currentStock} {it.unitSymbol}
                        </td>
                        <td className="py-2.5 px-3 text-right">₹{it.costPrice.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-[#1C1C1C]">
                          ₹{it.totalValuation.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {it.isLowStock ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-red-50 text-red-600">
                              Low Stock
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-50 text-emerald-600">
                              Healthy
                            </span>
                          )}
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-1">
              <span className="text-xs text-[#707070]">Theoretical COGS</span>
              <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">
                ₹{foodCostData.consolidatedTheoreticalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-[#707070]">Recipe BOM standard usage</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-1">
              <span className="text-xs text-[#707070]">Actual Consumption</span>
              <p className="text-2xl font-bold text-[#3978B8] font-['Outfit']">
                ₹{foodCostData.consolidatedActualCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-[#707070]">Recorded physical stock usage</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-1">
              <span className="text-xs text-[#707070]">Variance Loss Amount</span>
              <p className="text-2xl font-bold text-[#D9534F] font-['Outfit']">
                ₹{foodCostData.consolidatedVariance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-[#707070]">Portion & spoilage variance</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-1">
              <span className="text-xs text-[#707070]">Overall Food Cost %</span>
              <p className="text-2xl font-bold text-[#2E8B57] font-['Outfit']">
                {foodCostData.consolidatedFoodCostPercentage.toFixed(1)}%
              </p>
              <p className="text-[10px] text-[#707070]">Benchmark target: 28.5%</p>
            </div>
          </div>

          {/* Outlet Variance Table */}
          <div className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit']">
              14-Outlet Food Cost Variance Audit
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[rgba(45,45,45,0.08)] text-[#707070] bg-[#FAF8F5]">
                    <th className="py-2.5 px-3">Outlet Name</th>
                    <th className="py-2.5 px-3 text-right">Total Sales</th>
                    <th className="py-2.5 px-3 text-right">Theoretical %</th>
                    <th className="py-2.5 px-3 text-right">Actual %</th>
                    <th className="py-2.5 px-3 text-right">Variance (INR)</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
                  {foodCostData.outlets.map((o) => (
                    <tr key={o.branchId} className="hover:bg-[#FAF8F5]">
                      <td className="py-3 px-3 font-medium">{o.branchName}</td>
                      <td className="py-3 px-3 text-right">₹{o.totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-3 text-right">{o.theoreticalPercentage.toFixed(1)}%</td>
                      <td className="py-3 px-3 text-right font-semibold">{o.actualPercentage.toFixed(1)}%</td>
                      <td className="py-3 px-3 text-right text-[#D9534F] font-semibold">
                        ₹{o.varianceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${
                          o.status === 'CRITICAL'
                            ? 'bg-red-50 text-red-600'
                            : o.status === 'ALERT'
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          {o.status}
                        </span>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-1">
              <span className="text-xs text-[#707070]">Total Wastage Loss</span>
              <p className="text-2xl font-bold text-[#D9534F] font-['Outfit']">
                ₹{wastageData.totalLossCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-[#707070]">{wastageData.totalEntriesCount} approved wastage incidents</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-1">
              <span className="text-xs text-[#707070]">Primary Cause of Loss</span>
              <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">
                {Object.keys(wastageData.byReason)[0] || 'NONE'}
              </p>
              <p className="text-[10px] text-[#707070]">Highest contributing reason code</p>
            </div>
          </div>

          {/* Top Wasted SKUs & Outlet Breakdown */}
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
                    <th className="py-2 text-right">Loss Cost (INR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
                  {wastageData.topWastedSkus.map((sku) => (
                    <tr key={sku.item_id}>
                      <td className="py-2 font-medium">{sku.item_name}</td>
                      <td className="py-2 text-center">{sku.quantity}</td>
                      <td className="py-2 text-right font-semibold text-[#D9534F]">
                        ₹{sku.loss_cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
                      <span className="text-[#D9534F]">₹{cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-1">
              <span className="text-xs text-[#707070]">Total Purchase Spend</span>
              <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">
                ₹{procurementData.totalPoSpend.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-[#707070]">{procurementData.totalPoCount} purchase orders issued</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-1">
              <span className="text-xs text-[#707070]">Fulfilled Deliveries</span>
              <p className="text-2xl font-bold text-[#2E8B57] font-['Outfit']">
                {procurementData.fulfilledPoCount}
              </p>
              <p className="text-[10px] text-[#707070]">GRN verified & received</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-1">
              <span className="text-xs text-[#707070]">Pending In-Transit POs</span>
              <p className="text-2xl font-bold text-[#B8862D] font-['Outfit']">
                {procurementData.pendingPoCount}
              </p>
              <p className="text-[10px] text-[#707070]">Awaiting supplier delivery</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-1">
              <span className="text-xs text-[#707070]">PO Fulfillment Rate</span>
              <p className="text-2xl font-bold text-[#3978B8] font-['Outfit']">
                {procurementData.fulfillmentRatePercentage.toFixed(1)}%
              </p>
              <p className="text-[10px] text-[#707070]">On-time supplier delivery rate</p>
            </div>
          </div>

          {/* Top Suppliers List */}
          <div className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit']">
              Top Suppliers by Procurement Volume
            </h3>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[rgba(45,45,45,0.08)] text-[#707070] bg-[#FAF8F5]">
                  <th className="py-2.5 px-3">Supplier Name</th>
                  <th className="py-2.5 px-3 text-center">Orders Count</th>
                  <th className="py-2.5 px-3 text-right">Total Spend (INR)</th>
                  <th className="py-2.5 px-3 text-right">% of Total Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
                {procurementData.topSuppliers.map((s) => (
                  <tr key={s.supplierId} className="hover:bg-[#FAF8F5]">
                    <td className="py-3 px-3 font-medium">{s.supplierName}</td>
                    <td className="py-3 px-3 text-center">{s.totalOrdersCount}</td>
                    <td className="py-3 px-3 text-right font-semibold">
                      ₹{s.totalSpend.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-right text-[#C79A3B] font-semibold">
                      {s.percentageOfTotalSpend.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: EXPORT CENTER */}
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

          {exportMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {exportMessage}
            </div>
          )}

          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-[rgba(45,45,45,0.08)] bg-[#FAF8F5] flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#1C1C1C]">Executive Summary & 14-Outlet Matrix</p>
                <p className="text-xs text-[#707070]">Consolidated group P&L snapshot, revenue rankings, and margin KPIs</p>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={exporting}
                  onClick={() => handleExport('EXECUTIVE_SUMMARY', 'CSV')}
                  className="px-3 py-1.5 rounded-lg bg-white border border-[rgba(45,45,45,0.12)] text-xs font-semibold hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> CSV
                </button>
                <button
                  disabled={exporting}
                  onClick={() => handleExport('EXECUTIVE_SUMMARY', 'JSON')}
                  className="px-3 py-1.5 rounded-lg bg-white border border-[rgba(45,45,45,0.12)] text-xs font-semibold hover:bg-gray-50 transition-colors"
                >
                  JSON
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[rgba(45,45,45,0.08)] bg-[#FAF8F5] flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#1C1C1C]">Sales & Daily Revenue Breakdown</p>
                <p className="text-xs text-[#707070]">Daily ticket covers, average order value, category splits, and tax summary</p>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={exporting}
                  onClick={() => handleExport('SALES_SUMMARY', 'CSV')}
                  className="px-3 py-1.5 rounded-lg bg-white border border-[rgba(45,45,45,0.12)] text-xs font-semibold hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> CSV
                </button>
                <button
                  disabled={exporting}
                  onClick={() => handleExport('SALES_SUMMARY', 'JSON')}
                  className="px-3 py-1.5 rounded-lg bg-white border border-[rgba(45,45,45,0.12)] text-xs font-semibold hover:bg-gray-50 transition-colors"
                >
                  JSON
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[rgba(45,45,45,0.08)] bg-[#FAF8F5] flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#1C1C1C]">Inventory Valuation & Asset Health</p>
                <p className="text-xs text-[#707070]">On-hand physical stock valuation, SKU cost basis, and reorder levels</p>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={exporting}
                  onClick={() => handleExport('INVENTORY_VALUATION', 'CSV')}
                  className="px-3 py-1.5 rounded-lg bg-white border border-[rgba(45,45,45,0.12)] text-xs font-semibold hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> CSV
                </button>
                <button
                  disabled={exporting}
                  onClick={() => handleExport('INVENTORY_VALUATION', 'JSON')}
                  className="px-3 py-1.5 rounded-lg bg-white border border-[rgba(45,45,45,0.12)] text-xs font-semibold hover:bg-gray-50 transition-colors"
                >
                  JSON
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsWorkspace;
