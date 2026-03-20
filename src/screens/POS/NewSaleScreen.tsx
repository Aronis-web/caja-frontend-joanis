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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { usePOSStore } from '@/store/pos';
import { posService } from '@/services/POSService';
import type { Product, Customer, CreateSaleResponse } from '@/types/pos';
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
  const [recentSales, setRecentSales] = useState<any[]>([]);
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
    if (!currentSession) return;

    try {
      setLoadingSales(true);
      const sales = await posService.getRecentSales(currentSession.id, 20);
      setRecentSales(sales);
      setShowRecentSales(true);
    } catch (error) {
      console.error('Error loading recent sales:', error);
      Alert.alert('Error', 'No se pudieron cargar las ventas recientes');
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
              <TouchableOpacity onPress={() => removeCartItem(index)}>
                <Text style={styles.removeButton}>✕</Text>
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
                <Text style={styles.quantityText}>{item.quantity}</Text>
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
          {/* Document Type Selection */}
          <View style={styles.documentTypeContainer}>
            <TouchableOpacity
              style={[
                styles.documentTypeButton,
                documentType === '03' && styles.documentTypeActive,
              ]}
              onPress={() => setDocumentType('03')}
            >
              <Text
                style={[
                  styles.documentTypeText,
                  documentType === '03' && styles.documentTypeTextActive,
                ]}
              >
                Boleta
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.documentTypeButton,
                documentType === '01' && styles.documentTypeActive,
              ]}
              onPress={() => setDocumentType('01')}
            >
              <Text
                style={[
                  styles.documentTypeText,
                  documentType === '01' && styles.documentTypeTextActive,
                ]}
              >
                Factura
              </Text>
            </TouchableOpacity>
          </View>

          {/* Customer Selection (for Factura) */}
          {documentType === '01' && (
            <TouchableOpacity
              style={styles.customerButton}
              onPress={() => setShowCustomerSearch(true)}
            >
              <Text style={styles.customerButtonText}>
                {selectedCustomer
                  ? `${selectedCustomer.name} - ${selectedCustomer.documentNumber}`
                  : '+ Seleccionar Cliente'}
              </Text>
            </TouchableOpacity>
          )}

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
                setSelectedCustomer(null);
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
              <Text style={styles.modalTitle}>Últimas Ventas</Text>
              <TouchableOpacity onPress={() => setShowRecentSales(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.salesList}>
              {recentSales.length === 0 ? (
                <View style={styles.emptySales}>
                  <Text style={styles.emptySalesText}>No hay ventas registradas</Text>
                </View>
              ) : (
                recentSales.map((sale) => (
                  <TouchableOpacity
                    key={sale.id}
                    style={styles.saleItem}
                    onPress={() => {
                      setShowRecentSales(false);
                      // @ts-expect-error - Navigation types
                      navigation.navigate(ROUTES.SALE_DETAIL, { saleId: sale.id });
                    }}
                  >
                    <View style={styles.saleItemHeader}>
                      <Text style={styles.saleNumber}>{sale.saleNumber}</Text>
                      <Text style={styles.saleStatus}>
                        {sale.status === 'completed'
                          ? '✓ Completada'
                          : sale.status === 'processing'
                            ? '⏳ Procesando'
                            : sale.status === 'pending'
                              ? '⏸ Pendiente'
                              : sale.status === 'rejected'
                                ? '✗ Rechazada'
                                : '✗ Cancelada'}
                      </Text>
                    </View>
                    <View style={styles.saleItemDetails}>
                      <Text style={styles.saleDocType}>
                        {sale.documentType === '01' ? 'Factura' : 'Boleta'}
                        {sale.documentNumber ? ` - ${sale.documentNumber}` : ''}
                      </Text>
                      <Text style={styles.saleTotal}>{formatCurrency(sale.total)}</Text>
                    </View>
                    {sale.customer && (
                      <Text style={styles.saleCustomer}>Cliente: {sale.customer.name}</Text>
                    )}
                    <Text style={styles.saleDate}>
                      {new Date(sale.createdAt).toLocaleString('es-PE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.button, styles.closeModalButton]}
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

                <View style={styles.divider} />

                <Text style={styles.successMessage}>{saleResponse.document.message}</Text>

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
    width: 400,
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
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
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
  documentTypeContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  documentTypeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  documentTypeActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  documentTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  documentTypeTextActive: {
    color: '#FFFFFF',
  },
  customerButton: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 12,
  },
  customerButtonText: {
    fontSize: 14,
    color: '#007AFF',
    textAlign: 'center',
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
  removeButton: {
    fontSize: 20,
    color: '#F44336',
    padding: 4,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  totalValueBold: {
    fontSize: 22,
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
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  processButton: {
    backgroundColor: '#4CAF50',
  },
  processButtonText: {
    fontSize: 16,
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
  successMessage: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginVertical: 16,
    fontStyle: 'italic',
  },
  successButtons: {
    flexDirection: 'row',
    gap: 20,
  },
  printButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    paddingVertical: 36,
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
    paddingVertical: 36,
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
