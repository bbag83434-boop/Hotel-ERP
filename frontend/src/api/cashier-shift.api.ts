import { apiClient } from './axios';
import {
  CashSession,
  CashMovement,
  OpenShiftPayload,
  CashMovementPayload,
  CloseShiftPayload,
  ReconcileShiftPayload
} from '../types/cashier-shift.types';

export const cashierShiftApi = {
  // Get active shift for current terminal/branch
  getActiveSession: async (branchId?: string): Promise<CashSession | null> => {
    const res = await apiClient.get('/cashier-shifts/active', { params: { branchId } });
    return res.data.data;
  },

  // Open shift
  openSession: async (data: OpenShiftPayload): Promise<CashSession> => {
    const res = await apiClient.post('/cashier-shifts/open', data);
    return res.data.data;
  },

  // Record cash movement (Cash In, Cash Out, Safe Drop)
  recordMovement: async (data: CashMovementPayload): Promise<CashMovement> => {
    const res = await apiClient.post('/cashier-shifts/movement', data);
    return res.data.data;
  },

  // Close shift
  closeSession: async (data: CloseShiftPayload): Promise<CashSession> => {
    const res = await apiClient.post('/cashier-shifts/close', data);
    return res.data.data;
  },

  // Manager reconciliation signoff
  reconcileSession: async (data: ReconcileShiftPayload): Promise<CashSession> => {
    const res = await apiClient.post('/cashier-shifts/reconcile', data);
    return res.data.data;
  },

  // Shift history
  getHistory: async (params?: {
    branchId?: string;
    cashierId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<CashSession[]> => {
    const res = await apiClient.get('/cashier-shifts/history', { params });
    return res.data.data;
  },

  // Single shift details
  getSessionSummary: async (sessionId: string): Promise<{ session: CashSession; payments: any[] }> => {
    const res = await apiClient.get(`/cashier-shifts/${sessionId}`);
    return res.data.data;
  }
};
