/**
 * Close Session Screen
 * Allows user to close the current cash register session
 */

import React, { useState, useEffect } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { usePOSStore } from '@/store/pos';
import { posService } from '@/services/POSService';
import { ROUTES } from '@/constants/routes';
import type { Session } from '@/types/pos';

export default function CloseSessionScreen() {
  const navigation = useNavigation();
  const { currentSession, closeSession, isLoading } = usePOSStore();

  const [closingBalance, setClosingBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [summary, setSummary] = useState<Session | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    if (!currentSession) return;

    try {
      setLoadingSummary(true);
      const sessionSummary = await posService.getSessionSummary(currentSession.id);
      setSummary(sessionSummary);
    } catch (error) {
      Alert.alert('Error', 'No se pudo cargar el resumen de la sesión');
    } finally {
      setLoadingSummary(false);
    }
  };

  const calculateDifference = () => {
    const balance = parseFloat(closingBalance);
    if (isNaN(balance) || !summary?.summary) return 0;
    return balance - summary.summary.expectedBalance;
  };

  const handleCloseSession = async () => {
    if (!currentSession) {
      Alert.alert('Error', 'No hay sesión activa');
      return;
    }

    const balance = parseFloat(closingBalance);
    if (isNaN(balance) || balance < 0) {
      Alert.alert('Error', 'El balance de cierre debe ser un número válido mayor o igual a 0');
      return;
    }

    const difference = calculateDifference();
    const differenceText =
      difference !== 0 ? `\n\nDiferencia: S/ ${difference.toFixed(2)}` : '\n\nSin diferencias';

    Alert.alert(
      'Confirmar Cierre',
      `¿Está seguro de cerrar la caja?\n\n` +
        `Balance esperado: S/ ${summary?.summary?.expectedBalance.toFixed(2) || '0.00'}\n` +
        `Balance contado: S/ ${balance.toFixed(2)}` +
        differenceText,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Caja',
          style: difference !== 0 ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const finalNotes =
                notes ||
                (difference !== 0
                  ? `Diferencia de S/ ${difference.toFixed(2)}`
                  : 'Cierre sin diferencias');

              await closeSession(currentSession.id, balance, finalNotes);

              Alert.alert('Éxito', 'La caja ha sido cerrada exitosamente', [
                {
                  text: 'OK',
                  onPress: () => navigation.navigate(ROUTES.POS_DASHBOARD as never),
                },
              ]);
            } catch (error) {
              Alert.alert(
                'Error',
                error instanceof Error ? error.message : 'No se pudo cerrar la sesión'
              );
            }
          },
        },
      ]
    );
  };

  if (loadingSummary) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando resumen...</Text>
      </View>
    );
  }

  const formatCurrency = (amount: number) => `S/ ${amount.toFixed(2)}`;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Cerrar Caja</Text>
        <Text style={styles.subtitle}>Resumen del Día</Text>
      </View>

      <View style={styles.form}>
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Resumen de Movimientos</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Balance Inicial:</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(summary?.summary?.openingBalance || 0)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>+ Ventas:</Text>
            <Text style={[styles.summaryValue, styles.positiveValue]}>
              {formatCurrency(summary?.summary?.sales || 0)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>+ Ingresos:</Text>
            <Text style={[styles.summaryValue, styles.positiveValue]}>
              {formatCurrency(summary?.summary?.cashIn || 0)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>- Retiros:</Text>
            <Text style={[styles.summaryValue, styles.negativeValue]}>
              {formatCurrency(summary?.summary?.cashOut || 0)}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabelBold}>Balance Esperado:</Text>
            <Text style={styles.summaryValueBold}>
              {formatCurrency(summary?.summary?.expectedBalance || 0)}
            </Text>
          </View>
        </View>

        {/* Closing Balance Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Balance Contado <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.currencyInput}>
            <Text style={styles.currencySymbol}>S/</Text>
            <TextInput
              style={styles.input}
              value={closingBalance}
              onChangeText={setClosingBalance}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#999"
            />
          </View>
          <Text style={styles.hint}>Ingrese el monto total en efectivo que hay en la caja</Text>
        </View>

        {/* Difference Display */}
        {closingBalance && !isNaN(parseFloat(closingBalance)) && (
          <View
            style={[
              styles.differenceCard,
              calculateDifference() === 0
                ? styles.differenceZero
                : calculateDifference() > 0
                  ? styles.differencePositive
                  : styles.differenceNegative,
            ]}
          >
            <Text style={styles.differenceLabel}>Diferencia:</Text>
            <Text style={styles.differenceValue}>{formatCurrency(calculateDifference())}</Text>
          </View>
        )}

        {/* Notes Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Notas (Opcional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Observaciones del cierre..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={() => navigation.goBack()}
            disabled={isLoading}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.submitButton]}
            onPress={handleCloseSession}
            disabled={isLoading || !closingBalance}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Cerrar Caja</Text>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
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
  summaryCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 15,
    color: '#666',
  },
  summaryLabelBold: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  summaryValueBold: {
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
    marginVertical: 12,
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
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    height: 80,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  differenceCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  differenceZero: {
    backgroundColor: '#E8F5E9',
  },
  differencePositive: {
    backgroundColor: '#FFF3E0',
  },
  differenceNegative: {
    backgroundColor: '#FFEBEE',
  },
  differenceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  differenceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
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
  submitButton: {
    backgroundColor: '#F44336',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
