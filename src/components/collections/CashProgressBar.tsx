/**
 * CashProgressBar Component
 * Barra de progreso visual para el estado del efectivo
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { CashAlertLevel } from '@/types/collections';

interface CashProgressBarProps {
  percent: number;
  alertLevel: CashAlertLevel;
  height?: number;
}

const BAR_COLORS: Record<CashAlertLevel, string> = {
  [CashAlertLevel.NORMAL]: '#4CAF50',
  [CashAlertLevel.WARNING]: '#FFC107',
  [CashAlertLevel.CRITICAL]: '#FF9800',
  [CashAlertLevel.BLOCKED]: '#F44336',
};

export const CashProgressBar: React.FC<CashProgressBarProps> = ({
  percent,
  alertLevel,
  height = 12,
}) => {
  const barColor = BAR_COLORS[alertLevel];
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

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#E0E0E0',
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  bar: {
    height: '100%',
    borderRadius: 6,
  },
  marker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
});

export default CashProgressBar;
