'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Truck, Package, Plus, RefreshCw, Search, Filter, Star, CheckCircle2, DollarSign } from 'lucide-react';
import { procurementApi } from '@/api/procurement';
import { inventoryApi } from '@/api/inventory';
import { Supplier, SupplierItem, SupplierItemCreateInput } from '@/types/purchase.types';
import { Item, Unit } from '@/types/inventory.types';
import {
  FeedbackBanner,
  Modal,
  Field,
  inputCls,
  CancelBtn,
  SubmitBtn,
  StatusPill,
  EmptyState,
  ConfirmModal,
  ToggleSwitch,
  EditBtn,
  DeleteBtn,
  ErrDetail,
  Feedback,
} from './ui';

const emptyMappingForm: SupplierItemCreateInput = {
  supplier_id: '',
  item_id: '',
  supplier_item_code: '',
  supplier_item_name: '',
  purchase_unit_id: '',
  purchase_price: 0,
  conversion_rate: 1,
  lead_time_days: 1,
  is_preferred: false,
  is_active: true,
};

type BulkMappingRow = {
  item_id: string;
  purchase_price: number;
  purchase_unit_id: string;
  conversion_rate: number;
  lead_time_days: number;
  is_preferred: boolean;
  selected: boolean;
  status?: 'pending' | 'created' | 'skipped' | 'failed';
  message?: string;
};

export const MasterVendorItems: React.FC = () => {
  const [mappings, setMappings] = useState<SupplierItem[]>([]);
  const [vendors, setVendors] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const [search, setSearch] = useState('');
  const [selectedVendorFilter, setSelectedVendorFilter] = useState<string>('ALL');
  const [selectedItemFilter, setSelectedItemFilter] = useState<string>('ALL');

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<SupplierItemCreateInput>({ ...emptyMappingForm });

  const [editing, setEditing] = useState<SupplierItem | null>(null);
  const [editForm, setEditForm] = useState<SupplierItemCreateInput>({ ...emptyMappingForm });

  const [deleteTarget, setDeleteTarget] = useState<SupplierItem | null>(null);

  const [showBulk, setShowBulk] = useState(false);
  const [bulkVendorId, setBulkVendorId] = useState('');
  const [bulkRows, setBulkRows] = useState<BulkMappingRow[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [mapsData, vendsData, itemsData, unitsData] = await Promise.all([
        procurementApi.getVendorItems(),
        procurementApi.getSuppliers(),
        inventoryApi.getItems(),
        inventoryApi.getUnits(),
      ]);
      setMappings(mapsData);
      setVendors(vendsData);
      setItems(itemsData);
      setUnits(unitsData);

      if (vendsData.length > 0 && !createForm.supplier_id) {
        setCreateForm((prev) => ({ ...prev, supplier_id: vendsData[0].id }));
      }
      if (itemsData.length > 0 && !createForm.item_id) {
        setCreateForm((prev) => ({ ...prev, item_id: itemsData[0].id }));
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: ErrDetail(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const filtered = mappings.filter((m) => {
    const sName = m.supplier_name || vendors.find((v) => v.id === m.supplier_id)?.name || '';
    const iName = m.item_name || items.find((i) => i.id === m.item_id)?.name || '';
    const iCode = m.item_code || items.find((i) => i.id === m.item_id)?.code || '';
    const sic = m.supplier_item_code || '';

    const matchesSearch =
      sName.toLowerCase().includes(search.toLowerCase()) ||
      iName.toLowerCase().includes(search.toLowerCase()) ||
      iCode.toLowerCase().includes(search.toLowerCase()) ||
      sic.toLowerCase().includes(search.toLowerCase());

    const matchesVendor = selectedVendorFilter === 'ALL' || m.supplier_id === selectedVendorFilter;
    const matchesItem = selectedItemFilter === 'ALL' || m.item_id === selectedItemFilter;

    return matchesSearch && matchesVendor && matchesItem;
  });

  const groupedFiltered = filtered.reduce<Record<string, { vendorId: string; vendorName: string; mappings: SupplierItem[] }>>(
    (groups, mapping) => {
      const vendor = vendors.find((v) => v.id === mapping.supplier_id);
      const vendorId = mapping.supplier_id || 'unknown';
      if (!groups[vendorId]) {
        groups[vendorId] = {
          vendorId,
          vendorName: mapping.supplier_name || vendor?.name || 'Unknown Vendor',
          mappings: [],
        };
      }
      groups[vendorId].mappings.push(mapping);
      return groups;
    },
    {},
  );

  const openBulkMapping = () => {
    const defaultVendor = vendors[0]?.id || '';
    setBulkVendorId(defaultVendor);
    setBulkRows(
      items
        .filter((item) => item.is_active !== false)
        .map((item) => ({
          item_id: item.id,
          purchase_price: 0,
          purchase_unit_id: '',
          conversion_rate: 1,
          lead_time_days: 1,
          is_preferred: false,
          selected: false,
          status: 'pending' as const,
        })),
    );
    setShowBulk(true);
  };

  const updateBulkRow = (itemId: string, patch: Partial<BulkMappingRow>) => {
    setBulkRows((prev) =>
      prev.map((row) => (row.item_id === itemId ? { ...row, ...patch, status: 'pending', message: undefined } : row)),
    );
  };

  const setAllBulkSelected = (selected: boolean) => {
    setBulkRows((prev) => prev.map((row) => ({ ...row, selected })));
  };

  const selectedBulkRows = bulkRows.filter((row) => row.selected);

  const saveBulkMappings = async () => {
    if (!bulkVendorId) {
      setFeedback({ type: 'error', message: 'Please select a vendor before saving bulk mappings.' });
      return;
    }

    if (selectedBulkRows.length === 0) {
      setFeedback({ type: 'error', message: 'Select at least one item to create a vendor mapping.' });
      return;
    }

    const invalidRows = selectedBulkRows.filter(
      (row) => !Number.isFinite(Number(row.purchase_price)) || Number(row.purchase_price) <= 0,
    );
    if (invalidRows.length > 0) {
      setFeedback({ type: 'error', message: 'Every selected item must have a purchase rate greater than 0.' });
      return;
    }

    setBulkSaving(true);

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of selectedBulkRows) {
      const existing = mappings.find(
        (mapping) => mapping.supplier_id === bulkVendorId && mapping.item_id === row.item_id,
      );

      if (existing) {
        skipped += 1;
        setBulkRows((prev) =>
          prev.map((itemRow) =>
            itemRow.item_id === row.item_id
              ? { ...itemRow, status: 'skipped', message: 'Mapping already exists.' }
              : itemRow,
          ),
        );
        continue;
      }

      try {
        await procurementApi.createVendorItem({
          supplier_id: bulkVendorId,
          item_id: row.item_id,
          purchase_unit_id: row.purchase_unit_id || undefined,
          purchase_price: Number(row.purchase_price),
          conversion_rate: Number(row.conversion_rate || 1),
          lead_time_days: Number(row.lead_time_days || 1),
          is_preferred: Boolean(row.is_preferred),
          is_active: true,
        });

        created += 1;
        setBulkRows((prev) =>
          prev.map((itemRow) =>
            itemRow.item_id === row.item_id
              ? { ...itemRow, status: 'created', message: 'Created successfully.' }
              : itemRow,
          ),
        );
      } catch (err: any) {
        failed += 1;
        setBulkRows((prev) =>
          prev.map((itemRow) =>
            itemRow.item_id === row.item_id
              ? { ...itemRow, status: 'failed', message: ErrDetail(err) }
              : itemRow,
          ),
        );
      }
    }

    await loadAll();
    setBulkSaving(false);

    if (failed === 0) {
      setFeedback({
        type: 'success',
        message: `Bulk mapping complete: ${created} created${skipped ? `, ${skipped} already existed` : ''}.`,
      });
    } else {
      setFeedback({
        type: 'error',
        message: `Bulk mapping finished: ${created} created, ${skipped} skipped, ${failed} failed. Review failed rows.`,
      });
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.supplier_id || !createForm.item_id) {
      setFeedback({ type: 'error', message: 'Please select both a vendor and an item.' });
      return;
    }
    setActionLoading(true);
    try {
      await procurementApi.createVendorItem({
        supplier_id: createForm.supplier_id,
        item_id: createForm.item_id,
        supplier_item_code: createForm.supplier_item_code?.trim() || undefined,
        supplier_item_name: createForm.supplier_item_name?.trim() || undefined,
        purchase_unit_id: createForm.purchase_unit_id || undefined,
        purchase_price: Number(createForm.purchase_price || 0),
        conversion_rate: Number(createForm.conversion_rate || 1),
        lead_time_days: Number(createForm.lead_time_days || 1),
        is_preferred: Boolean(createForm.is_preferred),
        is_active: Boolean(createForm.is_active),
      });
      setFeedback({ type: 'success', message: 'Vendor-Item rate mapping created successfully.' });
      setShowCreate(false);
      setCreateForm({
        ...emptyMappingForm,
        supplier_id: vendors[0]?.id || '',
        item_id: items[0]?.id || '',
      });
      await loadAll();
    } catch (err: any) {
      setFeedback({ type: 'error', message: ErrDetail(err) });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setActionLoading(true);
    try {
      await procurementApi.updateVendorItem(editing.id, {
        supplier_item_code: editForm.supplier_item_code?.trim() || undefined,
        supplier_item_name: editForm.supplier_item_name?.trim() || undefined,
        purchase_unit_id: editForm.purchase_unit_id || undefined,
        purchase_price: Number(editForm.purchase_price || 0),
        conversion_rate: Number(editForm.conversion_rate || 1),
        lead_time_days: Number(editForm.lead_time_days || 1),
        is_preferred: Boolean(editForm.is_preferred),
        is_active: Boolean(editForm.is_active),
      });
      setFeedback({ type: 'success', message: 'Vendor-Item rate mapping updated successfully.' });
      setEditing(null);
      await loadAll();
    } catch (err: any) {
      setFeedback({ type: 'error', message: ErrDetail(err) });
    } finally {
      setActionLoading(false);
    }
  };

  const toggleActive = async (mapping: SupplierItem) => {
    setActionLoading(true);
    const newStatus = !mapping.is_active;
    try {
      await procurementApi.updateVendorItem(mapping.id, { is_active: newStatus });
      setFeedback({
        type: 'success',
        message: `Vendor rate mapping ${newStatus ? 'activated' : 'deactivated'}.`,
      });
      await loadAll();
    } catch (err: any) {
      setFeedback({ type: 'error', message: ErrDetail(err) });
    } finally {
      setActionLoading(false);
    }
  };

  const togglePreferred = async (mapping: SupplierItem) => {
    setActionLoading(true);
    const newPreferred = !mapping.is_preferred;
    try {
      await procurementApi.updateVendorItem(mapping.id, { is_preferred: newPreferred });
      setFeedback({
        type: 'success',
        message: newPreferred
          ? `Marked as Preferred Supplier for this item.`
          : `Removed Preferred status.`,
      });
      await loadAll();
    } catch (err: any) {
      setFeedback({ type: 'error', message: ErrDetail(err) });
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await procurementApi.deleteVendorItem(deleteTarget.id);
      setFeedback({
        type: 'success',
        message: 'Vendor-Item rate mapping deactivated successfully.',
      });
      setDeleteTarget(null);
      await loadAll();
    } catch (err: any) {
      setFeedback({ type: 'error', message: ErrDetail(err) });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {/* Control Toolbar */}
      <div className="rounded-2xl border border-[rgba(45,45,45,0.08)] bg-white p-3 sm:p-4 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]" />
              <input
                type="text"
                placeholder="Search by vendor, item, code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] focus:outline-none focus:border-[#C79A3B] text-[#1C1C1C]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex items-center gap-2">
              <select
                value={selectedVendorFilter}
                onChange={(e) => setSelectedVendorFilter(e.target.value)}
                className="w-full lg:w-auto lg:min-w-[165px] px-3 py-2 text-xs rounded-xl bg-white border border-[rgba(45,45,45,0.12)] focus:outline-none focus:border-[#C79A3B] text-[#1C1C1C]"
              >
                <option value="ALL">All Vendors ({vendors.length})</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedItemFilter}
                onChange={(e) => setSelectedItemFilter(e.target.value)}
                className="w-full lg:w-auto lg:min-w-[165px] px-3 py-2 text-xs rounded-xl bg-white border border-[rgba(45,45,45,0.12)] focus:outline-none focus:border-[#C79A3B] text-[#1C1C1C]"
              >
                <option value="ALL">All Items ({items.length})</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
            <button
              onClick={loadAll}
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.12)] hover:bg-[#FAF8F5] text-xs font-semibold text-[#1C1C1C] transition-all shadow-sm disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#C79A3B] ${loading ? 'animate-spin' : ''}`} />
              <span>Sync</span>
            </button>

            <button
              onClick={openBulkMapping}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1C1C1C] text-white text-xs font-semibold shadow-sm transition-all hover:bg-[#2A2A2A] active:scale-[0.99]"
            >
              <Package className="w-3.5 h-3.5" />
              <span>Bulk Map Items</span>
            </button>

            <button
              onClick={() => {
                setCreateForm({
                  ...emptyMappingForm,
                  supplier_id: vendors[0]?.id || '',
                  item_id: items[0]?.id || '',
                });
                setShowCreate(true);
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#C79A3B] to-[#B8862D] text-white text-xs font-semibold shadow-md shadow-[#C79A3B]/20 transition-all hover:brightness-105 active:scale-[0.99]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Map Vendor Item & Rate</span>
            </button>
          </div>
        </div>
      </div>

      {/* Professional grouped Vendor → Items register */}
      {loading ? (
        <div className="rounded-2xl border border-[rgba(45,45,45,0.08)] bg-white p-12 text-center text-[#707070] text-xs flex flex-col items-center justify-center gap-3 shadow-sm">
          <RefreshCw className="w-6 h-6 animate-spin text-[#C79A3B]" />
          <span>Loading Vendor ↔ Item Rate Mappings...</span>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          message={
            search || selectedVendorFilter !== 'ALL' || selectedItemFilter !== 'ALL'
              ? 'No vendor item mappings match your filter.'
              : 'No vendor-item rate mappings configured yet.'
          }
          icon={<DollarSign className="w-6 h-6" />}
        />
      ) : (
        <div className="space-y-3">
          {Object.values(groupedFiltered).map((group) => {
            const activeCount = group.mappings.filter((m) => m.is_active).length;
            const preferredCount = group.mappings.filter((m) => m.is_preferred).length;

            return (
              <section
                key={group.vendorId}
                className="overflow-hidden rounded-2xl border border-[rgba(45,45,45,0.09)] bg-white shadow-sm"
              >
                {/* Vendor header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 bg-gradient-to-r from-[#FAF8F5] to-white border-b border-[rgba(45,45,45,0.08)]">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 shrink-0 rounded-xl bg-[#1C1C1C] flex items-center justify-center">
                      <Truck className="w-4 h-4 text-[#F1E4C5]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-[#8A8A8A]">
                        Vendor
                      </div>
                      <div className="text-sm font-extrabold text-[#1C1C1C] truncate" title={group.vendorName}>
                        {group.vendorName}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="px-2.5 py-1 rounded-full bg-white border border-[rgba(45,45,45,0.1)] font-semibold text-[#555]">
                      {group.mappings.length} {group.mappings.length === 1 ? 'Item' : 'Items'}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-[#E7F6EC] border border-[#B7DEC4] font-semibold text-[#277A45]">
                      {activeCount} Active
                    </span>
                    {preferredCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F1E4C5] border border-[#B8862D]/25 font-semibold text-[#8A641D]">
                        <Star className="w-3 h-3 fill-[#B8862D]" />
                        {preferredCount} Preferred
                      </span>
                    )}
                  </div>
                </div>

                {/* Desktop item register */}
                <div className="hidden md:block">
                  <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(100px,0.8fr)_minmax(120px,1fr)_minmax(80px,0.7fr)_minmax(145px,1.15fr)_minmax(145px,1.2fr)] items-center gap-3 px-4 py-2.5 bg-[#FCFBF9] border-b border-[rgba(45,45,45,0.06)] text-[9px] uppercase tracking-[0.08em] font-bold text-[#8A8A8A]">
                    <div>Master Item</div>
                    <div>Rate</div>
                    <div>Purchase / Conversion</div>
                    <div>Lead</div>
                    <div>Status</div>
                    <div className="text-right">Actions</div>
                  </div>

                  <div className="divide-y divide-[rgba(45,45,45,0.07)]">
                    {group.mappings.map((m) => {
                      const item = items.find((i) => i.id === m.item_id);
                      const iName = m.item_name || item?.name || 'Unknown Item';
                      const iCode = m.item_code || item?.code || '';
                      const pUnit = m.purchase_unit_symbol || m.base_unit_symbol || 'UNIT';
                      const isActive = m.is_active;

                      return (
                        <div
                          key={m.id}
                          className={`grid grid-cols-[minmax(0,1.6fr)_minmax(100px,0.8fr)_minmax(120px,1fr)_minmax(80px,0.7fr)_minmax(145px,1.15fr)_minmax(145px,1.2fr)] items-center gap-3 px-4 py-3 transition-colors ${
                            isActive ? 'bg-white hover:bg-[#FAF8F5]/65' : 'bg-[#FAF8F5] opacity-70'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 shrink-0 rounded-lg bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)] flex items-center justify-center">
                                <Package className="w-3.5 h-3.5 text-[#C79A3B]" />
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-xs text-[#1C1C1C] truncate" title={iName}>{iName}</div>
                                <div className="mt-0.5 flex items-center gap-2 text-[9px] text-[#777]">
                                  {iCode && <span className="font-mono">[{iCode}]</span>}
                                  {m.supplier_item_code && <span className="font-mono truncate">SKU: {m.supplier_item_code}</span>}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="min-w-0">
                            <div className="font-extrabold text-sm text-[#1C1C1C]">
                              ₹{Number(m.purchase_price || 0).toFixed(2)}
                            </div>
                            <div className="text-[9px] text-[#8A8A8A]">per {pUnit}</div>
                          </div>

                          <div className="min-w-0">
                            <div className="font-semibold text-xs text-[#1C1C1C]">{pUnit}</div>
                            <div className="mt-0.5 text-[9px] text-[#777]">
                              1 {pUnit} = {Number(m.conversion_rate || 1)} Base
                            </div>
                          </div>

                          <div>
                            <span className="text-xs font-semibold text-[#1C1C1C] whitespace-nowrap">
                              {m.lead_time_days || 1} days
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusPill active={isActive} />
                            {m.is_preferred && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-2 py-1 rounded-full bg-[#F1E4C5] text-[#8A641D] border border-[#B8862D]/25">
                                <Star className="w-2.5 h-2.5 fill-[#B8862D]" />
                                Preferred
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-end gap-1.5">
                            <ToggleSwitch
                              active={isActive}
                              onChange={() => toggleActive(m)}
                              title={isActive ? 'Deactivate Rate Mapping' : 'Activate Rate Mapping'}
                            />
                            <button
                              onClick={() => togglePreferred(m)}
                              title={m.is_preferred ? 'Remove Preferred Vendor status' : 'Set as Preferred Vendor'}
                              className={`p-1.5 rounded-lg border transition-colors ${
                                m.is_preferred
                                  ? 'bg-[#F1E4C5] text-[#B8862D] border-[#B8862D]/40'
                                  : 'bg-white text-[#707070] border-[rgba(45,45,45,0.12)] hover:text-[#B8862D]'
                              }`}
                            >
                              <Star className={`w-3.5 h-3.5 ${m.is_preferred ? 'fill-[#B8862D]' : ''}`} />
                            </button>
                            <EditBtn
                              onClick={() => {
                                setEditing(m);
                                setEditForm({
                                  supplier_id: m.supplier_id,
                                  item_id: m.item_id,
                                  supplier_item_code: m.supplier_item_code || '',
                                  supplier_item_name: m.supplier_item_name || '',
                                  purchase_unit_id: m.purchase_unit_id || '',
                                  purchase_price: Number(m.purchase_price || 0),
                                  conversion_rate: Number(m.conversion_rate || 1),
                                  lead_time_days: Number(m.lead_time_days || 1),
                                  is_preferred: Boolean(m.is_preferred),
                                  is_active: Boolean(m.is_active),
                                });
                              }}
                            />
                            <DeleteBtn label="Remove" onClick={() => setDeleteTarget(m)} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Mobile vendor group */}
                <div className="md:hidden p-2.5 space-y-2">
                  {group.mappings.map((m) => {
                    const item = items.find((i) => i.id === m.item_id);
                    const iName = m.item_name || item?.name || 'Unknown Item';
                    const iCode = m.item_code || item?.code || '';
                    const pUnit = m.purchase_unit_symbol || m.base_unit_symbol || 'UNIT';
                    const isActive = m.is_active;

                    return (
                      <div
                        key={m.id}
                        className={`rounded-xl border border-[rgba(45,45,45,0.08)] p-3 ${
                          isActive ? 'bg-white' : 'bg-[#FAF8F5] opacity-70'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="w-8 h-8 shrink-0 rounded-lg bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)] flex items-center justify-center">
                              <Package className="w-3.5 h-3.5 text-[#C79A3B]" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-sm text-[#1C1C1C] truncate">{iName}</div>
                              <div className="mt-0.5 text-[9px] text-[#777]">
                                {iCode && <span className="font-mono">[{iCode}]</span>}
                                {m.supplier_item_code && <span className="ml-2 font-mono">SKU: {m.supplier_item_code}</span>}
                              </div>
                            </div>
                          </div>
                          <StatusPill active={isActive} />
                        </div>

                        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                          <div className="rounded-lg bg-[#FAF8F5] px-2 py-2">
                            <div className="text-[8px] uppercase tracking-wide text-[#8A8A8A]">Rate</div>
                            <div className="mt-0.5 text-xs font-extrabold text-[#1C1C1C]">₹{Number(m.purchase_price || 0).toFixed(2)}</div>
                            <div className="text-[8px] text-[#8A8A8A]">/{pUnit}</div>
                          </div>
                          <div className="rounded-lg bg-[#FAF8F5] px-2 py-2">
                            <div className="text-[8px] uppercase tracking-wide text-[#8A8A8A]">Purchase</div>
                            <div className="mt-0.5 text-[10px] font-bold text-[#1C1C1C]">{pUnit}</div>
                            <div className="text-[8px] text-[#8A8A8A]">× {Number(m.conversion_rate || 1)} base</div>
                          </div>
                          <div className="rounded-lg bg-[#FAF8F5] px-2 py-2">
                            <div className="text-[8px] uppercase tracking-wide text-[#8A8A8A]">Lead</div>
                            <div className="mt-0.5 text-[10px] font-bold text-[#1C1C1C]">{m.lead_time_days || 1} days</div>
                          </div>
                        </div>

                        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[rgba(45,45,45,0.08)] pt-2.5">
                          <div className="flex items-center gap-1.5">
                            <ToggleSwitch
                              active={isActive}
                              onChange={() => toggleActive(m)}
                              title={isActive ? 'Deactivate Rate Mapping' : 'Activate Rate Mapping'}
                            />
                            <button
                              onClick={() => togglePreferred(m)}
                              className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border text-[9px] font-semibold ${
                                m.is_preferred
                                  ? 'bg-[#F1E4C5] text-[#8A641D] border-[#B8862D]/30'
                                  : 'bg-white text-[#707070] border-[rgba(45,45,45,0.12)]'
                              }`}
                            >
                              <Star className={`w-3 h-3 ${m.is_preferred ? 'fill-[#B8862D]' : ''}`} />
                              Preferred
                            </button>
                          </div>
                          <div className="flex items-center gap-1">
                            <EditBtn
                              onClick={() => {
                                setEditing(m);
                                setEditForm({
                                  supplier_id: m.supplier_id,
                                  item_id: m.item_id,
                                  supplier_item_code: m.supplier_item_code || '',
                                  supplier_item_name: m.supplier_item_name || '',
                                  purchase_unit_id: m.purchase_unit_id || '',
                                  purchase_price: Number(m.purchase_price || 0),
                                  conversion_rate: Number(m.conversion_rate || 1),
                                  lead_time_days: Number(m.lead_time_days || 1),
                                  is_preferred: Boolean(m.is_preferred),
                                  is_active: Boolean(m.is_active),
                                });
                              }}
                            />
                            <DeleteBtn label="Remove" onClick={() => setDeleteTarget(m)} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Bulk Mapping Modal */}
      {showBulk && (
        <Modal
          title="Bulk Map Vendor Items & Rates"
          subtitle="Select one vendor, then configure multiple master items in one professional setup screen."
          onClose={() => !bulkSaving && setShowBulk(false)}
        >
          <div className="space-y-3 text-xs">
            <Field label="Select Vendor / Supplier" required>
              <select
                required
                value={bulkVendorId}
                onChange={(e) => setBulkVendorId(e.target.value)}
                disabled={bulkSaving}
                className={inputCls}
              >
                <option value="" disabled>Choose existing vendor</option>
                {vendors
                  .filter((v) => (v as any).is_active !== false && (v as any).isActive !== false)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} [{v.code}]
                    </option>
                  ))}
              </select>
            </Field>

            <div className="rounded-xl border border-[rgba(45,45,45,0.08)] bg-[#FAF8F5] px-3 py-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <div className="font-bold text-[#1C1C1C]">Item selection</div>
                  <div className="text-[10px] text-[#707070]">
                    Configure rate and purchasing details row-by-row. Existing mappings are skipped safely.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAllBulkSelected(true)}
                    disabled={bulkSaving}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-[rgba(45,45,45,0.12)] text-[10px] font-semibold"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllBulkSelected(false)}
                    disabled={bulkSaving}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-[rgba(45,45,45,0.12)] text-[10px] font-semibold"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            <div className="max-h-[48vh] overflow-auto rounded-xl border border-[rgba(45,45,45,0.08)] bg-white">
              <div className="hidden lg:grid sticky top-0 z-10 grid-cols-[36px_minmax(170px,1.4fr)_105px_130px_105px_105px_85px] gap-2 px-3 py-2.5 bg-[#FAF8F5] border-b border-[rgba(45,45,45,0.08)] text-[9px] uppercase tracking-wide font-bold text-[#707070]">
                <div></div>
                <div>Master Item</div>
                <div>Rate</div>
                <div>Purchase Unit</div>
                <div>Conversion</div>
                <div>Lead Days</div>
                <div>Preferred</div>
              </div>

              <div className="divide-y divide-[rgba(45,45,45,0.07)]">
                {bulkRows.map((row) => {
                  const item = items.find((i) => i.id === row.item_id);
                  const existing = mappings.some(
                    (mapping) => mapping.supplier_id === bulkVendorId && mapping.item_id === row.item_id,
                  );

                  return (
                    <div
                      key={row.item_id}
                      className={`p-3 ${row.status === 'created' ? 'bg-[#F3FAF5]' : row.status === 'failed' ? 'bg-[#FFF6F5]' : 'bg-white'}`}
                    >
                      <div className="hidden lg:grid grid-cols-[36px_minmax(170px,1.4fr)_105px_130px_105px_105px_85px] items-center gap-2">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={(e) => updateBulkRow(row.item_id, { selected: e.target.checked })}
                          disabled={bulkSaving || existing || row.status === 'created'}
                          className="h-4 w-4 accent-[#C79A3B]"
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-[#1C1C1C] truncate">{item?.name || 'Unknown Item'}</div>
                          <div className="text-[9px] text-[#707070] font-mono">
                            {item?.code || ''} · {item?.unit_symbol || 'UNIT'}
                          </div>
                          {existing && <div className="text-[9px] text-[#B8862D] font-semibold mt-0.5">Already mapped</div>}
                        </div>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={row.purchase_price}
                          onChange={(e) => updateBulkRow(row.item_id, { purchase_price: parseFloat(e.target.value) || 0 })}
                          disabled={bulkSaving || existing || row.status === 'created'}
                          className={inputCls}
                        />
                        <select
                          value={row.purchase_unit_id}
                          onChange={(e) => updateBulkRow(row.item_id, { purchase_unit_id: e.target.value })}
                          disabled={bulkSaving || existing || row.status === 'created'}
                          className={inputCls}
                        >
                          <option value="">Base Unit</option>
                          {units.map((u) => <option key={u.id} value={u.id}>{u.symbol}</option>)}
                        </select>
                        <input
                          type="number"
                          min="0.0001"
                          step="0.0001"
                          value={row.conversion_rate}
                          onChange={(e) => updateBulkRow(row.item_id, { conversion_rate: parseFloat(e.target.value) || 1 })}
                          disabled={bulkSaving || existing || row.status === 'created'}
                          className={inputCls}
                        />
                        <input
                          type="number"
                          min="0"
                          value={row.lead_time_days}
                          onChange={(e) => updateBulkRow(row.item_id, { lead_time_days: parseInt(e.target.value, 10) || 1 })}
                          disabled={bulkSaving || existing || row.status === 'created'}
                          className={inputCls}
                        />
                        <div className="flex justify-center">
                          <ToggleSwitch
                            active={row.is_preferred}
                            onChange={() => updateBulkRow(row.item_id, { is_preferred: !row.is_preferred })}
                            title="Set as preferred vendor"
                          />
                        </div>
                      </div>

                      <div className="lg:hidden">
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={(e) => updateBulkRow(row.item_id, { selected: e.target.checked })}
                            disabled={bulkSaving || existing || row.status === 'created'}
                            className="mt-1 h-4 w-4 accent-[#C79A3B]"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-[#1C1C1C] truncate">{item?.name || 'Unknown Item'}</div>
                            <div className="text-[9px] text-[#707070] font-mono">
                              {item?.code || ''} · {item?.unit_symbol || 'UNIT'}
                            </div>
                            {existing && <div className="text-[9px] text-[#B8862D] font-semibold mt-0.5">Already mapped</div>}
                          </div>
                          {row.status && row.status !== 'pending' && (
                            <span className={`text-[9px] font-bold px-1.5 py-1 rounded ${
                              row.status === 'created' ? 'bg-[#E7F6EC] text-[#277A45]' :
                              row.status === 'skipped' ? 'bg-[#F1E4C5] text-[#8A641D]' :
                              'bg-[#FDE9E7] text-[#A13B32]'
                            }`}>
                              {row.status}
                            </span>
                          )}
                        </div>

                        <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="col-span-2 sm:col-span-1">
                            <label className="block mb-1 text-[9px] font-semibold text-[#707070]">Rate</label>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={row.purchase_price}
                              onChange={(e) => updateBulkRow(row.item_id, { purchase_price: parseFloat(e.target.value) || 0 })}
                              disabled={bulkSaving || existing || row.status === 'created'}
                              className={inputCls}
                            />
                          </div>
                          <div>
                            <label className="block mb-1 text-[9px] font-semibold text-[#707070]">Purchase Unit</label>
                            <select
                              value={row.purchase_unit_id}
                              onChange={(e) => updateBulkRow(row.item_id, { purchase_unit_id: e.target.value })}
                              disabled={bulkSaving || existing || row.status === 'created'}
                              className={inputCls}
                            >
                              <option value="">Base Unit</option>
                              {units.map((u) => <option key={u.id} value={u.id}>{u.symbol}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block mb-1 text-[9px] font-semibold text-[#707070]">Conversion</label>
                            <input
                              type="number"
                              min="0.0001"
                              step="0.0001"
                              value={row.conversion_rate}
                              onChange={(e) => updateBulkRow(row.item_id, { conversion_rate: parseFloat(e.target.value) || 1 })}
                              disabled={bulkSaving || existing || row.status === 'created'}
                              className={inputCls}
                            />
                          </div>
                          <div>
                            <label className="block mb-1 text-[9px] font-semibold text-[#707070]">Lead Days</label>
                            <input
                              type="number"
                              min="0"
                              value={row.lead_time_days}
                              onChange={(e) => updateBulkRow(row.item_id, { lead_time_days: parseInt(e.target.value, 10) || 1 })}
                              disabled={bulkSaving || existing || row.status === 'created'}
                              className={inputCls}
                            />
                          </div>
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-[#1C1C1C]">Preferred Vendor</span>
                          <ToggleSwitch
                            active={row.is_preferred}
                            onChange={() => updateBulkRow(row.item_id, { is_preferred: !row.is_preferred })}
                            title="Set as preferred vendor"
                          />
                        </div>
                      </div>

                      {row.message && row.status !== 'pending' && (
                        <div className={`mt-2 text-[9px] ${row.status === 'failed' ? 'text-[#A13B32]' : 'text-[#707070]'}`}>
                          {row.message}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-[rgba(45,45,45,0.08)]">
              <div className="text-[10px] text-[#707070]">
                <span className="font-bold text-[#1C1C1C]">{selectedBulkRows.length}</span> item(s) selected
              </div>
              <div className="flex gap-2">
                <CancelBtn onClick={() => setShowBulk(false)} />
                <button
                  type="button"
                  disabled={bulkSaving}
                  onClick={saveBulkMappings}
                  className="inline-flex items-center justify-center rounded-xl bg-[#C79A3B] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {bulkSaving ? 'Saving...' : `Save ${selectedBulkRows.length} Mapping${selectedBulkRows.length === 1 ? '' : 's'}`}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Modal */}
      {showCreate && (
        <Modal
          title="Map Vendor Item & Specific Rate"
          subtitle="Link an existing master item to a vendor with a negotiated purchase price"
          onClose={() => setShowCreate(false)}
        >
          <form onSubmit={handleCreate} className="space-y-3 text-xs max-h-[68vh] overflow-y-auto pr-1">
            <Field label="Select Vendor / Supplier" required>
              <select
                required
                value={createForm.supplier_id}
                onChange={(e) => setCreateForm({ ...createForm, supplier_id: e.target.value })}
                className={inputCls}
              >
                <option value="" disabled>Choose existing vendor</option>
                {vendors
                  .filter((v) => (v as any).is_active !== false && (v as any).isActive !== false)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} [{v.code}]
                    </option>
                  ))}
              </select>
            </Field>

            <Field label="Select Master Item" required>
              <select
                required
                value={createForm.item_id}
                onChange={(e) => setCreateForm({ ...createForm, item_id: e.target.value })}
                className={inputCls}
              >
                <option value="" disabled>Choose existing item</option>
                {items
                  .filter((i) => i.is_active !== false)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} [{i.code}] ({i.unit_symbol || 'UNIT'})
                    </option>
                  ))}
              </select>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Negotiated Vendor Rate (₹)" required>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="e.g. 48.00"
                  value={createForm.purchase_price}
                  onChange={(e) => setCreateForm({ ...createForm, purchase_price: parseFloat(e.target.value) || 0 })}
                  className={inputCls}
                />
              </Field>

              <Field label="Purchase Unit (Optional)">
                <select
                  value={createForm.purchase_unit_id || ''}
                  onChange={(e) => setCreateForm({ ...createForm, purchase_unit_id: e.target.value || undefined })}
                  className={inputCls}
                >
                  <option value="">Default Item Base Unit</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.symbol})
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Conversion Factor (Units per Purchase Unit)">
                <input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  value={createForm.conversion_rate}
                  onChange={(e) => setCreateForm({ ...createForm, conversion_rate: parseFloat(e.target.value) || 1 })}
                  className={inputCls}
                />
              </Field>

              <Field label="Lead Time (Days)">
                <input
                  type="number"
                  min="0"
                  value={createForm.lead_time_days}
                  onChange={(e) => setCreateForm({ ...createForm, lead_time_days: parseInt(e.target.value, 10) || 1 })}
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Vendor Catalog SKU / Code (Optional)">
                <input
                  type="text"
                  placeholder="Vendor's internal SKU"
                  value={createForm.supplier_item_code || ''}
                  onChange={(e) => setCreateForm({ ...createForm, supplier_item_code: e.target.value })}
                  className={inputCls}
                />
              </Field>

              <Field label="Vendor Item Name (Optional)">
                <input
                  type="text"
                  placeholder="Vendor's item label"
                  value={createForm.supplier_item_name || ''}
                  onChange={(e) => setCreateForm({ ...createForm, supplier_item_name: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)] flex items-center justify-between">
              <div>
                <span className="font-bold text-[#1C1C1C] block">Preferred Vendor for this Item</span>
                <span className="text-[10px] text-[#707070]">System will automatically recommend this vendor in requisitions</span>
              </div>
              <ToggleSwitch
                active={Boolean(createForm.is_preferred)}
                onChange={() => setCreateForm({ ...createForm, is_preferred: !createForm.is_preferred })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[rgba(45,45,45,0.08)]">
              <CancelBtn onClick={() => setShowCreate(false)} />
              <SubmitBtn loading={actionLoading} label="Save Rate Mapping" />
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {editing && (
        <Modal
          title="Edit Vendor Rate & Mapping"
          subtitle={`Vendor: ${editing.supplier_name || 'Vendor'} · Item: ${editing.item_name || 'Item'}`}
          onClose={() => setEditing(null)}
        >
          <form onSubmit={handleUpdate} className="space-y-3 text-xs max-h-[68vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Negotiated Vendor Rate (₹)" required>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={editForm.purchase_price}
                  onChange={(e) => setEditForm({ ...editForm, purchase_price: parseFloat(e.target.value) || 0 })}
                  className={inputCls}
                />
              </Field>

              <Field label="Purchase Unit">
                <select
                  value={editForm.purchase_unit_id || ''}
                  onChange={(e) => setEditForm({ ...editForm, purchase_unit_id: e.target.value || undefined })}
                  className={inputCls}
                >
                  <option value="">Default Item Base Unit</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.symbol})
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Conversion Factor">
                <input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  value={editForm.conversion_rate}
                  onChange={(e) => setEditForm({ ...editForm, conversion_rate: parseFloat(e.target.value) || 1 })}
                  className={inputCls}
                />
              </Field>

              <Field label="Lead Time (Days)">
                <input
                  type="number"
                  min="0"
                  value={editForm.lead_time_days}
                  onChange={(e) => setEditForm({ ...editForm, lead_time_days: parseInt(e.target.value, 10) || 1 })}
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Vendor Catalog SKU">
                <input
                  type="text"
                  value={editForm.supplier_item_code || ''}
                  onChange={(e) => setEditForm({ ...editForm, supplier_item_code: e.target.value })}
                  className={inputCls}
                />
              </Field>

              <Field label="Vendor Item Name">
                <input
                  type="text"
                  value={editForm.supplier_item_name || ''}
                  onChange={(e) => setEditForm({ ...editForm, supplier_item_name: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)] flex items-center justify-between">
              <div>
                <span className="font-bold text-[#1C1C1C] block">Preferred Vendor for this Item</span>
                <span className="text-[10px] text-[#707070]">System will automatically recommend this vendor</span>
              </div>
              <ToggleSwitch
                active={Boolean(editForm.is_preferred)}
                onChange={() => setEditForm({ ...editForm, is_preferred: !editForm.is_preferred })}
              />
            </div>

            <Field label="Mapping Status">
              <div className="flex items-center gap-2">
                <ToggleSwitch
                  active={Boolean(editForm.is_active)}
                  onChange={() => setEditForm({ ...editForm, is_active: !editForm.is_active })}
                />
                <span className="text-xs text-[#1C1C1C] font-medium">{editForm.is_active ? 'Active' : 'Inactive'}</span>
              </div>
            </Field>

            <div className="flex justify-end gap-2 pt-2 border-t border-[rgba(45,45,45,0.08)]">
              <CancelBtn onClick={() => setEditing(null)} />
              <SubmitBtn loading={actionLoading} label="Save Changes" />
            </div>
          </form>
        </Modal>
      )}

      {/* Delete / Deactivate Confirmation Modal */}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Deactivate Vendor-Item Rate Mapping"
        message={`Are you sure you want to deactivate rate mapping between vendor "${deleteTarget?.supplier_name || 'Vendor'}" and item "${deleteTarget?.item_name || 'Item'}"? The item itself remains safely preserved in Master Items.`}
        loading={actionLoading}
        confirmLabel="Deactivate Mapping"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
};
