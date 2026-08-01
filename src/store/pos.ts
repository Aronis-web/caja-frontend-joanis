/**
 * POS Store
 * Manages POS state using Zustand
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { posService } from '@/services/POSService';
import { buildSalePayments, toCents } from '@/utils/paymentFlow';
import type {
  CashRegister,
  Session,
  PaymentMethod,
  Product,
  SaleItem,
  SalePayment,
  CreateSaleResponse,
  OrphanPinPadOperation,
  OrphanPinPadOperationsResponse,
  PinPadProvider,
} from '@/types/pos';

interface POSState {
  // Current state
  selectedCashRegister: CashRegister | null;
  currentSession: Session | null;
  paymentMethods: PaymentMethod[];
  topSellers: Product[];
  isTopSellersLoading: boolean;
  topSellersLastUpdatedAt: string | null;
  salesSinceTopSellersRefresh: number;

  // Cart state
  cartItems: SaleItem[];
  cartPayments: SalePayment[];

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Actions - Cash Register
  setSelectedCashRegister: (cashRegister: CashRegister | null) => Promise<void>;
  loadCashRegistersBySite: (siteId: string) => Promise<CashRegister[]>;

  // Actions - Session
  openSession: (
    cashRegisterId: string,
    userId: string,
    openingBalance: number,
    notes?: string
  ) => Promise<Session>;
  closeSession: (sessionId: string, closingBalance: number, notes?: string) => Promise<Session>;
  loadActiveSession: (cashRegisterId: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  setCurrentSession: (session: Session | null) => Promise<void>;

  // Actions - Payment Methods
  loadPaymentMethods: () => Promise<void>;

  // Actions - Cart
  addItemToCart: (product: Product, quantity: number) => void;
  updateCartItem: (index: number, quantity: number) => void;
  removeCartItem: (index: number) => void;
  clearCart: () => void;

  addPaymentToCart: (
    paymentMethodId: string,
    amount: number,
    extra?: {
      pinpadOperationId?: string;
      pinpadProvider?: PinPadProvider;
      cardLast4?: string;
      approvalCode?: string;
    }
  ) => void;
  updateCartPayment: (index: number, amount: number) => void;
  removeCartPayment: (index: number) => void;
  clearPayments: () => void;

  getCartTotal: () => number;
  getCartSubtotal: () => number;
  getCartTax: () => number;
  getCartDiscount: () => number;
  getPaymentsTotal: () => number;

  // Actions - Sales
  createSale: (
    customerId?: string,
    documentType?: '01' | '03',
    notes?: string
  ) => Promise<CreateSaleResponse>;

  // PinPad orphans (cobros aprobados sin venta)
  pinpadOrphans: OrphanPinPadOperation[];
  pinpadOrphansTotalCents: number;
  isPinpadOrphansLoading: boolean;
  pinpadOrphansError: string | null;

  // Actions - PinPad operations
  fetchOrphanPinPadOperations: (sessionId: string) => Promise<OrphanPinPadOperationsResponse>;
  voidPinPadOperation: (provider: PinPadProvider, id: string, reason: string) => Promise<boolean>;

  // Actions - Top sellers
  loadTopSellers: (cashRegisterId?: string, limit?: number) => Promise<void>;
  refreshTopSellersInBackground: (cashRegisterId?: string, limit?: number) => Promise<void>;
  incrementSalesCounterAndRefreshTopSellers: () => Promise<void>;
  resetTopSellersState: () => void;

  // Utility
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  initializeFromStorage: () => Promise<void>;
  reset: () => void;
}

const STORAGE_KEY = '@caja:selected_cash_register';
const SESSION_STORAGE_KEY = '@pos_current_session';
const TOP_SELLERS_STORAGE_KEY = '@pos_top_sellers';
const TOP_SELLERS_META_STORAGE_KEY = '@pos_top_sellers_meta';
const PAYMENT_METHODS_STORAGE_KEY = '@pos_payment_methods';
const CART_STORAGE_KEY = '@pos_cart';

interface PersistedCart {
  cashRegisterId: string | null;
  cartItems: SaleItem[];
  cartPayments: SalePayment[];
  updatedAt: string;
}

// Persiste el carrito asociado a la caja actual. Si está vacío, lo borra para
// no dejar basura en storage. Es fire-and-forget: un fallo de storage no debe
// bloquear la UI ni la operación de venta.
const persistCart = (state: {
  selectedCashRegister: CashRegister | null;
  cartItems: SaleItem[];
  cartPayments: SalePayment[];
}): void => {
  if (state.cartItems.length === 0 && state.cartPayments.length === 0) {
    void AsyncStorage.removeItem(CART_STORAGE_KEY);
    return;
  }
  const payload: PersistedCart = {
    cashRegisterId: state.selectedCashRegister?.id ?? null,
    cartItems: state.cartItems,
    cartPayments: state.cartPayments,
    updatedAt: new Date().toISOString(),
  };
  void AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(payload));
};

const normalizeTaxRate = (taxType?: string): number => (taxType === 'GRAVADO' ? 18 : 0);

const normalizeTopSellerProduct = (product: Product): Product => {
  const price =
    typeof product.price === 'number' ? product.price : (product.salePriceCents || 0) / 100;
  const stock = typeof product.stock === 'number' ? product.stock : (product.availableStock ?? 0);

  return {
    ...product,
    code: product.code || product.sku || product.barcode || '',
    description: product.description || product.name || '',
    price,
    stock,
    availableStock: product.availableStock ?? stock,
    taxRate: product.taxRate ?? normalizeTaxRate(product.taxType),
    imageUrl: product.imageDataUrl || product.imageUrl,
    imageDataUrl: product.imageDataUrl,
    isActive: true,
  };
};

const toDataUrlFromBlob = (blob: Blob, fallbackType = 'image/jpeg'): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('No se pudo convertir imagen a Data URL'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Error leyendo imagen'));
    reader.readAsDataURL(new Blob([blob], { type: blob.type || fallbackType }));
  });

const preloadImageAsDataUrl = async (url?: string): Promise<string | undefined> => {
  if (!url) return undefined;

  if (url.startsWith('data:image')) {
    return url;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return undefined;
    }

    const blob = await response.blob();
    return await toDataUrlFromBlob(blob, blob.type || 'image/jpeg');
  } catch (error) {
    console.warn('⚠️ [TOP_SELLERS] No se pudo precargar imagen:', url, error);
    return undefined;
  }
};

const persistTopSellers = async (
  products: Product[],
  cashRegisterId?: string,
  salesCounter: number = 0
): Promise<void> => {
  const now = new Date().toISOString();
  await AsyncStorage.setItem(TOP_SELLERS_STORAGE_KEY, JSON.stringify(products));
  await AsyncStorage.setItem(
    TOP_SELLERS_META_STORAGE_KEY,
    JSON.stringify({
      cashRegisterId,
      updatedAt: now,
      salesCounter,
    })
  );
};

// Initialize store with persisted data
const initializeStore = async () => {
  try {
    const storedCashRegister = await AsyncStorage.getItem(STORAGE_KEY);
    if (storedCashRegister) {
      const cashRegister = JSON.parse(storedCashRegister);
      return { selectedCashRegister: cashRegister };
    }
  } catch (error) {
    console.error('Error loading stored cash register:', error);
  }
  return {};
};

export const usePOSStore = create<POSState>((set, get) => ({
  // Initial state
  selectedCashRegister: null,
  currentSession: null,
  paymentMethods: [],
  topSellers: [],
  isTopSellersLoading: false,
  topSellersLastUpdatedAt: null,
  salesSinceTopSellersRefresh: 0,
  cartItems: [],
  cartPayments: [],
  isLoading: false,
  error: null,
  pinpadOrphans: [],
  pinpadOrphansTotalCents: 0,
  isPinpadOrphansLoading: false,
  pinpadOrphansError: null,

  // Cash Register actions
  setSelectedCashRegister: async (cashRegister) => {
    const previousId = get().selectedCashRegister?.id ?? null;
    const nextId = cashRegister?.id ?? null;

    // Al cambiar de caja (o al deseleccionar) limpiamos el carrito persistido:
    // el carrito está ligado a una caja específica y no debe cruzarse.
    if (previousId !== nextId) {
      set({ cartItems: [], cartPayments: [] });
      void AsyncStorage.removeItem(CART_STORAGE_KEY);
    }

    set({ selectedCashRegister: cashRegister });
    if (cashRegister) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cashRegister));
      // Load active session if exists
      try {
        await get().loadActiveSession(cashRegister.id);
      } catch {
        // No active session, that's ok
        set({ currentSession: null });
      }
      void get().refreshTopSellersInBackground(cashRegister.id, 40);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
      set({ currentSession: null });
      get().resetTopSellersState();
    }
  },

  loadCashRegistersBySite: async (siteId) => {
    try {
      set({ isLoading: true, error: null });
      const cashRegisters = await posService.getCashRegistersBySite(siteId);
      set({ isLoading: false });
      return cashRegisters;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load cash registers';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  // Session actions
  openSession: async (cashRegisterId, userId, openingBalance, notes) => {
    try {
      set({ isLoading: true, error: null });
      // Convertir de soles a centavos (multiplicar por 100)
      const openingCashCents = Math.round(openingBalance * 100);
      const session = await posService.openSession({
        cashRegisterId,
        userId,
        openingCashCents,
        notes,
      });
      // Guardar sesión en AsyncStorage para uso del servicio
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      set({ currentSession: session, isLoading: false });
      void get().refreshTopSellersInBackground(cashRegisterId, 40);

      // Reasignar ventas offline pendientes a la caja/sesión/usuario recién abiertos
      // y disparar sincronización en background. Imports dinámicos para evitar
      // ciclos con el offline/auth store.
      void (async () => {
        try {
          const { useOfflineStore } = await import('@/store/offline');
          const cashRegisterCode = get().selectedCashRegister?.code;
          const reassigned = await useOfflineStore.getState().reassignPendingSales({
            cashRegisterId,
            sessionId: session.id,
            sellerId: userId,
            cashRegisterCode,
          });
          if (reassigned > 0) {
            console.log(`🔁 [POS] ${reassigned} ventas offline reasignadas a la nueva sesión`);
          }
          const { offlineSyncService } = await import('@/services/OfflineSyncService');
          await offlineSyncService.syncPendingSales(cashRegisterId);
        } catch (syncError) {
          console.warn('⚠️ [POS] No se pudieron sincronizar ventas pendientes:', syncError);
        }
      })();

      return session;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to open session';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  closeSession: async (sessionId, closingBalance, notes) => {
    try {
      set({ isLoading: true, error: null });
      // Convertir de soles a centavos (multiplicar por 100)
      const closingCashCents = Math.round(closingBalance * 100);
      const session = await posService.closeSession(sessionId, {
        closingCashCents,
        notes,
      });
      // Eliminar sesión de AsyncStorage
      await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
      set({ currentSession: null, isLoading: false });
      get().clearCart();
      get().clearPayments();
      return session;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to close session';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  loadActiveSession: async (cashRegisterId) => {
    try {
      set({ isLoading: true, error: null });
      const session = await posService.getActiveSession(cashRegisterId);
      // Guardar sesión en AsyncStorage para uso del servicio
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      set({ currentSession: session, isLoading: false });
      void get().refreshTopSellersInBackground(cashRegisterId, 40);
    } catch (error) {
      await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
      set({ currentSession: null, isLoading: false });
      throw error;
    }
  },

  refreshSession: async () => {
    const { currentSession } = get();
    if (currentSession) {
      try {
        const session = await posService.getSession(currentSession.id);
        set({ currentSession: session });
      } catch (error) {
        console.error('Failed to refresh session:', error);
      }
    }
  },

  setCurrentSession: async (session) => {
    if (session) {
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
    }
    set({ currentSession: session });
  },

  // Payment Methods actions
  loadPaymentMethods: async () => {
    try {
      set({ isLoading: true, error: null });
      const { currentSession, selectedCashRegister } = get();

      // Try to get warehouseId from session's cashRegister or from selectedCashRegister
      const warehouseId =
        currentSession?.cashRegister?.site?.warehouseId || selectedCashRegister?.site?.warehouseId;

      console.log('💳 Loading payment methods with warehouseId:', warehouseId);
      const paymentMethods = await posService.getPaymentMethods(warehouseId);
      console.log('💳 Payment methods loaded:', paymentMethods.length);
      await AsyncStorage.setItem(PAYMENT_METHODS_STORAGE_KEY, JSON.stringify(paymentMethods));
      set({ paymentMethods, isLoading: false });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to load payment methods';
      // Sin red: caer al cache para no bloquear la operación offline.
      try {
        const cached = await AsyncStorage.getItem(PAYMENT_METHODS_STORAGE_KEY);
        if (cached) {
          const paymentMethods = JSON.parse(cached) as PaymentMethod[];
          console.log('💳 Payment methods restaurados desde cache:', paymentMethods.length);
          set({ paymentMethods, isLoading: false, error: null });
          return;
        }
      } catch (cacheError) {
        console.error('❌ Error leyendo cache de payment methods:', cacheError);
      }
      console.error('❌ Error loading payment methods:', errorMessage);
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  // Cart actions
  addItemToCart: (product, quantity) => {
    const { cartItems } = get();
    const existingIndex = cartItems.findIndex((item) => item.productId === product.id);
    const availableStock =
      typeof product.availableStock === 'number'
        ? product.availableStock
        : typeof product.stock === 'number'
          ? product.stock
          : undefined;

    console.log('🛒 Agregando al carrito:', {
      name: product.name,
      code: product.code,
      price: product.price,
      imageUrl: product.imageUrl,
      taxRate: product.taxRate,
      availableStock,
    });

    if (existingIndex >= 0) {
      // Update existing item
      const newItems = [...cartItems];
      const currentQty = newItems[existingIndex].quantity;
      const desiredQty = currentQty + quantity;
      const cappedQty =
        typeof availableStock === 'number' ? Math.min(desiredQty, availableStock) : desiredQty;
      newItems[existingIndex].quantity = cappedQty;
      if (typeof availableStock === 'number') {
        newItems[existingIndex].availableStock = availableStock;
      }
      set({ cartItems: newItems });
    } else {
      // Add new item
      const cappedQty =
        typeof availableStock === 'number' ? Math.min(quantity, availableStock) : quantity;
      const newItem: SaleItem = {
        productId: product.id,
        productName: product.name,
        productCode: product.code,
        quantity: cappedQty,
        unitPrice: product.price,
        discount: 0,
        taxRate: product.taxRate,
        imageUrl: product.imageUrl,
        availableStock,
      };
      console.log('✅ Item agregado al carrito:', newItem);
      set({ cartItems: [...cartItems, newItem] });
    }
    persistCart(get());
  },

  updateCartItem: (index, quantity) => {
    const { cartItems } = get();
    if (quantity <= 0) {
      get().removeCartItem(index);
      return;
    }
    const newItems = [...cartItems];
    const availableStock = newItems[index].availableStock;
    const cappedQty =
      typeof availableStock === 'number' ? Math.min(quantity, availableStock) : quantity;
    newItems[index].quantity = cappedQty;
    set({ cartItems: newItems });
    persistCart(get());
  },

  removeCartItem: (index) => {
    const { cartItems } = get();
    const newItems = cartItems.filter((_, i) => i !== index);
    set({ cartItems: newItems });
    persistCart(get());
  },

  clearCart: () => {
    set({ cartItems: [] });
    persistCart(get());
  },

  addPaymentToCart: (paymentMethodId, amount, extra) => {
    const { cartPayments, paymentMethods } = get();
    const paymentMethod = paymentMethods.find((pm) => pm.id === paymentMethodId);

    const newPayment: SalePayment = {
      paymentMethodId,
      paymentMethodName: paymentMethod?.name,
      amount,
      ...(extra?.pinpadOperationId ? { pinpadOperationId: extra.pinpadOperationId } : {}),
      ...(extra?.pinpadProvider ? { pinpadProvider: extra.pinpadProvider } : {}),
      ...(extra?.cardLast4 ? { cardLast4: extra.cardLast4 } : {}),
      ...(extra?.approvalCode ? { approvalCode: extra.approvalCode } : {}),
    };
    set({ cartPayments: [...cartPayments, newPayment] });
    persistCart(get());
  },

  updateCartPayment: (index, amount) => {
    const { cartPayments } = get();
    if (amount <= 0) {
      get().removeCartPayment(index);
      return;
    }
    const newPayments = [...cartPayments];
    newPayments[index].amount = amount;
    set({ cartPayments: newPayments });
    persistCart(get());
  },

  removeCartPayment: (index) => {
    const { cartPayments } = get();
    const newPayments = cartPayments.filter((_, i) => i !== index);
    set({ cartPayments: newPayments });
    persistCart(get());
  },

  clearPayments: () => {
    set({ cartPayments: [] });
    persistCart(get());
  },

  getCartSubtotal: () => {
    const { cartItems } = get();
    return cartItems.reduce((total, item) => {
      // El unitPrice ya incluye el IGV, necesitamos extraer el precio base
      const itemTotalWithTax = item.quantity * (item.unitPrice || 0) - (item.discount || 0);
      const taxRate = item.taxRate || 0;

      // Si hay IGV, calcular el precio base: precioTotal / (1 + tasaIGV)
      // Ejemplo: Si precio = 118 y IGV = 18%, entonces base = 118 / 1.18 = 100
      const itemSubtotal = taxRate > 0 ? itemTotalWithTax / (1 + taxRate / 100) : itemTotalWithTax;

      return total + itemSubtotal;
    }, 0);
  },

  getCartTax: () => {
    const { cartItems } = get();
    return cartItems.reduce((total, item) => {
      // El unitPrice ya incluye el IGV, extraemos el IGV del total
      const itemTotalWithTax = item.quantity * (item.unitPrice || 0) - (item.discount || 0);
      const taxRate = item.taxRate || 0;

      // Si hay IGV, calcular: IGV = precioTotal - precioBase
      // Ejemplo: Si precio = 118 y IGV = 18%, entonces IGV = 118 - (118/1.18) = 18
      const itemTax = taxRate > 0 ? itemTotalWithTax - itemTotalWithTax / (1 + taxRate / 100) : 0;

      return total + itemTax;
    }, 0);
  },

  getCartDiscount: () => {
    const { cartItems } = get();
    return cartItems.reduce((total, item) => total + (item.discount || 0), 0);
  },

  getCartTotal: () => {
    // El total es simplemente la suma de los precios de venta (que ya incluyen IGV)
    const { cartItems } = get();
    return cartItems.reduce((total, item) => {
      const itemTotal = item.quantity * (item.unitPrice || 0) - (item.discount || 0);
      return total + itemTotal;
    }, 0);
  },

  getPaymentsTotal: () => {
    const { cartPayments } = get();
    return cartPayments.reduce((total, payment) => total + payment.amount, 0);
  },

  // Sales actions
  createSale: async (customerId, _documentType = '03', notes) => {
    console.log('🏪 [STORE] createSale iniciado');
    const { currentSession, cartItems, cartPayments, paymentMethods } = get();

    console.log('📋 [STORE] Sesión actual:', currentSession?.id);
    console.log('🛒 [STORE] Items en carrito:', cartItems.length);
    console.log('💳 [STORE] Métodos de pago:', cartPayments.length);

    if (!currentSession) {
      console.error('❌ [STORE] No hay sesión activa');
      throw new Error('No active session');
    }

    if (cartItems.length === 0) {
      console.error('❌ [STORE] Carrito vacío');
      throw new Error('Cart is empty');
    }

    if (cartPayments.length === 0) {
      console.error('❌ [STORE] No hay métodos de pago');
      throw new Error('Debe agregar al menos un método de pago');
    }

    const total = get().getCartTotal();
    const paymentsTotal = get().getPaymentsTotal();
    const totalCents = toCents(total);
    const paymentsTotalCents = toCents(paymentsTotal);

    console.log('💰 [STORE] Total venta:', total);
    console.log('💳 [STORE] Total pagos:', paymentsTotal);

    // Permitir venta si el pago es mayor o igual al total (comparación en centavos)
    if (paymentsTotalCents < totalCents) {
      console.error('❌ [STORE] Pago insuficiente');
      throw new Error('Payment amount is insufficient');
    }

    const change = (paymentsTotalCents - totalCents) / 100;
    if (change > 0) {
      console.log('💵 [STORE] Vuelto:', change);
    }

    try {
      set({ isLoading: true, error: null });

      // Siempre usar B2C como tipo de venta (MAYÚSCULAS)
      const saleType = 'B2C';
      console.log('📄 [STORE] Tipo de venta:', saleType);
      console.log('👤 [STORE] Cliente ID:', customerId || 'Sin cliente');

      // Convertir items al formato del nuevo endpoint
      const items = cartItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPriceCents: Math.round((item.unitPrice || 0) * 100),
        discountCents: Math.round((item.discount || 0) * 100),
      }));

      console.log('📦 [STORE] Items convertidos:', JSON.stringify(items, null, 2));

      // Procesar pagos según el tipo de método
      const payments = buildSalePayments(total, cartPayments, paymentMethods);

      console.log('💳 [STORE] Pagos procesados:', JSON.stringify(payments, null, 2));

      const requestData: {
        saleType: 'B2C' | 'B2B';
        items: {
          productId: string;
          quantity: number;
          unitPriceCents: number;
          discountCents: number;
        }[];
        payments: {
          paymentMethodId: string;
          amountCents: number;
          referenceNumber: string;
          notes: string;
          pinpadOperationId?: string;
          pinpadProvider?: PinPadProvider;
        }[];
        notes?: string;
        customerId?: string;
      } = {
        saleType,
        items,
        payments,
        notes,
      };

      // Agregar customerId solo si existe
      if (customerId) {
        requestData.customerId = customerId;
      }

      console.log('📤 [STORE] Enviando request:', JSON.stringify(requestData, null, 2));
      console.log('🔍 [STORE] Verificando saleType antes de enviar:', requestData.saleType);

      const response = await posService.createSale(currentSession.id, requestData);

      console.log('✅ [STORE] Respuesta recibida:', JSON.stringify(response, null, 2));

      // Clear cart after successful sale
      get().clearCart();
      get().clearPayments();

      // Refresh session to update balance
      await get().refreshSession();
      void get().incrementSalesCounterAndRefreshTopSellers();

      set({ isLoading: false });

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create sale';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  // PinPad orphan operations (cobros aprobados sin venta)
  fetchOrphanPinPadOperations: async (sessionId) => {
    set({ isPinpadOrphansLoading: true, pinpadOrphansError: null });
    try {
      const response = await posService.getOrphanPinPadOperations(sessionId);
      set({
        pinpadOrphans: response.operations,
        pinpadOrphansTotalCents: response.totalCents,
        isPinpadOrphansLoading: false,
      });
      return response;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error al consultar cobros PinPad huerfanos';
      set({ pinpadOrphansError: errorMessage, isPinpadOrphansLoading: false });
      throw error;
    }
  },

  voidPinPadOperation: async (provider, id, reason) => {
    const trimmed = (reason || '').trim();
    if (!trimmed) {
      throw new Error('Debe indicar un motivo para anular el cobro.');
    }
    const response = await posService.voidPinPadOperation(provider, id, trimmed);
    // Refrescar la lista local removiendo el anulado (si voided) o
    // dejandola tal cual (si ya no estaba en UNCONSUMED).
    if (response.voided) {
      const { pinpadOrphans } = get();
      const remaining = pinpadOrphans.filter((op) => op.id !== id);
      const totalCents = remaining.reduce((sum, op) => sum + op.amountCents, 0);
      set({ pinpadOrphans: remaining, pinpadOrphansTotalCents: totalCents });
    }
    return response.voided;
  },

  // Top sellers actions
  loadTopSellers: async (cashRegisterId, limit = 40) => {
    const state = get();
    const registerId =
      cashRegisterId || state.selectedCashRegister?.id || state.currentSession?.cashRegisterId;

    if (!registerId) {
      return;
    }

    set({ isTopSellersLoading: true });

    try {
      const products = await posService.getTopSellers(registerId, limit);

      const withCachedImages = await Promise.all(
        products.map(async (product) => {
          const imageDataUrl = await preloadImageAsDataUrl(product.imageUrl);
          return normalizeTopSellerProduct({
            ...product,
            imageDataUrl,
            imageUrl: imageDataUrl || product.imageUrl,
          });
        })
      );

      const now = new Date().toISOString();
      set({
        topSellers: withCachedImages,
        isTopSellersLoading: false,
        topSellersLastUpdatedAt: now,
        salesSinceTopSellersRefresh: 0,
      });

      await persistTopSellers(withCachedImages, registerId, 0);
    } catch (error) {
      console.warn('⚠️ [POS_STORE] No se pudo cargar top sellers:', error);
      set({ isTopSellersLoading: false });

      // Mantener datos cacheados sin interrumpir operación
      const cached = await AsyncStorage.getItem(TOP_SELLERS_STORAGE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as Product[];
          set({ topSellers: parsed.map(normalizeTopSellerProduct) });
        } catch {
          // Ignorar errores de parseo
        }
      }
    }
  },

  refreshTopSellersInBackground: async (cashRegisterId, limit = 40) => {
    setTimeout(() => {
      void get().loadTopSellers(cashRegisterId, limit);
    }, 0);
  },

  incrementSalesCounterAndRefreshTopSellers: async () => {
    const state = get();
    const nextCounter = state.salesSinceTopSellersRefresh + 1;
    set({ salesSinceTopSellersRefresh: nextCounter });

    if (nextCounter >= 10) {
      const registerId = state.selectedCashRegister?.id || state.currentSession?.cashRegisterId;
      set({ salesSinceTopSellersRefresh: 0 });
      await persistTopSellers(state.topSellers, registerId, 0);
      void get().refreshTopSellersInBackground(registerId, 40);
      return;
    }

    const registerId = state.selectedCashRegister?.id || state.currentSession?.cashRegisterId;
    await persistTopSellers(state.topSellers, registerId, nextCounter);
  },

  resetTopSellersState: () => {
    set({
      topSellers: [],
      isTopSellersLoading: false,
      topSellersLastUpdatedAt: null,
      salesSinceTopSellersRefresh: 0,
    });
    void AsyncStorage.removeItem(TOP_SELLERS_STORAGE_KEY);
    void AsyncStorage.removeItem(TOP_SELLERS_META_STORAGE_KEY);
  },

  // Utility
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  // Initialize store from AsyncStorage
  initializeFromStorage: async () => {
    try {
      // Cargar sesión guardada
      const sessionData = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        console.log('🔄 Sesión cargada desde AsyncStorage:', session.id);
        set({ currentSession: session });
      } else {
        console.log('ℹ️ No hay sesión guardada en AsyncStorage');
      }

      const cachedPaymentMethods = await AsyncStorage.getItem(PAYMENT_METHODS_STORAGE_KEY);
      if (cachedPaymentMethods) {
        try {
          const paymentMethods = JSON.parse(cachedPaymentMethods) as PaymentMethod[];
          set({ paymentMethods });
        } catch (parseError) {
          console.warn('⚠️ [POS_STORE] Error cargando payment methods cacheados:', parseError);
        }
      }

      const cachedTopSellers = await AsyncStorage.getItem(TOP_SELLERS_STORAGE_KEY);
      const cachedTopSellersMeta = await AsyncStorage.getItem(TOP_SELLERS_META_STORAGE_KEY);

      if (cachedTopSellers) {
        try {
          const topSellers = (JSON.parse(cachedTopSellers) as Product[]).map(
            normalizeTopSellerProduct
          );
          const meta = cachedTopSellersMeta
            ? (JSON.parse(cachedTopSellersMeta) as {
                updatedAt?: string;
                salesCounter?: number;
              })
            : undefined;

          set({
            topSellers,
            topSellersLastUpdatedAt: meta?.updatedAt || null,
            salesSinceTopSellersRefresh: meta?.salesCounter || 0,
          });
        } catch (parseError) {
          console.warn('⚠️ [POS_STORE] Error cargando top sellers cacheados:', parseError);
        }
      }

      // Restaurar carrito persistido. Solo se aplica si la caja del carrito
      // coincide con la caja actualmente seleccionada (evita cruzar carritos
      // entre cajas distintas). Si no hay caja seleccionada todavía, también
      // se restaura: el flujo posterior de setSelectedCashRegister limpiará
      // si el usuario elige una caja distinta.
      const cartData = await AsyncStorage.getItem(CART_STORAGE_KEY);
      if (cartData) {
        try {
          const persisted = JSON.parse(cartData) as PersistedCart;
          const currentRegisterId = get().selectedCashRegister?.id ?? null;
          const sameRegister =
            currentRegisterId === null || persisted.cashRegisterId === currentRegisterId;

          if (sameRegister) {
            set({
              cartItems: persisted.cartItems ?? [],
              cartPayments: persisted.cartPayments ?? [],
            });
            console.log('🛒 Carrito restaurado desde AsyncStorage:', {
              items: persisted.cartItems?.length || 0,
              payments: persisted.cartPayments?.length || 0,
            });
          } else {
            console.log('🛒 Carrito persistido pertenece a otra caja, descartando');
            await AsyncStorage.removeItem(CART_STORAGE_KEY);
          }
        } catch (parseError) {
          console.warn('⚠️ [POS_STORE] Error cargando carrito persistido:', parseError);
          await AsyncStorage.removeItem(CART_STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error('❌ Error cargando sesión desde AsyncStorage:', error);
    }
  },

  reset: () => {
    set({
      selectedCashRegister: null,
      currentSession: null,
      paymentMethods: [],
      topSellers: [],
      isTopSellersLoading: false,
      topSellersLastUpdatedAt: null,
      salesSinceTopSellersRefresh: 0,
      cartItems: [],
      cartPayments: [],
      isLoading: false,
      error: null,
    });
    void AsyncStorage.removeItem(STORAGE_KEY);
    void AsyncStorage.removeItem(SESSION_STORAGE_KEY);
    void AsyncStorage.removeItem(TOP_SELLERS_STORAGE_KEY);
    void AsyncStorage.removeItem(TOP_SELLERS_META_STORAGE_KEY);
    void AsyncStorage.removeItem(CART_STORAGE_KEY);
  },
}));

// Initialize store on app start
initializeStore().then((initialState) => {
  if (initialState.selectedCashRegister) {
    usePOSStore.setState(initialState);
  }
});
