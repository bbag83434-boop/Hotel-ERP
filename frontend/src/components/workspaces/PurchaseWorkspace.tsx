'use client';

import React, { useState } from 'react';
import { useOutlet } from '@/context/OutletContext';
import {
  ShoppingCart,
  Truck,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  Building2,
  Clock,
  ShieldCheck,
} from 'lucide-react';

export const PurchaseWorkspace: React.FC = () => {
  const { activeOutlet, isHeadOffice } = useOutlet();
  const [subTab, setSubTab] = useState<'flow' | 'requests' | 'orders'>('flow');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-[#C79A3B]" />
              Central Purchase & Direct Supplier Fulfillment
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF8F5] text-[#B8862D] font-bold border border-[rgba(45,45,45,0.1)]">
              [{activeOutlet.code}]
            </span>
          </div>
          <p className="text-xs text-[#707070] mt-0.5">
            Head Office centralized review issuing purchase orders for direct destination delivery to retail outlets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSubTab('flow')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              subTab === 'flow'
                ? 'bg-[#F1E4C5] text-[#B8862D] border-[#B8862D]/30'
                : 'bg-white text-[#707070] border-[rgba(45,45,45,0.12)] hover:bg-[#FAF8F5]'
            }`}
          >
            4-Step Flow
          </button>
          <button
            onClick={() => setSubTab('requests')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              subTab === 'requests'
                ? 'bg-[#F1E4C5] text-[#B8862D] border-[#B8862D]/30'
                : 'bg-white text-[#707070] border-[rgba(45,45,45,0.12)] hover:bg-[#FAF8F5]'
            }`}
          >
            Purchase Requests
          </button>
        </div>
      </div>

      {/* 4-Step Direct Purchase Engine */}
      <div className="luxury-card p-6 space-y-6 bg-white border border-[rgba(45,45,45,0.08)] shadow-sm">
        <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
          <Truck className="w-4 h-4 text-[#C79A3B]" />
          Direct Destination Purchase Lifecycle
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] space-y-2">
            <div className="w-7 h-7 rounded-full bg-[#F1E4C5] text-[#B8862D] font-bold flex items-center justify-center text-xs border border-[#B8862D]/30">
              1
            </div>
            <h4 className="font-bold text-sm text-[#1C1C1C]">1. Outlet PR Draft</h4>
            <p className="text-xs text-[#707070]">
              Outlet manager drafts purchase request based on minimum reorder levels and immediate pantry requirements.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] space-y-2">
            <div className="w-7 h-7 rounded-full bg-[#F1E4C5] text-[#B8862D] font-bold flex items-center justify-center text-xs border border-[#B8862D]/30">
              2
            </div>
            <h4 className="font-bold text-sm text-[#1C1C1C]">2. Central Approval</h4>
            <p className="text-xs text-[#707070]">
              Head Office Central Purchase team reviews, verifies supplier contract pricing, and approves the order.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] space-y-2">
            <div className="w-7 h-7 rounded-full bg-[#F1E4C5] text-[#B8862D] font-bold flex items-center justify-center text-xs border border-[#B8862D]/30">
              3
            </div>
            <h4 className="font-bold text-sm text-[#1C1C1C]">3. Direct Supplier PO</h4>
            <p className="text-xs text-[#707070]">
              System issues official PO directly to external vendor specifying the destination outlet delivery address.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#2E8B57]/20 space-y-2">
            <div className="w-7 h-7 rounded-full bg-[#2E8B57]/15 text-[#2E8B57] font-bold flex items-center justify-center text-xs border border-[#2E8B57]/30">
              4
            </div>
            <h4 className="font-bold text-sm text-[#1C1C1C]">4. Destination GRN</h4>
            <p className="text-xs text-[#707070]">
              Outlet storekeeper conducts physical quality check and receives stock directly into local inventory ledger.
            </p>
          </div>
        </div>
      </div>

      {/* Operational Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#707070]">
        <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] space-y-1.5 shadow-sm">
          <span className="font-bold text-[#1C1C1C] text-sm flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-[#2E8B57]" />
            Zero Double-Handling
          </span>
          <p>
            Suppliers deliver perishable dairy, vegetables, and meat directly to the target restaurant outlet. Stock increases immediately at the destination branch.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] space-y-1.5 shadow-sm">
          <span className="font-bold text-[#1C1C1C] text-sm flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#C79A3B]" />
            Deterministic Financial Arithmetic
          </span>
          <p>
            Line items, taxes, discounts, and payable totals are computed deterministically in PostgreSQL with exact Decimal(14,2) precision.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PurchaseWorkspace;
