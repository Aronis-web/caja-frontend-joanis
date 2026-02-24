/**
 * Cash Transaction Screen
 * Handles cash in and cash out transactions
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { usePOSStore } from '@/store/pos';
import { posService } from '@/services/POSService';

type RouteParams = {
  CashTransaction: {
    type: 'cash_in' | 'cash_out';
  };
};

export default function CashTransactionScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'CashTransaction'>>();
  const { currentSession, refreshSession } = usePOSStore();

  const transactionType = route.params?.type || 'cash_in';
  const isCashIn = transactionType === 'cash_in';

  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!currentSession) {
      Alert.alert('Error', 'No hay sesión activa');
      return;
    }

    const transactionAmount = parseFloat(amount);
    if (isNaN(transactionAmount) || transactionAmount <= 0) {
      Alert.alert('Error', 'El monto debe ser un número válido mayor a 0');
      return;
    }

    if (!reason.trim()) {
      Alert.alert('Error', 'Debe ingresar un motivo para la transacción');
      return;
    }

    const actionText = isCashIn ? 'ingreso' : 'retiro';
    Alert.alert(
      'Confirmar Transacción',
      `¿Está seguro de registrar un ${actionText} de S/ ${transactionAmount.toFixed(2)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              setIsLoading(true);

              const transactionData = {
                sessionId: currentSession.id,
                amount: transactionAmount,
                reason: reason.trim(),
                notes: notes.trim() || undefined,
              };

              if (isCashIn) {
                await posService.cashIn(transactionData);
              } else {
                await posService.cashOut(transactionData);
              }

              // Refresh session to update balance
              await refreshSession();

              Alert.alert('Éxito', `${isCashIn ? 'Ingreso' : 'Retiro'} registrado exitosamente`, [
                {
                  text: 'OK',
                  onPress: () => navigation.goBack(),
                },
              ]);
            } catch (error) {
              Alert.alert(
                'Error',
                error instanceof Error ? error.message : 'No se pudo registrar la transacción'
              );
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const formatCurrency = (value: number) => `S/ ${value.toFixed(2)}`;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {isCashIn ? '💵 Ingreso de Efectivo' : '💸 Retiro de Efectivo'}
        </Text>
        <Text style={styles.subtitle}>
          Balance actual: {formatCurrency(currentSession?.currentBalance || 0)}
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Monto <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.currencyInput}>
            <Text style={styles.currencySymbol}>S/</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#999"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Motivo <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={reason}
            onChangeText={setReason}
            placeholder={isCashIn ? 'Ej: Cambio de billetes grandes' : 'Ej: Depósito bancario'}
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Notas (Opcional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder={
              isCashIn
                ? 'Ej: Cambio de billete de 500 soles'
                : 'Ej: Depósito en Banco BCP - Cuenta 123456789'
            }
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Preview */}
        {amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && (
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>Vista Previa</Text>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Balance actual:</Text>
              <Text style={styles.previewValue}>
                {formatCurrency(currentSession?.currentBalance || 0)}
              </Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>{isCashIn ? 'Ingreso:' : 'Retiro:'}</Text>
              <Text
                style={[
                  styles.previewValue,
                  isCashIn ? styles.positiveValue : styles.negativeValue,
                ]}
              >
                {isCashIn ? '+' : '-'} {formatCurrency(parseFloat(amount))}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.previewRow}>
              <Text style={styles.previewLabelBold}>Nuevo balance:</Text>
              <Text style={styles.previewValueBold}>
                {formatCurrency(
                  (currentSession?.currentBalance || 0) +
                    (isCashIn ? parseFloat(amount) : -parseFloat(amount))
                )}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={() => navigation.goBack()}
            disabled={isLoading}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, isCashIn ? styles.submitButtonIn : styles.submitButtonOut]}
            onPress={handleSubmit}
            disabled={isLoading || !amount || !reason}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>
                {isCashIn ? 'Registrar Ingreso' : 'Registrar Retiro'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  form: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: '#F44336',
  },
  currencyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    paddingLeft: 16,
    paddingRight: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewLabel: {
    fontSize: 14,
    color: '#666',
  },
  previewLabelBold: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  previewValueBold: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  positiveValue: {
    color: '#4CAF50',
  },
  negativeValue: {
    color: '#F44336',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  submitButtonIn: {
    backgroundColor: '#4CAF50',
  },
  submitButtonOut: {
    backgroundColor: '#FF9800',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
