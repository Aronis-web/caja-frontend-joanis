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
  setCurrentSession: (session: Session | null) => void;

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
  ) => Promise<{ saleId: string; message: string }>;

  // Utility
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const STORAGE_KEY = '@caja:selected_cash_register';

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
      const session = await posService.openSession({
        cashRegisterId,
        userId,
        openingBalance,
        notes,
      });
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
      const session = await posService.closeSession(sessionId, {
        closingBalance,
        notes,
      });
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
      set({ currentSession: session, isLoading: false });
    } catch (error) {
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

  setCurrentSession: (session) => {
    set({ currentSession: session });
  },

  // Payment Methods actions
  loadPaymentMethods: async () => {
    try {
      set({ isLoading: true, error: null });
      const paymentMethods = await posService.getPaymentMethods();
      set({ paymentMethods, isLoading: false });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to load payment methods';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  // Cart actions
  addItemToCart: (product, quantity) => {
    const { cartItems } = get();
    const existingIndex = cartItems.findIndex((item) => item.productId === product.id);

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
        quantity,
        unitPrice: product.price,
        discount: 0,
        taxRate: product.taxRate,
      };
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
      const itemSubtotal = item.quantity * item.unitPrice - (item.discount || 0);
      return total + itemSubtotal;
    }, 0);
  },

  getCartTax: () => {
    const { cartItems } = get();
    return cartItems.reduce((total, item) => {
      const itemSubtotal = item.quantity * item.unitPrice - (item.discount || 0);
      const itemTax = itemSubtotal * (item.taxRate / 100);
      return total + itemTax;
    }, 0);
  },

  getCartDiscount: () => {
    const { cartItems } = get();
    return cartItems.reduce((total, item) => total + (item.discount || 0), 0);
  },

  getCartTotal: () => {
    return get().getCartSubtotal() + get().getCartTax();
  },

  getPaymentsTotal: () => {
    const { cartPayments } = get();
    return cartPayments.reduce((total, payment) => total + payment.amount, 0);
  },

  // Sales actions
  createSale: async (customerId, documentType = '03', notes) => {
    const { currentSession, cartItems, cartPayments } = get();

    if (!currentSession) {
      throw new Error('No active session');
    }

    if (cartItems.length === 0) {
      throw new Error('Cart is empty');
    }

    const total = get().getCartTotal();
    const paymentsTotal = get().getPaymentsTotal();

    if (Math.abs(total - paymentsTotal) > 0.01) {
      throw new Error('Payment total does not match sale total');
    }

    try {
      set({ isLoading: true, error: null });

      const response = await posService.createSale(currentSession.id, {
        customerId,
        documentType,
        items: cartItems,
        payments: cartPayments,
        notes,
      });

      // Clear cart after successful sale
      get().clearCart();
      get().clearPayments();

      // Refresh session to update balance
      await get().refreshSession();

      set({ isLoading: false });

      return {
        saleId: response.sale.id,
        message: response.message,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create sale';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  // Utility
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

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
