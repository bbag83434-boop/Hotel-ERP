'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { inventoryApi } from '@/api/inventory';
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
} from '@/types/inventory.types';
import { Warehouse } from '@/types/organization.types';
import { useOutlet } from '@/context/OutletContext';
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
} from 'lucide-react';

export const InventoryManager: React.FC = () => {
  const { currentOutlet } = useOutlet();
  const [subTab, setSubTab] = useState<'balances' | 'items' | 'transfers' | 'categories'>('balances');

  // Domain Data
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

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
    reason: 'CYCLE_COUNT_ADJUSTMENT',
    notes: '',
  });

  const [categoryForm, setCategoryForm] = useState({ name: '', code: '', description: '' });
  const [unitForm, setUnitForm] = useState({ name: '', symbol: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const [balData, lowData, itemData, catData, unitData, trData, whData] = await Promise.all([
        inventoryApi.getStockBalances().catch(() => []),
        inventoryApi.getLowStockAlerts().catch(() => []),
        inventoryApi.getItems().catch(() => []),
        inventoryApi.getCategories().catch(() => []),
        inventoryApi.getUnits().catch(() => []),
        inventoryApi.getTransfers().catch(() => []),
        organizationApi.getWarehouses().catch(() => []),
      ]);

      setBalances(balData);
      setLowStockAlerts(lowData);
      setItems(itemData);
      setCategories(catData);
      setUnits(unitData);
      setTransfers(trData);
      setWarehouses(whData);

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

        <div className="flex items-center gap-2">
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
          {(['balances', 'items', 'transfers', 'categories'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setSubTab(tab); setSearchQuery(''); }}
              className={`pb-2.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
                subTab === tab
                  ? 'border-[#C79A3B] text-[#B8862D]'
                  : 'border-transparent text-[#707070] hover:text-[#1C1C1C]'
              }`}
            >
              {tab === 'balances' ? 'Live Balances' : tab === 'items' ? 'Items Catalogue' : tab === 'transfers' ? 'Inter-Outlet Transfers' : 'Categories & Units'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {subTab === 'balances' && (
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
                              reason: 'PHYSICAL_AUDIT_ADJUSTMENT',
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
                <label className="block text-[#707070] font-semibold mb-1">Reason / Justification *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Opening balance audit / Spoilage write-off"
                  value={adjustmentForm.reason}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                />
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

export default InventoryManager;
