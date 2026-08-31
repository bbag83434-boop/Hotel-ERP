export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'DIRTY_CLEANING' | 'OUT_OF_SERVICE' | 'INSPECTED';

export type BookingStatus = 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';

export type FolioTxType =
  | 'ROOM_CHARGE'
  | 'FOOD_BEVERAGE_POS'
  | 'LAUNDRY'
  | 'SPA'
  | 'MINIBAR'
  | 'PAYMENT'
  | 'DISCOUNT'
  | 'TAX'
  | 'REFUND';

export type HousekeepingStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'INSPECTED';
export type HousekeepingTaskType = 'DAILY_CLEAN' | 'DEEP_CLEAN' | 'CHECKOUT_CLEAN' | 'TURNDOWN' | 'INSPECTION';

export interface Floor {
  id: string;
  branchId: string;
  floorNumber: number;
  name: string;
  description?: string;
  rooms?: Room[];
}

export interface RoomType {
  id: string;
  branchId: string;
  name: string;
  code: string;
  description?: string;
  baseOccupancy: number;
  maxOccupancy: number;
  baseRate: number | string;
  amenities?: string;
}

export interface Room {
  id: string;
  branchId: string;
  floorId: string;
  roomTypeId: string;
  roomNumber: string;
  status: RoomStatus;
  isKeyIssued: boolean;
  currentBookingId?: string | null;
  notes?: string;
  floor?: Floor;
  roomType?: RoomType;
  bookings?: Booking[];
}

export interface GuestProfile {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  idType?: string;
  idNumber?: string;
  nationality?: string;
  address?: string;
  vipStatus: string;
  preferences?: string;
  notes?: string;
  bookings?: Booking[];
}

export interface FolioTransaction {
  id: string;
  bookingId: string;
  transactionType: FolioTxType;
  description: string;
  amount: number | string;
  referenceId?: string;
  createdAt: string;
}

export interface Booking {
  id: string;
  branchId: string;
  guestId: string;
  roomId?: string | null;
  roomTypeId: string;
  bookingNumber: string;
  checkInDate: string;
  checkOutDate: string;
  actualCheckIn?: string;
  actualCheckOut?: string;
  adults: number;
  children: number;
  roomRate: number | string;
  totalRoomCharges: number | string;
  extraCharges: number | string;
  taxAmount: number | string;
  discountAmount: number | string;
  grandTotal: number | string;
  paidAmount: number | string;
  balanceAmount: number | string;
  status: BookingStatus;
  paymentStatus: string;
  source: string;
  notes?: string;
  guest?: GuestProfile;
  room?: Room;
  roomType?: RoomType;
  folioTransactions?: FolioTransaction[];
}

export interface HousekeepingTask {
  id: string;
  branchId: string;
  roomId: string;
  taskType: HousekeepingTaskType;
  status: HousekeepingStatus;
  priority: string;
  remarks?: string;
  startedAt?: string;
  completedAt?: string;
  room?: Room;
  assignedTo?: { id: string; firstName: string; lastName: string };
  createdAt: string;
}

export interface MaintenanceTicket {
  id: string;
  branchId: string;
  roomId?: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  cost: number | string;
  room?: Room;
  assignedTo?: { id: string; firstName: string; lastName: string };
  createdAt: string;
}

export interface NightAudit {
  id: string;
  branchId: string;
  auditDate: string;
  totalRooms: number;
  occupiedRooms: number;
  occupancyRate: number | string;
  roomRevenue: number | string;
  fnbRevenue: number | string;
  otherRevenue: number | string;
  totalRevenue: number | string;
  adr: number | string;
  revpar: number | string;
  status: string;
  createdAt: string;
}
