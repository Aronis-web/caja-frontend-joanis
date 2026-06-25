/**
 * Divider Component
 *
 * Separador horizontal o vertical.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Text } from './Text';
import { spacing } from '../../tokens/spacing';
import { useTheme } from '../../themes';

export interface DividerProps {
  /**
   * Orientación del divider
   */
  orientation?: 'horizontal' | 'vertical';

  /**
   * Variante visual
   */
  variant?: 'full' | 'inset' | 'middle';

  /**
   * Texto en el centro (solo horizontal)
   */
  label?: string;

  /**
   * Espesor de la línea
   */
  thickness?: number;

  /**
   * Color de la línea
   */
  color?: string;

  /**
   * Espaciado vertical/horizontal
   */
  spacing?: 'none' | 'small' | 'medium' | 'large';

  /**
   * Estilos adicionales
   */
  style?: ViewStyle;
}

export const Divider: React.FC<DividerProps> = ({
  orientation = 'horizontal',
  variant = 'full',
  label,
  thickness = 1,
  color,
  spacing: spacingProp = 'medium',
  style,
}) => {
  const theme = useTheme();
  const lineColor = color ?? theme.color.border.subtle;
  const isHorizontal = orientation === 'horizontal';

  const getMargin = () => {
    switch (spacingProp) {
      case 'none':
        return 0;
      case 'small':
        return spacing[2];
      case 'large':
        return spacing[6];
      default:
        return spacing[4];
    }
  };

  const getInset = () => {
    switch (variant) {
      case 'inset':
        return spacing[4];
      case 'middle':
        return spacing[8];
      default:
        return 0;
    }
  };

  const margin = getMargin();
  const inset = getInset();

  // Si tiene label, renderizar con texto
  if (label && isHorizontal) {
    return (
      <View
        style={[
          styles.labelContainer,
          {
            marginVertical: margin,
            paddingHorizontal: inset,
          },
          style,
        ]}
      >
        <View
          style={[
            styles.line,
            {
              height: thickness,
              backgroundColor: lineColor,
              flex: 1,
            },
          ]}
        />
        <Text variant="caption" color="tertiary" style={styles.labelText}>
          {label}
        </Text>
        <View
          style={[
            styles.line,
            {
              height: thickness,
              backgroundColor: lineColor,
              flex: 1,
            },
          ]}
        />
      </View>
    );
  }

  // Divider simple
  if (isHorizontal) {
    return (
      <View
        style={[
          styles.horizontal,
          {
            height: thickness,
            backgroundColor: lineColor,
            marginVertical: margin,
            marginHorizontal: inset,
          },
          style,
        ]}
      />
    );
  }

  // Vertical divider
  return (
    <View
      style={[
        styles.vertical,
        {
          width: thickness,
          backgroundColor: lineColor,
          marginHorizontal: margin,
          marginVertical: inset,
        },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  horizontal: {
    width: '100%',
  },

  vertical: {
    alignSelf: 'stretch',
  },

  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  line: {
    flex: 1,
  },

  labelText: {
    marginHorizontal: spacing[3],
  },
});

export default Divider;
