/**
 * Open Session Screen
 * Allows user to open a new cash register session
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
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@/store/auth';
import { usePOSStore } from '@/store/pos';
import { ROUTES } from '@/constants/routes';

export default function OpenSessionScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((state) => state.user);
  const { selectedCashRegister, openSession, isLoading } = usePOSStore();

  const [openingBalance, setOpeningBalance] = useState('');
  const [notes, setNotes] = useState('');

  const handleOpenSession = async () => {
    if (!selectedCashRegister || !user) {
      Alert.alert('Error', 'Información de caja o usuario no disponible');
      return;
    }

    const balance = parseFloat(openingBalance);
    if (isNaN(balance) || balance < 0) {
      Alert.alert('Error', 'El balance de apertura debe ser un número válido mayor o igual a 0');
      return;
    }

    Alert.alert(
      'Confirmar Apertura',
      `¿Está seguro de abrir la caja con un balance inicial de S/ ${balance.toFixed(2)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Abrir Caja',
          onPress: async () => {
            try {
              await openSession(
                selectedCashRegister.id,
                user.id,
                balance,
                notes || `Apertura de caja - ${new Date().toLocaleDateString('es-PE')}`
              );

              Alert.alert('Éxito', 'La caja ha sido abierta exitosamente', [
                {
                  text: 'OK',
                  onPress: () => navigation.navigate(ROUTES.POS_DASHBOARD as never),
                },
              ]);
            } catch (error) {
              Alert.alert(
                'Error',
                error instanceof Error ? error.message : 'No se pudo abrir la sesión'
              );
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Abrir Caja</Text>
        <Text style={styles.subtitle}>{selectedCashRegister?.name}</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Usuario:</Text>
          <Text style={styles.infoValue}>{user?.name}</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Fecha y Hora:</Text>
          <Text style={styles.infoValue}>
            {new Date().toLocaleString('es-PE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Balance de Apertura <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.currencyInput}>
            <Text style={styles.currencySymbol}>S/</Text>
            <TextInput
              style={styles.input}
              value={openingBalance}
              onChangeText={setOpeningBalance}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#999"
            />
          </View>
          <Text style={styles.hint}>Ingrese el monto en efectivo con el que inicia la caja</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Notas (Opcional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Ej: Apertura turno mañana"
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
          />
        </View>

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
            onPress={handleOpenSession}
            disabled={isLoading || !openingBalance}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Abrir Caja</Text>
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
  infoCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
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
    backgroundColor: '#007AFF',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
