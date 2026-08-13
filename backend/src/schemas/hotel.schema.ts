import { z } from 'zod';

export const createFloorSchema = z.object({
  branchId: z.string().uuid('Valid Branch ID is required'),
  floorNumber: z.number().int(),
  name: z.string().min(1, 'Floor name is required'),
  description: z.string().optional()
});

export const createRoomTypeSchema = z.object({
  branchId: z.string().uuid('Valid Branch ID is required'),
  name: z.string().min(1, 'Room type name is required'),
  code: z.string().min(1, 'Room type code is required'),
  description: z.string().optional(),
  baseOccupancy: z.number().int().min(1).default(2),
  maxOccupancy: z.number().int().min(1).default(4),
  baseRate: z.number().min(0, 'Base rate must be positive'),
  amenities: z.string().optional()
});

export const createRoomSchema = z.object({
  branchId: z.string().uuid('Valid Branch ID is required'),
  floorId: z.string().uuid('Valid Floor ID is required'),
  roomTypeId: z.string().uuid('Valid RoomType ID is required'),
  roomNumber: z.string().min(1, 'Room number is required'),
  notes: z.string().optional()
});

export const updateRoomStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'DIRTY_CLEANING', 'OUT_OF_SERVICE', 'INSPECTED'])
});

export const createGuestProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  idType: z.enum(['PASSPORT', 'NATIONAL_ID', 'DRIVING_LICENSE']).default('PASSPORT'),
  idNumber: z.string().optional(),
  nationality: z.string().optional(),
  address: z.string().optional(),
  vipStatus: z.enum(['NONE', 'SILVER', 'GOLD', 'PLATINUM']).default('NONE'),
  preferences: z.string().optional(),
  notes: z.string().optional()
});

export const createBookingSchema = z.object({
  branchId: z.string().uuid('Valid Branch ID is required'),
  guestId: z.string().uuid('Valid Guest ID is required'),
  roomId: z.string().uuid().optional().nullable(),
  roomTypeId: z.string().uuid('Valid RoomType ID is required'),
  ratePlanId: z.string().uuid().optional().nullable(),
  checkInDate: z.string().min(1, 'Check-in date is required'),
  checkOutDate: z.string().min(1, 'Check-out date is required'),
  adults: z.number().int().min(1).default(1),
  children: z.number().int().min(0).default(0),
  roomRate: z.number().min(0, 'Room rate must be positive'),
  source: z.string().default('DIRECT_WALKIN'),
  notes: z.string().optional(),
  advancePayment: z.number().min(0).optional()
});

export const checkInSchema = z.object({
  roomId: z.string().uuid('Room selection is required for check-in'),
  idVerified: z.boolean().default(true),
  keyCardNumber: z.string().optional(),
  notes: z.string().optional()
});

export const checkOutSchema = z.object({
  paymentMethod: z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_BANKING', 'ROOM_POSTING', 'SPLIT']),
  amountPaid: z.number().min(0, 'Payment amount must be 0 or positive'),
  discountAmount: z.number().min(0).optional(),
  notes: z.string().optional()
});

export const postFolioChargeSchema = z.object({
  transactionType: z.enum(['ROOM_CHARGE', 'FOOD_BEVERAGE_POS', 'LAUNDRY', 'SPA', 'MINIBAR', 'PAYMENT', 'DISCOUNT', 'TAX', 'REFUND']),
  description: z.string().min(1, 'Description is required'),
  amount: z.number(),
  referenceId: z.string().optional()
});

export const roomChangeSchema = z.object({
  newRoomId: z.string().uuid('Valid target Room ID is required'),
  reason: z.string().min(1, 'Reason for room change is required')
});

export const createHousekeepingTaskSchema = z.object({
  branchId: z.string().uuid(),
  roomId: z.string().uuid(),
  taskType: z.enum(['DAILY_CLEAN', 'DEEP_CLEAN', 'CHECKOUT_CLEAN', 'TURNDOWN', 'INSPECTION']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  assignedToId: z.string().uuid().optional().nullable(),
  remarks: z.string().optional()
});

export const updateHousekeepingStatusSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'INSPECTED']),
  remarks: z.string().optional()
});

export const createMaintenanceTicketSchema = z.object({
  branchId: z.string().uuid(),
  roomId: z.string().uuid().optional().nullable(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  category: z.enum(['PLUMBING', 'ELECTRICAL', 'HVAC', 'CARPENTRY', 'APPLIANCE', 'OTHER']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY']).default('MEDIUM'),
  assignedToId: z.string().uuid().optional().nullable()
});

export const runNightAuditSchema = z.object({
  branchId: z.string().uuid(),
  auditDate: z.string().optional(),
  notes: z.string().optional()
});
