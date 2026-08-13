import { apiClient } from './axios';
import { ApprovalRequest, ApprovalRule, ApprovalStatus, ApprovalType } from '../types/approval.types';

export const approvalApi = {
  getRequests: async (params?: { branchId?: string; status?: ApprovalStatus; transactionType?: ApprovalType }): Promise<ApprovalRequest[]> => {
    const res = await apiClient.get('/approval/requests', { params });
    return res.data.data;
  },

  createRequest: async (data: any): Promise<ApprovalRequest> => {
    const res = await apiClient.post('/approval/requests', data);
    return res.data.data;
  },

  actOnRequest: async (id: string, data: { action: ApprovalStatus; comment?: string }): Promise<ApprovalRequest> => {
    const res = await apiClient.post(`/approval/requests/${id}/action`, data);
    return res.data.data;
  },

  getRules: async (branchId?: string): Promise<ApprovalRule[]> => {
    const res = await apiClient.get('/approval/rules', { params: { branchId } });
    return res.data.data;
  },

  createRule: async (data: any): Promise<ApprovalRule> => {
    const res = await apiClient.post('/approval/rules', data);
    return res.data.data;
  }
};
