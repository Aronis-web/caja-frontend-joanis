/**
 * POS Service
 * Handles all POS-related API calls
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '@/utils/config';
import { authService } from './AuthService';
import type {
  CashRegister,
  PaymentMethod,
  Session,
  Transaction,
  Sale,
  SaleInfo,
  Product,
  Customer,
  OpenSessionRequest,
  CloseSessionRequest,
  CreateSaleRequest,
  CreateSaleResponse,
  CashTransactionRequest,
  CreatePaymentMethodRequest,
  CreateCashRegisterRequest,
  ActiveSalesResponse,
  CreditNoteResponse,
} from '@/types/pos';

class POSService {
  private baseURL: string;

  constructor() {
    this.baseURL = config.API_URL;
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
      // Si es 401, el token expiró - cerrar sesión automáticamente
      if (response.status === 401) {
        console.warn('⚠️ Token expirado (401), cerrando sesión...');
        await authService.logout();
        throw new Error('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
      }

      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Cash Registers
  async getCashRegistersBySite(siteId: string): Promise<CashRegister[]> {
    return this.request<CashRegister[]>(`/pos/cash-registers/site/${siteId}`);
  }

  async getCashRegister(id: string): Promise<CashRegister> {
    return this.request<CashRegister>(`/pos/cash-registers/${id}`);
  }

  async createCashRegister(data: CreateCashRegisterRequest): Promise<CashRegister> {
    return this.request<CashRegister>('/pos/cash-registers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Payment Methods
  async getPaymentMethods(warehouseId?: string): Promise<PaymentMethod[]> {
    const params = new URLSearchParams({ isActive: 'true' });
    if (warehouseId) {
      params.append('warehouseId', warehouseId);
    }
    return this.request<PaymentMethod[]>(`/payment-methods?${params.toString()}`);
  }

  async createPaymentMethod(data: CreatePaymentMethodRequest): Promise<PaymentMethod> {
    return this.request<PaymentMethod>('/pos/cash-registers/payment-methods', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Sessions
  async openSession(data: OpenSessionRequest): Promise<Session> {
    return this.request<Session>(`/pos/sessions/open/${data.cashRegisterId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async closeSession(sessionId: string, data: CloseSessionRequest): Promise<Session> {
    return this.request<Session>(`/pos/sessions/${sessionId}/close`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getActiveSession(cashRegisterId: string): Promise<Session> {
    return this.request<Session>(`/pos/sessions/current/${cashRegisterId}`);
  }

  async getSession(sessionId: string): Promise<Session> {
    return this.request<Session>(`/pos/sessions/${sessionId}`);
  }

  async getSessionSummary(sessionId: string): Promise<Session> {
    return this.request<Session>(`/pos/sessions/${sessionId}/summary`);
  }

  // Transactions
  async cashIn(data: CashTransactionRequest): Promise<Transaction> {
    return this.request<Transaction>('/pos/transactions/cash-in', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async cashOut(data: CashTransactionRequest): Promise<Transaction> {
    return this.request<Transaction>('/pos/transactions/cash-out', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTransactions(sessionId: string): Promise<{ data: Transaction[]; total: number }> {
    return this.request<{ data: Transaction[]; total: number }>(
      `/pos/transactions?sessionId=${sessionId}`
    );
  }

  // Sales
  async createSale(sessionId: string, data: CreateSaleRequest): Promise<CreateSaleResponse> {
    return this.request<CreateSaleResponse>(`/pos/sales/${sessionId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSaleInfo(saleId: string): Promise<SaleInfo> {
    return this.request<SaleInfo>(`/pos/sales/info/${saleId}`);
  }

  async getRecentSales(sessionId: string, limit: number = 20): Promise<Sale[]> {
    return this.request<Sale[]>(`/pos/sales?sessionId=${sessionId}&limit=${limit}`);
  }

  async getActiveSales(cashRegisterId: string): Promise<ActiveSalesResponse> {
    return this.request<ActiveSalesResponse>(`/pos/sessions/active-sales/${cashRegisterId}`);
  }

  async downloadSalePDF(saleId: string, documentId: string): Promise<Blob> {
    const token = authService.getAccessToken();
    const currentCompany = authService.getCurrentCompany();
    const currentSite = authService.getCurrentSite();

    const headers: HeadersInit = {
      'x-app-id': config.APP_ID,
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
  async searchProducts(
    query: string,
    limit: number = 10,
    cashRegisterId?: string
  ): Promise<Product[]> {
    // Si no se proporciona cashRegisterId, intentar obtenerlo de la sesión guardada
    let registerId = cashRegisterId;
    if (!registerId) {
      const currentSession = await this.getCurrentSession();
      if (!currentSession) {
        throw new Error('No hay una sesión activa. Por favor, abre una sesión primero.');
      }
      registerId = currentSession.cashRegisterId;
    }

    const response = await this.request<{
      results: Product[];
      total: number;
      query: string;
      cashRegisterId: string;
    }>(
      `/pos/cash-registers/products/search?cashRegisterId=${registerId}&query=${encodeURIComponent(query)}&limit=${limit}`
    );

    console.log(`🔍 Búsqueda de productos: "${query}" - ${response.results.length} resultados`);

    // Log del primer producto para debug
    if (response.results.length > 0) {
      console.log(
        '🔍 DEBUG - Primer producto del endpoint POS:',
        JSON.stringify(
          {
            id: response.results[0].id,
            name: response.results[0].name,
            sku: response.results[0].sku,
            barcode: response.results[0].barcode,
            salePriceCents: response.results[0].salePriceCents,
            availableStock: response.results[0].availableStock,
            imageUrl: response.results[0].imageUrl,
            categoryName: response.results[0].categoryName,
            taxType: response.results[0].taxType,
          },
          null,
          2
        )
      );
    }

    // Mapear los productos del nuevo endpoint
    return response.results.map((product) => {
      // Usar salePriceCents del endpoint (convertir de centavos a soles)
      const price = product.salePriceCents ? product.salePriceCents / 100 : 0;

      // Determinar la tasa de impuesto según el taxType
      let taxRate = 0;
      if (product.taxType === 'GRAVADO') {
        taxRate = 18; // IGV 18%
      } else if (product.taxType === 'EXONERADO' || product.taxType === 'INAFECTO') {
        taxRate = 0; // Sin IGV
      }

      const mappedProduct = {
        ...product,
        code: product.sku || product.barcode || '',
        description: product.name || '',
        price,
        stock: product.availableStock || 0,
        taxRate,
        isActive: true, // Si está en los resultados, está activo
      };

      console.log(
        `📦 Producto mapeado: ${product.name} - Precio: S/ ${price} - Stock: ${product.availableStock}`
      );

      return mappedProduct;
    });
  }

  // Método auxiliar para obtener la sesión actual
  private async getCurrentSession(): Promise<Session | null> {
    try {
      // Intentar obtener desde AsyncStorage
      const sessionData = await AsyncStorage.getItem('@pos_current_session');
      if (sessionData) {
        return JSON.parse(sessionData);
      }
      return null;
    } catch (error) {
      console.error('Error obteniendo sesión actual:', error);
      return null;
    }
  }

  async getProduct(id: string): Promise<Product> {
    const product = await this.request<Product>(`/catalog/products/${id}`);

    console.log(
      '🔍 DEBUG - Producto del backend:',
      JSON.stringify(
        {
          id: product.id,
          title: product.title,
          costCents: product.costCents,
          photos: product.photos,
        },
        null,
        2
      )
    );

    // Obtener stock total del producto
    let stock = 0;
    try {
      const stockResponse = await this.request<{ total: number }>(
        `/admin/inventory/stock/product/${id}/total`
      );
      stock = stockResponse.total || 0;
    } catch (error) {
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
    let imageUrl: string | undefined = undefined;
    if (product.photos && product.photos.length > 0) {
      imageUrl = product.photos[0];
      console.log('📸 Imagen desde photos[0]:', imageUrl);
    }

    console.log(
      '✅ Producto procesado:',
      JSON.stringify(
        {
          price,
          imageUrl,
          stock,
        },
        null,
        2
      )
    );

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

  async getProductStock(id: string): Promise<{ total: number }> {
    return this.request<{ total: number }>(`/admin/inventory/stock/product/${id}/total`);
  }

  // Customers (for sale creation)
  async searchCustomers(query: string): Promise<Customer[]> {
    return this.request<Customer[]>(`/customers/search?q=${encodeURIComponent(query)}`);
  }

  async autocompleteCustomers(
    query: string,
    limit: number = 10,
    includeInactive: boolean = false,
    customerType?: 'PERSONA' | 'EMPRESA'
  ): Promise<{ data: Customer[]; meta: { total: number; query: string } }> {
    const params = new URLSearchParams({
      query,
      limit: limit.toString(),
      includeInactive: includeInactive.toString(),
    });

    if (customerType) {
      params.append('customerType', customerType);
    }

    return this.request<{ data: Customer[]; meta: { total: number; query: string } }>(
      `/customers/autocomplete?${params.toString()}`
    );
  }

  async getCustomer(id: string): Promise<Customer> {
    return this.request<Customer>(`/customers/${id}`);
  }

  // Regenerate ticket
  async regenerateTicket(saleId: string): Promise<{ pdfBase64: string; filename: string }> {
    return this.request<{ pdfBase64: string; filename: string }>(
      `/pos/sales/regenerate-ticket/${saleId}`
    );
  }

  // Credit Notes
  async generateCreditNote(saleId: string, requestBody: any): Promise<CreditNoteResponse> {
    console.log('🌐 [API] generateCreditNote - Iniciando request');
    console.log('🌐 [API] Sale ID:', saleId);
    console.log('🌐 [API] Endpoint:', `/pos/sales/${saleId}/credit-note`);
    console.log('🌐 [API] Method: POST');
    console.log('🌐 [API] Body:', JSON.stringify(requestBody, null, 2));

    try {
      const response = await this.request<CreditNoteResponse>(`/pos/sales/${saleId}/credit-note`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      console.log('✅ [API] generateCreditNote - Response recibido');
      console.log('✅ [API] Response:', JSON.stringify(response, null, 2));

      return response;
    } catch (error) {
      console.error('❌ [API] generateCreditNote - Error en request');
      console.error('❌ [API] Error:', error);
      throw error;
    }
  }

  async downloadCreditNote(
    saleId: string
  ): Promise<{ pdf: { pdfBase64: string; filename: string } }> {
    console.log('🌐 [API] downloadCreditNote - Iniciando request');
    console.log('🌐 [API] Sale ID:', saleId);
    console.log('🌐 [API] Endpoint:', `/pos/sales/${saleId}/credit-note/pdf`);
    console.log('🌐 [API] Method: GET');

    try {
      const response = await this.request<{ pdf: { pdfBase64: string; filename: string } }>(
        `/pos/sales/${saleId}/credit-note/pdf`
      );

      console.log('✅ [API] downloadCreditNote - Response recibido');
      console.log('✅ [API] Filename:', response.pdf.filename);
      console.log('✅ [API] PDF base64 length:', response.pdf.pdfBase64?.length);

      return response;
    } catch (error) {
      console.error('❌ [API] downloadCreditNote - Error en request');
      console.error('❌ [API] Error:', error);
      throw error;
    }
  }
}

export const posService = new POSService();
