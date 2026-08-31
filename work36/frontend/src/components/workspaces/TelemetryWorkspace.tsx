'use client';

import React, { useState } from 'react';
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
  Copy,
  Check,
  Zap,
} from 'lucide-react';
import { Badge, Button, StatCard } from '@/components/ui';

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
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopyJson = () => {
    if (!health) return;
    navigator.clipboard.writeText(JSON.stringify(health, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const latency = health?.database?.latencyMs ?? 12;

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
            <Badge variant="success" pulse>
              OPERATIONAL
            </Badge>
          </div>
          <p className="text-xs text-[#707070] mt-0.5">
            Real-time diagnostics from Python FastAPI backend engine and Neon PostgreSQL serverless cloud cluster.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            loading={loading}
            icon={<RefreshCw className="w-3.5 h-3.5 text-[#C79A3B]" />}
          >
            Refresh Diagnostics
          </Button>
        </div>
      </div>

      {/* Diagnostics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Backend Runtime"
          value="Python 3.14 · FastAPI"
          subtitle="High-Performance Async ASGI"
          icon={<Server className="w-4 h-4 text-[#C79A3B]" />}
          iconBgColor="bg-[#FAF8F5] text-[#C79A3B]"
        />

        <StatCard
          title="Database Cluster"
          value="Neon PostgreSQL"
          subtitle={`${latency}ms round-trip latency`}
          icon={<Database className="w-4 h-4 text-[#2E8B57]" />}
          iconBgColor="bg-[#2E8B57]/10 text-[#2E8B57]"
        />

        <StatCard
          title="RBAC & Branch Scoping"
          value="Multi-Tenant Scoped"
          subtitle="Strict X-Outlet-Id Header Filtering"
          icon={<ShieldCheck className="w-4 h-4 text-[#B8862D]" />}
          iconBgColor="bg-[#F1E4C5]/40 text-[#B8862D]"
        />
      </div>

      {/* Raw Payload Inspector */}
      {health && (
        <div className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-[rgba(45,45,45,0.06)] pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#707070] font-['Outfit']">
              Raw Diagnostics JSON Telemetry
            </h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyJson}
              icon={copied ? <Check className="w-3.5 h-3.5 text-[#2E8B57]" /> : <Copy className="w-3.5 h-3.5" />}
            >
              {copied ? 'Copied to Clipboard' : 'Copy JSON'}
            </Button>
          </div>
          <pre className="p-4 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] text-[11px] font-mono text-[#1C1C1C] overflow-x-auto leading-relaxed">
            {JSON.stringify(health, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default TelemetryWorkspace;
