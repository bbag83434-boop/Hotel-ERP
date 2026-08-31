'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Bot, CheckCircle2, Clock3, FileBarChart2, PackageCheck, RefreshCw, ShoppingCart, Smartphone, Zap } from 'lucide-react';
import { apiClient } from '@/api/client';
import { reportsApi } from '@/api/reports';
import { useOutlet } from '@/context/OutletContext';
import { Badge, Button, StatCard } from '@/components/ui';

type AutomationState = 'ACTIVE' | 'READY' | 'MANUAL' | 'INFO';
interface AutomationCard { key: string; title: string; description: string; state: AutomationState; action?: string; }

const cards: AutomationCard[] = [
  { key: 'stock-deduction', title: 'Auto Stock Deduction', description: 'Completed orders consume recipe ingredients through the stock ledger.', state: 'ACTIVE' },
  { key: 'reorder', title: 'Auto Reorder Check', description: 'Live inventory exposes low-stock and reorder recommendations.', state: 'ACTIVE', action: 'Check Now' },
  { key: 'po', title: 'Auto PO Generation', description: 'Approved purchase requirements can be consolidated into supplier-wise POs.', state: 'ACTIVE' },
  { key: 'reports', title: 'Auto Reports', description: 'Report snapshots and scheduled reporting infrastructure are available.', state: 'ACTIVE', action: 'Refresh Reports' },
  { key: 'whatsapp', title: 'WhatsApp Notifications', description: 'Supplier order messages are prepared as WhatsApp links; final sending remains user-controlled.', state: 'MANUAL' },
  { key: 'ai', title: 'AI Stock Recommendations', description: 'AI can surface replenishment recommendations for the active outlet.', state: 'READY', action: 'Run AI Check' },
];

export default function AutomationWorkspace() {
  const { activeOutlet } = useOutlet();
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [reorder, setReorder] = useState<any | null>(null);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [ai, setAi] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true); setMessage('');
    try {
      const [low, rec, snap] = await Promise.all([
        apiClient.get('/inventory/stock-balances/low-stock', { params: { branch_id: activeOutlet.id } }).catch(() => ({ data: [] })),
        apiClient.get('/inventory/reorder-recommendations', { params: { branch_id: activeOutlet.id } }).catch(() => ({ data: null })),
        reportsApi.getSnapshots({ branchId: activeOutlet.id }).catch(() => []),
      ]);
      setLowStock(Array.isArray(low.data) ? low.data : []);
      setReorder(rec.data);
      setSnapshots(Array.isArray(snap) ? snap : []);
    } finally { setLoading(false); }
  }, [activeOutlet.id]);

  useEffect(() => { load(); }, [load]);

  const runAI = async () => {
    setActionLoading('ai'); setMessage('');
    try {
      const res = await apiClient.get('/ai/recommendations/stock', { params: { outlet_id: activeOutlet.id } });
      setAi(res.data?.data ?? res.data);
      setMessage('AI stock recommendation check completed.');
    } catch (e: any) { setMessage(e?.response?.data?.detail || 'AI recommendation check failed.'); }
    finally { setActionLoading(null); }
  };

  const runReorder = async () => {
    setActionLoading('reorder'); setMessage('');
    try { await load(); setMessage('Reorder check refreshed from live inventory.'); }
    finally { setActionLoading(null); }
  };

  const refreshReports = async () => {
    setActionLoading('reports'); setMessage('');
    try { const s = await reportsApi.getSnapshots({ branchId: activeOutlet.id }); setSnapshots(s); setMessage('Report snapshot list refreshed.'); }
    catch { setMessage('Report refresh failed.'); }
    finally { setActionLoading(null); }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><Zap className="w-5 h-5 text-[#C79A3B]" /><h2 className="text-xl font-bold">Automation Center</h2><Badge variant="outlet">[{activeOutlet.code}]</Badge></div>
            <p className="text-xs text-[#707070] mt-1">Live visibility for automated ERP workflows. No destructive action is executed from this dashboard.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={load} loading={loading} icon={<RefreshCw className="w-3.5 h-3.5" />}>Refresh</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Low Stock" value={String(lowStock.length)} subtitle="Live alerts" icon={<PackageCheck className="w-4 h-4" />} />
        <StatCard title="Reorder Items" value={String(reorder?.total_items_to_reorder ?? reorder?.totalItemsToReorder ?? 0)} subtitle="Recommended" icon={<ShoppingCart className="w-4 h-4" />} />
        <StatCard title="Snapshots" value={String(snapshots.length)} subtitle="Saved reports" icon={<FileBarChart2 className="w-4 h-4" />} />
        <StatCard title="Outlet" value={activeOutlet.code} subtitle="Automation scope" icon={<Activity className="w-4 h-4" />} />
      </div>

      {message && <div className="rounded-xl border border-[#C79A3B]/30 bg-[#FAF8F5] px-4 py-3 text-xs font-medium">{message}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {cards.map((card) => {
          const stateIcon = card.state === 'ACTIVE' || card.state === 'READY' ? <CheckCircle2 className="w-4 h-4" /> : card.state === 'MANUAL' ? <Smartphone className="w-4 h-4" /> : <Clock3 className="w-4 h-4" />;
          const action = card.key === 'ai' ? runAI : card.key === 'reorder' ? runReorder : card.key === 'reports' ? refreshReports : undefined;
          return <div key={card.key} className="rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="font-bold text-sm">{card.title}</h3><p className="text-xs text-[#707070] mt-1 leading-5">{card.description}</p></div>
              <span className="shrink-0 flex items-center gap-1 rounded-full bg-[#F5F3EE] px-2 py-1 text-[9px] font-bold">{stateIcon}{card.state}</span>
            </div>
            {card.action && action && <div className="mt-3"><Button variant="secondary" size="sm" onClick={action} loading={actionLoading === card.key}>{card.action}</Button></div>}
          </div>;
        })}
      </div>

      {ai && <div className="rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] p-4 shadow-sm"><div className="flex items-center gap-2 mb-3"><Bot className="w-4 h-4 text-[#C79A3B]" /><h3 className="font-bold text-sm">AI Stock Recommendations</h3></div><pre className="text-[11px] whitespace-pre-wrap overflow-auto max-h-72 bg-[#FAF8F5] rounded-xl p-3">{JSON.stringify(ai, null, 2)}</pre></div>}

      {lowStock.length > 0 && <div className="rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] p-4 shadow-sm"><h3 className="font-bold text-sm mb-3">Current Low-Stock Queue</h3><div className="space-y-2">{lowStock.slice(0, 12).map((x, i) => <div key={x.id || x.item_id || i} className="flex justify-between gap-3 text-xs border-b border-black/5 pb-2"><span className="font-medium">{x.item_name || x.itemName || x.item_id}</span><span>{x.current_quantity ?? x.currentQuantity ?? 0} / min {x.min_level ?? x.minLevel ?? 0}</span></div>)}</div></div>}
    </div>
  );
}
