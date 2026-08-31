'use client';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ChefHat, Plus, RefreshCw, Pencil, Copy, Calculator, Trash2,
  DollarSign, AlertCircle,
} from 'lucide-react';
import { productionApi } from '@/api/production';
import { inventoryApi } from '@/api/inventory';
import { Recipe } from '@/types/production.types';
import { Item, Unit } from '@/types/inventory.types';
import { Badge, Button, EmptyState, Modal, SearchInput } from '@/components/ui';

// ─── Ingredient row state ─────────────────────────────────────────────────────
type Ing = {
  raw_item_id: string;
  unit_id: string;
  quantity: number;
  gross_quantity: number;
  usable_yield: number;
  waste_percentage: number;
  notes: string;
};
const blankIng = (): Ing => ({
  raw_item_id: '',
  unit_id: '',
  quantity: 1,
  gross_quantity: 1,
  usable_yield: 100,
  waste_percentage: 0,
  notes: '',
});

const nf = (v: number | string | undefined | null, d = 2) =>
  Number(v ?? 0).toFixed(d);

const fmt = (v: number | string | undefined | null) =>
  `\u20b9${nf(v, 2)}`;

/** Compute ingredient cost locally: gross_qty \xd7 rate. Mirrors backend _calculate_recipe_costs formula. */
function localIngCost(item: Item | undefined, ing: Ing): number {
  if (!item) return 0;
  const rate = Number(item.cost_price || 0);
  const gross = ing.gross_quantity > 0 ? ing.gross_quantity : ing.quantity;
  return rate * gross;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RecipeManager({
  onRunBatch,
}: {
  onRunBatch: (id: string) => void;
}) {
  const [recipes, setRecipes]     = useState<Recipe[]>([]);
  const [items, setItems]         = useState<Item[]>([]);
  const [units, setUnits]         = useState<Unit[]>([]);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [open, setOpen]           = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [msg, setMsg]             = useState<string | null>(null);
  const [err, setErr]             = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    code: '',
    finished_item_id: '',
    description: '',
    yield_qty: 1,
    preparation_minutes: 15,
    instructions: '',
    selling_price_per_unit: 0,
  });
  const [ings, setIngs] = useState<Ing[]>([blankIng()]);

  // ── Data loading ──────────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const [r, i, u] = await Promise.all([
        productionApi.getRecipes(),
        inventoryApi.getItems({ is_active: true }),
        inventoryApi.getUnits(),
      ]);
      setRecipes(r || []);
      setItems(i || []);
      setUnits(u || []);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || 'Failed to load recipes');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  // ── Derived sets ──────────────────────────────────────────────────────────
  const finished = useMemo(
    () => items.filter((i) => i.type === 'FINISHED_GOOD' || i.type === 'SEMI_FINISHED'),
    [items]
  );
  const rawItems = useMemo(
    () => items.filter((i) => i.type === 'RAW_MATERIAL' || i.type === 'SEMI_FINISHED'),
    [items]
  );
  const filtered = recipes.filter((r) =>
    `${r.name} ${r.code} ${r.finishedItemName ?? ''}`.toLowerCase().includes(search.toLowerCase())
  );
  const itemById = useMemo(() => {
    const m: Record<string, Item> = {};
    items.forEach((i) => (m[i.id] = i));
    return m;
  }, [items]);
  const unitById = useMemo(() => {
    const m: Record<string, Unit> = {};
    units.forEach((u) => (m[u.id] = u));
    return m;
  }, [units]);

  // ── Open create / edit ────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setForm({
      name: '', code: '', finished_item_id: finished[0]?.id || '', description: '',
      yield_qty: 1, preparation_minutes: 15, instructions: '', selling_price_per_unit: 0,
    });
    setIngs([blankIng()]);
    setErr(null); setMsg(null); setOpen(true);
  };

  const openEdit = (r: Recipe) => {
    setEditingId(r.id);
    setForm({
      name: r.name || '',
      code: r.code || '',
      finished_item_id: r.finishedItemId || '',
      description: r.description || '',
      yield_qty: Number(r.yieldQty ?? 1),
      preparation_minutes: Number(r.preparationMinutes ?? 0),
      instructions: r.instructions || '',
      selling_price_per_unit: Number(r.sellingPricePerUnit ?? 0),
    });
    setIngs(
      (r.ingredients || []).map((i) => ({
        raw_item_id: i.rawItemId,
        unit_id: i.unitId || '',
        quantity: Number(i.quantity ?? 1),
        gross_quantity: Number(i.grossQuantity ?? i.quantity ?? 1),
        usable_yield: Number(i.usableYield ?? 100),
        waste_percentage: Number(i.wastePercentage ?? 0),
        notes: i.notes || '',
      }))
    );
    setErr(null); setMsg(null); setOpen(true);
  };

  const setIng = (n: number, p: Partial<Ing>) =>
    setIngs((a) => a.map((x, i) => (i === n ? { ...x, ...p } : x)));

  /**
   * When net qty or waste % changes, auto-compute gross_quantity:
   *   gross = net / (1 - waste / 100)
   * This matches the backend formula in create_recipe / update_recipe.
   */
  const handleIngChange = (idx: number, field: keyof Ing, value: number | string) => {
    const prev = ings[idx];
    const update: Partial<Ing> = { [field]: value };
    if (field === 'quantity' || field === 'waste_percentage') {
      const qty = field === 'quantity' ? Number(value) : prev.quantity;
      const wst = field === 'waste_percentage' ? Number(value) : prev.waste_percentage;
      update.gross_quantity = wst > 0 && wst < 100
        ? Number((qty / (1 - wst / 100)).toFixed(4))
        : qty;
    }
    setIng(idx, update);
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const save = async () => {
    const valid = ings.filter((i) => i.raw_item_id && i.quantity > 0);
    if (!form.name.trim() || !form.code.trim() || !form.finished_item_id || form.yield_qty <= 0 || !valid.length) {
      setErr('Recipe name, code, finished item, yield > 0 and at least one ingredient are required.');
      return;
    }
    setSaving(true); setErr(null);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        description: form.description.trim() || undefined,
        instructions: form.instructions.trim() || undefined,
        selling_price_per_unit: form.selling_price_per_unit || 0,
        ingredients: valid.map((i) => ({
          raw_item_id: i.raw_item_id,
          unit_id: i.unit_id || undefined,
          quantity: i.quantity,
          gross_quantity: i.gross_quantity > 0 ? i.gross_quantity : undefined,
          usable_yield: Math.min(100, Math.max(0.01, i.usable_yield)),
          waste_percentage: Math.min(99.99, Math.max(0, i.waste_percentage)),
          notes: i.notes.trim() || undefined,
        })),
      };
      if (editingId) await productionApi.updateRecipe(editingId, payload);
      else await productionApi.createRecipe(payload);
      setOpen(false);
      setMsg(editingId ? 'Recipe updated successfully.' : 'Recipe created successfully.');
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || 'Failed to save recipe');
    } finally {
      setSaving(false);
    }
  };

  const clone = async (r: Recipe) => {
    try {
      await productionApi.cloneRecipe(r.id, { new_name: `${r.name} Copy`, new_code: `${r.code}-COPY` });
      setMsg('Recipe cloned successfully.'); await load();
    } catch (e: any) { setErr(e?.response?.data?.detail || e?.message || 'Failed to clone recipe'); }
  };

  const deactivate = async (r: Recipe) => {
    if (!window.confirm(`Deactivate recipe "${r.code}"?`)) return;
    try {
      await productionApi.updateRecipe(r.id, { is_active: false });
      setMsg('Recipe deactivated.'); await load();
    } catch (e: any) { setErr(e?.response?.data?.detail || e?.message || 'Failed to deactivate'); }
  };

  // ── Live costing preview (inside modal) ───────────────────────────────────
  // Uses item.cost_price from loaded items (same source as backend _calculate_recipe_costs).
  const modalBatchCost = useMemo(
    () => ings.filter((i) => i.raw_item_id).reduce((s, i) => s + localIngCost(itemById[i.raw_item_id], i), 0),
    [ings, itemById]
  );
  const modalCostPerPiece  = form.yield_qty > 0 ? modalBatchCost / form.yield_qty : 0;
  const modalExpectedSales = form.selling_price_per_unit * form.yield_qty;
  const modalGrossProfit   = modalExpectedSales - modalBatchCost;
  const modalMarginPct     = modalExpectedSales > 0 ? (modalGrossProfit / modalExpectedSales) * 100 : 0;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">Recipe &amp; BOM Directory ({filtered.length})</h3>
          <p className="text-[11px] text-[#707070] mt-1">
            Create, cost and manage recipes with ingredient yield, wastage and gross margin controls.
          </p>
        </div>
        <div className="flex gap-2">
          <SearchInput value={search} onChangeValue={setSearch} placeholder="Search recipe..." className="w-full sm:w-60" />
          <Button variant="primary" size="sm" onClick={openCreate} icon={<Plus className="w-3.5 h-3.5" />}>New Recipe</Button>
          <Button variant="secondary" size="sm" onClick={load} loading={loading} icon={<RefreshCw className="w-3.5 h-3.5" />}>Sync</Button>
        </div>
      </div>

      {msg && <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-xs font-semibold text-green-700">{msg}</div>}
      {err && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />{err}
        </div>
      )}

      {/* Recipe Cards */}
      {loading ? (
        <div className="p-12 text-center text-xs text-[#707070]">
          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-[#C79A3B]" />
          Loading recipe registry...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No Recipes Found" description="Create the first recipe/BOM for production and order consumption." icon={<ChefHat className="w-6 h-6" />} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((r) => {
            const totalCost = Number(r.totalRecipeCost ?? r.unitCost ?? 0);
            const yieldQty  = Number(r.yieldQty ?? 1);
            const cpp       = yieldQty > 0 ? totalCost / yieldQty : 0;
            const sp        = Number(r.sellingPricePerUnit ?? 0);
            const expSales  = sp * yieldQty;
            const gp        = expSales - totalCost;
            const gmpct     = expSales > 0 ? (gp / expSales) * 100 : 0;

            return (
              <div key={r.id} className="p-5 rounded-2xl bg-white border border-black/10 shadow-sm space-y-3">
                {/* Header */}
                <div className="flex justify-between gap-3">
                  <div>
                    <div className="flex gap-2 flex-wrap">
                      <h4 className="font-bold text-sm">{r.name}</h4>
                      <Badge variant="outlet">{r.code}</Badge>
                      <Badge variant={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'ACTIVE' : 'INACTIVE'}</Badge>
                    </div>
                    <p className="text-[11px] text-[#707070] mt-1">
                      Finished: {r.finishedItemName ?? '\u2014'} \u00b7 Yield {nf(yieldQty, 2)} {r.finishedUnitSymbol ?? ''}
                    </p>
                  </div>
                </div>

                {/* Costing Summary Strip */}
                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-[#FAF8F5] text-center">
                  <div>
                    <span className="text-[10px] text-[#707070] block">Batch Cost</span>
                    <b className="text-xs">{fmt(totalCost)}</b>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#707070] block">Cost/Piece</span>
                    <b className="text-xs text-[#C79A3B]">{fmt(cpp)}</b>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#707070] block">Margin</span>
                    <b className={`text-xs ${gmpct >= 0 ? 'text-[#2E8B57]' : 'text-red-600'}`}>
                      {sp > 0 ? `${nf(gmpct, 1)}%` : '\u2014'}
                    </b>
                  </div>
                </div>

                {/* Selling price / expected sales row */}
                {sp > 0 && (
                  <div className="grid grid-cols-3 gap-1 text-[11px] text-[#707070] px-1">
                    <span>Sell: {fmt(sp)}/pc</span>
                    <span>Sales: {fmt(expSales)}</span>
                    <span className={gp >= 0 ? 'text-[#2E8B57]' : 'text-red-600'}>GP: {fmt(gp)}</span>
                  </div>
                )}

                {/* Ingredient rows: Name | Qty | Rate | Cost | Waste */}
                <div className="space-y-0.5 max-h-36 overflow-y-auto">
                  <div className="grid grid-cols-6 gap-1 text-[10px] font-bold text-[#707070] pb-1 border-b border-black/5">
                    <span className="col-span-2">Ingredient</span>
                    <span className="text-right">Qty</span>
                    <span className="text-right">Rate</span>
                    <span className="text-right">Cost</span>
                    <span className="text-right">Waste</span>
                  </div>
                  {(r.ingredients || []).map((i) => {
                    const uSym  = i.unitSymbol || i.unit?.symbol || '';
                    const rate  = Number(i.unitCost ?? 0);
                    const cost  = Number(i.costContribution ?? 0);
                    const waste = Number(i.wastePercentage ?? 0);
                    return (
                      <div key={i.id} className="grid grid-cols-6 gap-1 text-[11px] py-0.5 border-b border-black/4">
                        <span className="col-span-2 truncate" title={i.rawItem?.name || i.itemName || ''}>
                          {i.rawItem?.name || i.itemName || 'Ingredient'}
                        </span>
                        <span className="text-right font-mono">{nf(i.quantity, 3)} {uSym}</span>
                        <span className="text-right font-mono text-[#707070]">{rate > 0 ? fmt(rate) : '\u2014'}</span>
                        <span className="text-right font-mono text-[#C79A3B]">{cost > 0 ? fmt(cost) : '\u2014'}</span>
                        <span className="text-right">
                          {waste > 0
                            ? <em className="text-amber-600 not-italic">{nf(waste, 1)}%</em>
                            : <span className="text-[#ccc]">\u2014</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Action buttons */}
                <div className="pt-2 border-t border-black/5 flex flex-wrap justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => openEdit(r)} icon={<Pencil className="w-3 h-3" />}>Edit</Button>
                  <Button variant="secondary" size="sm" onClick={() => clone(r)} icon={<Copy className="w-3 h-3" />}>Clone</Button>
                  <Button variant="secondary" size="sm" onClick={() => onRunBatch(r.id)} icon={<Calculator className="w-3 h-3" />}>Run Batch</Button>
                  {r.isActive && (
                    <Button variant="danger" size="sm" onClick={() => deactivate(r)} icon={<Trash2 className="w-3 h-3" />}>Deactivate</Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════ Create / Edit Modal ══════════ */}
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={editingId ? 'Edit Recipe / BOM' : 'Create Recipe / BOM'}
        subtitle="Net/gross quantities, usable yield %, wastage %, selling price and automatic costing."
        icon={<ChefHat className="w-4 h-4" />}
        maxWidth="3xl"
      >
        {/* Header Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-[11px] font-semibold">
            Recipe Name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full px-3 py-2.5 rounded-xl bg-[#FAF8F5] border border-black/10 text-xs" />
          </label>
          <label className="text-[11px] font-semibold">
            Recipe Code
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="mt-1 w-full px-3 py-2.5 rounded-xl bg-[#FAF8F5] border border-black/10 text-xs" />
          </label>
          <label className="text-[11px] font-semibold">
            Finished / Semi-finished Item
            <select value={form.finished_item_id} onChange={(e) => setForm({ ...form, finished_item_id: e.target.value })}
              className="mt-1 w-full px-3 py-2.5 rounded-xl bg-[#FAF8F5] border border-black/10 text-xs">
              <option value="">Select item</option>
              {finished.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.code})</option>)}
            </select>
          </label>
          <label className="text-[11px] font-semibold">
            Yield Quantity
            <input type="number" min=".0001" step=".01" value={form.yield_qty}
              onChange={(e) => setForm({ ...form, yield_qty: Number(e.target.value) })}
              className="mt-1 w-full px-3 py-2.5 rounded-xl bg-[#FAF8F5] border border-black/10 text-xs" />
          </label>
          <label className="text-[11px] font-semibold">
            Selling Price Per Piece (\u20b9)
            <input type="number" min="0" step=".01" value={form.selling_price_per_unit || ''}
              onChange={(e) => setForm({ ...form, selling_price_per_unit: Number(e.target.value) || 0 })}
              placeholder="Enter selling price..."
              className="mt-1 w-full px-3 py-2.5 rounded-xl bg-[#FAF8F5] border border-black/10 text-xs" />
          </label>
          <label className="text-[11px] font-semibold">
            Preparation Minutes
            <input type="number" min="0" value={form.preparation_minutes}
              onChange={(e) => setForm({ ...form, preparation_minutes: Number(e.target.value) })}
              className="mt-1 w-full px-3 py-2.5 rounded-xl bg-[#FAF8F5] border border-black/10 text-xs" />
          </label>
          <label className="text-[11px] font-semibold sm:col-span-2">
            Description
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1 w-full px-3 py-2.5 rounded-xl bg-[#FAF8F5] border border-black/10 text-xs" />
          </label>
        </div>

        {/* Live costing preview */}
        {ings.some((i) => i.raw_item_id) && (
          <div className="mt-3 p-3 rounded-xl bg-[#FAF8F5] border border-black/8">
            <p className="text-[10px] font-bold text-[#707070] mb-2 flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              Live Costing Preview (based on current inventory rates)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div>
                <span className="text-[10px] text-[#707070] block">Batch Cost</span>
                <b className="text-xs">{fmt(modalBatchCost)}</b>
              </div>
              <div>
                <span className="text-[10px] text-[#707070] block">Cost/Piece</span>
                <b className="text-xs text-[#C79A3B]">{fmt(modalCostPerPiece)}</b>
              </div>
              <div>
                <span className="text-[10px] text-[#707070] block">Expected Sales</span>
                <b className="text-xs text-[#2E8B57]">{fmt(modalExpectedSales)}</b>
              </div>
              <div>
                <span className="text-[10px] text-[#707070] block">Gross Margin</span>
                <b className={`text-xs ${modalMarginPct >= 0 ? 'text-[#3978B8]' : 'text-red-600'}`}>
                  {form.selling_price_per_unit > 0 ? `${nf(modalMarginPct, 1)}%` : '\u2014'}
                </b>
              </div>
            </div>
          </div>
        )}

        {/* Ingredients / BOM Table */}
        <div className="mt-3">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-bold text-xs">Ingredients / BOM</h4>
            <Button variant="secondary" size="sm" onClick={() => setIngs([...ings, blankIng()])} icon={<Plus className="w-3 h-3" />}>
              Add Ingredient
            </Button>
          </div>

          {/* Column headers (desktop only) */}
          <div className="hidden sm:grid grid-cols-12 gap-1.5 px-3 mb-1 text-[10px] font-bold text-[#707070]">
            <span className="col-span-3">Ingredient</span>
            <span className="col-span-2 text-right">Net Qty</span>
            <span className="col-span-2 text-right">Gross Qty</span>
            <span className="col-span-1 text-right">Yield%</span>
            <span className="col-span-1 text-right">Waste%</span>
            <span className="col-span-2 text-right">Rate / Cost</span>
            <span className="col-span-1" />
          </div>

          <div className="space-y-2">
            {ings.map((x, idx) => {
              const selItem = itemById[x.raw_item_id];
              const selUnit = x.unit_id
                ? unitById[x.unit_id]
                : selItem ? unitById[selItem.unit_id] : undefined;
              const rate  = selItem ? Number(selItem.cost_price || 0) : 0;
              const gross = x.gross_quantity > 0 ? x.gross_quantity : x.quantity;
              const cost  = rate * gross;

              return (
                <div key={idx} className="p-3 rounded-xl bg-[#FAF8F5] border border-black/5">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
                    {/* Ingredient selector */}
                    <div className="sm:col-span-3">
                      <select value={x.raw_item_id}
                        onChange={(e) => {
                          const it = rawItems.find((i) => i.id === e.target.value);
                          setIng(idx, { raw_item_id: e.target.value, unit_id: it?.unit_id || '' });
                        }}
                        className="w-full px-2.5 py-2 rounded-lg border border-black/10 text-[11px] bg-white">
                        <option value="">Select Ingredient</option>
                        {rawItems.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.code})</option>)}
                      </select>
                      {selItem && (
                        <span className="text-[10px] text-[#707070] mt-0.5 block">
                          Rate: {fmt(selItem.cost_price)}/{selUnit?.symbol || ''}
                        </span>
                      )}
                    </div>

                    {/* Net Qty */}
                    <div className="sm:col-span-2">
                      <div className="flex items-center gap-1">
                        <input type="number" min=".0001" step=".001" value={x.quantity}
                          onChange={(e) => handleIngChange(idx, 'quantity', Number(e.target.value))}
                          placeholder="Net qty"
                          className="w-full px-2.5 py-2 rounded-lg border border-black/10 text-[11px]" />
                        {selUnit && <span className="text-[10px] text-[#707070] whitespace-nowrap">{selUnit.symbol}</span>}
                      </div>
                    </div>

                    {/* Gross Qty */}
                    <div className="sm:col-span-2">
                      <input type="number" min=".0001" step=".001" value={x.gross_quantity}
                        onChange={(e) => setIng(idx, { gross_quantity: Number(e.target.value) })}
                        placeholder="Gross qty"
                        className="w-full px-2.5 py-2 rounded-lg border border-black/10 text-[11px]" />
                    </div>

                    {/* Usable Yield % */}
                    <div className="sm:col-span-1">
                      <input type="number" min=".01" max="100" step=".01" value={x.usable_yield}
                        onChange={(e) => setIng(idx, { usable_yield: Number(e.target.value) })}
                        placeholder="Yield%"
                        className="w-full px-2.5 py-2 rounded-lg border border-black/10 text-[11px]" />
                    </div>

                    {/* Waste % */}
                    <div className="sm:col-span-1">
                      <input type="number" min="0" max="99.99" step=".01" value={x.waste_percentage}
                        onChange={(e) => handleIngChange(idx, 'waste_percentage', Number(e.target.value))}
                        placeholder="Waste%"
                        className="w-full px-2.5 py-2 rounded-lg border border-black/10 text-[11px]" />
                    </div>

                    {/* Live Rate / Cost display (read-only) */}
                    <div className="sm:col-span-2 text-right">
                      {selItem ? (
                        <>
                          <div className="text-[10px] text-[#707070]">{fmt(rate)}/{selUnit?.symbol || ''}</div>
                          <div className="font-mono font-bold text-xs text-[#C79A3B]">{fmt(cost)}</div>
                        </>
                      ) : (
                        <span className="text-[10px] text-[#707070]">\u2014</span>
                      )}
                    </div>

                    {/* Remove row */}
                    <div className="sm:col-span-1 flex justify-end">
                      <button type="button" disabled={ings.length === 1}
                        onClick={() => setIngs(ings.filter((_, i) => i !== idx))}
                        className="px-2 py-2 rounded-lg border border-red-200 text-red-600 text-[11px] disabled:opacity-40 hover:bg-red-50">
                        \u2715
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Preparation Instructions */}
        <label className="text-[11px] font-semibold mt-3 block">
          Preparation Instructions
          <textarea rows={3} value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
            className="mt-1 w-full px-3 py-2.5 rounded-xl bg-[#FAF8F5] border border-black/10 text-xs" />
        </label>

        {err && (
          <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />{err}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={save}>
            {editingId ? 'Save Changes' : 'Create Recipe'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
