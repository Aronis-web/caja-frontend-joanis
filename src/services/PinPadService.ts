/**
 * PinPad Service
 * Servicio para comunicación con el PinPad Verifone P400 via API REST Gateway
 * Basado en: PMP-API Rest_Especificaciones_Tecnicas_v2_3.pdf
 */

import type {
  PinPadConfig,
  PinPadLoginRequest,
  PinPadLoginResponse,
  PinPadTestResponse,
  PinPadTransactionRequest,
  PinPadTransactionResponse,
  PinPadConnectionStatus,
  DEFAULT_PINPAD_CONFIG,
} from '@/types/pinpad';

/**
 * Error lanzado cuando la petición al PinPad excede el timeout configurado.
 * Uso típico: PPD desconectado / reiniciado durante una transacción.
 * La UI debe cerrar el modal de "Procesando pago" y permitir reintentar.
 */
export class PinPadTimeoutError extends Error {
  constructor(message = 'Tiempo de espera agotado. El PinPad no responde.') {
    super(message);
    this.name = 'PinPadTimeoutError';
  }
}

/**
 * Detecta si una respuesta corresponde a una cancelación desde el PPD por el operador.
 * (Certificación Izipay: response_code=77 + message=CANCELADO)
 */
export function isCancelledByOperator(response: PinPadTransactionResponse): boolean {
  return (
    response?.response_code === '77' &&
    typeof response?.message === 'string' &&
    response.message.trim().toUpperCase() === 'CANCELADO'
  );
}

/**
 * Detecta si el host informó un CIERRE AUTOMATICO durante la operación.
 * (Certificación Izipay: response_code=95 + message contiene "CIERRE" / "AUTOMAT")
 * En este caso la UI debe informar al operador y forzar re-consulta del lote,
 * ya que el PPD abrió un lote nuevo internamente.
 */
export function isAutoBatchClose(response: PinPadTransactionResponse): boolean {
  if (!response) return false;
  const rc = response.response_code;
  const msg = typeof response.message === 'string' ? response.message.toUpperCase() : '';
  return rc === '95' || msg.includes('CIERRE AUTOMAT') || msg.includes('AUTOMATICO');
}

/**
 * Longitud máxima permitida (defensiva) para campos de texto provenientes del host.
 * El host de Izipay puede eventualmente devolver campos con longitud mayor a la
 * definida en la especificación; esta función los recorta para evitar que la UI
 * se rompa al renderizarlos.
 */
const HOST_STRING_MAX_LENGTH = 512;
export function sanitizePinPadResponse<T extends Record<string, unknown>>(response: T): T {
  if (!response || typeof response !== 'object') return response;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(response)) {
    if (typeof v === 'string' && v.length > HOST_STRING_MAX_LENGTH) {
      // Preserva print_data completo (voucher) pero recorta el resto.
      out[k] = k === 'print_data' ? v : v.slice(0, HOST_STRING_MAX_LENGTH);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

class PinPadService {
  private config: PinPadConfig;
  private token: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private status: PinPadConnectionStatus = 'DISCONNECTED';
  private statusListeners: Set<(status: PinPadConnectionStatus) => void> = new Set();

  constructor(config?: Partial<PinPadConfig>) {
    this.config = {
      gatewayUrl: config?.gatewayUrl ?? 'http://localhost',
      gatewayPort: config?.gatewayPort ?? 9090,
      usuario: config?.usuario ?? 'izipay',
      password: config?.password ?? 'izipay',
      timeoutMs: config?.timeoutMs ?? 60000,
      autoReconnect: config?.autoReconnect ?? true,
      reconnectIntervalMs: config?.reconnectIntervalMs ?? 30000,
    };
  }

  // ============ CONFIGURACIÓN ============

  /**
   * Actualiza la configuración del servicio
   */
  updateConfig(config: Partial<PinPadConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('🔧 [PINPAD] Configuración actualizada:', this.config);
  }

  /**
   * Obtiene la URL base del Gateway
   */
  private getBaseUrl(): string {
    return `${this.config.gatewayUrl}:${this.config.gatewayPort}`;
  }

  // ============ ESTADO ============

  /**
   * Obtiene el estado actual de conexión
   */
  getStatus(): PinPadConnectionStatus {
    return this.status;
  }

  /**
   * Verifica si está autenticado con token válido
   */
  isAuthenticated(): boolean {
    if (!this.token || !this.tokenExpiresAt) {
      return false;
    }
    return new Date() < this.tokenExpiresAt;
  }

  /**
   * Suscribirse a cambios de estado
   */
  onStatusChange(listener: (status: PinPadConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(status: PinPadConnectionStatus): void {
    if (this.status !== status) {
      console.log(`📡 [PINPAD] Estado: ${this.status} → ${status}`);
      this.status = status;
      this.statusListeners.forEach((listener) => listener(status));
    }
  }

  // ============ PETICIONES HTTP ============

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requiresAuth: boolean = true
  ): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // Agregar token si es requerido
    if (requiresAuth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      console.log(`🌐 [PINPAD] ${options.method || 'GET'} ${endpoint}`);

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP Error: ${response.status}`);
      }

      const data = await response.json();
      console.log(`✅ [PINPAD] Response:`, data);
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        // PPD no responde (posible reinicio/desconexión durante la transacción):
        // invalidamos el token para forzar una nueva sesión en el próximo intento.
        this.token = null;
        this.tokenExpiresAt = null;
        throw new PinPadTimeoutError();
      }

      throw error;
    }
  }

  // ============ LOGIN ============

  /**
   * Realiza login y obtiene el token JWT
   * POST /API_PPAD/login
   */
  async login(): Promise<PinPadLoginResponse> {
    this.setStatus('AUTHENTICATING');

    try {
      const body: PinPadLoginRequest = {
        ecr_usuario: this.config.usuario,
        ecr_password: this.config.password,
      };

      const response = await this.request<PinPadLoginResponse>(
        '/API_PPAD/login',
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
        false // No requiere auth
      );

      if (response.resultado === '00' && response.token) {
        this.token = response.token;
        // Token válido por 12 horas según configuración (jwt.time=43200 segundos)
        this.tokenExpiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
        this.setStatus('AUTHENTICATED');
        console.log('🔐 [PINPAD] Login exitoso, token obtenido');
      } else {
        this.setStatus('ERROR');
        throw new Error(response.mensaje || response.message || 'Error de autenticación');
      }

      return response;
    } catch (error) {
      this.setStatus('ERROR');
      console.error('❌ [PINPAD] Error en login:', error);
      throw error;
    }
  }

  /**
   * Asegura que haya un token válido, renovándolo si es necesario
   */
  async ensureAuthenticated(): Promise<void> {
    if (!this.isAuthenticated()) {
      await this.login();
    }
  }

  // ============ TEST DE CONEXIÓN ============

  /**
   * Verifica disponibilidad del PinPad
   * POST /API_PPAD/test
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.ensureAuthenticated();

      this.setStatus('PROCESSING');

      const response = await this.request<PinPadTestResponse>('/API_PPAD/test', {
        method: 'POST',
      });

      const isAvailable = response.response_code === '00';

      if (isAvailable) {
        this.setStatus('CONNECTED');
        console.log('✅ [PINPAD] PinPad disponible');
      } else {
        this.setStatus('ERROR');
        console.warn('⚠️ [PINPAD] PinPad no disponible');
      }

      return isAvailable;
    } catch (error) {
      this.setStatus('ERROR');
      console.error('❌ [PINPAD] Error en test de conexión:', error);
      throw error;
    }
  }

  // ============ TRANSACCIONES ============

  /**
   * Procesa una transacción en el PinPad
   * POST /API_PPAD/procesarTransaccion
   */
  async processTransaction(request: PinPadTransactionRequest): Promise<PinPadTransactionResponse> {
    try {
      await this.ensureAuthenticated();

      this.setStatus('PROCESSING');
      console.log('💳 [PINPAD] Procesando transacción:', request.ecr_transaccion);
      console.log('📤 [PINPAD] Request completo:', JSON.stringify(request, null, 2));

      const response = await this.request<PinPadTransactionResponse>(
        '/API_PPAD/procesarTransaccion',
        {
          method: 'POST',
          body: JSON.stringify(request),
        }
      );

      console.log('📥 [PINPAD] Response completo:', JSON.stringify(response, null, 2));
      this.setStatus('CONNECTED');

      if (response.response_code === '00') {
        console.log('✅ [PINPAD] Transacción aprobada:', response.approval_code);
      } else {
        console.warn('⚠️ [PINPAD] Transacción rechazada:', response.message);
      }

      return response;
    } catch (error) {
      this.setStatus('ERROR');
      console.error('❌ [PINPAD] Error procesando transacción:', error);
      throw error;
    }
  }

  // ============ OPERACIONES DE COMPRA ============

  /**
   * Procesa una compra con tarjeta Y opción QR
   * @param amountCents Monto en centavos (ej: 1050 = S/ 10.50)
   * @param currencyCode Moneda ('604' = Soles, '840' = Dólares)
   * @param enableQR Si true, habilita también la opción de pagar con QR (default: true)
   *
   * IMPORTANTE: ecr_data_adicional: '0' habilita QR en el PinPad
   * Sin este parámetro, solo se permite tarjeta (chip/contactless/banda)
   */
  async processSale(
    amountCents: number,
    currencyCode: '604' | '840' = '604',
    enableQR: boolean = true
  ): Promise<PinPadTransactionResponse> {
    const request: any = {
      ecr_aplicacion: 'POS',
      ecr_transaccion: '01',
      ecr_amount: amountCents.toString(),
      ecr_currency_code: currencyCode,
    };

    // Habilitar QR si está activo (por defecto sí)
    if (enableQR) {
      request.ecr_data_adicional = '0';
    }

    return this.processTransaction(request);
  }

  /**
   * Procesa una compra SOLO con tarjeta (sin opción QR)
   * @param amountCents Monto en centavos
   * @param currencyCode Moneda
   */
  async processSaleCardOnly(
    amountCents: number,
    currencyCode: '604' | '840' = '604'
  ): Promise<PinPadTransactionResponse> {
    return this.processTransaction({
      ecr_aplicacion: 'POS',
      ecr_transaccion: '01',
      ecr_amount: amountCents.toString(),
      ecr_currency_code: currencyCode,
      // Sin ecr_data_adicional = solo tarjeta
    });
  }

  /**
   * Procesa una compra con opción de pago QR (alias para compatibilidad)
   * @deprecated Usar processSale() que ya incluye QR por defecto
   */
  async processSaleWithQR(
    amountCents: number,
    currencyCode: '604' | '840' = '604'
  ): Promise<PinPadTransactionResponse> {
    return this.processSale(amountCents, currencyCode, true);
  }

  /**
   * Procesa una compra directa con QR (sin opción de tarjeta)
   * Usa ecr_transaccion: '67' para QR directo
   */
  async processSaleQRDirect(
    amountCents: number,
    currencyCode: '604' | '840' = '604'
  ): Promise<PinPadTransactionResponse> {
    return this.processTransaction({
      ecr_aplicacion: 'POS',
      ecr_transaccion: '67',
      ecr_amount: amountCents.toString(),
      ecr_currency_code: currencyCode,
      ecr_data_adicional: '0',
    });
  }

  // ============ OPERACIONES DE ANULACIÓN ============

  /**
   * Anula una compra
   * @param referenceNumber Número de referencia de la compra a anular
   */
  async voidSale(referenceNumber: string): Promise<PinPadTransactionResponse> {
    return this.processTransaction({
      ecr_aplicacion: 'POS',
      ecr_transaccion: '06',
      ecr_data_adicional: referenceNumber,
    });
  }

  // ============ OPERACIONES DE REIMPRESIÓN ============

  /**
   * Reimprime un voucher
   * @param referenceNumber Número de referencia
   */
  async reprint(referenceNumber: string): Promise<PinPadTransactionResponse> {
    return this.processTransaction({
      ecr_aplicacion: 'POS',
      ecr_transaccion: '11',
      ecr_data_adicional: referenceNumber,
    });
  }

  /**
   * Reimprime un lote completo
   * @param batchNumber Número de lote
   */
  async reprintBatch(batchNumber: string): Promise<PinPadTransactionResponse> {
    return this.processTransaction({
      ecr_aplicacion: 'POS',
      ecr_transaccion: '28',
      ecr_data_adicional2: batchNumber,
    });
  }

  // ============ REPORTES ============

  /**
   * Obtiene el reporte detallado
   */
  async getDetailedReport(): Promise<PinPadTransactionResponse> {
    return this.processTransaction({
      ecr_aplicacion: 'POS',
      ecr_transaccion: '09',
    });
  }

  /**
   * Obtiene el reporte de totales
   */
  async getTotalsReport(): Promise<PinPadTransactionResponse> {
    return this.processTransaction({
      ecr_aplicacion: 'POS',
      ecr_transaccion: '10',
    });
  }

  // ============ CIERRE ============

  /**
   * Realiza el cierre de lote
   */
  async closeBatch(): Promise<PinPadTransactionResponse> {
    return this.processTransaction({
      ecr_aplicacion: 'POS',
      ecr_transaccion: '12',
    });
  }

  /**
   * Reporte detallado + Cierre
   */
  async detailedReportAndClose(): Promise<PinPadTransactionResponse> {
    return this.processTransaction({
      ecr_aplicacion: 'POS',
      ecr_transaccion: '19',
    });
  }

  /**
   * Reporte de totales + Cierre
   */
  async totalsReportAndClose(): Promise<PinPadTransactionResponse> {
    return this.processTransaction({
      ecr_aplicacion: 'POS',
      ecr_transaccion: '20',
    });
  }

  // ============ DESCONEXIÓN ============

  /**
   * Desconecta y limpia el token
   */
  disconnect(): void {
    this.token = null;
    this.tokenExpiresAt = null;
    this.setStatus('DISCONNECTED');
    console.log('🔌 [PINPAD] Desconectado');
  }
}

// Singleton instance
export const pinPadService = new PinPadService();

// También exportar la clase para testing
export { PinPadService };
