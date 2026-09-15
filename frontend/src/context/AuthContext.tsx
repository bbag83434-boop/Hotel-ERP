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

/**
 * Admin roles must start without an automatically selected outlet.
 * Admin can still manually select an outlet later.
 */
const isAdminRole = (role: UserProfile['role'] | undefined): boolean => {
  const roleName =
    typeof role === 'object'
      ? role?.name || ''
      : role || '';

  return [
    'SUPER_ADMIN',
    'SUPERADMIN',
    'OWNER',
    'ADMIN',
    'HQ_ADMIN',
    'HEAD_OFFICE_ADMIN',
  ].includes(roleName.toUpperCase());
};

const clearActiveOutlet = () => {
  if (typeof window === 'undefined') return;

  sessionStorage.removeItem('apex_active_outlet_id');
  sessionStorage.removeItem('apex_active_outlet_code');
  sessionStorage.removeItem('apex_active_outlet_name');
  sessionStorage.removeItem('apex_active_outlet_type');
};

const setActiveOutletFromBranch = (activeBranch: any) => {
  if (typeof window === 'undefined' || !activeBranch) return;

  sessionStorage.setItem('apex_active_outlet_id', activeBranch.id);
  sessionStorage.setItem('apex_active_outlet_code', activeBranch.code || '');

  if (activeBranch.name) {
    sessionStorage.setItem('apex_active_outlet_name', activeBranch.name);
  }

  if (activeBranch.type) {
    sessionStorage.setItem('apex_active_outlet_type', activeBranch.type);
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('apex_user_profile');

        if (cached) {
          return JSON.parse(cached);
        }
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

  /**
   * Fetch current authenticated user's profile.
   *
   * Important:
   * Admin users are deliberately NOT assigned the backend's
   * active_branch automatically.
   */
  const fetchUserProfile = useCallback(async (authToken?: string) => {
    const activeToken =
      authToken ||
      (typeof window !== 'undefined'
        ? localStorage.getItem('apex_auth_token')
        : null);

    if (!activeToken) {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      const res = await apiClient.get('/auth/me', {
        headers: {
          Authorization: `Bearer ${activeToken}`,
        },
      });

      if (res.data) {
        const profile = res.data;

        setUser(profile);
        setIsAuthenticated(true);
        setToken(activeToken);

        if (typeof window !== 'undefined') {
          localStorage.setItem(
            'apex_user_profile',
            JSON.stringify(profile)
          );

          /**
           * ADMIN:
           * Never automatically restore backend active_branch.
           *
           * This prevents an Admin login from opening
           * Salt Lake or any other previously assigned outlet.
           */
          if (isAdminRole(profile.role)) {
            clearActiveOutlet();
          } else {
            /**
             * NORMAL OUTLET USER:
             * Preserve existing backend active branch behavior.
             */
            const activeBranch =
              profile.active_branch || profile.activeBranch;

            if (
              activeBranch &&
              !sessionStorage.getItem('apex_active_outlet_id')
            ) {
              setActiveOutletFromBranch(activeBranch);
            }
          }
        }
      }
    } catch (err: any) {
      console.warn(
        '[Auth] Session check response:',
        err?.response?.data || err?.message
      );

      if (err?.response?.status === 401) {
        // Token is definitively invalid/expired.
        if (typeof window !== 'undefined') {
          localStorage.removeItem('apex_auth_token');
          localStorage.removeItem('apex_refresh_token');
          localStorage.removeItem('apex_user_profile');

          clearActiveOutlet();
        }

        setUser(null);
        setToken(null);
        setIsAuthenticated(false);
      } else {
        /**
         * Network / offline error:
         * preserve authenticated session from local cache.
         */
        if (typeof window !== 'undefined') {
          const cachedProfile =
            localStorage.getItem('apex_user_profile');

          if (cachedProfile && activeToken) {
            try {
              const cachedUser = JSON.parse(cachedProfile);

              setUser(cachedUser);
              setIsAuthenticated(true);
              setToken(activeToken);

              /**
               * If cached profile belongs to Admin,
               * don't restore any outlet automatically.
               */
              if (isAdminRole(cachedUser.role)) {
                clearActiveOutlet();
              }
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

  /**
   * Email / Password Login
   */
  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);

      /**
       * Clear any stale outlet from a previous session BEFORE login.
       *
       * This is important because otherwise an old Salt Lake selection
       * could survive until the new profile is loaded.
       */
      if (typeof window !== 'undefined') {
        clearActiveOutlet();
      }

      const res = await apiClient.post('/auth/login', {
        email,
        password,
      });

      const data = res.data;

      if (data && data.access_token) {
        const accessToken = data.access_token;
        const refreshToken = data.refresh_token;

        if (typeof window !== 'undefined') {
          localStorage.setItem(
            'apex_auth_token',
            accessToken
          );

          if (refreshToken) {
            localStorage.setItem(
              'apex_refresh_token',
              refreshToken
            );
          }
        }

        setToken(accessToken);
        setIsAuthenticated(true);

        if (data.user) {
          const loggedInUser = data.user;

          setUser(loggedInUser);

          if (typeof window !== 'undefined') {
            localStorage.setItem(
              'apex_user_profile',
              JSON.stringify(loggedInUser)
            );

            /**
             * ADMIN LOGIN:
             * Start with NO outlet selected.
             */
            if (isAdminRole(loggedInUser.role)) {
              clearActiveOutlet();
            } else {
              /**
               * NORMAL USER:
               * Restore backend-provided active branch.
               */
              const activeBranch =
                loggedInUser.active_branch ||
                loggedInUser.activeBranch;

              if (activeBranch) {
                setActiveOutletFromBranch(activeBranch);
              }
            }
          }
        } else {
          /**
           * If login response doesn't contain user,
           * fetch /auth/me.
           *
           * fetchUserProfile() also contains the Admin protection.
           */
          await fetchUserProfile(accessToken);
        }

        return {
          success: true,
        };
      }

      return {
        success: false,
        error: 'Invalid response from server',
      };
    } catch (err: any) {
      const errorDetail =
        err?.response?.data?.detail ||
        err?.message ||
        'Login failed';

      console.error(
        '[Auth Login Error]:',
        errorDetail
      );

      return {
        success: false,
        error: errorDetail,
      };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Google Login
   */
  const loginWithGoogle = async (
    idToken: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);

      /**
       * Clear any stale outlet before starting a new login.
       */
      if (typeof window !== 'undefined') {
        clearActiveOutlet();
      }

      const res = await apiClient.post('/auth/google', {
        id_token: idToken,
      });

      const data = res.data;

      if (data && data.access_token) {
        const accessToken = data.access_token;

        if (typeof window !== 'undefined') {
          localStorage.setItem(
            'apex_auth_token',
            accessToken
          );

          if (data.refresh_token) {
            localStorage.setItem(
              'apex_refresh_token',
              data.refresh_token
            );
          }
        }

        setToken(accessToken);
        setIsAuthenticated(true);

        if (data.user) {
          const loggedInUser = data.user;

          setUser(loggedInUser);

          if (typeof window !== 'undefined') {
            localStorage.setItem(
              'apex_user_profile',
              JSON.stringify(loggedInUser)
            );

            /**
             * ADMIN GOOGLE LOGIN:
             * Do NOT select backend active_branch.
             */
            if (isAdminRole(loggedInUser.role)) {
              clearActiveOutlet();
            } else {
              /**
               * Normal Google user:
               * use backend active branch if supplied.
               */
              const activeBranch =
                loggedInUser.active_branch ||
                loggedInUser.activeBranch;

              if (activeBranch) {
                setActiveOutletFromBranch(activeBranch);
              }
            }
          }
        } else {
          /**
           * /auth/me has the same Admin protection.
           */
          await fetchUserProfile(accessToken);
        }

        return {
          success: true,
        };
      }

      return {
        success: false,
        error: 'Google login failed',
      };
    } catch (err: any) {
      const errorDetail =
        err?.response?.data?.detail ||
        err?.message ||
        'Google authentication failed';

      return {
        success: false,
        error: errorDetail,
      };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logout
   */
  const logout = async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout').catch(() => {});
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('apex_auth_token');
        localStorage.removeItem('apex_refresh_token');
        localStorage.removeItem('apex_user_profile');

        clearActiveOutlet();
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
    throw new Error(
      'useAuth must be used within an AuthProvider'
    );
  }

  return context;
}

export default AuthProvider;