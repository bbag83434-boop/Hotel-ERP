"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChefHat, Clock3, RefreshCw, CheckCircle2, PlayCircle, Send, UtensilsCrossed, XCircle } from 'lucide-react';
import { useOutlet } from '@/context/OutletContext';
import { ordersApi } from '@/api/orders';
import Button from '@/components/ui/Button';

const nextStatus: Record<string, { label: string; value: string; icon: React.ReactNode }> = {
  OPEN: { label: 'Send to Kitchen', value: 'SENT_TO_KITCHEN', icon: <Send className="w-4 h-4" /> },
  SENT_TO_KITCHEN: { label: 'Start Preparing', value: 'IN_PREPARATION', icon: <PlayCircle className="w-4 h-4" /> },
  IN_PREPARATION: { label: 'Mark Ready', value: 'READY', icon: <CheckCircle2 className="w-4 h-4" /> },
  READY: { label: 'Mark Served', value: 'SERVED', icon: <UtensilsCrossed className="w-4 h-4" /> },
};

const statusLabel: Record<string,string> = { OPEN:'Open', SENT_TO_KITCHEN:'Queued', IN_PREPARATION:'Preparing', READY:'Ready', SERVED:'Served' };

export default function KDSWorkspace() {
  const { activeOutlet } = useOutlet();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setOrders(await ordersApi.kds(activeOutlet?.id)); }
    catch (e:any) { setError(e?.response?.data?.detail || 'Could not load kitchen orders.'); }
    finally { setLoading(false); }
  }, [activeOutlet?.id]);
  useEffect(() => { load(); const t = window.setInterval(load, 15000); return () => window.clearInterval(t); }, [load]);

  const active = useMemo(() => orders.filter(o => o.status !== 'SERVED'), [orders]);
  const counts = useMemo(() => ({ queued: active.filter(o=>o.status==='SENT_TO_KITCHEN').length, preparing: active.filter(o=>o.status==='IN_PREPARATION').length, ready: active.filter(o=>o.status==='READY').length }), [active]);

  const move = async (orderId:string, status:string) => {
    setBusy(orderId); setError('');
    try { const updated = await ordersApi.kdsStatus(orderId, status); setOrders(prev => prev.map(o => o.id === updated.id ? updated : o)); }
    catch (e:any) { setError(e?.response?.data?.detail || 'Status update failed.'); }
    finally { setBusy(''); }
  };

  return <section className="space-y-5">
    <div className="flex items-start justify-between gap-3">
      <div><div className="text-[11px] font-bold uppercase tracking-[.18em] text-[#B8862D]">Kitchen Display</div><h1 className="text-2xl font-black tracking-tight mt-1">KDS — Kitchen Queue</h1><p className="text-xs text-[#777] mt-1">Live order tickets for the active outlet. Auto-refreshes every 15 seconds.</p></div>
      <Button variant="secondary" onClick={load} loading={loading}><RefreshCw className="w-4 h-4" /></Button>
    </div>
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-2xl bg-white border border-black/5 p-3"><div className="text-[10px] text-[#777]">Queued</div><div className="text-xl font-black">{counts.queued}</div></div>
      <div className="rounded-2xl bg-white border border-black/5 p-3"><div className="text-[10px] text-[#777]">Preparing</div><div className="text-xl font-black">{counts.preparing}</div></div>
      <div className="rounded-2xl bg-white border border-black/5 p-3"><div className="text-[10px] text-[#777]">Ready</div><div className="text-xl font-black">{counts.ready}</div></div>
    </div>
    {error && <div className="rounded-xl bg-red-50 text-red-700 text-xs p-3">{error}</div>}
    {loading && !orders.length ? <div className="rounded-2xl bg-white border p-8 text-center text-xs text-[#777]">Loading kitchen queue…</div> : !active.length ? <div className="rounded-2xl bg-white border p-10 text-center"><ChefHat className="w-8 h-8 mx-auto text-[#B8862D]"/><div className="font-bold mt-2">Kitchen queue is clear</div><div className="text-xs text-[#777] mt-1">New orders will appear automatically.</div></div> :
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{active.map(o => <article key={o.id} className="rounded-2xl bg-white border border-black/5 shadow-sm overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between"><div><div className="font-black text-lg">{o.order_number}</div><div className="text-[10px] text-[#777]">{o.source} · {o.customer_name || 'Walk-in'}</div></div><span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[#F5F3EE]">{statusLabel[o.status] || o.status}</span></div>
        <div className="p-4 space-y-2">{(o.items || []).map((i:any) => <div key={i.id} className="flex justify-between gap-3 rounded-xl bg-[#FAF8F5] p-3"><div><div className="text-xs font-bold">{i.name}</div>{i.notes && <div className="text-[10px] text-[#777]">{i.notes}</div>}</div><div className="font-black text-sm">×{i.quantity}</div></div>)}</div>
        <div className="px-4 pb-4 flex gap-2">{nextStatus[o.status] && <Button variant="gold" className="flex-1" loading={busy===o.id} onClick={()=>move(o.id,nextStatus[o.status].value)}>{nextStatus[o.status].icon}{nextStatus[o.status].label}</Button>}{!['READY','SERVED'].includes(o.status) && <button disabled={busy===o.id} onClick={()=>move(o.id,'CANCELLED')} className="w-10 rounded-xl border border-red-200 text-red-600 flex items-center justify-center"><XCircle className="w-4 h-4"/></button>}</div>
        <div className="px-4 pb-4 text-[10px] text-[#999] flex items-center gap-1"><Clock3 className="w-3 h-3"/>{new Date(o.created_at).toLocaleTimeString()}</div>
      </article>)}</div>}
  </section>;
}
