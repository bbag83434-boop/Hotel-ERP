import { apiClient } from './axios';
import {
  Floor,
  RoomType,
  Room,
  GuestProfile,
  Booking,
  HousekeepingTask,
  MaintenanceTicket,
  NightAudit
} from '../types/hotel.types';

export const hotelApi = {
  // Floors & Rooms
  getFloors: async (branchId?: string): Promise<Floor[]> => {
    const res = await apiClient.get('/hotel/floors', { params: { branchId } });
    return res.data.data;
  },

  createFloor: async (data: Partial<Floor>): Promise<Floor> => {
    const res = await apiClient.post('/hotel/floors', data);
    return res.data.data;
  },

  getRoomTypes: async (branchId?: string): Promise<RoomType[]> => {
    const res = await apiClient.get('/hotel/room-types', { params: { branchId } });
    return res.data.data;
  },

  createRoomType: async (data: Partial<RoomType>): Promise<RoomType> => {
    const res = await apiClient.post('/hotel/room-types', data);
    return res.data.data;
  },

  getRooms: async (branchId?: string, status?: string): Promise<Room[]> => {
    const res = await apiClient.get('/hotel/rooms', { params: { branchId, status } });
    return res.data.data;
  },

  createRoom: async (data: Partial<Room>): Promise<Room> => {
    const res = await apiClient.post('/hotel/rooms', data);
    return res.data.data;
  },

  updateRoomStatus: async (id: string, status: string): Promise<Room> => {
    const res = await apiClient.patch(`/hotel/rooms/${id}/status`, { status });
    return res.data.data;
  },

  // Guests
  getGuests: async (search?: string): Promise<GuestProfile[]> => {
    const res = await apiClient.get('/hotel/guests', { params: { search } });
    return res.data.data;
  },

  createGuest: async (data: Partial<GuestProfile>): Promise<GuestProfile> => {
    const res = await apiClient.post('/hotel/guests', data);
    return res.data.data;
  },

  // Bookings
  getBookings: async (params?: { branchId?: string; status?: string; startDate?: string; endDate?: string }): Promise<Booking[]> => {
    const res = await apiClient.get('/hotel/bookings', { params });
    return res.data.data;
  },

  createBooking: async (data: any): Promise<Booking> => {
    const res = await apiClient.post('/hotel/bookings', data);
    return res.data.data;
  },

  checkInGuest: async (id: string, data: { roomId: string; keyCardNumber?: string; notes?: string }): Promise<Booking> => {
    const res = await apiClient.post(`/hotel/bookings/${id}/check-in`, data);
    return res.data.data;
  },

  postFolioCharge: async (id: string, data: { transactionType: string; description: string; amount: number }): Promise<any> => {
    const res = await apiClient.post(`/hotel/bookings/${id}/folio-charge`, data);
    return res.data.data;
  },

  changeRoom: async (id: string, data: { newRoomId: string; reason: string }): Promise<Booking> => {
    const res = await apiClient.post(`/hotel/bookings/${id}/room-change`, data);
    return res.data.data;
  },

  checkOutGuest: async (id: string, data: { paymentMethod: string; amountPaid: number; discountAmount?: number; notes?: string }): Promise<Booking> => {
    const res = await apiClient.post(`/hotel/bookings/${id}/check-out`, data);
    return res.data.data;
  },

  // Night Audit
  runNightAudit: async (data: { branchId: string; auditDate?: string; notes?: string }): Promise<NightAudit> => {
    const res = await apiClient.post('/hotel/night-audit', data);
    return res.data.data;
  },

  // Housekeeping & Maintenance
  getHousekeepingTasks: async (branchId?: string, status?: string): Promise<HousekeepingTask[]> => {
    const res = await apiClient.get('/hotel/housekeeping', { params: { branchId, status } });
    return res.data.data;
  },

  createHousekeepingTask: async (data: any): Promise<HousekeepingTask> => {
    const res = await apiClient.post('/hotel/housekeeping', data);
    return res.data.data;
  },

  updateHousekeepingStatus: async (id: string, status: string, remarks?: string): Promise<HousekeepingTask> => {
    const res = await apiClient.patch(`/hotel/housekeeping/${id}/status`, { status, remarks });
    return res.data.data;
  },

  getMaintenanceTickets: async (branchId?: string): Promise<MaintenanceTicket[]> => {
    const res = await apiClient.get('/hotel/maintenance', { params: { branchId } });
    return res.data.data;
  },

  createMaintenanceTicket: async (data: any): Promise<MaintenanceTicket> => {
    const res = await apiClient.post('/hotel/maintenance', data);
    return res.data.data;
  }
};
