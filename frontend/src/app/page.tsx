'use client';

import React, { useEffect, useState } from 'react';
import { useOutlet } from '@/context/OutletContext';
import { usePWA } from '@/context/PWAContext';
import { apiClient } from '@/api/client';
import { SystemHealth } from '@/types';
import {
  Building2,
  Cpu,
  Layers,
  CalendarCheck,
  TrendingUp,
  ShieldCheck,
  Zap,
  ArrowRight,
  Server,
  Activity,
  CheckCircle2,
  AlertCircle,
  Truck,
  Sparkles,
} from 'lucide-react';

export default function DashboardPage() {
  const { currentOutlet, outlets, closingInfo } = useOutlet();
  const { isOnline } = usePWA();
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loadingHealth, setLoadingHealth] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'topology' | 'purchase' | 'closing' | 'telemetry'>('topology');

  useEffect(() => {
    async function fetchHealth() {
      try {
        setLoadingHealth(true);
        const res = await apiClient.get('/health');
        if (res.data?.data) {
          setHealth(res.data.data);
        }
      } catch (err) {
        console.warn('Backend telemetry unreachable or offline:', err);
      } finally {
        setLoadingHealth(false);
      }
    }
    fetchHealth();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden luxury-card p-6 md:p-8 bg-gradient-to-br from-[#1a1a20] via-[#141418] to-[#0c0c0e] border-[#d4a437]/30">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-[#d4a437]/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#d4a437]/10 text-[#d4a437] border border-[#d4a437]/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>GREENFIELD REBUILD · NEXT.JS + FASTAPI + NEON</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white font-['Outfit']">
              APEX Multi-Outlet ERP
            </h1>
            <p className="text-sm md:text-base text-[#9ba1a6] max-w-xl">
              Currently operating under active scope:{' '}
              <span className="text-white font-semibold">{currentOutlet.name}</span>{' '}
              <span className="text-xs px-2 py-0.5 rounded bg-[#24242c] text-[#d4a437]">
                [{currentOutlet.code}]
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#212126] border border-[#2c2c34]">
              <Server className="w-4 h-4 text-[#d4a437]" />
              <div className="text-xs text-left">
                <p className="text-[#9ba1a6]">Backend Engine</p>
                <p className="font-semibold text-white">Python 3.14 · FastAPI</p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#212126] border border-[#2c2c34]">
              <Activity className="w-4 h-4 text-[#3fbf6f]" />
              <div className="text-xs text-left">
                <p className="text-[#9ba1a6]">Database</p>
                <p className="font-semibold text-white">Neon PostgreSQL</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metric Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="luxury-card p-4">
          <div className="flex items-center justify-between text-[#9ba1a6] mb-2">
            <span className="text-xs font-medium">Total Outlets</span>
            <Building2 className="w-4 h-4 text-[#d4a437]" />
          </div>
          <p className="text-2xl font-bold text-white font-['Outfit']">{outlets.length}</p>
          <p className="text-xs text-[#3fbf6f] mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> 14 Outlets + 2 Central Units
          </p>
        </div>

        <div className="luxury-card p-4">
          <div className="flex items-center justify-between text-[#9ba1a6] mb-2">
            <span className="text-xs font-medium">Purchase Flow</span>
            <Truck className="w-4 h-4 text-[#3b82f6]" />
          </div>
          <p className="text-2xl font-bold text-white font-['Outfit']">Central</p>
          <p className="text-xs text-[#9ba1a6] mt-1">Outlet PR → Central Approval</p>
        </div>

        <div className="luxury-card p-4">
          <div className="flex items-center justify-between text-[#9ba1a6] mb-2">
            <span className="text-xs font-medium">Closing Period</span>
            <CalendarCheck className="w-4 h-4 text-[#d4a437]" />
          </div>
          <p className="text-2xl font-bold text-white font-['Outfit']">
            {closingInfo.periodType === 'FIRST_HALF' ? '1st–15th' : '16th–End'}
          </p>
          <p className="text-xs text-[#d4a437] mt-1">{closingInfo.daysRemaining} days remaining in cycle</p>
        </div>

        <div className="luxury-card p-4">
          <div className="flex items-center justify-between text-[#9ba1a6] mb-2">
            <span className="text-xs font-medium">System Telemetry</span>
            <Cpu className="w-4 h-4 text-[#3fbf6f]" />
          </div>
          <p className="text-2xl font-bold text-white font-['Outfit']">
            {health?.database?.status === 'connected' ? 'Healthy' : 'Active'}
          </p>
          <p className="text-xs text-[#9ba1a6] mt-1">
            {health?.database?.latencyMs ? `${health.database.latencyMs}ms DB latency` : 'Zero negative stock ready'}
          </p>
        </div>
      </div>

      {/* Interactive Tabs */}
      <div className="flex border-b border-[#2c2c34] space-x-4">
        <button
          onClick={() => setActiveTab('topology')}
          className={`pb-3 text-sm font-semibold transition-all border-b-2 ${
            activeTab === 'topology'
              ? 'border-[#d4a437] text-[#d4a437]'
              : 'border-transparent text-[#9ba1a6] hover:text-white'
          }`}
        >
          14+ Outlets Topology
        </button>
        <button
          onClick={() => setActiveTab('purchase')}
          className={`pb-3 text-sm font-semibold transition-all border-b-2 ${
            activeTab === 'purchase'
              ? 'border-[#d4a437] text-[#d4a437]'
              : 'border-transparent text-[#9ba1a6] hover:text-white'
          }`}
        >
          Central Purchase Control
        </button>
        <button
          onClick={() => setActiveTab('closing')}
          className={`pb-3 text-sm font-semibold transition-all border-b-2 ${
            activeTab === 'closing'
              ? 'border-[#d4a437] text-[#d4a437]'
              : 'border-transparent text-[#9ba1a6] hover:text-white'
          }`}
        >
          Bi-Monthly Closing Engine
        </button>
        <button
          onClick={() => setActiveTab('telemetry')}
          className={`pb-3 text-sm font-semibold transition-all border-b-2 ${
            activeTab === 'telemetry'
              ? 'border-[#d4a437] text-[#d4a437]'
              : 'border-transparent text-[#9ba1a6] hover:text-white'
          }`}
        >
          Live Backend Telemetry
        </button>
      </div>

      {/* Tab 1: Topology */}
      {activeTab === 'topology' && (
        <div className="space-y-4">
          <div className="luxury-card p-6">
            <h2 className="text-lg font-bold text-white font-['Outfit'] mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#d4a437]" />
              Enterprise Multi-Outlet Network Scope
            </h2>
            <p className="text-sm text-[#9ba1a6] mb-6">
              Full multi-tenant hierarchical scoping covering Head Office, independent Central Production units, and all retail restaurant branches.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {outlets.map((outlet) => {
                const isSelected = outlet.id === currentOutlet.id;
                return (
                  <div
                    key={outlet.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-[#24242c] border-[#d4a437] shadow-lg shadow-[#d4a437]/10'
                        : 'bg-[#17171b] border-[#2c2c34] hover:border-[#444452]'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{outlet.name}</span>
                          {isSelected && (
                            <span className="text-[10px] bg-[#d4a437] text-black font-extrabold px-1.5 py-0.5 rounded">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#9ba1a6] mt-0.5 font-mono">{outlet.code}</p>
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          outlet.type === 'HEAD_OFFICE'
                            ? 'bg-purple-950/60 text-purple-300 border border-purple-800'
                            : outlet.type === 'CENTRAL_STORE'
                            ? 'bg-blue-950/60 text-blue-300 border border-blue-800'
                            : outlet.type === 'DESSERT_KITCHEN'
                            ? 'bg-pink-950/60 text-pink-300 border border-pink-800'
                            : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
                        }`}
                      >
                        {outlet.type.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#2c2c34] flex items-center justify-between text-xs text-[#9ba1a6]">
                      <span>Direct Purchase Delivery</span>
                      <span className="text-[#3fbf6f] font-medium">Enabled</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Purchase */}
      {activeTab === 'purchase' && (
        <div className="luxury-card p-6 space-y-6">
          <h2 className="text-lg font-bold text-white font-['Outfit'] flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#d4a437]" />
            Central Purchase Control & Direct Destination Fulfillment
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
            <div className="p-4 rounded-xl bg-[#212126] border border-[#2c2c34] space-y-2">
              <div className="w-8 h-8 rounded-full bg-[#d4a437]/20 text-[#d4a437] font-bold flex items-center justify-center mx-auto text-sm">
                1
              </div>
              <h3 className="font-semibold text-white text-sm">Outlet PR Creation</h3>
              <p className="text-xs text-[#9ba1a6]">Every outlet drafts purchase request for local stock requirements</p>
            </div>

            <div className="p-4 rounded-xl bg-[#212126] border border-[#2c2c34] space-y-2">
              <div className="w-8 h-8 rounded-full bg-[#d4a437]/20 text-[#d4a437] font-bold flex items-center justify-center mx-auto text-sm">
                2
              </div>
              <h3 className="font-semibold text-white text-sm">Central Review Queue</h3>
              <p className="text-xs text-[#9ba1a6]">All outlet PRs land in Head Office Central Purchase review hub</p>
            </div>

            <div className="p-4 rounded-xl bg-[#212126] border border-[#2c2c34] space-y-2">
              <div className="w-8 h-8 rounded-full bg-[#d4a437]/20 text-[#d4a437] font-bold flex items-center justify-center mx-auto text-sm">
                3
              </div>
              <h3 className="font-semibold text-white text-sm">PO Direct to Supplier</h3>
              <p className="text-xs text-[#9ba1a6]">Approved PO issued with destination outlet delivery address</p>
            </div>

            <div className="p-4 rounded-xl bg-[#212126] border border-[#2c2c34] space-y-2">
              <div className="w-8 h-8 rounded-full bg-[#3fbf6f]/20 text-[#3fbf6f] font-bold flex items-center justify-center mx-auto text-sm">
                4
              </div>
              <h3 className="font-semibold text-white text-sm">Destination GRN</h3>
              <p className="text-xs text-[#9ba1a6]">Outlet conducts physical QC & receives stock directly into local inventory</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Closing */}
      {activeTab === 'closing' && (
        <div className="luxury-card p-6 space-y-6">
          <h2 className="text-lg font-bold text-white font-['Outfit'] flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-[#d4a437]" />
            Bi-Monthly Closing Engine (1st–15th & 16th–MonthEnd)
          </h2>

          <div className="p-4 rounded-xl bg-[#212126] border border-[#2c2c34] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-xs text-[#9ba1a6]">Active Accounting Cycle</p>
              <p className="text-lg font-bold text-white mt-0.5">
                {closingInfo.label} ({closingInfo.startDate.slice(0, 10)} to {closingInfo.endDate.slice(0, 10)})
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 rounded-lg bg-[#2c2c34] text-xs font-semibold text-[#d4a437]">
                Status: OPEN FOR RECONCILIATION
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#0c0c0e] border border-[#2c2c34] space-y-3 font-mono text-xs">
            <p className="text-[#9ba1a6] font-bold font-sans text-sm">Food Cost & Consumption Formula:</p>
            <div className="text-[#3fbf6f]">
              Actual Consumption Valuation = Opening Physical Stock + Purchases in Period - Closing Physical Count
            </div>
            <div className="text-[#d4a437]">
              Variance Amount = Actual Consumption - Theoretical Consumption (POS Sales & Recipes)
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Telemetry */}
      {activeTab === 'telemetry' && (
        <div className="luxury-card p-6 space-y-4">
          <h2 className="text-lg font-bold text-white font-['Outfit'] flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#d4a437]" />
            FastAPI + Neon PostgreSQL Live Diagnostics
          </h2>

          <div className="p-4 rounded-xl bg-[#0c0c0e] border border-[#2c2c34] font-mono text-xs text-[#9ba1a6] overflow-x-auto">
            <pre>{JSON.stringify(health || { status: 'Connecting...', backend: 'FastAPI' }, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
