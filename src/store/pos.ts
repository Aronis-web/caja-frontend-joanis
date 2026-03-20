/**
 * POS Store
 * Manages POS state using Zustand
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { posService } from '@/services/POSService';
import type {
  CashRegister,
  Session,
  PaymentMethod,
  Product,
  SaleItem,
  SalePayment,
  CreateSaleResponse,
} from '@/types/pos';

interface POSState {
  // Current state
  selectedCashRegister: CashRegister | null;
  currentSession: Session | null;
  paymentMethods: PaymentMethod[];

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

  addPaymentToCart: (paymentMethodId: string, amount: number) => void;
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

  // Utility
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  initializeFromStorage: () => Promise<void>;
  reset: () => void;
}

const STORAGE_KEY = '@caja:selected_cash_register';
const SESSION_STORAGE_KEY = '@pos_current_session';

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
  cartItems: [],
  cartPayments: [],
  isLoading: false,
  error: null,

  // Cash Register actions
  setSelectedCashRegister: async (cashRegister) => {
    set({ selectedCashRegister: cashRegister });
    if (cashRegister) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cashRegister));
      // Load active session if exists
      try {
        await get().loadActiveSession(cashRegister.id);
      } catch (error) {
        // No active session, that's ok
        set({ currentSession: null });
      }
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
      set({ currentSession: null });
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
      set({ paymentMethods, isLoading: false });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to load payment methods';
      console.error('❌ Error loading payment methods:', errorMessage);
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  // Cart actions
  addItemToCart: (product, quantity) => {
    const { cartItems } = get();
    const existingIndex = cartItems.findIndex((item) => item.productId === product.id);

    console.log('🛒 Agregando al carrito:', {
      name: product.name,
      code: product.code,
      price: product.price,
      imageUrl: product.imageUrl,
      taxRate: product.taxRate,
    });

    if (existingIndex >= 0) {
      // Update existing item
      const newItems = [...cartItems];
      newItems[existingIndex].quantity += quantity;
      set({ cartItems: newItems });
    } else {
      // Add new item
      const newItem: SaleItem = {
        productId: product.id,
        productName: product.name,
        productCode: product.code,
        quantity,
        unitPrice: product.price,
        discount: 0,
        taxRate: product.taxRate,
        imageUrl: product.imageUrl,
      };
      console.log('✅ Item agregado al carrito:', newItem);
      set({ cartItems: [...cartItems, newItem] });
    }
  },

  updateCartItem: (index, quantity) => {
    const { cartItems } = get();
    if (quantity <= 0) {
      get().removeCartItem(index);
      return;
    }
    const newItems = [...cartItems];
    newItems[index].quantity = quantity;
    set({ cartItems: newItems });
  },

  removeCartItem: (index) => {
    const { cartItems } = get();
    const newItems = cartItems.filter((_, i) => i !== index);
    set({ cartItems: newItems });
  },

  clearCart: () => {
    set({ cartItems: [] });
  },

  addPaymentToCart: (paymentMethodId, amount) => {
    const { cartPayments, paymentMethods } = get();
    const paymentMethod = paymentMethods.find((pm) => pm.id === paymentMethodId);

    const newPayment: SalePayment = {
      paymentMethodId,
      paymentMethodName: paymentMethod?.name,
      amount,
    };
    set({ cartPayments: [...cartPayments, newPayment] });
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
  },

  removeCartPayment: (index) => {
    const { cartPayments } = get();
    const newPayments = cartPayments.filter((_, i) => i !== index);
    set({ cartPayments: newPayments });
  },

  clearPayments: () => {
    set({ cartPayments: [] });
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
  createSale: async (customerId, documentType = '03', notes) => {
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

    console.log('💰 [STORE] Total venta:', total);
    console.log('💳 [STORE] Total pagos:', paymentsTotal);

    // Permitir venta si el pago es mayor o igual al total
    if (paymentsTotal < total - 0.01) {
      console.error('❌ [STORE] Pago insuficiente');
      throw new Error('Payment amount is insufficient');
    }

    const change = paymentsTotal - total;
    if (change > 0) {
      console.log('💵 [STORE] Vuelto:', change);
    }

    try {
      set({ isLoading: true, error: null });

      // Determinar el tipo de venta según el tipo de documento
      const saleType = documentType === '01' ? 'B2B' : 'B2C';
      console.log('📄 [STORE] Tipo de venta:', saleType);

      // Convertir items al formato del nuevo endpoint
      const items = cartItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPriceCents: Math.round((item.unitPrice || 0) * 100),
        discountCents: Math.round((item.discount || 0) * 100),
      }));

      console.log('📦 [STORE] Items convertidos:', JSON.stringify(items, null, 2));

      // Procesar pagos según el tipo de método
      const totalCents = Math.round(total * 100);
      let remainingCents = totalCents;
      const payments = cartPayments.map((payment, index) => {
        const paymentMethod = paymentMethods.find((pm) => pm.id === payment.paymentMethodId);
        const isIzipay = paymentMethod?.code?.includes('IZIPAY') || paymentMethod?.isIzipay;
        const isCash = paymentMethod?.code === 'CASH' || paymentMethod?.isCash;

        let amountCents = Math.round(payment.amount * 100);

        console.log(`💳 [STORE] Procesando pago ${index + 1}:`, {
          method: paymentMethod?.name,
          code: paymentMethod?.code,
          isIzipay,
          isCash,
          originalAmount: payment.amount,
          remaining: remainingCents / 100,
        });

        // Si es IZIPAY, el monto no puede exceder el total de la venta
        if (isIzipay) {
          if (amountCents > totalCents) {
            console.warn(
              `⚠️ [STORE] IZIPAY: Monto ${amountCents / 100} excede total ${totalCents / 100}, ajustando a total`
            );
            amountCents = totalCents;
          }
        }

        // Si es EFECTIVO, enviar solo el monto necesario (restante sin tarjeta)
        if (isCash) {
          // Si hay otros pagos (tarjeta), enviar solo el restante
          if (cartPayments.length > 1) {
            amountCents = Math.min(amountCents, remainingCents);
            console.log(`💵 [STORE] EFECTIVO: Ajustando a restante ${amountCents / 100}`);
          } else {
            // Si es el único pago, enviar el total de la venta
            amountCents = totalCents;
            console.log(`💵 [STORE] EFECTIVO único: Enviando total ${amountCents / 100}`);
          }
        }

        remainingCents -= amountCents;

        return {
          paymentMethodId: payment.paymentMethodId,
          amountCents,
          referenceNumber: `PAY-${Date.now()}-${index}`,
          notes: paymentMethod?.name || 'Pago',
        };
      });

      console.log('💳 [STORE] Pagos procesados:', JSON.stringify(payments, null, 2));

      const requestData = {
        saleType,
        ...(customerId && { customerId }),
        items,
        payments,
        notes,
      };

      console.log('📤 [STORE] Enviando request:', JSON.stringify(requestData, null, 2));

      const response = await posService.createSale(currentSession.id, requestData);

      console.log('✅ [STORE] Respuesta recibida:', JSON.stringify(response, null, 2));

      // Clear cart after successful sale
      get().clearCart();
      get().clearPayments();

      // Refresh session to update balance
      await get().refreshSession();

      set({ isLoading: false });

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create sale';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
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
    } catch (error) {
      console.error('❌ Error cargando sesión desde AsyncStorage:', error);
    }
  },

  reset: () => {
    set({
      selectedCashRegister: null,
      currentSession: null,
      paymentMethods: [],
      cartItems: [],
      cartPayments: [],
      isLoading: false,
      error: null,
    });
    AsyncStorage.removeItem(STORAGE_KEY);
  },
}));

// Initialize store on app start
initializeStore().then((initialState) => {
  if (initialState.selectedCashRegister) {
    usePOSStore.setState(initialState);
  }
});
