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
    this.baseURL = `${config.API_URL}/api`;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = authService.getAccessToken();
    const currentCompany = authService.getCurrentCompany();
    const currentSite = authService.getCurrentSite();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'x-app-id': config.APP_ID,
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
    return this.request<Session>('/pos/sessions/open', {
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
    return this.request<Session>(`/pos/sessions/active/${cashRegisterId}`);
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

  async downloadSalePDF(saleId: string, documentId: string): Promise<Blob> {
    const token = authService.getAccessToken();
    const headers: HeadersInit = {
      'x-app-id': config.APP_ID,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
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
  async searchProducts(query: string): Promise<Product[]> {
    return this.request<Product[]>(`/products/search?q=${encodeURIComponent(query)}`);
  }

  async getProduct(id: string): Promise<Product> {
    return this.request<Product>(`/products/${id}`);
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
