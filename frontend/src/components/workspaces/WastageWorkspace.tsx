'use client';

import React from 'react';
import { useOutlet } from '@/context/OutletContext';
import {
  AlertTriangle,
  Trash2,
  CheckCircle2,
  Layers,
  Search,
  ShieldCheck,
} from 'lucide-react';

export const WastageWorkspace: React.FC = () => {
  const { activeOutlet } = useOutlet();

  const wastageCategories = [
    { name: 'Kitchen Preparation Loss', count: 'Standard (2-4%)', impact: 'Controlled' },
    { name: 'Expired / Spoilage', count: 'Strict Audit', impact: 'Monitored' },
    { name: 'Customer Return / Error', count: 'Manager Sign-off Required', impact: 'Low' },
    { name: 'Storage Spoilage', count: 'Warehouse Audit', impact: 'Protected' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#D9534F]" />
              Wastage & Food Loss Management
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF8F5] text-[#B8862D] font-bold border border-[rgba(45,45,45,0.1)]">
              [{activeOutlet.code}]
            </span>
          </div>
          <p className="text-xs text-[#707070] mt-0.5">
            Log and approve kitchen spoilage, prep discard, and inventory adjustments with mandatory reason codes.
          </p>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {wastageCategories.map((cat) => (
          <div key={cat.name} className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-2">
            <div className="flex items-center justify-between text-[#707070]">
              <span className="text-xs font-semibold">{cat.name}</span>
              <Trash2 className="w-4 h-4 text-[#D9534F]" />
            </div>
            <p className="text-sm font-bold text-[#1C1C1C]">{cat.count}</p>
            <p className="text-[10px] text-[#2E8B57] font-semibold">{cat.impact}</p>
          </div>
        ))}
      </div>

      {/* Control Policy */}
      <div className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] space-y-3 shadow-sm text-xs text-[#707070]">
        <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#C79A3B]" />
          Wastage Approval & Audit Rules
        </h3>
        <p>
          Any wastage record exceeding $50.00 valuation requires Head Office / Central Manager authorization. All wastage logs are reconciled during the bi-monthly closing audit.
        </p>
      </div>
    </div>
  );
};

export default WastageWorkspace;
