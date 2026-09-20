'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Tags, Plus, RefreshCw, Search } from 'lucide-react';
import { inventoryApi } from '@/api/inventory';
import { Category } from '@/types/inventory.types';
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

const emptyCategoryForm = {
  name: '',
  code: '',
  description: '',
  is_active: true,
};

export const MasterCategories: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ ...emptyCategoryForm });

  const [editing, setEditing] = useState<Category | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyCategoryForm });

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteReferences, setDeleteReferences] = useState<string[]>([]);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const data = await inventoryApi.getCategories();
      setCategories(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: ErrDetail(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const filtered = categories.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await inventoryApi.createCategory({
        name: createForm.name.trim(),
        code: createForm.code.trim().toUpperCase(),
        description: createForm.description.trim(),
      });
      setFeedback({ type: 'success', message: `Category "${createForm.name}" created successfully.` });
      setShowCreate(false);
      setCreateForm({ ...emptyCategoryForm });
      await loadCategories();
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
      await inventoryApi.updateCategory(editing.id, {
        name: editForm.name.trim(),
        code: editForm.code.trim().toUpperCase(),
        description: editForm.description.trim(),
        is_active: editForm.is_active,
      });
      setFeedback({ type: 'success', message: `Category "${editForm.name}" updated successfully.` });
      setEditing(null);
      await loadCategories();
    } catch (err: any) {
      setFeedback({ type: 'error', message: ErrDetail(err) });
    } finally {
      setActionLoading(false);
    }
  };

  const toggleActive = async (cat: Category) => {
    setActionLoading(true);
    const newStatus = cat.is_active === false;
    try {
      await inventoryApi.updateCategory(cat.id, { is_active: newStatus });
      setFeedback({
        type: 'success',
        message: `Category "${cat.name}" ${newStatus ? 'activated' : 'deactivated'}.`,
      });
      await loadCategories();
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
      const res: any = await inventoryApi.deleteCategory(deleteTarget.id);
      const refs = res?.references as string[] | undefined;
      if (refs && refs.length) {
        setFeedback({
          type: 'error',
          message: `Cannot delete "${deleteTarget.name}": ${refs.join(' · ')}. Set category Inactive instead.`,
        });
      } else {
        setFeedback({
          type: 'success',
          message: res?.message || `Category "${deleteTarget.name}" deleted successfully.`,
        });
      }
      setDeleteTarget(null);
      setDeleteReferences([]);
      await loadCategories();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail && typeof detail === 'object' && detail.references) {
        setDeleteReferences(detail.references);
        setFeedback({
          type: 'error',
          message: `${detail.message || 'Cannot delete category.'} ${detail.references.join(' · ')}`,
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
            type="text"
            placeholder="Search item categories by code, name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white border border-[rgba(45,45,45,0.12)] focus:outline-none focus:border-[#C79A3B] text-[#1C1C1C]"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadCategories}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[rgba(45,45,45,0.12)] hover:bg-[#FAF8F5] text-xs font-semibold text-[#1C1C1C] transition-all shadow-sm disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#C79A3B] ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
          <button
            onClick={() => {
              setCreateForm({ ...emptyCategoryForm });
              setShowCreate(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#C79A3B] to-[#B8862D] text-white text-xs font-semibold shadow-md shadow-[#C79A3B]/20 transition-all hover:brightness-105 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Category</span>
          </button>
        </div>
      </div>

      {/* ERP Horizontal Category Register */}
      {loading ? (
        <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-xs text-[#707070]">
          <RefreshCw className="h-6 w-6 animate-spin text-[#C79A3B]" />
          <span>Loading Item Categories...</span>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          message={
            search
              ? 'No categories matched your search criteria.'
              : 'No item categories configured yet.'
          }
          icon={<Tags className="h-6 w-6" />}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[rgba(45,45,45,0.09)] bg-white shadow-sm">
          <div className="min-w-[820px]">
            {/* Column Header */}
            <div className="grid grid-cols-[1.8fr_1fr_2.8fr_0.9fr_1.25fr] items-center border-b border-[rgba(45,45,45,0.08)] bg-[#FAF8F5] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#707070]">
              <div>Category</div>
              <div>Code</div>
              <div>Description</div>
              <div>Status</div>
              <div className="text-right">Actions</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-[rgba(45,45,45,0.07)]">
              {filtered.map((cat) => {
                const isActive = cat.is_active !== false;

                return (
                  <div
                    key={cat.id}
                    className={`grid grid-cols-[1.8fr_1fr_2.8fr_0.9fr_1.25fr] items-center px-4 py-3.5 transition-colors ${
                      isActive
                        ? 'bg-white hover:bg-[#FFFCF7]'
                        : 'bg-[#FCFAF8] opacity-80 hover:bg-[#FAF6F2]'
                    }`}
                  >
                    {/* Category */}
                    <div className="min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[rgba(45,45,45,0.08)] bg-[#FAF8F5] text-[#C79A3B]">
                          <Tags className="h-4 w-4" />
                        </div>

                        <p className="truncate text-xs font-semibold text-[#1C1C1C]">
                          {cat.name}
                        </p>
                      </div>
                    </div>

                    {/* Code */}
                    <div className="pr-3">
                      <span className="font-mono text-[10px] font-semibold text-[#B8862D]">
                        {cat.code}
                      </span>
                    </div>

                    {/* Description */}
                    <div className="min-w-0 pr-4">
                      <p className="truncate text-[10px] text-[#707070]">
                        {cat.description || 'No description provided.'}
                      </p>
                    </div>

                    {/* Status */}
                    <div>
                      <div className="flex items-center gap-2">
                        <ToggleSwitch
                          active={isActive}
                          onChange={() => toggleActive(cat)}
                          title={isActive ? 'Deactivate Category' : 'Activate Category'}
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
                          setEditing(cat);
                          setEditForm({
                            name: cat.name,
                            code: cat.code,
                            description: cat.description || '',
                            is_active: isActive,
                          });
                        }}
                      />

                      <DeleteBtn
                        onClick={() => {
                          setDeleteTarget(cat);
                          setDeleteReferences([]);
                        }}
                      />
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
        <Modal title="Create Item Category" subtitle="Add a new item grouping for inventory & purchasing" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-3 text-xs">
            <Field label="Category Name" required>
              <input
                type="text"
                required
                placeholder="e.g. Dairy & Eggs, Vegetables, Meat"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                className={inputCls}
              />
            </Field>

            <Field label="Category Code" required>
              <input
                type="text"
                required
                placeholder="e.g. CAT-DAIRY, CAT-VEG"
                value={createForm.code}
                onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
                className={inputCls}
              />
            </Field>

            <Field label="Description (Optional)">
              <textarea
                rows={2}
                placeholder="Details regarding items belonging to this category..."
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                className={inputCls}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2 border-t border-[rgba(45,45,45,0.08)]">
              <CancelBtn onClick={() => setShowCreate(false)} />
              <SubmitBtn loading={actionLoading} label="Create Category" />
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {editing && (
        <Modal title={`Edit Category: ${editing.name}`} onClose={() => setEditing(null)}>
          <form onSubmit={handleUpdate} className="space-y-3 text-xs">
            <Field label="Category Name" required>
              <input
                type="text"
                required
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className={inputCls}
              />
            </Field>

            <Field label="Category Code" required>
              <input
                type="text"
                required
                value={editForm.code}
                onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                className={inputCls}
              />
            </Field>

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
                  active={editForm.is_active}
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
        title="Delete Item Category"
        message={`Are you sure you want to delete category "${deleteTarget?.name}"? If items are assigned to this category, deletion will be blocked by backend safety checks.`}
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
