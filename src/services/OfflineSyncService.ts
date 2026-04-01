/**
 * Offline Sync Service
 * Handles synchronization of offline data with the server
 */

import { offlineDatabase } from './OfflineDatabase';
import { networkMonitor } from './NetworkMonitor';
import { config } from '@/utils/config';
import { authService } from './AuthService';
import type {
  OfflineProduct,
  OfflineCatalogResponse,
  StockUpdateResponse,
  TokenReplenishResponse,
  SyncRegistrationResponse,
  SyncStatusResponse,
  SyncSalesResponse,
} from '@/types/offline';
import { DEFAULT_OFFLINE_CONFIG } from '@/types/offline';

type SyncCallback = (event: string, data?: any) => void;

class OfflineSyncService {
  private baseURL: string;
  private syncListeners: Set<SyncCallback> = new Set();
  private isSyncing: boolean = false;
  private productSyncInterval: NodeJS.Timeout | null = null;
  private stockSyncInterval: NodeJS.Timeout | null = null;
  private config: typeof DEFAULT_OFFLINE_CONFIG;

  constructor() {
    this.baseURL = config.API_URL;
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
  }

  /**
   * Inicia el servicio de sincronización
   */
  async start(cashRegisterId: string): Promise<void> {
    console.log('🔄 [SYNC] Iniciando servicio de sincronización...');

    // Suscribirse a reconexiones
    networkMonitor.onReconnect(async () => {
      console.log('🔄 [SYNC] Reconexión detectada, iniciando sincronización...');
      await this.syncOnReconnect(cashRegisterId);
    });

    // Iniciar sincronización periódica
    this.startPeriodicSync(cashRegisterId);

    console.log('✅ [SYNC] Servicio de sincronización iniciado');
  }

  /**
   * Detiene el servicio de sincronización
   */
  stop(): void {
    if (this.productSyncInterval) {
      clearInterval(this.productSyncInterval);
      this.productSyncInterval = null;
    }
    if (this.stockSyncInterval) {
      clearInterval(this.stockSyncInterval);
      this.stockSyncInterval = null;
    }
    console.log('🛑 [SYNC] Servicio de sincronización detenido');
  }

  /**
   * Sincronización inicial completa
   */
  async performInitialSync(cashRegisterId: string): Promise<void> {
    this.emit('sync:start', { type: 'initial' });

    try {
      // 1. Descargar catálogo completo
      console.log('📦 [SYNC] Descargando catálogo de productos...');
      await this.syncProducts(cashRegisterId, 'full');

      // 2. Verificar/reponer tokens hasta llegar a 1000
      console.log('🎫 [SYNC] Verificando pool de tokens...');
      await this.ensureTokenPool(cashRegisterId);

      // NOTA: Las ventas pendientes se sincronizan MANUALMENTE desde configuración
      const pendingCount = await offlineDatabase.getPendingSalesCount();
      if (pendingCount > 0) {
        console.log(`📋 [SYNC] Hay ${pendingCount} ventas pendientes (sincronizar manualmente)`);
      }

      this.emit('sync:complete', { type: 'initial' });
      console.log('✅ [SYNC] Sincronización inicial completada');
    } catch (error) {
      this.emit('sync:error', { type: 'initial', error });
      console.error('❌ [SYNC] Error en sincronización inicial:', error);
      throw error;
    }
  }

  /**
   * Sincronización al reconectar
   */
  async syncOnReconnect(cashRegisterId: string): Promise<void> {
    if (this.isSyncing) {
      console.log('⏳ [SYNC] Ya hay una sincronización en progreso');
      return;
    }

    this.isSyncing = true;
    this.emit('sync:start', { type: 'reconnect' });

    try {
      // NOTA: Las ventas pendientes se sincronizan MANUALMENTE desde configuración
      const pendingCount = await offlineDatabase.getPendingSalesCount();
      if (pendingCount > 0) {
        console.log(`📋 [SYNC] Hay ${pendingCount} ventas pendientes (sincronizar manualmente)`);
      }

      // 1. Reponer tokens hasta 1000
      console.log('🎫 [SYNC] Reponiendo tokens...');
      await this.ensureTokenPool(cashRegisterId);

      // 2. Actualizar catálogo (delta)
      console.log('📦 [SYNC] Actualizando catálogo...');
      await this.syncProducts(cashRegisterId, 'delta');

      this.emit('sync:complete', { type: 'reconnect' });
      console.log('✅ [SYNC] Sincronización post-reconexión completada');
    } catch (error) {
      this.emit('sync:error', { type: 'reconnect', error });
      console.error('❌ [SYNC] Error en sincronización post-reconexión:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sincroniza productos (completo o delta)
   */
  async syncProducts(cashRegisterId: string, mode: 'full' | 'delta' = 'delta'): Promise<void> {
    this.emit('products:sync:start', { mode });

    try {
      let endpoint = `/pos/offline-catalog/${cashRegisterId}`;

      if (mode === 'delta') {
        const lastSync = await offlineDatabase.getLastSync('FULL');
        if (lastSync) {
          endpoint += `/delta?since=${lastSync.syncId}`;
        } else {
          // Si no hay sync previo, hacer full
          mode = 'full';
        }
      }

      console.log(`📡 [SYNC] Llamando a endpoint: ${endpoint}`);
      let response: OfflineCatalogResponse;

      try {
        response = await this.request<OfflineCatalogResponse>(endpoint);
        console.log(
          '📥 [SYNC] Respuesta recibida:',
          JSON.stringify(response, null, 2).slice(0, 500)
        );
      } catch (apiError) {
        console.error('❌ [SYNC] Error llamando API:', apiError);
        console.log('⚠️ [SYNC] El endpoint de catálogo offline no está disponible en el backend');
        console.log('ℹ️ [SYNC] Se requiere implementar: GET /pos/offline-catalog/:cashRegisterId');
        const errMsg = apiError instanceof Error ? apiError.message : 'Error desconocido';
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
        console.log(
          `🏢 [SYNC] Información de empresa guardada: ${response.companyInfo.razonSocial}`
        );
      }

      // Mapear productos al formato local con validación
      // El backend envía "title" en lugar de "name" y "availableStock" en lugar de "serverStock"
      const products: OfflineProduct[] = response.products.map((p: any, index) => {
        // Obtener nombre del producto (puede venir como "title" o "name")
        const productName = p.title || p.name;
        // Obtener stock (puede venir como "availableStock" o "serverStock")
        const stock = p.availableStock ?? p.serverStock ?? 0;
        // Normalizar taxType a mayúsculas para consistencia interna
        const rawTaxType = p.taxType || 'gravado';
        const normalizedTaxType = rawTaxType.toUpperCase() as 'GRAVADO' | 'EXONERADO' | 'INAFECTO';

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
      await offlineDatabase.saveProducts(products, response.syncMetadata.syncId);

      // Si vienen tokens, guardarlos
      if (response.tokenPool?.tokens?.length > 0) {
        console.log(`🎫 [SYNC] Guardando ${response.tokenPool.tokens.length} tokens...`);
        await offlineDatabase.saveTokens(response.tokenPool.tokens);
      }

      // Guardar metadata
      console.log('📝 [SYNC] Guardando metadata de sincronización...');
      const defaultExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await offlineDatabase.saveSyncMetadata({
        syncId: response.syncMetadata.syncId,
        syncType: mode === 'full' ? 'FULL' : 'DELTA',
        timestamp: response.syncMetadata.syncTimestamp || new Date().toISOString(),
        expiresAt: response.syncMetadata.expiresAt || defaultExpiry,
        checksum: response.syncMetadata.checksum || null,
        totalProducts: response.syncMetadata.totalProducts || products.length,
        cashRegisterId,
      });

      this.emit('products:sync:complete', { mode, count: products.length });
      console.log(`✅ [SYNC] ${products.length} productos sincronizados (${mode})`);
    } catch (error) {
      this.emit('products:sync:error', { mode, error });
      console.error('❌ [SYNC] Error en syncProducts:', error);
      throw error;
    }
  }

  /**
   * Sincroniza solo actualizaciones de stock
   */
  async syncStock(cashRegisterId: string): Promise<void> {
    this.emit('stock:sync:start');

    try {
      const lastSync = await offlineDatabase.getLastSync('STOCK');
      const since = lastSync?.timestamp || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const response = await this.request<StockUpdateResponse>(
        `/pos/stock-updates/${cashRegisterId}?since=${since}`
      );

      // Actualizar stock en productos
      for (const update of response.updates) {
        await offlineDatabase.updateLocalStock(update.productId, update.stock);
      }

      // Guardar metadata
      await offlineDatabase.saveSyncMetadata({
        syncId: `stock-${Date.now()}`,
        syncType: 'STOCK',
        timestamp: response.timestamp,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        cashRegisterId,
      });

      this.emit('stock:sync:complete', { count: response.updates.length });
      console.log(`✅ [SYNC] ${response.updates.length} actualizaciones de stock aplicadas`);
    } catch (error) {
      this.emit('stock:sync:error', { error });
      console.error('❌ [SYNC] Error sincronizando stock:', error);
    }
  }

  /**
   * Asegura que haya 1000 tokens disponibles
   */
  async ensureTokenPool(cashRegisterId: string): Promise<void> {
    const currentCount = await offlineDatabase.getAvailableTokenCount();
    const needed = this.config.tokenPoolSize - currentCount;

    if (needed <= 0) {
      console.log(
        `✅ [SYNC] Pool de tokens completo: ${currentCount}/${this.config.tokenPoolSize}`
      );
      return;
    }

    console.log(`🎫 [SYNC] Solicitando ${needed} tokens adicionales...`);
    this.emit('tokens:replenish:start', { needed });

    try {
      const usedTokens = await offlineDatabase.getUsedTokens();

      const response = await this.request<TokenReplenishResponse>(
        `/pos/offline-catalog/${cashRegisterId}/replenish-tokens`,
        {
          method: 'POST',
          body: JSON.stringify({
            requestedCount: needed,
            usedTokens,
          }),
        }
      );

      // Guardar nuevos tokens
      await offlineDatabase.saveTokens(response.newTokens);

      // Marcar tokens confirmados como sincronizados
      for (const token of response.confirmedUsedTokens) {
        await offlineDatabase.markTokenSynced(token);
      }

      const newCount = await offlineDatabase.getAvailableTokenCount();
      this.emit('tokens:replenish:complete', { count: response.newTokens.length, total: newCount });
      console.log(`✅ [SYNC] ${response.newTokens.length} tokens agregados. Total: ${newCount}`);
    } catch (error) {
      this.emit('tokens:replenish:error', { error });
      console.error('❌ [SYNC] Error reponiendo tokens:', error);
      throw error;
    }
  }

  /**
   * Sincroniza ventas pendientes con control de avalancha
   */
  async syncPendingSales(cashRegisterId: string): Promise<void> {
    const pendingSales = await offlineDatabase.getPendingSales();
    if (pendingSales.length === 0) {
      console.log('✅ [SYNC] No hay ventas pendientes');
      return;
    }

    this.emit('sales:sync:start', { count: pendingSales.length });

    try {
      // 1. Registrarse en la cola
      console.log('📝 [SYNC] Registrándose en cola de sincronización...');
      const registration = await this.request<SyncRegistrationResponse>('/pos/sync/register', {
        method: 'POST',
        body: JSON.stringify({
          cashRegisterId,
          pendingSalesCount: pendingSales.length,
        }),
      });

      console.log(`📊 [SYNC] Posición en cola: ${registration.queuePosition}`);
      this.emit('sales:sync:queued', { position: registration.queuePosition });

      // 2. Esperar turno (polling)
      let status: SyncStatusResponse;
      do {
        await this.delay(registration.pollIntervalMs);
        status = await this.request<SyncStatusResponse>(
          `/pos/sync/status/${registration.registrationId}`
        );

        if (status.status === 'QUEUED') {
          console.log(`⏳ [SYNC] Esperando turno... Posición: ${status.position}`);
          this.emit('sales:sync:waiting', { position: status.position });
        }
      } while (status.status === 'QUEUED');

      if (status.status === 'EXPIRED') {
        throw new Error('Sesión de sincronización expirada');
      }

      // 3. Enviar ventas en lotes
      console.log('📤 [SYNC] Turno asignado, enviando ventas...');
      let syncedCount = 0;

      for (let i = 0; i < pendingSales.length; i += this.config.salesBatchSize) {
        const batch = pendingSales.slice(i, i + this.config.salesBatchSize);
        const batchId = `batch-${Date.now()}-${i}`;

        // Marcar como sincronizando
        for (const sale of batch) {
          await offlineDatabase.updateSaleSyncStatus(sale.localId, 'SYNCING');
        }

        try {
          const response = await this.request<SyncSalesResponse>('/pos/sync/sales', {
            method: 'POST',
            headers: {
              'X-Sync-Token': status.syncToken!,
            },
            body: JSON.stringify({
              cashRegisterId,
              sessionId: batch[0].sessionId,
              batchId,
              syncToken: status.syncToken,
              sales: batch,
            }),
          });

          // Actualizar estado de cada venta
          for (const result of response.results) {
            if (result.status === 'QUEUED') {
              await offlineDatabase.updateSaleSyncStatus(result.localId, 'SYNCED', {
                serverSaleId: result.serverSaleId,
                serverDocumentNumber: result.serverDocumentNumber,
              });
              syncedCount++;
            } else {
              await offlineDatabase.updateSaleSyncStatus(result.localId, 'FAILED', {
                error: result.error,
              });
            }
          }

          this.emit('sales:sync:progress', {
            synced: syncedCount,
            total: pendingSales.length,
          });

          // Esperar antes del siguiente lote
          if (i + this.config.salesBatchSize < pendingSales.length) {
            await this.delay(this.config.batchDelayMs);
          }
        } catch (error) {
          // Marcar lote como fallido
          for (const sale of batch) {
            await offlineDatabase.updateSaleSyncStatus(sale.localId, 'FAILED', {
              error: error instanceof Error ? error.message : 'Error desconocido',
            });
          }
        }
      }

      // 4. Completar sincronización
      await this.request('/pos/sync/complete', {
        method: 'POST',
        body: JSON.stringify({ registrationId: registration.registrationId }),
      });

      this.emit('sales:sync:complete', { synced: syncedCount, total: pendingSales.length });
      console.log(`✅ [SYNC] ${syncedCount}/${pendingSales.length} ventas sincronizadas`);
    } catch (error) {
      this.emit('sales:sync:error', { error });
      console.error('❌ [SYNC] Error sincronizando ventas:', error);
      throw error;
    }
  }

  /**
   * Suscribe a eventos de sincronización
   */
  subscribe(callback: SyncCallback): () => void {
    this.syncListeners.add(callback);
    return () => this.syncListeners.delete(callback);
  }

  // ============ PRIVADOS ============

  private startPeriodicSync(cashRegisterId: string): void {
    // Sincronización de productos cada 30 minutos
    this.productSyncInterval = setInterval(async () => {
      if (networkMonitor.getStatus()) {
        try {
          await this.syncProducts(cashRegisterId, 'delta');
        } catch (error) {
          console.error('❌ [SYNC] Error en sincronización periódica de productos:', error);
        }
      }
    }, this.config.productSyncIntervalMs);

    // Sincronización de stock cada 10 minutos
    this.stockSyncInterval = setInterval(async () => {
      if (networkMonitor.getStatus()) {
        try {
          await this.syncStock(cashRegisterId);
        } catch (error) {
          console.error('❌ [SYNC] Error en sincronización periódica de stock:', error);
        }
      }
    }, this.config.stockSyncIntervalMs);
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = authService.getAccessToken();
    const currentCompany = authService.getCurrentCompany();
    const currentSite = authService.getCurrentSite();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-app-id': config.APP_ID,
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (currentCompany) {
      headers['x-company-id'] = currentCompany.id;
    }

    if (currentSite) {
      headers['x-site-id'] = currentSite.id;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  private emit(event: string, data?: any): void {
    this.syncListeners.forEach((callback) => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('❌ [SYNC] Error en listener:', error);
      }
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const offlineSyncService = new OfflineSyncService();
