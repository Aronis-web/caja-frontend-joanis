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
import type {
  EncryptedUsersBundle,
  OfflineLoginEvent,
  OfflineLoginMethod,
} from '@/types/offlineAuth';

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
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private savePending = false;
  private readonly SAVE_DEBOUNCE_MS = 750;

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

      // Garantizar que cualquier escritura pendiente se persista al salir
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('beforeunload', () => {
          if (this.savePending || this.saveTimeout) {
            if (this.saveTimeout) {
              clearTimeout(this.saveTimeout);
              this.saveTimeout = null;
            }
            this.savePending = false;
            this.flushToStorageSync();
          }
        });
      }

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

    // Migración: agregar columna codigoAfectacionIgv si no existe
    try {
      this.db.run(`ALTER TABLE products ADD COLUMN codigoAfectacionIgv TEXT`);
      console.log('🔄 [OFFLINE_DB] Columna codigoAfectacionIgv agregada');
    } catch (e) {
      // La columna ya existe, ignorar el error
    }

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
        cashRegisterCode TEXT,
        sessionId TEXT,
        sellerId TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        syncStatus TEXT DEFAULT 'PENDING',
        syncAttempts INTEGER DEFAULT 0,
        lastSyncAttempt TEXT,
        syncError TEXT,
        serverSaleId TEXT,
        serverDocumentNumber TEXT,
        pendingReassignment INTEGER DEFAULT 0
      )
    `);

    // Migración: agregar pendingReassignment / cashRegisterCode si no existen
    try {
      this.db.run(`ALTER TABLE offline_sales ADD COLUMN pendingReassignment INTEGER DEFAULT 0`);
      console.log('🔄 [OFFLINE_DB] Columna pendingReassignment agregada');
    } catch (e) {
      // ya existe
    }
    try {
      this.db.run(`ALTER TABLE offline_sales ADD COLUMN cashRegisterCode TEXT`);
      console.log('🔄 [OFFLINE_DB] Columna cashRegisterCode agregada');
    } catch (e) {
      // ya existe
    }

    // Migración: convertir sessionId a NULLABLE si la tabla existente lo definió NOT NULL
    try {
      const info = this.db.exec(`PRAGMA table_info(offline_sales)`);
      const rows = info[0]?.values || [];
      const sessionIdCol = rows.find((row: any[]) => row[1] === 'sessionId');
      const sessionIdNotNull = sessionIdCol ? sessionIdCol[3] === 1 : false;
      if (sessionIdNotNull) {
        console.log('🔄 [OFFLINE_DB] Migrando offline_sales: sessionId NULLABLE...');
        this.db.run(`ALTER TABLE offline_sales RENAME TO offline_sales_old`);
        this.db.run(`
          CREATE TABLE offline_sales (
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
            cashRegisterCode TEXT,
            sessionId TEXT,
            sellerId TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            syncStatus TEXT DEFAULT 'PENDING',
            syncAttempts INTEGER DEFAULT 0,
            lastSyncAttempt TEXT,
            syncError TEXT,
            serverSaleId TEXT,
            serverDocumentNumber TEXT,
            pendingReassignment INTEGER DEFAULT 0
          )
        `);
        this.db.run(`
          INSERT INTO offline_sales
          (localId, token, offlineTicketCode, items, totalCents, subtotalCents, taxCents, discountCents,
           customerId, customerSnapshot, payments, documentType, cashRegisterId, cashRegisterCode,
           sessionId, sellerId, createdAt, syncStatus, syncAttempts, lastSyncAttempt, syncError,
           serverSaleId, serverDocumentNumber, pendingReassignment)
          SELECT
            localId, token, offlineTicketCode, items, totalCents, subtotalCents, taxCents, discountCents,
            customerId, customerSnapshot, payments, documentType, cashRegisterId, cashRegisterCode,
            sessionId, sellerId, createdAt, syncStatus, syncAttempts, lastSyncAttempt, syncError,
            serverSaleId, serverDocumentNumber, pendingReassignment
          FROM offline_sales_old
        `);
        this.db.run(`DROP TABLE offline_sales_old`);
        console.log('✅ [OFFLINE_DB] Migración offline_sales completada');
      }
    } catch (e) {
      console.warn('⚠️ [OFFLINE_DB] No se pudo migrar offline_sales:', e);
    }

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_sales_status ON offline_sales(syncStatus)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_sales_token ON offline_sales(token)`);
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_sales_pending_reassign ON offline_sales(pendingReassignment)`
    );

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

    // Tabla del bundle de usuarios cifrado (solo 1 registro vigente por cashRegisterId)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users_bundle (
        cashRegisterId TEXT PRIMARY KEY,
        bundleId TEXT NOT NULL,
        alg TEXT NOT NULL,
        iv TEXT NOT NULL,
        authTag TEXT NOT NULL,
        ciphertext TEXT NOT NULL,
        checksum TEXT NOT NULL,
        keyVersion INTEGER NOT NULL,
        salt TEXT NOT NULL,
        info TEXT NOT NULL,
        userCount INTEGER NOT NULL,
        generatedAt TEXT NOT NULL,
        expiresAt TEXT NOT NULL,
        nextRefreshMs INTEGER NOT NULL,
        storedAt TEXT NOT NULL
      )
    `);

    // Tabla de eventos de login offline (cola para sincronizar al volver online)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS login_events (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        bundleId TEXT NOT NULL,
        occurredAt TEXT NOT NULL,
        method TEXT NOT NULL,
        success INTEGER NOT NULL,
        failureReason TEXT,
        syncStatus TEXT NOT NULL DEFAULT 'PENDING'
      )
    `);

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_login_events_status ON login_events(syncStatus)`);

    console.log('✅ [OFFLINE_DB] Tablas creadas correctamente');
  }

  /**
   * Programa una escritura de la BD a localStorage de forma debounced.
   * Múltiples llamadas dentro de SAVE_DEBOUNCE_MS se colapsan en un único flush
   * para evitar bloquear el hilo y picos de memoria por export()+base64.
   */
  saveToStorage(): void {
    if (!this.db) return;
    this.savePending = true;
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      if (this.savePending) {
        this.savePending = false;
        this.flushToStorageSync();
      }
    }, this.SAVE_DEBOUNCE_MS);
  }

  /**
   * Persiste la BD a localStorage inmediatamente (sin debounce).
   * Usar en cierre de la app o casos donde se requiera durabilidad inmediata.
   */
  flushToStorageSync(): void {
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
    // Conversión por chunks para evitar concatenación O(n^2) y posibles
    // desbordes de pila con String.fromCharCode(...array) en buffers grandes.
    const CHUNK = 0x8000;
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
      const sub = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
      binary += String.fromCharCode.apply(null, sub as unknown as number[]);
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
      WHERE (LOWER(name) LIKE ?
         OR LOWER(sku) LIKE ?
         OR barcode LIKE ?)
        AND localStock > 0
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
       customerId, customerSnapshot, payments, documentType, cashRegisterId, cashRegisterCode,
       sessionId, sellerId, createdAt, syncStatus, syncAttempts, pendingReassignment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        sale.cashRegisterCode || null,
        sale.sessionId || null,
        sale.sellerId,
        sale.createdAt,
        sale.syncStatus,
        sale.syncAttempts,
        sale.pendingReassignment ? 1 : 0,
      ]
    );

    this.saveToStorage();
    console.log(
      `✅ [OFFLINE_DB] Venta offline guardada: ${sale.localId}${sale.pendingReassignment ? ' (pending reassignment)' : ''}`
    );
  }

  /**
   * Reasigna las ventas pendientes de reasignación a la caja/sesión/vendedor
   * recién abiertos online. Limpia el flag pendingReassignment para que
   * pasen a ser elegibles para sincronización.
   */
  async reassignPendingSales(
    cashRegisterId: string,
    sessionId: string,
    sellerId: string,
    cashRegisterCode?: string
  ): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    // Reasignar tanto las ventas marcadas pendingReassignment=1 como cualquier
    // venta PENDING/FAILED cuya sessionId no coincida con la sesión actual:
    // ese caso ocurre cuando se creó offline con una sessionId stale del store
    // (turno cerrado en backend) y por eso la sync la rechaza. La caja sólo
    // admite un turno abierto a la vez, así que reasignar al nuevo es seguro.
    const countResult = this.db.exec(
      `SELECT COUNT(*) FROM offline_sales
       WHERE pendingReassignment = 1
          OR (syncStatus IN ('PENDING','FAILED') AND (sessionId IS NULL OR sessionId <> ?))`,
      [sessionId]
    );
    const count = (countResult[0]?.values[0]?.[0] as number) || 0;
    if (count === 0) return 0;

    this.db.run(
      `
      UPDATE offline_sales
      SET cashRegisterId = ?,
          cashRegisterCode = COALESCE(?, cashRegisterCode),
          sessionId = ?,
          sellerId = ?,
          pendingReassignment = 0,
          syncStatus = CASE WHEN syncStatus = 'FAILED' THEN 'PENDING' ELSE syncStatus END,
          syncAttempts = CASE WHEN syncStatus = 'FAILED' THEN 0 ELSE syncAttempts END
      WHERE pendingReassignment = 1
         OR (syncStatus IN ('PENDING','FAILED') AND (sessionId IS NULL OR sessionId <> ?))
    `,
      [cashRegisterId, cashRegisterCode || null, sessionId, sellerId, sessionId]
    );

    this.saveToStorage();
    console.log(
      `🔁 [OFFLINE_DB] ${count} ventas reasignadas a caja=${cashRegisterId} sesión=${sessionId}`
    );
    return count;
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
        AND (pendingReassignment IS NULL OR pendingReassignment = 0)
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
    obj.pendingReassignment = obj.pendingReassignment === 1;

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
    this.db.run(`DELETE FROM users_bundle`);
    this.db.run(`DELETE FROM login_events`);

    this.saveToStorage();
    console.log('🗑️ [OFFLINE_DB] Todos los datos eliminados');
  }

  // ============ USERS BUNDLE ============

  /**
   * Guarda (o reemplaza) el bundle cifrado de usuarios para una caja.
   */
  async saveUsersBundle(cashRegisterId: string, bundle: EncryptedUsersBundle): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(`DELETE FROM users_bundle WHERE cashRegisterId = ?`, [cashRegisterId]);
    this.db.run(
      `
      INSERT INTO users_bundle
      (cashRegisterId, bundleId, alg, iv, authTag, ciphertext, checksum, keyVersion, salt, info, userCount, generatedAt, expiresAt, nextRefreshMs, storedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        cashRegisterId,
        bundle.bundleId,
        bundle.alg,
        bundle.iv,
        bundle.authTag,
        bundle.ciphertext,
        bundle.checksum,
        bundle.keyVersion,
        bundle.salt,
        bundle.info,
        bundle.userCount,
        bundle.generatedAt,
        bundle.expiresAt,
        bundle.nextRefreshMs,
        new Date().toISOString(),
      ]
    );
    this.saveToStorage();
    console.log(
      `✅ [OFFLINE_DB] Bundle de usuarios guardado (${bundle.userCount} usuarios, expira ${bundle.expiresAt})`
    );
  }

  /**
   * Obtiene el bundle cifrado vigente para una caja.
   */
  async getUsersBundle(cashRegisterId: string): Promise<EncryptedUsersBundle | null> {
    if (!this.db) throw new Error('Database not initialized');

    const results = this.db.exec(`SELECT * FROM users_bundle WHERE cashRegisterId = ?`, [
      cashRegisterId,
    ]);

    if (results.length === 0 || results[0].values.length === 0) {
      return null;
    }

    const row = results[0].values[0];
    const columns = results[0].columns;
    const obj: any = {};
    columns.forEach((col: string, i: number) => {
      obj[col] = row[i];
    });

    return {
      alg: obj.alg,
      iv: obj.iv,
      authTag: obj.authTag,
      ciphertext: obj.ciphertext,
      bundleId: obj.bundleId,
      userCount: obj.userCount,
      checksum: obj.checksum,
      keyVersion: obj.keyVersion,
      generatedAt: obj.generatedAt,
      expiresAt: obj.expiresAt,
      nextRefreshMs: obj.nextRefreshMs,
      salt: obj.salt,
      info: obj.info,
    };
  }

  /**
   * Elimina el bundle de usuarios de una caja.
   */
  async clearUsersBundle(cashRegisterId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(`DELETE FROM users_bundle WHERE cashRegisterId = ?`, [cashRegisterId]);
    this.saveToStorage();
  }

  // ============ LOGIN EVENTS ============

  /**
   * Encola un evento de login offline para sincronizar al volver online.
   */
  async saveLoginEvent(event: OfflineLoginEvent): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(
      `
      INSERT OR REPLACE INTO login_events
      (id, userId, bundleId, occurredAt, method, success, failureReason, syncStatus)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        event.id,
        event.userId,
        event.bundleId,
        event.occurredAt,
        event.method,
        event.success ? 1 : 0,
        event.failureReason || null,
        event.syncStatus,
      ]
    );
    this.saveToStorage();
  }

  /**
   * Obtiene los eventos de login pendientes de sincronizar.
   */
  async getPendingLoginEvents(limit: number = 200): Promise<OfflineLoginEvent[]> {
    if (!this.db) throw new Error('Database not initialized');

    const results = this.db.exec(
      `SELECT * FROM login_events WHERE syncStatus = 'PENDING' ORDER BY occurredAt ASC LIMIT ?`,
      [limit]
    );

    if (results.length === 0 || results[0].values.length === 0) {
      return [];
    }

    return results[0].values.map((row: any[]) => {
      const obj: any = {};
      results[0].columns.forEach((col: string, i: number) => {
        obj[col] = row[i];
      });
      return {
        id: obj.id,
        userId: obj.userId,
        bundleId: obj.bundleId,
        occurredAt: obj.occurredAt,
        method: obj.method as OfflineLoginMethod,
        success: obj.success === 1,
        failureReason: obj.failureReason || undefined,
        syncStatus: obj.syncStatus,
      } as OfflineLoginEvent;
    });
  }

  /**
   * Marca eventos de login como sincronizados.
   */
  async markLoginEventsSynced(ids: string[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    if (ids.length === 0) return;

    const placeholders = ids.map(() => '?').join(',');
    this.db.run(`UPDATE login_events SET syncStatus = 'SYNCED' WHERE id IN (${placeholders})`, ids);
    this.saveToStorage();
  }

  /**
   * Elimina eventos de login ya sincronizados (housekeeping).
   */
  async deleteSyncedLoginEvents(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(`DELETE FROM login_events WHERE syncStatus = 'SYNCED'`);
    this.saveToStorage();
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
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = null;
      }
      this.savePending = false;
      this.flushToStorageSync();
      this.db.close();
      this.db = null;
      this.isInitialized = false;
      console.log('🗄️ [OFFLINE_DB] Base de datos cerrada');
    }
  }
}

export const offlineDatabase = new OfflineDatabaseService();
