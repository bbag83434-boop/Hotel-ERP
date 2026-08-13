import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Utensils,
  Flame,
  Grid,
  Plus,
  RefreshCw,
  Search,
  Clock,
  DollarSign,
  Receipt,
  Percent,
  TrendingUp,
  Layers,
  ChefHat,
  Smartphone,
  CreditCard,
  Banknote,
  Send,
  GitMerge,
  Users
} from 'lucide-react';
import { restaurantApi } from '../../api/restaurant.api';
import { productionApi } from '../../api/production.api';
import {
  DiningTable,
  MenuItem,
  MenuCategory,
  RestaurantOrder,
  KitchenTicket,
  SalesAnalytics
} from '../../types/restaurant.types';
import { Recipe } from '../../types/production.types';
import { formatINR } from '../../utils/formatters';

interface BranchOption {
  id: string;
  name: string;
  code: string;
  type?: string;
}

export const RestaurantPOSPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tables' | 'pos' | 'kds' | 'menu' | 'sales'>('pos');
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Table Floor Plan States
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('ALL');
  const [isNewTableModalOpen, setIsNewTableModalOpen] = useState(false);
  const [newTableData, setNewTableData] = useState({ tableNumber: '', name: '', capacity: 4, section: 'Main Dining' });
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');

  // POS Menu & Cart States
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [searchItem, setSearchItem] = useState<string>('');
  const [cartItems, setCartItems] = useState<Array<{ menuItem: MenuItem; quantity: number; notes: string }>>([]);
  const [posTableId, setPosTableId] = useState<string>('');
  const [posOrderType, setPosOrderType] = useState<string>('DINE_IN');
  const [posGuestCount, setPosGuestCount] = useState<number>(2);
  const [posCustomerName, setPosCustomerName] = useState<string>('');
  const [posOrderNotes, setPosOrderNotes] = useState<string>('');
  const [activeOrder, setActiveOrder] = useState<RestaurantOrder | null>(null);

  // KDS States
  const [kitchenTickets, setKitchenTickets] = useState<KitchenTicket[]>([]);
  const [selectedKdsStation, setSelectedKdsStation] = useState<string>('ALL');
  const [kdsAutoRefresh, setKdsAutoRefresh] = useState<boolean>(true);

  // Checkout & Discount States
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [receivedCash, setReceivedCash] = useState<string>('');
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState<boolean>(false);
  const [discountType, setDiscountType] = useState<string>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState<number>(10);
  const [discountReason, setDiscountReason] = useState<string>('Valued Guest Courtesy');
  const [activeDiscountAmount, setActiveDiscountAmount] = useState<number>(0);
  const [lastInvoiceNumber, setLastInvoiceNumber] = useState<string | null>(null);

  // Menu Management States
  const [isNewMenuItemModalOpen, setIsNewMenuItemModalOpen] = useState<boolean>(false);
  const [recipesList, setRecipesList] = useState<Recipe[]>([]);
  const [newMenuItemData, setNewMenuItemData] = useState({
    menuId: '',
    categoryId: '',
    recipeId: '',
    name: '',
    code: '',
    description: '',
    price: 15.0,
    taxRate: 5.0,
    kitchenStation: 'MAIN_KITCHEN',
    preparationMinutes: 15
  });

  // Sales Analytics States
  const [salesAnalytics, setSalesAnalytics] = useState<SalesAnalytics | null>(null);

  // Initial Load
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const [branchList, recipes] = await Promise.all([
          restaurantApi.getBranches().catch(() => [
            { id: 'mock-branch', name: 'Royal Rasoi Multi-Cuisine Restaurant', code: 'BR-REST-01', type: 'RESTAURANT' }
          ]),
          productionApi.getRecipes()
        ]);
        setBranches(branchList);
        setRecipesList(recipes.recipes || []);

        const restBr = branchList.find((b: BranchOption) => b.type === 'RESTAURANT') || branchList[0];
        if (restBr) {
          setSelectedBranchId(restBr.id);
        }
      } catch (err: any) {
        setErrorMsg(err.response?.data?.message || 'Failed to load restaurant initial data');
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  // Fetch branch-specific data
  const loadBranchData = useCallback(async (branchId: string) => {
    if (!branchId) return;
    try {
      setErrorMsg(null);
      const [tableList, menus, items, tickets, analytics] = await Promise.all([
        restaurantApi.getTables(branchId),
        restaurantApi.getMenus(branchId),
        restaurantApi.getMenuItems(),
        restaurantApi.getKitchenTickets({ branchId }),
        restaurantApi.getSalesAnalytics({ branchId })
      ]);
      setTables(tableList);
      setMenuItems(items);
      setKitchenTickets(tickets);
      setSalesAnalytics(analytics);

      if (menus.length > 0 && menus[0].categories) {
        setCategories(menus[0].categories);
        if (!newMenuItemData.menuId) {
          setNewMenuItemData((prev) => ({
            ...prev,
            menuId: menus[0].id,
            categoryId: menus[0].categories[0]?.id || ''
          }));
        }
      }
    } catch (err: any) {
      console.error(err);
    }
  }, [newMenuItemData.menuId]);

  useEffect(() => {
    if (selectedBranchId) {
      loadBranchData(selectedBranchId);
    }
  }, [selectedBranchId, loadBranchData]);

  // KDS Auto Polling
  useEffect(() => {
    if (!kdsAutoRefresh || !selectedBranchId || activeTab !== 'kds') return;
    const interval = setInterval(() => {
      restaurantApi.getKitchenTickets({ branchId: selectedBranchId }).then(setKitchenTickets).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [kdsAutoRefresh, selectedBranchId, activeTab]);

  // Cart Calculations
  const cartSubtotal = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + Number(item.menuItem.price) * item.quantity, 0);
  }, [cartItems]);

  const cartTax = useMemo(() => {
    return cartSubtotal * 0.05; // 5% Standard Tax
  }, [cartSubtotal]);

  const cartGrandTotal = useMemo(() => {
    const total = cartSubtotal + cartTax - activeDiscountAmount;
    return Math.max(0, total);
  }, [cartSubtotal, cartTax, activeDiscountAmount]);

  // Add Item to Cart
  const handleAddToCart = (menuItem: MenuItem) => {
    setCartItems((prev) => {
      const idx = prev.findIndex((i) => i.menuItem.id === menuItem.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx].quantity += 1;
        return copy;
      }
      return [...prev, { menuItem, quantity: 1, notes: '' }];
    });
  };

  const handleUpdateQty = (itemId: string, delta: number) => {
    setCartItems((prev) => {
      return prev
        .map((item) => {
          if (item.menuItem.id === itemId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as Array<{ menuItem: MenuItem; quantity: number; notes: string }>;
    });
  };

  // Open Table in POS Terminal
  const handleSelectTableForOrder = (table: DiningTable) => {
    setPosTableId(table.id);
    setPosOrderType('DINE_IN');
    if (table.orders && table.orders.length > 0) {
      const ord = table.orders[0];
      setActiveOrder(ord);
      setCartItems(
        ord.items.map((it) => ({
          menuItem: it.menuItem,
          quantity: Number(it.quantity),
          notes: it.notes || ''
        }))
      );
    } else {
      setActiveOrder(null);
      setCartItems([]);
    }
    setActiveTab('pos');
  };

  // Send Order to Kitchen
  const handleSendToKitchen = async () => {
    if (cartItems.length === 0) {
      setErrorMsg('Cannot send an empty order');
      return;
    }
    try {
      setLoading(true);
      setErrorMsg(null);

      let orderId = activeOrder?.id;
      if (!orderId) {
        const newOrder = await restaurantApi.createOrder({
          branchId: selectedBranchId,
          tableId: posTableId || null,
          orderType: posOrderType,
          guestCount: posGuestCount,
          customerName: posCustomerName,
          notes: posOrderNotes,
          items: cartItems.map((c) => ({
            menuItemId: c.menuItem.id,
            quantity: c.quantity,
            notes: c.notes
          }))
        });
        orderId = newOrder.id;
        setActiveOrder(newOrder);
      }

      const kdsRes = await restaurantApi.sendOrderToKitchen(orderId);
      setSuccessMsg(`Order successfully sent to kitchen stations (${kdsRes.tickets.length} tickets created)!`);
      loadBranchData(selectedBranchId);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to send order to kitchen');
    } finally {
      setLoading(false);
    }
  };

  // Process Checkout / Settle Bill
  const handleCompleteCheckout = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      let orderId = activeOrder?.id;
      if (!orderId) {
        const newOrder = await restaurantApi.createOrder({
          branchId: selectedBranchId,
          tableId: posTableId || null,
          orderType: posOrderType,
          guestCount: posGuestCount,
          customerName: posCustomerName,
          notes: posOrderNotes,
          items: cartItems.map((c) => ({
            menuItemId: c.menuItem.id,
            quantity: c.quantity,
            notes: c.notes
          }))
        });
        orderId = newOrder.id;
      }

      if (activeDiscountAmount > 0) {
        await restaurantApi.applyDiscount(orderId, {
          discountType,
          rateOrAmount: discountValue,
          reason: discountReason
        });
      }

      const paymentRes = await restaurantApi.completeOrderCheckout(orderId, {
        paymentMethod,
        amount: cartGrandTotal,
        receivedAmount: receivedCash ? Number(receivedCash) : cartGrandTotal
      });

      setLastInvoiceNumber(paymentRes.invoiceNumber);
      setSuccessMsg(`Order settled! Invoice: ${paymentRes.invoiceNumber}. Kitchen inventory deducted automatically per Recipe BOM.`);
      setCartItems([]);
      setActiveOrder(null);
      setPosTableId('');
      setActiveDiscountAmount(0);
      setReceivedCash('');
      setIsCheckoutModalOpen(false);
      loadBranchData(selectedBranchId);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  // Update KDS Ticket Status
  const handleUpdateKdsStatus = async (ticketId: string, status: string) => {
    try {
      await restaurantApi.updateTicketStatus(ticketId, status);
      const tickets = await restaurantApi.getKitchenTickets({ branchId: selectedBranchId });
      setKitchenTickets(tickets);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to update ticket status');
    }
  };

  // Create New Dining Table
  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await restaurantApi.createTable({
        branchId: selectedBranchId,
        tableNumber: newTableData.tableNumber,
        name: newTableData.name,
        capacity: Number(newTableData.capacity),
        section: newTableData.section
      });
      setIsNewTableModalOpen(false);
      setNewTableData({ tableNumber: '', name: '', capacity: 4, section: 'Main Dining' });
      setSuccessMsg('New dining table added');
      loadBranchData(selectedBranchId);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to create table');
    } finally {
      setLoading(false);
    }
  };

  // Merge Tables
  const handleMergeTables = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergeSourceId || !mergeTargetId) return;
    try {
      setLoading(true);
      await restaurantApi.mergeTables(mergeSourceId, mergeTargetId);
      setIsMergeModalOpen(false);
      setSuccessMsg('Tables merged successfully');
      loadBranchData(selectedBranchId);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to merge tables');
    } finally {
      setLoading(false);
    }
  };

  // Create Menu Item
  const handleCreateMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await restaurantApi.createMenuItem({
        ...newMenuItemData,
        price: Number(newMenuItemData.price),
        taxRate: Number(newMenuItemData.taxRate),
        preparationMinutes: Number(newMenuItemData.preparationMinutes),
        recipeId: newMenuItemData.recipeId || null
      });
      setIsNewMenuItemModalOpen(false);
      setSuccessMsg(`Menu item "${newMenuItemData.name}" created and linked to Recipe BOM`);
      loadBranchData(selectedBranchId);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to create menu item');
    } finally {
      setLoading(false);
    }
  };

  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchCat = selectedCategoryId === 'ALL' || item.categoryId === selectedCategoryId;
      const matchSearch =
        searchItem === '' ||
        item.name.toLowerCase().includes(searchItem.toLowerCase()) ||
        item.code.toLowerCase().includes(searchItem.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [menuItems, selectedCategoryId, searchItem]);

  const filteredTables = useMemo(() => {
    return tables.filter((t) => selectedSection === 'ALL' || t.section === selectedSection);
  }, [tables, selectedSection]);

  const uniqueSections = useMemo(() => {
    return Array.from(new Set(tables.map((t) => t.section)));
  }, [tables]);

  const filteredTickets = useMemo(() => {
    return kitchenTickets.filter((t) => selectedKdsStation === 'ALL' || t.station === selectedKdsStation);
  }, [kitchenTickets, selectedKdsStation]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
              <Utensils className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Restaurant Operations & POS</h1>
              <p className="text-sm text-slate-500">
                Touch-Optimized POS, Live Table Floor Plan, Kitchen Display (KDS), and Recipe-Connected Sales
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <Layers className="w-4 h-4 text-slate-400" />
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-700 focus:outline-none"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => loadBranchData(selectedBranchId)}
            className="p-2 text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700 font-bold ml-4">✕</button>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 font-bold ml-4">✕</button>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('pos')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition ${
            activeTab === 'pos'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-200'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          Fast POS Terminal
        </button>

        <button
          onClick={() => setActiveTab('tables')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition ${
            activeTab === 'tables'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-200'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Grid className="w-4 h-4" />
          Table Floor Plan ({tables.length})
        </button>

        <button
          onClick={() => setActiveTab('kds')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition relative ${
            activeTab === 'kds'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-200'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <ChefHat className="w-4 h-4" />
          Kitchen Display (KDS)
          {kitchenTickets.length > 0 && (
            <span className="ml-1.5 px-2 py-0.5 text-xs bg-amber-400 text-slate-950 font-bold rounded-full">
              {kitchenTickets.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('menu')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition ${
            activeTab === 'menu'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-200'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Utensils className="w-4 h-4" />
          Menu & Recipe BOM
        </button>

        <button
          onClick={() => setActiveTab('sales')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition ${
            activeTab === 'sales'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-200'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Sales & Food Cost Analytics
        </button>
      </div>

      {/* ========================================================== */}
      {/* TAB 1: FAST POS TOUCH TERMINAL */}
      {/* ========================================================== */}
      {activeTab === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Categories & Menu Item Cards */}
          <div className="lg:col-span-2 space-y-4">
            {/* Search & Category Pills */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
              <div className="relative">
                <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Search dishes by name or code (e.g. Margherita, Ribeye)..."
                  value={searchItem}
                  onChange={(e) => setSearchItem(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setSelectedCategoryId('ALL')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                    selectedCategoryId === 'ALL'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All Items ({menuItems.length})
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                      selectedCategoryId === cat.id
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu Items Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-3">
              {filteredMenuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleAddToCart(item)}
                  className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-rose-300 hover:shadow-md transition text-left flex flex-col justify-between h-44 group relative overflow-hidden active:scale-95"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {item.code}
                      </span>
                      {item.recipe && (
                        <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded flex items-center gap-1">
                          <ChefHat className="w-2.5 h-2.5" /> BOM
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm line-clamp-2 group-hover:text-rose-600 transition">
                      {item.name}
                    </h3>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {item.preparationMinutes}m
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-medium">
                        {item.kitchenStation.replace('_STATION', '')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <span className="text-base font-extrabold text-slate-900">
                        {formatINR(item.price)}
                      </span>
                      <span className="p-1 bg-rose-50 text-rose-600 rounded-lg group-hover:bg-rose-600 group-hover:text-white transition">
                        <Plus className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right 1 Col: Live Fast Order Cart */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between h-full min-h-[580px]">
            <div className="space-y-4">
              {/* Order Info Bar */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-rose-600" />
                  <h2 className="font-bold text-slate-900">
                    {activeOrder ? `Order #${activeOrder.orderNumber}` : 'New Order'}
                  </h2>
                </div>

                {/* Table Picker */}
                <select
                  value={posTableId}
                  onChange={(e) => setPosTableId(e.target.value)}
                  className="text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
                >
                  <option value="">Counter / Takeaway</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name || `Table ${t.tableNumber}`} ({t.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Order Type & Guest Count */}
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
                  {['DINE_IN', 'TAKEAWAY', 'DELIVERY'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setPosOrderType(type)}
                      className={`py-1.5 rounded-lg transition ${
                        posOrderType === type ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
                      }`}
                    >
                      {type.replace('_', ' ')}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-slate-600 flex-1">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>Guests:</span>
                    <input
                      type="number"
                      min="1"
                      value={posGuestCount}
                      onChange={(e) => setPosGuestCount(Number(e.target.value))}
                      className="w-10 bg-transparent font-bold text-slate-900 focus:outline-none"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Guest Name (Optional)"
                    value={posCustomerName}
                    onChange={(e) => setPosCustomerName(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none"
                  />
                </div>

                <input
                  type="text"
                  placeholder="Order Kitchen Notes (e.g. VIP, allergy alerts)"
                  value={posOrderNotes}
                  onChange={(e) => setPosOrderNotes(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none"
                />
              </div>

              {/* Cart Items List */}
              <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
                {cartItems.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 space-y-2">
                    <Utensils className="w-8 h-8 mx-auto stroke-1" />
                    <p className="text-xs">Cart is empty. Tap items to add to ticket.</p>
                  </div>
                ) : (
                  cartItems.map((c) => (
                    <div
                      key={c.menuItem.id}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-slate-800 text-xs truncate">{c.menuItem.name}</h4>
                        <div className="text-[11px] text-slate-400">
                          {formatINR(c.menuItem.price)} each
                        </div>
                      </div>

                      {/* Qty Controls */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdateQty(c.menuItem.id, -1)}
                          className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100"
                        >
                          -
                        </button>
                        <span className="font-bold text-xs w-4 text-center">{c.quantity}</span>
                        <button
                          onClick={() => handleUpdateQty(c.menuItem.id, 1)}
                          className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-right font-bold text-slate-900 text-xs min-w-[50px]">
                        {formatINR(Number(c.menuItem.price) * c.quantity)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Cart Footer & Totals */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Taxable Subtotal</span>
                  <span className="font-semibold">{formatINR(cartSubtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>GST (CGST 2.5% + SGST 2.5%)</span>
                  <span className="font-semibold">{formatINR(cartTax)}</span>
                </div>
                {activeDiscountAmount > 0 && (
                  <div className="flex justify-between text-rose-600 font-semibold">
                    <span>Discount</span>
                    <span>-{formatINR(activeDiscountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-extrabold text-slate-900 pt-1 border-t border-slate-100">
                  <span>Grand Total</span>
                  <span>{formatINR(cartGrandTotal)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setIsDiscountModalOpen(true)}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <Percent className="w-3.5 h-3.5" /> Discount
                </button>

                <button
                  onClick={handleSendToKitchen}
                  disabled={cartItems.length === 0 || loading}
                  className="py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" /> Send to KDS
                </button>
              </div>

              <button
                onClick={() => setIsCheckoutModalOpen(true)}
                disabled={cartItems.length === 0 || loading}
                className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl text-sm shadow-md shadow-rose-200 flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                <DollarSign className="w-5 h-5" /> Settle Bill ({formatINR(cartGrandTotal)})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 2: TABLE FLOOR PLAN */}
      {/* ========================================================== */}
      {activeTab === 'tables' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            {/* Section Filters */}
            <div className="flex items-center gap-2 overflow-x-auto">
              <button
                onClick={() => setSelectedSection('ALL')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  selectedSection === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                All Sections
              </button>
              {uniqueSections.map((sec) => (
                <button
                  key={sec}
                  onClick={() => setSelectedSection(sec)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    selectedSection === sec ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {sec}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMergeModalOpen(true)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition"
              >
                <GitMerge className="w-4 h-4" /> Merge Tables
              </button>
              <button
                onClick={() => setIsNewTableModalOpen(true)}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm"
              >
                <Plus className="w-4 h-4" /> Add Table
              </button>
            </div>
          </div>

          {/* Tables Visual Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredTables.map((t) => {
              const isOccupied = t.status === 'OCCUPIED';
              const isCleaning = t.status === 'CLEANING';
              const isReserved = t.status === 'RESERVED';
              const activeOrd = t.orders?.[0];

              return (
                <div
                  key={t.id}
                  onClick={() => handleSelectTableForOrder(t)}
                  className={`p-4 rounded-2xl border transition text-left cursor-pointer flex flex-col justify-between h-48 relative shadow-sm ${
                    isOccupied
                      ? 'bg-amber-50/70 border-amber-300 hover:border-amber-400'
                      : isCleaning
                      ? 'bg-cyan-50/70 border-cyan-300 hover:border-cyan-400'
                      : isReserved
                      ? 'bg-purple-50/70 border-purple-300 hover:border-purple-400'
                      : 'bg-white border-slate-200 hover:border-rose-400 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-extrabold text-slate-900">{t.name || `Table ${t.tableNumber}`}</span>
                      <p className="text-[11px] text-slate-400">{t.section}</p>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide ${
                        isOccupied
                          ? 'bg-amber-200 text-amber-900'
                          : isCleaning
                          ? 'bg-cyan-200 text-cyan-900'
                          : isReserved
                          ? 'bg-purple-200 text-purple-900'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>

                  {isOccupied && activeOrd ? (
                    <div className="space-y-1 bg-white/80 backdrop-blur p-2.5 rounded-xl border border-amber-200 text-xs">
                      <div className="flex justify-between font-bold text-slate-800">
                        <span>{activeOrd.orderNumber}</span>
                      </div>
                      <div className="flex justify-between text-xs font-bold pt-1 border-t border-slate-100">
                        <span className="text-slate-500">Running Bill:</span>
                        <span className="text-rose-600">{formatINR(activeOrd.grandTotal)}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {activeOrd.items?.length || 0} items ordered
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-2 text-slate-300">
                      <Utensils className="w-6 h-6 mx-auto stroke-1" />
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                    <span>Capacity: {t.capacity} seats</span>
                    <span className="text-rose-600 font-bold">Tap to Order →</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 3: KITCHEN DISPLAY SYSTEM (KDS) */}
      {/* ========================================================== */}
      {activeTab === 'kds' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            {/* Station Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto">
              {['ALL', 'MAIN_KITCHEN', 'PIZZA_STATION', 'GRILL_STATION', 'BAR'].map((station) => (
                <button
                  key={station}
                  onClick={() => setSelectedKdsStation(station)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                    selectedKdsStation === station ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {station.replace('_', ' ')}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={kdsAutoRefresh}
                  onChange={(e) => setKdsAutoRefresh(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                Auto-Refresh (5s)
              </label>
              <button
                onClick={() => loadBranchData(selectedBranchId)}
                className="p-2 text-slate-500 hover:text-slate-700 bg-slate-100 rounded-xl"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Ticket Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTickets.length === 0 ? (
              <div className="col-span-full text-center py-16 bg-white rounded-2xl border border-slate-200 text-slate-400 space-y-2">
                <ChefHat className="w-10 h-10 mx-auto stroke-1" />
                <p className="font-bold text-sm">All tickets cleared! Kitchen is calm.</p>
              </div>
            ) : (
              filteredTickets.map((ticket) => {
                const isPending = ticket.status === 'PENDING';
                const isPreparing = ticket.status === 'PREPARING';
                const isReady = ticket.status === 'READY';

                return (
                  <div
                    key={ticket.id}
                    className={`bg-white rounded-2xl border-2 flex flex-col justify-between shadow-sm overflow-hidden ${
                      isReady
                        ? 'border-emerald-500'
                        : isPreparing
                        ? 'border-amber-400'
                        : 'border-slate-200'
                    }`}
                  >
                    {/* Ticket Header */}
                    <div
                      className={`p-3.5 text-white flex items-center justify-between ${
                        isReady ? 'bg-emerald-600' : isPreparing ? 'bg-amber-500' : 'bg-slate-800'
                      }`}
                    >
                      <div>
                        <span className="font-extrabold text-sm tracking-wide">{ticket.ticketNumber}</span>
                        <div className="text-[11px] opacity-90">
                          {ticket.order?.table?.name || `Table ${ticket.order?.table?.tableNumber || 'Takeaway'}`}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-black/20 rounded">
                          {ticket.station.replace('_STATION', '')}
                        </span>
                        <div className="text-[10px] opacity-80 mt-0.5 flex items-center justify-end gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(ticket.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>

                    {/* Ticket Items List */}
                    <div className="p-4 space-y-2.5 flex-1 min-h-[160px]">
                      {ticket.items.map((item) => (
                        <div key={item.id} className="flex items-start justify-between text-sm border-b border-slate-100 pb-2">
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-800">
                              {Number(item.quantity)}x {item.orderItem?.name}
                            </span>
                            {item.notes && (
                              <p className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium">
                                ⚠️ Note: {item.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Ticket Workflow Action Buttons */}
                    <div className="p-3 bg-slate-50 border-t border-slate-100 flex gap-2">
                      {isPending && (
                        <button
                          onClick={() => handleUpdateKdsStatus(ticket.id, 'PREPARING')}
                          className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition"
                        >
                          Start Preparing 🍳
                        </button>
                      )}

                      {isPreparing && (
                        <button
                          onClick={() => handleUpdateKdsStatus(ticket.id, 'READY')}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition"
                        >
                          Mark Ready 🔔
                        </button>
                      )}

                      {isReady && (
                        <button
                          onClick={() => handleUpdateKdsStatus(ticket.id, 'SERVED')}
                          className="w-full py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition"
                        >
                          Mark Served ✅
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 4: MENU & RECIPE MANAGEMENT */}
      {/* ========================================================== */}
      {activeTab === 'menu' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <div>
              <h2 className="font-bold text-slate-900">Menu & Recipe Bill of Materials (BOM)</h2>
              <p className="text-xs text-slate-500">Every menu item links to raw ingredients to calculate live food cost and automate kitchen stock consumption.</p>
            </div>

            <button
              onClick={() => setIsNewMenuItemModalOpen(true)}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Menu Item
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase text-slate-500">
                <tr>
                  <th className="p-4">Item Code & Name</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Selling Price</th>
                  <th className="p-4">Live Food Cost (BOM)</th>
                  <th className="p-4">Margin %</th>
                  <th className="p-4">Kitchen Station</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {menuItems.map((item) => {
                  const price = Number(item.price);
                  const cost = Number(item.costPrice);
                  const margin = price > 0 ? (((price - cost) / price) * 100).toFixed(1) : '0';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-4">
                        <div className="font-bold text-slate-900">{item.name}</div>
                        <span className="text-xs text-slate-400">{item.code}</span>
                      </td>
                      <td className="p-4 text-slate-600">{item.category?.name || 'General'}</td>
                      <td className="p-4 font-extrabold text-slate-900">{formatINR(price)}</td>
                      <td className="p-4">
                        <span className="font-semibold text-emerald-700">{formatINR(cost)}</span>
                        {item.recipe && (
                          <span className="ml-1 text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                            BOM Linked
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded text-xs">
                          {margin}%
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded-md font-medium">
                          {item.kitchenStation}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-full">
                          Available
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 5: SALES ANALYTICS & REPORTS */}
      {/* ========================================================== */}
      {activeTab === 'sales' && salesAnalytics && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold uppercase">Total Revenue</span>
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900">
                {formatINR(salesAnalytics.summary.totalRevenue)}
              </div>
              <div className="text-xs text-slate-500 font-medium">
                {salesAnalytics.summary.totalOrders} total completed orders
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold uppercase">Kitchen Food Cost (COGS)</span>
                <ChefHat className="w-5 h-5 text-rose-600" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900">
                {formatINR(salesAnalytics.summary.totalCogs)}
              </div>
              <div className="text-xs text-emerald-600 font-bold">
                Food Cost: {salesAnalytics.summary.foodCostPercentage}%
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold uppercase">Gross Profit Margin</span>
                <TrendingUp className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="text-2xl font-extrabold text-emerald-600">
                {formatINR(salesAnalytics.summary.totalProfit)}
              </div>
              <div className="text-xs text-slate-500 font-medium">
                Gross margin after recipe BOM deductions
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold uppercase">Average Check (Per Order)</span>
                <Receipt className="w-5 h-5 text-amber-600" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900">
                {formatINR(salesAnalytics.summary.averageTicketSize)}
              </div>
              <div className="text-xs text-slate-500 font-medium">Per table order size</div>
            </div>
          </div>

          {/* Top Selling Items & Payment Methods */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-600" /> Top Selling Menu Items
              </h3>
              <div className="space-y-3">
                {salesAnalytics.topSellingItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-slate-100 font-bold text-xs flex items-center justify-center text-slate-600">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-slate-800">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-900">{formatINR(item.revenue)}</span>
                      <span className="text-xs text-slate-400 ml-2">({item.quantity} sold)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-600" /> Payment Mode Breakdown
              </h3>
              <div className="space-y-3">
                {Object.entries(salesAnalytics.paymentBreakdown).map(([method, amt]) => (
                  <div key={method} className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700">{method}</span>
                    <span className="font-bold text-slate-900">{formatINR(amt)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL 1: CHECKOUT & SETTLE BILL */}
      {/* ========================================================== */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <DollarSign className="w-6 h-6" />
                <h3 className="text-lg font-bold text-slate-900">Settle POS Payment</h3>
              </div>
              <button
                onClick={() => setIsCheckoutModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Bill Summary */}
            <div className="bg-slate-50 p-4 rounded-2xl space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Taxable Amount</span>
                <span>{formatINR(cartSubtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>GST (CGST 2.5% + SGST 2.5%)</span>
                <span>{formatINR(cartTax)}</span>
              </div>
              {activeDiscountAmount > 0 && (
                <div className="flex justify-between text-rose-600 font-semibold">
                  <span>Discount</span>
                  <span>-{formatINR(activeDiscountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                <span>Grand Total Due</span>
                <span className="text-rose-600 font-mono">{formatINR(cartGrandTotal)}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500">Select Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'CASH', label: 'Cash', icon: Banknote },
                  { id: 'CREDIT_CARD', label: 'Credit Card', icon: CreditCard },
                  { id: 'MOBILE_BANKING', label: 'Mobile Pay', icon: Smartphone }
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id)}
                    className={`py-3 rounded-xl border flex flex-col items-center gap-1 font-bold text-xs transition ${
                      paymentMethod === m.id
                        ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-sm'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <m.icon className="w-5 h-5" />
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Cash Buttons & Change Calculator */}
            {paymentMethod === 'CASH' && (
              <div className="space-y-2 bg-amber-50/60 p-4 rounded-2xl border border-amber-200">
                <label className="text-xs font-bold text-amber-900">Cash Tendered (₹)</label>
                <input
                  type="number"
                  placeholder={`Exact ${formatINR(cartGrandTotal)}`}
                  value={receivedCash}
                  onChange={(e) => setReceivedCash(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-lg font-bold focus:outline-none font-mono"
                />

                <div className="flex gap-2 pt-1">
                  {[100, 200, 500, 2000].map((bill) => (
                    <button
                      key={bill}
                      onClick={() => setReceivedCash(String(bill))}
                      className="px-3 py-1 bg-white border border-amber-300 rounded-lg text-xs font-bold text-amber-900 hover:bg-amber-100 font-mono"
                    >
                      ₹{bill}
                    </button>
                  ))}
                </div>

                {receivedCash && Number(receivedCash) >= cartGrandTotal && (
                  <div className="flex justify-between font-extrabold text-sm text-emerald-800 pt-2 border-t border-amber-200">
                    <span>Change Due to Guest:</span>
                    <span>{formatINR(Number(receivedCash) - cartGrandTotal)}</span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleCompleteCheckout}
              disabled={loading}
              className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-2xl text-sm shadow-md transition disabled:opacity-50"
            >
              Confirm Settlement & Print Receipt
            </button>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL 2: DISCOUNT ENTRY & APPROVAL FLAG */}
      {/* ========================================================== */}
      {isDiscountModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Percent className="w-5 h-5 text-rose-600" /> Apply Order Discount
              </h3>
              <button onClick={() => setIsDiscountModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600">Discount Type</label>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                >
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED_AMOUNT">Fixed Amount ($)</option>
                  <option value="COMPLIMENTARY">Complimentary (100%)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Value (% or $)</label>
                <input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Reason / Justification</label>
                <input
                  type="text"
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              {discountValue > 15 && (
                <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  ℹ️ Note: Discounts exceeding 15% are flagged for Manager Approval per ERP rules.
                </p>
              )}
            </div>

            <button
              onClick={() => {
                const calculated =
                  discountType === 'PERCENTAGE'
                    ? (cartSubtotal * discountValue) / 100
                    : discountValue;
                setActiveDiscountAmount(calculated);
                setIsDiscountModalOpen(false);
              }}
              className="w-full py-3 bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-sm transition"
            >
              Apply Discount
            </button>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL 3: ADD DINING TABLE */}
      {/* ========================================================== */}
      {isNewTableModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateTable} className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900">Add New Dining Table</h3>
              <button type="button" onClick={() => setIsNewTableModalOpen(false)}>✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600">Table Number / Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. T-11"
                  value={newTableData.tableNumber}
                  onChange={(e) => setNewTableData({ ...newTableData, tableNumber: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Table Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Patio Booth 11"
                  value={newTableData.name}
                  onChange={(e) => setNewTableData({ ...newTableData, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600">Seating Capacity</label>
                  <input
                    type="number"
                    min="1"
                    value={newTableData.capacity}
                    onChange={(e) => setNewTableData({ ...newTableData, capacity: Number(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600">Floor Section</label>
                  <select
                    value={newTableData.section}
                    onChange={(e) => setNewTableData({ ...newTableData, section: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold"
                  >
                    <option value="Main Dining">Main Dining</option>
                    <option value="Outdoor Patio">Outdoor Patio</option>
                    <option value="Bar Lounge">Bar Lounge</option>
                    <option value="VIP Lounge">VIP Lounge</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm shadow transition"
            >
              Create Dining Table
            </button>
          </form>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL 4: MERGE TABLES */}
      {/* ========================================================== */}
      {isMergeModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleMergeTables} className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <GitMerge className="w-5 h-5 text-rose-600" /> Merge Tables
              </h3>
              <button type="button" onClick={() => setIsMergeModalOpen(false)}>✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600">Source Table (Active Order) *</label>
                <select
                  required
                  value={mergeSourceId}
                  onChange={(e) => setMergeSourceId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                >
                  <option value="">Select source table</option>
                  {tables.filter((t) => t.status === 'OCCUPIED').map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name || `Table ${t.tableNumber}`} (Occupied)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Target Table *</label>
                <select
                  required
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                >
                  <option value="">Select target table</option>
                  {tables.filter((t) => t.id !== mergeSourceId).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name || `Table ${t.tableNumber}`} ({t.status})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-sm shadow transition"
            >
              Confirm Table Merge
            </button>
          </form>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL 5: ADD MENU ITEM & LINK TO RECIPE BOM */}
      {/* ========================================================== */}
      {isNewMenuItemModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateMenuItem} className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900">Add Menu Item with Recipe BOM</h3>
              <button type="button" onClick={() => setIsNewMenuItemModalOpen(false)}>✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-bold text-slate-600">Dish Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Truffle Mushroom Risotto"
                  value={newMenuItemData.name}
                  onChange={(e) => setNewMenuItemData({ ...newMenuItemData, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Item Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MI-RISOTTO-01"
                  value={newMenuItemData.code}
                  onChange={(e) => setNewMenuItemData({ ...newMenuItemData, code: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm uppercase font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Menu Category *</label>
                <select
                  required
                  value={newMenuItemData.categoryId}
                  onChange={(e) => setNewMenuItemData({ ...newMenuItemData, categoryId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Selling Price ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={newMenuItemData.price}
                  onChange={(e) => setNewMenuItemData({ ...newMenuItemData, price: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Kitchen Station</label>
                <select
                  value={newMenuItemData.kitchenStation}
                  onChange={(e) => setNewMenuItemData({ ...newMenuItemData, kitchenStation: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                >
                  <option value="MAIN_KITCHEN">Main Kitchen</option>
                  <option value="PIZZA_STATION">Pizza Station</option>
                  <option value="GRILL_STATION">Grill Station</option>
                  <option value="BAR">Bar</option>
                  <option value="COLD_STATION">Cold Station</option>
                  <option value="DESSERT_STATION">Dessert Station</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <ChefHat className="w-3.5 h-3.5 text-emerald-600" /> Link to Recipe BOM (Bill of Materials)
                </label>
                <select
                  value={newMenuItemData.recipeId}
                  onChange={(e) => setNewMenuItemData({ ...newMenuItemData, recipeId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-emerald-50 border border-emerald-300 rounded-xl text-sm font-medium text-emerald-900"
                >
                  <option value="">No Recipe (Direct Retail Item)</option>
                  {recipesList.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm shadow transition"
            >
              Save Menu Item
            </button>
          </form>
        </div>
      )}

      {/* Invoice receipt indicator */}
      {lastInvoiceNumber && (
        <div className="text-center text-xs text-slate-400">
          Last Settled Transaction: <span className="font-bold text-slate-700">{lastInvoiceNumber}</span>
        </div>
      )}
    </div>
  );
};

export default RestaurantPOSPage;
