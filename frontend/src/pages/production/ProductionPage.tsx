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
    <div className="space-y-6 select-none">
      {/* Header Banner */}
      <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#d4a437] to-[#996f1b] flex items-center justify-center text-black shadow-lg shadow-[#d4a437]/20 border border-[#d4a437]/40">
            <ChefHat className="w-6 h-6 text-black" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-wide uppercase">
                Culinary Recipes & Central Kitchen
              </h1>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#d4a437]/15 text-[#d4a437] font-semibold border border-[#d4a437]/30 tracking-wider">
                Production Engine
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Multi-tier Bill of Materials (BOM), automated ingredient consumption, yield/wastage tracking & Food Cost calculation
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          {activeTab === 'recipes' && (
            <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />} onClick={handleOpenCreateRecipe}>
              Create Recipe (BOM)
            </Button>
          )}
          {activeTab !== 'execute' && (
            <Button variant="secondary" size="md" leftIcon={<Flame className="w-4 h-4" />} onClick={() => setActiveTab('execute')}>
              Cook Batch
            </Button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="bg-[#e5544d]/10 border border-[#e5544d]/25 rounded-2xl p-4 text-xs text-[#e5544d] flex items-center justify-between font-medium">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="p-1 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      )}
      {successMsg && (
        <div className="bg-[#3fbf6f]/10 border border-[#3fbf6f]/25 rounded-2xl p-4 text-xs text-[#3fbf6f] flex items-center justify-between font-medium">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="p-1 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-white/[0.08] overflow-x-auto pb-2 text-xs font-semibold scrollbar-none">
        <button
          onClick={() => setActiveTab('recipes')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'recipes' ? 'bg-[#d4a437]/15 text-[#d4a437] border border-[#d4a437]/30 shadow-sm' : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Recipe Builder (BOM) ({recipes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('execute')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'execute' ? 'bg-[#d4a437]/15 text-[#d4a437] border border-[#d4a437]/30 shadow-sm' : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>Execute Kitchen Production</span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'orders' ? 'bg-[#d4a437]/15 text-[#d4a437] border border-[#d4a437]/30 shadow-sm' : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
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
          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-12 text-center text-neutral-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#d4a437]" />
            Loading recipes and bill of materials...
          </div>
        ) : recipes.length === 0 ? (
          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-12 text-center text-neutral-500 space-y-3">
            <ChefHat className="w-10 h-10 text-neutral-500 mx-auto" />
            <h4 className="text-sm font-bold text-white">No Culinary Recipes Configured</h4>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              Define standard dishes with itemized raw ingredient Bills of Materials (BOM), standard yield, and estimated food costing.
            </p>
            <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />} onClick={handleOpenCreateRecipe}>
              Create Recipe (BOM)
            </Button>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {recipes.map((rec) => (
            <div key={rec.id} className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-5 space-y-4 shadow-xl hover:border-[#d4a437]/40 transition-colors flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-white text-base leading-snug">{rec.name}</h3>
                    <p className="text-xs text-[#d4a437] font-semibold mt-0.5">
                      Yields: {Number(rec.yieldQty)} {rec.finishedItem.unit?.symbol} {rec.finishedItem.name}
                    </p>
                  </div>
                  <span className="font-mono bg-[#0c0c0e] px-2 py-0.5 rounded border border-white/[0.08] text-xs text-[#d4a437]">
                    {rec.code}
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-xs text-neutral-400">
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 text-neutral-500" />
                    <span>{rec.preparationMinutes || 15} mins</span>
                  </span>
                  <span>•</span>
                  <span>{rec.ingredients.length} raw ingredients</span>
                </div>

                {/* Ingredients Pill Summary */}
                <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">BOM Ingredients</p>
                  <div className="flex flex-wrap gap-1.5">
                    {rec.ingredients.map((ing) => (
                      <span key={ing.id} className="px-2 py-0.5 bg-[#0c0c0e] rounded-lg text-[11px] text-neutral-300 border border-white/[0.06]">
                        {ing.rawItem.name}: <span className="font-mono text-white">{Number(ing.quantity)} {ing.unit?.symbol || ing.rawItem.unit?.symbol}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Costing Summary & Action */}
              <div className="bg-[#0c0c0e] p-3.5 rounded-2xl border border-white/[0.06] flex items-center justify-between mt-2">
                <div>
                  <p className="text-[10px] text-neutral-400 uppercase font-semibold">Unit Food Cost</p>
                  <p className="text-base font-bold font-mono text-[#3fbf6f]">
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
          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-6 shadow-xl space-y-6">
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <Flame className="w-4 h-4 text-[#d4a437]" />
                <span className="uppercase tracking-wider">Execute Kitchen Production Order</span>
              </h2>
              <p className="text-xs text-neutral-400 mt-1">
                Consumes raw ingredients per recipe BOM, validates non-negative kitchen store stock, records yield/wastage, and updates real-time Food Cost.
              </p>
            </div>

            <form onSubmit={handleExecuteProduction} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300">Select Recipe *</label>
                  <select
                    value={executeForm.recipeId}
                    onChange={(e) => setExecuteForm({ ...executeForm, recipeId: e.target.value })}
                    required
                    className="w-full bg-[#0c0c0e] border border-white/[0.09] text-white text-xs rounded-xl px-3 py-2.5 focus:border-[#d4a437] focus:outline-none"
                  >
                    {recipes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300">Kitchen Store (Source) *</label>
                  <select
                    value={executeForm.kitchenWarehouseId}
                    onChange={(e) => setExecuteForm({ ...executeForm, kitchenWarehouseId: e.target.value })}
                    required
                    className="w-full bg-[#0c0c0e] border border-white/[0.09] text-white text-xs rounded-xl px-3 py-2.5 focus:border-[#d4a437] focus:outline-none"
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
              <div className="bg-[#0c0c0e] rounded-2xl border border-white/[0.06] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center space-x-1.5">
                    <Sparkles className="w-4 h-4 text-[#d4a437]" />
                    <span>Raw Material Consumption & Availability Check</span>
                  </h3>
                  {isPreviewLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#d4a437]" />}
                </div>

                {preview ? (
                  <div className="space-y-3">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-neutral-300">
                        <thead className="text-[10px] text-neutral-400 uppercase font-semibold border-b border-white/[0.06]">
                          <tr>
                            <th className="pb-2">Ingredient</th>
                            <th className="pb-2 text-right">Standard Required</th>
                            <th className="pb-2 text-right">Kitchen Stock</th>
                            <th className="pb-2 text-right">Est. Raw Cost</th>
                            <th className="pb-2 text-center">Availability</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.06] font-mono text-xs">
                          {preview.ingredients.map((ing) => (
                            <tr key={ing.rawItemId} className="py-2">
                              <td className="py-2.5 font-sans font-medium text-white">{ing.rawItemName}</td>
                              <td className="py-2.5 text-right font-bold text-[#d4a437]">
                                {Number(ing.standardRequiredQty).toFixed(3)} {ing.unitSymbol}
                              </td>
                              <td className="py-2.5 text-right text-neutral-300">
                                {Number(ing.currentStockInKitchen).toFixed(3)} {ing.unitSymbol}
                              </td>
                              <td className="py-2.5 text-right text-neutral-400">
                                {formatINR(ing.totalCost)}
                              </td>
                              <td className="py-2.5 text-center font-sans">
                                {ing.isAvailable ? (
                                  <span className="px-2 py-0.5 bg-[#3fbf6f]/15 text-[#3fbf6f] border border-[#3fbf6f]/25 rounded text-[10px] font-bold">
                                    IN STOCK
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-[#e5544d]/15 text-[#e5544d] border border-[#e5544d]/25 rounded text-[10px] font-bold">
                                    SHORT: {Number(ing.shortageQty).toFixed(2)} {ing.unitSymbol}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between bg-[#17171b] p-3 rounded-xl border border-white/[0.06] text-xs gap-2">
                      <div>
                        <span className="text-neutral-400">Total Raw Ingredient Cost: </span>
                        <span className="font-mono font-bold text-white text-sm">
                          {formatINR(preview.totalEstimatedRawCost)}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-400">Estimated Unit Food Cost: </span>
                        <span className="font-mono font-bold text-[#3fbf6f] text-sm">
                          {formatINR(preview.estimatedUnitFoodCost)} / dish
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-neutral-500 text-center py-4">Select a recipe to view ingredient consumption</p>
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
        <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-300">
              <thead className="bg-[#0c0c0e] text-neutral-400 font-semibold border-b border-white/[0.06] uppercase tracking-wider text-[10px]">
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
              <tbody className="divide-y divide-white/[0.06] font-mono">
                {productionOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-neutral-500 font-sans space-y-2">
                      <History className="w-8 h-8 text-neutral-500 mx-auto" />
                      <p className="text-sm font-semibold text-neutral-300">No production orders executed</p>
                      <p className="text-xs text-neutral-500">Completed batches and automated stock conversions will be logged here.</p>
                    </td>
                  </tr>
                ) : (
                  productionOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 font-bold text-white">{ord.orderNumber}</td>
                      <td className="p-4 font-sans font-medium text-white">
                        <p>{ord.recipe.name}</p>
                        <p className="text-[10px] text-[#d4a437]">{ord.recipe.finishedItem.name}</p>
                      </td>
                      <td className="p-4 font-sans text-neutral-300">{ord.kitchenWarehouse.name}</td>
                      <td className="p-4 text-center">
                        <span className="text-neutral-400">{Number(ord.plannedQty)}</span> → <span className="font-bold text-[#3fbf6f]">{Number(ord.actualYieldQty)}</span>
                      </td>
                      <td className="p-4 text-center text-[#e5544d] font-bold">{Number(ord.wastageQty)}</td>
                      <td className="p-4 text-right text-neutral-200 font-semibold">{formatINR(ord.totalRawCost)}</td>
                      <td className="p-4 text-right font-bold text-[#3fbf6f]">{formatINR(ord.unitFoodCost)}</td>
                      <td className="p-4 font-sans text-neutral-400 text-[11px]">
                        {ord.completedDate ? formatDateTimeIN(ord.completedDate) : 'In Progress'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: RECIPE BUILDER (BOM) */}
      {/* ------------------------------------------------------------- */}
      {showRecipeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] border border-white/[0.1] rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.06] mb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ChefHat className="w-4 h-4 text-[#d4a437]" />
                Build Recipe & Bill of Materials (BOM)
              </h3>
              <button onClick={() => setShowRecipeModal(false)} className="text-neutral-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleSaveRecipe} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    Finished Good (Dish Item) *
                  </label>
                  <select
                    value={recipeForm.finishedItemId}
                    onChange={(e) => setRecipeForm({ ...recipeForm, finishedItemId: e.target.value })}
                    required
                    className="w-full bg-[#0c0c0e] border border-white/[0.09] text-white text-xs rounded-xl px-3 py-2.5 focus:border-[#d4a437] focus:outline-none"
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
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Raw Ingredients (BOM)</span>
                  <button
                    type="button"
                    onClick={() => setRecipeForm({
                      ...recipeForm,
                      ingredients: [...recipeForm.ingredients, { rawItemId: '', quantity: 0.1, unitId: units[0]?.id || '', notes: '' }]
                    })}
                    className="text-xs text-[#d4a437] hover:text-[#b88c2c] font-semibold flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Ingredient</span>
                  </button>
                </div>

                {recipeForm.ingredients.map((ing, idx) => (
                  <div key={idx} className="flex items-center space-x-2 bg-[#0c0c0e] p-2.5 rounded-xl border border-white/[0.06]">
                    <select
                      value={ing.rawItemId}
                      onChange={(e) => {
                        const copy = [...recipeForm.ingredients];
                        copy[idx].rawItemId = e.target.value;
                        setRecipeForm({ ...recipeForm, ingredients: copy });
                      }}
                      required
                      className="flex-1 bg-[#17171b] border border-white/[0.09] text-white text-xs rounded-lg px-2.5 py-1.5 focus:border-[#d4a437] focus:outline-none"
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
                      className="w-24 bg-[#17171b] border border-white/[0.09] text-white text-xs rounded-lg px-2 py-1.5 font-mono text-right focus:border-[#d4a437] focus:outline-none"
                    />

                    {recipeForm.ingredients.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setRecipeForm({ ...recipeForm, ingredients: recipeForm.ingredients.filter((_, i) => i !== idx) })}
                        className="p-1 text-neutral-500 hover:text-[#e5544d]"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300">Preparation Instructions</label>
                <textarea
                  value={recipeForm.instructions}
                  onChange={(e) => setRecipeForm({ ...recipeForm, instructions: e.target.value })}
                  rows={3}
                  className="w-full bg-[#0c0c0e] border border-white/[0.09] text-white text-xs rounded-xl p-3 focus:border-[#d4a437] focus:outline-none"
                  placeholder="Step-by-step culinary preparation and cooking instructions..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-white/[0.06]">
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
