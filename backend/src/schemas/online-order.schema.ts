import { z } from 'zod';

export const generateTableQRSchema = z.object({
  tableId: z.string().uuid('Valid Table ID is required'),
  guestName: z.string().optional(),
  guestPhone: z.string().optional()
});

export const placeOnlineOrderSchema = z.object({
  sessionToken: z.string().min(1, 'Session token or table token is required'),
  customerName: z.string().min(1, 'Customer name is required'),
  customerPhone: z.string().min(6, 'Valid phone number is required'),
  customerEmail: z.string().email().optional().or(z.literal('')),
  orderType: z.enum(['DINE_IN', 'TAKEAWAY', 'ROOM_SERVICE']).default('DINE_IN'),
  roomNumber: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      menuItemId: z.string().uuid('Valid MenuItem ID is required'),
      quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
      notes: z.string().optional()
    })
  ).min(1, 'At least 1 item is required in the order')
});

export const settleOnlinePaymentSchema = z.object({
  orderId: z.string().uuid('Valid Online Order ID is required'),
  paymentMethod: z.enum(['UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'PAY_AT_COUNTER', 'ROOM_POSTING']),
  transactionRef: z.string().optional(),
  roomBookingId: z.string().optional()
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['RECEIVED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED'])
});

export type GenerateTableQRInput = z.infer<typeof generateTableQRSchema>;
export type PlaceOnlineOrderInput = z.infer<typeof placeOnlineOrderSchema>;
export type SettleOnlinePaymentInput = z.infer<typeof settleOnlinePaymentSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
