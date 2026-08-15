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
    <div className="space-y-6 select-none">
      {/* Header Banner */}
      <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#d4a437] to-[#996f1b] flex items-center justify-center text-black shadow-lg shadow-[#d4a437]/20 border border-[#d4a437]/40">
            <Boxes className="w-6 h-6 text-black" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-wide uppercase">
                Stock Catalog & Real-Time Stores
              </h1>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#d4a437]/15 text-[#d4a437] font-semibold border border-[#d4a437]/30 tracking-wider">
                Supply Chain
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Multi-location warehouse balances, ingredient catalog, units of measure, FEFO batches & movement ledger
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 w-full sm:w-auto">
          {activeTab === 'items' && (
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={handleOpenCreateItem}
              className="w-full sm:w-auto"
            >
              Add Item Master
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
              Add Storage Location
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
          <button onClick={() => setErrorMsg(null)} className="p-1 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="bg-[#3fbf6f]/10 border border-[#3fbf6f]/25 rounded-2xl p-4 text-xs text-[#3fbf6f] flex items-center justify-between font-medium">
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
      <div className="flex items-center space-x-2 border-b border-white/[0.08] overflow-x-auto pb-2 text-xs font-semibold scrollbar-none">
        <button
          onClick={() => { setActiveTab('items'); setPage(1); }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'items' ? 'bg-[#d4a437]/15 text-[#d4a437] border border-[#d4a437]/30 shadow-sm' : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Items & Products ({items.length})</span>
        </button>

        <button
          onClick={() => { setActiveTab('stocks'); setPage(1); }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'stocks' ? 'bg-[#d4a437]/15 text-[#d4a437] border border-[#d4a437]/30 shadow-sm' : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Stock Balances & Alerts</span>
        </button>

        <button
          onClick={() => { setActiveTab('ledger'); setPage(1); }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'ledger' ? 'bg-[#d4a437]/15 text-[#d4a437] border border-[#d4a437]/30 shadow-sm' : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Movement Ledger</span>
        </button>

        <button
          onClick={() => { setActiveTab('transfer'); }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'transfer' ? 'bg-[#d4a437]/15 text-[#d4a437] border border-[#d4a437]/30 shadow-sm' : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
          }`}
        >
          <ArrowLeftRight className="w-4 h-4" />
          <span>Store Transfer</span>
        </button>

        <button
          onClick={() => { setActiveTab('warehouses'); }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'warehouses' ? 'bg-[#d4a437]/15 text-[#d4a437] border border-[#d4a437]/30 shadow-sm' : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
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
          <div className="bg-[#17171b] border border-white/[0.08] rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-neutral-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search items by name, SKU or barcode..."
                className="w-full bg-[#0c0c0e] border border-white/[0.09] text-white text-xs rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#d4a437]/50 focus:border-[#d4a437]"
              />
            </div>

            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-[#0c0c0e] border border-white/[0.09] text-neutral-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#d4a437]/50 focus:border-[#d4a437]"
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
                className="w-full bg-[#0c0c0e] border border-white/[0.09] text-neutral-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#d4a437]/50 focus:border-[#d4a437]"
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
          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-neutral-300">
                <thead className="bg-[#0c0c0e] text-neutral-400 font-semibold border-b border-white/[0.06] uppercase tracking-wider text-[10px]">
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
                <tbody className="divide-y divide-white/[0.06]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-neutral-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#d4a437]" />
                        Loading items inventory...
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-neutral-500 space-y-2">
                        <Boxes className="w-8 h-8 text-neutral-500 mx-auto" />
                        <p className="text-sm font-semibold text-neutral-300">No items found in catalog</p>
                        <p className="text-xs text-neutral-500">Add raw materials, finished dishes, or beverages to populate your inventory master.</p>
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-4">
                          <p className="font-bold text-white text-sm">{item.name}</p>
                          <div className="flex items-center space-x-2 text-[11px] text-neutral-400 mt-0.5">
                            <span className="font-mono bg-[#0c0c0e] px-2 py-0.5 rounded border border-white/[0.07] text-neutral-300">
                              {item.code}
                            </span>
                            {item.barcode && <span>• {item.barcode}</span>}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 bg-[#0c0c0e] rounded-xl text-neutral-300 border border-white/[0.07] text-[11px]">
                            {item.category?.name || 'Uncategorized'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                              item.type === 'RAW_MATERIAL'
                                ? 'bg-[#e5a33d]/15 text-[#e5a33d] border-[#e5a33d]/25'
                                : item.type === 'FINISHED_GOOD'
                                ? 'bg-[#3fbf6f]/15 text-[#3fbf6f] border-[#3fbf6f]/25'
                                : 'bg-[#4d9de5]/15 text-[#4d9de5] border-[#4d9de5]/25'
                            }`}
                          >
                            {item.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4 text-right font-mono font-semibold text-neutral-200">
                          {formatINR(item.costPrice)} / {item.unit?.symbol}
                        </td>
                        <td className="p-4 text-right font-mono font-semibold text-[#3fbf6f]">
                          {formatINR(item.sellingPrice)}
                        </td>
                        <td className="p-4 text-right">
                          <div className="inline-flex items-center space-x-1.5">
                            <span
                              className={`font-mono font-bold ${
                                item.isLowStock ? 'text-[#e5544d]' : 'text-neutral-100'
                              }`}
                            >
                              {Number(item.totalStock || 0)} {item.unit?.symbol}
                            </span>
                            {item.isLowStock && (
                              <span className="w-2 h-2 rounded-full bg-[#e5544d] animate-pulse" title="Low stock alert" />
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-center text-neutral-400 font-mono text-[11px]">
                          Min: {Number(item.minStockLevel)} | Reorder: {Number(item.reorderQty)}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleOpenEditItem(item)}
                            className="p-2 bg-[#202026] hover:bg-[#d4a437] hover:text-black rounded-xl border border-white/[0.08] transition-all text-neutral-300"
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
            <div className="p-4 bg-[#0c0c0e] border-t border-white/[0.06] flex items-center justify-between text-xs text-neutral-400">
              <span>Page {page} of {totalPages}</span>
              <div className="flex items-center space-x-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1.5 bg-[#17171b] border border-white/[0.08] rounded-xl disabled:opacity-40 hover:bg-[#22222a] text-neutral-200"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1.5 bg-[#17171b] border border-white/[0.08] rounded-xl disabled:opacity-40 hover:bg-[#22222a] text-neutral-200"
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
          <div className="bg-[#17171b] border border-white/[0.08] rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
            <div>
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="w-full bg-[#0c0c0e] border border-white/[0.09] text-neutral-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#d4a437]/50 focus:border-[#d4a437]"
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
              <label className="flex items-center space-x-2 cursor-pointer text-xs font-semibold text-neutral-300">
                <input
                  type="checkbox"
                  checked={lowStockOnly}
                  onChange={(e) => setLowStockOnly(e.target.checked)}
                  className="rounded border-white/[0.2] bg-[#0c0c0e] text-[#d4a437] focus:ring-[#d4a437]"
                />
                <span className="flex items-center space-x-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#e5544d]" />
                  <span>Show Low Stock Alerts Only</span>
                </span>
              </label>
            </div>

            <div className="text-right text-xs text-neutral-400">
              <span>Real-time perpetual inventory balances</span>
            </div>
          </div>

          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-neutral-300">
                <thead className="bg-[#0c0c0e] text-neutral-400 font-semibold border-b border-white/[0.06] uppercase tracking-wider text-[10px]">
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
                <tbody className="divide-y divide-white/[0.06]">
                  {balances.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-neutral-500 space-y-2">
                        <Boxes className="w-8 h-8 text-neutral-500 mx-auto" />
                        <p className="text-sm font-semibold text-neutral-300">No stock balances recorded</p>
                        <p className="text-xs text-neutral-500">Record a purchase receiving (GRN) or stock adjustment to initialize warehouse balances.</p>
                      </td>
                    </tr>
                  ) : (
                    balances.map((sb) => (
                      <tr key={sb.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-4">
                          <p className="font-bold text-white">{sb.warehouse.name}</p>
                          <p className="text-[10px] text-neutral-400 font-mono">{sb.warehouse.code}</p>
                        </td>
                        <td className="p-4">
                          <p className="font-bold text-white text-sm">{sb.item.name}</p>
                          <p className="text-[11px] font-mono text-neutral-400">{sb.item.code}</p>
                        </td>
                        <td className="p-4 text-neutral-400">{sb.item.category?.name || 'General'}</td>
                        <td className="p-4 text-right font-mono text-sm font-bold text-neutral-100">
                          {Number(sb.quantity)} {sb.item.unit?.symbol}
                        </td>
                        <td className="p-4 text-center text-neutral-400 font-mono text-[11px]">
                          Min: {Number(sb.minStock)} | Reorder: {Number(sb.reorderQty)}
                        </td>
                        <td className="p-4 text-center">
                          {sb.isOutOfStock ? (
                            <span className="px-2.5 py-0.5 bg-[#e5544d]/15 text-[#e5544d] border border-[#e5544d]/25 rounded-full font-bold text-[10px]">
                              OUT OF STOCK
                            </span>
                          ) : sb.isLowStock ? (
                            <span className="px-2.5 py-0.5 bg-[#e5a33d]/15 text-[#e5a33d] border border-[#e5a33d]/25 rounded-full font-bold text-[10px]">
                              LOW STOCK
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 bg-[#3fbf6f]/15 text-[#3fbf6f] border border-[#3fbf6f]/25 rounded-full font-bold text-[10px]">
                              OPTIMAL
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleOpenAdjust(sb)}
                            className="px-3 py-1.5 bg-[#202026] hover:bg-[#d4a437] hover:text-black text-neutral-200 border border-white/[0.08] rounded-xl text-[11px] font-semibold transition-all"
                          >
                            Stock Audit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
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
          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl overflow-hidden shadow-xl">
            <div className="p-4 bg-[#0c0c0e] border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4 text-[#d4a437]" />
                <h3 className="font-bold text-white text-sm">Immutable Stock Movement Audit Trail</h3>
              </div>
              <p className="text-xs text-neutral-400">All GRNs, production consumptions, and transfers logged perpetually</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-neutral-300">
                <thead className="bg-[#0c0c0e] text-neutral-400 font-semibold border-b border-white/[0.06] uppercase tracking-wider text-[10px]">
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
                <tbody className="divide-y divide-white/[0.06] font-mono">
                  {ledgerEntries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-neutral-500 font-sans space-y-2">
                        <History className="w-8 h-8 text-neutral-500 mx-auto" />
                        <p className="text-sm font-semibold text-neutral-300">No stock movements logged</p>
                        <p className="text-xs text-neutral-500">Every goods receipt, kitchen consumption, and transfer will automatically appear here.</p>
                      </td>
                    </tr>
                  ) : (
                    ledgerEntries.map((log) => {
                      const isPositive = Number(log.changeQty) > 0;
                      return (
                        <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-4 font-sans text-neutral-400 text-[11px]">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="p-4 font-sans text-neutral-200 font-medium">{log.warehouse.name}</td>
                          <td className="p-4 font-sans">
                            <p className="font-bold text-white">{log.item.name}</p>
                            <p className="text-[10px] text-neutral-400">{log.item.code}</p>
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                                log.movementType === 'GRN'
                                  ? 'bg-[#3fbf6f]/15 text-[#3fbf6f] border-[#3fbf6f]/25'
                                  : log.movementType === 'PRODUCTION_IN'
                                  ? 'bg-[#4d9de5]/15 text-[#4d9de5] border-[#4d9de5]/25'
                                  : log.movementType === 'PRODUCTION_OUT'
                                  ? 'bg-[#d4a437]/15 text-[#d4a437] border-[#d4a437]/25'
                                  : log.movementType.includes('TRANSFER')
                                  ? 'bg-[#e5a33d]/15 text-[#e5a33d] border-[#e5a33d]/25'
                                  : 'bg-[#202026] text-neutral-300 border-white/[0.06]'
                              }`}
                            >
                              {log.movementType}
                            </span>
                          </td>
                          <td className="p-4 text-right font-bold text-sm">
                            <span className={isPositive ? 'text-[#3fbf6f]' : 'text-[#e5544d]'}>
                              {isPositive ? `+${Number(log.changeQty)}` : Number(log.changeQty)} {log.item.unit?.symbol}
                            </span>
                          </td>
                          <td className="p-4 text-right font-bold text-white">
                            {Number(log.balanceQty)} {log.item.unit?.symbol}
                          </td>
                          <td className="p-4 font-sans text-neutral-300 text-xs">
                            <p>{log.referenceType} {log.referenceId ? `(${log.referenceId.slice(0, 8)})` : ''}</p>
                            {(log.batchNumber || log.expiryDate) && (
                              <div className="flex items-center gap-1.5 mt-1 font-mono text-[10px]">
                                {log.batchNumber && (
                                  <span className="px-1.5 py-0.5 bg-[#0c0c0e] rounded text-[#d4a437] border border-white/[0.08]">
                                    Batch: {log.batchNumber}
                                  </span>
                                )}
                                {log.expiryDate && (
                                  <span className="px-1.5 py-0.5 bg-[#0c0c0e] rounded text-neutral-400 border border-white/[0.08]">
                                    Exp: {new Date(log.expiryDate).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            )}
                            {log.notes && <p className="text-[10px] text-neutral-400 mt-0.5">{log.notes}</p>}
                          </td>
                          <td className="p-4 font-sans text-neutral-400 text-xs">
                            {log.createdBy ? `${log.createdBy.firstName} ${log.createdBy.lastName || ''}` : 'System'}
                          </td>
                        </tr>
                      );
                    })
                  )}
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
          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-6 shadow-xl space-y-6">
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <ArrowLeftRight className="w-4 h-4 text-[#d4a437]" />
                <span className="uppercase tracking-wider">Inter-Store Stock Transfer</span>
              </h2>
              <p className="text-xs text-neutral-400 mt-1">
                Atomic database transaction decreases source store and increases destination store simultaneously. Non-negative stock rules strictly enforced.
              </p>
            </div>

            <form onSubmit={handleExecuteTransfer} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    Source Store (Outflow) *
                  </label>
                  <select
                    value={transferFromWh}
                    onChange={(e) => setTransferFromWh(e.target.value)}
                    required
                    className="w-full bg-[#0c0c0e] border border-white/[0.09] text-white text-xs rounded-xl px-3.5 py-2.5 focus:border-[#d4a437] focus:outline-none"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} {w.isCentral ? '(Central Hub)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    Destination Store (Inflow) *
                  </label>
                  <select
                    value={transferToWh}
                    onChange={(e) => setTransferToWh(e.target.value)}
                    required
                    className="w-full bg-[#0c0c0e] border border-white/[0.09] text-white text-xs rounded-xl px-3.5 py-2.5 focus:border-[#d4a437] focus:outline-none"
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
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Transfer Items List</span>
                  <button
                    type="button"
                    onClick={() => setTransferLines([...transferLines, { itemId: '', quantity: 1 }])}
                    className="text-xs text-[#d4a437] hover:text-[#b88c2c] font-semibold flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Transfer Item</span>
                  </button>
                </div>

                {transferLines.map((line, idx) => (
                  <div key={idx} className="flex items-center space-x-3 bg-[#0c0c0e] p-3 rounded-2xl border border-white/[0.06]">
                    <div className="flex-1">
                      <select
                        value={line.itemId}
                        onChange={(e) => {
                          const copy = [...transferLines];
                          copy[idx].itemId = e.target.value;
                          setTransferLines(copy);
                        }}
                        required
                        className="w-full bg-[#17171b] border border-white/[0.09] text-white text-xs rounded-xl px-3 py-2 focus:border-[#d4a437] focus:outline-none"
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
                        className="w-full bg-[#17171b] border border-white/[0.09] text-white text-xs rounded-xl px-3 py-2 font-mono text-right focus:border-[#d4a437] focus:outline-none"
                      />
                    </div>

                    {transferLines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setTransferLines(transferLines.filter((_, i) => i !== idx))}
                        className="text-neutral-500 hover:text-[#e5544d] p-1"
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
                  placeholder="e.g. Kitchen daily replenishment from Central Warehouse"
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
          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-[#d4a437]" />
                <span>Store Locations</span>
              </h3>
              <Button size="sm" variant="outline" onClick={() => setShowWarehouseModal(true)}>
                Add Store
              </Button>
            </div>

            <div className="space-y-3">
              {warehouses.length === 0 ? (
                <div className="p-8 text-center bg-[#0c0c0e] rounded-2xl border border-white/[0.06] text-neutral-500">
                  No warehouse locations configured.
                </div>
              ) : (
                warehouses.map((w) => (
                  <div key={w.id} className="p-4 bg-[#0c0c0e] rounded-2xl border border-white/[0.06] flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white text-sm">{w.name}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">{w.address || 'Standard Location'}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono bg-[#17171b] px-2 py-0.5 rounded border border-white/[0.08] text-xs text-[#d4a437]">
                        {w.code}
                      </span>
                      {w.isCentral && (
                        <p className="text-[10px] text-[#3fbf6f] font-bold uppercase mt-1">Central Store</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Categories Card */}
          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center space-x-2">
                <Layers className="w-4 h-4 text-[#d4a437]" />
                <span>Product Categories</span>
              </h3>
              <Button size="sm" variant="outline" onClick={() => setShowCategoryModal(true)}>
                Add Category
              </Button>
            </div>

            <div className="space-y-3">
              {categories.length === 0 ? (
                <div className="p-8 text-center bg-[#0c0c0e] rounded-2xl border border-white/[0.06] text-neutral-500">
                  No categories configured.
                </div>
              ) : (
                categories.map((c) => (
                  <div key={c.id} className="p-4 bg-[#0c0c0e] rounded-2xl border border-white/[0.06] flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white text-sm">{c.name}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">{c.description || 'General category'}</p>
                    </div>
                    <span className="font-mono bg-[#17171b] px-2 py-0.5 rounded border border-white/[0.08] text-xs text-[#d4a437]">
                      {c.code}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: CREATE / EDIT ITEM */}
      {/* ------------------------------------------------------------- */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] border border-white/[0.1] rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.06] mb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Boxes className="w-4 h-4 text-[#d4a437]" />
                {editingItem ? 'Edit Item Master' : 'Create New Item Master'}
              </h3>
              <button onClick={() => setShowItemModal(false)} className="text-neutral-400 hover:text-white">
                <X className="w-4 h-4" />
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
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    Category
                  </label>
                  <select
                    value={itemForm.categoryId}
                    onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}
                    required
                    className="w-full bg-[#0c0c0e] border border-white/[0.09] text-white text-xs rounded-xl px-3 py-2.5 focus:border-[#d4a437] focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    Unit of Measure
                  </label>
                  <select
                    value={itemForm.unitId}
                    onChange={(e) => setItemForm({ ...itemForm, unitId: e.target.value })}
                    required
                    className="w-full bg-[#0c0c0e] border border-white/[0.09] text-white text-xs rounded-xl px-3 py-2.5 focus:border-[#d4a437] focus:outline-none"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.symbol})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    Item Type
                  </label>
                  <select
                    value={itemForm.type}
                    onChange={(e) => setItemForm({ ...itemForm, type: e.target.value as ItemType })}
                    required
                    className="w-full bg-[#0c0c0e] border border-white/[0.09] text-white text-xs rounded-xl px-3 py-2.5 focus:border-[#d4a437] focus:outline-none"
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

              <div className="flex justify-end space-x-3 pt-4 border-t border-white/[0.06]">
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] border border-white/[0.1] rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Physical Stock Count Adjustment</h3>
            <p className="text-xs text-neutral-400">
              Item: <span className="font-bold text-white">{adjustTarget.itemName}</span> | System Qty: <span className="font-mono text-[#d4a437]">{adjustTarget.currentQty}</span>
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

              <div className="flex justify-end space-x-3 pt-3 border-t border-white/[0.06]">
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] border border-white/[0.1] rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Create Product Category</h3>
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
              <div className="flex justify-end space-x-3 pt-3 border-t border-white/[0.06]">
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] border border-white/[0.1] rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Create Storage Location</h3>
            <form onSubmit={handleSaveWarehouse} className="space-y-4">
              <Input
                label="Location Name"
                value={warehouseForm.name}
                onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                placeholder="e.g. Kitchen Cold Storage"
                required
              />
              <Input
                label="Location Code"
                value={warehouseForm.code}
                onChange={(e) => setWarehouseForm({ ...warehouseForm, code: e.target.value })}
                placeholder="e.g. WH-KITCHEN-02"
                required
              />
              <label className="flex items-center space-x-2 cursor-pointer text-xs text-neutral-300">
                <input
                  type="checkbox"
                  checked={warehouseForm.isCentral}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, isCentral: e.target.checked })}
                  className="rounded border-white/[0.2] bg-[#0c0c0e] text-[#d4a437]"
                />
                <span>Is Main Central Warehouse</span>
              </label>
              <div className="flex justify-end space-x-3 pt-3 border-t border-white/[0.06]">
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
