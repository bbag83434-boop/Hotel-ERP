'use client';

import React, { useState, useEffect } from 'react';
import { inventoryApi } from '@/api/inventory';
import { Category, Unit, ItemCreateInput, Item } from '@/types/inventory.types';
import { Package, X } from 'lucide-react';

interface ItemCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newItem: Item) => void;
  categories: Category[];
  units: Unit[];
}

export const ItemCreateModal: React.FC<ItemCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  categories,
  units,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<ItemCreateInput>({
    name: '',
    code: '',
    category_id: '',
    unit_id: '',
    type: 'RAW_MATERIAL',
    cost_price: 0,
    selling_price: 0,
    min_stock_level: 10,
    reorder_qty: 50,
  });

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setForm({
        name: '',
        code: '',
        category_id: categories[0]?.id || '',
        unit_id: units[0]?.id || '',
        type: 'RAW_MATERIAL',
        cost_price: 0,
        selling_price: 0,
        min_stock_level: 10,
        reorder_qty: 50,
      });
    }
  }, [isOpen, categories, units]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const createdItem = await inventoryApi.createItem({
        ...form,
        cost_price: Number(form.cost_price),
        selling_price: Number(form.selling_price),
        min_stock_level: Number(form.min_stock_level),
        reorder_qty: Number(form.reorder_qty),
      });
      onSuccess(createdItem);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to create item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-[rgba(45,45,45,0.12)] space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[rgba(45,45,45,0.08)] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#F1E4C5] text-[#B8862D] flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#1C1C1C] font-['Outfit']">Create New Master Item</h3>
              <p className="text-[11px] text-[#707070]">Add a SKU to the multi-outlet central inventory</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-[#D9534F]/10 border border-[#D9534F]/30 text-[#D9534F] text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-[#707070] font-semibold mb-1">Item Name *</label>
            <input
              required
              type="text"
              placeholder="e.g. Organic Almond Flour"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] focus:bg-white focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#707070] font-semibold mb-1">SKU / Item Code *</label>
              <input
                required
                type="text"
                placeholder="e.g. RAW-ALM-01"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] focus:bg-white focus:border-[#C79A3B] outline-none font-mono text-[#1C1C1C]"
              />
            </div>
            <div>
              <label className="block text-[#707070] font-semibold mb-1">Item Type *</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] focus:bg-white focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
              >
                <option value="RAW_MATERIAL">Raw Material</option>
                <option value="FINISHED_GOOD">Finished Good</option>
                <option value="SEMI_FINISHED">Semi Finished / Prep</option>
                <option value="PACKAGING">Packaging</option>
                <option value="ASSET">Asset</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#707070] font-semibold mb-1">Category *</label>
              <select
                required
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] focus:bg-white focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
              >
                {categories.length === 0 && <option value="">No categories available</option>}
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} [{c.code}]
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[#707070] font-semibold mb-1">Unit of Measure *</label>
              <select
                required
                value={form.unit_id}
                onChange={(e) => setForm({ ...form, unit_id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] focus:bg-white focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
              >
                {units.length === 0 && <option value="">No units available</option>}
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#707070] font-semibold mb-1">Cost Price ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.cost_price}
                onChange={(e) => setForm({ ...form, cost_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] focus:bg-white focus:border-[#C79A3B] outline-none font-mono text-[#1C1C1C]"
              />
            </div>
            <div>
              <label className="block text-[#707070] font-semibold mb-1">Selling Price ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.selling_price}
                onChange={(e) => setForm({ ...form, selling_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] focus:bg-white focus:border-[#C79A3B] outline-none font-mono text-[#1C1C1C]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#707070] font-semibold mb-1">Min Stock Level</label>
              <input
                type="number"
                min="0"
                value={form.min_stock_level}
                onChange={(e) => setForm({ ...form, min_stock_level: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] focus:bg-white focus:border-[#C79A3B] outline-none font-mono text-[#1C1C1C]"
              />
            </div>
            <div>
              <label className="block text-[#707070] font-semibold mb-1">Reorder Quantity</label>
              <input
                type="number"
                min="0"
                value={form.reorder_qty}
                onChange={(e) => setForm({ ...form, reorder_qty: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] focus:bg-white focus:border-[#C79A3B] outline-none font-mono text-[#1C1C1C]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[rgba(45,45,45,0.06)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[rgba(45,45,45,0.15)] text-[#707070] hover:bg-[#FAF8F5] font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#C79A3B] to-[#B8862D] hover:brightness-105 text-white font-semibold shadow-md shadow-[#C79A3B]/20 disabled:opacity-60 transition-all"
            >
              {loading ? 'Creating...' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ItemCreateModal;
