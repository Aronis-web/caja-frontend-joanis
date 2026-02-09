import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { config } from '@/utils/config';
import secureStorage from '@/utils/secureStorage';
import { authService } from '@/services/AuthService';
import { PermissionCheck, Permission } from '@/types/auth';
import type { User, Role } from '@/types/auth';
import { setSentryUser, clearSentryUser } from '@/config/sentry';

export interface CurrentCompany {
  id: string;
  name: string;
  alias?: string;
  ruc?: string;
  isActive: boolean;
}

export interface CurrentSite {
  id: string;
  code: string;
  name: string;
  companyId: string;
}

interface AuthState extends PermissionCheck {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  tokenExpiresAt: number | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  currentCompany: CurrentCompany | null;
  currentSite: CurrentSite | null;

  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setRefreshToken: (refreshToken: string | null) => void;
  setTokenExpiresAt: (expiresAt: number | null) => void;
  setCurrentCompany: (company: CurrentCompany | null) => void;
  setCurrentSite: (site: CurrentSite | null) => void;
  login: (user: User, accessToken: string) => Promise<void>;
  loginWithCredentials: (email: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
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
  currentCompany: null,
  currentSite: null,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setCurrentCompany: (company) => {
    console.log('🔧 setCurrentCompany called with:', company);
    set({ currentCompany: company });
    console.log('✅ Store updated with currentCompany');
  },

  setCurrentSite: (site) => {
    console.log('🔧 setCurrentSite called with:', site);
    set({ currentSite: site });
    console.log('✅ Store updated with currentSite');
  },

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

  login: async (user, accessToken) => {
    try {
      console.log('🔐 Store login called with user:', user?.id, 'token length:', accessToken?.length);

      if (!user || !user.id) {
        console.error('❌ Store validation failed - user:', user);
        throw new Error('Invalid user data');
      }

      if (!user.permissions) {
        user.permissions = [];
      }

      if (!user.roles) {
        user.roles = [];
      }

      console.log('💾 Storing user in secure storage...');
      await secureStorage.setItem(config.STORAGE_KEYS.AUTH_TOKEN, accessToken);
      await AsyncStorage.setItem(config.STORAGE_KEYS.USER, JSON.stringify(user));

      authService.setAccessToken(accessToken);

      console.log('✅ Setting auth state...');
      set({
        user: user as any,
        token: accessToken,
        isAuthenticated: true,
        error: null,
      });

      setSentryUser({
        id: user.id,
        email: user.email,
        username: user.name,
      });

      console.log('✅ Login completed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      console.error('❌ Login error in store:', errorMessage, error);
      throw error;
    }
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

      console.log('Login successful - User permissions:', response.user.permissions);
      console.log('Login successful - User roles:', response.user.roles);
      console.log('🔐 Remember Me:', rememberMe);

      await secureStorage.setItem(config.STORAGE_KEYS.AUTH_TOKEN, response.accessToken);
      await secureStorage.setItem(config.STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken);
      await secureStorage.setItem(config.STORAGE_KEYS.REMEMBER_ME, rememberMe ? 'true' : 'false');

      let expiresAt: number | null = null;
      if (rememberMe) {
        expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
        console.log('🔐 Extended session enabled: 30 days');
      } else if (response.accessTokenExpiresIn) {
        expiresAt = Date.now() + response.accessTokenExpiresIn * 1000;
      }

      if (expiresAt) {
        await secureStorage.setItem(config.STORAGE_KEYS.TOKEN_EXPIRES_AT, expiresAt.toString());
      }

      await AsyncStorage.setItem(config.STORAGE_KEYS.USER, JSON.stringify(response.user));

      authService.setAccessToken(response.accessToken);
      console.log('🔐 Token synced with AuthService after login');

      set({
        user: response.user as any,
        token: response.accessToken,
        refreshToken: response.refreshToken,
        tokenExpiresAt: expiresAt,
        isAuthenticated: true,
        error: null,
        isLoading: false,
        currentCompany: null,
        currentSite: null,
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
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
    set({ currentCompany: null, currentSite: null });
    await AsyncStorage.removeItem(config.STORAGE_KEYS.CURRENT_COMPANY);
    await AsyncStorage.removeItem(config.STORAGE_KEYS.CURRENT_SITE);

    clearSentryUser();
  },

  updateUser: (userData) => {
    const { user } = get();
    if (user) {
      const updatedUser = { ...user, ...userData };
      set({ user: updatedUser });
      if (updatedUser && typeof updatedUser === 'object') {
        AsyncStorage.setItem(config.STORAGE_KEYS.USER, JSON.stringify(updatedUser));
      }
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
      const companyJson = await AsyncStorage.getItem(config.STORAGE_KEYS.CURRENT_COMPANY);
      const siteJson = await AsyncStorage.getItem(config.STORAGE_KEYS.CURRENT_SITE);

      console.log('📦 Loaded data from storage:', {
        hasToken: !!token,
        hasRefreshToken: !!refreshToken,
        hasUser: !!userJson,
        hasCompany: !!companyJson,
        hasSite: !!siteJson,
      });

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

        if (!user || !user.id || user.id === 'temp-id') {
          console.warn('⚠️ Invalid user data, clearing auth');
          await get().clearInvalidAuth();
          return;
        }

        let currentToken = token;
        let tokenWasRefreshed = false;
        if (tokenExpiresAt && Date.now() >= tokenExpiresAt) {
          console.log('⏰ Token expired, attempting refresh...');
          if (refreshToken) {
            try {
              const refreshed = await get().refreshAccessToken();
              if (!refreshed) {
                console.warn('⚠️ Token refresh failed, clearing auth');
                await get().clearInvalidAuth(true);
                return;
              }
              console.log('✅ Token refreshed successfully');
              tokenWasRefreshed = true;
              const newToken = authService.getAccessToken();
              if (newToken) {
                currentToken = newToken;
              } else {
                console.error('❌ No token available after refresh');
                await get().clearInvalidAuth(true);
                return;
              }
            } catch (error) {
              console.error('❌ Token refresh error:', error);
              await get().clearInvalidAuth(true);
              return;
            }
          } else {
            console.warn('⚠️ No refresh token, clearing auth');
            await get().clearInvalidAuth();
            return;
          }
        }

        let currentCompany = null;
        let currentSite = null;

        try {
          currentCompany = companyJson ? JSON.parse(companyJson) : null;
          currentSite = siteJson ? JSON.parse(siteJson) : null;
        } catch (parseError) {
          console.error('❌ Failed to parse company/site JSON:', parseError);
        }

        if (!tokenWasRefreshed) {
          authService.setAccessToken(currentToken);
          console.log('🔐 Token synced with AuthService after init');
        } else {
          console.log('🔐 Token already synced with AuthService after refresh');
        }

        set({
          user,
          token: currentToken,
          refreshToken,
          tokenExpiresAt,
          isAuthenticated: true,
          currentCompany,
          currentSite,
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
      console.log('🏁 Auth initialization completed');
    }
  },

  refreshAccessToken: async () => {
    try {
      await authService.refreshToken();
      const newToken = authService.getAccessToken();

      if (newToken) {
        set({ token: newToken });
        console.log('✅ Token refreshed and synced with store');
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
            'Tu sesión ha expirado por seguridad. Por favor, inicia sesión nuevamente.',
            [{ text: 'Entendido', style: 'default' }]
          );
        }, 500);
      }

      await secureStorage.deleteItem(config.STORAGE_KEYS.AUTH_TOKEN);
      await secureStorage.deleteItem(config.STORAGE_KEYS.REFRESH_TOKEN);
      await secureStorage.deleteItem(config.STORAGE_KEYS.TOKEN_EXPIRES_AT);
      await AsyncStorage.removeItem(config.STORAGE_KEYS.USER);
      await AsyncStorage.removeItem(config.STORAGE_KEYS.CURRENT_COMPANY);
      await AsyncStorage.removeItem(config.STORAGE_KEYS.CURRENT_SITE);

      set({
        user: null,
        token: null,
        refreshToken: null,
        tokenExpiresAt: null,
        isAuthenticated: false,
        error: null,
        currentCompany: null,
        currentSite: null,
      });

      clearSentryUser();
    } catch (error) {
      console.error('Failed to clear invalid auth:', error);
    }
  },

  isTokenExpired: () => {
    const { tokenExpiresAt } = get();
    if (!tokenExpiresAt) return false;
    return Date.now() >= tokenExpiresAt;
  },

  shouldRefreshToken: () => {
    const { tokenExpiresAt } = get();
    if (!tokenExpiresAt) return false;
    const fiveMinutes = 5 * 60 * 1000;
    return Date.now() >= tokenExpiresAt - fiveMinutes;
  },

  // Permission checking methods
  hasPermission: (permission) => {
    const { user } = get();
    if (!user || !user.permissions) return false;
    return user.permissions.includes(permission);
  },

  hasAnyPermission: (permissions) => {
    const { user } = get();
    if (!user || !user.permissions) return false;
    return permissions.some((permission) => user.permissions!.includes(permission));
  },

  hasAllPermissions: (permissions) => {
    const { user } = get();
    if (!user || !user.permissions) return false;
    return permissions.every((permission) => user.permissions!.includes(permission));
  },

  hasRole: (roleCode) => {
    const { user } = get();
    if (!user || !user.roles) return false;
    return user.roles.some((role) => role.code === roleCode);
  },

  hasAnyRole: (roleCodes) => {
    const { user } = get();
    if (!user || !user.roles) return false;
    return roleCodes.some((roleCode) => user.roles!.some((role) => role.code === roleCode));
  },
}));
