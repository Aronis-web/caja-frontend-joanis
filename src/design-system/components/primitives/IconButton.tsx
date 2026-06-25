/**
 * IconButton Component
 *
 * Botón circular con icono.
 */

import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { iconSizes, touchTargets } from '../../tokens/spacing';
import { activeOpacity } from '../../tokens/animations';
import { useTheme, useThemedStyles } from '../../themes';
import type { Theme } from '../../themes';

export type IconButtonVariant = 'default' | 'primary' | 'secondary' | 'ghost' | 'danger';
export type IconButtonSize = 'small' | 'medium' | 'large';

export interface IconButtonProps {
  /**
   * Nombre del icono de Ionicons
   */
  icon: keyof typeof Ionicons.glyphMap;

  /**
   * Callback al presionar
   */
  onPress: () => void;

  /**
   * Variante visual
   */
  variant?: IconButtonVariant;

  /**
   * Tamaño del botón
   */
  size?: IconButtonSize;

  /**
   * Si está deshabilitado
   */
  disabled?: boolean;

  /**
   * Si está cargando
   */
  loading?: boolean;

  /**
   * Color del icono (override)
   */
  iconColor?: string;

  /**
   * Estilos adicionales
   */
  style?: ViewStyle;

  /**
   * TestID para pruebas
   */
  testID?: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onPress,
  variant = 'default',
  size = 'medium',
  disabled = false,
  loading = false,
  iconColor,
  style,
  testID,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const isDisabled = disabled || loading;

  const getContainerSize = (): number => {
    switch (size) {
      case 'small':
        return touchTargets.small;
      case 'large':
        return touchTargets.large;
      default:
        return touchTargets.medium;
    }
  };

  const getIconSize = (): number => {
    switch (size) {
      case 'small':
        return iconSizes.sm;
      case 'large':
        return iconSizes.xl;
      default:
        return iconSizes.lg;
    }
  };

  const getIconColor = (): string => {
    if (iconColor) return iconColor;
    if (isDisabled) return theme.color.icon.disabled;

    switch (variant) {
      case 'primary':
        return theme.color.icon.inverse;
      case 'secondary':
        return theme.color.icon.default;
      case 'ghost':
        return theme.color.icon.muted;
      case 'danger':
        return theme.color.icon.danger;
      default:
        return theme.color.icon.default;
    }
  };

  const containerSize = getContainerSize();

  const containerStyles = [
    styles.base,
    styles[`variant_${variant}`],
    {
      width: containerSize,
      height: containerSize,
      borderRadius: containerSize / 2,
    },
    isDisabled && styles.disabled,
    variant === 'primary' && !isDisabled && theme.shadow.sm,
    style,
  ];

  return (
    <TouchableOpacity
      style={containerStyles}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={activeOpacity.medium}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? theme.color.icon.inverse : theme.color.icon.default}
        />
      ) : (
        <Ionicons name={icon} size={getIconSize()} color={getIconColor()} />
      )}
    </TouchableOpacity>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    base: {
      alignItems: 'center',
      justifyContent: 'center',
    },

    disabled: {
      opacity: 0.5,
    },

    // ============================================
    // VARIANT STYLES
    // ============================================
    variant_default: {
      backgroundColor: theme.color.surface.subtle,
    },

    variant_primary: {
      backgroundColor: theme.color.action.primary.background,
    },

    variant_secondary: {
      backgroundColor: theme.color.action.secondary.background,
    },

    variant_ghost: {
      backgroundColor: 'transparent',
    },

    variant_danger: {
      backgroundColor: theme.color.state.danger.background,
    },
  });

export default IconButton;
