"use strict";
/**
 * Offline Sync Service
 * Handles synchronization of offline data with the server
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.offlineSyncService = void 0;
const OfflineDatabase_1 = require("./OfflineDatabase");
const NetworkMonitor_1 = require("./NetworkMonitor");
const AuthService_1 = require("./AuthService");
const DeviceTokenService_1 = require("./DeviceTokenService");
const OfflineLoginService_1 = require("./OfflineLoginService");
const OfflineUsersBundleService_1 = require("./OfflineUsersBundleService");
const async_storage_1 = __importDefault(require("@react-native-async-storage/async-storage"));
const config_1 = require("@/utils/config");
const package_json_1 = __importDefault(require("../../package.json"));
class OfflineSyncService {
    constructor() {
        this.syncListeners = new Set();
        this.isSyncing = false;
        this.productSyncInterval = null;
        this.stockSyncInterval = null;
        this.reconnectUnsubscribe = null;
        this.startedForCashRegisterId = null;
        this.baseURL = config_1.config.API_URL;
        this.config = {
            tokenPoolSize: 1000,
            tokenReplenishThreshold: 100,
            productSyncIntervalMs: 30 * 60 * 1000,
            stockSyncIntervalMs: 10 * 60 * 1000,
            healthCheckIntervalMs: 30 * 1000,
            maxSyncRetries: 3,
            retryDelayMs: 5000,
            salesBatchSize: 10,
            batchDelayMs: 3000,
        };
        // Inyectar el cliente HTTP en el servicio de bundle para reusar headers/auth.
        OfflineUsersBundleService_1.offlineUsersBundleService.setRequestFn((endpoint, options, cashRegisterId) => this.request(endpoint, options, cashRegisterId));
    }
    /**
     * Inicia el servicio de sincronización.
     * Idempotente: llamadas repetidas con el mismo cashRegisterId son no-op;
     * con un id distinto reinicia listeners e intervals para evitar duplicados.
     */
    async start(cashRegisterId) {
        if (this.startedForCashRegisterId === cashRegisterId) {
            console.log('🔄 [SYNC] Ya iniciado para esta caja, omitiendo re-inicialización');
            return;
        }
        if (this.startedForCashRegisterId && this.startedForCashRegisterId !== cashRegisterId) {
            console.log('🔄 [SYNC] Reiniciando para nueva caja, deteniendo recursos previos...');
            this.stop();
        }
        console.log('🔄 [SYNC] Iniciando servicio de sincronización...');
        // Suscribirse a reconexiones (guardando el unsubscribe para limpiarlo en stop)
        this.reconnectUnsubscribe = NetworkMonitor_1.networkMonitor.onReconnect(async () => {
            console.log('🔄 [SYNC] Reconexión detectada, iniciando sincronización...');
            await this.syncOnReconnect(cashRegisterId);
        });
        // Iniciar sincronización periódica
        this.startPeriodicSync(cashRegisterId);
        this.startedForCashRegisterId = cashRegisterId;
        console.log('✅ [SYNC] Servicio de sincronización iniciado');
    }
    /**
     * Garantiza que la BD local esté inicializada antes de cualquier operación.
     * Idempotente: offlineDatabase.initialize() cachea el initPromise.
     */
    async ensureDb() {
        await OfflineDatabase_1.offlineDatabase.initialize();
    }
    /**
     * Detiene el servicio de sincronización
     */
    stop() {
        if (this.productSyncInterval) {
            clearInterval(this.productSyncInterval);
            this.productSyncInterval = null;
        }
        if (this.stockSyncInterval) {
            clearInterval(this.stockSyncInterval);
            this.stockSyncInterval = null;
        }
        if (this.reconnectUnsubscribe) {
            try {
                this.reconnectUnsubscribe();
            }
            catch {
                /* ignore */
            }
            this.reconnectUnsubscribe = null;
        }
        this.startedForCashRegisterId = null;
        console.log('🛑 [SYNC] Servicio de sincronización detenido');
    }
    /**
     * Sincronización inicial completa
     */
    async performInitialSync(cashRegisterId) {
        this.emit('sync:start', { type: 'initial' });
        try {
            await this.ensureDb();
            const resolvedCashRegisterId = await this.resolveCashRegisterId(cashRegisterId);
            // 1. Descargar catálogo completo
            console.log('📦 [SYNC] Descargando catálogo de productos...');
            await this.syncProducts(resolvedCashRegisterId, 'full');
            // 2. Verificar/reponer tokens hasta llegar a 1000
            console.log('🎫 [SYNC] Verificando pool de tokens...');
            await this.ensureTokenPool(resolvedCashRegisterId);
            // 3. Descargar bundle de usuarios para login offline (si está aprovisionado)
            await this.syncUsersBundle(resolvedCashRegisterId);
            // NOTA: Las ventas pendientes se sincronizan MANUALMENTE desde configuración
            const pendingCount = await OfflineDatabase_1.offlineDatabase.getPendingSalesCount();
            if (pendingCount > 0) {
                console.log(`📋 [SYNC] Hay ${pendingCount} ventas pendientes (sincronizar manualmente)`);
            }
            this.emit('sync:complete', { type: 'initial' });
            console.log('✅ [SYNC] Sincronización inicial completada');
        }
        catch (error) {
            this.emit('sync:error', { type: 'initial', error });
            console.error('❌ [SYNC] Error en sincronización inicial:', error);
            throw error;
        }
    }
    /**
     * Sincronización al reconectar
     */
    async syncOnReconnect(cashRegisterId) {
        if (this.isSyncing) {
            console.log('⏳ [SYNC] Ya hay una sincronización en progreso');
            return;
        }
        this.isSyncing = true;
        this.emit('sync:start', { type: 'reconnect' });
        try {
            await this.ensureDb();
            const resolvedCashRegisterId = await this.resolveCashRegisterId(cashRegisterId);
            // NOTA: Las ventas pendientes se sincronizan MANUALMENTE desde configuración
            const pendingCount = await OfflineDatabase_1.offlineDatabase.getPendingSalesCount();
            if (pendingCount > 0) {
                console.log(`📋 [SYNC] Hay ${pendingCount} ventas pendientes (sincronizar manualmente)`);
            }
            // 1. Reponer tokens hasta 1000
            console.log('🎫 [SYNC] Reponiendo tokens...');
            await this.ensureTokenPool(resolvedCashRegisterId);
            // 2. Actualizar catálogo (delta)
            console.log('📦 [SYNC] Actualizando catálogo...');
            await this.syncProducts(resolvedCashRegisterId, 'delta');
            // 3. Refrescar bundle de usuarios (TTL 24h, nextRefreshMs ~4h)
            await this.syncUsersBundle(resolvedCashRegisterId);
            // 4. Subir eventos de login offline acumulados
            await this.syncLoginEvents(resolvedCashRegisterId);
            this.emit('sync:complete', { type: 'reconnect' });
            console.log('✅ [SYNC] Sincronización post-reconexión completada');
        }
        catch (error) {
            this.emit('sync:error', { type: 'reconnect', error });
            console.error('❌ [SYNC] Error en sincronización post-reconexión:', error);
        }
        finally {
            this.isSyncing = false;
        }
    }
    /**
     * Sincroniza productos (completo o delta)
     */
    async syncProducts(cashRegisterId, mode = 'delta') {
        this.emit('products:sync:start', { mode });
        try {
            await this.ensureDb();
            const resolvedCashRegisterId = await this.resolveCashRegisterId(cashRegisterId);
            let endpoint = `/pos/offline-catalog/${resolvedCashRegisterId}`;
            if (mode === 'delta') {
                const lastSync = (await OfflineDatabase_1.offlineDatabase.getLastSync('DELTA')) ||
                    (await OfflineDatabase_1.offlineDatabase.getLastSync('FULL'));
                if (lastSync?.timestamp) {
                    endpoint += `/delta?since=${encodeURIComponent(lastSync.timestamp)}`;
                }
                else {
                    // Si no hay sync previo, hacer full
                    mode = 'full';
                }
            }
            console.log(`📡 [SYNC] Llamando a endpoint: ${endpoint}`);
            let response;
            try {
                response = await this.request(endpoint, {}, resolvedCashRegisterId);
                console.log('📥 [SYNC] Respuesta recibida:', JSON.stringify(response, null, 2).slice(0, 500));
            }
            catch (apiError) {
                console.error('❌ [SYNC] Error llamando API:', apiError);
                const errMsg = apiError instanceof Error ? apiError.message : 'Error desconocido';
                if (errMsg.toLowerCase().includes('invalid input syntax for type uuid')) {
                    throw new Error(`Error de identificación: el backend recibió un ID inválido (se esperaba UUID). ${errMsg}`);
                }
                console.log('⚠️ [SYNC] El endpoint de catálogo offline no está disponible en el backend');
                console.log('ℹ️ [SYNC] Se requiere implementar: GET /pos/offline-catalog/:cashRegisterId');
                throw new Error(`API no disponible: ${errMsg}`);
            }
            // Validar respuesta
            if (!response) {
                console.error('❌ [SYNC] Respuesta vacía del servidor');
                throw new Error('Respuesta vacía del servidor');
            }
            if (!response.products) {
                console.error('❌ [SYNC] Respuesta sin productos:', response);
                throw new Error('La respuesta no contiene productos');
            }
            if (!response.syncMetadata) {
                console.error('❌ [SYNC] Respuesta sin syncMetadata:', response);
                throw new Error('La respuesta no contiene metadata de sincronización');
            }
            console.log(`📦 [SYNC] Procesando ${response.products.length} productos...`);
            // Guardar companyInfo si viene en la respuesta
            if (response.companyInfo) {
                localStorage.setItem('@offline:company_info', JSON.stringify(response.companyInfo));
                console.log(`🏢 [SYNC] Información de empresa guardada: ${response.companyInfo.razonSocial}`);
            }
            // Mapear productos al formato local con validación
            // El backend envía "title" en lugar de "name" y "availableStock" en lugar de "serverStock"
            const products = response.products.map((p, index) => {
                // Obtener nombre del producto (puede venir como "title" o "name")
                const productName = p.title || p.name;
                // Obtener stock (puede venir como "availableStock" o "serverStock")
                const stock = p.availableStock ?? p.serverStock ?? 0;
                // Normalizar taxType a mayúsculas para consistencia interna
                const rawTaxType = p.taxType || 'gravado';
                const normalizedTaxType = rawTaxType.toUpperCase();
                // Validar campos requeridos
                if (!p.id) {
                    console.warn(`⚠️ [SYNC] Producto ${index} sin ID, saltando...`);
                }
                if (!productName) {
                    console.warn(`⚠️ [SYNC] Producto ${index} (${p.id}) sin nombre`);
                }
                return {
                    id: p.id || `temp-${index}`,
                    sku: p.sku || null,
                    barcode: p.barcode || null,
                    name: productName || 'Sin nombre',
                    categoryName: p.categoryName || null,
                    salePriceCents: p.salePriceCents || 0,
                    taxType: normalizedTaxType,
                    serverStock: stock,
                    localStock: p.localStock ?? stock,
                    unitOfMeasure: p.unitOfMeasure || null,
                    codigoAfectacionIgv: p.codigoAfectacionIgv || null,
                    imageUrl: p.imageUrl || null,
                    syncId: response.syncMetadata.syncId,
                    updatedAt: new Date().toISOString(),
                };
            });
            // Guardar productos
            console.log(`💾 [SYNC] Guardando ${products.length} productos en BD local...`);
            await OfflineDatabase_1.offlineDatabase.saveProducts(products, response.syncMetadata.syncId);
            // Si vienen tokens, guardarlos
            const tokens = response.tokenPool?.tokens;
            if (tokens && tokens.length > 0) {
                console.log(`🎫 [SYNC] Guardando ${tokens.length} tokens...`);
                await OfflineDatabase_1.offlineDatabase.saveTokens(tokens);
            }
            // Guardar metadata
            console.log('📝 [SYNC] Guardando metadata de sincronización...');
            const defaultExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            await OfflineDatabase_1.offlineDatabase.saveSyncMetadata({
                syncId: response.syncMetadata.syncId,
                syncType: mode === 'full' ? 'FULL' : 'DELTA',
                timestamp: response.syncMetadata.syncTimestamp || new Date().toISOString(),
                expiresAt: response.syncMetadata.expiresAt || defaultExpiry,
                checksum: response.syncMetadata.checksum || undefined,
                totalProducts: response.syncMetadata.totalProducts || products.length,
                cashRegisterId: resolvedCashRegisterId,
            });
            this.emit('products:sync:complete', { mode, count: products.length });
            console.log(`✅ [SYNC] ${products.length} productos sincronizados (${mode})`);
        }
        catch (error) {
            this.emit('products:sync:error', { mode, error });
            console.error('❌ [SYNC] Error en syncProducts:', error);
            throw error;
        }
    }
    /**
     * Sincroniza solo actualizaciones de stock
     */
    async syncStock(cashRegisterId) {
        this.emit('stock:sync:start');
        try {
            await this.ensureDb();
            const resolvedCashRegisterId = await this.resolveCashRegisterId(cashRegisterId);
            const lastSync = await OfflineDatabase_1.offlineDatabase.getLastSync('STOCK');
            const since = lastSync?.timestamp || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const response = await this.request(`/pos/stock-updates/${resolvedCashRegisterId}?since=${since}`, {}, resolvedCashRegisterId);
            // Actualizar stock en productos
            for (const update of response.updates) {
                await OfflineDatabase_1.offlineDatabase.updateLocalStock(update.productId, update.stock);
            }
            // Guardar metadata
            await OfflineDatabase_1.offlineDatabase.saveSyncMetadata({
                syncId: `stock-${Date.now()}`,
                syncType: 'STOCK',
                timestamp: response.timestamp,
                expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                cashRegisterId: resolvedCashRegisterId,
            });
            this.emit('stock:sync:complete', { count: response.updates.length });
            console.log(`✅ [SYNC] ${response.updates.length} actualizaciones de stock aplicadas`);
        }
        catch (error) {
            this.emit('stock:sync:error', { error });
            console.error('❌ [SYNC] Error sincronizando stock:', error);
        }
    }
    /**
     * Asegura que haya 1000 tokens disponibles
     */
    async ensureTokenPool(cashRegisterId) {
        await this.ensureDb();
        const resolvedCashRegisterId = await this.resolveCashRegisterId(cashRegisterId);
        const currentCount = await OfflineDatabase_1.offlineDatabase.getAvailableTokenCount();
        const needed = this.config.tokenPoolSize - currentCount;
        if (needed <= 0) {
            console.log(`✅ [SYNC] Pool de tokens completo: ${currentCount}/${this.config.tokenPoolSize}`);
            return;
        }
        console.log(`🎫 [SYNC] Solicitando ${needed} tokens adicionales...`);
        this.emit('tokens:replenish:start', { needed });
        try {
            const usedTokens = await OfflineDatabase_1.offlineDatabase.getUsedTokens();
            const response = await this.request(`/pos/offline-catalog/${resolvedCashRegisterId}/replenish-tokens`, {
                method: 'POST',
                body: JSON.stringify({
                    requestCount: needed,
                    usedTokens,
                }),
            }, resolvedCashRegisterId);
            // Guardar nuevos tokens
            await OfflineDatabase_1.offlineDatabase.saveTokens(response.newTokens);
            // Marcar tokens confirmados como sincronizados
            for (const token of response.confirmedUsedTokens) {
                await OfflineDatabase_1.offlineDatabase.markTokenSynced(token);
            }
            const newCount = await OfflineDatabase_1.offlineDatabase.getAvailableTokenCount();
            this.emit('tokens:replenish:complete', { count: response.newTokens.length, total: newCount });
            console.log(`✅ [SYNC] ${response.newTokens.length} tokens agregados. Total: ${newCount}`);
        }
        catch (error) {
            this.emit('tokens:replenish:error', { error });
            console.error('❌ [SYNC] Error reponiendo tokens:', error);
            throw error;
        }
    }
    /**
     * Descarga (o refresca) el bundle cifrado de usuarios para login offline.
     * 403 = feature off o caja no aprovisionada -> deshabilitar login offline silenciosamente.
     * Ver POS_OFFLINE.MD seccion 4.2.
     */
    async syncUsersBundle(cashRegisterId) {
        await this.ensureDb();
        const resolvedCashRegisterId = await this.resolveCashRegisterId(cashRegisterId);
        if (!(await DeviceTokenService_1.deviceTokenService.isProvisioned())) {
            console.log('ℹ️ [SYNC] Caja no aprovisionada (sin deviceToken); se omite bundle de usuarios');
            return;
        }
        this.emit('users-bundle:sync:start');
        const result = await OfflineUsersBundleService_1.offlineUsersBundleService.downloadBundle(resolvedCashRegisterId);
        if (result.ok) {
            this.emit('users-bundle:sync:complete', {
                bundleId: result.bundle.bundleId,
                userCount: result.bundle.userCount,
                expiresAt: result.bundle.expiresAt,
            });
        }
        else {
            this.emit('users-bundle:sync:skipped', { reason: result.reason });
        }
    }
    /**
     * Envia los eventos de login offline pendientes al backend (idempotente).
     * Ver POS_OFFLINE.MD seccion 7.1.
     */
    async syncLoginEvents(cashRegisterId) {
        await this.ensureDb();
        const resolvedCashRegisterId = await this.resolveCashRegisterId(cashRegisterId);
        const pending = await OfflineDatabase_1.offlineDatabase.getPendingLoginEvents();
        if (pending.length === 0)
            return;
        if (!(await DeviceTokenService_1.deviceTokenService.isProvisioned())) {
            console.log('ℹ️ [SYNC] Sin deviceToken; no se pueden enviar login-events');
            return;
        }
        this.emit('login-events:sync:start', { count: pending.length });
        try {
            const body = {
                events: pending.map((e) => ({
                    userId: e.userId,
                    bundleId: e.bundleId,
                    occurredAt: e.occurredAt,
                    method: e.method,
                    success: e.success,
                    ...(e.failureReason ? { failureReason: e.failureReason } : {}),
                })),
            };
            await this.request(`/pos/offline-catalog/${resolvedCashRegisterId}/users/login-events`, { method: 'POST', body: JSON.stringify(body) }, resolvedCashRegisterId);
            await OfflineDatabase_1.offlineDatabase.markLoginEventsSynced(pending.map((e) => e.id));
            await OfflineDatabase_1.offlineDatabase.deleteSyncedLoginEvents();
            this.emit('login-events:sync:complete', { count: pending.length });
            console.log(`✅ [SYNC] ${pending.length} eventos de login sincronizados`);
        }
        catch (error) {
            this.emit('login-events:sync:error', { error });
            console.error('❌ [SYNC] Error sincronizando eventos de login:', error);
        }
    }
    /**
     * Sincroniza ventas pendientes con control de avalancha
     */
    async syncPendingSales(cashRegisterId) {
        await this.ensureDb();
        const resolvedCashRegisterId = await this.resolveCashRegisterId(cashRegisterId);
        const pendingSales = await OfflineDatabase_1.offlineDatabase.getPendingSales();
        if (pendingSales.length === 0) {
            console.log('✅ [SYNC] No hay ventas pendientes');
            return;
        }
        this.emit('sales:sync:start', { count: pendingSales.length });
        try {
            // Obtener el sessionId de la primera venta pendiente
            const firstSaleSessionId = pendingSales[0].sessionId;
            console.log(`🔍 [SYNC] SessionId de primera venta: "${firstSaleSessionId}"`);
            const oldestSaleTimestamp = pendingSales.reduce((oldest, sale) => (!oldest || sale.createdAt < oldest ? sale.createdAt : oldest), '');
            // 1. Registrarse en la cola
            console.log('📝 [SYNC] Registrándose en cola de sincronización...');
            const registration = await this.request('/pos/sync/register', {
                method: 'POST',
                body: JSON.stringify({
                    cashRegisterId: resolvedCashRegisterId,
                    sessionId: firstSaleSessionId,
                    pendingSalesCount: pendingSales.length,
                    oldestSaleTimestamp,
                    clientInfo: this.getClientInfo(),
                }),
            }, resolvedCashRegisterId);
            console.log(`📊 [SYNC] Posición en cola: ${registration.queuePosition ?? 0}`);
            this.emit('sales:sync:queued', { position: registration.queuePosition });
            // 2. Esperar turno (polling). Si register ya devolvió READY + syncToken, saltarse el poll.
            let status;
            if (registration.status === 'READY' && registration.syncToken) {
                status = {
                    status: 'READY',
                    syncToken: registration.syncToken,
                    expiresAt: registration.tokenExpiresAt,
                };
                console.log('⚡ [SYNC] Turno libre desde register; se omite polling');
            }
            else {
                do {
                    await this.delay(registration.pollIntervalMs);
                    status = await this.request(`/pos/sync/status/${registration.registrationId}`, {}, resolvedCashRegisterId);
                    if (status.status === 'QUEUED') {
                        console.log(`⏳ [SYNC] Esperando turno... Posición: ${status.position}`);
                        this.emit('sales:sync:waiting', { position: status.position });
                    }
                } while (status.status === 'QUEUED');
            }
            if (status.status === 'EXPIRED') {
                throw new Error('Sesión de sincronización expirada');
            }
            if (!status.syncToken) {
                throw new Error(`Backend no devolvió syncToken (status=${status.status}); no se puede subir el batch`);
            }
            // 3. Enviar ventas en lotes
            console.log('📤 [SYNC] Turno asignado, enviando ventas...');
            let syncedCount = 0;
            for (let i = 0; i < pendingSales.length; i += this.config.salesBatchSize) {
                const batch = pendingSales.slice(i, i + this.config.salesBatchSize);
                const batchId = crypto.randomUUID();
                // Log de debug para ver los sessionIds de las ventas
                console.log('🔍 [SYNC] Ventas en batch:', batch.map((s) => ({
                    localId: s.localId,
                    sessionId: s.sessionId,
                    cashRegisterId: s.cashRegisterId,
                })));
                // Marcar como sincronizando
                for (const sale of batch) {
                    await OfflineDatabase_1.offlineDatabase.updateSaleSyncStatus(sale.localId, 'SYNCING');
                }
                let nextBatchAllowedAt;
                try {
                    // Obtener sessionId del primer elemento del batch
                    const batchSessionId = batch[0].sessionId;
                    console.log(`📋 [SYNC] Enviando batch con sessionId: "${batchSessionId}" (tipo: ${typeof batchSessionId})`);
                    const response = await this.request('/pos/sync/sales', {
                        method: 'POST',
                        headers: {
                            'X-Sync-Token': status.syncToken,
                        },
                        body: JSON.stringify({
                            cashRegisterId: resolvedCashRegisterId,
                            sessionId: batchSessionId,
                            batchId,
                            sales: batch.map((s) => this.toSyncSalePayload(s)),
                        }),
                    }, resolvedCashRegisterId);
                    nextBatchAllowedAt = response.nextBatchAllowedAt;
                    console.log(`📥 [SYNC] Respuesta batch (${response.results?.length ?? 0} results):`, response.results?.map((r) => ({
                        localId: r.localId,
                        status: r.status,
                        errorCode: r.errorCode,
                        error: r.error,
                        serverSaleId: r.serverSaleId,
                    })));
                    // Actualizar estado de cada venta
                    for (const result of response.results) {
                        if (result.status === 'QUEUED') {
                            await OfflineDatabase_1.offlineDatabase.updateSaleSyncStatus(result.localId, 'SYNCED', {
                                serverSaleId: result.serverSaleId,
                                serverDocumentNumber: result.serverDocumentNumber,
                            });
                            syncedCount++;
                        }
                        else if (result.errorCode === 'TOKEN_ALREADY_USED') {
                            // Idempotencia: la venta ya estaba procesada en el backend
                            console.log(`ℹ️ [SYNC] Venta ${result.localId} ya estaba sincronizada (TOKEN_ALREADY_USED)`);
                            await OfflineDatabase_1.offlineDatabase.updateSaleSyncStatus(result.localId, 'SYNCED');
                            syncedCount++;
                        }
                        else {
                            await OfflineDatabase_1.offlineDatabase.updateSaleSyncStatus(result.localId, 'FAILED', {
                                error: result.error || result.errorCode || 'Venta rechazada',
                            });
                        }
                    }
                    this.emit('sales:sync:progress', {
                        synced: syncedCount,
                        total: pendingSales.length,
                    });
                }
                catch (error) {
                    // Marcar lote como fallido
                    for (const sale of batch) {
                        await OfflineDatabase_1.offlineDatabase.updateSaleSyncStatus(sale.localId, 'FAILED', {
                            error: error instanceof Error ? error.message : 'Error desconocido',
                        });
                    }
                }
                // Esperar antes del siguiente lote, respetando nextBatchAllowedAt
                if (i + this.config.salesBatchSize < pendingSales.length) {
                    const waitMs = this.computeBatchWaitMs(nextBatchAllowedAt);
                    await this.delay(waitMs);
                }
            }
            // 4. Completar sincronización
            await this.request('/pos/sync/complete', {
                method: 'POST',
                body: JSON.stringify({ registrationId: registration.registrationId }),
            }, resolvedCashRegisterId);
            this.emit('sales:sync:complete', { synced: syncedCount, total: pendingSales.length });
            console.log(`✅ [SYNC] ${syncedCount}/${pendingSales.length} ventas sincronizadas`);
        }
        catch (error) {
            this.emit('sales:sync:error', { error });
            console.error('❌ [SYNC] Error sincronizando ventas:', error);
            throw error;
        }
    }
    /**
     * Suscribe a eventos de sincronización
     */
    subscribe(callback) {
        this.syncListeners.add(callback);
        return () => this.syncListeners.delete(callback);
    }
    // ============ PRIVADOS ============
    startPeriodicSync(cashRegisterId) {
        // Limpiar intervals previos si ya existían (defensa adicional ante doble inicio)
        if (this.productSyncInterval) {
            clearInterval(this.productSyncInterval);
            this.productSyncInterval = null;
        }
        if (this.stockSyncInterval) {
            clearInterval(this.stockSyncInterval);
            this.stockSyncInterval = null;
        }
        // Sincronización de productos cada 30 minutos
        this.productSyncInterval = setInterval(async () => {
            if (NetworkMonitor_1.networkMonitor.getStatus()) {
                try {
                    const resolvedCashRegisterId = await this.resolveCashRegisterId(cashRegisterId);
                    await this.syncProducts(resolvedCashRegisterId, 'delta');
                }
                catch (error) {
                    console.error('❌ [SYNC] Error en sincronización periódica de productos:', error);
                }
            }
        }, this.config.productSyncIntervalMs);
        // Sincronización de stock cada 10 minutos
        this.stockSyncInterval = setInterval(async () => {
            if (NetworkMonitor_1.networkMonitor.getStatus()) {
                try {
                    const resolvedCashRegisterId = await this.resolveCashRegisterId(cashRegisterId);
                    await this.syncStock(resolvedCashRegisterId);
                }
                catch (error) {
                    console.error('❌ [SYNC] Error en sincronización periódica de stock:', error);
                }
            }
        }, this.config.stockSyncIntervalMs);
    }
    async request(endpoint, options = {}, cashRegisterId) {
        const token = AuthService_1.authService.getAccessToken();
        const currentCompany = AuthService_1.authService.getCurrentCompany();
        const currentSite = AuthService_1.authService.getCurrentSite();
        let resolvedCashRegisterId;
        if (cashRegisterId) {
            resolvedCashRegisterId = await this.resolveCashRegisterId(cashRegisterId);
        }
        const headers = {
            'Content-Type': 'application/json',
            'x-app-id': config_1.config.APP_ID,
            ...options.headers,
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        if (currentCompany?.id) {
            if (this.isUUID(currentCompany.id)) {
                headers['x-company-id'] = currentCompany.id;
            }
            else {
                console.warn(`⚠️ [SYNC] x-company-id inválido omitido: "${currentCompany.id}"`);
            }
        }
        if (currentSite?.id) {
            if (this.isUUID(currentSite.id)) {
                headers['x-site-id'] = currentSite.id;
            }
            else {
                console.warn(`⚠️ [SYNC] x-site-id inválido omitido: "${currentSite.id}"`);
            }
        }
        // Header requerido por el CashRegisterAuthGuard del backend
        if (resolvedCashRegisterId) {
            headers['X-Cash-Register-Id'] = resolvedCashRegisterId;
        }
        // X-Device-Token: requerido en /pos/* (validez 1 año, identifica la caja).
        // X-Offline-Session: JWT HS256 firmado por el frontend tras login offline.
        // Ver POS_OFFLINE.MD seccion 3.
        if (endpoint.startsWith('/pos/')) {
            const deviceToken = await DeviceTokenService_1.deviceTokenService.get();
            if (deviceToken && !headers['X-Device-Token']) {
                headers['X-Device-Token'] = deviceToken;
            }
            const offlineJwt = OfflineLoginService_1.offlineLoginService.getCurrentJwt();
            if (offlineJwt && !headers['X-Offline-Session']) {
                headers['X-Offline-Session'] = offlineJwt;
            }
        }
        // Solo presencia (boolean) de headers de auth: nunca loguear los valores (son secretos).
        const authPresence = {
            hasAuthorization: !!headers['Authorization'],
            hasDeviceToken: !!headers['X-Device-Token'],
            hasOfflineSession: !!headers['X-Offline-Session'],
            hasSyncToken: !!headers['X-Sync-Token'],
        };
        console.log('📡 [SYNC][request] Request debug:', {
            endpoint,
            cashRegisterIdOriginal: cashRegisterId,
            cashRegisterIdResolved: resolvedCashRegisterId,
            headerCashRegisterId: headers['X-Cash-Register-Id'],
            headerCompanyId: headers['x-company-id'] || null,
            headerSiteId: headers['x-site-id'] || null,
            authPresence,
        });
        const response = await fetch(`${this.baseURL}${endpoint}`, {
            ...options,
            headers,
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const backendMessage = errorData.message || `HTTP error! status: ${response.status}`;
            if (backendMessage.includes('invalid input syntax for type uuid')) {
                throw new Error(`${backendMessage} | headers_debug=${JSON.stringify({
                    appId: headers['x-app-id'] || null,
                    companyId: headers['x-company-id'] || null,
                    siteId: headers['x-site-id'] || null,
                    cashRegisterId: headers['X-Cash-Register-Id'] || null,
                })}`);
            }
            if (response.status === 401 || response.status === 403) {
                throw new Error(`HTTP ${response.status} en ${endpoint}: ${backendMessage} | auth_presence=${JSON.stringify(authPresence)}`);
            }
            throw new Error(backendMessage);
        }
        return response.json();
    }
    emit(event, data) {
        this.syncListeners.forEach((callback) => {
            try {
                callback(event, data);
            }
            catch (error) {
                console.error('❌ [SYNC] Error en listener:', error);
            }
        });
    }
    isUUID(value) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(value);
    }
    async resolveCashRegisterId(cashRegisterId) {
        if (this.isUUID(cashRegisterId)) {
            return cashRegisterId;
        }
        console.warn(`⚠️ [SYNC] cashRegisterId inválido para backend offline: "${cashRegisterId}". Intentando resolver UUID...`);
        const session = await this.getStoredSession();
        const sessionCashRegisterId = session?.cashRegisterId;
        if (sessionCashRegisterId && this.isUUID(sessionCashRegisterId)) {
            console.log(`✅ [SYNC] UUID de caja resuelto desde sesión activa: ${sessionCashRegisterId}`);
            return sessionCashRegisterId;
        }
        const selectedCashRegister = await this.getSelectedCashRegisterFromStorage();
        const candidateId = selectedCashRegister?.id;
        if (candidateId && this.isUUID(candidateId)) {
            console.log(`✅ [SYNC] UUID de caja resuelto desde caja seleccionada: ${candidateId}`);
            return candidateId;
        }
        throw new Error(`Cash register ID inválido para sincronización offline: "${cashRegisterId}". Se esperaba UUID.`);
    }
    async getStoredSession() {
        try {
            const sessionData = await async_storage_1.default.getItem('@pos_current_session');
            if (!sessionData) {
                return null;
            }
            return JSON.parse(sessionData);
        }
        catch (error) {
            console.warn('⚠️ [SYNC] No se pudo leer sesión almacenada para resolver cashRegisterId:', error);
            return null;
        }
    }
    async getSelectedCashRegisterFromStorage() {
        try {
            const registerData = await async_storage_1.default.getItem(config_1.config.STORAGE_KEYS.SELECTED_CASH_REGISTER);
            if (!registerData) {
                return null;
            }
            return JSON.parse(registerData);
        }
        catch (error) {
            console.warn('⚠️ [SYNC] No se pudo leer caja seleccionada desde storage:', error);
            return null;
        }
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    /**
     * Calcula la espera entre lotes respetando nextBatchAllowedAt del backend
     */
    computeBatchWaitMs(nextBatchAllowedAt) {
        const minWait = this.config.batchDelayMs;
        if (!nextBatchAllowedAt)
            return minWait;
        const serverWait = new Date(nextBatchAllowedAt).getTime() - Date.now();
        if (Number.isNaN(serverWait))
            return minWait;
        return Math.max(minWait, serverWait);
    }
    /**
     * Mapea una venta local al shape que espera /pos/sync/sales (sin campos internos)
     */
    toSyncSalePayload(sale) {
        return {
            localId: sale.localId,
            token: sale.token,
            offlineTicketCode: sale.offlineTicketCode,
            items: sale.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPriceCents: item.unitPriceCents,
                discountCents: item.discountCents,
                productSnapshot: {
                    sku: item.productCode,
                    title: item.productName,
                },
            })),
            totalCents: sale.totalCents,
            subtotalCents: sale.subtotalCents,
            taxCents: sale.taxCents,
            discountCents: sale.discountCents,
            customerDocumentType: sale.customerDocumentType,
            customerDocumentNumber: sale.customerDocumentNumber,
            customerSnapshot: sale.customerSnapshot
                ? {
                    fullName: sale.customerSnapshot.name,
                    documentType: sale.customerSnapshot.documentType,
                    documentNumber: sale.customerSnapshot.documentNumber,
                }
                : undefined,
            payments: sale.payments.map((p) => ({
                paymentMethodId: p.paymentMethodId,
                amountCents: p.amountCents,
            })),
            documentType: sale.documentType,
            createdAt: sale.createdAt,
            sellerId: sale.sellerId,
        };
    }
    /**
     * Información del cliente que viaja en /pos/sync/register
     */
    getClientInfo() {
        const ua = typeof navigator !== 'undefined' && navigator.userAgent
            ? navigator.userAgent
            : `POS/${package_json_1.default.version}`;
        return {
            userAgent: ua,
            appVersion: package_json_1.default.version,
        };
    }
}
exports.offlineSyncService = new OfflineSyncService();
