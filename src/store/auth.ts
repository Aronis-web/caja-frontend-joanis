import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { config } from '@/utils/config';
import secureStorage from '@/utils/secureStorage';
import { authService } from '@/services/AuthService';
import { PermissionCheck, Permission } from '@/types/auth';
import type { User } from '@/types/auth';

interface AuthState extends PermissionCheck {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  tokenExpiresAt: number | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setRefreshToken: (refreshToken: string | null) => void;
  setTokenExpiresAt: (expiresAt: number | null) => void;
  loginWithCredentials: (email: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  logout: () => Promise<void>;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  initAuth: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  clearInvalidAuth: (showSessionExpiredMessage?: boolean) => Promise<void>;
  isTokenExpired: () => boolean;
  shouldRefreshToken: () => boolean;

  // Permission checking methods
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  hasRole: (roleCode: string) => boolean;
  hasAnyRole: (roleCodes: string[]) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  tokenExpiresAt: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setToken: (token) => {
    if (token === undefined) {
      console.warn('Attempted to set undefined token - ignoring');
      return;
    }
    set({ token });
    authService.setAccessToken(token);
  },

  setRefreshToken: (refreshToken) => {
    if (refreshToken === undefined) {
      console.warn('Attempted to set undefined refresh token - ignoring');
      return;
    }
    set({ refreshToken });
  },

  setTokenExpiresAt: (expiresAt) => {
    if (expiresAt === undefined) {
      console.warn('Attempted to set undefined token expires at - ignoring');
      return;
    }
    set({ tokenExpiresAt: expiresAt });
  },

  loginWithCredentials: async (email, password, rememberMe = false) => {
    try {
      set({ isLoading: true, error: null });

      const response = await authService.login(email, password);

      if (!response.user || !response.user.id) {
        throw new Error('Invalid user data received from server');
      }

      if (!response.user.permissions) {
        response.user.permissions = [];
      }

      if (!response.user.roles) {
        response.user.roles = [];
      }

      console.log('✅ Login successful');

      await secureStorage.setItem(config.STORAGE_KEYS.AUTH_TOKEN, response.accessToken);
      await secureStorage.setItem(config.STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken);
      await secureStorage.setItem(config.STORAGE_KEYS.REMEMBER_ME, rememberMe ? 'true' : 'false');

      let expiresAt: number | null = null;
      if (rememberMe) {
        expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
      } else if (response.accessTokenExpiresIn) {
        expiresAt = Date.now() + response.accessTokenExpiresIn * 1000;
      }

      if (expiresAt) {
        await secureStorage.setItem(config.STORAGE_KEYS.TOKEN_EXPIRES_AT, expiresAt.toString());
      }

      await AsyncStorage.setItem(config.STORAGE_KEYS.USER, JSON.stringify(response.user));

      authService.setAccessToken(response.accessToken);

      set({
        user: response.user,
        token: response.accessToken,
        refreshToken: response.refreshToken,
        tokenExpiresAt: expiresAt,
        isAuthenticated: true,
        error: null,
        isLoading: false,
      });

      return true;
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : 'Login failed';
      console.error('Login error:', errorMessage);
      set({ error: errorMessage, isLoading: false });
      return false;
    }
  },

  logout: async () => {
    try {
      await authService.logout();
      await get().clearInvalidAuth();
    } catch (error) {
      await get().clearInvalidAuth();
    }
  },

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  initAuth: async () => {
    try {
      set({ isLoading: true });
      console.log('🔐 Starting auth initialization...');

      const token = await secureStorage.getItem(config.STORAGE_KEYS.AUTH_TOKEN);
      const refreshToken = await secureStorage.getItem(config.STORAGE_KEYS.REFRESH_TOKEN);
      const tokenExpiresAtStr = await secureStorage.getItem(config.STORAGE_KEYS.TOKEN_EXPIRES_AT);
      const userJson = await AsyncStorage.getItem(config.STORAGE_KEYS.USER);

      if (token && userJson) {
        let user;
        try {
          user = JSON.parse(userJson);
        } catch (parseError) {
          console.error('❌ Failed to parse user JSON:', parseError);
          await get().clearInvalidAuth();
          return;
        }

        const tokenExpiresAt = tokenExpiresAtStr ? parseInt(tokenExpiresAtStr, 10) : null;

        if (!user || !user.id) {
          console.warn('⚠️ Invalid user data, clearing auth');
          await get().clearInvalidAuth();
          return;
        }

        let currentToken = token;
        if (tokenExpiresAt && Date.now() >= tokenExpiresAt) {
          console.log('⏰ Token expired, attempting refresh...');
          if (refreshToken) {
            try {
              const refreshed = await get().refreshAccessToken();
              if (!refreshed) {
                await get().clearInvalidAuth(true);
                return;
              }
              const newToken = authService.getAccessToken();
              if (newToken) {
                currentToken = newToken;
              } else {
                await get().clearInvalidAuth(true);
                return;
              }
            } catch (error) {
              console.error('❌ Token refresh error:', error);
              await get().clearInvalidAuth(true);
              return;
            }
          } else {
            await get().clearInvalidAuth();
            return;
          }
        }

        authService.setAccessToken(currentToken);

        set({
          user,
          token: currentToken,
          refreshToken,
          tokenExpiresAt,
          isAuthenticated: true,
        });
        console.log('✅ Auth initialized successfully');
      } else {
        console.log('ℹ️ No stored auth data found');
      }
    } catch (error) {
      console.error('❌ Auth initialization error:', error);
      set({ error: 'Failed to initialize authentication' });
      await get().clearInvalidAuth();
    } finally {
      set({ isLoading: false });
    }
  },

  refreshAccessToken: async () => {
    try {
      await authService.refreshToken();
      const newToken = authService.getAccessToken();

      if (newToken) {
        set({ token: newToken });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  },

  clearInvalidAuth: async (showSessionExpiredMessage = false) => {
    try {
      if (showSessionExpiredMessage) {
        setTimeout(() => {
          Alert.alert(
            'Sesión Expirada',
            'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
            [{ text: 'Entendido', style: 'default' }]
          );
        }, 500);
      }

      await secureStorage.deleteItem(config.STORAGE_KEYS.AUTH_TOKEN);
      await secureStorage.deleteItem(config.STORAGE_KEYS.REFRESH_TOKEN);
      await secureStorage.deleteItem(config.STORAGE_KEYS.TOKEN_EXPIRES_AT);
      await secureStorage.deleteItem(config.STORAGE_KEYS.REMEMBER_ME);
      await AsyncStorage.removeItem(config.STORAGE_KEYS.USER);

      set({
        user: null,
        token: null,
        refreshToken: null,
        tokenExpiresAt: null,
        isAuthenticated: false,
        error: null,
      });

      authService.setAccessToken(null);
    } catch (error) {
      console.error('Error clearing auth:', error);
    }
  },

  isTokenExpired: () => {
    const { tokenExpiresAt } = get();
    if (!tokenExpiresAt) {
      return false;
    }
    return Date.now() >= tokenExpiresAt;
  },

  shouldRefreshToken: () => {
    const { tokenExpiresAt } = get();
    if (!tokenExpiresAt) {
      return false;
    }
    const fiveMinutes = 5 * 60 * 1000;
    return Date.now() >= tokenExpiresAt - fiveMinutes;
  },

  // Permission checking methods
  hasPermission: (permission: Permission) => {
    const { user } = get();
    if (!user || !user.permissions) {
      return false;
    }
    return user.permissions.includes(permission);
  },

  hasAnyPermission: (permissions: Permission[]) => {
    const { user } = get();
    if (!user || !user.permissions) {
      return false;
    }
    return permissions.some((permission) => user.permissions!.includes(permission));
  },

  hasAllPermissions: (permissions: Permission[]) => {
    const { user } = get();
    if (!user || !user.permissions) {
      return false;
    }
    return permissions.every((permission) => user.permissions!.includes(permission));
  },

  hasRole: (roleCode: string) => {
    const { user } = get();
    if (!user || !user.roles) {
      return false;
    }
    return user.roles.some((role) => role.code === roleCode);
  },

  hasAnyRole: (roleCodes: string[]) => {
    const { user } = get();
    if (!user || !user.roles) {
      return false;
    }
    return roleCodes.some((roleCode) => user.roles!.some((role) => role.code === roleCode));
  },
}));
