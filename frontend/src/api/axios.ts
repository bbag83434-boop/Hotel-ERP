import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Centralized Backend & API URL configuration
// Supports VITE_API_URL formatted as:
// - "https://hotel-erp-muv8.onrender.com"
// - "https://hotel-erp-muv8.onrender.com/api/v1"
// - "/api/v1" (local development fallback)
// - "" (unset default)
const rawEnvUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');

const resolveUrls = () => {
  if (!rawEnvUrl) {
    return {
      backendBaseUrl: '',
      apiBaseUrl: '/api/v1',
      healthCheckUrl: '/api/health'
    };
  }

  // Relative path configuration (e.g. /api/v1)
  if (rawEnvUrl.startsWith('/')) {
    const baseWithoutPrefix = rawEnvUrl.replace(/\/api(\/v1)?\/?$/, '');
    return {
      backendBaseUrl: baseWithoutPrefix,
      apiBaseUrl: rawEnvUrl.endsWith('/api/v1') ? rawEnvUrl : `${rawEnvUrl.replace(/\/api\/?$/, '')}/api/v1`,
      healthCheckUrl: `${baseWithoutPrefix}/api/health`
    };
  }

  // Absolute domain URL (e.g. https://hotel-erp-muv8.onrender.com)
  const hostBase = rawEnvUrl.replace(/\/api(\/v1)?\/?$/, '');
  return {
    backendBaseUrl: hostBase,
    apiBaseUrl: `${hostBase}/api/v1`,
    healthCheckUrl: `${hostBase}/api/health`
  };
};

const resolved = resolveUrls();
export const BACKEND_BASE_URL = resolved.backendBaseUrl;
export const API_BASE_URL = resolved.apiBaseUrl;
export const HEALTH_CHECK_URL = resolved.healthCheckUrl;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // for httpOnly refresh cookies
  headers: {
    'Content-Type': 'application/json'
  }
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request Interceptor: attach token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: handle token refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      isRefreshing = true;

      try {
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true });

        if (data?.success && data?.data?.accessToken) {
          const newToken = data.data.accessToken;
          localStorage.setItem('accessToken', newToken);
          apiClient.defaults.headers.common.Authorization = `Bearer ${newToken}`;

          processQueue(null, newToken);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return apiClient(originalRequest);
        } else {
          throw new Error('Refresh failed');
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
