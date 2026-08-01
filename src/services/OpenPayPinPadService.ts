/**
 * OpenPayPinPadService
 *
 * Cliente HTTP del `openpay-bridge` (servicio .NET local que envuelve el
 * SDK `EGlobal.TotalPOS.Peru.SDK` para el PinPad OpenPay Perú).
 *
 * A diferencia de Izipay, el bridge OpenPay NO tiene autenticación (corre
 * en localhost como proceso hijo de Electron). Sí mantiene estado interno:
 * hay que llamar a `initialize()` una vez tras arrancarlo para que cargue
 * `Local.config` y ejecute `Interfaz.Inicializar()` del SDK.
 *
 * El PinPad físico no soporta operaciones concurrentes; el bridge las
 * serializa con un `lock`, pero aquí también evitamos disparar transacciones
 * en paralelo desde el mismo cliente.
 */

import {
  DEFAULT_OPENPAY_BRIDGE_CONFIG,
  type OpenPayBridgeConfig,
  type OpenPayConnectionStatus,
  type OpenPayHealthResponse,
  type OpenPayResponse,
} from '@/types/openpay';

/**
 * Error lanzado cuando la petición al bridge excede el timeout configurado.
 * Uso típico: el PinPad está esperando input del cliente y se agota el timeout
 * del SDK, o el bridge murió. La UI debe cerrar el modal de "Procesando pago"
 * y permitir reintentar.
 */
export class OpenPayTimeoutError extends Error {
  constructor(message = 'Tiempo de espera agotado. El PinPad OpenPay no responde.') {
    super(message);
    this.name = 'OpenPayTimeoutError';
  }
}

/**
 * Error lanzado cuando el bridge no está disponible (proceso caído, puerto
 * ocupado, aún no arrancó). Distinto de un rechazo del PPD.
 */
export class OpenPayBridgeUnavailableError extends Error {
  constructor(message = 'El bridge OpenPay no está disponible.') {
    super(message);
    this.name = 'OpenPayBridgeUnavailableError';
  }
}

/** Detecta cancelaciones del operador desde el PPD (mismo criterio Izipay). */
export function isOpenPayCancelledByOperator(response: OpenPayResponse): boolean {
  return (
    response?.responseCode === '77' &&
    typeof response?.legend === 'string' &&
    response.legend.trim().toUpperCase() === 'CANCELADO'
  );
}

/**
 * Detecta el error del PPD "No se ha realizado inicialización de llaves"
 * (código 62 del PinPadManager). Ese error solo puede resolverse ejecutando
 * `Operacion.CargaLlaves` una vez contra el terminal.
 *
 * El mensaje llega distinto según el nivel: a veces con acento, a veces sin,
 * a veces con "Pin Online". Matcheamos por substring case-insensitive contra
 * la parte estable ("inicializ" + "llaves").
 */
function isKeysNotInitializedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const norm = msg.toLowerCase();
  return norm.includes('llaves') && norm.includes('inicializ');
}

class OpenPayPinPadService {
  private config: OpenPayBridgeConfig;
  private status: OpenPayConnectionStatus = 'DISCONNECTED';
  private statusListeners: Set<(status: OpenPayConnectionStatus) => void> = new Set();
  private initialized = false;

  constructor(config?: Partial<OpenPayBridgeConfig>) {
    this.config = { ...DEFAULT_OPENPAY_BRIDGE_CONFIG, ...(config || {}) };
  }

  // ============ CONFIG / ESTADO ============

  updateConfig(config: Partial<OpenPayBridgeConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('🔧 [OPENPAY] Configuración actualizada:', this.config);
  }

  getStatus(): OpenPayConnectionStatus {
    return this.status;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  onStatusChange(listener: (status: OpenPayConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(status: OpenPayConnectionStatus): void {
    if (this.status !== status) {
      console.log(`📡 [OPENPAY] Estado: ${this.status} → ${status}`);
      this.status = status;
      this.statusListeners.forEach((l) => l(status));
    }
  }

  // ============ HTTP ============

  private async request<T>(path: string, body?: unknown, method: string = 'POST'): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    // Fase 1: obtener la respuesta HTTP, reclasificando errores de red / timeout.
    // Se hace en un bloque aparte para no envolver el `throw` sintético del error
    // HTTP en un catch (evita `no-useless-catch`).
    let res: Response;
    try {
      console.log(`🌐 [OPENPAY] ${method} ${path}`);
      res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new OpenPayTimeoutError();
        }
        // fetch a un host caído en Electron/Chromium produce TypeError: Failed to fetch.
        if (error.name === 'TypeError' || /fetch/i.test(error.message)) {
          throw new OpenPayBridgeUnavailableError(
            `No se pudo contactar el bridge OpenPay en ${this.config.baseUrl}: ${error.message}`
          );
        }
      }
      throw error;
    }
    clearTimeout(timeoutId);

    // Fase 2: parsear cuerpo y validar status. El bridge siempre responde JSON.
    const data = (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
    if (!res.ok) {
      const msg = (data as { error?: string })?.error || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data as T;
  }

  // ============ INIT / HEALTH ============

  /**
   * Verifica que el bridge esté vivo. No inicializa el SDK.
   * Útil como sonda silenciosa antes de bloquear la UI.
   */
  async healthCheck(): Promise<OpenPayHealthResponse> {
    return this.request<OpenPayHealthResponse>('/health', undefined, 'GET');
  }

  /**
   * Manda al bridge inicializar el SDK cargando `Local.config`. Idempotente
   * en el lado del bridge (segundo llamado no hace nada).
   */
  async initialize(): Promise<void> {
    this.setStatus('CONNECTING');
    try {
      await this.request<OpenPayHealthResponse>('/openpay/init');
      this.initialized = true;
      this.setStatus('CONNECTED');
      console.log('🔐 [OPENPAY] SDK inicializado');
    } catch (error) {
      this.setStatus('ERROR');
      throw error;
    }
  }

  /**
   * Sonda silenciosa: /health + intenta initialize si aún no lo estaba.
   * NO cambia el status a ERROR si falla (para no ensuciar la UI cuando el
   * PinPad OpenPay simplemente no está en uso).
   */
  async probeAvailability(): Promise<boolean> {
    try {
      const h = await this.healthCheck();
      if (!h.initialized) {
        try {
          await this.request<OpenPayHealthResponse>('/openpay/init');
          this.initialized = true;
        } catch {
          this.initialized = false;
          return false;
        }
      } else {
        this.initialized = true;
      }
      // Marcamos CONNECTED sólo si estábamos en DISCONNECTED/ERROR previos.
      if (this.status !== 'PROCESSING') this.setStatus('CONNECTED');
      return true;
    } catch {
      this.initialized = false;
      return false;
    }
  }

  // ============ OPERACIONES ============

  /**
   * Convierte centavos → string con 2 decimales (formato que espera el SDK).
   * Ej: 1050 → "10.50".
   */
  private formatAmount(amountCents: number): string {
    return (Math.max(0, Math.round(amountCents)) / 100).toFixed(2);
  }

  /**
   * Venta con tarjeta (chip / contactless / banda). El PPD muestra el prompt
   * "INSERTE / DESLICE TARJETA" y bloquea hasta aprobación o cancelación.
   *
   * @param amountCents Monto en centavos.
   */
  async processSale(amountCents: number): Promise<OpenPayResponse> {
    return this.runOperation('/openpay/venta', { amount: this.formatAmount(amountCents) });
  }

  /**
   * Venta QR (billeteras: Yape, PLIN, etc. según config del PPD).
   *
   * Flujo real dentro del bridge (dos pasos SDK EGlobal):
   *   1) `GenerarQR()` — muestra el QR en la pantalla del PPD.
   *   2) `FinalizarVentaQR()` — bloquea polling contra el host OpenPay hasta
   *      que la wallet paga o se agota el timeout del PPD (~45s).
   *
   * Desde la app se dispara como un **solo llamado HTTP** — la promesa se
   * resuelve cuando el flujo QR completa. Para abortar mid-flight (botón
   * "Cancelar" en la UI mientras el cliente aún no escanea) usar
   * {@link cancelSaleQR}.
   */
  async processSaleQR(amountCents: number): Promise<OpenPayResponse> {
    return this.runOperation('/openpay/venta-qr', { amount: this.formatAmount(amountCents) });
  }

  /**
   * Cancela una VentaQR en curso (equivalente a `Peticion.CancelarVentaQR()`
   * en el SDK). Debe llamarse desde otro hilo/tab mientras `processSaleQR`
   * sigue pendiente — el bridge lo maneja sin deadlock.
   *
   * @returns `{ cancelled: true }` si había una VentaQR activa; `false` si no.
   */
  async cancelSaleQR(): Promise<{ ok: boolean; cancelled: boolean }> {
    try {
      const res = await this.request<{ cancelled: boolean }>('/openpay/venta-qr/cancel', {});
      return { ok: true, cancelled: res.cancelled === true };
    } catch (err) {
      console.warn('⚠️ [OPENPAY] cancelSaleQR falló:', err);
      return { ok: false, cancelled: false };
    }
  }

  /**
   * Anulación de una venta previa. El SDK exige el importe original y la
   * `ReferenciaFinanciera` devuelta por la venta aprobada.
   */
  async voidSale(amountCents: number, financialReference: string): Promise<OpenPayResponse> {
    return this.runOperation('/openpay/anulacion', {
      amount: this.formatAmount(amountCents),
      financialReference,
    });
  }

  /** Anulación de una venta QR. */
  async voidSaleQR(amountCents: number, financialReference: string): Promise<OpenPayResponse> {
    return this.runOperation('/openpay/anulacion-qr', {
      amount: this.formatAmount(amountCents),
      financialReference,
    });
  }

  /** Cierre de turno (lote) del terminal. */
  async closeTurn(): Promise<OpenPayResponse> {
    return this.runOperation('/openpay/cierre', {});
  }

  /** Carga de llaves criptográficas. Se corre una única vez tras afiliar. */
  async loadKeys(): Promise<OpenPayResponse> {
    return this.runOperation('/openpay/carga-llaves', {});
  }

  private async runOperation(path: string, body: unknown): Promise<OpenPayResponse> {
    this.setStatus('PROCESSING');
    try {
      const res = await this.runWithKeysRetry(path, body);
      if (res.ok) {
        console.log('✅ [OPENPAY] Aprobada:', res.authorization);
      } else {
        console.warn('⚠️ [OPENPAY] Rechazada:', res.responseCode, res.legend);
      }
      this.setStatus('CONNECTED');
      return res;
    } catch (error) {
      this.setStatus('ERROR');
      throw error;
    }
  }

  /**
   * Ejecuta la operación y, si el PPD reporta "no se ha realizado inicialización
   * de llaves", corre `/openpay/carga-llaves` transparentemente y reintenta UNA
   * vez. La carga de llaves solo aplica al terminal (no consume tarjeta), así
   * que el reintento no molesta al cliente que ya está frente al PPD.
   *
   * Nota: para no entrar en loop infinito si carga-llaves también fallara con
   * el mismo mensaje, la propia carga se ejecuta con `request()` directo, sin
   * pasar por este helper.
   */
  private async runWithKeysRetry(path: string, body: unknown): Promise<OpenPayResponse> {
    // La carga de llaves nunca debe re-entrar en este flujo.
    if (path === '/openpay/carga-llaves') {
      return this.request<OpenPayResponse>(path, body);
    }
    try {
      return await this.request<OpenPayResponse>(path, body);
    } catch (error) {
      if (!isKeysNotInitializedError(error)) throw error;
      console.warn(
        '🔑 [OPENPAY] PPD sin llaves cargadas — ejecutando carga-llaves y reintentando',
        path
      );
      let keysRes: OpenPayResponse;
      try {
        keysRes = await this.request<OpenPayResponse>('/openpay/carga-llaves', {});
      } catch (keysErr) {
        const originalMsg = error instanceof Error ? error.message : String(error);
        const keysMsg = keysErr instanceof Error ? keysErr.message : String(keysErr);
        throw new Error(
          `PPD sin llaves y falló la carga automática. Original: "${originalMsg}". Carga: "${keysMsg}".`
        );
      }
      if (!keysRes.ok) {
        const originalMsg = error instanceof Error ? error.message : String(error);
        throw new Error(
          `PPD sin llaves y la carga fue rechazada (${keysRes.responseCode}): ${keysRes.legend || 'sin mensaje'}. Original: "${originalMsg}".`
        );
      }
      console.log('🔐 [OPENPAY] Carga de llaves OK — reintentando operación', path);
      // Reintento único.
      return this.request<OpenPayResponse>(path, body);
    }
  }

  disconnect(): void {
    this.initialized = false;
    this.setStatus('DISCONNECTED');
    console.log('🔌 [OPENPAY] Desconectado');
  }
}

export const openPayService = new OpenPayPinPadService();
export { OpenPayPinPadService };
