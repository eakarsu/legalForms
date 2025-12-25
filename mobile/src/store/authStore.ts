/**
 * Authentication Store using Zustand
 */

import {create} from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {authService} from '../services/api';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  subscription?: 'free' | 'pro' | 'enterprise';
  createdAt: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  loginWithMicrosoft: () => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,

  login: async (email: string, password: string) => {
    set({isLoading: true, error: null});
    try {
      const response = await authService.login(email, password);
      const {user, token} = response.data;

      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));

      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Login failed',
        isLoading: false,
      });
      return false;
    }
  },

  loginWithGoogle: async () => {
    set({isLoading: true, error: null});
    try {
      // OAuth flow will be handled by the WebView
      // This is a placeholder for the OAuth callback
      return true;
    } catch (error: any) {
      set({
        error: error.message || 'Google login failed',
        isLoading: false,
      });
      return false;
    }
  },

  loginWithMicrosoft: async () => {
    set({isLoading: true, error: null});
    try {
      // OAuth flow will be handled by the WebView
      return true;
    } catch (error: any) {
      set({
        error: error.message || 'Microsoft login failed',
        isLoading: false,
      });
      return false;
    }
  },

  register: async (name: string, email: string, password: string) => {
    set({isLoading: true, error: null});
    try {
      const response = await authService.register(name, email, password);
      const {user, token} = response.data;

      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));

      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Registration failed',
        isLoading: false,
      });
      return false;
    }
  },

  logout: async () => {
    set({isLoading: true});
    try {
      await authService.logout();
    } catch (error) {
      // Continue with local logout even if API fails
    }
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  checkAuth: async () => {
    set({isLoading: true});
    try {
      const token = await AsyncStorage.getItem('token');
      const userStr = await AsyncStorage.getItem('user');

      if (token && userStr) {
        const user = JSON.parse(userStr);
        // Verify token with server
        const response = await authService.verifyToken();
        if (response.data.valid) {
          set({
            user: response.data.user || user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        }
      }
    } catch (error) {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
    }
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  updateUser: (userData: Partial<User>) => {
    const currentUser = get().user;
    if (currentUser) {
      const updatedUser = {...currentUser, ...userData};
      set({user: updatedUser});
      AsyncStorage.setItem('user', JSON.stringify(updatedUser));
    }
  },

  clearError: () => set({error: null}),
}));
