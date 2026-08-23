import { apiClient } from './client';
import {
  ManagedUser,
  UserCreatePayload,
  UserUpdatePayload,
  UserManagementSummary,
  UserRoleInfo,
  UserFilterParams,
} from '@/types/user.types';

export const usersApi = {
  /**
   * Fetch list of users with optional filtering
   */
  getUsers: async (params?: UserFilterParams): Promise<ManagedUser[]> => {
    const res = await apiClient.get('/users', { params });
    return res.data;
  },

  /**
   * Fetch single user details
   */
  getUser: async (id: string): Promise<ManagedUser> => {
    const res = await apiClient.get(`/users/${id}`);
    return res.data;
  },

  /**
   * Fetch high-level summary KPIs and role distribution
   */
  getSummary: async (): Promise<UserManagementSummary> => {
    const res = await apiClient.get('/users/summary');
    return res.data;
  },

  /**
   * Fetch all assignable roles
   */
  getRoles: async (): Promise<UserRoleInfo[]> => {
    const res = await apiClient.get('/users/roles');
    return res.data;
  },

  /**
   * Create a new user (supports OAuth SSO passwordless mode)
   */
  createUser: async (payload: UserCreatePayload): Promise<ManagedUser> => {
    const res = await apiClient.post('/users', payload);
    return res.data;
  },

  /**
   * Update an existing user
   */
  updateUser: async (id: string, payload: UserUpdatePayload): Promise<ManagedUser> => {
    const res = await apiClient.put(`/users/${id}`, payload);
    return res.data;
  },

  /**
   * Update user active status
   */
  updateUserStatus: async (id: string, is_active: boolean): Promise<ManagedUser> => {
    const res = await apiClient.patch(`/users/${id}/status`, { is_active });
    return res.data;
  },

  /**
   * Toggle user status alias
   */
  toggleUserStatus: async (id: string, is_active: boolean): Promise<ManagedUser> => {
    const res = await apiClient.patch(`/users/${id}/status`, { is_active });
    return res.data;
  },

  /**
   * Soft-delete / deactivate user (preserves audit trail)
   */
  deactivateUser: async (id: string): Promise<{ success: boolean; message: string; user_id: string; is_active: boolean }> => {
    const res = await apiClient.delete(`/users/${id}`);
    return res.data;
  },
};

export const userApi = usersApi;
