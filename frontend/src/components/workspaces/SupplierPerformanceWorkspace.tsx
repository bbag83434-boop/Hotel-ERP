'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, RefreshCw, Truck, Clock3, PackageCheck, AlertTriangle, WalletCards } from 'lucide-react';
import { supplierPerformanceApi, SupplierPerformanceRow } from '@/api/supplierPerformance';
import { useOutlet } from '@/context/OutletContext';
import { Button, EmptyState, StatCard } from '@/components/ui';

const money = (v:number) => `₹${Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:0})}`;
const pct = (v:number) => `${Number(v||0).toFixed(1)}%`;

export default function SupplierPerformanceWorkspace() {
  const { activeOutlet, isHeadOffice } = useOutlet();
  const [rows,setRows]=useState<SupplierPerformanceRow[]>([]); const [days,setDays]=useState(90); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null);
  const load=useCallback(async()=>{setLoading(true);setError(null);try{const d=await supplierPerformanceApi.get({days, branch_id:isHeadOffice?undefined:activeOutlet.id});setRows(d.suppliers||[]);}catch(e:any){setError(e?.response?.data?.detail||e?.message||'Unable to load supplier performance.');}finally{setLoading(false);}},[days,isHeadOffice,activeOutlet.id]);
  useEffect(()=>{load();},[load]);
  const summary=useMemo(()=>({spend:rows.reduce((a,r)=>a+r.purchase_spend,0),outstanding:rows.reduce((a,r)=>a+r.outstanding_amount,0),onTime:rows.length?rows.reduce((a,r)=>a+r.on_time_delivery_percent,0)/rows.length:0,fulfillment:rows.length?rows.reduce((a,r)=>a+r.fulfillment_percent,0)/rows.length:0,quality:rows.length?rows.reduce((a,r)=>a+r.quality_issue_percent,0)/rows.length:0}),[rows]);
  return <div className="space-y-5">
    <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><BarChart3 className="w-5 h-5 text-[#B8862D]"/><h1 className="text-xl font-bold">Supplier Performance</h1></div><p className="text-sm text-[#707070] mt-1">Live procurement intelligence from PO, GRN, bill and payment records.</p></div><div className="flex gap-2"><select className="border rounded-xl px-3 py-2 text-sm bg-white" value={days} onChange={e=>setDays(Number(e.target.value))}><option value={30}>30 days</option><option value={90}>90 days</option><option value={180}>180 days</option><option value={365}>1 year</option></select><Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/></Button></div></div>
    {error&&<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3"><StatCard title="Purchase Spend" value={money(summary.spend)} icon={<Truck className="w-4 h-4"/>}/><StatCard title="On-Time Delivery" value={pct(summary.onTime)} icon={<Clock3 className="w-4 h-4"/>}/><StatCard title="Fulfillment" value={pct(summary.fulfillment)} icon={<PackageCheck className="w-4 h-4"/>}/><StatCard title="Quality Issues" value={pct(summary.quality)} icon={<AlertTriangle className="w-4 h-4"/>}/><StatCard title="Outstanding" value={money(summary.outstanding)} icon={<WalletCards className="w-4 h-4"/>}/></div>
    {loading?<div className="h-64 rounded-2xl bg-[#FAF8F5] animate-pulse"/>:rows.length===0?<EmptyState title="No supplier transactions" description={`No procurement records were found for the selected ${days}-day window.`}/>:<section className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm overflow-x-auto"><div className="min-w-[900px]"><div className="grid grid-cols-[1.5fr_.7fr_1fr_1fr_1fr_1fr_1fr] gap-3 px-3 pb-2 text-[10px] uppercase tracking-wider text-[#707070] font-bold"><span>Supplier</span><span>Rating</span><span>Spend</span><span>On-Time</span><span>Fulfillment</span><span>Quality</span><span>Outstanding</span></div><div className="space-y-2">{rows.map((r,i)=><div key={r.supplier_id} className="grid grid-cols-[1.5fr_.7fr_1fr_1fr_1fr_1fr_1fr] items-center gap-3 rounded-xl bg-[#FAF8F5] p-3 text-sm"><div><div className="font-semibold">{i+1}. {r.supplier_name}</div><div className="text-[10px] text-[#707070]">{r.supplier_code} · {r.po_count} POs · {r.bill_count} bills</div></div><b>{r.rating.toFixed(1)}</b><span>{money(r.purchase_spend)}</span><span>{pct(r.on_time_delivery_percent)}</span><span>{pct(r.fulfillment_percent)}</span><span>{pct(r.quality_issue_percent)}</span><span className="font-semibold">{money(r.outstanding_amount)}</span></div>)}</div></div></section>}
    <div className="text-[11px] text-[#707070]">Scope: {isHeadOffice?'Head Office / all authorized outlets':'Outlet: '+activeOutlet.name}. No synthetic supplier data is used.</div>
  </div>;
}
