'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Settings,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Calculator,
  CheckCircle2,
  History,
  Save,
} from 'lucide-react';
import { foodCostApi } from '@/api/foodCost';
import { inventoryApi } from '@/api/inventory';
import type {
  FoodCostCalculationResponse,
  FoodCostMarkupOption,
} from '@/types/food-cost.types';
import type { Item, Unit } from '@/types/inventory.types';

interface IngredientRow {
  id: string;
  itemId: string;
  quantity: string;
  unitId: string;
}

interface FoodCostWorkspaceProps {
  onOpenSettings: () => void;
}

const toNumber = (value: unknown): number => Number(value ?? 0);

const formatINR = (value: unknown): string =>
  `₹${toNumber(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const UNIT_OPT = (u: Unit): string => u.symbol || u.name || '';

export const FoodCostWorkspace: React.FC<FoodCostWorkspaceProps> = ({ onOpenSettings }) => {
  const [rows, setRows] = useState<IngredientRow[]>([
    { id: crypto.randomUUID(), itemId: '', quantity: '', unitId: '' },
  ]);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [markupOptions, setMarkupOptions] = useState<FoodCostMarkupOption[]>([]);
  const [result, setResult] = useState<FoodCostCalculationResponse | null>(null);
  const [selectedMarkup, setSelectedMarkup] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [historyTotal, setHistoryTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const idemRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [itemsRes, unitsRes, configRes] = await Promise.all([
          inventoryApi.getItems({ type: 'RAW_MATERIAL', is_active: true }),
          inventoryApi.getUnits(),
          foodCostApi.getPublicConfig(),
        ]);
        if (cancelled) return;
        setItems(itemsRes.filter((i) => i.type === 'RAW_MATERIAL'));
        setUnits(unitsRes);
        setMarkupOptions(
          [...configRes.activeMarkupOptions].sort(
            (a, b) => (toNumber(a.sortOrder) || 0) - (toNumber(b.sortOrder) || 0)
          )
        );
      } catch (err: any) {
        if (!cancelled) {
          const msg =
            err?.response?.data?.detail || err?.message || 'Failed to load Food Cost data.';
          setError(typeof msg === 'string' ? msg : 'Failed to load Food Cost data.');
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadHistoryCount = useCallback(async () => {
    try {
      const res = await foodCostApi.getSnapshots({ limit: 1 });
      setHistoryTotal(res.total);
    } catch {
      /* history is non-blocking */
    }
  }, []);

  useEffect(() => {
    loadHistoryCount();
  }, [loadHistoryCount]);
const addRow = () => {
    setRows((prev) => [
      ...prev,
      { id: crypto.randomUUID(), itemId: '', quantity: '', unitId: '' },
    ]);
  };

  const removeRow = (id: string) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
    setResult(null);
  };

  const updateRow = (id: string, field: keyof IngredientRow, value: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, [field]: value };
        if (field === 'itemId') {
          const item = items.find((it) => it.id === value);
          if (item?.unit_id) next.unitId = item.unit_id;
        }
        return next;
      })
    );
    setResult(null);
  };

  const buildPayload = useCallback(() => {
    const ingredients: { itemId: string; quantity: number; unitId: string }[] = [];
    for (const row of rows) {
      if (!row.itemId) {
        setError('Select an ingredient for every row.');
        return null;
      }
      const qty = Number(row.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        setError('Quantity must be a number greater than zero.');
        return null;
      }
      if (!row.unitId) {
        setError('Select a unit for every ingredient.');
        return null;
      }
      ingredients.push({ itemId: row.itemId, quantity: qty, unitId: row.unitId });
    }
    if (ingredients.length === 0) {
      setError('Add at least one ingredient.');
      return null;
    }
    return { ingredients };
  }, [rows]);

  const runCalculation = useCallback(
    async (markup?: number) => {
      setError(null);
      setSaved(false);
      const payload = buildPayload();
      if (!payload) return;
      setLoading(true);
      try {
        const res =
          markup != null
            ? await foodCostApi.calculateWithMarkup(payload, markup)
            : await foodCostApi.calculate(payload);
        setResult(res);
        setSelectedMarkup(markup != null ? markup : null);
      } catch (err: any) {
        const msg = err?.response?.data?.detail || err?.message || 'Calculation failed.';
        setError(typeof msg === 'string' ? msg : 'Calculation failed.');
      } finally {
        setLoading(false);
      }
    },
    [buildPayload]
  );

  const reset = () => {
    setResult(null);
    setSelectedMarkup(null);
    setError(null);
    setSaved(false);
  };

  const saveSnapshot = async () => {
    if (!result || saving) return;
    if (!idemRef.current) idemRef.current = `fc-${crypto.randomUUID()}`;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const ingredients = rows
        .filter((r) => r.itemId && r.quantity && r.unitId)
        .map((r) => ({ itemId: r.itemId, quantity: Number(r.quantity), unitId: r.unitId }));
      if (ingredients.length === 0) {
        setError('Add at least one ingredient before saving.');
        return;
      }
      await foodCostApi.save({
        ingredients,
        idempotencyKey: idemRef.current,
        markupPercentage: selectedMarkup ?? undefined,
      });
      setSaved(true);
      await loadHistoryCount();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Saving failed.';
      setError(typeof msg === 'string' ? msg : 'Saving failed.');
    } finally {
      setSaving(false);
    }
  };
if (!loaded) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#B8862D]" />
        <span className="ml-2 text-sm text-[#707070]">Loading Food Cost...</span>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1C1C1C]">Food Cost</h1>
          <p className="text-sm text-[#707070] mt-0.5">
            Ingredient cost → management cost → selling cost
          </p>
        </div>
        <div className="flex items-center gap-2">
          {historyTotal != null && (
            <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-[rgba(45,45,45,0.08)] text-xs text-[#707070]">
              <History className="w-3.5 h-3.5" />
              {historyTotal} saved
            </span>
          )}
          <button
            onClick={onOpenSettings}
            title="Food Cost Settings"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-[rgba(45,45,45,0.08)] hover:bg-[#FAF8F5] transition-colors"
          >
            <Settings className="w-4 h-4 text-[#707070]" />
            <span className="text-sm font-medium text-[#1C1C1C] hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
{/* Ingredient builder */}
      <div className="rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm p-4 sm:p-6">
        <h2 className="text-sm font-bold text-[#1C1C1C] mb-4">Ingredients</h2>
        <div className="space-y-3">
          {rows.map((row, idx) => (
            <div
              key={row.id}
              className="grid grid-cols-12 gap-2 items-end bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] rounded-xl p-3"
            >
              <div className="col-span-12 sm:col-span-6 md:col-span-5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#707070]">
                  {idx + 1}. Ingredient
                </label>
                <select
                  value={row.itemId}
                  onChange={(e) => updateRow(row.id, 'itemId', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[rgba(45,45,45,0.12)] bg-white px-3 py-2 text-sm text-[#1C1C1C] focus:outline-none focus:ring-2 focus:ring-[#B8862D]/40"
                >
                  <option value="">Select ingredient…</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({it.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-6 sm:col-span-3 md:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#707070]">
                  Quantity
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={row.quantity}
                  onChange={(e) => updateRow(row.id, 'quantity', e.target.value)}
                  placeholder="0"
                  className="w-full mt-1 rounded-lg border border-[rgba(45,45,45,0.12)] bg-white px-3 py-2 text-sm text-[#1C1C1C] focus:outline-none focus:ring-2 focus:ring-[#B8862D]/40"
                />
              </div>
              <div className="col-span-6 sm:col-span-3 md:col-span-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#707070]">
                  Unit
                </label>
                <select
                  value={row.unitId}
                  onChange={(e) => updateRow(row.id, 'unitId', e.target.value)}
                  className="w-full mt-1 rounded-lg border border-[rgba(45,45,45,0.12)] bg-white px-3 py-2 text-sm text-[#1C1C1C] focus:outline-none focus:ring-2 focus:ring-[#B8862D]/40"
                >
                  <option value="">Unit…</option>
                  {units
                    .filter((u) => u.is_active !== false)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {UNIT_OPT(u)}
                      </option>
                    ))}
                </select>
              </div>
              <div className="col-span-12 md:col-span-2 flex md:justify-end">
                <button
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length <= 1}
                  title="Remove ingredient"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[rgba(45,45,45,0.08)] text-xs font-semibold text-[#A03030] hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between flex-wrap gap-3 mt-4">
          <button
            onClick={addRow}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-[#B8862D]/50 text-sm font-semibold text-[#B8862D] hover:bg-[#F1E4C5]/40 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Ingredient
          </button>
          <div className="flex items-center gap-2">
            {result && (
              <button
                onClick={reset}
                className="px-4 py-2 rounded-lg border border-[rgba(45,45,45,0.08)] text-sm font-semibold text-[#707070] hover:bg-[#FAF8F5] transition-colors"
              >
                Clear Results
              </button>
            )}
            <button
              onClick={() => runCalculation()}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1C1C1C] text-white text-sm font-bold shadow-sm hover:bg-[#2B2B2B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Calculator className="w-4 h-4" />
              )}
              Calculate Food Cost
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm p-4 sm:p-6 space-y-6">
          <div>
            <h2 className="text-sm font-bold text-[#1C1C1C] mb-3">Ingredient Cost Breakdown</h2>
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-[#707070] border-b border-[rgba(45,45,45,0.08)]">
                    <th className="py-2 pr-2">Ingredient</th>
                    <th className="py-2 px-2 text-right">Quantity</th>
                    <th className="py-2 px-2 text-right">Rate</th>
                    <th className="py-2 pl-2 text-right">Ingredient Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {result.ingredients.map((ing, i) => (
                    <tr key={`${ing.itemId}-${i}`} className="border-b border-[rgba(45,45,45,0.05)]">
                      <td className="py-2.5 pr-2 font-medium text-[#1C1C1C]">
                        {ing.itemName}
                        <span className="block text-[10px] text-[#707070]">
                          normalized: {toNumber(ing.normalizedQuantity)} {ing.unitSymbol}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right text-[#1C1C1C]">
                        {toNumber(ing.quantity)} {ing.unitSymbol}
                      </td>
                      <td className="py-2.5 px-2 text-right text-[#1C1C1C]">
                        {formatINR(ing.rate)} / {ing.unitSymbol}
                      </td>
                      <td className="py-2.5 pl-2 text-right font-semibold text-[#1C1C1C]">
                        {formatINR(ing.ingredientCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#707070]">Ingredient Cost</span>
              <span className="font-semibold text-[#1C1C1C]">{formatINR(result.ingredientCost)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#707070]">Management Cost</span>
              <span className="font-semibold text-[#1C1C1C]">{formatINR(result.managementCost)}</span>
            </div>
            <div className="border-t border-[rgba(45,45,45,0.1)] pt-2 flex items-center justify-between">
              <span className="text-sm font-bold text-[#1C1C1C]">Total Cost</span>
              <span className="text-base font-bold text-[#1C1C1C]">{formatINR(result.totalCost)}</span>
            </div>
          </div>

          {markupOptions.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-[#1C1C1C] mb-3">Selling Cost Options</h2>
              <div className="flex flex-wrap gap-2">
                {markupOptions.map((opt) => {
                  const pct = toNumber(opt.percentage);
                  const active = selectedMarkup === pct;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => runCalculation(pct)}
                      disabled={loading}
                      className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors disabled:opacity-50 ${
                        active
                          ? 'bg-[#B8862D] text-white border-[#B8862D]'
                          : 'bg-white text-[#1C1C1C] border-[rgba(45,45,45,0.12)] hover:bg-[#F1E4C5]/40'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {result.finalSellingCost != null && selectedMarkup != null && (
            <div className="rounded-xl bg-[#1C1C1C] text-white p-4 sm:p-5 flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                  Final Selling Cost ({selectedMarkup}% mark-up)
                </p>
                <p className="text-2xl font-bold mt-1">{formatINR(result.finalSellingCost)}</p>
              </div>
              <button
                onClick={saveSnapshot}
                disabled={saving || saved}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#B8862D] text-white text-sm font-bold hover:bg-[#a3762a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saved ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saved ? 'Saved to History' : 'Save Snapshot'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FoodCostWorkspace;