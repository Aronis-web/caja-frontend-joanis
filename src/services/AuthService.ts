import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '@/utils/config';
import secureStorage from '@/utils/secureStorage';
import { LoginResponse, RefreshTokenResponse, AuthError, Company, Site } from '@/types/auth';

class AuthService {
  private readonly appId = config.APP_ID;
  private readonly baseUrl = config.API_URL;
  private accessToken: string | null = null;
  private refreshTokenValue: string | null = null;
  private tokenExpiresAt: number | null = null;
  private refreshPromise: Promise<RefreshTokenResponse> | null = null;
  private currentCompany: Company | null = null;
  private currentSite: Site | null = null;

  constructor() {
    this.restoreAuth();
  }

  setCurrentCompany(company: Company | null): void {
    this.currentCompany = company;
  }

  setCurrentSite(site: Site | null): void {
    this.currentSite = site;
  }

  getCurrentCompany(): Company | null {
    return this.currentCompany;
  }

  getCurrentSite(): Site | null {
    return this.currentSite;
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-App-Id': this.appId,
      };

      // Add company and site headers if available
      if (this.currentCompany?.id) {
        headers['X-Company-Id'] = this.currentCompany.id;
      }
      if (this.currentSite?.id) {
        headers['X-Site-Id'] = this.currentSite.id;
      }

      console.log('🌐 Enviando petición de login a:', `${this.baseUrl}/auth/login`);
      console.log('📋 Headers:', headers);
      console.log('📧 Email:', email);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos timeout

      const response = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log('✅ Respuesta recibida, status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.createAuthError(response.status, errorData.message || 'Login failed');
      }

      const data: LoginResponse = await response.json();

      // Store tokens and user data
      await this.storeAuthData(data);

      return data;
    } catch (error) {
      console.error('❌ Error en login:', error);
      if (error instanceof AuthError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw this.createAuthError(0, 'Timeout: El servidor tardó demasiado en responder');
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

      // Add company and site headers if available
      if (this.currentCompany?.id) {
        headers['X-Company-Id'] = this.currentCompany.id;
      }
      if (this.currentSite?.id) {
        headers['X-Site-Id'] = this.currentSite.id;
      }

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
      const headers: Record<string, string> = {
        'X-App-Id': this.appId,
      };

      // Add company and site headers if available
      if (this.currentCompany?.id) {
        headers['X-Company-Id'] = this.currentCompany.id;
      }
      if (this.currentSite?.id) {
        headers['X-Site-Id'] = this.currentSite.id;
      }

      await fetch(`${this.baseUrl}/auth/logout`, {
        method: 'POST',
        headers,
      });
    } catch (error) {
      console.warn('Logout endpoint call failed:', error);
    } finally {
      await this.clearAuthData();
    }
  }

  async makeAuthenticatedRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-App-Id': this.appId,
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    // Add company and site headers if available
    if (this.currentCompany?.id) {
      headers['X-Company-Id'] = this.currentCompany.id;
    }
    if (this.currentSite?.id) {
      headers['X-Site-Id'] = this.currentSite.id;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw this.createAuthError(response.status, errorData.message || 'Request failed');
    }

    return await response.json();
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
