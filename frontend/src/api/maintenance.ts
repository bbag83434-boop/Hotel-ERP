import { apiClient } from './client';
import { MaintenanceAsset, MaintenanceTicket, MaintenanceSummary, AssetCreate, TicketCreate, TicketUpdate } from '@/types/maintenance.types';

export const maintenanceApi = {
  summary: async (branch_id?: string) => (await apiClient.get<MaintenanceSummary>('/maintenance/summary', { params: branch_id ? { branch_id } : {} })).data,
  assets: async (params?: { branch_id?: string; search?: string; status?: string }) => (await apiClient.get<MaintenanceAsset[]>('/maintenance/assets', { params })).data,
  createAsset: async (payload: AssetCreate) => (await apiClient.post<MaintenanceAsset>('/maintenance/assets', payload)).data,
  tickets: async (params?: { branch_id?: string; status?: string; priority?: string; search?: string }) => (await apiClient.get<MaintenanceTicket[]>('/maintenance/tickets', { params })).data,
  createTicket: async (payload: TicketCreate) => (await apiClient.post<MaintenanceTicket>('/maintenance/tickets', payload)).data,
  updateTicket: async (id: string, payload: TicketUpdate) => (await apiClient.patch<MaintenanceTicket>(`/maintenance/tickets/${id}`, payload)).data,
};
