import { apiClient } from './client';
import {
  WastageEntry,
  WastageEntryCreateInput,
  WastageAnalytics,
  WastageReason,
} from '../types/wastage.types';

export const wastageApi = {
  getReasons: async (): Promise<WastageReason[]> => {
    const res = await apiClient.get<WastageReason[]>('/wastage/reasons');
    return res.data;
  },

  getEntries: async (params?: {
    branch_id?: string;
    warehouse_id?: string;
    status?: string;
    reason_code?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
  }): Promise<WastageEntry[]> => {
    const res = await apiClient.get<WastageEntry[]>('/wastage/entries', { params });
    return res.data;
  },

  getEntry: async (id: string): Promise<WastageEntry> => {
    const res = await apiClient.get<WastageEntry>(`/wastage/entries/${id}`);
    return res.data;
  },

  createEntry: async (payload: WastageEntryCreateInput): Promise<WastageEntry> => {
    const res = await apiClient.post<WastageEntry>('/wastage/entries', payload);
    return res.data;
  },

  submitEntry: async (id: string): Promise<WastageEntry> => {
    const res = await apiClient.post<WastageEntry>(`/wastage/entries/${id}/submit`);
    return res.data;
  },

  approveEntry: async (id: string, payload?: { notes?: string }): Promise<WastageEntry> => {
    const res = await apiClient.post<WastageEntry>(`/wastage/entries/${id}/approve`, payload);
    return res.data;
  },

  rejectEntry: async (id: string, payload: { rejection_reason: string; notes?: string }): Promise<WastageEntry> => {
    const res = await apiClient.post<WastageEntry>(`/wastage/entries/${id}/reject`, payload);
    return res.data;
  },

  getAnalytics: async (params?: { branch_id?: string; days?: number }): Promise<WastageAnalytics> => {
    const res = await apiClient.get<WastageAnalytics>('/wastage/analytics', { params });
    return res.data;
  },
};
