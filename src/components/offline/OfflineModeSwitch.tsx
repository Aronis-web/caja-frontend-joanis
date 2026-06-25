/**
 * Offline Mode Indicator Component
 * Shows current offline/online mode status
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme, useThemedStyles, type Theme } from '@/design-system';
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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
            <ActivityIndicator size="small" color={theme.color.text.inverse} />
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.lg,
      padding: theme.space[3],
      marginBottom: theme.space[3],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },

    // Status row
    statusRow: {
      marginBottom: theme.space[2.5],
    },
    statusIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.space[1.5],
      paddingHorizontal: theme.space[3],
      borderRadius: theme.radii['2xl'],
      alignSelf: 'flex-start',
    },
    online: {
      backgroundColor: theme.color.state.success.background,
    },
    offline: {
      backgroundColor: theme.color.state.danger.background,
    },
    statusIcon: {
      fontSize: 12,
      marginRight: theme.space[1.5],
    },
    statusText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.heading,
    },

    // Switch row
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.space[2],
    },
    switchLabelContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    switchIcon: {
      fontSize: 18,
      marginRight: theme.space[2],
    },
    switchLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.color.text.heading,
    },

    switchState: {
      marginLeft: theme.space[2.5],
      fontSize: 13,
      fontWeight: '700',
      color: theme.color.text.subtle,
    },
    switchStateOn: {
      color: theme.color.icon.warning,
    },

    // Hints and warnings
    hintText: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginTop: theme.space[1.5],
      fontStyle: 'italic',
    },

    // Stats
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      marginTop: theme.space[3],
      paddingTop: theme.space[3],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
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
      color: theme.color.text.heading,
    },
    statLabel: {
      fontSize: 11,
      color: theme.color.text.muted,
      marginTop: 2,
    },
    statDivider: {
      width: 1,
      height: 40,
      backgroundColor: theme.color.border.subtle,
    },

    // Compact mode
    compactContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.space[2],
      paddingVertical: theme.space[1],
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.xl,
    },
    connectionDot: {
      width: 8,
      height: 8,
      borderRadius: theme.radii.xs,
      marginRight: theme.space[1.5],
    },
    dotOnline: {
      backgroundColor: theme.color.icon.success,
    },
    dotOffline: {
      backgroundColor: theme.color.icon.danger,
    },
    compactText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginRight: theme.space[2],
    },
    tokenBadge: {
      fontSize: 11,
      backgroundColor: theme.color.state.warning.background,
      paddingHorizontal: theme.space[1.5],
      paddingVertical: theme.space[0.5],
      borderRadius: theme.radii.lg,
      marginRight: theme.space[1],
    },
    pendingBadge: {
      fontSize: 11,
      backgroundColor: theme.color.state.info.background,
      paddingHorizontal: theme.space[1.5],
      paddingVertical: theme.space[0.5],
      borderRadius: theme.radii.lg,
    },

    // Mini mode - versión muy discreta para el header
    miniContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.space[1.5],
      paddingVertical: theme.space[1],
      borderRadius: theme.radii.lg,
      marginRight: theme.space[2],
    },
    miniContainerOffline: {
      backgroundColor: theme.color.state.danger.background,
    },
    miniContainerActive: {
      backgroundColor: theme.color.state.warning.background,
    },
    miniContainerWaiting: {
      backgroundColor: theme.color.state.warning.background,
    },
    miniDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    miniDotOnline: {
      backgroundColor: theme.color.icon.success,
    },
    miniDotOffline: {
      backgroundColor: theme.color.icon.danger,
      marginRight: theme.space[1],
    },
    miniDotWaiting: {
      backgroundColor: theme.color.icon.warning,
      marginRight: theme.space[0.5],
    },
    miniWaitingText: {
      fontSize: 10,
    },

    miniTokenCount: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.color.icon.warning,
      marginLeft: theme.space[1],
    },
    miniPendingBadge: {
      backgroundColor: theme.color.icon.accent,
      borderRadius: theme.radii.md,
      minWidth: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: theme.space[1],
    },
    miniPendingText: {
      fontSize: 9,
      fontWeight: '700',
      color: theme.color.text.onAction,
    },
  });
