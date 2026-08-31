'use client';

import React, { useMemo, useState } from 'react';
import { Bot, ShieldCheck, Sparkles, ShoppingCart, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/api/client';
import { procurementApi } from '@/api/procurement';
import { Button } from '@/components/ui/Button';

interface Props { activeOutlet: any; }
interface Recommendation { item_id:string; item_name:string; current_quantity:number; min_stock_level:number; suggested_order_quantity:number; priority:string; recommendation:string; }

export default function AIAgentWorkspace({ activeOutlet }: Props) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [createdRequest, setCreatedRequest] = useState<any>(null);

  const selectedItems = useMemo(() => recommendations.filter(r => selected[r.item_id]), [recommendations, selected]);

  const loadRecommendations = async () => {
    setLoading(true); setCreatedRequest(null);
    try {
      const res = await apiClient.get('/ai/recommendations/stock');
      setRecommendations(res.data?.data || []);
      setAnswer(`I checked deterministic stock, minimum levels and recent consumption for ${activeOutlet?.name || 'the active outlet'}. I can recommend actions, but I will not directly place a PO or bypass approval.`);
    } catch (e:any) {
      window.alert(e?.response?.data?.detail || 'AI agent could not load recommendations.');
    } finally { setLoading(false); }
  };

  const ask = async () => {
    const q = query.trim(); if (!q) return;
    setLoading(true);
    try {
      const res = await apiClient.post('/procurement/smart-requirements/ask', { branch_id: activeOutlet.id, question: q });
      const data = res.data?.data || res.data;
      setAnswer(data?.answer_text || data?.answer || 'No answer returned.');
    } catch (e:any) {
      window.alert(e?.response?.data?.detail || 'AI query failed.');
    } finally { setLoading(false); }
  };

  const createPurchaseRequest = async () => {
    if (!selectedItems.length) return;
    setActing(true); setCreatedRequest(null);
    try {
      const priority = selectedItems.some(x => x.priority === 'CRITICAL') ? 'URGENT' : selectedItems.some(x => x.priority === 'HIGH') ? 'HIGH' : 'MEDIUM';
      const res = await procurementApi.createPurchaseRequest({
        branch_id: activeOutlet.id,
        required_date: new Date(Date.now() + 86400000).toISOString(),
        priority,
        notes: 'AI Agent recommendation converted to Purchase Request. Approval required before procurement.',
        items: selectedItems.map(x => ({ item_id: x.item_id, requested_qty: x.suggested_order_quantity, estimated_price: 0, notes: x.recommendation })),
      });
      setCreatedRequest(res);
      setSelected({});
      setAnswer(`Purchase Request ${res.requestNumber || (res as any).request_number || ''} created and sent for approval.`);
    } catch (e:any) {
      window.alert(e?.response?.data?.detail || 'Could not create Purchase Request.');
    } finally { setActing(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><Bot className="w-5 h-5 text-[#C79A3B]"/><h2 className="text-lg font-bold">Controlled AI Agent</h2></div>
          <p className="text-xs text-[#707070] mt-1">Recommendations + approved application tools. No direct destructive actions.</p>
        </div>
        <span className="text-[10px] px-2 py-1 rounded-lg bg-[#F1E4C5] text-[#B8862D] font-bold flex items-center gap-1"><ShieldCheck className="w-3 h-3"/>Guarded</span>
      </div>

      <div className="bg-white rounded-2xl border border-[rgba(45,45,45,.08)] p-4 space-y-3">
        <div className="flex gap-2">
          <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&ask()} placeholder="Ask: what should I order today?" className="flex-1 px-3 py-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,.1)] text-xs outline-none focus:border-[#C79A3B]" />
          <Button onClick={ask} disabled={loading || !query.trim()} variant="primary">Ask</Button>
        </div>
        {answer && <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#C79A3B]/20 text-xs leading-relaxed">{answer}</div>}
        <div className="flex gap-2 overflow-x-auto">
          {['What is critical today?','What do I need to order?','What stock is low today?'].map(q=><button key={q} onClick={()=>{setQuery(q);}} className="px-2.5 py-1.5 rounded-lg border border-[rgba(45,45,45,.08)] text-[11px] whitespace-nowrap">{q}</button>)}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[rgba(45,45,45,.08)] p-4 space-y-3">
        <div className="flex items-center justify-between"><div><h3 className="font-bold text-sm">Deterministic Action Queue</h3><p className="text-[11px] text-[#707070]">Stock recommendation engine only. Final procurement remains approval-controlled.</p></div><Button onClick={loadRecommendations} disabled={loading} variant="secondary"><RefreshCw className={`w-3.5 h-3.5 ${loading?'animate-spin':''}`}/></Button></div>
        {!recommendations.length ? <div className="py-8 text-center text-xs text-[#707070]"><Sparkles className="w-6 h-6 mx-auto mb-2 text-[#C79A3B]"/>Load recommendations to review safe actions.</div> : recommendations.map(r=><label key={r.item_id} className="flex gap-3 p-3 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,.06)] cursor-pointer"><input type="checkbox" checked={!!selected[r.item_id]} onChange={e=>setSelected(s=>({...s,[r.item_id]:e.target.checked}))} className="mt-1"/><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><span className="font-semibold text-xs truncate">{r.item_name}</span><span className="text-[10px] font-bold">{r.priority}</span></div><div className="grid grid-cols-3 gap-2 mt-2 text-[10px]"><span>Current <b>{r.current_quantity}</b></span><span>Min <b>{r.min_stock_level}</b></span><span>Order <b>{r.suggested_order_quantity}</b></span></div><p className="text-[10px] text-[#707070] mt-2">{r.recommendation}</p></div></label>)}
        {recommendations.length > 0 && <div className="pt-2 border-t border-[rgba(45,45,45,.06)]"><Button onClick={createPurchaseRequest} disabled={acting || !selectedItems.length} variant="primary" className="w-full"><ShoppingCart className="w-3.5 h-3.5"/>{acting?'Creating…':`Create Purchase Request (${selectedItems.length})`}</Button><p className="text-[10px] text-[#707070] text-center mt-2">This creates a PENDING_APPROVAL request; it does not create a PO.</p></div>}
        {createdRequest && <div className="p-3 rounded-xl bg-[#2E8B57]/10 border border-[#2E8B57]/20 text-xs flex gap-2"><CheckCircle2 className="w-4 h-4 text-[#2E8B57] shrink-0"/><span><b>{createdRequest.request_number}</b> created and awaiting approval.</span></div>}
      </div>

      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[10px] text-amber-800 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0"/>The agent cannot approve requests, create POs, alter stock, change permissions, or bypass authorization.</div>
    </div>
  );
}
