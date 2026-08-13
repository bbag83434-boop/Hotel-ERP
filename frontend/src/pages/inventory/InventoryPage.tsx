import React, { useState, useEffect, useCallback } from 'react';
import {
  Boxes,
  Layers,
  ArrowLeftRight,
  History,
  Plus,
  Search,
  AlertTriangle,
  Building2,
  Edit2,
  CheckCircle2,
  RefreshCw,
  X
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { inventoryApi } from '../../api/inventory.api';
import {
  Item,
  Category,
  Unit,
  Warehouse,
  StockBalance,
  StockLedgerEntry,
  ItemType
} from '../../types/inventory.types';
import { formatINR } from '../../utils/formatters';

export const InventoryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'items' | 'stocks' | 'ledger' | 'transfer' | 'warehouses'>('items');

  // Master Data
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<StockLedgerEntry[]>([]);

  // Loading & Error States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [lowStockOnly, setLowStockOnly] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Modals
  const [showItemModal, setShowItemModal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [showWarehouseModal, setShowWarehouseModal] = useState<boolean>(false);
  const [showAdjustModal, setShowAdjustModal] = useState<boolean>(false);
  const [adjustTarget, setAdjustTarget] = useState<{ warehouseId: string; itemId: string; itemName: string; currentQty: number } | null>(null);

  // Form States
  const [itemForm, setItemForm] = useState({
    name: '',
    code: '',
    barcode: '',
    categoryId: '',
    unitId: '',
    type: 'RAW_MATERIAL' as ItemType,
    description: '',
    costPrice: 0,
    sellingPrice: 0,
    minStockLevel: 0,
    reorderQty: 0
  });

  const [categoryForm, setCategoryForm] = useState({ name: '', code: '', description: '' });
  const [warehouseForm, setWarehouseForm] = useState({ name: '', code: '', isCentral: false, address: '' });
  const [adjustForm, setAdjustForm] = useState({ newQuantity: 0, reason: '' });

  // Transfer Form State
  const [transferFromWh, setTransferFromWh] = useState<string>('');
  const [transferToWh, setTransferToWh] = useState<string>('');
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [transferLines, setTransferLines] = useState<Array<{ itemId: string; quantity: number }>>([
    { itemId: '', quantity: 1 }
  ]);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

  // Fetch initial master lists
  const loadMasterData = useCallback(async () => {
    try {
      const [catList, unitList, whList] = await Promise.all([
        inventoryApi.getCategories(),
        inventoryApi.getUnits(),
        inventoryApi.getWarehouses()
      ]);
      setCategories(catList);
      setUnits(unitList);
      setWarehouses(whList);
      if (whList.length > 0) {
        if (!transferFromWh) setTransferFromWh(whList[0].id);
        if (!transferToWh && whList.length > 1) setTransferToWh(whList[1].id);
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Failed to load master metadata');
    }
  }, [transferFromWh, transferToWh]);

  // Tab specific data loader
  const loadTabData = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      if (activeTab === 'items') {
        const res = await inventoryApi.getItems({
          search: searchQuery,
          categoryId: selectedCategory || undefined,
          type: (selectedType as ItemType) || undefined,
          page,
          limit: 15
        });
        setItems(res.items);
        setTotalPages(res.pagination?.totalPages || 1);
      } else if (activeTab === 'stocks') {
        const res = await inventoryApi.getStockBalances({
          warehouseId: selectedWarehouse || undefined,
          lowStockOnly,
          search: searchQuery,
          page,
          limit: 20
        });
        setBalances(res.balances);
        setTotalPages(res.pagination?.totalPages || 1);
      } else if (activeTab === 'ledger') {
        const res = await inventoryApi.getStockLedger({
          warehouseId: selectedWarehouse || undefined,
          page,
          limit: 25
        });
        setLedgerEntries(res.entries);
        setTotalPages(res.pagination?.totalPages || 1);
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Error fetching data');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, searchQuery, selectedCategory, selectedType, selectedWarehouse, lowStockOnly, page]);

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

  useEffect(() => {
    loadTabData();
  }, [loadTabData]);

  // Handlers
  const handleOpenCreateItem = () => {
    setEditingItem(null);
    setItemForm({
      name: '',
      code: `ITEM-${Math.floor(1000 + Math.random() * 9000)}`,
      barcode: '',
      categoryId: categories[0]?.id || '',
      unitId: units[0]?.id || '',
      type: 'RAW_MATERIAL',
      description: '',
      costPrice: 0,
      sellingPrice: 0,
      minStockLevel: 10,
      reorderQty: 25
    });
    setShowItemModal(true);
  };

  const handleOpenEditItem = (item: Item) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      code: item.code,
      barcode: item.barcode || '',
      categoryId: item.categoryId,
      unitId: item.unitId,
      type: item.type,
      description: item.description || '',
      costPrice: Number(item.costPrice),
      sellingPrice: Number(item.sellingPrice),
      minStockLevel: Number(item.minStockLevel),
      reorderQty: Number(item.reorderQty)
    });
    setShowItemModal(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (editingItem) {
        await inventoryApi.updateItem(editingItem.id, itemForm);
        setSuccessMsg('Item updated successfully');
      } else {
        await inventoryApi.createItem(itemForm);
        setSuccessMsg('Item created successfully');
      }
      setShowItemModal(false);
      loadTabData();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Failed to save item');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await inventoryApi.createCategory(categoryForm);
      setSuccessMsg('Category created');
      setShowCategoryModal(false);
      setCategoryForm({ name: '', code: '', description: '' });
      loadMasterData();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Failed to create category');
    }
  };

  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await inventoryApi.createWarehouse(warehouseForm);
      setSuccessMsg('Warehouse created');
      setShowWarehouseModal(false);
      setWarehouseForm({ name: '', code: '', isCentral: false, address: '' });
      loadMasterData();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Failed to create warehouse');
    }
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transferFromWh === transferToWh) {
      setErrorMsg('Source and destination warehouse cannot be identical.');
      return;
    }
    const validLines = transferLines.filter((l) => l.itemId && l.quantity > 0);
    if (validLines.length === 0) {
      setErrorMsg('Please select at least one item and quantity to transfer.');
      return;
    }

    setIsSubmittingTransfer(true);
    setErrorMsg(null);
    try {
      await inventoryApi.transferStock({
        fromWarehouseId: transferFromWh,
        toWarehouseId: transferToWh,
        notes: transferNotes,
        items: validLines
      });
      setSuccessMsg('Stock transferred atomically & ledger updated!');
      setTransferLines([{ itemId: '', quantity: 1 }]);
      setTransferNotes('');
      setActiveTab('stocks');
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Transfer failed. Check warehouse stock levels.');
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  const handleOpenAdjust = (sb: StockBalance) => {
    setAdjustTarget({
      warehouseId: sb.warehouseId,
      itemId: sb.itemId,
      itemName: sb.item.name,
      currentQty: Number(sb.quantity)
    });
    setAdjustForm({
      newQuantity: Number(sb.quantity),
      reason: 'Physical inventory audit reconciliation'
    });
    setShowAdjustModal(true);
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;
    try {
      await inventoryApi.adjustStock({
        warehouseId: adjustTarget.warehouseId,
        itemId: adjustTarget.itemId,
        newQuantity: Number(adjustForm.newQuantity),
        reason: adjustForm.reason
      });
      setSuccessMsg('Stock adjustment recorded & ledger updated');
      setShowAdjustModal(false);
      loadTabData();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Failed to adjust stock');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-brand-500/10 text-brand-400 rounded-xl">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Inventory & Store Management
              </h1>
              <p className="text-xs text-slate-400">
                Multi-location store balances, stock valuation, movement ledger & HSN codes
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          {activeTab === 'items' && (
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={handleOpenCreateItem}
              className="w-full sm:w-auto"
            >
              New Item Master
            </Button>
          )}
          {activeTab === 'warehouses' && (
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setShowWarehouseModal(true)}
              className="w-full sm:w-auto"
            >
              New Store
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
          <button onClick={() => setErrorMsg(null)} className="p-1 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-xs text-emerald-400 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="p-1 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center space-x-2 border-b border-slate-800 overflow-x-auto pb-1 text-xs font-semibold scrollbar-none">
        <button
          onClick={() => { setActiveTab('items'); setPage(1); }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'items' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Items & Products ({items.length})</span>
        </button>

        <button
          onClick={() => { setActiveTab('stocks'); setPage(1); }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'stocks' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Stock Balances & Alerts</span>
        </button>

        <button
          onClick={() => { setActiveTab('ledger'); setPage(1); }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'ledger' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Movement Ledger</span>
        </button>

        <button
          onClick={() => { setActiveTab('transfer'); }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'transfer' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <ArrowLeftRight className="w-4 h-4" />
          <span>Store Transfer</span>
        </button>

        <button
          onClick={() => { setActiveTab('warehouses'); }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'warehouses' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Stores & Categories</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: ITEM MASTER LIST */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'items' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search items by name, SKU or barcode..."
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">All Item Types</option>
                <option value="RAW_MATERIAL">Raw Material / Ingredient</option>
                <option value="FINISHED_GOOD">Finished Dish / Recipe</option>
                <option value="SEMI_FINISHED">Semi-Finished Prep</option>
                <option value="PACKAGING">Packaging</option>
              </select>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-floating">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-4">Item Details</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Type</th>
                    <th className="p-4 text-right">Cost Price</th>
                    <th className="p-4 text-right">Selling Price</th>
                    <th className="p-4 text-right">On-Hand Stock</th>
                    <th className="p-4 text-center">Reorder Threshold</th>
                    <th className="p-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-400" />
                        Loading items inventory...
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        No items found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-4">
                          <p className="font-bold text-white text-sm">{item.name}</p>
                          <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                            <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-300">
                              {item.code}
                            </span>
                            {item.barcode && <span>• {item.barcode}</span>}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 bg-slate-800 rounded-lg text-slate-300 border border-slate-700 text-[11px]">
                            {item.category?.name || 'Uncategorized'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase ${
                              item.type === 'RAW_MATERIAL'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : item.type === 'FINISHED_GOOD'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            }`}
                          >
                            {item.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4 text-right font-mono font-semibold text-slate-200">
                          {formatINR(item.costPrice)} / {item.unit?.symbol}
                        </td>
                        <td className="p-4 text-right font-mono font-semibold text-emerald-400">
                          {formatINR(item.sellingPrice)}
                        </td>
                        <td className="p-4 text-right">
                          <div className="inline-flex items-center space-x-1.5">
                            <span
                              className={`font-mono font-bold ${
                                item.isLowStock ? 'text-rose-400' : 'text-slate-100'
                              }`}
                            >
                              {Number(item.totalStock || 0)} {item.unit?.symbol}
                            </span>
                            {item.isLowStock && (
                              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Low stock alert" />
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-center text-slate-400 font-mono">
                          Min: {Number(item.minStockLevel)} | Reorder: {Number(item.reorderQty)}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleOpenEditItem(item)}
                            className="p-1.5 bg-slate-800 hover:bg-brand-600 hover:text-white rounded-lg border border-slate-700 transition-colors text-slate-300"
                            title="Edit Item"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Page {page} of {totalPages}</span>
              <div className="flex items-center space-x-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1.5 bg-slate-800 rounded-lg disabled:opacity-40 hover:bg-slate-700 text-slate-200"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1.5 bg-slate-800 rounded-lg disabled:opacity-40 hover:bg-slate-700 text-slate-200"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: STOCK BALANCES & LOW STOCK ALERTS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'stocks' && (
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
            <div>
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">All Stores & Outlets</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.isCentral ? '(Central)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <label className="flex items-center space-x-2 cursor-pointer text-xs font-semibold text-slate-300">
                <input
                  type="checkbox"
                  checked={lowStockOnly}
                  onChange={(e) => setLowStockOnly(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-brand-600 focus:ring-brand-500"
                />
                <span className="flex items-center space-x-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Show Low Stock Alert Items Only</span>
                </span>
              </label>
            </div>

            <div className="text-right text-xs text-slate-400">
              <span>Automated real-time stock balances across all locations</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-floating">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-4">Store</th>
                    <th className="p-4">Item Name & SKU</th>
                    <th className="p-4">Category</th>
                    <th className="p-4 text-right">Current Stock</th>
                    <th className="p-4 text-center">Thresholds</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {balances.map((sb) => (
                    <tr key={sb.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4">
                        <p className="font-bold text-white">{sb.warehouse.name}</p>
                        <p className="text-[10px] text-slate-400">{sb.warehouse.code}</p>
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-white text-sm">{sb.item.name}</p>
                        <p className="text-[11px] font-mono text-slate-400">{sb.item.code}</p>
                      </td>
                      <td className="p-4 text-slate-400">{sb.item.category?.name}</td>
                      <td className="p-4 text-right font-mono text-sm font-bold text-slate-100">
                        {Number(sb.quantity)} {sb.item.unit?.symbol}
                      </td>
                      <td className="p-4 text-center text-slate-400 font-mono text-[11px]">
                        Min: {Number(sb.minStock)} | Reorder: {Number(sb.reorderQty)}
                      </td>
                      <td className="p-4 text-center">
                        {sb.isOutOfStock ? (
                          <span className="px-2.5 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full font-bold text-[10px]">
                            OUT OF STOCK
                          </span>
                        ) : sb.isLowStock ? (
                          <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full font-bold text-[10px]">
                            LOW STOCK ALERT
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full font-bold text-[10px]">
                            OPTIMAL
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleOpenAdjust(sb)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-[11px] font-semibold"
                        >
                          Stock Audit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: STOCK LEDGER (IMMUTABLE MOVEMENT LOG) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-floating">
            <div className="p-4 bg-slate-800/40 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4 text-brand-400" />
                <h3 className="font-bold text-white text-sm">Immutable Stock Movement Audit Trail</h3>
              </div>
              <p className="text-xs text-slate-400">All GRNs, production consumptions, and transfers logged automatically</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-4">Timestamp</th>
                    <th className="p-4">Store</th>
                    <th className="p-4">Item</th>
                    <th className="p-4">Movement Type</th>
                    <th className="p-4 text-right">Change Qty</th>
                    <th className="p-4 text-right">Running Balance</th>
                    <th className="p-4">Reference & Notes</th>
                    <th className="p-4">Operator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {ledgerEntries.map((log) => {
                    const isPositive = Number(log.changeQty) > 0;
                    return (
                      <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 font-sans text-slate-400 text-[11px]">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="p-4 font-sans text-slate-200 font-medium">{log.warehouse.name}</td>
                        <td className="p-4 font-sans">
                          <p className="font-bold text-white">{log.item.name}</p>
                          <p className="text-[10px] text-slate-400">{log.item.code}</p>
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              log.movementType === 'GRN'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : log.movementType === 'PRODUCTION_IN'
                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                : log.movementType === 'PRODUCTION_OUT'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : log.movementType.includes('TRANSFER')
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                : 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            {log.movementType}
                          </span>
                        </td>
                        <td className="p-4 text-right font-bold text-sm">
                          <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                            {isPositive ? `+${Number(log.changeQty)}` : Number(log.changeQty)} {log.item.unit?.symbol}
                          </span>
                        </td>
                        <td className="p-4 text-right font-bold text-white">
                          {Number(log.balanceQty)} {log.item.unit?.symbol}
                        </td>
                        <td className="p-4 font-sans text-slate-300 text-xs">
                          <p>{log.referenceType} {log.referenceId ? `(${log.referenceId.slice(0, 8)})` : ''}</p>
                          {log.notes && <p className="text-[10px] text-slate-400 mt-0.5">{log.notes}</p>}
                        </td>
                        <td className="p-4 font-sans text-slate-400 text-xs">
                          {log.createdBy ? `${log.createdBy.firstName} ${log.createdBy.lastName || ''}` : 'System'}
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

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: STORE STOCK TRANSFER */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'transfer' && (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-floating">
            <h2 className="text-lg font-bold text-white mb-2 flex items-center space-x-2">
              <ArrowLeftRight className="w-5 h-5 text-brand-400" />
              <span>Inter-Store Stock Transfer (Atomic Transaction)</span>
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              Transfers decrease source store and increase destination store atomically in a single database transaction. Non-negative stock rule enforced.
            </p>

            <form onSubmit={handleExecuteTransfer} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Source Store (Decrease)
                  </label>
                  <select
                    value={transferFromWh}
                    onChange={(e) => setTransferFromWh(e.target.value)}
                    required
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-brand-500"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} {w.isCentral ? '(Central Hub)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Destination Store (Increase)
                  </label>
                  <select
                    value={transferToWh}
                    onChange={(e) => setTransferToWh(e.target.value)}
                    required
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-brand-500"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} {w.isCentral ? '(Central Hub)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items transfer table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Transfer Items List</span>
                  <button
                    type="button"
                    onClick={() => setTransferLines([...transferLines, { itemId: '', quantity: 1 }])}
                    className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                {transferLines.map((line, idx) => (
                  <div key={idx} className="flex items-center space-x-3 bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60">
                    <div className="flex-1">
                      <select
                        value={line.itemId}
                        onChange={(e) => {
                          const copy = [...transferLines];
                          copy[idx].itemId = e.target.value;
                          setTransferLines(copy);
                        }}
                        required
                        className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-xl px-3 py-2"
                      >
                        <option value="">Select Item / Raw Material</option>
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name} ({it.code}) - {it.unit?.symbol}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-32">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={line.quantity}
                        onChange={(e) => {
                          const copy = [...transferLines];
                          copy[idx].quantity = parseFloat(e.target.value) || 0;
                          setTransferLines(copy);
                        }}
                        placeholder="Quantity"
                        required
                        className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-xl px-3 py-2 font-mono text-right"
                      />
                    </div>

                    {transferLines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setTransferLines(transferLines.filter((_, i) => i !== idx))}
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div>
                <Input
                  label="Transfer Reason / Notes"
                  type="text"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="e.g. Daily kitchen ingredient restock from Central Store"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={isSubmittingTransfer}
              >
                Execute Atomic Transfer
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 5: STORES & CATEGORIES */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'warehouses' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Stores Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-brand-400" />
                <span>Store Locations</span>
              </h3>
              <Button size="sm" variant="outline" onClick={() => setShowWarehouseModal(true)}>
                Add Store
              </Button>
            </div>

            <div className="space-y-3">
              {warehouses.map((w) => (
                <div key={w.id} className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700/60 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-white text-sm">{w.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{w.address || 'Standard Location'}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-xs text-brand-300">
                      {w.code}
                    </span>
                    {w.isCentral && (
                      <p className="text-[10px] text-emerald-400 font-bold uppercase mt-1">Central Store</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Categories Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base flex items-center space-x-2">
                <Layers className="w-5 h-5 text-amber-400" />
                <span>Product Categories</span>
              </h3>
              <Button size="sm" variant="outline" onClick={() => setShowCategoryModal(true)}>
                Add Category
              </Button>
            </div>

            <div className="space-y-3">
              {categories.map((c) => (
                <div key={c.id} className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700/60 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-white text-sm">{c.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{c.description || 'General category'}</p>
                  </div>
                  <span className="font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-xs text-amber-300">
                    {c.code}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: CREATE / EDIT ITEM */}
      {/* ------------------------------------------------------------- */}
      {showItemModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-floating">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <h3 className="text-lg font-bold text-white">
                {editingItem ? 'Edit Item Master' : 'Create New Item Master'}
              </h3>
              <button onClick={() => setShowItemModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Item Name"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  placeholder="e.g. Buffalo Mozzarella Cheese"
                  required
                />
                <Input
                  label="Item Code (SKU)"
                  value={itemForm.code}
                  onChange={(e) => setItemForm({ ...itemForm, code: e.target.value })}
                  placeholder="e.g. RM-CHEESE-01"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Category
                  </label>
                  <select
                    value={itemForm.categoryId}
                    onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}
                    required
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-xl px-3 py-2.5"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Unit of Measure
                  </label>
                  <select
                    value={itemForm.unitId}
                    onChange={(e) => setItemForm({ ...itemForm, unitId: e.target.value })}
                    required
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-xl px-3 py-2.5"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.symbol})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Item Type
                  </label>
                  <select
                    value={itemForm.type}
                    onChange={(e) => setItemForm({ ...itemForm, type: e.target.value as ItemType })}
                    required
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-xl px-3 py-2.5"
                  >
                    <option value="RAW_MATERIAL">Raw Material / Ingredient</option>
                    <option value="FINISHED_GOOD">Finished Good (Dish)</option>
                    <option value="SEMI_FINISHED">Semi-Finished Prep</option>
                    <option value="PACKAGING">Packaging</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <Input
                  label="Cost Price (₹)"
                  type="number"
                  step="0.01"
                  value={itemForm.costPrice}
                  onChange={(e) => setItemForm({ ...itemForm, costPrice: Number(e.target.value) })}
                  required
                />
                <Input
                  label="Selling Price (₹)"
                  type="number"
                  step="0.01"
                  value={itemForm.sellingPrice}
                  onChange={(e) => setItemForm({ ...itemForm, sellingPrice: Number(e.target.value) })}
                />
                <Input
                  label="Min Stock Threshold"
                  type="number"
                  step="any"
                  value={itemForm.minStockLevel}
                  onChange={(e) => setItemForm({ ...itemForm, minStockLevel: parseFloat(e.target.value) || 0 })}
                />
                <Input
                  label="Reorder Quantity"
                  type="number"
                  step="any"
                  value={itemForm.reorderQty}
                  onChange={(e) => setItemForm({ ...itemForm, reorderQty: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
                <Button type="button" variant="ghost" onClick={() => setShowItemModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  {editingItem ? 'Save Changes' : 'Create Item'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: STOCK ADJUSTMENT */}
      {/* ------------------------------------------------------------- */}
      {showAdjustModal && adjustTarget && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-floating">
            <h3 className="text-base font-bold text-white mb-2">Physical Stock Count Adjustment</h3>
            <p className="text-xs text-slate-400 mb-4">
              Item: <span className="font-bold text-white">{adjustTarget.itemName}</span> | System Qty: <span className="font-mono text-brand-300">{adjustTarget.currentQty}</span>
            </p>

            <form onSubmit={handleSaveAdjustment} className="space-y-4">
              <Input
                label="New Actual Physical Count"
                type="number"
                step="any"
                min="0"
                value={adjustForm.newQuantity}
                onChange={(e) => setAdjustForm({ ...adjustForm, newQuantity: parseFloat(e.target.value) || 0 })}
                required
              />

              <Input
                label="Audit Reason"
                value={adjustForm.reason}
                onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                placeholder="e.g. Month-end inventory verification count discrepancy"
                required
              />

              <div className="flex justify-end space-x-3 pt-3">
                <Button type="button" variant="ghost" onClick={() => setShowAdjustModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Update Stock & Log
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: CREATE CATEGORY */}
      {/* ------------------------------------------------------------- */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-floating">
            <h3 className="text-base font-bold text-white mb-4">Create Product Category</h3>
            <form onSubmit={handleSaveCategory} className="space-y-4">
              <Input
                label="Category Name"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="e.g. Dairy & Eggs"
                required
              />
              <Input
                label="Category Code"
                value={categoryForm.code}
                onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })}
                placeholder="e.g. CAT-DAIRY"
                required
              />
              <div className="flex justify-end space-x-3 pt-3">
                <Button type="button" variant="ghost" onClick={() => setShowCategoryModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary">Create</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: CREATE WAREHOUSE */}
      {/* ------------------------------------------------------------- */}
      {showWarehouseModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-floating">
            <h3 className="text-base font-bold text-white mb-4">Create Warehouse / Store</h3>
            <form onSubmit={handleSaveWarehouse} className="space-y-4">
              <Input
                label="Warehouse Name"
                value={warehouseForm.name}
                onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                placeholder="e.g. Kitchen Cold Storage"
                required
              />
              <Input
                label="Warehouse Code"
                value={warehouseForm.code}
                onChange={(e) => setWarehouseForm({ ...warehouseForm, code: e.target.value })}
                placeholder="e.g. WH-KITCHEN-02"
                required
              />
              <label className="flex items-center space-x-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={warehouseForm.isCentral}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, isCentral: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-800 text-brand-600"
                />
                <span>Is Main Central Warehouse</span>
              </label>
              <div className="flex justify-end space-x-3 pt-3">
                <Button type="button" variant="ghost" onClick={() => setShowWarehouseModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary">Create</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default InventoryPage;
