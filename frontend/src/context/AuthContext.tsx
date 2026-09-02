'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import { UserProfile } from '../types/auth.types';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: (idToken: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('apex_user_profile');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return null;
  });
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('apex_auth_token');
    }
    return null;
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return Boolean(localStorage.getItem('apex_auth_token'));
    }
    return false;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchUserProfile = useCallback(async (authToken?: string) => {
    const activeToken = authToken || (typeof window !== 'undefined' ? localStorage.getItem('apex_auth_token') : null);
    if (!activeToken) {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const res = await apiClient.get('/auth/me', {
        headers: { Authorization: `Bearer ${activeToken}` },
      });

      if (res.data) {
        setUser(res.data);
        setIsAuthenticated(true);
        setToken(activeToken);

        if (typeof window !== 'undefined') {
          localStorage.setItem('apex_user_profile', JSON.stringify(res.data));
          const activeBranch = res.data.active_branch || res.data.activeBranch;
          if (activeBranch && !sessionStorage.getItem('apex_active_outlet_id')) {
            sessionStorage.setItem('apex_active_outlet_id', activeBranch.id);
            sessionStorage.setItem('apex_active_outlet_code', activeBranch.code);
          }
        }
      }
    } catch (err: any) {
      console.warn('[Auth] Session check response:', err?.response?.data || err.message);
      if (err?.response?.status === 401) {
        // Token is definitively invalid/expired
        if (typeof window !== 'undefined') {
          localStorage.removeItem('apex_auth_token');
          localStorage.removeItem('apex_refresh_token');
          localStorage.removeItem('apex_user_profile');
        }
        setUser(null);
        setToken(null);
        setIsAuthenticated(false);
      } else {
        // Network / offline error — preserve authenticated session from local cache
        if (typeof window !== 'undefined') {
          const cachedProfile = localStorage.getItem('apex_user_profile');
          if (cachedProfile && activeToken) {
            try {
              setUser(JSON.parse(cachedProfile));
              setIsAuthenticated(true);
              setToken(activeToken);
            } catch {}
          }
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      const res = await apiClient.post('/auth/login', { email, password });
      const data = res.data;

      if (data && data.access_token) {
        const accessToken = data.access_token;
        const refreshToken = data.refresh_token;

        if (typeof window !== 'undefined') {
          localStorage.setItem('apex_auth_token', accessToken);
          if (refreshToken) {
            localStorage.setItem('apex_refresh_token', refreshToken);
          }
        }

        setToken(accessToken);
        setIsAuthenticated(true);

        if (data.user) {
          setUser(data.user);
          if (typeof window !== 'undefined') {
            localStorage.setItem('apex_user_profile', JSON.stringify(data.user));
          }
          const activeBranch = data.user.active_branch || data.user.activeBranch;
          if (activeBranch && typeof window !== 'undefined') {
            sessionStorage.setItem('apex_active_outlet_id', activeBranch.id);
            sessionStorage.setItem('apex_active_outlet_code', activeBranch.code);
          }
        } else {
          await fetchUserProfile(accessToken);
        }

        return { success: true };
      }
      return { success: false, error: 'Invalid response from server' };
    } catch (err: any) {
      const errorDetail = err?.response?.data?.detail || err?.message || 'Login failed';
      console.error('[Auth Login Error]:', errorDetail);
      return { success: false, error: errorDetail };
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (idToken: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      const res = await apiClient.post('/auth/google', { id_token: idToken });
      const data = res.data;

      if (data && data.access_token) {
        const accessToken = data.access_token;
        if (typeof window !== 'undefined') {
          localStorage.setItem('apex_auth_token', accessToken);
          if (data.refresh_token) {
            localStorage.setItem('apex_refresh_token', data.refresh_token);
          }
        }

        setToken(accessToken);
        setIsAuthenticated(true);
        if (data.user) {
          setUser(data.user);
          if (typeof window !== 'undefined') {
            localStorage.setItem('apex_user_profile', JSON.stringify(data.user));
          }
        } else {
          await fetchUserProfile(accessToken);
        }
        return { success: true };
      }
      return { success: false, error: 'Google login failed' };
    } catch (err: any) {
      const errorDetail = err?.response?.data?.detail || err?.message || 'Google authentication failed';
      return { success: false, error: errorDetail };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout').catch(() => {});
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('apex_auth_token');
        localStorage.removeItem('apex_refresh_token');
        localStorage.removeItem('apex_user_profile');
        sessionStorage.removeItem('apex_active_outlet_id');
        sessionStorage.removeItem('apex_active_outlet_code');
        sessionStorage.removeItem('apex_active_outlet_name');
        sessionStorage.removeItem('apex_active_outlet_type');
      }
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  };

  const refreshProfile = async (): Promise<void> => {
    await fetchUserProfile();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isLoading,
        login,
        loginWithGoogle,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthProvider;
