import axios from 'axios';

// Get API base URL from environment or default to live backend URL
const getApiBaseUrl = (): string => {
  const envUrl = typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL ? String(process.env.NEXT_PUBLIC_API_URL).trim() : '';
  if (!envUrl) {
    // In production browser, route directly to live backend URL
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return 'https://hotel-erp-muv8.onrender.com/api/v1';
    }
    // In local development, direct to standard FastAPI backend port
    return 'http://127.0.0.1:8000/api/v1';
  }
  const clean = envUrl.replace(/\/+$/, '');
  return clean.endsWith('/api/v1') ? clean : `${clean}/api/v1`;
};

const API_BASE_URL = getApiBaseUrl();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor to attach Active Outlet ID & Auth Token
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const activeOutletId = localStorage.getItem('apex_active_outlet_id');
    if (activeOutletId && config.headers) {
      config.headers['X-Outlet-Id'] = activeOutletId;
    }

    const token = localStorage.getItem('apex_auth_token');
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return config;
});

// Helper utilities for token management
export const getStoredToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('apex_auth_token');
  }
  return null;
};

export const getStoredRefreshToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('apex_refresh_token');
  }
  return null;
};

export const getStoredOutletId = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('apex_active_outlet_id');
  }
  return null;
};

export const clearAuthStorage = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('apex_auth_token');
    localStorage.removeItem('apex_refresh_token');
    localStorage.removeItem('apex_active_outlet_id');
    localStorage.removeItem('apex_active_outlet_code');
  }
};

// Response Interceptor for standardized error handling & auto token refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: any = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      const refreshToken = getStoredRefreshToken();

      if (refreshToken) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then(() => {
              const token = getStoredToken();
              if (token && originalRequest.headers) {
                originalRequest.headers['Authorization'] = `Bearer ${token}`;
              }
              return apiClient(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });

          const newToken = res.data?.data?.access_token || res.data?.access_token;
          const newRefreshToken = res.data?.data?.refresh_token || res.data?.refresh_token;

          if (newToken) {
            localStorage.setItem('apex_auth_token', newToken);
            if (newRefreshToken) {
              localStorage.setItem('apex_refresh_token', newRefreshToken);
            }

            if (originalRequest.headers) {
              originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            }

            processQueue(null);
            return apiClient(originalRequest);
          }
        } catch (refreshErr) {
          processQueue(refreshErr);
          clearAuthStorage();
          return Promise.reject(refreshErr);
        } finally {
          isRefreshing = false;
        }
      } else {
        clearAuthStorage();
      }
    }

    if (error.response) {
      console.warn(`[API Error] ${error.response.status} ${error.config?.url}:`, error.response.data);
    } else if (error.request) {
      console.warn('[Network Error] No response received from backend API.');
    }
    return Promise.reject(error);
  }
);

