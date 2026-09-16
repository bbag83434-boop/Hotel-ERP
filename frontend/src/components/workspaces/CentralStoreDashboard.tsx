'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Boxes,
  CalendarDays,
  ClipboardList,
  PackageCheck,
  RefreshCw,
  Send,
  Truck,
  Warehouse,
} from 'lucide-react';
import { apiClient } from '@/api/client';
import { reportsApi } from '@/api/reports';
import { procurementApi } from '@/api/procurement';
import { useOutlet } from '@/context/OutletContext';
import type { WorkspaceId } from '@/components/common/Sidebar';

interface DashboardOverviewProps {
  health?: any;
  setActiveWorkspace: (id: WorkspaceId) => void;
}

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

interface RequirementDraftRow {
  item_id: string;
  item_name: string;
  item_code?: string;
  unit?: string;
  current_stock: number;
  min_stock: number;
  requested_qty: number;
  supplier_name: string | null;
  vendor_configured: boolean;
  estimated_price: number;
}

const unwrap = (res: any) => res?.data?.data ?? res?.data ?? res ?? [];
const money = (value: any) =>
  `₹${Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })}`;
const num = (value: any) => Number(value ?? 0);

const extractStockRows = (payload: any): StockRow[] => {
  const source = payload?.items || payload?.stock || payload?.balances || payload?.details || [];
  if (!Array.isArray(source)) return [];

  return source.map((x: any, idx: number) => {
    const quantity = num(
      x.quantity ?? x.current_quantity ?? x.currentQuantity ?? x.stock_qty ?? x.closing_qty,
    );
    const unitCost = num(
      x.unit_cost ?? x.cost_price ?? x.average_cost ?? x.avg_cost ?? x.unitPrice,
    );
    const value =
      num(x.total_valuation ?? x.valuation ?? x.stock_value ?? x.total_value) ||
      quantity * unitCost;

    return {
      id: String(x.id ?? x.item_id ?? idx),
      item_id: String(x.item_id ?? x.item?.id ?? x.itemId ?? x.id ?? ''),
      item_name: x.item_name ?? x.name ?? x.item?.name ?? 'Unknown Item',
      item_code: x.item_code ?? x.code ?? x.item?.code,
      unit: x.unit_symbol ?? x.unit ?? x.item?.unit?.symbol,
      quantity,
      unit_cost: unitCost,
      value,
      min_stock_level: num(
        x.min_stock_level ?? x.minStockLevel ?? x.minimum_stock_level,
      ),
    };
  });
};

export default function CentralStoreDashboard({
  setActiveWorkspace,
}: DashboardOverviewProps) {
  const { activeOutlet } = useOutlet();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');

  const [stockValue, setStockValue] = useState(0);
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [pendingPurchaseRequests, setPendingPurchaseRequests] = useState(0);
  const [purchaseReceiving, setPurchaseReceiving] = useState(0);
  const [outletTransfers, setOutletTransfers] = useState(0);

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(
    'Ask me about Central Store stock only — low stock, zero stock, stock value, or a specific item.',
  );

  const [draftOpen, setDraftOpen] = useState(false);
  const [draftLines, setDraftLines] = useState<RequirementDraftRow[]>([]);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftSubmitting, setDraftSubmitting] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');

  const period = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.toLocaleString('en-IN', { month: 'short' });
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    return now.getDate() <= 15
      ? `${month} ${year} · 1–15`
      : `${month} ${year} · 16–${lastDay}`;
  }, []);

  const load = useCallback(
    async (manual = false) => {
      if (manual) setRefreshing(true);
      else setLoading(true);
      setMessage('');

      try {
        const centralStoreBranchId = activeOutlet?.id || undefined;

        const [stockRes, centralReqRes, grnRes, transferRes] = await Promise.all([
          reportsApi
            .getInventoryValuation({ branchId: centralStoreBranchId })
            .catch(() => null),

          apiClient
            .get('/procurement/requests', {
              params: { requisition_type: 'CENTRAL_STORE', status_filter: 'PENDING_APPROVAL' },
            })
            .then(unwrap)
            .catch(() => []),

          procurementApi
            .getGoodsReceiveNotes({ status_filter: 'PENDING_APPROVAL' })
            .catch(() => []),

          apiClient
            .get('/procurement/central-store/queue')
            .then(unwrap)
            .catch(() => []),
        ]);

        if (stockRes) {
          const normalized = unwrap(stockRes);
          const rows = extractStockRows(normalized);
          const directValuation = Number(
            normalized?.totalValuation ??
              normalized?.total_valuation ??
              normalized?.valuation ??
              normalized?.totalStockValue,
          );
          const valuation = Number.isFinite(directValuation)
            ? directValuation
            : rows.reduce((sum, row) => sum + row.value, 0);

          setStockRows(rows);
          setStockValue(valuation);
        } else {
          setStockRows([]);
          setStockValue(0);
        }

        const pendingReqRows = Array.isArray(centralReqRes) ? centralReqRes : unwrap(centralReqRes);
        setPendingPurchaseRequests(pendingReqRows.length);

        const pendingGrnRows = Array.isArray(grnRes) ? grnRes : unwrap(grnRes);
        setPurchaseReceiving(pendingGrnRows.length);

        const transferRows = Array.isArray(transferRes)
          ? transferRes
          : Array.isArray(transferRes?.items)
            ? transferRes.items
            : [];

        setOutletTransfers(
          transferRows.filter((row: any) =>
            ['REQUESTED', 'APPROVED', 'DISPATCHED', 'IN_TRANSIT'].includes(
              String(row?.status || '').toUpperCase(),
            ),
          ).length,
        );
      } catch (error: any) {
        setMessage(
          error?.response?.data?.detail ||
            error?.response?.data?.message ||
            'Central Store dashboard data could not be loaded.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeOutlet?.id],
  );

  useEffect(() => {
    load();
  }, [load]);

  const lowStockRows = useMemo(
    () =>
      stockRows
        .filter((row) => row.min_stock_level > 0 && row.quantity <= row.min_stock_level)
        .sort((a, b) => {
          const aGap = a.quantity - a.min_stock_level;
          const bGap = b.quantity - b.min_stock_level;
          return aGap - bGap;
        }),
    [stockRows],
  );

  const zeroStockRows = useMemo(
    () => stockRows.filter((row) => row.quantity <= 0),
    [stockRows],
  );

  const buildRequirementDraft = useCallback(async () => {
    setDraftLoading(true);
    setDraftMessage('');
    try {
      const catalog = await procurementApi.getCentralStoreRequirementCatalog();
      const catalogRows: any[] = Array.isArray(catalog) ? catalog : unwrap(catalog);
      const catalogMap = new Map(catalogRows.map((row: any) => [String(row.item_id), row]));
      const rows: RequirementDraftRow[] = lowStockRows
        .map((row): RequirementDraftRow => {
          const itemId = String(row.item_id || row.id || '');
          const cat = catalogMap.get(itemId);
          const gap = Math.max(0, Number(row.min_stock_level || 0) - Number(row.quantity || 0));
          return {
            item_id: itemId,
            item_name: row.item_name,
            item_code: row.item_code,
            unit: row.unit,
            current_stock: row.quantity,
            min_stock: row.min_stock_level,
            requested_qty: gap,
            supplier_name: cat?.supplier_name || null,
            vendor_configured: Boolean(cat?.vendor_configured),
            estimated_price: Number(row.unit_cost || 0),
          };
        })
        .filter((row) => row.item_id && row.requested_qty > 0);

      setDraftLines(rows);
      setDraftOpen(true);
      if (!rows.length) {
        setDraftMessage('No low-stock items require a new Central Store requirement right now.');
      }
    } catch (error: any) {
      setDraftMessage(error?.response?.data?.detail || error?.message || 'Could not prepare the requirement draft.');
      setDraftOpen(true);
    } finally {
      setDraftLoading(false);
    }
  }, [lowStockRows]);

  const updateDraftQty = (itemId: string, qty: number) => {
    setDraftLines((prev) => prev.map((row) => String(row.item_id) === String(itemId) ? { ...row, requested_qty: Math.max(0, qty) } : row));
  };

  const submitRequirementDraft = useCallback(async () => {
    const branchId = activeOutlet?.id;
    const valid = draftLines.filter((row) => row.item_id && Number(row.requested_qty) > 0);
    if (!branchId) {
      setDraftMessage('Central Store scope is not selected.');
      return;
    }
    if (!valid.length) {
      setDraftMessage('Review the draft and keep at least one item with quantity greater than zero.');
      return;
    }
    const missingVendor = valid.filter((row) => !row.vendor_configured);
    if (missingVendor.length) {
      setDraftMessage(`Vendor is not configured for: ${missingVendor.map((row) => row.item_name).join(', ')}. Configure the vendor first.`);
      return;
    }

    setDraftSubmitting(true);
    setDraftMessage('');
    try {
      const response = await apiClient.post('/procurement/central-store-requirements', {
        branch_id: branchId,
        priority: 'MEDIUM',
        notes: 'AI stock recommendation — reviewed by Central Store user before submission.',
        items: valid.map((row) => ({ item_id: row.item_id, requested_qty: Number(row.requested_qty) })),
      });
      const created = unwrap(response);
      const requestNumber = created?.request_number || created?.requestNumber || created?.id || '';
      setDraftMessage(`Requirement ${requestNumber} submitted to Admin for approval.`);
      setDraftOpen(false);
      setDraftLines([]);
      await load();
    } catch (error: any) {
      setDraftMessage(error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Requirement submission failed.');
    } finally {
      setDraftSubmitting(false);
    }
  }, [activeOutlet?.id, draftLines, load]);

  const runStockAssistant = useCallback(
    (rawQuestion: string) => {
      const q = rawQuestion.trim().toLowerCase();
      if (!q) return;

      const totalItems = stockRows.length;
      const totalQty = stockRows.reduce((sum, row) => sum + row.quantity, 0);

      let nextAnswer = '';

      if (q.includes('low') || q.includes('minimum') || q.includes('short')) {
        if (!lowStockRows.length) {
          nextAnswer = 'Central Store stock looks healthy: no item is currently at or below its configured minimum stock level.';
        } else {
          const lines = lowStockRows.slice(0, 8).map(
            (row) =>
              `• ${row.item_name}: ${row.quantity} ${row.unit || ''} (minimum ${row.min_stock_level} ${row.unit || ''})`,
          );
          nextAnswer = `Low-stock items in Central Store (${lowStockRows.length}):\n\n${lines.join('\n')}`;
        }
      } else if (
        q.includes('zero') ||
        q.includes('empty') ||
        q.includes('out of stock')
      ) {
        if (!zeroStockRows.length) {
          nextAnswer = 'There are no zero-stock items in the current Central Store stock data.';
        } else {
          const lines = zeroStockRows.slice(0, 10).map((row) => `• ${row.item_name}`);
          nextAnswer = `Zero-stock items (${zeroStockRows.length}):\n\n${lines.join('\n')}`;
        }
      } else if (
        q.includes('value') ||
        q.includes('valuation') ||
        q.includes('worth')
      ) {
        nextAnswer = `Current Central Store stock valuation is ${money(stockValue)} across ${totalItems} item types.`;
      } else if (
        q.includes('how many') ||
        q.includes('item count') ||
        q.includes('items')
      ) {
        nextAnswer = `Central Store currently has ${totalItems} item types with a combined quantity of ${totalQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })}.`;
      } else {
        const exact = stockRows.find(
          (row) =>
            row.item_name.toLowerCase().includes(q) ||
            String(row.item_code || '').toLowerCase().includes(q),
        );

        if (exact) {
          const status =
            exact.min_stock_level > 0 && exact.quantity <= exact.min_stock_level
              ? 'LOW STOCK'
              : 'OK';
          nextAnswer = `${exact.item_name}: ${exact.quantity} ${exact.unit || ''} available, stock value ${money(exact.value)}, minimum ${exact.min_stock_level || 0} ${exact.unit || ''}. Status: ${status}.`;
        } else {
          nextAnswer =
            'I only use Central Store stock data here. Try: “low stock”, “zero stock”, “stock value”, “how many items”, or enter an item name/code.';
        }
      }

      setAnswer(nextAnswer);
    },
    [lowStockRows, stockRows, stockValue, zeroStockRows],
  );

  const cards = [
    {
      label: 'Stock Valuation',
      value: money(stockValue),
      helper: 'Current Central Store stock',
      icon: Boxes,
      action: () => setActiveWorkspace('centralStoreStock'),
    },
    {
      label: 'Purchase Requests',
      value: String(pendingPurchaseRequests),
      helper: 'Pending Central Store approvals',
      icon: ClipboardList,
      action: () => setActiveWorkspace('centralStore'),
    },
    {
      label: 'Purchase Receiving',
      value: String(purchaseReceiving),
      helper: 'Bills / GRNs awaiting approval',
      icon: PackageCheck,
      action: () => setActiveWorkspace('centralStorePurchaseReceiving'),
    },
    {
      label: 'Outlet Transfers',
      value: String(outletTransfers),
      helper: 'Requests moving to outlets',
      icon: Truck,
      action: () => setActiveWorkspace('centralStoreTransfer'),
    },
    {
      label: 'Own Requirement',
      value: 'Open',
      helper: 'Create Central Store requirement',
      icon: Warehouse,
      action: () => setActiveWorkspace('centralStoreRequirement'),
    },
    {
      label: 'Bi-Monthly Closing',
      value: period,
      helper: '1–15 / 16–month end',
      icon: CalendarDays,
      action: () => setActiveWorkspace('closing'),
    },
  ];

  return (
    <div className="w-full max-w-[1180px] mx-auto px-1 sm:px-2 pb-16 text-[#18233A]">
      <section className="bg-white rounded-2xl border border-[#E7E1D7] shadow-sm p-4 sm:p-5 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-[#FFF5DC] border border-[#E8D6A8] flex items-center justify-center shrink-0">
              <Warehouse className="w-5 h-5 text-[#B8862D]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold truncate">Central Store</h1>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[#F1E4C5] text-[#7A5B17]">
                  CENTRAL_STORE
                </span>
              </div>
              <p className="text-xs text-[#707070] mt-1">
                Central Store operational dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E7E1D7] text-[11px] font-semibold text-[#6D6A64]">
              <CalendarDays className="w-3.5 h-3.5 text-[#B8862D]" />
              {period}
            </span>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing}
              className="w-9 h-9 rounded-xl border border-[#E4DED2] bg-white flex items-center justify-center hover:bg-[#FFF9EC] disabled:opacity-50"
              title="Refresh dashboard"
              aria-label="Refresh dashboard"
            >
              <RefreshCw
                className={`w-4 h-4 text-[#B8862D] ${refreshing ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>

        {message && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {message}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              type="button"
              onClick={card.action}
              className="text-left bg-white rounded-2xl border border-[#E7E1D7] p-4 hover:shadow-md hover:border-[#D7B96F] transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFF5DC] border border-[#E8D6A8] flex items-center justify-center">
                  <Icon className="w-5 h-5 text-[#B8862D]" />
                </div>
                <span className="text-[10px] text-[#8A867E]">
                  {loading ? 'Loading…' : 'Open'}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold text-[#55514A]">{card.label}</p>
              <p className="mt-1 text-xl font-bold text-[#18233A] break-words">{card.value}</p>
              <p className="mt-1 text-[11px] text-[#858178]">{card.helper}</p>
              <div className="mt-3 text-[11px] font-semibold text-[#B8862D]">
                Open module →
              </div>
            </button>
          );
        })}
      </section>

      <section className="bg-white rounded-2xl border border-[#E7E1D7] shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-[#EFEAE1] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFF5DC] border border-[#E8D6A8] flex items-center justify-center">
              <Bot className="w-5 h-5 text-[#B8862D]" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Central Store Stock Assistant</h2>
              <p className="text-[11px] text-[#7B776F] mt-0.5">
                Stock-only assistant · no sales, POS, kitchen or outlet data
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              ['Low stock', 'low stock'],
              ['Zero stock', 'zero stock'],
              ['Stock value', 'stock value'],
            ].map(([label, q]) => (
              <button
                key={q}
                type="button"
                onClick={() => runStockAssistant(q)}
                className="px-3 py-1.5 rounded-lg border border-[#E4DED2] bg-[#FAF8F5] text-[11px] font-semibold text-[#5C584F] hover:bg-[#FFF9EC]"
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={buildRequirementDraft}
              disabled={draftLoading}
              className="px-3 py-1.5 rounded-lg bg-[#1C1C1C] text-white text-[11px] font-semibold hover:bg-black disabled:opacity-50"
            >
              {draftLoading ? 'Preparing…' : 'Create Requirement'}
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="rounded-xl bg-[#FAF8F5] border border-[#EEE8DD] p-4 text-xs leading-5 whitespace-pre-line min-h-[92px]">
            {answer}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  runStockAssistant(question);
                  setQuestion('');
                }
              }}
              placeholder="Ask about Central Store stock..."
              className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-[#E4DED2] bg-white text-xs outline-none focus:ring-2 focus:ring-[#B8862D]/15"
            />
            <button
              type="button"
              onClick={() => {
                runStockAssistant(question);
                setQuestion('');
              }}
              className="w-11 rounded-xl bg-[#1C1C1C] text-white flex items-center justify-center hover:bg-black"
              title="Ask"
              aria-label="Ask stock assistant"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          {draftMessage && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {draftMessage}
            </div>
          )}

          {draftOpen && (
            <div className="mt-4 rounded-2xl border border-[#E7E1D7] bg-[#FFFCF5] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#EEE8DD] flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold">AI Requirement Draft — Review Before Submit</h3>
                  <p className="text-[11px] text-[#7B776F] mt-1">AI only recommends quantity from Central Store stock. The final requirement remains under your control.</p>
                </div>
                <button type="button" onClick={() => setDraftOpen(false)} className="text-xs font-semibold text-[#7B776F]">Close</button>
              </div>
              <div className="p-3 space-y-2">
                {draftLines.length === 0 ? (
                  <div className="text-xs text-[#7B776F] py-3">No draft items.</div>
                ) : (
                  draftLines.map((row) => (
                    <div key={row.item_id} className="grid grid-cols-[1fr_90px_80px_1fr] gap-2 items-center rounded-xl border border-[#EEE8DD] bg-white p-2.5">
                      <div>
                        <div className="text-xs font-semibold">{row.item_name}</div>
                        <div className="text-[10px] text-[#8A867E]">Stock {row.current_stock} {row.unit || ''} · Min {row.min_stock} {row.unit || ''}</div>
                      </div>
                      <input type="number" min="0" step="0.001" value={row.requested_qty} onChange={(e) => updateDraftQty(row.item_id, Number(e.target.value) || 0)} className="px-2 py-2 rounded-lg border border-[#E4DED2] text-xs font-mono" />
                      <span className="px-2 py-2 rounded-lg bg-[#F1E4C5]/60 text-[#7A5B17] text-xs text-center">{row.unit || 'Unit'}</span>
                      <div className={`text-[10px] font-semibold ${row.vendor_configured ? 'text-[#2F6B3B]' : 'text-red-600'}`}>
                        {row.vendor_configured ? `Vendor: ${row.supplier_name}` : 'Vendor not configured'}
                      </div>
                    </div>
                  ))
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setDraftOpen(false)} className="px-3 py-2 rounded-xl border border-[#E4DED2] text-xs font-semibold">Cancel</button>
                  <button type="button" onClick={submitRequirementDraft} disabled={draftSubmitting || !draftLines.length} className="px-3 py-2 rounded-xl bg-[#1C1C1C] text-white text-xs font-semibold disabled:opacity-50">
                    {draftSubmitting ? 'Submitting…' : 'Submit to Admin'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-[#EEE8DD] p-3">
              <div className="text-[10px] uppercase tracking-wider text-[#7B776F]">Item Types</div>
              <div className="mt-1 text-lg font-bold">{stockRows.length}</div>
            </div>
            <div className="rounded-xl border border-[#EEE8DD] p-3">
              <div className="text-[10px] uppercase tracking-wider text-[#7B776F]">Low Stock</div>
              <div className="mt-1 text-lg font-bold">{lowStockRows.length}</div>
            </div>
            <div className="rounded-xl border border-[#EEE8DD] p-3">
              <div className="text-[10px] uppercase tracking-wider text-[#7B776F]">Zero Stock</div>
              <div className="mt-1 text-lg font-bold">{zeroStockRows.length}</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
