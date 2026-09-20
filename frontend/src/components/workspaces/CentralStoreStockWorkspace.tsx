
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Boxes, RefreshCw, Search, ArrowUpFromLine, AlertTriangle, Truck, ClipboardCheck } from 'lucide-react';
import { useOutlet } from '@/context/OutletContext';
import { apiClient } from '@/api/client';
import { Button, Badge, EmptyState, StatCard } from '@/components/ui';

interface StockRow {
  id: string;
  item_id?: string;
  item_name: string;
  item_code?: string;
  unit?: string;
  quantity: number;
  unit_cost: number;
  value: number;
  min_stock_level: number;
}

interface TransferRow {
  id: string;
  transfer_number?: string;
  status: string;
  destination_branch_name?: string;
  total_amount: number;
  created_at?: string;
  items?: any[];
}

const money = (v: any) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const num = (v: any) => Number(v ?? 0);
const normalize = (r: any) => r?.data?.data ?? r?.data ?? r ?? [];

const extractStockRows = (payload: any): StockRow[] => {
  const source = payload?.items || payload?.stock || payload?.balances || payload?.details || [];
  if (!Array.isArray(source)) return [];
  return source.map((x: any, idx: number) => {
    const quantity = num(x.quantity ?? x.current_quantity ?? x.currentQuantity ?? x.stock_qty ?? x.closing_qty);
    const unitCost = num(x.unit_cost ?? x.cost_price ?? x.average_cost ?? x.avg_cost ?? x.unitPrice);
    const value = num(x.total_valuation ?? x.valuation ?? x.stock_value ?? x.total_value) || quantity * unitCost;
    return {
      id: String(x.id ?? x.item_id ?? idx),
      item_id: x.item_id,
      item_name: x.item_name ?? x.name ?? x.item?.name ?? 'Unknown Item',
      item_code: x.item_code ?? x.code ?? x.item?.code,
      unit: x.unit_symbol ?? x.unit ?? x.item?.unit?.symbol,
      quantity,
      unit_cost: unitCost,
      value,
      min_stock_level: num(x.min_stock_level ?? x.minStockLevel ?? x.minimum_stock_level),
    };
  });
};

const extractTotalValuation = (payload: any, rows: StockRow[]) => {
  const direct = payload?.totalValuation ?? payload?.total_valuation ?? payload?.valuation ?? payload?.totalStockValue;
  if (Number.isFinite(Number(direct))) return Number(direct);
  return rows.reduce((sum, x) => sum + x.value, 0);
};

const centralTransferStatuses = [
  'REQUESTED',
  'APPROVED',
  'DISPATCHED',
  'IN_TRANSIT',
  'PARTIALLY_RECEIVED',
  'FULLY_RECEIVED',
  'RECONCILED',
];

export default function CentralStoreStockWorkspace() {
  const { activeOutlet } = useOutlet();
  const [rows, setRows] = useState<StockRow[]>([]);
  const [valuation, setValuation] = useState(0);
  const [lowStock, setLowStock] = useState(0);
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'stock' | 'count' | 'movement'>('stock');
  const [countLoading, setCountLoading] = useState(false);
  const [countSaving, setCountSaving] = useState(false);
  const [countError, setCountError] = useState('');
  const [countDraft, setCountDraft] = useState<any | null>(null);
  const [countHistory, setCountHistory] = useState<any[]>([]);
  const [physicalQty, setPhysicalQty] = useState<Record<string, string>>({});

  const loadCounts = useCallback(async () => {
    try {
      const res = await apiClient.get('/inventory/central-store-stock-counts', { params: { branch_id: activeOutlet?.id || undefined } });
      const data = normalize(res);
      setCountHistory(Array.isArray(data) ? data : []);
    } catch {
      setCountHistory([]);
    }
  }, [activeOutlet?.id]);

  const startCount = useCallback(async () => {
    setCountLoading(true);
    setCountError('');
    try {
      const res = await apiClient.post('/inventory/central-store-stock-counts', {}, { params: { branch_id: activeOutlet?.id || undefined } });
      const data = normalize(res);
      setCountDraft(data);
      const initial: Record<string, string> = {};
      (data?.items || []).forEach((line: any) => { initial[String(line.item_id)] = String(line.physical_qty ?? line.system_qty ?? 0); });
      setPhysicalQty(initial);
      setActiveTab('count');
      await loadCounts();
    } catch (err: any) {
      setCountError(err?.response?.data?.detail || err?.message || 'Could not start Central Store stock count.');
    } finally {
      setCountLoading(false);
    }
  }, [activeOutlet?.id, loadCounts]);

  const submitCount = useCallback(async () => {
    if (!countDraft?.id) return;
    setCountSaving(true);
    setCountError('');
    try {
      const items = (countDraft.items || []).map((line: any) => ({
        item_id: line.item_id,
        physical_qty: Number(physicalQty[String(line.item_id)] || 0),
        unit_cost: Number(line.unit_cost || 0),
        batch_number: line.batch_number || undefined,
        remarks: line.remarks || undefined,
      }));
      const res = await apiClient.put(`/inventory/central-store-stock-counts/${countDraft.id}/submit`, { items });
      const data = normalize(res);
      setCountDraft(data);
      await loadCounts();
    } catch (err: any) {
      setCountError(err?.response?.data?.detail || err?.message || 'Could not submit stock count.');
    } finally {
      setCountSaving(false);
    }
  }, [countDraft, physicalQty, loadCounts]);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const [inventoryResult, ...transferResults] = await Promise.all([
        apiClient.get('/inventory/central-store-stock', { params: { branch_id: activeOutlet?.id || undefined } }).catch(() => null),
        ...centralTransferStatuses.map((status) =>
          apiClient.get('/procurement/central-store/queue', { params: { status_filter: status } }).catch(() => null)
        ),
      ]);

      if (inventoryResult) {
        const normalized = normalize(inventoryResult);
        const stockRows = extractStockRows(normalized);
        setRows(stockRows);
        setValuation(extractTotalValuation(normalized, stockRows));
        setLowStock(num(normalized?.low_stock_items_count ?? stockRows.filter((x) => x.min_stock_level > 0 && x.quantity <= x.min_stock_level).length));
      } else {
        setRows([]);
        setValuation(0);
        setLowStock(0);
      }

      const merged: TransferRow[] = [];
      transferResults.forEach((res: any) => {
        const data = normalize(res);
        if (Array.isArray(data)) merged.push(...data);
      });
      const unique = merged.filter((x, i, arr) => arr.findIndex((y) => String(y.id) === String(x.id)) === i);
      setTransfers(unique.map((x: any) => ({
        id: String(x.id),
        transfer_number: x.transfer_number,
        status: String(x.status || '').toUpperCase(),
        destination_branch_name: x.destination_branch_name,
        total_amount: num(x.total_amount),
        created_at: x.created_at,
        items: x.items || [],
      })));
    } catch (err: any) {
      setMessage(err?.response?.data?.detail || err?.message || 'Central Store stock could not be loaded.');
      setRows([]);
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  }, [activeOutlet?.id]);

  useEffect(() => { load(); loadCounts(); }, [load, loadCounts]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((x) => `${x.item_name} ${x.item_code || ''} ${x.unit || ''}`.toLowerCase().includes(q));
  }, [rows, search]);

  const transferOutValue = useMemo(
    () => transfers.reduce((sum, x) => sum + x.total_amount, 0),
    [transfers]
  );

  const pendingTransferValue = useMemo(
    () => transfers.filter((x) => ['REQUESTED', 'APPROVED', 'DISPATCHED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(x.status)).reduce((sum, x) => sum + x.total_amount, 0),
    [transfers]
  );

  const totalQty = useMemo(() => rows.reduce((sum, x) => sum + x.quantity, 0), [rows]);

  return (
    <div className="w-full min-w-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#1C1C1C]">CENTRAL STORE STOCK</h2>
          <p className="text-xs text-[#707070] mt-1">Live stock balance, valuation and transfer control for the Central Store.</p>
        </div>
        <Button size="sm" variant="secondary" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={load}>
          Refresh
        </Button>
      </div>

      {message && <div className="p-3 rounded-xl bg-white border border-red-200 text-xs font-medium text-red-700">{message}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard title="Stock Value" value={money(valuation)} icon={<Boxes className="w-4 h-4" />} />
        <StatCard title="Item Types" value={rows.length} icon={<Boxes className="w-4 h-4" />} />
        <StatCard title="Total Qty" value={totalQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })} icon={<Boxes className="w-4 h-4" />} />
        <StatCard title="Low Stock" value={lowStock} icon={<AlertTriangle className="w-4 h-4" />} />
        <StatCard title="Transfer Value" value={money(transferOutValue)} icon={<Truck className="w-4 h-4" />} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 rounded-xl border border-gray-200 bg-white p-1 gap-1">
        {([['stock', 'Current Stock'], ['count', 'Stock Count'], ['movement', 'Stock Movement']] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setActiveTab(key)} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${activeTab === key ? 'bg-[#F3E5C5] text-[#B8862D]' : 'text-[#666] hover:bg-[#FAF8F5]'}`}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'stock' && (
        <>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#909090]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item / code..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-[#B8862D]/20"
          />
        </div>
        <div className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-[#5B5B5B]">
          Pending transfer value: <span className="text-[#1C1C1C]">{money(pendingTransferValue)}</span>
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm text-[#707070]">Loading Central Store stock…</div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="font-bold text-sm">Current Stock</div>
              <div className="text-[11px] text-[#777]">Quantity × cost = stock value</div>
            </div>
            {visibleRows.length === 0 ? (
              <div className="p-8"><EmptyState title="No stock rows" description="No Central Store stock records are available from the current valuation endpoint." icon={<Boxes className="w-6 h-6" />} /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] text-[#777]">
                    <tr>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3">Unit</th>
                      <th className="px-4 py-3 text-right">Cost</th>
                      <th className="px-4 py-3 text-right">Value</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => {
                      const isLow = row.min_stock_level > 0 && row.quantity <= row.min_stock_level;
                      return (
                        <tr key={row.id} className="border-t border-gray-100">
                          <td className="px-4 py-3 font-semibold">{row.item_name}</td>
                          <td className="px-4 py-3 font-mono text-[#777]">{row.item_code || '—'}</td>
                          <td className="px-4 py-3 text-right font-mono">{row.quantity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                          <td className="px-4 py-3">{row.unit || '—'}</td>
                          <td className="px-4 py-3 text-right font-mono">{money(row.unit_cost)}</td>
                          <td className="px-4 py-3 text-right font-mono font-semibold">{money(row.value)}</td>
                          <td className="px-4 py-3"><Badge variant={isLow ? 'danger' : 'success'}>{isLow ? 'LOW' : 'OK'}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <div className="font-bold text-sm">Transfer Summary</div>
                <div className="text-[11px] text-[#777]">Central Store → Outlet transfer value across the workflow.</div>
              </div>
              <ArrowUpFromLine className="w-4 h-4 text-[#B8862D]" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
              {[
                ['Requested', transfers.filter((x) => x.status === 'REQUESTED').reduce((s, x) => s + x.total_amount, 0)],
                ['Approved/Dispatch', transfers.filter((x) => ['APPROVED','DISPATCHED'].includes(x.status)).reduce((s, x) => s + x.total_amount, 0)],
                ['In Transit', transfers.filter((x) => x.status === 'IN_TRANSIT').reduce((s, x) => s + x.total_amount, 0)],
                ['Received', transfers.filter((x) => ['PARTIALLY_RECEIVED','FULLY_RECEIVED','RECONCILED'].includes(x.status)).reduce((s, x) => s + x.total_amount, 0)],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl bg-[#FAF8F5] p-3">
                  <div className="text-[10px] uppercase tracking-wider text-[#777]">{label}</div>
                  <div className="mt-1 font-bold text-sm">{money(value)}</div>
                </div>
              ))}
            </div>
            {transfers.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] text-[#777]">
                    <tr>
                      <th className="px-4 py-3">Transfer</th>
                      <th className="px-4 py-3">Destination</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfers.slice().sort((a,b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))).slice(0, 20).map((x) => (
                      <tr key={x.id} className="border-t border-gray-100">
                        <td className="px-4 py-3 font-mono">{x.transfer_number || x.id.slice(0, 8)}</td>
                        <td className="px-4 py-3 font-semibold">{x.destination_branch_name || 'Outlet'}</td>
                        <td className="px-4 py-3"><Badge variant="outlet">{x.status.replaceAll('_', ' ')}</Badge></td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">{money(x.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
        </>
      )}

      {activeTab === 'count' && (
        <div className="space-y-3">
          {countError && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700">{countError}</div>}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
              <div><div className="font-bold text-sm">Central Store Physical Count</div><div className="text-[11px] text-[#777]">Actual stock entry only. No warehouse selection is required.</div></div>
              <Button size="sm" icon={<ClipboardCheck className="w-3.5 h-3.5" />} onClick={startCount} disabled={countLoading}>{countLoading ? 'Starting…' : 'Start Count'}</Button>
            </div>
            {countDraft ? (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-[#FAF8F5] p-3"><div><div className="text-[10px] uppercase tracking-wider text-[#777]">Count Number</div><div className="font-bold text-sm">{countDraft.count_number}</div></div><Badge variant={countDraft.status === 'APPROVED' ? 'success' : countDraft.status === 'SUBMITTED' ? 'warning' : 'outlet'}>{countDraft.status}</Badge></div>
                <div className="overflow-x-auto rounded-xl border border-gray-200"><table className="w-full text-left text-xs"><thead className="bg-[#FAF8F5] text-[#777]"><tr><th className="px-3 py-2.5">Item</th><th className="px-3 py-2.5 text-right">System</th><th className="px-3 py-2.5">Unit</th><th className="px-3 py-2.5 text-right">Physical Qty</th><th className="px-3 py-2.5 text-right">Variance</th></tr></thead><tbody>
                  {(countDraft.items || []).map((line: any) => { const physical = Number(physicalQty[String(line.item_id)] || 0); const variance = physical - Number(line.system_qty || 0); return (
                    <tr key={line.id} className="border-t border-gray-100"><td className="px-3 py-2.5"><div className="font-semibold">{line.item_name}</div><div className="text-[10px] text-[#777]">{line.item_code || '—'}</div></td><td className="px-3 py-2.5 text-right font-mono">{Number(line.system_qty || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td><td className="px-3 py-2.5">{line.unit_symbol || '—'}</td><td className="px-3 py-2.5 text-right"><input type="number" min="0" step="0.01" value={physicalQty[String(line.item_id)] ?? ''} onChange={(e) => setPhysicalQty((prev) => ({ ...prev, [String(line.item_id)]: e.target.value }))} disabled={countSaving || ['SUBMITTED','APPROVED','CANCELLED'].includes(String(countDraft.status))} className="w-28 ml-auto px-2.5 py-1.5 rounded-lg border border-gray-200 text-right outline-none focus:ring-2 focus:ring-[#B8862D]/20" /></td><td className={`px-3 py-2.5 text-right font-mono font-semibold ${variance < 0 ? 'text-red-600' : variance > 0 ? 'text-green-600' : 'text-[#777]'}`}>{variance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td></tr>
                  ); })}
                </tbody></table></div>
                {(countDraft.status === 'DRAFT' || countDraft.status === 'IN_PROGRESS') && <div className="flex justify-end"><Button size="sm" icon={<ArrowUpFromLine className="w-3.5 h-3.5" />} onClick={submitCount} disabled={countSaving}>{countSaving ? 'Submitting…' : 'Submit for Approval'}</Button></div>}
              </div>
            ) : <EmptyState title="No active physical count" description="Start a Central Store count and enter the physical quantity of each Item Master item." icon={<ClipboardCheck className="w-6 h-6" />} />}
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden"><div className="px-4 py-3 border-b border-gray-100 font-bold text-sm">Count History</div>{countHistory.length === 0 ? <div className="p-6 text-sm text-[#777]">No Central Store count history.</div> : <div className="divide-y divide-gray-100">{countHistory.map((c: any) => <div key={c.id} className="px-4 py-3 flex items-center justify-between"><div><div className="text-xs font-bold">{c.count_number}</div><div className="text-[10px] text-[#777]">{new Date(c.count_date).toLocaleDateString('en-IN')}</div></div><Badge variant={c.status === 'APPROVED' ? 'success' : c.status === 'SUBMITTED' ? 'warning' : 'outlet'}>{c.status}</Badge></div>)}</div>}</div>
        </div>
      )}

      {activeTab === 'movement' && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden"><div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2"><ArrowUpFromLine className="w-4 h-4 text-[#B8862D]" /><div><div className="font-bold text-sm">Stock Movement</div><div className="text-[11px] text-[#777]">Central Store transfer lifecycle remains separate from physical count stock.</div></div></div><div className="p-4 text-xs text-[#666]">Use Transfer / Dispatch to manage Central Store → Outlet movements.</div></div>
      )}
    </div>
  );
}
