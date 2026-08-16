import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  UtensilsCrossed,
  Search,
  ShoppingCart,
  Plus,
  Minus,
  X,
  Clock,
  CheckCircle2,
  QrCode,
  ArrowRight,
  RefreshCw,
  Sparkles,
  MapPin,
  AlertCircle
} from 'lucide-react';
import { onlineOrderApi } from '../../api/online-order.api';
import {
  MenuCategoryGroup,
  DigitalMenuItem,
  TableSessionInfo,
  CartItem,
  OrderTrackingData
} from '../../types/online-order.types';
import { formatINR } from '../../utils/formatters';

export const DigitalMenuOrderingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tokenParam = searchParams.get('token') || searchParams.get('table') || '';

  // State
  const [session, setSession] = useState<TableSessionInfo | null>(null);
  const [categories, setCategories] = useState<MenuCategoryGroup[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cart & Item Customization
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedItemForModal, setSelectedItemForModal] = useState<DigitalMenuItem | null>(null);
  const [modalQuantity, setModalQuantity] = useState(1);
  const [modalNotes, setModalNotes] = useState('');

  // Checkout State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderType, setOrderType] = useState<'DINE_IN' | 'TAKEAWAY' | 'ROOM_SERVICE'>('DINE_IN');
  const [roomNumber, setRoomNumber] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Payment / Active Tracking State
  const [placedOrderNumber, setPlacedOrderNumber] = useState<string | null>(null);
  const [trackingData, setTrackingData] = useState<OrderTrackingData | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [upiRef, setUpiRef] = useState('');
  const [settlingPayment, setSettlingPayment] = useState(false);

  // Load Menu and Session
  useEffect(() => {
    loadMenuAndSession();
  }, [tokenParam]);

  const loadMenuAndSession = async () => {
    setLoading(true);
    setError(null);
    try {
      if (tokenParam) {
        try {
          const sess = await onlineOrderApi.getSessionDetails(tokenParam);
          setSession(sess);
        } catch {
          // Fallback if session token isn't in DB yet
          setSession({
            sessionId: 'default',
            sessionToken: tokenParam,
            tableId: 'default',
            tableNumber: tokenParam.replace('QR-', ''),
            section: 'Dining Hall',
            branch: { id: 'default', name: 'Grand Heritage Resort', code: 'GHR' },
            companyId: 'default'
          });
        }
      }

      const menuData = await onlineOrderApi.getPublicMenu(undefined, tokenParam || undefined);
      setCategories(menuData);
      if (menuData.length > 0) {
        setActiveCategory('All');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to load digital menu. Please refresh or ask a staff member.');
    } finally {
      setLoading(false);
    }
  };

  // Poll Tracking Data when tracking an active order
  useEffect(() => {
    if (!placedOrderNumber) return;

    const fetchTracking = async () => {
      try {
        const data = await onlineOrderApi.trackOrder(placedOrderNumber);
        setTrackingData(data);
      } catch (e) {
        console.error('Tracking fetch error', e);
      }
    };

    fetchTracking();
    const interval = setInterval(fetchTracking, 7000);
    return () => clearInterval(interval);
  }, [placedOrderNumber]);

  // Filtered Menu Items
  const allItems: DigitalMenuItem[] = categories.flatMap((cat) => cat.items);
  const filteredItems = allItems.filter((item) => {
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Cart Helpers
  const cartTotalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartTax = cartSubtotal * 0.05; // 5% GST
  const cartGrandTotal = cartSubtotal + cartTax;

  const openAddItemModal = (item: DigitalMenuItem) => {
    setSelectedItemForModal(item);
    setModalQuantity(1);
    setModalNotes('');
  };

  const confirmAddToCart = () => {
    if (!selectedItemForModal) return;

    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (c) => c.menuItemId === selectedItemForModal.id && c.notes === modalNotes
      );
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].quantity += modalQuantity;
        return updated;
      } else {
        return [
          ...prev,
          {
            menuItemId: selectedItemForModal.id,
            name: selectedItemForModal.name,
            price: selectedItemForModal.price,
            quantity: modalQuantity,
            notes: modalNotes || undefined,
            category: selectedItemForModal.category
          }
        ];
      }
    });

    setSelectedItemForModal(null);
  };

  const updateCartItemQty = (index: number, delta: number) => {
    setCart((prev) => {
      const updated = [...prev];
      const newQty = updated[index].quantity + delta;
      if (newQty <= 0) {
        return updated.filter((_, i) => i !== index);
      }
      updated[index].quantity = newQty;
      return updated;
    });
  };

  // Place Order Handler
  const handlePlaceOrder = async (payMethod: 'PAY_AT_COUNTER' | 'PAY_NOW') => {
    if (cart.length === 0) return;
    if (!customerName.trim() || !customerPhone.trim()) {
      alert('Please provide your name and phone number to place order');
      return;
    }

    setSubmitting(true);
    try {
      const token = session?.sessionToken || tokenParam || 'QR-DIRECT';
      const result = await onlineOrderApi.placeOrder({
        sessionToken: token,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        orderType,
        roomNumber: orderType === 'ROOM_SERVICE' ? roomNumber : undefined,
        notes: orderNotes.trim() || undefined,
        items: cart.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          notes: i.notes
        }))
      });

      const orderNumber = result.onlineOrder.orderNumber;
      const orderId = result.onlineOrder.id;

      setPlacedOrderNumber(orderNumber);
      setPlacedOrderId(orderId);
      setIsCartOpen(false);
      setCart([]);

      if (payMethod === 'PAY_NOW') {
        setShowPaymentModal(true);
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to place order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Settle Digital Payment
  const handleSettlePayment = async () => {
    if (!placedOrderId) return;
    setSettlingPayment(true);
    try {
      await onlineOrderApi.settlePayment({
        orderId: placedOrderId,
        paymentMethod: 'UPI',
        transactionRef: upiRef.trim() || `UPI-TXN-${Date.now().toString().slice(-6)}`
      });
      setShowPaymentModal(false);
      // Refresh tracking
      if (placedOrderNumber) {
        const data = await onlineOrderApi.trackOrder(placedOrderNumber);
        setTrackingData(data);
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Payment settlement verification failed');
    } finally {
      setSettlingPayment(false);
    }
  };

  // ==========================================
  // VIEW: LIVE ORDER TRACKING SCREEN
  // ==========================================
  if (placedOrderNumber && trackingData) {
    const isCompleted = trackingData.status === 'COMPLETED';
    const isPreparing = trackingData.status === 'PREPARING' || trackingData.status === 'CONFIRMED';

    return (
      <div className="min-h-screen bg-[#0a0a0c] text-white p-4 sm:p-6 flex flex-col items-center">
        <div className="w-full max-w-lg space-y-6">
          {/* Header */}
          <div className="text-center space-y-1">
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-[#d4a437]/15 border border-[#d4a437]/30 rounded-full text-[#d4a437] text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>GRAND HERITAGE GUEST ORDER</span>
            </div>
            <h1 className="text-2xl font-bold text-neutral-100 font-serif">Order #{trackingData.orderNumber}</h1>
            <p className="text-xs text-neutral-400">
              {session?.tableName || `Table ${session?.tableNumber || 'Dine-In'}`} • {session?.section || 'Terrace'}
            </p>
          </div>

          {/* Status Tracker Card */}
          <div className="bg-[#121216] border border-white/[0.08] rounded-2xl p-5 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-neutral-400">Order Progress</p>
                <p className="text-base font-bold text-[#d4a437] mt-0.5">
                  {trackingData.status === 'RECEIVED' && 'Received by Restaurant'}
                  {trackingData.status === 'CONFIRMED' && 'Order Confirmed'}
                  {trackingData.status === 'PREPARING' && 'Chef Preparing in Kitchen'}
                  {trackingData.status === 'COMPLETED' && 'Served & Completed'}
                  {trackingData.status === 'CANCELLED' && 'Cancelled'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#d4a437]/20 flex items-center justify-center text-[#d4a437]">
                {isCompleted ? <CheckCircle2 className="w-6 h-6 text-[#3fbf6f]" /> : <Clock className="w-6 h-6 animate-pulse" />}
              </div>
            </div>

            {/* Stepper Dots */}
            <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
              <div className="space-y-1">
                <div className="h-1.5 rounded-full bg-[#3fbf6f]" />
                <span className="text-[#3fbf6f] font-semibold">Received</span>
              </div>
              <div className="space-y-1">
                <div className={`h-1.5 rounded-full ${trackingData.status !== 'RECEIVED' ? 'bg-[#3fbf6f]' : 'bg-white/10'}`} />
                <span className={trackingData.status !== 'RECEIVED' ? 'text-[#3fbf6f] font-semibold' : 'text-neutral-500'}>Confirmed</span>
              </div>
              <div className="space-y-1">
                <div className={`h-1.5 rounded-full ${isPreparing || isCompleted ? 'bg-[#d4a437]' : 'bg-white/10'}`} />
                <span className={isPreparing || isCompleted ? 'text-[#d4a437] font-semibold' : 'text-neutral-500'}>Kitchen Prep</span>
              </div>
              <div className="space-y-1">
                <div className={`h-1.5 rounded-full ${isCompleted ? 'bg-[#3fbf6f]' : 'bg-white/10'}`} />
                <span className={isCompleted ? 'text-[#3fbf6f] font-semibold' : 'text-neutral-500'}>Served</span>
              </div>
            </div>

            {trackingData.kdsTicket && (
              <div className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <UtensilsCrossed className="w-4 h-4 text-[#d4a437]" />
                  <span className="text-neutral-300">Kitchen KOT #{trackingData.kdsTicket.ticketNumber}</span>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-[#d4a437]/20 text-[#d4a437] font-semibold text-[11px]">
                  {trackingData.kdsTicket.station}
                </span>
              </div>
            )}
          </div>

          {/* Items Summary */}
          <div className="bg-[#121216] border border-white/[0.08] rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Ordered Dishes</h3>
            <div className="divide-y divide-white/[0.06]">
              {trackingData.items.map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-neutral-200">{item.name}</span>
                    <span className="text-neutral-500 ml-2">x{item.quantity}</span>
                    {item.notes && <p className="text-[11px] text-[#d4a437]/80 italic mt-0.5">"{item.notes}"</p>}
                  </div>
                  <span className="font-medium text-neutral-300">{formatINR(item.totalPrice)}</span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-white/[0.08] space-y-1 text-xs">
              <div className="flex justify-between text-neutral-400">
                <span>Subtotal</span>
                <span>{formatINR(trackingData.subTotal)}</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Restaurant GST (5%)</span>
                <span>{formatINR(trackingData.taxAmount)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-[#d4a437] pt-1 border-t border-white/[0.06]">
                <span>Total Amount</span>
                <span>{formatINR(trackingData.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            {!isCompleted && !showPaymentModal && (
              <button
                onClick={() => setShowPaymentModal(true)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#d4a437] to-[#b8860b] text-black font-bold text-xs uppercase tracking-wider shadow-lg shadow-[#d4a437]/20 flex items-center justify-center space-x-2"
              >
                <QrCode className="w-4 h-4" />
                <span>Pay via UPI / Card Now</span>
              </button>
            )}

            <button
              onClick={() => {
                setPlacedOrderNumber(null);
                setTrackingData(null);
              }}
              className="w-full py-3 rounded-xl bg-[#1c1c22] hover:bg-white/[0.08] border border-white/[0.1] text-xs font-semibold text-neutral-300 transition-colors"
            >
              Order More Items from Menu
            </button>
          </div>
        </div>

        {/* UPI Payment Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#141418] border border-white/[0.1] rounded-2xl w-full max-w-sm p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-neutral-100 flex items-center space-x-2">
                  <QrCode className="w-4 h-4 text-[#d4a437]" />
                  <span>Instant UPI Settlement</span>
                </h3>
                <button onClick={() => setShowPaymentModal(false)} className="text-neutral-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* QR Mockup */}
              <div className="bg-white p-4 rounded-xl flex flex-col items-center justify-center space-y-2">
                <div className="w-40 h-40 bg-neutral-900 rounded-lg flex flex-col items-center justify-center text-white p-3 text-center">
                  <QrCode className="w-20 h-20 text-[#d4a437]" />
                  <p className="text-[10px] font-mono text-neutral-300 mt-1">grandheritage@upi</p>
                </div>
                <p className="text-[11px] font-bold text-neutral-800">Scan & Pay via GPay / PhonePe / Paytm</p>
                <p className="text-sm font-extrabold text-[#b8860b]">{formatINR(trackingData.totalAmount)}</p>
              </div>

              <div>
                <label className="text-[11px] font-medium text-neutral-400 block mb-1">UPI UTR / Ref Number (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 482910482901"
                  value={upiRef}
                  onChange={(e) => setUpiRef(e.target.value)}
                  className="w-full bg-[#1c1c22] border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-neutral-200 outline-none focus:border-[#d4a437]"
                />
              </div>

              <button
                disabled={settlingPayment}
                onClick={handleSettlePayment}
                className="w-full py-3 rounded-xl bg-[#d4a437] hover:bg-[#b8860b] text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {settlingPayment ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{settlingPayment ? 'Verifying Settlement...' : 'Confirm Paid'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW: MAIN DIGITAL MENU BROWSING
  // ==========================================
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white pb-24 select-none">
      {/* Top Banner & Branding */}
      <header className="sticky top-0 z-30 bg-[#0e0e12]/95 backdrop-blur-md border-b border-white/[0.08] px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#d4a437] to-[#8c6b23] flex items-center justify-center shadow-md">
              <UtensilsCrossed className="w-5 h-5 text-black" />
            </div>
            <div>
              <p className="text-xs font-bold tracking-widest text-[#d4a437] font-mono">GRAND HERITAGE</p>
              <h1 className="text-sm font-bold text-neutral-100 font-serif">
                {session ? `${session.tableName || 'Table ' + session.tableNumber}` : 'Digital Dining Menu'}
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {session && (
              <span className="hidden sm:inline-flex items-center space-x-1 px-2.5 py-1 bg-white/[0.05] border border-white/[0.08] rounded-lg text-[11px] text-neutral-300">
                <MapPin className="w-3 h-3 text-[#d4a437]" />
                <span>{session.section}</span>
              </span>
            )}

            {/* Cart Button Trigger */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 rounded-xl bg-[#d4a437]/15 hover:bg-[#d4a437]/25 border border-[#d4a437]/30 text-[#d4a437] transition-colors"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartTotalQty > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#d4a437] text-black font-extrabold text-[10px] flex items-center justify-center shadow-md animate-bounce">
                  {cartTotalQty}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero / Search */}
      <div className="max-w-4xl mx-auto px-4 pt-4 pb-2 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search appetizers, chef curries, beverages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#141418] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-xs text-neutral-200 placeholder-neutral-500 outline-none focus:border-[#d4a437]"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveCategory('All')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeCategory === 'All'
                ? 'bg-[#d4a437] text-black shadow-md shadow-[#d4a437]/20'
                : 'bg-[#141418] text-neutral-400 hover:text-white border border-white/[0.06]'
            }`}
          >
            All Dishes ({allItems.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.categoryName}
              onClick={() => setActiveCategory(cat.categoryName)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeCategory === cat.categoryName
                  ? 'bg-[#d4a437] text-black shadow-md shadow-[#d4a437]/20'
                  : 'bg-[#141418] text-neutral-400 hover:text-white border border-white/[0.06]'
              }`}
            >
              {cat.categoryName} ({cat.items.length})
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 py-3">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-2 border-[#d4a437] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-neutral-400">Loading fine dining menu...</p>
          </div>
        ) : error ? (
          <div className="bg-[#1f1616] border border-red-500/30 rounded-2xl p-6 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
            <p className="text-xs text-red-200">{error}</p>
            <button
              onClick={loadMenuAndSession}
              className="px-4 py-2 bg-white/[0.08] hover:bg-white/[0.12] rounded-xl text-xs font-semibold text-white"
            >
              Retry
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center text-neutral-500 space-y-2">
            <UtensilsCrossed className="w-8 h-8 mx-auto opacity-40" />
            <p className="text-xs">No matching dishes found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="bg-[#121216] border border-white/[0.07] hover:border-[#d4a437]/40 rounded-2xl p-4 transition-all flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-semibold text-[#d4a437] uppercase tracking-wider">
                        {item.category}
                      </span>
                      <h3 className="text-sm font-bold text-neutral-100 font-serif leading-tight">{item.name}</h3>
                    </div>
                    <span className="text-sm font-extrabold text-[#d4a437]">{formatINR(item.price)}</span>
                  </div>

                  {item.description && (
                    <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">{item.description}</p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
                  <div className="flex items-center space-x-1.5 text-[11px] text-neutral-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{item.preparationMinutes || 15} mins</span>
                  </div>

                  <button
                    onClick={() => openAddItemModal(item)}
                    className="px-3 py-1.5 rounded-xl bg-[#d4a437]/15 hover:bg-[#d4a437] text-[#d4a437] hover:text-black font-bold text-xs transition-all flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Bottom Cart Bar (When Cart Has Items) */}
      {cartTotalQty > 0 && !isCartOpen && (
        <div className="fixed bottom-4 inset-x-4 max-w-lg mx-auto z-40">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-gradient-to-r from-[#d4a437] to-[#b8860b] text-black font-bold py-3.5 px-5 rounded-2xl shadow-xl shadow-[#d4a437]/25 flex items-center justify-between transition-transform active:scale-[0.99]"
          >
            <div className="flex items-center space-x-2.5">
              <span className="w-6 h-6 rounded-full bg-black/20 text-xs font-extrabold flex items-center justify-center">
                {cartTotalQty}
              </span>
              <span className="text-xs uppercase tracking-wider font-extrabold">View Order Cart</span>
            </div>
            <div className="flex items-center space-x-1 text-sm font-extrabold">
              <span>{formatINR(cartGrandTotal)}</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* Item Customization Modal */}
      {selectedItemForModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141418] border border-white/[0.1] rounded-2xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] text-[#d4a437] uppercase font-semibold">{selectedItemForModal.category}</span>
                <h3 className="text-sm font-bold text-neutral-100">{selectedItemForModal.name}</h3>
                <p className="text-xs font-semibold text-[#d4a437] mt-0.5">{formatINR(selectedItemForModal.price)}</p>
              </div>
              <button onClick={() => setSelectedItemForModal(null)} className="text-neutral-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quantity Selector */}
            <div className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl">
              <span className="text-xs font-medium text-neutral-300">Quantity</span>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setModalQuantity((q) => Math.max(1, q - 1))}
                  className="w-7 h-7 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-neutral-200 flex items-center justify-center"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-sm font-bold text-neutral-100 w-4 text-center">{modalQuantity}</span>
                <button
                  onClick={() => setModalQuantity((q) => q + 1)}
                  className="w-7 h-7 rounded-lg bg-[#d4a437] text-black font-bold flex items-center justify-center"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Cooking Notes */}
            <div>
              <label className="text-[11px] font-medium text-neutral-400 block mb-1">Cooking Note / Preferences</label>
              <textarea
                rows={2}
                placeholder="e.g. Less spicy, no onions, extra crispy..."
                value={modalNotes}
                onChange={(e) => setModalNotes(e.target.value)}
                className="w-full bg-[#1c1c22] border border-white/[0.1] rounded-xl p-2.5 text-xs text-neutral-200 placeholder-neutral-500 outline-none focus:border-[#d4a437] resize-none"
              />
            </div>

            <button
              onClick={confirmAddToCart}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#d4a437] to-[#b8860b] text-black font-bold text-xs uppercase tracking-wider shadow-md flex items-center justify-center space-x-2"
            >
              <span>Add to Order</span>
              <span>•</span>
              <span>{formatINR(selectedItemForModal.price * modalQuantity)}</span>
            </button>
          </div>
        </div>
      )}

      {/* Slide-out Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-[#121216] border-l border-white/[0.08] h-full flex flex-col justify-between p-5 space-y-4 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center space-x-2">
                <ShoppingCart className="w-4 h-4 text-[#d4a437]" />
                <h3 className="text-sm font-bold text-neutral-100">Your Dining Order</h3>
              </div>
              <button onClick={() => setIsCartOpen(false)} className="text-neutral-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Items List */}
            {cart.length === 0 ? (
              <div className="py-16 text-center text-neutral-500 space-y-2">
                <ShoppingCart className="w-8 h-8 mx-auto opacity-40" />
                <p className="text-xs">Your order cart is empty.</p>
              </div>
            ) : (
              <div className="space-y-4 flex-1">
                <div className="divide-y divide-white/[0.06] max-h-56 overflow-y-auto pr-1">
                  {cart.map((item, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between text-xs">
                      <div className="space-y-0.5 max-w-[55%]">
                        <p className="font-semibold text-neutral-200 truncate">{item.name}</p>
                        <p className="text-[11px] text-[#d4a437] font-medium">{formatINR(item.price)}</p>
                        {item.notes && <p className="text-[10px] text-neutral-400 italic">"{item.notes}"</p>}
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateCartItemQty(idx, -1)}
                          className="w-6 h-6 rounded-md bg-white/[0.08] hover:bg-white/[0.15] text-neutral-200 flex items-center justify-center"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold text-neutral-100 w-3 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateCartItemQty(idx, 1)}
                          className="w-6 h-6 rounded-md bg-[#d4a437] text-black font-bold flex items-center justify-center"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Customer Details Form */}
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3.5 space-y-2.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#d4a437]">Guest Information</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Your Full Name *"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="bg-[#1c1c22] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 outline-none focus:border-[#d4a437]"
                    />
                    <input
                      type="tel"
                      placeholder="Mobile Number *"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="bg-[#1c1c22] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 outline-none focus:border-[#d4a437]"
                    />
                  </div>

                  {/* Order Type */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    {(['DINE_IN', 'TAKEAWAY', 'ROOM_SERVICE'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setOrderType(t)}
                        className={`py-1 rounded-lg text-[10px] font-semibold border transition-all ${
                          orderType === t
                            ? 'bg-[#d4a437]/20 border-[#d4a437] text-[#d4a437]'
                            : 'bg-white/[0.02] border-white/[0.06] text-neutral-400'
                        }`}
                      >
                        {t === 'DINE_IN' ? 'Dine-In' : t === 'TAKEAWAY' ? 'Takeaway' : 'Room Svc'}
                      </button>
                    ))}
                  </div>

                  {orderType === 'ROOM_SERVICE' && (
                    <input
                      type="text"
                      placeholder="Room Number (e.g. 402)"
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      className="w-full bg-[#1c1c22] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 outline-none focus:border-[#d4a437]"
                    />
                  )}

                  <input
                    type="text"
                    placeholder="General instructions for kitchen..."
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    className="w-full bg-[#1c1c22] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 outline-none focus:border-[#d4a437]"
                  />
                </div>

                {/* Price Summary */}
                <div className="space-y-1 text-xs pt-2">
                  <div className="flex justify-between text-neutral-400">
                    <span>Subtotal</span>
                    <span>{formatINR(cartSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Restaurant GST (5%)</span>
                    <span>{formatINR(cartTax)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-[#d4a437] pt-1.5 border-t border-white/[0.06]">
                    <span>Total Amount</span>
                    <span>{formatINR(cartGrandTotal)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Checkout Actions */}
            {cart.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-white/[0.08]">
                <button
                  disabled={submitting}
                  onClick={() => handlePlaceOrder('PAY_NOW')}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#d4a437] to-[#b8860b] text-black font-bold text-xs uppercase tracking-wider shadow-lg flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                  <span>Pay Now via UPI / Card</span>
                </button>

                <button
                  disabled={submitting}
                  onClick={() => handlePlaceOrder('PAY_AT_COUNTER')}
                  className="w-full py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-neutral-300 font-semibold text-xs transition-colors flex items-center justify-center space-x-2"
                >
                  <UtensilsCrossed className="w-3.5 h-3.5 text-[#d4a437]" />
                  <span>Send Order to Kitchen (Pay at Counter)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DigitalMenuOrderingPage;
