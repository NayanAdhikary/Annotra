import axios from 'axios';
import { useAuthStore } from '../store/authStore';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
});

// A bare axios instance that bypasses our interceptors — used only for
// the token refresh call to avoid an infinite retry loop.
const _plainAxios = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let _isRefreshing = false;
let _refreshQueue: Array<(token: string | null) => void> = [];

const _processQueue = (token: string | null) => {
  _refreshQueue.forEach((cb) => cb(token));
  _refreshQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Don't intercept non-401, already-retried, or the refresh call itself
    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url?.includes('/api/auth/refresh')
    ) {
      return Promise.reject(error);
    }

    const { refreshToken, setTokens, clear } = useAuthStore.getState();

    if (!refreshToken) {
      clear();
      return Promise.reject(error);
    }

    // If a refresh is already in flight, queue this request
    if (_isRefreshing) {
      return new Promise((resolve, reject) => {
        _refreshQueue.push((token) => {
          if (!token) return reject(error);
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          resolve(api(originalRequest));
        });
      });
    }

    originalRequest._retry = true;
    _isRefreshing = true;

    try {
      // Use plain axios — NOT the intercepted `api` — to prevent re-triggering
      const res = await _plainAxios.post('/api/auth/refresh', {
        refresh_token: refreshToken,
      });
      const { access_token, refresh_token } = res.data;
      setTokens(access_token, refresh_token);
      _processQueue(access_token);
      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
      }
      return api(originalRequest);
    } catch (refreshError) {
      _processQueue(null);
      clear();
      return Promise.reject(refreshError);
    } finally {
      _isRefreshing = false;
    }
  },
);
