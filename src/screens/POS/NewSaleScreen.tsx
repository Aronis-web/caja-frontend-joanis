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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { usePOSStore } from '@/store/pos';
import { posService } from '@/services/POSService';
import type { Product, Customer } from '@/types/pos';
import { ROUTES } from '@/constants/routes';

export default function NewSaleScreen() {
  const navigation = useNavigation();
  const {
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
  } = usePOSStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);

  const [documentType, setDocumentType] = useState<'03' | '01'>('03');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);

  useEffect(() => {
    if (!currentSession) {
      Alert.alert('Error', 'No hay sesión activa');
      navigation.goBack();
    }
  }, [currentSession]);

  const handleSearchProducts = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const results = await posService.searchProducts(query);
      setSearchResults(results.filter((p) => p.isActive && p.stock > 0));
    } catch (error) {
      console.error('Error searching products:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleAddProduct = (product: Product) => {
    addItemToCart(product, 1);
    setSearchQuery('');
    setSearchResults([]);
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

  const handleCompleteSale = async () => {
    const total = getCartTotal();
    const paymentsTotal = getPaymentsTotal();

    if (Math.abs(total - paymentsTotal) > 0.01) {
      Alert.alert('Error', 'El total de pagos no coincide con el total de la venta');
      return;
    }

    try {
      setShowPaymentModal(false);

      const result = await createSale(selectedCustomer?.id, documentType, 'Venta desde POS');

      Alert.alert(
        'Venta Procesada',
        `${result.message}\n\nEl documento se está generando en segundo plano.`,
        [
          {
            text: 'Ver Venta',
            onPress: () => {
              navigation.navigate(ROUTES.SALE_DETAIL as never, { saleId: result.saleId });
            },
          },
          {
            text: 'Nueva Venta',
            onPress: () => {
              clearCart();
              clearPayments();
              setSelectedCustomer(null);
              setDocumentType('03');
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo procesar la venta');
    }
  };

  const formatCurrency = (amount: number) => `S/ ${amount.toFixed(2)}`;

  const renderProductItem = ({ item }: { item: Product }) => (
    <TouchableOpacity style={styles.productItem} onPress={() => handleAddProduct(item)}>
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.productCode}>Código: {item.code}</Text>
        <Text style={styles.productStock}>Stock: {item.stock}</Text>
      </View>
      <Text style={styles.productPrice}>{formatCurrency(item.price)}</Text>
    </TouchableOpacity>
  );

  const renderCartItem = ({ item, index }: { item: any; index: number }) => {
    const itemTotal = item.quantity * item.unitPrice - (item.discount || 0);
    const itemTax = itemTotal * (item.taxRate / 100);
    const itemTotalWithTax = itemTotal + itemTax;

    return (
      <View style={styles.cartItem}>
        <View style={styles.cartItemHeader}>
          <Text style={styles.cartItemName}>{item.productName}</Text>
          <TouchableOpacity onPress={() => removeCartItem(index)}>
            <Text style={styles.removeButton}>✕</Text>
          </TouchableOpacity>
        </View>

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

          <Text style={styles.cartItemPrice}>{formatCurrency(item.unitPrice)} c/u</Text>
          <Text style={styles.cartItemTotal}>{formatCurrency(itemTotalWithTax)}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Nueva Venta</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
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

            <ScrollView style={styles.paymentMethodsList}>
              {paymentMethods
                .filter((pm) => pm.isActive)
                .map((method) => (
                  <TouchableOpacity
                    key={method.id}
                    style={styles.paymentMethodButton}
                    onPress={() => {
                      const remaining = getCartTotal() - getPaymentsTotal();
                      if (remaining > 0) {
                        addPaymentToCart(method.id, remaining);
                      }
                    }}
                  >
                    <Text style={styles.paymentMethodText}>{method.name}</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>

            {cartPayments.length > 0 && (
              <View style={styles.selectedPayments}>
                <Text style={styles.selectedPaymentsTitle}>Pagos:</Text>
                {cartPayments.map((payment, index) => (
                  <View key={index} style={styles.paymentRow}>
                    <Text style={styles.paymentName}>{payment.paymentMethodName}</Text>
                    <Text style={styles.paymentAmount}>{formatCurrency(payment.amount)}</Text>
                    <TouchableOpacity onPress={() => removeCartPayment(index)}>
                      <Text style={styles.removePaymentButton}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={styles.divider} />
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentTotalLabel}>Total Pagado:</Text>
                  <Text style={styles.paymentTotalValue}>{formatCurrency(getPaymentsTotal())}</Text>
                </View>
              </View>
            )}

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
                style={[styles.button, styles.modalConfirmButton]}
                onPress={handleCompleteSale}
                disabled={Math.abs(getCartTotal() - getPaymentsTotal()) > 0.01 || isLoading}
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
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  productInfo: {
    flex: 1,
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
  },
  productStock: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 2,
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
  cartItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  },
  cartItemTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
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
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalTotal: {
    backgroundColor: '#F9F9F9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalTotalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  paymentMethodsList: {
    maxHeight: 200,
    marginBottom: 16,
  },
  paymentMethodButton: {
    padding: 16,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    marginBottom: 8,
  },
  paymentMethodText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  selectedPayments: {
    marginBottom: 16,
  },
  selectedPaymentsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentName: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  paymentAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  removePaymentButton: {
    fontSize: 18,
    color: '#F44336',
    padding: 4,
  },
  paymentTotalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  paymentTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalConfirmButton: {
    backgroundColor: '#4CAF50',
  },
  modalConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
