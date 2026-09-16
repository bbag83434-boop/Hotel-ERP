'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  Send,
  Truck,
  PackageCheck,
} from 'lucide-react';
import { apiClient } from '@/api/client';
import { useOutlet } from '@/context/OutletContext';
import { Badge, Button, EmptyState } from '@/components/ui';

interface TransferItem {
  id?: string;
  item_id?: string;
  item_name?: string;
  item_code?: string;
  unit_symbol?: string;
  quantity?: number;
  requested_qty?: number;
  unit_cost?: number;
  amount?: number;
}

interface TransferRow {
  id: string;
  transfer_number?: string;
  status: string;
  destination_branch_name?: string;
  source_warehouse_name?: string;
  created_at?: string;
  transfer_date?: string;
  notes?: string;
  items?: TransferItem[];
  total_amount?: number;
}

const money = (value: number) =>
  `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const num = (v: any) => Number(v ?? 0);
const unwrap = (r: any) => r?.data?.data ?? r?.data ?? r ?? [];

const STATUS_ORDER = [
  'REQUESTED',
  'APPROVED',
  'DISPATCHED',
  'IN_TRANSIT',
  'PARTIALLY_RECEIVED',
  'FULLY_RECEIVED',
  'RECONCILED',
];

const nextAction = (status: string) => {
  switch (status) {
    case 'REQUESTED':
      return { label: 'Approve', next: 'APPROVED' };
    case 'APPROVED':
      return { label: 'Dispatch', next: 'DISPATCHED' };
    case 'DISPATCHED':
      return { label: 'Mark In Transit', next: 'IN_TRANSIT' };
    case 'IN_TRANSIT':
      return { label: 'Mark Received', next: 'COMPLETED' };
    default:
      return null;
  }
};

const amountOf = (row: TransferRow) => {
  if (num(row.total_amount) > 0) return num(row.total_amount);
  return (row.items || []).reduce((sum, item) => {
    const qty = num(item.quantity ?? item.requested_qty);
    return sum + qty * num(item.unit_cost);
  }, 0);
};

export default function CentralStoreTransferWorkspace() {
  const { activeOutlet } = useOutlet();
  const [rows, setRows] = useState<TransferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [view, setView] = useState<TransferRow | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const results = await Promise.all(
        STATUS_ORDER.map((status) =>
          apiClient
            .get('/procurement/central-store/queue', {
              params: {
                status_filter: status,
                branch_id: activeOutlet?.id || undefined,
              },
            })
            .then(unwrap)
            .catch(() => []),
        ),
      );

      const map = new Map<string, TransferRow>();
      results.flat().forEach((row: any) => {
        if (!row?.id) return;
        map.set(String(row.id), {
          ...row,
          id: String(row.id),
          status: String(row.status || '').toUpperCase(),
        });
      });
      setRows(Array.from(map.values()));
    } catch (err: any) {
      setMessage(err?.response?.data?.detail || err?.message || 'Transfer queue load failed.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [activeOutlet?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesStatus = filter === 'ALL' || row.status === filter;
      const haystack = [
        row.transfer_number,
        row.destination_branch_name,
        row.source_warehouse_name,
        row.notes,
        ...(row.items || []).flatMap((item) => [item.item_name, item.item_code]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return matchesStatus && (!q || haystack.includes(q));
    });
  }, [rows, filter, search]);

  const updateStatus = async (row: TransferRow, nextStatus: string) => {
    setActing(row.id);
    setMessage('');
    try {
      await apiClient.put(`/inventory/transfers/${row.id}/status`, {
        status: nextStatus,
      });
      setMessage(`${row.transfer_number || 'Transfer'} updated to ${nextStatus.replaceAll('_', ' ')}.`);
      await load();
    } catch (err: any) {
      setMessage(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          err?.message ||
          'Transfer status update failed.',
      );
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="w-full max-w-[1180px] mx-auto px-3 sm:px-5 lg:px-6 pb-20 text-[#18233A]">
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 py-3 sm:py-4">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#B8862D]" />
            <h1 className="text-lg sm:text-xl font-bold">CENTRAL STORE TRANSFER / DISPATCH</h1>
          </div>
          <p className="text-xs sm:text-sm text-[#77736B] mt-1">
            Outlet-approved requirements fulfilled from Central Store. Dispatch shows only the quantity actually selected for dispatch.
          </p>
        </div>

        <Button onClick={load} variant="ghost" className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          ['Requested', rows.filter((r) => r.status === 'REQUESTED').length],
          ['Approved', rows.filter((r) => r.status === 'APPROVED').length],
          ['In Transit', rows.filter((r) => r.status === 'IN_TRANSIT' || r.status === 'DISPATCHED').length],
          ['Received', rows.filter((r) => ['PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'RECONCILED', 'COMPLETED'].includes(r.status)).length],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-[#E4DED3] bg-white p-4 shadow-sm">
            <div className="text-[11px] uppercase tracking-wide text-[#77736B]">{label}</div>
            <div className="text-2xl font-bold mt-1">{value}</div>
          </div>
        ))}
      </div>

      {message && (
        <div className="mb-3 p-3 rounded-xl bg-white border border-[#E4DED3] text-xs font-medium">
          {message}
        </div>
      )}

      <section className="rounded-2xl border border-[#E4DED3] bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[#EEE9DF] flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {['ALL', 'REQUESTED', 'APPROVED', 'DISPATCHED', 'IN_TRANSIT', 'FULLY_RECEIVED', 'RECONCILED'].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilter(status)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border ${
                  filter === status
                    ? 'bg-[#F1E4C5] text-[#B8862D] border-[#B8862D]/30'
                    : 'bg-white text-[#707070] border-[rgba(45,45,45,.08)]'
                }`}
              >
                {status.replaceAll('_', ' ')}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C877E]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transfer / outlet / item"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E4DED3] bg-[#FAF8F5] text-sm outline-none"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-[#707070] flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading Central Store transfers…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8">
            <EmptyState title="No transfer found" description="Approved Central Store fulfilment requests will appear here." icon={<Truck className="w-6 h-6" />} />
          </div>
        ) : (
          <div className="divide-y divide-[#EEE9DF]">
            {filtered.map((row) => {
              const action = nextAction(row.status);
              const amount = amountOf(row);
              return (
                <div key={row.id} className="p-4 hover:bg-[#FFFCF7] transition-colors">
                  <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm">{row.transfer_number || 'Transfer'}</span>
                        <Badge variant="outlet">{row.status.replaceAll('_', ' ')}</Badge>
                      </div>
                      <div className="text-xs text-[#77736B] mt-1">
                        Central Store → {row.destination_branch_name || 'Outlet'}
                      </div>
                      <div className="flex flex-wrap gap-4 mt-2 text-xs text-[#4E4A44]">
                        <span>Items: <b>{row.items?.length || 0}</b></span>
                        <span>Value: <b>{money(amount)}</b></span>
                        {row.created_at && <span>{new Date(row.created_at).toLocaleString('en-IN')}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="ghost" onClick={() => setView(row)} className="gap-2">
                        <Eye className="w-4 h-4" /> View
                      </Button>

                      {action && (
                        <Button
                          onClick={() => updateStatus(row, action.next)}
                          disabled={acting === row.id}
                          className="gap-2"
                        >
                          {acting === row.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : action.next === 'DISPATCHED' ? (
                            <Send className="w-4 h-4" />
                          ) : action.next === 'COMPLETED' ? (
                            <PackageCheck className="w-4 h-4" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          {action.label}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {view && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setView(null)}>
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-[#EEE9DF] flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h2 className="font-bold">{view.transfer_number || 'Transfer'}</h2>
                <p className="text-xs text-[#77736B]">Central Store → {view.destination_branch_name || 'Outlet'}</p>
              </div>
              <Button variant="ghost" onClick={() => setView(null)}>Close</Button>
            </div>

            <div className="p-4">
              <div className="grid gap-2">
                {(view.items || []).map((item, index) => {
                  const qty = num(item.quantity ?? item.requested_qty);
                  const amount = qty * num(item.unit_cost);
                  return (
                    <div key={String(item.id || index)} className="rounded-xl border border-[#EEE9DF] p-3 bg-[#FAF8F5] grid grid-cols-[1fr_auto_auto] gap-4 items-center">
                      <div>
                        <div className="font-semibold text-sm">{item.item_name || 'Item'}</div>
                        <div className="text-[11px] text-[#77736B]">{item.item_code || '—'}</div>
                      </div>
                      <div className="text-right text-sm font-mono">
                        {qty} {item.unit_symbol || ''}
                      </div>
                      <div className="text-right text-sm font-mono font-semibold">
                        {money(amount)}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex justify-end">
                <div className="text-sm font-bold">Transfer Value: {money(amountOf(view))}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
