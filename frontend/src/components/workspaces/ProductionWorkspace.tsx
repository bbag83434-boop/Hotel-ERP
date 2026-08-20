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

export const ProductionWorkspace: React.FC = () => {
  const { activeOutlet } = useOutlet();
  const [activeTab, setActiveTab] = useState<'recipes' | 'orders' | 'batch_prep'>('recipes');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Batch Prep State
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const [plannedQty, setPlannedQty] = useState<number>(10);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [previewData, setPreviewData] = useState<ProductionPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [executing, setExecuting] = useState<boolean>(false);
  const [executionSuccess, setExecutionSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setErrorMessage(null);
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
      setErrorMessage(err.message || 'Failed to load production data');
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
    setErrorMessage(null);
    setExecutionSuccess(null);
    try {
      const preview = await productionApi.previewProduction({
        recipe_id: selectedRecipeId,
        planned_qty: plannedQty,
        kitchen_warehouse_id: selectedWarehouseId,
      });
      setPreviewData(preview);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || err.message || 'Failed to preview production');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Handle Execute Batch
  const handleExecuteBatch = async () => {
    if (!selectedRecipeId || !selectedWarehouseId || plannedQty <= 0) return;
    setExecuting(true);
    setErrorMessage(null);
    setExecutionSuccess(null);
    try {
      const order = await productionApi.executeProduction({
        recipe_id: selectedRecipeId,
        planned_qty: plannedQty,
        kitchen_warehouse_id: selectedWarehouseId,
        actual_yield_qty: plannedQty,
      });
      setExecutionSuccess(`Production Batch #${order.orderNumber} successfully executed and stock updated!`);
      setPreviewData(null);
      fetchData();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || err.message || 'Failed to execute production run');
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
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF8F5] text-[#B8862D] font-bold border border-[rgba(45,45,45,0.1)]">
              [{activeOutlet.code}]
            </span>
          </div>
          <p className="text-xs text-[#707070] mt-0.5">
            Standard recipes (BOM), ingredient costing, yield control, and automated kitchen batch production runs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[rgba(45,45,45,0.12)] hover:bg-[#FAF8F5] text-xs font-semibold text-[#1C1C1C] transition-all shadow-sm active:scale-95 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#C79A3B] ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm">
          <div className="flex items-center justify-between text-[#707070] mb-1">
            <span className="text-xs font-semibold">Active Recipes / BOM</span>
            <ChefHat className="w-4 h-4 text-[#C79A3B]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">{recipes.length}</p>
          <p className="text-[10px] text-[#2E8B57] mt-1 font-medium">Standardized Multi-Outlet Menu</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm">
          <div className="flex items-center justify-between text-[#707070] mb-1">
            <span className="text-xs font-semibold">Batch Orders</span>
            <Boxes className="w-4 h-4 text-[#C79A3B]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">{orders.length}</p>
          <p className="text-[10px] text-[#707070] mt-1 font-medium">Production runs logged</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm">
          <div className="flex items-center justify-between text-[#707070] mb-1">
            <span className="text-xs font-semibold">Production Kitchens</span>
            <Flame className="w-4 h-4 text-[#D99625]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">{warehouses.length}</p>
          <p className="text-[10px] text-[#D99625] mt-1 font-medium">Kitchen Warehouses Ready</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm">
          <div className="flex items-center justify-between text-[#707070] mb-1">
            <span className="text-xs font-semibold">Real-Time Yield</span>
            <Percent className="w-4 h-4 text-[#2E8B57]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">FIFO Auto</p>
          <p className="text-[10px] text-[#2E8B57] mt-1 font-medium">Automatic stock deduction & conversion</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[rgba(45,45,45,0.08)] pb-2">
        <button
          onClick={() => setActiveTab('recipes')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'recipes'
              ? 'bg-[#1C1C1C] text-white shadow-sm'
              : 'text-[#707070] hover:bg-[#FAF8F5] hover:text-[#1C1C1C]'
          }`}
        >
          <div className="flex items-center gap-2">
            <ChefHat className="w-4 h-4" />
            <span>Recipe & BOM Directory ({recipes.length})</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'orders'
              ? 'bg-[#1C1C1C] text-white shadow-sm'
              : 'text-[#707070] hover:bg-[#FAF8F5] hover:text-[#1C1C1C]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Boxes className="w-4 h-4" />
            <span>Batch Runs & History ({orders.length})</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('batch_prep')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'batch_prep'
              ? 'bg-[#C79A3B] text-white shadow-sm'
              : 'text-[#707070] hover:bg-[#FAF8F5] hover:text-[#1C1C1C]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4" />
            <span>Batch Prep Execution Tool</span>
          </div>
        </button>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      {executionSuccess && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-xs text-green-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{executionSuccess}</span>
        </div>
      )}

      {/* Tab 1: Recipe & BOM Directory */}
      {activeTab === 'recipes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit']">Standard Recipe Registry</h3>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]" />
              <input
                type="text"
                placeholder="Search recipes by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-56 sm:w-72 pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white border border-[rgba(45,45,45,0.12)] focus:outline-none focus:border-[#C79A3B] text-[#1C1C1C]"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-[#707070] text-xs flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#C79A3B]" />
              <span>Loading recipe registry...</span>
            </div>
          ) : filteredRecipes.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] text-xs text-[#707070] space-y-2">
              <ChefHat className="w-8 h-8 mx-auto text-[#C79A3B]/50" />
              <p className="font-semibold text-[#1C1C1C]">No recipes match your criteria</p>
              <p className="max-w-md mx-auto">
                BOM recipes establish theoretical raw ingredient usage per finished dish.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRecipes.map((r) => (
                <div
                  key={r.id}
                  className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-3 hover:border-[#C79A3B]/40 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-[#1C1C1C]">{r.name}</h4>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FAF8F5] text-[#B8862D] font-bold border border-[rgba(45,45,45,0.08)]">
                          {r.code}
                        </span>
                      </div>
                      <p className="text-xs text-[#707070] mt-0.5">
                        {r.description || 'Standard multi-outlet recipe BOM'}
                      </p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                      Active
                    </span>
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
                        ₹{Number(r.estimatedUnitCost || 0).toFixed(2)}
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
                            className="flex items-center justify-between text-xs py-0.5 px-2 rounded bg-white border border-[rgba(45,45,45,0.04)]"
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

                  <div className="pt-2 flex items-center justify-end gap-2 border-t border-[rgba(45,45,45,0.06)]">
                    <button
                      onClick={() => {
                        setSelectedRecipeId(r.id);
                        setActiveTab('batch_prep');
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1C1C1C] hover:bg-[#2D2D2D] text-white text-xs font-semibold transition-all active:scale-95 shadow-sm"
                    >
                      <Flame className="w-3.5 h-3.5 text-[#C79A3B]" />
                      <span>Run Batch</span>
                    </button>
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
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit']">Production Run Log</h3>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]" />
              <input
                type="text"
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-56 sm:w-72 pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white border border-[rgba(45,45,45,0.12)] focus:outline-none focus:border-[#C79A3B] text-[#1C1C1C]"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-[#707070] text-xs flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#C79A3B]" />
              <span>Loading production runs...</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] text-xs text-[#707070] space-y-2">
              <Boxes className="w-8 h-8 mx-auto text-[#C79A3B]/50" />
              <p className="font-semibold text-[#1C1C1C]">No production orders found</p>
              <p className="max-w-md mx-auto">
                Execute batch production runs to generate semi-finished/finished goods and log ingredient consumption.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] text-[#707070] font-bold border-b border-[rgba(45,45,45,0.08)]">
                    <tr>
                      <th className="p-3.5">Order #</th>
                      <th className="p-3.5">Recipe / Dish</th>
                      <th className="p-3.5">Planned Qty</th>
                      <th className="p-3.5">Actual Yield</th>
                      <th className="p-3.5">Total Raw Cost</th>
                      <th className="p-3.5">Unit Food Cost</th>
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
                        <td className="p-3.5 font-semibold text-[#1C1C1C]">
                          {Number(ord.plannedQty).toFixed(2)}
                        </td>
                        <td className="p-3.5 font-semibold text-[#2E8B57]">
                          {Number(ord.actualYieldQty || 0).toFixed(2)}
                        </td>
                        <td className="p-3.5 font-semibold text-[#1C1C1C]">
                          ₹{Number(ord.totalRawCost || 0).toFixed(2)}
                        </td>
                        <td className="p-3.5 font-semibold text-[#2E8B57]">
                          ₹{Number(ord.unitFoodCost || 0).toFixed(2)}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              ord.status === 'COMPLETED'
                                ? 'bg-green-50 text-green-700 border border-green-200'
                                : ord.status === 'IN_PROGRESS'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-gray-50 text-gray-700 border border-gray-200'
                            }`}
                          >
                            {ord.status}
                          </span>
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
                  className="w-full p-2.5 text-xs rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:outline-none focus:border-[#C79A3B]"
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
                  className="w-full p-2.5 text-xs rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:outline-none focus:border-[#C79A3B]"
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
                    className="w-full p-2.5 text-xs rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:outline-none focus:border-[#C79A3B]"
                  />
                  <button
                    onClick={handlePreview}
                    disabled={previewLoading || !selectedRecipeId || !selectedWarehouseId}
                    className="px-4 py-2.5 rounded-xl bg-[#1C1C1C] hover:bg-[#2D2D2D] text-white text-xs font-semibold transition-all active:scale-95 disabled:opacity-60 shadow-sm flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Search className="w-3.5 h-3.5 text-[#C79A3B]" />
                    <span>Check Sufficiency</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Preview Breakdown Table */}
            {previewData && (
              <div className="space-y-4 pt-4 border-t border-[rgba(45,45,45,0.08)]">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)]">
                  <div>
                    <span className="text-xs font-bold text-[#1C1C1C] block">
                      Sufficiency Status: {previewData.allIngredientsAvailable ? (
                        <span className="text-green-600">✓ All Ingredients Available in Stock</span>
                      ) : (
                        <span className="text-red-600">⚠ Ingredient Shortage Detected</span>
                      )}
                    </span>
                    <span className="text-[11px] text-[#707070]">
                      Batch Size: {previewData.plannedQty} Units | Est. Total Cost: ₹{Number(previewData.totalEstimatedRawCost).toFixed(2)} | Unit Food Cost: ₹{Number(previewData.estimatedUnitFoodCost).toFixed(2)}
                    </span>
                  </div>

                  <button
                    onClick={handleExecuteBatch}
                    disabled={executing || !previewData.allIngredientsAvailable}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2E8B57] hover:bg-[#246e45] text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{executing ? 'Executing Batch...' : 'Execute Production Batch'}</span>
                  </button>
                </div>

                <div className="bg-white rounded-xl border border-[rgba(45,45,45,0.08)] overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF8F5] text-[#707070] font-bold border-b border-[rgba(45,45,45,0.08)]">
                      <tr>
                        <th className="p-3">Raw Ingredient</th>
                        <th className="p-3">Required Qty</th>
                        <th className="p-3">Current Kitchen Stock</th>
                        <th className="p-3">Unit Cost</th>
                        <th className="p-3">Total Cost</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
                      {previewData.ingredients.map((ing) => (
                        <tr key={ing.rawItemId} className="hover:bg-[#FAF8F5]/50">
                          <td className="p-3 font-semibold text-[#1C1C1C]">
                            {ing.rawItemName} ({ing.rawItemCode})
                          </td>
                          <td className="p-3 font-mono font-bold text-[#1C1C1C]">
                            {Number(ing.standardRequiredQty).toFixed(2)} {ing.unitSymbol}
                          </td>
                          <td className="p-3 font-mono text-[#707070]">
                            {Number(ing.currentStockInKitchen).toFixed(2)} {ing.unitSymbol}
                          </td>
                          <td className="p-3 font-semibold text-[#1C1C1C]">
                            ₹{Number(ing.unitCost).toFixed(2)}
                          </td>
                          <td className="p-3 font-semibold text-[#2E8B57]">
                            ₹{Number(ing.totalCost).toFixed(2)}
                          </td>
                          <td className="p-3">
                            {ing.isAvailable ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                                <CheckCircle2 className="w-3 h-3" />
                                Available
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                                <AlertTriangle className="w-3 h-3" />
                                Short: {Number(ing.shortageQty).toFixed(2)} {ing.unitSymbol}
                              </span>
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
