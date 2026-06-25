/**
 * Button Component
 *
 * Botón moderno con múltiples variantes y estados.
 */

import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { textVariants } from '../../tokens/typography';
import { touchTargets, iconSizes } from '../../tokens/spacing';
import { activeOpacity } from '../../tokens/animations';
import { useTheme, useThemedStyles } from '../../themes';
import type { Theme } from '../../themes';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps {
  /**
   * Texto del botón
   */
  title: string;

  /**
   * Callback al presionar
   */
  onPress: () => void;

  /**
   * Variante visual del botón
   */
  variant?: ButtonVariant;

  /**
   * Tamaño del botón
   */
  size?: ButtonSize;

  /**
   * Si el botón está deshabilitado
   */
  disabled?: boolean;

  /**
   * Si muestra estado de carga
   */
  loading?: boolean;

  /**
   * Si ocupa todo el ancho disponible
   */
  fullWidth?: boolean;

  /**
   * Icono a la izquierda (nombre de Ionicons)
   */
  leftIcon?: keyof typeof Ionicons.glyphMap;

  /**
   * Icono a la derecha (nombre de Ionicons)
   */
  rightIcon?: keyof typeof Ionicons.glyphMap;

  /**
   * Estilos adicionales del contenedor
   */
  style?: ViewStyle;

  /**
   * Estilos adicionales del texto
   */
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const isDisabled = disabled || loading;
  const action = theme.color.action[variant];

  const containerStyles = [
    styles.base,
    styles[`variant_${variant}`],
    styles[`size_${size}`],
    fullWidth && styles.fullWidth,
    isDisabled && styles.disabled,
    variant === 'primary' && !isDisabled && theme.shadow.sm,
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`text_${variant}`],
    styles[`text_${size}`],
    isDisabled && styles.textDisabled,
    textStyle,
  ];

  const getIconColor = (): string => {
    if (isDisabled) return action.textDisabled;
    return action.text;
  };

  const getIconSize = (): number => {
    switch (size) {
      case 'small':
        return iconSizes.sm;
      case 'large':
        return iconSizes.lg;
      default:
        return iconSizes.md;
    }
  };

  const getLoaderColor = (): string => action.text;

  return (
    <TouchableOpacity
      style={containerStyles}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={activeOpacity.medium}
    >
      {loading ? (
        <ActivityIndicator color={getLoaderColor()} size="small" />
      ) : (
        <View style={styles.content}>
          {leftIcon && (
            <Ionicons
              name={leftIcon}
              size={getIconSize()}
              color={getIconColor()}
              style={styles.leftIcon}
            />
          )}
          <Text style={textStyles}>{title}</Text>
          {rightIcon && (
            <Ionicons
              name={rightIcon}
              size={getIconSize()}
              color={getIconColor()}
              style={styles.rightIcon}
            />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // ============================================
    // BASE STYLES
    // ============================================
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radii.md,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },

    content: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },

    fullWidth: {
      width: '100%',
    },

    disabled: {
      opacity: 0.5,
    },

    // ============================================
    // VARIANT STYLES
    // ============================================
    variant_primary: {
      backgroundColor: theme.color.action.primary.background,
      borderColor: theme.color.action.primary.border,
    },

    variant_secondary: {
      backgroundColor: theme.color.action.secondary.background,
      borderColor: theme.color.action.secondary.border,
    },

    variant_outline: {
      backgroundColor: theme.color.action.outline.background,
      borderColor: theme.color.action.outline.border,
    },

    variant_ghost: {
      backgroundColor: theme.color.action.ghost.background,
      borderColor: theme.color.action.ghost.border,
    },

    variant_danger: {
      backgroundColor: theme.color.action.danger.background,
      borderColor: theme.color.action.danger.border,
    },

    variant_success: {
      backgroundColor: theme.color.action.success.background,
      borderColor: theme.color.action.success.border,
    },

    // ============================================
    // SIZE STYLES
    // ============================================
    size_small: {
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[3],
      minHeight: touchTargets.small,
      borderRadius: theme.radii.sm,
    },

    size_medium: {
      paddingVertical: theme.space[2.5],
      paddingHorizontal: theme.space[4],
      minHeight: touchTargets.medium,
    },

    size_large: {
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[6],
      minHeight: touchTargets.large,
      borderRadius: theme.radii.lg,
    },

    // ============================================
    // TEXT STYLES
    // ============================================
    text: {
      ...textVariants.buttonMedium,
    },

    text_primary: {
      color: theme.color.action.primary.text,
    },

    text_secondary: {
      color: theme.color.action.secondary.text,
    },

    text_outline: {
      color: theme.color.action.outline.text,
    },

    text_ghost: {
      color: theme.color.action.ghost.text,
    },

    text_danger: {
      color: theme.color.action.danger.text,
    },

    text_success: {
      color: theme.color.action.success.text,
    },

    text_small: {
      ...textVariants.buttonSmall,
    },

    text_medium: {
      ...textVariants.buttonMedium,
    },

    text_large: {
      ...textVariants.buttonLarge,
    },

    textDisabled: {
      color: theme.color.text.disabled,
    },

    // ============================================
    // ICON STYLES
    // ============================================
    leftIcon: {
      marginRight: theme.space[2],
    },

    rightIcon: {
      marginLeft: theme.space[2],
    },
  });

export default Button;
