"use strict";
/**
 * Offline System Types
 * Types for the offline contingency system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_OFFLINE_CONFIG = void 0;
exports.DEFAULT_OFFLINE_CONFIG = {
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
