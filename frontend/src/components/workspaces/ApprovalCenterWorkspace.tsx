'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, RefreshCw, XCircle, ShieldCheck } from 'lucide-react';
import { apiClient } from '@/api/client';
import { Button, Badge, EmptyState, StatCard } from '@/components/ui';
import { procurementApi } from '@/api/procurement';
import { useOutlet } from '@/context/OutletContext';

interface ApprovalItem {
  id: string;
  type: 'PURCHASE_REQUEST' | 'PURCHASE_ORDER' | 'GRN' | 'WASTAGE' | 'LEAVE';
  title: string;
  reference: string;
  amount?: number;
  branch?: string;
  createdAt?: string;
  payload: any;
}

const money = (v: any) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const unwrap = (r: any) => r?.data?.data ?? r?.data ?? [];

export default function ApprovalCenterWorkspace() {
  const { activeOutlet, isHeadOffice } = useOutlet();
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [filter, setFilter] = useState<'ALL' | ApprovalItem['type']>('ALL');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setMessage('');
    try {
      const branch_id = isHeadOffice ? undefined : activeOutlet?.id;
      const [prs, pos, grns, wastage, leaves] = await Promise.all([
        procurementApi.getPurchaseRequests({ branch_id, status_filter: 'PENDING_APPROVAL' }).catch(() => []),
        procurementApi.getPurchaseOrders({ branch_id, status_filter: 'PENDING_APPROVAL' }).catch(() => []),
        procurementApi.getGoodsReceiveNotes({ branch_id, status_filter: 'PENDING_APPROVAL' }).catch(() => []),
        apiClient.get('/wastage/entries', { params: { branch_id, status_filter: 'PENDING_APPROVAL' } }).then(unwrap).catch(() => []),
        apiClient.get('/hr/leaves', { params: { branch_id, status: 'PENDING' } }).then(unwrap).catch(() => []),
      ]);
      const next: ApprovalItem[] = [
        ...prs.map((x: any) => ({ id:x.id, type:'PURCHASE_REQUEST', title:'Purchase Request', reference:x.request_number, amount:x.total_amount, branch:x.branch?.name, createdAt:x.created_at, payload:x })),
        ...pos.map((x: any) => ({ id:x.id, type:'PURCHASE_ORDER', title:'Purchase Order', reference:x.po_number, amount:x.net_amount ?? x.total_amount, branch:x.branch?.name, createdAt:x.created_at, payload:x })),
        ...grns.map((x: any) => ({ id:x.id, type:'GRN', title:'Goods Receipt', reference:x.grn_number, amount:x.total_amount, branch:x.branch?.name, createdAt:x.created_at, payload:x })),
        ...wastage.map((x: any) => ({ id:x.id, type:'WASTAGE', title:'Wastage Entry', reference:x.entry_number, amount:x.total_cost, branch:x.branch?.name, createdAt:x.created_at, payload:x })),
        ...leaves.map((x: any) => ({ id:x.id, type:'LEAVE', title:'Leave Request', reference:x.id.slice(0,8).toUpperCase(), amount:0, branch:x.branch?.name, createdAt:x.created_at, payload:x })),
      ];
      setItems(next.sort((a,b) => String(b.createdAt||'').localeCompare(String(a.createdAt||''))));
    } finally { setLoading(false); }
  }, [activeOutlet?.id, isHeadOffice]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => filter === 'ALL' ? items : items.filter(x => x.type === filter), [items, filter]);
  const counts = useMemo(() => ({
    total: items.length,
    purchase: items.filter(x=>x.type==='PURCHASE_REQUEST'||x.type==='PURCHASE_ORDER').length,
    operations: items.filter(x=>x.type==='GRN'||x.type==='WASTAGE').length,
    people: items.filter(x=>x.type==='LEAVE').length,
  }), [items]);

  const act = async (item: ApprovalItem, action: 'APPROVE' | 'REJECT') => {
    setActing(item.id); setMessage('');
    try {
      if (item.type === 'PURCHASE_REQUEST') action === 'APPROVE' ? await procurementApi.approvePurchaseRequest(item.id) : await procurementApi.rejectPurchaseRequest(item.id, { reason: 'Rejected from Approval Center' });
      if (item.type === 'PURCHASE_ORDER') action === 'APPROVE' ? await procurementApi.approveOrder(item.id) : await procurementApi.rejectOrder(item.id, { reason: 'Rejected from Approval Center' });
      if (item.type === 'GRN') action === 'APPROVE' ? await procurementApi.approveGoodsReceiveNote(item.id) : await procurementApi.rejectGoodsReceiveNote(item.id, { reason: 'Rejected from Approval Center' });
      if (item.type === 'WASTAGE') action === 'APPROVE' ? await apiClient.post(`/wastage/entries/${item.id}/approve`, {}) : await apiClient.post(`/wastage/entries/${item.id}/reject`, { rejection_reason: 'Rejected from Approval Center' });
      if (item.type === 'LEAVE') await apiClient.put(`/hr/leaves/${item.id}`, { status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED' });
      setMessage(`${item.title} ${action === 'APPROVE' ? 'approved' : 'rejected'}.`); await load();
    } catch (e:any) { setMessage(e?.response?.data?.detail || e?.response?.data?.message || 'Approval action failed.'); }
    finally { setActing(null); }
  };

  return <div className="space-y-5">
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
      <div><div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-[#B8862D]"/><h1 className="text-xl font-bold">Approval Center</h1></div><p className="text-xs text-[#707070] mt-1">Central queue for operational approvals · {isHeadOffice ? 'Head Office scope' : activeOutlet?.name}</p></div>
      <Button size="sm" variant="secondary" onClick={load} disabled={loading}><RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/> Refresh</Button>
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard title="Pending" value={counts.total} icon={<Clock3 className="w-4 h-4"/>}/><StatCard title="Purchase" value={counts.purchase} icon={<Clock3 className="w-4 h-4"/>}/><StatCard title="Operations" value={counts.operations} icon={<Clock3 className="w-4 h-4"/>}/><StatCard title="People" value={counts.people} icon={<Clock3 className="w-4 h-4"/>}/>
    </div>
    <div className="flex gap-2 overflow-x-auto pb-1">{(['ALL','PURCHASE_REQUEST','PURCHASE_ORDER','GRN','WASTAGE','LEAVE'] as const).map(f=><button key={f} onClick={()=>setFilter(f)} className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border ${filter===f?'bg-[#F1E4C5] text-[#B8862D] border-[#B8862D]/30':'bg-white text-[#707070] border-[rgba(45,45,45,.08)]'}`}>{f.replaceAll('_',' ')}</button>)}</div>
    {message && <div className="p-3 rounded-xl bg-white border border-[rgba(45,45,45,.08)] text-xs font-medium">{message}</div>}
    {loading ? <div className="p-8 text-center text-sm text-[#707070]">Loading approval queue…</div> : visible.length === 0 ? <EmptyState title="No pending approvals" description="There are no approval items in the selected scope/filter." icon={<CheckCircle2 className="w-6 h-6"/>}/> : <div className="grid gap-3">{visible.map(item=><div key={`${item.type}-${item.id}`} className="bg-white border border-[rgba(45,45,45,.08)] rounded-2xl p-4 shadow-sm"><div className="flex flex-col md:flex-row md:items-center justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2 flex-wrap"><span className="font-bold text-sm">{item.title}</span><Badge variant="outlet">PENDING</Badge><span className="text-[10px] text-[#707070]">{item.type.replaceAll('_',' ')}</span></div><div className="text-xs text-[#707070] mt-1">Reference: <span className="font-mono text-[#1C1C1C]">{item.reference}</span>{item.branch ? ` · ${item.branch}` : ''}</div>{item.payload?.reason && <div className="text-xs mt-2">{item.payload.reason}</div>}</div><div className="flex items-center gap-3"><div className="text-right"><div className="text-[10px] text-[#707070]">Amount</div><div className="font-bold text-sm">{money(item.amount)}</div></div><div className="flex gap-2"><Button size="sm" variant="primary" disabled={acting===item.id} onClick={()=>act(item,'APPROVE')}><CheckCircle2 className="w-4 h-4"/> Approve</Button><Button size="sm" variant="danger" disabled={acting===item.id} onClick={()=>act(item,'REJECT')}><XCircle className="w-4 h-4"/> Reject</Button></div></div></div></div>)}</div>}
  </div>;
}
