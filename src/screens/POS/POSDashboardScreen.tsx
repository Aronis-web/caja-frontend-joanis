/**
 * POS Dashboard Screen
 * Main POS interface showing session status and action buttons
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@/store/auth';
import { usePOSStore } from '@/store/pos';
import { ROUTES } from '@/constants/routes';

export default function POSDashboardScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((state) => state.user);
  const { selectedCashRegister, currentSession, refreshSession, isLoading } = usePOSStore();

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!selectedCashRegister) {
      navigation.navigate(ROUTES.CASH_REGISTER_SELECTION as never);
      return;
    }

    // Refresh session every 30 seconds
    const interval = setInterval(() => {
      refreshSession();
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedCashRegister]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshSession();
    setRefreshing(false);
  };

  const handleOpenSession = () => {
    navigation.navigate(ROUTES.OPEN_SESSION as never);
  };

  const handleNewSale = () => {
    if (!currentSession) {
      Alert.alert('Error', 'No hay sesión activa. Por favor, abra una sesión primero.');
      return;
    }
    navigation.navigate(ROUTES.NEW_SALE as never);
  };

  const handleCashIn = () => {
    if (!currentSession) {
      Alert.alert('Error', 'No hay sesión activa');
      return;
    }
    navigation.navigate(ROUTES.CASH_TRANSACTION as never, { type: 'cash_in' });
  };

  const handleCashOut = () => {
    if (!currentSession) {
      Alert.alert('Error', 'No hay sesión activa');
      return;
    }
    navigation.navigate(ROUTES.CASH_TRANSACTION as never, { type: 'cash_out' });
  };

  const handleCloseSession = () => {
    if (!currentSession) {
      Alert.alert('Error', 'No hay sesión activa');
      return;
    }
    navigation.navigate(ROUTES.CLOSE_SESSION as never);
  };

  const formatCurrency = (amount: number) => {
    return `S/ ${amount.toFixed(2)}`;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{selectedCashRegister?.name}</Text>
        <View
          style={[styles.statusBadge, currentSession ? styles.statusOpen : styles.statusClosed]}
        >
          <Text style={styles.statusText}>{currentSession ? 'ABIERTA' : 'CERRADA'}</Text>
        </View>
      </View>

      {/* Session Info */}
      {currentSession ? (
        <View style={styles.sessionCard}>
          <Text style={styles.sectionTitle}>Información de Sesión</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Balance Actual:</Text>
            <Text style={styles.infoValueHighlight}>
              {formatCurrency(currentSession.currentBalance)}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Ventas del día:</Text>
            <Text style={styles.infoValue}>{formatCurrency(currentSession.totalSales || 0)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Transacciones:</Text>
            <Text style={styles.infoValue}>{currentSession.totalTransactions || 0}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Abierta por:</Text>
            <Text style={styles.infoValue}>{currentSession.user?.name || user?.name}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Hora apertura:</Text>
            <Text style={styles.infoValue}>{formatDateTime(currentSession.openedAt)}</Text>
          </View>

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
            disabled={refreshing}
          >
            <Text style={styles.refreshButtonText}>
              {refreshing ? 'Actualizando...' : '🔄 Actualizar'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.noSessionCard}>
          <Text style={styles.noSessionTitle}>No hay sesión activa</Text>
          <Text style={styles.noSessionText}>Debe abrir una sesión para comenzar a operar</Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {!currentSession ? (
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={handleOpenSession}
          >
            <Text style={styles.actionButtonIcon}>🔓</Text>
            <Text style={styles.actionButtonText}>Abrir Caja</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.saleButton]}
              onPress={handleNewSale}
            >
              <Text style={styles.actionButtonIcon}>🛒</Text>
              <Text style={styles.actionButtonText}>Nueva Venta</Text>
            </TouchableOpacity>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton, styles.halfButton]}
                onPress={handleCashIn}
              >
                <Text style={styles.actionButtonIcon}>💵</Text>
                <Text style={styles.actionButtonText}>Ingreso</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton, styles.halfButton]}
                onPress={handleCashOut}
              >
                <Text style={styles.actionButtonIcon}>💸</Text>
                <Text style={styles.actionButtonText}>Retiro</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.actionButton, styles.dangerButton]}
              onPress={handleCloseSession}
            >
              <Text style={styles.actionButtonIcon}>🔒</Text>
              <Text style={styles.actionButtonText}>Cerrar Caja</Text>
            </TouchableOpacity>
          </>
        )}
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
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusOpen: {
    backgroundColor: '#4CAF50',
  },
  statusClosed: {
    backgroundColor: '#9E9E9E',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  sessionCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  noSessionCard: {
    backgroundColor: '#FFF3CD',
    margin: 16,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  noSessionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 8,
  },
  noSessionText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 15,
    color: '#666',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  infoValueHighlight: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 12,
  },
  refreshButton: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignItems: 'center',
  },
  refreshButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  actionsContainer: {
    padding: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  halfButton: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  saleButton: {
    backgroundColor: '#4CAF50',
  },
  secondaryButton: {
    backgroundColor: '#FF9800',
  },
  dangerButton: {
    backgroundColor: '#F44336',
  },
  actionButtonIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
