'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useOutlet } from '@/context/OutletContext';
import { apiClient } from '@/api/client';
import { procurementApi } from '@/api/procurement';
import type { WorkspaceId } from '@/components/common/Sidebar';
import {
  Supplier,
  SupplierItem,
  PurchaseRequest,
  PurchaseOrder,
  GoodsReceiveNote,
} from '@/types/purchase.types';
import {
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  PackageCheck,
  Receipt,
  Eye,
  Trash2,
  X,
  Check,
} from 'lucide-react';

interface PurchaseWorkspaceProps {
  onNavigateWorkspace?: (workspace: WorkspaceId) => void;
  initialTab?: 'needs' | 'receiving' | 'my_bills';
}

type PurchaseTab = 'needs' | 'receiving' | 'my_bills';

export const PurchaseWorkspace: React.FC<PurchaseWorkspaceProps> = ({ onNavigateWorkspace, initialTab }) => {
  const { activeOutlet, isHeadOffice } = useOutlet();

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<PurchaseTab>(initialTab || 'needs');
  
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Loading & Feedback
  const [loading, setLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filter States
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Data Stores
  const [requests, setRequests] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [grns, setGrns] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [vendorItems, setVendorItems] = useState<SupplierItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);

  // Modals
  const [createPRModalOpen, setCreatePRModalOpen] = useState<boolean>(false);
  const [createGRNModalOpen, setCreateGRNModalOpen] = useState<boolean>(false);
  const [submitBillModalOpen, setSubmitBillModalOpen] = useState<boolean>(false);
  const [viewPRModal, setViewPRModal] = useState<any | null>(null);
  const [viewGRNModal, setViewGRNModal] = useState<any | null>(null);
  const [rejectGRNModal, setRejectGRNModal] = useState<{ open: boolean; grnId: string; grnNumber: string }>({
    open: false,
    grnId: '',
    grnNumber: '',
  });
  const [grnRejectReason, setGrnRejectReason] = useState<string>('');

  // New Need / PR Form State
  const [newPRPriority, setNewPRPriority] = useState<string>('MEDIUM');
  const [newPRRequiredDate, setNewPRRequiredDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  );
  const [newPRNotes, setNewPRNotes] = useState<string>('');
  const [newPRLines, setNewPRLines] = useState<
    Array<{ item_id: string; requested_qty: number; estimated_price: number; supplier_id?: string; supplier_name?: string; notes?: string }>
  >([{ item_id: '', requested_qty: 10, estimated_price: 0 }]);

  // New GRN / Receiving Form State
  const [newGRNPOId, setNewGRNPOId] = useState<string>('');
  const [newGRNSupplierId, setNewGRNSupplierId] = useState<string>('');
  const [newGRNInvoiceNum, setNewGRNInvoiceNum] = useState<string>('');
  const [newGRNInvoiceAmt, setNewGRNInvoiceAmt] = useState<number>(0);
  const [newGRNNotes, setNewGRNNotes] = useState<string>('');
  const [newGRNInvoiceFile, setNewGRNInvoiceFile] = useState<{
    fileName: string;
    fileType: string;
    fileBase64: string;
    size: number;
  } | null>(null);

  // Submit Emergency / Local Bill Form State
  const [billPlatform, setBillPlatform] = useState<string>('Local Supplier');
  const [billCustomPlatform, setBillCustomPlatform] = useState<string>('');
  const [billPurchaseDate, setBillPurchaseDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [billInvoiceNumber, setBillInvoiceNumber] = useState<string>('');
  const [billNotes, setBillNotes] = useState<string>('');
  const [billFile, setBillFile] = useState<{ fileName: string; fileBase64: string; size: number } | null>(null);
  const [billLines, setBillLines] = useState<
    Array<{ item_id: string; quantity: number; rate: number }>
  >([{ item_id: '', quantity: 1, rate: 0 }]);

  // Fetch Core Data
  const fetchData = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const targetBranch = isHeadOffice ? undefined : activeOutlet.id;

      // 1. Fetch PRs (Needs)
      const prRes = await procurementApi.getPurchaseRequests({
        branch_id: targetBranch,
      }).catch(() => []);
      setRequests(prRes || []);

      // 2. Fetch POs (Approved deliveries)
      const poRes = await procurementApi.getPurchaseOrders({
        branch_id: targetBranch,
      }).catch(() => []);
      setOrders(poRes || []);

      // 3. Fetch GRNs
      const grnRes = await procurementApi.getGoodsReceiveNotes({
        branch_id: targetBranch,
      }).catch(() => []);
      setGrns(grnRes || []);

      // 4. Fetch Suppliers
      const supRes = await procurementApi.getSuppliers().catch(() => []);
      setSuppliers(supRes || []);

      // 5. Fetch Vendor-Item Mappings from Project Setup
      const vItemsRes = await procurementApi.getVendorItems({ is_active: true }).catch(() => []);
      setVendorItems(vItemsRes || []);

      // 6. Fetch Inventory Items
      const itemsRes = await apiClient.get('/inventory/items').catch(() => ({ data: [] }));
      const itemsList = Array.isArray(itemsRes.data) ? itemsRes.data : itemsRes.data?.data || [];
      setInventoryItems(itemsList);
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
  }, [activeOutlet.id, isHeadOffice]);

  // Handle Item Selection in Need Form (Auto-determine vendor from Setup mapping)
  const handleSelectPRItem = (index: number, itemId: string) => {
    const itemObj = inventoryItems.find((i) => i.id === itemId);
    const mapping = vendorItems.find((m) => m.item_id === itemId && (m.is_preferred || m.is_active));
    const matchedSupplier = mapping
      ? suppliers.find((s) => s.id === mapping.supplier_id)
      : suppliers.find((s) => s.id === itemObj?.supplier_id);

    const price = mapping?.purchase_price
      ? Number(mapping.purchase_price)
      : itemObj?.cost_price
      ? Number(itemObj.cost_price)
      : 0;

    const updated = [...newPRLines];
    updated[index] = {
      ...updated[index],
      item_id: itemId,
      supplier_id: mapping?.supplier_id || itemObj?.supplier_id || undefined,
      supplier_name: mapping?.supplier_name || matchedSupplier?.name || undefined,
      estimated_price: price,
    };
    setNewPRLines(updated);
  };

  // Submit New Need (PR)
  const handleCreatePR = async () => {
    if (newPRLines.length === 0 || !newPRLines[0].item_id) {
      setFeedback({ type: 'error', message: 'Please select at least one item.' });
      return;
    }
    setLoading(true);
    try {
      await procurementApi.createPurchaseRequest({
        branch_id: activeOutlet.id,
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
      setFeedback({ type: 'success', message: 'Need requirement submitted to Head Office successfully.' });
      setCreatePRModalOpen(false);
      setNewPRLines([{ item_id: '', requested_qty: 10, estimated_price: 0 }]);
      setNewPRNotes('');
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to submit need requirement.' });
    } finally {
      setLoading(false);
    }
  };

  // Submit Receiving / GRN
  const handleCreateGRN = async () => {
    if (!newGRNPOId) {
      setFeedback({ type: 'error', message: 'Please select an approved Purchase Order for receiving.' });
      return;
    }
    if (!newGRNInvoiceNum.trim()) {
      setFeedback({ type: 'error', message: 'Please enter the Supplier Invoice / Challan Number.' });
      return;
    }
    setLoading(true);
    try {
      await procurementApi.createGoodsReceiveFromPO({
        po_id: newGRNPOId,
        branch_id: activeOutlet.id,
        supplier_invoice_number: newGRNInvoiceNum.trim(),
        invoice_amount: Number(newGRNInvoiceAmt || 0),
        invoice_file_name: newGRNInvoiceFile?.fileName || undefined,
        notes: newGRNNotes || undefined,
      });

      setFeedback({
        type: 'success',
        message: 'Delivery receiving submitted! Queued for Head Office approval.',
      });
      setCreateGRNModalOpen(false);
      setNewGRNPOId('');
      setNewGRNInvoiceNum('');
      setNewGRNInvoiceAmt(0);
      setNewGRNNotes('');
      setNewGRNInvoiceFile(null);
      fetchData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || err?.message || 'GRN submission failed.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Submit Emergency / Local Bill
  const handleSubmitLocalBill = async () => {
    if (billLines.length === 0 || !billLines[0].item_id) {
      setFeedback({ type: 'error', message: 'Please select at least one item.' });
      return;
    }
    const effectivePlatform =
      billPlatform === 'Other' ? billCustomPlatform || 'Local Supplier' : billPlatform;
    const totalAmount = billLines.reduce(
      (sum, l) => sum + Number(l.quantity || 0) * Number(l.rate || 0),
      0
    );

    setLoading(true);
    try {
      const invNum = billInvoiceNumber.trim() || `BILL-${Date.now().toString().slice(-6)}`;
      const combinedNotes = `[Platform: ${effectivePlatform}] ${billNotes || ''} ${
        billFile ? `[Attachment: ${billFile.fileName}]` : ''
      }`.trim();

      await procurementApi.createGoodsReceiveNote({
        branch_id: activeOutlet.id,
        supplier_invoice_number: invNum,
        invoice_amount: totalAmount,
        receive_date: new Date(billPurchaseDate).toISOString(),
        notes: combinedNotes,
        status: 'PENDING_APPROVAL',
        auto_approve: false,
        items: billLines.map((l) => ({
          item_id: l.item_id,
          received_qty: Number(l.quantity),
          accepted_qty: Number(l.quantity),
          rejected_qty: 0,
          unit_price: Number(l.rate),
          qc_status: 'PASSED',
        })),
      });

      setFeedback({
        type: 'success',
        message: 'Bill submitted successfully for HO approval. Stock will be added upon approval.',
      });
      setSubmitBillModalOpen(false);
      setBillLines([{ item_id: '', quantity: 1, rate: 0 }]);
      setBillInvoiceNumber('');
      setBillNotes('');
      setBillFile(null);
      fetchData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || err?.message || 'Failed to submit bill.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Approve GRN / Bill (Adds Stock with duplicate protection)
  const handleApproveGRN = async (grnId: string) => {
    setLoading(true);
    try {
      await procurementApi.approveGoodsReceiveNote(grnId);
      setFeedback({
        type: 'success',
        message: 'Approved! Stock successfully added to destination warehouse.',
      });
      fetchData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || err?.message || 'Approval failed.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Reject GRN / Bill (No stock added)
  const handleConfirmRejectGRN = async () => {
    if (!grnRejectReason.trim()) {
      setFeedback({ type: 'error', message: 'Please provide a rejection reason.' });
      return;
    }
    setLoading(true);
    try {
      await procurementApi.rejectGoodsReceiveNote(rejectGRNModal.grnId, {
        reason: grnRejectReason.trim(),
      });
      setFeedback({
        type: 'success',
        message: `Record ${rejectGRNModal.grnNumber} rejected. No stock was added.`,
      });
      setRejectGRNModal({ open: false, grnId: '', grnNumber: '' });
      setGrnRejectReason('');
      fetchData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || 'Rejection failed.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Filtered Needs
  const filteredNeeds = useMemo(() => {
    return requests.filter((r) => {
      const matchSearch =
        !searchQuery ||
        r.request_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.items?.some((it: any) => it.item_name?.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [requests, searchQuery, statusFilter]);

  // Filtered Deliveries to Receive
  const incomingDeliveries = useMemo(() => {
    return orders.filter(
      (o) =>
        o.status === 'APPROVED' ||
        o.status === 'WHATSAPP_OPENED' ||
        o.status === 'SENT_MANUALLY' ||
        o.status === 'PARTIALLY_RECEIVED'
    );
  }, [orders]);

  // Filtered Receiving Log (Supplier GRNs)
  const supplierGRNs = useMemo(() => {
    return grns.filter((g) => g.po_id || !g.notes?.includes('[Platform:'));
  }, [grns]);

  // Filtered Local Bills (My Bills)
  const localBills = useMemo(() => {
    return grns.filter((g) => g.notes?.includes('[Platform:') || !g.po_id);
  }, [grns]);

  return (
    <div className="space-y-4">
      {/* Top Mobile-First Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#1C1C1C] font-['Outfit']">Purchase</h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF8F5] text-[#B8862D] font-bold border border-[rgba(45,45,45,0.1)]">
              [{activeOutlet.code}]
            </span>
          </div>
          <p className="text-xs text-[#707070] mt-0.5">
            Manage supplies, receiving & outlet purchases
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-xl border border-[rgba(45,45,45,0.12)] text-[#707070] hover:bg-[#FAF8F5] transition-all"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#C79A3B]' : ''}`} />
          </button>

          {activeTab === 'needs' && (
            <button
              onClick={() => setCreatePRModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1C1C1C] text-white text-xs font-bold hover:bg-[#2D2D2D] shadow-xs transition-all active:scale-[0.98]"
            >
              <Plus className="w-3.5 h-3.5 text-[#C79A3B]" />
              + New Need
            </button>
          )}

          {activeTab === 'receiving' && (
            <button
              onClick={() => setCreateGRNModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2E8B57] text-white text-xs font-bold hover:bg-[#257247] shadow-xs transition-all active:scale-[0.98]"
            >
              <PackageCheck className="w-3.5 h-3.5" />
              + Receive Delivery
            </button>
          )}

          {activeTab === 'my_bills' && (
            <button
              onClick={() => setSubmitBillModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#B8862D] text-white text-xs font-bold hover:bg-[#9c7124] shadow-xs transition-all active:scale-[0.98]"
            >
              <Plus className="w-3.5 h-3.5" />
              + Submit Bill
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs font-semibold ${
            feedback.type === 'success'
              ? 'bg-[#2E8B57]/10 text-[#2E8B57] border border-[#2E8B57]/20'
              : 'bg-red-500/10 text-red-600 border border-red-500/20'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3 Streamlined Tabs */}
      <div className="flex items-center gap-2 border-b border-[rgba(45,45,45,0.08)] pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('needs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'needs'
              ? 'bg-[#F1E4C5] text-[#B8862D] shadow-xs border border-[#B8862D]/30'
              : 'text-[#707070] hover:bg-[#FAF8F5] border border-transparent'
          }`}
        >
          <FileText className="w-4 h-4" />
          Needs
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/80 border border-current font-mono">
            {requests.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('receiving')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'receiving'
              ? 'bg-[#F1E4C5] text-[#B8862D] shadow-xs border border-[#B8862D]/30'
              : 'text-[#707070] hover:bg-[#FAF8F5] border border-transparent'
          }`}
        >
          <PackageCheck className="w-4 h-4" />
          Receiving
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/80 border border-current font-mono">
            {supplierGRNs.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('my_bills')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'my_bills'
              ? 'bg-[#F1E4C5] text-[#B8862D] shadow-xs border border-[#B8862D]/30'
              : 'text-[#707070] hover:bg-[#FAF8F5] border border-transparent'
          }`}
        >
          <Receipt className="w-4 h-4" />
          My Bills
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/80 border border-current font-mono">
            {localBills.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: NEEDS (Outlet Supply Requirements) */}
      {/* ========================================================================= */}
      {activeTab === 'needs' && (
        <div className="space-y-4">
          {/* Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-[rgba(45,45,45,0.08)]">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#707070]" />
              <input
                type="text"
                placeholder="Search requirements..."
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
                className="text-xs bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] rounded-xl px-2.5 py-1.5 font-semibold focus:outline-none"
              >
                <option value="ALL">All Status</option>
                <option value="PENDING_APPROVAL">Pending HO Approval</option>
                <option value="APPROVED">Approved</option>
                <option value="ORDERED">Ordered (PO Issued)</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>

          {/* Needs List */}
          <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] shadow-xs overflow-hidden">
            {filteredNeeds.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-8 h-8 text-[#B8862D] mx-auto mb-2 opacity-60" />
                <h3 className="text-sm font-bold text-[#1C1C1C]">No supply requirements found</h3>
                <p className="text-xs text-[#707070] mt-1 max-w-sm mx-auto">
                  Click "+ New Need" above to submit an item requirement for this outlet to Head Office.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredNeeds.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF8F5]/50 transition-colors"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-[#1C1C1C] font-mono">
                          {req.request_number}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            req.status === 'APPROVED' || req.status === 'ORDERED'
                              ? 'bg-green-100 text-green-800'
                              : req.status === 'REJECTED'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {req.status?.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] text-[#707070] px-2 py-0.5 rounded bg-gray-100 font-semibold">
                          Priority: {req.priority}
                        </span>
                      </div>

                      <div className="text-xs text-[#707070]">
                        {req.items?.length || 0} item(s):{' '}
                        <span className="font-medium text-[#1C1C1C]">
                          {req.items
                            ?.map((it: any) => `${it.item_name} (${it.requested_qty} ${it.unit_symbol || ''})`)
                            .slice(0, 3)
                            .join(', ')}
                          {req.items?.length > 3 ? '...' : ''}
                        </span>
                      </div>

                      {req.notes && (
                        <p className="text-[11px] text-[#8A641D] bg-[#FAF8F5] px-2 py-0.5 rounded inline-block">
                          Note: {req.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() => setViewPRModal(req)}
                        className="px-3 py-1.5 rounded-xl border border-[rgba(45,45,45,0.12)] text-xs font-bold text-[#1C1C1C] hover:bg-[#FAF8F5] transition-all flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: RECEIVING (Approved Deliveries & GRNs) */}
      {/* ========================================================================= */}
      {activeTab === 'receiving' && (
        <div className="space-y-6">
          {/* Incoming Approved Deliveries section */}
          {incomingDeliveries.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#707070]">
                Incoming Approved Supplier Deliveries
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {incomingDeliveries.map((po) => (
                  <div
                    key={po.id}
                    className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-xs flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs font-mono text-[#1C1C1C]">
                          {po.po_number}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                          {po.status?.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-[#1C1C1C] mt-1">
                        Supplier: {po.supplier_name || 'Mapped Vendor'}
                      </p>
                      <p className="text-[11px] text-[#707070] mt-0.5">
                        Items: {po.items?.map((it: any) => `${it.item_name} (${it.ordered_qty})`).join(', ')}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                      <span className="text-xs font-bold text-[#1C1C1C]">
                        ₹{Number(po.net_amount || po.total_amount || 0).toFixed(2)}
                      </span>
                      <button
                        onClick={() => {
                          setNewGRNPOId(po.id);
                          setNewGRNSupplierId(po.supplier_id || '');
                          setNewGRNInvoiceAmt(Number(po.net_amount || po.total_amount || 0));
                          setCreateGRNModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#2E8B57] text-white text-xs font-bold hover:bg-[#257247] shadow-xs flex items-center gap-1"
                      >
                        <PackageCheck className="w-3.5 h-3.5" /> Receive Delivery
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Receiving History Log */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#707070]">
              Delivery Receipts Log (GRN)
            </h3>
            <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] shadow-xs overflow-hidden">
              {supplierGRNs.length === 0 ? (
                <div className="p-12 text-center">
                  <PackageCheck className="w-8 h-8 text-[#2E8B57] mx-auto mb-2 opacity-60" />
                  <h3 className="text-sm font-bold text-[#1C1C1C]">No delivery receipts yet</h3>
                  <p className="text-xs text-[#707070] mt-1">
                    Received supplier deliveries and GRNs will appear here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {supplierGRNs.map((g) => (
                    <div
                      key={g.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF8F5]/50 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs font-mono text-[#1C1C1C]">
                            {g.grn_number}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              g.status === 'APPROVED' || g.status === 'RECEIVED'
                                ? 'bg-green-100 text-green-800'
                                : g.status === 'REJECTED'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {g.status?.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-xs text-[#707070]">
                          Invoice: <span className="font-medium text-[#1C1C1C]">{g.supplier_invoice_number || g.invoice_number || '—'}</span> · Total: ₹{Number(g.total_amount || 0).toFixed(2)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {g.status === 'PENDING_APPROVAL' && isHeadOffice && (
                          <>
                            <button
                              onClick={() => handleApproveGRN(g.id)}
                              className="px-3 py-1.5 rounded-xl bg-[#2E8B57] text-white text-xs font-bold hover:bg-[#257247] shadow-xs"
                            >
                              Approve & Post Stock
                            </button>
                            <button
                              onClick={() => setRejectGRNModal({ open: true, grnId: g.id, grnNumber: g.grn_number })}
                              className="px-2.5 py-1.5 rounded-xl border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setViewGRNModal(g)}
                          className="px-3 py-1.5 rounded-xl border border-[rgba(45,45,45,0.12)] text-xs font-bold text-[#1C1C1C] hover:bg-[#FAF8F5]"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MY BILLS (Emergency / Local Purchases) */}
      {/* ========================================================================= */}
      {activeTab === 'my_bills' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-[#1C1C1C]">Outlet Emergency & Local Purchase Bills</h3>
              <p className="text-[11px] text-[#707070] mt-0.5">
                Submit local store bills (Blinkit, Flipkart, Local Supplier, Cash). HO approval adds stock directly.
              </p>
            </div>
            <button
              onClick={() => setSubmitBillModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-[#B8862D] text-white text-xs font-bold hover:bg-[#9c7124] shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" /> + Submit Bill
            </button>
          </div>

          {/* Bills List */}
          <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] shadow-xs overflow-hidden">
            {localBills.length === 0 ? (
              <div className="p-12 text-center">
                <Receipt className="w-8 h-8 text-[#B8862D] mx-auto mb-2 opacity-60" />
                <h3 className="text-sm font-bold text-[#1C1C1C]">No local purchase bills submitted</h3>
                <p className="text-xs text-[#707070] mt-1 max-w-sm mx-auto">
                  Use "+ Submit Bill" to submit an emergency purchase from Blinkit, Flipkart, or a local supplier.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {localBills.map((b) => {
                  const isPending = b.status === 'PENDING_APPROVAL';
                  const isApproved = b.status === 'APPROVED' || b.status === 'RECEIVED';
                  return (
                    <div
                      key={b.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF8F5]/50 transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-[#1C1C1C]">
                            {b.supplier_invoice_number || b.invoice_number || b.grn_number}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              isApproved
                                ? 'bg-green-100 text-green-800'
                                : b.status === 'REJECTED'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isPending
                              ? 'HO Approval Pending (No Stock Added)'
                              : isApproved
                              ? 'Approved (Stock Added)'
                              : 'Rejected (No Stock Added)'}
                          </span>
                        </div>

                        <div className="text-xs text-[#707070]">
                          Date: <span className="font-medium text-[#1C1C1C]">{b.receive_date ? new Date(b.receive_date).toLocaleDateString() : '—'}</span> · Total:{' '}
                          <span className="font-bold text-[#1C1C1C]">₹{Number(b.total_amount || 0).toFixed(2)}</span>
                        </div>

                        {b.notes && (
                          <p className="text-[11px] text-[#707070] truncate max-w-md">
                            {b.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {isPending && isHeadOffice && (
                          <>
                            <button
                              onClick={() => handleApproveGRN(b.id)}
                              className="px-3 py-1.5 rounded-xl bg-[#2E8B57] text-white text-xs font-bold hover:bg-[#257247] shadow-xs"
                            >
                              Approve & Add Stock
                            </button>
                            <button
                              onClick={() => setRejectGRNModal({ open: true, grnId: b.id, grnNumber: b.grn_number })}
                              className="px-2.5 py-1.5 rounded-xl border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setViewGRNModal(b)}
                          className="px-3 py-1.5 rounded-xl border border-[rgba(45,45,45,0.12)] text-xs font-bold text-[#1C1C1C] hover:bg-[#FAF8F5]"
                        >
                          View Bill
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE NEED (+ New Need) */}
      {/* ========================================================================= */}
      {createPRModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#1C1C1C]">Create Supply Requirement</h3>
                <p className="text-xs text-[#707070]">
                  Submit need for [{activeOutlet.name}] to Head Office. Mapped vendors are auto-determined.
                </p>
              </div>
              <button onClick={() => setCreatePRModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#707070] mb-1">Priority</label>
                  <select
                    value={newPRPriority}
                    onChange={(e) => setNewPRPriority(e.target.value)}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-gray-200 rounded-xl font-semibold"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#707070] mb-1">Required By Date</label>
                  <input
                    type="date"
                    value={newPRRequiredDate}
                    onChange={(e) => setNewPRRequiredDate(e.target.value)}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-gray-200 rounded-xl font-semibold"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-semibold text-[#707070]">Items Needed</label>
                  <button
                    type="button"
                    onClick={() =>
                      setNewPRLines([
                        ...newPRLines,
                        { item_id: '', requested_qty: 10, estimated_price: 0 },
                      ])
                    }
                    className="text-[11px] text-[#B8862D] font-bold hover:underline"
                  >
                    + Add Item
                  </button>
                </div>

                {newPRLines.map((line, idx) => (
                  <div key={idx} className="p-3 bg-[#FAF8F5] rounded-xl space-y-2 border border-gray-100">
                    <div className="flex items-center gap-2">
                      <select
                        value={line.item_id}
                        onChange={(e) => handleSelectPRItem(idx, e.target.value)}
                        className="flex-1 p-2 bg-white border border-gray-200 rounded-xl text-xs"
                      >
                        <option value="">-- Choose Item --</option>
                        {inventoryItems.map((itm) => (
                          <option key={itm.id} value={itm.id}>
                            {itm.name} ({itm.unit?.symbol || itm.code || 'Unit'})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={line.requested_qty}
                        onChange={(e) => {
                          const updated = [...newPRLines];
                          updated[idx].requested_qty = Number(e.target.value);
                          setNewPRLines(updated);
                        }}
                        className="w-20 p-2 bg-white border border-gray-200 rounded-xl text-xs text-right font-mono"
                      />

                      {newPRLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setNewPRLines(newPRLines.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {line.supplier_name && (
                      <p className="text-[10px] text-green-700 font-semibold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Auto-mapped Supplier: {line.supplier_name}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#707070] mb-1">Notes / Requirement Purpose</label>
                <textarea
                  rows={2}
                  value={newPRNotes}
                  onChange={(e) => setNewPRNotes(e.target.value)}
                  placeholder="e.g. Weekend party preparation stock shortage..."
                  className="w-full p-2.5 bg-[#FAF8F5] border border-gray-200 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={() => setCreatePRModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreatePR}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1C1C1C] text-white hover:bg-[#2D2D2D] shadow-xs"
              >
                Submit Need
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: RECEIVE DELIVERY (+ Receive Delivery) */}
      {/* ========================================================================= */}
      {createGRNModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#1C1C1C]">Receive Supplier Delivery</h3>
                <p className="text-xs text-[#707070]">
                  Record physical stock intake against an approved PO.
                </p>
              </div>
              <button onClick={() => setCreateGRNModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[#707070] mb-1">Select Purchase Order</label>
                <select
                  value={newGRNPOId}
                  onChange={(e) => {
                    const poId = e.target.value;
                    setNewGRNPOId(poId);
                    const po = orders.find((o) => o.id === poId);
                    if (po) {
                      setNewGRNSupplierId(po.supplier_id || '');
                      setNewGRNInvoiceAmt(Number(po.net_amount || po.total_amount || 0));
                    }
                  }}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-gray-200 rounded-xl font-semibold"
                >
                  <option value="">-- Choose Approved PO --</option>
                  {orders.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.po_number} - {po.supplier_name || 'Vendor'} (₹{Number(po.net_amount || po.total_amount || 0).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#707070] mb-1">Invoice / Challan #</label>
                  <input
                    type="text"
                    placeholder="INV-9921..."
                    value={newGRNInvoiceNum}
                    onChange={(e) => setNewGRNInvoiceNum(e.target.value)}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-gray-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#707070] mb-1">Invoice Amount (₹)</label>
                  <input
                    type="number"
                    value={newGRNInvoiceAmt}
                    onChange={(e) => setNewGRNInvoiceAmt(Number(e.target.value))}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-gray-200 rounded-xl text-right font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#707070] mb-1">Notes / Receiving Remarks</label>
                <textarea
                  rows={2}
                  value={newGRNNotes}
                  onChange={(e) => setNewGRNNotes(e.target.value)}
                  placeholder="e.g. All items verified with good condition..."
                  className="w-full p-2.5 bg-[#FAF8F5] border border-gray-200 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={() => setCreateGRNModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateGRN}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#2E8B57] text-white hover:bg-[#257247] shadow-xs"
              >
                Submit Receiving
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: SUBMIT LOCAL BILL (+ Submit Bill) */}
      {/* ========================================================================= */}
      {submitBillModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#1C1C1C]">Submit Local / Emergency Purchase Bill</h3>
                <p className="text-xs text-[#707070]">
                  Submit bill from Blinkit, Flipkart, local supplier, or cash purchase for HO approval.
                </p>
              </div>
              <button onClick={() => setSubmitBillModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Platform Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-[#707070] mb-1.5">Supplier / Platform</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {['Blinkit', 'Flipkart', 'Local Supplier', 'Cash Purchase', 'Other'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setBillPlatform(p)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        billPlatform === p
                          ? 'bg-[#F1E4C5] text-[#B8862D] border-[#B8862D]/40 shadow-xs'
                          : 'bg-gray-50 text-gray-700 border-gray-200'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                {billPlatform === 'Other' && (
                  <input
                    type="text"
                    placeholder="Enter vendor / platform name..."
                    value={billCustomPlatform}
                    onChange={(e) => setBillCustomPlatform(e.target.value)}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-gray-200 rounded-xl"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#707070] mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={billPurchaseDate}
                    onChange={(e) => setBillPurchaseDate(e.target.value)}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-gray-200 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#707070] mb-1">Bill / Invoice Reference #</label>
                  <input
                    type="text"
                    placeholder="e.g. BLINK-4921"
                    value={billInvoiceNumber}
                    onChange={(e) => setBillInvoiceNumber(e.target.value)}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-gray-200 rounded-xl"
                  />
                </div>
              </div>

              {/* Bill Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-semibold text-[#707070]">Items Purchased</label>
                  <button
                    type="button"
                    onClick={() =>
                      setBillLines([...billLines, { item_id: '', quantity: 1, rate: 0 }])
                    }
                    className="text-[11px] text-[#B8862D] font-bold hover:underline"
                  >
                    + Add Item
                  </button>
                </div>

                {billLines.map((line, idx) => (
                  <div key={idx} className="p-3 bg-[#FAF8F5] rounded-xl space-y-2 border border-gray-100">
                    <div className="grid grid-cols-[1fr_80px_90px_auto] gap-2 items-center">
                      <select
                        value={line.item_id}
                        onChange={(e) => {
                          const updated = [...billLines];
                          updated[idx].item_id = e.target.value;
                          setBillLines(updated);
                        }}
                        className="p-2 bg-white border border-gray-200 rounded-xl text-xs"
                      >
                        <option value="">-- Choose Item --</option>
                        {inventoryItems.map((itm) => (
                          <option key={itm.id} value={itm.id}>
                            {itm.name} ({itm.unit?.symbol || 'Unit'})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={line.quantity}
                        onChange={(e) => {
                          const updated = [...billLines];
                          updated[idx].quantity = Number(e.target.value);
                          setBillLines(updated);
                        }}
                        className="p-2 bg-white border border-gray-200 rounded-xl text-xs text-right font-mono"
                      />

                      <input
                        type="number"
                        min="0"
                        placeholder="Rate ₹"
                        value={line.rate}
                        onChange={(e) => {
                          const updated = [...billLines];
                          updated[idx].rate = Number(e.target.value);
                          setBillLines(updated);
                        }}
                        className="p-2 bg-white border border-gray-200 rounded-xl text-xs text-right font-mono"
                      />

                      {billLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setBillLines(billLines.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="text-right text-[11px] font-bold text-[#1C1C1C]">
                      Line Total: ₹{(Number(line.quantity || 0) * Number(line.rate || 0)).toFixed(2)}
                    </div>
                  </div>
                ))}

                <div className="p-3 rounded-xl bg-[#F1E4C5]/40 border border-[#B8862D]/30 flex items-center justify-between font-bold text-xs">
                  <span>Grand Total:</span>
                  <span className="font-mono text-sm text-[#B8862D]">
                    ₹{billLines.reduce((sum, l) => sum + Number(l.quantity || 0) * Number(l.rate || 0), 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#707070] mb-1">Bill Notes / Justification</label>
                <textarea
                  rows={2}
                  value={billNotes}
                  onChange={(e) => setBillNotes(e.target.value)}
                  placeholder="e.g. Emergency purchase due to sudden guest surge..."
                  className="w-full p-2.5 bg-[#FAF8F5] border border-gray-200 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={() => setSubmitBillModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitLocalBill}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#B8862D] text-white hover:bg-[#9c7124] shadow-xs"
              >
                Submit Bill for Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: VIEW NEED DETAILS */}
      {/* ========================================================================= */}
      {viewPRModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#1C1C1C] font-mono">{viewPRModal.request_number}</h3>
                <p className="text-xs text-[#707070]">Need Requirement Details</p>
              </div>
              <button onClick={() => setViewPRModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Status:</span>
                <span className="font-bold">{viewPRModal.status}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Priority:</span>
                <span className="font-semibold">{viewPRModal.priority}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Required Date:</span>
                <span className="font-semibold">
                  {viewPRModal.required_date ? new Date(viewPRModal.required_date).toLocaleDateString() : '—'}
                </span>
              </div>

              <div className="pt-2">
                <p className="font-bold mb-2">Item Breakdown:</p>
                <div className="space-y-1.5">
                  {viewPRModal.items?.map((it: any) => (
                    <div key={it.id} className="p-2.5 bg-gray-50 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="font-bold text-[#1C1C1C]">{it.item_name}</span>
                        {it.supplier_name && (
                          <span className="block text-[10px] text-gray-500">Supplier: {it.supplier_name}</span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-xs">
                        {it.requested_qty} {it.unit_symbol || 'Units'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setViewPRModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: VIEW GRN / BILL DETAILS */}
      {/* ========================================================================= */}
      {viewGRNModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#1C1C1C] font-mono">{viewGRNModal.grn_number}</h3>
                <p className="text-xs text-[#707070]">Receipt / Bill Details</p>
              </div>
              <button onClick={() => setViewGRNModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Status:</span>
                <span className="font-bold">{viewGRNModal.status}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Invoice #:</span>
                <span className="font-semibold">{viewGRNModal.supplier_invoice_number || viewGRNModal.invoice_number || '—'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Total Amount:</span>
                <span className="font-bold font-mono">₹{Number(viewGRNModal.total_amount || 0).toFixed(2)}</span>
              </div>
              {viewGRNModal.notes && (
                <div className="py-1">
                  <span className="text-gray-500 block mb-1">Notes:</span>
                  <p className="p-2 bg-gray-50 rounded-xl text-gray-700">{viewGRNModal.notes}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setViewGRNModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: REJECT REASON */}
      {/* ========================================================================= */}
      {rejectGRNModal.open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <div>
              <h3 className="text-base font-bold text-red-600">Reject {rejectGRNModal.grnNumber}</h3>
              <p className="text-xs text-[#707070]">
                State the reason for rejecting this receiving/bill. No stock will be posted.
              </p>
            </div>

            <textarea
              rows={3}
              value={grnRejectReason}
              onChange={(e) => setGrnRejectReason(e.target.value)}
              placeholder="e.g. Overcharged rate / damaged items..."
              className="w-full p-2.5 bg-[#FAF8F5] border border-gray-200 rounded-xl text-xs focus:outline-none"
            />

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={() => setRejectGRNModal({ open: false, grnId: '', grnNumber: '' })}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRejectGRN}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700 shadow-xs"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseWorkspace;
