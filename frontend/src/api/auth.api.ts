import { apiClient } from './axios';
import { User } from '../types/auth.types';

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export const authApi = {
  login: async (identifier: string, password: string): Promise<LoginResponse> => {
    const res = await apiClient.post('/auth/login', { identifier, password });
    return res.data.data;
  },

  loginWithGoogle: async (data: {
    credential: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
  }): Promise<LoginResponse> => {
    const res = await apiClient.post('/auth/google', data);
    return res.data.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },

  getMe: async (): Promise<User> => {
    const res = await apiClient.get('/auth/me');
    return res.data.data;
  }
};

