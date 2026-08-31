export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING' | 'BLOCKED';
export type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'ROOM_SERVICE';
export type OrderStatus = 'OPEN' | 'SENT_TO_KITCHEN' | 'IN_PREPARATION' | 'READY' | 'SERVED' | 'COMPLETED' | 'CANCELLED';
export type OrderItemStatus = 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
export type KitchenStation = 'MAIN_KITCHEN' | 'PIZZA_STATION' | 'GRILL_STATION' | 'BAR' | 'DESSERT_STATION' | 'COLD_STATION';
export type KitchenTicketStatus = 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'MOBILE_BANKING' | 'ROOM_POSTING' | 'SPLIT';
export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'COUPON' | 'COMPLIMENTARY';

export interface MenuCategory {
  id: string;
  menuId: string;
  name: string;
  code: string;
  sortOrder: number;
  icon?: string;
  isActive: boolean;
  menuItems?: MenuItem[];
}

export interface MenuItem {
  id: string;
  companyId: string;
  menuId: string;
  categoryId: string;
  category?: MenuCategory;
  finishedItemId?: string;
  finishedItem?: { id: string; name: string; code: string; costPrice: number | string };
  recipeId?: string;
  recipe?: {
    id: string;
    name: string;
    code: string;
    yieldQty: number | string;
    ingredients: Array<{
      rawItemId: string;
      rawItem: { name: string; costPrice: number | string };
      quantity: number | string;
      unit?: { symbol: string };
    }>;
  };
  name: string;
  code: string;
  description?: string;
  price: number | string;
  costPrice: number | string;
  taxRate: number | string;
  kitchenStation: KitchenStation;
  preparationMinutes: number;
  isAvailable: boolean;
  imageUrl?: string;
}

export interface Menu {
  id: string;
  companyId: string;
  branchId?: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  categories: MenuCategory[];
}

export interface DiningTable {
  id: string;
  branchId: string;
  tableNumber: string;
  name?: string;
  capacity: number;
  section: string;
  status: TableStatus;
  activeOrderId?: string;
  isActive: boolean;
  orders?: RestaurantOrder[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  menuItem: MenuItem;
  name: string;
  quantity: number | string;
  unitPrice: number | string;
  totalPrice: number | string;
  cogsAmount?: number | string;
  notes?: string;
  status: OrderItemStatus;
}

export interface RestaurantOrder {
  id: string;
  companyId: string;
  branchId: string;
  orderNumber: string;
  tableId?: string;
  table?: DiningTable;
  orderType: OrderType;
  status: OrderStatus;
  guestCount: number;
  customerName?: string;
  customerPhone?: string;
  subtotal: number | string;
  discountAmount: number | string;
  taxAmount: number | string;
  serviceCharge: number | string;
  grandTotal: number | string;
  paidAmount: number | string;
  waiterId?: string;
  waiter?: { id: string; firstName: string; lastName: string };
  cashierId?: string;
  notes?: string;
  createdAt: string;
  items: OrderItem[];
}

export interface KitchenTicketItem {
  id: string;
  ticketId: string;
  orderItemId: string;
  orderItem: {
    id: string;
    name: string;
    quantity: number | string;
    notes?: string;
    menuItem?: { name: string; code: string; preparationMinutes: number };
  };
  quantity: number | string;
  status: OrderItemStatus;
  notes?: string;
}

export interface KitchenTicket {
  id: string;
  ticketNumber: string;
  orderId: string;
  order: {
    id: string;
    orderNumber: string;
    orderType: OrderType;
    table?: { tableNumber: string; name?: string; section: string };
    waiter?: { firstName: string; lastName: string };
    createdAt: string;
  };
  branchId: string;
  station: KitchenStation;
  status: KitchenTicketStatus;
  ticketType: string;
  notes?: string;
  sentAt: string;
  preparingAt?: string;
  readyAt?: string;
  servedAt?: string;
  items: KitchenTicketItem[];
}

export interface SalesRecord {
  id: string;
  orderId: string;
  invoiceNumber: string;
  saleDate: string;
  orderType: OrderType;
  grossSales: number | string;
  discountAmount: number | string;
  netSales: number | string;
  taxAmount: number | string;
  serviceCharge: number | string;
  grandTotal: number | string;
  totalCogs: number | string;
  grossProfit: number | string;
  paymentMethod: PaymentMethod;
  order?: RestaurantOrder;
  branch?: { id: string; name: string; code: string };
}

export interface SalesAnalytics {
  summary: {
    totalOrders: number;
    totalRevenue: number | string;
    totalDiscount: number | string;
    totalTax: number | string;
    totalCogs: number | string;
    totalProfit: number | string;
    foodCostPercentage: number;
    averageTicketSize: number;
  };
  paymentBreakdown: Record<string, number>;
  topSellingItems: Array<{ name: string; quantity: number; revenue: number }>;
  recentSales: SalesRecord[];
}
