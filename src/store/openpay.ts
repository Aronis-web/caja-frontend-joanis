/**
 * OpenPay PinPad store
 *
 * Espejo del `usePinPadStore` (Izipay) pero para el PinPad OpenPay.
 * Ambos stores conviven: el store correcto se elige en la UI a partir de
 * `derivePinPadProvider(paymentMethod.code)` — códigos con `OPENPAY_*`
 * usan éste; los demás (`IZIPAY_*`) usan el legacy.
 */

import { create } from 'zustand';
import {
  openPayService,
  OpenPayBridgeUnavailableError,
  OpenPayTimeoutError,
} from '@/services/OpenPayPinPadService';
import {
  DEFAULT_OPENPAY_BRIDGE_CONFIG,
  type OpenPayBridgeConfig,
  type OpenPayConnectionStatus,
  type OpenPayResponse,
} from '@/types/openpay';

interface OpenPayStoreState {
  status: OpenPayConnectionStatus;
  isAvailable: boolean;
  isProcessing: boolean;
  initialized: boolean;

  lastError: string | null;
  lastErrorAt: string | null;

  lastTransaction: OpenPayResponse | null;
  lastTransactionAt: string | null;

  config: OpenPayBridgeConfig;

  // Conexión
  connect: () => Promise<boolean>;
  disconnect: () => void;
  probeAvailability: () => Promise<boolean>;

  // Transacciones
  processSale: (amountCents: number) => Promise<OpenPayResponse>;
  processSaleQR: (amountCents: number) => Promise<OpenPayResponse>;
  cancelSaleQR: () => Promise<{ ok: boolean; cancelled: boolean }>;
  voidSale: (amountCents: number, financialReference: string) => Promise<OpenPayResponse>;
  closeTurn: () => Promise<OpenPayResponse>;

  updateConfig: (config: Partial<OpenPayBridgeConfig>) => void;
  clearError: () => void;
  clearLastTransaction: () => void;
}

export const useOpenPayStore = create<OpenPayStoreState>((set) => ({
  status: 'DISCONNECTED',
  isAvailable: false,
  isProcessing: false,
  initialized: false,
  lastError: null,
  lastErrorAt: null,
  lastTransaction: null,
  lastTransactionAt: null,
  config: DEFAULT_OPENPAY_BRIDGE_CONFIG,

  connect: async () => {
    set({ status: 'CONNECTING', lastError: null });
    try {
      await openPayService.initialize();
      set({ initialized: true, isAvailable: true, status: 'CONNECTED' });
      return true;
    } catch (error) {
      const msg =
        error instanceof OpenPayBridgeUnavailableError
          ? 'El servicio local del PinPad OpenPay no está disponible.'
          : error instanceof Error
            ? error.message
            : 'Error inicializando OpenPay';
      set({
        status: 'ERROR',
        initialized: false,
        isAvailable: false,
        lastError: msg,
        lastErrorAt: new Date().toISOString(),
      });
      return false;
    }
  },

  disconnect: () => {
    openPayService.disconnect();
    set({
      status: 'DISCONNECTED',
      isAvailable: false,
      initialized: false,
    });
  },

  probeAvailability: async () => {
    try {
      const ok = await openPayService.probeAvailability();
      set({ isAvailable: ok, initialized: ok });
      console.log(
        ok
          ? '✅ [OPENPAY_STORE] PinPad OpenPay disponible'
          : '🔌 [OPENPAY_STORE] PinPad OpenPay no disponible — se usará flujo manual'
      );
      return ok;
    } catch {
      set({ isAvailable: false, initialized: false });
      return false;
    }
  },

  processSale: async (amountCents) => {
    set({ isProcessing: true, lastError: null, status: 'PROCESSING' });
    try {
      const response = await openPayService.processSale(amountCents);
      set({
        isProcessing: false,
        status: 'CONNECTED',
        lastTransaction: response,
        lastTransactionAt: new Date().toISOString(),
        lastError: response.ok ? null : response.legend || 'Transacción rechazada',
        lastErrorAt: response.ok ? null : new Date().toISOString(),
      });
      return response;
    } catch (error) {
      const msg =
        error instanceof OpenPayTimeoutError
          ? error.message
          : error instanceof OpenPayBridgeUnavailableError
            ? 'El servicio local del PinPad OpenPay no responde.'
            : error instanceof Error
              ? error.message
              : 'Error procesando venta OpenPay';
      set({
        isProcessing: false,
        status: 'ERROR',
        lastError: msg,
        lastErrorAt: new Date().toISOString(),
      });
      throw error;
    }
  },

  processSaleQR: async (amountCents) => {
    set({ isProcessing: true, lastError: null, status: 'PROCESSING' });
    try {
      const response = await openPayService.processSaleQR(amountCents);
      set({
        isProcessing: false,
        status: 'CONNECTED',
        lastTransaction: response,
        lastTransactionAt: new Date().toISOString(),
      });
      return response;
    } catch (error) {
      set({
        isProcessing: false,
        status: 'ERROR',
        lastError: error instanceof Error ? error.message : 'Error procesando QR',
        lastErrorAt: new Date().toISOString(),
      });
      throw error;
    }
  },

  cancelSaleQR: async () => {
    try {
      return await openPayService.cancelSaleQR();
    } catch (err) {
      console.warn('⚠️ [OPENPAY_STORE] cancelSaleQR falló:', err);
      return { ok: false, cancelled: false };
    }
  },

  voidSale: async (amountCents, financialReference) => {
    set({ isProcessing: true, lastError: null, status: 'PROCESSING' });
    try {
      const response = await openPayService.voidSale(amountCents, financialReference);
      set({
        isProcessing: false,
        status: 'CONNECTED',
        lastTransaction: response,
        lastTransactionAt: new Date().toISOString(),
      });
      return response;
    } catch (error) {
      set({
        isProcessing: false,
        status: 'ERROR',
        lastError: error instanceof Error ? error.message : 'Error anulando venta',
        lastErrorAt: new Date().toISOString(),
      });
      throw error;
    }
  },

  closeTurn: async () => {
    set({ isProcessing: true, lastError: null, status: 'PROCESSING' });
    try {
      const response = await openPayService.closeTurn();
      set({
        isProcessing: false,
        status: 'CONNECTED',
        lastTransaction: response,
        lastTransactionAt: new Date().toISOString(),
      });
      return response;
    } catch (error) {
      set({
        isProcessing: false,
        status: 'ERROR',
        lastError: error instanceof Error ? error.message : 'Error cerrando turno',
        lastErrorAt: new Date().toISOString(),
      });
      throw error;
    }
  },

  updateConfig: (config) => {
    set((prev) => {
      const next = { ...prev.config, ...config };
      openPayService.updateConfig(next);
      return { config: next };
    });
  },

  clearError: () => set({ lastError: null, lastErrorAt: null }),
  clearLastTransaction: () => set({ lastTransaction: null, lastTransactionAt: null }),
}));

// Sincronizar el status del service con el store.
openPayService.onStatusChange((status) => {
  useOpenPayStore.setState({ status });
});
