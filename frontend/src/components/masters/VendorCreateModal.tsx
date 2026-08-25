'use client';

import React, { useState, useEffect } from 'react';
import { procurementApi } from '@/api/procurement';
import { Supplier } from '@/types/purchase.types';
import { Building2, X } from 'lucide-react';

interface VendorCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newVendor: Supplier) => void;
}

export const VendorCreateModal: React.FC<VendorCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    code: '',
    contact_person: '',
    phone: '',
    whatsapp_number: '',
    email: '',
    address: '',
    gst_number: '',
    payment_terms: 'Net 15 Days',
    is_active: true,
  });

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setForm({
        name: '',
        code: '',
        contact_person: '',
        phone: '',
        whatsapp_number: '',
        email: '',
        address: '',
        gst_number: '',
        payment_terms: 'Net 15 Days',
        is_active: true,
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const createdVendor = await procurementApi.createSupplier({
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        contactPerson: form.contact_person.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        paymentTerms: form.payment_terms.trim() || undefined,
        isActive: form.is_active,
      });
      onSuccess(createdVendor);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to create vendor');
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
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#1C1C1C] font-['Outfit']">Add New Vendor / Supplier</h3>
              <p className="text-[11px] text-[#707070]">Register approved procurement vendor with contact terms</p>
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
            <label className="block text-[#707070] font-semibold mb-1">Vendor / Company Name *</label>
            <input
              required
              type="text"
              placeholder="e.g. Heritage Dairy Farms Ltd"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] focus:bg-white focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#707070] font-semibold mb-1">Vendor Code *</label>
              <input
                required
                type="text"
                placeholder="e.g. SUP-DAIRY-01"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] focus:bg-white focus:border-[#C79A3B] outline-none font-mono text-[#1C1C1C]"
              />
            </div>
            <div>
              <label className="block text-[#707070] font-semibold mb-1">Contact Person</label>
              <input
                type="text"
                placeholder="e.g. Rajesh Sharma"
                value={form.contact_person}
                onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] focus:bg-white focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#707070] font-semibold mb-1">Phone / WhatsApp</label>
              <input
                type="tel"
                placeholder="e.g. +91 98765 43210"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value, whatsapp_number: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] focus:bg-white focus:border-[#C79A3B] outline-none font-mono text-[#1C1C1C]"
              />
            </div>
            <div>
              <label className="block text-[#707070] font-semibold mb-1">Email Address</label>
              <input
                type="email"
                placeholder="e.g. orders@heritagedairy.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] focus:bg-white focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#707070] font-semibold mb-1">Payment Terms</label>
              <select
                value={form.payment_terms}
                onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] focus:bg-white focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
              >
                <option value="Immediate / Cash on Delivery">Immediate / COD</option>
                <option value="Net 7 Days">Net 7 Days</option>
                <option value="Net 15 Days">Net 15 Days</option>
                <option value="Net 30 Days">Net 30 Days</option>
                <option value="Net 45 Days">Net 45 Days</option>
              </select>
            </div>
            <div>
              <label className="block text-[#707070] font-semibold mb-1">Status</label>
              <select
                value={form.is_active ? 'true' : 'false'}
                onChange={(e) => setForm({ ...form, is_active: e.target.value === 'true' })}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] focus:bg-white focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
              >
                <option value="true">Active Vendor</option>
                <option value="false">Inactive / Suspended</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[#707070] font-semibold mb-1">Address / Dispatch Hub</label>
            <input
              type="text"
              placeholder="e.g. Plot 42, Industrial Area, Sector 5"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] focus:bg-white focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
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
              {loading ? 'Registering...' : 'Register Vendor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VendorCreateModal;
