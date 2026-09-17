'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  inventoryApi,
  type StockCount,
} from '@/api/inventory';
import { organizationApi } from '@/api/organization';
import {
  Item,
  Category,
  Unit,
  StockBalance,
  LowStockAlert,
  StockTransfer,
  ItemCreateInput,
  StockTransferCreateInput,
  StockAdjustmentInput,
  StockLedgerEntry,
  ReorderRecommendation,
} from '@/types/inventory.types';
import { Warehouse } from '@/types/organization.types';
import { getCurrentClosingPeriod, useOutlet } from '@/context/OutletContext';
import { useAuth } from '@/context/AuthContext';
import {
  Boxes,
  Package,
  ArrowLeftRight,
  SlidersHorizontal,
  Tags,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Layers,
  ArrowRight,
  TrendingDown,
  Warehouse as WarehouseIcon,
  ClipboardCheck,
  LockKeyhole,
  Send,
  XCircle,
} from 'lucide-react';

const InventoryManagerAdmin: React.FC = () => {
  const { currentOutlet } = useOutlet();
  const [subTab, setSubTab] = useState<'balances' | 'alerts' | 'reorder' | 'ledger' | 'items' | 'transfers' | 'categories' | 'stock-counts'>('balances');

  // Domain Data
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<StockLedgerEntry[]>([]);
  const [reorderRecommendations, setReorderRecommendations] = useState<ReorderRecommendation[]>([]);
  const [reorderCost, setReorderCost] = useState<number>(0);

  // UI / State Handling
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');

  // Modals
  const [showItemModal, setShowItemModal] = useState<boolean>(false);
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState<boolean>(false);
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [showUnitModal, setShowUnitModal] = useState<boolean>(false);

  // Forms
  const [itemForm, setItemForm] = useState<ItemCreateInput>({
    name: '',
    code: '',
    category_id: '',
    unit_id: '',
    type: 'RAW_MATERIAL',
    cost_price: 0,
    selling_price: 0,
    min_stock_level: 10,
    reorder_qty: 50,
  });

  const [transferForm, setTransferForm] = useState<StockTransferCreateInput>({
    from_warehouse_id: '',
    to_warehouse_id: '',
    notes: '',
    items: [{ item_id: '', quantity: 1, unit_cost: 0 }],
  });

  const [adjustmentForm, setAdjustmentForm] = useState<StockAdjustmentInput>({
    warehouse_id: '',
    item_id: '',
    change_qty: 0,
    reason_code: 'CYCLE_COUNT_ADJUSTMENT',
    notes: '',
  });

  const [categoryForm, setCategoryForm] = useState({ name: '', code: '', description: '' });
  const [unitForm, setUnitForm] = useState({ name: '', symbol: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const [balData, lowData, itemData, catData, unitData, trData, whData, ledgerData, reorderData] = await Promise.all([
        inventoryApi.getStockBalances().catch(() => []),
        inventoryApi.getLowStockAlerts().catch(() => []),
        inventoryApi.getItems().catch(() => []),
        inventoryApi.getCategories().catch(() => []),
        inventoryApi.getUnits().catch(() => []),
        inventoryApi.getTransfers().catch(() => []),
        organizationApi.getWarehouses().catch(() => []),
        inventoryApi.getStockLedger({ limit: 100 }).catch(() => []),
        inventoryApi.getReorderRecommendations().catch(() => ({ recommendations: [], total_estimated_replenishment_cost: 0 })),
      ]);

      setBalances(balData);
      setLowStockAlerts(lowData);
      setItems(itemData);
      setCategories(catData);
      setUnits(unitData);
      setTransfers(trData);
      setWarehouses(whData);
      setLedgerEntries(ledgerData);
      setReorderRecommendations(reorderData?.recommendations || []);
      setReorderCost(Number(reorderData?.total_estimated_replenishment_cost || 0));

      // Preselect default IDs in forms
      if (catData.length > 0) setItemForm((prev) => ({ ...prev, category_id: prev.category_id || catData[0].id }));
      if (unitData.length > 0) setItemForm((prev) => ({ ...prev, unit_id: prev.unit_id || unitData[0].id }));
      if (whData.length > 0) {
        setTransferForm((prev) => ({
          ...prev,
          from_warehouse_id: prev.from_warehouse_id || whData[0].id,
          to_warehouse_id: prev.to_warehouse_id || (whData[1] ? whData[1].id : whData[0].id),
        }));
        setAdjustmentForm((prev) => ({ ...prev, warehouse_id: prev.warehouse_id || whData[0].id }));
      }
      if (itemData.length > 0) {
        setAdjustmentForm((prev) => ({ ...prev, item_id: prev.item_id || itemData[0].id }));
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to load live inventory data' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Form Handlers
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await inventoryApi.createItem({
        ...itemForm,
        cost_price: Number(itemForm.cost_price),
        selling_price: Number(itemForm.selling_price),
        min_stock_level: Number(itemForm.min_stock_level),
        reorder_qty: Number(itemForm.reorder_qty),
      });
      setFeedback({ type: 'success', message: `Item "${itemForm.name}" created successfully.` });
      setShowItemModal(false);
      setItemForm({
        name: '',
        code: '',
        category_id: categories[0]?.id || '',
        unit_id: units[0]?.id || '',
        type: 'RAW_MATERIAL',
        cost_price: 0,
        selling_price: 0,
        min_stock_level: 10,
        reorder_qty: 50,
      });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.detail || err.message || 'Failed to create item' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await inventoryApi.createTransfer({
        ...transferForm,
        items: transferForm.items.map((it) => ({
          item_id: it.item_id || items[0]?.id || '',
          quantity: Number(it.quantity),
          unit_cost: Number(it.unit_cost || 0),
        })),
      });
      setFeedback({ type: 'success', message: 'Inter-outlet stock transfer initiated successfully.' });
      setShowTransferModal(false);
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.detail || err.message || 'Transfer failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await inventoryApi.adjustStock({
        ...adjustmentForm,
        change_qty: Number(adjustmentForm.change_qty),
      });
      setFeedback({
        type: 'success',
        message: `Stock updated. New balance: ${res.new_balance} units (Ledger: ${res.ledger_entry_id.slice(0, 8)}...).`,
      });
      setShowAdjustmentModal(false);
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.detail || err.message || 'Stock adjustment failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await inventoryApi.createCategory(categoryForm);
      setFeedback({ type: 'success', message: `Category "${categoryForm.name}" created.` });
      setShowCategoryModal(false);
      setCategoryForm({ name: '', code: '', description: '' });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.detail || err.message || 'Category creation failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await inventoryApi.createUnit(unitForm);
      setFeedback({ type: 'success', message: `Unit "${unitForm.name}" created.` });
      setShowUnitModal(false);
      setUnitForm({ name: '', symbol: '' });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.detail || err.message || 'Unit creation failed' });
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered lists
  const filteredBalances = balances.filter((b) => {
    const matchesSearch =
      (b.item_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.item_code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.warehouse_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesWarehouse = selectedWarehouseId ? b.warehouse_id === selectedWarehouseId : true;
    return matchesSearch && matchesWarehouse;
  });

  const filteredItems = items.filter(
    (it) =>
      it.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      it.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (it.category_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredLedger = ledgerEntries.filter((entry) =>
    (entry.item_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (entry.item_code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (entry.warehouse_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (entry.movement_type || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredReorder = reorderRecommendations.filter((entry) =>
    entry.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.item_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.warehouse_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTransfers = transfers.filter(
    (tr) =>
      tr.transfer_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tr.from_warehouse_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tr.to_warehouse_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
            <Boxes className="w-5 h-5 text-[#C79A3B]" />
            Multi-Outlet Inventory & Central Commissary
          </h2>
          <p className="text-xs text-[#707070] mt-0.5">
            Real-time stock ledger, zero negative stock enforcement, and commissary dispatch control.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[rgba(45,45,45,0.12)] hover:bg-[#FAF8F5] text-xs font-semibold text-[#1C1C1C] shadow-sm active:scale-95 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#C79A3B] ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
      {subTab === 'balances' && (
            <button
              onClick={() => setShowAdjustmentModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#2E8B57] hover:bg-[#2E8B57]/90 text-white text-xs font-semibold shadow-md transition-all active:scale-95"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Adjust Stock</span>
            </button>
          )}
          {subTab === 'items' && (
            <button
              onClick={() => setShowItemModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#C79A3B] to-[#B8862D] text-white text-xs font-semibold shadow-md shadow-[#C79A3B]/20 transition-all hover:brightness-105 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Master Item</span>
            </button>
          )}
          {subTab === 'transfers' && (
            <button
              onClick={() => setShowTransferModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#3978B8] hover:bg-[#3978B8]/90 text-white text-xs font-semibold shadow-md transition-all active:scale-95"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Dispatch Transfer</span>
            </button>
          )}
          {subTab === 'categories' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCategoryModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] text-[#1C1C1C] text-xs font-semibold hover:bg-[#FAF8F5]"
              >
                <Plus className="w-3.5 h-3.5 text-[#C79A3B]" />
                <span>Category</span>
              </button>
              <button
                onClick={() => setShowUnitModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#C79A3B] text-white text-xs font-semibold hover:bg-[#B8862D]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Unit</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-[#2E8B57]/10 border-[#2E8B57]/30 text-[#2E8B57]'
              : 'bg-[#D9534F]/10 border-[#D9534F]/30 text-[#D9534F]'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs font-bold underline opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Low Stock Warning Banner */}
      {lowStockAlerts.length > 0 && (
        <div className="p-3.5 rounded-xl bg-[#D99625]/10 border border-[#D99625]/30 text-[#D99625] text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#D99625]" />
            <span>
              <strong>Low Stock Alert:</strong> {lowStockAlerts.length} item(s) are below minimum reorder thresholds across warehouses.
            </span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white border border-[#D99625]/30">
            Action Recommended
          </span>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={() => { setSubTab('balances'); setSearchQuery(''); }}
          className={`p-4 rounded-xl text-left border transition-all ${
            subTab === 'balances'
              ? 'bg-white border-[#C79A3B] shadow-md shadow-[#C79A3B]/10 ring-1 ring-[#C79A3B]'
              : 'bg-white/80 border-[rgba(45,45,45,0.08)] hover:bg-[#FAF8F5]'
          }`}
        >
          <div className="flex items-center justify-between text-[#707070] mb-1">
            <span className="text-xs font-semibold">Stock Balances</span>
            <Boxes className="w-4 h-4 text-[#C79A3B]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">{balances.length}</p>
          <p className="text-[10px] text-[#2E8B57] mt-1 font-medium">Multi-Warehouse Entries</p>
        </button>

        <button
          onClick={() => { setSubTab('items'); setSearchQuery(''); }}
          className={`p-4 rounded-xl text-left border transition-all ${
            subTab === 'items'
              ? 'bg-white border-[#C79A3B] shadow-md shadow-[#C79A3B]/10 ring-1 ring-[#C79A3B]'
              : 'bg-white/80 border-[rgba(45,45,45,0.08)] hover:bg-[#FAF8F5]'
          }`}
        >
          <div className="flex items-center justify-between text-[#707070] mb-1">
            <span className="text-xs font-semibold">Master Catalogue</span>
            <Package className="w-4 h-4 text-[#3978B8]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">{items.length}</p>
          <p className="text-[10px] text-[#3978B8] mt-1 font-medium">SKUs Registered</p>
        </button>

        <button
          onClick={() => { setSubTab('transfers'); setSearchQuery(''); }}
          className={`p-4 rounded-xl text-left border transition-all ${
            subTab === 'transfers'
              ? 'bg-white border-[#C79A3B] shadow-md shadow-[#C79A3B]/10 ring-1 ring-[#C79A3B]'
              : 'bg-white/80 border-[rgba(45,45,45,0.08)] hover:bg-[#FAF8F5]'
          }`}
        >
          <div className="flex items-center justify-between text-[#707070] mb-1">
            <span className="text-xs font-semibold">Transfers</span>
            <ArrowLeftRight className="w-4 h-4 text-[#2E8B57]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">{transfers.length}</p>
          <p className="text-[10px] text-[#2E8B57] mt-1 font-medium">Inter-Outlet Log</p>
        </button>

        <button
          onClick={() => { setSubTab('alerts'); setSearchQuery(''); }}
          className={`p-4 rounded-xl text-left border transition-all ${subTab === 'alerts' ? 'bg-white border-[#C79A3B] shadow-md shadow-[#C79A3B]/10 ring-1 ring-[#C79A3B]' : 'bg-white/80 border-[rgba(45,45,45,0.08)] hover:bg-[#FAF8F5]'}`}
        >
          <div className="flex items-center justify-between text-[#707070] mb-1">
            <span className="text-xs font-semibold">Stock Alerts</span><AlertTriangle className="w-4 h-4 text-[#D99625]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">{lowStockAlerts.length}</p>
          <p className="text-[10px] text-[#D99625] mt-1 font-medium">Below minimum</p>
        </button>

        <button
          onClick={() => { setSubTab('reorder'); setSearchQuery(''); }}
          className={`p-4 rounded-xl text-left border transition-all ${subTab === 'reorder' ? 'bg-white border-[#C79A3B] shadow-md shadow-[#C79A3B]/10 ring-1 ring-[#C79A3B]' : 'bg-white/80 border-[rgba(45,45,45,0.08)] hover:bg-[#FAF8F5]'}`}
        >
          <div className="flex items-center justify-between text-[#707070] mb-1">
            <span className="text-xs font-semibold">Reorder Queue</span><TrendingDown className="w-4 h-4 text-[#D9534F]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">{reorderRecommendations.length}</p>
          <p className="text-[10px] text-[#D9534F] mt-1 font-medium">Est. ₹{reorderCost.toFixed(0)}</p>
        </button>

        <button
          onClick={() => { setSubTab('ledger'); setSearchQuery(''); }}
          className={`p-4 rounded-xl text-left border transition-all ${subTab === 'ledger' ? 'bg-white border-[#C79A3B] shadow-md shadow-[#C79A3B]/10 ring-1 ring-[#C79A3B]' : 'bg-white/80 border-[rgba(45,45,45,0.08)] hover:bg-[#FAF8F5]'}`}
        >
          <div className="flex items-center justify-between text-[#707070] mb-1">
            <span className="text-xs font-semibold">Stock Movements</span><ArrowLeftRight className="w-4 h-4 text-[#3978B8]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">{ledgerEntries.length}</p>
          <p className="text-[10px] text-[#3978B8] mt-1 font-medium">Recent ledger entries</p>
        </button>

        <button
          onClick={() => { setSubTab('stock-counts'); setSearchQuery(''); }}
          className={`p-4 rounded-xl text-left border transition-all ${
            subTab === 'stock-counts'
              ? 'bg-white border-[#C79A3B] shadow-md shadow-[#C79A3B]/10 ring-1 ring-[#C79A3B]'
              : 'bg-white/80 border-[rgba(45,45,45,0.08)] hover:bg-[#FAF8F5]'
          }`}
        >
          <div className="flex items-center justify-between text-[#707070] mb-1">
            <span className="text-xs font-semibold">Stock Count Review</span>
            <ClipboardCheck className="w-4 h-4 text-[#3978B8]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">Review</p>
          <p className="text-[10px] text-[#3978B8] mt-1 font-medium">Approve / reject submitted counts</p>
        </button>

        <button
          onClick={() => { setSubTab('categories'); setSearchQuery(''); }}
          className={`p-4 rounded-xl text-left border transition-all ${
            subTab === 'categories'
              ? 'bg-white border-[#C79A3B] shadow-md shadow-[#C79A3B]/10 ring-1 ring-[#C79A3B]'
              : 'bg-white/80 border-[rgba(45,45,45,0.08)] hover:bg-[#FAF8F5]'
          }`}
        >
          <div className="flex items-center justify-between text-[#707070] mb-1">
            <span className="text-xs font-semibold">Categories & Units</span>
            <Tags className="w-4 h-4 text-[#B8862D]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">{categories.length}</p>
          <p className="text-[10px] text-[#707070] mt-1">{units.length} Units of Measure</p>
        </button>
      </div>

      {/* Sub-Tabs & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <div className="flex border-b border-[rgba(45,45,45,0.08)] space-x-3 overflow-x-auto">
          {(['balances', 'alerts', 'reorder', 'ledger', 'items', 'transfers', 'categories', 'stock-counts'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setSubTab(tab); setSearchQuery(''); }}
              className={`pb-2.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
                subTab === tab
                  ? 'border-[#C79A3B] text-[#B8862D]'
                  : 'border-transparent text-[#707070] hover:text-[#1C1C1C]'
              }`}
            >
              {tab === 'balances' ? 'Live Balances' : tab === 'alerts' ? 'Stock Alerts' : tab === 'reorder' ? 'Reorder Queue' : tab === 'ledger' ? 'Stock History' : tab === 'items' ? 'Items Catalogue' : tab === 'transfers' ? 'Inter-Outlet Transfers' : tab === 'stock-counts' ? 'Stock Count Review' : 'Categories & Units'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {(subTab === 'balances' || subTab === 'alerts' || subTab === 'reorder' || subTab === 'ledger') && (
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-xl bg-white border border-[rgba(45,45,45,0.12)] text-[#1C1C1C] focus:outline-none focus:border-[#C79A3B]"
            >
              <option value="">All Warehouses ({warehouses.length})</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} [{w.code}]
                </option>
              ))}
            </select>
          )}

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]" />
            <input
              type="text"
              placeholder={`Search ${subTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-56 pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white border border-[rgba(45,45,45,0.12)] focus:outline-none focus:border-[#C79A3B] text-[#1C1C1C]"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="p-12 text-center text-[#707070] text-xs flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-[#C79A3B]" />
          <span>Synchronizing live inventory records from Neon PostgreSQL...</span>
        </div>
      ) : (
        <div>
          {/* SUBTAB 1: Live Balances */}
          {subTab === 'stock-counts' && (
            <StockCountReviewWorkspace />
          )}

          {subTab === 'balances' && (
            <div className="space-y-4">
              {filteredBalances.length === 0 ? (
                <div className="p-8 text-center bg-white/50 rounded-2xl border border-[rgba(45,45,45,0.08)] text-xs text-[#707070]">
                  No stock balance records found matching current filter.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredBalances.map((b) => (
                    <div
                      key={b.id}
                      className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm hover:border-[#C79A3B]/40 transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-[#1C1C1C] font-['Outfit']">{b.item_name || 'SKU Item'}</h4>
                          <p className="text-[11px] font-mono text-[#707070] mt-0.5">{b.item_code}</p>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            b.is_low_stock
                              ? 'bg-[#D9534F]/10 text-[#D9534F] border border-[#D9534F]/30 animate-pulse'
                              : 'bg-[#2E8B57]/10 text-[#2E8B57] border border-[#2E8B57]/30'
                          }`}
                        >
                          {b.is_low_stock ? 'LOW STOCK' : 'IN STOCK'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] flex items-center justify-between font-mono">
                        <div>
                          <p className="text-[10px] text-[#707070]">Available Quantity</p>
                          <p className="text-base font-bold text-[#1C1C1C]">
                            {Number(b.quantity).toFixed(2)} {b.unit_symbol || 'units'}
                          </p>
                        </div>
                        <div className="text-right text-[10px] text-[#707070]">
                          <p>Min: {b.min_stock_level ? Number(b.min_stock_level).toFixed(1) : '-'}</p>
                          <p>Reorder: {b.reorder_qty ? Number(b.reorder_qty).toFixed(1) : '-'}</p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[rgba(45,45,45,0.06)] flex items-center justify-between text-[11px] text-[#707070]">
                        <span className="truncate max-w-[170px] flex items-center gap-1">
                          <WarehouseIcon className="w-3 h-3 text-[#3978B8]" />
                          {b.warehouse_name || 'Storage Hub'}
                        </span>
                        <button
                          onClick={() => {
                            setAdjustmentForm({
                              warehouse_id: b.warehouse_id,
                              item_id: b.item_id,
                              change_qty: 0,
                              reason_code: 'CYCLE_COUNT_ADJUSTMENT',
                              notes: '',
                            });
                            setShowAdjustmentModal(true);
                          }}
                          className="text-[10px] font-bold text-[#C79A3B] hover:text-[#B8862D] underline"
                        >
                          Adjust
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SUBTAB: Stock Alerts */}
          {subTab === 'alerts' && (
            <div className="space-y-3">
              {lowStockAlerts.filter((a) => !selectedWarehouseId || a.warehouse_id === selectedWarehouseId).length === 0 ? (
                <div className="p-8 text-center bg-white/50 rounded-2xl border border-[rgba(45,45,45,0.08)] text-xs text-[#2E8B57]">No active low-stock alerts.</div>
              ) : (
                lowStockAlerts.filter((a) => !selectedWarehouseId || a.warehouse_id === selectedWarehouseId).map((a) => (
                  <div key={`${a.warehouse_id}-${a.item_id}`} className="p-4 rounded-2xl bg-white border border-[#D99625]/30 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div><p className="font-bold text-sm">{a.item_name}</p><p className="text-[10px] text-[#707070]">{a.item_code} · {a.warehouse_name}</p></div>
                    <div className="flex items-center gap-4 text-xs font-mono"><span>Now {Number(a.current_quantity).toFixed(2)}</span><span>Min {Number(a.min_stock_level).toFixed(2)}</span><span className="font-bold text-[#D9534F]">Short {Number(a.shortage).toFixed(2)} {a.unit_symbol || ''}</span></div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* SUBTAB: Reorder Queue */}
          {subTab === 'reorder' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] flex items-center justify-between"><div><p className="text-xs text-[#707070]">Recommended replenishment</p><p className="text-xl font-bold">{filteredReorder.length} items</p></div><p className="font-mono font-bold text-[#B8862D]">Est. ₹{reorderCost.toFixed(2)}</p></div>
              {filteredReorder.filter((r) => !selectedWarehouseId || r.warehouse_id === selectedWarehouseId).map((r) => (
                <div key={`${r.warehouse_id}-${r.item_id}`} className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
                  <div><p className="font-bold text-sm">{r.item_name}</p><p className="text-[10px] text-[#707070]">{r.item_code} · {r.warehouse_name}</p></div>
                  <div className="text-xs font-mono">Current: <b>{Number(r.current_stock).toFixed(2)}</b> / Min: {Number(r.min_stock_level).toFixed(2)}</div>
                  <div className="text-xs font-mono">Suggested: <b>{Number(r.suggested_order_qty).toFixed(2)} {r.unit_symbol || ''}</b></div>
                  <div className="text-right"><span className={`text-[10px] font-bold px-2 py-1 rounded-full ${r.urgency_level === 'CRITICAL' ? 'bg-[#D9534F]/10 text-[#D9534F]' : r.urgency_level === 'HIGH' ? 'bg-[#D99625]/10 text-[#D99625]' : 'bg-[#3978B8]/10 text-[#3978B8]'}`}>{r.urgency_level}</span><p className="text-[10px] text-[#707070] mt-1">₹{Number(r.estimated_total_cost).toFixed(2)}</p></div>
                </div>
              ))}
            </div>
          )}

          {/* SUBTAB: Stock History */}
          {subTab === 'ledger' && (
            <div className="space-y-2">
              {filteredLedger.filter((e) => !selectedWarehouseId || e.warehouse_id === selectedWarehouseId).map((e) => (
                <div key={e.id} className="p-3 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] grid grid-cols-1 sm:grid-cols-5 gap-2 items-center text-xs">
                  <div><p className="font-bold">{e.item_name || e.item_id}</p><p className="text-[10px] text-[#707070]">{e.item_code || ''}</p></div>
                  <div className="text-[#707070]">{e.warehouse_name || e.warehouse_id}</div>
                  <div><span className="font-bold">{e.movement_type}</span><p className="text-[10px] text-[#707070]">{e.reference_type || 'Inventory'}</p></div>
                  <div className={`font-mono font-bold ${Number(e.change_qty) < 0 ? 'text-[#D9534F]' : 'text-[#2E8B57]'}`}>{Number(e.change_qty) > 0 ? '+' : ''}{Number(e.change_qty).toFixed(2)} {e.unit_symbol || ''}<p className="text-[10px] text-[#707070] font-normal">Balance {Number(e.balance_qty).toFixed(2)}</p></div>
                  <div className="text-right text-[10px] text-[#707070]">{e.created_at ? new Date(e.created_at).toLocaleString() : '—'}<br/>{e.created_by_name || e.user_name || ''}</div>
                </div>
              ))}
            </div>
          )}

          {/* SUBTAB 2: Items Catalogue */}
          {subTab === 'items' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((it) => (
                <div
                  key={it.id}
                  className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm hover:border-[#3978B8]/40 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-[#1C1C1C] font-['Outfit']">{it.name}</h4>
                      <p className="text-[11px] font-mono text-[#B8862D] mt-0.5">[{it.code}]</p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FAF8F5] text-[#707070] border border-[rgba(45,45,45,0.12)]">
                      {it.type}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 rounded-lg bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)]">
                      <span className="text-[10px] text-[#707070] block">Cost Price</span>
                      <span className="font-bold text-[#1C1C1C]">${Number(it.cost_price).toFixed(2)}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)]">
                      <span className="text-[10px] text-[#707070] block">Selling Price</span>
                      <span className="font-bold text-[#2E8B57]">${Number(it.selling_price).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[rgba(45,45,45,0.06)] flex items-center justify-between text-[10px] text-[#707070]">
                    <span>Category: {it.category_name || 'General'}</span>
                    <span className="font-mono">Unit: {it.unit_symbol || 'pcs'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SUBTAB 3: Stock Transfers */}
          {subTab === 'transfers' && (
            <div className="space-y-4">
              {filteredTransfers.length === 0 ? (
                <div className="p-8 text-center bg-white/50 rounded-2xl border border-[rgba(45,45,45,0.08)] text-xs text-[#707070]">
                  No inter-outlet transfer logs found.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredTransfers.map((tr) => (
                    <div
                      key={tr.id}
                      className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-mono font-bold text-xs text-[#1C1C1C]">{tr.transfer_number}</span>
                          <p className="text-[10px] text-[#707070] mt-0.5">{new Date(tr.transfer_date).toLocaleDateString()}</p>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            tr.status === 'COMPLETED'
                              ? 'bg-[#2E8B57]/10 text-[#2E8B57] border border-[#2E8B57]/30'
                              : tr.status === 'DISPATCHED'
                              ? 'bg-[#3978B8]/10 text-[#3978B8] border border-[#3978B8]/30'
                              : 'bg-[#D99625]/10 text-[#D99625] border border-[#D99625]/30'
                          }`}
                        >
                          {tr.status}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] flex items-center justify-between text-xs">
                        <div className="truncate max-w-[45%]">
                          <p className="text-[10px] text-[#707070]">From Warehouse</p>
                          <p className="font-semibold text-[#1C1C1C] truncate">{tr.from_warehouse_name || 'Origin'}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-[#C79A3B] shrink-0" />
                        <div className="truncate max-w-[45%] text-right">
                          <p className="text-[10px] text-[#707070]">To Destination</p>
                          <p className="font-semibold text-[#1C1C1C] truncate">{tr.to_warehouse_name || 'Destination'}</p>
                        </div>
                      </div>

                      {tr.items && tr.items.length > 0 && (
                        <div className="text-[11px] text-[#707070] space-y-1">
                          <span className="font-medium text-[#1C1C1C]">Manifest Line Items ({tr.items.length}):</span>
                          {tr.items.slice(0, 2).map((item, idx) => (
                            <div key={idx} className="flex justify-between text-[10px] font-mono">
                              <span>{item.item_name || 'Product'}</span>
                              <span>{Number(item.quantity).toFixed(2)} {item.unit_symbol || 'units'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SUBTAB 4: Categories & Units */}
          {subTab === 'categories' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Categories */}
              <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-3">
                <h4 className="font-bold text-sm text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
                  <Tags className="w-4 h-4 text-[#C79A3B]" />
                  Material Categories ({categories.length})
                </h4>
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {categories.map((c) => (
                    <div
                      key={c.id}
                      className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-[#1C1C1C]">{c.name}</span>
                        <span className="font-mono text-[10px] text-[#707070] ml-2">[{c.code}]</span>
                      </div>
                      <span className="text-[10px] text-[#707070]">UUID: {c.id.slice(0, 6)}...</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Units of Measure */}
              <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-3">
                <h4 className="font-bold text-sm text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#3978B8]" />
                  Units of Measure ({units.length})
                </h4>
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {units.map((u) => (
                    <div
                      key={u.id}
                      className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-[#1C1C1C]">{u.name}</span>
                        <span className="font-mono text-[10px] text-[#3978B8] font-bold ml-2">({u.symbol})</span>
                      </div>
                      <span className="text-[10px] text-[#707070]">UUID: {u.id.slice(0, 6)}...</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: New Item */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-[rgba(45,45,45,0.12)] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[rgba(45,45,45,0.08)] pb-3">
              <h3 className="font-bold text-base text-[#1C1C1C] font-['Outfit']">Create New Master Item</h3>
              <button onClick={() => setShowItemModal(false)} className="text-[#707070] hover:text-[#1C1C1C] text-sm font-bold">
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateItem} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#707070] font-semibold mb-1">Item Name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Organic Almond Flour"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#707070] font-semibold mb-1">SKU / Item Code *</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. RAW-ALM-01"
                    value={itemForm.code}
                    onChange={(e) => setItemForm({ ...itemForm, code: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                  />
                </div>
                <div>
                  <label className="block text-[#707070] font-semibold mb-1">Item Type *</label>
                  <select
                    value={itemForm.type}
                    onChange={(e) => setItemForm({ ...itemForm, type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                  >
                    <option value="RAW_MATERIAL">Raw Material</option>
                    <option value="FINISHED_GOOD">Finished Good</option>
                    <option value="SEMI_FINISHED">Semi Finished / Prep</option>
                    <option value="PACKAGING">Packaging</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#707070] font-semibold mb-1">Category *</label>
                  <select
                    required
                    value={itemForm.category_id}
                    onChange={(e) => setItemForm({ ...itemForm, category_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} [{c.code}]
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#707070] font-semibold mb-1">Unit of Measure *</label>
                  <select
                    required
                    value={itemForm.unit_id}
                    onChange={(e) => setItemForm({ ...itemForm, unit_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.symbol})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#707070] font-semibold mb-1">Cost Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={itemForm.cost_price}
                    onChange={(e) => setItemForm({ ...itemForm, cost_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                  />
                </div>
                <div>
                  <label className="block text-[#707070] font-semibold mb-1">Selling Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={itemForm.selling_price}
                    onChange={(e) => setItemForm({ ...itemForm, selling_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#707070] font-semibold mb-1">Min Stock Level</label>
                  <input
                    type="number"
                    value={itemForm.min_stock_level}
                    onChange={(e) => setItemForm({ ...itemForm, min_stock_level: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                  />
                </div>
                <div>
                  <label className="block text-[#707070] font-semibold mb-1">Reorder Quantity</label>
                  <input
                    type="number"
                    value={itemForm.reorder_qty}
                    onChange={(e) => setItemForm({ ...itemForm, reorder_qty: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 rounded-xl border border-[rgba(45,45,45,0.15)] text-[#707070] hover:bg-[#FAF8F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-[#C79A3B] hover:bg-[#B8862D] text-white font-semibold disabled:opacity-60"
                >
                  {actionLoading ? 'Saving...' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Inter-Outlet Transfer */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-[rgba(45,45,45,0.12)] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[rgba(45,45,45,0.08)] pb-3">
              <h3 className="font-bold text-base text-[#1C1C1C] font-['Outfit']">Dispatch Inter-Outlet Transfer</h3>
              <button onClick={() => setShowTransferModal(false)} className="text-[#707070] hover:text-[#1C1C1C] text-sm font-bold">
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateTransfer} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#707070] font-semibold mb-1">Origin Warehouse *</label>
                  <select
                    required
                    value={transferForm.from_warehouse_id}
                    onChange={(e) => setTransferForm({ ...transferForm, from_warehouse_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} [{w.code}]
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#707070] font-semibold mb-1">Destination Warehouse *</label>
                  <select
                    required
                    value={transferForm.to_warehouse_id}
                    onChange={(e) => setTransferForm({ ...transferForm, to_warehouse_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} [{w.code}]
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#707070] font-semibold mb-1">Select Item to Transfer *</label>
                <select
                  required
                  value={transferForm.items[0]?.item_id}
                  onChange={(e) =>
                    setTransferForm({
                      ...transferForm,
                      items: [{ ...transferForm.items[0], item_id: e.target.value }],
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                >
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} [{it.code}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#707070] font-semibold mb-1">Dispatch Quantity *</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={transferForm.items[0]?.quantity || 1}
                  onChange={(e) =>
                    setTransferForm({
                      ...transferForm,
                      items: [{ ...transferForm.items[0], quantity: parseFloat(e.target.value) || 1 }],
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                />
              </div>

              <div>
                <label className="block text-[#707070] font-semibold mb-1">Notes / Dispatch Instructions</label>
                <input
                  type="text"
                  placeholder="e.g. Daily bakery replenishment"
                  value={transferForm.notes || ''}
                  onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 rounded-xl border border-[rgba(45,45,45,0.15)] text-[#707070] hover:bg-[#FAF8F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-[#3978B8] hover:bg-[#3978B8]/90 text-white font-semibold disabled:opacity-60"
                >
                  {actionLoading ? 'Dispatching...' : 'Dispatch Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Direct Stock Adjustment */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-[rgba(45,45,45,0.12)] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[rgba(45,45,45,0.08)] pb-3">
              <h3 className="font-bold text-base text-[#1C1C1C] font-['Outfit']">Direct Stock Adjustment</h3>
              <button onClick={() => setShowAdjustmentModal(false)} className="text-[#707070] hover:text-[#1C1C1C] text-sm font-bold">
                ✕
              </button>
            </div>
            <form onSubmit={handleAdjustStock} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#707070] font-semibold mb-1">Target Warehouse *</label>
                  <select
                    required
                    value={adjustmentForm.warehouse_id}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, warehouse_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} [{w.code}]
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#707070] font-semibold mb-1">Target Item *</label>
                  <select
                    required
                    value={adjustmentForm.item_id}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, item_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                  >
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name} [{it.code}]
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#707070] font-semibold mb-1">
                  Adjustment Quantity (+ to add, - to deduct) *
                </label>
                <input
                  required
                  type="number"
                  step="0.01"
                  placeholder="e.g. +50 or -10"
                  value={adjustmentForm.change_qty}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, change_qty: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                />
              </div>

              <div>
                <label className="block text-[#707070] font-semibold mb-1">Reason Code *</label>
                <select
                  required
                  value={adjustmentForm.reason_code}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason_code: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                >
                  <option value="CYCLE_COUNT_ADJUSTMENT">Cycle Count Adjustment</option>
                  <option value="OPENING_BALANCE">Opening Balance</option>
                  <option value="SPOILAGE">Spoilage / Wastage</option>
                  <option value="THEFT_LOSS">Theft / Loss</option>
                  <option value="DAMAGE">Damage</option>
                  <option value="SUPPLIER_RETURN">Supplier Return</option>
                  <option value="INTERNAL_TRANSFER">Internal Transfer</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustmentModal(false)}
                  className="px-4 py-2 rounded-xl border border-[rgba(45,45,45,0.15)] text-[#707070] hover:bg-[#FAF8F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-[#2E8B57] hover:bg-[#2E8B57]/90 text-white font-semibold disabled:opacity-60"
                >
                  {actionLoading ? 'Updating...' : 'Post Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Category */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-[rgba(45,45,45,0.12)] space-y-4">
            <div className="flex items-center justify-between border-b border-[rgba(45,45,45,0.08)] pb-3">
              <h3 className="font-bold text-base text-[#1C1C1C] font-['Outfit']">New Material Category</h3>
              <button onClick={() => setShowCategoryModal(false)} className="text-[#707070] hover:text-[#1C1C1C] text-sm font-bold">
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateCategory} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#707070] font-semibold mb-1">Category Name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Dairy & Cheeses"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                />
              </div>
              <div>
                <label className="block text-[#707070] font-semibold mb-1">Category Code *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. CAT-DAIRY"
                  value={categoryForm.code}
                  onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 rounded-xl border border-[rgba(45,45,45,0.15)] text-[#707070] hover:bg-[#FAF8F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-[#C79A3B] hover:bg-[#B8862D] text-white font-semibold disabled:opacity-60"
                >
                  {actionLoading ? 'Creating...' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Unit */}
      {showUnitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-[rgba(45,45,45,0.12)] space-y-4">
            <div className="flex items-center justify-between border-b border-[rgba(45,45,45,0.08)] pb-3">
              <h3 className="font-bold text-base text-[#1C1C1C] font-['Outfit']">New Unit of Measure</h3>
              <button onClick={() => setShowUnitModal(false)} className="text-[#707070] hover:text-[#1C1C1C] text-sm font-bold">
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateUnit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#707070] font-semibold mb-1">Unit Name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Kilogram"
                  value={unitForm.name}
                  onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                />
              </div>
              <div>
                <label className="block text-[#707070] font-semibold mb-1">Unit Symbol *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. kg"
                  value={unitForm.symbol}
                  onChange={(e) => setUnitForm({ ...unitForm, symbol: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUnitModal(false)}
                  className="px-4 py-2 rounded-xl border border-[rgba(45,45,45,0.15)] text-[#707070] hover:bg-[#FAF8F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-[#C79A3B] hover:bg-[#B8862D] text-white font-semibold disabled:opacity-60"
                >
                  {actionLoading ? 'Creating...' : 'Create Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


type OutletStockScope = {
  id: string;
  code?: string;
  name?: string;
  type?: string;
};

const STOCK_COUNT_REVIEW_ROLES = new Set([
  'SUPER_ADMIN',
  'SUPERADMIN',
  'OWNER',
  'ADMIN',
  'HQ_ADMIN',
  'HEAD_OFFICE_ADMIN',
  'CENTRAL_PURCHASE_MANAGER',
  'CENTRAL_STORE_MANAGER',
  'GENERAL_MANAGER',
  'DIRECTOR',
]);

const getRoleName = (user: any): string => {
  const raw = typeof user?.role === 'object' ? user?.role?.name : user?.role;
  return String(raw || '').trim().toUpperCase();
};

const moneyINR = (value: number) =>
  `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatQty = (value: number) =>
  Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 3,
  });

const countDateInPeriod = (dateValue: string | undefined, start: string, end: string) => {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  const startDate = new Date(start);
  const endDate = new Date(end);
  return date >= startDate && date <= endDate;
};

const getApiError = (error: any, fallback: string) =>
  error?.response?.data?.detail ||
  error?.response?.data?.message ||
  error?.message ||
  fallback;

interface OutletStockWorkspaceProps {
  outlet: OutletStockScope;
}

const OutletStockWorkspace: React.FC<OutletStockWorkspaceProps> = ({ outlet }) => {
  const { user } = useAuth();
  const closingInfo = getCurrentClosingPeriod();
  const isSaltLakeKitchen =
    String(outlet.code || '').toUpperCase() === 'BB-01' ||
    String(outlet.name || '').toLowerCase().includes('salt lake');

  const [activeTab, setActiveTab] = useState<'stock' | 'count'>('stock');
  const [balances, setBalances] = useState<any[]>([]);
  const [itemCosts, setItemCosts] = useState<Record<string, number>>({});
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [stockCount, setStockCount] = useState<StockCount | null>(null);
  const [physicalQty, setPhysicalQty] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [countLoading, setCountLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const roleName = getRoleName(user);
  const canReview = STOCK_COUNT_REVIEW_ROLES.has(roleName);

  const loadStock = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [branchWarehouses, itemData] = await Promise.all([
        inventoryApi.getWarehouses({ branch_id: outlet.id }),
        inventoryApi.getItems(),
      ]);
      setWarehouses(branchWarehouses || []);
      const costMap: Record<string, number> = {};
      (itemData || []).forEach((item: any) => {
        costMap[String(item.id)] = Number(item.cost_price || 0);
      });
      setItemCosts(costMap);

      const selected = branchWarehouses?.[0];
      const nextWarehouseId = selected?.id || '';
      setWarehouseId(nextWarehouseId);

      if (!nextWarehouseId) {
        setBalances([]);
        return;
      }

      const data = await inventoryApi.getStockBalances({ warehouse_id: nextWarehouseId });
      setBalances(data || []);
    } catch (error: any) {
      setMessage({ type: 'error', text: getApiError(error, 'Stock could not be loaded.') });
      setBalances([]);
    } finally {
      setLoading(false);
    }
  }, [outlet.id]);

  const loadCount = useCallback(async () => {
    if (!warehouseId) {
      setStockCount(null);
      setPhysicalQty({});
      return;
    }

    setCountLoading(true);
    try {
      const counts = await inventoryApi.getStockCounts({ warehouse_id: warehouseId });
      const periodCount = (counts || [])
        .filter((row) => countDateInPeriod(row.count_date, closingInfo.startDate, closingInfo.endDate))
        .sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')))[0];

      setStockCount(periodCount || null);

      if (periodCount?.items?.length) {
        const nextPhysical: Record<string, string> = {};
        periodCount.items.forEach((item) => {
          nextPhysical[item.item_id] = String(item.physical_qty ?? '');
        });
        setPhysicalQty(nextPhysical);
      } else {
        setPhysicalQty({});
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: getApiError(error, 'Stock count could not be loaded.') });
    } finally {
      setCountLoading(false);
    }
  }, [warehouseId, closingInfo.startDate, closingInfo.endDate]);

  useEffect(() => {
    loadStock();
  }, [loadStock]);

  useEffect(() => {
    if (activeTab === 'count') {
      loadCount();
    }
  }, [activeTab, loadCount]);

  const currentRows = balances.map((row: any) => ({
    ...row,
    quantityNumber: Number(row.quantity || 0),
    // Prefer the live stock average cost; fall back to Item Master cost so
    // amount/value never disappears when an older balance has zero cost.
    costNumber: Number(row.avg_unit_cost || row.unit_cost || itemCosts[String(row.item_id)] || 0),
  }));

  const filteredRows = currentRows.filter((row: any) =>
    `${row.item_name || ''} ${row.item_code || ''}`.toLowerCase().includes(search.toLowerCase()),
  );

  const totalQty = currentRows.reduce((sum, row) => sum + row.quantityNumber, 0);
  const stockValue = currentRows.reduce((sum, row) => sum + row.quantityNumber * row.costNumber, 0);
  const lowStockCount = currentRows.filter((row) => {
    const min = Number(row.min_stock_level || 0);
    return min > 0 && row.quantityNumber <= min;
  }).length;

  const countRows = stockCount?.items?.length
    ? stockCount.items.map((item) => ({
        item_id: item.item_id,
        item_name: item.item_name || 'Item',
        item_code: item.item_code || '',
        unit_symbol: item.unit_symbol || '',
        system_qty: Number(item.system_qty || 0),
        unit_cost: Number(item.unit_cost || currentRows.find((row) => String(row.item_id) === String(item.item_id))?.costNumber || 0),
      }))
    : currentRows.map((row) => ({
        item_id: String(row.item_id),
        item_name: row.item_name || 'Item',
        item_code: row.item_code || '',
        unit_symbol: row.unit_symbol || '',
        system_qty: row.quantityNumber,
        unit_cost: row.costNumber,
      }));

  const countLocked = stockCount?.status === 'IN_PROGRESS' || stockCount?.status === 'COMPLETED' || stockCount?.status === 'CANCELLED';
  const countCompleted = stockCount?.status === 'COMPLETED';
  const countPending = stockCount?.status === 'IN_PROGRESS';
  const countRejected = stockCount?.status === 'CANCELLED';

  const startCount = async () => {
    if (!warehouseId) {
      setMessage({ type: 'error', text: 'No stock warehouse is configured for this outlet.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const created = await inventoryApi.createStockCount({
        warehouse_id: warehouseId,
        branch_id: outlet.id,
        count_date: new Date().toISOString(),
        notes: `Bi-monthly stock count - ${closingInfo.label}`,
      });
      setStockCount(created);
      setPhysicalQty({});
      setMessage({ type: 'success', text: `Stock count ${created.count_number} started.` });
    } catch (error: any) {
      setMessage({ type: 'error', text: getApiError(error, 'Could not start stock count.') });
    } finally {
      setSaving(false);
    }
  };

  const submitCount = async () => {
    if (!stockCount) {
      await startCount();
      return;
    }

    const missing = countRows.some((row) => {
      const raw = physicalQty[row.item_id];
      return raw === undefined || raw.trim() === '' || Number(raw) < 0 || Number.isNaN(Number(raw));
    });

    if (missing) {
      setMessage({ type: 'error', text: 'Please enter physical quantity for every stock item before submitting.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const updated = await inventoryApi.submitStockCount(stockCount.id, {
        notes: `Submitted for ${closingInfo.label}`,
        items: countRows.map((row) => ({
          item_id: row.item_id,
          physical_qty: Number(physicalQty[row.item_id]),
          system_qty: row.system_qty,
          unit_cost: row.unit_cost,
        })),
      });
      setStockCount(updated);
      setMessage({ type: 'success', text: 'Stock count submitted for admin approval.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: getApiError(error, 'Stock count submission failed.') });
    } finally {
      setSaving(false);
    }
  };

  const reviewApproval = async (approved: boolean) => {
    if (!stockCount || !canReview) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = approved
        ? await inventoryApi.approveStockCount(stockCount.id, `Approved for ${closingInfo.label}`)
        : await inventoryApi.rejectStockCount(stockCount.id, 'Stock count rejected by admin. Please recount and resubmit.');
      setStockCount(result);
      setMessage({
        type: approved ? 'success' : 'error',
        text: approved ? 'Stock count approved, reconciled and locked.' : 'Stock count rejected. A new count can be started.',
      });
      await loadStock();
    } catch (error: any) {
      setMessage({ type: 'error', text: getApiError(error, approved ? 'Approval failed.' : 'Rejection failed.') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-5 text-[#1C1C1C] min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.16em] font-bold text-[#B8862D]">Outlet Stock</p>
          <h1 className="mt-1 text-xl sm:text-3xl font-bold font-['Outfit'] truncate">{outlet.name || 'Outlet'} — Stock</h1>
          <p className="mt-1 text-xs sm:text-sm text-[#707070] leading-5">Live stock for this outlet.</p>
        </div>
        <button
          type="button"
          onClick={() => activeTab === 'stock' ? loadStock() : loadCount()}
          disabled={loading || countLoading}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-white border border-[rgba(45,45,45,0.12)] text-xs font-bold hover:bg-[#FAF8F5] disabled:opacity-60 active:scale-[0.98] transition"
        >
          <RefreshCw className={`w-4 h-4 ${(loading || countLoading) ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="rounded-2xl border border-[rgba(45,45,45,0.08)] bg-white p-3 sm:p-4 min-w-0">
          <p className="text-[11px] sm:text-xs text-[#707070]">Items</p>
          <p className="mt-1 text-xl sm:text-2xl font-bold font-['Outfit']">{currentRows.length}</p>
        </div>
        <div className="rounded-2xl border border-[rgba(45,45,45,0.08)] bg-white p-3 sm:p-4 min-w-0">
          <p className="text-[11px] sm:text-xs text-[#707070]">Total Qty</p>
          <p className="mt-1 text-xl sm:text-2xl font-bold font-['Outfit'] truncate">{formatQty(totalQty)}</p>
        </div>
        <div className="rounded-2xl border border-[rgba(45,45,45,0.08)] bg-white p-3 sm:p-4 min-w-0">
          <p className="text-[11px] sm:text-xs text-[#707070]">Stock Value</p>
          <p className="mt-1 text-xl sm:text-2xl font-bold font-['Outfit'] truncate">{moneyINR(stockValue)}</p>
        </div>
        <div className={`rounded-2xl border p-3 sm:p-4 min-w-0 ${lowStockCount ? 'bg-[#FFF7E8] border-[#D99625]/30' : 'bg-white border-[rgba(45,45,45,0.08)]'}`}>
          <p className="text-[11px] sm:text-xs text-[#707070]">Low Stock</p>
          <p className="mt-1 text-xl sm:text-2xl font-bold font-['Outfit']">{lowStockCount}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[rgba(45,45,45,0.08)] overflow-x-auto scrollbar-hide">
        <button
          type="button"
          onClick={() => setActiveTab('stock')}
          className={`shrink-0 px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-bold border-b-2 transition-colors ${activeTab === 'stock' ? 'border-[#C79A3B] text-[#B8862D]' : 'border-transparent text-[#707070]'}`}
        >
          Current Stock
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('count')}
          className={`shrink-0 px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-bold border-b-2 transition-colors ${activeTab === 'count' ? 'border-[#C79A3B] text-[#B8862D]' : 'border-transparent text-[#707070]'}`}
        >
          Stock Count
        </button>
        {isSaltLakeKitchen && (
          <div className="ml-auto hidden sm:flex shrink-0 items-center gap-2 text-[11px] font-bold text-[#3978B8]">
            <ClipboardCheck className="w-4 h-4" /> Kitchen Operations enabled for BB-01
          </div>
        )}
      </div>

      {message && (
        <div className={`rounded-xl border px-3.5 py-3 text-xs sm:text-sm leading-5 ${message.type === 'success' ? 'bg-[#2E8B57]/10 border-[#2E8B57]/30 text-[#2E8B57]' : 'bg-[#D9534F]/10 border-[#D9534F]/30 text-[#D9534F]'}`}>
          {message.text}
        </div>
      )}

      {/* CURRENT STOCK */}
      {activeTab === 'stock' && (
        <section className="rounded-2xl border border-[rgba(45,45,45,0.08)] bg-white overflow-hidden">
          <div className="p-3.5 sm:p-5 border-b border-[rgba(45,45,45,0.08)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold">Current Stock</h2>
                <p className="text-xs text-[#707070] mt-1">{outlet.name || 'This outlet'} stock</p>
              </div>
              <div className="sm:hidden shrink-0 rounded-lg bg-[#FAF8F5] px-2.5 py-1.5 text-[10px] font-semibold text-[#707070]">
                {filteredRows.length} items
              </div>
            </div>
            <div className="relative w-full mt-3">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search item / code"
                className="w-full pl-10 pr-3.5 py-3 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)] outline-none text-sm focus:border-[#C79A3B] transition"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-[#707070]">
              <RefreshCw className="w-6 h-6 animate-spin text-[#C79A3B]" />
              <p className="text-sm">Loading outlet stock…</p>
            </div>
          ) : !warehouseId ? (
            <div className="py-16 px-5 text-center text-sm text-[#707070]">No active stock warehouse is configured for this outlet.</div>
          ) : filteredRows.length === 0 ? (
            <div className="py-16 px-5 text-center text-sm text-[#707070]">No stock items found.</div>
          ) : (
            <>
              {/* Mobile: card layout — no horizontal scrolling */}
              <div className="sm:hidden divide-y divide-[rgba(45,45,45,0.07)]">
                {filteredRows.map((row) => {
                  const min = Number(row.min_stock_level || 0);
                  const isLow = min > 0 && row.quantityNumber <= min;
                  const value = row.quantityNumber * row.costNumber;
                  return (
                    <div key={row.id} className="p-3.5 active:bg-[#FAF8F5]/70 transition">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm leading-5 break-words">{row.item_name || 'Unnamed item'}</div>
                          <div className="mt-0.5 text-[11px] text-[#707070] font-mono break-all">
                            {row.item_code || '—'} <span className="font-sans">·</span> {row.unit_symbol || 'UNIT'}
                          </div>
                        </div>
                        <span className={`shrink-0 inline-flex px-2 py-1 rounded-full text-[9px] font-bold ${isLow ? 'bg-[#D99625]/10 text-[#A96B00]' : 'bg-[#2E8B57]/10 text-[#2E8B57]'}`}>
                          {isLow ? 'LOW' : 'OK'}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] p-2.5 min-w-0">
                          <p className="text-[9px] uppercase tracking-wide text-[#888]">Qty</p>
                          <p className="mt-0.5 text-sm font-bold truncate">{formatQty(row.quantityNumber)}</p>
                        </div>
                        <div className="rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] p-2.5 min-w-0">
                          <p className="text-[9px] uppercase tracking-wide text-[#888]">Cost</p>
                          <p className="mt-0.5 text-sm font-semibold truncate">{moneyINR(row.costNumber)}</p>
                        </div>
                        <div className="rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] p-2.5 min-w-0">
                          <p className="text-[9px] uppercase tracking-wide text-[#888]">Value</p>
                          <p className="mt-0.5 text-sm font-bold truncate">{moneyINR(value)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop/tablet: full table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#FAF8F5] text-[10px] uppercase tracking-wider text-[#707070]">
                    <tr>
                      <th className="px-4 py-3 text-left">Item</th>
                      <th className="px-4 py-3 text-left">Code</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3 text-right">Unit Cost</th>
                      <th className="px-4 py-3 text-right">Value</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
                    {filteredRows.map((row) => {
                      const min = Number(row.min_stock_level || 0);
                      const isLow = min > 0 && row.quantityNumber <= min;
                      return (
                        <tr key={row.id} className="hover:bg-[#FAF8F5]/70">
                          <td className="px-4 py-3">
                            <div className="font-semibold">{row.item_name || 'Unnamed item'}</div>
                            <div className="text-[11px] text-[#707070]">{row.unit_symbol || 'UNIT'}</div>
                          </td>
                          <td className="px-4 py-3 text-[#707070]">{row.item_code || '—'}</td>
                          <td className="px-4 py-3 text-right font-semibold">{formatQty(row.quantityNumber)}</td>
                          <td className="px-4 py-3 text-right">{moneyINR(row.costNumber)}</td>
                          <td className="px-4 py-3 text-right font-semibold">{moneyINR(row.quantityNumber * row.costNumber)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex px-2 py-1 rounded-full text-[10px] font-bold ${isLow ? 'bg-[#D99625]/10 text-[#A96B00]' : 'bg-[#2E8B57]/10 text-[#2E8B57]'}`}>
                              {isLow ? 'LOW' : 'OK'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {/* STOCK COUNT */}
      {activeTab === 'count' && (
        <section className="rounded-2xl border border-[rgba(45,45,45,0.08)] bg-white overflow-hidden">
          <div className="p-3.5 sm:p-5 border-b border-[rgba(45,45,45,0.08)]">
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.16em] font-bold text-[#B8862D]">Physical Count</p>
                <h2 className="mt-1 text-base sm:text-lg font-bold">{closingInfo.label}</h2>
                <p className="text-xs text-[#707070] mt-1 leading-5">Physical stock → submit → admin review → approved = verified & locked.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(!stockCount || countRejected) && (
                  <button
                    type="button"
                    onClick={startCount}
                    disabled={saving || !warehouseId}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#C79A3B] text-white text-xs font-bold hover:bg-[#B8862D] disabled:opacity-60 active:scale-[0.98] transition"
                  >
                    <ClipboardCheck className="w-4 h-4" /> {countRejected ? 'Start New Count' : 'Start Count'}
                  </button>
                )}
                {stockCount && stockCount.status === 'DRAFT' && (
                  <button
                    type="button"
                    onClick={submitCount}
                    disabled={saving || countLoading}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#2E8B57] text-white text-xs font-bold hover:bg-[#257348] disabled:opacity-60 active:scale-[0.98] transition"
                  >
                    <Send className="w-4 h-4" /> Submit Count
                  </button>
                )}
                {stockCount && countPending && canReview && (
                  <div className="w-full sm:w-auto grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => reviewApproval(true)}
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#2E8B57] text-white text-xs font-bold disabled:opacity-60 active:scale-[0.98] transition"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => reviewApproval(false)}
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#D9534F] text-white text-xs font-bold disabled:opacity-60 active:scale-[0.98] transition"
                    >
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {countLoading ? (
            <div className="py-16 flex items-center justify-center text-[#707070] gap-3 px-5 text-sm">
              <RefreshCw className="w-5 h-5 animate-spin text-[#C79A3B]" /> Loading count…
            </div>
          ) : stockCount?.status === 'IN_PROGRESS' ? (
            <div className="px-3.5 py-3 bg-[#3978B8]/10 border-b border-[#3978B8]/20 text-xs text-[#245E93] font-medium flex items-start gap-2 leading-5">
              <ClipboardCheck className="w-4 h-4 shrink-0 mt-0.5" /> Submitted and waiting for admin review.
            </div>
          ) : countCompleted ? (
            <div className="px-3.5 py-3 bg-[#2E8B57]/10 border-b border-[#2E8B57]/20 text-xs text-[#2E8B57] font-medium flex items-start gap-2 leading-5">
              <LockKeyhole className="w-4 h-4 shrink-0 mt-0.5" /> Approved, verified and locked. Stock ledger has been reconciled to physical quantity.
            </div>
          ) : countRejected ? (
            <div className="px-3.5 py-3 bg-[#D9534F]/10 border-b border-[#D9534F]/20 text-xs text-[#A93F3A] font-medium flex items-start gap-2 leading-5">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" /> Rejected. Start a new count for this period after recounting physical stock.
            </div>
          ) : null}

          {!stockCount && (
            <div className="px-4 py-10 sm:px-8 text-center text-sm text-[#707070]">
              No stock count has been started for this period.
            </div>
          )}

          {stockCount && (
            <>
              {/* Mobile count cards */}
              <div className="sm:hidden divide-y divide-[rgba(45,45,45,0.07)]">
                {countRows.map((row) => {
                  const raw = physicalQty[row.item_id];
                  const physical = raw === undefined || raw === '' ? null : Number(raw);
                  const variance = physical === null ? 0 : physical - row.system_qty;
                  const varianceValue = variance * row.unit_cost;
                  const varianceClass = variance > 0 ? 'text-[#2E8B57]' : variance < 0 ? 'text-[#D9534F]' : 'text-[#707070]';
                  return (
                    <div key={row.item_id} className="p-3.5 bg-white">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm leading-5 break-words">{row.item_name}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-[#707070]">
                            <span className="font-mono break-all">{row.item_code || '—'}</span>
                            <span className="inline-flex items-center rounded-full bg-[#C79A3B]/10 border border-[#C79A3B]/20 px-2 py-0.5 font-bold text-[#9A741F]">
                              UNIT: {row.unit_symbol || 'UNIT'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)] p-2.5">
                          <p className="text-[9px] uppercase tracking-wide text-[#888]">System Qty</p>
                          <p className="mt-1 text-sm font-bold text-[#1C1C1C]">{formatQty(row.system_qty)} <span className="text-[10px] font-medium text-[#707070]">{row.unit_symbol || 'UNIT'}</span></p>
                        </div>
                        <div className="rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)] p-2.5">
                          <label className="block text-[9px] uppercase tracking-wide text-[#888] mb-1">Physical Qty</label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              inputMode="decimal"
                              value={raw ?? ''}
                              disabled={countLocked || saving}
                              onChange={(e) => setPhysicalQty((prev) => ({ ...prev, [row.item_id]: e.target.value }))}
                              className="w-full min-w-0 px-2.5 py-2.5 rounded-lg bg-white border border-[rgba(45,45,45,0.14)] text-right text-base font-semibold outline-none focus:border-[#C79A3B] disabled:bg-[#F5F3EE] disabled:text-[#777]"
                            />
                            <span className="shrink-0 text-[10px] font-bold text-[#707070]">{row.unit_symbol || 'UNIT'}</span>
                          </div>
                        </div>
                        <div className="rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)] p-2.5">
                          <p className="text-[9px] uppercase tracking-wide text-[#888]">Variance</p>
                          <p className={`mt-1 text-sm font-bold ${varianceClass}`}>
                            {physical === null ? '—' : `${variance > 0 ? '+' : ''}${formatQty(variance)} ${row.unit_symbol || ''}`}
                          </p>
                        </div>
                        <div className="rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)] p-2.5">
                          <p className="text-[9px] uppercase tracking-wide text-[#888]">Variance Amount</p>
                          <p className={`mt-1 text-sm font-bold ${varianceClass}`}>
                            {physical === null ? '—' : moneyINR(varianceValue)}
                          </p>
                          <p className="mt-0.5 text-[9px] text-[#707070]">Cost {moneyINR(row.unit_cost)} / {row.unit_symbol || 'UNIT'}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop/tablet count table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#FAF8F5] text-[10px] uppercase tracking-wider text-[#707070]">
                    <tr>
                      <th className="px-4 py-3 text-left">Item / Unit</th>
                      <th className="px-4 py-3 text-right">System Qty</th>
                      <th className="px-4 py-3 text-right">Physical Qty</th>
                      <th className="px-4 py-3 text-right">Variance</th>
                      <th className="px-4 py-3 text-right">Variance Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
                    {countRows.map((row) => {
                      const raw = physicalQty[row.item_id];
                      const physical = raw === undefined || raw === '' ? null : Number(raw);
                      const variance = physical === null ? 0 : physical - row.system_qty;
                      const varianceValue = variance * row.unit_cost;
                      return (
                        <tr key={row.item_id}>
                          <td className="px-4 py-3">
                            <div className="font-semibold">{row.item_name}</div>
                            <div className="mt-1 flex items-center gap-2 text-[11px] text-[#707070]">
                              <span>{row.item_code || '—'}</span>
                              <span className="inline-flex rounded-full bg-[#C79A3B]/10 px-2 py-0.5 font-bold text-[#9A741F]">UNIT: {row.unit_symbol || 'UNIT'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">{formatQty(row.system_qty)} <span className="text-[10px] font-medium text-[#707070]">{row.unit_symbol || 'UNIT'}</span></td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              value={raw ?? ''}
                              disabled={countLocked || saving}
                              onChange={(e) => setPhysicalQty((prev) => ({ ...prev, [row.item_id]: e.target.value }))}
                              className="w-28 px-3 py-2 rounded-lg border border-[rgba(45,45,45,0.14)] text-right outline-none focus:border-[#C79A3B] disabled:bg-[#F5F3EE] disabled:text-[#777]"
                            />
                          </td>
                          <td className={`px-4 py-3 text-right font-semibold ${variance > 0 ? 'text-[#2E8B57]' : variance < 0 ? 'text-[#D9534F]' : 'text-[#707070]'}`}>
                            {physical === null ? '—' : `${variance > 0 ? '+' : ''}${formatQty(variance)}`}
                          </td>
                          <td className={`px-4 py-3 text-right ${varianceValue > 0 ? 'text-[#2E8B57]' : varianceValue < 0 ? 'text-[#D9534F]' : 'text-[#707070]'}`}>
                            <div className="font-semibold">{physical === null ? '—' : moneyINR(varianceValue)}</div>
                            <div className="text-[9px] text-[#888] mt-0.5">Cost {moneyINR(row.unit_cost)} / {row.unit_symbol || 'UNIT'}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
};

const StockCountReviewWorkspace: React.FC = () => {
  const [counts, setCounts] = useState<StockCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await inventoryApi.getStockCounts({ status: 'IN_PROGRESS', scope_all: true });
      setCounts(data || []);
    } catch (error: any) {
      setMessage(getApiError(error, 'Stock count review queue could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (count: StockCount, approve: boolean) => {
    setBusyId(count.id);
    setMessage('');
    try {
      if (approve) {
        await inventoryApi.approveStockCount(count.id, 'Approved from Stock Count Review');
      } else {
        await inventoryApi.rejectStockCount(count.id, 'Rejected from Stock Count Review');
      }
      await load();
      setMessage(approve ? `${count.count_number} approved and locked.` : `${count.count_number} rejected.`);
    } catch (error: any) {
      setMessage(getApiError(error, approve ? 'Approval failed.' : 'Rejection failed.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-[rgba(45,45,45,0.08)] bg-white overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-[rgba(45,45,45,0.08)] flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Pending Stock Count Review</h2>
          <p className="text-xs text-[#707070] mt-1">Approve to reconcile and lock; reject to send the outlet back for recount.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="p-2.5 rounded-xl border border-[rgba(45,45,45,0.12)] bg-white hover:bg-[#FAF8F5] disabled:opacity-60">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {message && <div className="px-4 py-3 text-xs bg-[#FAF8F5] border-b border-[rgba(45,45,45,0.08)]">{message}</div>}
      {loading ? (
        <div className="py-16 flex items-center justify-center text-[#707070] gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-[#C79A3B]" /> Loading review queue…
        </div>
      ) : counts.length === 0 ? (
        <div className="py-16 text-center text-sm text-[#707070]">No stock counts are waiting for approval.</div>
      ) : (
        <div className="divide-y divide-[rgba(45,45,45,0.06)]">
          {counts.map((count) => (
            <div key={count.id} className="p-4 sm:p-5 flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{count.count_number}</span>
                  <span className="inline-flex px-2 py-1 rounded-full text-[10px] font-bold bg-[#3978B8]/10 text-[#245E93]">PENDING</span>
                </div>
                <p className="text-xs text-[#707070] mt-1">{count.warehouse_name || 'Outlet Warehouse'} · {count.count_date ? new Date(count.count_date).toLocaleDateString('en-IN') : '—'}</p>
                <p className="text-xs mt-2">Variance value: <span className="font-semibold">{moneyINR(Number(count.total_variance_value || 0))}</span></p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => act(count, true)} disabled={busyId === count.id} className="px-3.5 py-2.5 rounded-xl bg-[#2E8B57] text-white text-xs font-bold disabled:opacity-60">
                  {busyId === count.id ? 'Processing…' : 'Approve & Lock'}
                </button>
                <button type="button" onClick={() => act(count, false)} disabled={busyId === count.id} className="px-3.5 py-2.5 rounded-xl bg-[#D9534F] text-white text-xs font-bold disabled:opacity-60">
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export const InventoryManager: React.FC = () => {
  const { currentOutlet } = useOutlet();
  const { user } = useAuth();
  const isInventoryManager = STOCK_COUNT_REVIEW_ROLES.has(getRoleName(user));
  const isRestaurantOutlet = currentOutlet?.type === 'RESTAURANT_OUTLET';

  // Stock must always follow the active outlet scope.
  // Admin/HQ users may still access the full Inventory Manager from the
  // appropriate HQ/management scope, but selecting an outlet must never
  // fall back to the old Multi-Outlet Inventory screen.
  if (currentOutlet?.id && isRestaurantOutlet) {
    return <OutletStockWorkspace outlet={currentOutlet} />;
  }

  return <InventoryManagerAdmin />;
};

export default InventoryManager;
