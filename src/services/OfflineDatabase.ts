/**
 * Offline Database Service
 * SQLite database using sql.js for offline data persistence
 *
 * NOTE: sql.js is loaded dynamically at runtime to avoid Metro bundler issues
 * with import.meta which sql.js uses internally.
 */

import type {
  OfflineProduct,
  OfflineToken,
  OfflineSale,
  SyncMetadata,
  OfflineSaleStatus,
} from '@/types/offline';

// Tipos para sql.js (definidos manualmente para evitar importar el módulo)
interface SqlJsDatabase {
  run(sql: string, params?: any[]): void;
  exec(sql: string, params?: any[]): { columns: string[]; values: any[][] }[];
  prepare(sql: string): {
    run(params?: any[]): void;
    free(): void;
  };
  export(): Uint8Array;
  close(): void;
}

interface SqlJsStatic {
  Database: new (data?: ArrayLike<number>) => SqlJsDatabase;
}

// Ubicación del archivo de base de datos
const DB_NAME = 'offline-data.sqlite';

// URL del CDN para sql.js
const SQL_JS_CDN = 'https://sql.js.org/dist';

class OfflineDatabaseService {
  private db: SqlJsDatabase | null = null;
  private SQL: SqlJsStatic | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Inicializa la base de datos SQLite
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  /**
   * Carga sql.js dinámicamente desde CDN usando script tag
   * Esto evita que Metro bundler procese el módulo y falle con import.meta
   */
  private async loadSqlJs(): Promise<SqlJsStatic> {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if ((window as any).initSqlJs) {
        (window as any)
          .initSqlJs({
            locateFile: (file: string) => `${SQL_JS_CDN}/${file}`,
          })
          .then(resolve)
          .catch(reject);
        return;
      }

      // Load script dynamically
      const script = document.createElement('script');
      script.src = `${SQL_JS_CDN}/sql-wasm.js`;
      script.async = true;

      script.onload = () => {
        if ((window as any).initSqlJs) {
          (window as any)
            .initSqlJs({
              locateFile: (file: string) => `${SQL_JS_CDN}/${file}`,
            })
            .then(resolve)
            .catch(reject);
        } else {
          reject(new Error('sql.js failed to load - initSqlJs not found'));
        }
      };

      script.onerror = () => {
        reject(new Error('Failed to load sql.js script from CDN'));
      };

      document.head.appendChild(script);
    });
  }

  private async _doInitialize(): Promise<void> {
    try {
      console.log('🗄️ [OFFLINE_DB] Inicializando SQLite...');

      // Cargar sql.js dinámicamente
      this.SQL = await this.loadSqlJs();
      console.log('🗄️ [OFFLINE_DB] sql.js cargado correctamente');

      // Intentar cargar base de datos existente desde localStorage
      const savedDb = this.loadFromStorage();
      if (savedDb) {
        this.db = new this.SQL.Database(savedDb);
        console.log('🗄️ [OFFLINE_DB] Base de datos cargada desde almacenamiento');
      } else {
        this.db = new this.SQL.Database();
        console.log('🗄️ [OFFLINE_DB] Nueva base de datos creada');
      }

      // Crear tablas
      await this.createTables();

      this.isInitialized = true;
      console.log('✅ [OFFLINE_DB] SQLite inicializado correctamente');
    } catch (error) {
      console.error('❌ [OFFLINE_DB] Error inicializando SQLite:', error);
      throw error;
    }
  }

  /**
   * Crea las tablas necesarias
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Tabla de productos
    this.db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        sku TEXT,
        barcode TEXT,
        name TEXT NOT NULL,
        categoryName TEXT,
        salePriceCents INTEGER NOT NULL,
        taxType TEXT NOT NULL,
        serverStock INTEGER DEFAULT 0,
        localStock INTEGER DEFAULT 0,
        unitOfMeasure TEXT,
        codigoAfectacionIgv TEXT,
        imageUrl TEXT,
        syncId TEXT,
        updatedAt TEXT
      )
    `);

    // Índices para búsqueda rápida
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)`);

    // Tabla de tokens
    this.db.run(`
      CREATE TABLE IF NOT EXISTS tokens (
        token TEXT PRIMARY KEY,
        sequence INTEGER,
        status TEXT DEFAULT 'AVAILABLE',
        expiresAt TEXT NOT NULL,
        usedForSaleId TEXT,
        usedAt TEXT,
        createdAt TEXT
      )
    `);

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_tokens_status ON tokens(status)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_tokens_expires ON tokens(expiresAt)`);

    // Tabla de ventas offline
    this.db.run(`
      CREATE TABLE IF NOT EXISTS offline_sales (
        localId TEXT PRIMARY KEY,
        token TEXT NOT NULL,
        offlineTicketCode TEXT NOT NULL,
        items TEXT NOT NULL,
        totalCents INTEGER NOT NULL,
        subtotalCents INTEGER,
        taxCents INTEGER,
        discountCents INTEGER DEFAULT 0,
        customerId TEXT,
        customerSnapshot TEXT,
        payments TEXT NOT NULL,
        documentType TEXT NOT NULL,
        cashRegisterId TEXT NOT NULL,
        sessionId TEXT NOT NULL,
        sellerId TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        syncStatus TEXT DEFAULT 'PENDING',
        syncAttempts INTEGER DEFAULT 0,
        lastSyncAttempt TEXT,
        syncError TEXT,
        serverSaleId TEXT,
        serverDocumentNumber TEXT
      )
    `);

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_sales_status ON offline_sales(syncStatus)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_sales_token ON offline_sales(token)`);

    // Tabla de metadata de sincronización
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sync_metadata (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        syncId TEXT NOT NULL,
        syncType TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        expiresAt TEXT,
        checksum TEXT,
        totalProducts INTEGER,
        totalTokens INTEGER,
        cashRegisterId TEXT
      )
    `);

    console.log('✅ [OFFLINE_DB] Tablas creadas correctamente');
  }

  /**
   * Guarda la base de datos en localStorage
   */
  saveToStorage(): void {
    if (!this.db) return;

    try {
      const data = this.db.export();
      const base64 = this.arrayBufferToBase64(data);
      localStorage.setItem(DB_NAME, base64);
      console.log('💾 [OFFLINE_DB] Base de datos guardada en localStorage');
    } catch (error) {
      console.error('❌ [OFFLINE_DB] Error guardando en localStorage:', error);
    }
  }

  /**
   * Carga la base de datos desde localStorage
   */
  private loadFromStorage(): Uint8Array | null {
    try {
      const base64 = localStorage.getItem(DB_NAME);
      if (base64) {
        return this.base64ToArrayBuffer(base64);
      }
    } catch (error) {
      console.error('❌ [OFFLINE_DB] Error cargando desde localStorage:', error);
    }
    return null;
  }

  private arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  // ============ PRODUCTOS ============

  /**
   * Guarda o actualiza productos en la base de datos
   */
  async saveProducts(products: OfflineProduct[], syncId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO products
      (id, sku, barcode, name, categoryName, salePriceCents, taxType, serverStock, localStock, unitOfMeasure, codigoAfectacionIgv, imageUrl, syncId, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const product of products) {
      stmt.run([
        product.id,
        product.sku,
        product.barcode,
        product.name,
        product.categoryName,
        product.salePriceCents,
        product.taxType,
        product.serverStock,
        product.localStock || product.serverStock,
        product.unitOfMeasure,
        product.codigoAfectacionIgv || null,
        product.imageUrl || null,
        syncId,
        new Date().toISOString(),
      ]);
    }

    stmt.free();
    this.saveToStorage();
    console.log(`✅ [OFFLINE_DB] ${products.length} productos guardados`);
  }

  /**
   * Busca productos por código, SKU o nombre
   */
  async searchProducts(query: string, limit: number = 20): Promise<OfflineProduct[]> {
    if (!this.db) throw new Error('Database not initialized');

    const searchQuery = `%${query.toLowerCase()}%`;
    const results = this.db.exec(
      `
      SELECT * FROM products
      WHERE LOWER(name) LIKE ?
         OR LOWER(sku) LIKE ?
         OR barcode LIKE ?
      LIMIT ?
    `,
      [searchQuery, searchQuery, query, limit]
    );

    if (results.length === 0 || results[0].values.length === 0) {
      return [];
    }

    return results[0].values.map((row: any[]) => this.rowToProduct(row, results[0].columns));
  }

  /**
   * Obtiene un producto por ID
   */
  async getProductById(id: string): Promise<OfflineProduct | null> {
    if (!this.db) throw new Error('Database not initialized');

    const results = this.db.exec(`SELECT * FROM products WHERE id = ?`, [id]);

    if (results.length === 0 || results[0].values.length === 0) {
      return null;
    }

    return this.rowToProduct(results[0].values[0], results[0].columns);
  }

  /**
   * Obtiene un producto por código de barras
   */
  async getProductByBarcode(barcode: string): Promise<OfflineProduct | null> {
    if (!this.db) throw new Error('Database not initialized');

    const results = this.db.exec(`SELECT * FROM products WHERE barcode = ?`, [barcode]);

    if (results.length === 0 || results[0].values.length === 0) {
      return null;
    }

    return this.rowToProduct(results[0].values[0], results[0].columns);
  }

  /**
   * Actualiza el stock local de un producto
   */
  async updateLocalStock(productId: string, newStock: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(`UPDATE products SET localStock = ? WHERE id = ?`, [newStock, productId]);
    this.saveToStorage();
  }

  /**
   * Reduce el stock local de un producto
   */
  async decrementLocalStock(productId: string, quantity: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(`UPDATE products SET localStock = MAX(0, localStock - ?) WHERE id = ?`, [
      quantity,
      productId,
    ]);
    this.saveToStorage();
  }

  /**
   * Obtiene el total de productos
   */
  async getProductCount(): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const results = this.db.exec(`SELECT COUNT(*) as count FROM products`);
    return (results[0]?.values[0]?.[0] as number) || 0;
  }

  private rowToProduct(row: any[], columns: string[]): OfflineProduct {
    const obj: any = {};
    columns.forEach((col: string, i: number) => {
      obj[col] = row[i];
    });
    return obj as OfflineProduct;
  }

  // ============ TOKENS ============

  /**
   * Guarda tokens en la base de datos
   */
  async saveTokens(
    tokens: { token: string; sequence: number; expiresAt: string; createdAt: string }[]
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO tokens
      (token, sequence, status, expiresAt, createdAt)
      VALUES (?, ?, 'AVAILABLE', ?, ?)
    `);

    for (const token of tokens) {
      stmt.run([token.token, token.sequence, token.expiresAt, token.createdAt]);
    }

    stmt.free();
    this.saveToStorage();
    console.log(`✅ [OFFLINE_DB] ${tokens.length} tokens guardados`);
  }

  /**
   * Obtiene el siguiente token disponible
   */
  async getNextAvailableToken(): Promise<OfflineToken | null> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const results = this.db.exec(
      `
      SELECT * FROM tokens
      WHERE status = 'AVAILABLE' AND expiresAt > ?
      ORDER BY sequence ASC
      LIMIT 1
    `,
      [now]
    );

    if (results.length === 0 || results[0].values.length === 0) {
      return null;
    }

    return this.rowToToken(results[0].values[0], results[0].columns);
  }

  /**
   * Marca un token como usado
   */
  async useToken(token: string, saleId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(
      `
      UPDATE tokens
      SET status = 'USED', usedForSaleId = ?, usedAt = ?
      WHERE token = ?
    `,
      [saleId, new Date().toISOString(), token]
    );

    this.saveToStorage();
  }

  /**
   * Marca un token como pendiente de sincronización
   */
  async markTokenPendingSync(token: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(`UPDATE tokens SET status = 'PENDING_SYNC' WHERE token = ?`, [token]);
    this.saveToStorage();
  }

  /**
   * Marca un token como sincronizado
   */
  async markTokenSynced(token: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(`UPDATE tokens SET status = 'SYNCED' WHERE token = ?`, [token]);
    this.saveToStorage();
  }

  /**
   * Cuenta los tokens disponibles
   */
  async getAvailableTokenCount(): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const results = this.db.exec(
      `
      SELECT COUNT(*) as count FROM tokens
      WHERE status = 'AVAILABLE' AND expiresAt > ?
    `,
      [now]
    );

    return (results[0]?.values[0]?.[0] as number) || 0;
  }

  /**
   * Obtiene tokens usados pendientes de confirmación
   */
  async getUsedTokens(): Promise<string[]> {
    if (!this.db) throw new Error('Database not initialized');

    const results = this.db.exec(`
      SELECT token FROM tokens WHERE status IN ('USED', 'PENDING_SYNC')
    `);

    if (results.length === 0) return [];

    return results[0].values.map((row: any[]) => row[0] as string);
  }

  /**
   * Elimina tokens expirados
   */
  async cleanExpiredTokens(): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();

    // Primero contar cuántos se eliminarán
    const countResult = this.db.exec(
      `
      SELECT COUNT(*) as count FROM tokens
      WHERE status = 'AVAILABLE' AND expiresAt <= ?
    `,
      [now]
    );

    const count = (countResult[0]?.values[0]?.[0] as number) || 0;

    // Eliminar tokens expirados que no se usaron
    this.db.run(`DELETE FROM tokens WHERE status = 'AVAILABLE' AND expiresAt <= ?`, [now]);

    if (count > 0) {
      this.saveToStorage();
      console.log(`🗑️ [OFFLINE_DB] ${count} tokens expirados eliminados`);
    }

    return count;
  }

  private rowToToken(row: any[], columns: string[]): OfflineToken {
    const obj: any = {};
    columns.forEach((col: string, i: number) => {
      obj[col] = row[i];
    });
    return obj as OfflineToken;
  }

  // ============ VENTAS OFFLINE ============

  /**
   * Guarda una venta offline
   */
  async saveOfflineSale(sale: OfflineSale): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(
      `
      INSERT INTO offline_sales
      (localId, token, offlineTicketCode, items, totalCents, subtotalCents, taxCents, discountCents,
       customerId, customerSnapshot, payments, documentType, cashRegisterId, sessionId, sellerId,
       createdAt, syncStatus, syncAttempts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        sale.localId,
        sale.token,
        sale.offlineTicketCode,
        JSON.stringify(sale.items),
        sale.totalCents,
        sale.subtotalCents,
        sale.taxCents,
        sale.discountCents,
        sale.customerId || null,
        sale.customerSnapshot ? JSON.stringify(sale.customerSnapshot) : null,
        JSON.stringify(sale.payments),
        sale.documentType,
        sale.cashRegisterId,
        sale.sessionId,
        sale.sellerId,
        sale.createdAt,
        sale.syncStatus,
        sale.syncAttempts,
      ]
    );

    this.saveToStorage();
    console.log(`✅ [OFFLINE_DB] Venta offline guardada: ${sale.localId}`);
  }

  /**
   * Obtiene ventas pendientes de sincronización
   */
  async getPendingSales(limit: number = 10): Promise<OfflineSale[]> {
    if (!this.db) throw new Error('Database not initialized');

    const results = this.db.exec(
      `
      SELECT * FROM offline_sales
      WHERE syncStatus IN ('PENDING', 'FAILED')
      ORDER BY createdAt ASC
      LIMIT ?
    `,
      [limit]
    );

    if (results.length === 0 || results[0].values.length === 0) {
      return [];
    }

    return results[0].values.map((row: any[]) => this.rowToSale(row, results[0].columns));
  }

  /**
   * Cuenta ventas pendientes
   */
  async getPendingSalesCount(): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const results = this.db.exec(`
      SELECT COUNT(*) as count FROM offline_sales
      WHERE syncStatus IN ('PENDING', 'FAILED')
    `);

    return (results[0]?.values[0]?.[0] as number) || 0;
  }

  /**
   * Actualiza el estado de sincronización de una venta
   */
  async updateSaleSyncStatus(
    localId: string,
    status: OfflineSaleStatus,
    serverData?: { serverSaleId?: string; serverDocumentNumber?: string; error?: string }
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();

    if (serverData) {
      this.db.run(
        `
        UPDATE offline_sales
        SET syncStatus = ?, lastSyncAttempt = ?, syncAttempts = syncAttempts + 1,
            serverSaleId = ?, serverDocumentNumber = ?, syncError = ?
        WHERE localId = ?
      `,
        [
          status,
          now,
          serverData.serverSaleId || null,
          serverData.serverDocumentNumber || null,
          serverData.error || null,
          localId,
        ]
      );
    } else {
      this.db.run(
        `
        UPDATE offline_sales
        SET syncStatus = ?, lastSyncAttempt = ?, syncAttempts = syncAttempts + 1
        WHERE localId = ?
      `,
        [status, now, localId]
      );
    }

    this.saveToStorage();
  }

  /**
   * Obtiene una venta por ID local
   */
  async getSaleByLocalId(localId: string): Promise<OfflineSale | null> {
    if (!this.db) throw new Error('Database not initialized');

    const results = this.db.exec(`SELECT * FROM offline_sales WHERE localId = ?`, [localId]);

    if (results.length === 0 || results[0].values.length === 0) {
      return null;
    }

    return this.rowToSale(results[0].values[0], results[0].columns);
  }

  private rowToSale(row: any[], columns: string[]): OfflineSale {
    const obj: any = {};
    columns.forEach((col: string, i: number) => {
      obj[col] = row[i];
    });

    // Parsear campos JSON
    if (typeof obj.items === 'string') {
      obj.items = JSON.parse(obj.items);
    }
    if (typeof obj.payments === 'string') {
      obj.payments = JSON.parse(obj.payments);
    }
    if (typeof obj.customerSnapshot === 'string' && obj.customerSnapshot) {
      obj.customerSnapshot = JSON.parse(obj.customerSnapshot);
    }

    return obj as OfflineSale;
  }

  // ============ METADATA ============

  /**
   * Guarda metadata de sincronización
   */
  async saveSyncMetadata(metadata: SyncMetadata): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(
      `
      INSERT INTO sync_metadata
      (syncId, syncType, timestamp, expiresAt, checksum, totalProducts, totalTokens, cashRegisterId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        metadata.syncId,
        metadata.syncType,
        metadata.timestamp,
        metadata.expiresAt,
        metadata.checksum || null,
        metadata.totalProducts || null,
        metadata.totalTokens || null,
        metadata.cashRegisterId,
      ]
    );

    this.saveToStorage();
  }

  /**
   * Obtiene la última sincronización por tipo
   */
  async getLastSync(syncType: 'FULL' | 'DELTA' | 'STOCK' | 'TOKENS'): Promise<SyncMetadata | null> {
    if (!this.db) throw new Error('Database not initialized');

    const results = this.db.exec(
      `
      SELECT * FROM sync_metadata
      WHERE syncType = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `,
      [syncType]
    );

    if (results.length === 0 || results[0].values.length === 0) {
      return null;
    }

    const row = results[0].values[0];
    const columns = results[0].columns;
    const obj: any = {};
    columns.forEach((col: string, i: number) => {
      obj[col] = row[i];
    });

    return obj as SyncMetadata;
  }

  // ============ UTILIDADES ============

  /**
   * Elimina todos los productos
   */
  async clearProducts(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(`DELETE FROM products`);
    this.saveToStorage();
    console.log('🗑️ [OFFLINE_DB] Todos los productos eliminados');
  }

  /**
   * Elimina todos los tokens (excepto los usados pendientes de sync)
   */
  async clearTokens(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Eliminar solo tokens disponibles, mantener los usados para sincronización
    this.db.run(`DELETE FROM tokens WHERE status = 'AVAILABLE'`);
    this.saveToStorage();
    console.log('🗑️ [OFFLINE_DB] Tokens disponibles eliminados');
  }

  /**
   * Limpia todos los datos (para debugging o reset)
   */
  async clearAllData(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(`DELETE FROM products`);
    this.db.run(`DELETE FROM tokens`);
    this.db.run(`DELETE FROM offline_sales`);
    this.db.run(`DELETE FROM sync_metadata`);

    this.saveToStorage();
    console.log('🗑️ [OFFLINE_DB] Todos los datos eliminados');
  }

  /**
   * Verifica si la base de datos está inicializada
   */
  isReady(): boolean {
    return this.isInitialized && this.db !== null;
  }

  /**
   * Cierra la base de datos
   */
  close(): void {
    if (this.db) {
      this.saveToStorage();
      this.db.close();
      this.db = null;
      this.isInitialized = false;
      console.log('🗄️ [OFFLINE_DB] Base de datos cerrada');
    }
  }
}

export const offlineDatabase = new OfflineDatabaseService();
