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

  // Log New Form State
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [entryNotes, setEntryNotes] = useState<string>('');
  const [formItems, setFormItems] = useState<WastageItemInput[]>([
    { item_id: '', quantity: 1, reason_code: 'EXPIRED', notes: '' },
  ]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Selected Entry for Detail / Rejection Modal
  const [selectedEntry, setSelectedEntry] = useState<WastageEntry | null>(null);
  const [rejectionModalOpen, setRejectionModalOpen] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  const fetchData = async () => {
    setLoading(true);
    setErrorMessage(null);
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
      setErrorMessage(err.message || 'Failed to load wastage records');
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

    // Auto populate unit_cost if item_id changed
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
      setErrorMessage('Please select a storage warehouse.');
      return;
    }
    const validItems = formItems.filter((fi) => fi.item_id && fi.quantity > 0);
    if (validItems.length === 0) {
      setErrorMessage('Please add at least one valid item with quantity > 0.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const created = await wastageApi.createEntry({
        branch_id: activeOutlet.id,
        warehouse_id: selectedWarehouseId,
        notes: entryNotes,
        items: validItems,
        auto_submit: autoSubmit,
      });
      setSuccessMessage(`Wastage Entry #${created.entry_number} logged successfully!`);
      setFormItems([{ item_id: '', quantity: 1, reason_code: 'EXPIRED', notes: '' }]);
      setEntryNotes('');
      setActiveTab('entries');
      fetchData();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || err.message || 'Failed to log wastage entry');
    } finally {
      setSubmitting(false);
    }
  };

  // Approve Entry
  const handleApprove = async (id: string) => {
    setErrorMessage(null);
    try {
      await wastageApi.approveEntry(id);
      setSuccessMessage('Wastage record approved and inventory balances updated!');
      fetchData();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || err.message || 'Failed to approve wastage');
    }
  };

  // Reject Entry
  const handleRejectConfirm = async () => {
    if (!selectedEntry || !rejectionReason.trim()) {
      setErrorMessage('Rejection reason is required.');
      return;
    }
    try {
      await wastageApi.rejectEntry(selectedEntry.id, { rejection_reason: rejectionReason });
      setSuccessMessage(`Wastage #${selectedEntry.entry_number} rejected.`);
      setRejectionModalOpen(false);
      setSelectedEntry(null);
      setRejectionReason('');
      fetchData();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || err.message || 'Failed to reject wastage');
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
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF8F5] text-[#B8862D] font-bold border border-[rgba(45,45,45,0.1)]">
              [{activeOutlet.code}]
            </span>
          </div>
          <p className="text-xs text-[#707070] mt-0.5">
            Log, authorize, and audit kitchen spoilage, prep loss, and inventory write-offs with reason codes and FIFO deduction.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('log_new')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#D9534F] hover:bg-[#c9302c] text-white text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Log Wastage</span>
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.12)] hover:bg-[#FAF8F5] text-xs font-semibold text-[#1C1C1C] transition-all shadow-sm active:scale-95 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#C79A3B] ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm">
          <div className="flex items-center justify-between text-[#707070] mb-1">
            <span className="text-xs font-semibold">Approved Loss</span>
            <DollarSign className="w-4 h-4 text-[#D9534F]" />
          </div>
          <p className="text-2xl font-bold text-[#D9534F] font-['Outfit']">
            ₹{approvedTotalCost.toFixed(2)}
          </p>
          <p className="text-[10px] text-[#707070] mt-1">Total written-off valuation</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm">
          <div className="flex items-center justify-between text-[#707070] mb-1">
            <span className="text-xs font-semibold">Pending Authorizations</span>
            <Clock className="w-4 h-4 text-[#D99625]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">{pendingCount}</p>
          <p className="text-[10px] text-[#D99625] mt-1 font-medium">Requiring Manager Approval</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm">
          <div className="flex items-center justify-between text-[#707070] mb-1">
            <span className="text-xs font-semibold">Total Entries Logged</span>
            <FileText className="w-4 h-4 text-[#C79A3B]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">{entries.length}</p>
          <p className="text-[10px] text-[#707070] mt-1 font-medium">Audit records recorded</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm">
          <div className="flex items-center justify-between text-[#707070] mb-1">
            <span className="text-xs font-semibold">Approval Threshold</span>
            <ShieldCheck className="w-4 h-4 text-[#2E8B57]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">₹1,000.00</p>
          <p className="text-[10px] text-[#2E8B57] mt-1 font-medium">Auto-triggers HO approval</p>
        </div>
      </div>

      {/* Abnormal Spoilage Alert Banner if any */}
      {analytics && analytics.abnormal_alerts && analytics.abnormal_alerts.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-800">
            <Flame className="w-4 h-4 text-amber-600" />
            <span>Abnormal Spoilage / Wastage Surge Detected</span>
          </div>
          {analytics.abnormal_alerts.map((al, idx) => (
            <div key={idx} className="text-[11px] flex items-center justify-between">
              <span>
                <strong>{al.branch_name}:</strong> Recorded ₹{al.current_cost.toFixed(2)} (+{al.surge_percentage}% above baseline)
              </span>
              <span className="text-amber-700 italic">{al.reason}</span>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-xs text-green-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[rgba(45,45,45,0.08)] pb-2">
        <button
          onClick={() => setActiveTab('entries')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'entries'
              ? 'bg-[#1C1C1C] text-white shadow-sm'
              : 'text-[#707070] hover:bg-[#FAF8F5] hover:text-[#1C1C1C]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            <span>Wastage Audit Log ({entries.length})</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('log_new')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'log_new'
              ? 'bg-[#D9534F] text-white shadow-sm'
              : 'text-[#707070] hover:bg-[#FAF8F5] hover:text-[#1C1C1C]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span>Log New Wastage</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'analytics'
              ? 'bg-[#1C1C1C] text-white shadow-sm'
              : 'text-[#707070] hover:bg-[#FAF8F5] hover:text-[#1C1C1C]'
          }`}
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            <span>Loss Analytics & Outlet Comparison</span>
          </div>
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
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    statusFilter === st
                      ? 'bg-[#1C1C1C] text-white'
                      : 'bg-white border border-[rgba(45,45,45,0.1)] text-[#707070] hover:bg-[#FAF8F5]'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]" />
              <input
                type="text"
                placeholder="Search wastage # or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-56 sm:w-64 pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white border border-[rgba(45,45,45,0.12)] focus:outline-none focus:border-[#C79A3B] text-[#1C1C1C]"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-[#707070] text-xs flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#C79A3B]" />
              <span>Loading wastage ledger...</span>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] text-xs text-[#707070] space-y-2">
              <Trash2 className="w-8 h-8 mx-auto text-[#D9534F]/40" />
              <p className="font-semibold text-[#1C1C1C]">No wastage records match filter</p>
              <p className="max-w-md mx-auto">
                Log spoilage, prep discard, or QC defect items to track loss and deduct stock.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] text-[#707070] font-bold border-b border-[rgba(45,45,45,0.08)]">
                    <tr>
                      <th className="p-3.5">Entry #</th>
                      <th className="p-3.5">Date</th>
                      <th className="p-3.5">Storage Warehouse</th>
                      <th className="p-3.5">Items</th>
                      <th className="p-3.5">Total Valuation</th>
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
                          <td className="p-3.5 font-bold text-[#D9534F]">
                            ₹{Number(e.total_cost).toFixed(2)}
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                e.status === 'APPROVED'
                                  ? 'bg-green-50 text-green-700 border border-green-200'
                                  : e.status === 'PENDING_APPROVAL'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : e.status === 'REJECTED'
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : 'bg-gray-50 text-gray-700 border border-gray-200'
                              }`}
                            >
                              {e.status.replace('_', ' ')}
                            </span>
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
                                <button
                                  onClick={async () => {
                                    await wastageApi.submitEntry(e.id);
                                    fetchData();
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-[#1C1C1C] hover:bg-[#2D2D2D] text-white text-[11px] font-semibold transition-all active:scale-95"
                                >
                                  Submit
                                </button>
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
                                      className="p-2 rounded-lg bg-white border border-[rgba(45,45,45,0.06)] text-[11px] flex items-center justify-between"
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
                                        <span className="text-[10px] text-[#D9534F]">
                                          ₹{Number(itm.total_cost).toFixed(2)}
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
              Specify wasted ingredients or finished items with mandatory reason codes. Entries over ₹1,000 require manager approval.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-[#1C1C1C] block mb-1">
                Storage / Kitchen Warehouse
              </label>
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="w-full p-2.5 text-xs rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:outline-none focus:border-[#C79A3B]"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#1C1C1C] block mb-1">
                General Audit Notes
              </label>
              <input
                type="text"
                placeholder="e.g. End of shift inspection / cooler breakdown..."
                value={entryNotes}
                onChange={(e) => setEntryNotes(e.target.value)}
                className="w-full p-2.5 text-xs rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:outline-none focus:border-[#C79A3B]"
              />
            </div>
          </div>

          {/* Dynamic Item Repeater */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1C1C1C] font-['Outfit']">
                Wasted Items List ({formItems.length})
              </span>
              <button
                onClick={handleAddItemRow}
                className="flex items-center gap-1 text-xs font-bold text-[#C79A3B] hover:text-[#b8862d]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {formItems.map((fi, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
                >
                  <div className="sm:col-span-4">
                    <label className="text-[11px] font-semibold text-[#707070] block mb-1">
                      Select Item
                    </label>
                    <select
                      value={fi.item_id}
                      onChange={(e) => handleItemChange(idx, 'item_id', e.target.value)}
                      className="w-full p-2 text-xs rounded-lg bg-white border border-[rgba(45,45,45,0.12)] focus:outline-none focus:border-[#C79A3B]"
                    >
                      <option value="">-- Choose Item --</option>
                      {items.map((itm) => (
                        <option key={itm.id} value={itm.id}>
                          {itm.name} ({itm.code}) - ₹{Number((itm as any).cost_price || (itm as any).costPrice || 0).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-semibold text-[#707070] block mb-1">
                      Wasted Qty
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
                ₹{calculatedTotalCost.toFixed(2)}
              </span>
              {calculatedTotalCost >= 1000 && (
                <span className="text-[10px] text-amber-700 font-semibold block mt-0.5">
                  ⚠ Exceeds ₹1,000 threshold — will require Manager Approval
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCreateEntry(false)}
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] hover:bg-[#FAF8F5] text-xs font-semibold text-[#1C1C1C] transition-all active:scale-95 disabled:opacity-50"
              >
                Save as Draft
              </button>
              <button
                onClick={() => handleCreateEntry(true)}
                disabled={submitting}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#D9534F] hover:bg-[#c9302c] text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{submitting ? 'Logging...' : 'Submit Wastage'}</span>
              </button>
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
                    <span className="font-bold text-[#1C1C1C]">₹{val.total_cost.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top 10 Wasted Items */}
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
                    <th className="p-3">Total Qty Lost</th>
                    <th className="p-3">Primary Reason</th>
                    <th className="p-3 text-right">Total Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
                  {(analytics.top_wasted_items || []).map((itm) => (
                    <tr key={itm.item_id} className="hover:bg-[#FAF8F5]/50">
                      <td className="p-3 font-semibold text-[#1C1C1C]">{itm.item_name}</td>
                      <td className="p-3 font-mono text-[#707070]">{itm.item_code}</td>
                      <td className="p-3 font-mono font-bold text-[#1C1C1C]">
                        {Number(itm.quantity).toFixed(2)}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-[10px] font-semibold text-[#707070]">
                          {itm.primary_reason}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold text-[#D9534F]">
                        ₹{Number(itm.total_cost).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectionModalOpen && selectedEntry && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-[rgba(45,45,45,0.1)] animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-[#1C1C1C]">
                Reject Wastage #{selectedEntry.entry_number}
              </h4>
              <button
                onClick={() => setRejectionModalOpen(false)}
                className="text-[#707070] hover:text-[#1C1C1C]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#707070]">
              Rejecting this record will NOT deduct stock from the warehouse. Please provide a mandatory reason for audit.
            </p>

            <div>
              <label className="text-xs font-semibold text-[#1C1C1C] block mb-1">
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

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectionModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.12)] text-xs font-semibold text-[#1C1C1C]"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={!rejectionReason.trim()}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WastageWorkspace;
