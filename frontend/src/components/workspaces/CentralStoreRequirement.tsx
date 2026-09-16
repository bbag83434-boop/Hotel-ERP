'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutlet } from '@/context/OutletContext';
import { useAuth } from '@/context/AuthContext';
import { procurementApi } from '@/api/procurement';
import { apiClient } from '@/api/client';
import { organizationApi } from '@/api/organization';
import {
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Trash2,
  FileText,
  Warehouse,
} from 'lucide-react';
import { Badge, Button, SearchInput, AlertBanner, EmptyState } from '@/components/ui';

export const HQ_APPROVER_ROLES = [
  'SUPER_ADMIN',
  'SUPERADMIN',
  'OWNER',
  'HQ_ADMIN',
  'HEAD_OFFICE_ADMIN',
  'CENTRAL_PURCHASE_MANAGER',
  'GENERAL_MANAGER',
  'DIRECTOR',
];

const statusBadge: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'Draft', cls: 'bg-gray-100 text-gray-700' },
  PENDING_APPROVAL: { label: 'Pending Approval', cls: 'bg-amber-100 text-amber-800' },
  APPROVED: { label: 'Approved', cls: 'bg-green-100 text-green-800' },
  REJECTED: { label: 'Rejected', cls: 'bg-red-100 text-red-800' },
  ORDERED: { label: 'Ordered', cls: 'bg-indigo-100 text-indigo-800' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-red-100 text-red-700' },
};

const num = (v: any) => Number(v ?? 0);
const fmtQty = (v: any) => num(v).toLocaleString('en-IN');
const fmtDate = (v?: string | null) => {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return v;
  }
};

interface CsLine {
  item_id: string;
  requested_qty: number;
  notes?: string;
}

const unwrapArray = (value: any): any[] => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.results)) return value.results;
  return [];
};

/**
 * Central Store OWN Requirement.
 *
 * Important scope rule:
 * The form selects its own CENTRAL_STORE branch. It does NOT depend on the
 * Admin/HQ GLOBAL outlet scope selector. This keeps Central Store independent
 * from the normal outlet scope.
 */
export const CentralStoreRequirement: React.FC = () => {
  const { activeOutlet, isHeadOffice } = useOutlet();
  const { user } = useAuth();

  const userRole = typeof user?.role === 'object'
    ? (user.role?.name || '')
    : (user?.role || '');

  const isHq =
    HQ_APPROVER_ROLES.includes(String(userRole).trim().toUpperCase()) ||
    Boolean(isHeadOffice);

  const isCentralStoreScope = Boolean(
    activeOutlet?.id && String(activeOutlet.type || '').toUpperCase() === 'CENTRAL_STORE'
  );

  const [catalog, setCatalog] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [vendorItems, setVendorItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [branchId, setBranchId] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<CsLine[]>([
    { item_id: '', requested_qty: 1, notes: '' },
  ]);

  const selectedCentralStore = useMemo(
    () => entries.find((b) => String(b.id) === String(branchId)) || null,
    [entries, branchId]
  );

  const updateLine = (idx: number, patch: Partial<CsLine>) =>
    setLineItems((prev) =>
      prev.map((line, i) => (i === idx ? { ...line, ...patch } : line))
    );

  const loadCentralStoreBranches = useCallback(async () => {
    // Do NOT send branch_type here. Some deployments of the organization API
    // return an empty result for that filtered call. We fetch the normal branch
    // list and filter CENTRAL_STORE on the client instead.
    const response = await organizationApi.getBranches({});
    const allBranches = unwrapArray(response);

    const centralStores = allBranches.filter((b) => {
      const type = String(b?.type || b?.branch_type || '').toUpperCase();
      const active = b?.is_active;
      return type === 'CENTRAL_STORE' && active !== false;
    });

    setEntries(centralStores);

    const scopedCentralStore =
      isCentralStoreScope && activeOutlet?.id
        ? centralStores.find((b) => String(b.id) === String(activeOutlet.id))
        : null;

    const preferred = scopedCentralStore || centralStores[0] || null;
    if (preferred?.id) {
      setBranchId((current) =>
        current && centralStores.some((b) => String(b.id) === String(current))
          ? current
          : String(preferred.id)
      );
    } else {
      setBranchId('');
    }

    return centralStores;
  }, [activeOutlet?.id, isCentralStoreScope]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [catResponse, inventoryResponse, vendorItemsResponse] = await Promise.all([
        procurementApi.getCentralStoreRequirementCatalog().catch(() => []),
        apiClient.get('/inventory/items').catch(() => ({ data: [] })),
        apiClient.get('/procurement/vendor-items', { params: { is_active: true } }).catch(() => ({ data: [] })),
        loadCentralStoreBranches(),
      ]);

      const catalogRows = unwrapArray(catResponse);
      setCatalog(catalogRows);
      const inventoryRows = unwrapArray(inventoryResponse);
      setInventoryItems(inventoryRows);
      const vendorRows = unwrapArray(vendorItemsResponse);
      setVendorItems(vendorRows);

      const params: any = {};
      // For the Central Store page, non-HQ users are scoped to their actual
      // Central Store branch. HQ/Admin can see all Central Store requirements.
      if (!isHq && isCentralStoreScope && activeOutlet?.id) {
        params.branch_id = activeOutlet.id;
      }
      if (statusFilter !== 'ALL') params.status_filter = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const listResponse = await procurementApi
        .getCentralStoreRequirements(params)
        .catch(() => []);

      setRequirements(unwrapArray(listResponse));

      const stores = await loadCentralStoreBranches().catch(() => []);
      if (stores.length === 0) {
        setFeedback({
          type: 'error',
          message: 'No active Central Store branch was found. Create/activate a branch with type CENTRAL_STORE first.',
        });
      } else {
        setFeedback((current) =>
          current?.message?.startsWith('No active Central Store') ? null : current
        );
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message:
          err?.response?.data?.detail ||
          err?.message ||
          'Failed to load Central Store requirement data.',
      });
    } finally {
      setLoading(false);
    }
  }, [
    activeOutlet?.id,
    isCentralStoreScope,
    isHq,
    loadCentralStoreBranches,
    searchQuery,
    statusFilter,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const catalogItemById = (itemId: string) =>
    (itemId ? catalog.find((c) => c.item_id === itemId) : null) || null;

  const inventoryItemById = (itemId: string) =>
    (itemId ? inventoryItems.find((item) => String(item?.id) === String(itemId)) : null) || null;

  const unitPriceByItemId = (itemId: string) => {
    const activeMappings = vendorItems.filter(
      (mapping) =>
        String(mapping?.item_id) === String(itemId) &&
        mapping?.is_active !== false
    );
    const preferred = activeMappings.find((mapping) => Boolean(mapping?.is_preferred));
    const mapping = preferred || activeMappings[0];
    const mappedPrice = Number(mapping?.purchase_price ?? 0);
    if (Number.isFinite(mappedPrice) && mappedPrice > 0) return mappedPrice;

    const item = inventoryItemById(itemId);
    const costPrice = Number(item?.cost_price ?? item?.costPrice ?? 0);
    if (Number.isFinite(costPrice) && costPrice > 0) return costPrice;

    const catalogRow = catalogItemById(itemId);
    return Number(
      catalogRow?.purchase_price ??
        catalogRow?.supplier_price ??
        catalogRow?.unit_price ??
        catalogRow?.purchase_rate ??
        catalogRow?.cost_price ??
        0
    ) || 0;
  };

  const vendorStatus = (itemId: string) => {
    const row = catalogItemById(itemId);
    if (!row) return { configured: false, source: 'NOT_CONFIGURED', name: null };
    return {
      configured: Boolean(row.vendor_configured),
      source: row.vendor_source,
      name: row.supplier_name,
    };
  };

  const handleCreate = async () => {
    if (!branchId) {
      setFeedback({
        type: 'error',
        message: 'Central Store is not selected yet. Please choose the Central Store branch.',
      });
      return;
    }

    const validLines = lineItems.filter(
      (line) => line.item_id && line.requested_qty > 0
    );

    if (validLines.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Add at least one item with quantity greater than zero.',
      });
      return;
    }

    const missingVendor = validLines.filter(
      (line) => !vendorStatus(line.item_id).configured
    );

    if (missingVendor.length > 0) {
      const names = missingVendor
        .map((line) => {
          const c = catalogItemById(line.item_id);
          return c ? c.item_name : line.item_id;
        })
        .join(', ');

      setFeedback({
        type: 'error',
        message:
          `Vendor is not configured for this item: ${names}. ` +
          'Assign a preferred vendor in Item/Vendor Master and retry.',
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const created = await procurementApi.createCentralStoreRequirement({
        branch_id: branchId,
        priority,
        notes: notes.trim() || undefined,
        items: validLines.map((line) => ({
          item_id: line.item_id,
          requested_qty: line.requested_qty,
          estimated_price: unitPriceByItemId(line.item_id),
          notes: line.notes?.trim() || undefined,
        })),
      });

      const label =
        (created as any)?.request_number ||
        (created as any)?.requestNumber ||
        '';

      setFeedback({
        type: 'success',
        message: `Central Store Requirement ${label} submitted for approval.`,
      });
      setShowCreate(false);
      setNotes('');
      setLineItems([{ item_id: '', requested_qty: 1, notes: '' }]);
      await fetchData();
    } catch (err: any) {
      let msg = err?.response?.data?.detail || 'Failed to submit requirement.';
      if (typeof msg === 'string' && msg.toLowerCase().includes('vendor')) {
        msg =
          'Vendor is not configured for one of the selected items. Assign a preferred vendor in Item/Vendor Master and retry.';
      }
      setFeedback({ type: 'error', message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (req: any) => {
    setActingId(req.id);
    try {
      await procurementApi.approvePurchaseRequest(req.id);
      setFeedback({
        type: 'success',
        message: `Requirement ${req.request_number} approved.`,
      });
      await fetchData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail || 'Approval failed.',
      });
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (req: any) => {
    const reason = window.prompt(
      `Rejection reason for ${req.request_number}:`,
      'Not required this cycle'
    );
    if (reason === null || !reason.trim()) return;

    setActingId(req.id);
    try {
      await procurementApi.rejectPurchaseRequest(req.id, {
        reason: reason.trim(),
      });
      setFeedback({
        type: 'success',
        message: `Requirement ${req.request_number} rejected.`,
      });
      await fetchData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail || 'Rejection failed.',
      });
    } finally {
      setActingId(null);
    }
  };

  const renderCreateForm = () => (
    <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-sm">New Central Store Requirement</h3>
          <p className="text-[11px] text-[#707070] mt-1">
            This requirement belongs to the selected Central Store itself — not to an outlet.
          </p>
        </div>
        {selectedCentralStore && (
          <div className="px-3 py-2 rounded-xl bg-[#F1E4C5]/50 text-xs font-bold text-[#7A5B17]">
            Central Store: {selectedCentralStore.name}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-[#707070] uppercase mb-1">
            Central Store *
          </label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs"
          >
            <option value="">-- Choose Central Store --</option>
            {entries.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} {b.code ? `(${b.code})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#707070] uppercase mb-1">
            Priority
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs"
          >
            {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-[#707070] uppercase mb-1">
          Items *
        </label>
        <div className="hidden md:grid grid-cols-[1fr_110px_90px_1fr_110px_40px] gap-2 px-2 py-2 text-[10px] font-bold uppercase tracking-wide text-[#8A8A8A] border border-b-0 bg-[#FAF8F5] rounded-t-xl">
          <div>Item</div>
          <div className="text-right">Qty</div>
          <div className="text-center">Unit</div>
          <div>Vendor</div>
          <div className="text-right">Amount</div>
          <div />
        </div>
        <div className="divide-y divide-gray-100 border rounded-b-xl">
          {lineItems.map((line, idx) => {
            const cRow = catalogItemById(line.item_id);
            const vs = vendorStatus(line.item_id);
            const displayUnit = cRow?.unit_symbol || 'Unit';
            const unitPrice = unitPriceByItemId(line.item_id);
            const lineAmount = Math.max(0, Number(line.requested_qty || 0)) * Math.max(0, unitPrice);

            return (
              <div
                key={idx}
                className="p-2 grid grid-cols-1 md:grid-cols-[1fr_110px_90px_1fr_110px_40px] gap-2 items-center"
              >
                <select
                  value={line.item_id}
                  onChange={(e) => updateLine(idx, { item_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs"
                >
                  <option value="">-- Choose Item --</option>
                  {catalog.map((it) => (
                    <option key={it.item_id} value={it.item_id}>
                      {it.item_name} ({it.item_code})
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={line.requested_qty}
                  onChange={(e) =>
                    updateLine(idx, {
                      requested_qty: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs font-mono"
                  title="Required Qty"
                />

                <span className="inline-flex items-center justify-center px-3 py-2 rounded-lg bg-[#F1E4C5]/60 text-[#B8862D] text-xs font-semibold">
                  {displayUnit}
                </span>

                {vs.configured ? (
                  <span
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-[#EAF5EA] text-[#2F6B3B] text-xs font-semibold truncate"
                    title={`Auto-resolved via ${String(vs.source).replaceAll('_', ' ')}`}
                  >
                    <Warehouse className="w-3 h-3" /> {vs.name}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-[#FDECEC] text-red-600 text-[11px] font-semibold">
                    <XCircle className="w-3 h-3" /> Vendor is not configured for this item.
                  </span>
                )}

                <div className="px-3 py-2 rounded-lg bg-[#FAF8F5] text-right font-mono text-xs font-semibold text-[#1C1C1C] border border-[rgba(45,45,45,0.08)]">
                  ₹{lineAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </div>

                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() =>
                    setLineItems(lineItems.filter((_, i) => i !== idx))
                  }
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mt-1 text-[10px] text-[#707070]">
          Vendor and purchase rate are auto-read from Item/Vendor Master. Amount = Qty × Purchase Rate.
          Items without a vendor cannot be submitted.
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-2"
          onClick={() =>
            setLineItems([
              ...lineItems,
              { item_id: '', requested_qty: 1, notes: '' },
            ])
          }
          icon={<Plus className="w-3.5 h-3.5" />}
        >
          Add Item
        </Button>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-[#707070] uppercase mb-1">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Optional context for the approver"
          className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs focus:outline-none focus:border-[#C79A3B]"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setShowCreate(false)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          loading={submitting}
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={handleCreate}
        >
          Submit Requirement
        </Button>
      </div>
    </div>
  );

  const renderRow = (req: any) => {
    const badge =
      statusBadge[req.status] || {
        label: req.status,
        cls: 'bg-gray-100 text-gray-700',
      };
    const lines = Array.isArray(req.items) ? req.items : [];

    return (
      <div
        key={req.id}
        className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-[#FAF8F5]/50 transition-colors border-b border-gray-100 last:border-0"
      >
        <div className="min-w-0 space-y-1 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-xs text-[#1C1C1C] font-mono">
              {req.request_number}
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${badge.cls}`}
            >
              {badge.label}
            </span>
            {req.branch_name && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)] font-semibold">
                {req.branch_name}
              </span>
            )}
          </div>

          {lines.length > 0 && (
            <div className="overflow-x-auto mt-1">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="text-[#9A9A9A]">
                    <th className="py-1 px-2 text-left">Item</th>
                    <th className="py-1 px-2 text-right">Required Qty</th>
                    <th className="py-1 px-2 text-left">Unit</th>
                    <th className="py-1 px-2 text-left">Vendor</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((itm: any) => (
                    <tr
                      key={itm.id || `${req.id}-${itm.item_id}`}
                      className="border-b border-gray-50 last:border-0"
                    >
                      <td className="py-1 px-2 font-medium text-[#1C1C1C]">
                        {itm.item_name || itm.item?.name || itm.item_id}
                        {itm.item_code ? (
                          <span className="text-[#9A9A9A]"> ({itm.item_code})</span>
                        ) : null}
                      </td>
                      <td className="py-1 px-2 text-right font-mono text-[#1C1C1C]">
                        {fmtQty(itm.requested_qty || itm.requestedQty)}
                      </td>
                      <td className="py-1 px-2 text-[#707070]">
                        {itm.unit_symbol || itm.unit || '—'}
                      </td>
                      <td className="py-1 px-2">
                        {itm.supplier_name ? (
                          <span className="inline-flex items-center gap-1 text-[#2F6B3B]">
                            <Warehouse className="w-3 h-3" /> {itm.supplier_name}
                          </span>
                        ) : (
                          <span className="text-red-600">
                            Vendor is not configured for this item.
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="text-[10px] text-[#9A9A9A]">
            <span>
              By <b className="text-[#1C1C1C]">{req.requested_by?.email || req.requested_by_id}</b>
            </span>
            <span> · {fmtDate(req.created_at || req.createdAt)}</span>
            <span>
              {' '}
              · Priority <b className="text-[#1C1C1C]">{req.priority}</b>
            </span>
            {req.rejection_reason && (
              <span className="text-red-600">
                {' '}
                Reason: {req.rejection_reason}
              </span>
            )}
            {req.notes && <span> · {req.notes}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isHq && req.status === 'PENDING_APPROVAL' && (
            <>
              <Button
                size="sm"
                variant="success"
                loading={actingId === req.id}
                onClick={() => handleApprove(req)}
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="danger"
                loading={actingId === req.id}
                onClick={() => handleReject(req)}
                icon={<XCircle className="w-3.5 h-3.5" />}
              >
                Reject
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full min-w-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#1C1C1C]">
            CENTRAL STORE REQUIREMENT
          </h2>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <p className="text-xs text-[#707070]">
              Central Store own requirement · NOT an outlet requirement · Vendor auto-selected from Item/Vendor Master.
            </p>
            {selectedCentralStore && (
              <span className="text-[10px] px-2 py-1 rounded-full bg-[#F1E4C5]/70 text-[#7A5B17] font-bold">
                {selectedCentralStore.name}
                {selectedCentralStore.code ? ` · ${selectedCentralStore.code}` : ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={fetchData}
          >
            Refresh
          </Button>
          {(!isHq && isCentralStoreScope) || isHq ? (
            <Button
              size="sm"
              variant="primary"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setShowCreate(!showCreate)}
            >
              {showCreate ? 'Close' : 'New Requirement'}
            </Button>
          ) : (
            <Badge
              variant="warning"
              icon={<Warehouse className="w-3 h-3" />}
            >
              Central Store scope required
            </Badge>
          )}
        </div>
      </div>

      {feedback && (
        <AlertBanner feedback={feedback} onClose={() => setFeedback(null)} />
      )}

      {showCreate && renderCreateForm()}

      <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            {(['ALL', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'] as const).map(
              (f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border ${
                    statusFilter === f
                      ? 'bg-[#F1E4C5] text-[#B8862D] border-[#B8862D]/30'
                      : 'bg-white text-[#707070] border-[rgba(45,45,45,.08)]'
                  }`}
                >
                  {f.replace(/_/g, ' ')}
                </button>
              )
            )}
          </div>

          <SearchInput
            className="ml-auto"
            placeholder="Search request no / notes"
            value={searchQuery}
            onChangeValue={setSearchQuery}
          />
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="p-8 text-center text-sm text-[#707070]">
              Loading Central Store requirements…
            </div>
          ) : requirements.length === 0 ? (
            <EmptyState
              title="No requirements"
              description="No Central Store requirements match the current filter."
              icon={<FileText className="w-6 h-6" />}
            />
          ) : (
            <div className="divide-y divide-gray-100">
              {requirements.map(renderRow)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CentralStoreRequirement;
