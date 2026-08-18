import axios from 'axios';

// Get API base URL from environment or default to relative path
const API_BASE_URL = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) || '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
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

// Response Interceptor for standardized error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.warn(`[API Error] ${error.response.status} ${error.config?.url}:`, error.response.data);
    } else if (error.request) {
      console.warn('[Network Error] No response received from backend API.');
    }
    return Promise.reject(error);
  }
);
