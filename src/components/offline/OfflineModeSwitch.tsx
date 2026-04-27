/**
 * Offline Mode Indicator Component
 * Shows current offline/online mode status
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useOfflineStore } from '@/store/offline';

interface OfflineModeSwitchProps {
  compact?: boolean;
  /** Versión mini para el header - muy discreta */
  mini?: boolean;
}

export default function OfflineModeSwitch({
  compact = false,
  mini = false,
}: OfflineModeSwitchProps) {
  const {
    connectionStatus,
    isOfflineModeEnabled,
    availableTokens,
    pendingSales,
    totalProducts,
    disconnectedSince,
    gracePeriodMs,
  } = useOfflineStore();

  // Estado para forzar re-render después del período de gracia
  const [, setForceUpdate] = useState(0);

  const isOnline = connectionStatus === 'ONLINE';
  const isSyncing = connectionStatus === 'SYNCING' || connectionStatus === 'RECONNECTING';
  const showOfflineIndicator = isOfflineModeEnabled;

  // Timer para actualizar el componente cuando pase el período de gracia
  useEffect(() => {
    if (!disconnectedSince || isOnline || showOfflineIndicator) {
      return;
    }

    const disconnectedTime = new Date(disconnectedSince).getTime();
    const elapsed = Date.now() - disconnectedTime;
    const remaining = gracePeriodMs - elapsed;

    if (remaining > 0) {
      const timer = setTimeout(() => {
        setForceUpdate((prev) => prev + 1);
      }, remaining + 100); // +100ms de margen

      return () => clearTimeout(timer);
    }
  }, [disconnectedSince, isOnline, showOfflineIndicator, gracePeriodMs]);

  // Vista mini para el header - solo indicador de estado
  if (mini) {
    if (isOnline) {
      return (
        <View style={styles.miniContainer}>
          <View style={[styles.miniDot, styles.miniDotOnline]} />
        </View>
      );
    }

    const isWaitingGracePeriod = !isOfflineModeEnabled && !!disconnectedSince;

    if (isWaitingGracePeriod) {
      return (
        <View style={[styles.miniContainer, styles.miniContainerWaiting]}>
          <View style={[styles.miniDot, styles.miniDotWaiting]} />
          <Text style={styles.miniWaitingText}>⏳</Text>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.miniContainer,
          styles.miniContainerOffline,
          isOfflineModeEnabled && styles.miniContainerActive,
        ]}
      >
        <View style={[styles.miniDot, styles.miniDotOffline]} />
        {isOfflineModeEnabled && <Text style={styles.miniTokenCount}>{availableTokens}</Text>}
        {pendingSales > 0 && (
          <View style={styles.miniPendingBadge}>
            <Text style={styles.miniPendingText}>{pendingSales}</Text>
          </View>
        )}
      </View>
    );
  }

  // Vista compacta para el header
  if (compact) {
    return (
      <View style={styles.compactContainer}>
        {/* Indicador de conexión */}
        <View style={[styles.connectionDot, isOnline ? styles.dotOnline : styles.dotOffline]} />

        {/* Estado */}
        <Text style={styles.compactText}>
          {isOnline ? 'Online' : isOfflineModeEnabled ? 'Offline' : 'Sin conexión'}
        </Text>

        {/* Contador de tokens en modo offline */}
        {isOfflineModeEnabled && <Text style={styles.tokenBadge}>🎫 {availableTokens}</Text>}

        {/* Ventas pendientes */}
        {pendingSales > 0 && <Text style={styles.pendingBadge}>📋 {pendingSales}</Text>}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Indicador de estado de conexión */}
      <View style={styles.statusRow}>
        <View style={[styles.statusIndicator, isOnline ? styles.online : styles.offline]}>
          {isSyncing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.statusIcon}>{isOnline ? '🟢' : '🔴'}</Text>
          )}
          <Text style={styles.statusText}>
            {isOnline ? 'Conectado' : isSyncing ? 'Sincronizando...' : 'Sin conexión'}
          </Text>
        </View>
      </View>

      {/* Indicador de modo offline */}
      <View style={styles.switchRow}>
        <View style={styles.switchLabelContainer}>
          <Text style={styles.switchIcon}>⚡</Text>
          <Text style={styles.switchLabel}>Modo Offline</Text>
        </View>

        <Text style={[styles.switchState, isOfflineModeEnabled && styles.switchStateOn]}>
          {isOfflineModeEnabled ? 'ACTIVO' : 'INACTIVO'}
        </Text>
      </View>

      {!isOnline && !isOfflineModeEnabled && !!disconnectedSince && (
        <Text style={styles.hintText}>⏳ Se activará automáticamente en 1 minuto</Text>
      )}

      {/* Estadísticas cuando está en modo offline */}
      {isOfflineModeEnabled && (
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>🎫</Text>
            <Text style={styles.statValue}>{availableTokens}</Text>
            <Text style={styles.statLabel}>tokens</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>📦</Text>
            <Text style={styles.statValue}>{totalProducts}</Text>
            <Text style={styles.statLabel}>productos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>📋</Text>
            <Text style={styles.statValue}>{pendingSales}</Text>
            <Text style={styles.statLabel}>pendientes</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },

  // Status row
  statusRow: {
    marginBottom: 10,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  online: {
    backgroundColor: '#d4edda',
  },
  offline: {
    backgroundColor: '#f8d7da',
  },
  statusIcon: {
    fontSize: 12,
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },

  // Switch row
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  switchIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },

  switchState: {
    marginLeft: 10,
    fontSize: 13,
    fontWeight: '700',
    color: '#999',
  },
  switchStateOn: {
    color: '#ff9800',
  },

  // Hints and warnings
  hintText: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
    fontStyle: 'italic',
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  statItem: {
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e9ecef',
  },

  // Compact mode
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  dotOnline: {
    backgroundColor: '#28a745',
  },
  dotOffline: {
    backgroundColor: '#dc3545',
  },
  compactText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  tokenBadge: {
    fontSize: 11,
    backgroundColor: '#fff3cd',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 4,
  },
  pendingBadge: {
    fontSize: 11,
    backgroundColor: '#cce5ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },

  // Mini mode - versión muy discreta para el header
  miniContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  miniContainerOffline: {
    backgroundColor: 'rgba(220, 53, 69, 0.1)',
  },
  miniContainerActive: {
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
  },
  miniContainerWaiting: {
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  miniDotOnline: {
    backgroundColor: '#28a745',
  },
  miniDotOffline: {
    backgroundColor: '#dc3545',
    marginRight: 4,
  },
  miniDotWaiting: {
    backgroundColor: '#ffc107',
    marginRight: 2,
  },
  miniWaitingText: {
    fontSize: 10,
  },

  miniTokenCount: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ff9800',
    marginLeft: 4,
  },
  miniPendingBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  miniPendingText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
});
