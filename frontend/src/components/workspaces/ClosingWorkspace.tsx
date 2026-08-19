'use client';

import React from 'react';
import { useOutlet } from '@/context/OutletContext';
import {
  CalendarDays,
  CalendarCheck,
  CheckCircle2,
  AlertCircle,
  Calculator,
  ShieldCheck,
  Percent,
} from 'lucide-react';

export const ClosingWorkspace: React.FC = () => {
  const { activeOutlet, closingInfo } = useOutlet();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-[#C79A3B]" />
              Bi-Monthly Closing Engine (1st–15th & 16th–MonthEnd)
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF8F5] text-[#B8862D] font-bold border border-[rgba(45,45,45,0.1)]">
              [{activeOutlet.code}]
            </span>
          </div>
          <p className="text-xs text-[#707070] mt-0.5">
            Strict physical stock reconciliation calculating actual vs. theoretical consumption and food cost variances.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-[#F1E4C5] text-xs font-bold text-[#B8862D] border border-[#B8862D]/30">
            Active Cycle: {closingInfo.periodType === 'FIRST_HALF' ? '1st–15th' : '16th–End'}
          </div>
        </div>
      </div>

      {/* Cycle Period Info Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-white via-[#FAF8F5] to-white border border-[rgba(45,45,45,0.08)] shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <span className="text-xs text-[#707070] font-semibold uppercase tracking-wider">Accounting Period Range</span>
          <p className="text-lg font-bold text-[#1C1C1C] font-['Outfit']">
            {closingInfo.label} ({closingInfo.startDate.slice(0, 10)} to {closingInfo.endDate.slice(0, 10)})
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-white border border-[rgba(45,45,45,0.08)] text-center">
            <span className="text-[10px] text-[#707070] block">Days Remaining</span>
            <span className="text-xl font-bold text-[#B8862D] font-['Outfit']">{closingInfo.daysRemaining}</span>
          </div>
          <div className="p-3 rounded-xl bg-white border border-[rgba(45,45,45,0.08)] text-center">
            <span className="text-[10px] text-[#707070] block">Audit Status</span>
            <span className="text-xs font-bold text-[#2E8B57] flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> OPEN
            </span>
          </div>
        </div>
      </div>

      {/* Core Mathematical Formulas (Deterministic Engine) */}
      <div className="p-6 rounded-2xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)] space-y-4 font-mono text-xs shadow-inner">
        <div className="flex items-center gap-2 font-sans font-bold text-sm text-[#1C1C1C]">
          <Calculator className="w-4 h-4 text-[#C79A3B]" />
          <span>Core Food Cost & Consumption Formulas:</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-[rgba(45,45,45,0.08)] space-y-1 text-[#2E8B57] font-semibold">
          <div className="text-[10px] text-[#707070] font-sans">Formula 1: Actual Consumption Valuation</div>
          <div>Actual Consumption = Opening Physical Stock + Purchases in Period - Closing Physical Count</div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-[rgba(45,45,45,0.08)] space-y-1 text-[#B8862D] font-semibold">
          <div className="text-[10px] text-[#707070] font-sans">Formula 2: Variance Valuation ($)</div>
          <div>Variance Amount = Actual Consumption - Theoretical Consumption (POS Sales & Recipes)</div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-[rgba(45,45,45,0.08)] space-y-1 text-[#3978B8] font-semibold">
          <div className="text-[10px] text-[#707070] font-sans">Formula 3: Food Cost Percentage (%)</div>
          <div>Food Cost % = (Actual Consumption Cost / Total Food Sales Revenue) × 100%</div>
        </div>
      </div>

      {/* Security & Audit Note */}
      <div className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] space-y-2 shadow-sm text-xs text-[#707070]">
        <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#2E8B57]" />
          Immutable Closing Snapshots
        </h3>
        <p>
          Once a bi-monthly period is closed and signed off by the General Manager and Finance Auditor, closing stock valuations and variance records become immutable.
        </p>
      </div>
    </div>
  );
};

export default ClosingWorkspace;
