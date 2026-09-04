'use client';

import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { foodCostApi } from '@/api/foodCost';
import type {
  CostHeadUpdate,
  MarkupOptionUpdate,
} from '@/types/food-cost.types';

interface EditableHead {
  id?: string;
  name: string;
  percentage: string;
  isActive: boolean;
  sortOrder: number;
}

interface EditableMarkup {
  id?: string;
  label: string;
  percentage: string;
  isActive: boolean;
  sortOrder: number;
}

interface FoodCostSettingsWorkspaceProps {
  onBack: () => void;
}

const toNumber = (value: unknown): number => Number(value ?? 0);

export const FoodCostSettingsWorkspace: React.FC<FoodCostSettingsWorkspaceProps> = ({
  onBack,
}) => {
  const [costHeads, setCostHeads] = useState<EditableHead[]>([]);
  const [markupOptions, setMarkupOptions] = useState<EditableMarkup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await foodCostApi.getAdminConfig();
        if (cancelled) return;
        setCostHeads(
          config.costHeads.map((h, i) => ({
            id: h.id,
            name: h.name,
            percentage: String(h.percentage),
            isActive: h.isActive,
            sortOrder: toNumber(h.sortOrder) || i,
          }))
        );
        setMarkupOptions(
          config.markupOptions.map((m, i) => ({
            id: m.id,
            label: m.label,
            percentage: String(m.percentage),
            isActive: m.isActive,
            sortOrder: toNumber(m.sortOrder) || i,
          }))
        );
      } catch (err: any) {
        if (!cancelled) {
          const msg =
            err?.response?.data?.detail || err?.message || 'Failed to load settings.';
          setError(typeof msg === 'string' ? msg : 'Failed to load settings.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalPercentage = costHeads
    .filter((h) => h.isActive)
    .reduce((sum, h) => sum + (Number(h.percentage) || 0), 0)
    .toFixed(2);

  const updateHead = (index: number, patch: Partial<EditableHead>) => {
    setCostHeads((prev) => prev.map((h, i) => (i === index ? { ...h, ...patch } : h)));
    setSaved(false);
  };

  const updateMarkup = (index: number, patch: Partial<EditableMarkup>) => {
    setMarkupOptions((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
    setSaved(false);
  };

  const validate = (): string | null => {
    for (const h of costHeads) {
      if (!h.name.trim()) return 'Every management cost head needs a name.';
      const pct = Number(h.percentage);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100)
        return `Cost head "${h.name}" percentage must be between 0 and 100.`;
    }
    for (const m of markupOptions) {
      if (!m.label.trim()) return 'Every mark-up option needs a label.';
      const pct = Number(m.percentage);
      if (!Number.isFinite(pct) || pct < 0)
        return 'Mark-up percentage must be 0 or greater.';
    }
    if (markupOptions.filter((m) => m.isActive).length === 0)
      return 'At least one mark-up option must be active.';
    return null;
  };
const save = async () => {
    setError(null);
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }
    const costHeadsPayload: CostHeadUpdate[] = costHeads.map((h, i) => ({
      id: h.id,
      name: h.name.trim(),
      percentage: Number(h.percentage) || 0,
      isActive: h.isActive,
      sortOrder: i,
    }));
    const markupPayload: MarkupOptionUpdate[] = markupOptions.map((m, i) => ({
      id: m.id,
      label: m.label.trim(),
      percentage: Number(m.percentage) || 0,
      isActive: m.isActive,
      sortOrder: i,
    }));
    setSaving(true);
    try {
      await foodCostApi.updateAdminConfig({
        costHeads: costHeadsPayload,
        markupOptions: markupPayload,
      });
      setSaved(true);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Save failed.';
      setError(typeof msg === 'string' ? msg : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#B8862D]" />
        <span className="ml-2 text-sm text-[#707070]">Loading Food Cost Settings...</span>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            title="Back to Food Cost"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-[rgba(45,45,45,0.08)] hover:bg-[#FAF8F5] transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-[#707070]" />
            <span className="text-sm font-medium text-[#1C1C1C] hidden sm:inline">Back</span>
          </button>
          <div>
            <h1 className="text-xl font-bold text-[#1C1C1C]">Food Cost Settings</h1>
            <p className="text-sm text-[#707070] mt-0.5">
              Admin-only private management cost configuration
            </p>
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1C1C1C] text-white text-sm font-bold shadow-sm hover:bg-[#2B2B2B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <ShieldCheck className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saved ? 'Saved' : 'Save Settings'}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
{/* Management cost (PRIVATE config) */}
      <div className="rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm p-4 sm:p-6">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <div>
            <h2 className="text-sm font-bold text-[#1C1C1C]">Management Cost</h2>
            <p className="text-xs text-[#707070] mt-0.5">
              Applied as a percentage of Ingredient Cost on each calculation.
            </p>
          </div>
          <span className="text-xs font-semibold text-[#B8862D] bg-[#F1E4C5]/60 px-3 py-1.5 rounded-lg">
            Total {totalPercentage}%
          </span>
        </div>

        <div className="space-y-2.5">
          <div className="grid grid-cols-12 gap-2 text-[10px] font-bold uppercase tracking-wider text-[#707070] px-1">
            <span className="col-span-5 sm:col-span-6">Cost Head</span>
            <span className="col-span-4 sm:col-span-3 text-right">%</span>
            <span className="col-span-3 text-right">Active</span>
          </div>
          {costHeads.map((head, i) => (
            <div
              key={head.id || `new-head-${i}`}
              className="grid grid-cols-12 gap-2 items-center bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] rounded-xl p-2.5"
            >
              <div className="col-span-5 sm:col-span-6">
                <input
                  value={head.name}
                  onChange={(e) => updateHead(i, { name: e.target.value })}
                  placeholder="e.g. Manpower"
                  className="w-full rounded-lg border border-[rgba(45,45,45,0.12)] bg-white px-3 py-2 text-sm text-[#1C1C1C] focus:outline-none focus:ring-2 focus:ring-[#B8862D]/40"
                />
              </div>
              <div className="col-span-4 sm:col-span-3">
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    value={head.percentage}
                    onChange={(e) => updateHead(i, { percentage: e.target.value })}
                    className="w-full rounded-lg border border-[rgba(45,45,45,0.12)] bg-white px-3 py-2 text-sm text-right text-[#1C1C1C] focus:outline-none focus:ring-2 focus:ring-[#B8862D]/40"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#707070]">
                    %
                  </span>
                </div>
              </div>
              <div className="col-span-3 flex items-center justify-end gap-1">
                <input
                  type="checkbox"
                  checked={head.isActive}
                  onChange={(e) => updateHead(i, { isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-[rgba(45,45,45,0.2)] accent-[#B8862D]"
                />
                <button
                  onClick={() => setCostHeads((prev) => prev.filter((_, idx) => idx !== i))}
                  title="Remove cost head"
                  className="p-1.5 rounded-md text-[#A03030] hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() =>
            setCostHeads((prev) => [
              ...prev,
              { name: '', percentage: '0', isActive: true, sortOrder: prev.length },
            ])
          }
          className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-[#B8862D]/50 text-sm font-semibold text-[#B8862D] hover:bg-[#F1E4C5]/40 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Cost Head
        </button>
      </div>
{/* Markup options */}
      <div className="rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm p-4 sm:p-6">
        <h2 className="text-sm font-bold text-[#1C1C1C]">Selling Mark-up Options</h2>
        <p className="text-xs text-[#707070] mt-0.5 mb-4">
          Only enabled options are shown on the Food Cost Main page.
        </p>
        <div className="space-y-2.5">
          <div className="grid grid-cols-12 gap-2 text-[10px] font-bold uppercase tracking-wider text-[#707070] px-1">
            <span className="col-span-4">Label</span>
            <span className="col-span-4 sm:col-span-3 text-right">%</span>
            <span className="col-span-4 text-right">Active</span>
          </div>
          {markupOptions.map((opt, i) => (
            <div
              key={opt.id || `new-markup-${i}`}
              className="grid grid-cols-12 gap-2 items-center bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] rounded-xl p-2.5"
            >
              <div className="col-span-4">
                <input
                  value={opt.label}
                  onChange={(e) => updateMarkup(i, { label: e.target.value })}
                  placeholder="e.g. 100%"
                  className="w-full rounded-lg border border-[rgba(45,45,45,0.12)] bg-white px-3 py-2 text-sm text-[#1C1C1C] focus:outline-none focus:ring-2 focus:ring-[#B8862D]/40"
                />
              </div>
              <div className="col-span-4 sm:col-span-3">
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={opt.percentage}
                    onChange={(e) => updateMarkup(i, { percentage: e.target.value })}
                    className="w-full rounded-lg border border-[rgba(45,45,45,0.12)] bg-white px-3 py-2 text-sm text-right text-[#1C1C1C] focus:outline-none focus:ring-2 focus:ring-[#B8862D]/40"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#707070]">
                    %
                  </span>
                </div>
              </div>
              <div className="col-span-4 flex items-center justify-end gap-1">
                <input
                  type="checkbox"
                  checked={opt.isActive}
                  onChange={(e) => updateMarkup(i, { isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-[rgba(45,45,45,0.2)] accent-[#B8862D]"
                />
                <button
                  onClick={() => setMarkupOptions((prev) => prev.filter((_, idx) => idx !== i))}
                  title="Remove mark-up option"
                  className="p-1.5 rounded-md text-[#A03030] hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() =>
            setMarkupOptions((prev) => [
              ...prev,
              { label: '', percentage: '100', isActive: true, sortOrder: prev.length },
            ])
          }
          className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-[#B8862D]/50 text-sm font-semibold text-[#B8862D] hover:bg-[#F1E4C5]/40 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Mark-up Option
        </button>
      </div>

      {/* Private notice */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-[#F1E4C5]/30 border border-[#B8862D]/20 text-xs text-[#70581f]">
        <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>
          This configuration is private and visible only to admins. Non-admin users can
          never retrieve these percentages through the API, and saved historical Food
          Cost results never change when this configuration is edited.
        </p>
      </div>
    </div>
  );
};