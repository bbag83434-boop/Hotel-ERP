'use client';

import React, { useState, useEffect } from 'react';
import { inventoryApi } from '@/api/inventory';
import { Unit } from '@/types/inventory.types';
import { Layers, X } from 'lucide-react';

interface UnitCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newUnit: Unit) => void;
}

export const UnitCreateModal: React.FC<UnitCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    symbol: '',
  });

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setForm({ name: '', symbol: '' });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const createdUnit = await inventoryApi.createUnit({
        name: form.name.trim(),
        symbol: form.symbol.trim(),
      });
      onSuccess(createdUnit);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to create unit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-[rgba(45,45,45,0.12)] space-y-4">
        <div className="flex items-center justify-between border-b border-[rgba(45,45,45,0.08)] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#F1E4C5] text-[#B8862D] flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#1C1C1C] font-['Outfit']">New Unit of Measure</h3>
              <p className="text-[11px] text-[#707070]">Standard quantity units (kg, ltr, pcs)</p>
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
            <label className="block text-[#707070] font-semibold mb-1">Unit Name *</label>
            <input
              required
              type="text"
              placeholder="e.g. Kilogram"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] focus:bg-white focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
            />
          </div>

          <div>
            <label className="block text-[#707070] font-semibold mb-1">Unit Symbol *</label>
            <input
              required
              type="text"
              placeholder="e.g. kg"
              value={form.symbol}
              onChange={(e) => setForm({ ...form, symbol: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] focus:bg-white focus:border-[#C79A3B] outline-none font-mono text-[#1C1C1C]"
            />
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
              {loading ? 'Creating...' : 'Create Unit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UnitCreateModal;
