import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, AuthState } from '../types/auth.types';
import { authApi } from '../api/auth.api';

interface AuthContextType extends AuthState {
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setSelectedBranchId: (branchId: string) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(
    localStorage.getItem('accessToken')
  );
  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(
    localStorage.getItem('selectedBranchId')
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    try {
      const storedToken = localStorage.getItem('accessToken');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }
      const userProfile = await authApi.getMe();
      setUser(userProfile);

      // Default branch selection
      const savedBranchId = localStorage.getItem('selectedBranchId');
      if (savedBranchId && userProfile.branches.some((b) => b.id === savedBranchId)) {
        setSelectedBranchIdState(savedBranchId);
      } else if (userProfile.defaultBranch) {
        setSelectedBranchIdState(userProfile.defaultBranch.id);
        localStorage.setItem('selectedBranchId', userProfile.defaultBranch.id);
      } else if (userProfile.branches.length > 0) {
        setSelectedBranchIdState(userProfile.branches[0].id);
        localStorage.setItem('selectedBranchId', userProfile.branches[0].id);
      }
    } catch {
      localStorage.removeItem('accessToken');
      setUser(null);
      setAccessToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (identifier: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await authApi.login(identifier, password);
      localStorage.setItem('accessToken', res.accessToken);
      setAccessToken(res.accessToken);
      setUser(res.user);

      if (res.user.defaultBranch) {
        setSelectedBranchIdState(res.user.defaultBranch.id);
        localStorage.setItem('selectedBranchId', res.user.defaultBranch.id);
      } else if (res.user.branches.length > 0) {
        setSelectedBranchIdState(res.user.branches[0].id);
        localStorage.setItem('selectedBranchId', res.user.branches[0].id);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignored
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('selectedBranchId');
      setUser(null);
      setAccessToken(null);
      setSelectedBranchIdState(null);
    }
  };

  const setSelectedBranchId = (branchId: string) => {
    setSelectedBranchIdState(branchId);
    localStorage.setItem('selectedBranchId', branchId);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!user,
        isLoading,
        selectedBranchId,
        login,
        logout,
        setSelectedBranchId,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
