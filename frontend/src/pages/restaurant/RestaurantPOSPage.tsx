import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Utensils,
  Flame,
  Grid,
  Plus,
  RefreshCw,
  Search,
  Clock,
  IndianRupee,
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
          restaurantApi.getBranches().catch(() => []),
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
    <div className="space-y-6 pb-12 select-none">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#17171b] p-5 sm:p-6 rounded-3xl shadow-xl border border-white/[0.08]">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#d4a437] to-[#996f1b] flex items-center justify-center text-black shadow-lg shadow-[#d4a437]/20 border border-[#d4a437]/40">
            <Utensils className="w-6 h-6 text-black" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-wide uppercase">
                Restaurant POS & Service Desk
              </h1>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#d4a437]/15 text-[#d4a437] font-semibold border border-[#d4a437]/30 tracking-wider">
                F&B Operations
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Touch-Optimized POS, Interactive Floor Plan, Kitchen Display (KDS), and Recipe BOM Sales
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#0c0c0e] border border-white/[0.09] rounded-xl px-3.5 py-2">
            <Layers className="w-4 h-4 text-[#d4a437]" />
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-white focus:outline-none"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id} className="bg-[#17171b] text-white">
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => loadBranchData(selectedBranchId)}
            className="p-2.5 text-neutral-400 hover:text-white bg-[#0c0c0e] hover:bg-[#202026] border border-white/[0.08] rounded-xl transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#d4a437]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 bg-[#e5544d]/10 border border-[#e5544d]/25 text-[#e5544d] rounded-2xl text-xs flex items-center justify-between font-medium">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-neutral-400 hover:text-white font-bold ml-4">✕</button>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-[#3fbf6f]/10 border border-[#3fbf6f]/25 text-[#3fbf6f] rounded-2xl text-xs flex items-center justify-between font-medium">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-neutral-400 hover:text-white font-bold ml-4">✕</button>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex items-center space-x-2 border-b border-white/[0.08] overflow-x-auto pb-2 text-xs font-semibold scrollbar-none">
        <button
          onClick={() => setActiveTab('pos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition whitespace-nowrap ${
            activeTab === 'pos'
              ? 'bg-[#d4a437]/15 text-[#d4a437] border border-[#d4a437]/30 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          Fast POS Terminal
        </button>

        <button
          onClick={() => setActiveTab('tables')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition whitespace-nowrap ${
            activeTab === 'tables'
              ? 'bg-[#d4a437]/15 text-[#d4a437] border border-[#d4a437]/30 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
          }`}
        >
          <Grid className="w-4 h-4" />
          Table Floor Plan ({tables.length})
        </button>

        <button
          onClick={() => setActiveTab('kds')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition whitespace-nowrap relative ${
            activeTab === 'kds'
              ? 'bg-[#d4a437]/15 text-[#d4a437] border border-[#d4a437]/30 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
          }`}
        >
          <ChefHat className="w-4 h-4" />
          Kitchen Display (KDS)
          {kitchenTickets.length > 0 && (
            <span className="ml-1.5 px-2 py-0.5 text-[10px] bg-[#d4a437] text-black font-bold rounded-full">
              {kitchenTickets.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('menu')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition whitespace-nowrap ${
            activeTab === 'menu'
              ? 'bg-[#d4a437]/15 text-[#d4a437] border border-[#d4a437]/30 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
          }`}
        >
          <Utensils className="w-4 h-4" />
          Menu & Recipe BOM
        </button>

        <button
          onClick={() => setActiveTab('sales')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition whitespace-nowrap ${
            activeTab === 'sales'
              ? 'bg-[#d4a437]/15 text-[#d4a437] border border-[#d4a437]/30 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
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
            <div className="bg-[#17171b] p-4 rounded-3xl shadow-xl border border-white/[0.08] space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Search dishes by name or SKU code (e.g. Biryani, Margherita)..."
                  value={searchItem}
                  onChange={(e) => setSearchItem(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0c0c0e] border border-white/[0.09] rounded-xl text-xs text-white focus:outline-none focus:border-[#d4a437]"
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setSelectedCategoryId('ALL')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                    selectedCategoryId === 'ALL'
                      ? 'bg-[#d4a437] text-black shadow-md'
                      : 'bg-[#0c0c0e] text-neutral-400 hover:text-white border border-white/[0.06]'
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
                        ? 'bg-[#d4a437] text-black shadow-md'
                        : 'bg-[#0c0c0e] text-neutral-400 hover:text-white border border-white/[0.06]'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu Items Grid */}
            {filteredMenuItems.length === 0 ? (
              <div className="p-12 text-center bg-[#17171b] rounded-3xl border border-white/[0.08] space-y-3 text-neutral-500">
                <Utensils className="w-10 h-10 mx-auto" />
                <h4 className="text-sm font-bold text-white">No Menu Items Found</h4>
                <p className="text-xs text-neutral-400">Add dishes to this menu category or clear your search filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredMenuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleAddToCart(item)}
                    className="bg-[#17171b] p-4 rounded-2xl border border-white/[0.08] hover:border-[#d4a437]/50 hover:shadow-xl transition text-left flex flex-col justify-between h-44 group relative overflow-hidden active:scale-95"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400">
                          {item.code}
                        </span>
                        {item.recipe && (
                          <span className="px-1.5 py-0.5 bg-[#3fbf6f]/15 text-[#3fbf6f] border border-[#3fbf6f]/25 text-[9px] font-bold rounded flex items-center gap-1">
                            <ChefHat className="w-2.5 h-2.5" /> BOM
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-white text-xs sm:text-sm line-clamp-2 group-hover:text-[#d4a437] transition">
                        {item.name}
                      </h3>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-neutral-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-neutral-500" /> {item.preparationMinutes}m
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-[#0c0c0e] rounded text-neutral-300 font-mono border border-white/[0.06]">
                          {item.kitchenStation.replace('_STATION', '')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
                        <span className="text-sm sm:text-base font-extrabold text-[#3fbf6f] font-mono">
                          {formatINR(item.price)}
                        </span>
                        <span className="p-1 bg-[#202026] text-[#d4a437] rounded-lg group-hover:bg-[#d4a437] group-hover:text-black transition">
                          <Plus className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right 1 Col: Live Fast Order Cart */}
          <div className="bg-[#17171b] p-5 rounded-3xl shadow-xl border border-white/[0.08] flex flex-col justify-between h-full min-h-[580px]">
            <div className="space-y-4">
              {/* Order Info Bar */}
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#d4a437]" />
                  <h2 className="font-bold text-white text-sm">
                    {activeOrder ? `Order #${activeOrder.orderNumber}` : 'New POS Order'}
                  </h2>
                </div>

                {/* Table Picker */}
                <select
                  value={posTableId}
                  onChange={(e) => setPosTableId(e.target.value)}
                  className="text-xs font-bold bg-[#0c0c0e] text-[#d4a437] border border-[#d4a437]/30 rounded-xl px-2.5 py-1.5 focus:outline-none"
                >
                  <option value="" className="bg-[#17171b] text-white">Counter / Takeaway</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id} className="bg-[#17171b] text-white">
                      {t.name || `Table ${t.tableNumber}`} ({t.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Order Type & Guest Count */}
              <div className="space-y-2.5">
                <div className="grid grid-cols-3 gap-1.5 bg-[#0c0c0e] p-1 rounded-2xl text-xs font-bold text-neutral-400 border border-white/[0.06]">
                  {['DINE_IN', 'TAKEAWAY', 'DELIVERY'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setPosOrderType(type)}
                      className={`py-1.5 rounded-xl transition ${
                        posOrderType === type ? 'bg-[#d4a437] text-black shadow-sm' : 'hover:text-white'
                      }`}
                    >
                      {type.replace('_', ' ')}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 bg-[#0c0c0e] border border-white/[0.09] px-2.5 py-1.5 rounded-xl text-neutral-300 flex-1">
                    <Users className="w-3.5 h-3.5 text-neutral-500" />
                    <span className="text-[11px]">Guests:</span>
                    <input
                      type="number"
                      min="1"
                      value={posGuestCount}
                      onChange={(e) => setPosGuestCount(Number(e.target.value))}
                      className="w-10 bg-transparent font-bold text-white focus:outline-none font-mono"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Guest Name"
                    value={posCustomerName}
                    onChange={(e) => setPosCustomerName(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 bg-[#0c0c0e] border border-white/[0.09] rounded-xl text-xs text-white focus:outline-none focus:border-[#d4a437]"
                  />
                </div>

                <input
                  type="text"
                  placeholder="Order Kitchen Notes (e.g. VIP, allergy alerts)"
                  value={posOrderNotes}
                  onChange={(e) => setPosOrderNotes(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#0c0c0e] border border-white/[0.09] rounded-xl text-xs text-white focus:outline-none focus:border-[#d4a437]"
                />
              </div>

              {/* Cart Items List */}
              <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 scrollbar-none">
                {cartItems.length === 0 ? (
                  <div className="text-center py-10 text-neutral-500 space-y-2 bg-[#0c0c0e] rounded-2xl border border-white/[0.04]">
                    <Utensils className="w-7 h-7 mx-auto stroke-1 text-neutral-600" />
                    <p className="text-xs">Ticket is empty. Tap menu items to add to order.</p>
                  </div>
                ) : (
                  cartItems.map((c) => (
                    <div
                      key={c.menuItem.id}
                      className="p-3 bg-[#0c0c0e] rounded-2xl border border-white/[0.06] flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-white truncate">{c.menuItem.name}</h4>
                        <div className="text-[11px] text-neutral-400 font-mono">
                          {formatINR(c.menuItem.price)} each
                        </div>
                      </div>

                      {/* Qty Controls */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleUpdateQty(c.menuItem.id, -1)}
                          className="w-6 h-6 rounded-lg bg-[#202026] border border-white/[0.08] flex items-center justify-center font-bold text-neutral-300 hover:bg-[#282832] transition"
                        >
                          -
                        </button>
                        <span className="font-bold text-xs w-4 text-center text-white font-mono">{c.quantity}</span>
                        <button
                          onClick={() => handleUpdateQty(c.menuItem.id, 1)}
                          className="w-6 h-6 rounded-lg bg-[#202026] border border-white/[0.08] flex items-center justify-center font-bold text-neutral-300 hover:bg-[#282832] transition"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-right font-bold text-[#3fbf6f] font-mono min-w-[50px]">
                        {formatINR(Number(c.menuItem.price) * c.quantity)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Cart Footer & Totals */}
            <div className="space-y-3 pt-3 border-t border-white/[0.06]">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-neutral-400">
                  <span>Taxable Subtotal</span>
                  <span className="font-semibold text-white font-mono">{formatINR(cartSubtotal)}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>GST (CGST 2.5% + SGST 2.5%)</span>
                  <span className="font-semibold text-white font-mono">{formatINR(cartTax)}</span>
                </div>
                {activeDiscountAmount > 0 && (
                  <div className="flex justify-between text-[#e5544d] font-semibold">
                    <span>Courtesy Discount</span>
                    <span className="font-mono">-{formatINR(activeDiscountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm sm:text-base font-extrabold text-white pt-1 border-t border-white/[0.06]">
                  <span>Grand Total</span>
                  <span className="text-[#3fbf6f] font-mono">{formatINR(cartGrandTotal)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setIsDiscountModalOpen(true)}
                  className="py-2.5 px-3 bg-[#202026] hover:bg-[#282832] text-neutral-300 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition border border-white/[0.06]"
                >
                  <Percent className="w-3.5 h-3.5 text-[#d4a437]" /> Discount
                </button>

                <button
                  onClick={handleSendToKitchen}
                  disabled={cartItems.length === 0 || loading}
                  className="py-2.5 px-3 bg-[#e5a33d] hover:bg-[#c98e32] text-black font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" /> Send to KDS
                </button>
              </div>

              <button
                onClick={() => setIsCheckoutModalOpen(true)}
                disabled={cartItems.length === 0 || loading}
                className="w-full py-3.5 bg-[#d4a437] hover:bg-[#b88c2c] text-black font-bold rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-[#d4a437]/20 flex items-center justify-center gap-2 transition disabled:opacity-40"
              >
                <IndianRupee className="w-4 h-4" /> Settle Bill ({formatINR(cartGrandTotal)})
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#17171b] p-4 rounded-3xl shadow-xl border border-white/[0.08]">
            {/* Section Filters */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
              <button
                onClick={() => setSelectedSection('ALL')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  selectedSection === 'ALL'
                    ? 'bg-[#d4a437] text-black shadow-md'
                    : 'bg-[#0c0c0e] text-neutral-400 hover:text-white border border-white/[0.06]'
                }`}
              >
                All Sections
              </button>
              {uniqueSections.map((sec) => (
                <button
                  key={sec}
                  onClick={() => setSelectedSection(sec)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    selectedSection === sec
                      ? 'bg-[#d4a437] text-black shadow-md'
                      : 'bg-[#0c0c0e] text-neutral-400 hover:text-white border border-white/[0.06]'
                  }`}
                >
                  {sec}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMergeModalOpen(true)}
                className="px-3.5 py-2 bg-[#202026] hover:bg-[#282832] text-neutral-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition border border-white/[0.06]"
              >
                <GitMerge className="w-4 h-4 text-[#d4a437]" /> Merge Tables
              </button>
              <button
                onClick={() => setIsNewTableModalOpen(true)}
                className="px-3.5 py-2 bg-[#d4a437] hover:bg-[#b88c2c] text-black font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-lg shadow-[#d4a437]/20"
              >
                <Plus className="w-4 h-4" /> Add Table
              </button>
            </div>
          </div>

          {/* Tables Visual Grid */}
          {filteredTables.length === 0 ? (
            <div className="p-16 text-center bg-[#17171b] rounded-3xl border border-white/[0.08] space-y-3 text-neutral-500">
              <Grid className="w-10 h-10 mx-auto" />
              <h4 className="text-sm font-bold text-white">No Tables In This Floor Section</h4>
              <p className="text-xs text-neutral-400">Click &quot;Add Table&quot; to configure dining stations and seating capacities.</p>
            </div>
          ) : (
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
                    className={`p-4 rounded-3xl border transition text-left cursor-pointer flex flex-col justify-between h-48 relative shadow-lg ${
                      isOccupied
                        ? 'bg-[#17171b] border-[#e5a33d]/40 hover:border-[#e5a33d]'
                        : isCleaning
                        ? 'bg-[#17171b] border-[#4d9de5]/40 hover:border-[#4d9de5]'
                        : isReserved
                        ? 'bg-[#17171b] border-[#996f1b]/40 hover:border-[#d4a437]'
                        : 'bg-[#17171b] border-white/[0.08] hover:border-[#d4a437]/60'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs sm:text-sm font-extrabold text-white">{t.name || `Table ${t.tableNumber}`}</span>
                        <p className="text-[10px] text-neutral-400">{t.section}</p>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wide border ${
                          isOccupied
                            ? 'bg-[#e5a33d]/15 text-[#e5a33d] border-[#e5a33d]/25'
                            : isCleaning
                            ? 'bg-[#4d9de5]/15 text-[#4d9de5] border-[#4d9de5]/25'
                            : isReserved
                            ? 'bg-[#d4a437]/15 text-[#d4a437] border-[#d4a437]/25'
                            : 'bg-[#3fbf6f]/15 text-[#3fbf6f] border-[#3fbf6f]/25'
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>

                    {isOccupied && activeOrd ? (
                      <div className="space-y-1 bg-[#0c0c0e] p-2.5 rounded-2xl border border-white/[0.06] text-xs">
                        <div className="flex justify-between font-bold text-white">
                          <span className="font-mono text-[11px]">{activeOrd.orderNumber}</span>
                        </div>
                        <div className="flex justify-between text-xs font-bold pt-1 border-t border-white/[0.06]">
                          <span className="text-neutral-400 text-[10px]">Running Bill:</span>
                          <span className="text-[#3fbf6f] font-mono">{formatINR(activeOrd.grandTotal)}</span>
                        </div>
                        <div className="text-[10px] text-neutral-400">
                          {activeOrd.items?.length || 0} items ordered
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-2 text-neutral-600">
                        <Utensils className="w-6 h-6 mx-auto stroke-1" />
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-2 border-t border-white/[0.06]">
                      <span>{t.capacity} Seats</span>
                      <span className="text-[#d4a437] font-bold text-[10px]">Select →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 3: KITCHEN DISPLAY SYSTEM (KDS) */}
      {/* ========================================================== */}
      {activeTab === 'kds' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#17171b] p-4 rounded-3xl shadow-xl border border-white/[0.08]">
            {/* Station Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
              {['ALL', 'MAIN_KITCHEN', 'PIZZA_STATION', 'GRILL_STATION', 'BAR'].map((station) => (
                <button
                  key={station}
                  onClick={() => setSelectedKdsStation(station)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                    selectedKdsStation === station
                      ? 'bg-[#d4a437] text-black shadow-md'
                      : 'bg-[#0c0c0e] text-neutral-400 hover:text-white border border-white/[0.06]'
                  }`}
                >
                  {station.replace('_', ' ')}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-bold text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={kdsAutoRefresh}
                  onChange={(e) => setKdsAutoRefresh(e.target.checked)}
                  className="rounded text-[#d4a437] bg-[#0c0c0e] border-white/[0.1] focus:ring-0"
                />
                Auto-Refresh (5s)
              </label>
              <button
                onClick={() => loadBranchData(selectedBranchId)}
                className="p-2 text-neutral-400 hover:text-white bg-[#0c0c0e] hover:bg-[#202026] border border-white/[0.08] rounded-xl transition"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Ticket Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTickets.length === 0 ? (
              <div className="col-span-full text-center py-16 bg-[#17171b] rounded-3xl border border-white/[0.08] text-neutral-500 space-y-2">
                <ChefHat className="w-10 h-10 mx-auto stroke-1 text-neutral-600" />
                <p className="font-bold text-sm text-white">All KOT Tickets Cleared</p>
                <p className="text-xs text-neutral-400">Kitchen is running smoothly. New POS orders will appear automatically.</p>
              </div>
            ) : (
              filteredTickets.map((ticket) => {
                const isPending = ticket.status === 'PENDING';
                const isPreparing = ticket.status === 'PREPARING';
                const isReady = ticket.status === 'READY';

                return (
                  <div
                    key={ticket.id}
                    className={`bg-[#17171b] rounded-3xl border flex flex-col justify-between shadow-xl overflow-hidden ${
                      isReady
                        ? 'border-[#3fbf6f]/50'
                        : isPreparing
                        ? 'border-[#e5a33d]/50'
                        : 'border-white/[0.08]'
                    }`}
                  >
                    {/* Ticket Header */}
                    <div
                      className={`p-3.5 text-white flex items-center justify-between border-b ${
                        isReady
                          ? 'bg-[#3fbf6f]/20 border-[#3fbf6f]/30'
                          : isPreparing
                          ? 'bg-[#e5a33d]/20 border-[#e5a33d]/30'
                          : 'bg-[#202026] border-white/[0.08]'
                      }`}
                    >
                      <div>
                        <span className="font-extrabold text-sm tracking-wide font-mono">{ticket.ticketNumber}</span>
                        <div className="text-[11px] text-neutral-300">
                          {ticket.order?.table?.name || `Table ${ticket.order?.table?.tableNumber || 'Takeaway'}`}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-[#0c0c0e] rounded text-[#d4a437] border border-white/[0.06]">
                          {ticket.station.replace('_STATION', '')}
                        </span>
                        <div className="text-[10px] text-neutral-400 mt-0.5 flex items-center justify-end gap-1 font-mono">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(ticket.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>

                    {/* Ticket Items List */}
                    <div className="p-4 space-y-2.5 flex-1 min-h-[160px] bg-[#17171b]">
                      {ticket.items.map((item) => (
                        <div key={item.id} className="flex items-start justify-between text-xs border-b border-white/[0.06] pb-2">
                          <div className="space-y-0.5">
                            <span className="font-bold text-white font-mono">
                              {Number(item.quantity)}x {item.orderItem?.name}
                            </span>
                            {item.notes && (
                              <p className="text-[10px] text-[#e5a33d] bg-[#e5a33d]/10 px-2 py-0.5 rounded font-medium border border-[#e5a33d]/20">
                                Note: {item.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Ticket Workflow Action Buttons */}
                    <div className="p-3 bg-[#0c0c0e] border-t border-white/[0.06] flex gap-2">
                      {isPending && (
                        <button
                          onClick={() => handleUpdateKdsStatus(ticket.id, 'PREPARING')}
                          className="w-full py-2 bg-[#e5a33d] hover:bg-[#c98e32] text-black text-xs font-bold rounded-xl transition"
                        >
                          Start Preparing 🍳
                        </button>
                      )}

                      {isPreparing && (
                        <button
                          onClick={() => handleUpdateKdsStatus(ticket.id, 'READY')}
                          className="w-full py-2 bg-[#3fbf6f] hover:bg-[#329958] text-black text-xs font-bold rounded-xl transition"
                        >
                          Mark Ready 🔔
                        </button>
                      )}

                      {isReady && (
                        <button
                          onClick={() => handleUpdateKdsStatus(ticket.id, 'SERVED')}
                          className="w-full py-2 bg-[#d4a437] hover:bg-[#b88c2c] text-black text-xs font-bold rounded-xl transition"
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#17171b] p-5 rounded-3xl shadow-xl border border-white/[0.08]">
            <div>
              <h2 className="font-bold text-white uppercase text-sm tracking-wider">Menu Catalog & Recipe BOM Links</h2>
              <p className="text-xs text-neutral-400 mt-0.5">Every menu item links to raw ingredients to calculate live food cost and automate kitchen stock deduction.</p>
            </div>

            <button
              onClick={() => setIsNewMenuItemModalOpen(true)}
              className="px-4 py-2.5 bg-[#d4a437] hover:bg-[#b88c2c] text-black font-bold rounded-2xl text-xs flex items-center gap-2 transition shadow-lg shadow-[#d4a437]/20"
            >
              <Plus className="w-4 h-4" /> Add Menu Item
            </button>
          </div>

          <div className="bg-[#17171b] rounded-3xl border border-white/[0.08] overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0c0c0e] border-b border-white/[0.08] text-[10px] font-bold uppercase tracking-wider text-neutral-400">
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
              <tbody className="divide-y divide-white/[0.06]">
                {menuItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-neutral-500 space-y-2">
                      <Utensils className="w-8 h-8 mx-auto" />
                      <p className="text-sm font-semibold text-white">No dishes registered in menu catalog</p>
                      <p className="text-xs text-neutral-400">Click &quot;Add Menu Item&quot; to link your recipes and start selling on the POS terminal.</p>
                    </td>
                  </tr>
                ) : (
                  menuItems.map((item) => {
                    const price = Number(item.price);
                    const cost = Number(item.costPrice);
                    const margin = price > 0 ? (((price - cost) / price) * 100).toFixed(1) : '0';

                    return (
                      <tr key={item.id} className="hover:bg-white/[0.02] transition">
                        <td className="p-4">
                          <div className="font-bold text-white">{item.name}</div>
                          <span className="text-[10px] text-neutral-400 font-mono">{item.code}</span>
                        </td>
                        <td className="p-4 text-neutral-300">{item.category?.name || 'General'}</td>
                        <td className="p-4 font-bold text-white font-mono">{formatINR(price)}</td>
                        <td className="p-4">
                          <span className="font-semibold text-[#3fbf6f] font-mono">{formatINR(cost)}</span>
                          {item.recipe && (
                            <span className="ml-2 text-[9px] bg-[#3fbf6f]/15 text-[#3fbf6f] border border-[#3fbf6f]/25 font-bold px-1.5 py-0.5 rounded">
                              BOM Linked
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 bg-[#d4a437]/15 text-[#d4a437] border border-[#d4a437]/25 font-bold rounded text-[10px]">
                            {margin}%
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-[10px] px-2 py-1 bg-[#0c0c0e] text-neutral-300 rounded-lg font-mono border border-white/[0.06]">
                            {item.kitchenStation}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 bg-[#3fbf6f]/15 text-[#3fbf6f] border border-[#3fbf6f]/25 font-bold text-[10px] rounded-full">
                            Active
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
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
            <div className="bg-[#17171b] p-5 rounded-3xl border border-white/[0.08] shadow-xl space-y-2">
              <div className="flex items-center justify-between text-neutral-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Total Revenue</span>
                <IndianRupee className="w-4 h-4 text-[#3fbf6f]" />
              </div>
              <div className="text-2xl font-extrabold text-white font-mono">
                {formatINR(salesAnalytics.summary.totalRevenue)}
              </div>
              <div className="text-xs text-neutral-400">
                {salesAnalytics.summary.totalOrders} total completed orders
              </div>
            </div>

            <div className="bg-[#17171b] p-5 rounded-3xl border border-white/[0.08] shadow-xl space-y-2">
              <div className="flex items-center justify-between text-neutral-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Food Cost (COGS)</span>
                <ChefHat className="w-4 h-4 text-[#e5544d]" />
              </div>
              <div className="text-2xl font-extrabold text-[#e5544d] font-mono">
                {formatINR(salesAnalytics.summary.totalCogs)}
              </div>
              <div className="text-xs text-[#3fbf6f] font-bold">
                Food Cost: {salesAnalytics.summary.foodCostPercentage}%
              </div>
            </div>

            <div className="bg-[#17171b] p-5 rounded-3xl border border-white/[0.08] shadow-xl space-y-2">
              <div className="flex items-center justify-between text-neutral-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Gross Profit Margin</span>
                <TrendingUp className="w-4 h-4 text-[#d4a437]" />
              </div>
              <div className="text-2xl font-extrabold text-[#3fbf6f] font-mono">
                {formatINR(salesAnalytics.summary.totalProfit)}
              </div>
              <div className="text-xs text-neutral-400">
                Gross margin after recipe BOM deductions
              </div>
            </div>

            <div className="bg-[#17171b] p-5 rounded-3xl border border-white/[0.08] shadow-xl space-y-2">
              <div className="flex items-center justify-between text-neutral-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Average Check</span>
                <Receipt className="w-4 h-4 text-[#e5a33d]" />
              </div>
              <div className="text-2xl font-extrabold text-white font-mono">
                {formatINR(salesAnalytics.summary.averageTicketSize)}
              </div>
              <div className="text-xs text-neutral-400">Per table check size</div>
            </div>
          </div>

          {/* Top Selling Items & Payment Methods */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#17171b] p-5 rounded-3xl border border-white/[0.08] shadow-xl space-y-4">
              <h3 className="font-bold text-white flex items-center gap-2 text-sm uppercase tracking-wider">
                <Flame className="w-4 h-4 text-[#e5544d]" /> Top Selling Dishes
              </h3>
              <div className="space-y-3">
                {salesAnalytics.topSellingItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs border-b border-white/[0.06] pb-2.5">
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full bg-[#0c0c0e] font-bold text-[10px] flex items-center justify-center text-[#d4a437] border border-white/[0.06]">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-white">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-[#3fbf6f] font-mono">{formatINR(item.revenue)}</span>
                      <span className="text-[10px] text-neutral-400 ml-2">({item.quantity} sold)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#17171b] p-5 rounded-3xl border border-white/[0.08] shadow-xl space-y-4">
              <h3 className="font-bold text-white flex items-center gap-2 text-sm uppercase tracking-wider">
                <CreditCard className="w-4 h-4 text-[#d4a437]" /> Settlement Mode Breakdown
              </h3>
              <div className="space-y-3">
                {Object.entries(salesAnalytics.paymentBreakdown).map(([method, amt]) => (
                  <div key={method} className="flex items-center justify-between text-xs border-b border-white/[0.06] pb-2.5">
                    <span className="font-semibold text-neutral-300">{method}</span>
                    <span className="font-bold text-white font-mono">{formatINR(amt)}</span>
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-white/[0.1]">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2 text-[#d4a437]">
                <IndianRupee className="w-5 h-5" />
                <h3 className="text-base font-bold text-white uppercase tracking-wider">Settle POS Payment</h3>
              </div>
              <button
                onClick={() => setIsCheckoutModalOpen(false)}
                className="text-neutral-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Bill Summary */}
            <div className="bg-[#0c0c0e] p-4 rounded-2xl space-y-2 text-xs border border-white/[0.06]">
              <div className="flex justify-between text-neutral-400">
                <span>Taxable Amount</span>
                <span className="font-mono text-white">{formatINR(cartSubtotal)}</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>GST (CGST 2.5% + SGST 2.5%)</span>
                <span className="font-mono text-white">{formatINR(cartTax)}</span>
              </div>
              {activeDiscountAmount > 0 && (
                <div className="flex justify-between text-[#e5544d] font-semibold">
                  <span>Discount</span>
                  <span className="font-mono">-{formatINR(activeDiscountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-extrabold text-white pt-2 border-t border-white/[0.08]">
                <span>Grand Total Due</span>
                <span className="text-[#3fbf6f] font-mono text-base">{formatINR(cartGrandTotal)}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Select Settlement Method</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'CASH', label: 'Cash', icon: Banknote },
                  { id: 'CREDIT_CARD', label: 'Credit Card', icon: CreditCard },
                  { id: 'MOBILE_BANKING', label: 'UPI / Mobile', icon: Smartphone }
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id)}
                    className={`py-3 rounded-2xl border flex flex-col items-center gap-1 font-bold text-xs transition ${
                      paymentMethod === m.id
                        ? 'bg-[#d4a437]/15 border-[#d4a437] text-[#d4a437] shadow-sm'
                        : 'bg-[#0c0c0e] border-white/[0.06] text-neutral-400 hover:text-white'
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
              <div className="space-y-2 bg-[#0c0c0e] p-4 rounded-2xl border border-white/[0.08]">
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Cash Tendered (₹)</label>
                <input
                  type="number"
                  placeholder={`Exact ${formatINR(cartGrandTotal)}`}
                  value={receivedCash}
                  onChange={(e) => setReceivedCash(e.target.value)}
                  className="w-full px-3 py-2 bg-[#17171b] border border-white/[0.1] rounded-xl text-base font-bold text-white focus:outline-none focus:border-[#d4a437] font-mono"
                />

                <div className="flex gap-2 pt-1">
                  {[100, 200, 500, 2000].map((bill) => (
                    <button
                      key={bill}
                      onClick={() => setReceivedCash(String(bill))}
                      className="px-3 py-1 bg-[#202026] border border-white/[0.08] rounded-lg text-xs font-bold text-neutral-300 hover:bg-[#282832] font-mono"
                    >
                      ₹{bill}
                    </button>
                  ))}
                </div>

                {receivedCash && Number(receivedCash) >= cartGrandTotal && (
                  <div className="flex justify-between font-extrabold text-xs text-[#3fbf6f] pt-2 border-t border-white/[0.08]">
                    <span>Change Due to Guest:</span>
                    <span className="font-mono">{formatINR(Number(receivedCash) - cartGrandTotal)}</span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleCompleteCheckout}
              disabled={loading}
              className="w-full py-3.5 bg-[#d4a437] hover:bg-[#b88c2c] text-black font-bold rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-[#d4a437]/20 transition disabled:opacity-40"
            >
              Confirm Settlement & Print Receipt
            </button>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL 2: DISCOUNT ENTRY */}
      {/* ========================================================== */}
      {isDiscountModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-white/[0.1]">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="font-bold text-white flex items-center gap-2 text-sm uppercase tracking-wider">
                <Percent className="w-4 h-4 text-[#d4a437]" /> Apply Order Discount
              </h3>
              <button onClick={() => setIsDiscountModalOpen(false)} className="text-neutral-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-neutral-300">Discount Type</label>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-[#0c0c0e] border border-white/[0.09] rounded-xl text-xs text-white focus:outline-none focus:border-[#d4a437]"
                >
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED_AMOUNT">Fixed Amount ($)</option>
                  <option value="COMPLIMENTARY">Complimentary (100%)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-300">Value (% or $)</label>
                <input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 bg-[#0c0c0e] border border-white/[0.09] rounded-xl text-xs font-bold text-white focus:outline-none focus:border-[#d4a437]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-300">Reason / Justification</label>
                <input
                  type="text"
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-[#0c0c0e] border border-white/[0.09] rounded-xl text-xs text-white focus:outline-none focus:border-[#d4a437]"
                />
              </div>

              {discountValue > 15 && (
                <p className="text-[11px] text-[#e5a33d] bg-[#e5a33d]/10 p-2.5 rounded-xl border border-[#e5a33d]/20">
                  Note: Discounts exceeding 15% are flagged for Manager Approval per ERP rules.
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
              className="w-full py-3 bg-[#d4a437] hover:bg-[#b88c2c] text-black font-bold rounded-xl text-xs uppercase tracking-wider transition"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateTable} className="bg-[#17171b] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-white/[0.1]">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="font-bold text-white text-sm uppercase tracking-wider">Add New Dining Table</h3>
              <button type="button" onClick={() => setIsNewTableModalOpen(false)} className="text-neutral-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-neutral-300">Table Number / Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. T-11"
                  value={newTableData.tableNumber}
                  onChange={(e) => setNewTableData({ ...newTableData, tableNumber: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-[#0c0c0e] border border-white/[0.09] rounded-xl text-xs font-bold text-white focus:outline-none focus:border-[#d4a437]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-300">Table Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Patio Booth 11"
                  value={newTableData.name}
                  onChange={(e) => setNewTableData({ ...newTableData, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-[#0c0c0e] border border-white/[0.09] rounded-xl text-xs text-white focus:outline-none focus:border-[#d4a437]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-neutral-300">Seating Capacity</label>
                  <input
                    type="number"
                    min="1"
                    value={newTableData.capacity}
                    onChange={(e) => setNewTableData({ ...newTableData, capacity: Number(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 bg-[#0c0c0e] border border-white/[0.09] rounded-xl text-xs text-white focus:outline-none focus:border-[#d4a437]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300">Floor Section</label>
                  <select
                    value={newTableData.section}
                    onChange={(e) => setNewTableData({ ...newTableData, section: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-[#0c0c0e] border border-white/[0.09] rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-[#d4a437]"
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
              className="w-full py-3 bg-[#d4a437] hover:bg-[#b88c2c] text-black font-bold rounded-xl text-xs uppercase tracking-wider transition"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleMergeTables} className="bg-[#17171b] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-white/[0.1]">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="font-bold text-white flex items-center gap-2 text-sm uppercase tracking-wider">
                <GitMerge className="w-4 h-4 text-[#d4a437]" /> Merge Tables
              </h3>
              <button type="button" onClick={() => setIsMergeModalOpen(false)} className="text-neutral-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-neutral-300">Source Table (Active Order) *</label>
                <select
                  required
                  value={mergeSourceId}
                  onChange={(e) => setMergeSourceId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-[#0c0c0e] border border-white/[0.09] rounded-xl text-xs text-white focus:outline-none focus:border-[#d4a437]"
                >
                  <option value="">Select source table</option>
                  {tables.filter((t) => t.status === 'OCCUPIED').map((t) => (
                    <option key={t.id} value={t.id} className="bg-[#17171b] text-white">
                      {t.name || `Table ${t.tableNumber}`} (Occupied)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-300">Target Table *</label>
                <select
                  required
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-[#0c0c0e] border border-white/[0.09] rounded-xl text-xs text-white focus:outline-none focus:border-[#d4a437]"
                >
                  <option value="">Select target table</option>
                  {tables.filter((t) => t.id !== mergeSourceId).map((t) => (
                    <option key={t.id} value={t.id} className="bg-[#17171b] text-white">
                      {t.name || `Table ${t.tableNumber}`} ({t.status})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#d4a437] hover:bg-[#b88c2c] text-black font-bold rounded-xl text-xs uppercase tracking-wider transition"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateMenuItem} className="bg-[#17171b] rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-white/[0.1]">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="font-bold text-white text-sm uppercase tracking-wider">Add Menu Item with Recipe BOM</h3>
              <button type="button" onClick={() => setIsNewMenuItemModalOpen(false)} className="text-neutral-400 hover:text-white">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-neutral-300">Dish Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Royal Shahi Paneer"
                  value={newMenuItemData.name}
                  onChange={(e) => setNewMenuItemData({ ...newMenuItemData, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-[#0c0c0e] border border-white/[0.09] rounded-xl text-xs text-white focus:outline-none focus:border-[#d4a437]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-300">Item Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MI-PANEER-01"
                  value={newMenuItemData.code}
                  onChange={(e) => setNewMenuItemData({ ...newMenuItemData, code: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-[#0c0c0e] border border-white/[0.09] rounded-xl text-xs uppercase font-bold text-white focus:outline-none focus:border-[#d4a437]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-300">Menu Category *</label>
                <select
                  required
                  value={newMenuItemData.categoryId}
                  onChange={(e) => setNewMenuItemData({ ...newMenuItemData, categoryId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-[#0c0c0e] border border-white/[0.09] rounded-xl text-xs text-white focus:outline-none focus:border-[#d4a437]"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#17171b] text-white">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-300">Selling Price (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={newMenuItemData.price}
                  onChange={(e) => setNewMenuItemData({ ...newMenuItemData, price: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 bg-[#0c0c0e] border border-white/[0.09] rounded-xl text-xs font-bold text-white focus:outline-none focus:border-[#d4a437]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-300">Kitchen Station</label>
                <select
                  value={newMenuItemData.kitchenStation}
                  onChange={(e) => setNewMenuItemData({ ...newMenuItemData, kitchenStation: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-[#0c0c0e] border border-white/[0.09] rounded-xl text-xs text-white focus:outline-none focus:border-[#d4a437]"
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
                <label className="text-xs font-semibold text-[#d4a437] flex items-center gap-1.5">
                  <ChefHat className="w-3.5 h-3.5 text-[#d4a437]" /> Link to Recipe BOM (Bill of Materials)
                </label>
                <select
                  value={newMenuItemData.recipeId}
                  onChange={(e) => setNewMenuItemData({ ...newMenuItemData, recipeId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-[#0c0c0e] border border-white/[0.09] rounded-xl text-xs font-medium text-white focus:outline-none focus:border-[#d4a437]"
                >
                  <option value="">No Recipe (Direct Retail Item)</option>
                  {recipesList.map((r) => (
                    <option key={r.id} value={r.id} className="bg-[#17171b] text-white">
                      {r.name} ({r.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#d4a437] hover:bg-[#b88c2c] text-black font-bold rounded-xl text-xs uppercase tracking-wider transition"
            >
              Save Menu Item
            </button>
          </form>
        </div>
      )}

      {/* Invoice receipt indicator */}
      {lastInvoiceNumber && (
        <div className="text-center text-xs text-neutral-500">
          Last Settled Transaction: <span className="font-mono font-bold text-[#d4a437]">{lastInvoiceNumber}</span>
        </div>
      )}
    </div>
  );
};

export default RestaurantPOSPage;
