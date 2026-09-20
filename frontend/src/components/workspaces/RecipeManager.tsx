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
  Eye,
  History,
  MoreVertical,
  CheckCircle2,
  XCircle,
  X,
  Loader2,
} from "lucide-react";
import { productionApi } from "@/api/production";
import { apiClient } from "@/api/client";
import { inventoryApi } from "@/api/inventory";
import { Recipe } from "@/types/production.types";
import { Item, Unit } from "@/types/inventory.types";
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

type UnitConversionRule = {
  from_unit_id: string;
  to_unit_id: string;
  conversion_factor: number | string;
};

const normalizeUnitToken = (value?: string): string =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

const normalizePositiveQuantity = (value: unknown, fallback = 1): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const STANDARD_UNIT_CONVERSIONS: Record<string, number> = {
  "kg>g": 1000,
  "kg>gm": 1000,
  "g>kg": 0.001,
  "gm>kg": 0.001,
  "kg>gram": 1000,
  "gm>gram": 1,
  "gram>kg": 0.001,
  "gram>gm": 1,
  "kg>grams": 1000,
  "gm>grams": 1,
  "grams>kg": 0.001,
  "grams>gm": 1,
  "g>mg": 1000,
  "mg>g": 0.001,
  "l>ml": 1000,
  "ml>l": 0.001,
  "litre>ml": 1000,
  "ml>litre": 0.001,
  "liter>ml": 1000,
  "ml>liter": 0.001,
  "dozen>pcs": 12,
  "pcs>dozen": 1 / 12,
  "dozen>pieces": 12,
  "pieces>dozen": 1 / 12,
  "box>pcs": 1,
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

// Backend RecipeResponse uses snake_case while the frontend Recipe type
// consumes camelCase. Normalize at the Recipe page boundary so the rest of
// this component always works with one consistent runtime shape.
const normalizeRecipe = (r: any): Recipe => ({
  ...r,
  finishedItemId: r.finishedItemId ?? r.finished_item_id,
  finishedItemName: r.finishedItemName ?? r.finished_item_name,
  finishedItemCode: r.finishedItemCode ?? r.finished_item_code,
  finishedUnitSymbol: r.finishedUnitSymbol ?? r.finished_unit_symbol,
  // Keep the saved backend yield as the single source for the edit/costing form.
  // Do not silently turn a valid saved yield into 1.
  yieldQty: normalizePositiveQuantity(r.yieldQty ?? r.yield_qty, 1),
  preparationMinutes: r.preparationMinutes ?? r.preparation_minutes,
  isCurrent: r.isCurrent ?? r.is_current,
  isActive: r.isActive ?? r.is_active,
  totalRecipeCost: r.totalRecipeCost ?? r.total_recipe_cost,
  unitCost: r.unitCost ?? r.unit_cost,
  ingredients: (r.ingredients || []).map((i: any) => ({
    ...i,
    rawItemId: i.rawItemId ?? i.raw_item_id,
    unitId: i.unitId ?? i.unit_id,
    grossQuantity: i.grossQuantity ?? i.gross_quantity,
    usableYield: i.usableYield ?? i.usable_yield,
    wastePercentage: i.wastePercentage ?? i.waste_percentage,
    itemName: i.itemName ?? i.item_name,
    itemCode: i.itemCode ?? i.item_code,
    itemType: i.itemType ?? i.item_type,
    unitSymbol: i.unitSymbol ?? i.unit_symbol,
    unitCost: i.unitCost ?? i.unit_cost,
    costContribution: i.costContribution ?? i.cost_contribution,
    isSubRecipe: i.isSubRecipe ?? i.is_sub_recipe,
    subRecipeId: i.subRecipeId ?? i.sub_recipe_id,
  })),
});
export default function RecipeManager({
  onRunBatch,
}: {
  onRunBatch: (id: string) => void;
}) {
  const [recipes, setRecipes] = useState<Recipe[]>([]),
    [items, setItems] = useState<Item[]>([]),
    [units, setUnits] = useState<Unit[]>([]),
    [search, setSearch] = useState(""),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [open, setOpen] = useState(false),
    [editingId, setEditingId] = useState<string | null>(null),
    [msg, setMsg] = useState<string | null>(null),
    [err, setErr] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "ALL" | "INACTIVE">("ACTIVE");
  const [viewingRecipe, setViewingRecipe] = useState<Recipe | null>(null);
  const [historyRecipe, setHistoryRecipe] = useState<Recipe | null>(null);
  const [historyItems, setHistoryItems] = useState<Recipe[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [unitConversions, setUnitConversions] = useState<UnitConversionRule[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    | { kind: "DELETE" | "DEACTIVATE"; recipe: Recipe }
    | null
  >(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<"DELETE" | "DEACTIVATE" | null>(null);

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
  
  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      // Recipe directory must load independently. Item/stock master data
      // is only required when creating or editing a recipe.
      // A failure/timeout in inventory APIs must never make the Recipe
      // directory show Network Error.
      const r = await productionApi.getRecipes();
      setRecipes((r || []).map(normalizeRecipe));
    } catch (e: any) {
      setErr(
        e?.response?.data?.detail || e?.message || "Failed to load recipes",
      );
    } finally {
      setLoading(false);
    }
  };

  const ensureItemsLoaded = async (): Promise<Item[]> => {
    if (items.length > 0) return items;

    try {
      const i = await inventoryApi.getItems({ is_active: true });
      const loadedItems = i || [];
      setItems(loadedItems);
      return loadedItems;
    } catch (e: any) {
      const message =
        e?.response?.data?.detail ||
        e?.message ||
        "Failed to load items";
      setErr(message);
      throw e;
    }
  };

  const ensureUnitsLoaded = async (): Promise<Unit[]> => {
    if (units.length > 0) return units;

    try {
      const loadedUnits = (await inventoryApi.getUnits()) || [];
      setUnits(loadedUnits);
      return loadedUnits;
    } catch (e: any) {
      const message =
        e?.response?.data?.detail ||
        e?.message ||
        "Failed to load units";
      setErr(message);
      throw e;
    }
  };

  const ensureUnitConversionsLoaded = async (): Promise<UnitConversionRule[]> => {
    if (unitConversions.length > 0) return unitConversions;

    try {
      const response = await apiClient.get<UnitConversionRule[]>(
        "/inventory/unit-conversions",
      );
      const loadedConversions = Array.isArray(response.data)
        ? response.data
        : [];
      setUnitConversions(loadedConversions);
      return loadedConversions;
    } catch {
      // Standard KG/G/L/ML/PCS conversions remain available locally.
      // Custom conversions, when unavailable, will fail server-side during save.
      return [];
    }
  };
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!msg && !err) return;
    const timer = window.setTimeout(() => {
      setMsg(null);
      setErr(null);
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [msg, err]);
  const finished = useMemo(
    () =>
      items.filter(
        (i) => i.type === "FINISHED_GOOD" || i.type === "SEMI_FINISHED",
      ),
    [items],
  );
  // Recipe ingredients can come from any active stock-bearing item type
  // that is valid as an input: raw material, semi-finished, or packaging.
  // Finished goods and assets are intentionally excluded.
  const raw = useMemo(
    () =>
      items.filter((i) => {
        const itemType = String(i.type || "").trim().toUpperCase();
        return (
          itemType === "RAW_MATERIAL" ||
          itemType === "SEMI_FINISHED" ||
          itemType === "PACKAGING"
        );
      }),
    [items],
  );
  const activeRecipes = useMemo(
    () => recipes.filter((r) => r.isActive && r.isCurrent !== false),
    [recipes],
  );
  const inactiveRecipes = useMemo(
    () => recipes.filter((r) => !r.isActive || r.isCurrent === false),
    [recipes],
  );
  const visibleRecipes =
    statusFilter === "ACTIVE"
      ? activeRecipes
      : statusFilter === "INACTIVE"
        ? inactiveRecipes
        : recipes;
  const filtered = visibleRecipes.filter((r) =>
    `${r.name} ${r.code} ${r.finishedItemName || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const openCreate = async () => {
    try {
      const [loadedItems] = await Promise.all([
        ensureItemsLoaded(),
        ensureUnitsLoaded(),
        ensureUnitConversionsLoaded(),
      ]);
      const availableItems = loadedItems.length ? loadedItems : items;
      const finishedItems = availableItems.filter(
        (i: any) => i.type === "FINISHED_GOOD" || i.type === "SEMI_FINISHED",
      );

      setEditingId(null);
      setForm({
        name: "",
        code: "",
        finished_item_id: finishedItems[0]?.id || "",
        description: "",
        yield_qty: 1,
        preparation_minutes: 15,
        instructions: "",
      });
      setIngs([blank()]);
      setErr(null);
      setMsg(null);
      setOpen(true);
    } catch {
      // ensureItemsLoaded already surfaces the user-facing error.
    }
  };

  const openEdit = async (r: Recipe) => {
    try {
      const [fullRecipe] = await Promise.all([
        productionApi.getRecipe(r.id),
        ensureItemsLoaded(),
        ensureUnitsLoaded(),
        ensureUnitConversionsLoaded(),
      ]);

      // Always use the detail response for edit mode. The list endpoint may
      // omit/transform fields, while GET /recipes/{id} is the authoritative
      // persisted recipe including yield_qty.
      const recipe = normalizeRecipe(fullRecipe);

      setEditingId(recipe.id);
      setForm({
        name: recipe.name || "",
        code: recipe.code || "",
        finished_item_id: recipe.finishedItemId || "",
        description: recipe.description || "",
        yield_qty: normalizePositiveQuantity(
          recipe.yieldQty ?? (recipe as any).yield_qty,
          1,
        ),
        preparation_minutes: Number(recipe.preparationMinutes || 0),
        instructions: recipe.instructions || "",
      });
      setIngs(
        (recipe.ingredients || []).map((i) => ({
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
    } catch {
      // ensureItemsLoaded already surfaces the user-facing error.
    }
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
        // Send the numeric yield explicitly so the backend always receives
        // the value currently shown in ONE BATCH MAKES.
        yield_qty: normalizePositiveQuantity(form.yield_qty, 1),
        // Keep the API payload explicit. The backend contract is snake_case;
        // yieldQty is included only as a compatibility alias for any older
        // recipe endpoint still expecting camelCase.
        yieldQty: normalizePositiveQuantity(form.yield_qty, 1),
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
  const requestDeactivate = (r: Recipe) => {
    setOpenMenuId(null);
    setConfirmAction({ kind: "DEACTIVATE", recipe: r });
  };

  const requestDelete = (r: Recipe) => {
    setOpenMenuId(null);
    setConfirmAction({ kind: "DELETE", recipe: r });
  };

  const executeConfirmedAction = async () => {
    if (!confirmAction || actionBusy) return;

    const { kind, recipe } = confirmAction;
    setActionBusy(true);
    setActionSuccess(null);
    setErr(null);
    setMsg(null);

    try {
      if (kind === "DELETE") {
        const recipeApi = productionApi as typeof productionApi & {
          deleteRecipe?: (id: string) => Promise<{ success: boolean; message: string }>;
        };

        if (typeof recipeApi.deleteRecipe === "function") {
          await recipeApi.deleteRecipe(recipe.id);
        } else {
          // Backward-compatible fallback for a stale frontend bundle where
          // productionApi.deleteRecipe has not yet been exposed.
          await apiClient.delete(`/recipes/${recipe.id}`);
        }
      } else {
        await productionApi.updateRecipe(recipe.id, { is_active: false });
      }

      setActionSuccess(kind);
      await new Promise((resolve) => setTimeout(resolve, 900));

      setConfirmAction(null);
      setActionSuccess(null);
      await load();

      setMsg(
        kind === "DELETE"
          ? `${recipe.name} was removed successfully.`
          : `${recipe.name} was deactivated successfully.`,
      );
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      let message: string | undefined;

      if (typeof detail === "string") {
        message = detail;
      } else if (detail && typeof detail === "object") {
        const base = typeof detail.message === "string" ? detail.message : "";
        const references = Array.isArray(detail.references)
          ? detail.references.filter(Boolean).join(" • ")
          : "";
        const action = typeof detail.action === "string" ? detail.action : "";
        message = [base, references, action].filter(Boolean).join(" ");
      }

      setErr(
        message ||
          e?.message ||
          (kind === "DELETE"
            ? "Failed to remove recipe"
            : "Failed to deactivate recipe"),
      );
      setActionSuccess(null);
    } finally {
      setActionBusy(false);
    }
  };

  const openHistory = async (r: Recipe) => {
    setOpenMenuId(null);
    setHistoryRecipe(r);
    setHistoryItems([]);
    setHistoryLoading(true);
    try {
      const history = await productionApi.getRecipeHistory(r.id);
      setHistoryItems(history || []);
    } catch (e: any) {
      setErr(
        e?.response?.data?.detail ||
          e?.message ||
          "Failed to load recipe history",
      );
      setHistoryRecipe(null);
    } finally {
      setHistoryLoading(false);
    }
  };
  const resolveUnitConversionFactor = (
    fromUnitId: string,
    toUnitId: string,
  ): number => {
    if (!fromUnitId || !toUnitId || fromUnitId === toUnitId) return 1;

    const direct = unitConversions.find(
      (rule) =>
        rule.from_unit_id === fromUnitId &&
        rule.to_unit_id === toUnitId,
    );
    if (direct) return Number(direct.conversion_factor);

    const reverse = unitConversions.find(
      (rule) =>
        rule.from_unit_id === toUnitId &&
        rule.to_unit_id === fromUnitId,
    );
    if (reverse) {
      const factor = Number(reverse.conversion_factor);
      return factor > 0 ? 1 / factor : 1;
    }

    const fromUnit = units.find((unit) => unit.id === fromUnitId);
    const toUnit = units.find((unit) => unit.id === toUnitId);
    const fromSymbol = normalizeUnitToken(fromUnit?.symbol || fromUnit?.name);
    const toSymbol = normalizeUnitToken(toUnit?.symbol || toUnit?.name);
    const standard = STANDARD_UNIT_CONVERSIONS[`${fromSymbol}>${toSymbol}`];

    return standard ?? NaN;
  };

  const getIngredientCostBreakdown = (ingredient: Ing) => {
    const item = raw.find((entry) => entry.id === ingredient.raw_item_id);
    if (!item) return null;

    const itemMasterUnitId = item.unit_id;
    const recipeUnitId = ingredient.unit_id || itemMasterUnitId;
    const rate = Number(
      item.cost_price ?? (item as any)?.costPrice ?? 0,
    );
    const usableYield = Number(ingredient.usable_yield) || 100;
    const yieldFactor = usableYield / 100;
    const grossQty =
      Number(ingredient.gross_quantity) > 0
        ? Number(ingredient.gross_quantity)
        : (Number(ingredient.quantity) || 0) / yieldFactor;
    const conversionFactor = resolveUnitConversionFactor(
      recipeUnitId,
      itemMasterUnitId,
    );

    if (!Number.isFinite(conversionFactor) || conversionFactor <= 0) {
      return {
        item,
        rate,
        grossQty,
        conversionFactor: null,
        convertedQty: null,
        ingredientCost: null,
        recipeUnit: units.find((unit) => unit.id === recipeUnitId),
        itemMasterUnit: units.find((unit) => unit.id === itemMasterUnitId),
      };
    }

    const convertedQty = grossQty * conversionFactor;
    return {
      item,
      rate,
      grossQty,
      conversionFactor,
      convertedQty,
      ingredientCost: convertedQty * rate,
      recipeUnit: units.find((unit) => unit.id === recipeUnitId),
      itemMasterUnit: units.find((unit) => unit.id === itemMasterUnitId),
    };
  };

  const {
    totalRecipeCost: dynamicTotalRecipeCost,
    finishedSellingPrice: dynamicSellingPrice,
    costPerYield: dynamicCostPerYield,
    margin: dynamicMargin,
    marginPct: dynamicMarginPct,
  } = useMemo(() => {
    let totalCost = 0;
    let hasUnpricedConversion = false;

    ings.forEach((x) => {
      const breakdown = getIngredientCostBreakdown(x);
      if (!breakdown || breakdown.ingredientCost == null) {
        hasUnpricedConversion = true;
        return;
      }
      totalCost += breakdown.ingredientCost;
    });

    const yieldQty = normalizePositiveQuantity(form.yield_qty, 1);
    const cpu = hasUnpricedConversion
      ? null
      : totalCost / yieldQty;

    const finItem = finished.find((i) => i.id === form.finished_item_id);
    const sp = Number(
      finItem?.selling_price || (finItem as any)?.sellingPrice || 0,
    );

    const m = cpu == null ? null : sp - cpu;
    const mp =
      m == null || sp <= 0
        ? null
        : ((m / sp) * 100).toFixed(1);

    return {
      totalRecipeCost: hasUnpricedConversion ? null : totalCost,
      finishedSellingPrice: sp,
      costPerYield: cpu,
      margin: m,
      marginPct: mp,
    };
  }, [ings, form.yield_qty, form.finished_item_id, raw, finished, units, unitConversions]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ChefHat className="w-4 h-4 text-[#C79A3B]" />
            <h3 className="text-sm font-bold text-[#1C1C1C]">Recipe &amp; BOM Directory</h3>
            <span className="px-2 py-0.5 rounded-full bg-[#FAF8F5] border border-black/10 text-[10px] font-bold text-[#707070]">
              {filtered.length}
            </span>
          </div>
          <p className="text-[11px] text-[#707070] mt-1 max-w-2xl leading-relaxed">
            Admin-controlled recipe master. Saving a recipe never changes stock. Outlet production/sale uses the active recipe to consume that outlet's ingredient stock.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
          <SearchInput
            value={search}
            onChangeValue={setSearch}
            placeholder="Search recipe..."
            className="w-full sm:w-64"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "ACTIVE" | "ALL" | "INACTIVE")}
            className="h-9 px-3 rounded-xl bg-white border border-black/10 text-xs font-semibold text-[#444]"
          >
            <option value="ACTIVE">Active only</option>
            <option value="ALL">All versions</option>
            <option value="INACTIVE">Inactive/history</option>
          </select>
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
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-[#707070]">
                      <span>Version {r.version || 1}</span>
                      <span>•</span>
                      <span>{r.isCurrent !== false ? "Current" : "Historical"}</span>
                    </div>
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
                <div className="pt-2 border-t border-black/5 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => { setViewingRecipe(r); setOpenMenuId(null); }}
                      icon={<Eye className="w-3 h-3" />}
                    >
                      View
                    </Button>
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
                  </div>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenMenuId(openMenuId === r.id ? null : r.id)}
                      className="w-9 h-9 rounded-xl border border-black/10 bg-white hover:bg-[#FAF8F5] flex items-center justify-center transition-colors"
                      aria-label={`More actions for ${r.name}`}
                    >
                      <MoreVertical className="w-4 h-4 text-[#555]" />
                    </button>
                    {openMenuId === r.id && (
                      <div className="absolute right-0 bottom-11 z-20 w-44 rounded-xl bg-white border border-black/10 shadow-lg p-1.5">
                        <button
                          type="button"
                          onClick={() => { setViewingRecipe(r); setOpenMenuId(null); }}
                          className="w-full px-3 py-2 rounded-lg text-left text-xs hover:bg-[#FAF8F5] flex items-center gap-2"
                        >
                          <Eye className="w-3.5 h-3.5" /> View details
                        </button>
                        <button
                          type="button"
                          onClick={() => openHistory(r)}
                          className="w-full px-3 py-2 rounded-lg text-left text-xs hover:bg-[#FAF8F5] flex items-center gap-2"
                        >
                          <History className="w-3.5 h-3.5" /> Version history
                        </button>
                        <button
                          type="button"
                          onClick={() => { setOpenMenuId(null); onRunBatch(r.id); }}
                          className="w-full px-3 py-2 rounded-lg text-left text-xs hover:bg-[#FAF8F5] flex items-center gap-2"
                        >
                          <Calculator className="w-3.5 h-3.5" /> Run batch
                        </button>
                        {r.isActive && (
                          <button
                            type="button"
                            onClick={() => requestDeactivate(r)}
                            className="w-full px-3 py-2 rounded-lg text-left text-xs hover:bg-amber-50 text-amber-700 flex items-center gap-2"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" /> Deactivate
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => requestDelete(r)}
                          className="w-full px-3 py-2 rounded-lg text-left text-xs hover:bg-red-50 text-red-600 flex items-center gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {(msg || err) && (
        <div className="fixed top-5 right-5 z-[120] w-[min(380px,calc(100vw-2rem))] pointer-events-none">
          <div
            role="alert"
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-sm ${
              err
                ? "border-red-200 bg-white/95 text-red-800"
                : "border-emerald-200 bg-white/95 text-emerald-800"
            }`}
          >
            <div
              className={`mt-0.5 shrink-0 rounded-full p-1.5 ${
                err ? "bg-red-50" : "bg-emerald-50"
              }`}
            >
              {err ? (
                <XCircle className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold uppercase tracking-[0.08em]">
                {err ? "Action failed" : "Recipe updated"}
              </div>
              <div className="mt-0.5 text-xs leading-relaxed text-[#4B4B4B]">
                {err || msg}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setMsg(null);
                setErr(null);
              }}
              className="shrink-0 rounded-lg p-1.5 text-[#777] hover:bg-black/5 hover:text-[#222] transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <Modal
        isOpen={!!confirmAction}
        onClose={() => {
          if (!actionBusy) setConfirmAction(null);
        }}
        title={
          confirmAction?.kind === "DELETE"
            ? "Permanently delete recipe?"
            : "Deactivate recipe?"
        }
        subtitle={confirmAction?.recipe ? `${confirmAction.recipe.name} • ${confirmAction.recipe.code}` : undefined}
        icon={
          <AlertTriangle
            className={`w-4 h-4 ${
              confirmAction?.kind === "DELETE" ? "text-red-600" : "text-amber-600"
            }`}
          />
        }
        maxWidth="md"
      >
        {confirmAction && (
          <div className="space-y-4">
            {actionSuccess ? (
              <div className="py-8 text-center">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-9 h-9 animate-pulse" />
                </div>
                <h4 className="mt-4 text-base font-bold text-[#1F5E3B]">
                  {actionSuccess === "DELETE"
                    ? "Recipe deleted successfully"
                    : "Recipe deactivated successfully"}
                </h4>
                <p className="mt-1 text-xs text-[#6A6A6A]">
                  Updating the recipe directory…
                </p>
              </div>
            ) : actionBusy ? (
              <div className="py-8 text-center">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-[#FAF8F5] border border-black/5 text-[#C79A3B] flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
                <h4 className="mt-4 text-base font-bold text-[#222]">
                  {confirmAction.kind === "DELETE" ? "Deleting recipe…" : "Deactivating recipe…"}
                </h4>
                <p className="mt-1 text-xs text-[#6A6A6A]">
                  Please wait. Do not close this window.
                </p>
                <div className="mt-5 mx-auto h-1.5 max-w-[250px] rounded-full bg-[#EEE8DF] overflow-hidden">
                  <div className="h-full w-2/3 rounded-full bg-[#C79A3B] animate-pulse" />
                </div>
              </div>
            ) : (
              <>
                <div
                  className={`rounded-2xl border p-4 ${
                    confirmAction.kind === "DELETE"
                      ? "border-red-100 bg-red-50/60"
                      : "border-amber-100 bg-amber-50/60"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${confirmAction.kind === "DELETE" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#222]">
                        {confirmAction.kind === "DELETE"
                          ? "Permanently delete this recipe?"
                          : "Deactivate this recipe?"}
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-[#626262]">
                        {confirmAction.kind === "DELETE"
                          ? "This will permanently remove the recipe version from the system. Linked production/sale records for this recipe version will also be removed. This action cannot be undone."
                          : "The recipe will no longer be available for new production or sale transactions. Existing history remains preserved."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    variant="secondary"
                    onClick={() => setConfirmAction(null)}
                  >
                    Cancel
                  </Button>
                  <button
                    type="button"
                    onClick={executeConfirmedAction}
                    className={`h-9 px-4 rounded-xl text-xs font-bold text-white transition-colors ${
                      confirmAction.kind === "DELETE"
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-amber-600 hover:bg-amber-700"
                    }`}
                  >
                    {confirmAction.kind === "DELETE"
                      ? "Permanently Delete"
                      : "Deactivate Recipe"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!viewingRecipe}
        onClose={() => setViewingRecipe(null)}
        title={viewingRecipe ? viewingRecipe.name : "Recipe Details"}
        subtitle={viewingRecipe ? `${viewingRecipe.code} • Version ${viewingRecipe.version || 1}` : undefined}
        icon={<Eye className="w-4 h-4" />}
        maxWidth="2xl"
      >
        {viewingRecipe && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-[#FAF8F5] border border-black/5">
                <span className="text-[10px] text-[#707070] block">Status</span>
                <b className="text-sm">{viewingRecipe.isActive ? "ACTIVE" : "INACTIVE"}</b>
              </div>
              <div className="p-3 rounded-xl bg-[#FAF8F5] border border-black/5">
                <span className="text-[10px] text-[#707070] block">Finished Item</span>
                <b className="text-sm">{viewingRecipe.finishedItemName || "-"}</b>
              </div>
              <div className="p-3 rounded-xl bg-[#FAF8F5] border border-black/5">
                <span className="text-[10px] text-[#707070] block">Yield</span>
                <b className="text-sm">{Number(viewingRecipe.yieldQty || 1)} {viewingRecipe.finishedUnitSymbol || ""}</b>
              </div>
              <div className="p-3 rounded-xl bg-[#FAF8F5] border border-black/5">
                <span className="text-[10px] text-[#707070] block">Unit Cost</span>
                <b className="text-sm text-[#2E8B57]">₹{Number(viewingRecipe.unitCost || 0).toFixed(2)}</b>
              </div>
            </div>

            {viewingRecipe.description && (
              <div>
                <span className="text-[10px] font-bold text-[#707070] uppercase tracking-wider">Description</span>
                <p className="mt-1 text-xs text-[#444]">{viewingRecipe.description}</p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-xs">Ingredients / BOM</h4>
                <span className="text-[10px] text-[#707070]">{viewingRecipe.ingredients?.length || 0} items</span>
              </div>
              <div className="rounded-xl border border-black/10 overflow-hidden">
                {(viewingRecipe.ingredients || []).map((i: any) => (
                  <div key={i.id} className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2.5 border-b border-black/5 last:border-0 text-xs">
                    <div>
                      <div className="font-semibold">{i.itemName || i.rawItem?.name || "Ingredient"}</div>
                      <div className="text-[10px] text-[#707070]">{i.itemCode || i.rawItem?.code || ""}</div>
                    </div>
                    <div className="font-mono">{Number(i.grossQuantity ?? i.quantity ?? 0).toFixed(3)} {i.unitSymbol || i.unit?.symbol || ""}</div>
                    <div className="font-semibold text-right">₹{Number(i.costContribution ?? 0).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setViewingRecipe(null)}>Close</Button>
              <Button variant="primary" onClick={() => { const r = viewingRecipe; setViewingRecipe(null); openEdit(r); }}>Edit Recipe</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!historyRecipe}
        onClose={() => setHistoryRecipe(null)}
        title={historyRecipe ? `${historyRecipe.name} History` : "Recipe History"}
        subtitle={historyRecipe ? `${historyRecipe.code} • Version history` : undefined}
        icon={<History className="w-4 h-4" />}
        maxWidth="2xl"
      >
        {historyLoading ? (
          <div className="p-8 text-center text-xs text-[#707070]">
            <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-[#C79A3B]" />
            Loading recipe history...
          </div>
        ) : (
          <div className="space-y-2">
            {historyItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-black/10 bg-white">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">Version {item.version || 1}</span>
                    <Badge variant={item.isActive ? "success" : "neutral"}>{item.isActive ? "ACTIVE" : "INACTIVE"}</Badge>
                  </div>
                  <p className="text-[10px] text-[#707070] mt-1">
                    {item.finishedItemName || "-"} • Yield {Number(item.yieldQty || 1)} {item.finishedUnitSymbol || ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-[#707070]">Unit cost</div>
                  <div className="font-semibold text-sm">₹{Number(item.unitCost || 0).toFixed(2)}</div>
                </div>
              </div>
            ))}
            {!historyItems.length && (
              <div className="p-8 text-center text-xs text-[#707070]">No history found.</div>
            )}
          </div>
        )}
      </Modal>

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
                            {i.name} {i.code ? `(${i.code})` : ""}
                          </option>
                        ))}
                      </select>
                      
                      {(() => {
                        const it = raw.find((i) => i.id === x.raw_item_id);
                        if (!it) return null;
                        
                        const breakdown = getIngredientCostBreakdown(x);
                        if (!breakdown) return null;

                        const recipeUnitSymbol =
                          breakdown.recipeUnit?.symbol ||
                          (breakdown.recipeUnit as any)?.name ||
                          "UNIT";
                        const masterUnitSymbol =
                          breakdown.itemMasterUnit?.symbol ||
                          (breakdown.itemMasterUnit as any)?.name ||
                          "UNIT";

                        return (
                          <div className="mt-3 space-y-1 text-[11px] text-[#707070]">
                            <p>
                              Rate: ₹{breakdown.rate.toFixed(2)} / {masterUnitSymbol}
                            </p>
                            <p className="font-semibold text-gray-800">
                              Required for recipe: {breakdown.grossQty.toFixed(3)} {recipeUnitSymbol}
                            </p>
                            {breakdown.convertedQty != null &&
                              breakdown.recipeUnit?.id !== breakdown.itemMasterUnit?.id && (
                                <p className="text-[#8A8A8A]">
                                  Costing qty: {breakdown.convertedQty.toFixed(6)} {masterUnitSymbol}
                                </p>
                              )}
                            {breakdown.ingredientCost == null && (
                              <p className="text-red-600 font-semibold">
                                No valid unit conversion configured.
                              </p>
                            )}
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
                      value={x.unit_id}
                      disabled={!x.raw_item_id || units.length === 0}
                      onChange={(e) => setIng(n, { unit_id: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm font-bold text-gray-700 text-center focus:ring-2 focus:ring-[#C79A3B] outline-none disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {x.raw_item_id ? (units.length ? "Select unit" : "Loading units...") : "Select ingredient"}
                      </option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.symbol}{u.name ? ` — ${u.name}` : ""}
                        </option>
                      ))}
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
                      const breakdown = getIngredientCostBreakdown(x);
                      if (!breakdown) return null;

                      return (
                        <div className="text-right">
                           <span className="block text-[10px] font-bold text-gray-500 tracking-wider mb-1">INGREDIENT COST</span>
                           <span className={`block text-sm font-bold ${breakdown.ingredientCost == null ? "text-red-600" : "text-[#2E8B57]"}`}>
                             {breakdown.ingredientCost == null
                               ? "—"
                               : `₹${breakdown.ingredientCost.toFixed(2)}`}
                           </span>
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
              <b className="text-[#1C1C1C]">
                {dynamicTotalRecipeCost == null ? "—" : `₹${dynamicTotalRecipeCost.toFixed(2)}`}
              </b>
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
              <b className="text-[#1C1C1C]">
                {dynamicCostPerYield == null ? "—" : `₹${dynamicCostPerYield.toFixed(2)}`}
              </b>
            </div>
            <div>
              <span className="text-[10px] text-[#707070] block">Selling Price / Unit</span>
              <b className="text-[#1C1C1C]">₹{dynamicSellingPrice.toFixed(2)}</b>
            </div>
            <div>
              <span className="text-[10px] text-[#707070] block">Gross Margin / Unit</span>
              <b className={dynamicMargin != null && dynamicMargin > 0 ? "text-[#2E8B57]" : "text-red-600"}>
                {dynamicMargin == null ? "—" : `₹${dynamicMargin.toFixed(2)}`}
              </b>
            </div>
            <div>
              <span className="text-[10px] text-[#707070] block">Margin %</span>
              <div className="flex items-center justify-center gap-1">
                <b className={dynamicMargin != null && dynamicMargin > 0 ? "text-[#2E8B57]" : "text-red-600"}>
                  {dynamicMarginPct == null ? "—" : `${dynamicMarginPct}%`}
                </b>
                {dynamicMargin != null && dynamicSellingPrice > 0 && (dynamicMargin / dynamicSellingPrice) < 0.20 && (
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
