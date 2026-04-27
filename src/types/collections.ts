/**
 * Collections Types
 * Tipos para el sistema de recaudación de efectivo
 */

// ═══════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════

export enum CashAlertLevel {
  NORMAL = 'NORMAL',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
  BLOCKED = 'BLOCKED',
}

export enum CollectionRequestReason {
  MANUAL = 'MANUAL',
  APPROACHING_LIMIT = 'APPROACHING_LIMIT',
  BLOCKED = 'BLOCKED',
  SCHEDULED = 'SCHEDULED',
  END_OF_SHIFT = 'END_OF_SHIFT',
}

export enum CollectionRequestStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

// ═══════════════════════════════════════════════════════════════════════════
// CASH STATUS INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

export interface PendingRequestInfo {
  id: string;
  token: string;
  status: CollectionRequestStatus;
  expiresAt: string;
}

export interface CashStatusResponse {
  // Valores en centavos (enteros)
  currentCashCents: number;
  maxCashCents: number;
  minCashCents: number;

  // Valores formateados (decimales)
  currentCash: number;
  maxCash: number;
  minCash: number;

  // Porcentaje y alertas
  percentUsed: number;
  alertLevel: CashAlertLevel;
  alertThresholdPercent: number;
  message: string;

  // Estado de bloqueo
  isBlocked: boolean;
  blockedAt?: string;
  blockedReason?: string;

  // Información de recaudación
  canCollect: boolean;
  maxCollectionCents: number;
  maxCollection: number;
  suggestedCollectionCents: number;
  suggestedCollection: number;

  // Solicitud pendiente (si existe)
  pendingRequest?: PendingRequestInfo;
}

// ═══════════════════════════════════════════════════════════════════════════
// COLLECTION REQUEST INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

export interface CreateCollectionRequestDto {
  reason: CollectionRequestReason;
  notes?: string;
}

export interface CreateClosureCollectionRequestDto {
  expectedAmountCents?: number;
  notes?: string;
}

export interface CollectionRequestResponse {
  requestId: string;
  qrToken: string;
  qrUrl: string;
  qrData: string;
  expiresAt: string;
  expiresInSeconds: number;
  currentCashCents: number;
  maxCollectionCents: number;
  expectedAmountCents?: number;
  mode?: 'CLOSURE' | 'REGULAR';
}

export interface CollectionRequestStatusResponse {
  id: string;
  status: CollectionRequestStatus;
  token: string;
  expiresAt: string;
  isExpired: boolean;
  expiresInSeconds: number;
  processedBy?: {
    id: string;
    name: string;
  };
  processedAt?: string;
  // Información adicional cuando se completa
  completedCollection?: {
    collectionNumber: string;
    amountCents: number;
    completedAt: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// UI HELPER TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface AlertLevelConfig {
  color: string;
  backgroundColor: string;
  borderColor: string;
  icon: string;
  label: string;
}

export const ALERT_LEVEL_CONFIGS: Record<CashAlertLevel, AlertLevelConfig> = {
  [CashAlertLevel.NORMAL]: {
    color: '#2E7D32',
    backgroundColor: '#E8F5E9',
    borderColor: '#A5D6A7',
    icon: '✅',
    label: 'Normal',
  },
  [CashAlertLevel.WARNING]: {
    color: '#F57F17',
    backgroundColor: '#FFF8E1',
    borderColor: '#FFE082',
    icon: '⚠️',
    label: 'Advertencia',
  },
  [CashAlertLevel.CRITICAL]: {
    color: '#E65100',
    backgroundColor: '#FFF3E0',
    borderColor: '#FFCC80',
    icon: '🔶',
    label: 'Crítico',
  },
  [CashAlertLevel.BLOCKED]: {
    color: '#C62828',
    backgroundColor: '#FFEBEE',
    borderColor: '#EF9A9A',
    icon: '🚫',
    label: 'Bloqueado',
  },
};
