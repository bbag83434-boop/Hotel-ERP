'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useOutlet } from '@/context/OutletContext';
import { useAuth } from '@/context/AuthContext';
import { procurementApi } from '@/api/procurement';
import { organizationApi } from '@/api/organization';
import { inventoryApi } from '@/api/inventory';
import {
  Plus, RefreshCw, CheckCircle2, XCircle, Trash2, FileText,
} from 'lucide-react';
import { Badge, Button, SearchInput, AlertBanner, EmptyState } from '@/components/ui';

export const HQ_APPROVER_ROLES = [
  'SUPER_ADMIN', 'SUPERADMIN', 'OWNER', 'HQ_ADMIN', 'HEAD_OFFICE_ADMIN',
  'CENTRAL_PURCHASE_MANAGER', 'GENERAL_MANAGER', 'DIRECTOR',
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
    return new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return v; }
};

interface LineItem {
  item_id: string;
  requested_qty: number;
  notes?: string;
}

export const MainKitchenRequisitions: React.FC = () => {
  const { activeOutlet, isHeadOffice } = useOutlet();
  const { user } = useAuth();

  const userRole = typeof user?.role === 'object' ? (user.role.name || '') : (user?.role || '');
  const isHq = HQ_APPROVER_ROLES.includes(userRole.trim().toUpperCase()) || isHeadOffice;

  const [items, setItems] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [branchId, setBranchId] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([{ item_id: '', requested_qty: 1 }]);
  const [submitting, setSubmitting] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const itmRes = await inventoryApi.getItems({ is_active: true }).catch(() => []);
      setItems(Array.isArray(itmRes) ? itmRes : []);

      if (isHq) {
        const brRes = await organizationApi.getBranches({ is_active: true }).catch(() => []);
        setBranches(Array.isArray(brRes) ? brRes : []);
        if (!branchId && Array.isArray(brRes) && brRes.length > 0) setBranchId(brRes[0].id);
      } else {
        setBranchId(activeOutlet?.id || '');
      }

      const params: any = {};
      if (!isHq && activeOutlet?.id) params.branch_id = activeOutlet.id;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      const list = await procurementApi.getKitchenRequisitions(params).catch(() => []);
      setRequisitions(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.detail || err?.message || 'Failed to load requisitions.' });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHq, activeOutlet?.id, statusFilter, searchQuery]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!branchId) {
      setFeedback({ type: 'error', message: 'Select an outlet branch.' });
      return;
    }
    const validLines = lineItems.filter((l) => l.item_id && l.requested_qty > 0);
    if (validLines.length === 0) {
      setFeedback({ type: 'error', message: 'Add at least one item with quantity greater than zero.' });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const created = await procurementApi.createKitchenRequisition({
        branch_id: branchId,
        priority,
        notes: notes.trim() || undefined,
        items: validLines.map((l) => ({ item_id: l.item_id, requested_qty: l.requested_qty, notes: l.notes?.trim() || undefined })),
      });
      setFeedback({ type: 'success', message: `Requisition ${created.requestNumber || created.request_number} submitted for approval. No stock changed.` });
      setShowCreate(false);
      setNotes('');
      setLineItems([{ item_id: '', requested_qty: 1 }]);
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.detail || 'Failed to submit requisition.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (req: any) => {
    setActingId(req.id);
    try {
      await procurementApi.approvePurchaseRequest(req.id);
      setFeedback({ type: 'success', message: `Requisition ${req.request_number} approved. Status only — stock is untouched.` });
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.detail || 'Approval failed.' });
    } finally { setActingId(null); }
  };

  const handleReject = async (req: any) => {
    const reason = window.prompt(`Rejection reason for ${req.request_number}:`, 'Not required this cycle');
    if (reason === null || !reason.trim()) return;
    setActingId(req.id);
    try {
      await procurementApi.rejectPurchaseRequest(req.id, { reason: reason.trim() });
      setFeedback({ type: 'success', message: `Requisition ${req.request_number} rejected.` });
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.detail || 'Rejection failed.' });
    } finally { setActingId(null); }
  };

  const updateLine = (idx: number, patch: Partial<LineItem>) => {
    setLineItems(lineItems.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const renderCreateForm = () => (
    <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] p-5 space-y-4">
      <h3 className="font-bold text-sm">Create Main Kitchen Requisition</h3>
      <p className="text-[11px] text-[#707070]">Submitted to HO/Admin for approval. No stock is changed at submission.</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-[#707070] uppercase mb-1">Outlet Branch *</label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            disabled={!isHq}
            className="w-full px-3 py-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs focus:outline-none focus:border-[#C79A3B]"
          >
            {!isHq && <option value={activeOutlet?.id}>{activeOutlet?.name}</option>}
            {isHq && branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#707070] uppercase mb-1">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs focus:outline-none focus:border-[#C79A3B]"
          >
            {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-[#707070] uppercase mb-1">Items *</label>
        <div className="divide-y divide-gray-100 border rounded-xl">
          {lineItems.map((line, idx) => (
            <div key={idx} className="flex gap-2 items-center p-2">
              <select
                value={line.item_id}
                onChange={(e) => updateLine(idx, { item_id: e.target.value })}
                className="flex-1 px-3 py-2 rounded-lg bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs"
              >
                <option value="">-- Choose Item --</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>{it.name} ({it.code})</option>
                ))}
              </select>
              <input
                type="number"
                min="0.001"
                step="0.001"
                value={line.requested_qty}
                onChange={(e) => updateLine(idx, { requested_qty: Number(e.target.value) || 0 })}
                className="w-28 px-3 py-2 rounded-lg bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs font-mono"
              />
              <Button type="button" variant="danger" size="sm" onClick={() => setLineItems(lineItems.filter((_, i) => i !== idx))}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-2"
          onClick={() => setLineItems([...lineItems, { item_id: '', requested_qty: 1 }])}
          icon={<Plus className="w-3.5 h-3.5" />}
        >
          Add Item
        </Button>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-[#707070] uppercase mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Optional context for the approver"
          className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs focus:outline-none focus:border-[#C79A3B]"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
        <Button type="button" variant="primary" size="sm" loading={submitting} icon={<Plus className="w-3.5 h-3.5" />} onClick={handleCreate}>
          Submit Requisition
        </Button>
      </div>
    </div>
  );

  const renderRow = (req: any) => {
    const badge = statusBadge[req.status] || { label: req.status, cls: 'bg-gray-100 text-gray-700' };
    return (
      <div key={req.id} className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-[#FAF8F5]/50 transition-colors border-b border-gray-100 last:border-0">
        <div className="min-w-0 space-y-1 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-xs text-[#1C1C1C] font-mono">{req.request_number}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${badge.cls}`}>{badge.label}</span>
            {req.branch_name && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)] font-semibold">{req.branch_name}</span>
            )}
          </div>
          <div className="text-xs text-[#707070] space-y-2 mt-2">
            {(() => {
              const grouped = (req.items || []).reduce((acc: any, it: any) => {
                const source = (it.supply_source || 'CENTRAL_STORE').toUpperCase().replace(/_/g, ' ');
                if (!acc[source]) acc[source] = [];
                acc[source].push(it);
                return acc;
              }, {});

              return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([source, items]: [string, any]) => (
                <div key={source} className="border border-gray-100 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-3 py-1 text-[10px] font-bold text-[#1C1C1C] uppercase tracking-widest border-b border-gray-100">
                    {source}
                  </div>
                  <div className="px-3 py-2 bg-white flex flex-wrap gap-x-4 gap-y-1">
                    {items.map((it: any) => (
                      <span key={it.id || it.item_id}>
                        {it.item_name || it.item_code} <span className="font-mono text-[#B8862D] font-bold">× {fmtQty(it.requested_qty)} {it.unit_symbol || ''}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
          <div className="flex items-center gap-2 flex-wrap text-[11px] text-[#707070]">
            <span>Requested: <b className="text-[#1C1C1C]">{fmtDate(req.created_at)}</b></span>
            {req.rejection_reason && <span className="text-red-600">Reason: {req.rejection_reason}</span>}
            {req.notes && <span>· {req.notes}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isHq && req.status === 'PENDING_APPROVAL' && (
            <>
              <Button size="sm" variant="success" loading={actingId === req.id} onClick={() => handleApprove(req)} icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
                Approve
              </Button>
              <Button size="sm" variant="danger" loading={actingId === req.id} onClick={() => handleReject(req)} icon={<XCircle className="w-3.5 h-3.5" />}>
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
          <h2 className="text-base font-bold text-[#1C1C1C]">Main Kitchen Requisitions</h2>
          <p className="text-xs text-[#707070]">
            Outlet → HO approval → Main Kitchen. Approval changes status only; stock is never changed by a requisition.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={fetchData}>Refresh</Button>
          {!isHq && (
            <Button size="sm" variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowCreate(!showCreate)}>
              {showCreate ? 'Close' : 'New Requisition'}
            </Button>
          )}
        </div>
      </div>

      {feedback && <AlertBanner type={feedback.type} title={feedback.message} onClose={() => setFeedback(null)} />}

      {!isHq && showCreate && renderCreateForm()}

      <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            {(['ALL', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border ${statusFilter === f ? 'bg-[#F1E4C5] text-[#B8862D] border-[#B8862D]/30' : 'bg-white text-[#707070] border-[rgba(45,45,45,.08)]'}`}
              >
                {f.replaceAll('_', ' ')}
              </button>
            ))}
          </div>
          <SearchInput
            className="ml-auto"
            placeholder="Search request no / notes"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="p-8 text-center text-sm text-[#707070]">Loading requisitions…</div>
          ) : requisitions.length === 0 ? (
            <EmptyState
              title="No requisitions"
              description="No Main Kitchen requisitions match the current filter."
              icon={<FileText className="w-6 h-6" />}
            />
          ) : (
            <div className="divide-y divide-gray-100">{requisitions.map(renderRow)}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MainKitchenRequisitions;