'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, RefreshCw, Save, Lock, Clock3 } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useOutlet } from '@/context/OutletContext';
import { useAuth } from '@/context/AuthContext';
import { Badge, EmptyState } from '@/components/ui';

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const money = (v: any) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const qty = (v: any) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });

export default function ClosingWorkspace() {
  const { activeOutlet, isHeadOffice } = useOutlet();
  const { user } = useAuth();

  const branchId = activeOutlet?.id;
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [periodType, setPeriodType] = useState<'FIRST_HALF' | 'SECOND_HALF'>(today.getDate() <= 15 ? 'FIRST_HALF' : 'SECOND_HALF');

  const [draft, setDraft] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [physical, setPhysical] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const periodLabel = periodType === 'FIRST_HALF' ? '1 – 15' : `16 – ${new Date(year, month, 0).getDate()}`;

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    setMessage(null);
    try {
      const [draftRes, historyRes] = await Promise.all([
        apiClient.get(`/procurement/closings/active/${branchId}`, {
          params: { year, month, period_type: periodType },
        }),
        apiClient.get('/procurement/closings', {
          params: { branch_id: branchId, year, month },
        }),
      ]);

      const nextDraft = draftRes.data?.data ?? draftRes.data;
      const nextHistory = historyRes.data?.data ?? historyRes.data ?? [];
      setDraft(nextDraft);
      setHistory(Array.isArray(nextHistory) ? nextHistory : []);

      const initial: Record<string, string> = {};
      for (const item of nextDraft?.items || []) {
        initial[String(item.item_id)] = String(item.physical_closing_qty ?? '');
      }
      setPhysical(initial);
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Closing data load failed.' });
    } finally {
      setLoading(false);
    }
  }, [branchId, year, month, periodType]);

  useEffect(() => { load(); }, [load]);

  const canSubmit = Boolean(branchId && draft?.items?.length && Object.values(physical).some((v) => Number(v) >= 0));

  const submit = async () => {
    if (!branchId || !draft?.items?.length) return;
    setSaving(true);
    setMessage(null);
    try {
      const items = (draft.items || []).map((item: any) => ({
        item_id: item.item_id,
        physical_closing_qty: Number(physical[String(item.item_id)] || 0),
        notes: undefined,
      }));

      await apiClient.post('/procurement/closings/submit', {
        branch_id: branchId,
        year,
        month,
        period_type: periodType,
        notes: notes.trim() || undefined,
        items,
      });

      setMessage({ type: 'success', text: 'Closing submitted successfully. It is now recorded for this period.' });
      await load();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Closing submission failed.' });
    } finally {
      setSaving(false);
    }
  };

  const summary = useMemo(() => ({
    opening: draft?.opening_valuation || 0,
    purchases: draft?.total_purchases || 0,
    items: draft?.items?.length || 0,
  }), [draft]);

  if (!branchId && !isHeadOffice) {
    return <EmptyState title="Select your outlet" description="Closing can only be submitted inside an authorized outlet scope." />;
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#1C1C1C]">OUTLET CLOSING</h2>
          <p className="text-xs text-[#707070] mt-1">Two closing periods are maintained separately and remain available in history.</p>
        </div>
        <button onClick={load} disabled={loading} className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-bold flex items-center gap-2 disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {message && (
        <div className={`rounded-xl px-4 py-3 text-xs font-semibold ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#707070] mb-1">Month</label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-full p-2.5 rounded-xl border border-gray-200 bg-[#FAF8F5] text-sm">
              {monthNames.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#707070] mb-1">Year</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setYear((y) => y - 1)}
                className="h-10 w-10 shrink-0 rounded-xl border border-gray-200 bg-white text-lg font-bold text-[#555] hover:bg-[#FAF8F5]"
                aria-label="Previous year"
              >
                −
              </button>
              <input
                type="number"
                inputMode="numeric"
                value={year}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (Number.isInteger(next) && next >= 1 && next <= 9999) setYear(next);
                }}
                className="w-full min-w-0 p-2.5 rounded-xl border border-gray-200 bg-[#FAF8F5] text-sm text-center font-bold"
                aria-label="Closing year"
              />
              <button
                type="button"
                onClick={() => setYear((y) => y + 1)}
                className="h-10 w-10 shrink-0 rounded-xl border border-gray-200 bg-white text-lg font-bold text-[#555] hover:bg-[#FAF8F5]"
                aria-label="Next year"
              >
                +
              </button>
            </div>
            <p className="mt-1 text-[10px] text-[#999]">Year changes dynamically — no fixed year list.</p>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#707070] mb-1">Closing Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setPeriodType('FIRST_HALF')} className={`p-2.5 rounded-xl border text-xs font-bold ${periodType === 'FIRST_HALF' ? 'bg-[#F1E4C5] border-[#B8862D]/40 text-[#7A5B17]' : 'bg-white border-gray-200 text-gray-600'}`}>
                Mid Month<br /><span className="font-medium">1 – 15</span>
              </button>
              <button onClick={() => setPeriodType('SECOND_HALF')} className={`p-2.5 rounded-xl border text-xs font-bold ${periodType === 'SECOND_HALF' ? 'bg-[#F1E4C5] border-[#B8862D]/40 text-[#7A5B17]' : 'bg-white border-gray-200 text-gray-600'}`}>
                Month End<br /><span className="font-medium">16 – {new Date(year, month, 0).getDate()}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="warning" icon={<CalendarDays className="w-3 h-3" />}>{monthNames[month - 1]} {year}</Badge>
          <Badge variant="outlet" icon={<Clock3 className="w-3 h-3" />}>{periodLabel}</Badge>
          <span className="text-[#777]">Status: <b className="text-[#1C1C1C]">{draft?.status || 'DRAFT'}</b></span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="rounded-xl bg-[#FAF8F5] p-3"><div className="text-[10px] uppercase tracking-wider text-[#777]">Opening</div><div className="mt-1 font-bold">{money(summary.opening)}</div></div>
          <div className="rounded-xl bg-[#FAF8F5] p-3"><div className="text-[10px] uppercase tracking-wider text-[#777]">Received Purchase</div><div className="mt-1 font-bold">{money(summary.purchases)}</div></div>
          <div className="rounded-xl bg-[#FAF8F5] p-3"><div className="text-[10px] uppercase tracking-wider text-[#777]">Items</div><div className="mt-1 font-bold">{summary.items}</div></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div><div className="font-bold text-sm">Physical Stock Count</div><div className="text-[11px] text-[#777]">Enter the actual closing quantity for each item.</div></div>
          <Lock className="w-4 h-4 text-[#B8862D]" />
        </div>
        {loading ? (
          <div className="p-10 text-center text-sm text-[#777]">Loading closing draft…</div>
        ) : !draft?.items?.length ? (
          <div className="p-10 text-center text-sm text-[#777]">No items found for this closing period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#FAF8F5] text-[#777]"><tr><th className="px-4 py-3 text-left">Item</th><th className="px-4 py-3 text-right">System Qty</th><th className="px-4 py-3">Unit</th><th className="px-4 py-3 text-right">Physical Closing</th><th className="px-4 py-3 text-right">Value</th></tr></thead>
              <tbody>
                {draft.items.map((item: any) => {
                  const value = Number(physical[String(item.item_id)] || 0) * Number(item.unit_cost || 0);
                  return (
                    <tr key={item.item_id} className="border-t border-gray-100">
                      <td className="px-4 py-3"><div className="font-semibold text-[#1C1C1C]">{item.item_name}</div><div className="text-[10px] text-[#888]">{item.item_code}</div></td>
                      <td className="px-4 py-3 text-right font-mono">{qty(item.physical_closing_qty)}</td>
                      <td className="px-4 py-3">{item.unit_symbol || 'UNIT'}</td>
                      <td className="px-4 py-3 text-right"><input type="number" min="0" step="0.001" value={physical[String(item.item_id)] ?? ''} onChange={(e) => setPhysical((prev) => ({ ...prev, [String(item.item_id)]: e.target.value }))} className="w-28 ml-auto p-2 rounded-lg border border-gray-200 bg-[#FAF8F5] text-right font-mono" /></td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">{money(value)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="p-4 border-t border-gray-100">
          <label className="block text-[11px] font-semibold text-[#707070] mb-1">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional closing remarks…" className="w-full p-2.5 rounded-xl border border-gray-200 bg-[#FAF8F5] text-xs" />
        </div>
        <div className="p-4 flex justify-end">
          <button onClick={submit} disabled={saving || !canSubmit} className="px-4 py-2.5 rounded-xl bg-[#1C1C1C] text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50">
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Submit Closing
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between"><div className="font-bold text-sm">Closing History</div><CheckCircle2 className="w-4 h-4 text-green-600" /></div>
        {history.length === 0 ? <div className="p-8 text-center text-xs text-[#777]">No closing record for this month.</div> : (
          <div className="divide-y divide-gray-100">
            {history.map((r: any) => (
              <div key={r.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div><div className="font-semibold text-xs">{String(r.period_type).replace('_', ' ')}</div><div className="text-[10px] text-[#777]">{r.start_date?.slice(0,10)} → {r.end_date?.slice(0,10)}</div></div>
                <div className="text-right"><div className="font-mono font-semibold">{money(r.closing_physical_valuation)}</div><div className="text-[10px] text-[#777]">{r.status}</div></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
