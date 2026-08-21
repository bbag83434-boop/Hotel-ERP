'use client';

import React, { useState, useEffect } from 'react';
import { useOutlet } from '@/context/OutletContext';
import { wastageApi } from '@/api/wastage';
import { inventoryApi } from '@/api/inventory';
import {
  AlertTriangle,
  Trash2,
  CheckCircle2,
  Search,
  ShieldCheck,
  Plus,
  RefreshCw,
  Clock,
  DollarSign,
  TrendingDown,
  XCircle,
  Eye,
  Check,
  X,
  Layers,
  BarChart3,
  Flame,
  AlertCircle,
  FileText,
} from 'lucide-react';
import {
  WastageEntry,
  WastageAnalytics,
  WastageReason,
  WastageReasonCode,
  WastageItemInput,
} from '@/types/wastage.types';
import { Item, Warehouse } from '@/types/inventory.types';
import { Badge, Button, StatCard, SearchInput, AlertBanner, EmptyState, Modal } from '@/components/ui';

export const WastageWorkspace: React.FC = () => {
  const { activeOutlet } = useOutlet();
  const [activeTab, setActiveTab] = useState<'entries' | 'log_new' | 'analytics'>('entries');
  const [entries, setEntries] = useState<WastageEntry[]>([]);
  const [analytics, setAnalytics] = useState<WastageAnalytics | null>(null);
  const [reasons, setReasons] = useState<WastageReason[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Log New Form State
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [entryNotes, setEntryNotes] = useState<string>('');
  const [formItems, setFormItems] = useState<WastageItemInput[]>([
    { item_id: '', quantity: 1, reason_code: 'EXPIRED', notes: '' },
  ]);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Selected Entry for Detail / Rejection Modal
  const [selectedEntry, setSelectedEntry] = useState<WastageEntry | null>(null);
  const [rejectionModalOpen, setRejectionModalOpen] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  const fetchData = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const [entriesRes, analyticsRes, reasonsRes, whRes, itemsRes] = await Promise.all([
        wastageApi.getEntries({ branch_id: activeOutlet.id }).catch(() => []),
        wastageApi.getAnalytics({ branch_id: activeOutlet.id }).catch(() => null),
        wastageApi.getReasons().catch(() => []),
        inventoryApi.getWarehouses({ branch_id: activeOutlet.id }).catch(() => []),
        inventoryApi.getItems().catch(() => []),
      ]);

      setEntries(Array.isArray(entriesRes) ? entriesRes : []);
      setAnalytics(analyticsRes);
      setReasons(reasonsRes);
      setWarehouses(Array.isArray(whRes) ? whRes : []);
      setItems(Array.isArray(itemsRes) ? itemsRes : []);

      if (whRes.length > 0 && !selectedWarehouseId) {
        setSelectedWarehouseId(whRes[0].id);
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || err?.message || 'Failed to load wastage records',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeOutlet.id]);

  // Add Item row to form
  const handleAddItemRow = () => {
    setFormItems([
      ...formItems,
      { item_id: '', quantity: 1, reason_code: 'EXPIRED', notes: '' },
    ]);
  };

  // Remove Item row
  const handleRemoveItemRow = (idx: number) => {
    if (formItems.length === 1) return;
    setFormItems(formItems.filter((_, i) => i !== idx));
  };

  // Update item row
  const handleItemChange = (idx: number, field: keyof WastageItemInput, value: any) => {
    const updated = [...formItems];
    updated[idx] = { ...updated[idx], [field]: value };

    if (field === 'item_id') {
      const selectedItem = items.find((itm) => itm.id === value);
      if (selectedItem) {
        updated[idx].unit_cost = Number((selectedItem as any).cost_price || (selectedItem as any).costPrice || 0);
      }
    }
    setFormItems(updated);
  };

  // Calculate live total cost for new entry
  const calculatedTotalCost = formItems.reduce((sum, fi) => {
    const itm = items.find((i) => i.id === fi.item_id);
    const cost = fi.unit_cost !== undefined ? fi.unit_cost : Number((itm as any)?.cost_price || (itm as any)?.costPrice || 0);
    return sum + (fi.quantity || 0) * cost;
  }, 0);

  // Submit new wastage entry
  const handleCreateEntry = async (autoSubmit: boolean) => {
    if (!selectedWarehouseId) {
      setFeedback({ type: 'error', message: 'Please select a storage warehouse.' });
      return;
    }
    const validItems = formItems.filter((fi) => fi.item_id && fi.quantity > 0);
    if (validItems.length === 0) {
      setFeedback({ type: 'error', message: 'Please add at least one valid item with quantity > 0.' });
      return;
    }

    setSubmitting(true);
    try {
      const created = await wastageApi.createEntry({
        branch_id: activeOutlet.id,
        warehouse_id: selectedWarehouseId,
        notes: entryNotes,
        items: validItems,
        auto_submit: autoSubmit,
      });
      setFeedback({
        type: 'success',
        message: `Wastage Entry #${created.entry_number} logged successfully!`,
      });
      setFormItems([{ item_id: '', quantity: 1, reason_code: 'EXPIRED', notes: '' }]);
      setEntryNotes('');
      setActiveTab('entries');
      fetchData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || err.message || 'Failed to log wastage entry',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Approve Entry
  const handleApprove = async (id: string) => {
    try {
      await wastageApi.approveEntry(id);
      setFeedback({
        type: 'success',
        message: 'Wastage record approved and inventory balances updated!',
      });
      fetchData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || err.message || 'Failed to approve wastage',
      });
    }
  };

  // Reject Entry
  const handleRejectConfirm = async () => {
    if (!selectedEntry || !rejectionReason.trim()) {
      setFeedback({ type: 'error', message: 'Rejection reason is required.' });
      return;
    }
    try {
      await wastageApi.rejectEntry(selectedEntry.id, { rejection_reason: rejectionReason });
      setFeedback({
        type: 'success',
        message: `Wastage #${selectedEntry.entry_number} rejected.`,
      });
      setRejectionModalOpen(false);
      setSelectedEntry(null);
      setRejectionReason('');
      fetchData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || err.message || 'Failed to reject wastage',
      });
    }
  };

  const filteredEntries = entries.filter((e) => {
    const matchesSearch =
      (e.entry_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.notes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.warehouse_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = entries.filter((e) => e.status === 'PENDING_APPROVAL').length;
  const approvedTotalCost = entries
    .filter((e) => e.status === 'APPROVED')
    .reduce((sum, e) => sum + Number(e.total_cost || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#D9534F]" />
              Wastage & Food Loss Management
            </h2>
            <Badge variant="outlet">[{activeOutlet.code}]</Badge>
          </div>
          <p className="text-xs text-[#707070] mt-0.5">
            Log, authorize, and audit kitchen spoilage, prep loss, and inventory write-offs with reason codes and FIFO deduction.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="danger"
            size="sm"
            onClick={() => setActiveTab('log_new')}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Log Wastage
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={fetchData}
            loading={loading}
            icon={<RefreshCw className="w-3.5 h-3.5 text-[#C79A3B]" />}
          >
            Sync Data
          </Button>
        </div>
      </div>

      {/* Feedback Banner */}
      <AlertBanner feedback={feedback} onClose={() => setFeedback(null)} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Approved Loss"
          value={`$${approvedTotalCost.toFixed(2)}`}
          subtitle="Total written-off valuation"
          icon={<DollarSign className="w-4 h-4 text-[#D9534F]" />}
          iconBgColor="bg-red-50 text-[#D9534F]"
        />

        <StatCard
          title="Pending Approval"
          value={pendingCount}
          subtitle="Requiring Manager Review"
          icon={<Clock className="w-4 h-4 text-[#D99625]" />}
          iconBgColor="bg-amber-50 text-[#D99625]"
        />

        <StatCard
          title="Total Logged"
          value={entries.length}
          subtitle="Audit records logged"
          icon={<FileText className="w-4 h-4 text-[#C79A3B]" />}
          iconBgColor="bg-[#FAF8F5] text-[#C79A3B]"
        />

        <StatCard
          title="HO Threshold"
          value="$1,000.00"
          subtitle="Auto-triggers HO approval"
          icon={<ShieldCheck className="w-4 h-4 text-[#2E8B57]" />}
          iconBgColor="bg-[#2E8B57]/10 text-[#2E8B57]"
        />
      </div>

      {/* Abnormal Spoilage Alert Banner */}
      {analytics && analytics.abnormal_alerts && analytics.abnormal_alerts.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-800">
            <Flame className="w-4 h-4 text-amber-600" />
            <span>Abnormal Spoilage / Wastage Surge Detected</span>
          </div>
          {analytics.abnormal_alerts.map((al, idx) => (
            <div key={idx} className="text-[11px] flex items-center justify-between">
              <span>
                <strong>{al.branch_name}:</strong> Recorded ${al.current_cost.toFixed(2)} (+{al.surge_percentage}% above baseline)
              </span>
              <span className="text-amber-700 italic">{al.reason}</span>
            </div>
          ))}
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-white border border-[rgba(45,45,45,0.08)] rounded-2xl shadow-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('entries')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'entries'
              ? 'bg-[#F1E4C5] text-[#B8862D] shadow-xs'
              : 'text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5]'
          }`}
        >
          <Trash2 className="w-4 h-4" />
          <span>Wastage Audit Log</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[rgba(45,45,45,0.08)] text-[#1C1C1C]">
            {entries.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('log_new')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'log_new'
              ? 'bg-[#F1E4C5] text-[#B8862D] shadow-xs'
              : 'text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5]'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Log New Wastage</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'analytics'
              ? 'bg-[#F1E4C5] text-[#B8862D] shadow-xs'
              : 'text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5]'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Loss Analytics & Insights</span>
        </button>
      </div>

      {/* Tab 1: Entries & Authorizations */}
      {activeTab === 'entries' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {['ALL', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'DRAFT'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                    statusFilter === st
                      ? 'bg-[#1C1C1C] text-white shadow-xs'
                      : 'bg-white border border-[rgba(45,45,45,0.1)] text-[#707070] hover:bg-[#FAF8F5]'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Search */}
            <SearchInput
              value={searchQuery}
              onChangeValue={setSearchQuery}
              placeholder="Search wastage # or notes..."
              className="w-full sm:w-72"
            />
          </div>

          {loading ? (
            <div className="p-12 text-center text-[#707070] text-xs flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#C79A3B]" />
              <span>Loading wastage ledger...</span>
            </div>
          ) : filteredEntries.length === 0 ? (
            <EmptyState
              title="No Wastage Records Found"
              description="Log spoilage, prep discard, or QC defect items to track loss and deduct stock."
              icon={<Trash2 className="w-6 h-6 text-[#D9534F]" />}
              action={
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setActiveTab('log_new')}
                  icon={<Plus className="w-3.5 h-3.5" />}
                >
                  Log First Record
                </Button>
              }
            />
          ) : (
            <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] text-[#707070] font-bold border-b border-[rgba(45,45,45,0.08)]">
                    <tr>
                      <th className="p-3.5">Entry #</th>
                      <th className="p-3.5">Date</th>
                      <th className="p-3.5">Storage Warehouse</th>
                      <th className="p-3.5">Items</th>
                      <th className="p-3.5 text-right">Total Valuation</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Reported By</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
                    {filteredEntries.map((e) => (
                      <React.Fragment key={e.id}>
                        <tr className="hover:bg-[#FAF8F5]/50 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-[#1C1C1C]">
                            {e.entry_number}
                          </td>
                          <td className="p-3.5 text-[#707070]">
                            {new Date(e.entry_date).toLocaleDateString()}
                          </td>
                          <td className="p-3.5 font-medium text-[#1C1C1C]">
                            {e.warehouse_name || 'Kitchen Warehouse'}
                          </td>
                          <td className="p-3.5 font-semibold text-[#1C1C1C]">
                            {e.total_items_count} items
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold text-[#D9534F]">
                            ${Number(e.total_cost).toFixed(2)}
                          </td>
                          <td className="p-3.5">
                            <Badge
                              variant={
                                e.status === 'APPROVED'
                                  ? 'success'
                                  : e.status === 'PENDING_APPROVAL'
                                  ? 'warning'
                                  : e.status === 'REJECTED'
                                  ? 'danger'
                                  : 'neutral'
                              }
                            >
                              {e.status.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="p-3.5 text-[#707070]">
                            {e.reported_by_name || 'Staff'}
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {e.status === 'PENDING_APPROVAL' && (
                                <>
                                  <button
                                    onClick={() => handleApprove(e.id)}
                                    title="Authorize Wastage & Deduct Stock"
                                    className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 transition-all active:scale-95"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedEntry(e);
                                      setRejectionModalOpen(true);
                                    }}
                                    title="Reject Wastage Record"
                                    className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-all active:scale-95"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                              {e.status === 'DRAFT' && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={async () => {
                                    await wastageApi.submitEntry(e.id);
                                    fetchData();
                                  }}
                                >
                                  Submit
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expand items */}
                        {e.items && e.items.length > 0 && (
                          <tr className="bg-[#FAF8F5]/30">
                            <td colSpan={8} className="p-2.5 px-6">
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-[#707070] block uppercase tracking-wider">
                                  Item Breakdown:
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                  {e.items.map((itm) => (
                                    <div
                                      key={itm.id}
                                      className="p-2.5 rounded-xl bg-white border border-[rgba(45,45,45,0.06)] text-[11px] flex items-center justify-between"
                                    >
                                      <div>
                                        <span className="font-bold text-[#1C1C1C] block">
                                          {itm.item_name}
                                        </span>
                                        <span className="text-[10px] text-[#707070]">
                                          Reason: {itm.reason_code}
                                        </span>
                                      </div>
                                      <div className="text-right font-mono">
                                        <span className="font-bold text-[#1C1C1C] block">
                                          {Number(itm.quantity).toFixed(2)} {itm.unit_symbol}
                                        </span>
                                        <span className="text-[10px] text-[#D9534F] font-semibold">
                                          ${Number(itm.total_cost).toFixed(2)}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Log New Wastage Form */}
      {activeTab === 'log_new' && (
        <div className="p-6 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-5">
          <div>
            <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#D9534F]" />
              Record Kitchen / Storage Wastage
            </h3>
            <p className="text-xs text-[#707070] mt-0.5">
              Specify wasted ingredients or finished items with mandatory reason codes. Entries over $1,000 require manager approval.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider mb-1 block">
                Storage / Kitchen Warehouse *
              </label>
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] focus:outline-none focus:border-[#C79A3B]"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider mb-1 block">
                General Audit Notes
              </label>
              <input
                type="text"
                placeholder="e.g. End of shift inspection / cooler breakdown..."
                value={entryNotes}
                onChange={(e) => setEntryNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] focus:outline-none focus:border-[#C79A3B]"
              />
            </div>
          </div>

          {/* Dynamic Item Repeater */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1C1C1C] font-['Outfit']">
                Wasted Items List ({formItems.length})
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleAddItemRow}
                icon={<Plus className="w-3.5 h-3.5 text-[#C79A3B]" />}
              >
                Add Item
              </Button>
            </div>

            <div className="space-y-2.5">
              {formItems.map((fi, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
                >
                  <div className="sm:col-span-4">
                    <label className="text-[11px] font-semibold text-[#707070] block mb-1">
                      Select Item *
                    </label>
                    <select
                      value={fi.item_id}
                      onChange={(e) => handleItemChange(idx, 'item_id', e.target.value)}
                      className="w-full p-2 text-xs rounded-lg bg-white border border-[rgba(45,45,45,0.12)] focus:outline-none focus:border-[#C79A3B]"
                    >
                      <option value="">-- Choose Item --</option>
                      {items.map((itm) => (
                        <option key={itm.id} value={itm.id}>
                          {itm.name} ({itm.code}) - ${Number((itm as any).cost_price || (itm as any).costPrice || 0).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-semibold text-[#707070] block mb-1">
                      Wasted Qty *
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={fi.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', Number(e.target.value))}
                      className="w-full p-2 text-xs rounded-lg bg-white border border-[rgba(45,45,45,0.12)] focus:outline-none focus:border-[#C79A3B]"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="text-[11px] font-semibold text-[#707070] block mb-1">
                      Reason Code
                    </label>
                    <select
                      value={fi.reason_code}
                      onChange={(e) => handleItemChange(idx, 'reason_code', e.target.value)}
                      className="w-full p-2 text-xs rounded-lg bg-white border border-[rgba(45,45,45,0.12)] focus:outline-none focus:border-[#C79A3B]"
                    >
                      {reasons.length > 0 ? (
                        reasons.map((r) => (
                          <option key={r.code} value={r.code}>
                            {r.label}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="EXPIRED">Expired / Spoilage</option>
                          <option value="PREPARATION_LOSS">Kitchen Prep Discard</option>
                          <option value="BURNT_DROPPED">Burnt / Dropped</option>
                          <option value="QUALITY_ISSUE">QC Defect / Rotten</option>
                          <option value="STORAGE_FAILURE">Storage Breakdown</option>
                          <option value="CUSTOMER_RETURN">Customer Return</option>
                          <option value="OTHER">Other General Loss</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-semibold text-[#707070] block mb-1">
                      Batch / Note
                    </label>
                    <input
                      type="text"
                      placeholder="Optional notes"
                      value={fi.notes || ''}
                      onChange={(e) => handleItemChange(idx, 'notes', e.target.value)}
                      className="w-full p-2 text-xs rounded-lg bg-white border border-[rgba(45,45,45,0.12)] focus:outline-none focus:border-[#C79A3B]"
                    />
                  </div>

                  <div className="sm:col-span-1 flex justify-center pb-1">
                    <button
                      onClick={() => handleRemoveItemRow(idx)}
                      disabled={formItems.length === 1}
                      className="p-1.5 rounded-lg text-[#707070] hover:text-red-600 disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Running Valuation & Action Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)]">
            <div>
              <span className="text-xs text-[#707070] block">Estimated Total Loss Valuation</span>
              <span className="text-xl font-bold text-[#D9534F] font-['Outfit']">
                ${calculatedTotalCost.toFixed(2)}
              </span>
              {calculatedTotalCost >= 1000 && (
                <span className="text-[10px] text-amber-700 font-semibold block mt-0.5">
                  ⚠ Exceeds $1,000 threshold — will require Manager Approval
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() => handleCreateEntry(false)}
                disabled={submitting}
              >
                Save as Draft
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={() => handleCreateEntry(true)}
                disabled={submitting}
                loading={submitting}
                icon={<Check className="w-3.5 h-3.5" />}
              >
                {submitting ? 'Logging...' : 'Submit Wastage'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Loss Analytics & Outlet Comparison */}
      {activeTab === 'analytics' && analytics && (
        <div className="space-y-5">
          {/* Reason Breakdown */}
          <div className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-[#D9534F]" />
              Loss Breakdown by Reason Code (Past 30 Days)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(analytics.by_reason || {}).map(([rCode, val]) => (
                <div
                  key={rCode}
                  className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#1C1C1C]">{rCode.replace('_', ' ')}</span>
                    <span className="text-xs font-bold text-[#D9534F]">{val.percentage}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#D9534F] rounded-full"
                      style={{ width: `${Math.min(val.percentage, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#707070] pt-1">
                    <span>{val.count} incidents</span>
                    <span className="font-bold text-[#1C1C1C]">${val.total_cost.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top High Loss Items */}
          <div className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit']">
              Top High-Loss Ingredients & Items
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F5] text-[#707070] font-bold border-b border-[rgba(45,45,45,0.08)]">
                  <tr>
                    <th className="p-3">Item Name</th>
                    <th className="p-3">Code</th>
                    <th className="p-3 text-right">Total Qty Lost</th>
                    <th className="p-3">Primary Reason</th>
                    <th className="p-3 text-right">Total Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
                  {(analytics.top_wasted_items || []).map((itm) => (
                    <tr key={itm.item_id} className="hover:bg-[#FAF8F5]/50">
                      <td className="p-3 font-semibold text-[#1C1C1C]">{itm.item_name}</td>
                      <td className="p-3 font-mono text-[#707070]">{itm.item_code}</td>
                      <td className="p-3 text-right font-mono font-bold text-[#1C1C1C]">
                        {Number(itm.quantity).toFixed(2)}
                      </td>
                      <td className="p-3">
                        <Badge variant="neutral">{itm.primary_reason}</Badge>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-[#D9534F]">
                        ${Number(itm.total_cost).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      <Modal
        isOpen={rejectionModalOpen && !!selectedEntry}
        onClose={() => setRejectionModalOpen(false)}
        title={`Reject Wastage Record #${selectedEntry?.entry_number}`}
        icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
      >
        <div className="space-y-3">
          <p className="text-xs text-[#707070]">
            Rejecting this record will NOT deduct stock from the warehouse. Please provide a mandatory reason for the audit trail.
          </p>

          <div>
            <label className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider mb-1 block">
              Reason for Rejection *
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Unverified spoilage / items were repurposed / count discrepancy..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full p-2.5 text-xs rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] focus:outline-none focus:border-[#C79A3B]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[rgba(45,45,45,0.06)]">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRejectionModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleRejectConfirm}
              disabled={!rejectionReason.trim()}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default WastageWorkspace;
