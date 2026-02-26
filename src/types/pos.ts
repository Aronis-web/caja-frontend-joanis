/**
 * POS Types
 */

export interface CashRegister {
  id: string;
  name: string;
  code: string;
  siteId: string;
  emissionPointId: string;
  status: 'ACTIVE' | 'INACTIVE';
  isActive?: boolean; // Deprecated, use status instead
  isOpen: boolean;
  currentSessionId: string | null;
  currentUserId: string | null;
  allowNegativeBalance: boolean;
  requiresManagerApproval: boolean;
  maxCashAmountCents: number | null;
  metadata: any;
  companyId: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  deletedAt: string | null;
  emissionPoint?: EmissionPoint;
  site?: any;
  company?: any;
}

export interface EmissionPoint {
  id: string;
  code: string;
  description: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
}

export interface Session {
  id: string;
  cashRegisterId: string;
  userId: string;
  openedAt: string;
  closedAt?: string;
  openingBalance: number;
  closingBalance?: number;
  expectedBalance?: number;
  difference?: number;
  currentBalance: number;
  status: 'open' | 'closed';
  notes?: string;
  totalSales?: number;
  totalCashIn?: number;
  totalCashOut?: number;
  totalTransactions?: number;
  cashRegister?: CashRegister;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  summary?: SessionSummary;
}

export interface SessionSummary {
  openingBalance: number;
  sales: number;
  cashIn: number;
  cashOut: number;
  expectedBalance: number;
  actualBalance: number;
  difference: number;
}

export interface Transaction {
  id: string;
  sessionId: string;
  type: 'cash_in' | 'cash_out';
  amount: number;
  reason: string;
  notes?: string;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
}

export interface SaleItem {
  productId: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate: number;
  subtotal?: number;
  tax?: number;
  total?: number;
}

export interface SalePayment {
  paymentMethodId: string;
  paymentMethodName?: string;
  amount: number;
}

export interface Sale {
  id: string;
  saleNumber: string;
  documentType: '01' | '03'; // 01 = Factura, 03 = Boleta
  documentNumber?: string;
  customerId?: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: 'pending' | 'processing' | 'completed' | 'rejected' | 'cancelled';
  emissionPointId: string;
  createdAt: string;
  items: SaleItem[];
  payments: SalePayment[];
  customer?: {
    id: string;
    name: string;
    documentNumber: string;
  };
}

export interface SaleDocument {
  id: string;
  documentType: string;
  documentNumber: string;
  status: string;
  sunatHash?: string;
  pdfUrl: string;
  xmlUrl: string;
  createdAt: string;
}

export interface SaleInfo {
  saleId: string;
  saleNumber: string;
  documentType: string;
  documentNumber?: string;
  status: string;
  total: number;
  createdAt: string;
  documents: SaleDocument[];
  message: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  taxRate: number;
  isActive: boolean;
  category?: string;
  imageUrl?: string;
}

export interface Customer {
  id: string;
  name: string;
  documentType: string;
  documentNumber: string;
  email?: string;
  phone?: string;
  address?: string;
}

// Request types
export interface OpenSessionRequest {
  cashRegisterId: string;
  userId: string;
  openingBalance: number;
  notes?: string;
}

export interface CloseSessionRequest {
  closingBalance: number;
  notes?: string;
}

export interface CreateSaleRequest {
  customerId?: string;
  documentType: '01' | '03';
  items: SaleItem[];
  payments: SalePayment[];
  notes?: string;
}

export interface CashTransactionRequest {
  sessionId: string;
  amount: number;
  reason: string;
  notes?: string;
}

export interface CreatePaymentMethodRequest {
  name: string;
  code: string;
  isActive: boolean;
}

export interface CreateCashRegisterRequest {
  name: string;
  code: string;
  siteId: string;
  emissionPointId: string;
  isActive: boolean;
}
