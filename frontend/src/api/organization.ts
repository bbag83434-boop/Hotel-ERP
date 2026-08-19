import { apiClient } from './client';
import {
  Company,
  Branch,
  Warehouse,
  Department,
  Staff,
  BranchCreateInput,
  WarehouseCreateInput,
  DepartmentCreateInput,
  StaffCreateInput,
  OrganizationOverview,
  BranchDetail,
} from '../types/organization.types';

export const organizationApi = {
  // Overview & Analytics
  getOverview: async (): Promise<OrganizationOverview> => {
    const res = await apiClient.get<OrganizationOverview>('/organization/overview');
    return res.data;
  },

  // Company
  getCompany: async (): Promise<Company> => {
    const res = await apiClient.get<Company>('/organization/company');
    return res.data;
  },
  updateCompany: async (payload: Partial<Company>): Promise<Company> => {
    const res = await apiClient.put<Company>('/organization/company', payload);
    return res.data;
  },

  // Branches
  getBranches: async (params?: { branch_type?: string; is_active?: boolean }): Promise<Branch[]> => {
    const res = await apiClient.get<Branch[]>('/organization/branches', { params });
    return res.data;
  },
  getBranch: async (branchId: string): Promise<Branch> => {
    const res = await apiClient.get<Branch>(`/organization/branches/${branchId}`);
    return res.data;
  },
  getBranchDetails: async (branchId: string): Promise<BranchDetail> => {
    const res = await apiClient.get<BranchDetail>(`/organization/branches/${branchId}/details`);
    return res.data;
  },
  createBranch: async (payload: BranchCreateInput): Promise<Branch> => {
    const res = await apiClient.post<Branch>('/organization/branches', payload);
    return res.data;
  },
  updateBranch: async (branchId: string, payload: Partial<BranchCreateInput>): Promise<Branch> => {
    const res = await apiClient.put<Branch>(`/organization/branches/${branchId}`, payload);
    return res.data;
  },

  // Warehouses
  getWarehouses: async (params?: { branch_id?: string; is_central?: boolean }): Promise<Warehouse[]> => {
    const res = await apiClient.get<Warehouse[]>('/organization/warehouses', { params });
    return res.data;
  },
  getWarehouse: async (warehouseId: string): Promise<Warehouse> => {
    const res = await apiClient.get<Warehouse>(`/organization/warehouses/${warehouseId}`);
    return res.data;
  },
  createWarehouse: async (payload: WarehouseCreateInput): Promise<Warehouse> => {
    const res = await apiClient.post<Warehouse>('/organization/warehouses', payload);
    return res.data;
  },
  updateWarehouse: async (warehouseId: string, payload: Partial<WarehouseCreateInput>): Promise<Warehouse> => {
    const res = await apiClient.put<Warehouse>(`/organization/warehouses/${warehouseId}`, payload);
    return res.data;
  },

  // Departments
  getDepartments: async (params?: { branch_id?: string }): Promise<Department[]> => {
    const res = await apiClient.get<Department[]>('/organization/departments', { params });
    return res.data;
  },
  getDepartment: async (deptId: string): Promise<Department> => {
    const res = await apiClient.get<Department>(`/organization/departments/${deptId}`);
    return res.data;
  },
  createDepartment: async (payload: DepartmentCreateInput): Promise<Department> => {
    const res = await apiClient.post<Department>('/organization/departments', payload);
    return res.data;
  },
  updateDepartment: async (deptId: string, payload: Partial<DepartmentCreateInput>): Promise<Department> => {
    const res = await apiClient.put<Department>(`/organization/departments/${deptId}`, payload);
    return res.data;
  },

  // Staff
  getStaff: async (params?: { branch_id?: string; department?: string; status?: string }): Promise<Staff[]> => {
    const res = await apiClient.get<Staff[]>('/organization/staff', { params });
    return res.data;
  },
  getStaffById: async (staffId: string): Promise<Staff> => {
    const res = await apiClient.get<Staff>(`/organization/staff/${staffId}`);
    return res.data;
  },
  createStaff: async (payload: StaffCreateInput): Promise<Staff> => {
    const res = await apiClient.post<Staff>('/organization/staff', payload);
    return res.data;
  },
  updateStaff: async (staffId: string, payload: Partial<StaffCreateInput>): Promise<Staff> => {
    const res = await apiClient.put<Staff>(`/organization/staff/${staffId}`, payload);
    return res.data;
  },

  // Scoping & RBAC
  assignUserBranch: async (payload: { user_id: string; branch_id: string; is_default?: boolean }): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.post('/organization/users/assign-branch', payload);
    return res.data;
  },
  assignUserRole: async (payload: { user_id: string; role_id: string }): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.post('/organization/users/assign-role', payload);
    return res.data;
  },
};
