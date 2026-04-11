/**
 * PinPad Types
 * Tipos para la integración con PinPad Verifone P400 via API REST Gateway
 * Basado en: PMP-API Rest_Especificaciones_Tecnicas_v2_3.pdf
 */

// ============ TIPOS DE TRANSACCIÓN ============

export type PinPadTransactionType =
  | '01' // Compra / Compra DCC
  | '06' // Anulación de Compra
  | '09' // Reporte Detallado
  | '10' // Reporte de Totales
  | '11' // Reimpresión
  | '12' // Cierre
  | '19' // Reporte Detallado / Cierre
  | '20' // Reporte Totales / Cierre
  | '28' // Reimpresión de Lote
  | '41' // Compra con Afiliación a Pagos Recurrentes
  | '67'; // Compra Pago con QR Directo

export type PinPadCurrencyCode = '604' | '840'; // 604 = Soles, 840 = Dólares

export type PinPadReadType =
  | 'C' // Chip
  | 'L' // Contactless (NFC)
  | 'B' // Banda magnética
  | 'M' // Manual
  | 'Q'; // QR

// ============ LOGIN ============

export interface PinPadLoginRequest {
  ecr_usuario: string;
  ecr_password: string;
}

export interface PinPadLoginResponse {
  resultado: string; // '00' = Aprobado, otro = Rechazado
  mensaje?: string;
  message?: string;
  token: string; // JWT Token (válido por 12 horas según config)
}

// ============ TEST ============

export interface PinPadTestResponse {
  response_code: string; // '00' = Disponible, '99' = No disponible
}

// ============ TRANSACCIÓN - REQUEST ============

export interface PinPadTransactionRequest {
  // Campos obligatorios
  ecr_aplicacion: string; // Siempre 'POS'
  ecr_transaccion: PinPadTransactionType;

  // Campos para compra
  ecr_amount?: string; // Monto sin decimales (ej: "1050" = S/ 10.50)
  ecr_currency_code?: PinPadCurrencyCode;

  // Campos para anulación/reimpresión
  ecr_data_adicional?: string; // Número de referencia

  // Campos para reimpresión de lote
  ecr_data_adicional2?: string; // Número de lote

  // Campos opcionales
  ecr_cod_servicio?: string;
  ecr_dni?: string;
  ecr_ruc?: string;

  // Campos para montos adicionales (servicios específicos)
  ecr_amount1?: string;
  ecr_producto1?: string;
  ecr_amount2?: string;
  ecr_producto2?: string;
  ecr_amount3?: string;
  ecr_producto3?: string;
  ecr_amount4?: string;
  ecr_producto4?: string;
  ecr_amount5?: string;
  ecr_producto5?: string;

  // Campos para Pagos Recurrentes (ecr_transaccion = '41')
  ecr_type_doc_r?: '1' | '2' | '3' | '4'; // 1=DNI, 2=CE, 3=Pasaporte, 4=Otros
  ecr_num_doc_r?: string;
  ecr_celular_r?: string;
  ecr_product_code_r?: string;
  ecr_product_desc_r?: string;
  ecr_period_pago_r?: '1' | '2' | '3' | '6' | '12'; // Periodicidad
  ecr_campos_adic_r?: '0' | '1';
  ecr_service_code_r?: string;
}

// ============ TRANSACCIÓN - RESPONSE ============

export interface PinPadTransactionResponse {
  // Campos de respuesta comunes
  response_code: string; // '00' = Aprobado
  message?: string;
  ecr_aplicacion?: string;
  ecr_transaccion?: string;

  // Campos de la tarjeta
  card?: string; // Número de tarjeta enmascarado (ej: "577752******7490")
  card_id?: string;
  read_type?: PinPadReadType;

  // Campos de la transacción aprobada
  amount?: string;
  currency_code?: string;
  approval_code?: string; // Código de aprobación
  merchant_id?: string;

  // Voucher para impresión
  print_data?: string; // Data formateada para impresión

  // Campo para DCC
  imagen_id?: '0' | '1'; // 0 = Sin imagen, 1 = Visa DCC

  // Campos adicionales que pueden venir
  ecr_data_adicional?: string;
  [key: string]: string | undefined; // Otros campos dinámicos
}

// ============ ESTADOS DEL PINPAD ============

export type PinPadConnectionStatus =
  | 'DISCONNECTED' // No conectado
  | 'CONNECTING' // Conectando...
  | 'CONNECTED' // Conectado y listo
  | 'AUTHENTICATING' // Autenticando...
  | 'AUTHENTICATED' // Autenticado con token
  | 'PROCESSING' // Procesando transacción
  | 'ERROR'; // Error de conexión

export interface PinPadState {
  // Estado de conexión
  status: PinPadConnectionStatus;
  isAvailable: boolean;
  lastError?: string;
  lastErrorAt?: string;

  // Token JWT
  token?: string;
  tokenExpiresAt?: string;

  // Última transacción
  lastTransaction?: PinPadTransactionResponse;
  lastTransactionAt?: string;

  // Configuración
  gatewayUrl: string;
  gatewayPort: number;
}

// ============ CONFIGURACIÓN ============

export interface PinPadConfig {
  gatewayUrl: string; // Default: 'http://localhost'
  gatewayPort: number; // Default: 9090
  usuario: string; // Default: 'izipay'
  password: string; // Default: 'izipay'
  timeoutMs: number; // Default: 60000 (60 segundos)
  autoReconnect: boolean;
  reconnectIntervalMs: number;
}

export const DEFAULT_PINPAD_CONFIG: PinPadConfig = {
  gatewayUrl: 'http://localhost',
  gatewayPort: 9090,
  usuario: 'izipay',
  password: 'izipay',
  timeoutMs: 60000,
  autoReconnect: true,
  reconnectIntervalMs: 30000,
};

// ============ HELPERS ============

/**
 * Convierte un monto en soles (número) al formato esperado por el PinPad
 * @param amount Monto en soles (ej: 10.50)
 * @returns String sin decimales (ej: "1050")
 */
export const formatAmountForPinPad = (amount: number): string => {
  return Math.round(amount * 100).toString();
};

/**
 * Convierte el monto del PinPad a número
 * @param amount String del PinPad (ej: "1050")
 * @returns Número en soles (ej: 10.50)
 */
export const parseAmountFromPinPad = (amount: string): number => {
  return parseInt(amount, 10) / 100;
};

/**
 * Mapea el tipo de lectura a texto legible
 */
export const getReadTypeLabel = (readType?: PinPadReadType): string => {
  switch (readType) {
    case 'C':
      return 'Chip';
    case 'L':
      return 'Contactless';
    case 'B':
      return 'Banda';
    case 'M':
      return 'Manual';
    case 'Q':
      return 'QR';
    default:
      return 'Desconocido';
  }
};

/**
 * Verifica si una respuesta es aprobada
 */
export const isTransactionApproved = (response: PinPadTransactionResponse): boolean => {
  return response.response_code === '00';
};
