'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useOutlet } from '@/context/OutletContext';
import { useAuth } from '@/context/AuthContext';
import { kitchenOrdersApi } from '@/api/kitchenOrders';
import { centralKitchenProductionApi, productionApi } from '@/api/production';
import {
  KitchenOrder,
  KitchenOrderItemOption,
} from '@/types/kitchen-order.types';
import { ProductionOrder, ProductionPreview, Recipe } from '@/types/production.types';
import {
  ChefHat, Plus, RefreshCw, Search, CheckCircle2, AlertCircle, Truck, PackageCheck,
  X, Clock, Ban, Play, Info, Store, Eye, Printer, Boxes, AlertTriangle, BookOpen, Trash2
} from 'lucide-react';
import { Button, AlertBanner, SearchInput, Badge, EmptyState } from '@/components/ui';
import RecipeManager from './RecipeManager';
import InventoryManager from '../inventory/InventoryManager';
import WastageWorkspace from './WastageWorkspace';

export const KITCHEN_ROLES = [
  'SUPER_ADMIN', 'SUPERADMIN', 'OWNER', 'ADMIN', 'HQ_ADMIN', 'HEAD_OFFICE_ADMIN',
  'CENTRAL_PURCHASE_MANAGER', 'CENTRAL_STORE_MANAGER', 'DESSERT_KITCHEN_HEAD',
  'KITCHEN_CHEF', 'GENERAL_MANAGER', 'DIRECTOR', 'PRODUCTION_MANAGER'
];

export const ADMIN_ROLES = [
  'SUPER_ADMIN', 'SUPERADMIN', 'OWNER', 'ADMIN', 'HQ_ADMIN', 'HEAD_OFFICE_ADMIN',
  'CENTRAL_PURCHASE_MANAGER', 'CENTRAL_STORE_MANAGER', 'DESSERT_KITCHEN_HEAD',
  'GENERAL_MANAGER', 'DIRECTOR', 'PRODUCTION_MANAGER'
];

const CENTRAL_OUTLET_TYPES = ['CENTRAL_STORE', 'DESSERT_KITCHEN', 'HEAD_OFFICE'];

export const statusBadge: Record<string, { label: string; cls: string }> = {
  SUBMITTED: { label: 'Demand Submitted', cls: 'bg-amber-100 text-amber-800' },
  APPROVED: { label: 'Demand Approved', cls: 'bg-indigo-100 text-indigo-800' },
  REJECTED: { label: 'Demand Rejected', cls: 'bg-red-100 text-red-800' },
  IN_PRODUCTION: { label: 'Dispatch Pending Approval', cls: 'bg-blue-100 text-blue-800' },
  DISPATCHED: { label: 'Dispatch Approved (In Transit)', cls: 'bg-violet-100 text-violet-800' },
  PARTIALLY_RECEIVED: { label: 'Partly Received', cls: 'bg-cyan-100 text-cyan-800' },
  RECEIVED: { label: 'Received', cls: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-red-100 text-red-700' },
};

const num = (v: any) => Number(v ?? 0);
const fmtQty = (v: any) => num(v).toLocaleString('en-IN');
const fmt = (v: any) => num(v).toFixed(2);
const fmtDate = (v?: string | null) => {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return v; }
};
const fmtDay = (v?: string | null) => {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return v; }
};

interface MainKitchenWorkspaceProps {
  initialView?: 'outlet' | 'kitchen';
}

type KitchenTab = 'demands' | 'production' | 'stock' | 'dispatch' | 'wastage' | 'history' | 'recipes';
type OutletTab = 'my_demands' | 'create_demand';

export const MainKitchenWorkspace: React.FC<MainKitchenWorkspaceProps> = ({ initialView }) => {
  const { activeOutlet } = useOutlet();
  const { user } = useAuth();

  const userRole = typeof user?.role === 'object' ? (user.role.name || '') : (user?.role || '');
  const isCentralOutlet = CENTRAL_OUTLET_TYPES.includes((activeOutlet?.type || '').toUpperCase());
  
  const isKitchen = initialView !== undefined 
    ? initialView === 'kitchen' 
    : (activeOutlet?.code === 'BB-01' || (activeOutlet ? isCentralOutlet : KITCHEN_ROLES.includes(userRole.toUpperCase())));

  const isAdmin = ADMIN_ROLES.includes(userRole.toUpperCase());

  const [activeKitchenTab, setActiveKitchenTab] = useState<KitchenTab>('demands');
  const [activeOutletTab, setActiveOutletTab] = useState<OutletTab>('my_demands');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Demands & Dispatch state
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [items, setItems] = useState<KitchenOrderItemOption[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  // Production state
  const [centralConfig, setCentralConfig] = useState<any>(null);
  const [prodHistory, setProdHistory] = useState<ProductionOrder[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [productionQty, setProductionQty] = useState(1);
  const [actualYieldQty, setActualYieldQty] = useState<number | null>(null);
  const [preview, setPreview] = useState<ProductionPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [executing, setExecuting] = useState(false);

  // Action states
  const [dispatchOrder, setDispatchOrder] = useState<KitchenOrder | null>(null);
  const [dispatchQty, setDispatchQty] = useState(0);
  const [dispatchNotes, setDispatchNotes] = useState('');
  
  const [receiveOrder, setReceiveOrder] = useState<KitchenOrder | null>(null);
  const [receiveQty, setReceiveQty] = useState(0);
  const [receiveNotes, setReceiveNotes] = useState('');
  
  const [createItemId, setCreateItemId] = useState('');
  const [createQty, setCreateQty] = useState(0);
  const [createNotes, setCreateNotes] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      if (isKitchen) {
        const configRes = await centralKitchenProductionApi.getCentralKitchenConfig().catch(() => null);
        if (configRes && configRes.branch_id) {
          setCentralConfig(configRes);
          const histRes = await centralKitchenProductionApi.getCentralKitchenOrders().catch(() => []);
          setProdHistory(histRes || []);
        }
        
        const r = await productionApi.getRecipes({ is_active: true }).catch(() => []);
        if (Array.isArray(r)) {
          const validRecipes = r.filter(x => x.finishedItemId || x.finished_item_id);
          setRecipes(validRecipes);
        }
      }
      
      const [ordersRes, itemsRes] = await Promise.all([
        kitchenOrdersApi.getKitchenOrders().catch(() => []),
        kitchenOrdersApi.getAvailableItems().catch(() => []),
      ]);
      setOrders(Array.isArray(ordersRes) ? ordersRes : []);
      setItems(Array.isArray(itemsRes) ? itemsRes : []);
      
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to load data.' });
    } finally {
      setLoading(false);
    }
  }, [isKitchen]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Production Preview
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const fetchPreview = async () => {
      if (!isKitchen || !selectedRecipeId || !centralConfig?.warehouse_id || productionQty <= 0) {
        setPreview(null);
        return;
      }
      setPreviewLoading(true);
      try {
        const data = await centralKitchenProductionApi.previewProduction({
          recipe_id: selectedRecipeId,
          planned_qty: productionQty,
          kitchen_warehouse_id: centralConfig.warehouse_id,
        });
        setPreview(data);
      } catch (err: any) {
        setPreview(null);
        setFeedback({ type: 'error', message: err?.response?.data?.detail || 'Preview failed' });
      } finally {
        setPreviewLoading(false);
      }
    };
    timeout = setTimeout(fetchPreview, 300);
    return () => clearTimeout(timeout);
  }, [selectedRecipeId, productionQty, centralConfig, isKitchen]);

  const filteredOrders = orders.filter((o) => {
    // If we are acting as Main Kitchen, do not show BB-01's own requested demands in the incoming queue
    if (isKitchen && activeOutlet?.code === 'BB-01' && o.branch_code === 'BB-01') return false;
    
    if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const haystack = `${o.order_number} ${o.item_name || ''} ${o.branch_name || ''}`.toLowerCase();
      return haystack.includes(q);
    }
    return true;
  });

  const handleCreateDemand = async () => {
    if (!createItemId || createQty <= 0) {
      setFeedback({ type: 'error', message: 'Select an item and quantity > 0.' });
      return;
    }
    try {
      await kitchenOrdersApi.createKitchenOrder({
        branch_id: activeOutlet?.id || '',
        item_id: createItemId,
        requested_qty: createQty,
        notes: createNotes.trim() || undefined,
      });
      setFeedback({ type: 'success', message: 'Demand submitted.' });
      setIsCreateModalOpen(false);
      setCreateItemId(''); setCreateQty(0); setCreateNotes('');
      setActiveOutletTab('my_demands');
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.detail || 'Failed to submit demand' });
    }
  };

  const handleApproveDemand = async (order: KitchenOrder) => {
    try {
      await kitchenOrdersApi.approveKitchenOrder(order.id, {});
      setFeedback({ type: 'success', message: `Demand ${order.order_number} approved.` });
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.detail || 'Approval failed' });
    }
  };
  
  const handleRejectDemand = async (order: KitchenOrder) => {
    try {
      await kitchenOrdersApi.rejectKitchenOrder(order.id, { reason: 'Rejected by HO' });
      setFeedback({ type: 'success', message: `Demand ${order.order_number} rejected.` });
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.detail || 'Rejection failed' });
    }
  };

  const handleDispatch = async () => {
    if (!dispatchOrder || dispatchQty <= 0) return;
    try {
      await kitchenOrdersApi.dispatchKitchenOrder(dispatchOrder.id, {
        dispatched_qty: dispatchQty,
        notes: dispatchNotes.trim() || undefined,
      });
      setFeedback({ type: 'success', message: `Dispatched ${dispatchQty} units.` });
      setDispatchOrder(null);
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.detail || 'Dispatch failed' });
    }
  };

  const handleApproveDispatch = async (order: KitchenOrder) => {
    try {
      await kitchenOrdersApi.approveDispatch(order.id, {});
      setFeedback({ type: 'success', message: `Dispatch approved.` });
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.detail || 'Approval failed' });
    }
  };

  const handleRejectDispatch = async (order: KitchenOrder) => {
    try {
      await kitchenOrdersApi.rejectDispatch(order.id, {});
      setFeedback({ type: 'success', message: `Dispatch rejected. Sector V stock restored.` });
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.detail || 'Reject failed' });
    }
  };

  const handleReceive = async () => {
    if (!receiveOrder) return;
    try {
      await kitchenOrdersApi.receiveKitchenOrder(receiveOrder.id, {
        accepted_qty: receiveQty,
        notes: receiveNotes.trim() || undefined,
      });
      setFeedback({ type: 'success', message: `Received ${receiveQty} units.` });
      setReceiveOrder(null);
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.detail || 'Receive failed' });
    }
  };

  const handleExecuteProduction = async () => {
    if (!centralConfig?.branch_id || !selectedRecipeId || productionQty <= 0) return;
    setExecuting(true);
    try {
      const yieldQty = actualYieldQty !== null ? actualYieldQty : productionQty;
      const wastageQty = Math.max(0, productionQty - yieldQty);
      await centralKitchenProductionApi.executeProduction({
        branch_id: centralConfig.branch_id,
        recipe_id: selectedRecipeId,
        planned_qty: productionQty,
        kitchen_warehouse_id: centralConfig.warehouse_id,
        actual_yield_qty: yieldQty,
        wastage_qty: wastageQty,
      });
      setFeedback({ type: 'success', message: `Production Completed! ${yieldQty} units produced.` });
      setPreview(null); setProductionQty(1); setActualYieldQty(null);
      fetchData();
      setActiveKitchenTab('history');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.detail || 'Production failed' });
    } finally {
      setExecuting(false);
    }
  };

  const renderOrderCard = (o: KitchenOrder, isDispatchTab: boolean = false) => {
    const badge = statusBadge[o.status] || { label: o.status, cls: 'bg-gray-100 text-gray-700' };
    const canApprove = !isKitchen && o.status === 'SUBMITTED' && isAdmin;
    const canDispatch = isKitchen && o.status === 'APPROVED';
    const canApproveDispatch = isKitchen && o.status === 'IN_PRODUCTION' && isAdmin;
    const canReceive = !isKitchen && o.status === 'DISPATCHED';

    return (
      <div key={o.id} className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-[#FAF8F5]/50 transition-colors border-b border-gray-100 last:border-0">
        <div className="min-w-0 space-y-1 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-xs text-[#1C1C1C] font-mono">{o.order_number}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${badge.cls}`}>{badge.label}</span>
            {isKitchen && o.branch_name && (
              <span className="flex items-center gap-1 text-[10px] text-[#1C1C1C] px-2 py-0.5 rounded bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)] font-semibold">
                <Store className="w-3 h-3 text-[#B8862D]" />
                {o.branch_name}
              </span>
            )}
          </div>
          <p className="text-sm font-bold text-[#1C1C1C]">
            {o.item_name} <span className="ml-2 text-[11px] font-semibold text-[#B8862D]">{fmtQty(o.requested_qty)} {o.unit_symbol}</span>
          </p>
          <div className="flex items-center gap-2 flex-wrap text-[11px] text-[#707070]">
            <span>Requested: <b className="text-[#1C1C1C]">{fmtQty(o.requested_qty)}</b></span>
            <span>Dispatched: <b className="text-[#1C1C1C]">{fmtQty(o.dispatched_qty)}</b></span>
            <span>Received: <b className="text-[#2E8B57]">{fmtQty(o.received_qty)}</b></span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canApprove && (
            <>
              <Button size="sm" variant="success" onClick={() => handleApproveDemand(o)} icon={<CheckCircle2 className="w-3 h-3"/>}>Approve</Button>
              <Button size="sm" variant="danger" onClick={() => handleRejectDemand(o)} icon={<Ban className="w-3 h-3"/>}>Reject</Button>
            </>
          )}
          {canDispatch && (
            <Button size="sm" variant="primary" onClick={() => { setDispatchOrder(o); setDispatchQty(num(o.requested_qty) - num(o.dispatched_qty)); }} icon={<Truck className="w-3 h-3"/>}>
              Dispatch
            </Button>
          )}
          {canApproveDispatch && (
            <>
              <Button size="sm" variant="success" onClick={() => handleApproveDispatch(o)} icon={<CheckCircle2 className="w-3 h-3"/>}>Approve Dispatch</Button>
              <Button size="sm" variant="danger" onClick={() => handleRejectDispatch(o)} icon={<Ban className="w-3 h-3"/>}>Reject Dispatch</Button>
            </>
          )}
          {canReceive && (
            <Button size="sm" variant="success" onClick={() => { setReceiveOrder(o); setReceiveQty(num(o.dispatched_qty) - num(o.received_qty)); }} icon={<PackageCheck className="w-3 h-3"/>}>
              Receive
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-[#B8862D]" />
            <h1 className="text-xl font-bold text-[#1C1C1C] font-['Outfit']">
              {isKitchen ? 'Main Kitchen Workspace' : 'Outlet Kitchen Demands'}
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF8F5] text-[#B8862D] font-bold border border-[rgba(45,45,45,0.1)]">
              [{activeOutlet?.code || 'GLOBAL'}]
            </span>
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={fetchData} loading={loading} icon={<RefreshCw className="w-4 h-4"/>}>Refresh</Button>
      </div>

      <AlertBanner feedback={feedback} onClose={() => setFeedback(null)} />

      {/* Tabs */}
      {isKitchen ? (
        <div className="flex items-center gap-2 border-b border-[rgba(45,45,45,0.08)] pb-2 overflow-x-auto">
          {(
            [
              { id: 'demands' as KitchenTab, label: 'Approved Outlet Demands', icon: CheckCircle2 },
              { id: 'production' as KitchenTab, label: 'Production', icon: ChefHat },
              { id: 'stock' as KitchenTab, label: 'Current Stock', icon: Boxes },
              { id: 'dispatch' as KitchenTab, label: 'Dispatch', icon: Truck },
              { id: 'wastage' as KitchenTab, label: 'Wastage', icon: Trash2 },
              { id: 'history' as KitchenTab, label: 'History', icon: Clock },
            ]
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveKitchenTab(id as KitchenTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeKitchenTab === id ? 'bg-[#F1E4C5] text-[#B8862D] shadow-xs border border-[#B8862D]/30' : 'text-[#707070] hover:bg-[#FAF8F5]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 border-b border-[rgba(45,45,45,0.08)] pb-2 overflow-x-auto">
          <button onClick={() => setActiveOutletTab('my_demands')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeOutletTab === 'my_demands' ? 'bg-[#F1E4C5] text-[#B8862D]' : 'text-[#707070]'}`}>
            <ChefHat className="w-4 h-4" /> My Demands
          </button>
          <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#1C1C1C] text-white">
            <Plus className="w-4 h-4" /> Create Demand
          </button>
        </div>
      )}

      {/* CONTENT */}
      {isKitchen ? (
        <div className="space-y-4">
          {activeKitchenTab === 'demands' && (
            <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] overflow-hidden">
              <div className="p-3 border-b border-gray-100 flex gap-3">
                 <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-xs bg-[#FAF8F5] border border-gray-200 rounded-xl px-3 py-1.5 font-semibold">
                   <option value="ALL">All Statuses</option>
                   <option value="APPROVED">Approved (Ready to Dispatch)</option>
                 </select>
              </div>
              {filteredOrders.filter(o => o.status === 'APPROVED').length === 0 ? (
                <EmptyState title="No Demands" description="No approved demands found." icon={<CheckCircle2 className="w-6 h-6"/>} />
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredOrders.filter(o => o.status === 'APPROVED').map(o => renderOrderCard(o, false))}
                </div>
              )}
            </div>
          )}

          {activeKitchenTab === 'dispatch' && (
            <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] overflow-hidden">
              <div className="p-3 border-b border-gray-100 text-sm font-bold">Dispatches in Transit / Pending Approval</div>
              {filteredOrders.filter(o => o.status === 'IN_PRODUCTION' || o.status === 'DISPATCHED').length === 0 ? (
                <EmptyState title="No Active Dispatches" description="No dispatches currently in transit or pending approval." icon={<Truck className="w-6 h-6"/>} />
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredOrders.filter(o => o.status === 'IN_PRODUCTION' || o.status === 'DISPATCHED').map(o => renderOrderCard(o, true))}
                </div>
              )}
            </div>
          )}

          {activeKitchenTab === 'production' && (
            <div className="p-6 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-[#1C1C1C] block mb-1">Recipe / Finished Item</label>
                  <select value={selectedRecipeId} onChange={(e) => { setSelectedRecipeId(e.target.value); setPreview(null); }} className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] focus:outline-none focus:border-[#C79A3B]">
                    <option value="">-- Select Recipe --</option>
                    {recipes.map(r => <option key={r.id} value={r.id}>{r.finishedItemName || r.finished_item_name || r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#1C1C1C] block mb-2">PLANNED PRODUCTION</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="1" value={productionQty} onChange={(e) => { setProductionQty(Math.max(1, Number(e.target.value) || 1)); setPreview(null); }} className="w-24 px-3 py-2 text-xs font-mono font-bold text-center rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] focus:outline-none focus:border-[#C79A3B]" />
                  </div>
                </div>
              </div>

              {preview && !previewLoading && (
                <div className="space-y-6 pt-6 border-t border-[rgba(45,45,45,0.08)] mt-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 rounded-2xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)]">
                     <div>
                       <span className="text-[10px] text-[#707070] uppercase font-bold tracking-wider block mb-2">GOOD OUTPUT</span>
                       <input type="number" min="0" max={productionQty} value={actualYieldQty !== null ? actualYieldQty : productionQty} onChange={(e) => setActualYieldQty(Math.min(productionQty, Math.max(0, Number(e.target.value))))} className="w-20 px-2 py-1 text-sm font-mono font-bold rounded-lg border border-[rgba(45,45,45,0.15)]" />
                     </div>
                  </div>
                  
                  <Button variant="success" size="lg" onClick={handleExecuteProduction} disabled={executing || !(preview as any).allIngredientsAvailable} loading={executing} icon={<Play className="w-4 h-4" />}>
                    SAVE PRODUCTION
                  </Button>
                </div>
              )}
            </div>
          )}

          {activeKitchenTab === 'stock' && (
            <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] p-4">
              <InventoryManager />
            </div>
          )}

          {activeKitchenTab === 'wastage' && (
            <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] p-4">
              <WastageWorkspace />
            </div>
          )}
          
          {activeKitchenTab === 'history' && (
            <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] p-4">
               <h3 className="font-bold text-sm mb-4">Production History</h3>
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-xs">
                   <thead className="bg-[#FAF8F5] text-[#707070]">
                     <tr>
                       <th className="p-3">Order No</th>
                       <th className="p-3">Item</th>
                       <th className="p-3 text-right">Yield</th>
                       <th className="p-3">Status</th>
                     </tr>
                   </thead>
                   <tbody>
                     {prodHistory.map(h => (
                       <tr key={h.id} className="border-b">
                         <td className="p-3 font-mono">{h.orderNumber}</td>
                         <td className="p-3">{(h as any).finished_item_name || (h as any).finishedItemName}</td>
                         <td className="p-3 text-right font-bold text-green-700">{(h as any).actual_yield_qty || (h as any).actualYieldQty}</td>
                         <td className="p-3"><Badge variant="success">Completed</Badge></td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] overflow-hidden">
          {orders.length === 0 ? <EmptyState title="No Demands" description="No demands found." icon={<ChefHat className="w-6 h-6"/>} /> : (
            <div className="divide-y divide-gray-100">
              {filteredOrders.map(o => renderOrderCard(o))}
            </div>
          )}
        </div>
      )}

      {/* DISPATCH MODAL */}
      {dispatchOrder && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-xl">
            <h3 className="font-bold text-lg">Dispatch to {dispatchOrder.branch_name}</h3>
            <div>
               <label className="text-xs font-semibold block mb-1">Actual Dispatch Quantity (Requested: {fmtQty(dispatchOrder.requested_qty)})</label>
               <input type="number" value={dispatchQty} onChange={(e) => setDispatchQty(Number(e.target.value))} className="w-full p-2 border rounded-xl" />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" onClick={() => setDispatchOrder(null)}>Cancel</Button>
              <Button variant="primary" onClick={handleDispatch}>Submit Dispatch</Button>
            </div>
          </div>
        </div>
      )}

      {/* RECEIVE MODAL */}
      {receiveOrder && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-xl">
            <h3 className="font-bold text-lg">Receive from Main Kitchen</h3>
            <div>
               <label className="text-xs font-semibold block mb-1">Received Quantity (Dispatched: {fmtQty(receiveOrder.dispatched_qty)})</label>
               <input type="number" value={receiveQty} onChange={(e) => setReceiveQty(Number(e.target.value))} className="w-full p-2 border rounded-xl" />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" onClick={() => setReceiveOrder(null)}>Cancel</Button>
              <Button variant="success" onClick={handleReceive}>Confirm Receive</Button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE DEMAND MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-xl">
            <h3 className="font-bold text-lg">Create Kitchen Demand</h3>
            <div>
               <label className="text-xs font-semibold block mb-1">Item</label>
               <select value={createItemId} onChange={(e) => setCreateItemId(e.target.value)} className="w-full p-2 border rounded-xl">
                 <option value="">Select Item...</option>
                 {items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
               </select>
            </div>
            <div>
               <label className="text-xs font-semibold block mb-1">Quantity</label>
               <input type="number" value={createQty} onChange={(e) => setCreateQty(Number(e.target.value))} className="w-full p-2 border rounded-xl" />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleCreateDemand}>Submit Demand</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainKitchenWorkspace;
