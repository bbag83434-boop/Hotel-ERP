import { apiClient } from './client';
export const hotelApi = {
  summary: async (branchId?: string) => (await apiClient.get('/hotel/summary', { params: branchId ? { branch_id: branchId } : {} })).data,
  rooms: async (params?: any) => (await apiClient.get('/hotel/rooms', { params })).data,
  createRoom: async (payload: any) => (await apiClient.post('/hotel/rooms', payload)).data,
  updateRoom: async (id: string, payload: any) => (await apiClient.patch(`/hotel/rooms/${id}`, payload)).data,
  bookings: async (params?: any) => (await apiClient.get('/hotel/bookings', { params })).data,
  createBooking: async (payload: any) => (await apiClient.post('/hotel/bookings', payload)).data,
  updateBooking: async (id: string, payload: any) => (await apiClient.patch(`/hotel/bookings/${id}`, payload)).data,
  housekeeping: async (params?: any) => (await apiClient.get('/hotel/housekeeping', { params })).data,
  createHousekeeping: async (payload: any) => (await apiClient.post('/hotel/housekeeping', payload)).data,
  updateHousekeeping: async (id: string, payload: any) => (await apiClient.patch(`/hotel/housekeeping/${id}`, payload)).data,
};
