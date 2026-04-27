/**
 * Collections Service
 * Servicio para el sistema de recaudación de efectivo
 */

import { config } from '@/utils/config';
import { authService } from './AuthService';
import { useAuthStore } from '@/store/auth';
import type {
  CashStatusResponse,
  CreateCollectionRequestDto,
  CreateClosureCollectionRequestDto,
  CollectionRequestResponse,
  CollectionRequestStatusResponse,
} from '@/types/collections';

class CollectionsService {
  private baseURL: string;

  constructor() {
    this.baseURL = config.API_URL;
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

  /**
   * Obtener estado de la solicitud de recaudación
   * GET /pos/collections/request/:requestId/status
   */
  async getRequestStatus(requestId: string): Promise<CollectionRequestStatusResponse> {
    console.log('🔄 [Collections] Consultando estado de solicitud:', requestId);
    try {
      const response = await this.request<CollectionRequestStatusResponse>(
        `/pos/collections/request/${requestId}/status`
      );
      console.log('📊 [Collections] Estado de solicitud:', {
        status: response.status,
        isExpired: response.isExpired,
        expiresInSeconds: response.expiresInSeconds,
        processedBy: response.processedBy?.name,
      });
      return response;
    } catch (error) {
      console.error('❌ [Collections] Error consultando estado:', error);
      throw error;
    }
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
