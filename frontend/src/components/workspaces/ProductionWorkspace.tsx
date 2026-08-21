'use client';

import React, { useState, useEffect } from 'react';
import { useOutlet } from '@/context/OutletContext';
import { productionApi } from '@/api/production';
import { inventoryApi } from '@/api/inventory';
import {
  ChefHat,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Flame,
  Boxes,
  Percent,
  Layers,
  ArrowRight,
  Clock,
  DollarSign,
  AlertTriangle,
  Play,
  RotateCcw,
} from 'lucide-react';
import { Recipe, ProductionOrder, ProductionPreview } from '@/types/production.types';
import { Warehouse } from '@/types/inventory.types';
import { Badge, Button, StatCard, SearchInput, AlertBanner, EmptyState } from '@/components/ui';

export const ProductionWorkspace: React.FC = () => {
  const { activeOutlet } = useOutlet();
  const [activeTab, setActiveTab] = useState<'recipes' | 'orders' | 'batch_prep'>('recipes');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Batch Prep State
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const [plannedQty, setPlannedQty] = useState<number>(10);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [previewData, setPreviewData] = useState<ProductionPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [executing, setExecuting] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const [recipesRes, ordersRes, whRes] = await Promise.all([
        productionApi.getRecipes().catch(() => []),
        productionApi.getProductionOrders({ branch_id: activeOutlet.id }).catch(() => []),
        inventoryApi.getWarehouses({ branch_id: activeOutlet.id }).catch(() => []),
      ]);
      setRecipes(Array.isArray(recipesRes) ? recipesRes : []);
      setOrders(Array.isArray(ordersRes) ? ordersRes : []);
      setWarehouses(Array.isArray(whRes) ? whRes : []);

      if (whRes.length > 0 && !selectedWarehouseId) {
        setSelectedWarehouseId(whRes[0].id);
      }
      if (recipesRes.length > 0 && !selectedRecipeId) {
        setSelectedRecipeId(recipesRes[0].id);
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || err?.message || 'Failed to load production data',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeOutlet.id]);

  // Handle Preview
  const handlePreview = async () => {
    if (!selectedRecipeId || !selectedWarehouseId || plannedQty <= 0) return;
    setPreviewLoading(true);
    setFeedback(null);
    try {
      const preview = await productionApi.previewProduction({
        recipe_id: selectedRecipeId,
        planned_qty: plannedQty,
        kitchen_warehouse_id: selectedWarehouseId,
      });
      setPreviewData(preview);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || err.message || 'Failed to preview production',
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  // Handle Execute Batch
  const handleExecuteBatch = async () => {
    if (!selectedRecipeId || !selectedWarehouseId || plannedQty <= 0) return;
    setExecuting(true);
    setFeedback(null);
    try {
      const order = await productionApi.executeProduction({
        recipe_id: selectedRecipeId,
        planned_qty: plannedQty,
        kitchen_warehouse_id: selectedWarehouseId,
        actual_yield_qty: plannedQty,
      });
      setFeedback({
        type: 'success',
        message: `Production Batch #${order.orderNumber} successfully executed and stock updated!`,
      });
      setPreviewData(null);
      fetchData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || err.message || 'Failed to execute production run',
      });
    } finally {
      setExecuting(false);
    }
  };

  const filteredRecipes = recipes.filter(
    (r) =>
      (r.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.code || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredOrders = orders.filter(
    (o) =>
      (o.orderNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.recipe?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-[#C79A3B]" />
              Production & Recipe System
            </h2>
            <Badge variant="outlet">[{activeOutlet.code}]</Badge>
          </div>
          <p className="text-xs text-[#707070] mt-0.5">
            Standard recipes (BOM), ingredient costing, yield control, and automated kitchen batch production runs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchData}
            loading={loading}
            icon={<RefreshCw className="w-3.5 h-3.5 text-[#C79A3B]" />}
          >
            Sync Production
          </Button>
        </div>
      </div>

      {/* Feedback Banner */}
      <AlertBanner feedback={feedback} onClose={() => setFeedback(null)} />

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Active Recipes"
          value={recipes.length}
          subtitle="Standard Multi-Outlet BOM"
          icon={<ChefHat className="w-4 h-4 text-[#C79A3B]" />}
          iconBgColor="bg-[#FAF8F5] text-[#C79A3B]"
        />

        <StatCard
          title="Batch Orders"
          value={orders.length}
          subtitle="Production runs logged"
          icon={<Boxes className="w-4 h-4 text-[#3978B8]" />}
          iconBgColor="bg-blue-50 text-[#3978B8]"
        />

        <StatCard
          title="Kitchen Units"
          value={warehouses.length}
          subtitle="Production Kitchens Ready"
          icon={<Flame className="w-4 h-4 text-[#D99625]" />}
          iconBgColor="bg-amber-50 text-[#D99625]"
        />

        <StatCard
          title="Real-Time Yield"
          value="FIFO Auto"
          subtitle="Direct stock conversion"
          icon={<Percent className="w-4 h-4 text-[#2E8B57]" />}
          iconBgColor="bg-[#2E8B57]/10 text-[#2E8B57]"
        />
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-white border border-[rgba(45,45,45,0.08)] rounded-2xl shadow-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('recipes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'recipes'
              ? 'bg-[#F1E4C5] text-[#B8862D] shadow-xs'
              : 'text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5]'
          }`}
        >
          <ChefHat className="w-4 h-4" />
          <span>Recipe & BOM Directory</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[rgba(45,45,45,0.08)] text-[#1C1C1C]">
            {recipes.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'orders'
              ? 'bg-[#F1E4C5] text-[#B8862D] shadow-xs'
              : 'text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5]'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Batch Runs & History</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[rgba(45,45,45,0.08)] text-[#1C1C1C]">
            {orders.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('batch_prep')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'batch_prep'
              ? 'bg-[#F1E4C5] text-[#B8862D] shadow-xs'
              : 'text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5]'
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>Batch Prep Execution Tool</span>
        </button>
      </div>

      {/* Tab 1: Recipe & BOM Directory */}
      {activeTab === 'recipes' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit']">
              Standard Recipe Registry ({filteredRecipes.length})
            </h3>
            <SearchInput
              value={searchQuery}
              onChangeValue={setSearchQuery}
              placeholder="Search recipes by name or code..."
              className="w-full sm:w-72"
            />
          </div>

          {loading ? (
            <div className="p-12 text-center text-[#707070] text-xs flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#C79A3B]" />
              <span>Loading recipe registry...</span>
            </div>
          ) : filteredRecipes.length === 0 ? (
            <EmptyState
              title="No Recipes Found"
              description="BOM recipes establish theoretical raw ingredient usage per finished dish."
              icon={<ChefHat className="w-6 h-6" />}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRecipes.map((r) => (
                <div
                  key={r.id}
                  className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-3 hover:border-[#C79A3B]/40 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-[#1C1C1C] font-['Outfit']">{r.name}</h4>
                          <Badge variant="outlet">{r.code}</Badge>
                        </div>
                        <p className="text-xs text-[#707070] mt-0.5">
                          {r.description || 'Standard multi-outlet recipe BOM'}
                        </p>
                      </div>
                      <Badge variant="success">Active</Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.05)] text-center text-xs">
                      <div>
                        <span className="text-[10px] text-[#707070] block">Yield Qty</span>
                        <span className="font-bold text-[#1C1C1C]">{r.yieldQty || 1} Servings</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#707070] block">Prep Time</span>
                        <span className="font-bold text-[#1C1C1C]">{r.preparationMinutes || 15} mins</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#707070] block">Est. Unit Cost</span>
                        <span className="font-bold text-[#2E8B57]">
                          ${Number(r.estimatedUnitCost || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {r.ingredients && r.ingredients.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-[rgba(45,45,45,0.06)]">
                        <span className="text-[11px] font-bold text-[#707070] block">
                          Ingredients ({r.ingredients.length}):
                        </span>
                        <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                          {r.ingredients.map((ing) => (
                            <div
                              key={ing.id}
                              className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-white border border-[rgba(45,45,45,0.04)]"
                            >
                              <span className="text-[#1C1C1C] font-medium">
                                {ing.rawItem?.name || 'Raw Ingredient'}
                              </span>
                              <span className="font-mono text-[11px] text-[#707070]">
                                {Number(ing.quantity).toFixed(2)} {ing.unit?.symbol || ing.rawItem?.unit?.symbol || ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2 border-t border-[rgba(45,45,45,0.06)]">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setSelectedRecipeId(r.id);
                        setActiveTab('batch_prep');
                      }}
                      icon={<Flame className="w-3.5 h-3.5 text-[#C79A3B]" />}
                    >
                      Run Batch
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Batch Runs & History */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit']">
              Production Run Log ({filteredOrders.length})
            </h3>
            <SearchInput
              value={searchQuery}
              onChangeValue={setSearchQuery}
              placeholder="Search orders..."
              className="w-full sm:w-72"
            />
          </div>

          {loading ? (
            <div className="p-12 text-center text-[#707070] text-xs flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#C79A3B]" />
              <span>Loading production runs...</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <EmptyState
              title="No Production Orders Found"
              description="Execute batch production runs to generate finished goods and automatically deduct ingredient stock."
              icon={<Boxes className="w-6 h-6" />}
            />
          ) : (
            <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] text-[#707070] font-bold border-b border-[rgba(45,45,45,0.08)]">
                    <tr>
                      <th className="p-3.5">Order #</th>
                      <th className="p-3.5">Recipe / Dish</th>
                      <th className="p-3.5 text-right">Planned Qty</th>
                      <th className="p-3.5 text-right">Actual Yield</th>
                      <th className="p-3.5 text-right">Total Raw Cost</th>
                      <th className="p-3.5 text-right">Unit Food Cost</th>
                      <th className="p-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
                    {filteredOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-[#FAF8F5]/50 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-[#1C1C1C]">
                          {ord.orderNumber}
                        </td>
                        <td className="p-3.5">
                          <span className="font-bold text-[#1C1C1C] block">
                            {ord.recipe?.name || 'Recipe'}
                          </span>
                          <span className="text-[10px] text-[#707070]">
                            {ord.kitchenWarehouse?.name || 'Kitchen'}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-semibold text-[#1C1C1C]">
                          {Number(ord.plannedQty).toFixed(2)}
                        </td>
                        <td className="p-3.5 text-right font-semibold text-[#2E8B57]">
                          {Number(ord.actualYieldQty || 0).toFixed(2)}
                        </td>
                        <td className="p-3.5 text-right font-mono font-semibold text-[#1C1C1C]">
                          ${Number(ord.totalRawCost || 0).toFixed(2)}
                        </td>
                        <td className="p-3.5 text-right font-mono font-semibold text-[#2E8B57]">
                          ${Number(ord.unitFoodCost || 0).toFixed(2)}
                        </td>
                        <td className="p-3.5">
                          <Badge
                            variant={
                              ord.status === 'COMPLETED'
                                ? 'success'
                                : ord.status === 'IN_PROGRESS'
                                ? 'warning'
                                : 'neutral'
                            }
                          >
                            {ord.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Batch Prep Execution Tool */}
      {activeTab === 'batch_prep' && (
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
                <Flame className="w-4 h-4 text-[#C79A3B]" />
                Interactive Kitchen Batch Production
              </h3>
              <p className="text-xs text-[#707070] mt-0.5">
                Calculate required raw ingredients, perform sufficiency check, and execute one-click stock deduction & finished good conversion.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="text-xs font-semibold text-[#1C1C1C] block mb-1">
                  Select Recipe / BOM
                </label>
                <select
                  value={selectedRecipeId}
                  onChange={(e) => {
                    setSelectedRecipeId(e.target.value);
                    setPreviewData(null);
                  }}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] focus:outline-none focus:border-[#C79A3B]"
                >
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#1C1C1C] block mb-1">
                  Target Kitchen Warehouse
                </label>
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => {
                    setSelectedWarehouseId(e.target.value);
                    setPreviewData(null);
                  }}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] focus:outline-none focus:border-[#C79A3B]"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#1C1C1C] block mb-1">
                  Planned Batch Quantity (Yield)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={plannedQty}
                    onChange={(e) => {
                      setPlannedQty(Number(e.target.value));
                      setPreviewData(null);
                    }}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] focus:outline-none focus:border-[#C79A3B]"
                  />
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handlePreview}
                    disabled={previewLoading || !selectedRecipeId || !selectedWarehouseId}
                    loading={previewLoading}
                    icon={<Search className="w-3.5 h-3.5 text-[#C79A3B]" />}
                    className="whitespace-nowrap"
                  >
                    Check
                  </Button>
                </div>
              </div>
            </div>

            {/* Preview Breakdown Table */}
            {previewData && (
              <div className="space-y-4 pt-4 border-t border-[rgba(45,45,45,0.08)]">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)]">
                  <div>
                    <span className="text-xs font-bold text-[#1C1C1C] block">
                      Sufficiency Status:{' '}
                      {previewData.allIngredientsAvailable ? (
                        <span className="text-[#2E8B57]">✓ All Ingredients Available in Stock</span>
                      ) : (
                        <span className="text-red-600">⚠ Ingredient Shortage Detected</span>
                      )}
                    </span>
                    <span className="text-[11px] text-[#707070]">
                      Batch Size: {previewData.plannedQty} Units | Est. Total Cost: ${Number(previewData.totalEstimatedRawCost).toFixed(2)} | Unit Food Cost: ${Number(previewData.estimatedUnitFoodCost).toFixed(2)}
                    </span>
                  </div>

                  <Button
                    variant="success"
                    size="md"
                    onClick={handleExecuteBatch}
                    disabled={executing || !previewData.allIngredientsAvailable}
                    loading={executing}
                    icon={<Play className="w-3.5 h-3.5" />}
                  >
                    {executing ? 'Executing Batch...' : 'Execute Production Batch'}
                  </Button>
                </div>

                <div className="bg-white rounded-xl border border-[rgba(45,45,45,0.08)] overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF8F5] text-[#707070] font-bold border-b border-[rgba(45,45,45,0.08)]">
                      <tr>
                        <th className="p-3">Raw Ingredient</th>
                        <th className="p-3 text-right">Required Qty</th>
                        <th className="p-3 text-right">Current Stock</th>
                        <th className="p-3 text-right">Unit Cost</th>
                        <th className="p-3 text-right">Total Cost</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
                      {previewData.ingredients.map((ing) => (
                        <tr key={ing.rawItemId} className="hover:bg-[#FAF8F5]/50">
                          <td className="p-3 font-semibold text-[#1C1C1C]">
                            {ing.rawItemName} ({ing.rawItemCode})
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-[#1C1C1C]">
                            {Number(ing.standardRequiredQty).toFixed(2)} {ing.unitSymbol}
                          </td>
                          <td className="p-3 text-right font-mono text-[#707070]">
                            {Number(ing.currentStockInKitchen).toFixed(2)} {ing.unitSymbol}
                          </td>
                          <td className="p-3 text-right font-mono font-semibold text-[#1C1C1C]">
                            ${Number(ing.unitCost).toFixed(2)}
                          </td>
                          <td className="p-3 text-right font-mono font-semibold text-[#2E8B57]">
                            ${Number(ing.totalCost).toFixed(2)}
                          </td>
                          <td className="p-3">
                            {ing.isAvailable ? (
                              <Badge variant="success">Available</Badge>
                            ) : (
                              <Badge variant="danger">
                                Short: {Number(ing.shortageQty).toFixed(2)} {ing.unitSymbol}
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductionWorkspace;
