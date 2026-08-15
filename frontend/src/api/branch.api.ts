import { apiClient } from './axios';

export interface Branch {
  id: string;
  companyId: string;
  name: string;
  code: string;
  type: 'HOTEL' | 'RESTAURANT' | 'RETAIL' | 'HYBRID' | 'CENTRAL_KITCHEN' | 'MAIN_STORE';
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBranchInput {
  name: string;
  code: string;
  type: 'HOTEL' | 'RESTAURANT' | 'RETAIL' | 'HYBRID' | 'CENTRAL_KITCHEN' | 'MAIN_STORE';
  email?: string;
  phone?: string;
  address: string;
}

export const branchApi = {
  getBranches: async (): Promise<Branch[]> => {
    const res = await apiClient.get('/branches');
    return res.data.data;
  },

  createBranch: async (data: CreateBranchInput): Promise<Branch> => {
    const res = await apiClient.post('/branches', data);
    return res.data.data;
  }
};
