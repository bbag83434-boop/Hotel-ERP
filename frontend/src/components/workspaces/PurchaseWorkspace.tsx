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
  Upload,
  Camera,
} from 'lucide-react';

interface PurchaseWorkspaceProps {
  onNavigateWorkspace?: (workspace: WorkspaceId) => void;
  initialTab?: 'needs' | 'receiving' | 'my_bills';
}

type PurchaseTab = 'needs' | 'receiving' | 'my_bills';

const SUPPLY_SOURCE_LABELS: Record<string, string> = {
  CENTRAL_STORE: 'Central Store',
  DESSERT_KITCHEN: 'Dessert Kitchen',
  RAW_MATERIAL_SUPPLY: 'Raw Material Supply',
  DAILY_OUTLET_SUPPLY: 'Daily Outlet Supply',
};

const formatSupplySource = (src?: string): string =>
  src ? SUPPLY_SOURCE_LABELS[src] || src.replace(/_/g, ' ') : '—';

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
    Array<{ item_id: string; requested_qty: number; estimated_price: number; unit?: string; supply_source?: string; supplier_id?: string; supplier_name?: string; notes?: string }>
  >([{ item_id: '', requested_qty: 0, estimated_price: 0 }]);
  const [itemSearchQueries, setItemSearchQueries] = useState<Record<number, string>>({});

  // New GRN / Receiving Form State
  const [newGRNPOId, setNewGRNPOId] = useState<string>('');
  const [newGRNSupplierId, setNewGRNSupplierId] = useState<string>('');
  const [newGRNInvoiceNum, setNewGRNInvoiceNum] = useState<string>('');
  const [newGRNInvoiceAmt, setNewGRNInvoiceAmt] = useState<number>(0);
  const [newGRNNotes, setNewGRNNotes] = useState<string>('');
  const [newGRNLines, setNewGRNLines] = useState<
    Array<{ po_item_id: string; item_name: string; unit: string; ordered_qty: number; already_received_qty: number; outstanding_qty: number; received_qty: number; accepted_qty: number }>
  >([]);
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
  const [billFile, setBillFile] = useState<{
    fileName: string;
    fileType: string;
    fileBase64: string;
    size: number;
  } | null>(null);

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

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.onerror = () => reject(new Error('Could not read the selected file.'));
      reader.readAsDataURL(file);
    });

  const handleBillFile = async (file: File | null) => {
    if (!file) return;
    try {
      const fileBase64 = await fileToBase64(file);
      setBillFile({
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileBase64,
        size: file.size,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Could not read bill file.' });
    }
  };

  // Handle Item Selection in Need Form (Auto-determine vendor from Setup mapping)
  const handleSelectPRItem = (index: number, itemId: string) => {
    const itemObj = inventoryItems.find((i) => i.id === itemId);
    // Vendor-Item Master is authoritative for outlet routing.
    // If an active Vendor-Item mapping exists, this line is DIRECT_VENDOR
    // even when the legacy Item Master still says CENTRAL_STORE.
    const mapping = vendorItems
      .filter((m) => m.item_id === itemId && m.is_active)
      .sort((a, b) => Number(Boolean(b.is_preferred)) - Number(Boolean(a.is_preferred)))[0];
    const matchedSupplier = mapping
      ? suppliers.find((s) => s.id === mapping.supplier_id)
      : suppliers.find((s) => s.id === itemObj?.supplier_id);

    const supplySource = mapping?.supplier_id
      ? 'DIRECT_VENDOR'
      : (itemObj?.supply_source || 'CENTRAL_STORE');

    const price = mapping?.purchase_price != null
      ? Number(mapping.purchase_price)
      : itemObj?.cost_price
      ? Number(itemObj.cost_price)
      : 0;

    const updated = [...newPRLines];
    updated[index] = {
      ...updated[index],
      item_id: itemId,
      unit: itemObj?.unit?.symbol || itemObj?.unit_symbol || '',
      supply_source: supplySource,
      supplier_id: mapping?.supplier_id || itemObj?.supplier_id || undefined,
      supplier_name: mapping?.supplier_name || matchedSupplier?.name || undefined,
      estimated_price: price,
    };
    setNewPRLines(updated);
    setItemSearchQueries((prev) => ({ ...prev, [index]: '' }));
  };

  // Submit Purchase Requirement (PR)
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
      setNewPRLines([{ item_id: '', requested_qty: 0, estimated_price: 0 }]);
      setItemSearchQueries({});
      setNewPRNotes('');
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to submit need requirement.' });
    } finally {
      setLoading(false);
    }
  };

  // Submit Vendor Receiving / GRN
  const handleCreateGRN = async () => {
    if (!newGRNPOId) {
      setFeedback({ type: 'error', message: 'Please select an approved Purchase Order for Vendor Receiving.' });
      return;
    }

    if (!newGRNInvoiceFile) {
      setFeedback({ type: 'error', message: 'Please upload or capture the vendor bill/invoice.' });
      return;
    }

    const selectedPO = orders.find((po) => po.id === newGRNPOId);
    const poAmount = Number(selectedPO?.net_amount || selectedPO?.total_amount || 0);
    const finalInvoiceNumber = newGRNInvoiceNum.trim() || `BILL-${Date.now().toString().slice(-8)}`;

    if (newGRNInvoiceAmt < poAmount - 0.01) {
      setFeedback({
        type: 'error',
        message: `Bill amount cannot be lower than the approved PO amount ₹${poAmount.toFixed(2)}.`,
      });
      return;
    }

    if (!newGRNLines.length || !newGRNLines.some((line) => Number(line.received_qty) > 0)) {
      setFeedback({ type: 'error', message: 'The selected PO has no outstanding quantity to receive.' });
      return;
    }

    setLoading(true);
    try {
      const uploadRes = await apiClient.post('/procurement/receiving/upload-invoice', {
        branch_id: activeOutlet.id,
        invoice_number: finalInvoiceNumber,
        invoice_amount: Number(newGRNInvoiceAmt || poAmount),
        file_name: newGRNInvoiceFile.fileName,
        file_type: newGRNInvoiceFile.fileType,
        file_base64: newGRNInvoiceFile.fileBase64,
      });

      const uploadData = uploadRes?.data?.data ?? uploadRes?.data ?? {};
      const storageRef = uploadData?.storage_ref || '';

      await procurementApi.createGoodsReceiveFromPO({
        po_id: newGRNPOId,
        branch_id: activeOutlet.id,
        supplier_invoice_number: finalInvoiceNumber,
        invoice_amount: Number(newGRNInvoiceAmt || poAmount),
        invoice_file_name: storageRef
          ? `${newGRNInvoiceFile.fileName} | ${storageRef}`
          : newGRNInvoiceFile.fileName,
        notes: `${newGRNNotes.trim()}${storageRef ? ` [Invoice Storage: ${storageRef}]` : ''}`.trim() || undefined,
        // PO quantities are loaded automatically and are not user-editable.
        items: newGRNLines
          .filter((line) => Number(line.received_qty) > 0)
          .map((line) => ({
            po_item_id: line.po_item_id,
            received_qty: Number(line.received_qty),
            accepted_qty: Number(line.accepted_qty),
            rejected_qty: Number(line.received_qty) - Number(line.accepted_qty),
          })),
      });

      setFeedback({
        type: 'success',
        message: 'Vendor Receiving submitted. Sent to Head Office for approval; stock is not added yet.',
      });
      setCreateGRNModalOpen(false);
      setNewGRNPOId('');
      setNewGRNSupplierId('');
      setNewGRNInvoiceNum('');
      setNewGRNInvoiceAmt(0);
      setNewGRNNotes('');
      setNewGRNLines([]);
      setNewGRNInvoiceFile(null);
      fetchData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || err?.response?.data?.detail || err?.message || 'Vendor Receiving submission failed.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Submit My Bill via invoice OCR (no manual item/qty/rate entry)
  const handleSubmitLocalBill = async () => {
    if (!billFile) {
      setFeedback({ type: 'error', message: 'Please upload or capture the purchase bill first.' });
      return;
    }

    const effectivePlatform =
      billPlatform === 'Other' ? billCustomPlatform || 'Local Supplier' : billPlatform;

    setLoading(true);
    try {
      const res = await apiClient.post('/procurement/my-bills/submit-ocr', {
        branch_id: activeOutlet.id,
        file_name: billFile.fileName,
        file_type: billFile.fileType,
        file_base64: billFile.fileBase64,
        purchase_date: billPurchaseDate || undefined,
        invoice_number: billInvoiceNumber.trim() || undefined,
        platform: effectivePlatform,
        notes: billNotes || undefined,
      });

      const extracted = res?.data || res || {};
      const extractedItems = Array.isArray(extracted.items) ? extracted.items.length : 0;
      const extractedTotal = Number(extracted.invoice_amount || extracted.total_amount || 0);

      setFeedback({
        type: 'success',
        message: `My Bill submitted for Head Office approval. OCR extracted ${extractedItems} item(s)${extractedTotal > 0 ? ` and ₹${extractedTotal.toFixed(2)}` : ''}. Stock will be added only after approval.`,
      });
      setSubmitBillModalOpen(false);
      setBillPlatform('Local Supplier');
      setBillCustomPlatform('');
      setBillPurchaseDate(new Date().toISOString().slice(0, 10));
      setBillInvoiceNumber('');
      setBillNotes('');
      setBillFile(null);
      fetchData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || err?.message || 'My Bill OCR submission failed.',
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
            <h1 className="text-xl font-bold text-[#1C1C1C] font-['Outfit']">{activeTab === 'receiving' ? 'Vendor Receiving' : activeTab === 'my_bills' ? 'My Bills' : 'Purchase'}</h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF8F5] text-[#B8862D] font-bold border border-[rgba(45,45,45,0.1)]">
              [{activeOutlet.code}]
            </span>
          </div>
          <p className="text-xs text-[#707070] mt-0.5">
            {activeTab === 'receiving'
              ? 'Approved vendor delivery → receiving → Head Office approval → stock'
              : activeTab === 'my_bills'
              ? 'Direct / emergency purchase bills → OCR → Head Office approval → stock'
              : 'Purchase requests'}
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
              + New Purchase Request
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

      {/* ========================================================================= */}
      {/* TAB 1: PURCHASE (Outlet Purchase Requests) */}
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

          {/* Purchase Request List */}
          <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] shadow-xs overflow-hidden">
            {filteredNeeds.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-8 h-8 text-[#B8862D] mx-auto mb-2 opacity-60" />
                <h3 className="text-sm font-bold text-[#1C1C1C]">No purchase requests found</h3>
                <p className="text-xs text-[#707070] mt-1 max-w-sm mx-auto">
                  Click "+ New Purchase Request" above to submit an item requirement for this outlet to Head Office.
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
{req.items?.length > 0 && (
                        <p className="text-[11px] text-[#8A641D] font-semibold">
                          {req.items
                            .slice(0, 3)
                            .map((it: any) => `${it.item_name} → Source: ${formatSupplySource(it.supply_source)}`)
                            .join('  ·  ')}
                          {req.items?.length > 3 ? '...' : ''}
                        </p>
                      )}

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
      {/* TAB 2: VENDOR RECEIVING (Approved PO Deliveries & GRNs) */}
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
                        Vendor: {po.supplier_name || po.supplier?.name || 'Mapped Vendor'}
                      </p>
                      <p className="text-[11px] font-semibold text-green-700 mt-0.5">
                        Phone/WhatsApp: {po.supplier?.whatsapp_number || po.supplier?.phone || 'N/A'}
                      </p>
                      <p className="text-[11px] text-[#707070] mt-0.5">
                        Items: {po.items?.map((it: any) => `${it.item_name} (${it.ordered_qty})`).join(', ')}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                      <span className="text-xs font-bold text-[#1C1C1C]">
                        ₹{Number(po.net_amount || po.total_amount || 0).toFixed(2)}
                      </span>
                      <div className="flex items-center gap-2">
                        {(!po.status || po.status === 'APPROVED' || po.status === 'WHATSAPP_OPENED') && (
                          <button
                            onClick={async () => {
                              try {
                                const res = await procurementApi.getWhatsAppLink(po.id);
                                if (res?.whatsapp_url) {
                                  window.open(res.whatsapp_url, '_blank');
                                }
                              } catch (e: any) {
                                alert(e?.response?.data?.detail || e?.response?.data?.message || 'Error opening WhatsApp.');
                              }
                            }}
                            className="px-3 py-1.5 rounded-xl border border-green-200 text-green-700 bg-green-50 text-xs font-bold hover:bg-green-100 shadow-xs flex items-center gap-1"
                          >
                            [ SEND WHATSAPP ]
                          </button>
                        )}
                      <button
                        onClick={() => {
                          setNewGRNPOId(po.id);
                          setNewGRNSupplierId(po.supplier_id || '');
                          setNewGRNInvoiceAmt(Number(po.net_amount || po.total_amount || 0));
                          setNewGRNInvoiceNum('');
                          setNewGRNNotes('');
                          setNewGRNInvoiceFile(null);
                          setNewGRNLines((po.items || [])
                            .map((line: any) => {
                              const ordered = Number(line.ordered_qty || line.quantity || 0);
                              const alreadyReceived = Number(line.received_qty || 0);
                              const outstanding = Math.max(0, ordered - alreadyReceived);
                              return {
                                po_item_id: line.id,
                                item_name: line.item_name || line.item?.name || 'Item',
                                unit: line.unit_symbol || line.item?.unit?.symbol || '',
                                ordered_qty: ordered,
                                already_received_qty: alreadyReceived,
                                outstanding_qty: outstanding,
                                received_qty: outstanding,
                                accepted_qty: outstanding,
                              };
                            })
                            .filter((line: any) => line.outstanding_qty > 0));
                          setCreateGRNModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#2E8B57] text-white text-xs font-bold hover:bg-[#257247] shadow-xs flex items-center gap-1"
                      >
                        <PackageCheck className="w-3.5 h-3.5" /> Receive Delivery
                      </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Receiving History Log */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#707070]">
              Vendor Receiving Log (GRN)
            </h3>
            <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] shadow-xs overflow-hidden">
              {supplierGRNs.length === 0 ? (
                <div className="p-12 text-center">
                  <PackageCheck className="w-8 h-8 text-[#2E8B57] mx-auto mb-2 opacity-60" />
                  <h3 className="text-sm font-bold text-[#1C1C1C]">No delivery receipts yet</h3>
                  <p className="text-xs text-[#707070] mt-1">
                    Approved vendor deliveries submitted here will appear in the receiving log.
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
      {/* TAB 3: MY BILLS */}
      {/* ========================================================================= */}
      {activeTab === 'my_bills' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#707070]">MY BILLS HISTORY</h3>
              <p className="text-[11px] text-[#707070] mt-1">Submitted direct purchase bills and their approval status.</p>
            </div>
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
      {/* MODAL 1: CREATE NEED (+ New Purchase Request) */}
      {/* ========================================================================= */}
      {createPRModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#1C1C1C]">Create Purchase Requirement</h3>
                <p className="text-xs text-[#707070]">
                  Submit a purchase requirement for [{activeOutlet.name}] to Head Office. Mapped vendors are auto-determined.
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
                        { item_id: '', requested_qty: 0, estimated_price: 0 },
                      ])
                    }
                    className="text-[11px] text-[#B8862D] font-bold hover:underline"
                  >
                    + Add Item
                  </button>
                </div>

                {newPRLines.map((line, idx) => {
                  const qty = Number(line.requested_qty || 0);
                  const unitPrice = Number(line.estimated_price || 0);
                  const amount = qty * unitPrice;
                  const query = (itemSearchQueries[idx] || '').trim().toLowerCase();
                  const filteredItems = inventoryItems.filter((itm) => {
                    if (!query) return true;
                    return (
                      String(itm.name || '').toLowerCase().includes(query) ||
                      String(itm.code || '').toLowerCase().includes(query) ||
                      String(itm.id || '').toLowerCase().includes(query)
                    );
                  });

                  return (
                    <div key={idx} className="p-3 bg-[#FAF8F5] rounded-xl space-y-3 border border-gray-100">
                      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_75px_70px_105px_120px_auto] gap-2 items-end">
                        <div className="min-w-0">
                          <label className="block text-[10px] font-semibold text-[#707070] mb-1">Item</label>
                          <div className="relative mb-1.5">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                            <input
                              type="text"
                              value={itemSearchQueries[idx] || ''}
                              onChange={(e) => setItemSearchQueries((prev) => ({ ...prev, [idx]: e.target.value }))}
                              placeholder="Search item name / code..."
                              className="w-full pl-8 pr-2.5 py-2 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:border-[#B8862D]"
                            />
                          </div>
                          <div className="relative">
                            <input
                              type="text"
                              value={itemSearchQueries[idx] || ''}
                              onChange={(e) =>
                                setItemSearchQueries((prev) => ({
                                  ...prev,
                                  [idx]: e.target.value,
                                }))
                              }
                              onFocus={() => {
                                if (!itemSearchQueries[idx]) {
                                  setItemSearchQueries((prev) => ({ ...prev, [idx]: '' }));
                                }
                              }}
                              placeholder={
                                line.item_id
                                  ? inventoryItems.find((itm) => itm.id === line.item_id)?.name || 'Search item...'
                                  : 'Search item name / code...'
                              }
                              className="w-full p-2 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:border-[#B8862D]"
                            />

                            {query && (
                              <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg">
                                {filteredItems.length > 0 ? (
                                  filteredItems.slice(0, 30).map((itm) => (
                                    <button
                                      key={itm.id}
                                      type="button"
                                      onClick={() => handleSelectPRItem(idx, itm.id)}
                                      className="w-full text-left px-3 py-2 hover:bg-[#F1E4C5]/50 border-b border-gray-50 last:border-b-0"
                                    >
                                      <div className="text-xs font-semibold text-[#1C1C1C]">{itm.name}</div>
                                      <div className="text-[10px] text-[#707070]">
                                        {itm.code ? `${itm.code} · ` : ''}{itm.unit?.symbol || 'Unit'}
                                      </div>
                                    </button>
                                  ))
                                ) : (
                                  <div className="px-3 py-2 text-[10px] text-red-500">
                                    No matching item found.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-[#707070] mb-1">Qty</label>
                          <input
                            type="number" min="0" step="0.01" value={line.requested_qty}
                            onChange={(e) => {
                              const updated = [...newPRLines];
                              updated[idx] = { ...updated[idx], requested_qty: Number(e.target.value) };
                              setNewPRLines(updated);
                            }}
                            className="w-full p-2 bg-white border border-gray-200 rounded-xl text-xs text-right font-mono font-semibold"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-[#707070] mb-1">Unit</label>
                          <div className="w-full p-2 bg-gray-100 border border-gray-200 rounded-xl text-xs text-center font-semibold min-h-[34px]">
                            {line.unit || '—'}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-[#707070] mb-1">Unit Price</label>
                          <div className="w-full p-2 bg-gray-100 border border-gray-200 rounded-xl text-xs text-right font-mono font-semibold min-h-[34px]">
                            ₹{unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-[#707070] mb-1">Amount</label>
                          <div className="w-full p-2 bg-[#F1E4C5] border border-[#C79A3B]/30 rounded-xl text-xs text-right font-mono font-bold text-[#8A641F] min-h-[34px]">
                            ₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>

                        {newPRLines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setNewPRLines(newPRLines.filter((_, i) => i !== idx));
                              setItemSearchQueries((prev) => {
                                const next = { ...prev };
                                delete next[idx];
                                return next;
                              });
                            }}
                            className="text-red-500 hover:text-red-700 p-1 mb-1"
                            title="Remove item"
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
                      {line.supply_source && (
                        <p className="text-[10px] text-[#B8862D] font-semibold flex items-center gap-1">
                          <PackageCheck className="w-3 h-3" />
                          Auto-routed Source: {formatSupplySource(line.supply_source)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#1C1C1C] text-white">
                <span className="text-xs font-semibold">Estimated Total</span>
                <span className="text-base font-bold font-mono text-[#F1E4C5]">
                  ₹{newPRLines.reduce((sum, item) => sum + Number(item.requested_qty || 0) * Number(item.estimated_price || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
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
      {/* ========================================================================= */}
      {/* MODAL 2: VENDOR RECEIVING */}
      {/* ========================================================================= */}
      {createGRNModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl shadow-xl">
            <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-3">
              <div>
                <div className="font-bold text-base text-[#1C1C1C]">Receive Vendor Bill</div>
                <div className="text-xs text-[#777] mt-1">
                  {(() => {
                    const po = orders.find((x) => x.id === newGRNPOId);
                    return po ? `PO ${po.po_number} · ${po.supplier_name || po.supplier?.name || 'Vendor'}` : 'Approved Purchase Order';
                  })()}
                </div>
              </div>
              <button onClick={() => setCreateGRNModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-700" aria-label="Close receiving">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-2xl border border-[#E8DDBF] bg-[#FFFDF7] p-4">
                <div className="flex items-start gap-3">
                  <PackageCheck className="w-5 h-5 text-[#8A6A1F] mt-0.5" />
                  <div>
                    <div className="font-bold text-sm text-[#1C1C1C]">PO quantities are locked</div>
                    <div className="text-xs text-[#6F644B] mt-1">Approved PO items and remaining quantities are loaded automatically. No manual item, received-quantity or accepted-quantity entry is allowed.</div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 p-4 bg-[#FAF8F5]">
                <div className="text-xs font-bold text-[#1C1C1C]">Vendor Bill / Invoice</div>
                <div className="text-[11px] text-[#666] mt-1">Take a photo from camera or upload the supplier bill/PDF. The bill is attached to this approved PO and sent for Head Office approval.</div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#707070] mb-1">Bill / Invoice Number</label>
                    <input type="text" placeholder="Optional — auto reference if blank" value={newGRNInvoiceNum} onChange={(e) => setNewGRNInvoiceNum(e.target.value)} className="w-full p-2.5 bg-white border border-gray-200 rounded-xl" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-bold cursor-pointer flex items-center gap-2">
                      <Upload className="w-3.5 h-3.5" /> Choose Bill
                      <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0] || null;
                        if (!file) return;
                        try {
                          const base64 = await fileToBase64(file);
                          setNewGRNInvoiceFile({ fileName: file.name, fileType: file.type || 'application/octet-stream', fileBase64: base64, size: file.size });
                        } catch (err: any) {
                          setFeedback({ type: 'error', message: err?.message || 'Could not read bill file.' });
                        }
                      }} />
                    </label>
                    <label className="px-3 py-2 rounded-xl bg-[#F1E4C5] text-[#7A5B17] text-xs font-bold cursor-pointer flex items-center gap-2">
                      <Camera className="w-3.5 h-3.5" /> Camera
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0] || null;
                        if (!file) return;
                        try {
                          const base64 = await fileToBase64(file);
                          setNewGRNInvoiceFile({ fileName: file.name, fileType: file.type || 'image/jpeg', fileBase64: base64, size: file.size });
                        } catch (err: any) {
                          setFeedback({ type: 'error', message: err?.message || 'Could not read camera image.' });
                        }
                      }} />
                    </label>
                  </div>
                </div>

                {newGRNInvoiceFile && <div className="mt-3 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-xs text-green-800"><b>Selected:</b> {newGRNInvoiceFile.fileName}</div>}

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#707070] mb-1">Actual Bill Amount (₹)</label>
                    <input type="number" min={Number(orders.find((x) => x.id === newGRNPOId)?.net_amount || orders.find((x) => x.id === newGRNPOId)?.total_amount || 0)} value={newGRNInvoiceAmt} onChange={(e) => setNewGRNInvoiceAmt(Number(e.target.value))} className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-right font-mono font-semibold" />
                    <p className="text-[10px] text-[#707070] mt-1">PO amount is prefilled. Change only when the actual vendor bill is higher.</p>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#707070] mb-1">Receiving Notes</label>
                    <input type="text" value={newGRNNotes} onChange={(e) => setNewGRNNotes(e.target.value)} placeholder="Condition / remarks / delivery note..." className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs" />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-white border-b border-gray-100">
                  <div className="text-sm font-bold text-[#1C1C1C]">PO Items</div>
                  <div className="text-[11px] text-[#777] mt-0.5">Items and remaining quantities come directly from the approved PO.</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-[#FAF8F5]"><tr className="text-[#707070]"><th className="text-left px-4 py-2.5 font-semibold">Item</th><th className="text-right px-4 py-2.5 font-semibold">Ordered</th><th className="text-right px-4 py-2.5 font-semibold">Already Received</th><th className="text-right px-4 py-2.5 font-semibold">Remaining</th></tr></thead>
                    <tbody>
                      {newGRNLines.length ? newGRNLines.map((line) => (
                        <tr key={line.po_item_id} className="border-t border-gray-100">
                          <td className="px-4 py-3 font-semibold text-[#1C1C1C]">{line.item_name}<span className="block text-[10px] text-[#777] mt-0.5">{line.unit || 'Unit'}</span></td>
                          <td className="px-4 py-3 text-right font-mono">{Number(line.ordered_qty || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-mono">{Number(line.already_received_qty || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold">{Number(line.outstanding_qty || 0).toFixed(2)}</td>
                        </tr>
                      )) : <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">Select an approved Purchase Order.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setCreateGRNModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100">Close</button>
              <button type="button" onClick={handleCreateGRN} disabled={loading || !newGRNInvoiceFile} className="px-4 py-2 rounded-xl text-xs font-bold bg-[#2E8B57] text-white hover:bg-[#257247] shadow-xs disabled:opacity-50">Submit Receiving</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: SUBMIT LOCAL BILL (+ Submit Bill) */}
      {/* ========================================================================= */}
      {submitBillModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#1C1C1C]">My Bills — Direct Purchase</h3>
                <p className="text-xs text-[#707070]">Upload the bill or invoice. Item, quantity, rate, tax and total are extracted automatically; there is no manual item entry.</p>
              </div>
              <button onClick={() => setSubmitBillModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[#707070] mb-1.5">Purchase Source</label>
                <div className="flex flex-wrap gap-2">
                  {['Blinkit', 'Amazon', 'Flipkart', 'Local Supplier', 'Cash Purchase', 'Other'].map((p) => (
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
                    className="w-full mt-2 p-2.5 bg-[#FAF8F5] border border-gray-200 rounded-xl"
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
                  <label className="block text-[11px] font-semibold text-[#707070] mb-1">Bill / Invoice # (optional)</label>
                  <input
                    type="text"
                    placeholder="OCR will read this if blank"
                    value={billInvoiceNumber}
                    onChange={(e) => setBillInvoiceNumber(e.target.value)}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-gray-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="rounded-2xl border-2 border-dashed border-[#D8C18C] bg-[#FFFDF7] p-6 text-center">
                <Receipt className="mx-auto h-8 w-8 text-[#B8862D]" />
                <div className="mt-2 text-sm font-bold text-[#1C1C1C]">Bill / Invoice Upload</div>
                <div className="mt-1 text-xs text-gray-500">PDF, JPG, PNG or WebP</div>

                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1C1C1C] text-white text-xs font-bold cursor-pointer">
                    <Upload className="w-3.5 h-3.5" /> Upload Bill
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => handleBillFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F1E4C5] text-[#7A5B17] text-xs font-bold cursor-pointer">
                    <Camera className="w-3.5 h-3.5" /> Camera
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handleBillFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>

                {billFile && (
                  <div className="mt-4 px-3 py-2 rounded-xl bg-green-50 border border-green-200 text-xs text-green-800 font-semibold">
                    Selected: {billFile.fileName}
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-[11px] text-gray-600">
                <div className="font-bold text-gray-800">Automatic processing</div>
                <div className="mt-1">Bill → OCR → Vendor / Invoice No / Date / Item / Qty / Rate / Tax / Total → Admin approval → Stock.</div>
                <div className="mt-1 font-semibold text-amber-700">Uploading the bill does not add stock. Admin approval is required.</div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#707070] mb-1">Bill Notes / Justification</label>
                <textarea
                  rows={2}
                  value={billNotes}
                  onChange={(e) => setBillNotes(e.target.value)}
                  placeholder="e.g. Emergency outlet purchase..."
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
                disabled={loading || !billFile}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#B8862D] text-white hover:bg-[#9c7124] shadow-xs disabled:opacity-50"
              >
                {loading ? 'Reading & Submitting…' : 'Submit Bill for Approval'}
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
                <p className="text-xs text-[#707070]">Purchase Request Details</p>
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
                        <span className="block text-[10px] text-gray-500">
                          Source: <span className="font-semibold text-[#B8862D]">{formatSupplySource(it.supply_source)}</span>
                          {it.unit || it.unit_symbol ? ` · ${it.unit || it.unit_symbol}` : ''}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-xs">
                        {it.requested_qty} {it.unit || it.unit_symbol || 'Units'}
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
