"use client";
import React, { useEffect, useMemo, useState } from "react";
import {
  ChefHat,
  Plus,
  RefreshCw,
  Pencil,
  Copy,
  Calculator,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { productionApi } from "@/api/production";
import { inventoryApi } from "@/api/inventory";
import { Recipe } from "@/types/production.types";
import { Item } from "@/types/inventory.types";
import { Badge, Button, EmptyState, Modal, SearchInput } from "@/components/ui";

type Ing = {
  raw_item_id: string;
  unit_id: string;
  quantity: number;
  gross_quantity: number;
  usable_yield: number;
  waste_percentage: number;
  notes: string;
};
const blank = (): Ing => ({
  raw_item_id: "",
  unit_id: "",
  quantity: 1,
  gross_quantity: 1,
  usable_yield: 100,
  waste_percentage: 0,
  notes: "",
});
export default function RecipeManager({
  onRunBatch,
}: {
  onRunBatch: (id: string) => void;
}) {
  const [recipes, setRecipes] = useState<Recipe[]>([]),
    [items, setItems] = useState<Item[]>([]),
    [search, setSearch] = useState(""),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [open, setOpen] = useState(false),
    [editingId, setEditingId] = useState<string | null>(null),
    [msg, setMsg] = useState<string | null>(null),
    [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    code: "",
    finished_item_id: "",
    description: "",
    yield_qty: 1,
    preparation_minutes: 15,
    instructions: "",
  });
  const [ings, setIngs] = useState<Ing[]>([blank()]);
  const [units, setUnits] = useState<any[]>([]);
  const [stockBalances, setStockBalances] = useState<any[]>([]);
  
  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const [r, i, u, sb] = await Promise.all([
        productionApi.getRecipes(),
        inventoryApi.getItems({ is_active: true }),
        inventoryApi.getUnits(),
        inventoryApi.getStockBalances()
      ]);
      setRecipes(r || []);
      setItems(i || []);
      setUnits(u || []);
      setStockBalances(sb || []);
    } catch (e: any) {
      setErr(
        e?.response?.data?.detail || e?.message || "Failed to load recipes",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const finished = useMemo(
    () =>
      items.filter(
        (i) => i.type === "FINISHED_GOOD" || i.type === "SEMI_FINISHED",
      ),
    [items],
  );
  const raw = useMemo(
    () =>
      items.filter(
        (i) => i.type === "RAW_MATERIAL" || i.type === "SEMI_FINISHED",
      ),
    [items],
  );
  const filtered = recipes.filter((r) =>
    `${r.name} ${r.code} ${r.finishedItemName || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const openCreate = () => {
    setEditingId(null);
    setForm({
      name: "",
      code: "",
      finished_item_id: finished[0]?.id || "",
      description: "",
      yield_qty: 1,
      preparation_minutes: 15,
      instructions: "",
    });
    setIngs([blank()]);
    setErr(null);
    setMsg(null);
    setOpen(true);
  };
  const openEdit = (r: Recipe) => {
    setEditingId(r.id);
    setForm({
      name: r.name || "",
      code: r.code || "",
      finished_item_id: r.finishedItemId || "",
      description: r.description || "",
      yield_qty: Number(r.yieldQty || 1),
      preparation_minutes: Number(r.preparationMinutes || 0),
      instructions: r.instructions || "",
    });
    setIngs(
      (r.ingredients || []).map((i) => ({
        raw_item_id: i.rawItemId,
        unit_id: i.unitId || "",
        quantity: Number(i.quantity || 1),
        gross_quantity: Number(i.grossQuantity ?? i.quantity ?? 1),
        usable_yield: Number(i.usableYield ?? 100),
        waste_percentage: Number(i.wastePercentage ?? 0),
        notes: i.notes || "",
      })),
    );
    setErr(null);
    setMsg(null);
    setOpen(true);
  };
  const setIng = (n: number, p: Partial<Ing>) =>
    setIngs((a) => a.map((x, i) => (i === n ? { ...x, ...p } : x)));
  const save = async () => {
    const valid = ings.filter((i) => i.raw_item_id && i.quantity > 0);
    if (
      !form.name.trim() ||
      !form.code.trim() ||
      !form.finished_item_id ||
      form.yield_qty <= 0 ||
      !valid.length
    ) {
      setErr(
        "Recipe name, code, finished item, yield and at least one ingredient are required.",
      );
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        description: form.description.trim() || undefined,
        instructions: form.instructions.trim() || undefined,
        ingredients: valid.map((i) => ({
          ...i,
          unit_id: i.unit_id || undefined,
          gross_quantity: i.gross_quantity > 0 ? i.gross_quantity : undefined,
          usable_yield: Math.min(100, Math.max(0.01, i.usable_yield)),
          waste_percentage: Math.min(99.99, Math.max(0, i.waste_percentage)),
          notes: i.notes.trim() || undefined,
        })),
      };
      if (editingId) await productionApi.updateRecipe(editingId, payload);
      else await productionApi.createRecipe(payload);
      setOpen(false);
      setMsg(
        editingId
          ? "Recipe updated successfully."
          : "Recipe created successfully.",
      );
      await load();
    } catch (e: any) {
      setErr(
        e?.response?.data?.detail || e?.message || "Failed to save recipe",
      );
    } finally {
      setSaving(false);
    }
  };
  const clone = async (r: Recipe) => {
    try {
      await productionApi.cloneRecipe(r.id, {
        new_name: `${r.name} Copy`,
        new_code: `${r.code}-COPY`,
      });
      setMsg("Recipe cloned successfully.");
      await load();
    } catch (e: any) {
      setErr(
        e?.response?.data?.detail || e?.message || "Failed to clone recipe",
      );
    }
  };
  const deactivate = async (r: Recipe) => {
    if (!window.confirm(`Deactivate recipe ${r.code}?`)) return;
    try {
      await productionApi.updateRecipe(r.id, { is_active: false });
      setMsg("Recipe deactivated.");
      await load();
    } catch (e: any) {
      setErr(
        e?.response?.data?.detail ||
          e?.message ||
          "Failed to deactivate recipe",
      );
    }
  };
  const {
    totalRecipeCost: dynamicTotalRecipeCost,
    finishedSellingPrice: dynamicSellingPrice,
    costPerYield: dynamicCostPerYield,
    margin: dynamicMargin,
    marginPct: dynamicMarginPct,
  } = useMemo(() => {
    let totalCost = 0;
    ings.forEach((x) => {
      const item = raw.find((i) => i.id === x.raw_item_id);
      const rate = Number(item?.cost_price || (item as any)?.costPrice || 0);
      const yield_factor = (Number(x.usable_yield) || 100) / 100;
      let gross_qty = Number(x.gross_quantity) || 0;
      if (!gross_qty || gross_qty <= 0) {
        gross_qty = (Number(x.quantity) || 0) / yield_factor;
      }
      totalCost += gross_qty * rate;
    });

    const yieldQty = Number(form.yield_qty) || 1;
    const cpu = totalCost / yieldQty;

    const finItem = finished.find((i) => i.id === form.finished_item_id);
    const sp = Number(
      finItem?.selling_price || (finItem as any)?.sellingPrice || 0,
    );

    const m = sp - cpu;
    const mp = sp > 0 ? ((m / sp) * 100).toFixed(1) : "0.0";

    return {
      totalRecipeCost: totalCost,
      finishedSellingPrice: sp,
      costPerYield: cpu,
      margin: m,
      marginPct: mp,
    };
  }, [ings, form.yield_qty, form.finished_item_id, raw, finished]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">
            Recipe & BOM Directory ({filtered.length})
          </h3>
          <p className="text-[11px] text-[#707070] mt-1">
            Create, edit and cost recipes with ingredient yield and wastage
            controls.
          </p>
        </div>
        <div className="flex gap-2">
          <SearchInput
            value={search}
            onChangeValue={setSearch}
            placeholder="Search recipe..."
            className="w-full sm:w-60"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={openCreate}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            New Recipe
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={load}
            loading={loading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Sync
          </Button>
        </div>
      </div>
      {msg && (
        <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-xs font-semibold text-green-700">
          {msg}
        </div>
      )}
      {err && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
          {err}
        </div>
      )}
      {loading ? (
        <div className="p-12 text-center text-xs text-[#707070]">
          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-[#C79A3B]" />
          Loading recipe registry...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Recipes Found"
          description="Create the first recipe/BOM for production and order consumption."
          icon={<ChefHat className="w-6 h-6" />}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((r) => {
            const fin = finished.find(
              (f) => f.id === r.finishedItemId || f.id === (r as any).finished_item_id,
            );
            const sp = Number((fin as any)?.sellingPrice || (fin as any)?.selling_price || 0);
            const uc = Number((r as any).unitCost || (r as any).unit_cost || 0);
            const tc = Number((r as any).totalRecipeCost || (r as any).total_recipe_cost || 0);
            const margin = sp - uc;
            const marginPct = sp > 0 ? ((margin / sp) * 100).toFixed(1) : "0.0";
            return (
              <div
                key={r.id}
                className="p-5 rounded-2xl bg-white border border-black/10 shadow-sm space-y-3"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <div className="flex gap-2 flex-wrap">
                      <h4 className="font-bold text-sm">{r.name}</h4>
                      <Badge variant="outlet">{r.code}</Badge>
                      <Badge variant={r.isActive ? "success" : "neutral"}>
                        {r.isActive ? "ACTIVE" : "INACTIVE"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-[#707070] mt-1">
                      Finished: {r.finishedItemName || "-"} | Yield{" "}
                      {Number(r.yieldQty || 1)} {r.finishedUnitSymbol || ""}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-xl bg-[#FAF8F5] text-center">
                  <div>
                    <span className="text-[10px] text-[#707070] block">
                      Total Cost
                    </span>
                    <b>₹{tc.toFixed(2)}</b>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#707070] block">
                      Unit Cost
                    </span>
                    <b className="text-[#2E8B57]">₹{uc.toFixed(2)}</b>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#707070] block">
                      Sell Price
                    </span>
                    <b>₹{sp.toFixed(2)}</b>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#707070] block">
                      Margin
                    </span>
                    <b
                      className={margin > 0 ? "text-[#2E8B57]" : "text-red-600"}
                    >
                      ₹{margin.toFixed(2)} ({marginPct}%)
                    </b>
                  </div>
                </div>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {(r.ingredients || []).map((i: any) => (
                    <div
                      key={i.id}
                      className="flex justify-between text-[11px] border-b border-black/5 pb-1"
                    >
                      <span>
                        {i.rawItem?.name || i.itemName || "Ingredient"}
                      </span>
                      <span className="font-mono">
                        {Number(i.grossQuantity ?? i.quantity).toFixed(2)}{" "}
                        {i.unit?.symbol || i.unitSymbol || ""}{" "}
                        {Number(i.wastePercentage || 0) > 0 && (
                          <em className="text-amber-600 not-italic">
                            +{Number(i.wastePercentage).toFixed(1)}% waste
                          </em>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t border-black/5 flex flex-wrap justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openEdit(r)}
                    icon={<Pencil className="w-3 h-3" />}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => clone(r)}
                    icon={<Copy className="w-3 h-3" />}
                  >
                    Clone
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onRunBatch(r.id)}
                    icon={<Calculator className="w-3 h-3" />}
                  >
                    Run Batch
                  </Button>
                  {r.isActive && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => deactivate(r)}
                      icon={<Trash2 className="w-3 h-3" />}
                    >
                      Deactivate
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Edit Recipe / BOM" : "Create Recipe / BOM"}
        subtitle="Store net/gross quantities, usable yield and wastage percentage."
        icon={<ChefHat className="w-4 h-4" />}
        maxWidth="2xl"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-[11px] font-semibold">
            Recipe Name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full px-3 py-2.5 rounded-xl bg-[#FAF8F5] border border-black/10 text-xs"
            />
          </label>
          <label className="text-[11px] font-semibold">
            Recipe Code
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="mt-1 w-full px-3 py-2.5 rounded-xl bg-[#FAF8F5] border border-black/10 text-xs"
            />
          </label>
          <label className="text-[11px] font-semibold">
            Output Item (Finished / Semi-finished Item)
            <select
              value={form.finished_item_id}
              onChange={(e) =>
                setForm({ ...form, finished_item_id: e.target.value })
              }
              className="mt-1 w-full px-3 py-2.5 rounded-xl bg-[#FAF8F5] border border-black/10 text-xs"
            >
              <option value="">Select item</option>
              {finished.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.code})
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-semibold">
            ONE BATCH MAKES
            <div className="flex gap-2 mt-1">
              <input
                type="number"
                min=".0001"
                step=".01"
                value={form.yield_qty}
                onChange={(e) =>
                  setForm({ ...form, yield_qty: Number(e.target.value) })
                }
                placeholder="Enter quantity"
                className="w-full px-3 py-2.5 rounded-xl bg-[#FAF8F5] border border-black/10 text-xs font-mono"
              />
              <div className="px-4 py-2.5 rounded-xl bg-gray-100 border border-black/10 text-xs text-gray-700 flex items-center justify-center font-bold min-w-[80px] shrink-0">
                {(() => {
                  const fin = finished.find(i => i.id === form.finished_item_id);
                  return (fin as any)?.unit?.symbol || (fin as any)?.unitSymbol || "UNIT";
                })()}
              </div>
            </div>
          </label>
          <label className="text-[11px] font-semibold">
            Preparation Time (Minutes)
            <input
              type="number"
              min="0"
              value={form.preparation_minutes}
              onChange={(e) =>
                setForm({
                  ...form,
                  preparation_minutes: Number(e.target.value),
                })
              }
              placeholder="Enter minutes"
              className="mt-1 w-full px-3 py-2.5 rounded-xl bg-[#FAF8F5] border border-black/10 text-xs"
            />
          </label>
          <label className="text-[11px] font-semibold">
            Recipe Description
            <input
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Enter description"
              className="mt-1 w-full px-3 py-2.5 rounded-xl bg-[#FAF8F5] border border-black/10 text-xs"
            />
          </label>
        </div>
        <div>
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-bold text-xs">Ingredients / BOM</h4>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIngs([...ings, blank()])}
              icon={<Plus className="w-3 h-3" />}
            >
              Add Ingredient
            </Button>
          </div>
          <div className="space-y-2">
            {ings.map((x, n) => (
              <div
                key={n}
                className="p-4 rounded-xl bg-white border border-gray-200 shadow-sm"
              >
                {/* Header Section */}
                <div className="flex justify-between items-start mb-4 border-b border-gray-100 pb-3">
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-md bg-[#FAF8F5] border border-gray-200 flex items-center justify-center font-bold text-gray-600 text-xs shrink-0 mt-1">
                      {n + 1}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 tracking-wider block mb-1">USES</span>
                      <select
                        value={x.raw_item_id}
                        onChange={(e) => {
                          const it = raw.find((i) => i.id === e.target.value);
                          setIng(n, {
                            raw_item_id: e.target.value,
                            unit_id: it?.unit_id || "",
                          });
                        }}
                        className="font-bold text-sm bg-transparent border-b border-dashed border-gray-300 focus:outline-none focus:border-gray-500 pb-0.5 cursor-pointer text-gray-800 -ml-1"
                      >
                        <option value="">Select Ingredient...</option>
                        {raw.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name}
                          </option>
                        ))}
                      </select>
                      
                      {(() => {
                        const it = raw.find((i) => i.id === x.raw_item_id);
                        if (!it) return null;
                        
                        const rate = Number(it?.cost_price || (it as any)?.costPrice || 0);
                        const unitSymbol = (it as any)?.unit?.symbol || (it as any)?.unitSymbol || "";
                        
                        // Calculate stock on hand
                        const itemStock = stockBalances.filter(sb => sb.item_id === x.raw_item_id).reduce((sum, sb) => sum + (Number(sb.quantity) || 0), 0);
                        
                        const reqQty = Number(x.quantity) || 0;
                        const uy = Number(x.usable_yield) || 100;
                        const yieldFactor = uy / 100;
                        const grossQty = reqQty / yieldFactor;

                        return (
                          <div className="mt-3 space-y-1 text-[11px] text-[#707070]">
                            <p>Rate: ₹{rate.toFixed(2)} / {unitSymbol}</p>
                            <p>Stock on hand: {itemStock.toFixed(3)} {unitSymbol}</p>
                            <p className="font-semibold text-gray-800">Required for recipe: {grossQty.toFixed(3)} {unitSymbol}</p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={ings.length === 1}
                    onClick={() => setIngs(ings.filter((_, i) => i !== n))}
                    className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 disabled:opacity-30 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Input Fields Section */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-end">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 tracking-wider mb-1.5">QTY</label>
                    <input
                      type="number"
                      min=".0001"
                      step=".01"
                      value={x.quantity}
                      onChange={(e) => {
                        const req = Number(e.target.value);
                        const uy = Number(x.usable_yield) || 100;
                        const wp = 100 - uy;
                        const yieldFactor = uy / 100;
                        const gross = req / yieldFactor;
                        setIng(n, { quantity: req, gross_quantity: gross, waste_percentage: wp });
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm font-mono text-center focus:ring-2 focus:ring-[#C79A3B] outline-none"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 tracking-wider mb-1.5">UNIT</label>
                    <select
                      disabled
                      className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm font-bold text-gray-500 text-center appearance-none"
                    >
                      <option>
                      {(() => {
                        const it = raw.find((i) => i.id === x.raw_item_id);
                        return (it as any)?.unit?.symbol || (it as any)?.unitSymbol || "UNIT";
                      })()}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 tracking-wider mb-1.5">YIELD %</label>
                    <input
                      type="number"
                      min="0.01"
                      max="100"
                      step=".01"
                      value={x.usable_yield}
                      onChange={(e) => {
                        const uy = Number(e.target.value);
                        const wp = 100 - uy;
                        const req = Number(x.quantity) || 0;
                        const yieldFactor = uy / 100;
                        const gross = req / yieldFactor;
                        setIng(n, { usable_yield: uy, waste_percentage: wp, gross_quantity: gross });
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm font-mono text-center focus:ring-2 focus:ring-[#C79A3B] outline-none"
                    />
                  </div>
                  
                  <div className="flex flex-col items-end justify-center h-full">
                    {(() => {
                      const it = raw.find((i) => i.id === x.raw_item_id);
                      if (!it) return null;
                      const rate = Number(it?.cost_price || (it as any)?.costPrice || 0);
                      const reqQty = Number(x.quantity) || 0;
                      const uy = Number(x.usable_yield) || 100;
                      const yieldFactor = uy / 100;
                      const grossQty = reqQty / yieldFactor;
                      const ingredientCost = grossQty * rate;
                      
                      return (
                        <div className="text-right">
                           <span className="block text-[10px] font-bold text-gray-500 tracking-wider mb-1">INGREDIENT COST</span>
                           <span className="block text-sm font-bold text-[#2E8B57]">₹{ingredientCost.toFixed(2)}</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <label className="text-[11px] font-semibold">
          Preparation Instructions
          <textarea
            rows={3}
            value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
            className="mt-1 w-full px-3 py-2.5 rounded-xl bg-[#FAF8F5] border border-black/10 text-xs"
          />
        </label>

        {/* Dynamic Costing Summary Panel */}
        <div className="p-4 rounded-xl bg-[#FAF8F5] border border-black/10 mt-2">
          <h4 className="font-bold text-xs mb-3 text-[#1C1C1C] flex items-center gap-2">
            <Calculator className="w-4 h-4 text-[#C79A3B]" />
            Live Recipe Costing & Margin
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-2 text-center">
            <div>
              <span className="text-[10px] text-[#707070] block">Total Ingredient Cost</span>
              <b className="text-[#1C1C1C]">₹{dynamicTotalRecipeCost.toFixed(2)}</b>
            </div>
            <div>
              <span className="text-[10px] text-[#707070] block">Output Quantity</span>
              <b className="text-[#1C1C1C]">
                {Number(form.yield_qty || 1)} {(() => {
                  const fin = finished.find(i => i.id === form.finished_item_id);
                  return (fin as any)?.unit?.symbol || (fin as any)?.unitSymbol || "";
                })()}
              </b>
            </div>
            <div>
              <span className="text-[10px] text-[#707070] block">Cost per Output Unit</span>
              <b className="text-[#1C1C1C]">₹{dynamicCostPerYield.toFixed(2)}</b>
            </div>
            <div>
              <span className="text-[10px] text-[#707070] block">Selling Price / Unit</span>
              <b className="text-[#1C1C1C]">₹{dynamicSellingPrice.toFixed(2)}</b>
            </div>
            <div>
              <span className="text-[10px] text-[#707070] block">Gross Margin / Unit</span>
              <b className={dynamicMargin > 0 ? "text-[#2E8B57]" : "text-red-600"}>
                ₹{dynamicMargin.toFixed(2)}
              </b>
            </div>
            <div>
              <span className="text-[10px] text-[#707070] block">Margin %</span>
              <div className="flex items-center justify-center gap-1">
                <b className={dynamicMargin > 0 ? "text-[#2E8B57]" : "text-red-600"}>
                  {dynamicMarginPct}%
                </b>
                {dynamicSellingPrice > 0 && (dynamicMargin / dynamicSellingPrice) < 0.20 && (
                  <span title="Low Margin Warning (< 20%)">
                    <AlertTriangle className="w-3 h-3 text-red-500" />
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {err && (
          <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs mt-2">
            {err}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={save}>
            {editingId ? "Save Changes" : "Create Recipe"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
