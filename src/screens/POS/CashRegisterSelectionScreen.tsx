/**
 * Cash Register Selection Screen
 * Allows user to select a cash register after company and site selection
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@/store/auth';
import { usePOSStore } from '@/store/pos';
import type { CashRegister } from '@/types/pos';
import { ROUTES } from '@/constants/routes';

export default function CashRegisterSelectionScreen() {
  const navigation = useNavigation();
  const currentSite = useAuthStore((state) => state.currentSite);
  const currentCompany = useAuthStore((state) => state.currentCompany);
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
  const [loading, setLoading] = useState(true);

  const { loadCashRegistersBySite, setSelectedCashRegister, loadPaymentMethods } = usePOSStore();

  useEffect(() => {
    loadCashRegisters();
    loadPaymentMethods();
  }, []);

  const loadCashRegisters = async () => {
    if (!currentSite) {
      Alert.alert('Error', 'No se ha seleccionado una sede');
      return;
    }

    try {
      setLoading(true);
      const registers = await loadCashRegistersBySite(currentSite.id);
      // Filter by status === 'ACTIVE' (API returns status, not isActive)
      setCashRegisters(registers.filter((r) => r.status === 'ACTIVE'));
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar las cajas registradoras');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCashRegister = async (cashRegister: CashRegister) => {
    try {
      await setSelectedCashRegister(cashRegister);
      navigation.navigate(ROUTES.POS_DASHBOARD as never);
    } catch (error) {
      Alert.alert('Error', 'No se pudo seleccionar la caja');
    }
  };

  const renderCashRegister = ({ item }: { item: CashRegister }) => (
    <TouchableOpacity style={styles.card} onPress={() => handleSelectCashRegister(item)}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <View
          style={[
            styles.statusBadge,
            item.currentSessionId ? styles.statusOpen : styles.statusClosed,
          ]}
        >
          <Text style={styles.statusText}>{item.currentSessionId ? 'ABIERTA' : 'CERRADA'}</Text>
        </View>
      </View>
      <Text style={styles.cardCode}>Código: {item.code}</Text>
      {item.emissionPoint && (
        <Text style={styles.cardDetail}>
          Punto de Emisión: {item.emissionPoint.code} - {item.emissionPoint.description}
        </Text>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando cajas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Seleccionar Caja</Text>
        <Text style={styles.subtitle}>{currentCompany?.name}</Text>
        <Text style={styles.subtitle}>{currentSite?.name}</Text>
      </View>

      {cashRegisters.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No hay cajas registradoras disponibles</Text>
          <Text style={styles.emptySubtext}>
            Contacte al administrador para configurar una caja
          </Text>
        </View>
      ) : (
        <FlatList
          data={cashRegisters}
          renderItem={renderCashRegister}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  listContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusOpen: {
    backgroundColor: '#4CAF50',
  },
  statusClosed: {
    backgroundColor: '#9E9E9E',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  cardCode: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  cardDetail: {
    fontSize: 13,
    color: '#888',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
