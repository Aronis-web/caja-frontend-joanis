/**
 * Card Component
 *
 * Contenedor con sombra y bordes redondeados.
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { activeOpacity } from '../../tokens/animations';
import { useThemedStyles } from '../../themes';
import type { Theme } from '../../themes';

export type CardVariant = 'elevated' | 'outlined' | 'filled';
export type CardPadding = 'none' | 'small' | 'medium' | 'large';

export interface CardProps {
  /**
   * Contenido del card
   */
  children: React.ReactNode;

  /**
   * Variante visual
   */
  variant?: CardVariant;

  /**
   * Padding interno
   */
  padding?: CardPadding;

  /**
   * Si el card es presionable
   */
  onPress?: () => void;

  /**
   * Si el card está deshabilitado
   */
  disabled?: boolean;

  /**
   * Estilos adicionales
   */
  style?: ViewStyle;

  /**
   * TestID para pruebas
   */
  testID?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'elevated',
  padding = 'medium',
  onPress,
  disabled = false,
  style,
  testID,
}) => {
  const styles = useThemedStyles(createStyles);
  const containerStyles = [
    styles.base,
    styles[`variant_${variant}`],
    styles[`padding_${padding}`],
    disabled && styles.disabled,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={containerStyles}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={activeOpacity.medium}
        testID={testID}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={containerStyles} testID={testID}>
      {children}
    </View>
  );
};

// ============================================
// CARD SUB-COMPONENTS
// ============================================

export interface CardHeaderProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ children, style }) => {
  const styles = useThemedStyles(createStyles);
  return <View style={[styles.header, style]}>{children}</View>;
};

export interface CardContentProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const CardContent: React.FC<CardContentProps> = ({ children, style }) => {
  const styles = useThemedStyles(createStyles);
  return <View style={[styles.content, style]}>{children}</View>;
};

export interface CardFooterProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const CardFooter: React.FC<CardFooterProps> = ({ children, style }) => {
  const styles = useThemedStyles(createStyles);
  return <View style={[styles.footer, style]}>{children}</View>;
};

export interface CardDividerProps {
  style?: ViewStyle;
}

export const CardDivider: React.FC<CardDividerProps> = ({ style }) => {
  const styles = useThemedStyles(createStyles);
  return <View style={[styles.divider, style]} />;
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // ============================================
    // BASE STYLES
    // ============================================
    base: {
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.base,
      overflow: 'hidden',
    },

    disabled: {
      opacity: 0.6,
    },

    // ============================================
    // VARIANT STYLES
    // ============================================
    variant_elevated: {
      backgroundColor: theme.color.surface.elevated,
      ...theme.shadow.sm,
    },

    variant_outlined: {
      backgroundColor: theme.color.surface.base,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },

    variant_filled: {
      backgroundColor: theme.color.surface.subtle,
    },

    // ============================================
    // PADDING STYLES
    // ============================================
    padding_none: {
      padding: 0,
    },

    padding_small: {
      padding: theme.space[3],
    },

    padding_medium: {
      padding: theme.space[4],
    },

    padding_large: {
      padding: theme.space[5],
    },

    // ============================================
    // SUB-COMPONENT STYLES
    // ============================================
    header: {
      marginBottom: theme.space[3],
    },

    content: {
      // Flexible content area
    },

    footer: {
      marginTop: theme.space[3],
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: theme.space[2],
    },

    divider: {
      height: 1,
      backgroundColor: theme.color.border.subtle,
      marginVertical: theme.space[3],
      marginHorizontal: -theme.space[4],
    },
  });

export default Card;
