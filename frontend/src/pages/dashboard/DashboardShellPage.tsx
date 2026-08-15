import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  Building,
  UtensilsCrossed,
  Boxes,
  ShieldCheck,
  RefreshCw,
  Clock,
  ChevronRight,
  Crown
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
    <div className="space-y-6 select-none">
      {/* Top Header Card */}
      <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#d4a437] to-[#996f1b] flex items-center justify-center text-black shadow-lg shadow-[#d4a437]/20 border border-[#d4a437]/40">
            <Crown className="w-6 h-6 text-black" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-wide uppercase">
                Grand Heritage Command Center
              </h1>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#d4a437]/15 text-[#d4a437] font-semibold border border-[#d4a437]/30 tracking-wider">
                FY {getIndianFinancialYear()}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Unified Executive Intelligence across Multi-Outlet POS, Central Kitchen, Stores & Finance
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={loadMetrics}
            disabled={loading}
            className="px-3.5 py-2 bg-[#202026] hover:bg-[#282832] text-neutral-200 border border-white/[0.08] hover:border-white/[0.15] rounded-xl transition-all flex items-center space-x-2 text-xs font-semibold shadow-sm active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#d4a437] ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Metrics</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-[#e5544d]/10 border border-[#e5544d]/25 text-[#e5544d] rounded-2xl text-xs font-medium">
          {errorMsg}
        </div>
      )}

      {metrics && (
        <>
          {/* Top Financial Hero Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Revenue */}
            <div className="bg-[#17171b] p-5 rounded-3xl border border-white/[0.08] shadow-xl space-y-2.5 hover:border-white/[0.14] transition-all">
              <div className="flex items-center justify-between text-xs text-neutral-400 font-semibold tracking-wider uppercase">
                <span>Total Gross Revenue</span>
                <span className="p-1.5 bg-[#3fbf6f]/15 text-[#3fbf6f] rounded-xl border border-[#3fbf6f]/25">
                  <DollarSign className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-mono">
                {formatINR(metrics.revenue.total)}
              </div>
              <div className="flex justify-between text-[11px] text-neutral-400 pt-2 border-t border-white/[0.06]">
                <span>Hotel: <strong className="text-[#3fbf6f]">{formatINR(metrics.revenue.hotelRevenue)}</strong></span>
                <span>F&B: <strong className="text-[#d4a437]">{formatINR(metrics.revenue.posRevenue)}</strong></span>
              </div>
            </div>

            {/* Gross Margin */}
            <div className="bg-[#17171b] p-5 rounded-3xl border border-white/[0.08] shadow-xl space-y-2.5 hover:border-white/[0.14] transition-all">
              <div className="flex items-center justify-between text-xs text-neutral-400 font-semibold tracking-wider uppercase">
                <span>Gross Profit Margin</span>
                <span className="p-1.5 bg-[#4d9de5]/15 text-[#4d9de5] rounded-xl border border-[#4d9de5]/25">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#d4a437] tracking-tight font-mono">
                {formatINR(metrics.revenue.grossProfit)}
              </div>
              <div className="flex justify-between text-[11px] text-neutral-400 pt-2 border-t border-white/[0.06]">
                <span>F&B Raw Cost (BOM):</span>
                <span className="font-semibold text-neutral-200">{formatINR(metrics.revenue.posCostOfGoods)}</span>
              </div>
            </div>

            {/* Hotel Occupancy */}
            <div
              className="bg-[#17171b] p-5 rounded-3xl border border-white/[0.08] shadow-xl space-y-2.5 cursor-pointer hover:border-[#d4a437]/40 transition-all"
              onClick={() => navigate('/hotel')}
            >
              <div className="flex items-center justify-between text-xs text-neutral-400 font-semibold tracking-wider uppercase">
                <span>Hotel Occupancy</span>
                <span className="p-1.5 bg-[#d4a437]/15 text-[#d4a437] rounded-xl border border-[#d4a437]/25">
                  <Building className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-neutral-100 tracking-tight font-mono flex items-baseline gap-2">
                {metrics.hospitality.occupancyRate}%
                <span className="text-xs font-medium text-neutral-400 font-sans">
                  ({metrics.hospitality.occupiedRooms}/{metrics.hospitality.totalRooms} rooms)
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-neutral-400 pt-2 border-t border-white/[0.06]">
                <span>ADR: <strong className="text-neutral-200">{formatINR(metrics.hospitality.adr)}</strong></span>
                <span>RevPAR: <strong className="text-neutral-200">{formatINR(metrics.hospitality.revpar)}</strong></span>
              </div>
            </div>

            {/* Governance & Approvals */}
            <div
              className="bg-[#17171b] p-5 rounded-3xl border border-white/[0.08] shadow-xl space-y-2.5 cursor-pointer hover:border-[#d4a437]/40 transition-all"
              onClick={() => navigate('/approvals')}
            >
              <div className="flex items-center justify-between text-xs text-neutral-400 font-semibold tracking-wider uppercase">
                <span>Pending Approvals</span>
                <span className="p-1.5 bg-[#e5a33d]/15 text-[#e5a33d] rounded-xl border border-[#e5a33d]/25">
                  <ShieldCheck className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#e5a33d] tracking-tight font-mono">
                {metrics.operations.pendingApprovals} <span className="text-xs font-normal text-neutral-400 font-sans">actions</span>
              </div>
              <div className="flex justify-between text-[11px] text-neutral-400 pt-2 border-t border-white/[0.06]">
                <span>Active Staff: <strong className="text-neutral-200">{metrics.operations.activeStaff}</strong></span>
                <span>Leave Requests: <strong className="text-neutral-200">{metrics.operations.pendingLeaves}</strong></span>
              </div>
            </div>
          </div>

          {/* Operational Deep Dives */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Hotel Operations Card */}
            <div className="bg-[#17171b] p-5 rounded-3xl border border-white/[0.08] shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Building className="w-4 h-4 text-[#d4a437]" /> Front Desk & Rooms
                </h3>
                <button
                  onClick={() => navigate('/hotel')}
                  className="text-xs text-[#d4a437] hover:text-[#e5ba55] font-semibold flex items-center gap-0.5 transition-colors"
                >
                  PMS View <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-3 bg-[#0c0c0e] border border-white/[0.05] rounded-2xl flex items-center justify-between">
                  <span className="text-neutral-400">Total In-House Bookings:</span>
                  <span className="font-bold text-white">{metrics.hospitality.totalBookings}</span>
                </div>
                <div className="p-3 bg-[#0c0c0e] border border-white/[0.05] rounded-2xl flex items-center justify-between">
                  <span className="text-neutral-400">Rooms Pending Housekeeping:</span>
                  <span className="font-bold text-[#e5a33d]">{metrics.hospitality.dirtyRooms}</span>
                </div>
                <div className="p-3 bg-[#0c0c0e] border border-white/[0.05] rounded-2xl flex items-center justify-between">
                  <span className="text-neutral-400">Maintenance Issues:</span>
                  <span className="font-bold text-[#e5544d]">{metrics.operations.openMaintenance}</span>
                </div>
              </div>
            </div>

            {/* F&B & Restaurant Card */}
            <div className="bg-[#17171b] p-5 rounded-3xl border border-white/[0.08] shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <UtensilsCrossed className="w-4 h-4 text-[#d4a437]" /> Dining & POS Operations
                </h3>
                <button
                  onClick={() => navigate('/restaurant')}
                  className="text-xs text-[#d4a437] hover:text-[#e5ba55] font-semibold flex items-center gap-0.5 transition-colors"
                >
                  POS View <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-3 bg-[#0c0c0e] border border-white/[0.05] rounded-2xl flex items-center justify-between">
                  <span className="text-neutral-400">Total Orders Processed:</span>
                  <span className="font-bold text-white">{metrics.fnb.totalOrders}</span>
                </div>
                <div className="p-3 bg-[#0c0c0e] border border-white/[0.05] rounded-2xl flex items-center justify-between">
                  <span className="text-neutral-400">Settled Transactions:</span>
                  <span className="font-bold text-white">{metrics.fnb.salesCount}</span>
                </div>
                <div className="p-3 bg-[#0c0c0e] border border-white/[0.05] rounded-2xl flex items-center justify-between">
                  <span className="text-neutral-400">Average Cover Check:</span>
                  <span className="font-bold text-[#3fbf6f] font-mono">{formatINR(metrics.fnb.averageCheck)}</span>
                </div>
              </div>
            </div>

            {/* Supply Chain & Warehouse Card */}
            <div className="bg-[#17171b] p-5 rounded-3xl border border-white/[0.08] shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-[#d4a437]" /> Warehouses & Stores
                </h3>
                <button
                  onClick={() => navigate('/inventory')}
                  className="text-xs text-[#d4a437] hover:text-[#e5ba55] font-semibold flex items-center gap-0.5 transition-colors"
                >
                  Stores View <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-3 bg-[#0c0c0e] border border-white/[0.05] rounded-2xl flex items-center justify-between">
                  <span className="text-neutral-400">Stores Stock Valuation:</span>
                  <span className="font-bold text-[#3fbf6f] font-mono">{formatINR(metrics.inventory.totalValuation)}</span>
                </div>
                <div className="p-3 bg-[#0c0c0e] border border-white/[0.05] rounded-2xl flex items-center justify-between">
                  <span className="text-neutral-400">Low Stock Reorders:</span>
                  <span className={`font-bold ${metrics.inventory.lowStockItems > 0 ? 'text-[#e5544d]' : 'text-neutral-400'}`}>
                    {metrics.inventory.lowStockItems} items
                  </span>
                </div>
                <div className="p-3 bg-[#0c0c0e] border border-white/[0.05] rounded-2xl flex items-center justify-between">
                  <span className="text-neutral-400">Vendor AP Outstanding:</span>
                  <span className="font-bold text-[#d4a437] font-mono">{formatINR(metrics.inventory.apOutstanding)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Live Enterprise Audit Trail */}
          <div className="bg-[#17171b] p-5 sm:p-6 rounded-3xl border border-white/[0.08] shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#d4a437]" /> Cryptographic Activity Log & Audit Trail
              </h3>
              <span className="text-[11px] text-neutral-500 font-medium">Real-time immutable ledger</span>
            </div>

            {metrics.activityFeed.length > 0 ? (
              <div className="divide-y divide-white/[0.06] bg-[#0c0c0e] rounded-2xl border border-white/[0.06] overflow-hidden">
                {metrics.activityFeed.map((evt) => (
                  <div key={evt.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between text-xs hover:bg-white/[0.02] transition-colors gap-1.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-[#d4a437]" />
                      <div>
                        <span className="font-semibold text-white">{evt.action}</span>
                        <span className="text-neutral-400 ml-2">on {evt.entity}</span>
                      </div>
                    </div>
                    <div className="text-neutral-400 text-[11px] sm:text-right">
                      <span>{evt.user} ({evt.role})</span> • <span>{formatDateTimeIN(evt.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-[#0c0c0e] rounded-2xl border border-white/[0.06] space-y-2">
                <Clock className="w-8 h-8 text-neutral-500 mx-auto" />
                <p className="text-xs font-semibold text-neutral-300">No recent activity events recorded</p>
                <p className="text-[11px] text-neutral-500">System actions across branches will be streamed here in real-time.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
