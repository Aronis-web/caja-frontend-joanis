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
  description?: string;
  requiresReference?: boolean;
  isActive: boolean;
  displayOrder?: number;
  parentId?: string | null;
  submethods?: PaymentMethod[];
  createdAt?: string;
  // Campos para identificar tipos de pago
  isIzipay?: boolean;
  isCash?: boolean;
}

export interface Session {
  id: string;
  cashRegisterId: string;
  userId: string;
  openedAt: string;
  closedAt?: string;
  openingCashCents: number;
  closingCashCents?: number;
  expectedCashCents?: number;
  differenceCents?: number;
  currentCashCents: number;
  status: 'open' | 'closed';
  notes?: string;
  totalSalesCents?: number;
  totalCashInCents?: number;
  totalCashOutCents?: number;
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
  openingCashCents: number;
  salesCents: number;
  cashInCents: number;
  cashOutCents: number;
  expectedCashCents: number;
  actualCashCents: number;
  differenceCents: number;
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
  unitPrice?: number;
  discount?: number;
  taxRate?: number;
  subtotal?: number;
  tax?: number;
  total?: number;
  imageUrl?: string;
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

export interface CreateSaleResponse {
  sale: {
    id: string;
    code: string;
    status: string;
    processingStatus: string;
    totalCents: number;
    cashRegisterId: string;
    sellerId: string;
    origin: string;
    createdAt: string;
  };
  document: {
    type: string;
    status: string;
    message: string;
  };
  session: {
    id: string;
    cashRegisterId: string;
    cashRegisterCode: string;
  };
  pdf: {
    base64: string;
    filename: string;
    mimeType: string;
  };
}

export interface ProductPresentation {
  id: string;
  code: string;
  name: string;
  isBase: boolean;
  factorToBase: number;
}

export interface ProductPresentationPrice {
  presentationId: string;
  presentationCode: string;
  presentationName: string;
  priceCents: number;
  currency: string;
  isOverridden: boolean;
}

export interface ProductPriceProfile {
  profileId: string;
  profileCode: string;
  profileName: string;
  prices: ProductPresentationPrice[];
}

export interface ProductCategory {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  correlativeNumber?: number;
  title?: string;
  sku?: string;
  barcode?: string;
  status?: string;
  costCents?: number;
  currency?: string;
  category?: ProductCategory;
  presentations?: ProductPresentation[];
  priceProfiles?: ProductPriceProfile[];
  photos?: string[];
  // Campos del nuevo endpoint de búsqueda POS
  name?: string;
  salePriceCents?: number;
  availableStock?: number;
  imageUrl?: string;
  categoryName?: string;
  taxType?: string;
  // Campos calculados para compatibilidad
  code?: string;
  description?: string;
  price?: number;
  stock?: number;
  taxRate?: number;
  isActive?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  documentType: string;
  documentNumber: string;
  email?: string;
  phone?: string;
  address?: string;
  customerType?: 'PERSONA' | 'EMPRESA';
  fullName?: string;
  status?: string;
  isActive?: boolean;
  matchType?: 'name' | 'document';
  label?: string;
}

// Request types
export interface OpenSessionRequest {
  cashRegisterId: string;
  userId: string;
  openingCashCents: number;
  notes?: string;
}

export interface CloseSessionRequest {
  closingCashCents: number;
  notes?: string;
}

export interface CreateSaleRequest {
  saleType: 'B2C' | 'B2B';
  customerId?: string;
  warehouseId?: string;
  items: {
    productId: string;
    quantity: number;
    unitPriceCents: number;
    discountCents: number;
  }[];
  payments: {
    paymentMethodId: string;
    amountCents: number;
    referenceNumber?: string;
    notes?: string;
  }[];
  notes?: string;
  customerNotes?: string;
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

// Active Sales Response
export interface ActiveSalesResponse {
  cashRegister: {
    id: string;
    code: string;
    name: string;
  };
  session: {
    id: string;
    openedAt: string;
    userId: string;
    userName: string;
    status: string;
  };
  summary: {
    totalSalesCount: number;
    totalSales: number;
    totalPayments: number;
    totalRefunds: number;
    paymentMethodBreakdown: {
      [key: string]: {
        count: number;
        total: number;
      };
    };
  };
  sales: ActiveSaleTransaction[];
}

export interface ActiveSaleTransaction {
  transactionId: string;
  saleId: string;
  sale: {
    id: string;
    code: string;
    saleNumber: number;
    saleDate: string;
    status: string;
    documentType: string;
    saleType: string;
    customerSnapshot?: {
      fullName?: string;
      documentNumber?: string;
      email?: string;
      phone?: string;
      documentType?: string;
    };
    companySnapshot?: any;
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    itemCount: number;
    totalQuantity: string;
    items: any[];
  };
  amount: number;
  paymentMethod: {
    id: string;
    name: string;
    code: string;
  };
  createdAt: string;
}
