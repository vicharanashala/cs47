/**
 * Axios API client with JWT interceptors.
 * - Attaches Bearer token from Zustand auth store
 * - On 401: attempts token refresh, retries original request once
 * - On second failure: clears auth and redirects to /login
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

// Request interceptor — attach access token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Dynamically read from localStorage to avoid circular imports with Zustand
  try {
    const stored = localStorage.getItem('escalateiq-auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      const token = parsed?.state?.accessToken;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  } catch {}
  return config;
});

// Response interceptor — handle 401 with refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshSubscribers.push((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      isRefreshing = true;
      try {
        const stored = localStorage.getItem('escalateiq-auth');
        const refreshToken = stored ? JSON.parse(stored)?.state?.refreshToken : null;

        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken });
        const newAccessToken = data.accessToken;

        // Update Zustand store in localStorage directly
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.state.accessToken = newAccessToken;
          parsed.state.refreshToken = data.refreshToken;
          localStorage.setItem('escalateiq-auth', JSON.stringify(parsed));
        }

        onTokenRefreshed(newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch {
        // Refresh failed — clear auth
        localStorage.removeItem('escalateiq-auth');
        window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
