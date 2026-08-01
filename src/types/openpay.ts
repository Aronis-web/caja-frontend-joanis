/**
 * OpenPay PinPad types
 *
 * El PinPad OpenPay (Perú) se integra vía el SDK .NET
 * `EGlobal.TotalPOS.Peru.SDK`, envuelto por `openpay-bridge` — un pequeño
 * servicio HTTP local que expone el SDK como REST (patrón análogo al
 * gateway de Izipay).
 *
 * El bridge escucha por defecto en `http://localhost:9091`.
 */

export interface OpenPayBridgeConfig {
  /** Base URL del bridge, sin barra final. Default: http://localhost:9091 */
  baseUrl: string;
  /** Timeout por request (ms). Debe ser mayor al PinPadTimeOut del SDK. */
  timeoutMs: number;
  /** Intervalo del healthcheck periódico (ms). */
  reconnectIntervalMs: number;
}

export const DEFAULT_OPENPAY_BRIDGE_CONFIG: OpenPayBridgeConfig = {
  baseUrl: 'http://localhost:9091',
  timeoutMs: 90_000, // el PinPadTimeOut típico es 60s; damos margen
  reconnectIntervalMs: 30_000,
};

/**
 * Estados posibles del PinPad OpenPay a lo largo del ciclo de vida.
 * Se mantienen los mismos valores que `PinPadConnectionStatus` (Izipay)
 * para poder reutilizar los mismos indicadores visuales.
 */
export type OpenPayConnectionStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'AUTHENTICATING'
  | 'AUTHENTICATED'
  | 'CONNECTED'
  | 'PROCESSING'
  | 'ERROR';

/**
 * Respuesta genérica del bridge: mapea 1:1 los campos de
 * `EGlobal.TotalPOS.Peru.SDK.Interfaz.Layout.Respuesta` renombrados a
 * camelCase inglés para consumo del renderer.
 */
export interface OpenPayResponse {
  /** true si `responseCode === '00'`. Aplicación NO debe reimplementar la regla. */
  ok: boolean;
  responseCode: string;
  legend: string;
  transactionId: string;
  authorization: string;
  /** Referencia usada para anulaciones (`ParametroOperacion.ReferenciaFinanciera`). */
  financialReference: string;
  operationCode: string;
  operationName: string;
  sequence: string;
  amount: string;
  tip: string;
  folio: string;
  operatorId: string;
  /** Firma capturada por el PPD (base64) o vacío si el flujo no la pidió. */
  sign: string;
  /** Fecha/hora del PPD en `yyyyMMddHHmmss`. */
  dateTime: string;
  // Comercio
  merchantId: string;
  merchantIdAmex: string;
  currency: string;
  merchantName: string;
  merchantAddress: string;
  terminalNumber: string;
  terminalSerial: string;
  turnId: string;
  // Tarjeta (siempre enmascarada; el PPD nunca entrega el PAN)
  cardNumber: string;
  cardHolder: string;
  readMode: string;
  cardProduct: string;
  cardIssuer: string;
  cardAppId: string;
  cardAppName: string;
  cardCryptogram: string;
  // Billetera / QR
  walletId: string;
  walletName: string;
  // Cuotas / promociones
  promoCode: string;
  financing: string;
  installments: string;
  installmentAmount: string;
  messages: string[];
}

export interface OpenPayHealthResponse {
  ok: boolean;
  initialized: boolean;
}

/**
 * Formato del cuerpo de error devuelto por el bridge cuando el SDK lanza
 * `PeticionException` o cualquier otra excepción durante la operación.
 */
export interface OpenPayErrorResponse {
  ok: false;
  error: string;
  type?: string;
}

/**
 * Extrae los últimos 4 dígitos de una tarjeta enmascarada devuelta por el PPD
 * (formatos vistos: `************1234`, `499999******1234`).
 */
export function extractCardLast4(cardNumber?: string | null): string | undefined {
  if (!cardNumber) return undefined;
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 4) return undefined;
  return digits.slice(-4);
}
