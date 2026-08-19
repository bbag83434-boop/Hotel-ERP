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
import OrganizationManager from '@/components/organization/OrganizationManager';

export default function DashboardPage() {
  const { currentOutlet, outlets, closingInfo } = useOutlet();
  const { isOnline } = usePWA();
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loadingHealth, setLoadingHealth] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'organization' | 'topology' | 'purchase' | 'closing' | 'telemetry'>('organization');

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
      <div className="relative overflow-hidden luxury-card p-6 md:p-8 bg-gradient-to-br from-white via-white/85 to-[#FAF8F5] border border-[rgba(45,45,45,0.08)] shadow-[0_4px_24px_rgba(45,45,45,0.04)]">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-[#C79A3B]/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#F1E4C5] text-[#B8862D] border border-[#B8862D]/30 shadow-sm">
              <Sparkles className="w-3.5 h-3.5" />
              <span>GREENFIELD REBUILD · NEXT.JS + FASTAPI + NEON</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1C1C1C] font-['Outfit']">
              APEX Multi-Outlet ERP
            </h1>
            <p className="text-sm md:text-base text-[#707070] max-w-xl">
              Currently operating under active scope:{' '}
              <span className="text-[#1C1C1C] font-semibold">{currentOutlet.name}</span>{' '}
              <span className="text-xs px-2 py-0.5 rounded bg-[#FAF8F5] text-[#B8862D] font-mono border border-[rgba(45,45,45,0.08)]">
                [{currentOutlet.code}]
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/90 border border-[rgba(45,45,45,0.08)] shadow-sm">
              <Server className="w-4 h-4 text-[#C79A3B]" />
              <div className="text-xs text-left">
                <p className="text-[#707070]">Backend Engine</p>
                <p className="font-semibold text-[#1C1C1C]">Python 3.14 · FastAPI</p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/90 border border-[rgba(45,45,45,0.08)] shadow-sm">
              <Activity className="w-4 h-4 text-[#2E8B57]" />
              <div className="text-xs text-left">
                <p className="text-[#707070]">Database</p>
                <p className="font-semibold text-[#1C1C1C]">Neon PostgreSQL</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metric Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="luxury-card p-4 bg-white/80 border border-[rgba(45,45,45,0.08)]">
          <div className="flex items-center justify-between text-[#707070] mb-2">
            <span className="text-xs font-medium">Total Outlets</span>
            <Building2 className="w-4 h-4 text-[#C79A3B]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">{outlets.length}</p>
          <p className="text-xs text-[#2E8B57] mt-1 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3 h-3" /> 14 Outlets + 2 Central Units
          </p>
        </div>

        <div className="luxury-card p-4 bg-white/80 border border-[rgba(45,45,45,0.08)]">
          <div className="flex items-center justify-between text-[#707070] mb-2">
            <span className="text-xs font-medium">Purchase Flow</span>
            <Truck className="w-4 h-4 text-[#3978B8]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">Central</p>
          <p className="text-xs text-[#707070] mt-1">Outlet PR → Central Approval</p>
        </div>

        <div className="luxury-card p-4 bg-white/80 border border-[rgba(45,45,45,0.08)]">
          <div className="flex items-center justify-between text-[#707070] mb-2">
            <span className="text-xs font-medium">Closing Period</span>
            <CalendarCheck className="w-4 h-4 text-[#C79A3B]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">
            {closingInfo.periodType === 'FIRST_HALF' ? '1st–15th' : '16th–End'}
          </p>
          <p className="text-xs text-[#B8862D] mt-1 font-medium">{closingInfo.daysRemaining} days remaining in cycle</p>
        </div>

        <div className="luxury-card p-4 bg-white/80 border border-[rgba(45,45,45,0.08)]">
          <div className="flex items-center justify-between text-[#707070] mb-2">
            <span className="text-xs font-medium">System Telemetry</span>
            <Cpu className="w-4 h-4 text-[#2E8B57]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">
            {health?.database?.status === 'connected' ? 'Healthy' : 'Active'}
          </p>
          <p className="text-xs text-[#707070] mt-1">
            {health?.database?.latencyMs ? `${health.database.latencyMs}ms DB latency` : 'Zero negative stock ready'}
          </p>
        </div>
      </div>

      {/* Interactive Tabs */}
      <div className="flex border-b border-[rgba(45,45,45,0.08)] space-x-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab('organization')}
          className={`pb-3 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'organization'
              ? 'border-[#C79A3B] text-[#B8862D]'
              : 'border-transparent text-[#707070] hover:text-[#1C1C1C]'
          }`}
        >
          Organization & Hierarchy
        </button>
        <button
          onClick={() => setActiveTab('topology')}
          className={`pb-3 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'topology'
              ? 'border-[#C79A3B] text-[#B8862D]'
              : 'border-transparent text-[#707070] hover:text-[#1C1C1C]'
          }`}
        >
          14+ Outlets Topology
        </button>
        <button
          onClick={() => setActiveTab('purchase')}
          className={`pb-3 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'purchase'
              ? 'border-[#C79A3B] text-[#B8862D]'
              : 'border-transparent text-[#707070] hover:text-[#1C1C1C]'
          }`}
        >
          Central Purchase Control
        </button>
        <button
          onClick={() => setActiveTab('closing')}
          className={`pb-3 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'closing'
              ? 'border-[#C79A3B] text-[#B8862D]'
              : 'border-transparent text-[#707070] hover:text-[#1C1C1C]'
          }`}
        >
          Bi-Monthly Closing Engine
        </button>
        <button
          onClick={() => setActiveTab('telemetry')}
          className={`pb-3 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'telemetry'
              ? 'border-[#C79A3B] text-[#B8862D]'
              : 'border-transparent text-[#707070] hover:text-[#1C1C1C]'
          }`}
        >
          Live Backend Telemetry
        </button>
      </div>

      {/* Tab: Organization Management */}
      {activeTab === 'organization' && (
        <div className="luxury-card p-6 bg-white/85 border border-[rgba(45,45,45,0.08)] shadow-[0_4px_24px_rgba(45,45,45,0.03)]">
          <OrganizationManager />
        </div>
      )}

      {/* Tab 1: Topology */}
      {activeTab === 'topology' && (
        <div className="space-y-4">
          <div className="luxury-card p-6 bg-white/80 border border-[rgba(45,45,45,0.08)]">
            <h2 className="text-lg font-bold text-[#1C1C1C] font-['Outfit'] mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#C79A3B]" />
              Enterprise Multi-Outlet Network Scope
            </h2>
            <p className="text-sm text-[#707070] mb-6">
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
                        ? 'bg-[#FAF8F5] border-[#C79A3B] shadow-md shadow-[#C79A3B]/10'
                        : 'bg-white/90 border-[rgba(45,45,45,0.08)] hover:border-[#C79A3B]/40 shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#1C1C1C] text-sm">{outlet.name}</span>
                          {isSelected && (
                            <span className="text-[10px] bg-[#F1E4C5] text-[#B8862D] font-extrabold px-1.5 py-0.5 rounded border border-[#B8862D]/30">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#707070] mt-0.5 font-mono">{outlet.code}</p>
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          outlet.type === 'HEAD_OFFICE'
                            ? 'bg-[#F1E4C5] text-[#B8862D] border border-[#B8862D]/30'
                            : outlet.type === 'CENTRAL_STORE'
                            ? 'bg-[#3978B8]/10 text-[#3978B8] border border-[#3978B8]/25'
                            : outlet.type === 'DESSERT_KITCHEN'
                            ? 'bg-[#D99625]/10 text-[#D99625] border border-[#D99625]/25'
                            : 'bg-[#2E8B57]/10 text-[#2E8B57] border border-[#2E8B57]/25'
                        }`}
                      >
                        {outlet.type.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[rgba(45,45,45,0.06)] flex items-center justify-between text-xs text-[#707070]">
                      <span>Direct Purchase Delivery</span>
                      <span className="text-[#2E8B57] font-medium">Enabled</span>
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
        <div className="luxury-card p-6 space-y-6 bg-white/80 border border-[rgba(45,45,45,0.08)]">
          <h2 className="text-lg font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#C79A3B]" />
            Central Purchase Control & Direct Destination Fulfillment
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
            <div className="p-4 rounded-xl bg-white/90 border border-[rgba(45,45,45,0.08)] space-y-2 shadow-sm">
              <div className="w-8 h-8 rounded-full bg-[#F1E4C5] text-[#B8862D] font-bold flex items-center justify-center mx-auto text-sm border border-[#B8862D]/30">
                1
              </div>
              <h3 className="font-semibold text-[#1C1C1C] text-sm">Outlet PR Creation</h3>
              <p className="text-xs text-[#707070]">Every outlet drafts purchase request for local stock requirements</p>
            </div>

            <div className="p-4 rounded-xl bg-white/90 border border-[rgba(45,45,45,0.08)] space-y-2 shadow-sm">
              <div className="w-8 h-8 rounded-full bg-[#F1E4C5] text-[#B8862D] font-bold flex items-center justify-center mx-auto text-sm border border-[#B8862D]/30">
                2
              </div>
              <h3 className="font-semibold text-[#1C1C1C] text-sm">Central Review Queue</h3>
              <p className="text-xs text-[#707070]">All outlet PRs land in Head Office Central Purchase review hub</p>
            </div>

            <div className="p-4 rounded-xl bg-white/90 border border-[rgba(45,45,45,0.08)] space-y-2 shadow-sm">
              <div className="w-8 h-8 rounded-full bg-[#F1E4C5] text-[#B8862D] font-bold flex items-center justify-center mx-auto text-sm border border-[#B8862D]/30">
                3
              </div>
              <h3 className="font-semibold text-[#1C1C1C] text-sm">PO Direct to Supplier</h3>
              <p className="text-xs text-[#707070]">Approved PO issued with destination outlet delivery address</p>
            </div>

            <div className="p-4 rounded-xl bg-white/90 border border-[rgba(45,45,45,0.08)] space-y-2 shadow-sm">
              <div className="w-8 h-8 rounded-full bg-[#2E8B57]/15 text-[#2E8B57] font-bold flex items-center justify-center mx-auto text-sm border border-[#2E8B57]/30">
                4
              </div>
              <h3 className="font-semibold text-[#1C1C1C] text-sm">Destination GRN</h3>
              <p className="text-xs text-[#707070]">Outlet conducts physical QC & receives stock directly into local inventory</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Closing */}
      {activeTab === 'closing' && (
        <div className="luxury-card p-6 space-y-6 bg-white/80 border border-[rgba(45,45,45,0.08)]">
          <h2 className="text-lg font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-[#C79A3B]" />
            Bi-Monthly Closing Engine (1st–15th & 16th–MonthEnd)
          </h2>

          <div className="p-4 rounded-xl bg-white/90 border border-[rgba(45,45,45,0.08)] flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm">
            <div>
              <p className="text-xs text-[#707070]">Active Accounting Cycle</p>
              <p className="text-lg font-bold text-[#1C1C1C] mt-0.5">
                {closingInfo.label} ({closingInfo.startDate.slice(0, 10)} to {closingInfo.endDate.slice(0, 10)})
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 rounded-lg bg-[#F1E4C5] text-xs font-semibold text-[#B8862D] border border-[#B8862D]/30">
                Status: OPEN FOR RECONCILIATION
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)] space-y-3 font-mono text-xs shadow-inner">
            <p className="text-[#1C1C1C] font-bold font-sans text-sm">Food Cost & Consumption Formula:</p>
            <div className="text-[#2E8B57] font-semibold">
              Actual Consumption Valuation = Opening Physical Stock + Purchases in Period - Closing Physical Count
            </div>
            <div className="text-[#B8862D] font-semibold">
              Variance Amount = Actual Consumption - Theoretical Consumption (POS Sales & Recipes)
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Telemetry */}
      {activeTab === 'telemetry' && (
        <div className="luxury-card p-6 space-y-4 bg-white/80 border border-[rgba(45,45,45,0.08)]">
          <h2 className="text-lg font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#C79A3B]" />
            FastAPI + Neon PostgreSQL Live Diagnostics
          </h2>

          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)] font-mono text-xs text-[#1C1C1C] overflow-x-auto shadow-inner">
            <pre>{JSON.stringify(health || { status: 'Connecting...', backend: 'FastAPI' }, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
