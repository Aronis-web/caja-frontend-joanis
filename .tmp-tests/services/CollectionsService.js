"use strict";
/**
 * Collections Service
 * Servicio para el sistema de recaudación de efectivo
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectionsService = void 0;
const socket_io_client_1 = require("socket.io-client");
const config_1 = require("@/utils/config");
const AuthService_1 = require("./AuthService");
const auth_1 = require("@/store/auth");
const collections_1 = require("@/types/collections");
class CollectionsService {
    constructor() {
        this.socket = null;
        this.baseURL = config_1.config.API_URL;
    }
    findNestedByKeys(source, keys, depth = 0) {
        if (!source || typeof source !== 'object' || depth > 6)
            return undefined;
        const record = source;
        for (const key of keys) {
            const candidate = record[key];
            if (candidate && typeof candidate === 'object') {
                return candidate;
            }
        }
        for (const value of Object.values(record)) {
            const nested = this.findNestedByKeys(value, keys, depth + 1);
            if (nested)
                return nested;
        }
        return undefined;
    }
    formatLogPayload(payload) {
        try {
            return JSON.stringify(payload, null, 2);
        }
        catch {
            return String(payload);
        }
    }
    async request(endpoint, options = {}) {
        const token = AuthService_1.authService.getAccessToken();
        const currentCompany = AuthService_1.authService.getCurrentCompany();
        const currentSite = AuthService_1.authService.getCurrentSite();
        const headers = {
            'Content-Type': 'application/json',
            'x-app-id': config_1.config.APP_ID,
            ...options.headers,
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        if (currentCompany) {
            headers['x-company-id'] = currentCompany.id;
        }
        if (currentSite) {
            headers['x-site-id'] = currentSite.id;
        }
        const response = await fetch(`${this.baseURL}${endpoint}`, {
            ...options,
            headers,
        });
        if (!response.ok) {
            // Si es 401, el token expiró - cerrar sesión automáticamente
            if (response.status === 401) {
                console.warn('⚠️ Token expirado (401), cerrando sesión...');
                await auth_1.useAuthStore.getState().logout();
                throw new Error('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
            }
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        // Para DELETE que retorna 204 No Content
        if (response.status === 204) {
            return {};
        }
        return response.json();
    }
    /**
     * Obtener estado del efectivo de la sesión actual
     * GET /pos/collections/session/:sessionId/cash-status
     */
    async getCashStatus(sessionId) {
        console.log('💰 [Collections] Obteniendo estado de efectivo para sesión:', sessionId);
        try {
            const response = await this.request(`/pos/collections/session/${sessionId}/cash-status`);
            console.log('✅ [Collections] Estado de efectivo:', {
                currentCash: response.currentCash,
                percentUsed: response.percentUsed,
                alertLevel: response.alertLevel,
                isBlocked: response.isBlocked,
            });
            return response;
        }
        catch (error) {
            console.error('❌ [Collections] Error obteniendo estado de efectivo:', error);
            throw error;
        }
    }
    /**
     * Crear solicitud de recaudación (genera QR)
     * POST /pos/collections/request/:sessionId
     */
    async createCollectionRequest(sessionId, data) {
        console.log('📱 [Collections] Creando solicitud de recaudación:', {
            sessionId,
            reason: data.reason,
        });
        try {
            const response = await this.request(`/pos/collections/request/${sessionId}`, {
                method: 'POST',
                body: JSON.stringify(data),
            });
            console.log('✅ [Collections] Solicitud creada:', {
                requestId: response.requestId,
                qrToken: response.qrToken,
                expiresInSeconds: response.expiresInSeconds,
            });
            return response;
        }
        catch (error) {
            console.error('❌ [Collections] Error creando solicitud:', error);
            throw error;
        }
    }
    /**
     * Solicitar recaudo de cierre (genera QR de cierre)
     * POST /pos/collections/closure/request/:sessionId
     */
    async createClosureCollectionRequest(sessionId, data = {}) {
        console.log('🔒 [Collections] Creando solicitud de recaudo de cierre:', {
            sessionId,
            expectedAmountCents: data.expectedAmountCents,
        });
        try {
            const response = await this.request(`/pos/collections/closure/request/${sessionId}`, {
                method: 'POST',
                body: JSON.stringify(data),
            });
            console.log('✅ [Collections] Solicitud de cierre creada:', {
                requestId: response.requestId,
                qrToken: response.qrToken,
                expiresInSeconds: response.expiresInSeconds,
                mode: response.mode,
            });
            return response;
        }
        catch (error) {
            console.error('❌ [Collections] Error creando solicitud de cierre:', error);
            throw error;
        }
    }
    normalizeRequestStatusPayload(payload, expectedRequestId) {
        if (!payload || typeof payload !== 'object')
            return null;
        const payloadWithData = payload;
        const raw = payloadWithData.data && typeof payloadWithData.data === 'object'
            ? payloadWithData.data
            : payload;
        const id = (raw.id ?? raw.requestId);
        const status = raw.status;
        if (!id || !status)
            return null;
        if (expectedRequestId && id !== expectedRequestId)
            return null;
        if (!Object.values(collections_1.CollectionRequestStatus).includes(status)) {
            return null;
        }
        const rawClosureContext = this.findNestedByKeys(raw, ['closureContext', 'closure_context']) ??
            raw.closureContext ??
            raw.closure_context;
        const sessionSnapshot = rawClosureContext?.sessionSnapshot ??
            rawClosureContext?.session_snapshot ??
            this.findNestedByKeys(rawClosureContext, ['sessionSnapshot', 'session_snapshot']);
        return {
            id,
            status,
            token: (raw.token ?? raw.qrToken ?? ''),
            expiresAt: (raw.expiresAt ?? new Date().toISOString()),
            isExpired: Boolean(raw.isExpired),
            expiresInSeconds: Number(raw.expiresInSeconds ?? 0),
            processedBy: raw.processedBy,
            processedAt: raw.processedAt,
            sessionId: raw.sessionId,
            isClosureRequest: raw.isClosureRequest,
            source: raw.source,
            closureContext: rawClosureContext
                ? {
                    ...rawClosureContext,
                    ...(sessionSnapshot ? { sessionSnapshot } : {}),
                }
                : undefined,
            completedCollection: raw.completedCollection,
        };
    }
    /**
     * Obtener estado de la solicitud de recaudación
     * GET /pos/collections/request/:requestId/status
     */
    async getRequestStatus(requestId) {
        console.log('🔄 [Collections] Consultando estado de solicitud:', requestId);
        try {
            const response = await this.request(`/pos/collections/request/${requestId}/status`);
            const normalizedResponse = this.normalizeRequestStatusPayload(response, requestId);
            if (!normalizedResponse) {
                throw new Error('Respuesta de estado inválida');
            }
            console.log('📊 [Collections] Estado de solicitud:', {
                status: normalizedResponse.status,
                isExpired: normalizedResponse.isExpired,
                expiresInSeconds: normalizedResponse.expiresInSeconds,
                processedBy: normalizedResponse.processedBy?.name,
                hasSessionSnapshot: Boolean(normalizedResponse.closureContext?.sessionSnapshot),
            });
            console.log(`🧾 [Collections] sessionSnapshot (GET /status):\n${this.formatLogPayload(normalizedResponse.closureContext?.sessionSnapshot ?? null)}`);
            return normalizedResponse;
        }
        catch (error) {
            console.error('❌ [Collections] Error consultando estado:', error);
            throw error;
        }
    }
    /**
     * Conectar websocket al namespace de collections
     */
    connectSocket() {
        if (this.socket?.connected) {
            return this.socket;
        }
        const token = AuthService_1.authService.getAccessToken();
        const currentCompany = AuthService_1.authService.getCurrentCompany();
        const currentSite = AuthService_1.authService.getCurrentSite();
        const appId = config_1.config.APP_ID;
        const companyId = currentCompany?.id;
        const siteId = currentSite?.id;
        const commonHeaders = {
            'X-App-Id': appId,
            ...(companyId ? { 'X-Company-Id': companyId } : {}),
            ...(siteId ? { 'X-Site-Id': siteId } : {}),
        };
        this.socket = (0, socket_io_client_1.io)(`${this.baseURL}/pos/collections`, {
            // No forzar solo websocket: en browser los headers custom pueden no viajar en WS
            transports: ['polling', 'websocket'],
            auth: {
                ...(token ? { token } : {}),
                appId,
                ...(companyId ? { companyId } : {}),
                ...(siteId ? { siteId } : {}),
            },
            query: {
                appId,
                ...(companyId ? { companyId } : {}),
                ...(siteId ? { siteId } : {}),
            },
            extraHeaders: commonHeaders,
            transportOptions: {
                polling: {
                    extraHeaders: commonHeaders,
                },
                websocket: {
                    extraHeaders: commonHeaders,
                },
            },
        });
        this.socket.on('connect', () => {
            console.log('✅ [Collections WS] Conectado:', this.socket?.id);
        });
        this.socket.on('connect_error', (error) => {
            console.error('❌ [Collections WS] Error de conexión:', error.message);
        });
        this.socket.on('disconnect', (reason) => {
            console.warn('⚠️ [Collections WS] Desconectado:', reason);
        });
        return this.socket;
    }
    disconnectSocket() {
        if (!this.socket)
            return;
        this.socket.disconnect();
        this.socket = null;
    }
    subscribeRequestStatus(requestId, onStatus, onError) {
        const socket = this.connectSocket();
        const handleStatus = (payload) => {
            const normalizedPayload = this.normalizeRequestStatusPayload(payload, requestId);
            if (!normalizedPayload)
                return;
            console.log('📩 [Collections WS] Estado recibido:', {
                requestId: normalizedPayload.id,
                status: normalizedPayload.status,
            });
            console.log(`🧾 [Collections WS] sessionSnapshot (event):\n${this.formatLogPayload(normalizedPayload.closureContext?.sessionSnapshot ?? null)}`);
            onStatus(normalizedPayload);
        };
        const handleError = (payload) => {
            if (typeof payload === 'object' && payload?.requestId && payload.requestId !== requestId)
                return;
            const message = typeof payload === 'string'
                ? payload
                : payload?.message || 'Error en websocket de recaudación';
            onError?.(message);
        };
        const statusEvents = [
            'collections:request-status',
            'collections:status',
            'collection:request-status',
            'collection:status',
            'collections:closure-completed',
            'collection:closure-completed',
            'collections:completed',
            'collection:completed',
        ];
        const errorEvents = ['collections:error', 'collection:error'];
        statusEvents.forEach((eventName) => socket.on(eventName, handleStatus));
        errorEvents.forEach((eventName) => socket.on(eventName, handleError));
        socket.emit('collections:subscribe', { requestId });
        socket.emit('collection:subscribe', { requestId });
        return () => {
            if (!this.socket)
                return;
            this.socket.emit('collections:unsubscribe', { requestId });
            this.socket.emit('collection:unsubscribe', { requestId });
            statusEvents.forEach((eventName) => this.socket?.off(eventName, handleStatus));
            errorEvents.forEach((eventName) => this.socket?.off(eventName, handleError));
        };
    }
    /**
     * Cancelar solicitud de recaudación
     * DELETE /pos/collections/request/:requestId
     */
    async cancelRequest(requestId) {
        console.log('❌ [Collections] Cancelando solicitud:', requestId);
        try {
            await this.request(`/pos/collections/request/${requestId}`, {
                method: 'DELETE',
            });
            console.log('✅ [Collections] Solicitud cancelada');
        }
        catch (error) {
            console.error('❌ [Collections] Error cancelando solicitud:', error);
            throw error;
        }
    }
}
exports.collectionsService = new CollectionsService();
