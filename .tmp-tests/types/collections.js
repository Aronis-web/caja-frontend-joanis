"use strict";
/**
 * Collections Types
 * Tipos para el sistema de recaudación de efectivo
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALERT_LEVEL_CONFIGS = exports.CollectionRequestStatus = exports.CollectionRequestReason = exports.CashAlertLevel = void 0;
const palette_1 = require("@/design-system/tokens/palette");
// ═══════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════
var CashAlertLevel;
(function (CashAlertLevel) {
    CashAlertLevel["NORMAL"] = "NORMAL";
    CashAlertLevel["WARNING"] = "WARNING";
    CashAlertLevel["CRITICAL"] = "CRITICAL";
    CashAlertLevel["BLOCKED"] = "BLOCKED";
})(CashAlertLevel || (exports.CashAlertLevel = CashAlertLevel = {}));
var CollectionRequestReason;
(function (CollectionRequestReason) {
    CollectionRequestReason["MANUAL"] = "MANUAL";
    CollectionRequestReason["APPROACHING_LIMIT"] = "APPROACHING_LIMIT";
    CollectionRequestReason["BLOCKED"] = "BLOCKED";
    CollectionRequestReason["SCHEDULED"] = "SCHEDULED";
    CollectionRequestReason["END_OF_SHIFT"] = "END_OF_SHIFT";
})(CollectionRequestReason || (exports.CollectionRequestReason = CollectionRequestReason = {}));
var CollectionRequestStatus;
(function (CollectionRequestStatus) {
    CollectionRequestStatus["PENDING"] = "PENDING";
    CollectionRequestStatus["IN_PROGRESS"] = "IN_PROGRESS";
    CollectionRequestStatus["PROCESSING"] = "PROCESSING";
    CollectionRequestStatus["COMPLETED"] = "COMPLETED";
    CollectionRequestStatus["EXPIRED"] = "EXPIRED";
    CollectionRequestStatus["CANCELLED"] = "CANCELLED";
})(CollectionRequestStatus || (exports.CollectionRequestStatus = CollectionRequestStatus = {}));
exports.ALERT_LEVEL_CONFIGS = {
    [CashAlertLevel.NORMAL]: {
        color: palette_1.palette.green[800],
        backgroundColor: palette_1.palette.green[100],
        borderColor: palette_1.palette.green[300],
        icon: '✅',
        label: 'Normal',
    },
    [CashAlertLevel.WARNING]: {
        color: palette_1.palette.amber[800],
        backgroundColor: palette_1.palette.amber[100],
        borderColor: palette_1.palette.amber[300],
        icon: '⚠️',
        label: 'Advertencia',
    },
    [CashAlertLevel.CRITICAL]: {
        color: palette_1.palette.amber[900],
        backgroundColor: palette_1.palette.amber[200],
        borderColor: palette_1.palette.amber[400],
        icon: '🔶',
        label: 'Crítico',
    },
    [CashAlertLevel.BLOCKED]: {
        color: palette_1.palette.red[800],
        backgroundColor: palette_1.palette.red[100],
        borderColor: palette_1.palette.red[300],
        icon: '🚫',
        label: 'Bloqueado',
    },
};
