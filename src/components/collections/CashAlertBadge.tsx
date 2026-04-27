/**
 * CashAlertBadge Component
 * Badge que muestra el nivel de alerta del efectivo
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CashAlertLevel, ALERT_LEVEL_CONFIGS } from '@/types/collections';

interface CashAlertBadgeProps {
  alertLevel: CashAlertLevel;
  showIcon?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const CashAlertBadge: React.FC<CashAlertBadgeProps> = ({
  alertLevel,
  showIcon = true,
  size = 'medium',
}) => {
  const config = ALERT_LEVEL_CONFIGS[alertLevel];

  const sizeStyles = {
    small: { paddingHorizontal: 6, paddingVertical: 2, fontSize: 10 },
    medium: { paddingHorizontal: 10, paddingVertical: 4, fontSize: 12 },
    large: { paddingHorizontal: 14, paddingVertical: 6, fontSize: 14 },
  };

  const currentSize = sizeStyles[size];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
          paddingHorizontal: currentSize.paddingHorizontal,
          paddingVertical: currentSize.paddingVertical,
        },
      ]}
    >
      {showIcon && <Text style={styles.icon}>{config.icon}</Text>}
      <Text
        style={[
          styles.label,
          {
            color: config.color,
            fontSize: currentSize.fontSize,
          },
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  icon: {
    fontSize: 12,
  },
  label: {
    fontWeight: '600',
  },
});

export default CashAlertBadge;
