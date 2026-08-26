'use client';

import React, { useState, useEffect } from 'react';
import { useOutlet } from '@/context/OutletContext';
import { apiClient } from '@/api/client';
import {
  Truck,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Boxes,
  Building2,
  Calendar,
  Layers,
  FileSpreadsheet,
  ArrowLeftRight,
} from 'lucide-react';
import { Badge, Button, StatCard, SearchInput, AlertBanner, EmptyState, Modal } from '@/components/ui';

export const TransfersWorkspace: React.FC = () => {
  const { activeOutlet, isHeadOffice, outlets } = useOutlet();
  const [transfers, setTransfers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'ALL' | 'INBOUND' | 'OUTBOUND'>('ALL');

  // Create Transfer Modal State
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [transferForm, setTransferForm] = useState({
    from_warehouse_id: '',
    to_warehouse_id: '',
    item_id: '',
    quantity: 10,
    notes: '',
  });
  const [submittingTransfer, setSubmittingTransfer] = useState<boolean>(false);

  const fetchTransfers = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const targetBranch = isHeadOffice ? undefined : activeOutlet.id;
      const [trRes, whRes, itmRes] = await Promise.all([
        apiClient.get('/inventory/transfers', { params: { branch_id: targetBranch } }).catch(() => ({ data: [] })),
        apiClient.get('/inventory/warehouses').catch(() => ({ data: [] })),
        apiClient.get('/inventory/items').catch(() => ({ data: [] })),
      ]);

      const trList = Array.isArray(trRes.data?.data) ? trRes.data.data : Array.isArray(trRes.data) ? trRes.data : [];
      const whList = Array.isArray(whRes.data?.data) ? whRes.data.data : Array.isArray(whRes.data) ? whRes.data : [];
      const itmList = Array.isArray(itmRes.data?.data) ? itmRes.data.data : Array.isArray(itmRes.data) ? itmRes.data : [];

      setTransfers(trList);
      setWarehouses(whList);
      setItems(itmList);

      if (whList.length > 1) {
        setTransferForm((prev) => ({
          ...prev,
          from_warehouse_id: whList[0].id,
          to_warehouse_id: whList[1].id,
        }));
      }
      if (itmList.length > 0) {
        setTransferForm((prev) => ({
          ...prev,
          item_id: itmList[0].id,
        }));
      }
    } catch (err: any) {
      setTransfers([]);
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || err?.message || 'Failed to load transfer movements',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, [activeOutlet.id]);

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferForm.from_warehouse_id || !transferForm.to_warehouse_id || !transferForm.item_id) {
      setFeedback({ type: 'error', message: 'Please select source warehouse, destination warehouse, and item.' });
      return;
    }
    if (transferForm.from_warehouse_id === transferForm.to_warehouse_id) {
      setFeedback({ type: 'error', message: 'Source and destination warehouses cannot be the same.' });
      return;
    }
    setSubmittingTransfer(true);
    try {
      await apiClient.post('/inventory/transfers', {
        from_warehouse_id: transferForm.from_warehouse_id,
        to_warehouse_id: transferForm.to_warehouse_id,
        notes: transferForm.notes || 'Inter-branch store dispatch',
        items: [
          {
            item_id: transferForm.item_id,
            quantity: Number(transferForm.quantity),
          },
        ],
      });
      setFeedback({ type: 'success', message: 'Stock transfer dispatched and recorded in StockLedger.' });
      setCreateModalOpen(false);
      setTransferForm({
        from_warehouse_id: warehouses[0]?.id || '',
        to_warehouse_id: warehouses[1]?.id || '',
        item_id: items[0]?.id || '',
        quantity: 10,
        notes: '',
      });
      fetchTransfers();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to create stock transfer' });
    } finally {
      setSubmittingTransfer(false);
    }
  };

  const filtered = transfers.filter((t) => {
    const matchesSearch =
      (t.transfer_number || t.transferNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.notes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.from_warehouse_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.to_warehouse_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
              <Truck className="w-5 h-5 text-[#C79A3B]" />
              Store Transfers & Commissary Dispatch
            </h2>
            <Badge variant="outlet">[{activeOutlet.code}]</Badge>
          </div>
          <p className="text-xs text-[#707070] mt-0.5">
            Inter-branch stock movements from Central Store & Commissary Bakery to retail dining outlets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchTransfers}
            loading={loading}
            icon={<RefreshCw className="w-3.5 h-3.5 text-[#C79A3B]" />}
          >
            Sync Ledger
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            New Transfer Dispatch
          </Button>
        </div>
      </div>

      {/* Feedback Banner */}
      <AlertBanner feedback={feedback} onClose={() => setFeedback(null)} />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Transfer Records"
          value={transfers.length}
          subtitle="Live PostgreSQL Ledger"
          icon={<Layers className="w-4 h-4 text-[#C79A3B]" />}
          iconBgColor="bg-[#FAF8F5] text-[#C79A3B]"
        />

        <StatCard
          title="Central Supply Hubs"
          value={`${warehouses.filter((w) => w.is_central || w.type === 'CENTRAL').length} Hub${warehouses.filter((w) => w.is_central || w.type === 'CENTRAL').length === 1 ? '' : 's'}`}
          subtitle={warehouses.filter((w) => w.is_central || w.type === 'CENTRAL').length > 0 ? 'Designated Central Hubs' : 'Standard Stores'}
          icon={<Building2 className="w-4 h-4 text-[#3978B8]" />}
          iconBgColor="bg-blue-50 text-[#3978B8]"
        />

        <StatCard
          title="Stock Ledger Integrity"
          value="Atomic"
          subtitle="Direct StockBalance & Ledger Sync"
          icon={<CheckCircle2 className="w-4 h-4 text-[#2E8B57]" />}
          iconBgColor="bg-[#2E8B57]/10 text-[#2E8B57]"
        />
      </div>

      {/* Search & List */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit']">
            Stock Transfer Movements for [{activeOutlet.code}] ({filtered.length})
          </h3>
          <SearchInput
            value={searchQuery}
            onChangeValue={setSearchQuery}
            placeholder="Search by transfer #, warehouse, notes..."
            className="w-full sm:w-72"
          />
        </div>

        {loading ? (
          <div className="p-12 text-center text-[#707070] text-xs flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-[#C79A3B]" />
            <span>Loading store transfers from Neon PostgreSQL...</span>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No Transfer Records Found"
            description={`No stock movements recorded for ${activeOutlet.name}. Initiate a transfer dispatch when replenishing from central stores.`}
            icon={<Truck className="w-6 h-6" />}
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => setCreateModalOpen(true)}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                Dispatch First Transfer
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[rgba(45,45,45,0.08)] bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-[rgba(45,45,45,0.08)] text-[#707070] font-bold">
                  <th className="p-3.5">Transfer #</th>
                  <th className="p-3.5">Source Warehouse</th>
                  <th className="p-3.5">Destination Warehouse</th>
                  <th className="p-3.5">Items / Notes</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
                {filtered.map((t, idx) => (
                  <tr key={t.id || idx} className="hover:bg-[#FAF8F5]/60 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-[#1C1C1C]">
                      {t.transfer_number || t.transferNumber || `TR-${idx + 1}`}
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-[#1C1C1C]">
                        {t.from_warehouse_name || t.fromWarehouse?.name || '—'}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-[#1C1C1C]">
                        {t.to_warehouse_name || t.toWarehouse?.name || '—'}
                      </div>
                    </td>
                    <td className="p-3.5 text-[#707070]">
                      {t.notes || '—'}
                    </td>
                    <td className="p-3.5 font-mono text-[11px] text-[#707070]">
                      {t.transfer_date ? t.transfer_date.slice(0, 10) : (t.created_at ? t.created_at.slice(0, 10) : '—')}
                    </td>
                    <td className="p-3.5">
                      <Badge variant="success">{t.status || 'COMPLETED'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: New Stock Transfer Dispatch */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={`New Stock Transfer (${activeOutlet.name})`}
        icon={<Truck className="w-5 h-5 text-[#C79A3B]" />}
      >
        <form onSubmit={handleCreateTransfer} className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider mb-1 block">
              Source Warehouse (From) *
            </label>
            <select
              value={transferForm.from_warehouse_id}
              onChange={(e) => setTransferForm({ ...transferForm, from_warehouse_id: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs text-[#1C1C1C] focus:outline-none focus:border-[#C79A3B]"
            >
              <option value="">-- Select Source Warehouse --</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name} ({wh.code}) {wh.is_central ? '★ Central' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider mb-1 block">
              Destination Warehouse (To) *
            </label>
            <select
              value={transferForm.to_warehouse_id}
              onChange={(e) => setTransferForm({ ...transferForm, to_warehouse_id: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs text-[#1C1C1C] focus:outline-none focus:border-[#C79A3B]"
            >
              <option value="">-- Select Destination Warehouse --</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name} ({wh.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider mb-1 block">
                Item to Transfer *
              </label>
              <select
                value={transferForm.item_id}
                onChange={(e) => setTransferForm({ ...transferForm, item_id: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs text-[#1C1C1C] focus:outline-none focus:border-[#C79A3B]"
              >
                <option value="">-- Choose Item --</option>
                {items.map((itm) => (
                  <option key={itm.id} value={itm.id}>
                    {itm.name} ({itm.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider mb-1 block">
                Transfer Quantity *
              </label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                required
                value={transferForm.quantity}
                onChange={(e) => setTransferForm({ ...transferForm, quantity: parseFloat(e.target.value) || 1 })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs font-mono font-bold text-[#1C1C1C] focus:outline-none focus:border-[#C79A3B]"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider mb-1 block">
              Dispatch Notes / Purpose
            </label>
            <input
              type="text"
              value={transferForm.notes}
              onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
              placeholder="e.g. Replenishment dispatch for weekend dining"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs text-[#1C1C1C] focus:outline-none focus:border-[#C79A3B]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[rgba(45,45,45,0.06)]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={submittingTransfer}
              icon={<Truck className="w-3.5 h-3.5" />}
            >
              Dispatch Transfer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TransfersWorkspace;
