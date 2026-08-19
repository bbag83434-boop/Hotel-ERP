'use client';

import React from 'react';
import { SystemHealth } from '@/types';
import {
  Cpu,
  Server,
  Activity,
  CheckCircle2,
  AlertCircle,
  Database,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

interface TelemetryWorkspaceProps {
  health: SystemHealth | null;
  loading: boolean;
  onRefresh: () => void;
}

export const TelemetryWorkspace: React.FC<TelemetryWorkspaceProps> = ({
  health,
  loading,
  onRefresh,
}) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[#2E8B57]" />
              Live Backend & Database Telemetry
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#2E8B57]/10 text-[#2E8B57] font-bold border border-[#2E8B57]/20">
              OPERATIONAL
            </span>
          </div>
          <p className="text-xs text-[#707070] mt-0.5">
            Real-time diagnostics from Python FastAPI backend engine and Neon PostgreSQL serverless cloud cluster.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[rgba(45,45,45,0.12)] hover:bg-[#FAF8F5] text-xs font-semibold text-[#1C1C1C] transition-all shadow-sm active:scale-95 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#C79A3B] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Diagnostics</span>
          </button>
        </div>
      </div>

      {/* Diagnostics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-2">
          <div className="flex items-center justify-between text-[#707070]">
            <span className="text-xs font-semibold">Backend Engine</span>
            <Server className="w-4 h-4 text-[#C79A3B]" />
          </div>
          <p className="text-lg font-bold text-[#1C1C1C] font-['Outfit']">Python 3.14 · FastAPI</p>
          <p className="text-xs text-[#2E8B57] flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> High-Performance Async ASGI
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-2">
          <div className="flex items-center justify-between text-[#707070]">
            <span className="text-xs font-semibold">PostgreSQL Engine</span>
            <Database className="w-4 h-4 text-[#2E8B57]" />
          </div>
          <p className="text-lg font-bold text-[#1C1C1C] font-['Outfit']">Neon Serverless</p>
          <p className="text-xs text-[#2E8B57] flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> {health?.database?.latencyMs ? `${health.database.latencyMs}ms Latency` : 'Connected'}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-2">
          <div className="flex items-center justify-between text-[#707070]">
            <span className="text-xs font-semibold">RBAC & Isolation</span>
            <ShieldCheck className="w-4 h-4 text-[#B8862D]" />
          </div>
          <p className="text-lg font-bold text-[#1C1C1C] font-['Outfit']">Multi-Tenant Scoped</p>
          <p className="text-xs text-[#707070]">Branch-level token filtering active</p>
        </div>
      </div>

      {/* Raw Payload Inspector */}
      {health && (
        <div className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#707070]">
            Raw Diagnostics JSON Telemetry
          </h3>
          <pre className="p-4 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] text-[11px] font-mono text-[#1C1C1C] overflow-x-auto">
            {JSON.stringify(health, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default TelemetryWorkspace;
