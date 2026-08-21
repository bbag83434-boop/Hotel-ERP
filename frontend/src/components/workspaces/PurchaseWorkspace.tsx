'use client';

import React, { useState, useEffect } from 'react';
import { useOutlet } from '@/context/OutletContext';
import { apiClient } from '@/api/client';
import { procurementApi } from '@/api/procurement';
import {
  Supplier,
  PurchaseRequest,
  PurchaseOrder,
  GoodsReceiveNote,
  ThreeWayMatchResponse,
  OutletClosingRecord,
  ActiveClosingDraft,
} from '@/types/purchase.types';
import {
  ShoppingCart,
  Truck,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  Building2,
  Clock,
  ShieldCheck,
  Eye,
  Edit3,
  Trash2,
  Send,
  MessageCircle,
  Layers,
  ArrowRight,
  CornerDownRight,
  CheckSquare,
  Square,
  PackageCheck,
  Receipt,
  DollarSign,
  TrendingUp,
  BarChart3,
  Filter,
  Lock,
  Unlock,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  X,
  ExternalLink,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

export const PurchaseWorkspace: React.FC = () => {
  const { currentOutlet, activeOutlet, isHeadOffice, outlets } = useOutlet();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'queue' | 'orders' | 'grn' | 'matching' | 'suppliers' | 'closing'>('queue');

  // Loading & Feedback
  const [loading, setLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filter States
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Data Stores
  const [requests, setRequests] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [grns, setGrns] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);

  // Selection & Multi-Consolidation
  const [selectedPRIds, setSelectedPRIds] = useState<string[]>([]);
  const [consolidationModalOpen, setConsolidationModalOpen] = useState<boolean>(false);
  const [consolidationNotes, setConsolidationNotes] = useState<string>('');
  const [autoSubmitConsolidated, setAutoSubmitConsolidated] = useState<boolean>(true);

  // Modals & Details
  const [viewPRModal, setViewPRModal] = useState<any | null>(null);
  const [createPRModalOpen, setCreatePRModalOpen] = useState<boolean>(false);
  const [createPOModalOpen, setCreatePOModalOpen] = useState<boolean>(false);
  const [createGRNModalOpen, setCreateGRNModalOpen] = useState<boolean>(false);
  const [viewPOModal, setViewPOModal] = useState<any | null>(null);
  const [selected3WayPOId, setSelected3WayPOId] = useState<string | null>(null);
  const [threeWayData, setThreeWayData] = useState<ThreeWayMatchResponse | null>(null);
  const [loading3Way, setLoading3Way] = useState<boolean>(false);

  // Rejection & Return Prompts
  const [actionReasonModal, setActionReasonModal] = useState<{
    type: 'REJECT_PR' | 'RETURN_PR' | 'REJECT_PO' | 'CANCEL_PO';
    id: string;
    title: string;
  } | null>(null);
  const [actionReasonText, setActionReasonText] = useState<string>('');

  // New PR Form State
  const [newPRBranchId, setNewPRBranchId] = useState<string>(activeOutlet.id);
  const [newPRPriority, setNewPRPriority] = useState<string>('MEDIUM');
  const [newPRRequiredDate, setNewPRRequiredDate] = useState<string>(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [newPRNotes, setNewPRNotes] = useState<string>('');
  const [newPRLines, setNewPRLines] = useState<Array<{ item_id: string; requested_qty: number; estimated_price: number; supplier_id?: string; notes?: string }>>([
    { item_id: '', requested_qty: 10, estimated_price: 0 },
  ]);

  // New Direct PO Form State
  const [newPOSupplierId, setNewPOSupplierId] = useState<string>('');
  const [newPOBranchId, setNewPOBranchId] = useState<string>(activeOutlet.id);
  const [newPODeliveryDate, setNewPODeliveryDate] = useState<string>(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [newPONotes, setNewPONotes] = useState<string>('');
  const [newPOLines, setNewPOLines] = useState<Array<{ item_id: string; ordered_qty: number; unit_price: number; notes?: string }>>([
    { item_id: '', ordered_qty: 20, unit_price: 50 },
  ]);

  // New GRN Form State
  const [newGRNBranchId, setNewGRNBranchId] = useState<string>(activeOutlet.id);
  const [newGRNPOId, setNewGRNPOId] = useState<string>('');
  const [newGRNSupplierId, setNewGRNSupplierId] = useState<string>('');
  const [newGRNInvoiceNum, setNewGRNInvoiceNum] = useState<string>('');
  const [newGRNInvoiceAmt, setNewGRNInvoiceAmt] = useState<number>(0);
  const [newGRNNotes, setNewGRNNotes] = useState<string>('');
  const [newGRNLines, setNewGRNLines] = useState<Array<{
    item_id: string;
    item_name?: string;
    unit_symbol?: string;
    po_item_id?: string;
    received_qty: number;
    accepted_qty: number;
    rejected_qty: number;
    unit_price: number;
    batch_number?: string;
    expiry_date?: string;
    qc_status: 'PASSED' | 'FAILED' | 'PENDING';
    qc_notes?: string;
  }>>([]);

  // Twice-Monthly Closing Draft State
  const [closingDraft, setClosingDraft] = useState<ActiveClosingDraft | null>(null);
  const [closingPhysicalCounts, setClosingPhysicalCounts] = useState<{ [itemId: string]: number }>({});
  const [closingNotes, setClosingNotes] = useState<string>('');
  const [closingSubmitting, setClosingSubmitting] = useState<boolean>(false);

  // Fetch Core Data
  const fetchData = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const targetBranch = isHeadOffice
        ? (selectedBranchFilter === 'ALL' ? undefined : selectedBranchFilter)
        : activeOutlet.id;

      // 1. Fetch PRs
      const prRes = await procurementApi.getPurchaseRequests({
        branch_id: targetBranch,
        status_filter: statusFilter === 'ALL' ? undefined : statusFilter,
        priority: priorityFilter === 'ALL' ? undefined : priorityFilter,
        search: searchQuery || undefined,
      });
      setRequests(prRes || []);

      // 2. Fetch POs
      const poRes = await procurementApi.getPurchaseOrders({
        branch_id: targetBranch,
        status_filter: statusFilter === 'ALL' ? undefined : statusFilter,
        search: searchQuery || undefined,
      });
      setOrders(poRes || []);

      // 3. Fetch GRNs
      const grnRes = await procurementApi.getGoodsReceiveNotes({
        branch_id: targetBranch,
      });
      setGrns(grnRes || []);

      // 4. Fetch Suppliers
      const supRes = await procurementApi.getSuppliers();
      setSuppliers(supRes || []);

      // 5. Fetch Inventory Items
      const itemsRes = await apiClient.get('/inventory/items');
      const itemsList = Array.isArray(itemsRes.data) ? itemsRes.data : itemsRes.data?.data || [];
      setInventoryItems(itemsList);

      // 6. Fetch Active Closing Draft
      if (activeOutlet.id) {
        try {
          const draft = await procurementApi.getActiveClosingDraft(activeOutlet.id);
          setClosingDraft(draft);
          const initialCounts: { [id: string]: number } = {};
          (draft.items || []).forEach((ci) => {
            initialCounts[ci.item_id] = Number(ci.physical_closing_qty || ci.theoretical_closing_qty || 0);
          });
          setClosingPhysicalCounts(initialCounts);
        } catch (e) {
          // ignore closing draft error
        }
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || err?.message || 'Failed to load procurement data.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeOutlet.id, selectedBranchFilter, statusFilter, priorityFilter]);

  // Handle 3-Way Match Drill Down
  const open3WayMatch = async (poId: string) => {
    setSelected3WayPOId(poId);
    setActiveTab('matching');
    setLoading3Way(true);
    try {
      const data = await procurementApi.getOrder3WayMatch(poId);
      setThreeWayData(data);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: 'Could not load 3-Way Matching breakdown: ' + (err?.response?.data?.message || err.message),
      });
    } finally {
      setLoading3Way(false);
    }
  };

  // Toggle PR selection for batch consolidation
  const togglePRSelection = (id: string) => {
    setSelectedPRIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllPendingPRs = () => {
    const pendingIds = requests
      .filter((r) => r.status === 'PENDING_APPROVAL' || r.status === 'APPROVED')
      .map((r) => r.id);
    if (selectedPRIds.length === pendingIds.length) {
      setSelectedPRIds([]);
    } else {
      setSelectedPRIds(pendingIds);
    }
  };

  // Execute Auto Consolidation
  const handleConsolidation = async () => {
    if (selectedPRIds.length === 0) return;
    setLoading(true);
    try {
      const res = await procurementApi.consolidateOrders({
        request_ids: selectedPRIds,
        auto_submit: autoSubmitConsolidated,
        notes: consolidationNotes || undefined,
      });
      setFeedback({
        type: 'success',
        message: res.message || `Successfully generated ${res.consolidated_orders_count} supplier purchase orders.`,
      });
      setSelectedPRIds([]);
      setConsolidationModalOpen(false);
      setConsolidationNotes('');
      fetchData();
      setActiveTab('orders');
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || 'Consolidation failed.',
      });
    } finally {
      setLoading(false);
    }
  };

  // PR Quick Actions
  const handleApprovePR = async (id: string) => {
    setLoading(true);
    try {
      await procurementApi.approvePurchaseRequest(id);
      setFeedback({ type: 'success', message: 'Purchase request approved for ordering.' });
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Approval failed.' });
    } finally {
      setLoading(false);
    }
  };

  // PO Workflow Actions
  const handleApprovePO = async (orderId: string) => {
    setLoading(true);
    try {
      await procurementApi.approveOrder(orderId);
      setFeedback({ type: 'success', message: 'Purchase order approved. Ready for WhatsApp dispatch.' });
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'PO approval failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenWhatsApp = async (orderId: string) => {
    setLoading(true);
    try {
      const res = await procurementApi.getWhatsAppLink(orderId);
      if (res.whatsapp_url) {
        window.open(res.whatsapp_url, '_blank');
      }
      setFeedback({
        type: 'success',
        message: 'WhatsApp message prefilled and opened. Remember to confirm sent when sent.',
      });
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to generate WhatsApp link.' });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSent = async (orderId: string) => {
    setLoading(true);
    try {
      await procurementApi.confirmSent(orderId);
      setFeedback({ type: 'success', message: 'Purchase order status updated to SENT_MANUALLY.' });
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to update send status.' });
    } finally {
      setLoading(false);
    }
  };

  // Action Reason Dialog Handler (Reject/Return/Cancel)
  const submitActionReason = async () => {
    if (!actionReasonModal || !actionReasonText.trim()) return;
    setLoading(true);
    try {
      if (actionReasonModal.type === 'REJECT_PR') {
        await procurementApi.rejectPurchaseRequest(actionReasonModal.id, { reason: actionReasonText });
        setFeedback({ type: 'success', message: 'Purchase request rejected.' });
      } else if (actionReasonModal.type === 'RETURN_PR') {
        await procurementApi.returnPurchaseRequest(actionReasonModal.id, { reason: actionReasonText });
        setFeedback({ type: 'success', message: 'Purchase request returned to outlet for revision.' });
      } else if (actionReasonModal.type === 'REJECT_PO' || actionReasonModal.type === 'CANCEL_PO') {
        await procurementApi.cancelPurchaseOrder(actionReasonModal.id, { reason: actionReasonText });
        setFeedback({ type: 'success', message: 'Purchase order cancelled.' });
      }
      setActionReasonModal(null);
      setActionReasonText('');
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Action failed.' });
    } finally {
      setLoading(false);
    }
  };

  // Submit New PR
  const handleCreatePR = async () => {
    if (newPRLines.length === 0 || !newPRLines[0].item_id) {
      setFeedback({ type: 'error', message: 'Please select at least one item.' });
      return;
    }
    setLoading(true);
    try {
      await procurementApi.createPurchaseRequest({
        branch_id: newPRBranchId,
        priority: newPRPriority,
        required_date: new Date(newPRRequiredDate).toISOString(),
        notes: newPRNotes || undefined,
        items: newPRLines.map((l) => ({
          item_id: l.item_id,
          requested_qty: Number(l.requested_qty),
          estimated_price: Number(l.estimated_price),
          supplier_id: l.supplier_id || undefined,
          notes: l.notes || undefined,
        })),
      });
      setFeedback({ type: 'success', message: 'Purchase Request created successfully.' });
      setCreatePRModalOpen(false);
      setNewPRLines([{ item_id: '', requested_qty: 10, estimated_price: 0 }]);
      setNewPRNotes('');
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to create PR.' });
    } finally {
      setLoading(false);
    }
  };

  // Submit New Direct PO
  const handleCreatePO = async () => {
    if (!newPOSupplierId) {
      setFeedback({ type: 'error', message: 'Please select a supplier.' });
      return;
    }
    if (newPOLines.length === 0 || !newPOLines[0].item_id) {
      setFeedback({ type: 'error', message: 'Please add at least one line item.' });
      return;
    }
    setLoading(true);
    try {
      await procurementApi.createDirectPurchaseOrder({
        supplier_id: newPOSupplierId,
        branch_id: newPOBranchId || undefined,
        expected_delivery_date: new Date(newPODeliveryDate).toISOString(),
        notes: newPONotes || undefined,
        items: newPOLines.map((l) => ({
          item_id: l.item_id,
          ordered_qty: Number(l.ordered_qty),
          unit_price: Number(l.unit_price),
          notes: l.notes || undefined,
        })),
      });
      setFeedback({ type: 'success', message: 'Direct Purchase Order issued successfully.' });
      setCreatePOModalOpen(false);
      setNewPOLines([{ item_id: '', ordered_qty: 20, unit_price: 50 }]);
      setNewPONotes('');
      fetchData();
      setActiveTab('orders');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to create PO.' });
    } finally {
      setLoading(false);
    }
  };

  // When PO is chosen for receiving, prefill GRN line items
  const handleSelectPOForGRN = (poId: string) => {
    setNewGRNPOId(poId);
    const po = orders.find((o) => o.id === poId);
    if (po) {
      setNewGRNSupplierId(po.supplier_id || '');
      setNewGRNBranchId(po.branch_id || activeOutlet.id);
      const lines = (po.items || []).map((pi: any) => ({
        item_id: pi.item_id,
        item_name: pi.item_name || (inventoryItems.find((i) => i.id === pi.item_id)?.name || 'Item'),
        unit_symbol: pi.unit_symbol || 'UNIT',
        po_item_id: pi.id,
        received_qty: Number(pi.ordered_qty) - Number(pi.received_qty || 0),
        accepted_qty: Number(pi.ordered_qty) - Number(pi.received_qty || 0),
        rejected_qty: 0,
        unit_price: Number(pi.unit_price || 0),
        qc_status: 'PASSED' as const,
      }));
      setNewGRNLines(lines);
    }
  };

  // Submit New GRN
  const handleCreateGRN = async () => {
    if (newGRNLines.length === 0) {
      setFeedback({ type: 'error', message: 'No line items to receive.' });
      return;
    }
    setLoading(true);
    try {
      await procurementApi.createGoodsReceiveNote({
        branch_id: newGRNBranchId,
        po_id: newGRNPOId || undefined,
        supplier_id: newGRNSupplierId || undefined,
        supplier_invoice_number: newGRNInvoiceNum || undefined,
        invoice_amount: newGRNInvoiceAmt || undefined,
        notes: newGRNNotes || undefined,
        items: newGRNLines.map((l) => ({
          item_id: l.item_id,
          po_item_id: l.po_item_id || undefined,
          received_qty: Number(l.received_qty),
          accepted_qty: Number(l.accepted_qty),
          rejected_qty: Number(l.rejected_qty || 0),
          unit_price: Number(l.unit_price),
          batch_number: l.batch_number || undefined,
          expiry_date: l.expiry_date ? new Date(l.expiry_date).toISOString() : undefined,
          qc_status: l.qc_status,
          qc_notes: l.qc_notes || undefined,
        })),
      });
      setFeedback({
        type: 'success',
        message: 'Goods received and destination stock ledger updated directly!',
      });
      setCreateGRNModalOpen(false);
      setNewGRNLines([]);
      setNewGRNInvoiceNum('');
      setNewGRNInvoiceAmt(0);
      fetchData();
      setActiveTab('grn');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'GRN submission failed.' });
    } finally {
      setLoading(false);
    }
  };

  // Submit Twice-Monthly Closing Count
  const handleSubmitClosing = async () => {
    if (!closingDraft) return;
    setClosingSubmitting(true);
    try {
      const itemsToSubmit = (closingDraft.items || []).map((ci) => ({
        item_id: ci.item_id,
        physical_closing_qty: Number(closingPhysicalCounts[ci.item_id] ?? ci.physical_closing_qty ?? 0),
      }));

      const res = await procurementApi.submitOutletClosing({
        branch_id: activeOutlet.id,
        period_type: closingDraft.period_type,
        year: closingDraft.year,
        month: closingDraft.month,
        items: itemsToSubmit,
        notes: closingNotes || undefined,
      });

      setFeedback({
        type: 'success',
        message: `Closing reconciliation submitted. Valuation: $${Number(res.closing_physical_valuation).toFixed(2)}, Food Cost: $${Number(res.actual_food_cost).toFixed(2)} (${Number(res.variance_percentage).toFixed(1)}% var).`,
      });
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to submit closing count.' });
    } finally {
      setClosingSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-[#C79A3B]" />
              Central Purchase & Direct Supplier Fulfillment
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF8F5] text-[#B8862D] font-bold border border-[rgba(45,45,45,0.1)]">
              [{activeOutlet.code}]
            </span>
          </div>
          <p className="text-xs text-[#707070] mt-0.5">
            Full Blueprint 6.15 Spec: Central Indent Control, Multi-Destination Supplier POs, Direct Outlet Receiving (GRN), 3-Way Matching, and Bi-Monthly Closings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-xl border border-[rgba(45,45,45,0.12)] text-[#707070] hover:bg-[#FAF8F5] transition-all"
            title="Refresh All Procurement Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#C79A3B]' : ''}`} />
          </button>

          <button
            onClick={() => setCreatePRModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] text-[#1C1C1C] text-xs font-bold hover:bg-[#FAF8F5] shadow-xs transition-all"
          >
            <Plus className="w-3.5 h-3.5 text-[#C79A3B]" />
            New Indent (PR)
          </button>

          <button
            onClick={() => setCreatePOModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#1C1C1C] text-[#FAF8F5] text-xs font-bold hover:bg-[#2D2D2D] shadow-xs transition-all"
          >
            <Plus className="w-3.5 h-3.5 text-[#C79A3B]" />
            Direct PO
          </button>

          <button
            onClick={() => setCreateGRNModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#2E8B57] text-white text-xs font-bold hover:bg-[#257247] shadow-xs transition-all"
          >
            <PackageCheck className="w-3.5 h-3.5" />
            Receive Delivery (GRN)
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-3 text-xs font-semibold ${
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

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-white border border-[rgba(45,45,45,0.08)] rounded-2xl shadow-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('queue')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'queue'
              ? 'bg-[#F1E4C5] text-[#B8862D] shadow-xs'
              : 'text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5]'
          }`}
        >
          <Layers className="w-4 h-4" />
          Central PR Queue
          {requests.filter((r) => r.status === 'PENDING_APPROVAL').length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-[#B8862D] text-white text-[10px]">
              {requests.filter((r) => r.status === 'PENDING_APPROVAL').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'orders'
              ? 'bg-[#F1E4C5] text-[#B8862D] shadow-xs'
              : 'text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5]'
          }`}
        >
          <Truck className="w-4 h-4" />
          Purchase Orders & WhatsApp
          <span className="px-1.5 py-0.5 rounded-full bg-[rgba(45,45,45,0.08)] text-[#1C1C1C] text-[10px]">
            {orders.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('grn')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'grn'
              ? 'bg-[#F1E4C5] text-[#B8862D] shadow-xs'
              : 'text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5]'
          }`}
        >
          <PackageCheck className="w-4 h-4" />
          Destination GRN Receiving
          <span className="px-1.5 py-0.5 rounded-full bg-[rgba(45,45,45,0.08)] text-[#1C1C1C] text-[10px]">
            {grns.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('matching')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'matching'
              ? 'bg-[#F1E4C5] text-[#B8862D] shadow-xs'
              : 'text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5]'
          }`}
        >
          <Receipt className="w-4 h-4" />
          3-Way Invoice Matching
        </button>

        <button
          onClick={() => setActiveTab('suppliers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'suppliers'
              ? 'bg-[#F1E4C5] text-[#B8862D] shadow-xs'
              : 'text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5]'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Suppliers & Routing Rules
        </button>

        <button
          onClick={() => setActiveTab('closing')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'closing'
              ? 'bg-[#F1E4C5] text-[#B8862D] shadow-xs'
              : 'text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5]'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Bi-Monthly Closing Impact
        </button>
      </div>

      {/* TAB 1: CENTRAL PURCHASE CONTROL QUEUE */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 p-4 bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] shadow-xs">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Outlet Filter for HO */}
              {isHeadOffice && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#707070]">
                  <Building2 className="w-3.5 h-3.5 text-[#C79A3B]" />
                  <select
                    value={selectedBranchFilter}
                    onChange={(e) => setSelectedBranchFilter(e.target.value)}
                    className="p-1.5 bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] rounded-lg text-xs text-[#1C1C1C] font-semibold focus:outline-none"
                  >
                    <option value="ALL">All Destinations (HO)</option>
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} ({o.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#707070]">
                <span>Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="p-1.5 bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] rounded-lg text-xs text-[#1C1C1C] font-semibold focus:outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING_APPROVAL">Pending Approval</option>
                  <option value="APPROVED">Approved</option>
                  <option value="ORDERED">Consolidated / Ordered</option>
                  <option value="DRAFT">Draft</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>

              {/* Priority Filter */}
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#707070]">
                <span>Priority:</span>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="p-1.5 bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] rounded-lg text-xs text-[#1C1C1C] font-semibold focus:outline-none"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
            </div>

            {/* Batch Consolidation Trigger */}
            <div className="flex items-center gap-2">
              <button
                onClick={selectAllPendingPRs}
                className="px-3 py-1.5 rounded-xl border border-[rgba(45,45,45,0.12)] text-xs text-[#707070] hover:bg-[#FAF8F5] font-semibold transition-all"
              >
                {selectedPRIds.length > 0 ? 'Deselect All' : 'Select All Ready'}
              </button>

              <button
                onClick={() => setConsolidationModalOpen(true)}
                disabled={selectedPRIds.length === 0}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                  selectedPRIds.length > 0
                    ? 'bg-[#B8862D] text-white hover:bg-[#9E7326]'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Consolidate Selected ({selectedPRIds.length}) to PO
              </button>
            </div>
          </div>

          {/* PR Queue Table */}
          <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#FAF8F5] border-b border-[rgba(45,45,45,0.08)] text-[#707070] font-bold">
                    <th className="p-3.5 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedPRIds.length > 0 && selectedPRIds.length === requests.length}
                        onChange={selectAllPendingPRs}
                        className="rounded accent-[#B8862D]"
                      />
                    </th>
                    <th className="p-3.5">PR Number</th>
                    <th className="p-3.5">Destination</th>
                    <th className="p-3.5">Purchase Type</th>
                    <th className="p-3.5">Required By</th>
                    <th className="p-3.5">Items Summary</th>
                    <th className="p-3.5">Est. Value</th>
                    <th className="p-3.5">Priority</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(45,45,45,0.05)]">
                  {requests.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-gray-400">
                        No purchase requests match the current filters.
                      </td>
                    </tr>
                  ) : (
                    requests.map((pr) => {
                      const totalEst = (pr.items || []).reduce(
                        (acc: number, it: any) => acc + Number(it.requested_qty || 0) * Number(it.estimated_price || 0),
                        0
                      );
                      const isSelected = selectedPRIds.includes(pr.id);

                      return (
                        <tr key={pr.id} className={`hover:bg-[#FAF8F5]/60 transition-all ${isSelected ? 'bg-[#F1E4C5]/20' : ''}`}>
                          <td className="p-3.5 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => togglePRSelection(pr.id)}
                              className="rounded accent-[#B8862D]"
                            />
                          </td>
                          <td className="p-3.5 font-mono font-bold text-[#1C1C1C]">
                            {pr.request_number}
                          </td>
                          <td className="p-3.5 font-semibold text-[#1C1C1C]">
                            {pr.branch_name || 'Retail Outlet'}
                          </td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FAF8F5] text-[#707070] border border-[rgba(45,45,45,0.1)]">
                              {pr.purchase_type || 'DIRECT_OUTLET_PURCHASE'}
                            </span>
                          </td>
                          <td className="p-3.5 text-[#707070]">
                            {pr.required_date ? new Date(pr.required_date).toLocaleDateString() : 'Immediate'}
                          </td>
                          <td className="p-3.5 text-[#707070]">
                            <div className="flex items-center gap-1 font-semibold">
                              <span>{(pr.items || []).length} items</span>
                              <span className="text-[10px] text-gray-400">
                                ({(pr.items || []).slice(0, 2).map((i: any) => i.item_name).join(', ')}
                                {(pr.items || []).length > 2 ? '...' : ''})
                              </span>
                            </div>
                          </td>
                          <td className="p-3.5 font-bold font-mono text-[#1C1C1C]">
                            ${totalEst.toFixed(2)}
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                pr.priority === 'CRITICAL' || pr.priority === 'URGENT'
                                  ? 'bg-red-100 text-red-700'
                                  : pr.priority === 'HIGH'
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {pr.priority}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                pr.status === 'APPROVED'
                                  ? 'bg-[#2E8B57]/15 text-[#2E8B57]'
                                  : pr.status === 'PENDING_APPROVAL'
                                  ? 'bg-[#C79A3B]/15 text-[#B8862D]'
                                  : pr.status === 'ORDERED'
                                  ? 'bg-blue-100 text-blue-700'
                                  : pr.status === 'REJECTED'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {pr.status}
                            </span>
                          </td>
                          <td className="p-3.5 text-right space-x-1">
                            <button
                              onClick={() => setViewPRModal(pr)}
                              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
                              title="View Indent Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {pr.status === 'PENDING_APPROVAL' && (
                              <>
                                <button
                                  onClick={() => handleApprovePR(pr.id)}
                                  className="p-1.5 rounded-lg text-[#2E8B57] hover:bg-[#2E8B57]/10"
                                  title="Approve Indent"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() =>
                                    setActionReasonModal({
                                      type: 'RETURN_PR',
                                      id: pr.id,
                                      title: `Return Indent ${pr.request_number} for Correction`,
                                    })
                                  }
                                  className="p-1.5 rounded-lg text-orange-600 hover:bg-orange-50"
                                  title="Return for Correction"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() =>
                                    setActionReasonModal({
                                      type: 'REJECT_PR',
                                      id: pr.id,
                                      title: `Reject Indent ${pr.request_number}`,
                                    })
                                  }
                                  className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                                  title="Reject Indent"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PURCHASE ORDERS & WHATSAPP DISPATCH */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.length === 0 ? (
              <div className="col-span-full p-8 text-center bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] text-gray-400">
                No purchase orders generated yet. Use the Central PR Queue to consolidate indents or create a Direct PO.
              </div>
            ) : (
              orders.map((po) => {
                const totalAmt = Number(po.net_amount || po.total_amount || 0);
                const isConsolidated = !!po.allocations;

                return (
                  <div
                    key={po.id}
                    className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] space-y-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Header Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono font-bold text-[#1C1C1C]">
                          {po.po_number}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            po.status === 'RECEIVED'
                              ? 'bg-[#2E8B57]/15 text-[#2E8B57]'
                              : po.status === 'PARTIALLY_RECEIVED'
                              ? 'bg-blue-100 text-blue-700'
                              : po.status === 'SENT_MANUALLY'
                              ? 'bg-purple-100 text-purple-700'
                              : po.status === 'WHATSAPP_OPENED'
                              ? 'bg-green-100 text-green-700'
                              : po.status === 'APPROVED'
                              ? 'bg-[#F1E4C5] text-[#B8862D]'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {po.status}
                        </span>
                      </div>

                      {/* Supplier & Destination info */}
                      <div className="space-y-1">
                        <div className="text-sm font-bold text-[#1C1C1C] flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-[#C79A3B]" />
                          <span>{po.supplier_name || 'Vendor'}</span>
                        </div>
                        <div className="text-xs text-[#707070]">
                          Destination: <span className="font-semibold text-[#1C1C1C]">{po.branch_name || (isConsolidated ? 'Multi-Outlet' : 'Central Store')}</span>
                        </div>
                        <div className="text-[10px] text-gray-400">
                          Ordered: {new Date(po.order_date).toLocaleDateString()}
                        </div>
                      </div>

                      {/* Line Items Summary */}
                      <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] space-y-1 text-xs">
                        <div className="font-bold text-[#1C1C1C] flex justify-between">
                          <span>{(po.items || []).length} Consolidated Items</span>
                          <span className="font-mono text-[#B8862D]">${totalAmt.toFixed(2)}</span>
                        </div>
                        <div className="text-[11px] text-[#707070] line-clamp-2">
                          {(po.items || []).map((i: any) => `${i.item_name} (${i.ordered_qty} ${i.unit_symbol || ''})`).join(', ')}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 border-t border-[rgba(45,45,45,0.06)] flex flex-wrap items-center justify-between gap-2">
                      <button
                        onClick={() => setViewPOModal(po)}
                        className="px-2.5 py-1.5 rounded-lg bg-gray-100 text-[#1C1C1C] text-xs font-semibold hover:bg-gray-200 transition-all flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> Details
                      </button>

                      {po.status === 'PENDING_APPROVAL' && (
                        <button
                          onClick={() => handleApprovePO(po.id)}
                          className="px-3 py-1.5 rounded-lg bg-[#2E8B57] text-white text-xs font-bold hover:bg-[#257247] transition-all flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve PO
                        </button>
                      )}

                      {(po.status === 'APPROVED' || po.status === 'WHATSAPP_OPENED') && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenWhatsApp(po.id)}
                            className="px-3 py-1.5 rounded-lg bg-[#25D366] text-white text-xs font-bold hover:bg-[#1EBE5D] transition-all flex items-center gap-1 shadow-xs"
                            title="Open WhatsApp with Pre-filled Order Text"
                          >
                            <MessageCircle className="w-3.5 h-3.5" /> 1-Click WhatsApp
                          </button>
                          <button
                            onClick={() => handleConfirmSent(po.id)}
                            className="px-2.5 py-1.5 rounded-lg border border-[rgba(45,45,45,0.15)] text-[#1C1C1C] text-xs font-semibold hover:bg-[#FAF8F5]"
                            title="Mark as Sent Manually"
                          >
                            Sent OK
                          </button>
                        </div>
                      )}

                      <button
                        onClick={() => open3WayMatch(po.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#FAF8F5] border border-[#B8862D]/30 text-[#B8862D] text-xs font-semibold hover:bg-[#F1E4C5]"
                      >
                        3-Way Match
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: GOODS RECEIVE NOTES (GRN) & DESTINATION RECEIVING */}
      {activeTab === 'grn' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#FAF8F5] border-b border-[rgba(45,45,45,0.08)] text-[#707070] font-bold">
                    <th className="p-3.5">GRN Number</th>
                    <th className="p-3.5">Receive Date</th>
                    <th className="p-3.5">Destination Branch</th>
                    <th className="p-3.5">Destination Warehouse</th>
                    <th className="p-3.5">Supplier</th>
                    <th className="p-3.5">PO Ref</th>
                    <th className="p-3.5">Supplier Invoice #</th>
                    <th className="p-3.5">Received Value</th>
                    <th className="p-3.5">QC Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(45,45,45,0.05)]">
                  {grns.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-gray-400">
                        No goods receipt notes recorded yet. Click "Receive Delivery (GRN)" to log arriving stock.
                      </td>
                    </tr>
                  ) : (
                    grns.map((g) => (
                      <tr key={g.id} className="hover:bg-[#FAF8F5]/60 transition-all">
                        <td className="p-3.5 font-mono font-bold text-[#1C1C1C]">{g.grn_number}</td>
                        <td className="p-3.5 text-[#707070]">{new Date(g.receive_date).toLocaleDateString()}</td>
                        <td className="p-3.5 font-semibold text-[#1C1C1C]">{g.branch_name}</td>
                        <td className="p-3.5 text-[#707070]">{g.warehouse_name || 'Main Store'}</td>
                        <td className="p-3.5 text-[#707070]">{g.supplier_name || 'Direct Vendor'}</td>
                        <td className="p-3.5 font-mono text-[#B8862D]">{g.po_number || 'Direct Delivery'}</td>
                        <td className="p-3.5 font-mono text-gray-600">{g.supplier_invoice_number || '—'}</td>
                        <td className="p-3.5 font-mono font-bold text-[#1C1C1C]">${Number(g.total_amount || 0).toFixed(2)}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2E8B57]/15 text-[#2E8B57]">
                            {g.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: 3-WAY INVOICE MATCHING DRILL-DOWN */}
      {activeTab === 'matching' && (
        <div className="space-y-6">
          {/* PO Selector if not preselected */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] shadow-xs">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-[#1C1C1C]">Select Purchase Order to Audit:</span>
              <select
                value={selected3WayPOId || ''}
                onChange={(e) => {
                  if (e.target.value) open3WayMatch(e.target.value);
                }}
                className="p-2 bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] rounded-xl text-xs font-semibold text-[#1C1C1C] focus:outline-none"
              >
                <option value="">-- Choose PO --</option>
                {orders.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.po_number} - {po.supplier_name} (${Number(po.net_amount || po.total_amount).toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            {threeWayData && (
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    threeWayData.overall_status === 'PERFECT_MATCH'
                      ? 'bg-[#2E8B57]/15 text-[#2E8B57]'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {threeWayData.overall_status.replace('_', ' ')}
                </span>
              </div>
            )}
          </div>

          {loading3Way ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-[rgba(45,45,45,0.08)]">
              <RefreshCw className="w-6 h-6 animate-spin text-[#C79A3B] mx-auto mb-2" />
              <p className="text-xs text-[#707070]">Loading 3-way reconciliation audit ledger...</p>
            </div>
          ) : !threeWayData ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] text-gray-400">
              Select a purchase order above to inspect the 3-way match comparison between PO ordered quantity, actual GRN received quantity, and supplier invoice amount.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Financial KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] space-y-1 shadow-sm">
                  <span className="text-[10px] text-[#707070] uppercase font-semibold">1. PO Approved Amount</span>
                  <p className="text-lg font-bold text-[#1C1C1C] font-mono">
                    ${Number(threeWayData.total_ordered_amount).toFixed(2)}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] space-y-1 shadow-sm">
                  <span className="text-[10px] text-[#707070] uppercase font-semibold">2. Physical Stock Received</span>
                  <p className="text-lg font-bold text-[#2E8B57] font-mono">
                    ${Number(threeWayData.total_received_amount).toFixed(2)}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] space-y-1 shadow-sm">
                  <span className="text-[10px] text-[#707070] uppercase font-semibold">3. Supplier Invoice Amount</span>
                  <p className="text-lg font-bold text-[#B8862D] font-mono">
                    ${Number(threeWayData.total_invoice_amount).toFixed(2)}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] space-y-1 shadow-sm">
                  <span className="text-[10px] text-[#707070] uppercase font-semibold">4. Net Variance ($)</span>
                  <p
                    className={`text-lg font-bold font-mono ${
                      Math.abs(Number(threeWayData.total_invoice_amount) - Number(threeWayData.total_ordered_amount)) > 0.01
                        ? 'text-amber-600'
                        : 'text-[#2E8B57]'
                    }`}
                  >
                    ${(Number(threeWayData.total_invoice_amount) - Number(threeWayData.total_ordered_amount)).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* 3-Way Line Items Comparison */}
              <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] shadow-xs overflow-hidden">
                <div className="p-4 border-b border-[rgba(45,45,45,0.08)] bg-[#FAF8F5] flex items-center justify-between">
                  <h3 className="font-bold text-xs text-[#1C1C1C] uppercase tracking-wider">
                    Line-by-Line 3-Way Audit Ledger ({threeWayData.po_number})
                  </h3>
                  <span className="text-xs text-[#707070]">
                    Linked GRNs: {threeWayData.grn_count}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-white border-b border-[rgba(45,45,45,0.08)] text-[#707070] font-bold">
                        <th className="p-3.5">Item Name</th>
                        <th className="p-3.5">PO Ordered</th>
                        <th className="p-3.5">PO Rate</th>
                        <th className="p-3.5">PO Total</th>
                        <th className="p-3.5">GRN Accepted</th>
                        <th className="p-3.5">Actual Rate</th>
                        <th className="p-3.5">Actual Total</th>
                        <th className="p-3.5">Qty Var</th>
                        <th className="p-3.5">Rate Var</th>
                        <th className="p-3.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(45,45,45,0.05)] font-mono">
                      {threeWayData.lines.map((ln) => (
                        <tr key={ln.item_id} className="hover:bg-[#FAF8F5]/60 transition-all font-sans">
                          <td className="p-3.5 font-bold text-[#1C1C1C]">
                            {ln.item_name}
                            <span className="block text-[10px] font-mono text-gray-400">{ln.item_code}</span>
                          </td>
                          <td className="p-3.5 font-mono">{ln.po_qty} {ln.unit_symbol}</td>
                          <td className="p-3.5 font-mono">${Number(ln.po_rate).toFixed(2)}</td>
                          <td className="p-3.5 font-mono font-bold">${Number(ln.po_total).toFixed(2)}</td>
                          <td className="p-3.5 font-mono text-[#2E8B57] font-bold">{ln.accepted_qty} {ln.unit_symbol}</td>
                          <td className="p-3.5 font-mono">${Number(ln.actual_rate).toFixed(2)}</td>
                          <td className="p-3.5 font-mono font-bold text-[#2E8B57]">${Number(ln.actual_total).toFixed(2)}</td>
                          <td className={`p-3.5 font-mono ${Number(ln.qty_variance) !== 0 ? 'text-amber-600 font-bold' : 'text-gray-400'}`}>
                            {Number(ln.qty_variance) > 0 ? `+${ln.qty_variance}` : ln.qty_variance}
                          </td>
                          <td className={`p-3.5 font-mono ${Number(ln.rate_variance) !== 0 ? 'text-amber-600 font-bold' : 'text-gray-400'}`}>
                            ${Number(ln.rate_variance).toFixed(2)}
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                ln.status === 'MATCHED'
                                  ? 'bg-[#2E8B57]/15 text-[#2E8B57]'
                                  : ln.status === 'PENDING_DELIVERY'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {ln.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: SUPPLIERS & ROUTING RULES */}
      {activeTab === 'suppliers' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map((sup) => (
              <div key={sup.id} className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-[#1C1C1C] flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#C79A3B]" />
                    {sup.name}
                  </h3>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#FAF8F5] text-[#707070]">
                    {sup.code}
                  </span>
                </div>

                <div className="text-xs text-[#707070] space-y-1">
                  <div>Contact: <span className="text-[#1C1C1C] font-semibold">{sup.contactPerson || 'Sales Desk'}</span></div>
                  <div>WhatsApp / Phone: <span className="text-[#1C1C1C] font-mono font-semibold">{sup.phone || '—'}</span></div>
                  <div>Payment Terms: <span className="text-[#1C1C1C] font-semibold">{sup.paymentTerms || 'Net 15 Days'}</span></div>
                </div>

                <div className="pt-2 border-t border-[rgba(45,45,45,0.06)] flex items-center justify-between text-xs">
                  <span className="text-[10px] text-[#2E8B57] font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Active Vendor
                  </span>
                  <button
                    onClick={() => {
                      setNewPOSupplierId(sup.id);
                      setCreatePOModalOpen(true);
                    }}
                    className="text-[#B8862D] font-bold hover:underline"
                  >
                    Issue Direct PO &rarr;
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: BI-MONTHLY CLOSING IMPACT */}
      {activeTab === 'closing' && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-gradient-to-r from-white via-[#FAF8F5] to-white border border-[rgba(45,45,45,0.08)] shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs text-[#707070] font-semibold uppercase tracking-wider">Active Cycle</span>
              <p className="text-lg font-bold text-[#1C1C1C] font-['Outfit']">
                {closingDraft ? `${closingDraft.period_type === 'FIRST_HALF' ? '1st–15th' : '16th–MonthEnd'} (${closingDraft.year}-${closingDraft.month})` : 'Twice-Monthly Cycle'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-white border border-[rgba(45,45,45,0.08)] text-center">
                <span className="text-[10px] text-[#707070] block">Days Remaining</span>
                <span className="text-xl font-bold text-[#B8862D] font-['Outfit']">{closingDraft?.days_remaining ?? 0}</span>
              </div>
              <div className="p-3 rounded-xl bg-white border border-[rgba(45,45,45,0.08)] text-center">
                <span className="text-[10px] text-[#707070] block">Period Purchases</span>
                <span className="text-xl font-bold text-[#2E8B57] font-['Outfit'] font-mono">
                  ${Number(closingDraft?.total_purchases || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Physical Count Table */}
          {closingDraft && (
            <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] shadow-xs overflow-hidden">
              <div className="p-4 border-b border-[rgba(45,45,45,0.08)] bg-[#FAF8F5] flex items-center justify-between">
                <h3 className="font-bold text-xs text-[#1C1C1C] uppercase tracking-wider">
                  Physical Stock Count & Automated Valuation Ledger ({activeOutlet.name})
                </h3>
                <span className="text-xs text-[#707070]">Formula: Opening + Purchases - Closing = Actual Consumption</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-white border-b border-[rgba(45,45,45,0.08)] text-[#707070] font-bold">
                      <th className="p-3.5">Item Name</th>
                      <th className="p-3.5">Unit Cost</th>
                      <th className="p-3.5">Opening Qty</th>
                      <th className="p-3.5">Received Qty</th>
                      <th className="p-3.5">Theoretical Closing</th>
                      <th className="p-3.5">Physical Count</th>
                      <th className="p-3.5">Calculated Valuation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(45,45,45,0.05)] font-mono">
                    {closingDraft.items.map((ci) => {
                      const countVal = closingPhysicalCounts[ci.item_id] ?? ci.physical_closing_qty ?? 0;
                      const lineVal = countVal * ci.unit_cost;

                      return (
                        <tr key={ci.item_id} className="hover:bg-[#FAF8F5]/60 transition-all font-sans">
                          <td className="p-3.5 font-bold text-[#1C1C1C]">
                            {ci.item_name}
                            <span className="block text-[10px] font-mono text-gray-400">{ci.item_code}</span>
                          </td>
                          <td className="p-3.5 font-mono">${Number(ci.unit_cost).toFixed(2)}</td>
                          <td className="p-3.5 font-mono text-gray-600">{ci.opening_qty} {ci.unit_symbol}</td>
                          <td className="p-3.5 font-mono text-[#2E8B57] font-bold">+{ci.received_qty} {ci.unit_symbol}</td>
                          <td className="p-3.5 font-mono text-gray-600">{ci.theoretical_closing_qty} {ci.unit_symbol}</td>
                          <td className="p-3.5">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={countVal}
                              onChange={(e) =>
                                setClosingPhysicalCounts({
                                  ...closingPhysicalCounts,
                                  [ci.item_id]: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="w-24 p-1.5 bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] rounded-lg text-xs font-mono font-bold text-[#1C1C1C]"
                            />
                          </td>
                          <td className="p-3.5 font-mono font-bold text-[#B8862D]">${lineVal.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-4 border-t border-[rgba(45,45,45,0.08)] bg-[#FAF8F5] flex items-center justify-between">
                <input
                  type="text"
                  placeholder="Optional Closing Notes..."
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  className="w-1/2 p-2 bg-white border border-[rgba(45,45,45,0.15)] rounded-xl text-xs"
                />
                <button
                  onClick={handleSubmitClosing}
                  disabled={closingSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#1C1C1C] text-white text-xs font-bold hover:bg-[#2D2D2D] shadow-xs transition-all"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#C79A3B]" />
                  {closingSubmitting ? 'Calculating...' : 'Submit Physical Closing Count'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* 1. Modal: Batch Consolidation Preview */}
      {consolidationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-xl border border-[rgba(45,45,45,0.1)]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1C1C1C] flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#C79A3B]" />
                Auto-Consolidate Indents into Supplier POs
              </h3>
              <button onClick={() => setConsolidationModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#707070]">
              You have selected <strong>{selectedPRIds.length} purchase request(s)</strong>. The core engine will group line items strictly by primary supplier, consolidate quantities, preserve individual outlet delivery allocations, and create clean purchase orders.
            </p>

            <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] space-y-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-[#1C1C1C]">
                <input
                  type="checkbox"
                  checked={autoSubmitConsolidated}
                  onChange={(e) => setAutoSubmitConsolidated(e.target.checked)}
                  className="rounded accent-[#B8862D]"
                />
                Auto-submit POs to PENDING_APPROVAL status
              </label>

              <textarea
                placeholder="Consolidation Notes / Special Vendor Instructions..."
                value={consolidationNotes}
                onChange={(e) => setConsolidationNotes(e.target.value)}
                rows={2}
                className="w-full p-2.5 bg-white border border-[rgba(45,45,45,0.15)] rounded-xl text-xs focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConsolidationModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[rgba(45,45,45,0.15)] text-xs font-semibold text-[#707070] hover:bg-[#FAF8F5]"
              >
                Cancel
              </button>
              <button
                onClick={handleConsolidation}
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-[#B8862D] text-white text-xs font-bold hover:bg-[#9E7326] shadow-xs"
              >
                {loading ? 'Consolidating...' : 'Generate Supplier Orders'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal: Create New PR (Indent) */}
      {createPRModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full space-y-4 shadow-xl border border-[rgba(45,45,45,0.1)] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1C1C1C] flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-[#C79A3B]" />
                Draft New Outlet Purchase Request (Indent)
              </h3>
              <button onClick={() => setCreatePRModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[#707070] font-semibold mb-1">Destination Branch:</label>
                <select
                  value={newPRBranchId}
                  onChange={(e) => setNewPRBranchId(e.target.value)}
                  className="w-full p-2 bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] rounded-xl font-semibold"
                >
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#707070] font-semibold mb-1">Priority:</label>
                <select
                  value={newPRPriority}
                  onChange={(e) => setNewPRPriority(e.target.value)}
                  className="w-full p-2 bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] rounded-xl font-semibold"
                >
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>

              <div>
                <label className="block text-[#707070] font-semibold mb-1">Required Date:</label>
                <input
                  type="date"
                  value={newPRRequiredDate}
                  onChange={(e) => setNewPRRequiredDate(e.target.value)}
                  className="w-full p-2 bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] rounded-xl font-semibold"
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1C1C1C]">Requested Line Items:</span>
                <button
                  type="button"
                  onClick={() =>
                    setNewPRLines([...newPRLines, { item_id: '', requested_qty: 10, estimated_price: 0 }])
                  }
                  className="text-xs font-bold text-[#B8862D] hover:underline"
                >
                  + Add Line
                </button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto">
                {newPRLines.map((line, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)] text-xs">
                    <select
                      value={line.item_id}
                      onChange={(e) => {
                        const sel = inventoryItems.find((it) => it.id === e.target.value);
                        const updated = [...newPRLines];
                        updated[idx].item_id = e.target.value;
                        if (sel) {
                          updated[idx].estimated_price = Number(sel.cost_price || 0);
                          updated[idx].supplier_id = sel.supplier_id;
                        }
                        setNewPRLines(updated);
                      }}
                      className="flex-1 p-1.5 bg-white border border-[rgba(45,45,45,0.15)] rounded-lg font-semibold"
                    >
                      <option value="">-- Choose Item --</option>
                      {inventoryItems.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name} ({it.unit?.symbol || 'Unit'}) - ${Number(it.cost_price || 0).toFixed(2)}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      placeholder="Qty"
                      value={line.requested_qty}
                      onChange={(e) => {
                        const updated = [...newPRLines];
                        updated[idx].requested_qty = parseFloat(e.target.value) || 0;
                        setNewPRLines(updated);
                      }}
                      className="w-20 p-1.5 bg-white border border-[rgba(45,45,45,0.15)] rounded-lg font-mono"
                    />

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Est. Price"
                      value={line.estimated_price}
                      onChange={(e) => {
                        const updated = [...newPRLines];
                        updated[idx].estimated_price = parseFloat(e.target.value) || 0;
                        setNewPRLines(updated);
                      }}
                      className="w-24 p-1.5 bg-white border border-[rgba(45,45,45,0.15)] rounded-lg font-mono"
                    />

                    {newPRLines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setNewPRLines(newPRLines.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <textarea
              placeholder="Operational notes / justification..."
              value={newPRNotes}
              onChange={(e) => setNewPRNotes(e.target.value)}
              rows={2}
              className="w-full p-2.5 bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] rounded-xl text-xs focus:outline-none"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setCreatePRModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[rgba(45,45,45,0.15)] text-xs font-semibold text-[#707070] hover:bg-[#FAF8F5]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePR}
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-[#1C1C1C] text-white text-xs font-bold hover:bg-[#2D2D2D] shadow-xs"
              >
                {loading ? 'Submitting...' : 'Submit Indent'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal: Create Direct PO */}
      {createPOModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full space-y-4 shadow-xl border border-[rgba(45,45,45,0.1)] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1C1C1C] flex items-center gap-2">
                <Truck className="w-5 h-5 text-[#C79A3B]" />
                Issue Direct Supplier Purchase Order
              </h3>
              <button onClick={() => setCreatePOModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[#707070] font-semibold mb-1">Target Supplier:</label>
                <select
                  value={newPOSupplierId}
                  onChange={(e) => setNewPOSupplierId(e.target.value)}
                  className="w-full p-2 bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] rounded-xl font-semibold"
                >
                  <option value="">-- Choose Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#707070] font-semibold mb-1">Destination Branch:</label>
                <select
                  value={newPOBranchId}
                  onChange={(e) => setNewPOBranchId(e.target.value)}
                  className="w-full p-2 bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] rounded-xl font-semibold"
                >
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#707070] font-semibold mb-1">Expected Delivery:</label>
                <input
                  type="date"
                  value={newPODeliveryDate}
                  onChange={(e) => setNewPODeliveryDate(e.target.value)}
                  className="w-full p-2 bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] rounded-xl font-semibold"
                />
              </div>
            </div>

            {/* Line items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1C1C1C]">Ordered Items:</span>
                <button
                  type="button"
                  onClick={() =>
                    setNewPOLines([...newPOLines, { item_id: '', ordered_qty: 10, unit_price: 50 }])
                  }
                  className="text-xs font-bold text-[#B8862D] hover:underline"
                >
                  + Add Item
                </button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto">
                {newPOLines.map((line, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)] text-xs">
                    <select
                      value={line.item_id}
                      onChange={(e) => {
                        const sel = inventoryItems.find((it) => it.id === e.target.value);
                        const updated = [...newPOLines];
                        updated[idx].item_id = e.target.value;
                        if (sel) {
                          updated[idx].unit_price = Number(sel.cost_price || 0);
                        }
                        setNewPOLines(updated);
                      }}
                      className="flex-1 p-1.5 bg-white border border-[rgba(45,45,45,0.15)] rounded-lg font-semibold"
                    >
                      <option value="">-- Choose Item --</option>
                      {inventoryItems.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name} ({it.unit?.symbol || 'Unit'}) - ${Number(it.cost_price || 0).toFixed(2)}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      placeholder="Qty"
                      value={line.ordered_qty}
                      onChange={(e) => {
                        const updated = [...newPOLines];
                        updated[idx].ordered_qty = parseFloat(e.target.value) || 0;
                        setNewPOLines(updated);
                      }}
                      className="w-20 p-1.5 bg-white border border-[rgba(45,45,45,0.15)] rounded-lg font-mono"
                    />

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Rate ($)"
                      value={line.unit_price}
                      onChange={(e) => {
                        const updated = [...newPOLines];
                        updated[idx].unit_price = parseFloat(e.target.value) || 0;
                        setNewPOLines(updated);
                      }}
                      className="w-24 p-1.5 bg-white border border-[rgba(45,45,45,0.15)] rounded-lg font-mono"
                    />

                    {newPOLines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setNewPOLines(newPOLines.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <textarea
              placeholder="Delivery instructions / notes..."
              value={newPONotes}
              onChange={(e) => setNewPONotes(e.target.value)}
              rows={2}
              className="w-full p-2.5 bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] rounded-xl text-xs focus:outline-none"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setCreatePOModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[rgba(45,45,45,0.15)] text-xs font-semibold text-[#707070] hover:bg-[#FAF8F5]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePO}
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-[#1C1C1C] text-white text-xs font-bold hover:bg-[#2D2D2D] shadow-xs"
              >
                {loading ? 'Creating...' : 'Issue Direct PO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Modal: Receive Delivery (Create GRN) */}
      {createGRNModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-3xl w-full space-y-4 shadow-xl border border-[rgba(45,45,45,0.1)] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1C1C1C] flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-[#2E8B57]" />
                Receive Physical Stock Delivery (Destination GRN)
              </h3>
              <button onClick={() => setCreateGRNModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[#707070] font-semibold mb-1">Linked Purchase Order:</label>
                <select
                  value={newGRNPOId}
                  onChange={(e) => handleSelectPOForGRN(e.target.value)}
                  className="w-full p-2 bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] rounded-xl font-semibold"
                >
                  <option value="">-- Direct Supplier Delivery (No PO) --</option>
                  {orders
                    .filter((o) => o.status !== 'CANCELLED' && o.status !== 'RECEIVED')
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.po_number} - {o.supplier_name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[#707070] font-semibold mb-1">Destination Outlet:</label>
                <select
                  value={newGRNBranchId}
                  onChange={(e) => setNewGRNBranchId(e.target.value)}
                  className="w-full p-2 bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] rounded-xl font-semibold"
                >
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#707070] font-semibold mb-1">Supplier Invoice Number:</label>
                <input
                  type="text"
                  placeholder="e.g. INV-2026-8942"
                  value={newGRNInvoiceNum}
                  onChange={(e) => setNewGRNInvoiceNum(e.target.value)}
                  className="w-full p-2 bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] rounded-xl font-semibold font-mono"
                />
              </div>
            </div>

            {/* Receiving Lines */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1C1C1C]">Received Stock Items & Quality Check:</span>
                <button
                  type="button"
                  onClick={() =>
                    setNewGRNLines([
                      ...newGRNLines,
                      {
                        item_id: '',
                        received_qty: 10,
                        accepted_qty: 10,
                        rejected_qty: 0,
                        unit_price: 50,
                        qc_status: 'PASSED',
                      },
                    ])
                  }
                  className="text-xs font-bold text-[#B8862D] hover:underline"
                >
                  + Add Received Line
                </button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto">
                {newGRNLines.map((line, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)] text-xs space-y-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={line.item_id}
                        onChange={(e) => {
                          const sel = inventoryItems.find((it) => it.id === e.target.value);
                          const updated = [...newGRNLines];
                          updated[idx].item_id = e.target.value;
                          if (sel) {
                            updated[idx].unit_price = Number(sel.cost_price || 0);
                            updated[idx].item_name = sel.name;
                            updated[idx].unit_symbol = sel.unit?.symbol || 'UNIT';
                          }
                          setNewGRNLines(updated);
                        }}
                        className="flex-1 p-1.5 bg-white border border-[rgba(45,45,45,0.15)] rounded-lg font-semibold"
                      >
                        <option value="">-- Choose Item --</option>
                        {inventoryItems.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name} ({it.unit?.symbol || 'Unit'})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="Rec Qty"
                        value={line.received_qty}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const updated = [...newGRNLines];
                          updated[idx].received_qty = val;
                          updated[idx].accepted_qty = Math.max(0, val - (updated[idx].rejected_qty || 0));
                          setNewGRNLines(updated);
                        }}
                        className="w-20 p-1.5 bg-white border border-[rgba(45,45,45,0.15)] rounded-lg font-mono"
                        title="Physical Received Qty"
                      />

                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="Acc Qty"
                        value={line.accepted_qty}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const updated = [...newGRNLines];
                          updated[idx].accepted_qty = val;
                          setNewGRNLines(updated);
                        }}
                        className="w-20 p-1.5 bg-white border border-[#2E8B57]/30 text-[#2E8B57] font-bold rounded-lg font-mono"
                        title="Accepted Qty"
                      />

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Rate ($)"
                        value={line.unit_price}
                        onChange={(e) => {
                          const updated = [...newGRNLines];
                          updated[idx].unit_price = parseFloat(e.target.value) || 0;
                          setNewGRNLines(updated);
                        }}
                        className="w-20 p-1.5 bg-white border border-[rgba(45,45,45,0.15)] rounded-lg font-mono"
                        title="Unit Rate"
                      />

                      <select
                        value={line.qc_status}
                        onChange={(e) => {
                          const updated = [...newGRNLines];
                          updated[idx].qc_status = e.target.value as any;
                          setNewGRNLines(updated);
                        }}
                        className="w-24 p-1.5 bg-white border border-[rgba(45,45,45,0.15)] rounded-lg font-semibold"
                      >
                        <option value="PASSED">QC PASSED</option>
                        <option value="FAILED">QC FAILED</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => setNewGRNLines(newGRNLines.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Batch Number (optional)"
                        value={line.batch_number || ''}
                        onChange={(e) => {
                          const updated = [...newGRNLines];
                          updated[idx].batch_number = e.target.value;
                          setNewGRNLines(updated);
                        }}
                        className="flex-1 p-1 bg-white border border-[rgba(45,45,45,0.1)] rounded-md text-[11px] font-mono"
                      />
                      <input
                        type="date"
                        placeholder="Expiry Date"
                        value={line.expiry_date || ''}
                        onChange={(e) => {
                          const updated = [...newGRNLines];
                          updated[idx].expiry_date = e.target.value;
                          setNewGRNLines(updated);
                        }}
                        className="w-36 p-1 bg-white border border-[rgba(45,45,45,0.1)] rounded-md text-[11px]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <textarea
              placeholder="Inspection / receiving notes..."
              value={newGRNNotes}
              onChange={(e) => setNewGRNNotes(e.target.value)}
              rows={2}
              className="w-full p-2.5 bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] rounded-xl text-xs focus:outline-none"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setCreateGRNModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[rgba(45,45,45,0.15)] text-xs font-semibold text-[#707070] hover:bg-[#FAF8F5]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGRN}
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-[#2E8B57] text-white text-xs font-bold hover:bg-[#257247] shadow-xs"
              >
                {loading ? 'Receiving...' : 'Confirm Goods Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal: View Indent Details */}
      {viewPRModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full space-y-4 shadow-xl border border-[rgba(45,45,45,0.1)] max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1C1C1C]">
                Indent Details: {viewPRModal.request_number}
              </h3>
              <button onClick={() => setViewPRModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-[#707070] p-3 rounded-2xl bg-[#FAF8F5]">
              <div>Destination: <strong className="text-[#1C1C1C]">{viewPRModal.branch_name}</strong></div>
              <div>Status: <strong className="text-[#1C1C1C]">{viewPRModal.status}</strong></div>
              <div>Priority: <strong className="text-[#1C1C1C]">{viewPRModal.priority}</strong></div>
              <div>Required: <strong className="text-[#1C1C1C]">{new Date(viewPRModal.required_date).toLocaleDateString()}</strong></div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-[#1C1C1C]">Line Items:</span>
              <div className="divide-y divide-[rgba(45,45,45,0.06)] max-h-48 overflow-y-auto">
                {(viewPRModal.items || []).map((it: any) => (
                  <div key={it.id} className="py-2 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-[#1C1C1C]">{it.item_name}</span>
                      <span className="text-gray-400 block text-[10px]">Supplier: {it.supplier_name || 'Item Master Default'}</span>
                    </div>
                    <div className="text-right font-mono">
                      <span className="font-bold">{it.requested_qty} {it.unit_symbol}</span>
                      <span className="text-gray-400 block text-[10px]">@ ${Number(it.estimated_price || 0).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                onClick={() => setViewPRModal(null)}
                className="px-4 py-2 rounded-xl bg-[#1C1C1C] text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal: View PO Details & WhatsApp Message */}
      {viewPOModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full space-y-4 shadow-xl border border-[rgba(45,45,45,0.1)] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1C1C1C]">
                Purchase Order: {viewPOModal.po_number}
              </h3>
              <button onClick={() => setViewPOModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-[#707070] p-3 rounded-2xl bg-[#FAF8F5]">
              <div>Supplier: <strong className="text-[#1C1C1C]">{viewPOModal.supplier_name}</strong></div>
              <div>Status: <strong className="text-[#1C1C1C]">{viewPOModal.status}</strong></div>
              <div>Destination: <strong className="text-[#1C1C1C]">{viewPOModal.branch_name || 'Multi-Destination'}</strong></div>
              <div>Order Date: <strong className="text-[#1C1C1C]">{new Date(viewPOModal.order_date).toLocaleDateString()}</strong></div>
            </div>

            {/* Line items */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-[#1C1C1C]">Consolidated Line Items:</span>
              <div className="divide-y divide-[rgba(45,45,45,0.06)] max-h-48 overflow-y-auto">
                {(viewPOModal.items || []).map((it: any) => (
                  <div key={it.id} className="py-2 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-[#1C1C1C]">{it.item_name}</span>
                      <span className="text-gray-400 block text-[10px]">Received: {it.received_qty || 0} / {it.ordered_qty} {it.unit_symbol}</span>
                    </div>
                    <div className="text-right font-mono">
                      <span className="font-bold">${Number(it.total_price || 0).toFixed(2)}</span>
                      <span className="text-gray-400 block text-[10px]">{it.ordered_qty} x ${Number(it.unit_price || 0).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Allocations breakdown if multi-outlet */}
            {viewPOModal.allocations && (
              <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] space-y-2 text-xs">
                <span className="font-bold text-[#1C1C1C] block">Multi-Outlet Allocation Breakdown:</span>
                <pre className="text-[10px] font-mono bg-white p-2 rounded-xl border border-[rgba(45,45,45,0.08)] max-h-36 overflow-y-auto whitespace-pre-wrap">
                  {typeof viewPOModal.allocations === 'string'
                    ? viewPOModal.allocations
                    : JSON.stringify(viewPOModal.allocations, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-[rgba(45,45,45,0.06)]">
              <div className="font-mono text-sm font-bold text-[#1C1C1C]">
                Total Net Amount: ${Number(viewPOModal.net_amount || viewPOModal.total_amount || 0).toFixed(2)}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenWhatsApp(viewPOModal.id)}
                  className="px-4 py-2 rounded-xl bg-[#25D366] text-white text-xs font-bold hover:bg-[#1EBE5D] flex items-center gap-1.5 shadow-xs"
                >
                  <MessageCircle className="w-4 h-4" /> Open WhatsApp
                </button>
                <button
                  onClick={() => setViewPOModal(null)}
                  className="px-4 py-2 rounded-xl bg-[#1C1C1C] text-white text-xs font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal: Action Reason Dialog (Reject/Return/Cancel) */}
      {actionReasonModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-xl border border-[rgba(45,45,45,0.1)]">
            <h3 className="text-sm font-bold text-[#1C1C1C] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              {actionReasonModal.title}
            </h3>

            <p className="text-xs text-[#707070]">
              Please state the reason or corrective feedback for this action. This will be recorded permanently in the structured audit trail.
            </p>

            <textarea
              placeholder="Enter mandatory reason..."
              value={actionReasonText}
              onChange={(e) => setActionReasonText(e.target.value)}
              rows={3}
              className="w-full p-2.5 bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] rounded-xl text-xs focus:outline-none"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setActionReasonModal(null)}
                className="px-4 py-2 rounded-xl border border-[rgba(45,45,45,0.15)] text-xs font-semibold text-[#707070] hover:bg-[#FAF8F5]"
              >
                Cancel
              </button>
              <button
                onClick={submitActionReason}
                disabled={!actionReasonText.trim() || loading}
                className="px-5 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseWorkspace;
