'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Truck, Plus, RefreshCw, Search, Phone, MessageCircle, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
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
  const [deleteStage, setDeleteStage] = useState<'confirm' | 'deleting' | 'success'>('confirm');
  const [deleteError, setDeleteError] = useState('');

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

  const openDelete = (vendor: Vendor) => {
    setDeleteTarget(vendor);
    setDeleteReferences([]);
    setDeleteError('');
    setDeleteStage('confirm');
  };

  const closeDelete = () => {
    if (deleteStage === 'deleting') return;
    setDeleteTarget(null);
    setDeleteReferences([]);
    setDeleteError('');
    setDeleteStage('confirm');
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setActionLoading(true);
    setDeleteError('');
    setDeleteStage('deleting');

    try {
      const res: any = await procurementApi.deleteSupplier(deleteTarget.id);
      const references = res?.references as string[] | undefined;

      if (references && references.length) {
        const message = `Vendor cannot be deleted because it is referenced by: ${references.join(' · ')}`;
        setDeleteReferences(references);
        setDeleteError(message);
        setDeleteStage('confirm');
        return;
      }

      await load();
      setDeleteStage('success');
      setFeedback({
        type: 'success',
        message: res?.message || `Vendor "${deleteTarget.name}" deleted successfully.`,
      });
    } catch (err: any) {
      const detail = err?.response?.data?.detail;

      if (detail && typeof detail === 'object' && detail.references) {
        const references = detail.references as string[];
        setDeleteReferences(references);
        setDeleteError(
          `${detail.message || 'Vendor cannot be deleted.'} ${references.join(' · ')}`,
        );
      } else {
        setDeleteError(ErrDetail(err) || 'Vendor deletion failed.');
      }

      setDeleteStage('confirm');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {/* Vendor Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setSearch('')}
          className="p-4 rounded-2xl text-left border border-[#C79A3B] bg-white shadow-md shadow-[#C79A3B]/10"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-[#707070]">Total Vendors</p>
          <p className="mt-1 text-2xl font-bold text-[#1C1C1C] font-['Outfit']">{vendors.length}</p>
        </button>

        <div className="p-4 rounded-2xl text-left border border-[rgba(45,45,45,0.08)] bg-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#707070]">Active</p>
          <p className="mt-1 text-2xl font-bold text-[#2E8B57] font-['Outfit']">
            {vendors.filter((v) => v.is_active !== false && (v as any).isActive !== false).length}
          </p>
        </div>

        <div className="p-4 rounded-2xl text-left border border-[rgba(45,45,45,0.08)] bg-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#707070]">Inactive</p>
          <p className="mt-1 text-2xl font-bold text-[#707070] font-['Outfit']">
            {vendors.filter((v) => !(v.is_active !== false && (v as any).isActive !== false)).length}
          </p>
        </div>
      </div>

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

      {/* ERP Horizontal Vendor Register */}
      {loading ? (
        <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-xs text-[#707070]">
          <RefreshCw className="h-6 w-6 animate-spin text-[#C79A3B]" />
          <span>Loading Vendors / Suppliers...</span>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          message={search ? 'No vendors matched your search.' : 'No vendors registered yet.'}
          icon={<Truck className="h-6 w-6" />}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[rgba(45,45,45,0.09)] bg-white shadow-sm">
          <div className="min-w-[1000px]">
            {/* Column Header */}
            <div className="grid grid-cols-[2fr_1fr_1.35fr_1.7fr_1.35fr_0.95fr_1.3fr] items-center border-b border-[rgba(45,45,45,0.08)] bg-[#FAF8F5] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#707070]">
              <div>Vendor</div>
              <div>Contact Person</div>
              <div>Phone / WhatsApp</div>
              <div>Email / Address</div>
              <div>GST / Payment</div>
              <div>Status</div>
              <div className="text-right">Actions</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-[rgba(45,45,45,0.07)]">
              {filtered.map((v) => {
                const isActive =
                  v.is_active !== false && (v as any).isActive !== false;

                return (
                  <div
                    key={v.id}
                    className={`grid grid-cols-[2fr_1fr_1.35fr_1.7fr_1.35fr_0.95fr_1.3fr] items-center px-4 py-3.5 transition-colors ${
                      isActive
                        ? 'bg-white hover:bg-[#FFFCF7]'
                        : 'bg-[#FCFAF8] opacity-80 hover:bg-[#FAF6F2]'
                    }`}
                  >
                    {/* Vendor */}
                    <div className="min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-xs font-semibold text-[#1C1C1C]">
                          {v.name}
                        </p>
                        <StatusPill active={isActive} />
                      </div>

                      <p className="mt-1 font-mono text-[10px] font-semibold text-[#B8862D]">
                        {v.code}
                      </p>
                    </div>

                    {/* Contact Person */}
                    <div className="min-w-0 pr-3">
                      <p className="truncate text-[11px] font-medium text-[#454545]">
                        {v.contact_person || '—'}
                      </p>
                    </div>

                    {/* Phone / WhatsApp */}
                    <div className="min-w-0 space-y-1 pr-3 text-[10px] text-[#707070]">
                      {v.phone ? (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 shrink-0 text-[#C79A3B]" />
                          <span className="truncate">{v.phone}</span>
                        </div>
                      ) : (
                        <span className="text-[#B0B0B0]">No phone</span>
                      )}

                      {v.whatsapp_number ? (
                        <div className="flex items-center gap-1.5 text-[#2E8B57]">
                          <MessageCircle className="h-3 w-3 shrink-0" />
                          <span className="truncate font-semibold">
                            {v.whatsapp_number}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    {/* Email / Address */}
                    <div className="min-w-0 space-y-1 pr-3 text-[10px] text-[#707070]">
                      {v.email ? (
                        <div className="truncate">{v.email}</div>
                      ) : (
                        <div className="text-[#B0B0B0]">No email</div>
                      )}

                      {v.address ? (
                        <div className="truncate">{v.address}</div>
                      ) : (
                        <div className="text-[#B0B0B0]">No address</div>
                      )}
                    </div>

                    {/* GST / Payment */}
                    <div className="min-w-0 space-y-1 pr-3 text-[10px] text-[#707070]">
                      <div className="truncate">
                        GST:{' '}
                        <span className="font-medium text-[#454545]">
                          {v.gst_number || '—'}
                        </span>
                      </div>
                      <div className="truncate">
                        Terms:{' '}
                        <span className="font-medium text-[#454545]">
                          {v.payment_terms || '—'}
                        </span>
                      </div>
                    </div>

                    {/* Status */}
                    <div>
                      <div className="flex items-center gap-2">
                        <ToggleSwitch
                          active={isActive}
                          onChange={() => toggleActive(v)}
                          title={isActive ? 'Deactivate' : 'Activate'}
                        />
                        <span
                          className={`text-[10px] font-semibold ${
                            isActive
                              ? 'text-[#2E8B57]'
                              : 'text-[#8A8A8A]'
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

                      <DeleteBtn onClick={() => openDelete(v)} />
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

      {/* Permanent Delete Confirmation */}
      {deleteTarget && deleteStage === 'confirm' && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Delete Vendor Permanently</h3>
                  <p className="text-xs text-slate-500">This action cannot be undone.</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-700">
                  You are about to permanently delete
                  <span className="font-semibold text-slate-900"> “{deleteTarget.name}”</span>.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  The vendor will be removed after the server confirms the delete operation.
                </p>
              </div>

              {deleteError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p>{deleteError}</p>
                      {deleteReferences.length > 0 && (
                        <div className="mt-2 space-y-1 text-xs">
                          {deleteReferences.map((reference, index) => (
                            <div key={`${reference}-${index}`}>• {reference}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeDelete}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={confirmDelete}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Permanently
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Loading */}
      {deleteTarget && deleteStage === 'deleting' && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 px-6 py-8 text-center text-white shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10">
              <RefreshCw className="h-7 w-7 animate-spin text-rose-400" />
            </div>
            <h3 className="mt-5 text-lg font-semibold">Deleting Vendor...</h3>
            <p className="mt-2 text-sm text-slate-300">
              Permanently deleting “{deleteTarget.name}”. Please wait.
            </p>
            <div className="mx-auto mt-5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-700">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-rose-500" />
            </div>
            <p className="mt-3 text-xs text-slate-400">Do not close or refresh this page.</p>
          </div>
        </div>
      )}

      {/* Delete Success */}
      {deleteTarget && deleteStage === 'success' && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-emerald-200 bg-white px-6 py-8 text-center shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <h3 className="mt-5 text-lg font-semibold text-slate-900">Delete Successful</h3>
            <p className="mt-2 text-sm text-slate-500">
              “{deleteTarget.name}” has been permanently deleted.
            </p>
            <button
              type="button"
              onClick={closeDelete}
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};