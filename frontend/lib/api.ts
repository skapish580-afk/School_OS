import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  // NOTE: Do NOT set a default Content-Type here.
  // When FormData (multipart/form-data) is sent, Axios must auto-generate
  // the correct boundary. A hardcoded 'application/json' would override it
  // and cause Django to reject file uploads with 400 Bad Request.
});

// 1. Request Interceptor: Auto-attach Token
api.interceptors.request.use(
  (config) => {
    // Check if we are in the browser
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 2. Response Interceptor: Handle Token Expiry & Refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        if (typeof window !== 'undefined') {
          const refreshToken = localStorage.getItem('refresh_token');
          
          if (refreshToken) {
            // Try to refresh the token
            const refreshResponse = await axios.post(
              `${API_BASE}/auth/token/refresh/`,
              { refresh: refreshToken }
            );

            const newAccessToken = refreshResponse.data.access;
            localStorage.setItem('access_token', newAccessToken);
            
            // Retry original request with new token
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return api(originalRequest);
          } else {
            // No refresh token, redirect to login
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('user');
            window.location.href = '/login';
            return Promise.reject(new Error('No refresh token available'));
          }
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    // Record failed API request in client-side telemetry buffer
    try {
      if (typeof window !== 'undefined') {
        const { FlightRecorder } = require('@/lib/telemetry/flightRecorder');
        FlightRecorder.recordFailedRequest({
          url: originalRequest?.url || 'unknown',
          method: (originalRequest?.method || 'GET').toUpperCase(),
          status: error.response?.status || 0,
          status_text: error.response?.statusText || (error.message || 'Network Error'),
          response_preview: error.response?.data
        });
      }
    } catch {}

    return Promise.reject(error);
  }
);


export const getMediaUrl = (path: string | null | undefined) => {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  
  // Extract base URL from API_BASE (e.g., http://127.0.0.1:8000/api/v1 -> http://127.0.0.1:8000)
  const baseUrl = API_BASE.replace('/api/v1', '');
  
  // Ensure the path starts with a slash
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
};

export default api;