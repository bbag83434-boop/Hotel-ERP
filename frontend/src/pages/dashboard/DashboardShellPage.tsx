import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  DollarSign,
  Hotel,
  UtensilsCrossed,
  Boxes,
  ShieldCheck,
  RefreshCw,
  Clock,
  ChevronRight
} from 'lucide-react';
import { dashboardApi } from '../../api/dashboard.api';
import { ExecutiveDashboardMetrics } from '../../types/dashboard.types';
import { formatINR, formatDateTimeIN, getIndianFinancialYear } from '../../utils/formatters';
import { useNavigate } from 'react-router-dom';

export const DashboardShellPage: React.FC = () => {
  const [metrics, setMetrics] = useState<ExecutiveDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const data = await dashboardApi.getMetrics();
      setMetrics(data);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to load executive metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 md:pb-8">
      {/* Top Banner */}
      <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-30 px-4 py-3 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-amber-600 to-indigo-600 rounded-xl shadow-lg shadow-amber-900/20 text-white font-bold">
              <LayoutDashboard className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Hotel Management Unified Dashboard
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30">
                  {getIndianFinancialYear()}
                </span>
              </h1>
              <p className="text-xs text-slate-400">Consolidated executive intelligence across Hotel PMS, Restaurant POS, Stores & GST Accounts</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadMetrics}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition flex items-center gap-1.5 text-xs font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 space-y-5">
        {errorMsg && (
          <div className="p-3 bg-rose-950/80 border border-rose-800/80 text-rose-200 rounded-lg text-sm">
            {errorMsg}
          </div>
        )}

        {metrics && (
          <>
            {/* Top Financial Hero Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Total Revenue */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-4 rounded-2xl border border-slate-800 shadow-xl space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>TOTAL CONSOLIDATED REVENUE</span>
                  <span className="p-1.5 bg-emerald-500/20 text-emerald-300 rounded-lg"><DollarSign className="w-4 h-4" /></span>
                </div>
                <div className="text-2xl font-black text-white tracking-tight font-mono">
                  {formatINR(metrics.revenue.total)}
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                  <span>Hotel: <strong className="text-emerald-400">{formatINR(metrics.revenue.hotelRevenue)}</strong></span>
                  <span>F&B: <strong className="text-sky-400">{formatINR(metrics.revenue.posRevenue)}</strong></span>
                </div>
              </div>

              {/* Gross Margin */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-4 rounded-2xl border border-slate-800 shadow-xl space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>GROSS PROFIT MARGIN</span>
                  <span className="p-1.5 bg-sky-500/20 text-sky-300 rounded-lg"><TrendingUp className="w-4 h-4" /></span>
                </div>
                <div className="text-2xl font-black text-sky-400 tracking-tight font-mono">
                  {formatINR(metrics.revenue.grossProfit)}
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                  <span>F&B Cost of Goods (BOM):</span>
                  <span className="font-semibold text-amber-400">{formatINR(metrics.revenue.posCostOfGoods)}</span>
                </div>
              </div>

              {/* Hotel Occupancy */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-4 rounded-2xl border border-slate-800 shadow-xl space-y-2 cursor-pointer hover:border-slate-700 transition" onClick={() => navigate('/hotel')}>
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>HOTEL OCCUPANCY RATE</span>
                  <span className="p-1.5 bg-indigo-500/20 text-indigo-300 rounded-lg"><Hotel className="w-4 h-4" /></span>
                </div>
                <div className="text-2xl font-black text-indigo-300 tracking-tight font-mono flex items-baseline gap-2">
                  {metrics.hospitality.occupancyRate}%
                  <span className="text-xs font-normal text-slate-400 font-sans">
                    ({metrics.hospitality.occupiedRooms}/{metrics.hospitality.totalRooms} rooms)
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                  <span>ADR: <strong className="text-slate-200">{formatINR(metrics.hospitality.adr)}</strong></span>
                  <span>RevPAR: <strong className="text-slate-200">{formatINR(metrics.hospitality.revpar)}</strong></span>
                </div>
              </div>

              {/* Governance & Approvals */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-4 rounded-2xl border border-slate-800 shadow-xl space-y-2 cursor-pointer hover:border-slate-700 transition" onClick={() => navigate('/approvals')}>
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>PENDING APPROVALS</span>
                  <span className="p-1.5 bg-amber-500/20 text-amber-300 rounded-lg"><ShieldCheck className="w-4 h-4" /></span>
                </div>
                <div className="text-2xl font-black text-amber-400 tracking-tight font-mono">
                  {metrics.operations.pendingApprovals} <span className="text-xs font-normal text-slate-400 font-sans">requests</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                  <span>Active Staff: <strong className="text-slate-200">{metrics.operations.activeStaff}</strong></span>
                  <span>Leaves: <strong className="text-slate-200">{metrics.operations.pendingLeaves}</strong></span>
                </div>
              </div>
            </div>

            {/* Operational Deep Dives */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Hotel Operations Card */}
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Hotel className="w-4 h-4 text-indigo-400" /> Hotel Front Desk & Rooms
                  </h3>
                  <button onClick={() => navigate('/hotel')} className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-0.5">
                    View PMS <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-slate-950 rounded-xl flex items-center justify-between">
                    <span className="text-slate-400">Total In-House Bookings:</span>
                    <span className="font-bold text-white">{metrics.hospitality.totalBookings}</span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl flex items-center justify-between">
                    <span className="text-slate-400">Rooms Needing Housekeeping:</span>
                    <span className="font-bold text-amber-400">{metrics.hospitality.dirtyRooms}</span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl flex items-center justify-between">
                    <span className="text-slate-400">Open Maintenance Issues:</span>
                    <span className="font-bold text-rose-400">{metrics.operations.openMaintenance}</span>
                  </div>
                </div>
              </div>

              {/* F&B & Restaurant Card */}
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4 text-rose-400" /> Restaurant & Dining POS
                  </h3>
                  <button onClick={() => navigate('/restaurant')} className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-0.5">
                    Open POS <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-slate-950 rounded-xl flex items-center justify-between">
                    <span className="text-slate-400">Total Dining Orders:</span>
                    <span className="font-bold text-white">{metrics.fnb.totalOrders}</span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl flex items-center justify-between">
                    <span className="text-slate-400">Completed Sales:</span>
                    <span className="font-bold text-white">{metrics.fnb.salesCount}</span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl flex items-center justify-between">
                    <span className="text-slate-400">Average Check (Per Cover):</span>
                    <span className="font-bold text-emerald-400 font-mono">{formatINR(metrics.fnb.averageCheck)}</span>
                  </div>
                </div>
              </div>

              {/* Supply Chain & Warehouse Card */}
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-amber-400" /> Stores & Procurement
                  </h3>
                  <button onClick={() => navigate('/inventory')} className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-0.5">
                    Stores <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-slate-950 rounded-xl flex items-center justify-between">
                    <span className="text-slate-400">Total Stores Stock Valuation:</span>
                    <span className="font-bold text-emerald-400 font-mono">{formatINR(metrics.inventory.totalValuation)}</span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl flex items-center justify-between">
                    <span className="text-slate-400">Low Stock Reorder Alerts:</span>
                    <span className={`font-bold ${metrics.inventory.lowStockItems > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                      {metrics.inventory.lowStockItems} items
                    </span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl flex items-center justify-between">
                    <span className="text-slate-400">Vendor Accounts Payable (AP):</span>
                    <span className="font-bold text-amber-400 font-mono">{formatINR(metrics.inventory.apOutstanding)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Enterprise Audit Trail */}
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" /> Real-time Audit Trail
                </h3>
                <span className="text-xs text-slate-500">Immutable governance log</span>
              </div>

              <div className="divide-y divide-slate-800/80 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                {metrics.activityFeed.map((evt) => (
                  <div key={evt.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-900/40 transition">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-brand-500" />
                      <div>
                        <span className="font-semibold text-slate-200">{evt.action}</span>
                        <span className="text-slate-500 ml-2">on {evt.entity}</span>
                      </div>
                    </div>
                    <div className="text-right text-slate-400 text-[11px]">
                      <span>{evt.user} ({evt.role})</span> • <span>{formatDateTimeIN(evt.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
