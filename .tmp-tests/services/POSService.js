"use strict";
/**
 * POS Service
 * Handles all POS-related API calls
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.posService = void 0;
const async_storage_1 = __importDefault(require("@react-native-async-storage/async-storage"));
const config_1 = require("@/utils/config");
const AuthService_1 = require("./AuthService");
const auth_1 = require("@/store/auth");
class POSService {
    constructor() {
        this.baseURL = config_1.config.API_URL;
    }
    async request(endpoint, options = {}, retriedAfterRefresh = false) {
        const token = AuthService_1.authService.getAccessToken();
        const currentCompany = AuthService_1.authService.getCurrentCompany();
        const currentSite = AuthService_1.authService.getCurrentSite();
        const headers = {
            'Content-Type': 'application/json',
            'x-app-id': config_1.config.APP_ID,
            ...options.headers,
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
        const fullUrl = `${this.baseURL}${endpoint}`;
        // 🔍 DEBUG: Log de la petición
        console.log('🌐 [POSService] Request:', {
            method: options.method || 'GET',
            url: fullUrl,
            endpoint,
            headers: {
                'x-company-id': headers['x-company-id'] || 'NO SET',
                'x-site-id': headers['x-site-id'] || 'NO SET',
                Authorization: headers['Authorization'] ? 'Bearer ***' : 'NO SET',
            },
            currentCompany: currentCompany ? { id: currentCompany.id, name: currentCompany.name } : null,
            currentSite: currentSite ? { id: currentSite.id, name: currentSite.name } : null,
        });
        const response = await fetch(fullUrl, {
            ...options,
            headers,
        });
        // 🔍 DEBUG: Log de la respuesta
        console.log('📥 [POSService] Response:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            url: response.url,
        });
        if (!response.ok) {
            // Si es 401, intentar refrescar el token una vez antes de cerrar sesión.
            if (response.status === 401) {
                if (!retriedAfterRefresh) {
                    console.warn('⚠️ Token expirado (401), intentando refresh antes de logout...');
                    const refreshed = await auth_1.useAuthStore
                        .getState()
                        .refreshAccessToken()
                        .catch(() => false);
                    if (refreshed) {
                        console.log('✅ Token refrescado, reintentando request...');
                        return this.request(endpoint, options, true);
                    }
                }
                console.warn('⚠️ Refresh imposible, cerrando sesión...');
                await auth_1.useAuthStore.getState().logout();
                throw new Error('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
            }
            const errorData = await response.json().catch(() => ({}));
            // 🔍 DEBUG: Log del error
            console.error('❌ [POSService] Error Response:', {
                status: response.status,
                statusText: response.statusText,
                errorData,
                endpoint,
                fullUrl,
            });
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        return response.json();
    }
    // Cash Registers
    async getCashRegistersBySite(siteId) {
        console.log('🏪 [POSService] getCashRegistersBySite llamado con siteId:', siteId);
        if (!siteId) {
            console.error('❌ [POSService] getCashRegistersBySite - siteId es undefined o vacío!');
            throw new Error('siteId es requerido para obtener las cajas registradoras');
        }
        try {
            const result = await this.request(`/pos/cash-registers/site/${siteId}`);
            console.log('✅ [POSService] getCashRegistersBySite - Cajas encontradas:', result?.length || 0);
            return result;
        }
        catch (error) {
            console.error('❌ [POSService] getCashRegistersBySite - Error:', error);
            throw error;
        }
    }
    async getCashRegister(id) {
        return this.request(`/pos/cash-registers/${id}`);
    }
    async createCashRegister(data) {
        return this.request('/pos/cash-registers', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }
    // Payment Methods
    async getPaymentMethods(warehouseId) {
        const params = new URLSearchParams({ isActive: 'true' });
        if (warehouseId) {
            params.append('warehouseId', warehouseId);
        }
        return this.request(`/payment-methods?${params.toString()}`);
    }
    async createPaymentMethod(data) {
        return this.request('/pos/cash-registers/payment-methods', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }
    // Sessions
    async openSession(data) {
        return this.request(`/pos/sessions/open/${data.cashRegisterId}`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }
    async closeSession(sessionId, data) {
        return this.request(`/pos/sessions/${sessionId}/close`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }
    async getActiveSession(cashRegisterId) {
        return this.request(`/pos/sessions/current/${cashRegisterId}`);
    }
    async getSession(sessionId) {
        return this.request(`/pos/sessions/${sessionId}`);
    }
    async getSessionSummary(sessionId) {
        return this.request(`/pos/sessions/${sessionId}/summary`);
    }
    // Transactions
    async cashIn(data) {
        return this.request('/pos/transactions/cash-in', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }
    async cashOut(data) {
        return this.request('/pos/transactions/cash-out', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }
    async getTransactions(sessionId) {
        return this.request(`/pos/transactions?sessionId=${sessionId}`);
    }
    // Sales
    async createSale(sessionId, data) {
        return this.request(`/pos/sales/${sessionId}`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }
    async getSaleInfo(saleId) {
        return this.request(`/pos/sales/info/${saleId}`);
    }
    async getRecentSales(sessionId, limit = 20) {
        return this.request(`/pos/sales?sessionId=${sessionId}&limit=${limit}`);
    }
    async getActiveSales(cashRegisterId, page = 1, limit = 20) {
        // Validar y sanitizar parámetros
        const validPage = Math.max(1, Math.floor(Number(page) || 1));
        const validLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || 20)));
        return this.request(`/pos/sessions/active-sales/${cashRegisterId}?page=${validPage}&limit=${validLimit}`);
    }
    async downloadSalePDF(saleId, documentId) {
        const token = AuthService_1.authService.getAccessToken();
        const currentCompany = AuthService_1.authService.getCurrentCompany();
        const currentSite = AuthService_1.authService.getCurrentSite();
        const headers = {
            'x-app-id': config_1.config.APP_ID,
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
        const response = await fetch(`${this.baseURL}/sales/${saleId}/documents/${documentId}/pdf`, {
            headers,
        });
        if (!response.ok) {
            throw new Error('Failed to download PDF');
        }
        return response.blob();
    }
    // Products (for sale creation)
    async searchProducts(query, limit = 10, cashRegisterId) {
        // Si no se proporciona cashRegisterId, intentar obtenerlo de la sesión guardada
        let registerId = cashRegisterId;
        if (!registerId) {
            const currentSession = await this.getCurrentSession();
            if (!currentSession) {
                throw new Error('No hay una sesión activa. Por favor, abre una sesión primero.');
            }
            registerId = currentSession.cashRegisterId;
        }
        const response = await this.request(`/pos/cash-registers/products/search?cashRegisterId=${registerId}&query=${encodeURIComponent(query)}&limit=${limit}`);
        console.log(`🔍 Búsqueda de productos: "${query}" - ${response.results.length} resultados`);
        // Log del primer producto para debug
        if (response.results.length > 0) {
            console.log('🔍 DEBUG - Primer producto del endpoint POS:', JSON.stringify({
                id: response.results[0].id,
                name: response.results[0].name,
                sku: response.results[0].sku,
                barcode: response.results[0].barcode,
                salePriceCents: response.results[0].salePriceCents,
                availableStock: response.results[0].availableStock,
                imageUrl: response.results[0].imageUrl,
                categoryName: response.results[0].categoryName,
                taxType: response.results[0].taxType,
            }, null, 2));
        }
        // Mapear los productos del nuevo endpoint
        return response.results.map((product) => this.mapProductForPOS(product));
    }
    async getTopSellers(cashRegisterId, limit = 40) {
        if (!cashRegisterId) {
            throw new Error('cashRegisterId es requerido para obtener productos más vendidos');
        }
        const safeLimit = Math.min(Math.max(limit, 1), 50);
        const response = await this.request(`/pos/cash-registers/products/top-sellers?cashRegisterId=${cashRegisterId}&limit=${safeLimit}`);
        return response.results.map((product) => this.mapProductForPOS(product));
    }
    mapProductForPOS(product) {
        const price = product.salePriceCents ? product.salePriceCents / 100 : 0;
        let taxRate = 0;
        if (product.taxType === 'GRAVADO') {
            taxRate = 18;
        }
        else if (product.taxType === 'EXONERADO' || product.taxType === 'INAFECTO') {
            taxRate = 0;
        }
        const mappedProduct = {
            ...product,
            code: product.sku || product.barcode || '',
            description: product.name || '',
            price,
            stock: product.availableStock || 0,
            taxRate,
            isActive: true,
        };
        return mappedProduct;
    }
    // Método auxiliar para obtener la sesión actual
    async getCurrentSession() {
        try {
            // Intentar obtener desde AsyncStorage
            const sessionData = await async_storage_1.default.getItem('@pos_current_session');
            if (sessionData) {
                return JSON.parse(sessionData);
            }
            return null;
        }
        catch (error) {
            console.error('Error obteniendo sesión actual:', error);
            return null;
        }
    }
    async getProduct(id) {
        const product = await this.request(`/catalog/products/${id}`);
        console.log('🔍 DEBUG - Producto del backend:', JSON.stringify({
            id: product.id,
            title: product.title,
            costCents: product.costCents,
            photos: product.photos,
        }, null, 2));
        // Obtener stock total del producto
        let stock = 0;
        try {
            const stockResponse = await this.request(`/admin/inventory/stock/product/${id}/total`);
            stock = stockResponse.total || 0;
        }
        catch (error) {
            console.warn(`⚠️ No se pudo obtener stock para producto ${id}:`, error);
            stock = 0; // Si falla, asumimos sin stock
        }
        // Usar costCents como precio
        let price = 0;
        if (product.costCents && product.costCents > 0) {
            price = product.costCents / 100;
            console.log('💰 Precio desde costCents:', price);
        }
        // Intentar obtener la imagen
        let imageUrl = undefined;
        if (product.photos && product.photos.length > 0) {
            imageUrl = product.photos[0];
            console.log('📸 Imagen desde photos[0]:', imageUrl);
        }
        console.log('✅ Producto procesado:', JSON.stringify({
            price,
            imageUrl,
            stock,
        }, null, 2));
        // Agregar campos calculados para compatibilidad
        return {
            ...product,
            code: product.sku || '',
            name: product.title || 'Sin nombre',
            description: product.title || '',
            isActive: product.status === 'ACTIVE' || product.status === 'PRELIMINARY',
            imageUrl,
            price,
            stock,
            taxRate: 18,
        };
    }
    async getProductStock(id) {
        return this.request(`/admin/inventory/stock/product/${id}/total`);
    }
    // Customers (for sale creation)
    async searchCustomers(query) {
        return this.request(`/customers/search?q=${encodeURIComponent(query)}`);
    }
    async autocompleteCustomers(query, limit = 10, includeInactive = false, customerType) {
        const params = new URLSearchParams({
            query,
            limit: limit.toString(),
            includeInactive: includeInactive.toString(),
        });
        if (customerType) {
            params.append('customerType', customerType);
        }
        return this.request(`/customers/autocomplete?${params.toString()}`);
    }
    async getCustomer(id) {
        return this.request(`/customers/${id}`);
    }
    // ApiPeru - Consulta DNI/RUC
    async lookupDNI(dni) {
        console.log('🔍 [API] lookupDNI - Consultando DNI:', dni);
        try {
            const response = await this.request(`/customers/dni/${dni}`);
            console.log('✅ [API] lookupDNI - Response:', JSON.stringify(response, null, 2));
            return response;
        }
        catch (error) {
            console.error('❌ [API] lookupDNI - Error:', error);
            throw error;
        }
    }
    async lookupRUC(ruc) {
        console.log('🔍 [API] lookupRUC - Consultando RUC:', ruc);
        try {
            const response = await this.request(`/customers/ruc/${ruc}`);
            console.log('✅ [API] lookupRUC - Response:', JSON.stringify(response, null, 2));
            return response;
        }
        catch (error) {
            console.error('❌ [API] lookupRUC - Error:', error);
            throw error;
        }
    }
    // Create Customer
    async createCustomer(data) {
        console.log('➕ [API] createCustomer - Creando cliente:', JSON.stringify(data, null, 2));
        try {
            const response = await this.request('/customers', {
                method: 'POST',
                body: JSON.stringify(data),
            });
            console.log('✅ [API] createCustomer - Cliente creado:', JSON.stringify(response, null, 2));
            return response;
        }
        catch (error) {
            console.error('❌ [API] createCustomer - Error:', error);
            throw error;
        }
    }
    // Regenerate ticket
    async regenerateTicket(saleId) {
        return this.request(`/pos/sales/regenerate-ticket/${saleId}`);
    }
    // Credit Notes
    async generateCreditNote(saleId, requestBody) {
        console.log('🌐 [API] generateCreditNote - Iniciando request');
        console.log('🌐 [API] Sale ID:', saleId);
        console.log('🌐 [API] Endpoint:', `/pos/sales/${saleId}/credit-note`);
        console.log('🌐 [API] Method: POST');
        console.log('🌐 [API] Body:', JSON.stringify(requestBody, null, 2));
        try {
            const response = await this.request(`/pos/sales/${saleId}/credit-note`, {
                method: 'POST',
                body: JSON.stringify(requestBody),
            });
            console.log('✅ [API] generateCreditNote - Response recibido');
            console.log('✅ [API] Response:', JSON.stringify(response, null, 2));
            return response;
        }
        catch (error) {
            console.error('❌ [API] generateCreditNote - Error en request');
            console.error('❌ [API] Error:', error);
            throw error;
        }
    }
    async downloadCreditNote(saleId) {
        console.log('🌐 [API] downloadCreditNote - Iniciando request');
        console.log('🌐 [API] Sale ID:', saleId);
        console.log('🌐 [API] Endpoint:', `/pos/sales/${saleId}/credit-note/pdf`);
        console.log('🌐 [API] Method: GET');
        try {
            const response = await this.request(`/pos/sales/${saleId}/credit-note/pdf`);
            console.log('✅ [API] downloadCreditNote - Response recibido');
            console.log('✅ [API] Filename:', response.pdf.filename);
            console.log('✅ [API] PDF base64 length:', response.pdf.pdfBase64?.length);
            return response;
        }
        catch (error) {
            console.error('❌ [API] downloadCreditNote - Error en request');
            console.error('❌ [API] Error:', error);
            throw error;
        }
    }
    async regenerateCreditNoteTicket(saleId, creditNoteDocumentId) {
        console.log('🌐 [API] regenerateCreditNoteTicket - Iniciando request');
        console.log('🌐 [API] Sale ID:', saleId);
        console.log('🌐 [API] Credit Note Document ID:', creditNoteDocumentId);
        console.log('🌐 [API] Endpoint:', `/pos/sales/${saleId}/credit-note/${creditNoteDocumentId}/ticket`);
        try {
            const response = await this.request(`/pos/sales/${saleId}/credit-note/${creditNoteDocumentId}/ticket`);
            console.log('✅ [API] regenerateCreditNoteTicket - Response recibido');
            console.log('✅ [API] Filename:', response.filename);
            console.log('✅ [API] PDF base64 length:', response.pdfBase64?.length);
            return response;
        }
        catch (error) {
            console.error('❌ [API] regenerateCreditNoteTicket - Error en request');
            console.error('❌ [API] Error:', error);
            throw error;
        }
    }
}
exports.posService = new POSService();
