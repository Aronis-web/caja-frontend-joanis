/**
 * Offline System Types
 * Types for the offline contingency system
 */

// ============ PRODUCTOS OFFLINE ============

export type TaxType = 'GRAVADO' | 'EXONERADO' | 'INAFECTO' | 'gravado' | 'exonerado' | 'inafecto';

export interface OfflineProduct {
  id: string;
  sku: string | null;
  barcode: string | null;
  name: string;
  categoryName: string | null;
  salePriceCents: number;
  taxType: TaxType;
  serverStock: number; // Stock según última sincronización
  localStock: number; // Stock ajustado por ventas locales
  unitOfMeasure: string | null;
  codigoAfectacionIgv?: string; // Código SUNAT de afectación IGV (10, 20, 30, etc.)
  imageUrl?: string | null;
  syncId: string;
  updatedAt: string;
}

// ============ TOKENS OFFLINE ============

export type OfflineTokenStatus = 'AVAILABLE' | 'USED' | 'PENDING_SYNC' | 'SYNCED' | 'EXPIRED';

export interface OfflineToken {
  token: string;
  sequence: number;
  status: OfflineTokenStatus;
  expiresAt: string;
  usedForSaleId?: string;
  usedAt?: string;
  createdAt: string;
}

// ============ VENTAS OFFLINE ============

export type OfflineSaleStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';

export interface OfflineSaleItem {
  productId: string;
  productName: string;
  productCode: string;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  taxRate: number;
}

export interface OfflineSalePayment {
  paymentMethodId: string;
  paymentMethodName: string;
  amountCents: number;
}

export interface OfflineSale {
  localId: string;
  token: string;
  offlineTicketCode: string;
  items: OfflineSaleItem[];
  totalCents: number;
  subtotalCents: number;
  taxCents: number;
  discountCents: number;
  customerId?: string;
  customerSnapshot?: {
    name: string;
    documentNumber: string;
    documentType: string;
  };
  payments: OfflineSalePayment[];
  documentType: '01' | '03';
  cashRegisterId: string;
  sessionId: string;
  sellerId: string;
  createdAt: string;
  syncStatus: OfflineSaleStatus;
  syncAttempts: number;
  lastSyncAttempt?: string;
  syncError?: string;
  serverSaleId?: string;
  serverDocumentNumber?: string;
}

// ============ METADATA DE SINCRONIZACIÓN ============

export interface SyncMetadata {
  syncId: string;
  syncType: 'FULL' | 'DELTA' | 'STOCK' | 'TOKENS';
  timestamp: string;
  expiresAt: string;
  checksum?: string;
  totalProducts?: number;
  totalTokens?: number;
  cashRegisterId: string;
}

// ============ RESPUESTAS DEL SERVIDOR ============

/**
 * Producto tal como viene del backend (puede tener campos diferentes)
 */
export interface ApiProduct {
  id: string;
  sku?: string;
  barcode?: string;
  title?: string; // Backend usa "title" en lugar de "name"
  name?: string;
  categoryName?: string;
  salePriceCents: number;
  taxType?: string;
  availableStock?: number; // Backend usa "availableStock" en lugar de "serverStock"
  serverStock?: number;
  unitOfMeasure?: string;
  codigoAfectacionIgv?: string;
  imageUrl?: string | null;
}

export interface OfflineCatalogResponse {
  products: ApiProduct[];
  syncMetadata: {
    syncId: string;
    syncTimestamp: string;
    cashRegisterId: string;
    warehouseId: string;
    priceProfileId: string;
    totalProducts: number;
    checksum: string;
    expiresAt: string;
  };
  tokenPool?: {
    tokens: PreGeneratedToken[];
    poolId: string;
    expiresAt: string;
    replenishThreshold: number;
    totalTokens?: number;
  };
  nextSync?: {
    recommendedMs: number;
    minMs: number;
    reason?: string;
  };
  companyInfo?: {
    ruc: string;
    razonSocial: string;
    nombreComercial?: string;
    direccion: string;
  };
}

export interface PreGeneratedToken {
  token: string;
  sequence: number;
  createdAt: string;
  expiresAt: string;
}

export interface StockUpdateResponse {
  updates: { productId: string; stock: number }[];
  timestamp: string;
  nextSyncRecommendedMs: number;
}

export interface TokenReplenishResponse {
  newTokens: PreGeneratedToken[];
  newPoolId: string;
  confirmedUsedTokens: string[];
}

// ============ SINCRONIZACIÓN DE VENTAS ============

export interface SyncRegistrationResponse {
  registrationId: string;
  queuePosition: number;
  pollIntervalMs: number;
  estimatedWaitMs: number;
}

export interface SyncStatusResponse {
  status: 'QUEUED' | 'READY' | 'EXPIRED';
  position?: number;
  syncToken?: string;
  expiresAt?: string;
}

export interface SyncSalesRequest {
  cashRegisterId: string;
  sessionId: string;
  batchId: string;
  syncToken: string;
  sales: OfflineSale[];
}

export interface SyncSalesResponse {
  batchId: string;
  processed: number;
  results: {
    localId: string;
    token: string;
    status: 'QUEUED' | 'REJECTED';
    queuePosition?: number;
    error?: string;
    errorCode?: string;
    serverSaleId?: string;
    serverDocumentNumber?: string;
  }[];
  nextBatchAllowedAt: string;
  remainingQuota: number;
}

// ============ ESTADO DEL SISTEMA OFFLINE ============

export type ConnectionStatus = 'ONLINE' | 'OFFLINE' | 'RECONNECTING' | 'SYNCING';

export interface OfflineSystemState {
  // Estado de conexión
  connectionStatus: ConnectionStatus;
  lastOnlineAt?: string;
  lastOfflineAt?: string;

  // Estado del modo offline
  isOfflineModeEnabled: boolean;
  offlineModeEnabledAt?: string;

  // Estadísticas de sincronización
  lastProductSync?: string;
  lastStockSync?: string;
  lastTokenSync?: string;

  // Contadores
  availableTokens: number;
  pendingSales: number;
  totalProducts: number;

  // Errores
  lastError?: string;
  lastErrorAt?: string;
}

// ============ CONFIGURACIÓN ============

export interface OfflineConfig {
  // Pool de tokens
  tokenPoolSize: number; // 1000 tokens
  tokenReplenishThreshold: number; // Pedir más cuando queden menos de X

  // Intervalos de sincronización (en ms)
  productSyncIntervalMs: number; // 30 minutos
  stockSyncIntervalMs: number; // 10 minutos
  healthCheckIntervalMs: number; // 30 segundos

  // Reintentos
  maxSyncRetries: number;
  retryDelayMs: number;

  // Lotes
  salesBatchSize: number; // 10 ventas por lote
  batchDelayMs: number; // 3 segundos entre lotes
}

export const DEFAULT_OFFLINE_CONFIG: OfflineConfig = {
  tokenPoolSize: 1000,
  tokenReplenishThreshold: 100,
  productSyncIntervalMs: 30 * 60 * 1000, // 30 minutos
  stockSyncIntervalMs: 10 * 60 * 1000, // 10 minutos
  healthCheckIntervalMs: 30 * 1000, // 30 segundos
  maxSyncRetries: 3,
  retryDelayMs: 5000,
  salesBatchSize: 10,
  batchDelayMs: 3000,
};

// ============ TICKET OFFLINE ============

export interface OfflineTicketData {
  ticketCode: string;
  qrUrl: string;
  qrToken: string;
  sale: OfflineSale;
  companyInfo: {
    name: string;
    ruc: string;
    address: string;
  };
  cashRegisterCode: string;
  sellerName: string;
  printedAt: string;
}
