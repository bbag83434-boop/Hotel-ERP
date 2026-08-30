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
  CardActionRow,
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]" />
            <input
              type="text"
              placeholder="Search by vendor, item, code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white border border-[rgba(45,45,45,0.12)] focus:outline-none focus:border-[#C79A3B] text-[#1C1C1C]"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#707070]" />
            <select
              value={selectedVendorFilter}
              onChange={(e) => setSelectedVendorFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl bg-white border border-[rgba(45,45,45,0.12)] focus:outline-none focus:border-[#C79A3B] text-[#1C1C1C] max-w-[180px]"
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
              className="px-3 py-1.5 text-xs rounded-xl bg-white border border-[rgba(45,45,45,0.12)] focus:outline-none focus:border-[#C79A3B] text-[#1C1C1C] max-w-[180px]"
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

        <div className="flex items-center gap-2">
          <button
            onClick={loadAll}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[rgba(45,45,45,0.12)] hover:bg-[#FAF8F5] text-xs font-semibold text-[#1C1C1C] transition-all shadow-sm disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#C79A3B] ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
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
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#C79A3B] to-[#B8862D] text-white text-xs font-semibold shadow-md shadow-[#C79A3B]/20 transition-all hover:brightness-105 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Map Vendor Item & Rate</span>
          </button>
        </div>
      </div>

      {/* Grid of Vendor-Item Mappings */}
      {loading ? (
        <div className="p-12 text-center text-[#707070] text-xs flex flex-col items-center justify-center gap-3">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filtered.map((m) => {
            const vendor = vendors.find((v) => v.id === m.supplier_id);
            const item = items.find((i) => i.id === m.item_id);
            const vName = m.supplier_name || vendor?.name || 'Unknown Vendor';
            const iName = m.item_name || item?.name || 'Unknown Item';
            const iCode = m.item_code || item?.code || '';
            const pUnit = m.purchase_unit_symbol || m.base_unit_symbol || 'UNIT';
            const isActive = m.is_active;

            return (
              <div
                key={m.id}
                className={`p-4 rounded-2xl border transition-all space-y-3 bg-white ${
                  isActive ? 'border-[rgba(45,45,45,0.08)] shadow-sm hover:border-[#C79A3B]/40' : 'border-[#D9534F]/20 opacity-75 bg-[#FAF8F5]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-[#C79A3B]" />
                      <span className="font-bold text-xs text-[#1C1C1C] truncate max-w-[180px]">{vName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 pl-5">
                      <span className="text-xs font-semibold text-[#1C1C1C]">{iName}</span>
                      {iCode && <span className="text-[10px] font-mono text-[#707070]">[{iCode}]</span>}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <StatusPill active={isActive} />
                    {m.is_preferred && (
                      <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-[#F1E4C5] text-[#B8862D] border border-[#B8862D]/30 flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5 fill-[#B8862D]" /> Preferred
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-[#707070] block">Vendor Rate</span>
                    <span className="font-extrabold text-sm text-[#1C1C1C]">
                      ₹{Number(m.purchase_price || 0).toFixed(2)} / {pUnit}
                    </span>
                  </div>

                  <div className="text-right text-[11px] text-[#707070]">
                    <span>Lead time: <span className="font-semibold text-[#1C1C1C]">{m.lead_time_days || 1}d</span></span>
                    {Number(m.conversion_rate || 1) !== 1 && (
                      <span className="block text-[10px]">Ratio: 1 {pUnit} = {Number(m.conversion_rate)} Base</span>
                    )}
                  </div>
                </div>

                {m.supplier_item_code && (
                  <p className="text-[10px] font-mono text-[#707070]">
                    Vendor SKU / Code: <span className="font-bold text-[#1C1C1C]">{m.supplier_item_code}</span>
                  </p>
                )}

                <CardActionRow>
                  <div className="flex items-center gap-2">
                    <ToggleSwitch
                      active={isActive}
                      onChange={() => toggleActive(m)}
                      title={isActive ? 'Deactivate Rate Mapping' : 'Activate Rate Mapping'}
                    />
                    <button
                      onClick={() => togglePreferred(m)}
                      title={m.is_preferred ? 'Remove Preferred Vendor status' : 'Set as Preferred Vendor'}
                      className={`p-1 rounded-lg border text-xs transition-colors ${
                        m.is_preferred
                          ? 'bg-[#F1E4C5] text-[#B8862D] border-[#B8862D]/40'
                          : 'bg-white text-[#707070] border-[rgba(45,45,45,0.12)] hover:text-[#B8862D]'
                      }`}
                    >
                      <Star className={`w-3.5 h-3.5 ${m.is_preferred ? 'fill-[#B8862D]' : ''}`} />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
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
                    <DeleteBtn
                      label="Remove"
                      onClick={() => {
                        setDeleteTarget(m);
                      }}
                    />
                  </div>
                </CardActionRow>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <Modal
          title="Map Vendor Item & Specific Rate"
          subtitle="Link an existing master item to a vendor with a negotiated purchase price"
          onClose={() => setShowCreate(false)}
        >
          <form onSubmit={handleCreate} className="space-y-3 text-xs">
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
          <form onSubmit={handleUpdate} className="space-y-3 text-xs">
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
