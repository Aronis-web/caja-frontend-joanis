"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAuthStore = void 0;
const zustand_1 = require("zustand");
const async_storage_1 = __importDefault(require("@react-native-async-storage/async-storage"));
const react_native_1 = require("react-native");
const config_1 = require("@/utils/config");
const secureStorage_1 = __importDefault(require("@/utils/secureStorage"));
const AuthService_1 = require("@/services/AuthService");
const DeviceTokenService_1 = require("@/services/DeviceTokenService");
const NetworkMonitor_1 = require("@/services/NetworkMonitor");
const OfflineLoginService_1 = require("@/services/OfflineLoginService");
const pos_1 = require("@/store/pos");
let reauthSubscriptionAttached = false;
function ensureOfflineReauthOnReconnect(handler) {
    if (reauthSubscriptionAttached)
        return;
    reauthSubscriptionAttached = true;
    NetworkMonitor_1.networkMonitor.onReconnect(handler);
}
let unauthorizedHandlerAttached = false;
function ensureUnauthorizedHandlerRegistered() {
    if (unauthorizedHandlerAttached)
        return;
    unauthorizedHandlerAttached = true;
    AuthService_1.authService.setUnauthorizedHandler(async () => {
        // Mantener store y servicio sincronizados cuando el backend devuelve 401
        // en una petición autenticada (token expirado / sesión inválida).
        try {
            await exports.useAuthStore.getState().clearInvalidAuth(true);
        }
        catch (err) {
            console.error('[AUTH] Error en unauthorized handler:', err);
        }
    });
}
function buildUserFromOfflineSession(session) {
    const { user } = session;
    const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email;
    return {
        id: user.id,
        email: user.email,
        name: fullName,
        roles: user.roles.map((code) => ({ id: code, code, name: code })),
        permissions: user.permissions,
    };
}
async function tryRestoreOfflineSession() {
    try {
        const session = await OfflineLoginService_1.offlineLoginService.restoreSession();
        if (!session)
            return null;
        const companyJson = await async_storage_1.default.getItem(config_1.config.STORAGE_KEYS.CURRENT_COMPANY);
        const siteJson = await async_storage_1.default.getItem(config_1.config.STORAGE_KEYS.CURRENT_SITE);
        let currentCompany = null;
        let currentSite = null;
        try {
            currentCompany = companyJson ? JSON.parse(companyJson) : null;
            currentSite = siteJson ? JSON.parse(siteJson) : null;
        }
        catch (parseError) {
            console.warn('⚠️ [OFFLINE_INIT] No se pudo restaurar empresa/sede:', parseError);
        }
        AuthService_1.authService.setCurrentCompany(currentCompany);
        AuthService_1.authService.setCurrentSite(currentSite);
        return {
            user: buildUserFromOfflineSession(session),
            token: null,
            refreshToken: null,
            tokenExpiresAt: session.payload.exp * 1000,
            isAuthenticated: true,
            isOfflineSession: true,
            currentCompany,
            currentSite,
            isLoading: false,
        };
    }
    catch (error) {
        console.warn('⚠️ [OFFLINE_INIT] No se pudo restaurar sesión offline:', error);
        return null;
    }
}
function offlineLoginErrorMessage(reason, lockedUntil) {
    switch (reason) {
        case 'BAD_PASSWORD':
            return 'Contraseña incorrecta';
        case 'BAD_PIN':
            return 'PIN incorrecto';
        case 'USER_NOT_FOUND':
            return 'Usuario no encontrado en la caja';
        case 'USER_INACTIVE':
            return 'Usuario inactivo';
        case 'PIN_LOCKED':
            return lockedUntil
                ? `PIN bloqueado hasta ${new Date(lockedUntil).toLocaleString()}`
                : 'PIN bloqueado';
        case 'BUNDLE_EXPIRED':
            return 'El paquete de usuarios offline expiró. Reconectá para actualizarlo.';
        case 'TOO_MANY_ATTEMPTS':
            return lockedUntil
                ? `Demasiados intentos. Bloqueado hasta ${new Date(lockedUntil).toLocaleString()}`
                : 'Demasiados intentos fallidos';
        default:
            return 'No se pudo iniciar sesión offline';
    }
}
exports.useAuthStore = (0, zustand_1.create)((set, get) => ({
    user: null,
    token: null,
    refreshToken: null,
    tokenExpiresAt: null,
    isAuthenticated: false,
    isOfflineSession: false,
    isLoading: true,
    error: null,
    currentCompany: null,
    currentSite: null,
    setUser: (user) => set({ user, isAuthenticated: !!user }),
    setCurrentCompany: async (company) => {
        const previousCompanyId = get().currentCompany?.id;
        const nextCompanyId = company?.id;
        // Si cambia de empresa (o se limpia), resetear contexto POS para evitar arrastre de sesión/caja
        if (previousCompanyId && previousCompanyId !== nextCompanyId) {
            pos_1.usePOSStore.getState().reset();
            await async_storage_1.default.removeItem(config_1.config.STORAGE_KEYS.CURRENT_SITE);
            set({ currentSite: null });
            AuthService_1.authService.setCurrentSite(null);
        }
        set({ currentCompany: company });
        if (company) {
            await async_storage_1.default.setItem(config_1.config.STORAGE_KEYS.CURRENT_COMPANY, JSON.stringify(company));
        }
        else {
            await async_storage_1.default.removeItem(config_1.config.STORAGE_KEYS.CURRENT_COMPANY);
        }
        AuthService_1.authService.setCurrentCompany(company);
    },
    setCurrentSite: async (site) => {
        const previousSiteId = get().currentSite?.id;
        const nextSiteId = site?.id;
        // Si cambia de sede (o se limpia), resetear contexto POS para evitar usar caja/sesión de otra sede
        if (previousSiteId && previousSiteId !== nextSiteId) {
            pos_1.usePOSStore.getState().reset();
        }
        set({ currentSite: site });
        if (site) {
            await async_storage_1.default.setItem(config_1.config.STORAGE_KEYS.CURRENT_SITE, JSON.stringify(site));
        }
        else {
            await async_storage_1.default.removeItem(config_1.config.STORAGE_KEYS.CURRENT_SITE);
        }
        AuthService_1.authService.setCurrentSite(site);
    },
    setToken: (token) => {
        if (token === undefined) {
            console.warn('Attempted to set undefined token - ignoring');
            return;
        }
        set({ token });
        AuthService_1.authService.setAccessToken(token);
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
            console.log('📡 Llamando a authService.login...');
            const response = await AuthService_1.authService.login(email, password);
            console.log('📡 Respuesta recibida del servidor');
            if (!response.user || !response.user.id) {
                const errorMsg = 'Datos de usuario inválidos recibidos del servidor';
                set({ error: errorMsg, isLoading: false });
                throw new Error(errorMsg);
            }
            if (!response.user.permissions) {
                response.user.permissions = [];
            }
            if (!response.user.roles) {
                response.user.roles = [];
            }
            console.log('✅ Login successful');
            // Limpiar contexto previo para evitar arrastrar empresa/sede/caja/sesión de otro usuario
            await async_storage_1.default.removeItem(config_1.config.STORAGE_KEYS.CURRENT_COMPANY);
            await async_storage_1.default.removeItem(config_1.config.STORAGE_KEYS.CURRENT_SITE);
            pos_1.usePOSStore.getState().reset();
            await secureStorage_1.default.setItem(config_1.config.STORAGE_KEYS.AUTH_TOKEN, response.accessToken);
            await secureStorage_1.default.setItem(config_1.config.STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken);
            await secureStorage_1.default.setItem(config_1.config.STORAGE_KEYS.REMEMBER_ME, rememberMe ? 'true' : 'false');
            if (rememberMe) {
                await async_storage_1.default.setItem(config_1.config.STORAGE_KEYS.LAST_EMAIL, email);
            }
            else {
                await async_storage_1.default.removeItem(config_1.config.STORAGE_KEYS.LAST_EMAIL);
            }
            let expiresAt = null;
            if (rememberMe) {
                expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
            }
            else if (response.accessTokenExpiresIn) {
                expiresAt = Date.now() + response.accessTokenExpiresIn * 1000;
            }
            if (expiresAt) {
                await secureStorage_1.default.setItem(config_1.config.STORAGE_KEYS.TOKEN_EXPIRES_AT, expiresAt.toString());
            }
            await async_storage_1.default.setItem(config_1.config.STORAGE_KEYS.USER, JSON.stringify(response.user));
            AuthService_1.authService.setAccessToken(response.accessToken);
            // En login nuevo siempre forzar selección de empresa/sede
            const savedCompany = null;
            const savedSite = null;
            // Cerrar cualquier sesión offline previa al iniciar una sesión online nueva
            await OfflineLoginService_1.offlineLoginService.logout().catch(() => undefined);
            set({
                user: response.user,
                token: response.accessToken,
                refreshToken: response.refreshToken,
                tokenExpiresAt: expiresAt,
                isAuthenticated: true,
                isOfflineSession: false,
                error: null,
                isLoading: false,
                currentCompany: savedCompany,
                currentSite: savedSite,
            });
            return true;
        }
        catch (_error) {
            const isNetworkError = _error instanceof Error &&
                (_error.message.includes('Network error') ||
                    _error.message.includes('Network request failed') ||
                    _error.message.includes('Timeout'));
            // Si el servidor no respondió, intentar el fallback offline cuando la caja está provisionada.
            if (isNetworkError) {
                const provisioned = await DeviceTokenService_1.deviceTokenService.isProvisioned().catch(() => false);
                if (provisioned) {
                    console.log('🌐➡️📴 [AUTH] Online falló por red, intentando login offline...');
                    const offlineResult = await get().loginOffline({ email, password });
                    if (offlineResult.ok) {
                        return true;
                    }
                    // loginOffline ya seteó error e isLoading: false con un mensaje específico.
                    return false;
                }
            }
            let errorMessage = 'Error al iniciar sesión';
            // Manejar diferentes tipos de errores
            if (_error instanceof Error) {
                if (_error.message.includes('Network error')) {
                    errorMessage = 'No se pudo conectar al servidor. Verifica tu conexión.';
                }
                else if (_error.message.includes('Timeout')) {
                    errorMessage = 'El servidor tardó demasiado en responder. Intenta nuevamente.';
                }
                else if (_error.message.includes('Credenciales incorrectas') ||
                    _error.message.includes('Invalid credentials')) {
                    errorMessage = 'Correo o contraseña incorrectos';
                }
                else if (_error.message.includes('Datos de usuario inválidos')) {
                    errorMessage = _error.message;
                }
                else {
                    errorMessage = _error.message;
                }
            }
            console.error('❌ Login error:', errorMessage);
            set({ error: errorMessage, isLoading: false });
            return false;
        }
    },
    loginOffline: async ({ email, password, pin }) => {
        set({ isLoading: true, error: null });
        try {
            // Fuentes de la caja, en orden de prioridad:
            // 1. Pareja persistida en el device (sobrevive logout).
            // 2. Selección actual del flujo online (puede haber sido borrada por pos.reset()).
            // 3. Claims del deviceToken (best effort si el token es un JWT con esos campos).
            let cashRegisterId;
            let cashRegisterCode;
            const provisioned = await DeviceTokenService_1.deviceTokenService.getProvisionedCashRegister().catch(() => null);
            if (provisioned?.id && provisioned?.code) {
                cashRegisterId = provisioned.id;
                cashRegisterCode = provisioned.code;
            }
            if (!cashRegisterId || !cashRegisterCode) {
                const selectedRegisterRaw = await async_storage_1.default.getItem('@caja:selected_cash_register');
                if (selectedRegisterRaw) {
                    try {
                        const parsed = JSON.parse(selectedRegisterRaw);
                        cashRegisterId = parsed.id ?? cashRegisterId;
                        cashRegisterCode = parsed.code ?? cashRegisterCode;
                    }
                    catch {
                        // Ignorar y caer al fallback con claims del deviceToken.
                    }
                }
            }
            if (!cashRegisterId || !cashRegisterCode) {
                const claims = await DeviceTokenService_1.deviceTokenService.getClaims().catch(() => null);
                if (claims?.cashRegisterId && claims?.cashRegisterCode) {
                    cashRegisterId = claims.cashRegisterId;
                    cashRegisterCode = claims.cashRegisterCode;
                }
            }
            if (!cashRegisterId || !cashRegisterCode) {
                set({
                    error: 'La caja no está provisionada. Pegá el device token en Configuración → Offline.',
                    isLoading: false,
                });
                return { ok: false, reason: 'NO_CASH_REGISTER' };
            }
            const result = await OfflineLoginService_1.offlineLoginService.verifyCredentials({
                cashRegisterId,
                cashRegisterCode,
                email,
                password,
                pin,
            });
            if (!result.ok) {
                const message = offlineLoginErrorMessage(result.reason, result.lockedUntil);
                set({ error: message, isLoading: false });
                return { ok: false, reason: result.reason, lockedUntil: result.lockedUntil };
            }
            // Restaurar empresa/sede previas desde storage para que la navegación avance
            const companyJson = await async_storage_1.default.getItem(config_1.config.STORAGE_KEYS.CURRENT_COMPANY);
            const siteJson = await async_storage_1.default.getItem(config_1.config.STORAGE_KEYS.CURRENT_SITE);
            let currentCompany = null;
            let currentSite = null;
            try {
                currentCompany = companyJson ? JSON.parse(companyJson) : null;
                currentSite = siteJson ? JSON.parse(siteJson) : null;
            }
            catch (parseError) {
                console.warn('⚠️ [OFFLINE_LOGIN] No se pudo restaurar empresa/sede:', parseError);
            }
            const offlineUser = buildUserFromOfflineSession(result.session);
            AuthService_1.authService.setCurrentCompany(currentCompany);
            AuthService_1.authService.setCurrentSite(currentSite);
            set({
                user: offlineUser,
                token: null,
                refreshToken: null,
                tokenExpiresAt: result.session.payload.exp * 1000,
                isAuthenticated: true,
                isOfflineSession: true,
                error: null,
                isLoading: false,
                currentCompany,
                currentSite,
            });
            return { ok: true };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Error en login offline';
            console.error('❌ [OFFLINE_LOGIN]', error);
            set({ error: message, isLoading: false });
            return { ok: false, reason: 'USER_NOT_FOUND' };
        }
    },
    logout: async () => {
        console.log('🔓 [AUTH STORE] logout() llamado');
        const wasOffline = get().isOfflineSession;
        // Siempre limpiar estado local primero para evitar bloqueos por red/API
        await get().clearInvalidAuth();
        // Cerrar sesión offline (siempre, por si quedó algo en storage)
        await OfflineLoginService_1.offlineLoginService.logout().catch(() => undefined);
        // Si la sesión era offline no hay nada que notificar al backend
        if (!wasOffline) {
            AuthService_1.authService.logout().catch((error) => {
                console.log('🔓 [AUTH STORE] Logout remoto falló (no bloqueante):', error);
            });
        }
        // Refuerzo de estado local
        set({ currentCompany: null, currentSite: null });
        await async_storage_1.default.removeItem(config_1.config.STORAGE_KEYS.CURRENT_COMPANY);
        await async_storage_1.default.removeItem(config_1.config.STORAGE_KEYS.CURRENT_SITE);
        console.log('🔓 [AUTH STORE] logout() completado - isAuthenticated debería ser false');
    },
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    clearError: () => set({ error: null }),
    initAuth: async () => {
        try {
            set({ isLoading: true });
            console.log('🔐 Starting auth initialization...');
            // Registrar handler de 401 para mantener store y servicio sincronizados.
            ensureUnauthorizedHandlerRegistered();
            // Suscribirse (una sola vez) a reconexiones: si la sesión activa es offline,
            // forzar logout para que el cajero reabra sesión online y elija caja/turno limpio.
            ensureOfflineReauthOnReconnect(() => {
                const state = get();
                if (state.isOfflineSession) {
                    console.log('🌐➡️🔁 [AUTH] Red recuperada con sesión offline activa, forzando relogin...');
                    void get().logout();
                }
            });
            const token = await secureStorage_1.default.getItem(config_1.config.STORAGE_KEYS.AUTH_TOKEN);
            const refreshToken = await secureStorage_1.default.getItem(config_1.config.STORAGE_KEYS.REFRESH_TOKEN);
            const tokenExpiresAtStr = await secureStorage_1.default.getItem(config_1.config.STORAGE_KEYS.TOKEN_EXPIRES_AT);
            const rememberMeStr = await secureStorage_1.default.getItem(config_1.config.STORAGE_KEYS.REMEMBER_ME);
            const userJson = await async_storage_1.default.getItem(config_1.config.STORAGE_KEYS.USER);
            const companyJson = await async_storage_1.default.getItem(config_1.config.STORAGE_KEYS.CURRENT_COMPANY);
            const siteJson = await async_storage_1.default.getItem(config_1.config.STORAGE_KEYS.CURRENT_SITE);
            // Antes de descartar nada, intentar restaurar sesión offline si la hay vigente.
            const offlineRestored = await tryRestoreOfflineSession();
            if (offlineRestored) {
                set(offlineRestored);
                console.log('✅ Auth inicializada desde sesión offline');
                return;
            }
            // Si el usuario no marcó "Mantener sesión iniciada", conservamos la sesión
            // mientras el access token siga vigente (sobrevive a hot-reloads / reapertura
            // dentro de la ventana del TTL). Sólo se descarta cuando expira y no hay
            // refresh token o el refresh falla (manejado más abajo).
            const tokenExpiresAtParsed = tokenExpiresAtStr ? parseInt(tokenExpiresAtStr, 10) : null;
            const rememberMeEnabled = rememberMeStr === 'true';
            const tokenAlreadyExpired = !!tokenExpiresAtParsed && Date.now() >= tokenExpiresAtParsed;
            if (token && !rememberMeEnabled && tokenAlreadyExpired) {
                console.log('🔒 REMEMBER_ME=false y token expirado → limpiando sesión almacenada');
                await get().clearInvalidAuth();
                return;
            }
            if (token && userJson) {
                let user;
                try {
                    user = JSON.parse(userJson);
                }
                catch (parseError) {
                    console.error('❌ Failed to parse user JSON:', parseError);
                    await get().clearInvalidAuth();
                    return;
                }
                const tokenExpiresAt = tokenExpiresAtParsed;
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
                            const newToken = AuthService_1.authService.getAccessToken();
                            if (newToken) {
                                currentToken = newToken;
                            }
                            else {
                                await get().clearInvalidAuth(true);
                                return;
                            }
                        }
                        catch (error) {
                            console.error('❌ Token refresh error:', error);
                            await get().clearInvalidAuth(true);
                            return;
                        }
                    }
                    else {
                        await get().clearInvalidAuth();
                        return;
                    }
                }
                // Load company and site if available
                let currentCompany = null;
                let currentSite = null;
                try {
                    currentCompany = companyJson ? JSON.parse(companyJson) : null;
                    currentSite = siteJson ? JSON.parse(siteJson) : null;
                }
                catch (parseError) {
                    console.error('❌ Failed to parse company/site JSON:', parseError);
                }
                AuthService_1.authService.setAccessToken(currentToken);
                AuthService_1.authService.setCurrentCompany(currentCompany);
                AuthService_1.authService.setCurrentSite(currentSite);
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
            }
            else {
                console.log('ℹ️ No stored auth data found');
            }
        }
        catch (error) {
            console.error('❌ Auth initialization error:', error);
            set({ error: 'Failed to initialize authentication' });
            await get().clearInvalidAuth();
        }
        finally {
            set({ isLoading: false });
        }
    },
    refreshAccessToken: async () => {
        try {
            await AuthService_1.authService.refreshToken();
            const newToken = AuthService_1.authService.getAccessToken();
            if (newToken) {
                set({ token: newToken });
                return true;
            }
            return false;
        }
        catch (error) {
            console.error('Token refresh error:', error);
            return false;
        }
    },
    clearInvalidAuth: async (showSessionExpiredMessage = false) => {
        try {
            if (showSessionExpiredMessage) {
                setTimeout(() => {
                    react_native_1.Alert.alert('Sesión Expirada', 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.', [{ text: 'Entendido', style: 'default' }]);
                }, 500);
            }
            // Limpiar primero el estado POS para evitar rehidratación de sesión/caja antigua
            pos_1.usePOSStore.getState().reset();
            await secureStorage_1.default.deleteItem(config_1.config.STORAGE_KEYS.AUTH_TOKEN);
            await secureStorage_1.default.deleteItem(config_1.config.STORAGE_KEYS.REFRESH_TOKEN);
            await secureStorage_1.default.deleteItem(config_1.config.STORAGE_KEYS.TOKEN_EXPIRES_AT);
            await secureStorage_1.default.deleteItem(config_1.config.STORAGE_KEYS.REMEMBER_ME);
            await async_storage_1.default.removeItem(config_1.config.STORAGE_KEYS.USER);
            await async_storage_1.default.removeItem(config_1.config.STORAGE_KEYS.CURRENT_COMPANY);
            await async_storage_1.default.removeItem(config_1.config.STORAGE_KEYS.CURRENT_SITE);
            set({
                user: null,
                token: null,
                refreshToken: null,
                tokenExpiresAt: null,
                isAuthenticated: false,
                isOfflineSession: false,
                error: null,
                currentCompany: null,
                currentSite: null,
            });
            AuthService_1.authService.setAccessToken(null);
            AuthService_1.authService.setCurrentCompany(null);
            AuthService_1.authService.setCurrentSite(null);
        }
        catch (error) {
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
    hasPermission: (permission) => {
        const { user } = get();
        if (!user || !user.permissions) {
            return false;
        }
        return user.permissions.includes(permission);
    },
    hasAnyPermission: (permissions) => {
        const { user } = get();
        if (!user || !user.permissions) {
            return false;
        }
        return permissions.some((permission) => user.permissions.includes(permission));
    },
    hasAllPermissions: (permissions) => {
        const { user } = get();
        if (!user || !user.permissions) {
            return false;
        }
        return permissions.every((permission) => user.permissions.includes(permission));
    },
    hasRole: (roleCode) => {
        const { user } = get();
        if (!user || !user.roles) {
            return false;
        }
        return user.roles.some((role) => role.code === roleCode);
    },
    hasAnyRole: (roleCodes) => {
        const { user } = get();
        if (!user || !user.roles) {
            return false;
        }
        return roleCodes.some((roleCode) => user.roles.some((role) => role.code === roleCode));
    },
}));
