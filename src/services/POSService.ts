/**
 * POS Service
 * Handles all POS-related API calls
 */

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
  CashTransactionRequest,
  CreatePaymentMethodRequest,
  CreateCashRegisterRequest,
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
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    return this.request<PaymentMethod[]>('/pos/cash-registers/payment-methods');
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
  async createSale(
    sessionId: string,
    data: CreateSaleRequest
  ): Promise<{ sale: Sale; message: string; documentStatus: string }> {
    return this.request<{ sale: Sale; message: string; documentStatus: string }>(
      `/pos/sales/${sessionId}`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  async getSaleInfo(saleId: string): Promise<SaleInfo> {
    return this.request<SaleInfo>(`/pos/sales/info/${saleId}`);
  }

  async getRecentSales(sessionId: string, limit: number = 20): Promise<Sale[]> {
    return this.request<Sale[]>(`/pos/sales?sessionId=${sessionId}&limit=${limit}`);
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
  async searchProducts(query: string, limit: number = 10): Promise<Product[]> {
    const products = await this.request<Product[]>(
      `/catalog/products/autocomplete?q=${encodeURIComponent(query)}&limit=${limit}`
    );

    // Agregar campos calculados para compatibilidad con el código existente
    return products.map((product) => ({
      ...product,
      code: product.sku,
      name: product.title,
      isActive: product.status === 'ACTIVE',
      imageUrl: product.photos && product.photos.length > 0 ? product.photos[0] : undefined,
      // Obtener el precio de la primera presentación del primer perfil
      price:
        product.priceProfiles &&
        product.priceProfiles.length > 0 &&
        product.priceProfiles[0].prices &&
        product.priceProfiles[0].prices.length > 0
          ? product.priceProfiles[0].prices[0].priceCents / 100
          : 0,
      // Por ahora no tenemos stock en la respuesta, se puede agregar después
      stock: 999,
      taxRate: 0.18, // IGV por defecto
    }));
  }

  async getProduct(id: string): Promise<Product> {
    const product = await this.request<Product>(`/catalog/products/${id}`);

    // Agregar campos calculados para compatibilidad
    return {
      ...product,
      code: product.sku,
      name: product.title,
      isActive: product.status === 'ACTIVE',
      imageUrl: product.photos && product.photos.length > 0 ? product.photos[0] : undefined,
      price:
        product.priceProfiles &&
        product.priceProfiles.length > 0 &&
        product.priceProfiles[0].prices &&
        product.priceProfiles[0].prices.length > 0
          ? product.priceProfiles[0].prices[0].priceCents / 100
          : 0,
      stock: 999,
      taxRate: 0.18,
    };
  }

  // Customers (for sale creation)
  async searchCustomers(query: string): Promise<Customer[]> {
    return this.request<Customer[]>(`/customers/search?q=${encodeURIComponent(query)}`);
  }

  async getCustomer(id: string): Promise<Customer> {
    return this.request<Customer>(`/customers/${id}`);
  }
}

export const posService = new POSService();
