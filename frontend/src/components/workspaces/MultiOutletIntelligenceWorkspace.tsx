'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, RefreshCw, TrendingUp, ShoppingCart, Boxes, AlertTriangle, Trophy } from 'lucide-react';
import { reportsApi } from '@/api/reports';
import { organizationApi } from '@/api/organization';
import { useOutlet } from '@/context/OutletContext';
import { StatCard, Badge, Button, EmptyState } from '@/components/ui';

const money = (v:number) => `₹${Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:0})}`;

export default function MultiOutletIntelligenceWorkspace() {
  const { isHeadOffice } = useOutlet();
  const [data,setData]=useState<any>(null); const [branches,setBranches]=useState<any[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null);
  const load=useCallback(async()=>{setLoading(true);setError(null);try{const [d,b]=await Promise.all([reportsApi.getExecutiveSummary(),organizationApi.getBranches({is_active:true})]);setData(d);setBranches(b||[]);}catch(e:any){setError(e?.response?.data?.detail||e?.message||'Unable to load Head Office intelligence.');}finally{setLoading(false);}},[]);
  useEffect(()=>{if(isHeadOffice) load(); else {setLoading(false);setError('Head Office scope is required for consolidated outlet intelligence.');}},[isHeadOffice,load]);
  const ranking=useMemo(()=>data?.outletRankings||[],[data]);
  if(!isHeadOffice)return <EmptyState title="Head Office only" description={error||'Switch to Head Office scope to view consolidated outlet intelligence.'}/>;
  return <div className="space-y-5">
    <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Building2 className="w-5 h-5 text-[#B8862D]"/><h1 className="text-xl font-bold text-[#1C1C1C]">Multi-Outlet Intelligence</h1></div><p className="text-sm text-[#707070] mt-1">Consolidated business view across active outlets.</p></div><Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className={`w-4 h-4 mr-1.5 ${loading?'animate-spin':''}`}/>Refresh</Button></div>
    {error&&<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {loading?<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[1,2,3,4].map(i=><div key={i} className="h-24 rounded-2xl bg-[#FAF8F5] animate-pulse"/>)}</div>:<>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Group Revenue" value={money(data?.kpis?.revenue||data?.kpis?.totalRevenue||0)} icon={<TrendingUp className="w-4 h-4"/>}/>
        <StatCard title="Orders" value={String(data?.kpis?.orders||data?.kpis?.totalOrders||0)} icon={<ShoppingCart className="w-4 h-4"/>}/>
        <StatCard title="COGS" value={money(data?.costBreakdown?.cogs||0)} icon={<Boxes className="w-4 h-4"/>}/>
        <StatCard title="Wastage" value={money(data?.costBreakdown?.wastage||0)} icon={<AlertTriangle className="w-4 h-4"/>}/>
      </div>
      <section className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm"><div className="flex items-center justify-between mb-3"><div><h2 className="font-bold text-[#1C1C1C]">Outlet Performance</h2><p className="text-xs text-[#707070]">Live consolidated ranking from reporting APIs.</p></div><Badge>{branches.length} Active Outlets</Badge></div>
        {ranking.length===0?<EmptyState title="No outlet ranking data" description="No consolidated outlet results were returned for the current period."/>:<div className="space-y-2">{ranking.map((r:any,i:number)=><div key={r.branchId||r.outletId||i} className="grid grid-cols-[32px_1fr_auto] items-center gap-3 rounded-xl bg-[#FAF8F5] p-3"><div className="w-8 h-8 rounded-full bg-[#F1E4C5] flex items-center justify-center text-[#B8862D] font-bold">{i+1}</div><div><div className="font-semibold text-sm">{r.branchName||r.outletName||r.name||'Outlet'}</div><div className="text-xs text-[#707070]">{r.orders??r.totalOrders??0} orders</div></div><div className="text-right"><div className="font-bold text-sm">{money(r.revenue??r.sales??r.totalSales??0)}</div><div className="text-[10px] text-[#707070]">Revenue</div></div></div>)}</div>}
      </section>
      <section className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm"><div className="flex items-center gap-2 mb-2"><Trophy className="w-4 h-4 text-[#B8862D]"/><h2 className="font-bold">Management Signals</h2></div><div className="grid sm:grid-cols-3 gap-2 text-xs text-[#505050]"><div className="rounded-xl bg-[#FAF8F5] p-3">Procurement: <b>{money(data?.costBreakdown?.procurement||0)}</b></div><div className="rounded-xl bg-[#FAF8F5] p-3">Wastage: <b>{money(data?.costBreakdown?.wastage||0)}</b></div><div className="rounded-xl bg-[#FAF8F5] p-3">COGS: <b>{money(data?.costBreakdown?.cogs||0)}</b></div></div></section>
    </>}
  </div>;
}
