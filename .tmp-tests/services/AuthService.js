"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = void 0;
const async_storage_1 = __importDefault(require("@react-native-async-storage/async-storage"));
const config_1 = require("@/utils/config");
const secureStorage_1 = __importDefault(require("@/utils/secureStorage"));
const auth_1 = require("@/types/auth");
class AuthService {
    constructor() {
        this.appId = config_1.config.APP_ID;
        this.baseUrl = config_1.config.API_URL;
        this.accessToken = null;
        this.refreshTokenValue = null;
        this.tokenExpiresAt = null;
        this.refreshPromise = null;
        this.currentCompany = null;
        this.currentSite = null;
        this.unauthorizedHandler = null;
    }
    /**
     * Permite al store de auth registrar el manejador que se ejecuta cuando el
     * backend devuelve 401 en una petición autenticada. Evita la dependencia
     * circular AuthService -> useAuthStore.
     */
    setUnauthorizedHandler(handler) {
        this.unauthorizedHandler = handler;
    }
    setCurrentCompany(company) {
        this.currentCompany = company;
    }
    setCurrentSite(site) {
        this.currentSite = site;
    }
    getCurrentCompany() {
        return this.currentCompany;
    }
    getCurrentSite() {
        return this.currentSite;
    }
    async login(email, password) {
        try {
            const headers = {
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
            console.log('🚀 Enviando fetch request...');
            const response = await fetch(`${this.baseUrl}/auth/login`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ email, password }),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            console.log('✅ Respuesta recibida, status:', response.status);
            console.log('📦 Response headers:', Object.fromEntries(response.headers.entries()));
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.message || 'Error al iniciar sesión';
                // Mensajes específicos según el código de estado
                if (response.status === 401 || response.status === 400) {
                    throw this.createAuthError(response.status, 'Credenciales incorrectas');
                }
                throw this.createAuthError(response.status, errorMessage);
            }
            const data = await response.json();
            // Store tokens and user data
            await this.storeAuthData(data);
            return data;
        }
        catch (error) {
            console.error('❌ Error en login:', error);
            console.error('❌ Error type:', error instanceof Error ? error.constructor.name : typeof error);
            console.error('❌ Error message:', error instanceof Error ? error.message : String(error));
            if (error instanceof Error) {
                console.error('❌ Error stack:', error.stack);
            }
            if (error instanceof auth_1.AuthError) {
                throw error;
            }
            if (error instanceof Error && error.name === 'AbortError') {
                throw this.createAuthError(0, 'Timeout: El servidor tardó demasiado en responder');
            }
            throw this.createAuthError(0, 'Network error during login');
        }
    }
    async refreshToken() {
        if (this.refreshPromise) {
            console.log('🔄 Token refresh already in progress');
            return this.refreshPromise;
        }
        this.refreshPromise = this.performTokenRefresh();
        try {
            const result = await this.refreshPromise;
            return result;
        }
        finally {
            this.refreshPromise = null;
        }
    }
    async performTokenRefresh() {
        try {
            console.log('🔄 Starting token refresh...');
            const headers = {
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
            const data = await response.json();
            await this.updateTokens(data);
            console.log('✅ Token refresh successful');
            return data;
        }
        catch (error) {
            console.error('❌ Token refresh error:', error);
            if (error instanceof auth_1.AuthError) {
                throw error;
            }
            throw this.createAuthError(0, 'Network error during token refresh');
        }
    }
    async logout() {
        try {
            const headers = {
                'X-App-Id': this.appId,
            };
            // Add company and site headers if available
            if (this.currentCompany?.id) {
                headers['X-Company-Id'] = this.currentCompany.id;
            }
            if (this.currentSite?.id) {
                headers['X-Site-Id'] = this.currentSite.id;
            }
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            try {
                await fetch(`${this.baseUrl}/auth/logout`, {
                    method: 'POST',
                    headers,
                    signal: controller.signal,
                });
            }
            finally {
                clearTimeout(timeoutId);
            }
        }
        catch (error) {
            console.warn('Logout endpoint call failed:', error);
        }
        finally {
            await this.clearAuthData();
        }
    }
    async makeAuthenticatedRequest(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            'X-App-Id': this.appId,
            ...(options.headers || {}),
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
            // Si es 401, el token expiró - cerrar sesión automáticamente
            if (response.status === 401) {
                console.warn('⚠️ Token expirado (401), cerrando sesión...');
                await this.clearAuthData();
                // Notificar al store para mantenerlo sincronizado (Navigation -> Login,
                // limpieza de POS, etc.). Es opcional: si no hay handler registrado,
                // al menos el servicio ya limpió su estado interno.
                if (this.unauthorizedHandler) {
                    try {
                        await this.unauthorizedHandler();
                    }
                    catch (handlerError) {
                        console.error('Error en unauthorizedHandler:', handlerError);
                    }
                }
                // Lanzar error específico para que la UI pueda manejarlo
                throw this.createAuthError(401, 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
            }
            const errorData = await response.json().catch(() => ({}));
            throw this.createAuthError(response.status, errorData.message || 'Request failed');
        }
        return await response.json();
    }
    getAccessToken() {
        return this.accessToken;
    }
    setAccessToken(token) {
        this.accessToken = token;
    }
    isAuthenticated() {
        return !!this.accessToken && !this.isTokenExpired();
    }
    isTokenExpired() {
        if (!this.tokenExpiresAt) {
            return false;
        }
        return Date.now() >= this.tokenExpiresAt;
    }
    async storeAuthData(data) {
        this.accessToken = data.accessToken;
        this.refreshTokenValue = data.refreshToken;
        this.tokenExpiresAt = data.accessTokenExpiresIn
            ? Date.now() + data.accessTokenExpiresIn * 1000
            : null;
        try {
            await secureStorage_1.default.setItem(config_1.config.STORAGE_KEYS.AUTH_TOKEN, data.accessToken);
            await secureStorage_1.default.setItem(config_1.config.STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
            if (this.tokenExpiresAt) {
                await secureStorage_1.default.setItem(config_1.config.STORAGE_KEYS.TOKEN_EXPIRES_AT, this.tokenExpiresAt.toString());
            }
            await async_storage_1.default.setItem(config_1.config.STORAGE_KEYS.USER, JSON.stringify(data.user));
        }
        catch (error) {
            console.error('Failed to store auth data:', error);
        }
    }
    async updateTokens(data) {
        this.accessToken = data.accessToken;
        this.refreshTokenValue = data.refreshToken;
        this.tokenExpiresAt = data.accessTokenExpiresIn
            ? Date.now() + data.accessTokenExpiresIn * 1000
            : null;
        try {
            await secureStorage_1.default.setItem(config_1.config.STORAGE_KEYS.AUTH_TOKEN, data.accessToken);
            if (data.refreshToken) {
                await secureStorage_1.default.setItem(config_1.config.STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
            }
            if (this.tokenExpiresAt) {
                await secureStorage_1.default.setItem(config_1.config.STORAGE_KEYS.TOKEN_EXPIRES_AT, this.tokenExpiresAt.toString());
            }
        }
        catch (error) {
            console.error('Failed to update tokens:', error);
        }
    }
    async clearAuthData() {
        this.accessToken = null;
        this.refreshTokenValue = null;
        this.tokenExpiresAt = null;
        try {
            await secureStorage_1.default.deleteItem(config_1.config.STORAGE_KEYS.AUTH_TOKEN);
            await secureStorage_1.default.deleteItem(config_1.config.STORAGE_KEYS.REFRESH_TOKEN);
            await secureStorage_1.default.deleteItem(config_1.config.STORAGE_KEYS.TOKEN_EXPIRES_AT);
            await async_storage_1.default.removeItem(config_1.config.STORAGE_KEYS.USER);
        }
        catch (error) {
            console.error('Failed to clear auth data:', error);
        }
    }
    async restoreAuth() {
        try {
            const token = await secureStorage_1.default.getItem(config_1.config.STORAGE_KEYS.AUTH_TOKEN);
            const refreshToken = await secureStorage_1.default.getItem(config_1.config.STORAGE_KEYS.REFRESH_TOKEN);
            const tokenExpiresAtStr = await secureStorage_1.default.getItem(config_1.config.STORAGE_KEYS.TOKEN_EXPIRES_AT);
            if (token) {
                this.accessToken = token;
                this.refreshTokenValue = refreshToken;
                this.tokenExpiresAt = tokenExpiresAtStr ? parseInt(tokenExpiresAtStr, 10) : null;
                if (this.isTokenExpired() && this.refreshTokenValue) {
                    try {
                        await this.refreshToken();
                    }
                    catch (error) {
                        // Si es un error de red (sin internet), conservar la sesión local
                        // para permitir entrar en modo offline. Solo limpiamos si el backend
                        // realmente rechazó el refresh (401/403, token revocado, etc.).
                        const isNetworkError = error instanceof auth_1.AuthError
                            ? error.code === 'NETWORK_ERROR'
                            : !!(error instanceof Error && error.name === 'TypeError');
                        if (isNetworkError) {
                            console.warn('⚠️ Token refresh falló por red, manteniendo sesión local para modo offline');
                        }
                        else {
                            console.error('Token refresh failed, clearing auth:', error);
                            await this.clearAuthData();
                        }
                    }
                }
            }
        }
        catch (error) {
            console.error('Failed to restore auth:', error);
            await this.clearAuthData();
        }
    }
    createAuthError(status, message) {
        let code = 'SERVER_ERROR';
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
        return new auth_1.AuthError(code, message, status);
    }
}
exports.authService = new AuthService();
exports.default = exports.authService;
