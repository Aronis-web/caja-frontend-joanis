"use strict";
/**
 * Offline Store
 * Manages offline mode state using Zustand
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.useOfflineStore = void 0;
const zustand_1 = require("zustand");
const OfflineDatabase_1 = require("@/services/OfflineDatabase");
const OfflineSyncService_1 = require("@/services/OfflineSyncService");
const NetworkMonitor_1 = require("@/services/NetworkMonitor");
const DeviceTokenService_1 = require("@/services/DeviceTokenService");
const OfflineLoginService_1 = require("@/services/OfflineLoginService");
const auth_1 = require("@/store/auth");
// Generar ID único para ventas locales
const generateLocalSaleId = () => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `LOCAL-${timestamp}-${random}`.toUpperCase();
};
// Generar código de ticket offline
const generateOfflineTicketCode = (cashRegisterCode) => {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const cajaCode = cashRegisterCode.slice(-3).padStart(3, '0');
    // Obtener secuencial del día desde localStorage
    const seqKey = `offline_seq_${dateStr}_${cajaCode}`;
    const seq = parseInt(localStorage.getItem(seqKey) || '0', 10) + 1;
    localStorage.setItem(seqKey, seq.toString());
    const seqStr = seq.toString().padStart(4, '0');
    return `OFF-${dateStr}-${cajaCode}-${seqStr}`;
};
let offlineActivationTimer = null;
exports.useOfflineStore = (0, zustand_1.create)((set, get) => ({
    // Estado inicial
    connectionStatus: 'ONLINE',
    isOfflineModeEnabled: false,
    availableTokens: 0,
    pendingSales: 0,
    totalProducts: 0,
    config: {
        tokenPoolSize: 1000,
        tokenReplenishThreshold: 100,
        productSyncIntervalMs: 30 * 60 * 1000,
        stockSyncIntervalMs: 10 * 60 * 1000,
        healthCheckIntervalMs: 30 * 1000,
        maxSyncRetries: 3,
        retryDelayMs: 5000,
        salesBatchSize: 10,
        batchDelayMs: 3000,
    },
    isInitializing: false,
    isInitialized: false,
    // Período de gracia: 1 minuto (60000 ms)
    disconnectedSince: null,
    gracePeriodMs: 60 * 1000,
    // ============ CONEXIÓN ============
    setConnectionStatus: (status) => {
        const currentStatus = get().connectionStatus;
        const wasOfflineModeEnabled = get().isOfflineModeEnabled;
        if (currentStatus !== status) {
            console.log(`🌐 [OFFLINE_STORE] Conexión: ${currentStatus} → ${status}`);
            const updates = { connectionStatus: status };
            if (status === 'ONLINE') {
                updates.lastOnlineAt = new Date().toISOString();
                updates.disconnectedSince = null; // Resetear período de gracia
                if (offlineActivationTimer) {
                    clearTimeout(offlineActivationTimer);
                    offlineActivationTimer = null;
                }
                // Si estábamos en modo offline y volvimos online, deshabilitar modo offline
                if (wasOfflineModeEnabled) {
                    console.log('🔄 [OFFLINE_STORE] Conexión restaurada, deshabilitando modo offline');
                    updates.isOfflineModeEnabled = false;
                }
            }
            else if (status === 'OFFLINE') {
                updates.lastOfflineAt = new Date().toISOString();
                // Solo establecer disconnectedSince y programar activación automática una vez
                if (!get().disconnectedSince) {
                    updates.disconnectedSince = new Date().toISOString();
                    console.log('⏱️ [OFFLINE_STORE] Iniciando período de gracia de 1 minuto...');
                    if (offlineActivationTimer) {
                        clearTimeout(offlineActivationTimer);
                    }
                    const gracePeriodMs = get().gracePeriodMs;
                    offlineActivationTimer = setTimeout(async () => {
                        offlineActivationTimer = null;
                        const state = get();
                        if (state.connectionStatus === 'OFFLINE' && !state.isOfflineModeEnabled) {
                            console.log('⚡ [OFFLINE_STORE] Activando modo offline automáticamente');
                            await state.enableOfflineMode();
                        }
                    }, gracePeriodMs);
                }
            }
            set(updates);
        }
    },
    isGracePeriodOver: () => {
        const { disconnectedSince, gracePeriodMs, connectionStatus } = get();
        // Si está online, no hay período de gracia
        if (connectionStatus === 'ONLINE') {
            return false;
        }
        // Si no hay timestamp de desconexión, no ha pasado el período
        if (!disconnectedSince) {
            return false;
        }
        const disconnectedTime = new Date(disconnectedSince).getTime();
        const elapsed = Date.now() - disconnectedTime;
        return elapsed >= gracePeriodMs;
    },
    checkConnection: async () => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch('/api/health', {
                method: 'HEAD',
                cache: 'no-cache',
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (response.ok) {
                get().setConnectionStatus('ONLINE');
                return true;
            }
        }
        catch (error) {
            // Sin conexión
        }
        get().setConnectionStatus('OFFLINE');
        return false;
    },
    // ============ MODO OFFLINE ============
    enableOfflineMode: async () => {
        // TODO: MODO PRUEBAS - Restricciones deshabilitadas temporalmente
        // const state = get();
        // // Verificar que no haya conexión
        // if (state.connectionStatus === 'ONLINE') {
        //   console.warn('⚠️ [OFFLINE_STORE] No se puede activar modo offline con conexión activa');
        //   return false;
        // }
        // // Verificar que haya tokens disponibles
        // if (state.availableTokens <= 0) {
        //   console.warn('⚠️ [OFFLINE_STORE] No hay tokens disponibles para modo offline');
        //   return false;
        // }
        // // Verificar que haya productos
        // if (state.totalProducts <= 0) {
        //   console.warn('⚠️ [OFFLINE_STORE] No hay productos sincronizados para modo offline');
        //   return false;
        // }
        console.log('✅ [OFFLINE_STORE] Modo offline activado (MODO PRUEBAS)');
        set({
            isOfflineModeEnabled: true,
            offlineModeEnabledAt: new Date().toISOString(),
        });
        return true;
    },
    disableOfflineMode: () => {
        console.log('🔄 [OFFLINE_STORE] Modo offline desactivado');
        set({ isOfflineModeEnabled: false });
    },
    canEnableOfflineMode: () => {
        // TODO: MODO PRUEBAS - Siempre permitir activar modo offline
        return true;
        // const state = get();
        // return (
        //   state.connectionStatus !== 'ONLINE' &&
        //   state.availableTokens > 0 &&
        //   state.totalProducts > 0 &&
        //   state.isInitialized
        // );
    },
    // ============ PRODUCTOS ============
    searchProductsOffline: async (query, limit = 20) => {
        if (!OfflineDatabase_1.offlineDatabase.isReady()) {
            console.warn('⚠️ [OFFLINE_STORE] Base de datos no inicializada');
            return [];
        }
        try {
            return await OfflineDatabase_1.offlineDatabase.searchProducts(query, limit);
        }
        catch (error) {
            console.error('❌ [OFFLINE_STORE] Error buscando productos:', error);
            return [];
        }
    },
    getProductByBarcode: async (barcode) => {
        if (!OfflineDatabase_1.offlineDatabase.isReady()) {
            return null;
        }
        try {
            return await OfflineDatabase_1.offlineDatabase.getProductByBarcode(barcode);
        }
        catch (error) {
            console.error('❌ [OFFLINE_STORE] Error obteniendo producto por barcode:', error);
            return null;
        }
    },
    // ============ TOKENS ============
    getNextToken: async () => {
        if (!OfflineDatabase_1.offlineDatabase.isReady()) {
            console.warn('⚠️ [OFFLINE_STORE] Base de datos no inicializada');
            return null;
        }
        try {
            const token = await OfflineDatabase_1.offlineDatabase.getNextAvailableToken();
            if (token) {
                // Actualizar contador
                await get().refreshTokenCount();
                return token.token;
            }
            return null;
        }
        catch (error) {
            console.error('❌ [OFFLINE_STORE] Error obteniendo token:', error);
            return null;
        }
    },
    refreshTokenCount: async () => {
        if (!OfflineDatabase_1.offlineDatabase.isReady())
            return;
        try {
            const count = await OfflineDatabase_1.offlineDatabase.getAvailableTokenCount();
            set({ availableTokens: count });
        }
        catch (error) {
            console.error('❌ [OFFLINE_STORE] Error actualizando contador de tokens:', error);
        }
    },
    // ============ VENTAS OFFLINE ============
    createOfflineSale: async (params) => {
        if (!OfflineDatabase_1.offlineDatabase.isReady()) {
            throw new Error('Base de datos offline no inicializada');
        }
        // Resolver identidad de caja/sesión/vendedor.
        // En sesión online activa los params traen todo. En sesión offline pura
        // (sin selección de caja ni turno abierto) derivamos del deviceToken
        // y del usuario autenticado; la venta queda pendingReassignment.
        let cashRegisterId = params.cashRegisterId;
        let cashRegisterCode = params.cashRegisterCode;
        let sellerId = params.sellerId;
        const sessionId = params.sessionId;
        if (!cashRegisterId || !cashRegisterCode) {
            // 1) Pareja persistida en el device (mismo origen que usa loginOffline).
            const provisioned = await DeviceTokenService_1.deviceTokenService.getProvisionedCashRegister().catch(() => null);
            if (provisioned?.id && provisioned?.code) {
                cashRegisterId = cashRegisterId || provisioned.id;
                cashRegisterCode = cashRegisterCode || provisioned.code;
            }
        }
        if (!cashRegisterId || !cashRegisterCode) {
            // 2) Claims del JWT offline emitido al loguear (contiene cashRegisterId/Code).
            const offlinePayload = OfflineLoginService_1.offlineLoginService.getCurrentSession()?.payload;
            if (offlinePayload?.cashRegisterId && offlinePayload?.cashRegisterCode) {
                cashRegisterId = cashRegisterId || offlinePayload.cashRegisterId;
                cashRegisterCode = cashRegisterCode || offlinePayload.cashRegisterCode;
            }
        }
        if (!cashRegisterId || !cashRegisterCode) {
            // 3) Best effort: claims del deviceToken (si el backend los incluye).
            const claims = await DeviceTokenService_1.deviceTokenService.getClaims().catch(() => null);
            if (claims?.cashRegisterId && claims?.cashRegisterCode) {
                cashRegisterId = cashRegisterId || claims.cashRegisterId;
                cashRegisterCode = cashRegisterCode || claims.cashRegisterCode;
            }
        }
        if (!sellerId) {
            sellerId = auth_1.useAuthStore.getState().user?.id;
        }
        if (!cashRegisterId || !cashRegisterCode) {
            throw new Error('Caja no provisionada: no se puede crear venta offline');
        }
        if (!sellerId) {
            throw new Error('No hay usuario autenticado para registrar la venta');
        }
        const pendingReassignment = !sessionId;
        // Obtener token
        const token = await OfflineDatabase_1.offlineDatabase.getNextAvailableToken();
        if (!token) {
            throw new Error('No hay tokens disponibles para ventas offline');
        }
        // Calcular totales
        const subtotalCents = params.items.reduce((sum, item) => {
            const itemTotal = item.quantity * item.unitPriceCents - item.discountCents;
            const taxRate = item.taxRate || 0;
            return sum + (taxRate > 0 ? Math.round(itemTotal / (1 + taxRate / 100)) : itemTotal);
        }, 0);
        const taxCents = params.items.reduce((sum, item) => {
            const itemTotal = item.quantity * item.unitPriceCents - item.discountCents;
            const taxRate = item.taxRate || 0;
            return sum + (taxRate > 0 ? itemTotal - Math.round(itemTotal / (1 + taxRate / 100)) : 0);
        }, 0);
        const totalCents = params.items.reduce((sum, item) => {
            return sum + (item.quantity * item.unitPriceCents - item.discountCents);
        }, 0);
        const discountCents = params.items.reduce((sum, item) => sum + item.discountCents, 0);
        // Generar IDs
        const localId = generateLocalSaleId();
        const offlineTicketCode = generateOfflineTicketCode(cashRegisterCode);
        // Crear objeto de venta
        const sale = {
            localId,
            token: token.token,
            offlineTicketCode,
            items: params.items,
            totalCents,
            subtotalCents,
            taxCents,
            discountCents,
            customerId: params.customerId,
            customerDocumentType: params.customerDocumentType,
            customerDocumentNumber: params.customerDocumentNumber,
            customerSnapshot: params.customerSnapshot,
            payments: params.payments,
            documentType: params.documentType,
            cashRegisterId,
            cashRegisterCode,
            sessionId: sessionId || null,
            sellerId,
            createdAt: new Date().toISOString(),
            syncStatus: 'PENDING',
            syncAttempts: 0,
            pendingReassignment,
        };
        // Guardar venta
        await OfflineDatabase_1.offlineDatabase.saveOfflineSale(sale);
        // Marcar token como usado
        await OfflineDatabase_1.offlineDatabase.useToken(token.token, localId);
        // Actualizar stock local de productos
        for (const item of params.items) {
            await OfflineDatabase_1.offlineDatabase.decrementLocalStock(item.productId, item.quantity);
        }
        // Actualizar contadores
        await get().refreshTokenCount();
        await get().refreshPendingSalesCount();
        console.log(`✅ [OFFLINE_STORE] Venta offline creada: ${offlineTicketCode}${pendingReassignment ? ' (pendiente de reasignar caja/sesión)' : ''}`);
        return sale;
    },
    reassignPendingSales: async ({ cashRegisterId, sessionId, sellerId, cashRegisterCode }) => {
        if (!OfflineDatabase_1.offlineDatabase.isReady())
            return 0;
        try {
            const count = await OfflineDatabase_1.offlineDatabase.reassignPendingSales(cashRegisterId, sessionId, sellerId, cashRegisterCode);
            if (count > 0) {
                await get().refreshPendingSalesCount();
            }
            return count;
        }
        catch (error) {
            console.error('❌ [OFFLINE_STORE] Error reasignando ventas pendientes:', error);
            return 0;
        }
    },
    refreshPendingSalesCount: async () => {
        if (!OfflineDatabase_1.offlineDatabase.isReady())
            return;
        try {
            const count = await OfflineDatabase_1.offlineDatabase.getPendingSalesCount();
            set({ pendingSales: count });
        }
        catch (error) {
            console.error('❌ [OFFLINE_STORE] Error actualizando contador de ventas:', error);
        }
    },
    // ============ SINCRONIZACIÓN ============
    syncProducts: async (products, syncId) => {
        if (!OfflineDatabase_1.offlineDatabase.isReady()) {
            throw new Error('Base de datos offline no inicializada');
        }
        await OfflineDatabase_1.offlineDatabase.saveProducts(products, syncId);
        // Actualizar metadata
        await OfflineDatabase_1.offlineDatabase.saveSyncMetadata({
            syncId,
            syncType: 'FULL',
            timestamp: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas
            totalProducts: products.length,
            cashRegisterId: '',
        });
        // Actualizar contador
        const count = await OfflineDatabase_1.offlineDatabase.getProductCount();
        set({
            totalProducts: count,
            lastProductSync: new Date().toISOString(),
        });
    },
    syncTokens: async (tokens) => {
        if (!OfflineDatabase_1.offlineDatabase.isReady()) {
            throw new Error('Base de datos offline no inicializada');
        }
        await OfflineDatabase_1.offlineDatabase.saveTokens(tokens);
        // Actualizar contador
        await get().refreshTokenCount();
        set({ lastTokenSync: new Date().toISOString() });
    },
    // ============ INICIALIZACIÓN ============
    initialize: async () => {
        if (get().isInitialized || get().isInitializing)
            return;
        set({ isInitializing: true });
        try {
            console.log('🔄 [OFFLINE_STORE] Inicializando sistema offline...');
            // Inicializar base de datos
            await OfflineDatabase_1.offlineDatabase.initialize();
            // Limpiar tokens expirados
            await OfflineDatabase_1.offlineDatabase.cleanExpiredTokens();
            // Cargar estadísticas
            await get().refreshStats();
            set({ isInitialized: true, isInitializing: false });
            console.log('✅ [OFFLINE_STORE] Sistema offline inicializado');
            // Si hay conexión y la base de datos está vacía, realizar sincronización inicial
            const stats = get();
            if (NetworkMonitor_1.networkMonitor.getStatus() && stats.totalProducts === 0 && stats.availableTokens === 0) {
                console.log('📦 [OFFLINE_STORE] Base de datos vacía, iniciando descarga inicial...');
                // Intentar obtener cashRegisterId del localStorage o usar uno por defecto
                const cashRegisterStr = localStorage.getItem('@caja:selected_cash_register');
                if (cashRegisterStr) {
                    try {
                        const registerData = JSON.parse(cashRegisterStr);
                        const registerId = registerData.id || registerData;
                        console.log(`🔄 [OFFLINE_STORE] Descargando catálogo para caja: ${registerData.code || registerId}`);
                        console.log(`📋 [OFFLINE_STORE] Cash Register ID: ${registerId}`);
                        await OfflineSyncService_1.offlineSyncService.performInitialSync(registerId);
                        // Actualizar estadísticas después de la sincronización
                        await get().refreshStats();
                        console.log('✅ [OFFLINE_STORE] Descarga inicial completada');
                    }
                    catch (error) {
                        // No fallar la inicialización por errores de sincronización
                        console.error('❌ [OFFLINE_STORE] Error en descarga inicial:', error);
                        console.log('⚠️ [OFFLINE_STORE] El sistema offline funcionará sin datos pre-cargados');
                        console.log('ℹ️ [OFFLINE_STORE] La sincronización se reintentará cuando haya conexión');
                        // Guardar el error pero continuar
                        set({
                            lastError: error instanceof Error ? error.message : 'Error en sincronización inicial',
                            lastErrorAt: new Date().toISOString(),
                        });
                    }
                }
                else {
                    console.log('⚠️ [OFFLINE_STORE] No se encontró caja registradora, se omite descarga inicial');
                }
            }
            else if (stats.totalProducts > 0 || stats.availableTokens > 0) {
                console.log(`ℹ️ [OFFLINE_STORE] Datos existentes: ${stats.totalProducts} productos, ${stats.availableTokens} tokens`);
            }
        }
        catch (error) {
            console.error('❌ [OFFLINE_STORE] Error inicializando sistema offline:', error);
            set({
                isInitializing: false,
                lastError: error instanceof Error ? error.message : 'Error desconocido',
                lastErrorAt: new Date().toISOString(),
            });
        }
    },
    refreshStats: async () => {
        if (!OfflineDatabase_1.offlineDatabase.isReady())
            return;
        try {
            const [tokenCount, productCount, pendingSalesCount] = await Promise.all([
                OfflineDatabase_1.offlineDatabase.getAvailableTokenCount(),
                OfflineDatabase_1.offlineDatabase.getProductCount(),
                OfflineDatabase_1.offlineDatabase.getPendingSalesCount(),
            ]);
            set({
                availableTokens: tokenCount,
                totalProducts: productCount,
                pendingSales: pendingSalesCount,
            });
        }
        catch (error) {
            console.error('❌ [OFFLINE_STORE] Error actualizando estadísticas:', error);
        }
    },
}));
