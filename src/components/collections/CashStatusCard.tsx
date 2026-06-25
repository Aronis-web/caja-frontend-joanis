/**
 * CashStatusCard Component
 * Tarjeta compacta que muestra el estado del efectivo en el dashboard
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useThemedStyles, type Theme } from '@/design-system';
import { CashProgressBar } from './CashProgressBar';
import { CashAlertBadge } from './CashAlertBadge';
import { CashAlertLevel, ALERT_LEVEL_CONFIGS, type CashStatusResponse } from '@/types/collections';

interface CashStatusCardProps {
  cashStatus: CashStatusResponse | null;
  isLoading?: boolean;
  onPress?: () => void;
  onRequestCollection?: () => void;
}

export const CashStatusCard: React.FC<CashStatusCardProps> = ({
  cashStatus,
  isLoading = false,
  onPress,
  onRequestCollection,
}) => {
  const styles = useThemedStyles(createStyles);

  if (isLoading || !cashStatus) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>💰 Estado del Efectivo</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>
            {isLoading ? 'Cargando...' : 'Sin información disponible'}
          </Text>
        </View>
      </View>
    );
  }

  const { alertLevel, percentUsed, currentCash, maxCash, isBlocked, message, canCollect } =
    cashStatus;
  const config = ALERT_LEVEL_CONFIGS[alertLevel];

  const formatCurrency = (amount: number) => {
    return `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const showCollectionButton =
    canCollect &&
    (alertLevel === CashAlertLevel.WARNING ||
      alertLevel === CashAlertLevel.CRITICAL ||
      alertLevel === CashAlertLevel.BLOCKED);

  return (
    <TouchableOpacity
      style={[styles.container, { borderColor: config.borderColor, borderWidth: 1 }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>💰 Estado del Efectivo</Text>
        <CashAlertBadge alertLevel={alertLevel} size="small" />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressSection}>
        <CashProgressBar percent={percentUsed} alertLevel={alertLevel} />
        <Text style={[styles.percentText, { color: config.color }]}>{percentUsed.toFixed(0)}%</Text>
      </View>

      {/* Amounts */}
      <View style={styles.amountsRow}>
        <View style={styles.amountItem}>
          <Text style={styles.amountLabel}>Actual</Text>
          <Text style={[styles.amountValue, { color: config.color }]}>
            {formatCurrency(currentCash)}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.amountItem}>
          <Text style={styles.amountLabel}>Máximo</Text>
          <Text style={styles.amountValue}>{formatCurrency(maxCash)}</Text>
        </View>
      </View>

      {/* Alert Message */}
      {(isBlocked || alertLevel !== CashAlertLevel.NORMAL) && (
        <View style={[styles.alertMessage, { backgroundColor: config.backgroundColor }]}>
          <Text style={[styles.alertText, { color: config.color }]}>
            {config.icon}{' '}
            {message ||
              (isBlocked ? 'Caja bloqueada - Recaudación requerida' : 'Atención requerida')}
          </Text>
        </View>
      )}

      {/* Collection Button */}
      {showCollectionButton && onRequestCollection && (
        <TouchableOpacity
          style={[styles.collectionButton, isBlocked && styles.collectionButtonUrgent]}
          onPress={onRequestCollection}
        >
          <Text style={styles.collectionButtonText}>
            {isBlocked ? '🚨 Solicitar Recaudación Urgente' : '💵 Solicitar Recaudación'}
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      padding: theme.space[4],
      marginBottom: theme.space[4],
      ...theme.shadow.sm,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[3],
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    progressSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
      marginBottom: theme.space[3],
    },
    percentText: {
      fontSize: 16,
      fontWeight: '700',
      minWidth: 45,
      textAlign: 'right',
    },
    amountsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      paddingVertical: theme.space[2],
    },
    amountItem: {
      alignItems: 'center',
      flex: 1,
    },
    amountLabel: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginBottom: 2,
    },
    amountValue: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    divider: {
      width: 1,
      height: 30,
      backgroundColor: theme.color.border.subtle,
    },
    alertMessage: {
      marginTop: theme.space[3],
      padding: theme.space[2.5],
      borderRadius: theme.radii.md,
    },
    alertText: {
      fontSize: 13,
      fontWeight: '500',
      textAlign: 'center',
    },
    collectionButton: {
      marginTop: theme.space[3],
      backgroundColor: theme.color.icon.accent,
      paddingVertical: theme.space[3],
      borderRadius: theme.radii.md,
      alignItems: 'center',
    },
    collectionButtonUrgent: {
      backgroundColor: theme.color.action.danger.background,
    },
    collectionButtonText: {
      color: theme.color.text.onAction,
      fontSize: 14,
      fontWeight: '600',
    },
    loadingContainer: {
      padding: theme.space[5],
      alignItems: 'center',
    },
    loadingText: {
      color: theme.color.text.subtle,
      fontSize: 14,
    },
  });

export default CashStatusCard;
