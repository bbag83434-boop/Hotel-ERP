'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Eye, FileText, RefreshCw, Send, ShieldCheck, XCircle, Package } from 'lucide-react';
import { procurementApi } from '@/api/procurement';
import { Button, Badge, EmptyState, StatCard } from '@/components/ui';
import { useOutlet } from '@/context/OutletContext';
import { useAuth } from '@/context/AuthContext';

const HQ_APPROVER_ROLES = new Set([
  'SUPER_ADMIN', 'SUPERADMIN', 'OWNER', 'ADMIN', 'HQ_ADMIN',
  'HEAD_OFFICE_ADMIN', 'CENTRAL_PURCHASE_MANAGER', 'GENERAL_MANAGER', 'DIRECTOR',
]);

const money = (value: any) =>
  `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const isHqApprover = (user: any) => {
  const rawRole = typeof user?.role === 'string'
    ? user.role
    : user?.role?.name ?? user?.role_name ?? user?.roleName;
  return rawRole
    ? HQ_APPROVER_ROLES.has(String(rawRole).trim().toUpperCase().replace(/[\s-]+/g, '_'))
    : false;
};

const parseJson = (value: any) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
};

const qtyOf = (line: any) => Number(line?.requested_qty ?? line?.requestedQty ?? line?.quantity ?? line?.ordered_qty ?? 0);
const rateOf = (line: any) => Number(line?.estimated_price ?? line?.estimatedPrice ?? line?.unit_price ?? line?.unitPrice ?? 0);
const amountOf = (line: any) => qtyOf(line) * rateOf(line);

const requestAmount = (request: any) => {
  const total = Number(request?.total_amount ?? request?.totalAmount);
  if (Number.isFinite(total)) return total;
  return (request?.items || []).reduce((sum: number, line: any) => sum + amountOf(line), 0);
};

const sourceLabel = (value: any) => {
  const source = String(value || 'CENTRAL_STORE').toUpperCase();
  if (source === 'DIRECT_VENDOR') return 'Direct Vendor';
  if (source === 'CENTRAL_STORE') return 'Central Store';
  return source.replaceAll('_', ' ');
};

const isOpenVendorPO = (po: any) => {
  if (String(po?.status || '').toUpperCase() !== 'APPROVED') return false;
  const allocation = parseJson(po?.allocations);
  return allocation?.consolidation_open === true;
};

interface ApprovalItem {
  id: string;
  reference: string;
  title: string;
  amount: number;
  branch?: string;
  status?: string;
  createdAt?: string;
  payload: any;
}

export default function ApprovalCenterWorkspace() {
  const { activeOutlet, isHeadOffice } = useOutlet();
  const { user } = useAuth();

  const [tab, setTab] = useState<'APPROVE' | 'HISTORY' | 'SEND_PO'>('APPROVE');
  const [pending, setPending] = useState<ApprovalItem[]>([]);
  const [history, setHistory] = useState<ApprovalItem[]>([]);
  const [openPOs, setOpenPOs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [poLoading, setPoLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);
  const [viewRequest, setViewRequest] = useState<ApprovalItem | null>(null);
  const [viewPO, setViewPO] = useState<any | null>(null);

  const branchId = isHeadOffice ? undefined : activeOutlet?.id;
  const canApprove = useMemo(() => isHqApprover(user), [user]);

  const loadPRData = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const [pendingPRs, allPRs] = await Promise.all([
        procurementApi.getPurchaseRequests({ branch_id: branchId, status_filter: 'PENDING_APPROVAL' }),
        procurementApi.getPurchaseRequests({ branch_id: branchId }),
      ]);

      setPending((pendingPRs || []).map((x: any) => ({
        id: String(x.id),
        reference: x.request_number,
        title: x.requisition_type === 'CENTRAL_STORE' ? 'CENTRAL STORE REQUEST' : 'PURCHASE REQUEST',
        amount: requestAmount(x),
        branch: x.branch_name || x.branch?.name,
        status: x.status,
        createdAt: x.created_at,
        payload: x,
      })));

      const historyStatuses = new Set(['APPROVED', 'ORDERED', 'REJECTED', 'CANCELLED']);
      setHistory((allPRs || [])
        .filter((x: any) => historyStatuses.has(String(x?.status || '').toUpperCase()))
        .map((x: any) => ({
          id: String(x.id),
          reference: x.request_number,
          title: x.requisition_type === 'CENTRAL_STORE' ? 'CENTRAL STORE REQUEST' : 'PURCHASE REQUEST',
          amount: requestAmount(x),
          branch: x.branch_name || x.branch?.name,
          status: x.status,
          createdAt: x.created_at,
          payload: x,
        }))
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))));
    } catch (error: any) {
      const data = error?.response?.data;
      setMessage(data?.detail || data?.message || error?.message || 'Approval data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  const loadPOs = useCallback(async () => {
    setPoLoading(true);
    try {
      const orders = await procurementApi.getPurchaseOrders({
        branch_id: branchId,
        status_filter: 'APPROVED',
      });
      const fresh = (orders || []).filter(isOpenVendorPO);
      setOpenPOs(fresh);
    } catch (error: any) {
      const data = error?.response?.data;
      setMessage(data?.detail || data?.message || error?.message || 'Vendor PO queue could not be loaded.');
    } finally {
      setPoLoading(false);
    }
  }, [branchId]);

  const loadAll = useCallback(async () => {
    // Do not load the entire approved-PO list on page startup. That query can be
    // large and is only needed when the user opens Send PO.
    await loadPRData();
    if (tab === 'SEND_PO') {
      await loadPOs();
    }
  }, [loadPRData, loadPOs, tab]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const approvePR = async (item: ApprovalItem) => {
    setActingId(item.id);
    setMessage('');
    try {
      await procurementApi.approvePurchaseRequest(item.id);
      setMessage(`${item.reference} approved.`);
      await loadPRData();
      if (tab === 'SEND_PO') await loadPOs();
    } catch (error: any) {
      const data = error?.response?.data;
      setMessage(data?.error?.message || data?.detail || data?.message || error?.message || 'Approval failed.');
    } finally {
      setActingId(null);
    }
  };

  const rejectPR = async (item: ApprovalItem) => {
    setActingId(item.id);
    setMessage('');
    try {
      await procurementApi.rejectPurchaseRequest(item.id, { reason: 'Rejected from Approval Center' });
      setMessage(`${item.reference} rejected.`);
      await loadPRData();
    } catch (error: any) {
      const data = error?.response?.data;
      setMessage(data?.detail || data?.message || error?.message || 'Reject failed.');
    } finally {
      setActingId(null);
    }
  };

  const sendWhatsApp = async (po: any) => {
    setMessage('');
    try {
      const response = await procurementApi.getWhatsAppLink(po.id);
      if (!response?.whatsapp_url) {
        setMessage('WhatsApp link could not be generated.');
        return;
      }
      window.open(response.whatsapp_url, '_blank', 'noopener,noreferrer');
      await loadPRData();
      if (tab === 'SEND_PO') await loadPOs();
    } catch (error: any) {
      const data = error?.response?.data;
      setMessage(data?.detail || data?.message || error?.message || 'WhatsApp send failed.');
    }
  };

  const counts = useMemo(() => ({
    pending: pending.length,
    history: history.length,
    sendPO: openPOs.length,
  }), [pending, history, openPOs]);

  const currentPOItems = useMemo(() => {
    if (!viewPO) return [];
    const allocation = parseJson(viewPO.allocations);
    if (Array.isArray(allocation?.items_summary)) {
      return allocation.items_summary;
    }
    return (viewPO.items || []).map((item: any) => ({
      item_name: item.item_name,
      total_qty: item.ordered_qty,
      unit_symbol: item.unit_symbol || item.unit,
      unit_price: item.unit_price,
      allocations: parseJson(item.allocations),
    }));
  }, [viewPO]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#B8862D]" />
            <h1 className="text-xl font-bold">Approval Center</h1>
          </div>
          <p className="text-xs text-[#707070] mt-1">Approve requirements, review history, then send vendor POs.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={loadAll} disabled={loading || poLoading}>
          <RefreshCw className={`w-4 h-4 ${(loading || poLoading) ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard title="Approve" value={counts.pending} icon={<Clock3 className="w-4 h-4" />} />
        <StatCard title="Approved History" value={counts.history} icon={<CheckCircle2 className="w-4 h-4" />} />
        <StatCard title="Send PO" value={counts.sendPO} icon={<Send className="w-4 h-4" />} />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setTab('APPROVE')} className={`px-4 py-2 rounded-xl text-xs font-bold border ${tab === 'APPROVE' ? 'bg-[#F1E4C5] text-[#B8862D] border-[#B8862D]/30' : 'bg-white text-[#707070] border-gray-200'}`}>Approve</button>
        <button onClick={() => setTab('HISTORY')} className={`px-4 py-2 rounded-xl text-xs font-bold border ${tab === 'HISTORY' ? 'bg-[#F1E4C5] text-[#B8862D] border-[#B8862D]/30' : 'bg-white text-[#707070] border-gray-200'}`}>Approved History</button>
        <button onClick={() => setTab('SEND_PO')} className={`px-4 py-2 rounded-xl text-xs font-bold border ${tab === 'SEND_PO' ? 'bg-[#F1E4C5] text-[#B8862D] border-[#B8862D]/30' : 'bg-white text-[#707070] border-gray-200'}`}>Send PO</button>
      </div>

      {message && <div className="p-3 rounded-xl bg-white border border-gray-200 text-xs font-medium">{message}</div>}

      {tab === 'APPROVE' && (
        <div className="space-y-3">
          {loading ? (
            <div className="p-8 text-center text-sm text-[#707070]">Loading approvals…</div>
          ) : pending.length === 0 ? (
            <EmptyState title="Nothing to approve" description="All purchase requirements are clear." icon={<CheckCircle2 className="w-6 h-6" />} />
          ) : (
            pending.map(item => (
              <div key={item.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm">{item.title}</span>
                      <Badge variant="outlet">{item.status || 'PENDING_APPROVAL'}</Badge>
                    </div>
                    <div className="text-xs text-[#707070] mt-1">{item.reference}{item.branch ? ` · ${item.branch}` : ''}</div>
                    <div className="text-sm font-bold mt-1">{money(item.amount)}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setViewRequest(item)}>
                      <Eye className="w-4 h-4" /> View
                    </Button>
                    <Button size="sm" variant="primary" disabled={!canApprove || actingId === item.id} onClick={() => approvePR(item)}>
                      <CheckCircle2 className="w-4 h-4" /> Approve
                    </Button>
                    <Button size="sm" variant="danger" disabled={!canApprove || actingId === item.id} onClick={() => rejectPR(item)}>
                      <XCircle className="w-4 h-4" /> Reject
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'HISTORY' && (
        <div className="space-y-3">
          {loading ? (
            <div className="p-8 text-center text-sm text-[#707070]">Loading history…</div>
          ) : history.length === 0 ? (
            <EmptyState title="No approval history" description="Approved purchase requirements will remain here." icon={<FileText className="w-6 h-6" />} />
          ) : (
            history.map(item => (
              <div key={item.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm">{item.title}</span>
                      <Badge variant="outlet">{item.status}</Badge>
                    </div>
                    <div className="text-xs text-[#707070] mt-1">{item.reference}{item.branch ? ` · ${item.branch}` : ''}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold">{money(item.amount)}</span>
                    <Button size="sm" variant="secondary" onClick={() => setViewRequest(item)}>
                      <Eye className="w-4 h-4" /> View
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'SEND_PO' && (
        <div className="space-y-3">
          {poLoading ? (
            <div className="p-8 text-center text-sm text-[#707070]">Loading vendor POs…</div>
          ) : openPOs.length === 0 ? (
            <EmptyState title="No vendor PO ready" description="Approved Direct Vendor requirements will appear here, grouped by vendor." icon={<Package className="w-6 h-6" />} />
          ) : (
            openPOs.map((po: any) => {
              const allocation = parseJson(po.allocations);
              const itemCount = Array.isArray(allocation?.items_summary) ? allocation.items_summary.length : (po.items?.length || 0);
              const outletCount = allocation?.outlets ? Object.keys(allocation.outlets).length : 0;
              return (
                <div key={po.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm">{po.supplier_name || 'Vendor'}</span>
                        <Badge variant="outlet">OPEN PO</Badge>
                      </div>
                      <div className="text-xs text-[#707070] mt-1 font-mono">{po.po_number}</div>
                      <div className="text-xs text-[#707070] mt-1">{itemCount} item types · {outletCount} outlets</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-base">{money(po.net_amount ?? po.total_amount)}</span>
                      <Button size="sm" variant="secondary" onClick={() => setViewPO(po)}>
                        <Eye className="w-4 h-4" /> View PO
                      </Button>
                      <Button size="sm" variant="primary" onClick={() => sendWhatsApp(po)}>
                        <Send className="w-4 h-4" /> SEND WHATSAPP
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {viewRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">Requirement Details</h3>
                <div className="text-xs text-gray-500">{viewRequest.reference} · {viewRequest.status}</div>
              </div>
              <button onClick={() => setViewRequest(null)} aria-label="Close"><XCircle className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-5">
                <div><div className="text-xs text-gray-500">Outlet</div><div>{viewRequest.branch || '—'}</div></div>
                <div><div className="text-xs text-gray-500">Status</div><div className="font-semibold">{viewRequest.status}</div></div>
                <div><div className="text-xs text-gray-500">Total</div><div className="font-bold">{money(viewRequest.amount)}</div></div>
              </div>
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50"><tr>
                    <th className="px-3 py-2">Item</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Vendor</th>
                    <th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2">Unit</th><th className="px-3 py-2 text-right">Rate</th><th className="px-3 py-2 text-right">Amount</th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {(viewRequest.payload?.items || []).map((line: any) => (
                      <tr key={line.id || line.item_id}>
                        <td className="px-3 py-2 font-medium">{line.item_name || line.item?.name || 'Item'}</td>
                        <td className="px-3 py-2">{sourceLabel(line.supply_source || line.supplySource)}</td>
                        <td className="px-3 py-2">{line.supplier_name || line.supplier?.name || '—'}</td>
                        <td className="px-3 py-2 text-right font-mono">{qtyOf(line)}</td>
                        <td className="px-3 py-2">{line.unit_symbol || line.unit || '—'}</td>
                        <td className="px-3 py-2 text-right">{money(rateOf(line))}</td>
                        <td className="px-3 py-2 text-right font-semibold">{money(amountOf(line))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end"><Button variant="secondary" onClick={() => setViewRequest(null)}>Close</Button></div>
          </div>
        </div>
      )}

      {viewPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
            <div className="p-4 border-b flex items-center justify-between">
              <div><h3 className="font-bold text-lg">Vendor PO</h3><div className="text-xs text-gray-500">{viewPO.po_number} · {viewPO.supplier_name}</div></div>
              <button onClick={() => setViewPO(null)} aria-label="Close"><XCircle className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-5">
                <div><div className="text-xs text-gray-500">Vendor</div><div className="font-semibold">{viewPO.supplier_name}</div></div>
                <div><div className="text-xs text-gray-500">PO Total</div><div className="font-bold">{money(viewPO.net_amount ?? viewPO.total_amount)}</div></div>
                <div><div className="text-xs text-gray-500">Status</div><div className="font-semibold">READY TO SEND</div></div>
              </div>
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50"><tr>
                    <th className="px-3 py-2">Item</th><th className="px-3 py-2 text-right">Total Qty</th><th className="px-3 py-2">Unit</th><th className="px-3 py-2 text-right">Rate</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Outlet Allocation</th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {currentPOItems.map((item: any, idx: number) => {
                      const allocations = Array.isArray(item?.allocations) ? item.allocations : [];
                      const allocationText = allocations.map((a: any) => `${a.branch_name || 'Outlet'} → ${a.quantity ?? a.qty ?? 0} ${item.unit_symbol || ''}`).join(', ');
                      return (
                        <tr key={`${item.item_id || item.item_name}-${idx}`}>
                          <td className="px-3 py-2 font-medium">{item.item_name || 'Item'}</td>
                          <td className="px-3 py-2 text-right font-mono">{Number(item.total_qty || 0)}</td>
                          <td className="px-3 py-2">{item.unit_symbol || '—'}</td>
                          <td className="px-3 py-2 text-right">{money(item.unit_price)}</td>
                          <td className="px-3 py-2 text-right font-semibold">{money(Number(item.total_qty || 0) * Number(item.unit_price || 0))}</td>
                          <td className="px-3 py-2">{allocationText || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-between gap-2">
              <Button variant="secondary" onClick={() => setViewPO(null)}>Close</Button>
              <Button variant="primary" onClick={() => sendWhatsApp(viewPO)}><Send className="w-4 h-4" /> SEND WHATSAPP</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
