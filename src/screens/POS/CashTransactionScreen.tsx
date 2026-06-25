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
import { cashCentsToSoles } from '@/utils/posMappers';
import { useTheme, useThemedStyles, type Theme } from '@/design-system';

type RouteParams = {
  CashTransaction: {
    type: 'cash_in' | 'cash_out';
  };
};

export default function CashTransactionScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'CashTransaction'>>();
  const { currentSession, refreshSession } = usePOSStore();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

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
          Balance actual: {formatCurrency(cashCentsToSoles(currentSession?.currentCashCents))}
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
              placeholderTextColor={theme.color.text.placeholder}
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
            placeholderTextColor={theme.color.text.placeholder}
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
            placeholderTextColor={theme.color.text.placeholder}
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
                {formatCurrency(cashCentsToSoles(currentSession?.currentCashCents))}
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
                  cashCentsToSoles(currentSession?.currentCashCents) +
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
              <ActivityIndicator color={theme.color.text.onAction} />
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    header: {
      backgroundColor: theme.color.surface.base,
      padding: theme.space[5],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    subtitle: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
    form: {
      padding: theme.space[4],
    },
    inputGroup: {
      marginBottom: theme.space[5],
    },
    label: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[2],
    },
    required: {
      color: theme.color.text.danger,
    },
    currencyInput: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    currencySymbol: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.color.text.heading,
      paddingLeft: theme.space[4],
      paddingRight: theme.space[2],
    },
    input: {
      flex: 1,
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.md,
      padding: theme.space[3.5],
      fontSize: 16,
      color: theme.color.text.heading,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    textArea: {
      height: 80,
      textAlignVertical: 'top',
    },
    previewCard: {
      backgroundColor: theme.color.surface.base,
      padding: theme.space[4],
      borderRadius: theme.radii.md,
      marginBottom: theme.space[5],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    previewTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[3],
    },
    previewRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[2],
    },
    previewLabel: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
    previewLabelBold: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    previewValue: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.color.text.heading,
    },
    previewValueBold: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.color.text.heading,
    },
    positiveValue: {
      color: theme.color.action.success.background,
    },
    negativeValue: {
      color: theme.color.action.danger.background,
    },
    divider: {
      height: 1,
      backgroundColor: theme.color.border.subtle,
      marginVertical: theme.space[2],
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: theme.space[3],
      marginTop: theme.space[6],
    },
    button: {
      flex: 1,
      padding: theme.space[4],
      borderRadius: theme.radii.md,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: theme.color.surface.base,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    submitButtonIn: {
      backgroundColor: theme.color.action.success.background,
    },
    submitButtonOut: {
      backgroundColor: theme.color.icon.warning,
    },
    submitButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
  });
