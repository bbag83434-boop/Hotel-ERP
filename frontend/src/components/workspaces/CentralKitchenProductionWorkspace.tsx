'use client';

/**
 * CentralKitchenProductionWorkspace
 *
 * PART 3 — Central Kitchen PRODUCTION
 *
 * Requirements:
 *  - EXACTLY ONE Central Kitchen. No branch/warehouse selectors.
 *  - 2 main areas: NEW PRODUCTION, PRODUCTION HISTORY (and Recipe Manager).
 *  - Stock Check: block if ANY ingredient is insufficient (no negative stock).
 *  - FIFO ingredient deduction & finished stock increase.
 *  - NO interaction with Kitchen Orders / Transfer / Dispatch.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { centralKitchenProductionApi } from '@/api/production';
import {
  ChefHat,
  RefreshCw,
  Plus,
  Search,
  Play,
  AlertTriangle,
  CheckCircle2,
  Clock,
  BarChart3,
  BookOpen,
} from 'lucide-react';
import { ProductionOrder, ProductionPreview, Recipe } from '@/types/production.types';
import { Button, StatCard, SearchInput, AlertBanner, EmptyState, Badge } from '@/components/ui';
import RecipeManager from './RecipeManager'; // Existing Recipe BOM engine

const ALLOWED_ROLES = [
  'SUPER_ADMIN', 'SUPERADMIN', 'OWNER', 'ADMIN', 'HQ_ADMIN', 'HEAD_OFFICE_ADMIN',
  'CENTRAL_PURCHASE_MANAGER', 'CENTRAL_STORE_MANAGER', 'DESSERT_KITCHEN_HEAD',
  'GENERAL_MANAGER', 'DIRECTOR', 'KITCHEN_CHEF', 'PRODUCTION_MANAGER',
];

const num = (v: unknown) => Number(v ?? 0);
const fmt = (v: unknown) => num(v).toFixed(2);
const fmtDate = (v?: string | null) => {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return v; }
};

type Tab = 'new_production' | 'history' | 'recipes';

export const CentralKitchenProductionWorkspace: React.FC = () => {
  const { user } = useAuth();
  const userRole = typeof user?.role === 'object' ? (user.role.name || '') : (user?.role || '');
  const isAllowed = ALLOWED_ROLES.includes(userRole.toUpperCase());

  const [tab, setTab] = useState<Tab>('new_production');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Master Data
  const [centralConfig, setCentralConfig] = useState<{
    branch_id: string;
    branch_name: string;
    branch_code: string;
    warehouse_id: string;
    warehouse_name: string;
    warehouse_code: string;
  } | null>(null);
  const [history, setHistory] = useState<ProductionOrder[]>([]);

  // Production State
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [productionQty, setProductionQty] = useState<number>(1);
  const [preview, setPreview] = useState<ProductionPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [executing, setExecuting] = useState(false);

  // Search
  const [historySearch, setHistorySearch] = useState('');

  // 1. Initial Load
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const configRes = await centralKitchenProductionApi.getCentralKitchenConfig();
      if (configRes && configRes.branch_id) {
        setCentralConfig(configRes);
        const histRes = await centralKitchenProductionApi.getCentralKitchenOrders();
        setHistory(histRes || []);
      }

      // (We fetch recipes via the Production preview endpoint list or RecipeManager manages them itself.
      // But we need a light list for the New Production dropdown.)
      const r = await fetch('/api/v1/recipes').then((res) => res.json()).catch(() => []);
      if (Array.isArray(r)) {
        setRecipes(r);
        if (r.length > 0 && !selectedRecipeId) {
          setSelectedRecipeId(r[0].id);
        }
      } else if (r.data && Array.isArray(r.data)) {
        setRecipes(r.data);
        if (r.data.length > 0 && !selectedRecipeId) {
          setSelectedRecipeId(r.data[0].id);
        }
      }

    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to load Central Kitchen data.' });
    } finally {
      setLoading(false);
    }
  }, [selectedRecipeId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // 2. Production Check (Preview)
  const handlePreview = async () => {
    if (!selectedRecipeId || !centralConfig?.warehouse_id || productionQty <= 0) return;
    setPreviewLoading(true);
    setPreview(null);
    setFeedback(null);
    try {
      const data = await centralKitchenProductionApi.previewProduction({
        recipe_id: selectedRecipeId,
        planned_qty: productionQty,
        kitchen_warehouse_id: centralConfig.warehouse_id,
      });
      setPreview(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.detail || err?.message || 'Preview failed' });
    } finally {
      setPreviewLoading(false);
    }
  };

  // 3. Execution (Post)
  const handleExecute = async () => {
    if (!centralConfig?.branch_id || !centralConfig?.warehouse_id || !selectedRecipeId || productionQty <= 0) return;
    if (!preview?.allIngredientsAvailable) return;
    setExecuting(true);
    setFeedback(null);
    try {
      const order = await centralKitchenProductionApi.executeProduction({
        branch_id: centralConfig.branch_id,
        recipe_id: selectedRecipeId,
        planned_qty: productionQty,
        kitchen_warehouse_id: centralConfig.warehouse_id,
        actual_yield_qty: productionQty,
      });
      setFeedback({
        type: 'success',
        message: `✅ Production ${order.orderNumber} Completed! ${productionQty} units produced. Ingredients consumed via FIFO.`,
      });
      setPreview(null);
      setProductionQty(1);
      
      // Refresh history & stay on history tab
      const h = await centralKitchenProductionApi.getCentralKitchenOrders();
      setHistory(h || []);
      setTab('history');
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail || err?.message || 'Production execution failed',
      });
    } finally {
      setExecuting(false);
    }
  };

  const filteredHistory = history.filter((o) =>
    (o.orderNumber || '').toLowerCase().includes(historySearch.toLowerCase()) ||
    ((o as any).finished_item_name || (o as any).finishedItemName || '').toLowerCase().includes(historySearch.toLowerCase())
  );

  // --- Render Access Guards ---
  if (!isAllowed) {
    return (
      <div className="p-12 text-center rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-xs">
        <ChefHat className="w-10 h-10 text-red-400 mx-auto mb-3 opacity-70" />
        <h3 className="text-sm font-bold text-[#1C1C1C]">Access Restricted</h3>
        <p className="text-xs text-[#707070] mt-1 max-w-sm mx-auto">
          Central Kitchen Production is available to admin and central kitchen roles only.
        </p>
      </div>
    );
  }

  if (!loading && !centralConfig) {
    return (
      <div className="space-y-6">
        <div className="p-12 text-center rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-xs">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-[#1C1C1C]">No Central Kitchen Configured</h3>
          <p className="text-xs text-[#707070] mt-1 max-w-sm mx-auto">
            You must have exactly ONE Central Kitchen branch configured (DESSERT_KITCHEN, CENTRAL_STORE, or HEAD_OFFICE).
          </p>
        </div>
      </div>
    );
  }

  const selectedRecipe = recipes.find((r) => r.id === selectedRecipeId);

  return (
    <div className="space-y-6">
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-[#C79A3B]" />
            Central Kitchen — PRODUCTION
          </h2>
          <p className="text-xs text-[#707070] mt-1">
            Producing at: <strong className="text-[#1C1C1C]">{centralConfig?.branch_name || '...'}</strong> 
            {' '}({centralConfig?.warehouse_name || '...'})
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchAll} loading={loading} icon={<RefreshCw className="w-3.5 h-3.5 text-[#C79A3B]" />}>
          Refresh Data
        </Button>
      </div>

      <AlertBanner feedback={feedback} onClose={() => setFeedback(null)} />

      {/* Navigation */}
      <div className="flex items-center gap-1.5 p-1.5 bg-white border border-[rgba(45,45,45,0.08)] rounded-2xl shadow-xs overflow-x-auto">
        {(
          [
            { id: 'new_production' as Tab, label: 'New Production',     icon: Plus },
            { id: 'history' as Tab,        label: 'Production History', icon: Clock },
            { id: 'recipes' as Tab,        label: 'Recipe / BOM',       icon: BookOpen },
          ]
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              tab === id
                ? 'bg-[#F1E4C5] text-[#B8862D] shadow-xs'
                : 'text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5]'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ──────────────────────────────────────────────────────────────────
          TAB A: NEW PRODUCTION
      ────────────────────────────────────────────────────────────────── */}
      {tab === 'new_production' && (
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-5">
            <div>
              <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
                <ChefHat className="w-4 h-4 text-[#C79A3B]" />
                Execute Production Run
              </h3>
              <p className="text-xs text-[#707070] mt-0.5">
                Select an active recipe, enter total yield quantity. Ingredients will be checked against Central Kitchen stock.
              </p>
            </div>

            {/* Select Recipe */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-[#1C1C1C] block mb-1">
                  Finished/Semi-Finished Item (Recipe)
                </label>
                <select
                  value={selectedRecipeId}
                  onChange={(e) => { setSelectedRecipeId(e.target.value); setPreview(null); }}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] focus:outline-none focus:border-[#C79A3B]"
                >
                  <option value="">-- Select Recipe --</option>
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.finishedItemName || r.name} ({r.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#1C1C1C] block mb-2">
                  Production Quantity (Total Yield)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setProductionQty(Math.max(1, productionQty - 1)); setPreview(null); }}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] text-[#1C1C1C] font-bold text-sm hover:bg-[#F1E4C5] active:scale-95 transition-all"
                  >-</button>
                  <input
                    type="number"
                    min="1"
                    value={productionQty}
                    onChange={(e) => { setProductionQty(Math.max(1, Number(e.target.value) || 1)); setPreview(null); }}
                    className="w-24 px-3 py-2 text-xs font-mono font-bold text-center rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] focus:outline-none focus:border-[#C79A3B]"
                  />
                  <button
                    type="button"
                    onClick={() => { setProductionQty(productionQty + 1); setPreview(null); }}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] text-[#1C1C1C] font-bold text-sm hover:bg-[#F1E4C5] active:scale-95 transition-all"
                  >+</button>
                  <span className="text-xs text-[#707070] font-semibold ml-2">
                    {selectedRecipe?.finishedUnitSymbol || 'Units'}
                  </span>
                </div>
              </div>
            </div>

            {/* Action */}
            <Button
              variant="primary"
              size="md"
              onClick={handlePreview}
              disabled={previewLoading || !selectedRecipeId || productionQty <= 0}
              loading={previewLoading}
              icon={<Search className="w-3.5 h-3.5 text-[#C79A3B]" />}
            >
              Check Ingredient Availability
            </Button>

            {/* PREVIEW RESULTS */}
            {preview && (
              <div className="space-y-4 pt-4 border-t border-[rgba(45,45,45,0.08)]">
                
                {/* Banner */}
                <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border ${
                  preview.allIngredientsAvailable ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                }`}>
                  <div>
                    <span className="text-xs font-bold">
                      {preview.allIngredientsAvailable ? (
                        <span className="flex items-center gap-1.5 text-[#2E8B57]">
                          <CheckCircle2 className="w-4 h-4" /> Requirements Met — Ready to Produce
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-red-700">
                          <AlertTriangle className="w-4 h-4" /> INSUFFICIENT STOCK — Production Blocked
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] text-[#707070] block mt-1">
                      Total Cost: ₹{fmt(preview.totalEstimatedRawCost)} · Cost/Unit: ₹{fmt(preview.estimatedUnitFoodCost)}
                    </span>
                  </div>
                  <Button
                    variant="success"
                    size="md"
                    onClick={handleExecute}
                    disabled={executing || !preview.allIngredientsAvailable}
                    loading={executing}
                    icon={<Play className="w-3.5 h-3.5" />}
                  >
                    Confirm Production
                  </Button>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl border border-[rgba(45,45,45,0.08)] overflow-hidden">
                  <div className="px-4 py-2.5 bg-[#FAF8F5] border-b border-[rgba(45,45,45,0.08)]">
                    <p className="text-xs font-bold text-[#1C1C1C]">Ingredient Requirement Table</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#FAF8F5] text-[#707070] font-bold border-b border-[rgba(45,45,45,0.08)]">
                        <tr>
                          <th className="p-3">Ingredient</th>
                          <th className="p-3 text-right">Required Qty</th>
                          <th className="p-3 text-right">Available</th>
                          <th className="p-3">Unit</th>
                          <th className="p-3 text-right">Rate</th>
                          <th className="p-3 text-right">Cost</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
                        {preview.ingredients.map((ing) => {
                          const reqQty  = num((ing as any).required_qty   ?? (ing as any).standardRequiredQty);
                          const avlQty  = num((ing as any).available_qty  ?? (ing as any).currentStockInKitchen);
                          const unit    = (ing as any).unit_symbol        ?? (ing as any).unitSymbol        ?? '';
                          const rate    = num((ing as any).unit_cost      ?? (ing as any).unitCost);
                          const cost    = num((ing as any).total_cost     ?? (ing as any).totalCost);
                          const isSuff  = (ing as any).is_sufficient      !== false && (ing as any).isAvailable !== false;
                          const name    = (ing as any).item_name          ?? (ing as any).rawItemName  ?? '—';
                          
                          return (
                            <tr key={(ing as any).raw_item_id ?? name} className="hover:bg-[#FAF8F5]/50">
                              <td className="p-3 font-semibold text-[#1C1C1C]">{name}</td>
                              <td className="p-3 text-right font-mono font-bold text-[#1C1C1C]">{fmt(reqQty)}</td>
                              <td className={`p-3 text-right font-mono ${isSuff ? 'text-[#2E8B57]' : 'text-red-600 font-bold'}`}>
                                {fmt(avlQty)}
                              </td>
                              <td className="p-3 text-[#707070]">{unit}</td>
                              <td className="p-3 text-right font-mono text-[#707070]">₹{fmt(rate)}</td>
                              <td className="p-3 text-right font-mono font-semibold text-[#2E8B57]">₹{fmt(cost)}</td>
                              <td className="p-3">
                                {isSuff ? <Badge variant="success">OK</Badge> : <Badge variant="danger">Shortage</Badge>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────
          TAB B: PRODUCTION HISTORY
      ────────────────────────────────────────────────────────────────── */}
      {tab === 'history' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#C79A3B]" />
              Production History
            </h3>
            <SearchInput
              value={historySearch}
              onChangeValue={setHistorySearch}
              placeholder="Search history..."
              className="w-full sm:w-72"
            />
          </div>

          {filteredHistory.length === 0 ? (
            <EmptyState title="No Records" description="No production runs found in the Central Kitchen." icon={<Clock className="w-6 h-6" />} />
          ) : (
            <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] text-[#707070] font-bold border-b border-[rgba(45,45,45,0.08)]">
                    <tr>
                      <th className="p-3.5">Production No</th>
                      <th className="p-3.5">Date</th>
                      <th className="p-3.5">Item</th>
                      <th className="p-3.5">Recipe</th>
                      <th className="p-3.5 text-right">Produced Qty</th>
                      <th className="p-3.5">Unit</th>
                      <th className="p-3.5 text-right">Total Cost</th>
                      <th className="p-3.5 text-right">Cost/Unit</th>
                      <th className="p-3.5">Created By</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
                    {filteredHistory.map((order) => {
                      const itemName = (order as any).finished_item_name || (order as any).finishedItemName || '—';
                      const recipeName = (order as any).recipe_name || (order as any).recipeName || '—';
                      const unitSymbol = (order as any).finished_unit_symbol || (order as any).finishedUnitSymbol || 'pcs';
                      const cost = num((order as any).total_raw_cost ?? order.totalRawCost);
                      const cpu = num((order as any).unit_food_cost ?? order.unitFoodCost);
                      const qty = num((order as any).actual_yield_qty ?? order.actualYieldQty);
                      const date = (order as any).completed_date || (order as any).completedDate || (order as any).created_at;
                      const creator = (order as any).created_by?.firstName || 'Admin';

                      return (
                        <tr key={order.id} className="hover:bg-[#FAF8F5]/50">
                          <td className="p-3.5 font-mono font-semibold text-[11px]">{order.orderNumber}</td>
                          <td className="p-3.5 text-[#707070]">{fmtDate(date)}</td>
                          <td className="p-3.5 font-semibold text-[#1C1C1C]">{itemName}</td>
                          <td className="p-3.5 text-[#707070]">{recipeName}</td>
                          <td className="p-3.5 text-right font-mono font-bold">{fmt(qty)}</td>
                          <td className="p-3.5 text-[#707070]">{unitSymbol}</td>
                          <td className="p-3.5 text-right font-mono font-semibold text-[#2E8B57]">₹{fmt(cost)}</td>
                          <td className="p-3.5 text-right font-mono text-[#707070]">₹{fmt(cpu)}</td>
                          <td className="p-3.5 text-[#707070] text-[11px]">{creator}</td>
                          <td className="p-3.5"><Badge variant="success">Completed</Badge></td>
                          <td className="p-3.5">
                            {/* View Details mock action (already implemented partially in History logic if we expand row) */}
                            <button className="text-[10px] font-bold text-[#3978B8] hover:underline">
                              View Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────
          TAB C: RECIPE / BOM
      ────────────────────────────────────────────────────────────────── */}
      {tab === 'recipes' && (
        <div className="space-y-4">
           {/* We inject the existing Recipe BOM Engine here, allowing Admin to View/Set/Edit */}
           <RecipeManager onRunBatch={(id) => { setSelectedRecipeId(id); setTab('new_production'); }} />
        </div>
      )}

    </div>
  );
};

export default CentralKitchenProductionWorkspace;
