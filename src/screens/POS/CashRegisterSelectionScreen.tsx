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
  const user = useAuthStore((state) => state.user);
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
  const [loading, setLoading] = useState(true);

  const { loadCashRegistersBySite, setSelectedCashRegister, loadPaymentMethods } = usePOSStore();

  // Verificar si el usuario ya tiene una caja activa
  const userActiveCashRegister = cashRegisters.find(
    (cr) => cr.currentSessionId && cr.currentUserId === user?.id
  );

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

  // Verifica si la caja está abierta por otra persona
  const isOpenByOtherUser = (cashRegister: CashRegister): boolean => {
    return !!(
      cashRegister.currentSessionId &&
      cashRegister.currentUserId &&
      cashRegister.currentUserId !== user?.id
    );
  };

  // Verifica si el usuario tiene otra caja activa (diferente a esta)
  const userHasAnotherActiveCashRegister = (cashRegister: CashRegister): boolean => {
    return !!(userActiveCashRegister && userActiveCashRegister.id !== cashRegister.id);
  };

  const handleSelectCashRegister = async (cashRegister: CashRegister) => {
    // Validar si la caja está abierta por otra persona
    if (isOpenByOtherUser(cashRegister)) {
      Alert.alert(
        'Caja no disponible',
        'Esta caja está siendo utilizada por otro usuario. Solo puedes acceder a cajas cerradas o que hayas abierto tú mismo.'
      );
      return;
    }

    // Validar si el usuario ya tiene otra caja activa
    if (userHasAnotherActiveCashRegister(cashRegister)) {
      Alert.alert(
        'Ya tienes una caja activa',
        `Debes cerrar tu sesión en "${userActiveCashRegister?.name}" antes de poder acceder a otra caja.`
      );
      return;
    }

    try {
      await setSelectedCashRegister(cashRegister);
      // Navegar explícitamente al dashboard para evitar arrastrar una ruta previa (ej. NewSale)
      navigation.navigate(ROUTES.POS_DASHBOARD as never);
    } catch (error) {
      Alert.alert('Error', 'No se pudo seleccionar la caja');
    }
  };

  const renderCashRegister = ({ item }: { item: CashRegister }) => {
    const blockedByOther = isOpenByOtherUser(item);
    const blockedByActiveSession = userHasAnotherActiveCashRegister(item);
    const isOpenByMe = item.currentSessionId && item.currentUserId === user?.id;
    const isBlocked = blockedByOther || blockedByActiveSession;

    // Determinar el estado visual de la caja
    const getStatusStyle = () => {
      if (blockedByOther) return styles.statusBlocked;
      if (blockedByActiveSession) return styles.statusBlocked;
      if (isOpenByMe) return styles.statusOpenByMe;
      if (item.currentSessionId) return styles.statusOpen;
      return styles.statusClosed;
    };

    const getStatusText = () => {
      if (blockedByOther) return 'OCUPADA';
      if (isOpenByMe) return 'MI CAJA';
      if (item.currentSessionId) return 'ABIERTA';
      return 'CERRADA';
    };

    const getBlockedMessage = () => {
      if (blockedByOther) return '🔒 En uso por otro usuario';
      if (blockedByActiveSession) return '⚠️ Ya tienes otra caja activa';
      return null;
    };

    return (
      <TouchableOpacity
        style={[styles.card, isBlocked && styles.cardBlocked]}
        onPress={() => handleSelectCashRegister(item)}
        disabled={isBlocked}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, isBlocked && styles.cardTitleBlocked]}>{item.name}</Text>
          <View style={[styles.statusBadge, getStatusStyle()]}>
            <Text style={styles.statusText}>{getStatusText()}</Text>
          </View>
        </View>
        <Text style={[styles.cardCode, isBlocked && styles.cardTextBlocked]}>
          Código: {item.code}
        </Text>
        {item.emissionPoint && (
          <Text style={[styles.cardDetail, isBlocked && styles.cardTextBlocked]}>
            Punto de Emisión: {item.emissionPoint.code} - {item.emissionPoint.description}
          </Text>
        )}
        {getBlockedMessage() && <Text style={styles.blockedMessage}>{getBlockedMessage()}</Text>}
      </TouchableOpacity>
    );
  };

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
  statusOpenByMe: {
    backgroundColor: '#2196F3',
  },
  statusBlocked: {
    backgroundColor: '#F44336',
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
  cardBlocked: {
    backgroundColor: '#F5F5F5',
    opacity: 0.8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cardTitleBlocked: {
    color: '#999',
  },
  cardTextBlocked: {
    color: '#AAA',
  },
  blockedMessage: {
    marginTop: 8,
    fontSize: 13,
    color: '#F44336',
    fontWeight: '500',
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
