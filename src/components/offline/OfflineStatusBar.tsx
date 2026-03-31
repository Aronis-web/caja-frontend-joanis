/**
 * Offline Status Bar Component
 * Shows offline status in a horizontal bar format
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useOfflineStore } from '@/store/offline';

interface OfflineStatusBarProps {
  onSyncPress?: () => void;
}

export default function OfflineStatusBar({ onSyncPress }: OfflineStatusBarProps) {
  const { connectionStatus, isOfflineModeEnabled, availableTokens, pendingSales, lastProductSync } =
    useOfflineStore();

  const isOnline = connectionStatus === 'ONLINE';
  const isSyncing = connectionStatus === 'SYNCING';

  // Formatear última sincronización
  const formatLastSync = () => {
    if (!lastProductSync) return 'Nunca';

    const diff = Date.now() - new Date(lastProductSync).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `hace ${hours}h`;
    if (minutes > 0) return `hace ${minutes}min`;
    return 'ahora';
  };

  // No mostrar si está online y no hay modo offline
  if (isOnline && !isOfflineModeEnabled && pendingSales === 0) {
    return null;
  }

  return (
    <View style={[styles.container, isOfflineModeEnabled && styles.containerOffline]}>
      {/* Estado de conexión */}
      <View style={styles.section}>
        <View style={[styles.dot, isOnline ? styles.dotOnline : styles.dotOffline]} />
        <Text style={styles.statusText}>
          {isSyncing ? 'Sincronizando...' : isOnline ? 'Online' : 'Sin conexión'}
        </Text>
        {isSyncing && <ActivityIndicator size="small" color="#fff" style={styles.loader} />}
      </View>

      {/* Modo offline activo */}
      {isOfflineModeEnabled && (
        <View style={styles.section}>
          <Text style={styles.offlineBadge}>⚡ MODO OFFLINE</Text>
        </View>
      )}

      {/* Tokens disponibles */}
      {(isOfflineModeEnabled || !isOnline) && (
        <View style={styles.section}>
          <Text style={styles.infoText}>🎫 {availableTokens} tokens</Text>
        </View>
      )}

      {/* Ventas pendientes */}
      {pendingSales > 0 && (
        <TouchableOpacity style={styles.section} onPress={onSyncPress}>
          <Text style={styles.pendingText}>📋 {pendingSales} pendientes</Text>
        </TouchableOpacity>
      )}

      {/* Última sincronización */}
      <View style={styles.section}>
        <Text style={styles.syncText}>🔄 {formatLastSync()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#343a40',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 12,
  },
  containerOffline: {
    backgroundColor: '#e65100',
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  dotOnline: {
    backgroundColor: '#4caf50',
  },
  dotOffline: {
    backgroundColor: '#f44336',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  loader: {
    marginLeft: 6,
  },
  offlineBadge: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  infoText: {
    color: '#fff',
    fontSize: 12,
  },
  pendingText: {
    color: '#ffeb3b',
    fontSize: 12,
    fontWeight: '600',
  },
  syncText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
  },
});
