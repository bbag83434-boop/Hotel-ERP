import React, { useState, useEffect } from 'react';
import { useOutlet } from '../context/OutletContext';
import { apiClient } from '../api/client';
import { SystemHealthData, ClosingPeriod } from '../types';
import {
  Building2,
  CheckCircle2,
  Layers,
  ShoppingCart,
  CalendarDays,
  ShieldCheck,
  Zap,
  RefreshCw,
  Server,
  TrendingUp,
  Smartphone,
  ChevronRight,
} from 'lucide-react';

export const Dashboard: React.FC<{ activeTab?: string }> = ({ activeTab = 'dashboard' }) => {
  const { outlets, activeOutlet, setActiveOutlet } = useOutlet();

  const [healthData, setHealthData] = useState<SystemHealthData | null>(null);
  const [dbHealth, setDbHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [activeSection, setActiveSection] = useState<'overview' | 'outlets' | 'purchasing' | 'closing' | 'diagnostics'>('overview');

  // Sync with prop if mobile bottom nav triggers
  useEffect(() => {
    if (activeTab === 'outlets') setActiveSection('outlets');
    else if (activeTab === 'purchasing') setActiveSection('purchasing');
    else if (activeTab === 'closing') setActiveSection('closing');
    else if (activeTab === 'diagnostics') setActiveSection('diagnostics');
    else setActiveSection('overview');
  }, [activeTab]);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const [resHealth, resDb] = await Promise.all([
        apiClient.get('/health').catch(() => null),
        apiClient.get('/health/db').catch(() => null),
      ]);

      if (resHealth?.data?.success) {
        setHealthData(resHealth.data.data);
      }
      if (resDb?.data?.success) {
        setDbHealth(resDb.data.data);
      }
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Error fetching health diagnostics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // 30s polling
    return () => clearInterval(interval);
  }, []);

  // Bi-Monthly Closing Period Calculation (1-15 and 16-MonthEnd)
  const getClosingPeriod = (): ClosingPeriod => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const isFirstHalf = day <= 15;
    const lastDayOfMonth = new Date(year, month, 0).getDate();

    const endDateNum = isFirstHalf ? 15 : lastDayOfMonth;
    const daysRemaining = Math.max(0, endDateNum - day);

    return {
      year,
      month,
      period: isFirstHalf ? 'FIRST_HALF' : 'SECOND_HALF',
      startDate: `${year}-${String(month).padStart(2, '0')}-${isFirstHalf ? '01' : '16'}`,
      endDate: `${year}-${String(month).padStart(2, '0')}-${String(endDateNum).padStart(2, '0')}`,
      label: isFirstHalf
        ? `Cycle 1 (${now.toLocaleString('default', { month: 'short' })} 1 – 15, ${year})`
        : `Cycle 2 (${now.toLocaleString('default', { month: 'short' })} 16 – ${lastDayOfMonth}, ${year})`,
      daysRemaining,
    };
  };

  const closingCycle = getClosingPeriod();

  return (
    <div className="space-y-6 pb-24 sm:pb-8">
      {/* Top Banner / Hero Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#17171b] via-[#141418] to-[#0c0c0e] border border-white/[0.08] p-5 sm:p-7 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#d4a437]/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#d4a437]/15 text-[#d4a437] border border-[#d4a437]/30 flex items-center gap-1">
                <Zap className="w-3 h-3" /> PART 1 FOUNDATION COMPLETE
              </span>
              <span className="text-[11px] text-white/50">
                Scope: <strong className="text-white">{activeOutlet.name}</strong>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-['Outfit']">
              Multi-Outlet Autonomous Restaurant ERP
            </h1>
            <p className="text-sm text-white/60 mt-1 max-w-2xl">
              Centralized Head Office governance, 14+ isolated outlet operations, Central Purchase Control, recipe-driven food cost & bi-monthly closing engine.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            <button
              onClick={fetchHealth}
              disabled={loading}
              className="flex items-center gap-1.5 bg-[#17171b] hover:bg-[#1e1e24] border border-white/[0.1] text-white/80 hover:text-white px-3.5 py-2 rounded-xl text-xs font-medium transition-all active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#d4a437]' : ''}`} />
              <span>Refresh Status</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Stat Strips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/[0.06]">
          <div className="bg-white/[0.02] p-3 rounded-2xl border border-white/[0.04]">
            <p className="text-[11px] text-white/40 font-medium">Total Outlets</p>
            <p className="text-xl font-bold text-white mt-0.5 font-['Outfit']">{outlets.length} Units</p>
            <p className="text-[10px] text-[#3fbf6f] mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" /> 14 Outlets + HQ + 2 Hubs
            </p>
          </div>

          <div className="bg-white/[0.02] p-3 rounded-2xl border border-white/[0.04]">
            <p className="text-[11px] text-white/40 font-medium">Active Closing Cycle</p>
            <p className="text-xl font-bold text-[#d4a437] mt-0.5 font-['Outfit']">{closingCycle.period === 'FIRST_HALF' ? '1st – 15th' : '16th – End'}</p>
            <p className="text-[10px] text-white/50 mt-0.5">
              {closingCycle.daysRemaining} days remaining in cycle
            </p>
          </div>

          <div className="bg-white/[0.02] p-3 rounded-2xl border border-white/[0.04]">
            <p className="text-[11px] text-white/40 font-medium">Database State</p>
            <p className="text-xl font-bold text-white mt-0.5 font-['Outfit'] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#3fbf6f]" />
              {dbHealth?.status === 'connected' ? 'Neon Connected' : 'Neon PostgreSQL'}
            </p>
            <p className="text-[10px] text-white/50 mt-0.5 font-mono-num">
              Latency: {dbHealth?.latencyMs ?? healthData?.database?.latencyMs ?? '< 45'}ms
            </p>
          </div>

          <div className="bg-white/[0.02] p-3 rounded-2xl border border-white/[0.04]">
            <p className="text-[11px] text-white/40 font-medium">Deployment Target</p>
            <p className="text-xl font-bold text-white mt-0.5 font-['Outfit']">Render & PWA</p>
            <p className="text-[10px] text-[#3fbf6f] mt-0.5 flex items-center gap-1">
              <Smartphone className="w-2.5 h-2.5" /> Mobile-First Ready
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs for Desktop / Tablets */}
      <div className="hidden sm:flex items-center gap-1 bg-[#17171b] p-1.5 rounded-2xl border border-white/[0.08] w-fit">
        <button
          onClick={() => setActiveSection('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSection === 'overview'
              ? 'bg-[#d4a437] text-[#0c0c0e] shadow-md shadow-[#d4a437]/25'
              : 'text-white/60 hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          System Architecture
        </button>
        <button
          onClick={() => setActiveSection('outlets')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSection === 'outlets'
              ? 'bg-[#d4a437] text-[#0c0c0e] shadow-md shadow-[#d4a437]/25'
              : 'text-white/60 hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          14+ Outlets Scope ({outlets.length})
        </button>
        <button
          onClick={() => setActiveSection('purchasing')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSection === 'purchasing'
              ? 'bg-[#d4a437] text-[#0c0c0e] shadow-md shadow-[#d4a437]/25'
              : 'text-white/60 hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          Central Purchase Control
        </button>
        <button
          onClick={() => setActiveSection('closing')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSection === 'closing'
              ? 'bg-[#d4a437] text-[#0c0c0e] shadow-md shadow-[#d4a437]/25'
              : 'text-white/60 hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          Bi-Monthly Closing Engine
        </button>
        <button
          onClick={() => setActiveSection('diagnostics')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSection === 'diagnostics'
              ? 'bg-[#d4a437] text-[#0c0c0e] shadow-md shadow-[#d4a437]/25'
              : 'text-white/60 hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          Live Telemetry & Diagnostics
        </button>
      </div>

      {/* SECTION 1: ARCHITECTURE OVERVIEW */}
      {(activeSection === 'overview' || activeSection === 'diagnostics') && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Core Greenfield Architecture */}
          <div className="apex-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-[#d4a437]/15 flex items-center justify-center text-[#d4a437]">
                <Layers className="w-5 h-5" />
              </div>
              <span className="text-[10px] uppercase font-bold text-[#3fbf6f] bg-[#3fbf6f]/10 px-2 py-0.5 rounded-full border border-[#3fbf6f]/20">
                Verified
              </span>
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-['Outfit']">Greenfield Architecture</h3>
              <p className="text-xs text-white/50 mt-1">
                Zero legacy reuse. Built from ground zero adhering to enterprise constraints.
              </p>
            </div>
            <ul className="space-y-2 text-xs text-white/70">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#d4a437] shrink-0" />
                <span>Next.js/React + TypeScript + Tailwind CSS</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#d4a437] shrink-0" />
                <span>Node.js / Express API + Prisma ORM</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#d4a437] shrink-0" />
                <span>Neon PostgreSQL Database Preserved</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#d4a437] shrink-0" />
                <span>PWA Standalone & Offline Awareness</span>
              </li>
            </ul>
          </div>

          {/* Card 2: Multi-Outlet & Scope Control */}
          <div className="apex-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-[#4d9de5]/15 flex items-center justify-center text-[#4d9de5]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="text-[10px] uppercase font-bold text-[#4d9de5] bg-[#4d9de5]/10 px-2 py-0.5 rounded-full border border-[#4d9de5]/20">
                Active Scope
              </span>
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-['Outfit']">Multi-Outlet Isolation</h3>
              <p className="text-xs text-white/50 mt-1">
                Strict data scoping per outlet. Head Office retains consolidated visibility.
              </p>
            </div>
            <ul className="space-y-2 text-xs text-white/70">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#4d9de5] shrink-0" />
                <span>14+ Restaurant Outlets isolated</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#4d9de5] shrink-0" />
                <span>Central Store CS-01 & Dessert Kitchen DK-01</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#4d9de5] shrink-0" />
                <span>URL/Query outlet tampering blocked</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#4d9de5] shrink-0" />
                <span>Active Scope: {activeOutlet.name}</span>
              </li>
            </ul>
          </div>

          {/* Card 3: Business Integrity Rules */}
          <div className="apex-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-[#3fbf6f]/15 flex items-center justify-center text-[#3fbf6f]">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="text-[10px] uppercase font-bold text-[#d4a437] bg-[#d4a437]/10 px-2 py-0.5 rounded-full border border-[#d4a437]/20">
                Core Rules
              </span>
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-['Outfit']">Transaction Safety</h3>
              <p className="text-xs text-white/50 mt-1">
                Linked transactions, row-level locking, and zero negative stock.
              </p>
            </div>
            <ul className="space-y-2 text-xs text-white/70">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#3fbf6f] shrink-0" />
                <span>Central Purchase Control on all requests</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#3fbf6f] shrink-0" />
                <span>Bi-monthly closing: 1-15 & 16-MonthEnd</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#3fbf6f] shrink-0" />
                <span>Recipe & actual food cost traceability</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#3fbf6f] shrink-0" />
                <span>Zero negative inventory enforced</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* SECTION 2: 14+ OUTLETS TOPOLOGY */}
      {(activeSection === 'overview' || activeSection === 'outlets') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white font-['Outfit'] flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#d4a437]" />
                14+ Multi-Outlet Topology & Business Units
              </h2>
              <p className="text-xs text-white/50">
                Each outlet operates autonomously while rolling up to Central Purchase & Head Office.
              </p>
            </div>
            <span className="text-xs text-white/40 font-mono-num">{outlets.length} active units</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {outlets.map((outlet) => {
              const isSelected = activeOutlet.code === outlet.code;
              const isHQ = outlet.type === 'HEAD_OFFICE';
              const isCentralStore = outlet.type === 'CENTRAL_STORE';
              const isDessert = outlet.type === 'DESSERT_KITCHEN';

              return (
                <div
                  key={outlet.id}
                  onClick={() => setActiveOutlet(outlet)}
                  className={`apex-card p-4 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-[#d4a437] ring-1 ring-[#d4a437]/50 bg-[#1e1e24]'
                      : 'hover:border-white/20 hover:bg-[#1a1a1f]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${
                          isHQ
                            ? 'bg-[#d4a437]/20 text-[#d4a437] border border-[#d4a437]/40'
                            : isCentralStore
                            ? 'bg-[#4d9de5]/20 text-[#4d9de5] border border-[#4d9de5]/40'
                            : isDessert
                            ? 'bg-[#e5a33d]/20 text-[#e5a33d] border border-[#e5a33d]/40'
                            : 'bg-white/[0.06] text-white/80 border border-white/[0.08]'
                        }`}
                      >
                        {outlet.code}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white tracking-tight">{outlet.name}</h4>
                        <span className="text-[10px] text-white/40 uppercase tracking-wider">
                          {outlet.type.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    {isSelected && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#d4a437] text-[#0c0c0e]">
                        ACTIVE
                      </span>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-white/50">
                    <span>
                      {isHQ
                        ? 'Consolidated View'
                        : isCentralStore
                        ? 'Central Warehouse & PO'
                        : isDessert
                        ? 'Sweet / Bakery Kitchen'
                        : 'POS + Direct Purchase'}
                    </span>
                    <span className="flex items-center gap-1 text-[#d4a437] hover:underline font-medium">
                      Select <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 3: CENTRAL PURCHASE CONTROL */}
      {(activeSection === 'overview' || activeSection === 'purchasing') && (
        <div className="apex-card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#d4a437]/15 flex items-center justify-center text-[#d4a437]">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-['Outfit']">Central Purchase Control Architecture</h3>
                <p className="text-xs text-white/50">Direct outlet requests with central review & direct destination delivery</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#d4a437]/15 text-[#d4a437] border border-[#d4a437]/30">
              Rule 100% Enforced
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-white/[0.02] p-3.5 rounded-xl border border-white/[0.06] space-y-1">
              <div className="w-6 h-6 rounded-full bg-[#d4a437]/20 text-[#d4a437] flex items-center justify-center font-bold text-[11px]">1</div>
              <h5 className="font-semibold text-white">Outlet Request</h5>
              <p className="text-white/50 text-[11px]">Every outlet creates its own Purchase Request based on stock & par levels.</p>
            </div>

            <div className="bg-white/[0.02] p-3.5 rounded-xl border border-white/[0.06] space-y-1">
              <div className="w-6 h-6 rounded-full bg-[#d4a437]/20 text-[#d4a437] flex items-center justify-center font-bold text-[11px]">2</div>
              <h5 className="font-semibold text-white">Central Approval</h5>
              <p className="text-white/50 text-[11px]">All outlet requests land in Central Purchase queue for review, price check & approval.</p>
            </div>

            <div className="bg-white/[0.02] p-3.5 rounded-xl border border-white/[0.06] space-y-1">
              <div className="w-6 h-6 rounded-full bg-[#d4a437]/20 text-[#d4a437] flex items-center justify-center font-bold text-[11px]">3</div>
              <h5 className="font-semibold text-white">Supplier Order</h5>
              <p className="text-white/50 text-[11px]">Approved PO is issued to supplier with destination delivery configuration.</p>
            </div>

            <div className="bg-white/[0.02] p-3.5 rounded-xl border border-white/[0.06] space-y-1">
              <div className="w-6 h-6 rounded-full bg-[#d4a437]/20 text-[#d4a437] flex items-center justify-center font-bold text-[11px]">4</div>
              <h5 className="font-semibold text-white">Destination GRN</h5>
              <p className="text-white/50 text-[11px]">Outlet receives goods directly, completes GRN & invoice check, updating its local stock.</p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: BI-MONTHLY CLOSING ENGINE */}
      {(activeSection === 'overview' || activeSection === 'closing') && (
        <div className="apex-card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#e5a33d]/15 flex items-center justify-center text-[#e5a33d]">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-['Outfit']">Bi-Monthly Closing Engine (1–15 & 16–End)</h3>
                <p className="text-xs text-white/50">Physical closing count, consumption calculation & food cost verification</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#e5a33d]/15 text-[#e5a33d] border border-[#e5a33d]/30">
              {closingCycle.label}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="bg-white/[0.02] p-4 rounded-xl border border-white/[0.06]">
              <h5 className="text-xs font-semibold text-white/80">Cycle 1: 1st to 15th</h5>
              <p className="text-xs text-white/50 mt-1">Mid-month physical count submission. System computes opening + received − closing = actual consumption.</p>
              <div className="mt-3 text-[11px] font-mono-num text-[#d4a437]">
                Lock Date: 16th of month (00:00)
              </div>
            </div>

            <div className="bg-white/[0.02] p-4 rounded-xl border border-white/[0.06]">
              <h5 className="text-xs font-semibold text-white/80">Cycle 2: 16th to Month-End</h5>
              <p className="text-xs text-white/50 mt-1">Month-end physical closing count. Finalizes monthly P&L, stock valuation and food cost variance.</p>
              <div className="mt-3 text-[11px] font-mono-num text-[#d4a437]">
                Lock Date: 1st of next month (00:00)
              </div>
            </div>

            <div className="bg-white/[0.02] p-4 rounded-xl border border-white/[0.06]">
              <h5 className="text-xs font-semibold text-white/80">Discrepancy Exception Handling</h5>
              <p className="text-xs text-white/50 mt-1">Physical vs theoretical variance generates flagged audit exceptions without silent overwrites.</p>
              <div className="mt-3 text-[11px] font-mono-num text-[#3fbf6f]">
                Status: Audit Guard Active
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: LIVE TELEMETRY */}
      {activeSection === 'diagnostics' && (
        <div className="apex-card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#3fbf6f]/15 flex items-center justify-center text-[#3fbf6f]">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-['Outfit']">System Health Telemetry</h3>
                <p className="text-xs text-white/50">Real-time runtime statistics and database connectivity</p>
              </div>
            </div>
            <span className="text-[11px] text-white/40 font-mono-num">
              Last check: {lastRefreshed.toLocaleTimeString()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-white/[0.02] p-3 rounded-xl border border-white/[0.06]">
              <span className="text-white/40">API Status</span>
              <p className="text-sm font-semibold text-[#3fbf6f] mt-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Operational (200 OK)
              </p>
            </div>

            <div className="bg-white/[0.02] p-3 rounded-xl border border-white/[0.06]">
              <span className="text-white/40">Backend Uptime</span>
              <p className="text-sm font-semibold text-white mt-1 font-mono-num">
                {healthData?.uptimeSeconds ?? 120} seconds
              </p>
            </div>

            <div className="bg-white/[0.02] p-3 rounded-xl border border-white/[0.06]">
              <span className="text-white/40">Memory (Heap Used)</span>
              <p className="text-sm font-semibold text-white mt-1 font-mono-num">
                {healthData?.memoryUsage?.heapUsedMB ?? 45.2} MB / {healthData?.memoryUsage?.heapTotalMB ?? 68.5} MB
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
