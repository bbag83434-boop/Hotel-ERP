'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, ChevronDown, Minus, Plus, RefreshCw, Search, ShoppingBag,
  Smartphone, Store, Trash2, UtensilsCrossed, X
} from 'lucide-react';
import { useOutlet } from '@/context/OutletContext';
import { ordersApi, OrderSource } from '@/api/orders';
import { inventoryApi } from '@/api/inventory';
import Button from '@/components/ui/Button';

interface MenuRow { id: string; code: string; name: string; price: number; tax_rate: number; }
interface OrderRow {
  id: string; order_number: string; source: OrderSource; status: string; total_amount: number | string;
  created_at: string; customer_name?: string; customer_phone?: string;
  items: Array<{ name: string; quantity: number | string; total_price?: number | string }>;
}
interface CartLine extends MenuRow { quantity: number; notes?: string; }

const sourceLabel: Record<OrderSource, string> = { ZOMATO: 'Zomato', SWIGGY: 'Swiggy', MANUAL: 'Manual' };
const statusLabel: Record<string, string> = {
  OPEN: 'Open', SENT_TO_KITCHEN: 'Kitchen', IN_PREPARATION: 'Preparing', READY: 'Ready', SERVED: 'Served', COMPLETED: 'Completed', CANCELLED: 'Cancelled'
};

export default function OrdersWorkspace() {
  const { activeOutlet } = useOutlet();
  const [stats, setStats] = useState<any>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [menu, setMenu] = useState<MenuRow[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [source, setSource] = useState<OrderSource | undefined>();
  const [search, setSearch] = useState('');
  const [orderStatus, setOrderStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [menuSearch, setMenuSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [externalId, setExternalId] = useState('');
  const [notes, setNotes] = useState('');
  const [guestCount, setGuestCount] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<'CASH'|'UPI'|'CARD'>('CASH');
  const [receivedAmount, setReceivedAmount] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [s, list, menuList, wh] = await Promise.all([
        ordersApi.stats(activeOutlet.id),
        ordersApi.list(activeOutlet.id, source),
        ordersApi.menu(activeOutlet.id),
        inventoryApi.getWarehouses({ branch_id: activeOutlet.id }).catch(() => []),
      ]);
      setStats(s); setOrders(list as unknown as OrderRow[]); setMenu(menuList); setWarehouses(wh || []);
    } catch (e: any) { setError(e?.response?.data?.detail || 'Unable to load orders.'); }
    finally { setLoading(false); }
  }, [activeOutlet.id, source]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!success) return; const t = setTimeout(() => setSuccess(''), 3000); return () => clearTimeout(t); }, [success]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter(o => (!orderStatus || o.status === orderStatus) && (!q || [o.order_number, o.customer_name, o.source, o.status, ...(o.items || []).map(i => i.name)].some(v => String(v || '').toLowerCase().includes(q))));
  }, [orders, search, orderStatus]);

  const filteredMenu = useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    return menu.filter(m => !q || `${m.name} ${m.code}`.toLowerCase().includes(q));
  }, [menu, menuSearch]);

  const addToCart = (item: MenuRow) => setCart(prev => {
    const found = prev.find(x => x.id === item.id);
    return found ? prev.map(x => x.id === item.id ? { ...x, quantity: x.quantity + 1 } : x) : [...prev, { ...item, quantity: 1 }];
  });
  const changeQty = (id: string, delta: number) => setCart(prev => prev.map(x => x.id === id ? { ...x, quantity: Math.max(0, x.quantity + delta) } : x).filter(x => x.quantity > 0));
  const subtotal = cart.reduce((sum, x) => sum + x.price * x.quantity, 0);
  const tax = cart.reduce((sum, x) => sum + x.price * x.quantity * (x.tax_rate || 0) / 100, 0);
  const total = subtotal + tax;

  const resetNew = () => { setCart([]); setCustomerName(''); setCustomerPhone(''); setExternalId(''); setNotes(''); setGuestCount(1); setMenuSearch(''); setShowNew(false); };

  const createOrder = async () => {
    if (!cart.length) { setError('Add at least one menu item.'); return; }
    if ((source === 'ZOMATO' || source === 'SWIGGY') && !externalId.trim()) { setError(`External ${source === 'ZOMATO' ? 'Zomato' : 'Swiggy'} order ID is required.`); return; }
    setSaving(true); setError('');
    try {
      const created = await ordersApi.create({
        branch_id: activeOutlet.id, source: source || 'MANUAL', external_order_id: externalId.trim() || undefined,
        guest_count: guestCount, customer_name: customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined, notes: notes.trim() || undefined,
        items: cart.map(x => ({ menu_item_id: x.id, quantity: x.quantity, notes: x.notes })),
      });
      setSuccess(`Order #${created.orderNumber || (created as any).order_number || ''} created successfully.`); resetNew(); await load();
    } catch (e: any) { setError(e?.response?.data?.detail || 'Order could not be created.'); }
    finally { setSaving(false); }
  };

  const completeOrder = async (order: OrderRow) => {
    const warehouseId = warehouses.find(w => w.branch_id === activeOutlet.id)?.id || warehouses[0]?.id;
    if (!warehouseId) { setError('No warehouse is configured for this outlet. Complete action is blocked to prevent incorrect stock deduction.'); return; }
    const method = (window.prompt('Payment method: CASH, UPI or CARD', 'CASH') || 'CASH').toUpperCase() as 'CASH'|'UPI'|'CARD';
    if (!['CASH','UPI','CARD'].includes(method)) { setError('Invalid payment method.'); return; }
    const received = method === 'CASH' ? Number(window.prompt(`Cash received (order total ₹${Number(order.total_amount).toFixed(2)})`, String(Number(order.total_amount).toFixed(2))) || 0) : Number(order.total_amount);
    if (!Number.isFinite(received) || received < Number(order.total_amount)) { setError('Received amount is below order total.'); return; }
    setSaving(true); setError('');
    try { await ordersApi.complete(order.id, warehouseId, method, received); setSuccess(`Order #${order.order_number} completed and stock processed.`); await load(); }
    catch (e: any) { setError(e?.response?.data?.detail || 'Order could not be completed.'); }
    finally { setSaving(false); }
  };

  return (
    <section className="space-y-4 pb-24">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-[10px] uppercase tracking-[0.18em] text-[#8A8A8A] font-bold">Orders</p><h1 className="text-2xl font-bold">Order Control</h1><p className="text-xs text-[#707070] mt-1">{activeOutlet.name}</p></div>
        <Button variant="secondary" onClick={load} disabled={loading} icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}>Refresh</Button>
      </div>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>}
      {success && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-700 flex gap-2 items-center"><CheckCircle2 className="w-4 h-4" />{success}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[["Today", stats?.today_orders ?? 0, ShoppingBag], ["Revenue", `₹${Number(stats?.today_revenue ?? 0).toFixed(0)}`, Store], ["Open", stats?.open_orders ?? 0, Smartphone], ["Completed", stats?.completed_orders ?? 0, CheckCircle2]].map(([label, value, Icon]: any) => <div key={label} className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm"><Icon className="w-4 h-4 text-[#B8862D] mb-3"/><div className="text-xl font-bold">{value}</div><div className="text-[10px] uppercase tracking-wider text-[#777] font-semibold">{label}</div></div>)}
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {([undefined, 'ZOMATO', 'SWIGGY', 'MANUAL'] as const).map(value => <button key={value || 'ALL'} onClick={() => setSource(value || undefined)} className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border ${source === value ? 'bg-[#F1E4C5] border-[#C79A3B]/40 text-[#B8862D]' : 'bg-white border-black/5 text-[#555]'}`}>{value ? sourceLabel[value] : 'All Sources'}</button>)}
        <Button variant="gold" onClick={() => { setShowNew(true); setError(''); }} icon={<Plus className="w-4 h-4" />}>New Order</Button>
      </div>

      <div className="grid md:grid-cols-[1fr_auto] gap-2">
        <div className="relative"><Search className="absolute left-3 top-2.5 w-4 h-4 text-[#999]"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order, customer, item..." className="w-full rounded-xl border border-black/10 bg-white pl-9 pr-3 py-2.5 text-xs outline-none focus:border-[#C79A3B]"/></div>
        <select value={orderStatus} onChange={e => setOrderStatus(e.target.value)} className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-xs outline-none"><option value="">All Status</option>{Object.entries(statusLabel).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-black/5 flex justify-between"><span className="text-xs font-bold">Order History</span><span className="text-[10px] text-[#888]">{filteredOrders.length} orders</span></div>
        {filteredOrders.length === 0 ? <div className="p-10 text-center text-xs text-[#777]">No orders found.</div> : filteredOrders.map(order => <div key={order.id} className="px-4 py-3 border-b border-black/5 last:border-0 flex items-center justify-between gap-3">
          <div className="min-w-0"><div className="flex items-center gap-2 flex-wrap"><span className="font-bold text-sm">#{order.order_number}</span><span className="text-[9px] px-2 py-0.5 rounded-full bg-[#FAF8F5] border border-black/5 font-bold">{sourceLabel[order.source]}</span><span className="text-[9px] px-2 py-0.5 rounded-full bg-[#F5F3EE] font-bold">{statusLabel[order.status] || order.status}</span></div><div className="text-[10px] text-[#777] truncate mt-1">{order.customer_name || 'Guest'} · {(order.items || []).length} item(s) · {new Date(order.created_at).toLocaleString()}</div></div>
          <div className="text-right shrink-0"><div className="font-bold text-sm">₹{Number(order.total_amount || 0).toFixed(2)}</div>{order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && <button disabled={saving} onClick={() => completeOrder(order)} className="mt-1 text-[10px] font-bold text-[#B8862D]">Complete →</button>}</div>
        </div>)}
      </div>

      {showNew && <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-5" onMouseDown={e => e.target === e.currentTarget && resetNew()}>
        <div className="w-full md:max-w-5xl max-h-[94vh] overflow-y-auto bg-[#F5F3EE] rounded-t-3xl md:rounded-3xl shadow-2xl p-4 md:p-6">
          <div className="flex items-center justify-between mb-4"><div><div className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#8A8A8A]">Create Order</div><h2 className="text-xl font-bold">New {source ? sourceLabel[source] : 'Order'}</h2></div><button onClick={resetNew} className="p-2 rounded-xl bg-white border border-black/5"><X className="w-5 h-5"/></button></div>
          <div className="grid lg:grid-cols-[1.35fr_.9fr] gap-4">
            <div className="space-y-3"><div className="flex gap-2 overflow-x-auto no-scrollbar">{(['ZOMATO','SWIGGY','MANUAL'] as OrderSource[]).map(s => <button key={s} onClick={() => setSource(s)} className={`px-3 py-2 rounded-xl text-xs font-bold border ${source === s ? 'champagne-active' : 'bg-white border-black/5'}`}>{sourceLabel[s]}</button>)}</div>
              <div className="grid sm:grid-cols-2 gap-2"><input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer name" className="field"/><input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Phone (optional)" className="field"/>{source && source !== 'MANUAL' && <input value={externalId} onChange={e => setExternalId(e.target.value)} placeholder={`${sourceLabel[source]} external order ID *`} className="field sm:col-span-2"/>}<input type="number" min="1" value={guestCount} onChange={e => setGuestCount(Math.max(1, Number(e.target.value)))} placeholder="Guests" className="field"/><input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Order notes" className="field"/></div>
              <div className="relative"><Search className="absolute left-3 top-2.5 w-4 h-4 text-[#999]"/><input value={menuSearch} onChange={e => setMenuSearch(e.target.value)} placeholder="Search menu items..." className="field pl-9"/></div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{filteredMenu.map(item => <button key={item.id} onClick={() => addToCart(item)} className="text-left rounded-2xl bg-white border border-black/5 p-3 hover:border-[#C79A3B]/40 active:scale-[.98]"><div className="text-xs font-bold line-clamp-2">{item.name}</div><div className="text-[9px] text-[#888] mt-1">{item.code}</div><div className="text-sm font-bold text-[#B8862D] mt-2">₹{item.price.toFixed(2)}</div><div className="text-[9px] text-[#999] mt-1">Tax {item.tax_rate}% · + Add</div></button>)}</div>
              {filteredMenu.length === 0 && <div className="p-6 text-center text-xs text-[#777] bg-white rounded-2xl">No available menu items.</div>}</div>
            <div className="rounded-2xl bg-white border border-black/5 p-4 h-fit lg:sticky lg:top-0"><div className="flex items-center gap-2 mb-3"><UtensilsCrossed className="w-4 h-4 text-[#B8862D]"/><span className="text-sm font-bold">Order Cart</span><span className="ml-auto text-[10px] text-[#888]">{cart.length} line(s)</span></div>{cart.length === 0 ? <div className="py-10 text-center text-xs text-[#888]">Tap a menu item to add it.</div> : <div className="space-y-2">{cart.map(line => <div key={line.id} className="rounded-xl bg-[#FAF8F5] p-3"><div className="flex justify-between gap-2"><span className="text-xs font-bold">{line.name}</span><button onClick={() => setCart(c => c.filter(x => x.id !== line.id))}><Trash2 className="w-3.5 h-3.5 text-[#999]"/></button></div><div className="flex items-center justify-between mt-2"><span className="text-[10px] text-[#777]">₹{line.price.toFixed(2)} each</span><div className="flex items-center gap-2"><button onClick={() => changeQty(line.id, -1)} className="w-7 h-7 rounded-lg bg-white border"><Minus className="w-3 h-3 mx-auto"/></button><span className="text-xs font-bold w-4 text-center">{line.quantity}</span><button onClick={() => changeQty(line.id, 1)} className="w-7 h-7 rounded-lg bg-white border"><Plus className="w-3 h-3 mx-auto"/></button></div></div></div>)}
              <div className="border-t pt-3 mt-3 space-y-1 text-xs"><div className="flex justify-between"><span>Subtotal</span><b>₹{subtotal.toFixed(2)}</b></div><div className="flex justify-between"><span>Tax</span><b>₹{tax.toFixed(2)}</b></div><div className="flex justify-between text-base mt-2"><span>Total</span><b>₹{total.toFixed(2)}</b></div></div><Button variant="gold" className="w-full mt-4" loading={saving} onClick={createOrder}>Create Order</Button></div>}</div>
          </div>
        </div>
      </div>}
    </section>
  );
}
