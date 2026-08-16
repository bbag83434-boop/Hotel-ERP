import { z } from 'zod';

// ==========================================
// MENU & CATEGORY SCHEMAS
// ==========================================

export const createMenuSchema = z.object({
  branchId: z.string().uuid().optional().nullable().or(z.literal('')),
  name: z.string().min(1, 'Menu name is required'),
  code: z.string().min(1, 'Menu code is required'),
  description: z.string().optional().or(z.literal(''))
});

export const createMenuCategorySchema = z.object({
  menuId: z.string().uuid('Valid menu ID is required'),
  name: z.string().min(1, 'Category name is required'),
  code: z.string().min(1, 'Category code is required'),
  sortOrder: z.coerce.number().int().optional(),
  icon: z.string().optional().or(z.literal(''))
});

export const createMenuItemSchema = z.object({
  menuId: z.string().uuid('Menu ID is required'),
  categoryId: z.string().uuid('Category ID is required'),
  finishedItemId: z.string().uuid().optional().nullable().or(z.literal('')),
  recipeId: z.string().uuid().optional().nullable().or(z.literal('')),
  name: z.string().min(1, 'Item name is required'),
  code: z.string().min(1, 'Item code is required'),
  description: z.string().optional().or(z.literal('')),
  price: z.coerce.number().min(0, 'Price must be greater than or equal to 0'),
  costPrice: z.coerce.number().min(0).optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  kitchenStation: z.enum([
    'MAIN_KITCHEN',
    'PIZZA_STATION',
    'GRILL_STATION',
    'BAR',
    'DESSERT_STATION',
    'COLD_STATION'
  ]).optional(),
  preparationMinutes: z.coerce.number().int().min(1).optional(),
  imageUrl: z.string().optional().or(z.literal(''))
});

export const updateMenuItemSchema = createMenuItemSchema.partial();

// ==========================================
// TABLE MANAGEMENT SCHEMAS
// ==========================================

export const createTableSchema = z.object({
  branchId: z.string().uuid('Branch ID is required'),
  tableNumber: z.string().min(1, 'Table number is required'),
  name: z.string().optional().or(z.literal('')),
  capacity: z.coerce.number().int().min(1, 'Capacity must be at least 1').default(4),
  section: z.string().default('Main Dining')
});

export const updateTableStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'BLOCKED'])
});

export const mergeTablesSchema = z.object({
  sourceTableId: z.string().uuid('Source table ID is required'),
  targetTableId: z.string().uuid('Target table ID is required')
});

// ==========================================
// ORDER & POS SCHEMAS
// ==========================================

export const createOrderSchema = z.object({
  branchId: z.string().uuid('Branch ID is required'),
  tableId: z.string().uuid().optional().nullable().or(z.literal('')),
  orderType: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'ROOM_SERVICE']).default('DINE_IN'),
  guestCount: z.coerce.number().int().min(1).default(1),
  customerName: z.string().optional().or(z.literal('')),
  customerPhone: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  items: z.array(
    z.object({
      menuItemId: z.string().uuid('Valid MenuItem ID is required'),
      quantity: z.coerce.number().min(0.1, 'Quantity must be greater than 0'),
      notes: z.string().optional().or(z.literal(''))
    })
  ).min(1, 'Order must contain at least one item')
});

export const addItemsToOrderSchema = z.object({
  items: z.array(
    z.object({
      menuItemId: z.string().uuid('Valid MenuItem ID is required'),
      quantity: z.coerce.number().min(0.1, 'Quantity must be greater than 0'),
      notes: z.string().optional().or(z.literal(''))
    })
  ).min(1, 'Must provide at least one item to add')
});

export const updateTicketStatusSchema = z.object({
  status: z.enum(['PENDING', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'])
});

// ==========================================
// CHECKOUT, DISCOUNT & PAYMENT SCHEMAS
// ==========================================

export const applyDiscountSchema = z.object({
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'COUPON', 'COMPLIMENTARY']),
  rateOrAmount: z.coerce.number().min(0, 'Discount value must be positive'),
  reason: z.string().min(1, 'Reason for discount is required').default('Valued Guest Courtesy')
});

export const processPaymentSchema = z.object({
  paymentMethod: z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_BANKING', 'ROOM_POSTING', 'SPLIT']),
  amount: z.coerce.number().min(0, 'Payment amount must be non-negative'),
  receivedAmount: z.coerce.number().min(0).optional(),
  transactionRef: z.string().optional().or(z.literal('')),
  cardLast4: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal(''))
});
