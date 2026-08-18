"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processPaymentSchema = exports.applyDiscountSchema = exports.updateTicketStatusSchema = exports.addItemsToOrderSchema = exports.createOrderSchema = exports.mergeTablesSchema = exports.updateTableStatusSchema = exports.createTableSchema = exports.updateMenuItemSchema = exports.createMenuItemSchema = exports.createMenuCategorySchema = exports.createMenuSchema = void 0;
const zod_1 = require("zod");
// ==========================================
// MENU & CATEGORY SCHEMAS
// ==========================================
exports.createMenuSchema = zod_1.z.object({
    branchId: zod_1.z.string().uuid().optional().nullable().or(zod_1.z.literal('')),
    name: zod_1.z.string().min(1, 'Menu name is required'),
    code: zod_1.z.string().min(1, 'Menu code is required'),
    description: zod_1.z.string().optional().or(zod_1.z.literal(''))
});
exports.createMenuCategorySchema = zod_1.z.object({
    menuId: zod_1.z.string().uuid('Valid menu ID is required'),
    name: zod_1.z.string().min(1, 'Category name is required'),
    code: zod_1.z.string().min(1, 'Category code is required'),
    sortOrder: zod_1.z.coerce.number().int().optional(),
    icon: zod_1.z.string().optional().or(zod_1.z.literal(''))
});
exports.createMenuItemSchema = zod_1.z.object({
    menuId: zod_1.z.string().uuid('Menu ID is required'),
    categoryId: zod_1.z.string().uuid('Category ID is required'),
    finishedItemId: zod_1.z.string().uuid().optional().nullable().or(zod_1.z.literal('')),
    recipeId: zod_1.z.string().uuid().optional().nullable().or(zod_1.z.literal('')),
    name: zod_1.z.string().min(1, 'Item name is required'),
    code: zod_1.z.string().min(1, 'Item code is required'),
    description: zod_1.z.string().optional().or(zod_1.z.literal('')),
    price: zod_1.z.coerce.number().min(0, 'Price must be greater than or equal to 0'),
    costPrice: zod_1.z.coerce.number().min(0).optional(),
    taxRate: zod_1.z.coerce.number().min(0).max(100).optional(),
    kitchenStation: zod_1.z.enum([
        'MAIN_KITCHEN',
        'PIZZA_STATION',
        'GRILL_STATION',
        'BAR',
        'DESSERT_STATION',
        'COLD_STATION'
    ]).optional(),
    preparationMinutes: zod_1.z.coerce.number().int().min(1).optional(),
    imageUrl: zod_1.z.string().optional().or(zod_1.z.literal(''))
});
exports.updateMenuItemSchema = exports.createMenuItemSchema.partial();
// ==========================================
// TABLE MANAGEMENT SCHEMAS
// ==========================================
exports.createTableSchema = zod_1.z.object({
    branchId: zod_1.z.string().uuid('Branch ID is required'),
    tableNumber: zod_1.z.string().min(1, 'Table number is required'),
    name: zod_1.z.string().optional().or(zod_1.z.literal('')),
    capacity: zod_1.z.coerce.number().int().min(1, 'Capacity must be at least 1').default(4),
    section: zod_1.z.string().default('Main Dining')
});
exports.updateTableStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'BLOCKED'])
});
exports.mergeTablesSchema = zod_1.z.object({
    sourceTableId: zod_1.z.string().uuid('Source table ID is required'),
    targetTableId: zod_1.z.string().uuid('Target table ID is required')
});
// ==========================================
// ORDER & POS SCHEMAS
// ==========================================
exports.createOrderSchema = zod_1.z.object({
    branchId: zod_1.z.string().uuid('Branch ID is required'),
    tableId: zod_1.z.string().uuid().optional().nullable().or(zod_1.z.literal('')),
    orderType: zod_1.z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'ROOM_SERVICE']).default('DINE_IN'),
    guestCount: zod_1.z.coerce.number().int().min(1).default(1),
    customerName: zod_1.z.string().optional().or(zod_1.z.literal('')),
    customerPhone: zod_1.z.string().optional().or(zod_1.z.literal('')),
    notes: zod_1.z.string().optional().or(zod_1.z.literal('')),
    items: zod_1.z.array(zod_1.z.object({
        menuItemId: zod_1.z.string().uuid('Valid MenuItem ID is required'),
        quantity: zod_1.z.coerce.number().min(0.1, 'Quantity must be greater than 0'),
        notes: zod_1.z.string().optional().or(zod_1.z.literal(''))
    })).min(1, 'Order must contain at least one item')
});
exports.addItemsToOrderSchema = zod_1.z.object({
    items: zod_1.z.array(zod_1.z.object({
        menuItemId: zod_1.z.string().uuid('Valid MenuItem ID is required'),
        quantity: zod_1.z.coerce.number().min(0.1, 'Quantity must be greater than 0'),
        notes: zod_1.z.string().optional().or(zod_1.z.literal(''))
    })).min(1, 'Must provide at least one item to add')
});
exports.updateTicketStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['PENDING', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'])
});
// ==========================================
// CHECKOUT, DISCOUNT & PAYMENT SCHEMAS
// ==========================================
exports.applyDiscountSchema = zod_1.z.object({
    discountType: zod_1.z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'COUPON', 'COMPLIMENTARY']),
    rateOrAmount: zod_1.z.coerce.number().min(0, 'Discount value must be positive'),
    reason: zod_1.z.string().min(1, 'Reason for discount is required').default('Valued Guest Courtesy')
});
exports.processPaymentSchema = zod_1.z.object({
    paymentMethod: zod_1.z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_BANKING', 'ROOM_POSTING', 'SPLIT']),
    amount: zod_1.z.coerce.number().min(0, 'Payment amount must be non-negative'),
    receivedAmount: zod_1.z.coerce.number().min(0).optional(),
    transactionRef: zod_1.z.string().optional().or(zod_1.z.literal('')),
    cardLast4: zod_1.z.string().optional().or(zod_1.z.literal('')),
    notes: zod_1.z.string().optional().or(zod_1.z.literal(''))
});
