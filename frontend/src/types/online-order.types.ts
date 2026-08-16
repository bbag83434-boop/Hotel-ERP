export interface DigitalMenuItem {
  id: string;
  code: string;
  name: string;
  description?: string;
  price: number;
  kitchenStation: string;
  preparationMinutes: number;
  imageUrl?: string;
  category: string;
}

export interface MenuCategoryGroup {
  categoryName: string;
  items: DigitalMenuItem[];
}

export interface TableSessionInfo {
  sessionId: string;
  sessionToken: string;
  tableId: string;
  tableNumber: string;
  tableName?: string;
  section: string;
  branch: {
    id: string;
    name: string;
    code: string;
    address?: string;
  };
  companyId: string;
}

export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  category: string;
}

export interface PlaceOrderPayload {
  sessionToken: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  orderType: 'DINE_IN' | 'TAKEAWAY' | 'ROOM_SERVICE';
  roomNumber?: string;
  notes?: string;
  items: Array<{
    menuItemId: string;
    quantity: number;
    notes?: string;
  }>;
}

export interface OrderTrackingData {
  orderNumber: string;
  status: 'RECEIVED' | 'CONFIRMED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'COMPLETED' | 'CANCELLED';
  channel: string;
  subTotal: number;
  taxAmount: number;
  totalAmount: number;
  createdAt: string;
  customer: {
    name?: string;
    phone?: string;
  };
  branch: {
    id: string;
    name: string;
    code: string;
    address?: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    notes?: string;
  }>;
  kdsTicket?: {
    ticketNumber: string;
    status: string;
    station: string;
  } | null;
}

export interface BranchTableQRItem {
  tableId: string;
  tableNumber: string;
  tableName: string;
  section: string;
  capacity: number;
  status: string;
  sessionToken: string;
  orderUrl: string;
  hasActiveSession: boolean;
}
