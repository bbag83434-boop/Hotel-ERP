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
  SmartRequirementDraft,
  SmartRequirementItem,
  BranchRequirementConfig,
  SmartAIAskResponse,
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
  Upload,
  Sparkles,
  Bot,
  HelpCircle,
  Sliders,
  History,
  Check,
  Boxes,
  ArrowLeftRight,
} from 'lucide-react';
import PurchaseModuleLayout, { PurchaseSectionId } from './purchase/PurchaseModuleLayout';
import SetupWorkspace from '@/components/workspaces/SetupWorkspace';

export const PurchaseWorkspace: React.FC = () => {
  const { currentOutlet, activeOutlet, isHeadOffice, outlets } = useOutlet();

  // Active Section & Smart Panel
  const [activeSection, setActiveSection] = useState<PurchaseSectionId>('requisitions');
  const [showSmartAssistant, setShowSmartAssistant] = useState<boolean>(false);

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
  const [consolidatedSupplierId, setConsolidatedSupplierId] = useState<string>('');
  const [consolidatedOrderType, setConsolidatedOrderType] = useState<string>('CONSOLIDATED_DIRECT');
  const [consolidatedBranchId, setConsolidatedBranchId] = useState<string>('');
  const [consolidationNotes, setConsolidationNotes] = useState<string>('');
  const [autoSubmitConsolidated, setAutoSubmitConsolidated] = useState<boolean>(true);

  // Modals & Detail Views
  const [createPRModalOpen, setCreatePRModalOpen] = useState<boolean>(false);
  const [createPOModalOpen, setCreatePOModalOpen] = useState<boolean>(false);
  const [createGRNModalOpen, setCreateGRNModalOpen] = useState<boolean>(false);
  const [viewPRModal, setViewPRModal] = useState<any | null>(null);
  const [viewPOModal, setViewPOModal] = useState<any | null>(null);
  const [view3WayModal, setView3WayModal] = useState<ThreeWayMatchResponse | null>(null);
  const [closingDetailModal, setClosingDetailModal] = useState<OutletClosingRecord | null>(null);
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

  // New GRN / Smart Receiving Form State
  const [newGRNBranchId, setNewGRNBranchId] = useState<string>(activeOutlet.id);
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
  const [grnStatusTab, setGrnStatusTab] = useState<'ALL' | 'PENDING_APPROVAL' | 'APPROVED'>('ALL');
  const [rejectGRNModal, setRejectGRNModal] = useState<{ open: boolean; grnId: string; grnNumber: string }>({
    open: false,
    grnId: '',
    grnNumber: '',
  });
  const [grnRejectReason, setGrnRejectReason] = useState<string>('');
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

  // Smart Requirements & AI Assistant State
  const [smartDraft, setSmartDraft] = useState<SmartRequirementDraft | null>(null);
  const [smartDraftLoading, setSmartDraftLoading] = useState<boolean>(false);
  const [smartConfig, setSmartConfig] = useState<BranchRequirementConfig | null>(null);
  const [smartConfigModalOpen, setSmartConfigModalOpen] = useState<boolean>(false);
  const [leadTimeDays, setLeadTimeDays] = useState<number>(1);
  const [safetyBufferPct, setSafetyBufferPct] = useState<number>(10);
  const [prepTime, setPrepTime] = useState<string>('16:00');
  const [autoEnabled, setAutoEnabled] = useState<boolean>(true);
  const [showAuditTrail, setShowAuditTrail] = useState<boolean>(false);

  // AI Assistant Q&A
  const [aiQuestion, setAiQuestion] = useState<string>('');
  const [aiAnswer, setAiAnswer] = useState<SmartAIAskResponse | null>(null);
  const [aiAsking, setAiAsking] = useState<boolean>(false);

  // Add Item to Draft Modal
  const [addItemDraftModalOpen, setAddItemDraftModalOpen] = useState<boolean>(false);
  const [addDraftItemId, setAddDraftItemId] = useState<string>('');
  const [addDraftQty, setAddDraftQty] = useState<number>(10);
  const [addDraftNotes, setAddDraftNotes] = useState<string>('');

  // Draft Editing State
  const [draftNotes, setDraftNotes] = useState<string>('');
  const [confirmingDraft, setConfirmingDraft] = useState<boolean>(false);

  // Fetch Smart Requirement Draft & Configuration
  const fetchSmartDraft = async (forceRegenerate = false) => {
    if (!activeOutlet.id) return;
    setSmartDraftLoading(true);
    try {
      if (forceRegenerate) {
        const gen = await procurementApi.generateSmartRequirement({
          branch_id: activeOutlet.id,
          lead_time_days: leadTimeDays,
          safety_buffer_percent: safetyBufferPct,
          force_regenerate: true,
        });
        setSmartDraft(gen);
        setFeedback({ type: 'success', message: 'Smart Requirement draft regenerated successfully.' });
      } else {
        const draft = await procurementApi.getSmartRequirementDraft(activeOutlet.id);
        setSmartDraft(draft);
      }
      try {
        const cfg = await procurementApi.getBranchRequirementConfig(activeOutlet.id);
        setSmartConfig(cfg);
        if (cfg) {
          setPrepTime(cfg.preparation_time || '16:00');
          setAutoEnabled(cfg.is_auto_enabled ?? true);
          setLeadTimeDays(cfg.lead_time_days ?? 1);
          setSafetyBufferPct(Number(cfg.safety_buffer_percent ?? 10));
        }
      } catch (cfgErr) {
        // config fallback
      }
    } catch (err: any) {
      console.warn('Smart requirement fetch note:', err);
    } finally {
      setSmartDraftLoading(false);
    }
  };

  // AI Q&A Assistant Handler
  const handleAskAI = async (questionText?: string) => {
    const q = (questionText || aiQuestion).trim();
    if (!q || !activeOutlet.id) return;
    setAiAsking(true);
    try {
      const res = await procurementApi.askSmartRequirementAssistant({
        branch_id: activeOutlet.id,
        question: q,
      });
      setAiAnswer(res);
      setAiQuestion('');
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || err?.message || 'AI Assistant query failed.',
      });
    } finally {
      setAiAsking(false);
    }
  };

  // Update Draft Item Quantity
  const handleUpdateDraftItemQty = async (itemId: string, newQty: number) => {
    if (!smartDraft) return;
    const updatedItems = smartDraft.items.map((it) => {
      if (it.item_id === itemId) {
        return { ...it, final_order_qty: newQty, is_user_modified: true };
      }
      return it;
    });
    try {
      const res = await procurementApi.updateSmartRequirementDraftItems(smartDraft.id, {
        items: updatedItems,
        notes: draftNotes || smartDraft.notes,
      });
      setSmartDraft(res);
      setFeedback({ type: 'success', message: 'Quantity updated and audit logged.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to update item quantity.' });
    }
  };

  // Remove Item from Draft
  const handleRemoveDraftItem = async (itemId: string) => {
    if (!smartDraft) return;
    const updatedItems = smartDraft.items.filter((it) => it.item_id !== itemId);
    try {
      const res = await procurementApi.updateSmartRequirementDraftItems(smartDraft.id, {
        items: updatedItems,
        notes: draftNotes || smartDraft.notes,
      });
      setSmartDraft(res);
      setFeedback({ type: 'success', message: 'Item removed from draft.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to remove item.' });
    }
  };

  // Add Custom Catalog Item to Draft
  const handleAddItemToDraft = async () => {
    if (!smartDraft || !addDraftItemId) return;
    const existing = smartDraft.items.find((it) => it.item_id === addDraftItemId);
    let updatedItems: SmartRequirementItem[];
    if (existing) {
      updatedItems = smartDraft.items.map((it) => {
        if (it.item_id === addDraftItemId) {
          return { ...it, final_order_qty: Number(it.final_order_qty) + Number(addDraftQty), is_user_modified: true };
        }
        return it;
      });
    } else {
      const itmObj = inventoryItems.find((i) => i.id === addDraftItemId);
      const newItem: SmartRequirementItem = {
        item_id: addDraftItemId,
        item_name: itmObj?.name,
        item_code: itmObj?.code,
        unit_symbol: itmObj?.unit?.symbol || 'Units',
        supplier_id: itmObj?.supplier_id,
        supplier_name: itmObj?.supplier?.name,
        current_stock: 0,
        min_stock: itmObj?.min_stock_level || 0,
        target_stock: addDraftQty,
        pending_incoming: 0,
        daily_consumption: 0,
        short_qty: addDraftQty,
        system_suggested_qty: 0,
        final_order_qty: Number(addDraftQty),
        priority: 'MEDIUM',
        is_user_modified: true,
        is_manually_added: true,
        reason: 'Manually added by outlet user',
        notes: addDraftNotes || undefined,
      };
      updatedItems = [...smartDraft.items, newItem];
    }
    try {
      const res = await procurementApi.updateSmartRequirementDraftItems(smartDraft.id, {
        items: updatedItems,
        notes: draftNotes || smartDraft.notes,
      });
      setSmartDraft(res);
      setAddItemDraftModalOpen(false);
      setAddDraftItemId('');
      setAddDraftQty(10);
      setAddDraftNotes('');
      setFeedback({ type: 'success', message: 'Item added to draft.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to add item.' });
    }
  };

  // Confirm Draft -> Converts to Purchase Request
  const handleConfirmSmartDraft = async () => {
    if (!smartDraft) return;
    setConfirmingDraft(true);
    try {
      const res = await procurementApi.confirmSmartRequirementDraft(smartDraft.id, {
        notes: draftNotes || undefined,
      });
      setFeedback({
        type: 'success',
        message: res.message || `Smart Requirement draft confirmed! Converted to ${res.request_number} (PENDING_APPROVAL).`,
      });
      fetchSmartDraft();
      fetchData();
      setActiveSection('requisitions');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to confirm draft.' });
    } finally {
      setConfirmingDraft(false);
    }
  };

  // Save Schedule Config
  const handleSaveScheduleConfig = async () => {
    if (!activeOutlet.id) return;
    try {
      const res = await procurementApi.updateBranchRequirementConfig(activeOutlet.id, {
        preparation_time: prepTime,
        is_auto_enabled: autoEnabled,
        lead_time_days: Number(leadTimeDays),
        safety_buffer_percent: Number(safetyBufferPct),
      });
      setSmartConfig(res);
      setSmartConfigModalOpen(false);
      setFeedback({ type: 'success', message: `Schedule updated: Prepares daily at ${prepTime}.` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to save schedule.' });
    }
  };

  // Process Scheduled Requirements
  const handleTriggerScheduledRun = async () => {
    setLoading(true);
    try {
      const res = await procurementApi.processScheduledRequirements();
      setFeedback({
        type: 'success',
        message: `Scheduled runner finished: ${res.processed_count} prepared, ${res.skipped_count} skipped.`,
      });
      fetchSmartDraft();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to trigger scheduled run.' });
    } finally {
      setLoading(false);
    }
  };

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
    fetchSmartDraft();
  }, [activeOutlet.id, selectedBranchFilter, statusFilter, priorityFilter]);

  // Handle 3-Way Match Drill Down
  const open3WayMatch = async (poId: string) => {
    setSelected3WayPOId(poId);
    setActiveSection('orders');
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
      setActiveSection('orders');
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
      setActiveSection('orders');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to create PO.' });
    } finally {
      setLoading(false);
    }
  };

  // When PO is chosen for receiving, prefill GRN line items & invoice amount
  const handleSelectPOForGRN = (poId: string) => {
    setNewGRNPOId(poId);
    const po = orders.find((o) => o.id === poId);
    if (po) {
      setNewGRNSupplierId(po.supplier_id || '');
      setNewGRNBranchId(po.branch_id || activeOutlet.id);
      const totalPoAmt = Number(po.net_amount || po.total_amount || 0);
      setNewGRNInvoiceAmt(totalPoAmt);
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

  // Open Smart Receiving modal directly from a PO card
  const handleOpenReceiveForPO = (po: any) => {
    setNewGRNPOId(po.id);
    setNewGRNSupplierId(po.supplier_id || '');
    setNewGRNBranchId(po.branch_id || activeOutlet.id);
    setNewGRNInvoiceNum('');
    const totalPoAmt = Number(po.net_amount || po.total_amount || 0);
    setNewGRNInvoiceAmt(totalPoAmt);
    setNewGRNNotes('');
    setNewGRNInvoiceFile(null);
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
    setCreateGRNModalOpen(true);
  };

  // Handle Invoice File Upload / Selection
  const handleInvoiceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowed.includes(file.type)) {
      setFeedback({ type: 'error', message: 'Invalid file format. Please upload a PDF, JPG, or PNG invoice document.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64Str = (reader.result as string).split(',')[1];
      setNewGRNInvoiceFile({
        fileName: file.name,
        fileType: file.type,
        fileBase64: base64Str,
        size: file.size,
      });
    };
    reader.readAsDataURL(file);
  };

  // Submit Smart Receiving from PO
  const handleCreateGRN = async () => {
    if (!newGRNPOId) {
      setFeedback({ type: 'error', message: 'Please select an approved Purchase Order for receiving.' });
      return;
    }
    if (!newGRNInvoiceNum.trim()) {
      setFeedback({ type: 'error', message: 'Please enter the Supplier Invoice / Bill Number.' });
      return;
    }
    setLoading(true);
    try {
      if (newGRNInvoiceFile) {
        try {
          await procurementApi.uploadSupplierInvoice({
            po_id: newGRNPOId,
            branch_id: newGRNBranchId,
            supplier_id: newGRNSupplierId,
            invoice_number: newGRNInvoiceNum.trim(),
            invoice_amount: Number(newGRNInvoiceAmt || 0),
            file_name: newGRNInvoiceFile.fileName,
            file_type: newGRNInvoiceFile.fileType,
            file_base64: newGRNInvoiceFile.fileBase64,
          });
        } catch (uploadErr) {
          console.warn('Invoice upload note:', uploadErr);
        }
      }

      await procurementApi.createGoodsReceiveFromPO({
        po_id: newGRNPOId,
        branch_id: newGRNBranchId,
        supplier_invoice_number: newGRNInvoiceNum.trim(),
        invoice_amount: Number(newGRNInvoiceAmt || 0),
        invoice_file_name: newGRNInvoiceFile?.fileName || undefined,
        notes: newGRNNotes || undefined,
      });

      setFeedback({
        type: 'success',
        message: 'Receiving submitted successfully! Queued for HO/Central Approval.',
      });
      setCreateGRNModalOpen(false);
      setNewGRNLines([]);
      setNewGRNInvoiceNum('');
      setNewGRNInvoiceAmt(0);
      setNewGRNNotes('');
      setNewGRNInvoiceFile(null);
      fetchData();
      setActiveSection('receiving');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.message || err?.message || 'GRN submission failed.' });
    } finally {
      setLoading(false);
    }
  };

  // HO Approve GRN
  const handleApproveGRN = async (grnId: string) => {
    setLoading(true);
    try {
      await procurementApi.approveGoodsReceiveNote(grnId);
      setFeedback({
        type: 'success',
        message: 'GRN Approved! Items & quantities successfully posted to destination StockBalance & StockLedger.',
      });
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Approval failed.' });
    } finally {
      setLoading(false);
    }
  };

  // HO Reject GRN
  const handleConfirmRejectGRN = async () => {
    if (!grnRejectReason.trim()) {
      setFeedback({ type: 'error', message: 'Please provide a reason for rejecting this receiving.' });
      return;
    }
    setLoading(true);
    try {
      await procurementApi.rejectGoodsReceiveNote(rejectGRNModal.grnId, { reason: grnRejectReason.trim() });
      setFeedback({
        type: 'success',
        message: `GRN ${rejectGRNModal.grnNumber} rejected. No stock was posted.`,
      });
      setRejectGRNModal({ open: false, grnId: '', grnNumber: '' });
      setGrnRejectReason('');
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Rejection failed.' });
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

      {/* Nested Zing-style Purchase Module Layout */}
      <PurchaseModuleLayout activeSection={activeSection} onSectionChange={setActiveSection}>
        {/* SECTION 1: REQUISITIONS (PR QUEUE + SMART AI INDENT) */}
        {activeSection === 'requisitions' && (
          <div className="space-y-4">
            {/* Quick Smart AI Assistant Toggle */}
            <div className="flex items-center justify-between pb-1">
              <button
                onClick={() => setShowSmartAssistant(!showSmartAssistant)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                  showSmartAssistant
                    ? 'bg-[#F1E4C5] text-[#B8862D] border border-[#B8862D]/30'
                    : 'bg-white border border-[rgba(45,45,45,0.12)] text-[#1C1C1C] hover:bg-[#FAF8F5]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-[#C79A3B]" />
                <span>{showSmartAssistant ? 'Hide Smart AI Assistant' : 'Smart AI Indent Engine'}</span>
                {smartDraft && smartDraft.critical_count > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[9px] animate-pulse">
                    {smartDraft.critical_count} Critical
                  </span>
                )}
              </button>
            </div>

            {/* Collapsible Smart AI Indent Assistant */}
            {showSmartAssistant && (
              <div className="space-y-4 p-4 rounded-3xl bg-[#FAF8F5] border border-[#C79A3B]/30 shadow-xs mb-4">
                {/* Outlet Scoping & Control Banner */}
                <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-[#F1E4C5] text-[#B8862D]">
                      <Sparkles className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-[#1C1C1C] flex items-center gap-2">
                        Smart AI Requirement Engine
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#FAF8F5] text-[#B8862D] border border-[#C79A3B]/30">
                          [{activeOutlet.code}] {activeOutlet.name}
                        </span>
                      </h4>
                      <p className="text-[11px] text-[#707070]">
                        Deterministic stock + run-rate + lead time & safety buffer calculations.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => fetchSmartDraft(true)}
                      disabled={smartDraftLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] text-xs font-bold text-[#1C1C1C] hover:bg-[#FAF8F5] shadow-xs transition-all"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-[#C79A3B] ${smartDraftLoading ? 'animate-spin' : ''}`} />
                      Regenerate
                    </button>
                    <button
                      onClick={() => setSmartConfigModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] text-xs font-bold text-[#1C1C1C] hover:bg-[#FAF8F5] shadow-xs transition-all"
                    >
                      <Sliders className="w-3.5 h-3.5 text-[#C79A3B]" />
                      Schedule ({prepTime})
                    </button>
                  </div>
                </div>

                {/* AI Assistant Question Box */}
                <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={aiQuestion}
                      onChange={(e) => setAiQuestion(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAskAI();
                      }}
                      placeholder={`Ask AI Assistant about stock, consumption, or replenishment for ${activeOutlet.name}...`}
                      className="flex-1 px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs focus:outline-none focus:border-[#C79A3B]"
                    />
                    <button
                      onClick={() => handleAskAI()}
                      disabled={aiAsking || !aiQuestion.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#B8862D] hover:bg-[#9E7326] text-white text-xs font-bold disabled:opacity-50 transition-all shadow-xs"
                    >
                      <Send className={`w-3.5 h-3.5 ${aiAsking ? 'animate-spin' : ''}`} />
                      {aiAsking ? 'Analyzing...' : 'Ask'}
                    </button>
                  </div>

                  {aiAnswer && (
                    <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#C79A3B]/30 text-xs text-[#1C1C1C] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#B8862D] text-[10px] uppercase">{aiAnswer.intent}</span>
                        <button onClick={() => setAiAnswer(null)} className="text-gray-400 hover:text-gray-600">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="whitespace-pre-line text-[11px] leading-relaxed">{aiAnswer.answer_text}</p>
                    </div>
                  )}
                </div>

                {/* Active Draft Confirmation Card */}
                {smartDraft && smartDraft.items && smartDraft.items.length > 0 && (
                  <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] flex items-center justify-between gap-3">
                    <div className="text-xs">
                      <span className="font-bold text-[#1C1C1C] block">
                        Calculated {smartDraft.items.length} requirement items (${Number(smartDraft.estimated_total_order_value || 0).toFixed(2)})
                      </span>
                      <span className="text-[11px] text-[#707070]">
                        {smartDraft.critical_count} critical, {smartDraft.high_priority_count} high priority.
                      </span>
                    </div>

                    <button
                      onClick={handleConfirmSmartDraft}
                      disabled={confirmingDraft || smartDraft.status === 'CONFIRMED'}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2E8B57] hover:bg-[#257247] text-white text-xs font-bold disabled:opacity-50 shadow-xs transition-all"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {confirmingDraft ? 'Submitting...' : smartDraft.status === 'CONFIRMED' ? 'Draft Confirmed' : 'Confirm & Convert to PR'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* PR Controls Bar & Table */}
            {(() => {
              const filteredRequests = requests.filter((pr) => {
                if (!searchQuery) return true;
                const q = searchQuery.toLowerCase();
                const reqNum = (pr.request_number || '').toLowerCase();
                const dest = (pr.branch_name || '').toLowerCase();
                const itemsText = (pr.items || []).map((i: any) => i.item_name || '').join(' ').toLowerCase();
                return reqNum.includes(q) || dest.includes(q) || itemsText.includes(q);
              });

              const hasActiveFilters = searchQuery !== '' || statusFilter !== 'ALL' || priorityFilter !== 'ALL' || (isHeadOffice && selectedBranchFilter !== 'ALL');

              return (
                <div className="space-y-4">
                  {/* Controls Bar */}
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5 flex-1">
                      {/* Search Input */}
                      <div className="relative flex-1 min-w-[200px] max-w-md">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]" />
                        <input
                          type="text"
                          placeholder="Search PR number, destination..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-white border border-[rgba(45,45,45,0.12)] focus:outline-none focus:border-[#C79A3B] text-[#1C1C1C] shadow-xs"
                        />
                      </div>

                      {/* Outlet Filter for HO */}
                      {isHeadOffice && (
                        <div className="flex items-center gap-1.5">
                          <select
                            value={selectedBranchFilter}
                            onChange={(e) => setSelectedBranchFilter(e.target.value)}
                            className="px-3 py-2 bg-white border border-[rgba(45,45,45,0.12)] rounded-xl text-xs text-[#1C1C1C] font-medium focus:outline-none focus:border-[#C79A3B] shadow-xs"
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
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 bg-white border border-[rgba(45,45,45,0.12)] rounded-xl text-xs text-[#1C1C1C] font-medium focus:outline-none focus:border-[#C79A3B] shadow-xs"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="PENDING_APPROVAL">Pending Approval</option>
                        <option value="APPROVED">Approved</option>
                        <option value="ORDERED">Consolidated / Ordered</option>
                        <option value="DRAFT">Draft</option>
                        <option value="REJECTED">Rejected</option>
                      </select>

                      {/* Priority Filter */}
                      <select
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value)}
                        className="px-3 py-2 bg-white border border-[rgba(45,45,45,0.12)] rounded-xl text-xs text-[#1C1C1C] font-medium focus:outline-none focus:border-[#C79A3B] shadow-xs"
                      >
                        <option value="ALL">All Priorities</option>
                        <option value="CRITICAL">Critical</option>
                        <option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Low</option>
                      </select>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setCreatePRModalOpen(true)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#C79A3B] to-[#B8862D] text-white text-xs font-bold shadow-md shadow-[#C79A3B]/20 hover:brightness-105 active:scale-95 transition-all whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ New Indent (PR)</span>
                      </button>

                      {isHeadOffice && (
                        <button
                          onClick={selectAllPendingPRs}
                          className="px-3 py-2 rounded-xl border border-[rgba(45,45,45,0.15)] text-xs text-[#707070] bg-white hover:bg-[#FAF8F5] font-semibold transition-all shadow-xs"
                        >
                          {selectedPRIds.length > 0 ? 'Deselect All' : 'Select All Ready'}
                        </button>
                      )}

                      {isHeadOffice && (
                        <button
                          onClick={() => setConsolidationModalOpen(true)}
                          disabled={selectedPRIds.length === 0}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs whitespace-nowrap ${
                            selectedPRIds.length > 0
                              ? 'bg-[#1C1C1C] text-white hover:bg-[#2D2D2D] active:scale-95 shadow-md'
                              : 'bg-gray-100 text-gray-400 border border-[rgba(45,45,45,0.08)] cursor-not-allowed'
                          }`}
                        >
                          <Layers className="w-3.5 h-3.5 text-[#C79A3B]" />
                          Consolidate Selected ({selectedPRIds.length}) to PO
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Requisitions Count Line */}
                  <div className="text-[11px] font-semibold text-[#707070]">
                    {filteredRequests.length.toLocaleString()} purchase requisitions
                  </div>

                  {/* PR Queue Table */}
                  <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-[#FAF8F5]/80 border-b border-[rgba(45,45,45,0.08)] text-[#707070] uppercase font-bold text-[10px] tracking-wider">
                            <th className="py-3 px-4 w-10 text-center">
                              {isHeadOffice && (
                                <input
                                  type="checkbox"
                                  checked={selectedPRIds.length > 0 && selectedPRIds.length === filteredRequests.length}
                                  onChange={selectAllPendingPRs}
                                  className="rounded accent-[#B8862D] cursor-pointer"
                                />
                              )}
                            </th>
                            <th className="py-3 px-4">PR NUMBER</th>
                            <th className="py-3 px-4">DESTINATION</th>
                            <th className="py-3 px-4">PURCHASE TYPE</th>
                            <th className="py-3 px-4">REQUIRED BY</th>
                            <th className="py-3 px-4">ITEMS SUMMARY</th>
                            <th className="py-3 px-4">EST. VALUE</th>
                            <th className="py-3 px-4">PRIORITY</th>
                            <th className="py-3 px-4">STATUS</th>
                            <th className="py-3 px-4 text-right">ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
                          {loading ? (
                            Array.from({ length: 5 }).map((_, idx) => (
                              <tr key={idx} className="animate-pulse">
                                <td className="py-3.5 px-4 text-center">
                                  <div className="h-4 w-4 bg-gray-200 rounded mx-auto"></div>
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="h-3 w-20 bg-gray-200 rounded"></div>
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="h-3 w-28 bg-gray-200 rounded"></div>
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="h-3 w-24 bg-gray-200 rounded"></div>
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="h-3 w-20 bg-gray-200 rounded"></div>
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="h-3 w-32 bg-gray-200 rounded"></div>
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="h-3 w-16 bg-gray-200 rounded"></div>
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="h-4 w-14 bg-gray-200 rounded-full"></div>
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="h-4 w-16 bg-gray-200 rounded-full"></div>
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  <div className="h-4 w-12 bg-gray-200 rounded ml-auto"></div>
                                </td>
                              </tr>
                            ))
                          ) : filteredRequests.length === 0 ? (
                            <tr>
                              <td colSpan={10} className="py-12 text-center text-[#707070]">
                                <div className="max-w-xs mx-auto space-y-2">
                                  <ShoppingCart className="w-8 h-8 text-[#C79A3B]/50 mx-auto" />
                                  <p className="font-bold text-[#1C1C1C]">No purchase requests found</p>
                                  <p className="text-[11px]">
                                    {hasActiveFilters
                                      ? 'No indents match the active filters or search criteria.'
                                      : 'There are no active purchase requisitions in the queue.'}
                                  </p>
                                  {hasActiveFilters && (
                                    <button
                                      onClick={() => {
                                        setSearchQuery('');
                                        setStatusFilter('ALL');
                                        setPriorityFilter('ALL');
                                        if (isHeadOffice) setSelectedBranchFilter('ALL');
                                      }}
                                      className="text-xs font-bold text-[#B8862D] underline pt-1 block mx-auto"
                                    >
                                      Clear filters
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ) : (
                            filteredRequests.map((pr) => {
                              const totalEst = (pr.items || []).reduce(
                                (acc: number, it: any) => acc + Number(it.requested_qty || 0) * Number(it.estimated_price || 0),
                                0
                              );
                              const isSelected = selectedPRIds.includes(pr.id);

                              return (
                                <tr
                                  key={pr.id}
                                  className={`hover:bg-[#FAF8F5]/60 transition-colors duration-100 ${
                                    isSelected ? 'bg-[#F1E4C5]/20' : ''
                                  }`}
                                >
                                  <td className="py-3 px-4 text-center">
                                    {isHeadOffice && (
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => togglePRSelection(pr.id)}
                                        className="rounded accent-[#B8862D] cursor-pointer"
                                      />
                                    )}
                                  </td>
                                  <td className="py-3 px-4 font-mono font-bold text-[#B8862D]">
                                    {pr.request_number}
                                  </td>
                                  <td className="py-3 px-4 font-bold text-[#1C1C1C]">
                                    {pr.branch_name || 'Retail Outlet'}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FAF8F5] text-[#707070] border border-[rgba(45,45,45,0.08)]">
                                      {pr.purchase_type || 'DIRECT_OUTLET_PURCHASE'}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-[#707070]">
                                    {pr.required_date ? new Date(pr.required_date).toLocaleDateString() : 'Immediate'}
                                  </td>
                                  <td className="py-3 px-4 text-[#707070]">
                                    <div className="flex items-center gap-1 font-semibold text-[#1C1C1C]">
                                      <span>{(pr.items || []).length} items</span>
                                      <span className="text-[10px] text-[#707070] font-normal">
                                        ({(pr.items || []).slice(0, 2).map((i: any) => i.item_name).join(', ')}
                                        {(pr.items || []).length > 2 ? '...' : ''})
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 font-bold font-mono text-[#1C1C1C]">
                                    ${totalEst.toFixed(2)}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        pr.priority === 'CRITICAL' || pr.priority === 'URGENT'
                                          ? 'bg-[#D9534F]/10 text-[#D9534F] border border-[#D9534F]/30'
                                          : pr.priority === 'HIGH'
                                          ? 'bg-[#D99625]/10 text-[#D99625] border border-[#D99625]/30'
                                          : pr.priority === 'MEDIUM'
                                          ? 'bg-[#3978B8]/10 text-[#3978B8] border border-[#3978B8]/30'
                                          : 'bg-[#FAF8F5] text-[#707070] border border-[rgba(45,45,45,0.08)]'
                                      }`}
                                    >
                                      {pr.priority}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        pr.status === 'APPROVED'
                                          ? 'bg-[#2E8B57]/10 text-[#2E8B57] border border-[#2E8B57]/30'
                                          : pr.status === 'PENDING_APPROVAL'
                                          ? 'bg-[#F1E4C5] text-[#B8862D] border border-[#B8862D]/30'
                                          : pr.status === 'ORDERED'
                                          ? 'bg-[#3978B8]/10 text-[#3978B8] border border-[#3978B8]/30'
                                          : pr.status === 'REJECTED'
                                          ? 'bg-[#D9534F]/10 text-[#D9534F] border border-[#D9534F]/30'
                                          : 'bg-[#FAF8F5] text-[#707070] border border-[rgba(45,45,45,0.08)]'
                                      }`}
                                    >
                                      {pr.status === 'APPROVED'
                                        ? 'Approved'
                                        : pr.status === 'PENDING_APPROVAL'
                                        ? 'Pending Approval'
                                        : pr.status === 'ORDERED'
                                        ? 'Consolidated / Ordered'
                                        : pr.status === 'REJECTED'
                                        ? 'Rejected'
                                        : pr.status === 'DRAFT'
                                        ? 'Draft'
                                        : pr.status}
                                    </span>
                                    {pr.status === 'REJECTED' && pr.rejection_reason && (
                                      <div className="mt-1 text-[10px] font-semibold text-[#D9534F]">
                                        Rejected: {pr.rejection_reason}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-right space-x-1">
                                    <button
                                      onClick={() => setViewPRModal(pr)}
                                      className="p-1.5 rounded-lg text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5] transition-colors"
                                      title="View Indent Details"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>

                                    {isHeadOffice && pr.status === 'PENDING_APPROVAL' && (
                                      <>
                                        <button
                                          onClick={() => handleApprovePR(pr.id)}
                                          className="p-1.5 rounded-lg text-[#2E8B57] hover:bg-[#2E8B57]/10 transition-colors"
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
                                          className="p-1.5 rounded-lg text-[#D99625] hover:bg-[#D99625]/10 transition-colors"
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
                                          className="p-1.5 rounded-lg text-[#D9534F] hover:bg-[#D9534F]/10 transition-colors"
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
              );
            })()}
          </div>
        )}

        {/* SECTION 2: RECEIVING (DESTINATION GRN RECEIVING) */}
        {activeSection === 'receiving' && (
          <div className="space-y-4">
            {/* Sub-Tabs for GRN Status Workflow */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 bg-[#FAF8F5] p-1.5 rounded-2xl border border-[rgba(45,45,45,0.08)]">
                <button
                  onClick={() => setGrnStatusTab('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    grnStatusTab === 'ALL' ? 'bg-white text-[#1C1C1C] shadow-xs' : 'text-[#707070] hover:text-[#1C1C1C]'
                  }`}
                >
                  All Receiving ({grns.length})
                </button>
                <button
                  onClick={() => setGrnStatusTab('PENDING_APPROVAL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    grnStatusTab === 'PENDING_APPROVAL' ? 'bg-white text-[#1C1C1C] shadow-xs' : 'text-[#707070] hover:text-[#1C1C1C]'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-[#B8862D]" />
                  Pending HO ({grns.filter((g) => g.status === 'PENDING_APPROVAL').length})
                </button>
                <button
                  onClick={() => setGrnStatusTab('APPROVED')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    grnStatusTab === 'APPROVED' ? 'bg-white text-[#1C1C1C] shadow-xs' : 'text-[#707070] hover:text-[#1C1C1C]'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#2E8B57]" />
                  Stock Posted ({grns.filter((g) => ['APPROVED', 'RECEIVED', 'QC_PASSED'].includes(g.status)).length})
                </button>
              </div>

              <button
                onClick={() => {
                  setNewGRNPOId('');
                  setNewGRNLines([]);
                  setNewGRNInvoiceNum('');
                  setNewGRNInvoiceAmt(0);
                  setNewGRNNotes('');
                  setNewGRNInvoiceFile(null);
                  setCreateGRNModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-[#2E8B57] text-white text-xs font-bold hover:bg-[#257247] shadow-xs flex items-center gap-1.5"
              >
                <PackageCheck className="w-4 h-4" /> Receive Delivery (GRN)
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#FAF8F5] border-b border-[rgba(45,45,45,0.08)] text-[#707070] font-bold">
                      <th className="p-3.5">GRN Ref</th>
                      <th className="p-3.5">Receive Date</th>
                      <th className="p-3.5">Destination</th>
                      <th className="p-3.5">Supplier & PO</th>
                      <th className="p-3.5">Supplier Invoice #</th>
                      <th className="p-3.5">Invoice Amount</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(45,45,45,0.05)]">
                    {grns.filter((g) => {
                      if (grnStatusTab === 'PENDING_APPROVAL') return g.status === 'PENDING_APPROVAL';
                      if (grnStatusTab === 'APPROVED') return ['APPROVED', 'RECEIVED', 'QC_PASSED'].includes(g.status);
                      return true;
                    }).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-gray-400">
                          {grnStatusTab === 'PENDING_APPROVAL'
                            ? 'No goods receipts currently waiting for HO approval.'
                            : 'No goods receipt notes found. Click "Receive Delivery (GRN)" to log arriving stock.'}
                        </td>
                      </tr>
                    ) : (
                      grns
                        .filter((g) => {
                          if (grnStatusTab === 'PENDING_APPROVAL') return g.status === 'PENDING_APPROVAL';
                          if (grnStatusTab === 'APPROVED') return ['APPROVED', 'RECEIVED', 'QC_PASSED'].includes(g.status);
                          return true;
                        })
                        .map((g) => {
                          const isPending = g.status === 'PENDING_APPROVAL';
                          const isApproved = ['APPROVED', 'RECEIVED', 'QC_PASSED'].includes(g.status);
                          const hasVariance = (g.notes || '').includes('INVOICE VARIANCE FLAGGED');

                          return (
                            <tr key={g.id} className="hover:bg-[#FAF8F5]/60 transition-all">
                              <td className="p-3.5 font-mono font-bold text-[#1C1C1C]">{g.grn_number}</td>
                              <td className="p-3.5 text-[#707070]">{new Date(g.receive_date).toLocaleDateString()}</td>
                              <td className="p-3.5">
                                <div className="font-semibold text-[#1C1C1C]">{g.branch_name}</div>
                                <div className="text-[11px] text-[#707070]">{g.warehouse_name || 'Main Store'}</div>
                              </td>
                              <td className="p-3.5">
                                <div className="text-[#1C1C1C] font-semibold">{g.supplier_name || 'Direct Vendor'}</div>
                                <div className="font-mono text-[#B8862D] text-[11px]">{g.po_number || 'Direct Delivery'}</div>
                              </td>
                              <td className="p-3.5 font-mono font-semibold text-gray-700">{g.supplier_invoice_number || '—'}</td>
                              <td className="p-3.5">
                                <div className="font-mono font-bold text-[#1C1C1C]">${Number(g.total_amount || 0).toFixed(2)}</div>
                                {hasVariance && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200 mt-0.5">
                                    <AlertTriangle className="w-3 h-3 text-amber-600" /> Variance Flagged
                                  </span>
                                )}
                              </td>
                              <td className="p-3.5">
                                <span
                                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                    isApproved
                                      ? 'bg-[#2E8B57]/15 text-[#2E8B57]'
                                      : isPending
                                      ? 'bg-[#B8862D]/15 text-[#B8862D] animate-pulse'
                                      : 'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {isPending ? 'PENDING APPROVAL' : g.status}
                                </span>
                              </td>
                              <td className="p-3.5 text-right">
                                {isHeadOffice && isPending ? (
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => handleApproveGRN(g.id)}
                                      disabled={loading}
                                      className="px-3 py-1 rounded-lg bg-[#2E8B57] text-white text-xs font-bold hover:bg-[#257247] transition-all flex items-center gap-1 shadow-xs"
                                      title="Approve Receiving & Post to Destination Stock"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Post Stock
                                    </button>
                                    <button
                                      onClick={() => setRejectGRNModal({ open: true, grnId: g.id, grnNumber: g.grn_number })}
                                      disabled={loading}
                                      className="px-2.5 py-1 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition-all"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                ) : isApproved ? (
                                  <span className="text-[#2E8B57] font-semibold text-xs inline-flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Stock Posted
                                  </span>
                                ) : isPending ? (
                                  <span className="text-[#B8862D] font-semibold text-xs inline-flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" /> Pending HO Approval
                                  </span>
                                ) : (
                                  <span className="text-red-500 font-semibold text-xs inline-flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5" /> Rejected
                                  </span>
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

        {/* SECTION 3: UPLOAD BILLS (STUB / COMING SOON) */}
        {activeSection === 'upload_bills' && (
          <div className="bg-white rounded-3xl border border-[rgba(45,45,45,0.08)] p-8 sm:p-12 text-center shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-[#F1E4C5] text-[#B8862D] flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-[#1C1C1C] mb-1">Direct Bill & Invoice Scanner</h3>
            <p className="text-xs text-[#707070] max-w-md mx-auto mb-6">
              Upload supplier tax invoices and delivery dockets. AI OCR will automatically extract vendor details, line items, and match against purchase orders.
            </p>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FAF8F5] text-[#B8862D] border border-[#C79A3B]/30">
              Coming soon in next module pass
            </span>
          </div>
        )}

        {/* SECTION 4: STOCK OVERVIEW (LINK OUT / EMBED SUMMARY) */}
        {activeSection === 'stock' && (
          <div className="bg-white rounded-3xl border border-[rgba(45,45,45,0.08)] p-8 sm:p-12 text-center shadow-sm space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[#F1E4C5] text-[#B8862D] flex items-center justify-center mx-auto mb-2">
              <Boxes className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1C1C1C] mb-1">Real-Time Inventory & Stock Balances</h3>
              <p className="text-xs text-[#707070] max-w-md mx-auto">
                Stock is actively synced across all {outlets.length} outlets. View warehouse ledgers, stock reconciliations, and reorder levels in the dedicated Inventory workspace.
              </p>
            </div>
            <div className="pt-2">
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-[#FAF8F5] text-[#B8862D] border border-[#C79A3B]/30">
                Accessible via main sidebar &ldquo;Inventory & Stock&rdquo;
              </span>
            </div>
          </div>
        )}

        {/* SECTION 5: APPROVALS (STUB / COMING SOON) */}
        {activeSection === 'approvals' && (
          <div className="bg-white rounded-3xl border border-[rgba(45,45,45,0.08)] p-8 sm:p-12 text-center shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-[#F1E4C5] text-[#B8862D] flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-[#1C1C1C] mb-1">Central Purchase Approvals Queue</h3>
            <p className="text-xs text-[#707070] max-w-md mx-auto mb-6">
              Multi-tier approval thresholds and automated escalation for high-value purchase requisitions and supplier contracts.
            </p>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FAF8F5] text-[#B8862D] border border-[#C79A3B]/30">
              Coming soon in next module pass
            </span>
          </div>
        )}

        {/* SECTION 6: ORDERS (PURCHASE ORDERS & WHATSAPP DISPATCH + 3-WAY MATCH DRILLDOWN) */}
        {activeSection === 'orders' && (
          <div className="space-y-4">
            {/* 3-Way Match Drill Down (if inspecting a specific PO) */}
            {selected3WayPOId && threeWayData && (
              <div className="p-5 rounded-3xl bg-white border border-[#C79A3B]/40 shadow-md space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[rgba(45,45,45,0.08)]">
                  <div className="flex items-center gap-2.5">
                    <Receipt className="w-5 h-5 text-[#C79A3B]" />
                    <div>
                      <h4 className="text-sm font-bold text-[#1C1C1C]">
                        3-Way Invoice Matching Audit &bull; PO {threeWayData.po_number}
                      </h4>
                      <p className="text-[11px] text-[#707070]">
                        Matching Purchase Order vs GRN Receipts vs Supplier Invoices
                      </p>
                    </div>
                  </div>

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
                    <button
                      onClick={() => {
                        setSelected3WayPOId('');
                        setThreeWayData(null);
                      }}
                      className="text-gray-400 hover:text-gray-600 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 3-Way Match Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[rgba(45,45,45,0.06)]">
                    <span className="text-[#707070] block text-[10px] uppercase font-bold">1. PO Ordered Value</span>
                    <span className="text-base font-bold text-[#1C1C1C] font-mono">
                      ${Number(threeWayData.total_ordered_amount || threeWayData.po_total || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[rgba(45,45,45,0.06)]">
                    <span className="text-[#707070] block text-[10px] uppercase font-bold">2. GRN Received Value</span>
                    <span className="text-base font-bold text-[#1C1C1C] font-mono">
                      ${Number(threeWayData.total_received_amount || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[rgba(45,45,45,0.06)]">
                    <span className="text-[#707070] block text-[10px] uppercase font-bold">3. Invoice Billed Value</span>
                    <span className="text-base font-bold text-[#1C1C1C] font-mono">
                      ${Number(threeWayData.total_invoice_amount || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Line Items Audit Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#FAF8F5] border-b border-[rgba(45,45,45,0.08)] text-[#707070] font-bold">
                        <th className="p-2.5">Item</th>
                        <th className="p-2.5 text-right">PO Ordered</th>
                        <th className="p-2.5 text-right">GRN Received</th>
                        <th className="p-2.5 text-right">Billed Qty</th>
                        <th className="p-2.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(45,45,45,0.05)]">
                      {(threeWayData.lines || []).map((ln: any, i: number) => (
                        <tr key={i} className="hover:bg-[#FAF8F5]/50">
                          <td className="p-2.5 font-semibold text-[#1C1C1C]">{ln.item_name}</td>
                          <td className="p-2.5 text-right font-mono">{ln.po_qty}</td>
                          <td className="p-2.5 text-right font-mono">{ln.grn_qty}</td>
                          <td className="p-2.5 text-right font-mono">{ln.invoice_qty}</td>
                          <td className="p-2.5 text-right">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2E8B57]/15 text-[#2E8B57]">
                              {ln.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PO Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {orders.length === 0 ? (
                <div className="col-span-full p-8 text-center bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] text-gray-400">
                  No purchase orders generated yet. Use Requisitions to consolidate indents or create a Direct PO.
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

                        {isHeadOffice && po.status === 'PENDING_APPROVAL' && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleApprovePO(po.id)}
                              disabled={loading}
                              className="px-2.5 py-1.5 rounded-lg bg-[#2E8B57] text-white text-xs font-bold hover:bg-[#257247] transition-all flex items-center gap-1 shadow-xs"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                            </button>
                            <button
                              onClick={() =>
                                setActionReasonModal({
                                  type: 'CANCEL_PO',
                                  id: po.id,
                                  title: `Cancel PO ${po.po_number}`,
                                })
                              }
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                              title="Cancel PO"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {po.status === 'APPROVED' && (
                          <button
                            onClick={() => handleOpenWhatsApp(po.id)}
                            disabled={loading}
                            className="px-2.5 py-1.5 rounded-lg bg-[#25D366] text-white text-xs font-bold hover:bg-[#1EBE5D] transition-all flex items-center gap-1 shadow-xs"
                            title="Dispatch PO via WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" /> Send WhatsApp
                          </button>
                        )}

                        {po.status === 'WHATSAPP_OPENED' && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleOpenWhatsApp(po.id)}
                              className="p-1.5 rounded-lg bg-green-50 text-[#25D366] hover:bg-green-100"
                              title="Reopen WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleConfirmSent(po.id)}
                              disabled={loading}
                              className="px-2.5 py-1.5 rounded-lg bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] text-[#1C1C1C] text-xs font-bold hover:bg-white transition-all shadow-xs"
                              title="Mark as Sent Manually"
                            >
                              Sent OK
                            </button>
                          </div>
                        )}

                        {['APPROVED', 'WHATSAPP_OPENED', 'SENT_MANUALLY', 'ISSUED', 'PARTIALLY_RECEIVED'].includes(po.status) && (
                          <button
                            onClick={() => handleOpenReceiveForPO(po)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#2E8B57] text-white text-xs font-bold hover:bg-[#257247] transition-all flex items-center gap-1 shadow-xs"
                            title="Record Goods Receiving for this PO"
                          >
                            <PackageCheck className="w-3.5 h-3.5" /> Receive Stock
                          </button>
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

        {/* SECTION 7: BILLS & PAYMENTS (STUB / COMING SOON) */}
        {activeSection === 'bills_payments' && (
          <div className="bg-white rounded-3xl border border-[rgba(45,45,45,0.08)] p-8 sm:p-12 text-center shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-[#F1E4C5] text-[#B8862D] flex items-center justify-center mx-auto mb-4">
              <Receipt className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-[#1C1C1C] mb-1">Vendor Bills & Payment Schedules</h3>
            <p className="text-xs text-[#707070] max-w-md mx-auto mb-6">
              Three-way matched supplier invoices approved and queued for weekly disbursements, credit period monitoring, and bank exports.
            </p>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FAF8F5] text-[#B8862D] border border-[#C79A3B]/30">
              Coming soon in next module pass
            </span>
          </div>
        )}

        {/* SECTION 8: NEEDS ATTENTION (STUB / COMING SOON) */}
        {activeSection === 'needs_attention' && (
          <div className="bg-white rounded-3xl border border-[rgba(45,45,45,0.08)] p-8 sm:p-12 text-center shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-[#1C1C1C] mb-1">Procurement Exceptions & Variances</h3>
            <p className="text-xs text-[#707070] max-w-md mx-auto mb-6">
              Automated anomaly detection for unit price inflation, partial delivery shortages, unmapped items, and delivery SLA breaches.
            </p>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FAF8F5] text-amber-700 border border-amber-300">
              Coming soon in next module pass
            </span>
          </div>
        )}

        {/* SECTION 9: TRANSFERS (SUMMARY / LINK OUT) */}
        {activeSection === 'transfers' && (
          <div className="bg-white rounded-3xl border border-[rgba(45,45,45,0.08)] p-8 sm:p-12 text-center shadow-sm space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[#F1E4C5] text-[#B8862D] flex items-center justify-center mx-auto mb-2">
              <ArrowLeftRight className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1C1C1C] mb-1">Inter-Outlet Store Transfers</h3>
              <p className="text-xs text-[#707070] max-w-md mx-auto">
                Issue and receive inter-branch transfers between central warehouse and outlet kitchens with in-transit tracking and driver manifest.
              </p>
            </div>
            <div className="pt-2">
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-[#FAF8F5] text-[#B8862D] border border-[#C79A3B]/30">
                Accessible via main sidebar &ldquo;Store Transfers&rdquo;
              </span>
            </div>
          </div>
        )}

        {/* SECTION 10: REPORTS (BI-MONTHLY CLOSING IMPACT) */}
        {activeSection === 'reports' && (
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
                            <td className="p-3.5 font-mono text-gray-600">{Number(ci.theoretical_closing_qty || 0).toFixed(1)} {ci.unit_symbol}</td>
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

        {/* SECTION 11: SETUP (ITEMS, VENDORS, CATEGORIES & UNITS) */}
        {activeSection === 'setup' && (
          <div className="w-full min-w-0">
            <SetupWorkspace />
          </div>
        )}
      </PurchaseModuleLayout>

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

      {/* 4. Modal: Smart PO-Based Goods Receiving */}
      {createGRNModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-3xl w-full space-y-4 shadow-xl border border-[rgba(45,45,45,0.1)] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[rgba(45,45,45,0.08)]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-[#2E8B57]/15 flex items-center justify-center text-[#2E8B57]">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1C1C1C]">
                    PO-Based Direct Receiving & GRN
                  </h3>
                  <p className="text-[11px] text-[#707070]">
                    Automated receiving locked to approved PO line items & quantities.
                  </p>
                </div>
              </div>
              <button onClick={() => setCreateGRNModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step 1: Select or Display Linked PO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[#707070] font-bold mb-1">1. Select Approved Purchase Order:</label>
                <select
                  value={newGRNPOId}
                  onChange={(e) => handleSelectPOForGRN(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] rounded-xl font-bold font-mono text-[#1C1C1C]"
                >
                  <option value="">-- Choose Approved PO to Receive --</option>
                  {orders
                    .filter((o) => ['APPROVED', 'WHATSAPP_OPENED', 'SENT_MANUALLY', 'ISSUED', 'PARTIALLY_RECEIVED'].includes(o.status))
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.po_number} — {o.supplier_name || 'Vendor'} (${Number(o.net_amount || o.total_amount || 0).toFixed(2)})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[#707070] font-bold mb-1">Destination Outlet & Receiving Warehouse:</label>
                <div className="p-2.5 bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] rounded-xl font-semibold text-[#1C1C1C] flex items-center justify-between">
                  <span>
                    {outlets.find((o) => o.id === newGRNBranchId)?.name || activeOutlet.name}
                  </span>
                  <span className="text-[11px] text-[#707070] font-mono">Main Store Warehouse</span>
                </div>
              </div>
            </div>

            {/* PO Summary & Auto-Loaded Read-Only Items */}
            {newGRNPOId && (
              <div className="space-y-3">
                {/* PO Header details */}
                {(() => {
                  const currentPO = orders.find((o) => o.id === newGRNPOId);
                  const poTotalVal = currentPO ? Number(currentPO.net_amount || currentPO.total_amount || 0) : 0;
                  const hasVarianceVal = Math.abs(newGRNInvoiceAmt - poTotalVal) > 0.01;
                  const diffVal = newGRNInvoiceAmt - poTotalVal;
                  const diffPctVal = poTotalVal > 0 ? (diffVal / poTotalVal) * 100 : 0;

                  return (
                    <>
                      <div className="p-3 bg-[#FAF8F5] rounded-2xl border border-[rgba(45,45,45,0.08)] flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="text-[#707070] text-[11px]">Supplier / Vendor:</div>
                          <div className="font-bold text-[#1C1C1C]">{currentPO?.supplier_name || 'Direct Supplier'}</div>
                        </div>
                        <div>
                          <div className="text-[#707070] text-[11px]">PO Reference:</div>
                          <div className="font-mono font-bold text-[#B8862D]">{currentPO?.po_number}</div>
                        </div>
                        <div>
                          <div className="text-[#707070] text-[11px]">Approved PO Valuation:</div>
                          <div className="font-mono font-bold text-[#1C1C1C]">${poTotalVal.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-[#707070] text-[11px]">Status:</div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2E8B57]/15 text-[#2E8B57]">
                            {currentPO?.status}
                          </span>
                        </div>
                      </div>

                      {/* Locked Items Table */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[#1C1C1C] flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-[#707070]" />
                            PO Line Items (Locked from Approved PO — No Manual Entry):
                          </span>
                          <span className="text-[11px] text-[#707070] font-semibold">
                            {newGRNLines.length} item{newGRNLines.length !== 1 ? 's' : ''} to receive
                          </span>
                        </div>

                        <div className="border border-[rgba(45,45,45,0.1)] rounded-2xl overflow-hidden bg-white max-h-48 overflow-y-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="bg-[#FAF8F5] border-b border-[rgba(45,45,45,0.08)] text-[#707070] font-bold">
                                <th className="p-2.5">Item Name</th>
                                <th className="p-2.5 text-center">Unit</th>
                                <th className="p-2.5 text-right">Approved Qty</th>
                                <th className="p-2.5 text-right">Unit Rate</th>
                                <th className="p-2.5 text-right">Line Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[rgba(45,45,45,0.05)] font-medium">
                              {newGRNLines.map((line, idx) => (
                                <tr key={idx} className="hover:bg-[#FAF8F5]/50">
                                  <td className="p-2.5 font-bold text-[#1C1C1C]">{line.item_name}</td>
                                  <td className="p-2.5 text-center text-[#707070] font-mono">{line.unit_symbol}</td>
                                  <td className="p-2.5 text-right font-mono font-bold text-[#2E8B57]">
                                    {line.accepted_qty}
                                  </td>
                                  <td className="p-2.5 text-right font-mono text-[#707070]">
                                    ${Number(line.unit_price).toFixed(2)}
                                  </td>
                                  <td className="p-2.5 text-right font-mono font-bold text-[#1C1C1C]">
                                    ${(Number(line.accepted_qty) * Number(line.unit_price)).toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Step 2: Invoice Number & Invoice Amount */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                        <div>
                          <label className="block text-[#707070] font-bold mb-1">
                            2. Supplier Invoice / Bill Number <span className="text-red-500">*</span>:
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. INV-2026-9042"
                            value={newGRNInvoiceNum}
                            onChange={(e) => setNewGRNInvoiceNum(e.target.value)}
                            className="w-full p-2.5 bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] rounded-xl font-bold font-mono text-[#1C1C1C] focus:bg-white focus:outline-none"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-[#707070] font-bold mb-1">
                            3. Invoice Billed Amount ($):
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={newGRNInvoiceAmt}
                            onChange={(e) => setNewGRNInvoiceAmt(parseFloat(e.target.value) || 0)}
                            className="w-full p-2.5 bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] rounded-xl font-bold font-mono text-[#1C1C1C] focus:bg-white focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Variance Alert Banner */}
                      {hasVarianceVal && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs space-y-1">
                          <div className="font-bold text-amber-900 flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            Amount Variance Detected & Flagged for Approval:
                          </div>
                          <p className="text-amber-800 text-[11px]">
                            Approved PO is <strong>${poTotalVal.toFixed(2)}</strong> vs Invoice Amount{' '}
                            <strong>${newGRNInvoiceAmt.toFixed(2)}</strong> ({diffVal > 0 ? '+' : ''}${diffVal.toFixed(2)} /{' '}
                            {diffVal > 0 ? '+' : ''}{diffPctVal.toFixed(1)}%). This variance will be highlighted in the Central HO Approval Queue.
                          </p>
                        </div>
                      )}

                      {/* Step 3: Supplier Invoice Upload */}
                      <div className="space-y-1 text-xs">
                        <label className="block text-[#707070] font-bold">4. Upload Supplier Invoice Document / Photo (PDF, JPG, PNG):</label>
                        <div className="p-3 bg-[#FAF8F5] border border-dashed border-[rgba(45,45,45,0.2)] rounded-2xl flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <Upload className="w-5 h-5 text-[#707070]" />
                            {newGRNInvoiceFile ? (
                              <div>
                                <div className="font-bold text-[#1C1C1C]">{newGRNInvoiceFile.fileName}</div>
                                <div className="text-[10px] text-[#707070]">
                                  {(newGRNInvoiceFile.size / 1024).toFixed(1)} KB — Ready to attach
                                </div>
                              </div>
                            ) : (
                              <div className="text-[#707070]">Select invoice document from your device</div>
                            )}
                          </div>
                          <label className="cursor-pointer px-3 py-1.5 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] font-bold text-xs hover:bg-gray-50 shadow-2xs">
                            Choose File
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={handleInvoiceFileChange}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="block text-[#707070] font-bold mb-1 text-xs">Receiving & Inspection Notes (optional):</label>
                        <textarea
                          placeholder="Delivery package condition, batch numbers, driver notes..."
                          value={newGRNNotes}
                          onChange={(e) => setNewGRNNotes(e.target.value)}
                          rows={2}
                          className="w-full p-2.5 bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] rounded-xl text-xs focus:bg-white focus:outline-none"
                        />
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-[rgba(45,45,45,0.08)]">
              <div className="text-[11px] text-[#707070] flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#2E8B57]" />
                Stock posts directly to destination warehouse upon Central/HO Approval.
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCreateGRNModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[rgba(45,45,45,0.15)] text-xs font-semibold text-[#707070] hover:bg-[#FAF8F5]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateGRN}
                  disabled={loading || !newGRNPOId || !newGRNInvoiceNum.trim()}
                  className="px-5 py-2 rounded-xl bg-[#2E8B57] text-white text-xs font-bold hover:bg-[#257247] shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <PackageCheck className="w-4 h-4" />
                  {loading ? 'Submitting...' : 'Submit for HO Approval'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject GRN Reason Modal */}
      {rejectGRNModal.open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-xl border border-[rgba(45,45,45,0.1)]">
            <div className="flex items-center justify-between pb-2 border-b border-[rgba(45,45,45,0.08)]">
              <h3 className="text-sm font-bold text-red-600 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Reject Receiving: {rejectGRNModal.grnNumber}
              </h3>
              <button
                onClick={() => setRejectGRNModal({ open: false, grnId: '', grnNumber: '' })}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#707070]">
              Please state why this goods receipt is rejected (e.g. wrong items, damaged package, price discrepancy). No stock will be posted.
            </p>
            <textarea
              placeholder="Enter rejection reason..."
              value={grnRejectReason}
              onChange={(e) => setGrnRejectReason(e.target.value)}
              rows={3}
              className="w-full p-2.5 bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] rounded-xl text-xs focus:bg-white focus:outline-none"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectGRNModal({ open: false, grnId: '', grnNumber: '' })}
                className="px-4 py-2 rounded-xl border border-[rgba(45,45,45,0.15)] text-xs font-semibold text-[#707070] hover:bg-[#FAF8F5]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRejectGRN}
                disabled={loading || !grnRejectReason.trim()}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Rejecting...' : 'Confirm Rejection'}
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

      {/* 8. Modal: Smart Requirement Schedule Settings */}
      {smartConfigModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-xl border border-[rgba(45,45,45,0.1)]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1C1C1C] flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#C79A3B]" />
                Automated Schedule Config ({activeOutlet.name})
              </h3>
              <button onClick={() => setSmartConfigModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#707070] font-semibold mb-1">Daily Automated Preparation Time (HH:MM):</label>
                <input
                  type="time"
                  value={prepTime}
                  onChange={(e) => setPrepTime(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[#707070] font-semibold mb-1">Lead Time (Days):</label>
                <input
                  type="number"
                  min="1"
                  max="14"
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(parseInt(e.target.value) || 1)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[#707070] font-semibold mb-1">Safety Buffer (%):</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="5"
                  value={safetyBufferPct}
                  onChange={(e) => setSafetyBufferPct(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] rounded-xl font-mono font-bold"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="autoEnabledToggle"
                  checked={autoEnabled}
                  onChange={(e) => setAutoEnabled(e.target.checked)}
                  className="w-4 h-4 rounded text-[#B8862D] focus:ring-0"
                />
                <label htmlFor="autoEnabledToggle" className="font-semibold text-[#1C1C1C] cursor-pointer">
                  Enable Daily Automated Preparation
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[rgba(45,45,45,0.06)]">
              <button
                onClick={() => setSmartConfigModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[rgba(45,45,45,0.15)] text-xs font-semibold text-[#707070] hover:bg-[#FAF8F5]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveScheduleConfig}
                className="px-5 py-2 rounded-xl bg-[#B8862D] text-white text-xs font-bold hover:bg-[#9E7326]"
              >
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Modal: Add Item to Smart Requirement Draft */}
      {addItemDraftModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-xl border border-[rgba(45,45,45,0.1)]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1C1C1C] flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#C79A3B]" />
                Add Item to Smart Draft ({activeOutlet.name})
              </h3>
              <button onClick={() => setAddItemDraftModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#707070] font-semibold mb-1">Select Item from Catalog:</label>
                <select
                  value={addDraftItemId}
                  onChange={(e) => setAddDraftItemId(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] rounded-xl font-semibold"
                >
                  <option value="">-- Choose Item --</option>
                  {inventoryItems.map((itm) => (
                    <option key={itm.id} value={itm.id}>
                      {itm.name} ({itm.code}) - {itm.unit?.symbol || 'Units'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#707070] font-semibold mb-1">Order Quantity:</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={addDraftQty}
                  onChange={(e) => setAddDraftQty(parseFloat(e.target.value) || 1)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[#707070] font-semibold mb-1">Notes / Justification:</label>
                <input
                  type="text"
                  placeholder="e.g. Extra catering stock requested by chef"
                  value={addDraftNotes}
                  onChange={(e) => setAddDraftNotes(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] rounded-xl"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[rgba(45,45,45,0.06)]">
              <button
                onClick={() => setAddItemDraftModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[rgba(45,45,45,0.15)] text-xs font-semibold text-[#707070] hover:bg-[#FAF8F5]"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItemToDraft}
                disabled={!addDraftItemId || addDraftQty <= 0}
                className="px-5 py-2 rounded-xl bg-[#2E8B57] text-white text-xs font-bold hover:bg-[#257247] disabled:opacity-50"
              >
                Add Item to Draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseWorkspace;
