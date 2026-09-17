'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  RefreshCw,
  Search,
  Send,
  Truck,
  Warehouse,
  LockKeyhole,
  XCircle,
} from 'lucide-react';
import { reportsApi } from '@/api/reports';
import { apiClient } from '@/api/client';
import { inventoryApi, type StockCount } from '@/api/inventory';
import { useOutlet, getCurrentClosingPeriod } from '@/context/OutletContext';
import { useAuth } from '@/context/AuthContext';
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

interface MoneyMovement {
  id: string;
  reference: string;
  vendor?: string;
  status: string;
  amount: number;
  date?: string;
}

const money = (value: number) =>
  `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const num = (value: any) => Number(value ?? 0);
const unwrap = (response: any) => response?.data?.data ?? response?.data ?? response ?? [];

const extractStockRows = (payload: any): StockRow[] => {
  const source =
    payload?.items ||
    payload?.stock ||
    payload?.balances ||
    payload?.details ||
    payload?.stock_items ||
    [];

  if (!Array.isArray(source)) return [];

  return source.map((item: any, index: number) => {
    const quantity = num(
      item.quantity ??
        item.current_quantity ??
        item.currentQuantity ??
        item.stock_qty ??
        item.closing_qty,
    );
    const unitCost = num(
      item.unit_cost ??
        item.cost_price ??
        item.average_cost ??
        item.avg_cost ??
        item.unitPrice,
    );
    const value =
      num(
        item.total_valuation ??
          item.valuation ??
          item.stock_value ??
          item.total_value,
      ) || quantity * unitCost;

    return {
      id: String(item.id ?? item.item_id ?? index),
      item_id: item.item_id,
      item_name: item.item_name ?? item.name ?? item.item?.name ?? 'Unknown Item',
      item_code: item.item_code ?? item.code ?? item.item?.code,
      unit: item.unit_symbol ?? item.unit ?? item.item?.unit?.symbol,
      quantity,
      unit_cost: unitCost,
      value,
      min_stock_level: num(
        item.min_stock_level ?? item.minStockLevel ?? item.minimum_stock_level,
      ),
    };
  });
};

const extractTotalValuation = (payload: any, rows: StockRow[]) => {
  const direct =
    payload?.totalValuation ??
    payload?.total_valuation ??
    payload?.valuation ??
    payload?.totalStockValue;

  if (Number.isFinite(Number(direct))) return Number(direct);
  return rows.reduce((sum, row) => sum + row.value, 0);
};

const getTransferAmount = (transfer: any) => {
  const direct = num(
    transfer.total_amount ??
      transfer.amount ??
      transfer.total_value ??
      transfer.transfer_value,
  );
  if (direct > 0) return direct;

  return (Array.isArray(transfer.items) ? transfer.items : []).reduce(
    (sum: number, item: any) => {
      const qty = num(item.quantity ?? item.requested_qty ?? item.qty);
      const cost = num(item.unit_cost ?? item.cost_price ?? item.unit_price);
      return sum + qty * cost;
    },
    0,
  );
};

const isSameMonth = (dateValue?: string) => {
  if (!dateValue) return false;
  const d = new Date(dateValue);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

const CENTRAL_TRANSFER_STATUSES = [
  'REQUESTED',
  'APPROVED',
  'DISPATCHED',
  'IN_TRANSIT',
  'PARTIALLY_RECEIVED',
  'FULLY_RECEIVED',
  'RECONCILED',
];

const PURCHASE_STATUSES = [
  'APPROVED',
  'ISSUED',
  'WHATSAPP_OPENED',
  'SENT_MANUALLY',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
];

export default function CentralStoreStockWorkspace() {
  const { activeOutlet } = useOutlet();

  const [rows, setRows] = useState<StockRow[]>([]);
  const [valuation, setValuation] = useState(0);
  const [lowStock, setLowStock] = useState(0);

  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [receipts, setReceipts] = useState<MoneyMovement[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<MoneyMovement[]>([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState<'STOCK' | 'COUNT' | 'MOVEMENTS'>('STOCK');
  const [message, setMessage] = useState('');

  const centralBranchId = activeOutlet?.id;
  const closingInfo = getCurrentClosingPeriod();
  const { user } = useAuth();

  const [centralWarehouseId, setCentralWarehouseId] = useState('');
  const [stockCount, setStockCount] = useState<StockCount | null>(null);
  const [physicalQty, setPhysicalQty] = useState<Record<string, string>>({});
  const [countLoading, setCountLoading] = useState(false);
  const [countSaving, setCountSaving] = useState(false);

  const reviewRoles = new Set([
    'SUPER_ADMIN',
    'SUPERADMIN',
    'OWNER',
    'ADMIN',
    'HQ_ADMIN',
    'HEAD_OFFICE_ADMIN',
    'CENTRAL_PURCHASE_MANAGER',
    'CENTRAL_STORE_MANAGER',
    'GENERAL_MANAGER',
    'DIRECTOR',
  ]);
  const roleName = String(
    typeof user?.role === 'object' ? user?.role?.name : user?.role || '',
  ).trim().toUpperCase();
  const canReview = reviewRoles.has(roleName);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');

    try {
      const [inventoryResult, transferResults, grnResult, poResult] = await Promise.all([
        reportsApi
          .getInventoryValuation({ branchId: centralBranchId || undefined })
          .catch(() => null),

        Promise.all(
          CENTRAL_TRANSFER_STATUSES.map((status) =>
            apiClient
              .get('/procurement/central-store/queue', {
                params: { status_filter: status, branch_id: centralBranchId || undefined },
              })
              .catch(() => null),
          ),
        ),

        apiClient
          .get('/procurement/receiving', {
            params: { branch_id: centralBranchId || undefined },
          })
          .then(unwrap)
          .catch(() => []),

        apiClient
          .get('/procurement/orders', {
            params: { branch_id: centralBranchId || undefined },
          })
          .then(unwrap)
          .catch(() => []),
      ]);

      if (inventoryResult) {
        const normalized = unwrap(inventoryResult);
        const stockRows = extractStockRows(normalized);
        setRows(stockRows);
        setValuation(extractTotalValuation(normalized, stockRows));
        setLowStock(
          num(
            normalized?.lowStockItemsCount ??
              normalized?.low_stock_items_count ??
              stockRows.filter(
                (row) => row.min_stock_level > 0 && row.quantity <= row.min_stock_level,
              ).length,
          ),
        );
      } else {
        setRows([]);
        setValuation(0);
        setLowStock(0);
      }

      const mergedTransfers: any[] = [];
      transferResults.forEach((response: any) => {
        const data = unwrap(response);
        if (Array.isArray(data)) mergedTransfers.push(...data);
      });

      const uniqueTransfers = mergedTransfers.filter(
        (row, index, array) =>
          array.findIndex((other) => String(other.id) === String(row.id)) === index,
      );

      setTransfers(
        uniqueTransfers.map((row: any) => ({
          id: String(row.id),
          transfer_number: row.transfer_number,
          status: String(row.status || '').toUpperCase(),
          destination_branch_name:
            row.destination_branch_name ?? row.destination_branch?.name ?? row.to_branch_name,
          total_amount: getTransferAmount(row),
          created_at: row.created_at ?? row.transfer_date,
          items: row.items || [],
        })),
      );

      const grnList = Array.isArray(grnResult) ? grnResult : [];
      setReceipts(
        grnList
          .map((row: any) => ({
            id: String(row.id),
            reference: row.grn_number || row.id?.slice(0, 8),
            vendor: row.supplier_name,
            status: String(row.status || '').toUpperCase(),
            amount: num(row.total_amount ?? row.invoice_amount),
            date: row.created_at ?? row.receive_date,
          }))
          .filter((row) => row.amount >= 0),
      );

      const poList = Array.isArray(poResult) ? poResult : [];
      setPurchaseOrders(
        poList
          .filter((row: any) => PURCHASE_STATUSES.includes(String(row.status || '').toUpperCase()))
          .map((row: any) => ({
            id: String(row.id),
            reference: row.po_number || row.id?.slice(0, 8),
            vendor: row.supplier_name ?? row.supplier?.name,
            status: String(row.status || '').toUpperCase(),
            amount: num(row.net_amount ?? row.total_amount),
            date: row.created_at ?? row.order_date,
          })),
      );
    } catch (error: any) {
      setMessage(
        error?.response?.data?.detail ||
          error?.message ||
          'Central Store stock could not be loaded.',
      );
      setRows([]);
      setTransfers([]);
      setReceipts([]);
      setPurchaseOrders([]);
    } finally {
      setLoading(false);
    }
  }, [centralBranchId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadCentralWarehouse = useCallback(async () => {
    if (!centralBranchId) {
      setCentralWarehouseId('');
      return;
    }

    try {
      const warehouses = await inventoryApi.getWarehouses({ branch_id: centralBranchId });
      const active = (warehouses || []).filter((warehouse: any) => warehouse?.is_active !== false);
      const preferred = active.find((warehouse: any) => {
        const label = `${warehouse?.name || ''} ${warehouse?.code || ''}`.toLowerCase();
        return label.includes('central store') || label.includes('central');
      });
      setCentralWarehouseId(String((preferred || active[0] || warehouses?.[0])?.id || ''));
    } catch (error: any) {
      setCentralWarehouseId('');
      setMessage(
        error?.response?.data?.detail ||
          error?.message ||
          'Central Store warehouse could not be resolved.',
      );
    }
  }, [centralBranchId]);

  useEffect(() => {
    loadCentralWarehouse();
  }, [loadCentralWarehouse]);

  const loadCount = useCallback(async () => {
    if (!centralWarehouseId) {
      setStockCount(null);
      setPhysicalQty({});
      return;
    }

    setCountLoading(true);
    try {
      const counts = await inventoryApi.getStockCounts({ warehouse_id: centralWarehouseId });
      const periodCount = (counts || [])
        .filter((count) => {
          if (!count.count_date) return false;
          const countDate = new Date(count.count_date);
          return countDate >= new Date(closingInfo.startDate) && countDate <= new Date(closingInfo.endDate);
        })
        .sort((a, b) =>
          String(b.updated_at || b.created_at || '').localeCompare(
            String(a.updated_at || a.created_at || ''),
          ),
        )[0];

      setStockCount(periodCount || null);

      if (periodCount?.items?.length) {
        const nextPhysical: Record<string, string> = {};
        periodCount.items.forEach((item) => {
          nextPhysical[item.item_id] = String(item.physical_qty ?? '');
        });
        setPhysicalQty(nextPhysical);
      } else {
        setPhysicalQty({});
      }
    } catch (error: any) {
      setMessage(
        error?.response?.data?.detail ||
          error?.message ||
          'Central Store stock count could not be loaded.',
      );
    } finally {
      setCountLoading(false);
    }
  }, [centralWarehouseId, closingInfo.startDate, closingInfo.endDate]);

  useEffect(() => {
    if (activeSection === 'COUNT') {
      loadCount();
    }
  }, [activeSection, loadCount]);

  const countRows = useMemo(() => {
    if (stockCount?.items?.length) {
      return stockCount.items.map((item) => ({
        item_id: item.item_id,
        item_name: item.item_name || 'Item',
        item_code: item.item_code || '',
        unit_symbol: item.unit_symbol || '',
        system_qty: Number(item.system_qty || 0),
        unit_cost: Number(item.unit_cost || 0),
      }));
    }

    return rows
      .filter((row) => row.item_id)
      .map((row) => ({
        item_id: String(row.item_id),
        item_name: row.item_name || 'Item',
        item_code: row.item_code || '',
        unit_symbol: row.unit || '',
        system_qty: Number(row.quantity || 0),
        unit_cost: Number(row.unit_cost || 0),
      }));
  }, [rows, stockCount]);

  const countLocked =
    stockCount?.status === 'IN_PROGRESS' ||
    stockCount?.status === 'COMPLETED' ||
    stockCount?.status === 'CANCELLED';
  const countCompleted = stockCount?.status === 'COMPLETED';
  const countPending = stockCount?.status === 'IN_PROGRESS';
  const countRejected = stockCount?.status === 'CANCELLED';

  const startCount = async () => {
    if (!centralWarehouseId || !centralBranchId) {
      setMessage('Central Store stock warehouse is not configured.');
      return;
    }

    setCountSaving(true);
    setMessage('');
    try {
      const created = await inventoryApi.createStockCount({
        warehouse_id: centralWarehouseId,
        branch_id: centralBranchId,
        count_date: new Date().toISOString(),
        notes: `Central Store stock count - ${closingInfo.label}`,
      });
      setStockCount(created);
      setPhysicalQty({});
      setMessage(`Stock count ${created.count_number} started.`);
    } catch (error: any) {
      setMessage(
        error?.response?.data?.detail ||
          error?.message ||
          'Could not start Central Store stock count.',
      );
    } finally {
      setCountSaving(false);
    }
  };

  const submitCount = async () => {
    if (!stockCount) {
      await startCount();
      return;
    }

    const missing = countRows.some((row) => {
      const raw = physicalQty[row.item_id];
      return raw === undefined || raw.trim() === '' || Number(raw) < 0 || Number.isNaN(Number(raw));
    });

    if (missing) {
      setMessage('Please enter physical quantity for every Central Store stock item before submitting.');
      return;
    }

    setCountSaving(true);
    setMessage('');
    try {
      const updated = await inventoryApi.submitStockCount(stockCount.id, {
        notes: `Submitted for Central Store - ${closingInfo.label}`,
        items: countRows.map((row) => ({
          item_id: row.item_id,
          physical_qty: Number(physicalQty[row.item_id]),
          system_qty: row.system_qty,
          unit_cost: row.unit_cost,
        })),
      });
      setStockCount(updated);
      setMessage('Central Store stock count submitted for admin approval.');
    } catch (error: any) {
      setMessage(
        error?.response?.data?.detail ||
          error?.message ||
          'Central Store stock count submission failed.',
      );
    } finally {
      setCountSaving(false);
    }
  };

  const reviewCount = async (approved: boolean) => {
    if (!stockCount || !canReview) return;

    setCountSaving(true);
    setMessage('');
    try {
      const result = approved
        ? await inventoryApi.approveStockCount(stockCount.id, `Approved for Central Store - ${closingInfo.label}`)
        : await inventoryApi.rejectStockCount(
            stockCount.id,
            'Central Store stock count rejected. Please recount and resubmit.',
          );
      setStockCount(result);
      setMessage(
        approved
          ? 'Central Store stock count approved, reconciled and locked.'
          : 'Central Store stock count rejected. A new count can be started after recount.',
      );
      await load();
      await loadCount();
    } catch (error: any) {
      setMessage(
        error?.response?.data?.detail ||
          error?.message ||
          (approved ? 'Approval failed.' : 'Rejection failed.'),
      );
    } finally {
      setCountSaving(false);
    }
  };

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      `${row.item_name} ${row.item_code || ''} ${row.unit || ''}`
        .toLowerCase()
        .includes(query),
    );
  }, [rows, search]);

  const transferTotal = useMemo(
    () => transfers.reduce((sum, transfer) => sum + transfer.total_amount, 0),
    [transfers],
  );

  const pendingTransferValue = useMemo(
    () =>
      transfers
        .filter((transfer) =>
          ['REQUESTED', 'APPROVED', 'DISPATCHED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(
            transfer.status,
          ),
        )
        .reduce((sum, transfer) => sum + transfer.total_amount, 0),
    [transfers],
  );

  const transferredThisMonth = useMemo(
    () =>
      transfers
        .filter((transfer) => isSameMonth(transfer.created_at))
        .reduce((sum, transfer) => sum + transfer.total_amount, 0),
    [transfers],
  );

  const receivedThisMonth = useMemo(
    () =>
      receipts
        .filter((receipt) => isSameMonth(receipt.date))
        .reduce((sum, receipt) => sum + receipt.amount, 0),
    [receipts],
  );

  const approvedPurchaseValue = useMemo(
    () => purchaseOrders.reduce((sum, po) => sum + po.amount, 0),
    [purchaseOrders],
  );

  const receivedPurchaseValue = useMemo(
    () =>
      receipts
        .filter((receipt) => ['APPROVED', 'RECEIVED', 'QC_PASSED'].includes(receipt.status))
        .reduce((sum, receipt) => sum + receipt.amount, 0),
    [receipts],
  );

  return (
    <div className="w-full min-w-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Warehouse className="w-5 h-5 text-[#B8862D]" />
            <h2 className="text-base font-bold text-[#1C1C1C]">CENTRAL STORE STOCK</h2>
          </div>
          <p className="text-xs text-[#707070] mt-1">
            Central Store-এর actual stock, vendor receiving এবং outlet transfer control এক জায়গায়।
          </p>
        </div>

        <Button
          size="sm"
          variant="secondary"
          icon={<RefreshCw className="w-3.5 h-3.5" />}
          onClick={load}
        >
          Refresh
        </Button>
      </div>

      {message && (
        <div className="p-3 rounded-xl bg-white border border-red-200 text-xs font-medium text-red-700">
          {message}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard title="Current Stock Value" value={money(valuation)} icon={<Boxes className="w-4 h-4" />} />
        <StatCard title="Item Types" value={rows.length} icon={<Boxes className="w-4 h-4" />} />
        <StatCard title="Low Stock" value={lowStock} icon={<AlertTriangle className="w-4 h-4" />} />
        <StatCard title="Received This Month" value={money(receivedThisMonth)} icon={<ArrowDownToLine className="w-4 h-4" />} />
        <StatCard title="Transferred This Month" value={money(transferredThisMonth)} icon={<ArrowUpFromLine className="w-4 h-4" />} />
      </div>

      <div className="grid grid-cols-3 gap-2 p-1 bg-white rounded-xl border border-gray-200">
        {[
          ['STOCK', 'Current Stock'],
          ['COUNT', 'Stock Count'],
          ['MOVEMENTS', 'Stock Movement'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveSection(key as 'STOCK' | 'COUNT' | 'MOVEMENTS')}
            className={`px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${
              activeSection === key
                ? 'bg-[#F1E4C5] text-[#B8862D]'
                : 'text-[#707070] hover:bg-[#FAF8F5]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm text-[#707070]">Loading Central Store stock…</div>
      ) : activeSection === 'STOCK' ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#909090]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search item / code..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-[#B8862D]/20"
              />
            </div>
            <div className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-[#5B5B5B]">
              Pending outlet transfer value:{' '}
              <span className="text-[#1C1C1C]">{money(pendingTransferValue)}</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <div className="font-bold text-sm">Current Central Store Stock</div>
                <div className="text-[11px] text-[#777]">Current quantity × cost = current stock value</div>
              </div>
              <Boxes className="w-4 h-4 text-[#B8862D]" />
            </div>

            {visibleRows.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="No stock rows"
                  description="No Central Store stock records are available from the current valuation endpoint."
                  icon={<Boxes className="w-6 h-6" />}
                />
              </div>
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
                          <td className="px-4 py-3 text-right font-mono">
                            {row.quantity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3">{row.unit || '—'}</td>
                          <td className="px-4 py-3 text-right font-mono">{money(row.unit_cost)}</td>
                          <td className="px-4 py-3 text-right font-mono font-semibold">{money(row.value)}</td>
                          <td className="px-4 py-3">
                            <Badge variant={isLow ? 'danger' : 'success'}>{isLow ? 'LOW' : 'OK'}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : activeSection === 'COUNT' ? (
        <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-[#B8862D]">Physical Count</p>
              <h2 className="mt-1 text-lg font-bold">Central Store — {closingInfo.label}</h2>
              <p className="text-xs text-[#707070] mt-1">
                Central Store physical stock → submit → admin approval/rejection → approved = verified & locked.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(!stockCount || countRejected) && (
                <button
                  type="button"
                  onClick={startCount}
                  disabled={countSaving || countLoading || !centralWarehouseId}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C79A3B] text-white text-xs font-bold hover:bg-[#B8862D] disabled:opacity-60"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  {countRejected ? 'Start New Count' : 'Start Count'}
                </button>
              )}
              {stockCount?.status === 'DRAFT' && (
                <button
                  type="button"
                  onClick={submitCount}
                  disabled={countSaving || countLoading || !countRows.length}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2E8B57] text-white text-xs font-bold hover:bg-[#257348] disabled:opacity-60"
                >
                  <Send className="w-4 h-4" /> Submit Count
                </button>
              )}
              {stockCount && countPending && canReview && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => reviewCount(true)}
                    disabled={countSaving}
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#2E8B57] text-white text-xs font-bold disabled:opacity-60"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Approve & Lock
                  </button>
                  <button
                    type="button"
                    onClick={() => reviewCount(false)}
                    disabled={countSaving}
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#D9534F] text-white text-xs font-bold disabled:opacity-60"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              )}
            </div>
          </div>

          {countLoading ? (
            <div className="py-16 flex items-center justify-center text-[#707070] gap-3">
              <RefreshCw className="w-5 h-5 animate-spin text-[#C79A3B]" /> Loading Central Store count…
            </div>
          ) : !centralWarehouseId ? (
            <div className="py-16 text-center text-sm text-[#707070]">
              No active Central Store stock warehouse is configured.
            </div>
          ) : stockCount?.status === 'IN_PROGRESS' ? (
            <div className="px-4 py-3 bg-[#3978B8]/10 border-b border-[#3978B8]/20 text-xs text-[#245E93] font-medium flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4" /> Submitted and waiting for admin review.
            </div>
          ) : countCompleted ? (
            <div className="px-4 py-3 bg-[#2E8B57]/10 border-b border-[#2E8B57]/20 text-xs text-[#2E8B57] font-medium flex items-center gap-2">
              <LockKeyhole className="w-4 h-4" /> Approved, verified and locked. Central Store stock ledger has been reconciled to physical quantity.
            </div>
          ) : countRejected ? (
            <div className="px-4 py-3 bg-[#D9534F]/10 border-b border-[#D9534F]/20 text-xs text-[#A93F3A] font-medium flex items-center gap-2">
              <XCircle className="w-4 h-4" /> Rejected. Recount Central Store stock and start a new count for this period.
            </div>
          ) : !stockCount ? (
            <div className="px-4 py-10 sm:px-8 text-center text-sm text-[#707070]">
              No Central Store stock count has been started for this period.
            </div>
          ) : null}

          {stockCount && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-[#FAF8F5] text-[10px] uppercase tracking-wider text-[#707070]">
                  <tr>
                    <th className="px-4 py-3 text-left">Item</th>
                    <th className="px-4 py-3 text-right">System Qty</th>
                    <th className="px-4 py-3 text-right">Physical Qty</th>
                    <th className="px-4 py-3 text-right">Variance</th>
                    <th className="px-4 py-3 text-right">Variance Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
                  {countRows.map((row) => {
                    const raw = physicalQty[row.item_id];
                    const physical = raw === undefined || raw === '' ? null : Number(raw);
                    const variance = physical === null ? 0 : physical - row.system_qty;
                    const varianceValue = variance * row.unit_cost;
                    return (
                      <tr key={row.item_id}>
                        <td className="px-4 py-3">
                          <div className="font-semibold">{row.item_name}</div>
                          <div className="text-[11px] text-[#707070]">
                            {row.item_code || '—'} · {row.unit_symbol || 'UNIT'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {Number(row.system_qty || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={raw ?? ''}
                            disabled={countLocked || countSaving}
                            onChange={(event) =>
                              setPhysicalQty((prev) => ({
                                ...prev,
                                [row.item_id]: event.target.value,
                              }))
                            }
                            className="w-28 px-3 py-2 rounded-lg border border-gray-200 text-right outline-none focus:border-[#C79A3B] disabled:bg-[#F5F3EE] disabled:text-[#777]"
                          />
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold ${
                          variance > 0 ? 'text-[#2E8B57]' : variance < 0 ? 'text-[#D9534F]' : 'text-[#707070]'
                        }`}>
                          {physical === null ? '—' : `${variance > 0 ? '+' : ''}${Number(variance).toLocaleString('en-IN', { maximumFractionDigits: 3 })}`}
                        </td>
                        <td className={`px-4 py-3 text-right ${
                          varianceValue > 0 ? 'text-[#2E8B57]' : varianceValue < 0 ? 'text-[#D9534F]' : 'text-[#707070]'
                        }`}>
                          {physical === null ? '—' : money(varianceValue)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#707070]">Vendor Purchase Value</span>
                <ArrowDownToLine className="w-4 h-4 text-[#B8862D]" />
              </div>
              <div className="mt-2 text-lg font-bold">{money(approvedPurchaseValue)}</div>
              <div className="text-[11px] text-[#777] mt-1">Approved / issued Central Store POs</div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#707070]">Vendor Received Value</span>
                <CheckCircle2 className="w-4 h-4 text-[#3F8B57]" />
              </div>
              <div className="mt-2 text-lg font-bold">{money(receivedPurchaseValue)}</div>
              <div className="text-[11px] text-[#777] mt-1">Approved / received GRNs at Central Store</div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#707070]">Outlet Transfer Value</span>
                <Truck className="w-4 h-4 text-[#B8862D]" />
              </div>
              <div className="mt-2 text-lg font-bold">{money(transferTotal)}</div>
              <div className="text-[11px] text-[#777] mt-1">All Central Store → Outlet transfers</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <div className="font-bold text-sm">Central Store → Outlet Transfer Flow</div>
                <div className="text-[11px] text-[#777]">Request → Approved → Dispatch → In Transit → Receive → Reconcile</div>
              </div>
              <Truck className="w-4 h-4 text-[#B8862D]" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
              {[
                ['REQUESTED', 'Requested', transfers.filter((x) => x.status === 'REQUESTED').length],
                ['APPROVED', 'Approved', transfers.filter((x) => x.status === 'APPROVED').length],
                ['IN_TRANSIT', 'In Transit', transfers.filter((x) => x.status === 'IN_TRANSIT').length],
                ['RECEIVED', 'Received', transfers.filter((x) => ['PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'RECONCILED'].includes(x.status)).length],
              ].map(([key, label, count]) => (
                <div key={String(key)} className="rounded-xl bg-[#FAF8F5] p-3">
                  <div className="text-[10px] uppercase tracking-wider text-[#777]">{label}</div>
                  <div className="mt-1 text-lg font-bold">{count}</div>
                </div>
              ))}
            </div>

            {transfers.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#707070]">No Central Store → Outlet transfers found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] text-[#777]">
                    <tr>
                      <th className="px-4 py-3">Transfer</th>
                      <th className="px-4 py-3">Destination</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfers
                      .slice()
                      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
                      .slice(0, 30)
                      .map((transfer) => (
                        <tr key={transfer.id} className="border-t border-gray-100">
                          <td className="px-4 py-3 font-mono font-semibold">
                            {transfer.transfer_number || transfer.id.slice(0, 8)}
                          </td>
                          <td className="px-4 py-3 font-semibold">{transfer.destination_branch_name || 'Outlet'}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outlet">{transfer.status.replaceAll('_', ' ')}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold">{money(transfer.total_amount)}</td>
                          <td className="px-4 py-3 text-[#777]">
                            {transfer.created_at ? new Date(transfer.created_at).toLocaleDateString('en-IN') : '—'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <ArrowDownToLine className="w-4 h-4 text-[#3F8B57]" />
                <div>
                  <div className="font-bold text-sm">Vendor → Central Store</div>
                  <div className="text-[11px] text-[#777]">Purchase orders and receiving history</div>
                </div>
              </div>
              <div className="max-h-80 overflow-auto">
                {receipts.length === 0 ? (
                  <div className="p-6 text-sm text-[#777]">No receiving records found.</div>
                ) : (
                  receipts.slice(0, 20).map((receipt) => (
                    <div key={receipt.id} className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-xs truncate">{receipt.reference}</div>
                        <div className="text-[10px] text-[#777] truncate">{receipt.vendor || 'Vendor'} · {receipt.status.replaceAll('_', ' ')}</div>
                      </div>
                      <div className="text-xs font-mono font-semibold">{money(receipt.amount)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <Clock3 className="w-4 h-4 text-[#B8862D]" />
                <div>
                  <div className="font-bold text-sm">Inbound PO Pipeline</div>
                  <div className="text-[11px] text-[#777]">Approved Central Store purchase orders awaiting / in receiving</div>
                </div>
              </div>
              <div className="max-h-80 overflow-auto">
                {purchaseOrders.length === 0 ? (
                  <div className="p-6 text-sm text-[#777]">No active inbound purchase orders found.</div>
                ) : (
                  purchaseOrders.slice(0, 20).map((po) => (
                    <div key={po.id} className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-xs truncate">{po.reference}</div>
                        <div className="text-[10px] text-[#777] truncate">{po.vendor || 'Vendor'} · {po.status.replaceAll('_', ' ')}</div>
                      </div>
                      <div className="text-xs font-mono font-semibold">{money(po.amount)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
