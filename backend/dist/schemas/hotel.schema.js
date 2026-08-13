"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runNightAuditSchema = exports.createMaintenanceTicketSchema = exports.updateHousekeepingStatusSchema = exports.createHousekeepingTaskSchema = exports.roomChangeSchema = exports.postFolioChargeSchema = exports.checkOutSchema = exports.checkInSchema = exports.createBookingSchema = exports.createGuestProfileSchema = exports.updateRoomStatusSchema = exports.createRoomSchema = exports.createRoomTypeSchema = exports.createFloorSchema = void 0;
const zod_1 = require("zod");
exports.createFloorSchema = zod_1.z.object({
    branchId: zod_1.z.string().uuid('Valid Branch ID is required'),
    floorNumber: zod_1.z.number().int(),
    name: zod_1.z.string().min(1, 'Floor name is required'),
    description: zod_1.z.string().optional()
});
exports.createRoomTypeSchema = zod_1.z.object({
    branchId: zod_1.z.string().uuid('Valid Branch ID is required'),
    name: zod_1.z.string().min(1, 'Room type name is required'),
    code: zod_1.z.string().min(1, 'Room type code is required'),
    description: zod_1.z.string().optional(),
    baseOccupancy: zod_1.z.number().int().min(1).default(2),
    maxOccupancy: zod_1.z.number().int().min(1).default(4),
    baseRate: zod_1.z.number().min(0, 'Base rate must be positive'),
    amenities: zod_1.z.string().optional()
});
exports.createRoomSchema = zod_1.z.object({
    branchId: zod_1.z.string().uuid('Valid Branch ID is required'),
    floorId: zod_1.z.string().uuid('Valid Floor ID is required'),
    roomTypeId: zod_1.z.string().uuid('Valid RoomType ID is required'),
    roomNumber: zod_1.z.string().min(1, 'Room number is required'),
    notes: zod_1.z.string().optional()
});
exports.updateRoomStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'DIRTY_CLEANING', 'OUT_OF_SERVICE', 'INSPECTED'])
});
exports.createGuestProfileSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1, 'First name is required'),
    lastName: zod_1.z.string().min(1, 'Last name is required'),
    email: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
    phone: zod_1.z.string().optional(),
    idType: zod_1.z.enum(['PASSPORT', 'NATIONAL_ID', 'DRIVING_LICENSE']).default('PASSPORT'),
    idNumber: zod_1.z.string().optional(),
    nationality: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    vipStatus: zod_1.z.enum(['NONE', 'SILVER', 'GOLD', 'PLATINUM']).default('NONE'),
    preferences: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional()
});
exports.createBookingSchema = zod_1.z.object({
    branchId: zod_1.z.string().uuid('Valid Branch ID is required'),
    guestId: zod_1.z.string().uuid('Valid Guest ID is required'),
    roomId: zod_1.z.string().uuid().optional().nullable(),
    roomTypeId: zod_1.z.string().uuid('Valid RoomType ID is required'),
    ratePlanId: zod_1.z.string().uuid().optional().nullable(),
    checkInDate: zod_1.z.string().min(1, 'Check-in date is required'),
    checkOutDate: zod_1.z.string().min(1, 'Check-out date is required'),
    adults: zod_1.z.number().int().min(1).default(1),
    children: zod_1.z.number().int().min(0).default(0),
    roomRate: zod_1.z.number().min(0, 'Room rate must be positive'),
    source: zod_1.z.string().default('DIRECT_WALKIN'),
    notes: zod_1.z.string().optional(),
    advancePayment: zod_1.z.number().min(0).optional()
});
exports.checkInSchema = zod_1.z.object({
    roomId: zod_1.z.string().uuid('Room selection is required for check-in'),
    idVerified: zod_1.z.boolean().default(true),
    keyCardNumber: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional()
});
exports.checkOutSchema = zod_1.z.object({
    paymentMethod: zod_1.z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_BANKING', 'ROOM_POSTING', 'SPLIT']),
    amountPaid: zod_1.z.number().min(0, 'Payment amount must be 0 or positive'),
    discountAmount: zod_1.z.number().min(0).optional(),
    notes: zod_1.z.string().optional()
});
exports.postFolioChargeSchema = zod_1.z.object({
    transactionType: zod_1.z.enum(['ROOM_CHARGE', 'FOOD_BEVERAGE_POS', 'LAUNDRY', 'SPA', 'MINIBAR', 'PAYMENT', 'DISCOUNT', 'TAX', 'REFUND']),
    description: zod_1.z.string().min(1, 'Description is required'),
    amount: zod_1.z.number(),
    referenceId: zod_1.z.string().optional()
});
exports.roomChangeSchema = zod_1.z.object({
    newRoomId: zod_1.z.string().uuid('Valid target Room ID is required'),
    reason: zod_1.z.string().min(1, 'Reason for room change is required')
});
exports.createHousekeepingTaskSchema = zod_1.z.object({
    branchId: zod_1.z.string().uuid(),
    roomId: zod_1.z.string().uuid(),
    taskType: zod_1.z.enum(['DAILY_CLEAN', 'DEEP_CLEAN', 'CHECKOUT_CLEAN', 'TURNDOWN', 'INSPECTION']),
    priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
    assignedToId: zod_1.z.string().uuid().optional().nullable(),
    remarks: zod_1.z.string().optional()
});
exports.updateHousekeepingStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'INSPECTED']),
    remarks: zod_1.z.string().optional()
});
exports.createMaintenanceTicketSchema = zod_1.z.object({
    branchId: zod_1.z.string().uuid(),
    roomId: zod_1.z.string().uuid().optional().nullable(),
    title: zod_1.z.string().min(1, 'Title is required'),
    description: zod_1.z.string().min(1, 'Description is required'),
    category: zod_1.z.enum(['PLUMBING', 'ELECTRICAL', 'HVAC', 'CARPENTRY', 'APPLIANCE', 'OTHER']),
    priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY']).default('MEDIUM'),
    assignedToId: zod_1.z.string().uuid().optional().nullable()
});
exports.runNightAuditSchema = zod_1.z.object({
    branchId: zod_1.z.string().uuid(),
    auditDate: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional()
});
