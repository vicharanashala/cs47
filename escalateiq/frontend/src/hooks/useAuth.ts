'use client';

import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useNotificationStore } from '@/store/notificationStore';

export function useAuth() {
  const { user, accessToken, setAuth, clearAuth } = useAuthStore();
  const { addToast } = useNotificationStore();
  const router = useRouter();

  const isAuthenticated = !!accessToken && !!user;
  const isAdmin = user?.role === 'admin';

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    setAuth(data.user, data.accessToken, data.refreshToken);
    addToast(`Welcome back, ${data.user.username}!`, 'success');
    router.push('/feed');
  };

  const register = async (username: string, email: string, password: string) => {
    await api.post('/auth/register', { username, email, password });
    addToast('Account created! Please sign in.', 'success');
    router.push('/login');
  };

  const logout = async () => {
    const { refreshToken } = useAuthStore.getState();
    try {
      await api.post('/auth/logout', { refreshToken });
    } catch {}
    clearAuth();
    router.push('/login');
  };

  return { user, isAuthenticated, isAdmin, login, register, logout };
}
