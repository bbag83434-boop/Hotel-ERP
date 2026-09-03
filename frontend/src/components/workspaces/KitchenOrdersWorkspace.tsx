'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useOutlet } from '@/context/OutletContext';
import { useAuth } from '@/context/AuthContext';
import { kitchenOrdersApi } from '@/api/kitchenOrders';
import { organizationApi } from '@/api/organization';
import {
  KitchenOrder,
  KitchenOrderItemOption,
} from '@/types/kitchen-order.types';
import {
  ChefHat,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Truck,
  PackageCheck,
  X,
  Check,
  Clock,
  Ban,
  Play,
  Info,
  Boxes,
  Store,
  Eye,
  Package,
  Printer,
} from 'lucide-react';

export const KITCHEN_ROLES = [
  'SUPER_ADMIN',
  'SUPERADMIN',
  'OWNER',
  'ADMIN',
  'HQ_ADMIN',
  'HEAD_OFFICE_ADMIN',
  'CENTRAL_PURCHASE_MANAGER',
  'CENTRAL_STORE_MANAGER',
  'DESSERT_KITCHEN_HEAD',
  'KITCHEN_CHEF',
  'GENERAL_MANAGER',
  'DIRECTOR',
];

export const ADMIN_ROLES = [
  'SUPER_ADMIN',
  'SUPERADMIN',
  'OWNER',
  'ADMIN',
  'HQ_ADMIN',
  'HEAD_OFFICE_ADMIN',
  'CENTRAL_PURCHASE_MANAGER',
  'CENTRAL_STORE_MANAGER',
  'DESSERT_KITCHEN_HEAD',
  'GENERAL_MANAGER',
  'DIRECTOR',
  'PRODUCTION_MANAGER',
];

const CENTRAL_OUTLET_TYPES = ['CENTRAL_STORE', 'DESSERT_KITCHEN', 'HEAD_OFFICE'];

export const statusBadge: Record<string, { label: string; cls: string }> = {
  SUBMITTED: { label: 'Submitted', cls: 'bg-amber-100 text-amber-800' },
  APPROVED: { label: 'Approved', cls: 'bg-indigo-100 text-indigo-800' },
  REJECTED: { label: 'Rejected', cls: 'bg-red-100 text-red-800' },
  IN_PRODUCTION: { label: 'In Production', cls: 'bg-blue-100 text-blue-800' },
  DISPATCHED: { label: 'Dispatched', cls: 'bg-violet-100 text-violet-800' },
  PARTIALLY_RECEIVED: { label: 'Partly Received', cls: 'bg-cyan-100 text-cyan-800' },
  RECEIVED: { label: 'Received', cls: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-red-100 text-red-700' },
};

const num = (v: number | string | null | undefined) => Number(v ?? 0);

const fmtQty = (v: number | string | null | undefined) => num(v).toLocaleString('en-IN');

const fmtDate = (v?: string | null) => {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return v;
  }
};

const fmtDay = (v?: string | null) => {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return v;
  }
};
interface KitchenOrdersWorkspaceProps {
  initialView?: 'outlet' | 'kitchen';
}

type OutletTab = 'orders' | 'create';

export const KitchenOrdersWorkspace: React.FC<KitchenOrdersWorkspaceProps> = ({ initialView }) => {
  const { activeOutlet } = useOutlet();
  const { user } = useAuth();

  const userRole = typeof user?.role === 'object' ? (user.role.name || '') : (user?.role || '');
  const isCentralOutlet = CENTRAL_OUTLET_TYPES.includes((activeOutlet?.type || '').toUpperCase());
  
  const isKitchen = activeOutlet 
    ? isCentralOutlet 
    : Boolean(initialView === 'kitchen' || KITCHEN_ROLES.includes(userRole.toUpperCase()));

  const [activeTab, setActiveTab] = useState<OutletTab>('orders');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [items, setItems] = useState<KitchenOrderItemOption[]>([]);
  const [kitchens, setKitchens] = useState<any[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createKitchenWarehouseId, setCreateKitchenWarehouseId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Create form state
  const [createItemId, setCreateItemId] = useState<string>('');
  const [createQty, setCreateQty] = useState<number>(0);
  const [createRequiredDate, setCreateRequiredDate] = useState<string>('');
  const [createNotes, setCreateNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Action modals
  const [dispatchOrder, setDispatchOrder] = useState<KitchenOrder | null>(null);
  const [dispatchQty, setDispatchQty] = useState<number>(0);
  const [dispatchNotes, setDispatchNotes] = useState<string>('');
  const [dispatchBatchNumber, setDispatchBatchNumber] = useState<string>('');
  const [dispatchLoading, setDispatchLoading] = useState<boolean>(false);

  const [receiveOrder, setReceiveOrder] = useState<KitchenOrder | null>(null);
  const [receiveQty, setReceiveQty] = useState<number>(0);
  const [receiveNotes, setReceiveNotes] = useState<string>('');
  const [receiveLoading, setReceiveLoading] = useState<boolean>(false);

  const [cancelOrder, setCancelOrder] = useState<KitchenOrder | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelLoading, setCancelLoading] = useState<boolean>(false);

  // Issue modal state
  const [issueOrder, setIssueOrder] = useState<KitchenOrder | null>(null);
  const [issueQty, setIssueQty] = useState<number>(0);
  const [issueLoading, setIssueLoading] = useState<boolean>(false);

  // Reject modal state
  const [rejectOrder, setRejectOrder] = useState<KitchenOrder | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [rejectLoading, setRejectLoading] = useState<boolean>(false);

  // View modal state
  const [viewOrder, setViewOrder] = useState<KitchenOrder | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState<boolean>(false);

  // Challan modal state
  const [challanOrder, setChallanOrder] = useState<KitchenOrder | null>(null);
  const [challanModalOpen, setChallanModalOpen] = useState<boolean>(false);

const fetchData = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const [ordersRes, itemsRes] = await Promise.all([
        kitchenOrdersApi.getKitchenOrders().catch(() => []),
        kitchenOrdersApi.getAvailableItems().catch(() => []),
      ]);
      setOrders(Array.isArray(ordersRes) ? ordersRes : []);
      setItems(Array.isArray(itemsRes) ? itemsRes : []);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail || err?.response?.data?.error?.message || err?.message || 'Failed to load kitchen orders',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const haystack = `${o.order_number} ${o.item_name || ''} ${o.item_code || ''} ${o.branch_name || ''} ${o.branch_code || ''}`.toLowerCase();
      return haystack.includes(q);
    }
    return true;
  });

  const pendingApprovalCount = orders.filter((o) => o.status === 'SUBMITTED').length;
  const pendingCount = orders.filter((o) => ['APPROVED', 'IN_PRODUCTION'].includes(o.status)).length;
  const dispatchableCount = orders.filter((o) => o.status === 'DISPATCHED').length;

  const openDispatch = (order: KitchenOrder) => {
    setDispatchOrder(order);
    // Dispatch uses the actual issued quantity, not the original requested quantity.
    const issued = num(order.issued_qty);
    const alreadyDispatched = num(order.dispatched_qty);
    setDispatchQty(Math.max(0, issued - alreadyDispatched));
    setDispatchNotes('');
    setDispatchBatchNumber('');
  };

  const openReceive = (order: KitchenOrder) => {
    setReceiveOrder(order);
    setReceiveQty(num(order.dispatched_qty) - num(order.received_qty));
    setReceiveNotes('');
  };

  const openCancel = (order: KitchenOrder) => {
    setCancelOrder(order);
    setCancelReason('');
  };

  const handleCreate = async () => {
    if (!createItemId || createQty <= 0) {
      setFeedback({ type: 'error', message: 'Select a finished/semi-finished item and enter a quantity greater than zero.' });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      await kitchenOrdersApi.createKitchenOrder({
        branch_id: activeOutlet?.id || '',
        item_id: createItemId,
        requested_qty: createQty,
        required_date: createRequiredDate ? new Date(createRequiredDate).toISOString() : undefined,
        notes: createNotes.trim() || undefined,
      });
      setFeedback({ type: 'success', message: 'Kitchen Order submitted to the Production Kitchen.' });
      setCreateItemId('');
      setCreateQty(0);
      setCreateNotes('');
      setCreateRequiredDate('');
      setActiveTab('orders');
      fetchData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail || err?.response?.data?.error?.message || err?.message || 'Failed to submit kitchen order',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartProduction = async (order: KitchenOrder) => {
    setLoading(true);
    setFeedback(null);
    try {
      await kitchenOrdersApi.startProduction(order.id, {});
      setFeedback({ type: 'success', message: `Order ${order.order_number} moved into production.` });
      fetchData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail || err?.response?.data?.error?.message || err?.message || 'Failed to start production',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDispatch = async () => {
    if (!dispatchOrder) return;
    setDispatchLoading(true);
    setFeedback(null);
    try {
      await kitchenOrdersApi.dispatchKitchenOrder(dispatchOrder.id, {
        dispatched_qty: dispatchQty,
        batch_number: dispatchBatchNumber.trim() || undefined,
        notes: dispatchNotes.trim() || undefined,
      });
      setFeedback({ type: 'success', message: `Dispatched ${dispatchQty} qty to ${dispatchOrder.branch_name || 'outlet'}. Awaiting receiving.` });
      setDispatchOrder(null);
      fetchData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail || err?.response?.data?.error?.message || err?.message || 'Dispatch failed. Insufficient stock? Produce via Recipes & Production first.',
      });
    } finally {
      setDispatchLoading(false);
    }
  };

  const handleReceive = async () => {
    if (!receiveOrder) return;
    setReceiveLoading(true);
    setFeedback(null);
    try {
      await kitchenOrdersApi.receiveKitchenOrder(receiveOrder.id, {
        accepted_qty: receiveQty,
        notes: receiveNotes.trim() || undefined,
      });
      setFeedback({ type: 'success', message: `Received ${receiveQty} qty. Stock added to outlet warehouse.` });
      setReceiveOrder(null);
      fetchData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail || err?.response?.data?.error?.message || err?.message || 'Receive failed',
      });
    } finally {
      setReceiveLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelOrder || !cancelReason.trim()) {
      setFeedback({ type: 'error', message: 'A cancellation reason is required.' });
      return;
    }
    setCancelLoading(true);
    setFeedback(null);
    try {
      await kitchenOrdersApi.cancelKitchenOrder(cancelOrder.id, { reason: cancelReason.trim() });
      setFeedback({ type: 'success', message: `Kitchen order ${cancelOrder.order_number} cancelled.` });
      setCancelOrder(null);
      fetchData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail || err?.response?.data?.error?.message || err?.message || 'Cancel failed',
      });
    } finally {
      setCancelLoading(false);
    }
  };

  // Approve handler
  const handleApprove = async (order: KitchenOrder) => {
    setLoading(true);
    setFeedback(null);
    try {
      await kitchenOrdersApi.approveKitchenOrder(order.id, {});
      setFeedback({ type: 'success', message: `Order ${order.order_number} approved. It will appear in the Central Kitchen queue.` });
      fetchData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail || err?.response?.data?.error?.message || err?.message || 'Approval failed',
      });
    } finally {
      setLoading(false);
    }
  };

  // Reject handler
  const handleReject = async (order: KitchenOrder) => {
    setRejectOrder(order);
    setRejectReason('');
  };

  const confirmReject = async () => {
    if (!rejectOrder || !rejectReason.trim()) {
      setFeedback({ type: 'error', message: 'A rejection reason is required.' });
      return;
    }
    setRejectLoading(true);
    setFeedback(null);
    try {
      await kitchenOrdersApi.rejectKitchenOrder(rejectOrder.id, { reason: rejectReason.trim() });
      setFeedback({ type: 'success', message: `Order ${rejectOrder.order_number} rejected.` });
      setRejectOrder(null);
      fetchData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail || err?.response?.data?.error?.message || err?.message || 'Rejection failed',
      });
    } finally {
      setRejectLoading(false);
    }
  };

  // Issue handler
  const openIssue = (order: KitchenOrder) => {
    setIssueOrder(order);
    setIssueQty(num(order.requested_qty));
  };

  const handleIssue = async () => {
    if (!issueOrder) return;
    if (issueQty <= 0) {
      setFeedback({ type: 'error', message: 'Issue quantity must be greater than zero.' });
      return;
    }
    if (issueQty > num(issueOrder.requested_qty)) {
      setFeedback({ type: 'error', message: 'Cannot issue more than requested quantity.' });
      return;
    }
    setIssueLoading(true);
    setFeedback(null);
    try {
      await kitchenOrdersApi.issueKitchenOrder(issueOrder.id, { issue_qty: issueQty });
      setFeedback({ type: 'success', message: `Issued ${issueQty} qty for order ${issueOrder.order_number}. Ready to dispatch.` });
      setIssueOrder(null);
      fetchData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail || err?.response?.data?.error?.message || err?.message || 'Issue failed. Check central kitchen stock.',
      });
    } finally {
      setIssueLoading(false);
    }
  };

  // Challan handler
  const openChallan = (order: KitchenOrder) => {
    setChallanOrder(order);
    setChallanModalOpen(true);
  };

  const printChallan = () => {
    setChallanModalOpen(false);
    window.print();
  };
return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <ChefHat className="w-4 h-4 text-[#B8862D]" />
            <h1 className="text-xl font-bold text-[#1C1C1C] font-['Outfit']">Kitchen Orders</h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF8F5] text-[#B8862D] font-bold border border-[rgba(45,45,45,0.1)]">
              [{activeOutlet?.code || 'GLOBAL'}]
            </span>
          </div>
          <p className="text-xs text-[#707070] mt-0.5">
            {isKitchen
              ? 'Outlet-wise kitchen requirements — approve, issue, and dispatch finished & semi-finished items.'
              : 'Require finished/semi-finished items (e.g. Gulab Jamun, desserts, gravy) from the Central Kitchen.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-xl border border-[rgba(45,45,45,0.12)] text-[#707070] hover:bg-[#FAF8F5] transition-all"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#C79A3B]' : ''}`} />
          </button>
          {!isKitchen && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1C1C1C] text-white text-xs font-bold hover:bg-[#2D2D2D] shadow-xs transition-all active:scale-[0.98]"
            >
              <Plus className="w-3.5 h-3.5" />
              New Kitchen Order
            </button>
          )}
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs font-semibold ${
            feedback.type === 'success'
              ? 'bg-[#2E8B57]/10 text-[#2E8B57] border border-[#2E8B57]/20'
              : 'bg-red-500/10 text-red-600 border border-red-500/20'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {isKitchen && (
          <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-xs">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#707070] font-bold">
              <Clock className="w-3.5 h-3.5 text-amber-600" /> Pending Approval
            </div>
            <p className="text-2xl font-bold mt-1 text-[#1C1C1C]">{pendingApprovalCount}</p>
            <p className="text-[10px] text-[#707070]">Awaiting HQ approval</p>
          </div>
        )}
        <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-xs">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#707070] font-bold">
            <Package className="w-3.5 h-3.5 text-indigo-600" /> Orders to Fulfill
          </div>
          <p className="text-2xl font-bold mt-1 text-[#1C1C1C]">{pendingCount}</p>
          <p className="text-[10px] text-[#707070]">Approved / In Production</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-xs">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#707070] font-bold">
            <Truck className="w-3.5 h-3.5 text-violet-600" /> Dispatched
          </div>
          <p className="text-2xl font-bold mt-1 text-[#1C1C1C]">{dispatchableCount}</p>
          <p className="text-[10px] text-[#707070]">In transit / to receive</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-xs">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#707070] font-bold">
            <PackageCheck className="w-3.5 h-3.5 text-green-600" /> Received
          </div>
          <p className="text-2xl font-bold mt-1 text-[#1C1C1C]">
            {orders.filter((o) => o.status === 'RECEIVED').length}
          </p>
          <p className="text-[10px] text-[#707070]">Completed</p>
        </div>
      </div>
{/* Outlet mode tabs */}
      {!isKitchen && (
        <div className="flex items-center gap-2 border-b border-[rgba(45,45,45,0.08)] pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'orders'
                ? 'bg-[#F1E4C5] text-[#B8862D] shadow-xs border border-[#B8862D]/30'
                : 'text-[#707070] hover:bg-[#FAF8F5] border border-transparent'
            }`}
          >
            <ChefHat className="w-4 h-4" />
            My Kitchen Orders
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/80 border border-current font-mono">{orders.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'create'
                ? 'bg-[#F1E4C5] text-[#B8862D] shadow-xs border border-[#B8862D]/30'
                : 'text-[#707070] hover:bg-[#FAF8F5] border border-transparent'
            }`}
          >
            <Plus className="w-4 h-4" />
            Create Kitchen Order
          </button>
        </div>
      )}

      {/* Filters (kitchen mode & my orders) */}
      {true && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-[rgba(45,45,45,0.08)]">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#707070]" />
            <input
              type="text"
              placeholder={isKitchen ? 'Search orders / outlets / items...' : 'Search my orders / items...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#FAF8F5] rounded-xl border border-[rgba(45,45,45,0.08)] focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-[11px] text-[#707070] font-semibold">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] rounded-xl px-2.5 py-1.5 font-semibold"
            >
              <option value="ALL">All</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="IN_PRODUCTION">In Production</option>
              <option value="DISPATCHED">Dispatched</option>
              <option value="PARTIALLY_RECEIVED">Partly Received</option>
              <option value="RECEIVED">Received</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      )}
{/* Orders list — Kitchen queue OR Outlet "My Orders" */}
      {(isKitchen || activeTab === 'orders') && (
        <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 text-[#B8862D] mx-auto mb-2 animate-spin opacity-60" />
              <p className="text-xs text-[#707070]">Loading kitchen orders...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-12 text-center">
              <ChefHat className="w-8 h-8 text-[#B8862D] mx-auto mb-2 opacity-60" />
              <h3 className="text-sm font-bold text-[#1C1C1C]">
                {isKitchen ? 'No kitchen orders in the queue' : 'No kitchen orders yet'}
              </h3>
              <p className="text-xs text-[#707070] mt-1 max-w-sm mx-auto">
                {isKitchen
                  ? 'When outlets raise kitchen requirements and HQ approves them, they will appear here for issue & dispatch.'
                  : 'Click "Create Kitchen Order" to require a finished/semi-finished item from the Central Kitchen.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredOrders.map((o) => {
                const badge = statusBadge[o.status] || { label: o.status, cls: 'bg-gray-100 text-gray-700' };
                const remaining = num(o.requested_qty) - num(o.received_qty);
                const issuedRemaining = num(o.issued_qty) - num(o.dispatched_qty);
                // Admin can approve/reject submitted orders.
                const canApprove = isKitchen && o.status === 'SUBMITTED';
                // Central Kitchen can issue approved orders.
                const canIssue = isKitchen && ['APPROVED', 'IN_PRODUCTION'].includes(o.status) && num(o.issued_qty) === 0;
                // Central Kitchen can dispatch after issue.
                const canDispatch = isKitchen && ['APPROVED', 'IN_PRODUCTION', 'DISPATCHED', 'PARTIALLY_RECEIVED'].includes(o.status) && issuedRemaining > 0;
                const canReceive = !isKitchen && o.status === 'DISPATCHED';
                const canCancel = !isKitchen && ['SUBMITTED', 'APPROVED', 'IN_PRODUCTION'].includes(o.status);
                return (
                  <div
                    key={o.id}
                    className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-[#FAF8F5]/50 transition-colors"
                  >
                    <div className="min-w-0 space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-[#1C1C1C] font-mono">{o.order_number}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${badge.cls}`}>{badge.label}</span>
                        {isKitchen && o.branch_name && (
                          <span className="flex items-center gap-1 text-[10px] text-[#1C1C1C] px-2 py-0.5 rounded bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)] font-semibold">
                            <Store className="w-3 h-3 text-[#B8862D]" />
                            {o.branch_name} [{o.branch_code}]
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-bold text-[#1C1C1C]">
                        {o.item_name} <span className="text-[10px] text-[#707070] font-mono">({o.item_code})</span>
                        <span className="ml-2 text-[11px] font-semibold text-[#B8862D]">
                          {fmtQty(o.requested_qty)} {o.unit_symbol || 'units'}
                        </span>
                      </p>

                      <div className="flex items-center gap-2 flex-wrap text-[11px] text-[#707070]">
                        <span>Requested: <b className="text-[#1C1C1C]">{fmtQty(o.requested_qty)}</b></span>
                        <span>Issued: <b className="text-[#1C1C1C]">{fmtQty(o.issued_qty)}</b></span>
                        <span>Dispatched: <b className="text-[#1C1C1C]">{fmtQty(o.dispatched_qty)}</b></span>
                        <span>Received: <b className="text-[#2E8B57]">{fmtQty(o.received_qty)}</b></span>
                        <span className="text-[#707070]">· Required by: {fmtDay(o.required_date)}</span>
                      </div>
{o.dispatch_notes && (
                        <p className="text-[11px] text-[#8A641D] bg-[#FAF8F5] px-2 py-0.5 rounded inline-block">
                          {o.dispatch_notes}
                        </p>
                      )}
                      {o.receive_notes && (
                        <p className="text-[11px] text-[#257247] bg-[#2E8B57]/10 px-2 py-0.5 rounded inline-block">
                          Received: {o.receive_notes}
                        </p>
                      )}

                      {isKitchen && o.kitchen_available_qty !== undefined && o.kitchen_available_qty !== null && (
                        <p className="flex items-center gap-1 text-[11px] text-[#707070]">
                          <Info className="w-3 h-3 text-[#B8862D]" />
                          Kitchen stock: {fmtQty(o.kitchen_available_qty)} {o.unit_symbol || 'units'}
                          <span className="text-[#999]">({o.kitchen_warehouse_name || 'central kitchen'})</span>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
                      {/* View */}
                      <button
                        onClick={() => { setViewOrder(o); setViewModalOpen(true); }}
                        className="px-2.5 py-1.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" /> View
                      </button>
                      {/* Approve / Reject (Admin only, for SUBMITTED) */}
                      {canApprove && (
                        <>
                          <button
                            onClick={() => handleApprove(o)}
                            className="px-3 py-1.5 rounded-xl bg-[#2E8B57] text-white text-xs font-bold hover:bg-[#257247] flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Approve
                          </button>
                          <button
                            onClick={() => handleReject(o)}
                            className="px-2.5 py-1.5 rounded-xl border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 flex items-center gap-1"
                          >
                            <Ban className="w-3 h-3" /> Reject
                          </button>
                        </>
                      )}
                      {/* Issue (Central Kitchen, for APPROVED) */}
                      {canIssue && (
                        <button
                          onClick={() => openIssue(o)}
                          className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 flex items-center gap-1"
                        >
                          <Package className="w-3 h-3" /> Issue
                        </button>
                      )}
                      {/* Dispatch (Central Kitchen) */}
                      {canDispatch && (
                        <button
                          onClick={() => openDispatch(o)}
                          className="px-3 py-1.5 rounded-xl bg-[#2E8B57] text-white text-xs font-bold hover:bg-[#257247] shadow-xs flex items-center gap-1"
                        >
                          <Truck className="w-3 h-3" /> Dispatch
                        </button>
                      )}
                      {/* Print Challan */}
                      {isKitchen && ['IN_PRODUCTION', 'DISPATCHED', 'PARTIALLY_RECEIVED', 'RECEIVED'].includes(o.status) && (
                        <button
                          onClick={() => openChallan(o)}
                          className="px-2.5 py-1.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 flex items-center gap-1"
                        >
                          <Printer className="w-3 h-3" /> Print
                        </button>
                      )}
                      {/* Receive (Outlet) */}
                      {canReceive && (
                        <button
                          onClick={() => openReceive(o)}
                          className="px-3 py-1.5 rounded-xl bg-[#2E8B57] text-white text-xs font-bold hover:bg-[#257247] shadow-xs flex items-center gap-1"
                        >
                          <PackageCheck className="w-3 h-3" /> Receive & Add Stock
                        </button>
                      )}
                      {/* Cancel (Outlet) */}
                      {canCancel && (
                        <button
                          onClick={() => openCancel(o)}
                          className="px-2.5 py-1.5 rounded-xl border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 flex items-center gap-1"
                        >
                          <Ban className="w-3 h-3" /> Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
{/* Outlet mode — Create Kitchen Order Modal */}
      {!isKitchen && isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#1C1C1C]">New Kitchen Order</h3>
                <p className="text-xs text-[#707070]">Require finished/semi-finished goods from a Central Kitchen.</p>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

          {items.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-[#FAF8F5] border border-dashed border-[rgba(45,45,45,0.15)]">
              <AlertCircle className="w-8 h-8 text-[#B8862D] mx-auto mb-2 opacity-60" />
              <h4 className="text-sm font-bold text-[#1C1C1C]">No finished/semi-finished items available</h4>
              <p className="text-xs text-[#707070] mt-1 max-w-md mx-auto">
                Add FINISHED_GOOD / SEMI_FINISHED items in Item Master (Project Setup → Master Data → Items) and define a Recipe/BOM. Kitchen Orders only use real Items from the Item Master.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-[#707070] mb-1">
                    Finished / Semi-finished Item <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={createItemId}
                    onChange={(e) => setCreateItemId(e.target.value)}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-gray-200 rounded-xl font-semibold"
                  >
                    <option value="">Select item...</option>
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name} ({it.code}) · {it.unit_symbol || 'unit'} {it.has_recipe ? ' · Recipe ✓' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#707070] mb-1">
                      Required Quantity <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={createQty || ''}
                      onChange={(e) => setCreateQty(Number(e.target.value))}
                      placeholder="e.g. 50"
                      className="w-full p-2.5 bg-[#FAF8F5] border border-gray-200 rounded-xl font-semibold"
                    />
                    {createItemId && (
                      <p className="text-[10px] text-[#707070] mt-1">
                        Unit: {items.find((i) => i.id === createItemId)?.unit_symbol || 'units'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#707070] mb-1">
                      Central Production Kitchen
                    </label>
                    <select
                      value={createKitchenWarehouseId}
                      onChange={(e) => setCreateKitchenWarehouseId(e.target.value)}
                      className="w-full p-2.5 bg-[#FAF8F5] border border-gray-200 rounded-xl font-semibold"
                    >
                      <option value="">(Auto-assign to default central kitchen)</option>
                      {kitchens.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.name} ({k.branch?.name || k.branch_id})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#707070] mb-1">Required By</label>
                    <input
                      type="date"
                      value={createRequiredDate}
                      onChange={(e) => setCreateRequiredDate(e.target.value)}
                      className="w-full p-2.5 bg-[#FAF8F5] border border-gray-200 rounded-xl font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#707070] mb-1">Current Status</label>
                    <input
                      type="text"
                      disabled
                      value="Pending (New Order)"
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-semibold text-gray-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#707070] mb-1">Notes</label>
                  <textarea
                    value={createNotes}
                    onChange={(e) => setCreateNotes(e.target.value)}
                    rows={2}
                    placeholder="Optional — special instructions for the kitchen"
                    className="w-full p-2.5 bg-[#FAF8F5] border border-gray-200 rounded-xl font-semibold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-4">
                  <button
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-[#707070] hover:bg-[#FAF8F5]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={submitting}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#1C1C1C] text-white text-xs font-bold hover:bg-[#2D2D2D] shadow-xs transition-all active:scale-[0.98]"
                  >
                    {submitting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ChefHat className="w-3.5 h-3.5 text-[#C79A3B]" />
                    )}
                    {submitting ? 'Submitting...' : 'Submit Request'}
                  </button>
              </div>
            </>
          )}
        </div>
      </div>
      )}
{/* Dispatch modal — Kitchen */}
      {dispatchOrder && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#1C1C1C]">Dispatch to Outlet</h3>
                <p className="text-xs text-[#707070]">{dispatchOrder.order_number} · {dispatchOrder.item_name} → {dispatchOrder.branch_name || dispatchOrder.branch_code}</p>
              </div>
              <button onClick={() => setDispatchOrder(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="bg-[#FAF8F5] rounded-xl p-3 text-xs text-[#707070] space-y-0.5">
              <p>Requested: <b className="text-[#1C1C1C]">{fmtQty(dispatchOrder.requested_qty)} {dispatchOrder.unit_symbol || 'units'}</b></p>
              <p>Issued: <b className="text-[#1C1C1C]">{fmtQty(dispatchOrder.issued_qty)} {dispatchOrder.unit_symbol || 'units'}</b></p>
              <p>Already dispatched: <b className="text-[#1C1C1C]">{fmtQty(dispatchOrder.dispatched_qty)}</b></p>
              <p>Kitchen stock: <b className="text-[#1C1C1C]">{fmtQty(dispatchOrder.kitchen_available_qty)}</b></p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[#707070] mb-1">Dispatch Quantity</label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={dispatchQty || ''}
                  onChange={(e) => setDispatchQty(Number(e.target.value))}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-gray-200 rounded-xl font-semibold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#707070] mb-1">Batch Number</label>
                <input
                  type="text"
                  value={dispatchBatchNumber}
                  onChange={(e) => setDispatchBatchNumber(e.target.value)}
                  placeholder="Optional"
                  className="w-full p-2.5 bg-[#FAF8F5] border border-gray-200 rounded-xl font-semibold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#707070] mb-1">Dispatch Notes</label>
                <textarea
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional"
                  className="w-full p-2.5 bg-[#FAF8F5] border border-gray-200 rounded-xl font-semibold"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setDispatchOrder(null)}
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-[#707070] hover:bg-[#FAF8F5]"
              >
                Close
              </button>
              <button
                onClick={handleDispatch}
                disabled={dispatchLoading || dispatchQty <= 0}
                className="flex-1 px-3 py-2 rounded-xl bg-[#2E8B57] text-white text-xs font-bold hover:bg-[#257247] flex items-center justify-center gap-1 disabled:opacity-50"
              >
                {dispatchLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}
                Confirm Dispatch
              </button>
            </div>
            <p className="text-[10px] text-[#707070] flex items-center gap-1">
              <Info className="w-3 h-3" /> Dispatch uses the issued quantity. Stock will be deducted from Central Kitchen when the outlet confirms receiving.
            </p>
          </div>
        </div>
      )}
{/* Receive modal — Outlet */}
      {receiveOrder && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#1C1C1C]">Receive Dispatched Goods</h3>
                <p className="text-xs text-[#707070]">{receiveOrder.order_number} · {receiveOrder.item_name}</p>
              </div>
              <button onClick={() => setReceiveOrder(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="bg-[#FAF8F5] rounded-xl p-3 text-xs text-[#707070] space-y-0.5">
              <p>Dispatched by kitchen: <b className="text-[#1C1C1C]">{fmtQty(receiveOrder.dispatched_qty)} {receiveOrder.unit_symbol || 'units'}</b></p>
              <p>Already received: <b className="text-[#1C1C1C]">{fmtQty(receiveOrder.received_qty)}</b></p>
              {receiveOrder.kitchen_warehouse_name && <p>From: {receiveOrder.kitchen_warehouse_name}</p>}
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[#707070] mb-1">Accept Quantity</label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={receiveQty || ''}
                  onChange={(e) => setReceiveQty(Number(e.target.value))}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-gray-200 rounded-xl font-semibold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#707070] mb-1">Receive Notes</label>
                <textarea
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional"
                  className="w-full p-2.5 bg-[#FAF8F5] border border-gray-200 rounded-xl font-semibold"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setReceiveOrder(null)}
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-[#707070] hover:bg-[#FAF8F5]"
              >
                Close
              </button>
              <button
                onClick={handleReceive}
                disabled={receiveLoading || receiveQty <= 0}
                className="flex-1 px-3 py-2 rounded-xl bg-[#2E8B57] text-white text-xs font-bold hover:bg-[#257247] flex items-center justify-center gap-1 disabled:opacity-50"
              >
                {receiveLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PackageCheck className="w-3.5 h-3.5" />}
                Confirm & Add Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel modal */}
      {cancelOrder && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#1C1C1C]">Cancel Kitchen Order</h3>
                <p className="text-xs text-[#707070]">{cancelOrder.order_number} · {cancelOrder.item_name}</p>
              </div>
              <button onClick={() => setCancelOrder(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[#707070] mb-1">Reason <span className="text-red-500">*</span></label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                  placeholder="Why are you cancelling this requirement?"
                  className="w-full p-2.5 bg-[#FAF8F5] border border-gray-200 rounded-xl font-semibold"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCancelOrder(null)}
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-[#707070] hover:bg-[#FAF8F5]"
              >
                Keep Order
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelLoading || !cancelReason.trim()}
                className="flex-1 px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 flex items-center justify-center gap-1 disabled:opacity-50"
              >
                {cancelLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Issue modal — Central Kitchen */}
      {issueOrder && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#1C1C1C]">Issue Quantity</h3>
                <p className="text-xs text-[#707070]">{issueOrder.order_number} · {issueOrder.item_name}</p>
              </div>
              <button onClick={() => setIssueOrder(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-[#FAF8F5] rounded-xl p-3 text-xs text-[#707070] space-y-0.5">
              <p>Requested by outlet: <b className="text-[#1C1C1C]">{fmtQty(issueOrder.requested_qty)} {issueOrder.unit_symbol || 'units'}</b></p>
              {issueOrder.kitchen_available_qty !== undefined && issueOrder.kitchen_available_qty !== null && (
                <p>Central Kitchen stock: <b className="text-[#1C1C1C]">{fmtQty(issueOrder.kitchen_available_qty)} {issueOrder.unit_symbol || 'units'}</b></p>
              )}
              {issueOrder.branch_name && <p>Outlet: {issueOrder.branch_name} [{issueOrder.branch_code}]</p>}
              {Number(issueOrder.kitchen_available_qty) < issueQty && (
                <p className="text-red-600 font-semibold flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Insufficient stock! Available: {fmtQty(issueOrder.kitchen_available_qty)}, Required: {fmtQty(issueQty)}</p>
              )}
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[#707070] mb-1">Issue Quantity <span className="text-red-500">*</span> <span className="text-[#999] font-normal ml-1">(max: {fmtQty(issueOrder.requested_qty)})</span></label>
                <input type="number" min={0} max={num(issueOrder.requested_qty)} step="any" value={issueQty || ''} onChange={(e) => setIssueQty(Number(e.target.value))} className="w-full p-2.5 bg-[#FAF8F5] border border-gray-200 rounded-xl font-semibold" />
                <p className="text-[10px] text-[#707070] mt-1">You can send less than requested but not more.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setIssueOrder(null)} className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-[#707070] hover:bg-[#FAF8F5]">Close</button>
              <button onClick={handleIssue} disabled={issueLoading || issueQty <= 0 || issueQty > num(issueOrder.requested_qty) || issueQty > Number(issueOrder.kitchen_available_qty)} className="flex-1 px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 flex items-center justify-center gap-1 disabled:opacity-50">
                {issueLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                Confirm Issue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal — Admin/HQ */}
      {rejectOrder && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#1C1C1C]">Reject Kitchen Order</h3>
                <p className="text-xs text-[#707070]">{rejectOrder.order_number} · {rejectOrder.item_name}</p>
              </div>
              <button onClick={() => setRejectOrder(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-[#FAF8F5] rounded-xl p-3 text-xs text-[#707070] space-y-0.5">
              <p>Requested by: <b className="text-[#1C1C1C]">{rejectOrder.branch_name || 'outlet'}</b></p>
              <p>Item: <b className="text-[#1C1C1C]">{rejectOrder.item_name}</b> ({rejectOrder.item_code})</p>
              <p>Quantity: <b className="text-[#1C1C1C]">{fmtQty(rejectOrder.requested_qty)} {rejectOrder.unit_symbol || 'units'}</b></p>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[#707070] mb-1">Rejection Reason <span className="text-red-500">*</span></label>
                <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} placeholder="Why is this order being rejected?" className="w-full p-2.5 bg-[#FAF8F5] border border-gray-200 rounded-xl font-semibold" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setRejectOrder(null)} className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-[#707070] hover:bg-[#FAF8F5]">Keep Order</button>
              <button onClick={confirmReject} disabled={rejectLoading || !rejectReason.trim()} className="flex-1 px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 flex items-center justify-center gap-1 disabled:opacity-50">
                {rejectLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View modal */}
      {viewModalOpen && viewOrder && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#1C1C1C]">Kitchen Order Details</h3>
                <p className="text-xs text-[#707070]">{viewOrder.order_number}</p>
              </div>
              <button onClick={() => setViewModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-[#FAF8F5] rounded-xl p-4 text-xs text-[#707070] space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <p>Order Number: <b className="text-[#1C1C1C]">{viewOrder.order_number}</b></p>
                <p>Status: <b className="text-[#1C1C1C]">{viewOrder.status}</b></p>
                <p>Outlet: <b className="text-[#1C1C1C]">{viewOrder.branch_name || '—'} [{viewOrder.branch_code || '—'}]</b></p>
                <p>Item: <b className="text-[#1C1C1C]">{viewOrder.item_name} ({viewOrder.item_code})</b></p>
                <p>Requested Qty: <b className="text-[#1C1C1C]">{fmtQty(viewOrder.requested_qty)} {viewOrder.unit_symbol || 'units'}</b></p>
                <p>Issued Qty: <b className="text-[#1C1C1C]">{fmtQty(viewOrder.issued_qty)} {viewOrder.unit_symbol || 'units'}</b></p>
                <p>Dispatched Qty: <b className="text-[#1C1C1C]">{fmtQty(viewOrder.dispatched_qty)} {viewOrder.unit_symbol || 'units'}</b></p>
                <p>Received Qty: <b className="text-[#2E8B57]">{fmtQty(viewOrder.received_qty)} {viewOrder.unit_symbol || 'units'}</b></p>
                <p>Required By: <b className="text-[#1C1C1C]">{fmtDay(viewOrder.required_date)}</b></p>
                <p>Kitchen Stock: <b className="text-[#1C1C1C]">{viewOrder.kitchen_available_qty != null ? fmtQty(viewOrder.kitchen_available_qty) : '—'} {viewOrder.unit_symbol || 'units'}</b></p>
                <p>Approved By: <b className="text-[#1C1C1C]">{viewOrder.approved_by || '—'}</b></p>
                <p>Dispatched By: <b className="text-[#1C1C1C]">{viewOrder.dispatched_by || '—'}</b></p>
              </div>
              {viewOrder.notes && <p>Notes: <b className="text-[#1C1C1C]">{viewOrder.notes}</b></p>}
              {viewOrder.rejection_reason && <p className="text-red-600">Rejection Reason: <b>{viewOrder.rejection_reason}</b></p>}
            </div>
            <div className="flex items-center justify-end">
              <button onClick={() => setViewModalOpen(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-[#707070] hover:bg-[#FAF8F5]">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Challan / Print modal */}
      {challanModalOpen && challanOrder && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-xl" id="challan-print">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#1C1C1C]">Delivery Challan</h3>
                <p className="text-xs text-[#707070]">{challanOrder.challan_number || `CH-${challanOrder.order_number}`}</p>
              </div>
              <button onClick={() => setChallanModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="border border-gray-200 rounded-xl p-5 text-xs space-y-3">
              <div className="text-center border-b border-gray-200 pb-3">
                <h2 className="text-base font-bold text-[#1C1C1C]">{challanOrder.central_kitchen_name || 'Central Kitchen'}</h2>
                <p className="text-[#707070]">Internal Delivery Challan</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <p>Challan No: <b className="text-[#1C1C1C]">{challanOrder.challan_number || `CH-${challanOrder.order_number}`}</b></p>
                <p>Date: <b className="text-[#1C1C1C]">{new Date().toLocaleDateString('en-IN')}</b></p>
                <p>Kitchen Order: <b className="text-[#1C1C1C]">{challanOrder.order_number}</b></p>
                <p>Item: <b className="text-[#1C1C1C]">{challanOrder.item_name} ({challanOrder.item_code})</b></p>
              </div>
              <div className="border-t border-gray-200 pt-3 grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[#707070] font-semibold">From:</p>
                  <p className="text-[#1C1C1C] font-bold">{challanOrder.central_kitchen_name || 'Central Kitchen'}</p>
                </div>
                <div>
                  <p className="text-[#707070] font-semibold">To:</p>
                  <p className="text-[#1C1C1C] font-bold">{challanOrder.branch_name || 'Outlet'} [{challanOrder.branch_code || '—'}]</p>
                </div>
              </div>
              <div className="border-t border-gray-200 pt-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-1 text-[#707070]">Item</th>
                      <th className="text-right py-1 text-[#707070]">Requested</th>
                      <th className="text-right py-1 text-[#707070]">Issued</th>
                      <th className="text-right py-1 text-[#707070]">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-1 text-[#1C1C1C]">{challanOrder.item_name}</td>
                      <td className="py-1 text-right text-[#1C1C1C]">{fmtQty(challanOrder.requested_qty)}</td>
                      <td className="py-1 text-right text-[#1C1C1C]">{fmtQty(challanOrder.issued_qty)}</td>
                      <td className="py-1 text-right text-[#1C1C1C]">{challanOrder.unit_symbol || 'units'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="border-t border-gray-200 pt-3 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[#707070] font-semibold mb-2">Dispatched By:</p>
                  <p className="text-[#1C1C1C] border-b border-gray-300 pb-4 mb-1">&nbsp;</p>
                  <p className="text-[10px] text-[#999]">Name & Signature</p>
                </div>
                <div>
                  <p className="text-[#707070] font-semibold mb-2">Received By:</p>
                  <p className="text-[#1C1C1C] border-b border-gray-300 pb-4 mb-1">&nbsp;</p>
                  <p className="text-[10px] text-[#999]">Name & Signature</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setChallanModalOpen(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-[#707070] hover:bg-[#FAF8F5]">Close</button>
              <button onClick={printChallan} className="px-4 py-2 rounded-xl bg-[#1C1C1C] text-white text-xs font-bold hover:bg-[#2D2D2D] flex items-center gap-1"><Printer className="w-3.5 h-3.5" /> Print Challan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KitchenOrdersWorkspace;