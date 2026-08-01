"use strict";
/**
 * PinPad Types
 * Tipos para la integración con PinPad Verifone P400 via API REST Gateway
 * Basado en: PMP-API Rest_Especificaciones_Tecnicas_v2_3.pdf
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTransactionApproved = exports.getReadTypeLabel = exports.parseAmountFromPinPad = exports.formatAmountForPinPad = exports.DEFAULT_PINPAD_CONFIG = void 0;
exports.DEFAULT_PINPAD_CONFIG = {
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
const formatAmountForPinPad = (amount) => {
    return Math.round(amount * 100).toString();
};
exports.formatAmountForPinPad = formatAmountForPinPad;
/**
 * Convierte el monto del PinPad a número
 * @param amount String del PinPad (ej: "1050")
 * @returns Número en soles (ej: 10.50)
 */
const parseAmountFromPinPad = (amount) => {
    return parseInt(amount, 10) / 100;
};
exports.parseAmountFromPinPad = parseAmountFromPinPad;
/**
 * Mapea el tipo de lectura a texto legible
 */
const getReadTypeLabel = (readType) => {
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
exports.getReadTypeLabel = getReadTypeLabel;
/**
 * Verifica si una respuesta es aprobada
 */
const isTransactionApproved = (response) => {
    return response.response_code === '00';
};
exports.isTransactionApproved = isTransactionApproved;
