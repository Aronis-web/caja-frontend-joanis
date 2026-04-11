/**
 * New Sale Screen
 * Main POS sale interface with product search and cart
 */

import React, { useState, useEffect } from 'react';
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
import { useOfflineStore } from '@/store/offline';
import { usePinPadStore } from '@/store/pinpad';
import { posService } from '@/services/POSService';
import { networkMonitor } from '@/services/NetworkMonitor';
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

export default function NewSaleScreen() {
  const navigation = useNavigation();
  const { width: windowWidth } = useWindowDimensions();
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
    isLoading,
    initializeFromStorage,
    loadPaymentMethods,
    loadActiveSession,
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
  } = useOfflineStore();

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
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const [lastKeyTime, setLastKeyTime] = useState(0);

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
  const [currentPage, setCurrentPage] = useState(1);
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
  const [creditNoteType, setCreditNoteType] = useState<'total' | 'partial' | null>(null);
  const [selectedSaleForCreditNote, setSelectedSaleForCreditNote] = useState<any>(null);
  const [selectedProductsForCreditNote, setSelectedProductsForCreditNote] = useState<string[]>([]);
  const [creditNoteMotivo, setCreditNoteMotivo] = useState<string>('06');
  const [creditNoteSustento, setCreditNoteSustento] = useState<string>('');
  const [generatingCreditNote, setGeneratingCreditNote] = useState(false);

  // Payment method selection states
  const [selectedParentMethod, setSelectedParentMethod] = useState<string | null>(null);
  const [selectedSubmethod, setSelectedSubmethod] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  // PinPad states
  const [showPinPadModal, setShowPinPadModal] = useState(false);
  const [pinPadProcessing, setPinPadProcessing] = useState(false);
  const [pinPadMessage, setPinPadMessage] = useState('');
  const [pinPadAmountPending, setPinPadAmountPending] = useState(0);
  const [pinPadMethodPending, setPinPadMethodPending] = useState<string | null>(null);
  const [pinPadMethodNamePending, setPinPadMethodNamePending] = useState<string>('');

  // Initialize store from AsyncStorage on mount
  useEffect(() => {
    const initialize = async () => {
      console.log('🔄 Inicializando store desde AsyncStorage...');
      setIsInitializing(true);

      await initializeFromStorage();

      // Si hay una caja registradora seleccionada pero no hay sesión, intentar cargar la sesión activa
      if (selectedCashRegister && !currentSession) {
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
    // Solo redirigir si ya terminó de inicializar y no hay sesión
    if (!isInitializing && !currentSession) {
      console.log('⚠️ No hay sesión activa después de inicializar, redirigiendo a abrir sesión');
      navigation.navigate(ROUTES.OPEN_SESSION as never);
    }
  }, [currentSession, isInitializing]);

  // Listener global para capturar escaneo de código de barras
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let barcodeTimeout: NodeJS.Timeout;

    const handleKeyPress = (event: KeyboardEvent) => {
      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime;

      // Si pasa más de 100ms entre teclas, reiniciar el buffer (nueva entrada)
      if (timeDiff > 100) {
        setBarcodeBuffer('');
      }

      setLastKeyTime(currentTime);

      // Si es Enter, procesar el código de barras
      if (event.key === 'Enter') {
        event.preventDefault();
        if (barcodeBuffer.length > 0) {
          console.log('📷 Código de barras capturado:', barcodeBuffer);
          handleBarcodeScanned(barcodeBuffer);
          setBarcodeBuffer('');
        }
        return;
      }

      // Ignorar teclas especiales
      if (event.key.length > 1) return;

      // Agregar carácter al buffer
      setBarcodeBuffer((prev) => prev + event.key);

      // Limpiar buffer después de 200ms de inactividad
      clearTimeout(barcodeTimeout);
      barcodeTimeout = setTimeout(() => {
        setBarcodeBuffer('');
      }, 200);
    };

    window.addEventListener('keypress', handleKeyPress);

    return () => {
      window.removeEventListener('keypress', handleKeyPress);
      clearTimeout(barcodeTimeout);
    };
  }, [barcodeBuffer, lastKeyTime, currentSession]);

  const handleSearchProducts = async (query: string) => {
    console.log('🔍 handleSearchProducts llamado con query:', query);
    setSearchQuery(query);
    if (query.length < 2) {
      console.log('⚠️ Query muy corto, limpiando resultados');
      setSearchResults([]);
      return;
    }

    // Si está en modo offline, buscar en la base de datos local
    if (isOfflineModeEnabled) {
      console.log('📴 Buscando en modo OFFLINE...');
      try {
        setSearching(true);
        const offlineResults = await searchProductsOffline(query, 20);
        console.log('✅ Productos encontrados (offline):', offlineResults.length);

        // Convertir OfflineProduct a Product para compatibilidad
        const results: Product[] = offlineResults.map((p) => ({
          id: p.id,
          sku: p.sku,
          barcode: p.barcode,
          name: p.name,
          code: p.sku || p.barcode,
          categoryName: p.categoryName,
          salePriceCents: p.salePriceCents,
          price: p.salePriceCents / 100,
          stock: p.localStock,
          availableStock: p.localStock,
          taxType: p.taxType,
          taxRate: p.taxType === 'GRAVADO' ? 18 : 0,
          imageUrl: p.imageUrl,
          isActive: true,
        }));

        setSearchResults(results);
      } catch (error) {
        console.error('❌ Error buscando productos offline:', error);
        Alert.alert('Error', 'Error al buscar productos en modo offline.');
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
      return;
    }

    // Modo online normal
    console.log('📋 currentSession:', currentSession);
    if (!currentSession) {
      console.error('❌ No hay sesión activa');
      Alert.alert('Error', 'No hay una sesión activa. Por favor, abre una sesión primero.');
      return;
    }

    console.log('🔑 cashRegisterId:', currentSession.cashRegisterId);

    try {
      setSearching(true);
      console.log('🚀 Iniciando búsqueda de productos...');
      const results = await posService.searchProducts(query, 20, currentSession.cashRegisterId);
      console.log('✅ Productos encontrados:', results.length);
      if (results.length > 0) {
        console.log('📦 Primer producto:', results[0]);
      }
      // El backend ya filtra por productos activos, no necesitamos filtrar aquí
      setSearchResults(results);
    } catch (error) {
      console.error('❌ Error searching products:', error);
      Alert.alert('Error', 'No se pudieron buscar productos. Verifica tu conexión.');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Manejar escaneo de código de barras (cuando se presiona Enter)
  const handleBarcodeScanned = async (query: string) => {
    console.log('📷 Código escaneado:', query);

    if (!query || query.length < 2) {
      console.log('⚠️ Código muy corto, ignorando');
      return;
    }

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
            // Buscar coincidencia exacta por número de documento
            const exactMatch = customerResults.data.find(
              (customer) => customer.documentNumber === query
            );

            if (exactMatch) {
              console.log('✅ Cliente encontrado:', exactMatch.fullName || exactMatch.name);

              // Si ya hay un cliente, reemplazarlo
              if (selectedCustomer) {
                console.log('🔄 Reemplazando cliente anterior:', selectedCustomer.name);
              }

              // Agregar el nuevo cliente
              handleSelectCustomer(exactMatch);
              setSearching(false);
              return;
            }
          }

          console.log('ℹ️ No se encontró cliente con DNI:', query);
          // Si no se encuentra cliente, continuar buscando como producto
        } catch (customerError) {
          console.log('⚠️ Error al buscar cliente, continuando con búsqueda de producto');
        }
      }

      // Buscar como producto (código de barras)
      console.log('🔍 Buscando producto por código de barras...');
      const results = await posService.searchProducts(query, 20, currentSession.cashRegisterId);

      if (results.length === 0) {
        console.log('❌ No se encontró ningún producto con ese código');
        Alert.alert(
          'No encontrado',
          `No se encontró ningún producto o cliente con el código: ${query}`
        );
        setSearchQuery('');
        setSearchResults([]);
      } else if (results.length === 1) {
        // Si hay exactamente 1 resultado, agregarlo automáticamente al carrito
        console.log('✅ Producto encontrado, agregando al carrito automáticamente');
        await handleAddProduct(results[0]);
        // Limpiar búsqueda para el siguiente escaneo
        setSearchQuery('');
        setSearchResults([]);
      } else {
        // Si hay múltiples resultados, mostrarlos para que el usuario seleccione
        console.log(`⚠️ Se encontraron ${results.length} productos, mostrando resultados`);
        setSearchResults(results);
      }
    } catch (error) {
      console.error('❌ Error al procesar código escaneado:', error);
      Alert.alert('Error', 'No se pudo procesar el código. Verifica tu conexión.');
      setSearchQuery('');
      setSearchResults([]);
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

      // El producto ya viene con toda la información necesaria del endpoint
      addItemToCart(product, 1);
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      console.error('❌ Error al agregar producto:', error);
      Alert.alert('Error', 'No se pudo agregar el producto. Intenta nuevamente.');
    }
  };

  const handleSearchCustomers = async (query: string) => {
    setCustomerSearchQuery(query);

    if (query.length < 2) {
      setCustomerSearchResults([]);
      setShowCustomerDropdown(false);
      return;
    }

    try {
      setSearchingCustomers(true);
      const response = await posService.autocompleteCustomers(query, 10);
      setCustomerSearchResults(response.data);
      // Mostrar dropdown si hay resultados O si es un DNI/RUC válido para agregar
      const isValidDNI = /^\d{8}$/.test(query.trim());
      const isValidRUC = /^\d{11}$/.test(query.trim());
      setShowCustomerDropdown(response.data.length > 0 || isValidDNI || isValidRUC);
    } catch (error) {
      console.error('❌ Error searching customers:', error);
      setCustomerSearchResults([]);
      // Aún mostrar dropdown si es DNI/RUC válido para permitir agregar
      const isValidDNI = /^\d{8}$/.test(query.trim());
      const isValidRUC = /^\d{11}$/.test(query.trim());
      setShowCustomerDropdown(isValidDNI || isValidRUC);
    } finally {
      setSearchingCustomers(false);
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
    setCustomerSearchQuery(
      customer.label || `${customer.fullName || customer.name} - ${customer.documentNumber}`
    );
    setShowCustomerDropdown(false);

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
    setCustomerSearchResults([]);
    setShowCustomerDropdown(false);
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
      console.log('💰 [VENTAS] Total ventas (cents):', salesData.summary?.totalSalesCents || 0);
      console.log('💳 [VENTAS] Total pagos (cents):', salesData.summary?.totalPaymentsCents || 0);

      if (salesData.sales && salesData.sales.length > 0) {
        console.log(
          '🔍 [VENTAS] Primera venta (ejemplo):',
          JSON.stringify(salesData.sales[0], null, 2)
        );
      }

      setActiveSalesData(salesData);
      setCurrentPage(validPage);
      setShowRecentSales(true);
    } catch (error) {
      console.error('❌ [VENTAS] Error loading active sales:', error);
      Alert.alert('Error', 'No se pudieron cargar las ventas de la sesión activa');
    } finally {
      setLoadingSales(false);
    }
  };

  const handleCompleteSale = async () => {
    console.log('🚀 handleCompleteSale iniciado');
    const total = getCartTotal();
    const paymentsTotal = getPaymentsTotal();

    console.log('💰 Total de la venta:', total);
    console.log('💳 Total de pagos:', paymentsTotal);
    console.log('📊 Diferencia:', paymentsTotal - total);

    // Permitir venta si el pago es mayor o igual al total
    if (paymentsTotal < total) {
      console.log('❌ Error: Pago insuficiente');
      Alert.alert('Error', 'El monto pagado es insuficiente');
      return;
    }

    // Calcular el vuelto
    const change = paymentsTotal - total;
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

      if (!selectedCashRegister || !currentSession) {
        Alert.alert('Error', 'No hay sesión activa');
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
          cashRegisterId: selectedCashRegister.id,
          sessionId: currentSession.id,
          sellerId: currentSession.userId,
          cashRegisterCode: selectedCashRegister.code,
        });

        console.log('✅ Venta offline creada:', offlineSale.offlineTicketCode);

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

      return;
    }

    // ============ MODO ONLINE (normal) ============
    try {
      console.log('📞 Llamando a createSale...');
      const result = await createSale(selectedCustomer?.id, documentType, 'Venta desde POS');
      console.log('✅ Venta creada exitosamente:', result);

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

  const handleGenerateCreditNote = async (saleId: string) => {
    console.log('🔵 [CREDIT_NOTE] handleGenerateCreditNote llamado');
    console.log('🔵 [CREDIT_NOTE] saleId:', saleId);

    try {
      // Buscar la venta en activeSalesData
      const saleData = activeSalesData?.sales.find((s) => s.saleId === saleId);
      if (!saleData) {
        Alert.alert('Error', 'No se encontró la información de la venta');
        return;
      }

      console.log('🔵 [CREDIT_NOTE] Sale data:', saleData);
      console.log('🔵 [CREDIT_NOTE] Items:', saleData.sale.items);

      // Abrir modal de selección de tipo de devolución
      setSelectedSaleForCreditNote(saleData);
      setCreditNoteType(null);
      setSelectedProductsForCreditNote([]);
      setCreditNoteMotivo('06'); // Devolución total por defecto
      setCreditNoteSustento('');
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
          .filter((item: any) => selectedProductsForCreditNote.includes(item.productId))
          .map((item: any) => ({
            sku: item.productCode || item.sku,
            descripcion: item.productName || item.name,
            cantidad: item.quantity,
            valorUnitario: item.unitPrice / 100, // Convertir de centavos a soles
            precioVentaUnitario: item.unitPrice / 100,
          }));
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

  const toggleProductSelection = (productId: string) => {
    setSelectedProductsForCreditNote((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  const handlePrintCreditNote = async (saleId: string, creditNotes: any[]) => {
    try {
      console.log('🖨️ [CREDIT_NOTE] Imprimiendo ticket de nota de crédito para venta:', saleId);
      console.log('🖨️ [CREDIT_NOTE] Credit Notes disponibles:', creditNotes);

      // Obtener el primer creditNote (o el más reciente)
      if (!creditNotes || creditNotes.length === 0) {
        Alert.alert('Error', 'No se encontró la nota de crédito');
        return;
      }

      const creditNote = creditNotes[0]; // Tomar la primera nota de crédito
      const creditNoteDocumentId = creditNote.id;

      console.log('🖨️ [CREDIT_NOTE] Credit Note Document ID:', creditNoteDocumentId);

      const response = await posService.regenerateCreditNoteTicket(saleId, creditNoteDocumentId);
      console.log('✅ [CREDIT_NOTE] Ticket de nota de crédito generado:', response.filename);

      // Imprimir el ticket
      await handlePrintPDF(response.pdfBase64, response.filename);
      console.log('✅ [CREDIT_NOTE] Ticket impreso exitosamente');
    } catch (error) {
      console.error('❌ [CREDIT_NOTE] Error al imprimir nota de crédito:', error);
      Alert.alert('Error', 'No se pudo imprimir el ticket de la nota de crédito');
    }
  };

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
      const qrUrl = `https://erp-aio-offline-documents.com/public/receipt/${saleData.token}`;

      // Generar contenido HTML del ticket
      const ticketHtml = generateOfflineTicketHtml(saleData, companyInfo, qrUrl);

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
    qrUrl: string
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

    // Generar QR como imagen usando API de QR (tamaño grande para impresoras térmicas)
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=${encodeURIComponent(qrUrl)}`;

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

  const renderProductItem = ({ item }: { item: Product }) => (
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
      </View>
    </TouchableOpacity>
  );

  const renderCartItem = ({ item, index }: { item: any; index: number }) => {
    const unitPrice = item.unitPrice || 0; // Este precio ya incluye IGV
    const taxRate = item.taxRate || 0;
    // El total del item es simplemente cantidad * precio (que ya incluye IGV) - descuento
    const itemTotal = item.quantity * unitPrice - (item.discount || 0);

    const handleQuantityChange = (text: string) => {
      const newQuantity = parseInt(text, 10);
      if (!isNaN(newQuantity) && newQuantity > 0) {
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
                  onBlur={(e) => handleQuantityBlur(e.nativeEvent.text)}
                  keyboardType="numeric"
                  selectTextOnFocus
                  maxLength={4}
                />
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => updateCartItem(index, item.quantity + 1)}
                >
                  <Text style={styles.quantityButtonText}>+</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.cartItemTotal}>Total: {formatCurrency(itemTotal)}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

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
        <Text style={styles.title}>Nueva Venta</Text>
        <View style={styles.headerActions}>
          {/* Offline Mode Switch - discreto al lado de Últimas Ventas */}
          <OfflineModeSwitch mini />
          <TouchableOpacity
            style={styles.recentSalesButton}
            onPress={handleLoadRecentSales}
            disabled={loadingSales || isOfflineModeEnabled}
          >
            {loadingSales ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <>
                <Text style={styles.recentSalesIcon}>📋</Text>
                <Text style={styles.recentSalesText}>Últimas Ventas</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate(ROUTES.POS_DASHBOARD as never)}>
            <Text style={styles.menuButton}>☰</Text>
          </TouchableOpacity>
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
              placeholderTextColor="#999"
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
                          { backgroundColor: '#FFF3E0', marginTop: 4 },
                        ]}
                      >
                        <Text style={{ fontSize: 11, color: '#E65100' }}>📴 Cliente Offline</Text>
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
                        placeholderTextColor="#999"
                        onFocus={() => {
                          if (customerSearchResults.length > 0) {
                            setShowCustomerDropdown(true);
                          }
                        }}
                      />
                      {searchingCustomers && (
                        <ActivityIndicator
                          style={styles.customerSearchLoader}
                          size="small"
                          color="#007AFF"
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
                      const remaining = getCartTotal() - getPaymentsTotal();
                      setPaymentAmount(remaining.toFixed(2));
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
                      const total = getCartTotal();

                      if (isIzipay && amount > total) {
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
                    const isIzipay =
                      selectedMethod?.code?.includes('IZIPAY') || selectedMethod?.isIzipay;
                    const isCash = selectedMethod?.code === 'CASH' || selectedMethod?.isCash;
                    const total = getCartTotal();

                    console.log('💳 Validando pago:', {
                      method: selectedMethod?.name,
                      code: selectedMethod?.code,
                      isIzipay,
                      isCash,
                      amount,
                      total,
                    });

                    // Si es IZIPAY (tarjeta), validar que no exceda el total de la venta
                    if (isIzipay && amount > total) {
                      Alert.alert(
                        'Error',
                        `El monto con tarjeta no puede exceder el total de la venta (S/ ${total.toFixed(
                          2
                        )})`
                      );
                      return;
                    }

                    // Si es Izipay, procesar con el PinPad Verifone P400
                    if (isIzipay) {
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
                    {getPaymentsTotal() !== getCartTotal() && (
                      <View
                        style={[
                          styles.changeHighlightBox,
                          getPaymentsTotal() < getCartTotal()
                            ? styles.changeHighlightBoxMissing
                            : styles.changeHighlightBoxChange,
                        ]}
                      >
                        <Text style={styles.changeHighlightLabel}>
                          {getPaymentsTotal() < getCartTotal() ? '⚠️ FALTANTE' : '💰 VUELTO'}
                        </Text>
                        <Text
                          style={[
                            styles.changeHighlightValue,
                            getPaymentsTotal() < getCartTotal()
                              ? styles.summaryValueMissing
                              : styles.summaryValueChange,
                          ]}
                        >
                          {formatCurrency(Math.abs(getPaymentsTotal() - getCartTotal()))}
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
                  (getPaymentsTotal() < getCartTotal() || isLoading) && styles.buttonDisabled,
                ]}
                onPress={() => {
                  const total = getCartTotal();
                  const paymentsTotal = getPaymentsTotal();
                  console.log('🔘 Botón presionado');
                  console.log('💰 Total carrito:', total);
                  console.log('💳 Total pagos:', paymentsTotal);
                  console.log('🔒 Está deshabilitado:', paymentsTotal < total || isLoading);
                  console.log('⏳ isLoading:', isLoading);

                  if (paymentsTotal < total || isLoading) {
                    console.log('❌ Botón deshabilitado, no se ejecuta handleCompleteSale');
                    return;
                  }

                  handleCompleteSale();
                }}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
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
                            style={styles.creditNoteButton}
                            onPress={(e) => {
                              console.log('🟢 [BUTTON] Botón Imprimir NC presionado');
                              console.log('🟢 [BUTTON] Sale ID:', saleId);
                              console.log('🟢 [BUTTON] Has Credit Note:', hasCreditNote);
                              console.log('🟢 [BUTTON] Credit Notes:', sale.creditNotes);
                              e.stopPropagation();
                              handlePrintCreditNote(saleId, sale.creditNotes);
                            }}
                          >
                            <Text style={styles.creditNoteButtonIcon}>🖨️</Text>
                            <Text style={styles.creditNoteButtonText}>Imprimir NC</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={styles.generateCreditNoteButton}
                            onPress={(e) => {
                              console.log('🟠 [BUTTON] Botón Generar NC presionado');
                              console.log('🟠 [BUTTON] Sale ID:', saleId);
                              console.log('🟠 [BUTTON] Has Credit Note:', hasCreditNote);
                              e.stopPropagation();
                              handleGenerateCreditNote(saleId);
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
              activeSalesData.pagination.totalPages > 1 && (
                <View style={styles.paginationContainer}>
                  <TouchableOpacity
                    style={[
                      styles.paginationButton,
                      !activeSalesData.pagination.hasPreviousPage &&
                        styles.paginationButtonDisabled,
                    ]}
                    onPress={() => handleLoadRecentSales(currentPage - 1)}
                    disabled={!activeSalesData.pagination.hasPreviousPage || loadingSales}
                  >
                    <Text
                      style={[
                        styles.paginationButtonText,
                        !activeSalesData.pagination.hasPreviousPage &&
                          styles.paginationButtonTextDisabled,
                      ]}
                    >
                      ← Anterior
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.paginationInfo}>
                    <Text style={styles.paginationText}>
                      Página {activeSalesData.pagination.page} de{' '}
                      {activeSalesData.pagination.totalPages}
                    </Text>
                    <Text style={styles.paginationSubtext}>
                      ({activeSalesData.pagination.totalSales} ventas totales)
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.paginationButton,
                      !activeSalesData.pagination.hasNextPage && styles.paginationButtonDisabled,
                    ]}
                    onPress={() => handleLoadRecentSales(currentPage + 1)}
                    disabled={!activeSalesData.pagination.hasNextPage || loadingSales}
                  >
                    <Text
                      style={[
                        styles.paginationButtonText,
                        !activeSalesData.pagination.hasNextPage &&
                          styles.paginationButtonTextDisabled,
                      ]}
                    >
                      Siguiente →
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setShowRecentSales(false)}
            >
              <Text style={styles.closeModalButtonText}>Cerrar</Text>
            </TouchableOpacity>
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

      {/* Credit Note Modal */}
      <Modal
        visible={showCreditNoteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowCreditNoteModal(false);
          setCreditNoteType(null);
          setSelectedProductsForCreditNote([]);
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
              <>
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

                {/* Motivo de la Nota de Crédito */}
                <View style={styles.creditNoteFieldContainer}>
                  <Text style={styles.creditNoteFieldLabel}>Motivo (Catálogo 09 SUNAT):</Text>
                  <View style={styles.creditNoteSelectContainer}>
                    <TouchableOpacity
                      style={styles.creditNoteSelect}
                      onPress={() => {
                        // Aquí podrías abrir un picker o modal con todos los motivos
                        // Por ahora, mostraremos los más comunes
                      }}
                    >
                      <Text style={styles.creditNoteSelectText}>
                        {creditNoteMotivo === '01' && '01 - Anulación de la operación'}
                        {creditNoteMotivo === '06' && '06 - Devolución total'}
                        {creditNoteMotivo === '07' && '07 - Devolución por ítem'}
                        {creditNoteMotivo === '04' && '04 - Descuento global'}
                        {creditNoteMotivo === '05' && '05 - Descuento por ítem'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.creditNoteMotivoButtons}>
                    <TouchableOpacity
                      style={[
                        styles.creditNoteMotivoButton,
                        creditNoteMotivo === '01' && styles.creditNoteMotivoButtonActive,
                      ]}
                      onPress={() => setCreditNoteMotivo('01')}
                    >
                      <Text
                        style={[
                          styles.creditNoteMotivoButtonText,
                          creditNoteMotivo === '01' && styles.creditNoteMotivoButtonTextActive,
                        ]}
                      >
                        01 - Anulación
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.creditNoteMotivoButton,
                        creditNoteMotivo === '06' && styles.creditNoteMotivoButtonActive,
                      ]}
                      onPress={() => setCreditNoteMotivo('06')}
                    >
                      <Text
                        style={[
                          styles.creditNoteMotivoButtonText,
                          creditNoteMotivo === '06' && styles.creditNoteMotivoButtonTextActive,
                        ]}
                      >
                        06 - Dev. Total
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.creditNoteMotivoButton,
                        creditNoteMotivo === '07' && styles.creditNoteMotivoButtonActive,
                      ]}
                      onPress={() => setCreditNoteMotivo('07')}
                    >
                      <Text
                        style={[
                          styles.creditNoteMotivoButtonText,
                          creditNoteMotivo === '07' && styles.creditNoteMotivoButtonTextActive,
                        ]}
                      >
                        07 - Dev. Ítem
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
                    placeholderTextColor="#999"
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
                    <ScrollView style={styles.creditNoteProductsList}>
                      {selectedSaleForCreditNote.sale.items.map((item: any, index: number) => {
                        const isSelected = selectedProductsForCreditNote.includes(item.productId);
                        return (
                          <TouchableOpacity
                            key={index}
                            style={[
                              styles.creditNoteProductItem,
                              isSelected && styles.creditNoteProductItemSelected,
                            ]}
                            onPress={() => toggleProductSelection(item.productId)}
                          >
                            <View style={styles.creditNoteProductCheckbox}>
                              <Text style={styles.creditNoteProductCheckboxIcon}>
                                {isSelected ? '☑' : '☐'}
                              </Text>
                            </View>
                            <View style={styles.creditNoteProductInfo}>
                              <Text style={styles.creditNoteProductName}>
                                {item.productName || item.name}
                              </Text>
                              <Text style={styles.creditNoteProductDetails}>
                                Cantidad: {item.quantity} | Precio:{' '}
                                {formatCurrency(item.unitPrice / 100)}
                              </Text>
                            </View>
                            <Text style={styles.creditNoteProductTotal}>
                              {formatCurrency((item.quantity * item.unitPrice) / 100)}
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
                    <ActivityIndicator size="large" color="#FF9800" />
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
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.creditNoteConfirmButtonText}>Generar NC</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
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
                onPress={handlePrintPDF}
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
                <ActivityIndicator size="large" color="#4CAF50" />
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
                        placeholderTextColor="#999"
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
                          placeholderTextColor="#999"
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
                          placeholderTextColor="#999"
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
                        placeholderTextColor="#999"
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
                        placeholderTextColor="#999"
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
                      placeholderTextColor="#999"
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
                      placeholderTextColor="#999"
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
                    trackColor={{ false: '#E0E0E0', true: '#81C784' }}
                    thumbColor={newCustomerData.aceptaPublicidad ? '#4CAF50' : '#BDBDBD'}
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
                  <ActivityIndicator size="small" color="#FFFFFF" />
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
                  placeholderTextColor="#999"
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
                  placeholderTextColor="#999"
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
                <ActivityIndicator size="large" color="#2196F3" style={{ marginVertical: 20 }} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recentSalesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  recentSalesIcon: {
    fontSize: 18,
  },
  recentSalesText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  menuButton: {
    fontSize: 24,
    color: '#666',
    padding: 4,
  },
  // Offline Status Bar styles
  offlineStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#343a40',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 12,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotOnline: {
    backgroundColor: '#4caf50',
  },
  dotOffline: {
    backgroundColor: '#f44336',
  },
  offlineStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  offlineBadge: {
    backgroundColor: '#ff9800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  offlineBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  offlineTokenCount: {
    color: '#fff',
    fontSize: 12,
  },
  offlinePendingCount: {
    color: '#ffeb3b',
    fontSize: 12,
    fontWeight: '600',
  },
  closeButton: {
    fontSize: 24,
    color: '#666',
    padding: 4,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  leftPanel: {
    flex: 1,
    padding: 16,
  },
  rightPanel: {
    flex: 0.4,
    minWidth: 320,
    maxWidth: 650,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderLeftColor: '#E0E0E0',
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    fontSize: 20,
    borderWidth: 2,
    borderColor: '#2196F3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchLoader: {
    marginLeft: 8,
  },
  searchResults: {
    flex: 1,
  },
  productItem: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 12,
  },
  productImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  productImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
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
    color: '#333',
    marginBottom: 4,
  },
  productCode: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  // Customer Search Styles
  customerSearchContainer: {
    marginBottom: 16,
    position: 'relative',
    zIndex: 1000,
  },
  customerSearchHeader: {
    marginBottom: 8,
  },
  customerSearchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  customerInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  customerSearchInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    fontSize: 18,
    borderWidth: 2,
    borderColor: '#4CAF50',
    paddingRight: 70,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  customerSearchLoader: {
    position: 'absolute',
    right: 40,
  },
  clearCustomerButton: {
    position: 'absolute',
    right: 8,
    padding: 8,
  },
  clearCustomerIcon: {
    fontSize: 18,
    color: '#999',
    fontWeight: 'bold',
  },
  customerDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: 4,
    maxHeight: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1001,
  },
  customerDropdownScroll: {
    maxHeight: 300,
  },
  customerDropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  customerDropdownItemContent: {
    gap: 4,
  },
  customerDropdownItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  customerDropdownItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  customerTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  customerTypeBadgeEmpresa: {
    backgroundColor: '#E3F2FD',
  },
  customerTypeBadgePersona: {
    backgroundColor: '#F3E5F5',
  },
  customerTypeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666',
  },
  customerDropdownItemDoc: {
    fontSize: 12,
    color: '#666',
  },
  customerDropdownItemEmail: {
    fontSize: 11,
    color: '#999',
  },
  customerDropdownItemPhone: {
    fontSize: 11,
    color: '#999',
  },
  selectedCustomerCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#4CAF50',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedCustomerInfo: {
    flex: 1,
    marginRight: 12,
  },
  selectedCustomerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 4,
  },
  selectedCustomerDoc: {
    fontSize: 14,
    color: '#388E3C',
    marginBottom: 2,
  },
  selectedCustomerEmail: {
    fontSize: 12,
    color: '#66BB6A',
    marginBottom: 2,
  },
  selectedCustomerPhone: {
    fontSize: 12,
    color: '#66BB6A',
  },
  removeCustomerButton: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F44336',
  },
  removeCustomerButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F44336',
  },
  // Add Customer Dropdown Item Styles
  addCustomerDropdownItem: {
    padding: 14,
    backgroundColor: '#E8F5E9',
    borderTopWidth: 2,
    borderTopColor: '#4CAF50',
  },
  addCustomerDropdownContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    color: '#2E7D32',
  },
  addCustomerSubtitle: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 2,
  },
  // Add Customer Modal Styles
  addCustomerModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 600,
    maxHeight: '85%',
  },
  addCustomerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  addCustomerModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  addCustomerCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCustomerCloseButtonText: {
    fontSize: 20,
    color: '#666',
    fontWeight: 'bold',
  },
  addCustomerLoading: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCustomerLoadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  addCustomerForm: {
    flex: 1,
    marginBottom: 16,
  },
  addCustomerFormGroup: {
    marginBottom: 16,
  },
  addCustomerFormRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  addCustomerSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  addCustomerSwitchLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  addCustomerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  addCustomerInput: {
    backgroundColor: '#F9F9F9',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    color: '#333',
  },
  addCustomerDocumentBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  addCustomerDocumentText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    fontFamily: 'monospace',
  },
  addCustomerTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addCustomerTypeBadgeEmpresa: {
    backgroundColor: '#E3F2FD',
  },
  addCustomerTypeBadgePersona: {
    backgroundColor: '#F3E5F5',
  },
  addCustomerTypeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  addCustomerButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  addCustomerButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCustomerCancelButton: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  addCustomerCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  addCustomerSaveButton: {
    backgroundColor: '#4CAF50',
  },
  addCustomerSaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Offline Customer Styles
  offlineAddCustomerButton: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: '#FF9800',
    borderStyle: 'dashed',
  },
  offlineAddCustomerIcon: {
    fontSize: 24,
  },
  offlineAddCustomerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E65100',
  },
  offlineAddCustomerSubtext: {
    fontSize: 13,
    color: '#FF9800',
  },
  offlineCustomerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  offlineCustomerModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 450,
  },
  offlineCustomerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  offlineCustomerModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  offlineCustomerCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineCustomerCloseButtonText: {
    fontSize: 18,
    color: '#666',
  },
  offlineCustomerForm: {
    marginBottom: 20,
  },
  offlineCustomerFormGroup: {
    marginBottom: 18,
  },
  offlineCustomerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  offlineCustomerDocTypeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  offlineCustomerDocTypeButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
  },
  offlineCustomerDocTypeButtonActive: {
    borderColor: '#FF9800',
    backgroundColor: '#FFF3E0',
  },
  offlineCustomerDocTypeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  offlineCustomerDocTypeTextActive: {
    color: '#E65100',
  },
  offlineCustomerInput: {
    backgroundColor: '#F9F9F9',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    color: '#333',
  },
  offlineCustomerInfoBox: {
    backgroundColor: '#FFF8E1',
    borderRadius: 10,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  offlineCustomerInfoText: {
    fontSize: 13,
    color: '#E65100',
    lineHeight: 18,
  },
  offlineCustomerInfoSubtext: {
    fontSize: 12,
    color: '#FF9800',
    marginTop: 6,
    fontWeight: '600',
  },
  offlineCustomerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  offlineCustomerButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineCustomerCancelButton: {
    backgroundColor: '#F5F5F5',
  },
  offlineCustomerCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  offlineCustomerSaveButton: {
    backgroundColor: '#FF9800',
  },
  offlineCustomerSaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cartList: {
    flex: 1,
    marginBottom: 16,
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
    color: '#999',
    marginBottom: 8,
  },
  emptyCartSubtext: {
    fontSize: 14,
    color: '#BBB',
  },
  cartItem: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  cartItemRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  cartItemImage: {
    width: 60,
    height: 60,
    borderRadius: 6,
    backgroundColor: '#F5F5F5',
  },
  cartItemImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 6,
    backgroundColor: '#F5F5F5',
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
    marginRight: 8,
  },
  cartItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    lineHeight: 18,
  },
  cartItemSku: {
    fontSize: 11,
    color: '#999',
    marginTop: 1,
    lineHeight: 13,
  },
  removeButtonContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 6,
    padding: 6,
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
    gap: 8,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    minWidth: 30,
    textAlign: 'center',
  },
  quantityInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    width: 55,
    height: 32,
    textAlign: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 6,
    paddingHorizontal: 4,
  },
  cartItemPrice: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
    lineHeight: 16,
  },
  cartItemTotal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  totalsContainer: {
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    marginBottom: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
  },
  totalLabelBold: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  totalValueBold: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  discountValue: {
    color: '#F44336',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  clearButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
  },
  processButton: {
    backgroundColor: '#4CAF50',
  },
  processButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 48,
    width: '98%',
    maxWidth: 1400,
    maxHeight: '95%',
  },
  modalTitle: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 32,
    textAlign: 'center',
  },
  modalScrollContent: {
    flex: 1,
    marginBottom: 24,
  },
  modalTotal: {
    backgroundColor: '#F9F9F9',
    padding: 32,
    borderRadius: 16,
    marginBottom: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTotalLabel: {
    fontSize: 32,
    fontWeight: '600',
    color: '#666',
  },
  modalTotalValue: {
    fontSize: 52,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  paymentSelection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  methodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  methodButton: {
    flex: 1,
    minWidth: 200,
    padding: 28,
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    borderWidth: 4,
    borderColor: '#E0E0E0',
  },
  methodButtonSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  methodButtonText: {
    fontSize: 26,
    color: '#333',
    textAlign: 'center',
    fontWeight: '600',
  },
  methodButtonTextSelected: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  submethodContainer: {
    marginTop: 16,
  },
  izipayWarningBox: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FF9800',
    shadowColor: '#FF9800',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  izipayWarningIcon: {
    fontSize: 40,
    marginRight: 16,
  },
  izipayWarningContent: {
    flex: 1,
  },
  izipayWarningTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#E65100',
    marginBottom: 8,
  },
  izipayWarningText: {
    fontSize: 18,
    color: '#F57C00',
    lineHeight: 24,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 28,
  },
  amountInput: {
    flex: 1,
    padding: 28,
    fontSize: 32,
    borderWidth: 3,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    fontWeight: 'bold',
  },
  fillRemainingButton: {
    padding: 28,
    backgroundColor: '#2196F3',
    borderRadius: 16,
    minWidth: 180,
  },
  fillRemainingButtonText: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  addPaymentButton: {
    padding: 32,
    backgroundColor: '#4CAF50',
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 28,
  },
  addPaymentButtonText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  selectedPayments: {
    marginBottom: 28,
    backgroundColor: '#F9F9F9',
    padding: 24,
    borderRadius: 16,
  },
  selectedPaymentsTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
  },
  paymentInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginRight: 16,
  },
  paymentName: {
    fontSize: 24,
    color: '#333',
    fontWeight: '600',
    flex: 1,
  },
  paymentAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2196F3',
    marginLeft: 16,
  },
  removePaymentButton: {
    backgroundColor: '#FFEBEE',
    padding: 16,
    borderRadius: 12,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePaymentIcon: {
    fontSize: 32,
  },
  paymentSummary: {
    marginTop: 16,
    paddingTop: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 26,
    fontWeight: '600',
    color: '#666',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryValuePaid: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  summaryValueHighlight: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  summaryValueMissing: {
    color: '#F44336',
  },
  summaryValueChange: {
    color: '#4CAF50',
  },
  changeHighlightBox: {
    marginTop: 24,
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 4,
  },
  changeHighlightBoxMissing: {
    backgroundColor: '#FFEBEE',
    borderColor: '#F44336',
  },
  changeHighlightBoxChange: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  changeHighlightLabel: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 16,
    letterSpacing: 2,
  },
  changeHighlightValue: {
    fontSize: 64,
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 24,
  },
  modalCancelButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#E0E0E0',
    padding: 32,
  },
  modalCancelButtonText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#666',
  },
  modalConfirmButton: {
    backgroundColor: '#4CAF50',
    padding: 32,
  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  modalConfirmButtonText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  salesModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 700,
    maxHeight: '85%',
  },
  salesModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  salesSummary: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  salesList: {
    flex: 1,
    marginBottom: 16,
  },
  emptySales: {
    padding: 40,
    alignItems: 'center',
  },
  emptySalesText: {
    fontSize: 16,
    color: '#999',
  },
  saleItem: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  saleItemClickable: {
    padding: 16,
  },
  saleItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  saleNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saleNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  creditNoteBadge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  creditNoteBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  saleStatus: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  // Estilos para estados de venta
  statusDraft: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BDBDBD',
  },
  statusConfirmed: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#81C784',
  },
  statusDevParcial: {
    backgroundColor: '#FFF9C4',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFD54F',
  },
  statusDevTotal: {
    backgroundColor: '#FFECB3',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  statusInvoiced: {
    backgroundColor: '#E1F5FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4FC3F7',
  },
  statusPaid: {
    backgroundColor: '#C8E6C9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#66BB6A',
  },
  statusCancelled: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#EF5350',
  },
  statusRefunded: {
    backgroundColor: '#F3E5F5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BA68C8',
  },
  statusDefault: {
    backgroundColor: '#EEEEEE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BDBDBD',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#333',
  },
  saleItemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  saleDocType: {
    fontSize: 14,
    color: '#666',
  },
  saleTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  saleCustomer: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  salePaymentsContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  salePaymentsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  salePaymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  salePaymentMethod: {
    fontSize: 12,
    color: '#555',
    flex: 1,
  },
  salePaymentAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  salePaymentTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#D0D0D0',
    paddingHorizontal: 8,
  },
  salePaymentTotalLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
  },
  salePaymentTotalValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  saleItemCount: {
    fontSize: 12,
    color: '#666',
  },
  saleDate: {
    fontSize: 12,
    color: '#999',
  },
  saleItemActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  reprintButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  reprintButtonIcon: {
    fontSize: 18,
  },
  reprintButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  generateCreditNoteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF9800',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    borderLeftWidth: 1,
    borderLeftColor: '#FFFFFF',
  },
  generateCreditNoteButtonIcon: {
    fontSize: 18,
  },
  generateCreditNoteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  creditNoteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    borderLeftWidth: 1,
    borderLeftColor: '#FFFFFF',
  },
  creditNoteButtonIcon: {
    fontSize: 18,
  },
  creditNoteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeModalButton: {
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Pagination Styles
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 16,
  },
  paginationButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  paginationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  paginationButtonTextDisabled: {
    color: '#999999',
  },
  paginationInfo: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 16,
  },
  paginationText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  paginationSubtext: {
    fontSize: 14,
    color: '#666666',
  },
  // Success Modal Styles
  successModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 48,
    width: '95%',
    maxWidth: 1200,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  successHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  successIcon: {
    fontSize: 100,
    color: '#4CAF50',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  successDetails: {
    backgroundColor: '#F9F9F9',
    borderRadius: 16,
    padding: 32,
    marginBottom: 32,
  },
  successTotalBox: {
    backgroundColor: '#E3F2FD',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 3,
    borderColor: '#2196F3',
  },
  successTotalLabel: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 8,
    letterSpacing: 1,
  },
  successTotalValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#1565C0',
  },
  successChangeBox: {
    backgroundColor: '#E8F5E9',
    padding: 28,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 4,
    borderColor: '#4CAF50',
  },
  successChangeLabel: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 12,
    letterSpacing: 1,
  },
  successChangeValue: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#1B5E20',
  },
  successRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  successLabel: {
    fontSize: 20,
    color: '#666',
    fontWeight: '600',
  },
  successValue: {
    fontSize: 20,
    color: '#333',
    fontWeight: 'bold',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  successValueBold: {
    fontSize: 28,
    color: '#4CAF50',
    fontWeight: 'bold',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  successButtons: {
    flexDirection: 'row',
    gap: 20,
  },
  printButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    paddingVertical: 52,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  printButtonText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  newSaleButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 52,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newSaleButtonText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  // Offline Success Modal Styles
  offlineSuccessModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    width: '90%',
    maxWidth: 700,
    maxHeight: '95%',
    borderWidth: 3,
    borderColor: '#FF9800',
  },
  offlineSuccessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 12,
  },
  offlineSuccessIcon: {
    fontSize: 48,
  },
  offlineSuccessTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF9800',
  },
  offlineWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    borderWidth: 2,
    borderColor: '#FFC107',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  offlineWarningIcon: {
    fontSize: 32,
  },
  offlineWarningText: {
    flex: 1,
    fontSize: 14,
    color: '#856404',
    fontWeight: '600',
    lineHeight: 20,
  },
  offlineSuccessTotalBox: {
    backgroundColor: '#FFF8E1',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 3,
    borderColor: '#FF9800',
  },
  offlineTicketCode: {
    fontSize: 18,
    color: '#FF9800',
    fontWeight: 'bold',
    fontFamily: 'monospace',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  offlinePendingBadge: {
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  offlinePendingText: {
    fontSize: 14,
    color: '#856404',
    fontWeight: '600',
  },
  offlinePrintButton: {
    flex: 1,
    backgroundColor: '#FF9800',
    paddingVertical: 52,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Image Modal Styles
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
    right: 10,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalCloseText: {
    fontSize: 36,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  imageModalImage: {
    width: '100%',
    height: '100%',
  },
  // Credit Note Modal Styles
  creditNoteModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 600,
    maxHeight: '80%',
  },
  creditNoteModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  creditNoteSaleInfo: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  creditNoteSaleNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  creditNoteSaleTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  creditNoteTypeContainer: {
    marginBottom: 20,
  },
  creditNoteTypeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  creditNoteTypeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  creditNoteTypeButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  creditNoteTypeButtonActive: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  creditNoteTypeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  creditNoteTypeButtonTextActive: {
    color: '#2196F3',
  },
  creditNoteFieldContainer: {
    marginBottom: 20,
  },
  creditNoteFieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  creditNoteSelectContainer: {
    marginBottom: 8,
  },
  creditNoteSelect: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  creditNoteSelectText: {
    fontSize: 14,
    color: '#333',
  },
  creditNoteMotivoButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  creditNoteMotivoButton: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  creditNoteMotivoButtonActive: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  creditNoteMotivoButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  creditNoteMotivoButtonTextActive: {
    color: '#2196F3',
  },
  creditNoteSustentoInput: {
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  creditNoteCharCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  creditNoteProductsContainer: {
    marginBottom: 20,
  },
  creditNoteProductsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  creditNoteProductsList: {
    maxHeight: 300,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 8,
  },
  creditNoteProductItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  creditNoteProductItemSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  creditNoteProductCheckbox: {
    marginRight: 12,
  },
  creditNoteProductCheckboxIcon: {
    fontSize: 24,
    color: '#2196F3',
  },
  creditNoteProductInfo: {
    flex: 1,
  },
  creditNoteProductName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  creditNoteProductDetails: {
    fontSize: 12,
    color: '#666',
  },
  creditNoteProductTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  creditNoteLoadingContainer: {
    backgroundColor: '#FFF3E0',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  creditNoteLoadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F57C00',
    marginTop: 12,
  },
  creditNoteLoadingSubtext: {
    fontSize: 12,
    color: '#FF9800',
    marginTop: 4,
  },
  creditNoteActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  creditNoteCancelButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  creditNoteCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  creditNoteConfirmButton: {
    flex: 1,
    backgroundColor: '#FF9800',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  creditNoteConfirmButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  creditNoteButtonDisabled: {
    opacity: 0.5,
  },
  creditNoteConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // PinPad Modal Styles
  pinPadModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinPadModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  pinPadModalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  pinPadModalIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  pinPadModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  pinPadModalBody: {
    alignItems: 'center',
    width: '100%',
    paddingVertical: 16,
  },
  pinPadModalAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 16,
  },
  pinPadModalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  pinPadModalCloseButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 32,
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
  },
  pinPadModalCloseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
});
