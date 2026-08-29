 'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck, RefreshCw, Search, PackageSearch, Users, FileText, ShoppingCart, Lock } from 'lucide-react';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { useOutlet } from '@/context/OutletContext';

type Tool = { tool:string; read_only:boolean; permission:string; approval_required?:boolean; allowed:boolean };
type Result = any;

const TOOL_LABELS: Record<string,string> = {
  stock_status: 'Stock Status',
  low_stock: 'Low Stock',
  supplier_lookup: 'Supplier Lookup',
  procurement_summary: 'Procurement Summary',
  create_purchase_request: 'Create Purchase Request',
};

export default function AIControlledToolsWorkspace() {
  const { activeOutlet } = useOutlet();
  const [tools,setTools] = useState<Tool[]>([]);
  const [tool,setTool] = useState('stock_status');
  const [search,setSearch] = useState('');
  const [items,setItems] = useState('');
  const [result,setResult] = useState<Result>(null);
  const [loading,setLoading] = useState(false);

  const loadRegistry = async () => {
    try {
      const r = await apiClient.get('/ai/tools/registry');
      setTools(r.data?.data || []);
    } catch (e:any) { window.alert(e?.response?.data?.detail || 'Could not load AI tools.'); }
  };
  useEffect(()=>{ loadRegistry(); },[]);

  const execute = async () => {
    setLoading(true); setResult(null);
    try {
      let arguments_:any = { branch_id: activeOutlet.id };
      if (tool === 'supplier_lookup') arguments_.search = search.trim();
      if (tool === 'create_purchase_request') {
        const parsed = JSON.parse(items);
        if (!Array.isArray(parsed) || !parsed.length) throw new Error('Add at least one purchase item.');
        arguments_.items = parsed;
        arguments_.priority = 'MEDIUM';
      }
      const r = await apiClient.post('/ai/tools/execute', {
        tool, arguments: arguments_, idempotency_key: `${tool}-${activeOutlet.id}-${Date.now()}`
      });
      setResult(r.data);
    } catch (e:any) {
      window.alert(e?.response?.data?.detail || e?.message || 'Tool execution failed.');
    } finally { setLoading(false); }
  };

  const icon = (name:string) => name.includes('stock') ? <PackageSearch className="w-4 h-4"/> :
    name.includes('supplier') ? <Users className="w-4 h-4"/> :
    name.includes('procurement') ? <FileText className="w-4 h-4"/> : <ShoppingCart className="w-4 h-4"/>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-[#C79A3B]"/><h2 className="text-lg font-bold">AI Controlled Tools</h2></div>
          <p className="text-xs text-[#707070] mt-1">Permission-checked tools. Every execution is audited.</p>
        </div>
        <span className="text-[10px] px-2 py-1 rounded-lg bg-[#F1E4C5] text-[#B8862D] font-bold flex items-center gap-1"><Lock className="w-3 h-3"/> Guarded</span>
      </div>

      <div className="grid gap-2">
        {tools.map(t => (
          <button key={t.tool} onClick={()=>setTool(t.tool)}
            className={`w-full text-left p-3 rounded-xl border ${tool===t.tool?'border-[#C79A3B] bg-[#F1E4C5]/40':'border-[rgba(45,45,45,.08)] bg-white'}`}>
            <div className="flex items-center gap-2">{icon(t.tool)}<span className="font-semibold text-xs">{TOOL_LABELS[t.tool] || t.tool}</span>
              <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-[#FAF8F5]">{t.read_only?'READ':'ACTION'}</span>
            </div>
            <p className="text-[10px] text-[#707070] mt-1">{t.permission}{t.approval_required?' · approval required':''}</p>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[rgba(45,45,45,.08)] p-4 space-y-3">
        {tool === 'supplier_lookup' && <div><label className="text-[11px] font-semibold">Supplier search</label><div className="flex gap-2 mt-1"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name / code / phone" className="flex-1 px-3 py-2.5 rounded-xl bg-[#FAF8F5] border border-black/10 text-xs"/><Search className="w-4 h-4 mt-3 -ml-8 text-[#707070]"/></div></div>}
        {tool === 'create_purchase_request' && <div>
          <label className="text-[11px] font-semibold">Items JSON</label>
          <textarea value={items} onChange={e=>setItems(e.target.value)} rows={5}
            placeholder={'[{"item_id":"ITEM_ID","requested_qty":10}]'}
            className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[#FAF8F5] border border-black/10 text-xs font-mono"/>
          <p className="text-[10px] text-[#707070] mt-1">Creates only a PENDING_APPROVAL Purchase Request. It never creates or approves a PO.</p>
        </div>}
        <Button onClick={execute} disabled={loading} variant="primary" className="w-full">{loading?<><RefreshCw className="w-3.5 h-3.5 animate-spin"/>Executing…</>:<>Execute Controlled Tool</>}</Button>
      </div>

      {result && <div className="bg-white rounded-2xl border border-[#C79A3B]/30 p-4">
        <div className="text-xs font-bold mb-2">Execution Result</div>
        <pre className="text-[10px] whitespace-pre-wrap break-words bg-[#FAF8F5] rounded-xl p-3 overflow-auto">{JSON.stringify(result,null,2)}</pre>
      </div>}

      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[10px] text-amber-800">
        AI tools cannot approve POs, make payments, change stock directly, change permissions, or bypass outlet/company authorization.
      </div>
    </div>
  );
}
