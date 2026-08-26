'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutlet } from '@/context/OutletContext';
import { procurementApi } from '@/api/procurement';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  Truck,
  PackageCheck,
  X,
  RefreshCw,
  Search,
  Check,
  AlertTriangle,
  Building2,
  Clock,
} from 'lucide-react';
import { StatCard, Badge, Button, EmptyState } from '@/components/ui';

export type ApprovalTab = 'ALL' | 'PR' | 'PO' | 'GRN';

export interface ApprovalsSectionProps {
  onActionCompleted?: () => void;
}

interface UnifiedApprovalItem {
  id: string;
  type: 'PR' | 'PO' | 'GRN';
  referenceNo: string;
  destination: string;
  supplier: string;
  value: number;
  status: string;
  createdAt?: string;
  raw: any;
}

const formatCurrency = (val?: number | null) => {
  if (val === null || val === undefined || isNaN(Number(val))) return '₹0.00';
  return `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const ApprovalsSection: React.FC<ApprovalsSectionProps> = ({ onActionCompleted }) => {
  const { activeOutlet, isHeadOffice, outlets } = useOutlet();

  const [activeTab, setActiveTab] = useState<ApprovalTab>('ALL');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Raw fetched lists
  const [pendingPRs, setPendingPRs] = useState<any[]>([]);
  const [pendingPOs, setPendingPOs] = useState<any[]>([]);
  const [pendingGRNs, setPendingGRNs] = useState<any[]>([]);

  // Action in flight
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [confirmingApproveId, setConfirmingApproveId] = useState<string | null>(null);

  // Rejection Modal
  const [rejectModal, setRejectModal] = useState<{
    open: boolean;
    item: UnifiedApprovalItem | null;
  }>({
    open: false,
    item: null,
  });
  const [rejectReason, setRejectReason] = useState<string>('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  const fetchApprovals = useCallback(async () => {
    try {
      const targetBranch = isHeadOffice ? undefined : activeOutlet.id;

      const [prRes, poRes, grnRes] = await Promise.all([
        procurementApi.getPurchaseRequests({ branch_id: targetBranch }).catch(() => []),
        procurementApi.getPurchaseOrders({ branch_id: targetBranch }).catch(() => []),
        procurementApi.getGoodsReceiveNotes({ branch_id: targetBranch }).catch(() => []),
      ]);

      // Filter Requisitions needing approval (PENDING_APPROVAL or DRAFT)
      const filteredPRs = (prRes || []).filter(
        (r: any) => r.status === 'PENDING_APPROVAL' || r.status === 'DRAFT' || r.status === 'SUBMITTED'
      );

      // Filter Purchase Orders needing approval (DRAFT, PENDING_APPROVAL, or SUBMITTED)
      const filteredPOs = (poRes || []).filter(
        (o: any) => o.status === 'DRAFT' || o.status === 'PENDING_APPROVAL' || o.status === 'SUBMITTED'
      );

      // Filter Goods Receive Notes needing approval (PENDING_APPROVAL or PENDING)
      const filteredGRNs = (grnRes || []).filter(
        (g: any) => g.status === 'PENDING_APPROVAL' || g.status === 'PENDING'
      );

      setPendingPRs(filteredPRs);
      setPendingPOs(filteredPOs);
      setPendingGRNs(filteredGRNs);
    } catch (err: any) {
      console.error('Failed to load pending approvals:', err);
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || err?.message || 'Failed to load approvals queue.',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeOutlet.id, isHeadOffice]);

  useEffect(() => {
    setLoading(true);
    fetchApprovals();
  }, [fetchApprovals]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchApprovals();
  };

  // Convert raw entities into a unified table format
  const unifiedItems: UnifiedApprovalItem[] = useMemo(() => {
    const items: UnifiedApprovalItem[] = [];

    // Map PRs
    pendingPRs.forEach((pr) => {
      const totalEst = (pr.items || []).reduce(
        (acc: number, it: any) => acc + Number(it.requested_qty || 0) * Number(it.estimated_price || 0),
        0
      );
      items.push({
        id: pr.id,
        type: 'PR',
        referenceNo: pr.request_number || 'PR-DRAFT',
        destination: pr.branch_name || pr.branch?.name || activeOutlet.name,
        supplier: '—',
        value: totalEst,
        status: pr.status || 'PENDING_APPROVAL',
        createdAt: pr.created_at || pr.required_date,
        raw: pr,
      });
    });

    // Map POs
    pendingPOs.forEach((po) => {
      const totalVal = Number(po.net_amount ?? po.total_amount ?? 0);
      items.push({
        id: po.id,
        type: 'PO',
        referenceNo: po.po_number || 'PO-DRAFT',
        destination: po.branch_name || po.branch?.name || (outlets.find((o) => o.id === po.branch_id)?.name) || activeOutlet.name,
        supplier: po.supplier_name || po.supplier?.name || 'Direct Supplier',
        value: totalVal,
        status: po.status || 'DRAFT',
        createdAt: po.created_at || po.order_date,
        raw: po,
      });
    });

    // Map GRNs
    pendingGRNs.forEach((grn) => {
      const totalVal = Number(grn.total_amount ?? grn.invoice_amount ?? 0);
      items.push({
        id: grn.id,
        type: 'GRN',
        referenceNo: grn.grn_number || 'GRN-PENDING',
        destination: grn.branch_name || grn.branch?.name || (outlets.find((o) => o.id === grn.branch_id)?.name) || activeOutlet.name,
        supplier: grn.supplier_name || grn.supplier?.name || 'Direct Supplier',
        value: totalVal,
        status: grn.status || 'PENDING_APPROVAL',
        createdAt: grn.created_at || grn.receive_date,
        raw: grn,
      });
    });

    // Sort newest first
    return items.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [pendingPRs, pendingPOs, pendingGRNs, activeOutlet.name, outlets]);

  // Tab & search filtering
  const filteredItems = useMemo(() => {
    return unifiedItems.filter((item) => {
      const matchesTab = activeTab === 'ALL' || item.type === activeTab;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.referenceNo.toLowerCase().includes(q) ||
        item.destination.toLowerCase().includes(q) ||
        item.supplier.toLowerCase().includes(q) ||
        item.status.toLowerCase().includes(q);

      return matchesTab && matchesSearch;
    });
  }, [unifiedItems, activeTab, searchQuery]);

  // Execute Approval with Optimistic Update
  const handleApprove = async (item: UnifiedApprovalItem) => {
    setActionLoadingId(item.id);
    setConfirmingApproveId(null);
    setFeedback(null);

    // Optimistic Update: Immediately remove item from state
    if (item.type === 'PR') {
      setPendingPRs((prev) => prev.filter((p) => p.id !== item.id));
    } else if (item.type === 'PO') {
      setPendingPOs((prev) => prev.filter((p) => p.id !== item.id));
    } else if (item.type === 'GRN') {
      setPendingGRNs((prev) => prev.filter((p) => p.id !== item.id));
    }

    try {
      if (item.type === 'PR') {
        await procurementApi.approvePurchaseRequest(item.id);
        setFeedback({
          type: 'success',
          message: `Requisition ${item.referenceNo} approved successfully.`,
        });
      } else if (item.type === 'PO') {
        await procurementApi.approveOrder(item.id);
        setFeedback({
          type: 'success',
          message: `Purchase Order ${item.referenceNo} approved successfully. Ready for Receiving (GRN).`,
        });
      } else if (item.type === 'GRN') {
        await procurementApi.approveGoodsReceiveNote(item.id);
        setFeedback({
          type: 'success',
          message: `Goods Receipt ${item.referenceNo} approved! Stock balances updated.`,
        });
      }
      onActionCompleted?.();
    } catch (err: any) {
      console.error('Approval failed:', err);
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Approval action failed.',
      });
      // Revert / re-sync on failure
      fetchApprovals();
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open Rejection Dialog
  const handleOpenRejectModal = (item: UnifiedApprovalItem) => {
    setConfirmingApproveId(null);
    setRejectReason('');
    setRejectError(null);
    setRejectModal({ open: true, item });
  };

  // Confirm Rejection with Optimistic Update
  const handleConfirmReject = async () => {
    if (!rejectModal.item) return;
    const item = rejectModal.item;
    const reasonText = rejectReason.trim();

    if (!reasonText) {
      setRejectError('Please enter a mandatory rejection reason.');
      return;
    }

    setActionLoadingId(item.id);
    setRejectModal({ open: false, item: null });
    setFeedback(null);

    // Optimistic Update: Immediately remove item from list
    if (item.type === 'PR') {
      setPendingPRs((prev) => prev.filter((p) => p.id !== item.id));
    } else if (item.type === 'PO') {
      setPendingPOs((prev) => prev.filter((p) => p.id !== item.id));
    } else if (item.type === 'GRN') {
      setPendingGRNs((prev) => prev.filter((p) => p.id !== item.id));
    }

    try {
      if (item.type === 'PR') {
        await procurementApi.rejectPurchaseRequest(item.id, { reason: reasonText });
        setFeedback({
          type: 'success',
          message: `Requisition ${item.referenceNo} rejected.`,
        });
      } else if (item.type === 'PO') {
        await procurementApi.rejectOrder(item.id, { reason: reasonText });
        setFeedback({
          type: 'success',
          message: `Purchase Order ${item.referenceNo} rejected.`,
        });
      } else if (item.type === 'GRN') {
        await procurementApi.rejectGoodsReceiveNote(item.id, { reason: reasonText });
        setFeedback({
          type: 'success',
          message: `Goods Receipt ${item.referenceNo} rejected.`,
        });
      }
      onActionCompleted?.();
    } catch (err: any) {
      console.error('Rejection failed:', err);
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Rejection action failed.',
      });
      // Revert / re-sync on failure
      fetchApprovals();
    } finally {
      setActionLoadingId(null);
      setRejectReason('');
      setRejectError(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 w-full min-w-0">
      {/* 1. Header Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#C79A3B]" />
              Central Purchase &amp; Receiving Approvals Queue
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F1E4C5] text-[#B8862D] border border-[#B8862D]/30">
              {unifiedItems.length} Total Pending
            </span>
          </div>
          <p className="text-xs text-[#707070] mt-0.5">
            Head Office central authorization for requisitions, draft purchase orders, and destination GRN receipts.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleRefresh}
          loading={refreshing}
          icon={<RefreshCw className="w-3.5 h-3.5 text-[#B8862D]" />}
          className="self-start sm:self-auto"
        >
          Refresh Queue
        </Button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-[#2E8B57]/10 text-[#2E8B57] border-[#2E8B57]/20'
              : 'bg-red-500/10 text-red-600 border-red-500/20'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#2E8B57]" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Three Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div
          onClick={() => setActiveTab('PR')}
          className={`cursor-pointer transition-all ${
            activeTab === 'PR' ? 'ring-2 ring-[#C79A3B] rounded-2xl' : ''
          }`}
        >
          <StatCard
            title="Pending Requisitions (PR)"
            value={pendingPRs.length}
            subtitle={pendingPRs.length > 0 ? 'Indents awaiting PO issuance' : 'All requisitions processed'}
            icon={<FileText className="w-4 h-4 text-[#3978B8]" />}
            iconBgColor="bg-blue-50 text-[#3978B8]"
          />
        </div>

        <div
          onClick={() => setActiveTab('PO')}
          className={`cursor-pointer transition-all ${
            activeTab === 'PO' ? 'ring-2 ring-[#C79A3B] rounded-2xl' : ''
          }`}
        >
          <StatCard
            title="Pending Purchase Orders"
            value={pendingPOs.length}
            subtitle={pendingPOs.length > 0 ? 'Draft / POs awaiting approval' : 'All orders issued & approved'}
            icon={<Truck className="w-4 h-4 text-[#B8862D]" />}
            iconBgColor="bg-[#F1E4C5]/40 text-[#B8862D]"
          />
        </div>

        <div
          onClick={() => setActiveTab('GRN')}
          className={`cursor-pointer transition-all ${
            activeTab === 'GRN' ? 'ring-2 ring-[#C79A3B] rounded-2xl' : ''
          }`}
        >
          <StatCard
            title="Pending GRN Receiving"
            value={pendingGRNs.length}
            subtitle={pendingGRNs.length > 0 ? 'Deliveries awaiting stock posting' : 'All receipts verified'}
            icon={<PackageCheck className="w-4 h-4 text-[#2E8B57]" />}
            iconBgColor="bg-[#2E8B57]/10 text-[#2E8B57]"
          />
        </div>
      </div>

      {/* 3. Sub-Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-[rgba(45,45,45,0.08)] shadow-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'ALL'
                ? 'bg-[#F1E4C5] text-[#B8862D] border border-[#B8862D]/30 shadow-xs'
                : 'text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5]'
            }`}
          >
            All Pending ({unifiedItems.length})
          </button>
          <button
            onClick={() => setActiveTab('PR')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'PR'
                ? 'bg-[#F1E4C5] text-[#B8862D] border border-[#B8862D]/30 shadow-xs'
                : 'text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5]'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-[#3978B8]" />
            Requisitions ({pendingPRs.length})
          </button>
          <button
            onClick={() => setActiveTab('PO')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'PO'
                ? 'bg-[#F1E4C5] text-[#B8862D] border border-[#B8862D]/30 shadow-xs'
                : 'text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5]'
            }`}
          >
            <Truck className="w-3.5 h-3.5 text-[#B8862D]" />
            Purchase Orders ({pendingPOs.length})
          </button>
          <button
            onClick={() => setActiveTab('GRN')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'GRN'
                ? 'bg-[#F1E4C5] text-[#B8862D] border border-[#B8862D]/30 shadow-xs'
                : 'text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5]'
            }`}
          >
            <PackageCheck className="w-3.5 h-3.5 text-[#2E8B57]" />
            GRN Receiving ({pendingGRNs.length})
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative min-w-[220px] sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]" />
          <input
            type="text"
            placeholder="Search ref #, supplier, outlet..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-white border border-[rgba(45,45,45,0.12)] focus:outline-none focus:border-[#C79A3B] text-[#1C1C1C] shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* 4. Approvals Table */}
      <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#FAF8F5] border-b border-[rgba(45,45,45,0.08)] text-[#707070] uppercase font-bold text-[10px] tracking-wider">
                <th className="py-3 px-4 w-20">TYPE</th>
                <th className="py-3 px-4">REFERENCE NO.</th>
                <th className="py-3 px-4">BRANCH / DESTINATION</th>
                <th className="py-3 px-4">SUPPLIER</th>
                <th className="py-3 px-4">VALUE</th>
                <th className="py-3 px-4">STATUS</th>
                <th className="py-3 px-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
              {loading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3.5 px-4">
                      <div className="h-5 w-12 bg-gray-200 rounded-full" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-28 bg-gray-200 rounded" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-28 bg-gray-200 rounded" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-24 bg-gray-200 rounded" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-16 bg-gray-200 rounded" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-5 w-20 bg-gray-200 rounded-full" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="h-7 w-28 bg-gray-200 rounded-xl ml-auto" />
                    </td>
                  </tr>
                ))
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#707070]">
                    <div className="max-w-xs mx-auto space-y-2">
                      <CheckCircle2 className="w-8 h-8 text-[#2E8B57] mx-auto opacity-70" />
                      <p className="font-bold text-[#1C1C1C] text-sm font-['Outfit']">
                        Nothing pending here — you&apos;re all caught up.
                      </p>
                      <p className="text-[11px] text-[#707070]">
                        {searchQuery
                          ? 'No items match your active search query.'
                          : 'No requisitions, orders, or delivery receipts requiring authorization in this view.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isActionLoading = actionLoadingId === item.id;
                  const isConfirming = confirmingApproveId === item.id;

                  return (
                    <tr key={`${item.type}-${item.id}`} className="hover:bg-[#FAF8F5]/60 transition-colors">
                      {/* TYPE BADGE */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            item.type === 'PR'
                              ? 'bg-[#3978B8]/10 text-[#3978B8] border border-[#3978B8]/25'
                              : item.type === 'PO'
                              ? 'bg-[#F1E4C5] text-[#B8862D] border border-[#B8862D]/35'
                              : 'bg-[#2E8B57]/10 text-[#2E8B57] border border-[#2E8B57]/25'
                          }`}
                        >
                          {item.type}
                        </span>
                      </td>

                      {/* REFERENCE NO. */}
                      <td className="py-3.5 px-4 font-mono font-bold text-[#1C1C1C]">
                        {item.referenceNo}
                      </td>

                      {/* BRANCH / DESTINATION */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#1C1C1C]">{item.destination}</div>
                      </td>

                      {/* SUPPLIER */}
                      <td className="py-3.5 px-4">
                        <div className="text-[#505050] font-medium">{item.supplier}</div>
                      </td>

                      {/* VALUE */}
                      <td className="py-3.5 px-4 font-mono font-bold text-[#1C1C1C]">
                        {formatCurrency(item.value)}
                      </td>

                      {/* STATUS */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.status === 'PENDING_APPROVAL' || item.status === 'SUBMITTED'
                              ? 'bg-[#F1E4C5] text-[#B8862D] border border-[#B8862D]/30'
                              : item.status === 'DRAFT'
                              ? 'bg-gray-100 text-gray-700 border border-gray-200'
                              : 'bg-[#2E8B57]/10 text-[#2E8B57] border border-[#2E8B57]/30'
                          }`}
                        >
                          {item.status.replace('_', ' ')}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isConfirming ? (
                            <div className="flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-xl border border-[rgba(45,45,45,0.12)]">
                              <button
                                onClick={() => handleApprove(item)}
                                disabled={isActionLoading}
                                className="px-2.5 py-1 rounded-lg bg-[#2E8B57] hover:bg-[#257247] text-white text-[11px] font-bold shadow-xs active:scale-95 transition-all"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmingApproveId(null)}
                                className="px-2 py-1 rounded-lg text-gray-500 hover:text-gray-800 text-[11px] font-semibold"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => setConfirmingApproveId(item.id)}
                                disabled={isActionLoading}
                                className="px-3 py-1.5 rounded-xl bg-[#2E8B57] hover:bg-[#257247] text-white text-xs font-bold shadow-xs flex items-center gap-1 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                                title={`Approve ${item.type} ${item.referenceNo}`}
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>

                              <button
                                onClick={() => handleOpenRejectModal(item)}
                                disabled={isActionLoading}
                                className="px-3 py-1.5 rounded-xl border border-red-300 text-red-600 hover:bg-red-50 text-xs font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                                title={`Reject ${item.type} ${item.referenceNo}`}
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Rejection Modal with Mandatory Reason */}
      {rejectModal.open && rejectModal.item && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-2xl border border-[rgba(45,45,45,0.12)] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[rgba(45,45,45,0.08)]">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-sm sm:text-base font-bold text-[#1C1C1C] font-['Outfit']">
                  Reject {rejectModal.item.type}: {rejectModal.item.referenceNo}
                </h3>
              </div>
              <button
                onClick={() => setRejectModal({ open: false, item: null })}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] text-xs space-y-1 text-[#707070]">
              <div className="flex justify-between">
                <span>Destination:</span>
                <strong className="text-[#1C1C1C]">{rejectModal.item.destination}</strong>
              </div>
              <div className="flex justify-between">
                <span>Value:</span>
                <strong className="text-[#1C1C1C] font-mono">{formatCurrency(rejectModal.item.value)}</strong>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="block text-[#1C1C1C] font-bold">
                Mandatory Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={rejectReason}
                onChange={(e) => {
                  setRejectReason(e.target.value);
                  if (rejectError) setRejectError(null);
                }}
                placeholder="e.g. Budget ceiling exceeded / duplicate order / rate discrepancy..."
                className="w-full p-2.5 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-red-500 focus:outline-none text-xs text-[#1C1C1C] placeholder:text-[#A0A0A0]"
              />
              {rejectError && (
                <p className="text-[11px] text-red-600 font-semibold">{rejectError}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[rgba(45,45,45,0.06)]">
              <button
                onClick={() => setRejectModal({ open: false, item: null })}
                className="px-4 py-2 rounded-xl border border-[rgba(45,45,45,0.15)] text-xs font-semibold text-[#707070] hover:bg-[#FAF8F5]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={actionLoadingId === rejectModal.item.id || !rejectReason.trim()}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
              >
                {actionLoadingId === rejectModal.item.id ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalsSection;
