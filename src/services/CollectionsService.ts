/**
 * Collections Service
 * Servicio para el sistema de recaudación de efectivo
 */

import { io, type Socket } from 'socket.io-client';
import { config } from '@/utils/config';
import { authService } from './AuthService';
import { useAuthStore } from '@/store/auth';
import {
  CollectionRequestStatus,
  type CashStatusResponse,
  type CreateCollectionRequestDto,
  type CreateClosureCollectionRequestDto,
  type CollectionRequestResponse,
  type CollectionRequestStatusResponse,
} from '@/types/collections';

class CollectionsService {
  private baseURL: string;
  private socket: Socket | null = null;

  constructor() {
    this.baseURL = config.API_URL;
  }

  private findNestedByKeys(
    source: unknown,
    keys: string[],
    depth: number = 0
  ): Record<string, unknown> | undefined {
    if (!source || typeof source !== 'object' || depth > 6) return undefined;

    const record = source as Record<string, unknown>;

    for (const key of keys) {
      const candidate = record[key];
      if (candidate && typeof candidate === 'object') {
        return candidate as Record<string, unknown>;
      }
    }

    for (const value of Object.values(record)) {
      const nested = this.findNestedByKeys(value, keys, depth + 1);
      if (nested) return nested;
    }

    return undefined;
  }

  private formatLogPayload(payload: unknown): string {
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return String(payload);
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = authService.getAccessToken();
    const currentCompany = authService.getCurrentCompany();
    const currentSite = authService.getCurrentSite();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-app-id': config.APP_ID,
      ...(options.headers as Record<string, string>),
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
        await useAuthStore.getState().logout();
        throw new Error('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
      }

      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    // Para DELETE que retorna 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  /**
   * Obtener estado del efectivo de la sesión actual
   * GET /pos/collections/session/:sessionId/cash-status
   */
  async getCashStatus(sessionId: string): Promise<CashStatusResponse> {
    console.log('💰 [Collections] Obteniendo estado de efectivo para sesión:', sessionId);
    try {
      const response = await this.request<CashStatusResponse>(
        `/pos/collections/session/${sessionId}/cash-status`
      );
      console.log('✅ [Collections] Estado de efectivo:', {
        currentCash: response.currentCash,
        percentUsed: response.percentUsed,
        alertLevel: response.alertLevel,
        isBlocked: response.isBlocked,
      });
      return response;
    } catch (error) {
      console.error('❌ [Collections] Error obteniendo estado de efectivo:', error);
      throw error;
    }
  }

  /**
   * Crear solicitud de recaudación (genera QR)
   * POST /pos/collections/request/:sessionId
   */
  async createCollectionRequest(
    sessionId: string,
    data: CreateCollectionRequestDto
  ): Promise<CollectionRequestResponse> {
    console.log('📱 [Collections] Creando solicitud de recaudación:', {
      sessionId,
      reason: data.reason,
    });
    try {
      const response = await this.request<CollectionRequestResponse>(
        `/pos/collections/request/${sessionId}`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );
      console.log('✅ [Collections] Solicitud creada:', {
        requestId: response.requestId,
        qrToken: response.qrToken,
        expiresInSeconds: response.expiresInSeconds,
      });
      return response;
    } catch (error) {
      console.error('❌ [Collections] Error creando solicitud:', error);
      throw error;
    }
  }

  /**
   * Solicitar recaudo de cierre (genera QR de cierre)
   * POST /pos/collections/closure/request/:sessionId
   */
  async createClosureCollectionRequest(
    sessionId: string,
    data: CreateClosureCollectionRequestDto = {}
  ): Promise<CollectionRequestResponse> {
    console.log('🔒 [Collections] Creando solicitud de recaudo de cierre:', {
      sessionId,
      expectedAmountCents: data.expectedAmountCents,
    });

    try {
      const response = await this.request<CollectionRequestResponse>(
        `/pos/collections/closure/request/${sessionId}`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );

      console.log('✅ [Collections] Solicitud de cierre creada:', {
        requestId: response.requestId,
        qrToken: response.qrToken,
        expiresInSeconds: response.expiresInSeconds,
        mode: response.mode,
      });

      return response;
    } catch (error) {
      console.error('❌ [Collections] Error creando solicitud de cierre:', error);
      throw error;
    }
  }

  private normalizeRequestStatusPayload(
    payload: unknown,
    expectedRequestId?: string
  ): CollectionRequestStatusResponse | null {
    if (!payload || typeof payload !== 'object') return null;

    const payloadWithData = payload as { data?: unknown };
    const raw =
      payloadWithData.data && typeof payloadWithData.data === 'object'
        ? (payloadWithData.data as Record<string, unknown>)
        : (payload as Record<string, unknown>);

    const id = (raw.id ?? raw.requestId) as string | undefined;
    const status = raw.status as CollectionRequestStatus | undefined;

    if (!id || !status) return null;
    if (expectedRequestId && id !== expectedRequestId) return null;

    if (!Object.values(CollectionRequestStatus).includes(status)) {
      return null;
    }

    const rawClosureContext =
      this.findNestedByKeys(raw, ['closureContext', 'closure_context']) ??
      (raw.closureContext as Record<string, unknown> | undefined) ??
      (raw.closure_context as Record<string, unknown> | undefined);

    const sessionSnapshot =
      (rawClosureContext?.sessionSnapshot as Record<string, unknown> | undefined) ??
      (rawClosureContext?.session_snapshot as Record<string, unknown> | undefined) ??
      this.findNestedByKeys(rawClosureContext, ['sessionSnapshot', 'session_snapshot']);

    return {
      id,
      status,
      token: (raw.token ?? raw.qrToken ?? '') as string,
      expiresAt: (raw.expiresAt ?? new Date().toISOString()) as string,
      isExpired: Boolean(raw.isExpired),
      expiresInSeconds: Number(raw.expiresInSeconds ?? 0),
      processedBy: raw.processedBy as CollectionRequestStatusResponse['processedBy'],
      processedAt: raw.processedAt as string | undefined,
      sessionId: raw.sessionId as string | undefined,
      isClosureRequest: raw.isClosureRequest as boolean | undefined,
      source: raw.source as string | undefined,
      closureContext: rawClosureContext
        ? ({
            ...rawClosureContext,
            ...(sessionSnapshot ? { sessionSnapshot } : {}),
          } as CollectionRequestStatusResponse['closureContext'])
        : undefined,
      completedCollection:
        raw.completedCollection as CollectionRequestStatusResponse['completedCollection'],
    };
  }

  /**
   * Obtener estado de la solicitud de recaudación
   * GET /pos/collections/request/:requestId/status
   */
  async getRequestStatus(requestId: string): Promise<CollectionRequestStatusResponse> {
    console.log('🔄 [Collections] Consultando estado de solicitud:', requestId);
    try {
      const response = await this.request<unknown>(`/pos/collections/request/${requestId}/status`);
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

      console.log(
        `🧾 [Collections] sessionSnapshot (GET /status):\n${this.formatLogPayload(normalizedResponse.closureContext?.sessionSnapshot ?? null)}`
      );
      return normalizedResponse;
    } catch (error) {
      console.error('❌ [Collections] Error consultando estado:', error);
      throw error;
    }
  }

  /**
   * Conectar websocket al namespace de collections
   */
  connectSocket(): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    const token = authService.getAccessToken();
    const currentCompany = authService.getCurrentCompany();
    const currentSite = authService.getCurrentSite();

    const appId = config.APP_ID;
    const companyId = currentCompany?.id;
    const siteId = currentSite?.id;

    const commonHeaders: Record<string, string> = {
      'X-App-Id': appId,
      ...(companyId ? { 'X-Company-Id': companyId } : {}),
      ...(siteId ? { 'X-Site-Id': siteId } : {}),
    };

    this.socket = io(`${this.baseURL}/pos/collections`, {
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

  disconnectSocket(): void {
    if (!this.socket) return;
    this.socket.disconnect();
    this.socket = null;
  }

  subscribeRequestStatus(
    requestId: string,
    onStatus: (payload: CollectionRequestStatusResponse) => void,
    onError?: (errorMessage: string) => void
  ): () => void {
    const socket = this.connectSocket();

    const handleStatus = (payload: unknown) => {
      const normalizedPayload = this.normalizeRequestStatusPayload(payload, requestId);
      if (!normalizedPayload) return;

      console.log('📩 [Collections WS] Estado recibido:', {
        requestId: normalizedPayload.id,
        status: normalizedPayload.status,
      });

      console.log(
        `🧾 [Collections WS] sessionSnapshot (event):\n${this.formatLogPayload(normalizedPayload.closureContext?.sessionSnapshot ?? null)}`
      );

      onStatus(normalizedPayload);
    };

    const handleError = (payload: { message?: string; requestId?: string } | string) => {
      if (typeof payload === 'object' && payload?.requestId && payload.requestId !== requestId)
        return;

      const message =
        typeof payload === 'string'
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
    ] as const;

    const errorEvents = ['collections:error', 'collection:error'] as const;

    statusEvents.forEach((eventName) => socket.on(eventName, handleStatus));
    errorEvents.forEach((eventName) => socket.on(eventName, handleError));

    socket.emit('collections:subscribe', { requestId });
    socket.emit('collection:subscribe', { requestId });

    return () => {
      if (!this.socket) return;

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
  async cancelRequest(requestId: string): Promise<void> {
    console.log('❌ [Collections] Cancelando solicitud:', requestId);
    try {
      await this.request<void>(`/pos/collections/request/${requestId}`, {
        method: 'DELETE',
      });
      console.log('✅ [Collections] Solicitud cancelada');
    } catch (error) {
      console.error('❌ [Collections] Error cancelando solicitud:', error);
      throw error;
    }
  }
}

export const collectionsService = new CollectionsService();
