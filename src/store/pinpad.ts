/**
 * PinPad Store
 * Estado global para el PinPad usando Zustand
 */

import { create } from 'zustand';
import { pinPadService } from '@/services/PinPadService';
import type {
  PinPadConnectionStatus,
  PinPadTransactionResponse,
  PinPadConfig,
  PinPadCurrencyCode,
} from '@/types/pinpad';

interface PinPadStoreState {
  // Estado de conexión
  status: PinPadConnectionStatus;
  isAvailable: boolean;
  isProcessing: boolean;

  // Errores
  lastError: string | null;
  lastErrorAt: string | null;

  // Token
  isAuthenticated: boolean;
  tokenExpiresAt: string | null;

  // Última transacción
  lastTransaction: PinPadTransactionResponse | null;
  lastTransactionAt: string | null;

  // Configuración
  config: PinPadConfig;

  // Acciones de conexión
  connect: () => Promise<boolean>;
  disconnect: () => void;
  testConnection: () => Promise<boolean>;

  // Acciones de transacción
  processSale: (
    amountCents: number,
    currencyCode?: PinPadCurrencyCode
  ) => Promise<PinPadTransactionResponse>;
  processSaleWithQR: (
    amountCents: number,
    currencyCode?: PinPadCurrencyCode
  ) => Promise<PinPadTransactionResponse>;
  voidSale: (referenceNumber: string) => Promise<PinPadTransactionResponse>;
  reprint: (referenceNumber: string) => Promise<PinPadTransactionResponse>;

  // Acciones de reportes
  getDetailedReport: () => Promise<PinPadTransactionResponse>;
  getTotalsReport: () => Promise<PinPadTransactionResponse>;
  closeBatch: () => Promise<PinPadTransactionResponse>;

  // Configuración
  updateConfig: (config: Partial<PinPadConfig>) => void;

  // Limpiar error
  clearError: () => void;

  // Limpiar última transacción
  clearLastTransaction: () => void;
}

export const usePinPadStore = create<PinPadStoreState>((set, get) => ({
  // Estado inicial
  status: 'DISCONNECTED',
  isAvailable: false,
  isProcessing: false,
  lastError: null,
  lastErrorAt: null,
  isAuthenticated: false,
  tokenExpiresAt: null,
  lastTransaction: null,
  lastTransactionAt: null,
  config: {
    gatewayUrl: 'http://localhost',
    gatewayPort: 9090,
    usuario: 'izipay',
    password: 'izipay',
    timeoutMs: 60000,
    autoReconnect: true,
    reconnectIntervalMs: 30000,
  },

  // ============ CONEXIÓN ============

  connect: async () => {
    set({ status: 'CONNECTING', lastError: null });

    try {
      // Login para obtener token
      await pinPadService.login();

      set({
        status: 'AUTHENTICATED',
        isAuthenticated: true,
        tokenExpiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      });

      console.log('✅ [PINPAD_STORE] Conectado y autenticado');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error de conexión';
      set({
        status: 'ERROR',
        isAuthenticated: false,
        lastError: errorMessage,
        lastErrorAt: new Date().toISOString(),
      });
      console.error('❌ [PINPAD_STORE] Error de conexión:', errorMessage);
      return false;
    }
  },

  disconnect: () => {
    pinPadService.disconnect();
    set({
      status: 'DISCONNECTED',
      isAvailable: false,
      isAuthenticated: false,
      tokenExpiresAt: null,
    });
    console.log('🔌 [PINPAD_STORE] Desconectado');
  },

  testConnection: async () => {
    set({ isProcessing: true, lastError: null });

    try {
      const isAvailable = await pinPadService.testConnection();

      set({
        isAvailable,
        status: isAvailable ? 'CONNECTED' : 'ERROR',
        isProcessing: false,
      });

      if (isAvailable) {
        console.log('✅ [PINPAD_STORE] PinPad disponible');
      } else {
        console.warn('⚠️ [PINPAD_STORE] PinPad no disponible');
      }

      return isAvailable;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al verificar conexión';
      set({
        isAvailable: false,
        status: 'ERROR',
        isProcessing: false,
        lastError: errorMessage,
        lastErrorAt: new Date().toISOString(),
      });
      console.error('❌ [PINPAD_STORE] Error en test:', errorMessage);
      return false;
    }
  },

  // ============ TRANSACCIONES ============

  processSale: async (amountCents, currencyCode = '604') => {
    set({ isProcessing: true, lastError: null, status: 'PROCESSING' });

    try {
      const response = await pinPadService.processSale(amountCents, currencyCode);

      set({
        isProcessing: false,
        status: 'CONNECTED',
        lastTransaction: response,
        lastTransactionAt: new Date().toISOString(),
      });

      if (response.response_code !== '00') {
        set({
          lastError: response.message || 'Transacción rechazada',
          lastErrorAt: new Date().toISOString(),
        });
      }

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error procesando venta';
      set({
        isProcessing: false,
        status: 'ERROR',
        lastError: errorMessage,
        lastErrorAt: new Date().toISOString(),
      });
      throw error;
    }
  },

  processSaleWithQR: async (amountCents, currencyCode = '604') => {
    set({ isProcessing: true, lastError: null, status: 'PROCESSING' });

    try {
      const response = await pinPadService.processSaleWithQR(amountCents, currencyCode);

      set({
        isProcessing: false,
        status: 'CONNECTED',
        lastTransaction: response,
        lastTransactionAt: new Date().toISOString(),
      });

      if (response.response_code !== '00') {
        set({
          lastError: response.message || 'Transacción rechazada',
          lastErrorAt: new Date().toISOString(),
        });
      }

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error procesando venta QR';
      set({
        isProcessing: false,
        status: 'ERROR',
        lastError: errorMessage,
        lastErrorAt: new Date().toISOString(),
      });
      throw error;
    }
  },

  voidSale: async (referenceNumber) => {
    set({ isProcessing: true, lastError: null, status: 'PROCESSING' });

    try {
      const response = await pinPadService.voidSale(referenceNumber);

      set({
        isProcessing: false,
        status: 'CONNECTED',
        lastTransaction: response,
        lastTransactionAt: new Date().toISOString(),
      });

      if (response.response_code !== '00') {
        set({
          lastError: response.message || 'Anulación rechazada',
          lastErrorAt: new Date().toISOString(),
        });
      }

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error anulando venta';
      set({
        isProcessing: false,
        status: 'ERROR',
        lastError: errorMessage,
        lastErrorAt: new Date().toISOString(),
      });
      throw error;
    }
  },

  reprint: async (referenceNumber) => {
    set({ isProcessing: true, lastError: null, status: 'PROCESSING' });

    try {
      const response = await pinPadService.reprint(referenceNumber);

      set({
        isProcessing: false,
        status: 'CONNECTED',
        lastTransaction: response,
        lastTransactionAt: new Date().toISOString(),
      });

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error reimprimiendo';
      set({
        isProcessing: false,
        status: 'ERROR',
        lastError: errorMessage,
        lastErrorAt: new Date().toISOString(),
      });
      throw error;
    }
  },

  // ============ REPORTES ============

  getDetailedReport: async () => {
    set({ isProcessing: true, lastError: null, status: 'PROCESSING' });

    try {
      const response = await pinPadService.getDetailedReport();

      set({
        isProcessing: false,
        status: 'CONNECTED',
        lastTransaction: response,
        lastTransactionAt: new Date().toISOString(),
      });

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error obteniendo reporte';
      set({
        isProcessing: false,
        status: 'ERROR',
        lastError: errorMessage,
        lastErrorAt: new Date().toISOString(),
      });
      throw error;
    }
  },

  getTotalsReport: async () => {
    set({ isProcessing: true, lastError: null, status: 'PROCESSING' });

    try {
      const response = await pinPadService.getTotalsReport();

      set({
        isProcessing: false,
        status: 'CONNECTED',
        lastTransaction: response,
        lastTransactionAt: new Date().toISOString(),
      });

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error obteniendo totales';
      set({
        isProcessing: false,
        status: 'ERROR',
        lastError: errorMessage,
        lastErrorAt: new Date().toISOString(),
      });
      throw error;
    }
  },

  closeBatch: async () => {
    set({ isProcessing: true, lastError: null, status: 'PROCESSING' });

    try {
      const response = await pinPadService.closeBatch();

      set({
        isProcessing: false,
        status: 'CONNECTED',
        lastTransaction: response,
        lastTransactionAt: new Date().toISOString(),
      });

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error cerrando lote';
      set({
        isProcessing: false,
        status: 'ERROR',
        lastError: errorMessage,
        lastErrorAt: new Date().toISOString(),
      });
      throw error;
    }
  },

  // ============ CONFIGURACIÓN ============

  updateConfig: (config) => {
    const newConfig = { ...get().config, ...config };
    set({ config: newConfig });
    pinPadService.updateConfig(newConfig);
    console.log('🔧 [PINPAD_STORE] Configuración actualizada');
  },

  // ============ UTILIDADES ============

  clearError: () => {
    set({ lastError: null, lastErrorAt: null });
  },

  clearLastTransaction: () => {
    set({ lastTransaction: null, lastTransactionAt: null });
  },
}));

// Suscribirse a cambios de estado del servicio
pinPadService.onStatusChange((status) => {
  usePinPadStore.setState({ status });
});
