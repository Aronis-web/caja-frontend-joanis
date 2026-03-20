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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { usePOSStore } from '@/store/pos';
import { posService } from '@/services/POSService';
import type { Product, Customer, CreateSaleResponse, ActiveSalesResponse } from '@/types/pos';
import { ROUTES } from '@/constants/routes';

export default function NewSaleScreen() {
  const navigation = useNavigation();
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

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);

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
  const [activeSalesData, setActiveSalesData] = useState<ActiveSalesResponse | null>(null);
  const [loadingSales, setLoadingSales] = useState(false);
  const [showSaleSuccessModal, setShowSaleSuccessModal] = useState(false);
  const [saleResponse, setSaleResponse] = useState<CreateSaleResponse | null>(null);
  const [saleChange, setSaleChange] = useState(0); // Vuelto de la venta

  // Payment method selection states
  const [selectedParentMethod, setSelectedParentMethod] = useState<string | null>(null);
  const [selectedSubmethod, setSelectedSubmethod] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  // Initialize store from AsyncStorage on mount
  useEffect(() => {
    const initialize = async () => {
      console.log('🔄 Inicializando store desde AsyncStorage...');
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
    };
    initialize();
  }, []);

  useEffect(() => {
    if (!currentSession) {
      // Si no hay sesión activa, redirigir a abrir sesión
      navigation.navigate(ROUTES.OPEN_SESSION as never);
    }
  }, [currentSession]);

  const handleSearchProducts = async (query: string) => {
    console.log('🔍 handleSearchProducts llamado con query:', query);
    setSearchQuery(query);
    if (query.length < 2) {
      console.log('⚠️ Query muy corto, limpiando resultados');
      setSearchResults([]);
      return;
    }

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
      setShowCustomerDropdown(response.data.length > 0);
    } catch (error) {
      console.error('❌ Error searching customers:', error);
      setCustomerSearchResults([]);
      setShowCustomerDropdown(false);
    } finally {
      setSearchingCustomers(false);
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

  const handleLoadRecentSales = async () => {
    if (!selectedCashRegister) return;

    try {
      setLoadingSales(true);
      console.log('📊 [VENTAS] Cargando ventas de la sesión...');
      console.log('📊 [VENTAS] Cash Register ID:', selectedCashRegister.id);

      const salesData = await posService.getActiveSales(selectedCashRegister.id);

      console.log('✅ [VENTAS] Respuesta del backend:', JSON.stringify(salesData, null, 2));
      console.log('📈 [VENTAS] Total de ventas:', salesData.sales?.length || 0);
      console.log('💰 [VENTAS] Total ventas (cents):', salesData.summary?.totalSalesCents || 0);
      console.log('💳 [VENTAS] Total pagos (cents):', salesData.summary?.totalPaymentsCents || 0);

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
    } catch (error) {
      console.error('❌ Error al procesar venta:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo procesar la venta');
    }
  };

  const handlePrintPDF = async () => {
    console.log('🔍 handlePrintPDF iniciado');
    console.log('📄 saleResponse:', saleResponse);

    if (!saleResponse?.pdf) {
      console.error('❌ No hay PDF disponible');
      Alert.alert('Error', 'No hay PDF disponible para imprimir');
      return;
    }

    try {
      const { base64, filename } = saleResponse.pdf;
      console.log('📦 PDF info:', { filename, base64Length: base64?.length });

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

        if (result.success && result.downloaded) {
          console.log('✅ PDF descargado y abierto');
          Alert.alert(
            'PDF Descargado',
            `El PDF se guardó en:\n${result.path}\n\nSe abrió automáticamente para que puedas imprimirlo.`,
            [{ text: 'OK' }]
          );
        } else {
          console.error('❌ Error al descargar PDF:', result.error);
          Alert.alert('Error', 'No se pudo descargar el PDF');
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

  const formatCurrency = (amount: number) => `S/ ${amount.toFixed(2)}`;

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

          {/* Información del producto */}
          <View style={styles.cartItemInfo}>
            <View style={styles.cartItemHeader}>
              <Text style={styles.cartItemName}>{item.productName}</Text>
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Nueva Venta</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.recentSalesButton}
            onPress={handleLoadRecentSales}
            disabled={loadingSales}
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
              placeholder="Buscar productos..."
              placeholderTextColor="#999"
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
        <View style={styles.rightPanel}>
          {/* Customer Search with Autocomplete */}
          <View style={styles.customerSearchContainer}>
            <View style={styles.customerSearchHeader}>
              <Text style={styles.customerSearchLabel}>
                {documentType === '01' ? '📄 Factura' : '🧾 Boleta'}
                {selectedCustomer &&
                  ` - ${selectedCustomer.customerType === 'EMPRESA' ? 'Empresa' : 'Persona'}`}
              </Text>
            </View>

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
                    <Text style={styles.selectedCustomerEmail}>📧 {selectedCustomer.email}</Text>
                  )}
                  {selectedCustomer.phone && (
                    <Text style={styles.selectedCustomerPhone}>📱 {selectedCustomer.phone}</Text>
                  )}
                </View>
                <TouchableOpacity onPress={handleClearCustomer} style={styles.removeCustomerButton}>
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
                {showCustomerDropdown && customerSearchResults.length > 0 && (
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
                    </ScrollView>
                  </View>
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
                    (!selectedParentMethod ||
                      !paymentAmount ||
                      parseFloat(paymentAmount) <= 0 ||
                      (paymentMethods.find((pm) => pm.id === selectedParentMethod)?.submethods &&
                        paymentMethods.find((pm) => pm.id === selectedParentMethod)!.submethods!
                          .length > 0 &&
                        !selectedSubmethod)) &&
                      styles.buttonDisabled,
                  ]}
                  onPress={() => {
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

                    // Si es IZIPAY, validar que no exceda el total de la venta
                    if (isIzipay && amount > total) {
                      Alert.alert(
                        'Error',
                        `El monto con tarjeta no puede exceder el total de la venta (S/ ${total.toFixed(
                          2
                        )})`
                      );
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
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Monto total:</Text>
                  <Text style={styles.summaryValue}>
                    {formatCurrency(activeSalesData.summary.totalSales)}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Pagos recibidos:</Text>
                  <Text style={styles.summaryValue}>
                    {formatCurrency(activeSalesData.summary.totalPayments)}
                  </Text>
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
                (() => {
                  // Agrupar transacciones por saleId
                  const salesMap = new Map<
                    string,
                    {
                      sale: any;
                      payments: Array<{ method: any; amount: number }>;
                    }
                  >();

                  activeSalesData.sales.forEach((transaction) => {
                    const saleId = transaction.saleId;
                    if (!salesMap.has(saleId)) {
                      salesMap.set(saleId, {
                        sale: transaction.sale,
                        payments: [],
                      });
                    }
                    salesMap.get(saleId)!.payments.push({
                      method: transaction.paymentMethod,
                      amount: transaction.amount,
                    });
                  });

                  // Convertir a array y renderizar
                  return Array.from(salesMap.entries()).map(([saleId, { sale, payments }]) => {
                    // Calcular total pagado
                    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

                    return (
                      <TouchableOpacity
                        key={saleId}
                        style={styles.saleItem}
                        onPress={() => {
                          setShowRecentSales(false);
                          // @ts-expect-error - Navigation types
                          navigation.navigate(ROUTES.SALE_DETAIL, { saleId });
                        }}
                      >
                        <View style={styles.saleItemHeader}>
                          <Text style={styles.saleNumber}>
                            {sale.code} - #{sale.saleNumber}
                          </Text>
                          <Text style={styles.saleStatus}>
                            {sale.status === 'CONFIRMED'
                              ? '✓ Confirmada'
                              : sale.status === 'PROCESSING'
                                ? '⏳ Procesando'
                                : sale.status === 'PENDING'
                                  ? '⏸ Pendiente'
                                  : sale.status === 'REJECTED'
                                    ? '✗ Rechazada'
                                    : '✗ Cancelada'}
                          </Text>
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
                        {payments && payments.length > 0 && (
                          <View style={styles.salePaymentsContainer}>
                            <Text style={styles.salePaymentsTitle}>💳 Métodos de Pago:</Text>
                            {payments.map((payment, index) => (
                              <View key={index} style={styles.salePaymentRow}>
                                <Text style={styles.salePaymentMethod}>
                                  • {payment.method.name}
                                </Text>
                                <Text style={styles.salePaymentAmount}>
                                  {formatCurrency(payment.amount)}
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
                    );
                  });
                })()
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setShowRecentSales(false)}
            >
              <Text style={styles.closeModalButtonText}>Cerrar</Text>
            </TouchableOpacity>
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
    width: 650,
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
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  cartItemRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cartItemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  cartItemImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartItemImagePlaceholderText: {
    fontSize: 32,
  },
  cartItemInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cartItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  removeButtonContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButton: {
    fontSize: 28,
  },
  cartItemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
    width: 60,
    height: 36,
    textAlign: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 6,
    paddingHorizontal: 4,
  },
  cartItemPrice: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  cartItemTotal: {
    fontSize: 14,
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
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#666',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
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
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  saleItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  saleNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  saleStatus: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  status_completed: {
    backgroundColor: '#E8F5E9',
    color: '#4CAF50',
  },
  status_processing: {
    backgroundColor: '#FFF3E0',
    color: '#FF9800',
  },
  status_pending: {
    backgroundColor: '#E3F2FD',
    color: '#2196F3',
  },
  status_rejected: {
    backgroundColor: '#FFEBEE',
    color: '#F44336',
  },
  status_cancelled: {
    backgroundColor: '#F5F5F5',
    color: '#9E9E9E',
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
});
