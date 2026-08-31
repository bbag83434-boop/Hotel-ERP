'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, PackageSearch, RefreshCw, ShoppingCart, Truck } from 'lucide-react';
import { procurementApi } from '@/api/procurement';

interface Props { branchId: string; branchName?: string; }

export default function SmartInventoryIntelligencePanel({ branchId, branchName }: Props) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!branchId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await procurementApi.getSmartInventoryIntelligence(branchId));
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.response?.data?.message || e?.message || 'Unable to load inventory intelligence.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [branchId]);

  const summary = data?.summary || {};
  const recommendations = data?.recommendations || [];

  return (
    <section className="rounded-2xl border border-[#C79A3B]/25 bg-white shadow-sm overflow-hidden">
      <div className="p-5 border-b border-[rgba(45,45,45,0.06)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#F1E4C5] text-[#B8862D] flex items-center justify-center">
            <PackageSearch className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#1C1C1C]">Smart Inventory / Purchase Intelligence</h4>
            <p className="text-[11px] text-[#707070]">Deterministic replenishment analysis for {branchName || 'this outlet'}</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold text-[#1C1C1C]">
          <RefreshCw className={`w-3.5 h-3.5 text-[#C79A3B] ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && <div className="m-4 p-3 rounded-xl bg-red-50 text-red-700 text-xs font-semibold">{error}</div>}

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            ['Monitored', summary.monitored_items ?? 0, 'text-[#1C1C1C]'],
            ['Actionable', summary.actionable_items ?? 0, 'text-blue-700'],
            ['Critical', summary.critical_items ?? 0, 'text-red-600'],
            ['High', summary.high_priority_items ?? 0, 'text-amber-700'],
            ['Est. Value', Number(summary.estimated_purchase_value || 0).toFixed(2), 'text-[#2E8B57]'],
          ].map(([label, value, cls]) => (
            <div key={String(label)} className="p-3 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] text-center">
              <span className="block text-[10px] text-[#707070]">{label}</span>
              <span className={`font-bold text-sm ${cls}`}>{value}</span>
            </div>
          ))}
        </div>

        {loading && !data ? (
          <div className="py-8 text-center text-xs text-[#707070]">Calculating stock coverage and purchase requirements…</div>
        ) : recommendations.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#707070]">No replenishment action is currently recommended.</div>
        ) : (
          <div className="space-y-2">
            {recommendations.slice(0, 12).map((item: any) => (
              <div key={item.item_id} className="p-3 rounded-xl border border-[rgba(45,45,45,0.08)] flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[#1C1C1C] truncate">{item.item_name}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${item.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' : item.priority === 'HIGH' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-700'}`}>{item.priority}</span>
                  </div>
                  <div className="mt-1 text-[10px] text-[#707070]">
                    Stock {Number(item.current_stock).toFixed(2)} {item.unit_symbol} · Cover {item.days_of_cover == null ? '—' : `${item.days_of_cover}d`} · Pending {Number(item.pending_incoming).toFixed(2)}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right shrink-0">
                  <div><span className="block text-[9px] text-[#707070]">Order</span><span className="font-bold text-xs text-[#1C1C1C]">{Number(item.recommended_order_qty).toFixed(2)} {item.unit_symbol}</span></div>
                  <div><span className="block text-[9px] text-[#707070]">Supplier</span><span className="font-semibold text-xs text-[#1C1C1C]">{item.supplier_name || 'Not mapped'}</span></div>
                  {item.supplier_lead_time_days != null && <Truck className="w-4 h-4 text-[#C79A3B]" />}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 p-3 rounded-xl bg-[#FAF8F5] text-[10px] text-[#707070]">
          <AlertTriangle className="w-4 h-4 text-[#C79A3B] shrink-0" />
          Recommendations are read-only. Confirmation continues through the existing Purchase Request → approval workflow.
          <ShoppingCart className="w-4 h-4 text-[#C79A3B] ml-auto shrink-0" />
        </div>
      </div>
    </section>
  );
}
