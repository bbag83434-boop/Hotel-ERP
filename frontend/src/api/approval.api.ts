import { apiClient } from './axios';
import {
  ApprovalRequest,
  ApprovalRule,
  ApprovalStatus,
  ApprovalType,
  ApprovalSummary,
  CreateApprovalRulePayload,
  UpdateApprovalRulePayload,
  ActOnApprovalPayload
} from '../types/approval.types';

export const approvalApi = {
  // Summary Metrics
  getSummary: async (branchId?: string): Promise<ApprovalSummary> => {
    const res = await apiClient.get('/approval/summary', { params: { branchId } });
    return res.data.data;
  },

  // Requests
  getRequests: async (params?: {
    branchId?: string;
    status?: ApprovalStatus;
    transactionType?: ApprovalType;
    requestedById?: string;
  }): Promise<ApprovalRequest[]> => {
    const res = await apiClient.get('/approval/requests', { params });
    return res.data.data;
  },

  createRequest: async (data: any): Promise<ApprovalRequest> => {
    const res = await apiClient.post('/approval/requests', data);
    return res.data.data;
  },

  actOnRequest: async (id: string, data: ActOnApprovalPayload): Promise<ApprovalRequest> => {
    const res = await apiClient.post(`/approval/requests/${id}/action`, data);
    return res.data.data;
  },

  // Rules Matrix
  getRules: async (branchId?: string): Promise<ApprovalRule[]> => {
    const res = await apiClient.get('/approval/rules', { params: { branchId } });
    return res.data.data;
  },

  createRule: async (data: CreateApprovalRulePayload): Promise<ApprovalRule> => {
    const res = await apiClient.post('/approval/rules', data);
    return res.data.data;
  },

  updateRule: async (id: string, data: UpdateApprovalRulePayload): Promise<ApprovalRule> => {
    const res = await apiClient.put(`/approval/rules/${id}`, data);
    return res.data.data;
  },

  deleteRule: async (id: string): Promise<{ success: boolean }> => {
    const res = await apiClient.delete(`/approval/rules/${id}`);
    return res.data.data;
  }
};
