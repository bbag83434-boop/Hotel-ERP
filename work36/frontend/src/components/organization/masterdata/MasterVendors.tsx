'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Truck, Plus, RefreshCw, Search, Phone, MessageCircle } from 'lucide-react';
import { procurementApi } from '@/api/procurement';
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

interface Vendor {
  id: string;
  company_id?: string;
  name: string;
  code: string;
  contact_person?: string;
  phone?: string;
  whatsapp_number?: string;
  email?: string;
  address?: string;
  gst_number?: string;
  payment_terms?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

const emptyForm = {
  name: '',
  code: '',
  contact_person: '',
  phone: '',
  whatsapp_number: '',
  email: '',
  address: '',
  gst_number: '',
  payment_terms: '',
  is_active: true,
};

export const MasterVendors: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ ...emptyForm });
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
  const [deleteReferences, setDeleteReferences] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await procurementApi.getSuppliers();
      setVendors(data as unknown as Vendor[]);
    } catch (err: any) {
      setFeedback({ type: 'error', message: ErrDetail(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = vendors.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      (v.code || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.phone || '').includes(search) ||
      (v.contact_person || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await procurementApi.createSupplier({
        ...createForm,
        name: createForm.name.trim(),
        code: createForm.code.trim().toUpperCase(),
      });
      setFeedback({ type: 'success', message: `Vendor "${createForm.name}" created successfully.` });
      setShowCreate(false);
      setCreateForm({ ...emptyForm });
      await load();
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
      await procurementApi.updateSupplier(editing.id, {
        ...editForm,
        name: editForm.name.trim(),
        code: editForm.code.trim().toUpperCase(),
      });
      setFeedback({ type: 'success', message: `Vendor "${editForm.name}" updated successfully.` });
      setEditing(null);
      await load();
    } catch (err: any) {
      setFeedback({ type: 'error', message: ErrDetail(err) });
    } finally {
      setActionLoading(false);
    }
  };

  const toggleActive = async (v: Vendor) => {
    setActionLoading(true);
    const currentActive = v.is_active !== false && (v as any).isActive !== false;
    const newStatus = !currentActive;
    try {
      await procurementApi.updateSupplier(v.id, { is_active: newStatus, isActive: newStatus });
      setFeedback({
        type: 'success',
        message: `Vendor "${v.name}" ${newStatus ? 'activated' : 'deactivated'}.`,
      });
      await load();
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
      const res: any = await procurementApi.deleteSupplier(deleteTarget.id);
      const references = res?.references as string[] | undefined;
      setFeedback({
        type: references && references.length ? 'error' : 'success',
        message: references && references.length
          ? `Cannot delete: ${references.join(' · ')}. Set the vendor Inactive instead.`
          : (res?.message || 'Vendor deleted successfully.'),
      });
      setDeleteTarget(null);
      setDeleteReferences([]);
      await load();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail && typeof detail === 'object' && detail.references) {
        setDeleteReferences(detail.references);
        setFeedback({
          type: 'error',
          message: `${detail.message || 'Cannot delete vendor.'} ${detail.references.join(' · ')}`,
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendors by name, code, phone, contact..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white border border-[rgba(45,45,45,0.12)] focus:outline-none focus:border-[#C79A3B] text-[#1C1C1C]"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[rgba(45,45,45,0.12)] hover:bg-[#FAF8F5] text-xs font-semibold text-[#1C1C1C] transition-all shadow-sm disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#C79A3B] ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
          <button
            onClick={() => {
              setCreateForm({ ...emptyForm });
              setShowCreate(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#C79A3B] to-[#B8862D] text-white text-xs font-semibold shadow-md shadow-[#C79A3B]/20 transition-all hover:brightness-105 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Vendor</span>
          </button>
        </div>
      </div>

      {/* Grid of Vendors */}
      {loading ? (
        <div className="p-12 text-center text-[#707070] text-xs flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-[#C79A3B]" />
          <span>Loading Vendors / Suppliers...</span>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          message={search ? 'No vendors matched your search.' : 'No vendors registered yet.'}
          icon={<Truck className="w-6 h-6" />}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filtered.map((v) => {
            const isActive = v.is_active !== false && (v as any).isActive !== false;
            return (
              <div
                key={v.id}
                className={`p-4 rounded-2xl border transition-all space-y-3 bg-white ${
                  isActive ? 'border-[rgba(45,45,45,0.08)] shadow-sm hover:border-[#C79A3B]/40' : 'border-[#D9534F]/20 opacity-75 bg-[#FAF8F5]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-[#1C1C1C] font-['Outfit'] truncate">{v.name}</h4>
                    <p className="text-[11px] font-mono text-[#B8862D] mt-0.5">[{v.code}]</p>
                  </div>
                  <StatusPill active={isActive} />
                </div>

                <div className="space-y-1.5 text-[11px] text-[#707070]">
                  {v.contact_person && (
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-medium text-[#1C1C1C]">Contact:</span> {v.contact_person}
                    </div>
                  )}
                  {v.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-[#C79A3B] shrink-0" />
                      <span className="truncate">{v.phone}</span>
                      {v.whatsapp_number && (
                        <span className="flex items-center gap-1 text-[#2E8B57] font-semibold shrink-0">
                          <MessageCircle className="w-3 h-3" /> WhatsApp
                        </span>
                      )}
                    </div>
                  )}
                  {!v.phone && v.whatsapp_number && (
                    <div className="flex items-center gap-1.5 text-[#2E8B57] font-semibold">
                      <MessageCircle className="w-3 h-3" /> {v.whatsapp_number}
                    </div>
                  )}
                  {v.email && <div className="truncate">✉ {v.email}</div>}
                  {v.address && <div className="truncate">📍 {v.address}</div>}
                  {v.gst_number && <div className="truncate text-[10px] font-mono">GST: {v.gst_number}</div>}
                </div>

                <CardActionRow>
                  <div className="flex items-center gap-2">
                    <ToggleSwitch
                      active={isActive}
                      onChange={() => toggleActive(v)}
                      title={isActive ? 'Deactivate' : 'Activate'}
                    />
                    <span className="text-[10px] text-[#707070]">{isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <EditBtn
                      onClick={() => {
                        setEditing(v);
                        setEditForm({
                          name: v.name,
                          code: v.code,
                          contact_person: v.contact_person || '',
                          phone: v.phone || '',
                          whatsapp_number: v.whatsapp_number || '',
                          email: v.email || '',
                          address: v.address || '',
                          gst_number: v.gst_number || '',
                          payment_terms: v.payment_terms || '',
                          is_active: isActive,
                        });
                      }}
                    />
                    <DeleteBtn
                      onClick={() => {
                        setDeleteTarget(v);
                        setDeleteReferences([]);
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
        <Modal title="Register New Vendor / Supplier" subtitle="Add vendor profile for automated purchase grouping & WhatsApp dispatch" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Vendor Company Name" required>
                <input
                  type="text"
                  required
                  placeholder="e.g. ABC Foods Ltd"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Vendor Code" required>
                <input
                  type="text"
                  required
                  placeholder="e.g. VEN-ABC"
                  value={createForm.code}
                  onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Contact Person">
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={createForm.contact_person}
                  onChange={(e) => setCreateForm({ ...createForm, contact_person: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Phone Number">
                <input
                  type="tel"
                  placeholder="e.g. +91 98765 43210"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="WhatsApp Number (for PO dispatch)">
                <input
                  type="tel"
                  placeholder="e.g. 919876543210"
                  value={createForm.whatsapp_number}
                  onChange={(e) => setCreateForm({ ...createForm, whatsapp_number: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Email Address">
                <input
                  type="email"
                  placeholder="e.g. sales@abcfoods.com"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="GST / Tax ID Number">
                <input
                  type="text"
                  placeholder="e.g. 27AAAAA0000A1Z5"
                  value={createForm.gst_number}
                  onChange={(e) => setCreateForm({ ...createForm, gst_number: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Payment Terms">
                <input
                  type="text"
                  placeholder="e.g. Net 30 Days, COD"
                  value={createForm.payment_terms}
                  onChange={(e) => setCreateForm({ ...createForm, payment_terms: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Business Address">
              <textarea
                rows={2}
                placeholder="Warehouse or billing address..."
                value={createForm.address}
                onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                className={inputCls}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2 border-t border-[rgba(45,45,45,0.08)]">
              <CancelBtn onClick={() => setShowCreate(false)} />
              <SubmitBtn loading={actionLoading} label="Create Vendor" />
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {editing && (
        <Modal title={`Edit Vendor: ${editing.name}`} onClose={() => setEditing(null)}>
          <form onSubmit={handleUpdate} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Vendor Company Name" required>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Vendor Code" required>
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
              <Field label="Contact Person">
                <input
                  type="text"
                  value={editForm.contact_person}
                  onChange={(e) => setEditForm({ ...editForm, contact_person: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Phone Number">
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="WhatsApp Number">
                <input
                  type="tel"
                  value={editForm.whatsapp_number}
                  onChange={(e) => setEditForm({ ...editForm, whatsapp_number: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Email Address">
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="GST / Tax ID Number">
                <input
                  type="text"
                  value={editForm.gst_number}
                  onChange={(e) => setEditForm({ ...editForm, gst_number: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Payment Terms">
                <input
                  type="text"
                  value={editForm.payment_terms}
                  onChange={(e) => setEditForm({ ...editForm, payment_terms: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Business Address">
              <textarea
                rows={2}
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
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
        title="Delete Vendor"
        message={`Are you sure you want to delete vendor "${deleteTarget?.name}"? If this vendor has purchase orders, GRNs, or mapped items, backend dependency protection will block destructive deletion.`}
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