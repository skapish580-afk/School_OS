import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure based on environment
// For local testing: http://localhost:8000/api/v1
// For physical device: http://{YOUR_IP}:8000/api/v1 (run: ipconfig to find IP)
// For Android emulator: http://10.0.2.2:8000/api/v1
const API_BASE = 'http://localhost:8000/api/v1'; // ← CHANGE THIS if testing on physical device

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token expiry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await AsyncStorage.getItem('refresh_token');
        if (refreshToken) {
          const refreshResponse = await axios.post(
            `${API_BASE}/auth/token/refresh/`,
            { refresh: refreshToken }
          );

          const newAccessToken = refreshResponse.data.access;
          await AsyncStorage.setItem('access_token', newAccessToken);

          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        await AsyncStorage.removeItem('access_token');
        await AsyncStorage.removeItem('refresh_token');
      }
    }

    return Promise.reject(error);
  }
);

export default api;
