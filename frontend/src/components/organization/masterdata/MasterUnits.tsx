'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Scale, Plus, RefreshCw, Search } from 'lucide-react';
import { inventoryApi } from '@/api/inventory';
import { Unit } from '@/types/inventory.types';
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

const emptyUnitForm = {
  name: '',
  symbol: '',
  is_active: true,
};

export const MasterUnits: React.FC = () => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ ...emptyUnitForm });

  const [editing, setEditing] = useState<Unit | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyUnitForm });

  const [deleteTarget, setDeleteTarget] = useState<Unit | null>(null);
  const [deleteReferences, setDeleteReferences] = useState<string[]>([]);

  const loadUnits = useCallback(async () => {
    setLoading(true);
    try {
      const data = await inventoryApi.getUnits();
      setUnits(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: ErrDetail(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  const filtered = units.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.symbol.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await inventoryApi.createUnit({
        name: createForm.name.trim(),
        symbol: createForm.symbol.trim().toLowerCase(),
      });
      setFeedback({ type: 'success', message: `Unit "${createForm.name}" (${createForm.symbol}) created successfully.` });
      setShowCreate(false);
      setCreateForm({ ...emptyUnitForm });
      await loadUnits();
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
      await inventoryApi.updateUnit(editing.id, {
        name: editForm.name.trim(),
        symbol: editForm.symbol.trim().toLowerCase(),
        is_active: editForm.is_active,
      });
      setFeedback({ type: 'success', message: `Unit "${editForm.name}" updated successfully.` });
      setEditing(null);
      await loadUnits();
    } catch (err: any) {
      setFeedback({ type: 'error', message: ErrDetail(err) });
    } finally {
      setActionLoading(false);
    }
  };

  const toggleActive = async (unit: Unit) => {
    setActionLoading(true);
    const newStatus = unit.is_active === false;
    try {
      await inventoryApi.updateUnit(unit.id, { is_active: newStatus });
      setFeedback({
        type: 'success',
        message: `Unit "${unit.name}" ${newStatus ? 'activated' : 'deactivated'}.`,
      });
      await loadUnits();
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
      const res: any = await inventoryApi.deleteUnit(deleteTarget.id);
      const refs = res?.references as string[] | undefined;
      if (refs && refs.length) {
        setFeedback({
          type: 'error',
          message: `Cannot delete "${deleteTarget.name}": ${refs.join(' · ')}. Set unit Inactive instead.`,
        });
      } else {
        setFeedback({
          type: 'success',
          message: res?.message || `Unit "${deleteTarget.name}" deleted successfully.`,
        });
      }
      setDeleteTarget(null);
      setDeleteReferences([]);
      await loadUnits();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail && typeof detail === 'object' && detail.references) {
        setDeleteReferences(detail.references);
        setFeedback({
          type: 'error',
          message: `${detail.message || 'Cannot delete unit.'} ${detail.references.join(' · ')}`,
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
            placeholder="Search units of measurement by symbol, name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white border border-[rgba(45,45,45,0.12)] focus:outline-none focus:border-[#C79A3B] text-[#1C1C1C]"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadUnits}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[rgba(45,45,45,0.12)] hover:bg-[#FAF8F5] text-xs font-semibold text-[#1C1C1C] transition-all shadow-sm disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#C79A3B] ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
          <button
            onClick={() => {
              setCreateForm({ ...emptyUnitForm });
              setShowCreate(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#C79A3B] to-[#B8862D] text-white text-xs font-semibold shadow-md shadow-[#C79A3B]/20 transition-all hover:brightness-105 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Unit</span>
          </button>
        </div>
      </div>

      {/* Grid of Units */}
      {loading ? (
        <div className="p-12 text-center text-[#707070] text-xs flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-[#C79A3B]" />
          <span>Loading Units of Measurement...</span>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          message={search ? 'No units matched your search criteria.' : 'No units configured yet.'}
          icon={<Scale className="w-6 h-6" />}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {filtered.map((unit) => {
            const isActive = unit.is_active !== false;
            return (
              <div
                key={unit.id}
                className={`p-4 rounded-2xl border transition-all space-y-3 bg-white ${
                  isActive ? 'border-[rgba(45,45,45,0.08)] shadow-sm hover:border-[#C79A3B]/40' : 'border-[#D9534F]/20 opacity-75 bg-[#FAF8F5]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)] flex items-center justify-center text-[#C79A3B]">
                      <Scale className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#1C1C1C] font-['Outfit']">{unit.name}</h4>
                      <p className="text-xs font-mono font-bold text-[#B8862D]">{unit.symbol}</p>
                    </div>
                  </div>
                  <StatusPill active={isActive} />
                </div>

                <div className="text-[11px] text-[#707070] bg-[#FAF8F5] px-2.5 py-1 rounded-lg border border-[rgba(45,45,45,0.06)] font-mono">
                  Symbol: <span className="font-bold text-[#1C1C1C]">{unit.symbol}</span>
                </div>

                <CardActionRow>
                  <div className="flex items-center gap-2">
                    <ToggleSwitch
                      active={isActive}
                      onChange={() => toggleActive(unit)}
                      title={isActive ? 'Deactivate Unit' : 'Activate Unit'}
                    />
                    <span className="text-[10px] text-[#707070]">{isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <EditBtn
                      onClick={() => {
                        setEditing(unit);
                        setEditForm({
                          name: unit.name,
                          symbol: unit.symbol,
                          is_active: isActive,
                        });
                      }}
                    />
                    <DeleteBtn
                      onClick={() => {
                        setDeleteTarget(unit);
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
        <Modal title="Create Unit of Measurement" subtitle="Define standard base units (KG, G, L, ML, PCS, BOX)" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-3 text-xs">
            <Field label="Unit Full Name" required>
              <input
                type="text"
                required
                placeholder="e.g. Kilogram, Litre, Pieces, Box"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                className={inputCls}
              />
            </Field>

            <Field label="Unit Symbol" required>
              <input
                type="text"
                required
                placeholder="e.g. kg, l, ml, pcs, box"
                value={createForm.symbol}
                onChange={(e) => setCreateForm({ ...createForm, symbol: e.target.value })}
                className={inputCls}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2 border-t border-[rgba(45,45,45,0.08)]">
              <CancelBtn onClick={() => setShowCreate(false)} />
              <SubmitBtn loading={actionLoading} label="Create Unit" />
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {editing && (
        <Modal title={`Edit Unit: ${editing.name}`} onClose={() => setEditing(null)}>
          <form onSubmit={handleUpdate} className="space-y-3 text-xs">
            <Field label="Unit Full Name" required>
              <input
                type="text"
                required
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className={inputCls}
              />
            </Field>

            <Field label="Unit Symbol" required>
              <input
                type="text"
                required
                value={editForm.symbol}
                onChange={(e) => setEditForm({ ...editForm, symbol: e.target.value })}
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
        title="Delete Unit"
        message={`Are you sure you want to delete unit "${deleteTarget?.name}" (${deleteTarget?.symbol})? If items, recipes, or transactions reference this unit, deletion will be blocked.`}
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
