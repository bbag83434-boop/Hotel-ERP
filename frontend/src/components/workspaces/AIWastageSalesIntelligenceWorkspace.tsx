'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, RefreshCw, TrendingDown, TrendingUp, Clock, Trash2 } from 'lucide-react';
import { useOutlet } from '@/context/OutletContext';
import { aiIntelligenceApi, WastageSalesIntelligence } from '@/api/aiIntelligence';
import { Badge, Button, EmptyState, StatCard } from '@/components/ui';

const money = (v: number) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const pct = (v: number | null) => v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

export default function AIWastageSalesIntelligenceWorkspace() {
  const { activeOutlet } = useOutlet();
  const [data, setData] = useState<WastageSalesIntelligence | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await aiIntelligenceApi.getWastageSales(days)); }
    catch (e: any) { setError(e?.response?.data?.detail || e?.message || 'Unable to load AI intelligence.'); }
    finally { setLoading(false); }
  }, [days]);

  useEffect(() => { load(); }, [load, activeOutlet.id]);

  if (loading && !data) return <div className="space-y-4"><div className="h-8 w-64 rounded-xl bg-[#FAF8F5] animate-pulse"/><div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[1,2,3,4].map(x => <div key={x} className="h-24 rounded-2xl bg-[#FAF8F5] animate-pulse"/>)}</div></div>;
  if (error && !data) return <EmptyState title="Intelligence unavailable" description={error}/>;
  if (!data) return <EmptyState title="No intelligence data" description="No stored sales or approved wastage data is available for this outlet."/>;

  return <div className="space-y-5">
    <div className="flex items-start justify-between gap-3">
      <div><div className="flex items-center gap-2"><BarChart3 className="w-5 h-5 text-[#B8862D]"/><h1 className="text-xl font-bold">AI Wastage & Sales Intelligence</h1></div><p className="text-sm text-[#707070] mt-1">Deterministic insights from stored outlet data — no invented figures.</p></div>
      <div className="flex items-center gap-2"><select value={days} onChange={e => setDays(Number(e.target.value))} className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs"><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select><Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}/></Button></div>
    </div>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard title="Sales" value={money(data.sales.revenue)} icon={<TrendingUp className="w-4 h-4"/>}/>
      <StatCard title="Orders" value={String(data.sales.orders)} icon={<BarChart3 className="w-4 h-4"/>}/>
      <StatCard title="Average Bill" value={money(data.sales.average_bill)} icon={<TrendingUp className="w-4 h-4"/>}/>
      <StatCard title="Approved Wastage" value={money(data.wastage.cost)} icon={<Trash2 className="w-4 h-4"/>}/>
    </div>

    <div className="grid lg:grid-cols-2 gap-4">
      <section className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm"><div className="flex justify-between items-center mb-3"><div><h2 className="font-bold">Sales Signals</h2><p className="text-xs text-[#707070]">Period-over-period and product performance</p></div><Badge>{pct(data.sales.change_percentage)}</Badge></div>
        <div className="grid grid-cols-2 gap-2 mb-4"><div className="rounded-xl bg-[#FAF8F5] p-3"><div className="text-[10px] text-[#707070]">Previous Sales</div><b>{money(data.sales.previous_revenue)}</b></div><div className="rounded-xl bg-[#FAF8F5] p-3"><div className="text-[10px] text-[#707070]">Peak Hour</div><b>{data.sales.peak_hours[0] ? `${String(data.sales.peak_hours[0].hour).padStart(2,'0')}:00` : '—'}</b></div></div>
        <h3 className="text-xs font-bold mb-2">Top Selling</h3>{data.sales.top_products.length ? <div className="space-y-2">{data.sales.top_products.slice(0,5).map(x => <div key={x.item_id} className="flex justify-between text-xs"><span className="truncate pr-3">{x.item_name}</span><b>{money(x.revenue)}</b></div>)}</div> : <p className="text-xs text-[#707070]">No completed sales.</p>}
      </section>
      <section className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm"><div className="flex justify-between items-center mb-3"><div><h2 className="font-bold">Wastage Intelligence</h2><p className="text-xs text-[#707070]">Approved wastage only</p></div><Badge>{pct(data.wastage.change_percentage)}</Badge></div>
        <div className="grid grid-cols-2 gap-2 mb-4"><div className="rounded-xl bg-[#FAF8F5] p-3"><div className="text-[10px] text-[#707070]">Wastage / Sales</div><b>{data.wastage.cost_as_percent_of_sales.toFixed(2)}%</b></div><div className="rounded-xl bg-[#FAF8F5] p-3"><div className="text-[10px] text-[#707070]">Previous Wastage</div><b>{money(data.wastage.previous_cost)}</b></div></div>
        <h3 className="text-xs font-bold mb-2">Highest Loss Items</h3>{data.wastage.top_items.length ? <div className="space-y-2">{data.wastage.top_items.slice(0,5).map(x => <div key={x.item_id} className="flex justify-between text-xs"><span className="truncate pr-3">{x.item_name}</span><b>{money(x.cost)}</b></div>)}</div> : <p className="text-xs text-[#707070]">No approved wastage.</p>}
      </section>
    </div>

    <section className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm"><div className="flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4 text-[#B8862D]"/><h2 className="font-bold">Management Signals</h2></div><div className="space-y-2">{data.signals.map((s,i) => <div key={`${s.type}-${i}`} className="rounded-xl bg-[#FAF8F5] p-3 flex gap-3"><span className="text-[10px] font-bold mt-0.5">{s.severity}</span><span className="text-xs">{s.message}</span></div>)}</div></section>
    <div className="text-[10px] text-[#8A8A8A] flex items-center gap-1"><Clock className="w-3 h-3"/> Source: {data.source} · {data.period.start} to {data.period.end} · {activeOutlet.name}</div>
  </div>;
}
