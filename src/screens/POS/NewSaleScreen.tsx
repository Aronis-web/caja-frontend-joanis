/**
 * New Sale Screen
 * Main POS sale interface with product search and cart
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
  Platform,
  Linking,
  Keyboard,
  useWindowDimensions,
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { usePOSStore } from '@/store/pos';
import { useAuthStore } from '@/store/auth';
import { useOfflineStore } from '@/store/offline';
import { usePinPadStore } from '@/store/pinpad';
import { useCollectionsStore } from '@/store/collections';
import { posService } from '@/services/POSService';
import { networkMonitor } from '@/services/NetworkMonitor';
import { offlineLoginService } from '@/services/OfflineLoginService';
import QRCode from 'qrcode';
import { OfflineModeSwitch } from '@/components/offline';
import type { PinPadTransactionResponse } from '@/types/pinpad';
import type {
  Product,
  Customer,
  CreateSaleResponse,
  ActiveSalesResponse,
  CreateCustomerRequest,
} from '@/types/pos';
import type {
  OfflineProduct,
  OfflineSale,
  OfflineSaleItem,
  OfflineSalePayment,
} from '@/types/offline';
import { ROUTES } from '@/constants/routes';
import { mapOfflineProductToProduct } from '@/utils/posMappers';
import { CashAlertLevel } from '@/types/collections';
import { calculateRemainingCents, isIzipayAmountValid, toCents } from '@/utils/paymentFlow';
import { useTheme, useThemedStyles, type Theme } from '@/design-system';

export default function NewSaleScreen() {
  const navigation = useNavigation();
  const { width: windowWidth } = useWindowDimensions();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const {
    selectedCashRegister,
    currentSession,
    cartItems,
    cartPayments,
    paymentMethods,
    addItemToCart,
    updateCartItem,
    removeCartItem,
    clearCart,
    addPaymentToCart,
    updateCartPayment,
    removeCartPayment,
    clearPayments,
    getCartTotal,
    getCartSubtotal,
    getCartTax,
    getCartDiscount,
    getPaymentsTotal,
    createSale,
    topSellers,
    isTopSellersLoading,
    isLoading,
    initializeFromStorage,
    loadPaymentMethods,
    loadActiveSession,
    refreshTopSellersInBackground,
  } = usePOSStore();

  // Offline store
  const {
    isOfflineModeEnabled,
    connectionStatus,
    availableTokens,
    pendingSales,
    isInitialized: isOfflineInitialized,
    initialize: initializeOffline,
    searchProductsOffline,
    getProductByBarcode: getProductByBarcodeOffline,
    createOfflineSale,
    setConnectionStatus,
    enableOfflineMode,
  } = useOfflineStore();

  // Auth: sesión offline pura (sin caja/turno seleccionados online)
  const isOfflineSession = useAuthStore((s) => s.isOfflineSession);

  // PinPad store
  const {
    status: pinPadStatus,
    isProcessing: isPinPadProcessing,
    lastTransaction: lastPinPadTransaction,
    lastError: pinPadError,
    connect: connectPinPad,
    processSale: processPinPadSale,
  } = usePinPadStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [showBarcodeSelectionModal, setShowBarcodeSelectionModal] = useState(false);
  const [barcodeSelectionProducts, setBarcodeSelectionProducts] = useState<Product[]>([]);
  const [lastScannedBarcode, setLastScannedBarcode] = useState('');

  const [documentType, setDocumentType] = useState<'03' | '01'>('03');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [showRecentSales, setShowRecentSales] = useState(false);

  // Customer autocomplete states
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerSearchRequestIdRef = useRef(0);
  const latestCustomerSearchQueryRef = useRef('');

  // Product search - descartar respuestas obsoletas y aplicar debounce
  const productSearchRequestIdRef = useRef(0);
  const latestProductSearchQueryRef = useRef('');
  const productSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Barcode scanner - buffer y timing en refs (sin re-renders)
  const barcodeBufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const handleBarcodeScannedRef = useRef<(query: string) => Promise<void> | void>(() => {});

  // Add Customer Modal states
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [addCustomerLoading, setAddCustomerLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState<{
    customerType: 'PERSONA' | 'EMPRESA';
    documentType: 'DNI' | 'RUC';
    documentNumber: string;
    nombres: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    razonSocial: string;
    email: string;
    phone: string;
    address: string;
    aceptaPublicidad: boolean;
  }>({
    customerType: 'PERSONA',
    documentType: 'DNI',
    documentNumber: '',
    nombres: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    razonSocial: '',
    email: '',
    phone: '',
    address: '',
    aceptaPublicidad: true,
  });

  // Offline Customer Modal states
  const [showOfflineCustomerModal, setShowOfflineCustomerModal] = useState(false);
  const [offlineCustomerData, setOfflineCustomerData] = useState<{
    documentType: 'DNI' | 'RUC';
    documentNumber: string;
    fullName: string;
  }>({
    documentType: 'DNI',
    documentNumber: '',
    fullName: '',
  });

  const [activeSalesData, setActiveSalesData] = useState<ActiveSalesResponse | null>(null);
  const [loadingSales, setLoadingSales] = useState(false);
  const [salesPerPage] = useState(20);
  const [showSaleSuccessModal, setShowSaleSuccessModal] = useState(false);
  const [saleResponse, setSaleResponse] = useState<CreateSaleResponse | null>(null);
  const [saleChange, setSaleChange] = useState(0); // Vuelto de la venta

  // Estados para venta offline
  const [showOfflineSaleSuccessModal, setShowOfflineSaleSuccessModal] = useState(false);
  const [offlineSaleResponse, setOfflineSaleResponse] = useState<OfflineSale | null>(null);
  const [offlineSaleChange, setOfflineSaleChange] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);
  const [showCreditNoteManagementModal, setShowCreditNoteManagementModal] = useState(false);
  const [creditNoteType, setCreditNoteType] = useState<'total' | 'partial' | null>(null);
  const [selectedSaleForCreditNote, setSelectedSaleForCreditNote] = useState<any>(null);
  const [selectedSaleForCreditNoteManagement, setSelectedSaleForCreditNoteManagement] =
    useState<any>(null);
  const [creditNoteReturnedQuantities, setCreditNoteReturnedQuantities] = useState<
    Record<string, number>
  >({});
  const [loadingCreditNoteManagement, setLoadingCreditNoteManagement] = useState(false);
  const [selectedProductsForCreditNote, setSelectedProductsForCreditNote] = useState<string[]>([]);
  const [creditNoteProductQuantities, setCreditNoteProductQuantities] = useState<
    Record<string, string>
  >({});
  const [creditNoteRemainingMode, setCreditNoteRemainingMode] = useState(false);
  const [creditNoteMotivo, setCreditNoteMotivo] = useState<string>('06');
  const [creditNoteSustento, setCreditNoteSustento] = useState<string>('');
  const [generatingCreditNote, setGeneratingCreditNote] = useState(false);

  // Payment method selection states
  const [selectedParentMethod, setSelectedParentMethod] = useState<string | null>(null);
  const [selectedSubmethod, setSelectedSubmethod] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  // PinPad states
  const [showPinPadModal, setShowPinPadModal] = useState(false);
  const isConfirmingSaleRef = useRef(false);
  const [isConfirmingSale, setIsConfirmingSale] = useState(false);
  const [pinPadProcessing, setPinPadProcessing] = useState(false);
  const [pinPadMessage, setPinPadMessage] = useState('');
  const [pinPadAmountPending, setPinPadAmountPending] = useState(0);
  const [pinPadMethodPending, setPinPadMethodPending] = useState<string | null>(null);
  const [pinPadMethodNamePending, setPinPadMethodNamePending] = useState<string>('');

  const { cashStatus, fetchCashStatus } = useCollectionsStore();

  // Initialize store from AsyncStorage on mount
  useEffect(() => {
    const initialize = async () => {
      console.log('🔄 Inicializando store desde AsyncStorage...');
      setIsInitializing(true);

      await initializeFromStorage();

      // Si hay una caja registradora seleccionada pero no hay sesión, intentar cargar la sesión activa.
      // En sesión offline pura no hay caja seleccionada ni red, así que salteamos esta llamada.
      if (!isOfflineSession && selectedCashRegister && !currentSession) {
        console.log('🔄 Intentando cargar sesión activa para caja:', selectedCashRegister.code);
        try {
          await loadActiveSession(selectedCashRegister.id);
        } catch (error) {
          console.log('ℹ️ No hay sesión activa para esta caja');
        }
      }

      // Load payment methods
      console.log('💳 Cargando métodos de pago...');
      await loadPaymentMethods();

      // Initialize offline system
      console.log('📴 Inicializando sistema offline...');
      await initializeOffline();

      // En sesión offline pura, activar modo offline para que búsqueda/venta usen la BD local.
      if (isOfflineSession) {
        await enableOfflineMode();
      }

      setIsInitializing(false);
    };
    initialize();
  }, []);

  // Initialize network monitor
  useEffect(() => {
    console.log('🌐 Iniciando monitor de red...');
    networkMonitor.start();

    const unsubscribe = networkMonitor.subscribe((isOnline) => {
      setConnectionStatus(isOnline ? 'ONLINE' : 'OFFLINE');
    });

    return () => {
      unsubscribe();
      networkMonitor.stop();
    };
  }, []);

  useEffect(() => {
    // Solo redirigir si ya terminó de inicializar y no hay sesión.
    // En sesión offline pura no existe turno y no debemos redirigir al dashboard.
    if (!isInitializing && !currentSession && !isOfflineSession) {
      console.log('⚠️ No hay sesión activa después de inicializar, redirigiendo a dashboard');
      navigation.navigate(ROUTES.POS_DASHBOARD as never);
    }
  }, [currentSession, isInitializing, isOfflineSession, navigation]);

  useEffect(() => {
    if (selectedCashRegister?.id) {
      void refreshTopSellersInBackground(selectedCashRegister.id, 40);
    }
  }, [selectedCashRegister?.id, refreshTopSellersInBackground]);

  // Mantener actualizada la ref al handler de escaneo (evita closures obsoletos
  // en el listener global, que se monta una sola vez).
  useEffect(() => {
    handleBarcodeScannedRef.current = handleBarcodeScanned;
  });

  // Listener global para capturar escaneo de código de barras.
  // Distingue escáner (teclas a < 30ms) de tipeo manual; cualquier tecla "lenta"
  // reinicia el buffer, por lo que tipear en el TextInput no contamina el escáner.
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let barcodeTimeout: ReturnType<typeof setTimeout> | null = null;

    const SCANNER_KEY_INTERVAL_MS = 30;
    const SCANNER_MIN_LENGTH = 4;
    const BUFFER_RESET_MS = 200;

    const handleKeyPress = (event: KeyboardEvent) => {
      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;

      if (event.key === 'Enter') {
        const buffer = barcodeBufferRef.current;
        barcodeBufferRef.current = '';
        lastKeyTimeRef.current = currentTime;
        if (barcodeTimeout) {
          clearTimeout(barcodeTimeout);
          barcodeTimeout = null;
        }
        // Solo procesar como escáner si el buffer alcanzó la longitud mínima
        // (tipeo manual habrá sido reseteado por el chequeo de timing previo).
        if (buffer.length >= SCANNER_MIN_LENGTH) {
          event.preventDefault();
          console.log('📷 Código de barras capturado:', buffer);
          void handleBarcodeScannedRef.current(buffer);
        }
        return;
      }

      // Ignorar teclas especiales (modificadores, flechas, etc.)
      if (event.key.length > 1) {
        lastKeyTimeRef.current = currentTime;
        return;
      }

      // Tecla "lenta" => tipeo manual o pausa: reiniciar buffer
      if (timeDiff > SCANNER_KEY_INTERVAL_MS) {
        barcodeBufferRef.current = '';
      }

      barcodeBufferRef.current += event.key;
      lastKeyTimeRef.current = currentTime;

      if (barcodeTimeout) clearTimeout(barcodeTimeout);
      barcodeTimeout = setTimeout(() => {
        barcodeBufferRef.current = '';
      }, BUFFER_RESET_MS);
    };

    window.addEventListener('keypress', handleKeyPress);

    return () => {
      window.removeEventListener('keypress', handleKeyPress);
      if (barcodeTimeout) clearTimeout(barcodeTimeout);
    };
  }, []);

  // Cleanup del debounce de búsqueda al desmontar
  useEffect(() => {
    return () => {
      if (productSearchDebounceRef.current) {
        clearTimeout(productSearchDebounceRef.current);
        productSearchDebounceRef.current = null;
      }
    };
  }, []);

  // Ejecuta la búsqueda real, descartando respuestas obsoletas y filtrando OOS.
  const runProductSearch = async (query: string) => {
    const requestId = productSearchRequestIdRef.current + 1;
    productSearchRequestIdRef.current = requestId;

    const isStale = () =>
      requestId !== productSearchRequestIdRef.current ||
      query !== latestProductSearchQueryRef.current;

    try {
      if (isOfflineModeEnabled) {
        console.log('📴 Buscando en modo OFFLINE...');
        const offlineResults = await searchProductsOffline(query, 20);
        if (isStale()) return;
        const mapped: Product[] = offlineResults
          .filter((p) => p.localStock > 0)
          .map(mapOfflineProductToProduct);
        console.log('✅ Productos encontrados (offline):', mapped.length);
        setSearchResults(mapped);
        return;
      }

      if (!currentSession) {
        console.error('❌ No hay sesión activa');
        Alert.alert('Error', 'No hay una sesión activa. Por favor, abre una sesión primero.');
        setSearchResults([]);
        return;
      }

      console.log('🚀 Iniciando búsqueda de productos...');
      const results = await posService.searchProducts(query, 20, currentSession.cashRegisterId);
      if (isStale()) return;
      const filtered = results.filter((p) => (p.stock ?? p.availableStock ?? 0) > 0);
      console.log(`✅ Productos encontrados: ${results.length} (con stock: ${filtered.length})`);
      setSearchResults(filtered);
    } catch (error) {
      if (isStale()) return;
      console.error('❌ Error searching products:', error);
      const msg = ((error as Error)?.message || '').toLowerCase();
      if (msg.includes('sesi') && msg.includes('expir')) {
        Alert.alert(
          'Sesión expirada',
          'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'
        );
      } else {
        Alert.alert('Error', 'No se pudieron buscar productos. Verifica tu conexión.');
      }
      setSearchResults([]);
    } finally {
      if (requestId === productSearchRequestIdRef.current) {
        setSearching(false);
      }
    }
  };

  const handleSearchProducts = (query: string) => {
    setSearchQuery(query);
    latestProductSearchQueryRef.current = query;

    if (productSearchDebounceRef.current) {
      clearTimeout(productSearchDebounceRef.current);
      productSearchDebounceRef.current = null;
    }

    if (query.length < 2) {
      // Invalidar cualquier respuesta en vuelo y limpiar resultados
      productSearchRequestIdRef.current += 1;
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    productSearchDebounceRef.current = setTimeout(() => {
      void runProductSearch(query);
    }, 250);
  };

  // Manejar escaneo de código de barras (cuando se presiona Enter en el escáner).
  // Respeta modo offline para no cruzar stock online con la BD local.
  const handleBarcodeScanned = async (query: string) => {
    console.log('📷 Código escaneado:', query);

    if (!query || query.length < 2) {
      console.log('⚠️ Código muy corto, ignorando');
      return;
    }

    // ============ MODO OFFLINE ============
    if (isOfflineModeEnabled) {
      try {
        setSearching(true);
        // Primero intentar barcode exacto, luego búsqueda por texto
        const byBarcode = await getProductByBarcodeOffline(query);
        const offlineProducts: OfflineProduct[] = byBarcode
          ? [byBarcode]
          : await searchProductsOffline(query, 20);

        const inStock = offlineProducts.filter((p) => p.localStock > 0);
        const mapped: Product[] = inStock.map(mapOfflineProductToProduct);

        if (mapped.length === 0) {
          Alert.alert(
            'No encontrado',
            offlineProducts.length > 0
              ? `El producto con código "${query}" no tiene stock disponible offline.`
              : `No se encontró ningún producto con el código: ${query}`
          );
        } else if (mapped.length === 1) {
          await handleAddProduct(mapped[0]);
          setSearchQuery('');
          setSearchResults([]);
        } else {
          setLastScannedBarcode(query);
          setBarcodeSelectionProducts(mapped);
          setShowBarcodeSelectionModal(true);
          setSearchResults([]);
        }
      } catch (error) {
        console.error('❌ Error al procesar código offline:', error);
        Alert.alert('Error', 'No se pudo procesar el código en modo offline.');
      } finally {
        setSearching(false);
      }
      return;
    }

    // ============ MODO ONLINE ============
    if (!currentSession) {
      console.error('❌ No hay sesión activa');
      Alert.alert('Error', 'No hay una sesión activa. Por favor, abre una sesión primero.');
      return;
    }

    try {
      setSearching(true);

      // Si el código tiene 8 dígitos, buscar cliente (DNI)
      if (query.length === 8 && /^\d+$/.test(query)) {
        console.log('👤 Código de 8 dígitos detectado, buscando cliente por DNI...');
        try {
          const customerResults = await posService.autocompleteCustomers(query, 10);

          if (customerResults.data.length > 0) {
            const exactMatch = customerResults.data.find(
              (customer) => customer.documentNumber === query
            );

            if (exactMatch) {
              console.log('✅ Cliente encontrado:', exactMatch.fullName || exactMatch.name);
              if (selectedCustomer) {
                console.log('🔄 Reemplazando cliente anterior:', selectedCustomer.name);
              }
              handleSelectCustomer(exactMatch);
              setSearching(false);
              return;
            }
          }

          console.log('ℹ️ No se encontró cliente con DNI:', query);
        } catch (customerError) {
          console.log('⚠️ Error al buscar cliente, continuando con búsqueda de producto');
        }
      }

      console.log('🔍 Buscando producto por código de barras...');
      const results = await posService.searchProducts(query, 20, currentSession.cashRegisterId);
      const inStock = results.filter((p) => (p.stock ?? p.availableStock ?? 0) > 0);

      if (inStock.length === 0) {
        console.log('❌ No se encontró producto con stock para ese código');
        Alert.alert(
          'No encontrado',
          results.length > 0
            ? `El producto con código "${query}" no tiene stock disponible.`
            : `No se encontró ningún producto o cliente con el código: ${query}`
        );
      } else if (inStock.length === 1) {
        console.log('✅ Producto encontrado, agregando al carrito automáticamente');
        await handleAddProduct(inStock[0]);
        setSearchQuery('');
        setSearchResults([]);
      } else {
        console.log(`⚠️ Se encontraron ${inStock.length} productos con el mismo código`);
        setLastScannedBarcode(query);
        setBarcodeSelectionProducts(inStock);
        setShowBarcodeSelectionModal(true);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('❌ Error al procesar código escaneado:', error);
      const msg = ((error as Error)?.message || '').toLowerCase();
      if (msg.includes('sesi') && msg.includes('expir')) {
        Alert.alert(
          'Sesión expirada',
          'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'
        );
      } else {
        Alert.alert('Error', 'No se pudo procesar el código. Verifica tu conexión.');
      }
      // No limpiamos searchQuery: preservamos lo tipeado por el usuario
    } finally {
      setSearching(false);
    }
  };

  const handleAddProduct = async (product: Product) => {
    try {
      console.log(`📦 Agregando producto: ${product.name}`);
      console.log(`📸 Imagen del producto: ${product.imageUrl || 'Sin imagen'}`);
      console.log(`💰 Precio de venta: S/ ${product.price || 0}`);
      console.log(`📊 Stock disponible: ${product.stock || 0} unidades`);

      // El nuevo endpoint ya incluye el stock disponible
      const stock = product.stock || 0;

      if (!stock || stock <= 0) {
        Alert.alert('Sin Stock', `El producto "${product.name}" no tiene stock disponible.`);
        return;
      }

      // Verificar si la cantidad ya en carrito alcanza el stock disponible
      const currentCartQty = cartItems.find((item) => item.productId === product.id)?.quantity || 0;
      if (currentCartQty >= stock) {
        Alert.alert(
          'Stock máximo alcanzado',
          `Solo hay ${stock} unidad(es) disponible(s) de "${product.name}" y ya están en el carrito.`
        );
        return;
      }

      // El producto ya viene con toda la información necesaria del endpoint
      addItemToCart(product, 1);
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      console.error('❌ Error al agregar producto:', error);
      Alert.alert('Error', 'No se pudo agregar el producto. Intenta nuevamente.');
    }
  };

  const handleSelectBarcodeProduct = async (product: Product) => {
    await handleAddProduct(product);
    setShowBarcodeSelectionModal(false);
    setBarcodeSelectionProducts([]);
    setLastScannedBarcode('');
  };

  const handleCloseBarcodeSelectionModal = () => {
    setShowBarcodeSelectionModal(false);
    setBarcodeSelectionProducts([]);
    setLastScannedBarcode('');
  };

  const handleSearchCustomers = async (query: string) => {
    const normalizedQuery = query.trim();
    setCustomerSearchQuery(query);
    latestCustomerSearchQueryRef.current = normalizedQuery;

    if (normalizedQuery.length < 2) {
      customerSearchRequestIdRef.current += 1;
      setCustomerSearchResults([]);
      setShowCustomerDropdown(false);
      setSearchingCustomers(false);
      return;
    }

    const requestId = customerSearchRequestIdRef.current + 1;
    customerSearchRequestIdRef.current = requestId;

    try {
      setSearchingCustomers(true);
      const response = await posService.autocompleteCustomers(normalizedQuery, 10);

      if (
        requestId !== customerSearchRequestIdRef.current ||
        normalizedQuery !== latestCustomerSearchQueryRef.current
      ) {
        return;
      }

      setCustomerSearchResults(response.data);
      // Mostrar dropdown si hay resultados O si es un DNI/RUC válido para agregar
      const isValidDNI = /^\d{8}$/.test(normalizedQuery);
      const isValidRUC = /^\d{11}$/.test(normalizedQuery);
      setShowCustomerDropdown(response.data.length > 0 || isValidDNI || isValidRUC);
    } catch (error) {
      if (
        requestId !== customerSearchRequestIdRef.current ||
        normalizedQuery !== latestCustomerSearchQueryRef.current
      ) {
        return;
      }

      console.error('❌ Error searching customers:', error);
      setCustomerSearchResults([]);
      // Aún mostrar dropdown si es DNI/RUC válido para permitir agregar
      const isValidDNI = /^\d{8}$/.test(normalizedQuery);
      const isValidRUC = /^\d{11}$/.test(normalizedQuery);
      setShowCustomerDropdown(isValidDNI || isValidRUC);
    } finally {
      if (requestId === customerSearchRequestIdRef.current) {
        setSearchingCustomers(false);
      }
    }
  };

  // Verificar si el query es un DNI o RUC válido
  const isValidDocumentQuery = () => {
    const query = customerSearchQuery.trim();
    const isValidDNI = /^\d{8}$/.test(query);
    const isValidRUC = /^\d{11}$/.test(query);
    return isValidDNI || isValidRUC;
  };

  // Abrir modal para agregar cliente con consulta a ApiPeru
  const handleOpenAddCustomerModal = async () => {
    const query = customerSearchQuery.trim();
    const isValidDNI = /^\d{8}$/.test(query);
    const isValidRUC = /^\d{11}$/.test(query);

    if (!isValidDNI && !isValidRUC) {
      Alert.alert('Error', 'Ingrese un DNI (8 dígitos) o RUC (11 dígitos) válido');
      return;
    }

    // Resetear datos del formulario
    setNewCustomerData({
      customerType: isValidRUC ? 'EMPRESA' : 'PERSONA',
      documentType: isValidRUC ? 'RUC' : 'DNI',
      documentNumber: query,
      nombres: '',
      apellidoPaterno: '',
      apellidoMaterno: '',
      razonSocial: '',
      email: '',
      phone: '',
      address: '',
      aceptaPublicidad: true,
    });

    setShowCustomerDropdown(false);
    setShowAddCustomerModal(true);

    // Consultar datos a ApiPeru
    setLookupLoading(true);
    try {
      if (isValidDNI) {
        const response = await posService.lookupDNI(query);
        if (response.success && response.data) {
          setNewCustomerData((prev) => ({
            ...prev,
            nombres: response.data!.nombres || '',
            apellidoPaterno: response.data!.apellido_paterno || '',
            apellidoMaterno: response.data!.apellido_materno || '',
          }));
        }
      } else if (isValidRUC) {
        const response = await posService.lookupRUC(query);
        if (response.success && response.data) {
          setNewCustomerData((prev) => ({
            ...prev,
            razonSocial: response.data!.nombre_o_razon_social || '',
            address: response.data!.direccion_completa || '',
          }));
        }
      }
    } catch (error) {
      console.error('⚠️ Error consultando datos:', error);
      // No mostrar error, el usuario puede llenar manualmente
    } finally {
      setLookupLoading(false);
    }
  };

  // Crear nuevo cliente
  const handleAddCustomer = async () => {
    const {
      customerType,
      documentType,
      documentNumber,
      nombres,
      apellidoPaterno,
      apellidoMaterno,
      razonSocial,
      email,
      phone,
      address,
    } = newCustomerData;

    // Validaciones
    if (customerType === 'PERSONA') {
      if (!nombres.trim() || !apellidoPaterno.trim()) {
        Alert.alert('Error', 'Debe ingresar nombres y apellido paterno');
        return;
      }
    } else {
      if (!razonSocial.trim()) {
        Alert.alert('Error', 'Debe ingresar la razón social');
        return;
      }
    }

    setAddCustomerLoading(true);
    try {
      const requestData: CreateCustomerRequest = {
        customerType,
        documentType,
        documentNumber,
        ...(customerType === 'PERSONA'
          ? {
              nombres: nombres.trim(),
              apellidoPaterno: apellidoPaterno.trim(),
              apellidoMaterno: apellidoMaterno.trim() || undefined,
            }
          : {
              razonSocial: razonSocial.trim(),
            }),
        ...(email.trim() && { email: email.trim() }),
        ...(phone.trim() && { phone: phone.trim() }),
        ...(address.trim() && { address: address.trim() }),
        aceptaPublicidad: newCustomerData.aceptaPublicidad,
      };

      const newCustomer = await posService.createCustomer(requestData);

      // Seleccionar automáticamente el cliente creado
      const customerToSelect: Customer = {
        id: newCustomer.id,
        name: newCustomer.fullName || newCustomer.name,
        fullName: newCustomer.fullName,
        documentType: newCustomer.documentType,
        documentNumber: newCustomer.documentNumber,
        email: newCustomer.email,
        phone: newCustomer.phone,
        address: newCustomer.address,
        customerType: newCustomer.customerType,
      };

      handleSelectCustomer(customerToSelect);
      setShowAddCustomerModal(false);

      Alert.alert('✅ Éxito', 'Cliente agregado correctamente');
    } catch (error: any) {
      console.error('❌ Error creando cliente:', error);
      Alert.alert('Error', error.message || 'No se pudo crear el cliente');
    } finally {
      setAddCustomerLoading(false);
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    const selectedLabel =
      customer.label || `${customer.fullName || customer.name} - ${customer.documentNumber}`;
    setCustomerSearchQuery(selectedLabel);
    latestCustomerSearchQueryRef.current = selectedLabel.trim();
    customerSearchRequestIdRef.current += 1;
    setCustomerSearchResults([]);
    setShowCustomerDropdown(false);
    setSearchingCustomers(false);

    // Determinar automáticamente el tipo de documento según el tipo de cliente
    if (customer.customerType === 'EMPRESA') {
      setDocumentType('01'); // Factura para empresas
    } else {
      setDocumentType('03'); // Boleta para personas naturales
    }
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerSearchQuery('');
    latestCustomerSearchQueryRef.current = '';
    customerSearchRequestIdRef.current += 1;
    setCustomerSearchResults([]);
    setShowCustomerDropdown(false);
    setSearchingCustomers(false);
    setDocumentType('03'); // Volver a boleta por defecto
  };

  // Offline Customer handlers
  const handleOpenOfflineCustomerModal = () => {
    setOfflineCustomerData({
      documentType: 'DNI',
      documentNumber: '',
      fullName: '',
    });
    setShowOfflineCustomerModal(true);
  };

  const handleSaveOfflineCustomer = () => {
    const { documentType: docType, documentNumber, fullName } = offlineCustomerData;

    // Validar documento
    if (docType === 'DNI' && !/^\d{8}$/.test(documentNumber)) {
      Alert.alert('Error', 'El DNI debe tener 8 dígitos');
      return;
    }
    if (docType === 'RUC' && !/^\d{11}$/.test(documentNumber)) {
      Alert.alert('Error', 'El RUC debe tener 11 dígitos');
      return;
    }

    // Validar nombre/razón social
    if (!fullName.trim()) {
      Alert.alert('Error', docType === 'RUC' ? 'Ingrese la razón social' : 'Ingrese el nombre');
      return;
    }

    // Determinar tipo de documento fiscal
    if (docType === 'RUC') {
      setDocumentType('01'); // Factura para RUC
    } else {
      setDocumentType('03'); // Boleta para DNI
    }

    setShowOfflineCustomerModal(false);
  };

  const handleClearOfflineCustomer = () => {
    setOfflineCustomerData({
      documentType: 'DNI',
      documentNumber: '',
      fullName: '',
    });
    setDocumentType('03');
  };

  const handleProcessSale = () => {
    if (cartItems.length === 0) {
      Alert.alert('Error', 'El carrito está vacío');
      return;
    }

    if (documentType === '01' && !selectedCustomer) {
      Alert.alert('Error', 'Debe seleccionar un cliente para emitir una factura');
      return;
    }

    setShowPaymentModal(true);
  };

  const handleLoadRecentSales = async (page: number = 1) => {
    if (!selectedCashRegister) return;

    // Validar que la página sea válida (mínimo 1)
    const validPage = Math.max(1, Math.floor(page));

    try {
      setLoadingSales(true);
      console.log('📊 [VENTAS] Cargando ventas de la sesión...');
      console.log('📊 [VENTAS] Cash Register ID:', selectedCashRegister.id);
      console.log('📊 [VENTAS] Página solicitada:', page);
      console.log('📊 [VENTAS] Página validada:', validPage);
      console.log('📊 [VENTAS] Límite por página:', salesPerPage);

      const salesData = await posService.getActiveSales(
        selectedCashRegister.id,
        validPage,
        salesPerPage
      );

      console.log('✅ [VENTAS] Respuesta del backend:', JSON.stringify(salesData, null, 2));
      console.log('📈 [VENTAS] Total de ventas en esta página:', salesData.sales?.length || 0);
      console.log(
        '📈 [VENTAS] Total de ventas en la sesión:',
        salesData.pagination?.totalSales || 0
      );
      console.log('📄 [VENTAS] Página actual:', salesData.pagination?.page || 1);
      console.log('📄 [VENTAS] Total de páginas:', salesData.pagination?.totalPages || 1);
      console.log('💰 [VENTAS] Total ventas (cents):', salesData.summary?.totalSales || 0);
      console.log('💳 [VENTAS] Total pagos (cents):', salesData.summary?.totalPayments || 0);

      if (salesData.sales && salesData.sales.length > 0) {
        console.log(
          '🔍 [VENTAS] Primera venta (ejemplo):',
          JSON.stringify(salesData.sales[0], null, 2)
        );
      }

      setActiveSalesData(salesData);
      setShowRecentSales(true);
    } catch (error) {
      console.error('❌ [VENTAS] Error loading active sales:', error);
      Alert.alert('Error', 'No se pudieron cargar las ventas de la sesión activa');
    } finally {
      setLoadingSales(false);
    }
  };

  const handleCompleteSale = async () => {
    if (isConfirmingSaleRef.current) {
      console.log('⏳ Confirmación de venta ya en progreso');
      return;
    }

    isConfirmingSaleRef.current = true;
    setIsConfirmingSale(true);
    console.log('🚀 handleCompleteSale iniciado');
    const total = getCartTotal();
    const paymentsTotal = getPaymentsTotal();
    const totalCents = toCents(total);
    const paymentsTotalCents = toCents(paymentsTotal);

    console.log('💰 Total de la venta:', total);
    console.log('💳 Total de pagos:', paymentsTotal);
    console.log('📊 Diferencia:', paymentsTotal - total);

    // Permitir venta si el pago es mayor o igual al total (comparación en centavos para evitar errores de precisión)
    if (paymentsTotalCents < totalCents) {
      console.log('❌ Error: Pago insuficiente');
      Alert.alert('Error', 'El monto pagado es insuficiente');
      isConfirmingSaleRef.current = false;
      setIsConfirmingSale(false);
      return;
    }

    // Calcular el vuelto
    const change = (paymentsTotalCents - totalCents) / 100;
    console.log('💵 Vuelto:', change);

    console.log('✅ Pago suficiente, procesando venta...');
    console.log('👤 Cliente:', selectedCustomer?.id || 'Sin cliente');
    console.log('📄 Tipo de documento:', documentType);
    console.log('🛒 Items en carrito:', cartItems.length);
    console.log('💳 Métodos de pago:', cartPayments.length);
    console.log('📴 Modo offline:', isOfflineModeEnabled);

    // ============ MODO OFFLINE ============
    if (isOfflineModeEnabled) {
      console.log('📴 Procesando venta en MODO OFFLINE...');

      // En sesión offline pura no hay caja/turno seleccionados: el store
      // deriva caja del deviceToken y vendedor del JWT offline, y la venta
      // queda pendiente de reasignar al abrir turno online.
      if (!isOfflineSession && (!selectedCashRegister || !currentSession)) {
        Alert.alert('Error', 'No hay sesión activa');
        isConfirmingSaleRef.current = false;
        setIsConfirmingSale(false);
        return;
      }

      try {
        // Convertir items del carrito al formato offline
        const offlineItems: OfflineSaleItem[] = cartItems.map((item) => ({
          productId: item.productId,
          productName: item.productName || '',
          productCode: item.productCode || '',
          quantity: item.quantity,
          unitPriceCents: Math.round((item.unitPrice || 0) * 100),
          discountCents: Math.round((item.discount || 0) * 100),
          taxRate: item.taxRate || 0,
        }));

        // Convertir pagos al formato offline
        const offlinePayments: OfflineSalePayment[] = cartPayments.map((payment) => ({
          paymentMethodId: payment.paymentMethodId,
          paymentMethodName: payment.paymentMethodName || '',
          amountCents: Math.round(payment.amount * 100),
        }));

        // Crear venta offline con datos del cliente offline
        const hasOfflineCustomer = offlineCustomerData.documentNumber.trim() !== '';
        const offlineSale = await createOfflineSale({
          items: offlineItems,
          payments: offlinePayments,
          // Campos principales para búsqueda/creación de cliente
          customerDocumentType: hasOfflineCustomer ? offlineCustomerData.documentType : undefined,
          customerDocumentNumber: hasOfflineCustomer
            ? offlineCustomerData.documentNumber
            : undefined,
          // Snapshot como fallback
          customerSnapshot: hasOfflineCustomer
            ? {
                name: offlineCustomerData.fullName.trim(),
                documentNumber: offlineCustomerData.documentNumber,
                documentType: offlineCustomerData.documentType,
              }
            : undefined,
          documentType,
          // En sesión offline pura van undefined: el store deriva del deviceToken
          // y marca la venta como pendingReassignment.
          // Si la app está en modo offline, NUNCA pasamos sessionId aunque haya
          // currentSession en el store: esa sessionId podría ser un turno ya
          // cerrado en el backend y bloquearía la sync posterior. La reasignación
          // al abrir el próximo turno online corrige el sessionId.
          cashRegisterId: selectedCashRegister?.id,
          sessionId: isOfflineSession || isOfflineModeEnabled ? undefined : currentSession?.id,
          // Si hay sesión offline activa, el vendedor real es el sub del JWT offline.
          sellerId: offlineLoginService.getCurrentSession()?.payload.sub ?? currentSession?.userId,
          cashRegisterCode: selectedCashRegister?.code,
        });

        console.log('✅ Venta offline creada:', offlineSale.offlineTicketCode);

        // Limpiar carrito inmediatamente tras venta offline exitosa (paridad
        // con online, que limpia dentro de createSale). Esto evita duplicar
        // la venta si la app se cierra antes de que el usuario cierre el
        // modal de éxito: al reabrir, no quedará el carrito persistido con
        // los mismos items ya vendidos.
        clearCart();
        clearPayments();

        // Cerrar modal de pago
        setShowPaymentModal(false);

        // Guardar la respuesta de venta offline y mostrar modal de éxito
        setOfflineSaleResponse(offlineSale);
        setOfflineSaleChange(change);
        setShowOfflineSaleSuccessModal(true);

        // Imprimir ticket offline automáticamente
        setTimeout(() => {
          handlePrintOfflineTicket(offlineSale);
        }, 500);
      } catch (error) {
        console.error('❌ Error al procesar venta offline:', error);
        Alert.alert(
          'Error',
          error instanceof Error ? error.message : 'No se pudo procesar la venta offline'
        );
      }

      isConfirmingSaleRef.current = false;
      setIsConfirmingSale(false);
      return;
    }

    // ============ MODO ONLINE (normal) ============
    try {
      console.log('📞 Llamando a createSale...');
      const result = await createSale(selectedCustomer?.id, documentType, 'Venta desde POS');
      console.log('✅ Venta creada exitosamente:', result);

      // Actualizar estado de efectivo solo tras completar una venta
      if (currentSession?.id) {
        await fetchCashStatus(currentSession.id);
      }

      // Cerrar modal de pago solo después de que la venta se complete exitosamente
      setShowPaymentModal(false);

      // Guardar la respuesta, el vuelto y mostrar el modal de éxito
      setSaleResponse(result);
      setSaleChange(change);
      setShowSaleSuccessModal(true);

      // Imprimir automáticamente el ticket después de confirmar la venta
      if (result.pdf?.base64 && result.pdf?.filename) {
        console.log('🖨️ Imprimiendo ticket automáticamente...');
        // Usar setTimeout para asegurar que el modal se muestre primero
        setTimeout(() => {
          handlePrintPDF(result.pdf.base64, result.pdf.filename);
        }, 500);
      }
    } catch (error) {
      console.error('❌ Error al procesar venta:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo procesar la venta');
    } finally {
      isConfirmingSaleRef.current = false;
      setIsConfirmingSale(false);
    }
  };

  const handlePrintPDF = async (pdfBase64?: string, pdfFilename?: string) => {
    console.log('🔍 handlePrintPDF iniciado');
    console.log('📄 saleResponse:', saleResponse);

    // Si se pasan parámetros directamente, usarlos (para reimprimir)
    let base64 = pdfBase64;
    let filename = pdfFilename;

    // Si no se pasan parámetros, usar saleResponse (para impresión después de venta)
    if (!base64 || !filename) {
      if (!saleResponse?.pdf) {
        console.error('❌ No hay PDF disponible');
        Alert.alert('Error', 'No hay PDF disponible para imprimir');
        return;
      }
      base64 = saleResponse.pdf.base64;
      filename = saleResponse.pdf.filename;
    }

    console.log('📦 PDF info:', { filename, base64Length: base64?.length });

    try {
      // Detectar si estamos en Electron
      const isElectron = typeof window !== 'undefined' && (window as any).electronAPI?.isElectron;
      console.log('🔍 Detección Electron:', {
        hasWindow: typeof window !== 'undefined',
        hasElectronAPI: !!(window as any).electronAPI,
        isElectron,
      });

      if (isElectron) {
        // En Electron, descargar y abrir el PDF
        console.log('🖨️ Descargando PDF en Electron...');
        console.log('📞 Llamando a electronAPI.printPDF...');
        const result = await (window as any).electronAPI.printPDF(base64, filename);
        console.log('📊 Resultado de printPDF:', result);

        if (result.success && result.printed) {
          console.log('✅ PDF enviado a la impresora');
          // No mostrar alerta para no interrumpir el flujo
          // El ticket se imprime automáticamente
        } else {
          console.error('❌ Error al imprimir PDF:', result.error);
          Alert.alert('Error', 'No se pudo imprimir el PDF automáticamente');
        }
      } else if (Platform.OS === 'web') {
        // En web (navegador), abrir el PDF en una nueva ventana para imprimir
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        // Abrir en nueva ventana para imprimir
        const printWindow = window.open(url, '_blank');
        if (printWindow) {
          printWindow.onload = () => {
            printWindow.print();
          };
        } else {
          Alert.alert(
            'Error',
            'No se pudo abrir la ventana de impresión. Verifica los permisos de pop-ups.'
          );
        }

        // Limpiar el URL después de un tiempo
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 1000);
      } else {
        // En móvil/desktop, usar el sistema de archivos
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const FileSystem = require('expo-file-system').default;
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Sharing = require('expo-sharing').default;

        const fileUri = `${FileSystem.documentDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Compartir o abrir el archivo
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri);
        } else {
          Alert.alert('Éxito', `PDF guardado en: ${fileUri}`);
        }
      }
    } catch (error) {
      console.error('❌ Error al imprimir PDF:', error);
      Alert.alert('Error', 'No se pudo imprimir el PDF');
    }
  };

  const handleReprintTicket = async (saleId: string) => {
    try {
      console.log('🖨️ Reimprimiendo ticket para venta:', saleId);
      const response = await posService.regenerateTicket(saleId);
      console.log('✅ Ticket regenerado:', response.filename);

      // Imprimir el PDF regenerado
      await handlePrintPDF(response.pdfBase64, response.filename);
    } catch (error) {
      console.error('❌ Error al reimprimir ticket:', error);
      Alert.alert('Error', 'No se pudo reimprimir el ticket');
    }
  };

  const handleGenerateCreditNote = async (
    saleId: string,
    remainingOnly = false,
    sourceSaleData?: any
  ) => {
    console.log('🔵 [CREDIT_NOTE] handleGenerateCreditNote llamado');
    console.log('🔵 [CREDIT_NOTE] saleId:', saleId);
    console.log('🔵 [CREDIT_NOTE] remainingOnly:', remainingOnly);

    try {
      // Buscar la venta en activeSalesData o usar la venta enriquecida desde gestión
      const saleData = sourceSaleData || activeSalesData?.sales.find((s) => s.saleId === saleId);
      if (!saleData) {
        Alert.alert('Error', 'No se encontró la información de la venta');
        return;
      }

      console.log('🔵 [CREDIT_NOTE] Sale data:', saleData);
      console.log('🔵 [CREDIT_NOTE] Items:', saleData.sale.items);

      const returnedQuantities = calculateCreditNoteReturnedQuantities(saleData);
      const availableItems = remainingOnly
        ? saleData.sale.items.filter(
            (item: any, index: number) =>
              getCreditNoteAvailableQuantity(item, index, returnedQuantities, saleData) > 0
          )
        : saleData.sale.items;

      if (remainingOnly && availableItems.length === 0) {
        Alert.alert(
          'Sin saldo disponible',
          'Todos los productos de esta venta ya fueron devueltos.'
        );
        return;
      }

      const productQuantities = availableItems.reduce(
        (acc: Record<string, string>, item: any, index: number) => {
          const originalIndex = saleData.sale.items.indexOf(item);
          const itemIndex = originalIndex >= 0 ? originalIndex : index;
          acc[getCreditNoteProductId(item, itemIndex)] = String(
            remainingOnly
              ? getCreditNoteAvailableQuantity(item, itemIndex, returnedQuantities, saleData)
              : getCreditNoteProductQuantity(item)
          );
          return acc;
        },
        {}
      );

      // Abrir modal de selección de tipo de devolución
      setSelectedSaleForCreditNote(saleData);
      setCreditNoteType(remainingOnly ? 'partial' : null);
      setSelectedProductsForCreditNote([]);
      setCreditNoteProductQuantities(productQuantities);
      setCreditNoteRemainingMode(remainingOnly);
      setCreditNoteMotivo(remainingOnly ? '07' : '06'); // Devolución por ítem si viene desde gestión
      setCreditNoteSustento('');
      setShowCreditNoteManagementModal(false);
      setShowCreditNoteModal(true);
    } catch (error) {
      console.error('❌ [CREDIT_NOTE] Error en handleGenerateCreditNote:', error);
      Alert.alert('Error', 'No se pudo generar la nota de crédito');
    }
  };

  const handleConfirmCreditNote = async () => {
    console.log('🔵 [CREDIT_NOTE] handleConfirmCreditNote llamado');
    console.log('🔵 [CREDIT_NOTE] Type:', creditNoteType);
    console.log('🔵 [CREDIT_NOTE] Motivo:', creditNoteMotivo);
    console.log('🔵 [CREDIT_NOTE] Sustento:', creditNoteSustento);
    console.log('🔵 [CREDIT_NOTE] Selected products:', selectedProductsForCreditNote);

    if (!creditNoteType) {
      Alert.alert('Error', 'Debe seleccionar el tipo de devolución');
      return;
    }

    if (!creditNoteSustento || creditNoteSustento.trim().length === 0) {
      Alert.alert('Error', 'Debe ingresar el sustento de la nota de crédito');
      return;
    }

    if (creditNoteType === 'partial' && selectedProductsForCreditNote.length === 0) {
      Alert.alert('Error', 'Debe seleccionar al menos un producto para la devolución parcial');
      return;
    }

    if (creditNoteType === 'partial') {
      const invalidQuantityItem = selectedSaleForCreditNote.sale.items.find(
        (item: any, index: number) => {
          const productId = getCreditNoteProductId(item, index);
          if (!selectedProductsForCreditNote.includes(productId)) return false;

          const limitQuantity = getCreditNoteItemLimitQuantity(item, index);
          const quantity = getCreditNoteEditedQuantity(productId, limitQuantity);
          return !Number.isFinite(quantity) || quantity <= 0 || quantity > limitQuantity;
        }
      );

      if (invalidQuantityItem) {
        Alert.alert(
          'Cantidad inválida',
          'La cantidad a devolver debe ser mayor a 0 y no puede superar la cantidad disponible.'
        );
        return;
      }
    }

    setGeneratingCreditNote(true);

    try {
      console.log('📝 [CREDIT_NOTE] Iniciando generación de nota de crédito...');
      console.log('📝 [CREDIT_NOTE] Sale ID:', selectedSaleForCreditNote.saleId);

      const requestBody: any = {
        motivoNota: creditNoteMotivo,
        sustentoNota: creditNoteSustento.trim(),
      };

      if (creditNoteType === 'partial') {
        // Construir array de items para devolución parcial
        const items = selectedSaleForCreditNote.sale.items
          .filter((item: any, index: number) =>
            selectedProductsForCreditNote.includes(getCreditNoteProductId(item, index))
          )
          .map((item: any, index: number) => {
            const productId = getCreditNoteProductId(item, index);
            const limitQuantity = getCreditNoteItemLimitQuantity(item, index);
            const quantity = getCreditNoteEditedQuantity(productId, limitQuantity);
            const unitPrice = getCreditNoteProductUnitPrice(item, selectedSaleForCreditNote, index);
            return {
              sku: getCreditNoteProductSku(item),
              descripcion: getCreditNoteProductName(item),
              cantidad: quantity,
              valorUnitario: unitPrice,
              precioVentaUnitario: unitPrice,
            };
          });
        requestBody.items = items;
      }

      console.log('📝 [CREDIT_NOTE] Request body:', JSON.stringify(requestBody, null, 2));

      const response = await posService.generateCreditNote(
        selectedSaleForCreditNote.saleId,
        requestBody
      );

      console.log('✅ [CREDIT_NOTE] Respuesta recibida del backend:');
      console.log('✅ [CREDIT_NOTE] Response completo:', JSON.stringify(response, null, 2));
      console.log('✅ [CREDIT_NOTE] Success:', response.success);
      console.log('✅ [CREDIT_NOTE] Message:', response.message);
      console.log('✅ [CREDIT_NOTE] Credit Note Number:', response.creditNote?.documentNumber);
      console.log('✅ [CREDIT_NOTE] Credit Note ID:', response.creditNote?.id);
      console.log('✅ [CREDIT_NOTE] Credit Note Status:', response.creditNote?.status);
      console.log('✅ [CREDIT_NOTE] Credit Note Type:', response.creditNote?.creditNoteType);
      console.log('✅ [CREDIT_NOTE] Total:', response.creditNote?.total);
      console.log('✅ [CREDIT_NOTE] PDF disponible:', !!response.pdf);
      console.log('✅ [CREDIT_NOTE] PDF filename:', response.pdf?.filename);
      console.log('✅ [CREDIT_NOTE] PDF base64 length:', response.pdf?.pdfBase64?.length);

      // Cerrar modal
      setShowCreditNoteModal(false);
      setCreditNoteType(null);
      setSelectedProductsForCreditNote([]);
      setCreditNoteProductQuantities({});
      setCreditNoteRemainingMode(false);
      setSelectedSaleForCreditNote(null);
      setCreditNoteMotivo('06');
      setCreditNoteSustento('');

      // Imprimir automáticamente la nota de crédito
      if (response.pdf?.pdfBase64 && response.pdf?.filename) {
        console.log('🖨️ [CREDIT_NOTE] Imprimiendo PDF de nota de crédito automáticamente...');
        await handlePrintPDF(response.pdf.pdfBase64, response.pdf.filename);
        console.log('✅ [CREDIT_NOTE] PDF impreso exitosamente');
      } else {
        console.warn('⚠️ [CREDIT_NOTE] No hay PDF disponible para imprimir');
      }

      // Recargar las ventas para mostrar la nota de crédito
      console.log('🔄 [CREDIT_NOTE] Recargando lista de ventas...');
      await handleLoadRecentSales();
      console.log('✅ [CREDIT_NOTE] Lista de ventas actualizada');

      Alert.alert(
        'Éxito',
        `Nota de crédito ${response.creditNote.documentNumber} generada correctamente`,
        [
          {
            text: 'OK',
          },
        ]
      );
    } catch (error) {
      console.error('❌ [CREDIT_NOTE] Error al generar nota de crédito:', error);
      console.error('❌ [CREDIT_NOTE] Error type:', typeof error);
      console.error(
        '❌ [CREDIT_NOTE] Error name:',
        error instanceof Error ? error.name : 'Unknown'
      );
      console.error(
        '❌ [CREDIT_NOTE] Error message:',
        error instanceof Error ? error.message : String(error)
      );
      console.error(
        '❌ [CREDIT_NOTE] Error stack:',
        error instanceof Error ? error.stack : 'No stack'
      );

      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'No se pudo generar la nota de crédito'
      );
    } finally {
      setGeneratingCreditNote(false);
    }
  };

  const getCreditNoteProductId = (item: any, index: number) =>
    String(
      item.saleItemId ||
        item.id ||
        item.itemId ||
        item.productId ||
        item.product?.id ||
        item.sku ||
        item.productCode ||
        index
    );

  const getCreditNoteProductName = (item: any) =>
    item.productName ||
    item.product?.name ||
    item.name ||
    item.description ||
    item.descripcion ||
    item.descripcionProducto ||
    'Producto sin nombre';

  const getCreditNoteProductSku = (item: any) =>
    item.productCode ||
    item.codigo ||
    item.product?.sku ||
    item.product?.code ||
    item.sku ||
    item.code ||
    '';

  const centsToAmount = (value: unknown) => Number(value || 0) / 100;

  const getCreditNoteProductUnitPrice = (item: any, saleData?: any, index?: number) => {
    const summaryItem = saleData
      ? findCreditNoteSummaryForSaleItem(saleData, item, index ?? 0)
      : null;
    const sourceItem = summaryItem || item;

    if (sourceItem.unitPriceCents != null) return centsToAmount(sourceItem.unitPriceCents);
    if (sourceItem.priceCents != null) return centsToAmount(sourceItem.priceCents);
    if (sourceItem.salePriceCents != null) return centsToAmount(sourceItem.salePriceCents);
    if (sourceItem.product?.salePriceCents != null)
      return centsToAmount(sourceItem.product.salePriceCents);
    if (sourceItem.product?.priceCents != null) return centsToAmount(sourceItem.product.priceCents);
    if (sourceItem.unitPrice != null) return centsToAmount(sourceItem.unitPrice);
    if (sourceItem.price != null) return Number(sourceItem.price || 0);
    if (sourceItem.product?.price != null) return Number(sourceItem.product.price || 0);
    return 0;
  };

  const normalizeCreditNoteQuantity = (value: unknown, fallback = 0) => {
    const numericValue = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(numericValue) ? numericValue : fallback;
  };

  const getCreditNoteProductQuantity = (item: any) =>
    normalizeCreditNoteQuantity(item.quantity ?? item.qty ?? item.purchasedQuantity, 1);

  const getCreditNoteCreditedQuantityFromItem = (item: any) =>
    Number(
      item.creditedQuantity ??
        item.refundedQuantity ??
        item.returnedQuantity ??
        item.quantityCredited ??
        item.quantityRefunded ??
        item.quantityReturned ??
        item.creditNoteQuantity ??
        item.product?.creditedQuantity ??
        0
    );

  const getCreditNoteItemsFromDocument = (creditNote: any) =>
    creditNote?.items ||
    creditNote?.details ||
    creditNote?.products ||
    creditNote?.saleItems ||
    creditNote?.creditNoteItems ||
    creditNote?.documentItems ||
    creditNote?.document?.items ||
    creditNote?.creditNote?.items ||
    [];

  const getCreditNoteDocumentsFromSaleData = (saleData: any) =>
    saleData?.sale?.creditNotes ||
    saleData?.sale?.creditNoteDocuments ||
    saleData?.sale?.documents?.filter((document: any) =>
      String(document.documentType || document.type || '')
        .toLowerCase()
        .includes('credit')
    ) ||
    saleData?.creditNotes ||
    saleData?.creditNoteDocuments ||
    [];

  const getCreditNoteItemsFromSaleData = (saleData: any) =>
    saleData?.sale?.creditNoteItems ||
    saleData?.sale?.returnedItems ||
    saleData?.sale?.refundedItems ||
    saleData?.creditNoteItems ||
    saleData?.returnedItems ||
    saleData?.refundedItems ||
    [];

  const getCreditNoteReturnedItemQuantity = (item: any) =>
    normalizeCreditNoteQuantity(
      item.returnedQuantity ?? item.cantidad ?? item.quantity ?? item.qty ?? item.refundedQuantity,
      0
    );

  const findCreditNoteSummaryForSaleItem = (saleData: any, saleItem: any, index: number) => {
    const saleProductId = getCreditNoteProductId(saleItem, index);
    const saleSku = getCreditNoteProductSku(saleItem);
    const saleName = getCreditNoteProductName(saleItem);
    const summaryItems = getCreditNoteItemsFromSaleData(saleData);

    return summaryItems.find((creditNoteItem: any) => {
      const creditSaleItemId = String(
        creditNoteItem.saleItemId || creditNoteItem.id || creditNoteItem.itemId || ''
      );
      const creditProductId = String(creditNoteItem.productId || creditNoteItem.product?.id || '');
      const creditSku = getCreditNoteProductSku(creditNoteItem);

      return (
        (!!creditSaleItemId && saleProductId === creditSaleItemId) ||
        (!!creditProductId && saleProductId === creditProductId) ||
        (!!saleSku && saleSku === creditSku) ||
        saleName === getCreditNoteProductName(creditNoteItem)
      );
    });
  };

  const calculateCreditNoteReturnedQuantities = (saleData: any) => {
    const returnedQuantities: Record<string, number> = {};
    const saleItems = saleData?.sale?.items || [];
    const summaryItems = getCreditNoteItemsFromSaleData(saleData);

    saleItems.forEach((item: any, index: number) => {
      const productId = getCreditNoteProductId(item, index);
      const summaryItem = findCreditNoteSummaryForSaleItem(saleData, item, index);
      const returnedQuantity = summaryItem
        ? normalizeCreditNoteQuantity(summaryItem.returnedQuantity, 0)
        : getCreditNoteCreditedQuantityFromItem(item);

      if (returnedQuantity > 0) {
        returnedQuantities[productId] = returnedQuantity;
      }
    });

    if (summaryItems.length > 0) {
      return returnedQuantities;
    }

    const creditNotes = getCreditNoteDocumentsFromSaleData(saleData);

    const addReturnedQuantityFromCreditNoteItem = (creditNoteItem: any) => {
      const matchedIndex = saleItems.findIndex((saleItem: any, index: number) => {
        const saleProductId = getCreditNoteProductId(saleItem, index);
        const creditProductId = String(
          creditNoteItem.saleItemId ||
            creditNoteItem.itemId ||
            creditNoteItem.productId ||
            creditNoteItem.product?.id ||
            creditNoteItem.id ||
            creditNoteItem.sku ||
            creditNoteItem.productCode ||
            creditNoteItem.codigo ||
            ''
        );

        return (
          (!!creditProductId && saleProductId === creditProductId) ||
          (!!creditNoteItem.sku && getCreditNoteProductSku(saleItem) === creditNoteItem.sku) ||
          (!!creditNoteItem.codigo &&
            getCreditNoteProductSku(saleItem) === creditNoteItem.codigo) ||
          (!!creditNoteItem.productCode &&
            getCreditNoteProductSku(saleItem) === creditNoteItem.productCode) ||
          getCreditNoteProductName(saleItem) === getCreditNoteProductName(creditNoteItem)
        );
      });

      if (matchedIndex >= 0) {
        const matchedItem = saleItems[matchedIndex];
        const productId = getCreditNoteProductId(matchedItem, matchedIndex);
        returnedQuantities[productId] =
          (returnedQuantities[productId] || 0) + getCreditNoteReturnedItemQuantity(creditNoteItem);
      }
    };

    creditNotes.forEach((creditNote: any) => {
      getCreditNoteItemsFromDocument(creditNote).forEach(addReturnedQuantityFromCreditNoteItem);
    });

    return returnedQuantities;
  };

  const getCreditNoteCreditedQuantity = (
    item: any,
    index?: number,
    returnedQuantities: Record<string, number> = creditNoteReturnedQuantities,
    saleData?: any
  ) => {
    const summaryItem = saleData
      ? findCreditNoteSummaryForSaleItem(saleData, item, index ?? 0)
      : null;
    if (summaryItem?.returnedQuantity != null) {
      return normalizeCreditNoteQuantity(summaryItem.returnedQuantity, 0);
    }

    const productId = getCreditNoteProductId(item, index ?? 0);
    return returnedQuantities[productId] ?? getCreditNoteCreditedQuantityFromItem(item);
  };

  const getCreditNoteAvailableQuantity = (
    item: any,
    index: number,
    returnedQuantities: Record<string, number> = creditNoteReturnedQuantities,
    saleData?: any
  ) => {
    const summaryItem = saleData ? findCreditNoteSummaryForSaleItem(saleData, item, index) : null;
    if (summaryItem?.remainingQuantity != null) {
      return Math.max(normalizeCreditNoteQuantity(summaryItem.remainingQuantity, 0), 0);
    }

    return Math.max(
      getCreditNoteProductQuantity(item) -
        getCreditNoteCreditedQuantity(item, index, returnedQuantities, saleData),
      0
    );
  };

  const getCreditNoteItemLimitQuantity = (item: any, index: number) =>
    creditNoteRemainingMode
      ? getCreditNoteAvailableQuantity(
          item,
          index,
          creditNoteReturnedQuantities,
          selectedSaleForCreditNote
        )
      : getCreditNoteProductQuantity(item);

  const getCreditNoteEditedQuantity = (productId: string, defaultQuantity: number) => {
    const quantityText = creditNoteProductQuantities[productId] ?? String(defaultQuantity);
    return Number(quantityText.replace(',', '.'));
  };

  const updateCreditNoteProductQuantity = (
    productId: string,
    quantity: string,
    maxQuantity: number
  ) => {
    const sanitizedQuantity = quantity.replace(/[^0-9.,]/g, '');
    const numericQuantity = Number(sanitizedQuantity.replace(',', '.'));
    const limitedQuantity =
      Number.isFinite(numericQuantity) && numericQuantity > maxQuantity
        ? String(maxQuantity)
        : sanitizedQuantity;

    setCreditNoteProductQuantities((prev) => ({
      ...prev,
      [productId]: limitedQuantity,
    }));
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProductsForCreditNote((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  const pickFirstNonEmptyArray = (...arrays: any[]) =>
    arrays.find((value) => Array.isArray(value) && value.length > 0) ||
    arrays.find((value) => Array.isArray(value));

  const handlePrintSingleCreditNote = async (saleId: string, creditNote: any) => {
    try {
      console.log('🖨️ [CREDIT_NOTE] Imprimiendo ticket de nota de crédito para venta:', saleId);
      console.log('🖨️ [CREDIT_NOTE] Credit Note:', creditNote);

      if (!creditNote?.id) {
        Alert.alert('Error', 'No se encontró la nota de crédito');
        return;
      }

      const response = await posService.regenerateCreditNoteTicket(saleId, creditNote.id);
      console.log('✅ [CREDIT_NOTE] Ticket de nota de crédito generado:', response.filename);

      // Imprimir/abrir el ticket
      await handlePrintPDF(response.pdfBase64, response.filename);
      console.log('✅ [CREDIT_NOTE] Ticket impreso exitosamente');
    } catch (error) {
      console.error('❌ [CREDIT_NOTE] Error al imprimir nota de crédito:', error);
      Alert.alert('Error', 'No se pudo imprimir el ticket de la nota de crédito');
    }
  };

  const mergeSaleDataWithInfo = (saleData: any, saleInfo: any) => {
    const detailedSale = saleInfo?.sale || saleInfo;
    return {
      ...saleData,
      sale: {
        ...saleData.sale,
        ...detailedSale,
        code: saleData.sale.code || detailedSale?.code,
        saleNumber: saleData.sale.saleNumber || detailedSale?.saleNumber,
        status: detailedSale?.status || saleData.sale.status,
        creditNoteType: detailedSale?.creditNoteType || saleData.sale.creditNoteType,
        hasCreditNote: detailedSale?.hasCreditNote ?? saleData.sale.hasCreditNote,
        items: pickFirstNonEmptyArray(
          detailedSale?.items,
          detailedSale?.sale?.items,
          saleData.sale.items
        ),
        creditNotes: pickFirstNonEmptyArray(
          detailedSale?.creditNotes,
          detailedSale?.creditNoteDocuments,
          detailedSale?.documents?.filter((document: any) =>
            String(document.documentType || document.type || '')
              .toLowerCase()
              .includes('credit')
          ),
          saleData.sale.creditNotes
        ),
        creditNoteItems: pickFirstNonEmptyArray(
          detailedSale?.creditNoteItems,
          detailedSale?.returnedItems,
          detailedSale?.refundedItems,
          saleData.sale.creditNoteItems
        ),
        returnedItems: detailedSale?.returnedItems || saleData.sale.returnedItems,
        refundedItems: detailedSale?.refundedItems || saleData.sale.refundedItems,
      },
    };
  };

  const handleOpenCreditNoteManagement = async (saleData: any) => {
    setSelectedSaleForCreditNoteManagement(saleData);
    setCreditNoteReturnedQuantities(calculateCreditNoteReturnedQuantities(saleData));
    setShowCreditNoteManagementModal(true);
    setLoadingCreditNoteManagement(true);

    try {
      const saleInfo = await posService.getSaleInfo(saleData.saleId);
      console.log('🟣 [CREDIT_NOTE] Sale info para gestión NC:', JSON.stringify(saleInfo, null, 2));
      const mergedSaleData = mergeSaleDataWithInfo(saleData, saleInfo);
      setSelectedSaleForCreditNoteManagement(mergedSaleData);
      setCreditNoteReturnedQuantities(calculateCreditNoteReturnedQuantities(mergedSaleData));
    } catch (error) {
      console.warn('⚠️ [CREDIT_NOTE] No se pudo cargar detalle de venta para NC:', error);
    } finally {
      setLoadingCreditNoteManagement(false);
    }
  };

  const isTotalCreditNoteSale = (sale: any) =>
    sale.status === 'CONFIRMED_DEV_TOTAL' ||
    sale.creditNoteType === 'total' ||
    sale.creditNoteType === 'TOTAL' ||
    sale.creditNoteType === 'DEV_TOTAL';

  const handleNewSale = () => {
    setShowSaleSuccessModal(false);
    setSaleResponse(null);
    clearCart();
    clearPayments();
    setSelectedCustomer(null);
    setCustomerSearchQuery('');
    setCustomerSearchResults([]);
    setShowCustomerDropdown(false);
    setDocumentType('03');
  };

  // Nueva venta desde modal offline
  const handleNewSaleFromOffline = () => {
    setShowOfflineSaleSuccessModal(false);
    setOfflineSaleResponse(null);
    setOfflineSaleChange(0);
    clearCart();
    clearPayments();
    setSelectedCustomer(null);
    setCustomerSearchQuery('');
    setCustomerSearchResults([]);
    setShowCustomerDropdown(false);
    setDocumentType('03');
  };

  // Imprimir ticket offline con QR
  const handlePrintOfflineTicket = async (sale?: OfflineSale) => {
    const saleData = sale || offlineSaleResponse;
    if (!saleData) {
      Alert.alert('Error', 'No hay datos de venta para imprimir');
      return;
    }

    try {
      console.log('🖨️ [OFFLINE] Generando ticket offline...');

      // Obtener información de la empresa desde localStorage
      const companyInfoStr = localStorage.getItem('@offline:company_info');
      const companyInfo = companyInfoStr
        ? JSON.parse(companyInfoStr)
        : {
            ruc: '00000000000',
            razonSocial: 'Empresa',
            nombreComercial: 'Tienda',
            direccion: 'Dirección',
          };

      // Generar URL del QR para validación posterior
      const qrUrl = `https://erp-aio-offline-documents.com/public/receipt/view/${saleData.token}`;

      // Generar QR localmente como data URL (sin red, requerido en modo offline)
      let qrImageDataUrl = '';
      try {
        qrImageDataUrl = await QRCode.toDataURL(qrUrl, {
          margin: 0,
          width: 200,
          errorCorrectionLevel: 'M',
        });
      } catch (qrError) {
        console.error('❌ [OFFLINE] Error generando QR local:', qrError);
      }

      // Generar contenido HTML del ticket
      const ticketHtml = generateOfflineTicketHtml(saleData, companyInfo, qrUrl, qrImageDataUrl);

      // Verificar si estamos en Electron
      const isElectron = !!(window as any).electronAPI?.printHTML;

      if (isElectron) {
        // Usar API de Electron para imprimir directamente a la térmica
        console.log('🖨️ [OFFLINE] Usando Electron para impresión directa...');
        const filename = `ticket_offline_${saleData.offlineTicketCode.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        const result = await (window as any).electronAPI.printHTML(ticketHtml, filename);

        if (result.success) {
          console.log('✅ [OFFLINE] Ticket impreso exitosamente en impresora térmica');
        } else {
          console.error('❌ [OFFLINE] Error al imprimir:', result.error);
          Alert.alert('Error de impresión', result.error || 'No se pudo imprimir el ticket');
        }
      } else {
        // Fallback para navegador web: abrir ventana de impresión
        console.log('🖨️ [OFFLINE] Usando ventana de impresión del navegador...');
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (printWindow) {
          printWindow.document.write(ticketHtml);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
          }, 250);
        } else {
          Alert.alert('Error', 'No se pudo abrir la ventana de impresión');
        }
      }

      console.log('✅ [OFFLINE] Ticket enviado a impresión');
    } catch (error) {
      console.error('❌ [OFFLINE] Error al imprimir ticket:', error);
      Alert.alert('Error', 'No se pudo imprimir el ticket offline');
    }
  };

  // Generar HTML del ticket offline
  const generateOfflineTicketHtml = (
    sale: OfflineSale,
    companyInfo: { ruc: string; razonSocial: string; nombreComercial?: string; direccion: string },
    qrUrl: string,
    qrImageDataUrl: string
  ): string => {
    const fechaVenta = new Date(sale.createdAt).toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const itemsHtml = sale.items
      .map(
        (item) => `
        <tr>
          <td style="text-align:left;padding:2px 0;">${item.productName}</td>
          <td style="text-align:center;">${item.quantity}</td>
          <td style="text-align:right;">S/ ${(item.unitPriceCents / 100).toFixed(2)}</td>
          <td style="text-align:right;">S/ ${((item.quantity * item.unitPriceCents - item.discountCents) / 100).toFixed(2)}</td>
        </tr>
      `
      )
      .join('');

    const paymentsHtml = sale.payments
      .map(
        (payment) => `
        <div style="display:flex;justify-content:space-between;font-size:10px;">
          <span>${payment.paymentMethodName}:</span>
          <span>S/ ${(payment.amountCents / 100).toFixed(2)}</span>
        </div>
      `
      )
      .join('');

    // QR generado localmente (data URL embebida, no requiere red).
    // Fallback al endpoint público si la generación local falló por alguna razón.
    const qrImageUrl =
      qrImageDataUrl ||
      `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=${encodeURIComponent(qrUrl)}`;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ticket Offline - ${sale.offlineTicketCode}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Lucida Console', 'Courier New', monospace;
            font-size: 12px;
            width: 72mm;
            max-width: 72mm;
            padding: 3mm;
            background: white;
            color: #000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            line-height: 1.15;
          }
          .header { text-align: center; margin-bottom: 4px; }
          .company-name { font-size: 14px; font-weight: bold; }
          .company-info { font-size: 11px; color: #000; }
          .divider { border-top: 1px dashed #000; margin: 4px 0; }
          .warning-box {
            border: 1px solid #000;
            padding: 4px;
            margin: 4px 0;
            text-align: center;
          }
          .warning-title { font-weight: bold; font-size: 12px; color: #000; }
          .warning-text { font-size: 10px; color: #000; margin-top: 2px; }
          .ticket-code { font-size: 14px; font-weight: bold; text-align: center; margin: 4px 0; letter-spacing: 1px; }
          .info-row { display: flex; justify-content: space-between; margin: 2px 0; font-size: 11px; }
          table { width: 100%; border-collapse: collapse; margin: 4px 0; }
          th { text-align: left; border-bottom: 1px solid #000; padding: 2px 0; font-size: 10px; font-weight: bold; }
          td { font-size: 10px; padding: 2px 0; vertical-align: top; }
          .totals { margin-top: 4px; }
          .total-row { display: flex; justify-content: space-between; margin: 2px 0; font-size: 12px; }
          .total-final { font-size: 16px; font-weight: bold; }
          .qr-section { text-align: center; margin: 6px 0; }
          .qr-title { font-weight: bold; font-size: 11px; margin-bottom: 3px; }
          .qr-instructions { font-size: 9px; color: #000; margin-top: 3px; line-height: 1.2; }
          .footer { text-align: center; font-size: 10px; color: #000; margin-top: 6px; }
          .qr-notice-box {
            border: 1px solid #000;
            padding: 4px;
            margin-bottom: 4px;
            text-align: center;
          }
          .qr-notice-title { font-weight: bold; font-size: 11px; margin-bottom: 2px; }
          .qr-notice-text { font-size: 9px; line-height: 1.2; }
          @media print {
            @page {
              size: 80mm auto;
              margin: 0;
            }
            html, body {
              width: 72mm;
              max-width: 72mm;
              margin: 0;
              padding: 3mm;
            }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${companyInfo.nombreComercial || companyInfo.razonSocial}</div>
          <div class="company-info">RUC: ${companyInfo.ruc}</div>
          <div class="company-info">${companyInfo.direccion}</div>
        </div>

        <div class="divider"></div>

        <div class="warning-box">
          <div class="warning-title">⚠️ TICKET DE CONTINGENCIA</div>
          <div class="warning-text">Este documento NO es un comprobante válido ante SUNAT</div>
        </div>

        <div class="ticket-code">📋 ${sale.offlineTicketCode}</div>

        <div class="info-row">
          <span>Fecha:</span>
          <span>${fechaVenta}</span>
        </div>
        <div class="info-row">
          <span>Tipo Doc:</span>
          <span>${sale.documentType === '01' ? 'Factura' : 'Boleta'}</span>
        </div>
        ${
          sale.customerSnapshot
            ? `
        <div class="info-row">
          <span>Cliente:</span>
          <span>${sale.customerSnapshot.name}</span>
        </div>
        <div class="info-row">
          <span>Doc:</span>
          <span>${sale.customerSnapshot.documentNumber}</span>
        </div>
        `
            : ''
        }

        <div class="divider"></div>

        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th style="text-align:center;">Cant</th>
              <th style="text-align:right;">P.Unit</th>
              <th style="text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="divider"></div>

        <div class="totals">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>S/ ${(sale.subtotalCents / 100).toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span>IGV (18%):</span>
            <span>S/ ${(sale.taxCents / 100).toFixed(2)}</span>
          </div>
          ${
            sale.discountCents > 0
              ? `
          <div class="total-row">
            <span>Descuento:</span>
            <span>-S/ ${(sale.discountCents / 100).toFixed(2)}</span>
          </div>
          `
              : ''
          }
          <div class="divider"></div>
          <div class="total-row total-final">
            <span>TOTAL:</span>
            <span>S/ ${(sale.totalCents / 100).toFixed(2)}</span>
          </div>
        </div>

        <div class="divider"></div>

        <div style="margin: 4px 0;">
          <strong style="font-size:11px;">Pagos:</strong>
          ${paymentsHtml}
        </div>

        <div class="divider"></div>

        <div class="qr-section">
          <div class="qr-notice-box">
            <div class="qr-notice-title">AVISO IMPORTANTE</div>
            <div class="qr-notice-text">
              Sistema no disponible temporalmente.<br>
              Escanea el QR para tu comprobante<br>
              <strong>en maximo 24 horas.</strong>
            </div>
          </div>
          <img src="${qrImageUrl}" alt="QR Code" style="width:32mm;height:32mm;margin:4px auto;display:block;image-rendering:pixelated;">
          <div class="qr-instructions">
            Guarda este ticket para descargar tu comprobante.
          </div>
        </div>

        <div class="footer">
          <p>Gracias por su compra</p>
        </div>
      </body>
      </html>
    `;
  };

  const formatCurrency = (amount: number) => `S/ ${amount.toFixed(2)}`;

  // Calcular ancho del panel derecho (carrito) de forma proporcional
  // En pantallas grandes (>1200px): 35% del ancho
  // En pantallas medianas (800-1200px): 40% del ancho
  // En pantallas pequeñas (<800px): 45% del ancho
  // Mínimo: 320px, Máximo: 650px
  const getRightPanelWidth = () => {
    if (windowWidth > 1200) {
      return Math.min(Math.max(windowWidth * 0.35, 320), 650);
    } else if (windowWidth > 800) {
      return Math.min(Math.max(windowWidth * 0.4, 320), 650);
    } else {
      return Math.min(Math.max(windowWidth * 0.45, 320), 650);
    }
  };

  const rightPanelWidth = getRightPanelWidth();
  const topSellerCardGap = 12;
  const leftPanelAvailableWidth = Math.max(windowWidth - rightPanelWidth - 48, 320);
  const topSellerColumns = 8;
  const topSellerCardSize = Math.floor(
    (leftPanelAvailableWidth - topSellerCardGap * (topSellerColumns - 1)) / topSellerColumns
  );
  const safeTopSellerCardSize = Math.min(Math.max(topSellerCardSize, 90), 280);

  const renderProductItem = ({ item }: { item: Product }) => {
    const stock = item.availableStock ?? item.stock ?? 0;
    const isOutOfStock = stock <= 0;
    const isLowStock = stock > 0 && stock <= 5;
    const stockStyle = isOutOfStock
      ? styles.productStockOut
      : isLowStock
        ? styles.productStockLow
        : styles.productStockOk;
    return (
      <TouchableOpacity style={styles.productItem} onPress={() => handleAddProduct(item)}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.productImage} resizeMode="cover" />
        ) : (
          <View style={styles.productImagePlaceholder}>
            <Text style={styles.productImagePlaceholderText}>📦</Text>
          </View>
        )}
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{item.name}</Text>
          <Text style={styles.productCode}>Código: {item.code}</Text>
          <Text style={styles.productPrice}>{formatCurrency(item.price || 0)}</Text>
          <Text style={[styles.productStock, stockStyle]}>
            Stock: {stock} {isOutOfStock ? '(sin stock)' : ''}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderTopSellerItem = ({ item }: { item: Product }) => {
    const topSellerSquareSize = Math.round(safeTopSellerCardSize * 0.78);

    return (
      <TouchableOpacity
        style={[
          styles.topSellerCard,
          {
            width: safeTopSellerCardSize,
            minHeight: safeTopSellerCardSize + 72,
          },
        ]}
        onPress={() => handleAddProduct(item)}
      >
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={[styles.topSellerImage, { height: topSellerSquareSize }]}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.topSellerImagePlaceholder, { height: topSellerSquareSize }]}>
            <Text style={styles.topSellerImagePlaceholderText}>📦</Text>
          </View>
        )}
        <Text style={styles.topSellerName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.topSellerSku} numberOfLines={1}>
          SKU: {item.sku || item.code || '-'}
        </Text>
        <Text style={styles.topSellerPrice}>{formatCurrency(item.price || 0)}</Text>
      </TouchableOpacity>
    );
  };

  const renderCartItem = ({ item, index }: { item: any; index: number }) => {
    const unitPrice = item.unitPrice || 0; // Este precio ya incluye IGV
    const taxRate = item.taxRate || 0;
    // El total del item es simplemente cantidad * precio (que ya incluye IGV) - descuento
    const itemTotal = item.quantity * unitPrice - (item.discount || 0);
    const availableStock: number | undefined =
      typeof item.availableStock === 'number' ? item.availableStock : undefined;
    const atStockLimit = typeof availableStock === 'number' && item.quantity >= availableStock;

    const notifyStockLimit = () => {
      if (typeof availableStock === 'number') {
        Alert.alert(
          'Stock máximo alcanzado',
          `Solo hay ${availableStock} unidad(es) disponible(s) de "${item.productName}".`
        );
      }
    };

    const handleQuantityChange = (text: string) => {
      const newQuantity = parseInt(text, 10);
      if (!isNaN(newQuantity) && newQuantity > 0) {
        if (typeof availableStock === 'number' && newQuantity > availableStock) {
          notifyStockLimit();
          updateCartItem(index, availableStock);
          return;
        }
        updateCartItem(index, newQuantity);
      } else if (text === '') {
        // Permitir campo vacío temporalmente
        return;
      }
    };

    const handleQuantityBlur = (text: string) => {
      const newQuantity = parseInt(text, 10);
      if (isNaN(newQuantity) || newQuantity <= 0) {
        // Si el valor no es válido, restaurar a 1
        updateCartItem(index, 1);
      }
    };

    const handleIncrement = () => {
      if (atStockLimit) {
        notifyStockLimit();
        return;
      }
      updateCartItem(index, item.quantity + 1);
    };

    return (
      <View style={styles.cartItem}>
        <View style={styles.cartItemRow}>
          {/* Imagen del producto */}
          <TouchableOpacity
            onPress={() => {
              if (item.imageUrl) {
                setSelectedImage(item.imageUrl);
                setShowImageModal(true);
              }
            }}
            activeOpacity={item.imageUrl ? 0.7 : 1}
          >
            {item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.cartItemImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.cartItemImagePlaceholder}>
                <Text style={styles.cartItemImagePlaceholderText}>📦</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Información del producto */}
          <View style={styles.cartItemInfo}>
            <View style={styles.cartItemHeader}>
              <View style={styles.cartItemNameContainer}>
                <Text style={styles.cartItemName}>{item.productName}</Text>
                {item.productCode && (
                  <Text style={styles.cartItemSku}>SKU: {item.productCode}</Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.removeButtonContainer}
                onPress={() => removeCartItem(index)}
              >
                <Text style={styles.removeButton}>🗑️</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.cartItemPrice}>
              Precio: {formatCurrency(unitPrice)} c/u (inc. IGV)
            </Text>

            <View style={styles.cartItemDetails}>
              <View style={styles.quantityControl}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => updateCartItem(index, item.quantity - 1)}
                >
                  <Text style={styles.quantityButtonText}>-</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.quantityInput}
                  value={String(item.quantity)}
                  onChangeText={handleQuantityChange}
                  onBlur={(e) =>
                    handleQuantityBlur(
                      (e.nativeEvent as { text?: string }).text ?? String(item.quantity)
                    )
                  }
                  keyboardType="numeric"
                  selectTextOnFocus
                  maxLength={4}
                />
                <TouchableOpacity
                  style={[styles.quantityButton, atStockLimit && styles.quantityButtonDisabled]}
                  onPress={handleIncrement}
                >
                  <Text style={styles.quantityButtonText}>+</Text>
                </TouchableOpacity>
              </View>

              {typeof availableStock === 'number' && (
                <Text style={styles.cartItemStock}>Stock disponible: {availableStock}</Text>
              )}

              <Text style={styles.cartItemTotal}>Total: {formatCurrency(itemTotal)}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const handleOpenCashCollection = () => {
    if (!currentSession) {
      Alert.alert('Error', 'No hay sesión activa');
      return;
    }

    (navigation.navigate as unknown as (route: string, params?: unknown) => void)(
      ROUTES.CASH_COLLECTION,
      { autoStart: true }
    );
  };

  const currentCashCents = cashStatus?.currentCashCents ?? 0;
  const maxCashCents = cashStatus?.maxCashCents ?? 0;
  const percentCurrentRaw = maxCashCents > 0 ? (currentCashCents / maxCashCents) * 100 : 0;
  const percentCurrent = Math.min(100, Math.max(0, percentCurrentRaw));
  const circleSize = 42;
  const progressDegrees = (percentCurrent / 100) * 360;

  const getCashCircleColor = () => {
    switch (cashStatus?.alertLevel) {
      case CashAlertLevel.BLOCKED:
        return theme.color.action.danger.background;
      case CashAlertLevel.CRITICAL:
        return theme.color.icon.warning;
      case CashAlertLevel.WARNING:
        return theme.color.state.warning.border;
      default:
        return theme.color.action.success.background;
    }
  };

  const cashCircleColor = getCashCircleColor();

  return (
    <View style={styles.container}>
      {/* Offline Status Bar */}
      {(isOfflineModeEnabled || connectionStatus !== 'ONLINE' || pendingSales > 0) && (
        <View style={styles.offlineStatusBar}>
          <View
            style={[
              styles.connectionDot,
              connectionStatus === 'ONLINE' ? styles.dotOnline : styles.dotOffline,
            ]}
          />
          <Text style={styles.offlineStatusText}>
            {connectionStatus === 'ONLINE' ? 'Online' : 'Sin conexión'}
          </Text>
          {isOfflineModeEnabled && (
            <View style={styles.offlineBadge}>
              <Text style={styles.offlineBadgeText}>⚡ MODO OFFLINE</Text>
            </View>
          )}
          {isOfflineModeEnabled && (
            <Text style={styles.offlineTokenCount}>🎫 {availableTokens} tokens</Text>
          )}
          {pendingSales > 0 && (
            <Text style={styles.offlinePendingCount}>📋 {pendingSales} pendientes</Text>
          )}
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          Nueva Venta
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.cashCircularButton}
            onPress={handleOpenCashCollection}
            activeOpacity={0.8}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <View
              style={[
                styles.cashCircularVisible,
                Platform.OS === 'web'
                  ? ({
                      background: `conic-gradient(${cashCircleColor} 0deg ${progressDegrees}deg, ${theme.color.border.subtle} ${progressDegrees}deg 360deg)`,
                      borderColor: theme.color.action.primary.background,
                    } as any)
                  : {
                      backgroundColor: theme.color.action.primary.background,
                      borderColor: theme.color.action.primary.background,
                    },
              ]}
            >
              <View style={styles.cashCircularInnerVisible}>
                <Text style={[styles.cashCircularText, { color: cashCircleColor }]}>
                  {Math.round(percentCurrent)}%
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Offline Mode Switch - discreto al lado de Últimas Ventas */}
          <OfflineModeSwitch mini />
          <TouchableOpacity
            style={styles.recentSalesButton}
            onPress={() => handleLoadRecentSales()}
            disabled={loadingSales || isOfflineModeEnabled}
          >
            {loadingSales ? (
              <ActivityIndicator size="small" color={theme.color.text.link} />
            ) : (
              <>
                <Text style={styles.recentSalesIcon}>📋</Text>
                <Text style={styles.recentSalesText}>Últimas Ventas</Text>
              </>
            )}
          </TouchableOpacity>
          {!isOfflineSession && (
            <TouchableOpacity onPress={() => navigation.navigate(ROUTES.POS_DASHBOARD as never)}>
              <Text style={styles.menuButton}>☰</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.content}>
        {/* Left Panel - Product Search */}
        <View style={styles.leftPanel}>
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={handleSearchProducts}
              placeholder="Buscar productos (manual) o escanear código de barras..."
              placeholderTextColor={theme.color.text.placeholder}
              returnKeyType="search"
            />
            {searching && <ActivityIndicator style={styles.searchLoader} />}
          </View>

          {searchResults.length > 0 && (
            <FlatList
              data={searchResults}
              renderItem={renderProductItem}
              keyExtractor={(item) => item.id}
              style={styles.searchResults}
            />
          )}

          {searchQuery.length < 2 && (
            <View style={styles.topSellersSection}>
              <View style={styles.topSellersHeader}>
                <Text style={styles.topSellersTitle}>Más vendidos</Text>
                {isTopSellersLoading && (
                  <ActivityIndicator size="small" color={theme.color.text.link} />
                )}
              </View>

              <FlatList
                data={topSellers}
                renderItem={renderTopSellerItem}
                keyExtractor={(item) => `top-${item.id}`}
                numColumns={topSellerColumns}
                key={`top-sellers-grid-${topSellerColumns}`}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={styles.topSellersList}
                columnWrapperStyle={topSellerColumns > 1 ? styles.topSellersRow : undefined}
                ListEmptyComponent={
                  !isTopSellersLoading ? (
                    <Text style={styles.topSellersEmptyText}>Sin productos más vendidos aún</Text>
                  ) : null
                }
              />
            </View>
          )}
        </View>

        {/* Right Panel - Cart */}
        <View style={[styles.rightPanel, { width: getRightPanelWidth() }]}>
          {/* Customer Search with Autocomplete */}
          <View style={styles.customerSearchContainer}>
            <View style={styles.customerSearchHeader}>
              <Text style={styles.customerSearchLabel}>
                {documentType === '01' ? '📄 Factura' : '🧾 Boleta'}
                {!isOfflineModeEnabled &&
                  selectedCustomer &&
                  ` - ${selectedCustomer.customerType === 'EMPRESA' ? 'Empresa' : 'Persona'}`}
                {isOfflineModeEnabled &&
                  offlineCustomerData.documentNumber &&
                  ` - ${offlineCustomerData.documentType === 'RUC' ? 'Empresa' : 'Persona'}`}
              </Text>
            </View>

            {/* ============ MODO OFFLINE ============ */}
            {isOfflineModeEnabled ? (
              <>
                {/* Cliente Offline seleccionado */}
                {offlineCustomerData.documentNumber ? (
                  <View style={styles.selectedCustomerCard}>
                    <View style={styles.selectedCustomerInfo}>
                      <Text style={styles.selectedCustomerName}>
                        {offlineCustomerData.fullName}
                      </Text>
                      <Text style={styles.selectedCustomerDoc}>
                        {offlineCustomerData.documentType}: {offlineCustomerData.documentNumber}
                      </Text>
                      <View
                        style={[
                          styles.offlineCustomerBadge,
                          {
                            backgroundColor: theme.color.state.warning.background,
                            marginTop: theme.space[1],
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 11, color: theme.color.state.warning.text }}>
                          📴 Cliente Offline
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={handleClearOfflineCustomer}
                      style={styles.removeCustomerButton}
                    >
                      <Text style={styles.removeCustomerButtonText}>🗑️ Borrar</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.offlineAddCustomerButton}
                    onPress={handleOpenOfflineCustomerModal}
                  >
                    <Text style={styles.offlineAddCustomerIcon}>👤</Text>
                    <Text style={styles.offlineAddCustomerText}>Agregar Cliente</Text>
                    <Text style={styles.offlineAddCustomerSubtext}>(Opcional)</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <>
                {/* ============ MODO ONLINE ============ */}
                {/* Selected Customer Card */}
                {selectedCustomer ? (
                  <View style={styles.selectedCustomerCard}>
                    <View style={styles.selectedCustomerInfo}>
                      <Text style={styles.selectedCustomerName}>
                        {selectedCustomer.fullName || selectedCustomer.name}
                      </Text>
                      <Text style={styles.selectedCustomerDoc}>
                        {selectedCustomer.documentType}: {selectedCustomer.documentNumber}
                      </Text>
                      {selectedCustomer.email && (
                        <Text style={styles.selectedCustomerEmail}>
                          📧 {selectedCustomer.email}
                        </Text>
                      )}
                      {selectedCustomer.phone && (
                        <Text style={styles.selectedCustomerPhone}>
                          📱 {selectedCustomer.phone}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={handleClearCustomer}
                      style={styles.removeCustomerButton}
                    >
                      <Text style={styles.removeCustomerButtonText}>🗑️ Borrar</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <View style={styles.customerInputContainer}>
                      <TextInput
                        style={styles.customerSearchInput}
                        value={customerSearchQuery}
                        onChangeText={handleSearchCustomers}
                        placeholder="Buscar cliente por DNI, RUC o nombre..."
                        placeholderTextColor={theme.color.text.placeholder}
                        onFocus={() => {
                          const normalizedQuery = customerSearchQuery.trim();
                          const isValidDNI = /^\d{8}$/.test(normalizedQuery);
                          const isValidRUC = /^\d{11}$/.test(normalizedQuery);
                          if (customerSearchResults.length > 0 || isValidDNI || isValidRUC) {
                            setShowCustomerDropdown(true);
                          }
                        }}
                      />
                      {searchingCustomers && (
                        <ActivityIndicator
                          style={styles.customerSearchLoader}
                          size="small"
                          color={theme.color.text.link}
                        />
                      )}
                    </View>

                    {/* Autocomplete Dropdown */}
                    {showCustomerDropdown && (
                      <View style={styles.customerDropdown}>
                        <ScrollView style={styles.customerDropdownScroll} nestedScrollEnabled>
                          {customerSearchResults.map((customer) => (
                            <TouchableOpacity
                              key={customer.id}
                              style={styles.customerDropdownItem}
                              onPress={() => handleSelectCustomer(customer)}
                            >
                              <View style={styles.customerDropdownItemContent}>
                                <View style={styles.customerDropdownItemHeader}>
                                  <Text style={styles.customerDropdownItemName}>
                                    {customer.fullName || customer.name}
                                  </Text>
                                  <View
                                    style={[
                                      styles.customerTypeBadge,
                                      customer.customerType === 'EMPRESA'
                                        ? styles.customerTypeBadgeEmpresa
                                        : styles.customerTypeBadgePersona,
                                    ]}
                                  >
                                    <Text style={styles.customerTypeBadgeText}>
                                      {customer.customerType === 'EMPRESA' ? 'Empresa' : 'Persona'}
                                    </Text>
                                  </View>
                                </View>
                                <Text style={styles.customerDropdownItemDoc}>
                                  {customer.documentType}: {customer.documentNumber}
                                </Text>
                                {customer.email && (
                                  <Text style={styles.customerDropdownItemEmail}>
                                    📧 {customer.email}
                                  </Text>
                                )}
                                {customer.phone && (
                                  <Text style={styles.customerDropdownItemPhone}>
                                    📱 {customer.phone}
                                  </Text>
                                )}
                              </View>
                            </TouchableOpacity>
                          ))}

                          {/* Opción Agregar Cliente - solo si es DNI/RUC válido */}
                          {isValidDocumentQuery() && (
                            <TouchableOpacity
                              style={styles.addCustomerDropdownItem}
                              onPress={handleOpenAddCustomerModal}
                            >
                              <View style={styles.addCustomerDropdownContent}>
                                <Text style={styles.addCustomerIcon}>➕</Text>
                                <View style={styles.addCustomerTextContainer}>
                                  <Text style={styles.addCustomerTitle}>Agregar Cliente</Text>
                                  <Text style={styles.addCustomerSubtitle}>
                                    {/^\d{8}$/.test(customerSearchQuery.trim())
                                      ? `DNI: ${customerSearchQuery.trim()}`
                                      : `RUC: ${customerSearchQuery.trim()}`}
                                  </Text>
                                </View>
                              </View>
                            </TouchableOpacity>
                          )}
                        </ScrollView>
                      </View>
                    )}
                  </>
                )}
              </>
            )}
          </View>

          {/* Cart Items */}
          <ScrollView style={styles.cartList}>
            {cartItems.length === 0 ? (
              <View style={styles.emptyCart}>
                <Text style={styles.emptyCartText}>Carrito vacío</Text>
                <Text style={styles.emptyCartSubtext}>Busque y agregue productos</Text>
              </View>
            ) : (
              <FlatList
                data={cartItems}
                renderItem={renderCartItem}
                keyExtractor={(_, index) => index.toString()}
              />
            )}
          </ScrollView>

          {/* Totals */}
          <View style={styles.totalsContainer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal:</Text>
              <Text style={styles.totalValue}>{formatCurrency(getCartSubtotal())}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>IGV (18%):</Text>
              <Text style={styles.totalValue}>{formatCurrency(getCartTax())}</Text>
            </View>
            {getCartDiscount() > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Descuento:</Text>
                <Text style={[styles.totalValue, styles.discountValue]}>
                  -{formatCurrency(getCartDiscount())}
                </Text>
              </View>
            )}
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabelBold}>TOTAL:</Text>
              <Text style={styles.totalValueBold}>{formatCurrency(getCartTotal())}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.button, styles.clearButton]}
              onPress={() => {
                clearCart();
                clearPayments();
                handleClearCustomer();
              }}
              disabled={cartItems.length === 0}
            >
              <Text style={styles.clearButtonText}>Limpiar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.processButton]}
              onPress={handleProcessSale}
              disabled={cartItems.length === 0 || isLoading}
            >
              <Text style={styles.processButtonText}>Procesar Venta</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Payment Modal */}
      <Modal
        visible={showPaymentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Forma de Pago</Text>

            <View style={styles.modalTotal}>
              <Text style={styles.modalTotalLabel}>Total a Pagar:</Text>
              <Text style={styles.modalTotalValue}>{formatCurrency(getCartTotal())}</Text>
            </View>

            <ScrollView style={styles.modalScrollContent} showsVerticalScrollIndicator={true}>
              {/* Payment Method Selection */}
              <View style={styles.paymentSelection}>
                <Text style={styles.sectionLabel}>Método de Pago:</Text>
                <View style={styles.methodsGrid}>
                  {paymentMethods
                    .filter((pm) => pm.isActive && !pm.parentId)
                    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
                    .map((method) => (
                      <TouchableOpacity
                        key={method.id}
                        style={[
                          styles.methodButton,
                          selectedParentMethod === method.id && styles.methodButtonSelected,
                        ]}
                        onPress={() => {
                          setSelectedParentMethod(method.id);
                          setSelectedSubmethod(null); // Reset submethod when parent changes
                        }}
                      >
                        <Text
                          style={[
                            styles.methodButtonText,
                            selectedParentMethod === method.id && styles.methodButtonTextSelected,
                          ]}
                        >
                          {method.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </View>

                {/* Show submethods if parent method has them */}
                {selectedParentMethod &&
                  paymentMethods.find((pm) => pm.id === selectedParentMethod)?.submethods &&
                  paymentMethods.find((pm) => pm.id === selectedParentMethod)!.submethods!.length >
                    0 && (
                    <View style={styles.submethodContainer}>
                      <Text style={styles.sectionLabel}>Submétodo:</Text>
                      <View style={styles.methodsGrid}>
                        {paymentMethods
                          .find((pm) => pm.id === selectedParentMethod)
                          ?.submethods?.map((submethod) => (
                            <TouchableOpacity
                              key={submethod.id}
                              style={[
                                styles.methodButton,
                                selectedSubmethod === submethod.id && styles.methodButtonSelected,
                              ]}
                              onPress={() => setSelectedSubmethod(submethod.id)}
                            >
                              <Text
                                style={[
                                  styles.methodButtonText,
                                  selectedSubmethod === submethod.id &&
                                    styles.methodButtonTextSelected,
                                ]}
                              >
                                {submethod.name}
                              </Text>
                            </TouchableOpacity>
                          ))}
                      </View>
                    </View>
                  )}

                {/* Mensaje de advertencia para Izipay */}
                {selectedParentMethod &&
                  (() => {
                    const parentMethod = paymentMethods.find(
                      (pm) => pm.id === selectedParentMethod
                    );
                    const selectedMethod =
                      parentMethod?.submethods && parentMethod.submethods.length > 0
                        ? parentMethod.submethods.find((sm) => sm.id === selectedSubmethod)
                        : parentMethod;
                    const isIzipay =
                      selectedMethod?.code?.includes('IZIPAY') || selectedMethod?.isIzipay;

                    return isIzipay ? (
                      <View style={styles.izipayWarningBox}>
                        <Text style={styles.izipayWarningIcon}>⚠️</Text>
                        <View style={styles.izipayWarningContent}>
                          <Text style={styles.izipayWarningTitle}>Pago con Tarjeta (Izipay)</Text>
                          <Text style={styles.izipayWarningText}>
                            El monto máximo permitido es el total de la venta:{' '}
                            {formatCurrency(getCartTotal())}
                          </Text>
                        </View>
                      </View>
                    ) : null;
                  })()}

                {/* Payment Amount Input */}
                <View style={styles.amountContainer}>
                  <Text style={styles.sectionLabel}>Monto:</Text>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    value={paymentAmount}
                    onChangeText={setPaymentAmount}
                  />
                  <TouchableOpacity
                    style={styles.fillRemainingButton}
                    onPress={() => {
                      const remainingCents = calculateRemainingCents(
                        getCartTotal(),
                        getPaymentsTotal()
                      );
                      setPaymentAmount((remainingCents / 100).toFixed(2));
                    }}
                  >
                    <Text style={styles.fillRemainingButtonText}>Restante</Text>
                  </TouchableOpacity>
                </View>

                {/* Add Payment Button */}
                <TouchableOpacity
                  style={[
                    styles.addPaymentButton,
                    (() => {
                      // Validaciones básicas
                      if (
                        !selectedParentMethod ||
                        !paymentAmount ||
                        parseFloat(paymentAmount) <= 0
                      ) {
                        return styles.buttonDisabled;
                      }

                      const parentMethod = paymentMethods.find(
                        (pm) => pm.id === selectedParentMethod
                      );

                      // Validar submétodo si es necesario
                      if (
                        parentMethod?.submethods &&
                        parentMethod.submethods.length > 0 &&
                        !selectedSubmethod
                      ) {
                        return styles.buttonDisabled;
                      }

                      // Obtener el método seleccionado (submethod o parent)
                      const selectedMethod =
                        parentMethod?.submethods && parentMethod.submethods.length > 0
                          ? parentMethod.submethods.find((sm) => sm.id === selectedSubmethod)
                          : parentMethod;

                      // Validar Izipay: deshabilitar si el monto excede el total
                      const isIzipay =
                        selectedMethod?.code?.includes('IZIPAY') || selectedMethod?.isIzipay;
                      const amount = parseFloat(paymentAmount);
                      const remaining =
                        calculateRemainingCents(getCartTotal(), getPaymentsTotal()) / 100;

                      if (isIzipay && amount > remaining) {
                        return styles.buttonDisabled;
                      }

                      return null;
                    })(),
                  ]}
                  onPress={async () => {
                    const amount = parseFloat(paymentAmount);
                    if (isNaN(amount) || amount <= 0) {
                      Alert.alert('Error', 'Ingrese un monto válido');
                      return;
                    }

                    const parentMethod = paymentMethods.find(
                      (pm) => pm.id === selectedParentMethod
                    );
                    if (!parentMethod) return;

                    // If has submethods, use the selected submethod, otherwise use parent
                    const methodToUse =
                      parentMethod.submethods && parentMethod.submethods.length > 0
                        ? selectedSubmethod
                        : selectedParentMethod;

                    if (!methodToUse) {
                      Alert.alert('Error', 'Seleccione un método de pago');
                      return;
                    }

                    // Obtener el método de pago seleccionado (puede ser submethod o parent)
                    const selectedMethod =
                      parentMethod.submethods && parentMethod.submethods.length > 0
                        ? parentMethod.submethods.find((sm) => sm.id === selectedSubmethod)
                        : parentMethod;

                    // Validar monto según tipo de método de pago
                    const isIzipayMethod =
                      selectedMethod?.code?.includes('IZIPAY') || selectedMethod?.isIzipay;
                    const isCash = selectedMethod?.code === 'CASH' || selectedMethod?.isCash;
                    const usePinPadFlow = isIzipayMethod;
                    const total = getCartTotal();
                    const paid = getPaymentsTotal();
                    const remaining = calculateRemainingCents(total, paid) / 100;

                    console.log('💳 Validando pago:', {
                      method: selectedMethod?.name,
                      code: selectedMethod?.code,
                      isIzipayMethod,
                      isCash,
                      usePinPadFlow,
                      amount,
                      total,
                    });

                    // Si es IZIPAY (tarjeta), validar que no exceda el restante de la venta
                    if (isIzipayMethod && !isIzipayAmountValid(amount, total, paid)) {
                      Alert.alert(
                        'Error',
                        `El monto con tarjeta no puede exceder el restante de la venta (S/ ${remaining.toFixed(
                          2
                        )})`
                      );
                      return;
                    }

                    // Si es Izipay y PinPad está habilitado, procesar con el PinPad Verifone P400
                    if (usePinPadFlow) {
                      const methodName =
                        parentMethod.submethods && parentMethod.submethods.length > 0
                          ? `${parentMethod.name} - ${
                              parentMethod.submethods.find((sm) => sm.id === selectedSubmethod)
                                ?.name
                            }`
                          : parentMethod.name;

                      // Guardar datos pendientes y mostrar modal
                      setPinPadAmountPending(amount);
                      setPinPadMethodPending(methodToUse);
                      setPinPadMethodNamePending(methodName);
                      setPinPadMessage('Conectando con PinPad...');
                      setShowPinPadModal(true);
                      setPinPadProcessing(true);

                      try {
                        // Conectar si no está conectado
                        if (pinPadStatus !== 'CONNECTED' && pinPadStatus !== 'AUTHENTICATED') {
                          setPinPadMessage('Conectando con PinPad...');
                          await connectPinPad();
                        }

                        // Procesar la venta (monto en centavos)
                        const amountCents = Math.round(amount * 100);
                        setPinPadMessage(
                          'Esperando pago en el PinPad...\n\n📱 Escanee QR o\n💳 Inserte, deslice o acerque la tarjeta'
                        );

                        const response = await processPinPadSale(amountCents);

                        if (response.response_code === '00') {
                          // Transacción aprobada
                          setPinPadMessage('✅ Transacción Aprobada');

                          // Agregar el pago al carrito con info de la transacción
                          addPaymentToCart(methodToUse, amount);

                          // Limpiar estados
                          setPaymentAmount('');
                          setSelectedParentMethod(null);
                          setSelectedSubmethod(null);

                          // Mostrar éxito brevemente y cerrar
                          setTimeout(() => {
                            setShowPinPadModal(false);
                            setPinPadProcessing(false);
                            Alert.alert(
                              '✅ Pago Aprobado',
                              `Tarjeta: ${response.card || '****'}\nAutorización: ${response.approval_code || 'N/A'}\nMonto: S/ ${amount.toFixed(2)}`,
                              [{ text: 'OK' }]
                            );
                          }, 1500);
                        } else {
                          // Transacción rechazada
                          setPinPadProcessing(false);
                          setPinPadMessage(
                            `❌ Transacción Rechazada\n\n${response.message || 'Error desconocido'}\nCódigo: ${response.response_code}`
                          );

                          setTimeout(() => {
                            setShowPinPadModal(false);
                          }, 3000);
                        }
                      } catch (error: any) {
                        console.error('❌ Error PinPad:', error);
                        setPinPadProcessing(false);
                        setPinPadMessage(
                          `❌ Error\n\n${error.message || 'Error de comunicación con el PinPad'}`
                        );

                        setTimeout(() => {
                          setShowPinPadModal(false);
                        }, 3000);
                      }
                      return;
                    }

                    // Si es EFECTIVO, permitir cualquier monto (puede ser mayor para dar vuelto)
                    // No hay validación adicional para efectivo

                    const methodName =
                      parentMethod.submethods && parentMethod.submethods.length > 0
                        ? `${parentMethod.name} - ${
                            parentMethod.submethods.find((sm) => sm.id === selectedSubmethod)?.name
                          }`
                        : parentMethod.name;

                    addPaymentToCart(methodToUse, amount);
                    setPaymentAmount('');
                    setSelectedParentMethod(null);
                    setSelectedSubmethod(null);
                  }}
                >
                  <Text style={styles.addPaymentButtonText}>+ Agregar Pago</Text>
                </TouchableOpacity>
              </View>

              {cartPayments.length > 0 && (
                <View style={styles.selectedPayments}>
                  <Text style={styles.selectedPaymentsTitle}>Pagos Agregados:</Text>
                  {cartPayments.map((payment, index) => (
                    <View key={index} style={styles.paymentRow}>
                      <View style={styles.paymentInfo}>
                        <Text style={styles.paymentName}>{payment.paymentMethodName}</Text>
                        <Text style={styles.paymentAmount}>{formatCurrency(payment.amount)}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.removePaymentButton}
                        onPress={() => removeCartPayment(index)}
                      >
                        <Text style={styles.removePaymentIcon}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <View style={styles.divider} />

                  {/* Payment Summary */}
                  <View style={styles.paymentSummary}>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Total a Pagar:</Text>
                      <Text style={styles.summaryValue}>{formatCurrency(getCartTotal())}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Total Pagado:</Text>
                      <Text style={styles.summaryValuePaid}>
                        {formatCurrency(getPaymentsTotal())}
                      </Text>
                    </View>

                    {/* Faltante/Vuelto - Grande y Destacado */}
                    {toCents(getPaymentsTotal()) !== toCents(getCartTotal()) && (
                      <View
                        style={[
                          styles.changeHighlightBox,
                          toCents(getPaymentsTotal()) < toCents(getCartTotal())
                            ? styles.changeHighlightBoxMissing
                            : styles.changeHighlightBoxChange,
                        ]}
                      >
                        <Text style={styles.changeHighlightLabel}>
                          {toCents(getPaymentsTotal()) < toCents(getCartTotal())
                            ? '⚠️ FALTANTE'
                            : '💰 VUELTO'}
                        </Text>
                        <Text
                          style={[
                            styles.changeHighlightValue,
                            toCents(getPaymentsTotal()) < toCents(getCartTotal())
                              ? styles.summaryValueMissing
                              : styles.summaryValueChange,
                          ]}
                        >
                          {formatCurrency(
                            Math.abs(toCents(getPaymentsTotal()) - toCents(getCartTotal())) / 100
                          )}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.modalCancelButton]}
                onPress={() => {
                  setShowPaymentModal(false);
                  clearPayments();
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.button,
                  styles.modalConfirmButton,
                  (() => {
                    const totalCents = toCents(getCartTotal());
                    const paymentsTotalCents = toCents(getPaymentsTotal());
                    const hasInsufficientPayment = paymentsTotalCents < totalCents;
                    const isDisabled = hasInsufficientPayment || isLoading || isConfirmingSale;
                    return isDisabled ? styles.buttonDisabled : null;
                  })(),
                ]}
                onPress={async () => {
                  const total = getCartTotal();
                  const paymentsTotal = getPaymentsTotal();
                  const totalCents = toCents(total);
                  const paymentsTotalCents = toCents(paymentsTotal);
                  const hasInsufficientPayment = paymentsTotalCents < totalCents;
                  const isDisabled = hasInsufficientPayment || isLoading || isConfirmingSale;

                  console.log('🔘 Botón presionado');
                  console.log('💰 Total carrito:', total);
                  console.log('💳 Total pagos:', paymentsTotal);
                  console.log('🔒 Está deshabilitado:', isDisabled);
                  console.log('⏳ isLoading:', isLoading);

                  if (hasInsufficientPayment) {
                    const missing = (totalCents - paymentsTotalCents) / 100;
                    Alert.alert('Pago insuficiente', `Falta pagar S/ ${missing.toFixed(2)}`);
                    return;
                  }

                  if (isLoading || isConfirmingSale) {
                    console.log('❌ Confirmación en progreso, ignorando click');
                    return;
                  }

                  await handleCompleteSale();
                }}
              >
                {isLoading || isConfirmingSale ? (
                  <ActivityIndicator color={theme.color.text.onAction} />
                ) : (
                  <Text style={styles.modalConfirmButtonText}>Confirmar Venta</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Recent Sales Modal */}
      <Modal
        visible={showRecentSales}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRecentSales(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.salesModalContent}>
            <View style={styles.salesModalHeader}>
              <Text style={styles.modalTitle}>Ventas de la Sesión Activa</Text>
              <TouchableOpacity onPress={() => setShowRecentSales(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            {activeSalesData && (
              <View style={styles.salesSummary}>
                <Text style={styles.summaryTitle}>Resumen de Ventas</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total de ventas:</Text>
                  <Text style={styles.summaryValue}>{activeSalesData.summary.totalSalesCount}</Text>
                </View>
              </View>
            )}

            <ScrollView style={styles.salesList}>
              {!activeSalesData || activeSalesData.sales.length === 0 ? (
                <View style={styles.emptySales}>
                  <Text style={styles.emptySalesText}>
                    No hay ventas registradas en esta sesión
                  </Text>
                </View>
              ) : (
                activeSalesData.sales.map((saleData) => {
                  const { saleId, sale, transactions } = saleData;

                  // Calcular total pagado desde las transacciones
                  const totalPaid = transactions.reduce((sum, t) => sum + t.amount, 0);

                  // Verificar si tiene nota de crédito
                  const hasCreditNote = sale.hasCreditNote || false;

                  return (
                    <View key={saleId} style={styles.saleItem}>
                      <TouchableOpacity
                        style={styles.saleItemClickable}
                        onPress={() => {
                          setShowRecentSales(false);
                          // @ts-expect-error - Navigation types
                          navigation.navigate(ROUTES.SALE_DETAIL, { saleId });
                        }}
                      >
                        <View style={styles.saleItemHeader}>
                          <View style={styles.saleNumberContainer}>
                            <Text style={styles.saleNumber}>
                              {sale.code} - #{sale.saleNumber}
                            </Text>
                            {hasCreditNote && (
                              <View style={styles.creditNoteBadge}>
                                <Text style={styles.creditNoteBadgeText}>📝 NC</Text>
                              </View>
                            )}
                          </View>
                          {(() => {
                            const getStatusStyle = (status: string) => {
                              switch (status) {
                                case 'DRAFT':
                                  return {
                                    style: styles.statusDraft,
                                    text: '📝 Borrador',
                                  };
                                case 'CONFIRMED':
                                  return {
                                    style: styles.statusConfirmed,
                                    text: '✓ Confirmada',
                                  };
                                case 'CONFIRMED_DEV_PARCIAL':
                                  return {
                                    style: styles.statusDevParcial,
                                    text: '↩️ Dev. Parcial',
                                  };
                                case 'CONFIRMED_DEV_TOTAL':
                                  return {
                                    style: styles.statusDevTotal,
                                    text: '↩️ Dev. Total',
                                  };
                                case 'INVOICED':
                                  return {
                                    style: styles.statusInvoiced,
                                    text: '📄 Facturada',
                                  };
                                case 'PAID':
                                  return {
                                    style: styles.statusPaid,
                                    text: '💰 Pagada',
                                  };
                                case 'CANCELLED':
                                  return {
                                    style: styles.statusCancelled,
                                    text: '✗ Cancelada',
                                  };
                                case 'REFUNDED':
                                  return {
                                    style: styles.statusRefunded,
                                    text: '💸 Reembolsada',
                                  };
                                default:
                                  return {
                                    style: styles.statusDefault,
                                    text: status,
                                  };
                              }
                            };
                            const statusInfo = getStatusStyle(sale.status);
                            return (
                              <View style={statusInfo.style}>
                                <Text style={styles.statusText}>{statusInfo.text}</Text>
                              </View>
                            );
                          })()}
                        </View>
                        <View style={styles.saleItemDetails}>
                          <Text style={styles.saleDocType}>
                            {sale.documentType === 'FACTURA' ? 'Factura' : 'Boleta'}
                            {' - '}
                            {sale.saleType}
                          </Text>
                          <Text style={styles.saleTotal}>{formatCurrency(sale.total)}</Text>
                        </View>
                        {sale.customerSnapshot && (
                          <Text style={styles.saleCustomer}>
                            Cliente: {sale.customerSnapshot.fullName || 'Sin nombre'}
                            {sale.customerSnapshot.documentNumber &&
                              ` - ${sale.customerSnapshot.documentNumber}`}
                          </Text>
                        )}

                        {/* Métodos de Pago */}
                        {transactions && transactions.length > 0 && (
                          <View style={styles.salePaymentsContainer}>
                            <Text style={styles.salePaymentsTitle}>💳 Métodos de Pago:</Text>
                            {transactions.map((transaction, index) => (
                              <View key={index} style={styles.salePaymentRow}>
                                <Text style={styles.salePaymentMethod}>
                                  • {transaction.paymentMethod.name}
                                </Text>
                                <Text style={styles.salePaymentAmount}>
                                  {formatCurrency(transaction.amount)}
                                </Text>
                              </View>
                            ))}
                            <View style={styles.salePaymentTotal}>
                              <Text style={styles.salePaymentTotalLabel}>Total Pagado:</Text>
                              <Text style={styles.salePaymentTotalValue}>
                                {formatCurrency(totalPaid)}
                              </Text>
                            </View>
                          </View>
                        )}

                        <View style={styles.saleItemDetails}>
                          <Text style={styles.saleItemCount}>
                            📦 {sale.itemCount} items ({sale.totalQuantity} unidades)
                          </Text>
                        </View>
                        <Text style={styles.saleDate}>
                          {new Date(sale.saleDate).toLocaleString('es-PE', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </TouchableOpacity>

                      {/* Botones de acción */}
                      <View style={styles.saleItemActions}>
                        {/* Botón de Reimprimir Ticket */}
                        <TouchableOpacity
                          style={styles.reprintButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleReprintTicket(saleId);
                          }}
                        >
                          <Text style={styles.reprintButtonIcon}>🖨️</Text>
                          <Text style={styles.reprintButtonText}>Reimprimir Ticket</Text>
                        </TouchableOpacity>

                        {/* Botón de Nota de Crédito */}
                        {hasCreditNote ? (
                          <TouchableOpacity
                            style={styles.manageCreditNoteButton}
                            onPress={(e) => {
                              console.log('🟣 [BUTTON] Botón Gestionar NC presionado');
                              console.log('🟣 [BUTTON] Sale ID:', saleId);
                              console.log('🟣 [BUTTON] Credit Notes:', sale.creditNotes);
                              e.stopPropagation();
                              void handleOpenCreditNoteManagement(saleData);
                            }}
                          >
                            <Text style={styles.creditNoteButtonIcon}>📋</Text>
                            <Text style={styles.creditNoteButtonText}>Gestionar NC</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={styles.generateCreditNoteButton}
                            onPress={(e) => {
                              console.log('🟠 [BUTTON] Botón Generar NC presionado');
                              console.log('🟠 [BUTTON] Sale ID:', saleId);
                              console.log('🟠 [BUTTON] Has Credit Note:', hasCreditNote);
                              e.stopPropagation();
                              void handleGenerateCreditNote(saleId);
                            }}
                          >
                            <Text style={styles.generateCreditNoteButtonIcon}>📝</Text>
                            <Text style={styles.generateCreditNoteButtonText}>Generar NC</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            {/* Paginación */}
            {activeSalesData &&
              activeSalesData.pagination &&
              (() => {
                const page = Math.max(1, Number(activeSalesData.pagination.page) || 1);
                const totalPages = Math.max(1, Number(activeSalesData.pagination.totalPages) || 1);
                const hasPreviousPage =
                  typeof activeSalesData.pagination.hasPreviousPage === 'boolean'
                    ? activeSalesData.pagination.hasPreviousPage
                    : page > 1;
                const hasNextPage =
                  typeof activeSalesData.pagination.hasNextPage === 'boolean'
                    ? activeSalesData.pagination.hasNextPage
                    : page < totalPages;

                if (totalPages <= 1) return null;

                return (
                  <View style={styles.paginationContainer}>
                    <TouchableOpacity
                      style={[
                        styles.paginationButton,
                        !hasPreviousPage && styles.paginationButtonDisabled,
                      ]}
                      onPress={() => handleLoadRecentSales(page - 1)}
                      disabled={!hasPreviousPage || loadingSales}
                    >
                      <Text
                        style={[
                          styles.paginationButtonText,
                          !hasPreviousPage && styles.paginationButtonTextDisabled,
                        ]}
                      >
                        ← Anterior
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.paginationInfo}>
                      <Text style={styles.paginationText}>
                        Página {page} de {totalPages}
                      </Text>
                      <Text style={styles.paginationSubtext}>
                        ({activeSalesData.pagination.totalSales} ventas totales)
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.paginationButton,
                        !hasNextPage && styles.paginationButtonDisabled,
                      ]}
                      onPress={() => handleLoadRecentSales(page + 1)}
                      disabled={!hasNextPage || loadingSales}
                    >
                      <Text
                        style={[
                          styles.paginationButtonText,
                          !hasNextPage && styles.paginationButtonTextDisabled,
                        ]}
                      >
                        Siguiente →
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })()}

            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setShowRecentSales(false)}
            >
              <Text style={styles.closeModalButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Barcode Duplicate Selection Modal */}
      <Modal
        visible={showBarcodeSelectionModal}
        animationType="fade"
        transparent={true}
        onRequestClose={handleCloseBarcodeSelectionModal}
      >
        <View style={styles.barcodeSelectionModalOverlay}>
          <View style={styles.barcodeSelectionModalContent}>
            <View style={styles.barcodeSelectionModalHeader}>
              <Text style={styles.barcodeSelectionTitle}>Selecciona un producto</Text>
              <TouchableOpacity
                style={styles.barcodeSelectionCloseButton}
                onPress={handleCloseBarcodeSelectionModal}
              >
                <Text style={styles.barcodeSelectionCloseButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.barcodeSelectionSubtitle}>
              Se encontraron varios productos con el código: {lastScannedBarcode}
            </Text>

            <FlatList
              data={barcodeSelectionProducts}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.barcodeSelectionRow}
              contentContainerStyle={styles.barcodeSelectionListContent}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.barcodeSelectionCard}
                  onPress={() => handleSelectBarcodeProduct(item)}
                >
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.barcodeSelectionImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.barcodeSelectionImagePlaceholder}>
                      <Text style={styles.barcodeSelectionImagePlaceholderText}>📦</Text>
                    </View>
                  )}
                  <Text style={styles.barcodeSelectionProductName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.barcodeSelectionProductCode}>
                    Código: {item.code || item.barcode}
                  </Text>
                  <Text style={styles.barcodeSelectionProductPrice}>
                    {formatCurrency(item.price || 0)}
                  </Text>
                  <Text style={styles.barcodeSelectionProductStock}>Stock: {item.stock || 0}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Image Modal */}
      <Modal
        visible={showImageModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowImageModal(false)}
      >
        <TouchableOpacity
          style={styles.imageModalOverlay}
          activeOpacity={1}
          onPress={() => setShowImageModal(false)}
        >
          <View style={styles.imageModalContent}>
            <TouchableOpacity
              style={styles.imageModalCloseButton}
              onPress={() => setShowImageModal(false)}
            >
              <Text style={styles.imageModalCloseText}>✕</Text>
            </TouchableOpacity>
            {selectedImage && (
              <Image
                source={{ uri: selectedImage }}
                style={styles.imageModalImage}
                resizeMode="contain"
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Credit Note Management Modal */}
      <Modal
        visible={showCreditNoteManagementModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowCreditNoteManagementModal(false);
          setSelectedSaleForCreditNoteManagement(null);
          setCreditNoteReturnedQuantities({});
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.creditNoteManagementModalContent}>
            <View style={styles.creditNoteModalHeader}>
              <Text style={styles.modalTitle}>Gestionar Notas de Crédito</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCreditNoteManagementModal(false);
                  setSelectedSaleForCreditNoteManagement(null);
                  setCreditNoteReturnedQuantities({});
                }}
              >
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedSaleForCreditNoteManagement && (
              <ScrollView
                style={styles.creditNoteManagementScroll}
                contentContainerStyle={styles.creditNoteManagementScrollContent}
                showsVerticalScrollIndicator
              >
                <View style={styles.creditNoteSaleInfo}>
                  <Text style={styles.creditNoteSaleNumber}>
                    Venta: {selectedSaleForCreditNoteManagement.sale.code} - #
                    {selectedSaleForCreditNoteManagement.sale.saleNumber}
                  </Text>
                  <Text style={styles.creditNoteSaleTotal}>
                    Total venta: {formatCurrency(selectedSaleForCreditNoteManagement.sale.total)}
                  </Text>
                  <Text style={styles.creditNoteManagementSummaryText}>
                    NC emitidas: {selectedSaleForCreditNoteManagement.sale.creditNotes?.length || 0}
                  </Text>
                </View>

                {loadingCreditNoteManagement && (
                  <View style={styles.creditNoteManagementLoadingBox}>
                    <ActivityIndicator size="small" color={theme.color.icon.accent} />
                    <Text style={styles.creditNoteManagementLoadingText}>
                      Cargando detalle de notas de crédito...
                    </Text>
                  </View>
                )}

                <View style={styles.creditNoteManagementSection}>
                  <Text style={styles.creditNoteManagementSectionTitle}>Notas emitidas</Text>
                  {!selectedSaleForCreditNoteManagement.sale.creditNotes ||
                  selectedSaleForCreditNoteManagement.sale.creditNotes.length === 0 ? (
                    <Text style={styles.creditNoteManagementEmptyText}>
                      Esta venta todavía no tiene notas de crédito.
                    </Text>
                  ) : (
                    selectedSaleForCreditNoteManagement.sale.creditNotes.map(
                      (creditNote: any, index: number) => (
                        <View key={creditNote.id || index} style={styles.creditNoteManagementItem}>
                          <View style={styles.creditNoteManagementItemInfo}>
                            <Text style={styles.creditNoteManagementItemTitle}>
                              {creditNote.code || creditNote.documentNumber || `NC ${index + 1}`}
                            </Text>
                            <Text style={styles.creditNoteManagementItemDetail}>
                              Estado: {creditNote.status || 'Sin estado'}
                            </Text>
                            {!!creditNote.createdAt && (
                              <Text style={styles.creditNoteManagementItemDetail}>
                                Fecha:{' '}
                                {new Date(creditNote.createdAt).toLocaleString('es-PE', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </Text>
                            )}
                          </View>
                          <TouchableOpacity
                            style={styles.creditNoteManagementDownloadButton}
                            onPress={() =>
                              void handlePrintSingleCreditNote(
                                selectedSaleForCreditNoteManagement.saleId,
                                creditNote
                              )
                            }
                          >
                            <Text style={styles.creditNoteManagementDownloadButtonText}>
                              Imprimir
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )
                    )
                  )}
                </View>

                <View style={styles.creditNoteManagementSection}>
                  <Text style={styles.creditNoteManagementSectionTitle}>Productos disponibles</Text>
                  {selectedSaleForCreditNoteManagement.sale.items.map(
                    (item: any, index: number) => {
                      const summaryItem = findCreditNoteSummaryForSaleItem(
                        selectedSaleForCreditNoteManagement,
                        item,
                        index
                      );
                      const purchasedQuantity =
                        summaryItem?.purchasedQuantity ?? getCreditNoteProductQuantity(item);
                      const creditedQuantity = getCreditNoteCreditedQuantity(
                        item,
                        index,
                        creditNoteReturnedQuantities,
                        selectedSaleForCreditNoteManagement
                      );
                      const availableQuantity = getCreditNoteAvailableQuantity(
                        item,
                        index,
                        creditNoteReturnedQuantities,
                        selectedSaleForCreditNoteManagement
                      );
                      const returns = summaryItem?.returns || [];

                      return (
                        <View
                          key={getCreditNoteProductId(item, index)}
                          style={styles.creditNoteAvailableItem}
                        >
                          <Text style={styles.creditNoteAvailableItemName}>
                            {summaryItem?.productName || getCreditNoteProductName(item)}
                          </Text>
                          <Text style={styles.creditNoteAvailableItemDetail}>
                            Comprado: {purchasedQuantity} | Devuelto: {creditedQuantity} |
                            Disponible: {availableQuantity}
                          </Text>
                          {returns.map((returnedItem: any, returnIndex: number) => (
                            <Text
                              key={returnedItem.creditNoteId || returnIndex}
                              style={styles.creditNoteAvailableReturnDetail}
                            >
                              {returnedItem.documentNumber || `NC ${returnIndex + 1}`}:{' '}
                              {returnedItem.quantity} devuelto(s)
                            </Text>
                          ))}
                        </View>
                      );
                    }
                  )}
                </View>

                {!isTotalCreditNoteSale(selectedSaleForCreditNoteManagement.sale) && (
                  <TouchableOpacity
                    style={styles.creditNoteManagementGenerateButton}
                    onPress={() =>
                      void handleGenerateCreditNote(
                        selectedSaleForCreditNoteManagement.saleId,
                        true,
                        selectedSaleForCreditNoteManagement
                      )
                    }
                  >
                    <Text style={styles.creditNoteManagementGenerateButtonText}>
                      Generar nueva NC con saldo restante
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Credit Note Modal */}
      <Modal
        visible={showCreditNoteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowCreditNoteModal(false);
          setCreditNoteType(null);
          setSelectedProductsForCreditNote([]);
          setCreditNoteProductQuantities({});
          setCreditNoteRemainingMode(false);
          setCreditNoteMotivo('06');
          setCreditNoteSustento('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.creditNoteModalContent}>
            <View style={styles.creditNoteModalHeader}>
              <Text style={styles.modalTitle}>Generar Nota de Crédito</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCreditNoteModal(false);
                  setCreditNoteType(null);
                  setSelectedProductsForCreditNote([]);
                  setCreditNoteMotivo('06');
                  setCreditNoteSustento('');
                }}
              >
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedSaleForCreditNote && (
              <ScrollView
                style={styles.creditNoteModalScroll}
                contentContainerStyle={styles.creditNoteModalScrollContent}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled
              >
                <View style={styles.creditNoteSaleInfo}>
                  <Text style={styles.creditNoteSaleNumber}>
                    Venta: {selectedSaleForCreditNote.sale.code} - #
                    {selectedSaleForCreditNote.sale.saleNumber}
                  </Text>
                  <Text style={styles.creditNoteSaleTotal}>
                    Total: {formatCurrency(selectedSaleForCreditNote.sale.total)}
                  </Text>
                </View>

                {/* Tipo de Devolución */}
                <View style={styles.creditNoteTypeContainer}>
                  <Text style={styles.creditNoteTypeLabel}>Tipo de Devolución:</Text>
                  <View style={styles.creditNoteTypeButtons}>
                    <TouchableOpacity
                      style={[
                        styles.creditNoteTypeButton,
                        creditNoteType === 'total' && styles.creditNoteTypeButtonActive,
                      ]}
                      onPress={() => {
                        setCreditNoteType('total');
                        setSelectedProductsForCreditNote([]);
                        setCreditNoteMotivo('06'); // Devolución total
                      }}
                    >
                      <Text
                        style={[
                          styles.creditNoteTypeButtonText,
                          creditNoteType === 'total' && styles.creditNoteTypeButtonTextActive,
                        ]}
                      >
                        📦 Devolución Total
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.creditNoteTypeButton,
                        creditNoteType === 'partial' && styles.creditNoteTypeButtonActive,
                      ]}
                      onPress={() => {
                        setCreditNoteType('partial');
                        setCreditNoteMotivo('07'); // Devolución por ítem
                      }}
                    >
                      <Text
                        style={[
                          styles.creditNoteTypeButtonText,
                          creditNoteType === 'partial' && styles.creditNoteTypeButtonTextActive,
                        ]}
                      >
                        📋 Devolución Parcial
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Sustento de la Nota de Crédito */}
                <View style={styles.creditNoteFieldContainer}>
                  <Text style={styles.creditNoteFieldLabel}>Sustento *:</Text>
                  <TextInput
                    style={styles.creditNoteSustentoInput}
                    value={creditNoteSustento}
                    onChangeText={setCreditNoteSustento}
                    placeholder="Ingrese el motivo de la devolución..."
                    placeholderTextColor={theme.color.text.placeholder}
                    multiline
                    numberOfLines={3}
                    maxLength={250}
                  />
                  <Text style={styles.creditNoteCharCount}>
                    {creditNoteSustento.length}/250 caracteres
                  </Text>
                </View>

                {/* Lista de Productos (solo si es devolución parcial) */}
                {creditNoteType === 'partial' && (
                  <View style={styles.creditNoteProductsContainer}>
                    <Text style={styles.creditNoteProductsLabel}>
                      Seleccione los productos a devolver:
                    </Text>
                    <ScrollView style={styles.creditNoteProductsList} nestedScrollEnabled>
                      {selectedSaleForCreditNote.sale.items.map((item: any, index: number) => {
                        const productId = getCreditNoteProductId(item, index);
                        const productName = getCreditNoteProductName(item);
                        const productSku = getCreditNoteProductSku(item);
                        const summaryItem = findCreditNoteSummaryForSaleItem(
                          selectedSaleForCreditNote,
                          item,
                          index
                        );
                        const purchasedQuantity =
                          summaryItem?.purchasedQuantity ?? getCreditNoteProductQuantity(item);
                        const creditedQuantity = getCreditNoteCreditedQuantity(
                          item,
                          index,
                          creditNoteReturnedQuantities,
                          selectedSaleForCreditNote
                        );
                        const limitQuantity = getCreditNoteItemLimitQuantity(item, index);
                        const quantityText =
                          creditNoteProductQuantities[productId] ?? String(limitQuantity);
                        const quantity = getCreditNoteEditedQuantity(productId, limitQuantity);
                        const unitPrice = getCreditNoteProductUnitPrice(
                          item,
                          selectedSaleForCreditNote,
                          index
                        );
                        const isSelected = selectedProductsForCreditNote.includes(productId);

                        if (creditNoteRemainingMode && limitQuantity <= 0) {
                          return null;
                        }
                        return (
                          <TouchableOpacity
                            key={productId}
                            style={[
                              styles.creditNoteProductItem,
                              isSelected && styles.creditNoteProductItemSelected,
                            ]}
                            onPress={() => toggleProductSelection(productId)}
                          >
                            <View style={styles.creditNoteProductCheckbox}>
                              <Text style={styles.creditNoteProductCheckboxIcon}>
                                {isSelected ? '☑' : '☐'}
                              </Text>
                            </View>
                            <View style={styles.creditNoteProductInfo}>
                              <Text style={styles.creditNoteProductName}>{productName}</Text>
                              {!!productSku && (
                                <Text style={styles.creditNoteProductSku}>SKU: {productSku}</Text>
                              )}
                              <Text style={styles.creditNoteProductDetails}>
                                Comprado: {purchasedQuantity}
                                {creditNoteRemainingMode && ` | Devuelto: ${creditedQuantity}`}
                                {' | '}Disponible: {limitQuantity} | Precio:{' '}
                                {formatCurrency(unitPrice)}
                              </Text>
                              <View style={styles.creditNoteQuantityRow}>
                                <Text style={styles.creditNoteQuantityLabel}>Devolver:</Text>
                                <TextInput
                                  style={styles.creditNoteQuantityInput}
                                  value={quantityText}
                                  onChangeText={(value) =>
                                    updateCreditNoteProductQuantity(productId, value, limitQuantity)
                                  }
                                  keyboardType="numeric"
                                  selectTextOnFocus
                                />
                              </View>
                            </View>
                            <Text style={styles.creditNoteProductTotal}>
                              {formatCurrency(
                                (Number.isFinite(quantity) ? quantity : 0) * unitPrice
                              )}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {/* Indicador de Carga */}
                {generatingCreditNote && (
                  <View style={styles.creditNoteLoadingContainer}>
                    <ActivityIndicator size="large" color={theme.color.icon.warning} />
                    <Text style={styles.creditNoteLoadingText}>Generando nota de crédito...</Text>
                    <Text style={styles.creditNoteLoadingSubtext}>
                      Este proceso puede tardar unos segundos
                    </Text>
                  </View>
                )}

                {/* Botones de Acción */}
                <View style={styles.creditNoteActions}>
                  <TouchableOpacity
                    style={[
                      styles.creditNoteCancelButton,
                      generatingCreditNote && styles.creditNoteButtonDisabled,
                    ]}
                    onPress={() => {
                      setShowCreditNoteModal(false);
                      setCreditNoteType(null);
                      setSelectedProductsForCreditNote([]);
                      setCreditNoteMotivo('06');
                      setCreditNoteSustento('');
                    }}
                    disabled={generatingCreditNote}
                  >
                    <Text style={styles.creditNoteCancelButtonText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.creditNoteConfirmButton,
                      (!creditNoteType || !creditNoteSustento.trim() || generatingCreditNote) &&
                        styles.creditNoteConfirmButtonDisabled,
                    ]}
                    onPress={handleConfirmCreditNote}
                    disabled={!creditNoteType || !creditNoteSustento.trim() || generatingCreditNote}
                  >
                    {generatingCreditNote ? (
                      <ActivityIndicator size="small" color={theme.color.text.onAction} />
                    ) : (
                      <Text style={styles.creditNoteConfirmButtonText}>Generar NC</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Sale Success Modal */}
      <Modal
        visible={showSaleSuccessModal}
        animationType="fade"
        transparent={true}
        onRequestClose={handleNewSale}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModalContent}>
            <View style={styles.successHeader}>
              <Text style={styles.successIcon}>✓</Text>
              <Text style={styles.successTitle}>¡Venta Procesada!</Text>
            </View>

            {saleResponse && (
              <View style={styles.successDetails}>
                {/* Total a Pagar - Grande y Destacado */}
                <View style={styles.successTotalBox}>
                  <Text style={styles.successTotalLabel}>TOTAL A PAGAR</Text>
                  <Text style={styles.successTotalValue}>
                    {formatCurrency(saleResponse.sale.totalCents / 100)}
                  </Text>
                </View>

                {/* Vuelto - Grande y Destacado */}
                {saleChange > 0 && (
                  <View style={styles.successChangeBox}>
                    <Text style={styles.successChangeLabel}>💰 VUELTO</Text>
                    <Text style={styles.successChangeValue}>{formatCurrency(saleChange)}</Text>
                  </View>
                )}

                <View style={styles.divider} />

                <View style={styles.successRow}>
                  <Text style={styles.successLabel}>Código de Venta:</Text>
                  <Text style={styles.successValue}>{saleResponse.sale.code}</Text>
                </View>

                <View style={styles.successRow}>
                  <Text style={styles.successLabel}>Tipo de Documento:</Text>
                  <Text style={styles.successValue}>{saleResponse.document.type}</Text>
                </View>

                <View style={styles.successRow}>
                  <Text style={styles.successLabel}>Estado:</Text>
                  <Text style={styles.successValue}>{saleResponse.document.status}</Text>
                </View>

                <View style={styles.successRow}>
                  <Text style={styles.successLabel}>Fecha:</Text>
                  <Text style={styles.successValue}>
                    {new Date(saleResponse.sale.createdAt).toLocaleString('es-PE', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.successButtons}>
              <TouchableOpacity
                style={[styles.button, styles.printButton]}
                onPress={() => handlePrintPDF()}
              >
                <Text style={styles.printButtonText}>🖨️ Imprimir PDF</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.newSaleButton]}
                onPress={handleNewSale}
              >
                <Text style={styles.newSaleButtonText}>Nueva Venta</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Offline Sale Success Modal */}
      <Modal
        visible={showOfflineSaleSuccessModal}
        animationType="fade"
        transparent={true}
        onRequestClose={handleNewSaleFromOffline}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.offlineSuccessModalContent}>
            <View style={styles.offlineSuccessHeader}>
              <Text style={styles.offlineSuccessIcon}>📴</Text>
              <Text style={styles.offlineSuccessTitle}>Venta Offline Registrada</Text>
            </View>

            {/* Warning banner */}
            <View style={styles.offlineWarningBanner}>
              <Text style={styles.offlineWarningIcon}>⚠️</Text>
              <Text style={styles.offlineWarningText}>
                Este ticket NO es un comprobante válido ante SUNAT.{'\n'}
                El cliente podrá obtener su comprobante escaneando el QR.
              </Text>
            </View>

            {offlineSaleResponse && (
              <View style={styles.successDetails}>
                {/* Total a Pagar - Grande y Destacado */}
                <View style={styles.offlineSuccessTotalBox}>
                  <Text style={styles.successTotalLabel}>TOTAL</Text>
                  <Text style={styles.successTotalValue}>
                    {formatCurrency(offlineSaleResponse.totalCents / 100)}
                  </Text>
                </View>

                {/* Vuelto - Grande y Destacado */}
                {offlineSaleChange > 0 && (
                  <View style={styles.successChangeBox}>
                    <Text style={styles.successChangeLabel}>💰 VUELTO</Text>
                    <Text style={styles.successChangeValue}>
                      {formatCurrency(offlineSaleChange)}
                    </Text>
                  </View>
                )}

                <View style={styles.divider} />

                <View style={styles.successRow}>
                  <Text style={styles.successLabel}>Código Offline:</Text>
                  <Text style={styles.offlineTicketCode}>
                    {offlineSaleResponse.offlineTicketCode}
                  </Text>
                </View>

                <View style={styles.successRow}>
                  <Text style={styles.successLabel}>Tipo de Documento:</Text>
                  <Text style={styles.successValue}>
                    {offlineSaleResponse.documentType === '01' ? 'Factura' : 'Boleta'}
                  </Text>
                </View>

                <View style={styles.successRow}>
                  <Text style={styles.successLabel}>Fecha:</Text>
                  <Text style={styles.successValue}>
                    {new Date(offlineSaleResponse.createdAt).toLocaleString('es-PE', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>

                <View style={styles.successRow}>
                  <Text style={styles.successLabel}>Productos:</Text>
                  <Text style={styles.successValue}>{offlineSaleResponse.items.length} items</Text>
                </View>

                <View style={styles.successRow}>
                  <Text style={styles.successLabel}>Estado:</Text>
                  <View style={styles.offlinePendingBadge}>
                    <Text style={styles.offlinePendingText}>⏳ Pendiente de sincronizar</Text>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.successButtons}>
              <TouchableOpacity
                style={[styles.button, styles.offlinePrintButton]}
                onPress={() => handlePrintOfflineTicket()}
              >
                <Text style={styles.printButtonText}>🖨️ Reimprimir Ticket</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.newSaleButton]}
                onPress={handleNewSaleFromOffline}
              >
                <Text style={styles.newSaleButtonText}>Nueva Venta</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Customer Modal */}
      <Modal
        visible={showAddCustomerModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddCustomerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addCustomerModalContent}>
            <View style={styles.addCustomerModalHeader}>
              <Text style={styles.addCustomerModalTitle}>
                {newCustomerData.customerType === 'EMPRESA'
                  ? '🏢 Nueva Empresa'
                  : '👤 Nuevo Cliente'}
              </Text>
              <TouchableOpacity
                style={styles.addCustomerCloseButton}
                onPress={() => setShowAddCustomerModal(false)}
              >
                <Text style={styles.addCustomerCloseButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {lookupLoading ? (
              <View style={styles.addCustomerLoading}>
                <ActivityIndicator size="large" color={theme.color.text.success} />
                <Text style={styles.addCustomerLoadingText}>Consultando datos...</Text>
              </View>
            ) : (
              <ScrollView style={styles.addCustomerForm} showsVerticalScrollIndicator={false}>
                {/* Documento */}
                <View style={styles.addCustomerFormGroup}>
                  <Text style={styles.addCustomerLabel}>
                    {newCustomerData.documentType === 'RUC' ? 'RUC' : 'DNI'}
                  </Text>
                  <View style={styles.addCustomerDocumentBox}>
                    <Text style={styles.addCustomerDocumentText}>
                      {newCustomerData.documentNumber}
                    </Text>
                    <View
                      style={[
                        styles.addCustomerTypeBadge,
                        newCustomerData.customerType === 'EMPRESA'
                          ? styles.addCustomerTypeBadgeEmpresa
                          : styles.addCustomerTypeBadgePersona,
                      ]}
                    >
                      <Text style={styles.addCustomerTypeBadgeText}>
                        {newCustomerData.customerType === 'EMPRESA' ? 'Empresa' : 'Persona'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Campos para PERSONA */}
                {newCustomerData.customerType === 'PERSONA' && (
                  <>
                    <View style={styles.addCustomerFormGroup}>
                      <Text style={styles.addCustomerLabel}>Nombres *</Text>
                      <TextInput
                        style={styles.addCustomerInput}
                        value={newCustomerData.nombres}
                        onChangeText={(text) =>
                          setNewCustomerData((prev) => ({ ...prev, nombres: text }))
                        }
                        placeholder="Ingrese nombres"
                        placeholderTextColor={theme.color.text.placeholder}
                        autoCapitalize="words"
                      />
                    </View>

                    <View style={styles.addCustomerFormRow}>
                      <View style={[styles.addCustomerFormGroup, { flex: 1, marginRight: 8 }]}>
                        <Text style={styles.addCustomerLabel}>Apellido Paterno *</Text>
                        <TextInput
                          style={styles.addCustomerInput}
                          value={newCustomerData.apellidoPaterno}
                          onChangeText={(text) =>
                            setNewCustomerData((prev) => ({ ...prev, apellidoPaterno: text }))
                          }
                          placeholder="Apellido paterno"
                          placeholderTextColor={theme.color.text.placeholder}
                          autoCapitalize="words"
                        />
                      </View>

                      <View style={[styles.addCustomerFormGroup, { flex: 1, marginLeft: 8 }]}>
                        <Text style={styles.addCustomerLabel}>Apellido Materno</Text>
                        <TextInput
                          style={styles.addCustomerInput}
                          value={newCustomerData.apellidoMaterno}
                          onChangeText={(text) =>
                            setNewCustomerData((prev) => ({ ...prev, apellidoMaterno: text }))
                          }
                          placeholder="Apellido materno"
                          placeholderTextColor={theme.color.text.placeholder}
                          autoCapitalize="words"
                        />
                      </View>
                    </View>
                  </>
                )}

                {/* Campos para EMPRESA */}
                {newCustomerData.customerType === 'EMPRESA' && (
                  <>
                    <View style={styles.addCustomerFormGroup}>
                      <Text style={styles.addCustomerLabel}>Razón Social *</Text>
                      <TextInput
                        style={styles.addCustomerInput}
                        value={newCustomerData.razonSocial}
                        onChangeText={(text) =>
                          setNewCustomerData((prev) => ({ ...prev, razonSocial: text }))
                        }
                        placeholder="Ingrese razón social"
                        placeholderTextColor={theme.color.text.placeholder}
                        autoCapitalize="characters"
                      />
                    </View>

                    <View style={styles.addCustomerFormGroup}>
                      <Text style={styles.addCustomerLabel}>Dirección</Text>
                      <TextInput
                        style={styles.addCustomerInput}
                        value={newCustomerData.address}
                        onChangeText={(text) =>
                          setNewCustomerData((prev) => ({ ...prev, address: text }))
                        }
                        placeholder="Ingrese dirección"
                        placeholderTextColor={theme.color.text.placeholder}
                      />
                    </View>
                  </>
                )}

                {/* Campos opcionales (Email y Teléfono) */}
                <View style={styles.addCustomerFormRow}>
                  <View style={[styles.addCustomerFormGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.addCustomerLabel}>Email (opcional)</Text>
                    <TextInput
                      style={styles.addCustomerInput}
                      value={newCustomerData.email}
                      onChangeText={(text) =>
                        setNewCustomerData((prev) => ({ ...prev, email: text }))
                      }
                      placeholder="correo@ejemplo.com"
                      placeholderTextColor={theme.color.text.placeholder}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={[styles.addCustomerFormGroup, { flex: 1, marginLeft: 8 }]}>
                    <Text style={styles.addCustomerLabel}>Teléfono (opcional)</Text>
                    <TextInput
                      style={styles.addCustomerInput}
                      value={newCustomerData.phone}
                      onChangeText={(text) =>
                        setNewCustomerData((prev) => ({ ...prev, phone: text }))
                      }
                      placeholder="999 999 999"
                      placeholderTextColor={theme.color.text.placeholder}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                {/* Switch Acepta Publicidad */}
                <View style={styles.addCustomerSwitchRow}>
                  <Text style={styles.addCustomerSwitchLabel}>Permitir publicidad</Text>
                  <Switch
                    value={newCustomerData.aceptaPublicidad}
                    onValueChange={(value) =>
                      setNewCustomerData((prev) => ({ ...prev, aceptaPublicidad: value }))
                    }
                    trackColor={{
                      false: theme.color.border.subtle,
                      true: theme.color.state.success.border,
                    }}
                    thumbColor={
                      newCustomerData.aceptaPublicidad
                        ? theme.color.action.success.background
                        : theme.color.text.disabled
                    }
                  />
                </View>
              </ScrollView>
            )}

            {/* Botones de acción */}
            <View style={styles.addCustomerButtons}>
              <TouchableOpacity
                style={[styles.addCustomerButton, styles.addCustomerCancelButton]}
                onPress={() => setShowAddCustomerModal(false)}
                disabled={addCustomerLoading}
              >
                <Text style={styles.addCustomerCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.addCustomerButton,
                  styles.addCustomerSaveButton,
                  (addCustomerLoading || lookupLoading) && styles.buttonDisabled,
                ]}
                onPress={handleAddCustomer}
                disabled={addCustomerLoading || lookupLoading}
              >
                {addCustomerLoading ? (
                  <ActivityIndicator size="small" color={theme.color.text.onAction} />
                ) : (
                  <Text style={styles.addCustomerSaveButtonText}>➕ Agregar Cliente</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Offline Customer Modal */}
      <Modal
        visible={showOfflineCustomerModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowOfflineCustomerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.offlineCustomerModalContent}>
            <View style={styles.offlineCustomerModalHeader}>
              <Text style={styles.offlineCustomerModalTitle}>👤 Cliente Offline</Text>
              <TouchableOpacity
                style={styles.offlineCustomerCloseButton}
                onPress={() => setShowOfflineCustomerModal(false)}
              >
                <Text style={styles.offlineCustomerCloseButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.offlineCustomerForm}>
              {/* Tipo de documento */}
              <View style={styles.offlineCustomerFormGroup}>
                <Text style={styles.offlineCustomerLabel}>Tipo de Documento</Text>
                <View style={styles.offlineCustomerDocTypeRow}>
                  <TouchableOpacity
                    style={[
                      styles.offlineCustomerDocTypeButton,
                      offlineCustomerData.documentType === 'DNI' &&
                        styles.offlineCustomerDocTypeButtonActive,
                    ]}
                    onPress={() =>
                      setOfflineCustomerData((prev) => ({ ...prev, documentType: 'DNI' }))
                    }
                  >
                    <Text
                      style={[
                        styles.offlineCustomerDocTypeText,
                        offlineCustomerData.documentType === 'DNI' &&
                          styles.offlineCustomerDocTypeTextActive,
                      ]}
                    >
                      DNI
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.offlineCustomerDocTypeButton,
                      offlineCustomerData.documentType === 'RUC' &&
                        styles.offlineCustomerDocTypeButtonActive,
                    ]}
                    onPress={() =>
                      setOfflineCustomerData((prev) => ({ ...prev, documentType: 'RUC' }))
                    }
                  >
                    <Text
                      style={[
                        styles.offlineCustomerDocTypeText,
                        offlineCustomerData.documentType === 'RUC' &&
                          styles.offlineCustomerDocTypeTextActive,
                      ]}
                    >
                      RUC
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Número de documento */}
              <View style={styles.offlineCustomerFormGroup}>
                <Text style={styles.offlineCustomerLabel}>
                  Número de {offlineCustomerData.documentType}
                </Text>
                <TextInput
                  style={styles.offlineCustomerInput}
                  value={offlineCustomerData.documentNumber}
                  onChangeText={(text) =>
                    setOfflineCustomerData((prev) => ({
                      ...prev,
                      documentNumber: text.replace(/\D/g, ''),
                    }))
                  }
                  placeholder={
                    offlineCustomerData.documentType === 'DNI' ? '12345678' : '20123456789'
                  }
                  placeholderTextColor={theme.color.text.placeholder}
                  keyboardType="numeric"
                  maxLength={offlineCustomerData.documentType === 'DNI' ? 8 : 11}
                />
              </View>

              {/* Nombre o Razón Social */}
              <View style={styles.offlineCustomerFormGroup}>
                <Text style={styles.offlineCustomerLabel}>
                  {offlineCustomerData.documentType === 'RUC' ? 'Razón Social' : 'Nombre Completo'}
                </Text>
                <TextInput
                  style={styles.offlineCustomerInput}
                  value={offlineCustomerData.fullName}
                  onChangeText={(text) =>
                    setOfflineCustomerData((prev) => ({ ...prev, fullName: text }))
                  }
                  placeholder={
                    offlineCustomerData.documentType === 'RUC' ? 'EMPRESA SAC' : 'Juan Pérez García'
                  }
                  placeholderTextColor={theme.color.text.placeholder}
                  autoCapitalize="characters"
                />
              </View>

              {/* Info box */}
              <View style={styles.offlineCustomerInfoBox}>
                <Text style={styles.offlineCustomerInfoText}>
                  📴 Este cliente se guardará localmente y se sincronizará cuando vuelva la
                  conexión.
                </Text>
                <Text style={styles.offlineCustomerInfoSubtext}>
                  {offlineCustomerData.documentType === 'RUC'
                    ? '→ Se generará FACTURA'
                    : '→ Se generará BOLETA'}
                </Text>
              </View>
            </View>

            {/* Botones */}
            <View style={styles.offlineCustomerButtons}>
              <TouchableOpacity
                style={[styles.offlineCustomerButton, styles.offlineCustomerCancelButton]}
                onPress={() => setShowOfflineCustomerModal(false)}
              >
                <Text style={styles.offlineCustomerCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.offlineCustomerButton, styles.offlineCustomerSaveButton]}
                onPress={handleSaveOfflineCustomer}
              >
                <Text style={styles.offlineCustomerSaveButtonText}>✓ Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* PinPad Processing Modal */}
      <Modal
        visible={showPinPadModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          if (!pinPadProcessing) {
            setShowPinPadModal(false);
          }
        }}
      >
        <View style={styles.pinPadModalOverlay}>
          <View style={styles.pinPadModalContent}>
            <View style={styles.pinPadModalHeader}>
              <Text style={styles.pinPadModalIcon}>💳</Text>
              <Text style={styles.pinPadModalTitle}>PinPad Verifone P400</Text>
            </View>

            <View style={styles.pinPadModalBody}>
              <Text style={styles.pinPadModalAmount}>S/ {pinPadAmountPending.toFixed(2)}</Text>

              {pinPadProcessing && (
                <ActivityIndicator
                  size="large"
                  color={theme.color.icon.accent}
                  style={{ marginVertical: 20 }}
                />
              )}

              <Text style={styles.pinPadModalMessage}>{pinPadMessage}</Text>
            </View>

            {!pinPadProcessing && (
              <TouchableOpacity
                style={styles.pinPadModalCloseButton}
                onPress={() => setShowPinPadModal(false)}
              >
                <Text style={styles.pinPadModalCloseButtonText}>Cerrar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    header: {
      backgroundColor: theme.color.surface.base,
      padding: theme.space[4],
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    title: {
      flex: 1,
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      marginRight: theme.space[2],
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2.5],
      flexShrink: 0,
      zIndex: 10,
      elevation: 10,
    },
    cashCircularButton: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 52,
      height: 52,
      marginRight: 2,
      zIndex: 20,
      elevation: 20,
    },
    cashCircularVisible: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: theme.color.border.subtle,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.color.action.primary.background,
      overflow: 'hidden',
    },
    cashCircularInnerVisible: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.color.surface.base,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    cashCircularText: {
      fontSize: 10,
      fontWeight: '800',
      lineHeight: 12,
    },
    cashCircularDebugText: {
      fontSize: 16,
      fontWeight: '900',
      color: theme.color.action.primary.background,
    },
    recentSalesButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.surface.muted,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.md,
      gap: theme.space[1.5],
    },
    recentSalesIcon: {
      fontSize: 18,
    },
    recentSalesText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.link,
    },
    menuButton: {
      fontSize: 24,
      color: theme.color.text.muted,
      padding: theme.space[1],
    },
    offlineStatusBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.background.inverse,
      paddingVertical: theme.space[1.5],
      paddingHorizontal: theme.space[3],
      gap: theme.space[3],
    },
    connectionDot: {
      width: 8,
      height: 8,
      borderRadius: theme.radii.full,
    },
    dotOnline: {
      backgroundColor: theme.color.action.success.background,
    },
    dotOffline: {
      backgroundColor: theme.color.action.danger.background,
    },
    offlineStatusText: {
      color: theme.color.text.inverse,
      fontSize: 12,
      fontWeight: '500',
    },
    offlineBadge: {
      backgroundColor: theme.color.icon.warning,
      paddingHorizontal: theme.space[2],
      paddingVertical: theme.space[0.5],
      borderRadius: theme.radii.md,
    },
    offlineBadgeText: {
      color: theme.color.text.inverse,
      fontSize: 11,
      fontWeight: '700',
    },
    offlineTokenCount: {
      color: theme.color.text.inverse,
      fontSize: 12,
    },
    offlinePendingCount: {
      color: theme.color.state.warning.border,
      fontSize: 12,
      fontWeight: '600',
    },
    closeButton: {
      fontSize: 24,
      color: theme.color.text.muted,
      padding: theme.space[1],
    },
    content: {
      flex: 1,
      flexDirection: 'row',
    },
    leftPanel: {
      flex: 1,
      padding: theme.space[4],
    },
    rightPanel: {
      flex: 0.4,
      minWidth: 320,
      maxWidth: 650,
      backgroundColor: theme.color.surface.base,
      borderLeftWidth: 1,
      borderLeftColor: theme.color.border.subtle,
      padding: theme.space[4],
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.space[4],
    },
    searchInput: {
      flex: 1,
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      padding: theme.space[5],
      fontSize: 20,
      borderWidth: 2,
      borderColor: theme.color.icon.accent,
      ...theme.shadow.sm,
    },
    searchLoader: {
      marginLeft: theme.space[2],
    },
    searchResults: {
      flex: 1,
    },
    topSellersSection: {
      marginTop: theme.space[2],
      flex: 1,
    },
    topSellersHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.space[2],
    },
    topSellersTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    topSellersList: {
      paddingVertical: theme.space[1],
      paddingBottom: theme.space[6],
      gap: theme.space[3],
    },
    topSellersRow: {
      justifyContent: 'flex-start',
      gap: theme.space[3],
      marginBottom: theme.space[3],
    },
    topSellerCard: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      padding: theme.space[2.5],
      justifyContent: 'space-between',
    },
    topSellerImage: {
      width: '100%',
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.muted,
      marginBottom: theme.space[2],
    },
    topSellerImagePlaceholder: {
      width: '100%',
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.muted,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.space[2],
    },
    topSellerImagePlaceholderText: {
      fontSize: 34,
    },
    topSellerName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
      minHeight: 36,
    },
    topSellerSku: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.color.text.body,
      marginTop: 2,
    },
    topSellerPrice: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.color.text.link,
      marginTop: theme.space[1.5],
    },
    topSellersEmptyText: {
      fontSize: 13,
      color: theme.color.text.muted,
      paddingVertical: theme.space[2.5],
      paddingHorizontal: theme.space[1],
    },
    productItem: {
      backgroundColor: theme.color.surface.base,
      padding: theme.space[3],
      borderRadius: theme.radii.md,
      marginBottom: theme.space[3],
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      gap: theme.space[3],
    },
    productImage: {
      width: 100,
      height: 100,
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.subtle,
    },
    productImagePlaceholder: {
      width: 100,
      height: 100,
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.subtle,
      justifyContent: 'center',
      alignItems: 'center',
    },
    productImagePlaceholderText: {
      fontSize: 40,
    },
    productInfo: {
      flex: 1,
      justifyContent: 'center',
    },
    productName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    productCode: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginBottom: theme.space[1],
    },
    productPrice: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.color.text.link,
    },
    productStock: {
      fontSize: 12,
      fontWeight: '600',
      marginTop: theme.space[1],
    },
    productStockOk: {
      color: theme.color.text.success,
    },
    productStockLow: {
      color: theme.color.icon.warning,
    },
    productStockOut: {
      color: theme.color.action.danger.background,
    },
    customerSearchContainer: {
      marginBottom: theme.space[4],
      position: 'relative',
      zIndex: 1000,
    },
    customerSearchHeader: {
      marginBottom: theme.space[2],
    },
    customerSearchLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    customerInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      position: 'relative',
    },
    customerSearchInput: {
      flex: 1,
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      padding: 18,
      fontSize: 18,
      borderWidth: 2,
      borderColor: theme.color.action.success.background,
      paddingRight: 70,
      ...theme.shadow.sm,
    },
    customerSearchLoader: {
      position: 'absolute',
      right: 40,
    },
    clearCustomerButton: {
      position: 'absolute',
      right: theme.space[2],
      padding: theme.space[2],
    },
    clearCustomerIcon: {
      fontSize: 18,
      color: theme.color.text.placeholder,
      fontWeight: 'bold',
    },
    customerDropdown: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      marginTop: theme.space[1],
      maxHeight: 300,
      ...theme.shadow.md,
      zIndex: 1001,
    },
    customerDropdownScroll: {
      maxHeight: 300,
    },
    customerDropdownItem: {
      padding: theme.space[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    customerDropdownItemContent: {
      gap: theme.space[1],
    },
    customerDropdownItemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[1],
    },
    customerDropdownItemName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
      flex: 1,
    },
    customerTypeBadge: {
      paddingHorizontal: theme.space[2],
      paddingVertical: theme.space[1],
      borderRadius: theme.radii.sm,
      marginLeft: theme.space[2],
    },
    customerTypeBadgeEmpresa: {
      backgroundColor: theme.color.state.info.background,
    },
    customerTypeBadgePersona: {
      backgroundColor: theme.color.surface.muted,
    },
    customerTypeBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    customerDropdownItemDoc: {
      fontSize: 12,
      color: theme.color.text.muted,
    },
    customerDropdownItemEmail: {
      fontSize: 11,
      color: theme.color.text.placeholder,
    },
    customerDropdownItemPhone: {
      fontSize: 11,
      color: theme.color.text.placeholder,
    },
    selectedCustomerCard: {
      backgroundColor: theme.color.state.success.background,
      borderRadius: theme.radii.lg,
      padding: theme.space[4],
      borderWidth: 2,
      borderColor: theme.color.action.success.background,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      ...theme.shadow.sm,
    },
    selectedCustomerInfo: {
      flex: 1,
      marginRight: theme.space[3],
    },
    selectedCustomerName: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.color.state.success.text,
      marginBottom: theme.space[1],
    },
    selectedCustomerDoc: {
      fontSize: 14,
      color: theme.color.state.success.text,
      marginBottom: 2,
    },
    selectedCustomerEmail: {
      fontSize: 12,
      color: theme.color.state.success.text,
      marginBottom: 2,
    },
    selectedCustomerPhone: {
      fontSize: 12,
      color: theme.color.state.success.text,
    },
    removeCustomerButton: {
      backgroundColor: theme.color.state.danger.background,
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[2.5],
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.color.action.danger.background,
    },
    removeCustomerButtonText: {
      fontSize: 14,
      fontWeight: 'bold',
      color: theme.color.state.danger.text,
    },
    addCustomerDropdownItem: {
      padding: theme.space[3.5],
      backgroundColor: theme.color.state.success.background,
      borderTopWidth: 2,
      borderTopColor: theme.color.action.success.background,
    },
    addCustomerDropdownContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
    },
    addCustomerIcon: {
      fontSize: 24,
    },
    addCustomerTextContainer: {
      flex: 1,
    },
    addCustomerTitle: {
      fontSize: 15,
      fontWeight: 'bold',
      color: theme.color.state.success.text,
    },
    addCustomerSubtitle: {
      fontSize: 12,
      color: theme.color.action.success.background,
      marginTop: 2,
    },
    addCustomerModalContent: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii['2xl'],
      padding: theme.space[6],
      width: '90%',
      maxWidth: 600,
      maxHeight: '85%',
    },
    addCustomerModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[5],
      paddingBottom: theme.space[4],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    addCustomerModalTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.color.text.heading,
    },
    addCustomerCloseButton: {
      width: 40,
      height: 40,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.subtle,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addCustomerCloseButtonText: {
      fontSize: 20,
      color: theme.color.text.muted,
      fontWeight: 'bold',
    },
    addCustomerLoading: {
      padding: theme.space[10],
      alignItems: 'center',
      justifyContent: 'center',
    },
    addCustomerLoadingText: {
      marginTop: theme.space[4],
      fontSize: 16,
      color: theme.color.text.muted,
    },
    addCustomerForm: {
      flex: 1,
      marginBottom: theme.space[4],
    },
    addCustomerFormGroup: {
      marginBottom: theme.space[4],
    },
    addCustomerFormRow: {
      flexDirection: 'row',
      marginBottom: theme.space[4],
    },
    addCustomerSwitchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.md,
      padding: theme.space[3.5],
      marginBottom: theme.space[4],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    addCustomerSwitchLabel: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.color.text.heading,
    },
    addCustomerLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[2],
    },
    addCustomerInput: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.md,
      padding: theme.space[3.5],
      fontSize: 16,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      color: theme.color.text.heading,
    },
    addCustomerDocumentBox: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.md,
      padding: theme.space[3.5],
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    addCustomerDocumentText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      fontFamily: theme.fonts.mono,
    },
    addCustomerTypeBadge: {
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1.5],
      borderRadius: theme.radii.sm,
    },
    addCustomerTypeBadgeEmpresa: {
      backgroundColor: theme.color.state.info.background,
    },
    addCustomerTypeBadgePersona: {
      backgroundColor: theme.color.surface.muted,
    },
    addCustomerTypeBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    addCustomerButtons: {
      flexDirection: 'row',
      gap: theme.space[3],
      marginTop: theme.space[2],
    },
    addCustomerButton: {
      flex: 1,
      paddingVertical: theme.space[4],
      borderRadius: theme.radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addCustomerCancelButton: {
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    addCustomerCancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    addCustomerSaveButton: {
      backgroundColor: theme.color.action.success.background,
    },
    addCustomerSaveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
    offlineAddCustomerButton: {
      backgroundColor: theme.color.state.warning.background,
      borderRadius: theme.radii.lg,
      padding: theme.space[4],
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[2.5],
      borderWidth: 2,
      borderColor: theme.color.icon.warning,
      borderStyle: 'dashed',
    },
    offlineAddCustomerIcon: {
      fontSize: 24,
    },
    offlineAddCustomerText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.state.warning.text,
    },
    offlineAddCustomerSubtext: {
      fontSize: 13,
      color: theme.color.icon.warning,
    },
    offlineCustomerBadge: {
      paddingHorizontal: theme.space[2],
      paddingVertical: theme.space[0.5],
      borderRadius: theme.radii.sm,
      alignSelf: 'flex-start',
    },
    offlineCustomerModalContent: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii['2xl'],
      padding: theme.space[6],
      width: '90%',
      maxWidth: 450,
    },
    offlineCustomerModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[5],
      paddingBottom: theme.space[4],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    offlineCustomerModalTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: theme.color.text.heading,
    },
    offlineCustomerCloseButton: {
      width: 32,
      height: 32,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.subtle,
      justifyContent: 'center',
      alignItems: 'center',
    },
    offlineCustomerCloseButtonText: {
      fontSize: 18,
      color: theme.color.text.muted,
    },
    offlineCustomerForm: {
      marginBottom: theme.space[5],
    },
    offlineCustomerFormGroup: {
      marginBottom: 18,
    },
    offlineCustomerLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[2],
    },
    offlineCustomerDocTypeRow: {
      flexDirection: 'row',
      gap: theme.space[3],
    },
    offlineCustomerDocTypeButton: {
      flex: 1,
      paddingVertical: theme.space[3.5],
      paddingHorizontal: theme.space[5],
      borderRadius: theme.radii.md,
      borderWidth: 2,
      borderColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.subtle,
      alignItems: 'center',
    },
    offlineCustomerDocTypeButtonActive: {
      borderColor: theme.color.icon.warning,
      backgroundColor: theme.color.state.warning.background,
    },
    offlineCustomerDocTypeText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    offlineCustomerDocTypeTextActive: {
      color: theme.color.state.warning.text,
    },
    offlineCustomerInput: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.md,
      padding: theme.space[3.5],
      fontSize: 16,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      color: theme.color.text.heading,
    },
    offlineCustomerInfoBox: {
      backgroundColor: theme.color.state.warning.background,
      borderRadius: theme.radii.md,
      padding: theme.space[3.5],
      borderLeftWidth: 4,
      borderLeftColor: theme.color.icon.warning,
    },
    offlineCustomerInfoText: {
      fontSize: 13,
      color: theme.color.state.warning.text,
      lineHeight: 18,
    },
    offlineCustomerInfoSubtext: {
      fontSize: 12,
      color: theme.color.icon.warning,
      marginTop: theme.space[1.5],
      fontWeight: '600',
    },
    offlineCustomerButtons: {
      flexDirection: 'row',
      gap: theme.space[3],
    },
    offlineCustomerButton: {
      flex: 1,
      paddingVertical: theme.space[3.5],
      borderRadius: theme.radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    offlineCustomerCancelButton: {
      backgroundColor: theme.color.surface.subtle,
    },
    offlineCustomerCancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    offlineCustomerSaveButton: {
      backgroundColor: theme.color.icon.warning,
    },
    offlineCustomerSaveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
    cartList: {
      flex: 1,
      marginBottom: theme.space[4],
    },
    emptyCart: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
    },
    emptyCartText: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.color.text.placeholder,
      marginBottom: theme.space[2],
    },
    emptyCartSubtext: {
      fontSize: 14,
      color: theme.color.text.disabled,
    },
    cartItem: {
      paddingVertical: theme.space[1],
      paddingHorizontal: theme.space[2.5],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    cartItemRow: {
      flexDirection: 'row',
      gap: theme.space[2],
      alignItems: 'center',
    },
    cartItemImage: {
      width: 60,
      height: 60,
      borderRadius: theme.radii.sm,
      backgroundColor: theme.color.surface.subtle,
    },
    cartItemImagePlaceholder: {
      width: 60,
      height: 60,
      borderRadius: theme.radii.sm,
      backgroundColor: theme.color.surface.subtle,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cartItemImagePlaceholderText: {
      fontSize: 24,
    },
    cartItemInfo: {
      flex: 1,
      justifyContent: 'space-between',
    },
    cartItemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 0,
    },
    cartItemNameContainer: {
      flex: 1,
      marginRight: theme.space[2],
    },
    cartItemName: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.color.text.heading,
      lineHeight: 18,
    },
    cartItemSku: {
      fontSize: 11,
      color: theme.color.text.placeholder,
      marginTop: 1,
      lineHeight: 13,
    },
    removeButtonContainer: {
      backgroundColor: theme.color.state.danger.background,
      borderRadius: theme.radii.sm,
      padding: theme.space[1.5],
      minWidth: 36,
      minHeight: 36,
      justifyContent: 'center',
      alignItems: 'center',
    },
    removeButton: {
      fontSize: 24,
    },
    cartItemDetails: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 2,
    },
    quantityControl: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
    },
    quantityButton: {
      width: 32,
      height: 32,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.muted,
      justifyContent: 'center',
      alignItems: 'center',
    },
    quantityButtonDisabled: {
      opacity: 0.4,
    },
    cartItemStock: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginTop: theme.space[1],
    },
    quantityButtonText: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    quantityText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
      minWidth: 30,
      textAlign: 'center',
    },
    quantityInput: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
      width: 55,
      height: 32,
      textAlign: 'center',
      backgroundColor: theme.color.surface.base,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.sm,
      paddingHorizontal: theme.space[1],
    },
    cartItemPrice: {
      fontSize: 13,
      color: theme.color.text.muted,
      marginBottom: 2,
      lineHeight: 16,
    },
    cartItemTotal: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.color.text.link,
    },
    totalsContainer: {
      padding: theme.space[4],
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.md,
      marginBottom: theme.space[4],
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: theme.space[2],
    },
    totalLabel: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
    totalLabelBold: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.color.text.heading,
    },
    totalValue: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.color.text.heading,
    },
    totalValueBold: {
      fontSize: 32,
      fontWeight: 'bold',
      color: theme.color.action.success.background,
    },
    discountValue: {
      color: theme.color.action.danger.background,
    },
    divider: {
      height: 1,
      backgroundColor: theme.color.border.subtle,
      marginVertical: theme.space[2],
    },
    actionButtons: {
      flexDirection: 'row',
      gap: theme.space[3],
    },
    button: {
      flex: 1,
      paddingVertical: theme.space[6],
      paddingHorizontal: theme.space[5],
      borderRadius: theme.radii.md,
      alignItems: 'center',
    },
    clearButton: {
      backgroundColor: theme.color.surface.base,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    clearButtonText: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    processButton: {
      backgroundColor: theme.color.action.success.background,
    },
    processButtonText: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii['2xl'],
      padding: theme.space[12],
      width: '98%',
      maxWidth: 1400,
      maxHeight: '95%',
    },
    modalTitle: {
      fontSize: 48,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      marginBottom: theme.space[8],
      textAlign: 'center',
    },
    modalScrollContent: {
      flex: 1,
      marginBottom: theme.space[6],
    },
    modalTotal: {
      backgroundColor: theme.color.surface.subtle,
      padding: theme.space[8],
      borderRadius: theme.radii.xl,
      marginBottom: theme.space[8],
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    modalTotalLabel: {
      fontSize: 32,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    modalTotalValue: {
      fontSize: 52,
      fontWeight: 'bold',
      color: theme.color.action.success.background,
    },
    paymentSelection: {
      marginBottom: theme.space[6],
    },
    sectionLabel: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      marginBottom: theme.space[4],
    },
    methodsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[4],
      marginBottom: theme.space[6],
    },
    methodButton: {
      flex: 1,
      minWidth: 200,
      padding: 28,
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.xl,
      borderWidth: 4,
      borderColor: theme.color.border.subtle,
    },
    methodButtonSelected: {
      backgroundColor: theme.color.state.info.background,
      borderColor: theme.color.icon.accent,
    },
    methodButtonText: {
      fontSize: 26,
      color: theme.color.text.heading,
      textAlign: 'center',
      fontWeight: '600',
    },
    methodButtonTextSelected: {
      color: theme.color.text.link,
      fontWeight: 'bold',
    },
    submethodContainer: {
      marginTop: theme.space[4],
    },
    izipayWarningBox: {
      backgroundColor: theme.color.state.warning.background,
      borderRadius: theme.radii.lg,
      padding: theme.space[5],
      marginBottom: theme.space[6],
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: theme.color.icon.warning,
      ...theme.shadow.md,
    },
    izipayWarningIcon: {
      fontSize: 40,
      marginRight: theme.space[4],
    },
    izipayWarningContent: {
      flex: 1,
    },
    izipayWarningTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: theme.color.state.warning.text,
      marginBottom: theme.space[2],
    },
    izipayWarningText: {
      fontSize: 18,
      color: theme.color.state.warning.text,
      lineHeight: 24,
    },
    amountContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[4],
      marginBottom: theme.space[7],
    },
    amountInput: {
      flex: 1,
      padding: 28,
      fontSize: 32,
      borderWidth: 3,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.color.surface.base,
      fontWeight: 'bold',
    },
    fillRemainingButton: {
      padding: 28,
      backgroundColor: theme.color.icon.accent,
      borderRadius: theme.radii.xl,
      minWidth: 180,
    },
    fillRemainingButtonText: {
      fontSize: 26,
      fontWeight: 'bold',
      color: theme.color.text.onAction,
      textAlign: 'center',
    },
    addPaymentButton: {
      padding: theme.space[8],
      backgroundColor: theme.color.action.success.background,
      borderRadius: theme.radii.xl,
      alignItems: 'center',
      marginBottom: theme.space[7],
    },
    addPaymentButtonText: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.color.text.onAction,
    },
    selectedPayments: {
      marginBottom: theme.space[7],
      backgroundColor: theme.color.surface.subtle,
      padding: theme.space[6],
      borderRadius: theme.radii.xl,
    },
    selectedPaymentsTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      marginBottom: theme.space[5],
    },
    paymentRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[4],
      backgroundColor: theme.color.surface.base,
      padding: theme.space[5],
      borderRadius: theme.radii.lg,
    },
    paymentInfo: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginRight: theme.space[4],
    },
    paymentName: {
      fontSize: 24,
      color: theme.color.text.heading,
      fontWeight: '600',
      flex: 1,
    },
    paymentAmount: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.color.text.link,
      marginLeft: theme.space[4],
    },
    removePaymentButton: {
      backgroundColor: theme.color.state.danger.background,
      padding: theme.space[4],
      borderRadius: theme.radii.lg,
      minWidth: 60,
      alignItems: 'center',
      justifyContent: 'center',
    },
    removePaymentIcon: {
      fontSize: 32,
    },
    paymentSummary: {
      marginTop: theme.space[4],
      paddingTop: theme.space[5],
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[4],
    },
    summaryLabel: {
      fontSize: 26,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    summaryValue: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.color.text.heading,
    },
    summaryValuePaid: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.color.text.link,
    },
    summaryValueHighlight: {
      fontSize: 32,
      fontWeight: 'bold',
    },
    summaryValueMissing: {
      color: theme.color.action.danger.background,
    },
    summaryValueChange: {
      color: theme.color.action.success.background,
    },
    changeHighlightBox: {
      marginTop: theme.space[6],
      padding: theme.space[8],
      borderRadius: theme.radii.xl,
      alignItems: 'center',
      borderWidth: 4,
    },
    changeHighlightBoxMissing: {
      backgroundColor: theme.color.state.danger.background,
      borderColor: theme.color.action.danger.background,
    },
    changeHighlightBoxChange: {
      backgroundColor: theme.color.state.success.background,
      borderColor: theme.color.action.success.background,
    },
    changeHighlightLabel: {
      fontSize: 32,
      fontWeight: 'bold',
      marginBottom: theme.space[4],
      letterSpacing: 2,
    },
    changeHighlightValue: {
      fontSize: 64,
      fontWeight: 'bold',
    },
    modalButtons: {
      flexDirection: 'row',
      gap: theme.space[6],
    },
    modalCancelButton: {
      backgroundColor: theme.color.surface.base,
      borderWidth: 3,
      borderColor: theme.color.border.subtle,
      padding: theme.space[8],
    },
    modalCancelButtonText: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.color.text.muted,
    },
    modalConfirmButton: {
      backgroundColor: theme.color.action.success.background,
      padding: theme.space[8],
    },
    buttonDisabled: {
      backgroundColor: theme.color.action.primary.backgroundDisabled,
      opacity: 0.6,
    },
    modalConfirmButtonText: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.color.text.onAction,
    },
    salesModalContent: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      padding: theme.space[6],
      width: '90%',
      maxWidth: 700,
      maxHeight: '85%',
    },
    salesModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[4],
    },
    salesSummary: {
      backgroundColor: theme.color.surface.subtle,
      padding: theme.space[4],
      borderRadius: theme.radii.md,
      marginBottom: theme.space[4],
    },
    summaryTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      marginBottom: theme.space[3],
    },
    salesList: {
      flex: 1,
      marginBottom: theme.space[4],
    },
    emptySales: {
      padding: theme.space[10],
      alignItems: 'center',
    },
    emptySalesText: {
      fontSize: 16,
      color: theme.color.text.placeholder,
    },
    saleItem: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.md,
      marginBottom: theme.space[3],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      overflow: 'hidden',
    },
    saleItemClickable: {
      padding: theme.space[4],
    },
    saleItemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[2],
    },
    saleNumberContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
    },
    saleNumber: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.color.text.heading,
    },
    creditNoteBadge: {
      backgroundColor: theme.color.icon.warning,
      paddingHorizontal: theme.space[2],
      paddingVertical: theme.space[0.5],
      borderRadius: theme.radii.lg,
    },
    creditNoteBadgeText: {
      fontSize: 10,
      fontWeight: 'bold',
      color: theme.color.text.onAction,
    },
    saleStatus: {
      fontSize: 12,
      fontWeight: '600',
      paddingHorizontal: theme.space[2],
      paddingVertical: theme.space[1],
      borderRadius: theme.radii.sm,
    },
    statusDraft: {
      backgroundColor: theme.color.state.draft.background,
      paddingHorizontal: theme.space[2.5],
      paddingVertical: 5,
      borderRadius: theme.radii.sm,
      borderWidth: 1,
      borderColor: theme.color.state.draft.border,
    },
    statusConfirmed: {
      backgroundColor: theme.color.state.success.background,
      paddingHorizontal: theme.space[2.5],
      paddingVertical: 5,
      borderRadius: theme.radii.sm,
      borderWidth: 1,
      borderColor: theme.color.state.success.border,
    },
    statusDevParcial: {
      backgroundColor: theme.color.state.warning.background,
      paddingHorizontal: theme.space[2.5],
      paddingVertical: 5,
      borderRadius: theme.radii.sm,
      borderWidth: 1,
      borderColor: theme.color.state.warning.border,
    },
    statusDevTotal: {
      backgroundColor: theme.color.state.warning.background,
      paddingHorizontal: theme.space[2.5],
      paddingVertical: 5,
      borderRadius: theme.radii.sm,
      borderWidth: 1,
      borderColor: theme.color.state.warning.border,
    },
    statusInvoiced: {
      backgroundColor: theme.color.state.info.background,
      paddingHorizontal: theme.space[2.5],
      paddingVertical: 5,
      borderRadius: theme.radii.sm,
      borderWidth: 1,
      borderColor: theme.color.state.info.border,
    },
    statusPaid: {
      backgroundColor: theme.color.state.paid.background,
      paddingHorizontal: theme.space[2.5],
      paddingVertical: 5,
      borderRadius: theme.radii.sm,
      borderWidth: 1,
      borderColor: theme.color.state.paid.border,
    },
    statusCancelled: {
      backgroundColor: theme.color.state.cancelled.background,
      paddingHorizontal: theme.space[2.5],
      paddingVertical: 5,
      borderRadius: theme.radii.sm,
      borderWidth: 1,
      borderColor: theme.color.state.cancelled.border,
    },
    statusRefunded: {
      backgroundColor: theme.color.surface.muted,
      paddingHorizontal: theme.space[2.5],
      paddingVertical: 5,
      borderRadius: theme.radii.sm,
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    statusDefault: {
      backgroundColor: theme.color.state.draft.background,
      paddingHorizontal: theme.space[2.5],
      paddingVertical: 5,
      borderRadius: theme.radii.sm,
      borderWidth: 1,
      borderColor: theme.color.state.draft.border,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    saleItemDetails: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[1],
    },
    saleDocType: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
    saleTotal: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.color.action.success.background,
    },
    saleCustomer: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginBottom: theme.space[1],
    },
    salePaymentsContainer: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.md,
      padding: theme.space[3],
      marginTop: theme.space[2],
      marginBottom: theme.space[2],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    salePaymentsTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[2],
    },
    salePaymentRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.space[1],
      paddingHorizontal: theme.space[2],
    },
    salePaymentMethod: {
      fontSize: 12,
      color: theme.color.text.body,
      flex: 1,
    },
    salePaymentAmount: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.link,
    },
    salePaymentTotal: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: theme.space[2],
      paddingTop: theme.space[2],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.default,
      paddingHorizontal: theme.space[2],
    },
    salePaymentTotalLabel: {
      fontSize: 13,
      fontWeight: 'bold',
      color: theme.color.text.heading,
    },
    salePaymentTotalValue: {
      fontSize: 14,
      fontWeight: 'bold',
      color: theme.color.action.success.background,
    },
    saleItemCount: {
      fontSize: 12,
      color: theme.color.text.muted,
    },
    saleDate: {
      fontSize: 12,
      color: theme.color.text.placeholder,
    },
    saleItemActions: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
    },
    reprintButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.text.link,
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[4],
      gap: theme.space[2],
    },
    reprintButtonIcon: {
      fontSize: 18,
    },
    reprintButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
    generateCreditNoteButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.icon.warning,
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[4],
      gap: theme.space[2],
      borderLeftWidth: 1,
      borderLeftColor: theme.color.surface.base,
    },
    generateCreditNoteButtonIcon: {
      fontSize: 18,
    },
    generateCreditNoteButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
    creditNoteButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.action.success.background,
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[4],
      gap: theme.space[2],
      borderLeftWidth: 1,
      borderLeftColor: theme.color.surface.base,
    },
    manageCreditNoteButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.icon.accent,
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[4],
      gap: theme.space[2],
      borderLeftWidth: 1,
      borderLeftColor: theme.color.surface.base,
    },
    creditNoteButtonIcon: {
      fontSize: 18,
    },
    creditNoteButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
    closeModalButton: {
      backgroundColor: theme.color.text.link,
      padding: theme.space[3.5],
      borderRadius: theme.radii.md,
      alignItems: 'center',
    },
    closeModalButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
    paginationContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.space[4],
      paddingHorizontal: theme.space[5],
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.md,
      marginBottom: theme.space[4],
    },
    paginationButton: {
      backgroundColor: theme.color.text.link,
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[5],
      borderRadius: theme.radii.md,
      minWidth: 120,
      alignItems: 'center',
    },
    paginationButtonDisabled: {
      backgroundColor: theme.color.action.primary.backgroundDisabled,
      opacity: 0.6,
    },
    paginationButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
    paginationButtonTextDisabled: {
      color: theme.color.text.placeholder,
    },
    paginationInfo: {
      alignItems: 'center',
      flex: 1,
      marginHorizontal: theme.space[4],
    },
    paginationText: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    paginationSubtext: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
    successModalContent: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii['3xl'],
      padding: theme.space[12],
      width: '95%',
      maxWidth: 1200,
      maxHeight: '90%',
      ...theme.shadow.lg,
    },
    successHeader: {
      alignItems: 'center',
      marginBottom: theme.space[8],
    },
    successIcon: {
      fontSize: 100,
      color: theme.color.action.success.background,
      marginBottom: theme.space[4],
    },
    successTitle: {
      fontSize: 48,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      textAlign: 'center',
    },
    successDetails: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.xl,
      padding: theme.space[8],
      marginBottom: theme.space[8],
    },
    successTotalBox: {
      backgroundColor: theme.color.state.info.background,
      padding: theme.space[6],
      borderRadius: theme.radii.lg,
      alignItems: 'center',
      marginBottom: theme.space[5],
      borderWidth: 3,
      borderColor: theme.color.icon.accent,
    },
    successTotalLabel: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.color.state.info.text,
      marginBottom: theme.space[2],
      letterSpacing: 1,
    },
    successTotalValue: {
      fontSize: 48,
      fontWeight: 'bold',
      color: theme.color.state.info.text,
    },
    successChangeBox: {
      backgroundColor: theme.color.state.success.background,
      padding: 28,
      borderRadius: theme.radii.lg,
      alignItems: 'center',
      marginBottom: theme.space[5],
      borderWidth: 4,
      borderColor: theme.color.action.success.background,
    },
    successChangeLabel: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.color.state.success.text,
      marginBottom: theme.space[3],
      letterSpacing: 1,
    },
    successChangeValue: {
      fontSize: 56,
      fontWeight: 'bold',
      color: theme.color.state.success.text,
    },
    successRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[4],
    },
    successLabel: {
      fontSize: 20,
      color: theme.color.text.muted,
      fontWeight: '600',
    },
    successValue: {
      fontSize: 20,
      color: theme.color.text.heading,
      fontWeight: 'bold',
      textAlign: 'right',
      flex: 1,
      marginLeft: theme.space[4],
    },
    successValueBold: {
      fontSize: 28,
      color: theme.color.action.success.background,
      fontWeight: 'bold',
      textAlign: 'right',
      flex: 1,
      marginLeft: theme.space[4],
    },
    successButtons: {
      flexDirection: 'row',
      gap: theme.space[5],
    },
    printButton: {
      flex: 1,
      backgroundColor: theme.color.icon.accent,
      paddingVertical: 52,
      paddingHorizontal: theme.space[6],
      borderRadius: theme.radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    printButtonText: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.color.text.onAction,
    },
    newSaleButton: {
      flex: 1,
      backgroundColor: theme.color.action.success.background,
      paddingVertical: 52,
      paddingHorizontal: theme.space[6],
      borderRadius: theme.radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    newSaleButtonText: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.color.text.onAction,
    },
    offlineSuccessModalContent: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii['3xl'],
      padding: theme.space[8],
      width: '90%',
      maxWidth: 700,
      maxHeight: '95%',
      borderWidth: 3,
      borderColor: theme.color.icon.warning,
    },
    offlineSuccessHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.space[4],
      gap: theme.space[3],
    },
    offlineSuccessIcon: {
      fontSize: 48,
    },
    offlineSuccessTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.color.icon.warning,
    },
    offlineWarningBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.state.warning.background,
      borderWidth: 2,
      borderColor: theme.color.state.warning.border,
      borderRadius: theme.radii.lg,
      padding: theme.space[4],
      marginBottom: theme.space[5],
      gap: theme.space[3],
    },
    offlineWarningIcon: {
      fontSize: 32,
    },
    offlineWarningText: {
      flex: 1,
      fontSize: 14,
      color: theme.color.state.warning.text,
      fontWeight: '600',
      lineHeight: 20,
    },
    offlineSuccessTotalBox: {
      backgroundColor: theme.color.state.warning.background,
      borderRadius: theme.radii.xl,
      padding: theme.space[6],
      alignItems: 'center',
      marginBottom: theme.space[5],
      borderWidth: 3,
      borderColor: theme.color.icon.warning,
    },
    offlineTicketCode: {
      fontSize: 18,
      color: theme.color.icon.warning,
      fontWeight: 'bold',
      fontFamily: theme.fonts.mono,
      textAlign: 'right',
      flex: 1,
      marginLeft: theme.space[4],
    },
    offlinePendingBadge: {
      backgroundColor: theme.color.state.warning.background,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1.5],
      borderRadius: theme.radii.xl,
      borderWidth: 1,
      borderColor: theme.color.state.warning.border,
    },
    offlinePendingText: {
      fontSize: 14,
      color: theme.color.state.warning.text,
      fontWeight: '600',
    },
    offlinePrintButton: {
      flex: 1,
      backgroundColor: theme.color.icon.warning,
      paddingVertical: 52,
      paddingHorizontal: theme.space[6],
      borderRadius: theme.radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    barcodeSelectionModalOverlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.strong,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.space[6],
    },
    barcodeSelectionModalContent: {
      width: '96%',
      maxWidth: 1400,
      maxHeight: '92%',
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii['2xl'],
      padding: theme.space[6],
    },
    barcodeSelectionModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[2],
    },
    barcodeSelectionTitle: {
      fontSize: 36,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    barcodeSelectionSubtitle: {
      fontSize: 20,
      color: theme.color.text.body,
      marginBottom: theme.space[5],
    },
    barcodeSelectionCloseButton: {
      width: 44,
      height: 44,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.muted,
      justifyContent: 'center',
      alignItems: 'center',
    },
    barcodeSelectionCloseButtonText: {
      fontSize: 24,
      color: theme.color.text.body,
      fontWeight: '700',
    },
    barcodeSelectionListContent: {
      paddingBottom: theme.space[4],
    },
    barcodeSelectionRow: {
      gap: theme.space[4],
      marginBottom: theme.space[4],
    },
    barcodeSelectionCard: {
      flex: 1,
      minWidth: 0,
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      padding: theme.space[4],
    },
    barcodeSelectionImage: {
      width: '100%',
      height: 260,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.muted,
      marginBottom: theme.space[3],
    },
    barcodeSelectionImagePlaceholder: {
      width: '100%',
      height: 260,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.muted,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.space[3],
    },
    barcodeSelectionImagePlaceholderText: {
      fontSize: 64,
    },
    barcodeSelectionProductName: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[2],
      minHeight: 64,
    },
    barcodeSelectionProductCode: {
      fontSize: 16,
      color: theme.color.text.muted,
      marginBottom: theme.space[1.5],
    },
    barcodeSelectionProductPrice: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.color.text.link,
      marginBottom: theme.space[1.5],
    },
    barcodeSelectionProductStock: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.color.text.success,
    },
    imageModalOverlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.strong,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.space[5],
    },
    imageModalContent: {
      width: '100%',
      height: '80%',
      maxWidth: 800,
      position: 'relative',
    },
    imageModalCloseButton: {
      position: 'absolute',
      top: -60,
      right: theme.space[2.5],
      zIndex: 10,
      backgroundColor: theme.color.overlay.subtle,
      borderRadius: theme.radii.full,
      width: 60,
      height: 60,
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageModalCloseText: {
      fontSize: 36,
      color: theme.color.text.inverse,
      fontWeight: 'bold',
    },
    imageModalImage: {
      width: '100%',
      height: '100%',
    },
    creditNoteManagementModalContent: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[6],
      width: '90%',
      maxWidth: 700,
      maxHeight: '88%',
    },
    creditNoteManagementScroll: {
      flex: 1,
    },
    creditNoteManagementScrollContent: {
      paddingBottom: theme.space[4],
    },
    creditNoteManagementSummaryText: {
      fontSize: 13,
      color: theme.color.text.muted,
      marginTop: theme.space[1.5],
    },
    creditNoteManagementLoadingBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2.5],
      backgroundColor: theme.color.surface.muted,
      borderRadius: theme.radii.md,
      padding: theme.space[3],
      marginBottom: theme.space[4],
    },
    creditNoteManagementLoadingText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.icon.accent,
    },
    creditNoteManagementSection: {
      marginBottom: theme.space[5],
    },
    creditNoteManagementSectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[3],
    },
    creditNoteManagementEmptyText: {
      fontSize: 14,
      color: theme.color.text.placeholder,
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.md,
      padding: theme.space[3.5],
    },
    creditNoteManagementItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.space[3],
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.md,
      padding: theme.space[3],
      marginBottom: theme.space[2.5],
    },
    creditNoteManagementItemInfo: {
      flex: 1,
    },
    creditNoteManagementItemTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    creditNoteManagementItemDetail: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginBottom: 2,
    },
    creditNoteManagementDownloadButton: {
      backgroundColor: theme.color.text.link,
      borderRadius: theme.radii.md,
      paddingVertical: theme.space[2.5],
      paddingHorizontal: theme.space[3],
    },
    creditNoteManagementDownloadButtonText: {
      color: theme.color.text.onAction,
      fontSize: 13,
      fontWeight: '700',
    },
    creditNoteAvailableItem: {
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.md,
      padding: theme.space[3],
      marginBottom: theme.space[2],
    },
    creditNoteAvailableItemName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    creditNoteAvailableItemDetail: {
      fontSize: 12,
      color: theme.color.text.muted,
    },
    creditNoteAvailableReturnDetail: {
      fontSize: 11,
      color: theme.color.icon.accent,
      marginTop: 3,
    },
    creditNoteManagementGenerateButton: {
      backgroundColor: theme.color.icon.warning,
      borderRadius: theme.radii.md,
      paddingVertical: theme.space[3.5],
      alignItems: 'center',
    },
    creditNoteManagementGenerateButtonText: {
      color: theme.color.text.onAction,
      fontSize: 15,
      fontWeight: '700',
    },
    creditNoteModalContent: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[6],
      width: '90%',
      maxWidth: 600,
      maxHeight: '88%',
    },
    creditNoteModalScroll: {
      flex: 1,
    },
    creditNoteModalScrollContent: {
      paddingBottom: theme.space[4],
    },
    creditNoteModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[5],
    },
    creditNoteSaleInfo: {
      backgroundColor: theme.color.surface.subtle,
      padding: theme.space[4],
      borderRadius: theme.radii.md,
      marginBottom: theme.space[5],
    },
    creditNoteSaleNumber: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      marginBottom: theme.space[2],
    },
    creditNoteSaleTotal: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.color.action.success.background,
    },
    creditNoteTypeContainer: {
      marginBottom: theme.space[5],
    },
    creditNoteTypeLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[3],
    },
    creditNoteTypeButtons: {
      flexDirection: 'row',
      gap: theme.space[3],
    },
    creditNoteTypeButton: {
      flex: 1,
      backgroundColor: theme.color.surface.subtle,
      paddingVertical: theme.space[4],
      paddingHorizontal: theme.space[5],
      borderRadius: theme.radii.md,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: theme.color.border.subtle,
    },
    creditNoteTypeButtonActive: {
      backgroundColor: theme.color.state.info.background,
      borderColor: theme.color.icon.accent,
    },
    creditNoteTypeButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    creditNoteTypeButtonTextActive: {
      color: theme.color.text.link,
    },
    creditNoteFieldContainer: {
      marginBottom: theme.space[5],
    },
    creditNoteFieldLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[2],
    },
    creditNoteSustentoInput: {
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.md,
      padding: theme.space[3],
      fontSize: 14,
      color: theme.color.text.heading,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    creditNoteCharCount: {
      fontSize: 12,
      color: theme.color.text.placeholder,
      textAlign: 'right',
      marginTop: theme.space[1],
    },
    creditNoteProductsContainer: {
      marginBottom: theme.space[5],
    },
    creditNoteProductsLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[3],
    },
    creditNoteProductsList: {
      maxHeight: 260,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.md,
      padding: theme.space[2],
    },
    creditNoteProductItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.space[3],
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.md,
      marginBottom: theme.space[2],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    creditNoteProductItemSelected: {
      backgroundColor: theme.color.state.info.background,
      borderColor: theme.color.icon.accent,
    },
    creditNoteProductCheckbox: {
      marginRight: theme.space[3],
    },
    creditNoteProductCheckboxIcon: {
      fontSize: 24,
      color: theme.color.icon.accent,
    },
    creditNoteProductInfo: {
      flex: 1,
    },
    creditNoteProductName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    creditNoteProductSku: {
      fontSize: 11,
      color: theme.color.text.placeholder,
      marginBottom: theme.space[1],
    },
    creditNoteProductDetails: {
      fontSize: 12,
      color: theme.color.text.muted,
    },
    creditNoteQuantityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      marginTop: theme.space[2],
    },
    creditNoteQuantityLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    creditNoteQuantityInput: {
      width: 70,
      backgroundColor: theme.color.surface.base,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.sm,
      paddingHorizontal: theme.space[2],
      paddingVertical: theme.space[1.5],
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
      textAlign: 'center',
    },
    creditNoteProductTotal: {
      fontSize: 14,
      fontWeight: 'bold',
      color: theme.color.action.success.background,
    },
    creditNoteLoadingContainer: {
      backgroundColor: theme.color.state.warning.background,
      padding: theme.space[5],
      borderRadius: theme.radii.md,
      alignItems: 'center',
      marginBottom: theme.space[5],
      borderWidth: 1,
      borderColor: theme.color.state.warning.border,
    },
    creditNoteLoadingText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.state.warning.text,
      marginTop: theme.space[3],
    },
    creditNoteLoadingSubtext: {
      fontSize: 12,
      color: theme.color.icon.warning,
      marginTop: theme.space[1],
    },
    creditNoteActions: {
      flexDirection: 'row',
      gap: theme.space[3],
      marginTop: theme.space[5],
    },
    creditNoteCancelButton: {
      flex: 1,
      backgroundColor: theme.color.surface.subtle,
      paddingVertical: theme.space[3.5],
      borderRadius: theme.radii.md,
      alignItems: 'center',
    },
    creditNoteCancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    creditNoteConfirmButton: {
      flex: 1,
      backgroundColor: theme.color.icon.warning,
      paddingVertical: theme.space[3.5],
      borderRadius: theme.radii.md,
      alignItems: 'center',
    },
    creditNoteConfirmButtonDisabled: {
      backgroundColor: theme.color.border.subtle,
    },
    creditNoteButtonDisabled: {
      opacity: 0.5,
    },
    creditNoteConfirmButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
    pinPadModalOverlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.strong,
      justifyContent: 'center',
      alignItems: 'center',
    },
    pinPadModalContent: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[6],
      width: '90%',
      maxWidth: 400,
      alignItems: 'center',
      ...theme.shadow.lg,
    },
    pinPadModalHeader: {
      alignItems: 'center',
      marginBottom: theme.space[5],
    },
    pinPadModalIcon: {
      fontSize: 48,
      marginBottom: theme.space[3],
    },
    pinPadModalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.color.text.heading,
    },
    pinPadModalBody: {
      alignItems: 'center',
      width: '100%',
      paddingVertical: theme.space[4],
    },
    pinPadModalAmount: {
      fontSize: 36,
      fontWeight: 'bold',
      color: theme.color.icon.accent,
      marginBottom: theme.space[4],
    },
    pinPadModalMessage: {
      fontSize: 16,
      color: theme.color.text.muted,
      textAlign: 'center',
      lineHeight: 24,
      paddingHorizontal: theme.space[4],
    },
    pinPadModalCloseButton: {
      marginTop: theme.space[5],
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[8],
      backgroundColor: theme.color.border.subtle,
      borderRadius: theme.radii.md,
    },
    pinPadModalCloseButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
  });
