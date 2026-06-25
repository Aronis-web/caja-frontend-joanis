/**
 * CashProgressBar Component
 * Barra de progreso visual para el estado del efectivo
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, useThemedStyles, type Theme } from '@/design-system';
import { CashAlertLevel } from '@/types/collections';

interface CashProgressBarProps {
  percent: number;
  alertLevel: CashAlertLevel;
  height?: number;
}

export const CashProgressBar: React.FC<CashProgressBarProps> = ({
  percent,
  alertLevel,
  height = 12,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const barColors: Record<CashAlertLevel, string> = {
    [CashAlertLevel.NORMAL]: theme.color.action.success.background,
    [CashAlertLevel.WARNING]: theme.color.icon.warning,
    [CashAlertLevel.CRITICAL]: theme.color.action.danger.backgroundHover,
    [CashAlertLevel.BLOCKED]: theme.color.action.danger.background,
  };

  const barColor = barColors[alertLevel];
  const clampedPercent = Math.min(Math.max(percent, 0), 100);

  return (
    <View style={[styles.container, { height }]}>
      <View
        style={[
          styles.bar,
          {
            width: `${clampedPercent}%`,
            backgroundColor: barColor,
          },
        ]}
      />
      {/* Marcador de 80% (umbral de advertencia) */}
      <View style={[styles.marker, { left: '80%' }]} />
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      width: '100%',
      backgroundColor: theme.color.border.subtle,
      borderRadius: theme.radii.sm,
      overflow: 'hidden',
      position: 'relative',
    },
    bar: {
      height: '100%',
      borderRadius: theme.radii.sm,
    },
    marker: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 2,
      backgroundColor: theme.color.overlay.subtle,
    },
  });

export default CashProgressBar;
