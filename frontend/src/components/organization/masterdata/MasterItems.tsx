'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Package, Plus, RefreshCw, Search, Filter, Layers, DollarSign, AlertTriangle, Trash2 } from 'lucide-react';
import { inventoryApi } from '@/api/inventory';
import { procurementApi } from '@/api/procurement';
import { Item, Category, Unit, ItemCreateInput } from '@/types/inventory.types';
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

const itemTypes = [
  { value: 'RAW_MATERIAL', label: 'Raw Material' },
  { value: 'FINISHED_GOOD', label: 'Finished Good' },
  { value: 'SEMI_FINISHED', label: 'Semi-Finished / Prep' },
  { value: 'PACKAGING', label: 'Packaging Material' },
  { value: 'ASSET', label: 'Asset / Equipment' },
];

const supplyTypes = [
  { value: 'CENTRAL_STORE', label: 'Central Store' },
  { value: 'DIRECT_VENDOR', label: 'Direct Vendor' },
  { value: 'RAW_MATERIAL', label: 'Raw Material' },
  { value: 'DAILY_OUTLET_SUPPLY', label: 'Daily Outlet Supply' },
  { value: 'DESSERT_KITCHEN', label: 'Dessert Kitchen' },
];

const emptyItemForm: ItemCreateInput = {
  name: '',
  code: '',
  category_id: '',
  unit_id: '',
  barcode: '',
  type: 'RAW_MATERIAL',
  description: '',
  cost_price: 0,
  selling_price: 0,
  min_stock_level: 10,
  reorder_qty: 50,
  is_active: true,
  supply_source: 'CENTRAL_STORE',
  supplier_id: '',
};

export const MasterItems: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<ItemCreateInput>({ ...emptyItemForm });

  const [editing, setEditing] = useState<Item | null>(null);
  const [editForm, setEditForm] = useState<ItemCreateInput>({ ...emptyItemForm });

  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [deleteReferences, setDeleteReferences] = useState<string[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsData, catsData, unitsData, suppData] = await Promise.all([
        inventoryApi.getItems(),
        inventoryApi.getCategories(),
        inventoryApi.getUnits(),
        procurementApi.getSuppliers(),
      ]);
      setItems(itemsData);
      setCategories(catsData);
      setUnits(unitsData);
      setSuppliers(suppData);

      if (catsData.length > 0 && !createForm.category_id) {
        setCreateForm((prev) => ({ ...prev, category_id: catsData[0].id }));
      }
      if (unitsData.length > 0 && !createForm.unit_id) {
        setCreateForm((prev) => ({ ...prev, unit_id: unitsData[0].id }));
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

  const filtered = items.filter((it) => {
    const matchesSearch =
      it.name.toLowerCase().includes(search.toLowerCase()) ||
      it.code.toLowerCase().includes(search.toLowerCase()) ||
      (it.barcode || '').toLowerCase().includes(search.toLowerCase());

    const matchesCategory = selectedCategory === 'ALL' || it.category_id === selectedCategory;
    const matchesType = selectedType === 'ALL' || it.type === selectedType;
    const matchesStatus =
      selectedStatus === 'ALL' ||
      (selectedStatus === 'ACTIVE' && it.is_active) ||
      (selectedStatus === 'INACTIVE' && !it.is_active);

    return matchesSearch && matchesCategory && matchesType && matchesStatus;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await inventoryApi.createItem({
        ...createForm,
        name: createForm.name.trim(),
        code: createForm.code.trim().toUpperCase(),
        cost_price: Number(createForm.cost_price || 0),
        selling_price: Number(createForm.selling_price || 0),
        min_stock_level: Number(createForm.min_stock_level || 0),
        reorder_qty: Number(createForm.reorder_qty || 0),
        supplier_id: createForm.supplier_id || undefined,
      });
      setFeedback({ type: 'success', message: `Item "${createForm.name}" created successfully.` });
      setShowCreate(false);
      setCreateForm({
        ...emptyItemForm,
        category_id: categories[0]?.id || '',
        unit_id: units[0]?.id || '',
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
      await inventoryApi.updateItem(editing.id, {
        ...editForm,
        name: editForm.name.trim(),
        code: editForm.code.trim().toUpperCase(),
        cost_price: Number(editForm.cost_price || 0),
        selling_price: Number(editForm.selling_price || 0),
        min_stock_level: Number(editForm.min_stock_level || 0),
        reorder_qty: Number(editForm.reorder_qty || 0),
        supplier_id: editForm.supplier_id || undefined,
      });
      setFeedback({ type: 'success', message: `Item "${editForm.name}" updated successfully.` });
      setEditing(null);
      await loadAll();
    } catch (err: any) {
      setFeedback({ type: 'error', message: ErrDetail(err) });
    } finally {
      setActionLoading(false);
    }
  };

  const toggleActive = async (item: Item) => {
    setActionLoading(true);
    const newStatus = !item.is_active;
    try {
      await inventoryApi.updateItem(item.id, { is_active: newStatus });
      setFeedback({
        type: 'success',
        message: `Item "${item.name}" ${newStatus ? 'activated' : 'deactivated'}.`,
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
    const permanent = !deleteTarget.is_active;

    try {
      const res: any = await inventoryApi.deleteItem(deleteTarget.id, { permanent });
      const refs = res?.references as string[] | undefined;

      if (res?.permanently_deleted) {
        setFeedback({
          type: 'success',
          message: res?.message || `Inactive item "${deleteTarget.name}" permanently deleted.`,
        });
      } else if (res?.deactivated || (refs && refs.length)) {
        setFeedback({
          type: 'success',
          message: `Item "${deleteTarget.name}" deactivated because it is referenced by existing records (${refs?.join(' · ') || 'Protected'}).`,
        });
      } else {
        setFeedback({
          type: 'success',
          message: res?.message || `Item "${deleteTarget.name}" deleted successfully.`,
        });
      }

      setDeleteTarget(null);
      setDeleteReferences([]);
      await loadAll();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;

      if (detail && typeof detail === 'object' && detail.references) {
        setDeleteReferences(detail.references);
        setFeedback({
          type: 'error',
          message: `${detail.message || 'Cannot permanently delete item.'} ${detail.references.join(' · ')}`,
        });
      } else {
        setFeedback({ type: 'error', message: ErrDetail(err) });
      }
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
              placeholder="Search items by code, name, barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white border border-[rgba(45,45,45,0.12)] focus:outline-none focus:border-[#C79A3B] text-[#1C1C1C]"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#707070]" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl bg-white border border-[rgba(45,45,45,0.12)] focus:outline-none focus:border-[#C79A3B] text-[#1C1C1C]"
            >
              <option value="ALL">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl bg-white border border-[rgba(45,45,45,0.12)] focus:outline-none focus:border-[#C79A3B] text-[#1C1C1C]"
            >
              <option value="ALL">All Types</option>
              {itemTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
              className="px-3 py-1.5 text-xs rounded-xl bg-white border border-[rgba(45,45,45,0.12)] focus:outline-none focus:border-[#C79A3B] text-[#1C1C1C]"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
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
                ...emptyItemForm,
                category_id: categories[0]?.id || '',
                unit_id: units[0]?.id || '',
              });
              setShowCreate(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#C79A3B] to-[#B8862D] text-white text-xs font-semibold shadow-md shadow-[#C79A3B]/20 transition-all hover:brightness-105 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Item</span>
          </button>
        </div>
      </div>

      {/* ERP Horizontal Item Register */}
      {loading ? (
        <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-xs text-[#707070]">
          <RefreshCw className="h-6 w-6 animate-spin text-[#C79A3B]" />
          <span>Loading Item Master...</span>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          message={
            search ||
            selectedCategory !== 'ALL' ||
            selectedType !== 'ALL' ||
            selectedStatus !== 'ALL'
              ? 'No items match your filter criteria.'
              : 'No items registered in item master.'
          }
          icon={<Package className="h-6 w-6" />}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[rgba(45,45,45,0.09)] bg-white shadow-sm">
          <div className="min-w-[1080px]">
            {/* Column Header */}
            <div className="grid grid-cols-[2fr_1fr_1.25fr_1.35fr_0.9fr_1fr_0.9fr_1.35fr] items-center border-b border-[rgba(45,45,45,0.08)] bg-[#FAF8F5] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#707070]">
              <div>Item</div>
              <div>Category</div>
              <div>Type</div>
              <div>Supply</div>
              <div>Cost</div>
              <div>Stock / Reorder</div>
              <div>Status</div>
              <div className="text-right">Actions</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-[rgba(45,45,45,0.07)]">
              {filtered.map((item) => {
                const isActive = item.is_active;
                const categoryName =
                  item.category_name ||
                  categories.find((c) => c.id === item.category_id)?.name ||
                  'Category';
                const unitSymbol =
                  item.unit_symbol ||
                  units.find((u) => u.id === item.unit_id)?.symbol ||
                  'UNIT';
                const supplyLabel =
                  supplyTypes.find(
                    (t) => t.value === (item.supply_source || 'CENTRAL_STORE'),
                  )?.label ||
                  item.supply_source ||
                  'Central Store';
                const vendorName = item.supplier_id
                  ? suppliers.find((s) => s.id === item.supplier_id)?.name
                  : '';

                return (
                  <div
                    key={item.id}
                    className={`grid grid-cols-[2fr_1fr_1.25fr_1.35fr_0.9fr_1fr_0.9fr_1.35fr] items-center px-4 py-3.5 transition-colors ${
                      isActive
                        ? 'bg-white hover:bg-[#FFFCF7]'
                        : 'bg-[#FCFAF8] opacity-80 hover:bg-[#FAF6F2]'
                    }`}
                  >
                    {/* Item */}
                    <div className="min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-xs font-semibold text-[#1C1C1C]">
                          {item.name}
                        </p>
                        <StatusPill active={isActive} />
                      </div>

                      <div className="mt-1 flex items-center gap-2">
                        <span className="font-mono text-[10px] font-semibold text-[#B8862D]">
                          {item.code}
                        </span>
                        {item.barcode && (
                          <span className="truncate font-mono text-[9px] text-[#8A8A8A]">
                            {item.barcode}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Category */}
                    <div className="min-w-0 pr-3">
                      <p className="truncate text-[11px] font-medium text-[#454545]">
                        {categoryName}
                      </p>
                    </div>

                    {/* Type */}
                    <div className="min-w-0 pr-3">
                      <span className="inline-flex max-w-full truncate rounded-md border border-[rgba(45,45,45,0.09)] bg-[#FAF8F5] px-2 py-1 text-[10px] font-semibold text-[#555]">
                        {item.type.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {/* Supply */}
                    <div className="min-w-0 pr-3">
                      <p className="truncate text-[10px] font-semibold text-[#B8862D]">
                        {supplyLabel}
                      </p>
                      {vendorName && (
                        <p className="mt-0.5 truncate text-[9px] text-[#777]">
                          {vendorName}
                        </p>
                      )}
                    </div>

                    {/* Cost */}
                    <div className="pr-3">
                      <p className="text-xs font-bold text-[#1C1C1C]">
                        ₹{Number(item.cost_price || 0).toFixed(2)}
                      </p>
                      <p className="mt-0.5 text-[9px] text-[#8A8A8A]">{unitSymbol}</p>
                    </div>

                    {/* Stock / Reorder */}
                    <div className="pr-3">
                      <div className="text-[10px] text-[#707070]">
                        Min:{' '}
                        <span className="font-semibold text-[#D99625]">
                          {Number(item.min_stock_level || 0)}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-[#707070]">
                        Reorder:{' '}
                        <span className="font-semibold text-[#2E8B57]">
                          {Number(item.reorder_qty || 0)}
                        </span>
                      </div>
                    </div>

                    {/* Status */}
                    <div>
                      <div className="flex items-center gap-2">
                        <ToggleSwitch
                          active={isActive}
                          onChange={() => toggleActive(item)}
                          title={isActive ? 'Deactivate Item' : 'Activate Item'}
                        />
                        <span
                          className={`text-[10px] font-semibold ${
                            isActive ? 'text-[#2E8B57]' : 'text-[#8A8A8A]'
                          }`}
                        >
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1.5">
                      <EditBtn
                        onClick={() => {
                          setEditing(item);
                          setEditForm({
                            name: item.name,
                            code: item.code,
                            category_id: item.category_id,
                            unit_id: item.unit_id,
                            barcode: item.barcode || '',
                            type: item.type,
                            description: item.description || '',
                            cost_price: Number(item.cost_price || 0),
                            selling_price: Number(item.selling_price || 0),
                            min_stock_level: Number(item.min_stock_level || 0),
                            reorder_qty: Number(item.reorder_qty || 0),
                            is_active: item.is_active,
                            supply_source: item.supply_source || 'CENTRAL_STORE',
                            supplier_id: item.supplier_id || '',
                          });
                        }}
                      />

                      <button
                        type="button"
                        onClick={() => {
                          setDeleteTarget(item);
                          setDeleteReferences([]);
                        }}
                        disabled={actionLoading}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition-all disabled:opacity-50 ${
                          isActive
                            ? 'border-[#D9534F]/25 text-[#D9534F] hover:bg-[#D9534F]/5'
                            : 'border-[#8B5CF6]/25 text-[#7C3AED] hover:bg-[#8B5CF6]/5'
                        }`}
                        title={isActive ? 'Fast Delete' : 'Permanent Delete'}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {isActive ? 'Delete' : 'Permanent'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <Modal title="Create Master Item" subtitle="Add standard item to Master Catalog (shared across all vendors & outlets)" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Item Name" required>
                <input
                  type="text"
                  required
                  placeholder="e.g. Basmati Rice, Sunflower Oil"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Item Code" required>
                <input
                  type="text"
                  required
                  placeholder="e.g. ITM-RICE-01"
                  value={createForm.code}
                  onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Category" required>
                <select
                  required
                  value={createForm.category_id}
                  onChange={(e) => setCreateForm({ ...createForm, category_id: e.target.value })}
                  className={inputCls}
                >
                  <option value="" disabled>Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Base Stock Unit" required>
                <select
                  required
                  value={createForm.unit_id}
                  onChange={(e) => setCreateForm({ ...createForm, unit_id: e.target.value })}
                  className={inputCls}
                >
                  <option value="" disabled>Select base unit</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Item Classification">
                <select
                  value={createForm.type}
                  onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
                  className={inputCls}
                >
                  {itemTypes.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Barcode (Optional)">
                <input
                  type="text"
                  placeholder="e.g. 8901234567890"
                  value={createForm.barcode || ''}
                  onChange={(e) => setCreateForm({ ...createForm, barcode: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Supply Type (Fulfillment)" required>
                <select
                  required
                  value={createForm.supply_source || 'CENTRAL_STORE'}
                  onChange={(e) => setCreateForm({ ...createForm, supply_source: e.target.value, supplier_id: '' })}
                  className={inputCls}
                >
                  {supplyTypes.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Default Vendor (If applicable)">
                <select
                  value={createForm.supplier_id || ''}
                  onChange={(e) => setCreateForm({ ...createForm, supplier_id: e.target.value })}
                  className={inputCls}
                  disabled={!['DIRECT_VENDOR', 'DAILY_OUTLET_SUPPLY'].includes(createForm.supply_source || '')}
                >
                  <option value="">Select Vendor...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Field label="Default Cost (₹)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={createForm.cost_price}
                  onChange={(e) => setCreateForm({ ...createForm, cost_price: parseFloat(e.target.value) || 0 })}
                  className={inputCls}
                />
              </Field>
              <Field label="Selling Price (₹)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={createForm.selling_price}
                  onChange={(e) => setCreateForm({ ...createForm, selling_price: parseFloat(e.target.value) || 0 })}
                  className={inputCls}
                />
              </Field>
              <Field label="Min Stock Level">
                <input
                  type="number"
                  min="0"
                  value={createForm.min_stock_level}
                  onChange={(e) => setCreateForm({ ...createForm, min_stock_level: parseFloat(e.target.value) || 0 })}
                  className={inputCls}
                />
              </Field>
              <Field label="Reorder Qty">
                <input
                  type="number"
                  min="0"
                  value={createForm.reorder_qty}
                  onChange={(e) => setCreateForm({ ...createForm, reorder_qty: parseFloat(e.target.value) || 0 })}
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Description (Optional)">
              <textarea
                rows={2}
                placeholder="Product specifications, packaging notes, storage instructions..."
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                className={inputCls}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2 border-t border-[rgba(45,45,45,0.08)]">
              <CancelBtn onClick={() => setShowCreate(false)} />
              <SubmitBtn loading={actionLoading} label="Create Item" />
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {editing && (
        <Modal title={`Edit Item: ${editing.name}`} onClose={() => setEditing(null)}>
          <form onSubmit={handleUpdate} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Item Name" required>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Item Code" required>
                <input
                  type="text"
                  required
                  value={editForm.code}
                  onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Category" required>
                <select
                  required
                  value={editForm.category_id}
                  onChange={(e) => setEditForm({ ...editForm, category_id: e.target.value })}
                  className={inputCls}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Base Stock Unit" required>
                <select
                  required
                  value={editForm.unit_id}
                  onChange={(e) => setEditForm({ ...editForm, unit_id: e.target.value })}
                  className={inputCls}
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Item Classification">
                <select
                  value={editForm.type}
                  onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                  className={inputCls}
                >
                  {itemTypes.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Barcode">
                <input
                  type="text"
                  value={editForm.barcode || ''}
                  onChange={(e) => setEditForm({ ...editForm, barcode: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Supply Type (Fulfillment)" required>
                <select
                  required
                  value={editForm.supply_source || 'CENTRAL_STORE'}
                  onChange={(e) => setEditForm({ ...editForm, supply_source: e.target.value, supplier_id: '' })}
                  className={inputCls}
                >
                  {supplyTypes.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Default Vendor (If applicable)">
                <select
                  value={editForm.supplier_id || ''}
                  onChange={(e) => setEditForm({ ...editForm, supplier_id: e.target.value })}
                  className={inputCls}
                  disabled={!['DIRECT_VENDOR', 'DAILY_OUTLET_SUPPLY'].includes(editForm.supply_source || '')}
                >
                  <option value="">Select Vendor...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Field label="Cost Price (₹)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.cost_price}
                  onChange={(e) => setEditForm({ ...editForm, cost_price: parseFloat(e.target.value) || 0 })}
                  className={inputCls}
                />
              </Field>
              <Field label="Selling Price (₹)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.selling_price}
                  onChange={(e) => setEditForm({ ...editForm, selling_price: parseFloat(e.target.value) || 0 })}
                  className={inputCls}
                />
              </Field>
              <Field label="Min Stock Level">
                <input
                  type="number"
                  min="0"
                  value={editForm.min_stock_level}
                  onChange={(e) => setEditForm({ ...editForm, min_stock_level: parseFloat(e.target.value) || 0 })}
                  className={inputCls}
                />
              </Field>
              <Field label="Reorder Qty">
                <input
                  type="number"
                  min="0"
                  value={editForm.reorder_qty}
                  onChange={(e) => setEditForm({ ...editForm, reorder_qty: parseFloat(e.target.value) || 0 })}
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Description">
              <textarea
                rows={2}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className={inputCls}
              />
            </Field>

            <Field label="Status">
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

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={deleteTarget?.is_active ? 'Fast Delete Item' : 'Permanent Delete Inactive Item'}
        message={
          deleteTarget?.is_active
            ? `Fast Delete "${deleteTarget?.name}" now? The active item will be removed from active use; if protected by existing records, it will be kept as Inactive instead of corrupting history.`
            : `Permanently delete inactive item "${deleteTarget?.name}"? This permanently removes the selected inactive item and its safely removable item-owned records.`
        }
        details={deleteReferences}
        loading={actionLoading}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteReferences([]);
        }}
        onConfirm={confirmDelete}
      />
    </div>
  );
};
