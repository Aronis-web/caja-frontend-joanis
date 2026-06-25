/**
 * Collections Types
 * Tipos para el sistema de recaudación de efectivo
 */

import { palette } from '@/design-system/tokens/palette';

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
  PROCESSING = 'PROCESSING',
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

  // Snapshot de cierre cuando existe una solicitud CLOSURE COMPLETED en la sesión
  sessionSnapshot?: ClosureSessionSnapshot;
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

export interface ClosureSessionIdentity {
  session_id: string;
  session_number?: string | number;
  cash_register_id: string;
  cash_register_code: string;
  cash_register_name: string;
  site_id: string;
  site_name: string;
  user_id: string;
  user_name: string;
}

export interface ClosureSessionTimesAndStatus {
  opened_at: string;
  closed_at: string;
  duration_minutes: number;
  status: string;
  closure_reason: string | null;
}

export interface ClosureSessionMonetarySummary {
  opening_cash_cents: number;
  closing_cash_cents: number;
  expected_cash_cents: number;
  difference_cents: number;
  difference_type: string;
  total_sales_cents: number;
  total_sales_count: number;
  total_cash_in_cents: number;
  total_cash_out_cents: number;
  total_refunds_cents: number;
  current_cash_cents: number;
}

export interface ClosureSalesBreakdownItem {
  [key: string]: string | number | null;
}

export interface ClosureSalesBreakdown {
  by_payment_method: ClosureSalesBreakdownItem[];
  by_document_type: ClosureSalesBreakdownItem[];
  by_cashier_session: ClosureSalesBreakdownItem[];
}

export interface ClosureOperationalTraceability {
  closed_by: string | null;
  closed_by_name: string | null;
  pending_collection_request_id: string | null;
  final_collection_id: string | null;
  alerts: {
    cash_alert_level: string;
    is_blocked: boolean;
    blocked_reason: string | null;
    blocked_at: string | null;
    had_inconsistencies: boolean;
  };
}

export interface ClosureReconciliationAndAudit {
  reconciliation_status: string;
  mismatch_details: Array<Record<string, unknown>>;
  generated_at: string;
  report_version: string;
  source_request_id: string;
}

export interface ClosureSessionSnapshot {
  session_identity: ClosureSessionIdentity;
  times_and_status: ClosureSessionTimesAndStatus;
  monetary_summary: ClosureSessionMonetarySummary;
  sales_breakdown?: ClosureSalesBreakdown;
  operational_traceability?: ClosureOperationalTraceability;
  reconciliation_and_audit?: ClosureReconciliationAndAudit;
}

export interface ClosureContext {
  sessionSnapshot?: ClosureSessionSnapshot;
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
  sessionId?: string;
  isClosureRequest?: boolean;
  source?: string;
  closureContext?: ClosureContext;
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
    color: palette.green[800],
    backgroundColor: palette.green[100],
    borderColor: palette.green[300],
    icon: '✅',
    label: 'Normal',
  },
  [CashAlertLevel.WARNING]: {
    color: palette.amber[800],
    backgroundColor: palette.amber[100],
    borderColor: palette.amber[300],
    icon: '⚠️',
    label: 'Advertencia',
  },
  [CashAlertLevel.CRITICAL]: {
    color: palette.amber[900],
    backgroundColor: palette.amber[200],
    borderColor: palette.amber[400],
    icon: '🔶',
    label: 'Crítico',
  },
  [CashAlertLevel.BLOCKED]: {
    color: palette.red[800],
    backgroundColor: palette.red[100],
    borderColor: palette.red[300],
    icon: '🚫',
    label: 'Bloqueado',
  },
};
