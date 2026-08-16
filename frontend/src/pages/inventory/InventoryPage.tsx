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
  X,
  ClipboardCheck,
  TrendingDown,
  CheckCircle
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
  const [activeTab, setActiveTab] = useState<
    'items' | 'stocks' | 'ledger' | 'transfer' | 'wastage' | 'stock-count' | 'warehouses'
  >('items');

  // Master Data
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<StockLedgerEntry[]>([]);
  const [wastageEntries, setWastageEntries] = useState<StockLedgerEntry[]>([]);
  const [stockCountHistory, setStockCountHistory] = useState<StockLedgerEntry[]>([]);

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
  const [_totalPages, setTotalPages] = useState<number>(1);

  // Modals
  const [showItemModal, setShowItemModal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [showWarehouseModal, setShowWarehouseModal] = useState<boolean>(false);
  const [showAdjustModal, setShowAdjustModal] = useState<boolean>(false);
  const [showWastageModal, setShowWastageModal] = useState<boolean>(false);
  const [showStockCountModal, setShowStockCountModal] = useState<boolean>(false);
  const [adjustTarget, setAdjustTarget] = useState<{
    warehouseId: string;
    itemId: string;
    itemName: string;
    currentQty: number;
  } | null>(null);

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

  // Wastage Form State (PART 12)
  const [wastageForm, setWastageForm] = useState<{
    warehouseId: string;
    wastageType:
      | 'EXPIRED'
      | 'SPOILED'
      | 'DAMAGED'
      | 'WRONG_PREPARATION'
      | 'OVERPRODUCTION'
      | 'RETURNED_DISCARDED'
      | 'PRODUCTION_LOSS';
    reason: string;
    notes: string;
    items: Array<{ itemId: string; quantity: number; batchNumber: string; reason: string }>;
  }>({
    warehouseId: '',
    wastageType: 'SPOILED',
    reason: '',
    notes: '',
    items: [{ itemId: '', quantity: 1, batchNumber: '', reason: '' }]
  });
  const [isSubmittingWastage, setIsSubmittingWastage] = useState(false);

  // Stock Count Form State (PART 16)
  const [stockCountWarehouse, setStockCountWarehouse] = useState<string>('');
  const [stockCountNotes, setStockCountNotes] = useState<string>('');
  const [stockCountLines, setStockCountLines] = useState<Array<{ itemId: string; countedQty: number; notes: string }>>([
    { itemId: '', countedQty: 0, notes: '' }
  ]);
  const [isSubmittingStockCount, setIsSubmittingStockCount] = useState(false);

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
        if (!wastageForm.warehouseId) setWastageForm((prev) => ({ ...prev, warehouseId: whList[0].id }));
        if (!stockCountWarehouse) setStockCountWarehouse(whList[0].id);
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Failed to load master metadata');
    }
  }, [transferFromWh, transferToWh, wastageForm.warehouseId, stockCountWarehouse]);

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
      } else if (activeTab === 'wastage') {
        const res = await inventoryApi.getWastageRecords({
          warehouseId: selectedWarehouse || undefined,
          page,
          limit: 20
        });
        setWastageEntries(res.entries);
        setTotalPages(res.pagination?.totalPages || 1);
      } else if (activeTab === 'stock-count') {
        const res = await inventoryApi.getStockCountHistory({
          warehouseId: selectedWarehouse || undefined
        });
        setStockCountHistory(res);
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
      setSuccessMsg('Category created successfully');
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
      setSuccessMsg('Storage location created successfully');
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

  // Wastage Submission (PART 12)
  const handleSaveWastage = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = wastageForm.items.filter((i) => i.itemId && i.quantity > 0);
    if (validItems.length === 0) {
      setErrorMsg('Please specify at least one valid item and quantity for wastage recording.');
      return;
    }
    if (!wastageForm.warehouseId) {
      setErrorMsg('Please select a storage warehouse.');
      return;
    }
    if (!wastageForm.reason.trim()) {
      setErrorMsg('Please provide a reason for the wastage.');
      return;
    }

    setIsSubmittingWastage(true);
    setErrorMsg(null);
    try {
      const result = await inventoryApi.recordWastage({
        warehouseId: wastageForm.warehouseId,
        wastageType: wastageForm.wastageType,
        reason: wastageForm.reason,
        notes: wastageForm.notes,
        items: validItems
      });

      setSuccessMsg(
        result.requiresApproval
          ? `Wastage #${result.wastage.adjustmentNumber} exceeds threshold ($500) and submitted for manager approval.`
          : `Wastage #${result.wastage.adjustmentNumber} recorded, stock deducted & GL loss entry posted.`
      );
      setShowWastageModal(false);
      setWastageForm({
        warehouseId: warehouses[0]?.id || '',
        wastageType: 'SPOILED',
        reason: '',
        notes: '',
        items: [{ itemId: '', quantity: 1, batchNumber: '', reason: '' }]
      });
      loadTabData();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Failed to record wastage.');
    } finally {
      setIsSubmittingWastage(false);
    }
  };

  // Stock Count Physical Reconciliation (PART 16)
  const handleSaveStockCount = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = stockCountLines.filter((l) => l.itemId && l.countedQty >= 0);
    if (validItems.length === 0) {
      setErrorMsg('Please specify at least one item with a valid physical count.');
      return;
    }
    if (!stockCountWarehouse) {
      setErrorMsg('Please select a store/warehouse to audit.');
      return;
    }

    setIsSubmittingStockCount(true);
    setErrorMsg(null);
    try {
      const result = await inventoryApi.reconcileStockCount({
        warehouseId: stockCountWarehouse,
        notes: stockCountNotes,
        countedItems: validItems
      });

      setSuccessMsg(
        result.requiresApproval
          ? `Physical count #${result.countNumber} variance exceeds threshold and is routed for approval.`
          : `Physical count #${result.countNumber} reconciled and inventory ledger adjusted successfully.`
      );
      setShowStockCountModal(false);
      setStockCountLines([{ itemId: '', countedQty: 0, notes: '' }]);
      setStockCountNotes('');
      loadTabData();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Failed to reconcile physical count.');
    } finally {
      setIsSubmittingStockCount(false);
    }
  };

  // Compute live estimated wastage value in modal
  const estimatedWastageValue = wastageForm.items.reduce((total, line) => {
    const item = items.find((it) => it.id === line.itemId);
    return total + (item ? Number(item.costPrice) * (Number(line.quantity) || 0) : 0);
  }, 0);

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
          {activeTab === 'wastage' && (
            <Button
              variant="primary"
              size="md"
              leftIcon={<TrendingDown className="w-4 h-4" />}
              onClick={() => setShowWastageModal(true)}
              className="w-full sm:w-auto"
            >
              Record Wastage & Loss
            </Button>
          )}
          {activeTab === 'stock-count' && (
            <Button
              variant="primary"
              size="md"
              leftIcon={<ClipboardCheck className="w-4 h-4" />}
              onClick={() => setShowStockCountModal(true)}
              className="w-full sm:w-auto"
            >
              New Physical Count Audit
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
          onClick={() => {
            setActiveTab('items');
            setPage(1);
          }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'items'
              ? 'bg-[#d4a437]/15 text-[#d4a437] border border-[#d4a437]/30 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Items & Products ({items.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('stocks');
            setPage(1);
          }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'stocks'
              ? 'bg-[#d4a437]/15 text-[#d4a437] border border-[#d4a437]/30 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Stock Balances & Alerts</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('ledger');
            setPage(1);
          }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'ledger'
              ? 'bg-[#d4a437]/15 text-[#d4a437] border border-[#d4a437]/30 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Movement Ledger</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('transfer');
          }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'transfer'
              ? 'bg-[#d4a437]/15 text-[#d4a437] border border-[#d4a437]/30 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
          }`}
        >
          <ArrowLeftRight className="w-4 h-4" />
          <span>Store Transfer (PART 17)</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('wastage');
            setPage(1);
          }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'wastage'
              ? 'bg-[#d4a437]/15 text-[#d4a437] border border-[#d4a437]/30 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          <span>Wastage & Loss (PART 12)</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('stock-count');
          }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'stock-count'
              ? 'bg-[#d4a437]/15 text-[#d4a437] border border-[#d4a437]/30 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>Stock Count & Audit (PART 16)</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('warehouses');
          }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'warehouses'
              ? 'bg-[#d4a437]/15 text-[#d4a437] border border-[#d4a437]/30 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
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

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-[#0c0c0e] border border-white/[0.09] text-neutral-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#d4a437]"
            >
              <option value="">All Product Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-[#0c0c0e] border border-white/[0.09] text-neutral-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#d4a437]"
            >
              <option value="">All Item Types</option>
              <option value="RAW_MATERIAL">Raw Materials</option>
              <option value="FINISHED_GOOD">Finished Dishes / Goods</option>
              <option value="SEMI_FINISHED">Semi-Finished Preps</option>
              <option value="PACKAGING">Packaging & Consumables</option>
            </select>
          </div>

          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02] text-neutral-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="p-4">SKU / Code</th>
                    <th className="p-4">Item Details</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Unit</th>
                    <th className="p-4 text-right">Cost Price</th>
                    <th className="p-4 text-right">Selling Price</th>
                    <th className="p-4 text-center">Thresholds</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-neutral-500">
                        <div className="w-6 h-6 border-2 border-[#d4a437] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        Loading item catalog...
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-neutral-500">
                        No items found matching the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-4 font-mono font-bold text-[#d4a437]">{item.code}</td>
                        <td className="p-4">
                          <p className="font-bold text-white text-sm">{item.name}</p>
                          {item.description && <p className="text-[11px] text-neutral-400 mt-0.5">{item.description}</p>}
                        </td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-neutral-300 text-[10px]">
                            {item.category?.name || 'Uncategorized'}
                          </span>
                        </td>
                        <td className="p-4 font-semibold text-neutral-300">{item.unit?.symbol || 'Unit'}</td>
                        <td className="p-4 font-mono text-right text-white font-semibold">{formatINR(item.costPrice)}</td>
                        <td className="p-4 font-mono text-right text-[#3fbf6f] font-semibold">{formatINR(item.sellingPrice)}</td>
                        <td className="p-4 text-center text-neutral-400 text-[11px]">
                          Min: <span className="font-mono text-white">{item.minStockLevel}</span> | Reorder:{' '}
                          <span className="font-mono text-white">{item.reorderQty}</span>
                        </td>
                        <td className="p-4 text-center">
                          <Button size="sm" variant="outline" onClick={() => handleOpenEditItem(item)}>
                            <Edit2 className="w-3.5 h-3.5 mr-1" />
                            Edit
                          </Button>
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
      {/* TAB 2: STOCK BALANCES */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'stocks' && (
        <div className="space-y-4">
          <div className="bg-[#17171b] border border-white/[0.08] rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="bg-[#0c0c0e] border border-white/[0.09] text-neutral-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#d4a437]"
            >
              <option value="">All Storage Locations</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} {w.isCentral ? '(Central)' : ''}
                </option>
              ))}
            </select>

            <label className="flex items-center space-x-2.5 bg-[#0c0c0e] border border-white/[0.09] rounded-xl px-3.5 py-2.5 cursor-pointer text-xs text-neutral-300">
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={(e) => setLowStockOnly(e.target.checked)}
                className="rounded border-white/[0.2] bg-[#17171b] text-[#d4a437] focus:ring-0"
              />
              <span className="font-semibold text-[#e5544d] flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Low Stock Alerts Only
              </span>
            </label>
          </div>

          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02] text-neutral-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="p-4">Item SKU</th>
                    <th className="p-4">Item Name</th>
                    <th className="p-4">Storage Location</th>
                    <th className="p-4 text-right">Available Balance</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-neutral-500">
                        <div className="w-6 h-6 border-2 border-[#d4a437] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        Loading stock balances...
                      </td>
                    </tr>
                  ) : balances.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-neutral-500">
                        No stock balances available for this store.
                      </td>
                    </tr>
                  ) : (
                    balances.map((sb) => {
                      const qty = Number(sb.quantity);
                      const min = Number(sb.item?.minStockLevel || 0);
                      const isLow = qty <= min && min > 0;
                      const isOut = qty <= 0;

                      return (
                        <tr key={sb.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-4 font-mono font-bold text-[#d4a437]">{sb.item?.code}</td>
                          <td className="p-4">
                            <p className="font-bold text-white text-sm">{sb.item?.name}</p>
                            <p className="text-[11px] text-neutral-400">Unit: {sb.item?.unit?.symbol}</p>
                          </td>
                          <td className="p-4">
                            <span className="font-semibold text-neutral-300">{sb.warehouse?.name}</span>
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-base text-white">
                            {qty} <span className="text-xs font-normal text-neutral-400">{sb.item?.unit?.symbol}</span>
                          </td>
                          <td className="p-4 text-center">
                            {isOut ? (
                              <span className="px-2.5 py-1 rounded-full bg-[#e5544d]/15 text-[#e5544d] border border-[#e5544d]/30 text-[10px] font-bold uppercase tracking-wider">
                                Out of Stock
                              </span>
                            ) : isLow ? (
                              <span className="px-2.5 py-1 rounded-full bg-[#e5a33d]/15 text-[#e5a33d] border border-[#e5a33d]/30 text-[10px] font-bold uppercase tracking-wider">
                                Low Stock ({qty}/{min})
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-[#3fbf6f]/15 text-[#3fbf6f] border border-[#3fbf6f]/30 text-[10px] font-bold uppercase tracking-wider">
                                Healthy
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            <Button size="sm" variant="outline" onClick={() => handleOpenAdjust(sb)}>
                              Adjust
                            </Button>
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
      {/* TAB 3: MOVEMENT LEDGER */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02] text-neutral-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="p-4">Timestamp</th>
                    <th className="p-4">Location</th>
                    <th className="p-4">Item SKU & Name</th>
                    <th className="p-4">Movement Type</th>
                    <th className="p-4 text-right">Change Qty</th>
                    <th className="p-4 text-right">New Balance</th>
                    <th className="p-4">Reference & Notes</th>
                    <th className="p-4">Logged By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-neutral-500">
                        <div className="w-6 h-6 border-2 border-[#d4a437] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        Loading immutable ledger...
                      </td>
                    </tr>
                  ) : ledgerEntries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-neutral-500">
                        No stock movement records found.
                      </td>
                    </tr>
                  ) : (
                    ledgerEntries.map((log) => {
                      const change = Number(log.changeQty);
                      const isPositive = change > 0;
                      return (
                        <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-4 font-mono text-neutral-400 text-[11px]">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="p-4 font-semibold text-neutral-300">{log.warehouse?.name}</td>
                          <td className="p-4">
                            <p className="font-bold text-white">{log.item?.name}</p>
                            <p className="font-mono text-[10px] text-[#d4a437]">{log.item?.code}</p>
                          </td>
                          <td className="p-4">
                            <span className="px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[10px] font-bold">
                              {log.movementType}
                            </span>
                          </td>
                          <td
                            className={`p-4 text-right font-mono font-bold text-sm ${
                              isPositive ? 'text-[#3fbf6f]' : 'text-[#e5544d]'
                            }`}
                          >
                            {isPositive ? `+${change}` : change} {log.item?.unit?.symbol}
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-white text-sm">
                            {Number(log.balanceQty)} {log.item?.unit?.symbol}
                          </td>
                          <td className="p-4">
                            <span className="font-mono text-[10px] text-[#d4a437] font-semibold">
                              {log.referenceId || log.referenceType || '—'}
                            </span>
                            {log.notes && <p className="text-[11px] text-neutral-400 mt-0.5">{log.notes}</p>}
                          </td>
                          <td className="p-4 text-neutral-400">
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
      {/* TAB 4: WASTAGE & LOSS CONTROL (PART 12) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'wastage' && (
        <div className="space-y-4">
          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-[#e5544d]" />
                  <span>Wastage & Spoilage Incident Logs</span>
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Track expired, spoiled, damaged, overproduction, and preparation write-downs with automated General
                  Ledger Loss postings.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setShowWastageModal(true)}
              >
                Record Wastage
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02] text-neutral-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="p-4">Reference / Date</th>
                    <th className="p-4">Store Location</th>
                    <th className="p-4">Item SKU & Name</th>
                    <th className="p-4 text-right">Discarded Qty</th>
                    <th className="p-4 text-right">Loss Valuation</th>
                    <th className="p-4">Wastage Reason & Batch</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-neutral-500">
                        <div className="w-6 h-6 border-2 border-[#d4a437] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        Loading wastage audit logs...
                      </td>
                    </tr>
                  ) : wastageEntries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-neutral-500">
                        <TrendingDown className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                        <p className="font-semibold text-neutral-300">No Wastage or Loss Incidents Recorded</p>
                        <p className="text-xs text-neutral-500 mt-1">
                          All store inventories are balanced. Click "Record Wastage" to log any spoiled or expired items.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    wastageEntries.map((log) => (
                      <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-4">
                          <p className="font-mono font-bold text-[#d4a437]">{log.referenceId}</p>
                          <p className="text-[10px] text-neutral-400">{new Date(log.createdAt).toLocaleString()}</p>
                        </td>
                        <td className="p-4 font-semibold text-neutral-300">{log.warehouse?.name}</td>
                        <td className="p-4">
                          <p className="font-bold text-white">{log.item?.name}</p>
                          <p className="font-mono text-[10px] text-neutral-400">{log.item?.code}</p>
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-[#e5544d] text-sm">
                          {log.changeQty} {log.item?.unit?.symbol}
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-white text-sm">
                          {formatINR(log.totalCost)}
                        </td>
                        <td className="p-4">
                          <p className="text-neutral-300 font-medium">{log.notes || 'Routine discard'}</p>
                          {log.batchNumber && (
                            <span className="font-mono text-[10px] text-[#d4a437] bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/[0.06] mt-0.5 inline-block">
                              Batch: {log.batchNumber}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <span className="px-2.5 py-0.5 rounded-full bg-[#3fbf6f]/15 text-[#3fbf6f] border border-[#3fbf6f]/30 text-[10px] font-bold uppercase">
                            APPLIED
                          </span>
                        </td>
                        <td className="p-4 text-neutral-400">
                          {log.createdBy ? `${log.createdBy.firstName} ${log.createdBy.lastName || ''}` : 'System'}
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
      {/* TAB 5: PHYSICAL STOCK COUNT AUDIT (PART 16) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'stock-count' && (
        <div className="space-y-4">
          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-[#d4a437]" />
                  <span>Physical Inventory Count & Audit Discrepancies</span>
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Periodic physical counts compared to system stock. Variances update ledger and post shrinkage/surplus
                  journal entries.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setShowStockCountModal(true)}
              >
                New Audit Count
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02] text-neutral-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="p-4">Count Audit #</th>
                    <th className="p-4">Location</th>
                    <th className="p-4">Item Details</th>
                    <th className="p-4 text-right">Variance Qty</th>
                    <th className="p-4 text-right">Variance Value</th>
                    <th className="p-4">Audit Notes</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4">Audited By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-neutral-500">
                        <div className="w-6 h-6 border-2 border-[#d4a437] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        Loading stock count history...
                      </td>
                    </tr>
                  ) : stockCountHistory.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-neutral-500">
                        <ClipboardCheck className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                        <p className="font-semibold text-neutral-300">No Physical Stock Counts Performed Yet</p>
                        <p className="text-xs text-neutral-500 mt-1">
                          Perform periodic audits to ensure shelf stock matches the digital inventory ledger.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    stockCountHistory.map((log) => {
                      const change = Number(log.changeQty);
                      const isGain = change > 0;
                      return (
                        <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-4">
                            <p className="font-mono font-bold text-[#d4a437]">{log.referenceId}</p>
                            <p className="text-[10px] text-neutral-400">{new Date(log.createdAt).toLocaleString()}</p>
                          </td>
                          <td className="p-4 font-semibold text-neutral-300">{log.warehouse?.name}</td>
                          <td className="p-4">
                            <p className="font-bold text-white">{log.item?.name}</p>
                            <p className="font-mono text-[10px] text-neutral-400">{log.item?.code}</p>
                          </td>
                          <td
                            className={`p-4 text-right font-mono font-bold text-sm ${
                              isGain ? 'text-[#3fbf6f]' : 'text-[#e5544d]'
                            }`}
                          >
                            {isGain ? `+${change}` : change} {log.item?.unit?.symbol}
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-white text-sm">
                            {formatINR(log.totalCost)}
                          </td>
                          <td className="p-4 text-neutral-300">{log.notes || 'Count audit adjustment'}</td>
                          <td className="p-4 text-center">
                            <span className="px-2.5 py-0.5 rounded-full bg-[#3fbf6f]/15 text-[#3fbf6f] border border-[#3fbf6f]/30 text-[10px] font-bold uppercase">
                              RECONCILED
                            </span>
                          </td>
                          <td className="p-4 text-neutral-400">
                            {log.createdBy ? `${log.createdBy.firstName} ${log.createdBy.lastName || ''}` : 'Auditor'}
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
      {/* TAB 6: STORE STOCK TRANSFER (PART 17) */}
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
                Atomic database transaction decreases source store and increases destination store simultaneously.
                Non-negative stock rules strictly enforced.
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
                  <div
                    key={idx}
                    className="flex items-center space-x-3 bg-[#0c0c0e] p-3 rounded-2xl border border-white/[0.06]"
                  >
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
      {/* TAB 7: STORES & CATEGORIES */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'warehouses' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  <div
                    key={w.id}
                    className="p-4 bg-[#0c0c0e] rounded-2xl border border-white/[0.06] flex items-center justify-between"
                  >
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
                  <div
                    key={c.id}
                    className="p-4 bg-[#0c0c0e] rounded-2xl border border-white/[0.06] flex items-center justify-between"
                  >
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
      {/* MODAL: RECORD WASTAGE (PART 12) */}
      {/* ------------------------------------------------------------- */}
      {showWastageModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] border border-white/[0.1] rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-[#e5544d]" />
                  <span>Record Wastage & Loss Incident</span>
                </h3>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Deducts inventory stock and generates double-entry GL loss expense postings.
                </p>
              </div>
              <button onClick={() => setShowWastageModal(false)} className="text-neutral-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWastage} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    Storage Location *
                  </label>
                  <select
                    value={wastageForm.warehouseId}
                    onChange={(e) => setWastageForm({ ...wastageForm, warehouseId: e.target.value })}
                    required
                    className="w-full bg-[#0c0c0e] border border-white/[0.09] text-white text-xs rounded-xl px-3.5 py-2.5 focus:border-[#d4a437] focus:outline-none"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} {w.isCentral ? '(Central)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    Wastage Classification *
                  </label>
                  <select
                    value={wastageForm.wastageType}
                    onChange={(e) =>
                      setWastageForm({ ...wastageForm, wastageType: e.target.value as any })
                    }
                    required
                    className="w-full bg-[#0c0c0e] border border-white/[0.09] text-white text-xs rounded-xl px-3.5 py-2.5 focus:border-[#d4a437] focus:outline-none"
                  >
                    <option value="SPOILED">Spoiled / Curdled / Soured</option>
                    <option value="EXPIRED">Expired Past Shelf Life</option>
                    <option value="DAMAGED">Damaged in Handling / Storage</option>
                    <option value="WRONG_PREPARATION">Wrong Kitchen Preparation</option>
                    <option value="OVERPRODUCTION">Excess Overproduction</option>
                    <option value="RETURNED_DISCARDED">Returned by Guest & Discarded</option>
                    <option value="PRODUCTION_LOSS">Production Trim / Peeling Loss</option>
                  </select>
                </div>
              </div>

              <div>
                <Input
                  label="Primary Reason / Explanation *"
                  value={wastageForm.reason}
                  onChange={(e) => setWastageForm({ ...wastageForm, reason: e.target.value })}
                  placeholder="e.g. Refrigerator condenser fault led to curdled dairy batch"
                  required
                />
              </div>

              {/* Items Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Discarded Items</span>
                  <button
                    type="button"
                    onClick={() =>
                      setWastageForm({
                        ...wastageForm,
                        items: [...wastageForm.items, { itemId: '', quantity: 1, batchNumber: '', reason: '' }]
                      })
                    }
                    className="text-xs text-[#d4a437] hover:text-[#b88c2c] font-semibold flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                {wastageForm.items.map((line, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 bg-[#0c0c0e] p-3 rounded-2xl border border-white/[0.06] items-center"
                  >
                    <div className="col-span-12 sm:col-span-5">
                      <select
                        value={line.itemId}
                        onChange={(e) => {
                          const copy = [...wastageForm.items];
                          copy[idx].itemId = e.target.value;
                          setWastageForm({ ...wastageForm, items: copy });
                        }}
                        required
                        className="w-full bg-[#17171b] border border-white/[0.09] text-white text-xs rounded-xl px-3 py-2 focus:border-[#d4a437] focus:outline-none"
                      >
                        <option value="">Select Item</option>
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name} ({formatINR(it.costPrice)}/{it.unit?.symbol})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-6 sm:col-span-3">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={line.quantity}
                        onChange={(e) => {
                          const copy = [...wastageForm.items];
                          copy[idx].quantity = parseFloat(e.target.value) || 0;
                          setWastageForm({ ...wastageForm, items: copy });
                        }}
                        placeholder="Quantity"
                        required
                        className="w-full bg-[#17171b] border border-white/[0.09] text-white text-xs rounded-xl px-3 py-2 font-mono text-right focus:border-[#d4a437] focus:outline-none"
                      />
                    </div>

                    <div className="col-span-5 sm:col-span-3">
                      <input
                        type="text"
                        value={line.batchNumber}
                        onChange={(e) => {
                          const copy = [...wastageForm.items];
                          copy[idx].batchNumber = e.target.value;
                          setWastageForm({ ...wastageForm, items: copy });
                        }}
                        placeholder="Batch # (opt)"
                        className="w-full bg-[#17171b] border border-white/[0.09] text-white text-xs rounded-xl px-3 py-2 font-mono focus:border-[#d4a437] focus:outline-none"
                      />
                    </div>

                    <div className="col-span-1 text-center">
                      {wastageForm.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setWastageForm({
                              ...wastageForm,
                              items: wastageForm.items.filter((_, i) => i !== idx)
                            })
                          }
                          className="text-neutral-500 hover:text-[#e5544d] p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Threshold & Valuation Badge */}
              <div className="bg-[#0c0c0e] border border-white/[0.06] rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-neutral-400 uppercase tracking-wider font-semibold">
                    Estimated Loss Valuation
                  </p>
                  <p className="text-lg font-bold font-mono text-white mt-0.5">{formatINR(estimatedWastageValue)}</p>
                </div>
                <div>
                  {estimatedWastageValue > 500 ? (
                    <span className="px-3 py-1 rounded-full bg-[#e5a33d]/15 text-[#e5a33d] border border-[#e5a33d]/30 text-xs font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> Requires Manager Authorization (&gt; ₹500)
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-[#3fbf6f]/15 text-[#3fbf6f] border border-[#3fbf6f]/30 text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5" /> Auto-Applied Under Threshold (&le; ₹500)
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-white/[0.06]">
                <Button type="button" variant="ghost" onClick={() => setShowWastageModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={isSubmittingWastage}>
                  Confirm & Post Wastage
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: PHYSICAL STOCK COUNT AUDIT (PART 16) */}
      {/* ------------------------------------------------------------- */}
      {showStockCountModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] border border-white/[0.1] rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-[#d4a437]" />
                  <span>Physical Inventory Count & Audit</span>
                </h3>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Record physical on-hand quantities. Variances automatically generate balance adjustments & shrinkage
                  postings.
                </p>
              </div>
              <button onClick={() => setShowStockCountModal(false)} className="text-neutral-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStockCount} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300">
                  Audited Location *
                </label>
                <select
                  value={stockCountWarehouse}
                  onChange={(e) => setStockCountWarehouse(e.target.value)}
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

              {/* Items Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Physical Counted Items
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setStockCountLines([
                        ...stockCountLines,
                        { itemId: '', countedQty: 0, notes: '' }
                      ])
                    }
                    className="text-xs text-[#d4a437] hover:text-[#b88c2c] font-semibold flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                {stockCountLines.map((line, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 bg-[#0c0c0e] p-3 rounded-2xl border border-white/[0.06] items-center"
                  >
                    <div className="col-span-12 sm:col-span-6">
                      <select
                        value={line.itemId}
                        onChange={(e) => {
                          const copy = [...stockCountLines];
                          copy[idx].itemId = e.target.value;
                          setStockCountLines(copy);
                        }}
                        required
                        className="w-full bg-[#17171b] border border-white/[0.09] text-white text-xs rounded-xl px-3 py-2 focus:border-[#d4a437] focus:outline-none"
                      >
                        <option value="">Select Item</option>
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name} ({it.code}) - {it.unit?.symbol}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-6 sm:col-span-3">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={line.countedQty}
                        onChange={(e) => {
                          const copy = [...stockCountLines];
                          copy[idx].countedQty = parseFloat(e.target.value) || 0;
                          setStockCountLines(copy);
                        }}
                        placeholder="Physical Qty"
                        required
                        className="w-full bg-[#17171b] border border-white/[0.09] text-white text-xs rounded-xl px-3 py-2 font-mono text-right focus:border-[#d4a437] focus:outline-none"
                      />
                    </div>

                    <div className="col-span-5 sm:col-span-2">
                      <input
                        type="text"
                        value={line.notes}
                        onChange={(e) => {
                          const copy = [...stockCountLines];
                          copy[idx].notes = e.target.value;
                          setStockCountLines(copy);
                        }}
                        placeholder="Audit notes"
                        className="w-full bg-[#17171b] border border-white/[0.09] text-white text-xs rounded-xl px-3 py-2 focus:border-[#d4a437] focus:outline-none"
                      />
                    </div>

                    <div className="col-span-1 text-center">
                      {stockCountLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setStockCountLines(stockCountLines.filter((_, i) => i !== idx))
                          }
                          className="text-neutral-500 hover:text-[#e5544d] p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <Input
                  label="Audit Session Notes"
                  value={stockCountNotes}
                  onChange={(e) => setStockCountNotes(e.target.value)}
                  placeholder="e.g. Scheduled bi-weekly physical stock audit"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-white/[0.06]">
                <Button type="button" variant="ghost" onClick={() => setShowStockCountModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={isSubmittingStockCount}>
                  Reconcile & Update Balances
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
              Item: <span className="font-bold text-white">{adjustTarget.itemName}</span> | System Qty:{' '}
              <span className="font-mono text-[#d4a437]">{adjustTarget.currentQty}</span>
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
                <Button type="button" variant="ghost" onClick={() => setShowCategoryModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Create
                </Button>
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
                <Button type="button" variant="ghost" onClick={() => setShowWarehouseModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Create
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;
