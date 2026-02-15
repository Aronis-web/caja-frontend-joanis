import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '@/utils/config';
import secureStorage from '@/utils/secureStorage';
import { LoginResponse, RefreshTokenResponse, AuthError } from '@/types/auth';

class AuthService {
  private readonly appId = config.APP_ID;
  private readonly baseUrl = config.API_URL;
  private accessToken: string | null = null;
  private refreshTokenValue: string | null = null;
  private tokenExpiresAt: number | null = null;
  private refreshPromise: Promise<RefreshTokenResponse> | null = null;

  constructor() {
    this.restoreAuth();
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Id': this.appId,
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.createAuthError(response.status, errorData.message || 'Login failed');
      }

      const data: LoginResponse = await response.json();

      // Store tokens and user data
      await this.storeAuthData(data);

      return data;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw this.createAuthError(0, 'Network error during login');
    }
  }

  async refreshToken(): Promise<RefreshTokenResponse> {
    if (this.refreshPromise) {
      console.log('🔄 Token refresh already in progress');
      return this.refreshPromise;
    }

    this.refreshPromise = this.performTokenRefresh();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performTokenRefresh(): Promise<RefreshTokenResponse> {
    try {
      console.log('🔄 Starting token refresh...');

      const headers: Record<string, string> = {
        'X-App-Id': this.appId,
      };

      if (this.refreshTokenValue) {
        headers['Content-Type'] = 'application/json';
      }

      const body = this.refreshTokenValue
        ? JSON.stringify({ refreshToken: this.refreshTokenValue })
        : undefined;

      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers,
        body,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Token refresh failed:', response.status);
        throw this.createAuthError(response.status, errorData.message || 'Token refresh failed');
      }

      const data: RefreshTokenResponse = await response.json();
      await this.updateTokens(data);

      console.log('✅ Token refresh successful');
      return data;
    } catch (error) {
      console.error('❌ Token refresh error:', error);
      if (error instanceof AuthError) {
        throw error;
      }
      throw this.createAuthError(0, 'Network error during token refresh');
    }
  }

  async logout(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          'X-App-Id': this.appId,
        },
      });
    } catch (error) {
      console.warn('Logout endpoint call failed:', error);
    } finally {
      await this.clearAuthData();
    }
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  isAuthenticated(): boolean {
    return !!this.accessToken && !this.isTokenExpired();
  }

  isTokenExpired(): boolean {
    if (!this.tokenExpiresAt) {
      return false;
    }
    return Date.now() >= this.tokenExpiresAt;
  }

  private async storeAuthData(data: LoginResponse): Promise<void> {
    this.accessToken = data.accessToken;
    this.refreshTokenValue = data.refreshToken;
    this.tokenExpiresAt = data.accessTokenExpiresIn
      ? Date.now() + data.accessTokenExpiresIn * 1000
      : null;

    try {
      await secureStorage.setItem(config.STORAGE_KEYS.AUTH_TOKEN, data.accessToken);
      await secureStorage.setItem(config.STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
      if (this.tokenExpiresAt) {
        await secureStorage.setItem(
          config.STORAGE_KEYS.TOKEN_EXPIRES_AT,
          this.tokenExpiresAt.toString()
        );
      }
      await AsyncStorage.setItem(config.STORAGE_KEYS.USER, JSON.stringify(data.user));
    } catch (error) {
      console.error('Failed to store auth data:', error);
    }
  }

  private async updateTokens(data: RefreshTokenResponse): Promise<void> {
    this.accessToken = data.accessToken;
    this.refreshTokenValue = data.refreshToken;
    this.tokenExpiresAt = data.accessTokenExpiresIn
      ? Date.now() + data.accessTokenExpiresIn * 1000
      : null;

    try {
      await secureStorage.setItem(config.STORAGE_KEYS.AUTH_TOKEN, data.accessToken);
      if (data.refreshToken) {
        await secureStorage.setItem(config.STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
      }
      if (this.tokenExpiresAt) {
        await secureStorage.setItem(
          config.STORAGE_KEYS.TOKEN_EXPIRES_AT,
          this.tokenExpiresAt.toString()
        );
      }
    } catch (error) {
      console.error('Failed to update tokens:', error);
    }
  }

  private async clearAuthData(): Promise<void> {
    this.accessToken = null;
    this.refreshTokenValue = null;
    this.tokenExpiresAt = null;

    try {
      await secureStorage.deleteItem(config.STORAGE_KEYS.AUTH_TOKEN);
      await secureStorage.deleteItem(config.STORAGE_KEYS.REFRESH_TOKEN);
      await secureStorage.deleteItem(config.STORAGE_KEYS.TOKEN_EXPIRES_AT);
      await AsyncStorage.removeItem(config.STORAGE_KEYS.USER);
    } catch (error) {
      console.error('Failed to clear auth data:', error);
    }
  }

  private async restoreAuth(): Promise<void> {
    try {
      const token = await secureStorage.getItem(config.STORAGE_KEYS.AUTH_TOKEN);
      const refreshToken = await secureStorage.getItem(config.STORAGE_KEYS.REFRESH_TOKEN);
      const tokenExpiresAtStr = await secureStorage.getItem(config.STORAGE_KEYS.TOKEN_EXPIRES_AT);

      if (token) {
        this.accessToken = token;
        this.refreshTokenValue = refreshToken;
        this.tokenExpiresAt = tokenExpiresAtStr ? parseInt(tokenExpiresAtStr, 10) : null;

        if (this.isTokenExpired() && this.refreshTokenValue) {
          try {
            await this.refreshToken();
          } catch (error) {
            console.error('Token refresh failed, clearing auth:', error);
            await this.clearAuthData();
          }
        }
      }
    } catch (error) {
      console.error('Failed to restore auth:', error);
      await this.clearAuthData();
    }
  }

  private createAuthError(status: number, message: string): AuthError {
    let code:
      | 'INVALID_CREDENTIALS'
      | 'TOKEN_EXPIRED'
      | 'TOKEN_INVALID'
      | 'FORBIDDEN'
      | 'NETWORK_ERROR'
      | 'SERVER_ERROR' = 'SERVER_ERROR';

    switch (status) {
      case 400:
        code = 'INVALID_CREDENTIALS';
        break;
      case 401:
        code = message.toLowerCase().includes('expired') ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
        break;
      case 403:
        code = 'FORBIDDEN';
        break;
      case 0:
        code = 'NETWORK_ERROR';
        break;
    }

    return new AuthError(code, message, status);
  }
}

export const authService = new AuthService();
export default authService;
