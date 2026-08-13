import React, { useState, useEffect, useCallback } from 'react';
import {
  ChefHat,
  Layers,
  History,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Flame,
  X,
  RefreshCw
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { productionApi } from '../../api/production.api';
import { inventoryApi } from '../../api/inventory.api';
import {
  Recipe,
  ProductionPreview,
  ProductionOrder
} from '../../types/production.types';
import { Item, Warehouse, Unit } from '../../types/inventory.types';
import { useAuth } from '../../context/AuthContext';
import { formatINR, formatDateTimeIN } from '../../utils/formatters';

export const ProductionPage: React.FC = () => {
  const { user, selectedBranchId } = useAuth();
  const [activeTab, setActiveTab] = useState<'recipes' | 'execute' | 'orders'>('recipes');

  // Master Data
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);

  // Loading & Alerts
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [showRecipeModal, setShowRecipeModal] = useState<boolean>(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

  // Recipe Builder Form State
  const [recipeForm, setRecipeForm] = useState({
    finishedItemId: '',
    name: '',
    code: '',
    description: '',
    yieldQty: 1,
    preparationMinutes: 15,
    instructions: '',
    ingredients: [{ rawItemId: '', quantity: 0.25, unitId: '', notes: '' }]
  });

  // Production Execution Form State
  const [executeForm, setExecuteForm] = useState({
    recipeId: '',
    plannedQty: 10,
    actualYieldQty: 10,
    wastageQty: 0,
    kitchenWarehouseId: '',
    notes: ''
  });

  const [preview, setPreview] = useState<ProductionPreview | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Load Base Metadata
  const loadBaseData = useCallback(async () => {
    try {
      const [itemsRes, unitsList, whList] = await Promise.all([
        inventoryApi.getItems({ limit: 100 }),
        inventoryApi.getUnits(),
        inventoryApi.getWarehouses()
      ]);
      setItems(itemsRes.items);
      setUnits(unitsList);
      setWarehouses(whList);

      if (whList.length > 0) {
        const kitchenWh = whList.find((w) => w.code.includes('KITCHEN')) || whList[0];
        setExecuteForm((prev) => ({ ...prev, kitchenWarehouseId: kitchenWh.id }));
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Failed to load master metadata');
    }
  }, []);

  const loadTabData = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      if (activeTab === 'recipes') {
        const res = await productionApi.getRecipes();
        setRecipes(res.recipes);
        if (res.recipes.length > 0 && !executeForm.recipeId) {
          setExecuteForm((prev) => ({
            ...prev,
            recipeId: res.recipes[0].id,
            plannedQty: Number(res.recipes[0].yieldQty),
            actualYieldQty: Number(res.recipes[0].yieldQty)
          }));
        }
      } else if (activeTab === 'orders') {
        const res = await productionApi.getProductionOrders({ branchId: selectedBranchId || undefined });
        setProductionOrders(res.orders);
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Error loading production tab');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, selectedBranchId, executeForm.recipeId]);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    loadTabData();
  }, [loadTabData]);

  // Handle Recipe Builder
  const handleOpenCreateRecipe = () => {
    setEditingRecipe(null);
    const finishedItems = items.filter((i) => i.type === 'FINISHED_GOOD');
    setRecipeForm({
      finishedItemId: finishedItems[0]?.id || '',
      name: '',
      code: `REC-${Math.floor(100 + Math.random() * 900)}`,
      description: '',
      yieldQty: 1,
      preparationMinutes: 15,
      instructions: '',
      ingredients: [{ rawItemId: '', quantity: 0.25, unitId: units[0]?.id || '', notes: '' }]
    });
    setShowRecipeModal(true);
  };

  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    const validIngredients = recipeForm.ingredients.filter((ing) => ing.rawItemId && ing.quantity > 0);
    if (validIngredients.length === 0) {
      setErrorMsg('Add at least one raw ingredient to the Recipe Bill of Materials');
      return;
    }

    try {
      if (editingRecipe) {
        await productionApi.updateRecipe(editingRecipe.id, {
          ...recipeForm,
          ingredients: validIngredients
        });
        setSuccessMsg('Recipe updated successfully');
      } else {
        await productionApi.createRecipe({
          ...recipeForm,
          ingredients: validIngredients
        });
        setSuccessMsg('Recipe (BOM) created successfully');
      }
      setShowRecipeModal(false);
      loadTabData();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Failed to save recipe');
    }
  };

  // Handle Preview Consumption
  const handleGeneratePreview = useCallback(async () => {
    if (!executeForm.recipeId || !executeForm.kitchenWarehouseId || executeForm.plannedQty <= 0) return;
    setIsPreviewLoading(true);
    setErrorMsg(null);
    try {
      const data = await productionApi.previewProduction({
        recipeId: executeForm.recipeId,
        plannedQty: Number(executeForm.plannedQty),
        kitchenWarehouseId: executeForm.kitchenWarehouseId
      });
      setPreview(data);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Failed to generate consumption preview');
    } finally {
      setIsPreviewLoading(false);
    }
  }, [executeForm.recipeId, executeForm.kitchenWarehouseId, executeForm.plannedQty]);

  useEffect(() => {
    if (activeTab === 'execute' && executeForm.recipeId && executeForm.kitchenWarehouseId) {
      handleGeneratePreview();
    }
  }, [activeTab, executeForm.recipeId, executeForm.kitchenWarehouseId, executeForm.plannedQty, handleGeneratePreview]);

  // Execute Production
  const handleExecuteProduction = async (e: React.FormEvent) => {
    e.preventDefault();
    const branchId = selectedBranchId || user?.branches[0]?.id;
    if (!branchId) return;

    if (!preview?.allIngredientsAvailable) {
      setErrorMsg('Cannot produce batch: One or more raw ingredients have insufficient stock in the kitchen store.');
      return;
    }

    setIsExecuting(true);
    setErrorMsg(null);
    try {
      const order = await productionApi.executeProductionOrder({
        branchId,
        kitchenWarehouseId: executeForm.kitchenWarehouseId,
        recipeId: executeForm.recipeId,
        plannedQty: Number(executeForm.plannedQty),
        actualYieldQty: Number(executeForm.actualYieldQty),
        wastageQty: Number(executeForm.wastageQty),
        notes: executeForm.notes
      });
      setSuccessMsg(
        `Production Order ${order.orderNumber} completed! Consumed raw materials, added finished dish to stock, updated Food Cost to $${Number(order.unitFoodCost).toFixed(2)}.`
      );
      setActiveTab('orders');
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Production execution failed');
    } finally {
      setIsExecuting(false);
    }
  };

  const finishedGoods = items.filter((i) => i.type === 'FINISHED_GOOD');
  const rawMaterials = items.filter((i) => i.type === 'RAW_MATERIAL' || i.type === 'SEMI_FINISHED');

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-2xl">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Kitchen Production & Recipe Management
            </h1>
            <p className="text-xs text-slate-400">
              Bill of Materials (BOM), automated ingredient consumption, yield/wastage tracking & Food Cost calculation
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {activeTab === 'recipes' && (
            <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />} onClick={handleOpenCreateRecipe}>
              New Recipe (BOM)
            </Button>
          )}
          {activeTab !== 'execute' && (
            <Button variant="secondary" size="md" leftIcon={<Flame className="w-4 h-4" />} onClick={() => setActiveTab('execute')}>
              Produce Batch
            </Button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 text-xs text-rose-400 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)}><X className="w-4 h-4" /></button>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-xs text-emerald-400 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 overflow-x-auto pb-1 text-xs font-semibold scrollbar-none">
        <button
          onClick={() => setActiveTab('recipes')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'recipes' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Recipe Builder (BOM) ({recipes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('execute')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'execute' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>Execute Kitchen Production</span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'orders' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Production History ({productionOrders.length})</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: RECIPES LIST */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'recipes' && (
        isLoading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-400" />
            Loading recipes and bill of materials...
          </div>
        ) : recipes.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-500">
            No recipes created yet. Click "New Recipe (BOM)" to define your first dish.
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {recipes.map((rec) => (
            <div key={rec.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-floating hover:border-brand-500/40 transition-colors flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-white text-base leading-snug">{rec.name}</h3>
                    <p className="text-xs text-brand-400 font-semibold mt-0.5">
                      Yields: {Number(rec.yieldQty)} {rec.finishedItem.unit?.symbol} {rec.finishedItem.name}
                    </p>
                  </div>
                  <span className="font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-xs text-amber-300">
                    {rec.code}
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-xs text-slate-400">
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{rec.preparationMinutes || 15} mins</span>
                  </span>
                  <span>•</span>
                  <span>{rec.ingredients.length} raw ingredients</span>
                </div>

                {/* Ingredients Pill Summary */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">BOM Ingredients</p>
                  <div className="flex flex-wrap gap-1.5">
                    {rec.ingredients.map((ing) => (
                      <span key={ing.id} className="px-2 py-0.5 bg-slate-800 rounded-md text-[11px] text-slate-300 border border-slate-700/80">
                        {ing.rawItem.name}: <span className="font-mono text-white">{Number(ing.quantity)} {ing.unit?.symbol || ing.rawItem.unit?.symbol}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Costing Summary & Action */}
              <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60 flex items-center justify-between mt-2">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Unit Food Cost</p>
                  <p className="text-base font-bold font-mono text-emerald-400">
                    {formatINR(rec.estimatedUnitCost || 0)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setExecuteForm((prev) => ({
                      ...prev,
                      recipeId: rec.id,
                      plannedQty: Number(rec.yieldQty),
                      actualYieldQty: Number(rec.yieldQty)
                    }));
                    setActiveTab('execute');
                  }}
                >
                  Cook Dish
                </Button>
              </div>
            </div>
          ))}
        </div>
        )
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: EXECUTE PRODUCTION (COOKING BATCH) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'execute' && (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-floating space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <Flame className="w-5 h-5 text-amber-400" />
                <span>Execute Kitchen Production Order</span>
              </h2>
              <p className="text-xs text-slate-400">
                Consumes raw ingredients per recipe, verifies non-negative kitchen stock, records yield/wastage, and recalculates Food Cost automatically.
              </p>
            </div>

            <form onSubmit={handleExecuteProduction} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">Select Recipe</label>
                  <select
                    value={executeForm.recipeId}
                    onChange={(e) => setExecuteForm({ ...executeForm, recipeId: e.target.value })}
                    required
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-brand-500"
                  >
                    {recipes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">Kitchen Store (Source)</label>
                  <select
                    value={executeForm.kitchenWarehouseId}
                    onChange={(e) => setExecuteForm({ ...executeForm, kitchenWarehouseId: e.target.value })}
                    required
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-brand-500"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                <Input
                  label="Planned Batch Quantity"
                  type="number"
                  min="0.1"
                  step="any"
                  value={executeForm.plannedQty}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setExecuteForm({ ...executeForm, plannedQty: val, actualYieldQty: val });
                  }}
                  required
                />
              </div>

              {/* Live Consumption Preview Table */}
              <div className="bg-slate-800/40 rounded-2xl border border-slate-700/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                    <Sparkles className="w-4 h-4 text-brand-400" />
                    <span>Raw Material Consumption & Stock Check</span>
                  </h3>
                  {isPreviewLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-400" />}
                </div>

                {preview ? (
                  <div className="space-y-3">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="text-[10px] text-slate-400 uppercase font-semibold border-b border-slate-700">
                          <tr>
                            <th className="pb-2">Ingredient</th>
                            <th className="pb-2 text-right">Standard Required</th>
                            <th className="pb-2 text-right">Kitchen Stock</th>
                            <th className="pb-2 text-right">Est. Raw Cost</th>
                            <th className="pb-2 text-center">Availability</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/60 font-mono text-xs">
                          {preview.ingredients.map((ing) => (
                            <tr key={ing.rawItemId} className="py-2">
                              <td className="py-2.5 font-sans font-medium text-white">{ing.rawItemName}</td>
                              <td className="py-2.5 text-right font-bold text-brand-300">
                                {Number(ing.standardRequiredQty).toFixed(3)} {ing.unitSymbol}
                              </td>
                              <td className="py-2.5 text-right text-slate-300">
                                {Number(ing.currentStockInKitchen).toFixed(3)} {ing.unitSymbol}
                              </td>
                              <td className="py-2.5 text-right text-slate-400">
                                {formatINR(ing.totalCost)}
                              </td>
                              <td className="py-2.5 text-center font-sans">
                                {ing.isAvailable ? (
                                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-[10px] font-bold">
                                    IN STOCK
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded text-[10px] font-bold">
                                    SHORT: {Number(ing.shortageQty).toFixed(2)} {ing.unitSymbol}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-800 p-3 rounded-xl border border-slate-700 text-xs gap-2">
                      <div>
                        <span className="text-slate-400">Total Raw Ingredient Cost: </span>
                        <span className="font-mono font-bold text-white text-sm">
                          {formatINR(preview.totalEstimatedRawCost)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Estimated Unit Food Cost: </span>
                        <span className="font-mono font-bold text-emerald-400 text-sm">
                          {formatINR(preview.estimatedUnitFoodCost)} / dish
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 text-center py-4">Select a recipe to view ingredient consumption</p>
                )}
              </div>

              {/* Yield & Wastage Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Actual Finished Yield (Dishes/Pcs Produced)"
                  type="number"
                  step="any"
                  min="0.1"
                  value={executeForm.actualYieldQty}
                  onChange={(e) => setExecuteForm({ ...executeForm, actualYieldQty: parseFloat(e.target.value) || 0 })}
                  required
                />

                <Input
                  label="Kitchen Wastage / Spoilage Qty"
                  type="number"
                  step="any"
                  min="0"
                  value={executeForm.wastageQty}
                  onChange={(e) => setExecuteForm({ ...executeForm, wastageQty: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <Input
                label="Kitchen Shift Notes"
                value={executeForm.notes}
                onChange={(e) => setExecuteForm({ ...executeForm, notes: e.target.value })}
                placeholder="e.g. Lunch peak batch production"
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={isExecuting}
                disabled={preview ? !preview.allIngredientsAvailable : false}
              >
                Confirm Production & Update Food Cost
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: PRODUCTION ORDERS HISTORY */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'orders' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-floating">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4">Order #</th>
                  <th className="p-4">Dish / Recipe</th>
                  <th className="p-4">Kitchen Store</th>
                  <th className="p-4 text-center">Planned vs Yield</th>
                  <th className="p-4 text-center">Wastage</th>
                  <th className="p-4 text-right">Raw Material Cost</th>
                  <th className="p-4 text-right">Actual Unit Cost</th>
                  <th className="p-4">Completed Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {productionOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-4 font-bold text-white">{ord.orderNumber}</td>
                    <td className="p-4 font-sans font-medium text-white">
                      <p>{ord.recipe.name}</p>
                      <p className="text-[10px] text-brand-400">{ord.recipe.finishedItem.name}</p>
                    </td>
                    <td className="p-4 font-sans text-slate-300">{ord.kitchenWarehouse.name}</td>
                    <td className="p-4 text-center">
                      <span className="text-slate-400">{Number(ord.plannedQty)}</span> → <span className="font-bold text-emerald-400">{Number(ord.actualYieldQty)}</span>
                    </td>
                    <td className="p-4 text-center text-rose-400 font-bold">{Number(ord.wastageQty)}</td>
                    <td className="p-4 text-right text-slate-200 font-semibold">{formatINR(ord.totalRawCost)}</td>
                    <td className="p-4 text-right font-bold text-emerald-400">{formatINR(ord.unitFoodCost)}</td>
                    <td className="p-4 font-sans text-slate-400 text-[11px]">
                      {ord.completedDate ? formatDateTimeIN(ord.completedDate) : 'In Progress'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: RECIPE BUILDER (BOM) */}
      {/* ------------------------------------------------------------- */}
      {showRecipeModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-floating">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <h3 className="text-lg font-bold text-white">Build Recipe & Bill of Materials</h3>
              <button onClick={() => setShowRecipeModal(false)}><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSaveRecipe} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Finished Good (Dish Item)
                  </label>
                  <select
                    value={recipeForm.finishedItemId}
                    onChange={(e) => setRecipeForm({ ...recipeForm, finishedItemId: e.target.value })}
                    required
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-xl px-3 py-2.5"
                  >
                    <option value="">Select Finished Dish</option>
                    {finishedGoods.map((fg) => (
                      <option key={fg.id} value={fg.id}>{fg.name} ({fg.code})</option>
                    ))}
                  </select>
                </div>

                <Input
                  label="Recipe Name"
                  value={recipeForm.name}
                  onChange={(e) => setRecipeForm({ ...recipeForm, name: e.target.value })}
                  placeholder="e.g. Classic Margherita Pizza Recipe"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Recipe Code"
                  value={recipeForm.code}
                  onChange={(e) => setRecipeForm({ ...recipeForm, code: e.target.value })}
                  placeholder="REC-PIZZA-01"
                  required
                />
                <Input
                  label="Standard Yield Qty"
                  type="number"
                  min="0.1"
                  step="any"
                  value={recipeForm.yieldQty}
                  onChange={(e) => setRecipeForm({ ...recipeForm, yieldQty: parseFloat(e.target.value) || 1 })}
                  required
                />
                <Input
                  label="Prep Time (Minutes)"
                  type="number"
                  value={recipeForm.preparationMinutes}
                  onChange={(e) => setRecipeForm({ ...recipeForm, preparationMinutes: parseInt(e.target.value, 10) || 15 })}
                />
              </div>

              {/* Raw Ingredients Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Raw Ingredients (BOM)</span>
                  <button
                    type="button"
                    onClick={() => setRecipeForm({
                      ...recipeForm,
                      ingredients: [...recipeForm.ingredients, { rawItemId: '', quantity: 0.1, unitId: units[0]?.id || '', notes: '' }]
                    })}
                    className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Ingredient</span>
                  </button>
                </div>

                {recipeForm.ingredients.map((ing, idx) => (
                  <div key={idx} className="flex items-center space-x-2 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                    <select
                      value={ing.rawItemId}
                      onChange={(e) => {
                        const copy = [...recipeForm.ingredients];
                        copy[idx].rawItemId = e.target.value;
                        setRecipeForm({ ...recipeForm, ingredients: copy });
                      }}
                      required
                      className="flex-1 bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-lg px-2.5 py-1.5"
                    >
                      <option value="">Select Raw Material</option>
                      {rawMaterials.map((rm) => (
                        <option key={rm.id} value={rm.id}>{rm.name} ({rm.code}) - {rm.unit?.symbol}</option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="0.001"
                      step="any"
                      placeholder="Qty"
                      value={ing.quantity}
                      onChange={(e) => {
                        const copy = [...recipeForm.ingredients];
                        copy[idx].quantity = parseFloat(e.target.value) || 0;
                        setRecipeForm({ ...recipeForm, ingredients: copy });
                      }}
                      required
                      className="w-24 bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-lg px-2 py-1.5 font-mono text-right"
                    />

                    {recipeForm.ingredients.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setRecipeForm({ ...recipeForm, ingredients: recipeForm.ingredients.filter((_, i) => i !== idx) })}
                        className="p-1 text-slate-500 hover:text-rose-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">Preparation Instructions</label>
                <textarea
                  value={recipeForm.instructions}
                  onChange={(e) => setRecipeForm({ ...recipeForm, instructions: e.target.value })}
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-xl p-3 focus:ring-2 focus:ring-brand-500"
                  placeholder="Step-by-step culinary preparation and cooking instructions..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
                <Button type="button" variant="ghost" onClick={() => setShowRecipeModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary">Save Recipe BOM</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default ProductionPage;
