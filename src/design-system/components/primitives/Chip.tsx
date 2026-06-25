/**
 * Chip Component
 *
 * Chip para filtros y selecciones.
 */

import React from 'react';
import { TouchableOpacity, View, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { iconSizes } from '../../tokens/spacing';
import { activeOpacity } from '../../tokens/animations';
import { useTheme, useThemedStyles } from '../../themes';
import type { Theme } from '../../themes';

export type ChipVariant = 'filled' | 'outlined';
export type ChipSize = 'small' | 'medium';

export interface ChipProps {
  /**
   * Texto del chip
   */
  label: string;

  /**
   * Si está seleccionado
   */
  selected?: boolean;

  /**
   * Callback al presionar
   */
  onPress?: () => void;

  /**
   * Callback al cerrar (muestra X)
   */
  onClose?: () => void;

  /**
   * Variante visual
   */
  variant?: ChipVariant;

  /**
   * Tamaño
   */
  size?: ChipSize;

  /**
   * Icono a la izquierda
   */
  icon?: keyof typeof Ionicons.glyphMap;

  /**
   * Si está deshabilitado
   */
  disabled?: boolean;

  /**
   * Color personalizado cuando está seleccionado
   */
  selectedColor?: string;

  /**
   * Estilos adicionales
   */
  style?: ViewStyle;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  selected = false,
  onPress,
  onClose,
  variant = 'filled',
  size = 'medium',
  icon,
  disabled = false,
  selectedColor,
  style,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const accent = selectedColor ?? theme.color.brand.primary;
  const isInteractive = !!onPress && !disabled;

  const containerStyles = [
    styles.base,
    styles[`size_${size}`],
    variant === 'filled' && styles.filled,
    variant === 'outlined' && styles.outlined,
    selected && variant === 'filled' && { backgroundColor: accent },
    selected && variant === 'outlined' && { borderColor: accent },
    disabled && styles.disabled,
    style,
  ];

  const getTextColor = (): string => {
    if (disabled) return theme.color.text.disabled;
    if (selected) return variant === 'filled' ? theme.color.text.onAction : accent;
    return theme.color.text.muted;
  };

  const getIconColor = (): string => {
    if (disabled) return theme.color.icon.disabled;
    if (selected) return variant === 'filled' ? theme.color.icon.inverse : accent;
    return theme.color.icon.subtle;
  };

  const getIconSize = (): number => {
    return size === 'small' ? iconSizes.xs : iconSizes.sm;
  };

  const content = (
    <>
      {icon && (
        <Ionicons name={icon} size={getIconSize()} color={getIconColor()} style={styles.leftIcon} />
      )}
      <Text
        variant={size === 'small' ? 'labelSmall' : 'labelMedium'}
        color={getTextColor()}
        style={size === 'small' ? styles.textSmall : undefined}
      >
        {label}
      </Text>
      {onClose && (
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeButton}
          activeOpacity={activeOpacity.medium}
          disabled={disabled}
        >
          <Ionicons name="close" size={getIconSize()} color={getIconColor()} />
        </TouchableOpacity>
      )}
    </>
  );

  if (isInteractive) {
    return (
      <TouchableOpacity
        style={containerStyles}
        onPress={onPress}
        activeOpacity={activeOpacity.medium}
        disabled={disabled}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={containerStyles}>{content}</View>;
};

// ============================================
// CHIP GROUP
// ============================================
export interface ChipGroupProps {
  /**
   * Lista de opciones
   */
  options: Array<{ label: string; value: string; icon?: keyof typeof Ionicons.glyphMap }>;

  /**
   * Valores seleccionados
   */
  selected: string[];

  /**
   * Callback al cambiar selección
   */
  onChange: (selected: string[]) => void;

  /**
   * Si permite selección múltiple
   */
  multiple?: boolean;

  /**
   * Variante visual
   */
  variant?: ChipVariant;

  /**
   * Tamaño
   */
  size?: ChipSize;

  /**
   * Estilos del contenedor
   */
  style?: ViewStyle;
}

export const ChipGroup: React.FC<ChipGroupProps> = ({
  options,
  selected,
  onChange,
  multiple = false,
  variant = 'filled',
  size = 'medium',
  style,
}) => {
  const styles = useThemedStyles(createStyles);
  const handlePress = (value: string) => {
    if (multiple) {
      if (selected.includes(value)) {
        onChange(selected.filter((v) => v !== value));
      } else {
        onChange([...selected, value]);
      }
    } else {
      onChange([value]);
    }
  };

  return (
    <View style={[styles.group, style]}>
      {options.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          icon={option.icon}
          selected={selected.includes(option.value)}
          onPress={() => handlePress(option.value)}
          variant={variant}
          size={size}
          style={styles.groupChip}
        />
      ))}
    </View>
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
      borderRadius: theme.radii.full,
      alignSelf: 'flex-start',
    },

    disabled: {
      opacity: 0.5,
    },

    // ============================================
    // SIZE STYLES
    // ============================================
    size_small: {
      paddingVertical: theme.space[1],
      paddingHorizontal: theme.space[2],
      minHeight: 28,
    },

    size_medium: {
      paddingVertical: theme.space[1.5],
      paddingHorizontal: theme.space[3],
      minHeight: 36,
    },

    // ============================================
    // VARIANT STYLES
    // ============================================
    filled: {
      backgroundColor: theme.color.surface.muted,
    },

    outlined: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: theme.color.border.default,
    },

    // ============================================
    // ELEMENT STYLES
    // ============================================
    leftIcon: {
      marginRight: theme.space[1],
    },

    closeButton: {
      marginLeft: theme.space[1],
      padding: theme.space[0.5],
      marginRight: -theme.space[1],
    },

    textSmall: {
      textTransform: 'none',
      letterSpacing: 0,
    },

    // ============================================
    // GROUP STYLES
    // ============================================
    group: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[2],
    },

    groupChip: {
      // Individual chip in group
    },
  });

export default Chip;
