'use client';

import React from 'react';
import { useOutlet } from '@/context/OutletContext';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  PieChart,
  Calendar,
  CheckCircle2,
  Building2,
} from 'lucide-react';

export const ReportsWorkspace: React.FC = () => {
  const { activeOutlet, isHeadOffice, outlets } = useOutlet();

  const kpis = [
    { title: 'Target Food Cost', value: '28.5%', sub: 'Budget benchmark', color: 'text-[#2E8B57]' },
    { title: 'Beverage Cost Target', value: '19.0%', sub: 'Liquor & cocktails', color: 'text-[#3978B8]' },
    { title: 'Target Labour Cost', value: '22.0%', sub: 'Kitchen & floor roster', color: 'text-[#B8862D]' },
    { title: 'Gross Profit Target', value: '68.5%', sub: 'Prime margin target', color: 'text-[#1C1C1C]' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#C79A3B]" />
              Financial & Cost Control Intelligence
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF8F5] text-[#B8862D] font-bold border border-[rgba(45,45,45,0.1)]">
              [{activeOutlet.code}]
            </span>
          </div>
          <p className="text-xs text-[#707070] mt-0.5">
            Consolidated 14-outlet sales analytics, food cost variance reports, and margin tracking.
          </p>
        </div>
      </div>

      {/* Target KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.title} className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-1">
            <span className="text-xs font-semibold text-[#707070]">{k.title}</span>
            <p className={`text-2xl font-bold font-['Outfit'] ${k.color}`}>{k.value}</p>
            <p className="text-[10px] text-[#707070]">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Multi-Outlet Performance Overview */}
      <div className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] space-y-4 shadow-sm">
        <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#C79A3B]" />
          14-Outlet Performance Scope ({outlets.length} Units Active)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {outlets.map((o) => (
            <div key={o.id} className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-[#1C1C1C] truncate">{o.name}</span>
                <span className="text-[9px] font-mono font-bold text-[#B8862D]">[{o.code}]</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#707070] pt-1 border-t border-[rgba(45,45,45,0.06)]">
                <span>Type: {o.type.replace('_', ' ')}</span>
                <span className="text-[#2E8B57] font-semibold">Active Scoped</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReportsWorkspace;
