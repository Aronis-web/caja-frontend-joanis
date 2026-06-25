/**
 * Badge Component
 *
 * Insignia para mostrar estados, contadores y etiquetas.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { iconSizes } from '../../tokens/spacing';
import { useTheme, useThemedStyles } from '../../themes';
import type { Theme } from '../../themes';

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'active'
  | 'pending'
  | 'draft'
  | 'completed'
  | 'cancelled'
  | 'overdue'
  | 'paid'
  | 'partial';

export type BadgeSize = 'small' | 'medium' | 'large';

export interface BadgeProps {
  /**
   * Texto del badge
   */
  label: string;

  /**
   * Variante de color
   */
  variant?: BadgeVariant;

  /**
   * Tamaño del badge
   */
  size?: BadgeSize;

  /**
   * Icono opcional
   */
  icon?: keyof typeof Ionicons.glyphMap;

  /**
   * Si el badge tiene forma de píldora
   */
  pill?: boolean;

  /**
   * Si tiene borde
   */
  outlined?: boolean;

  /**
   * Estilos adicionales
   */
  style?: ViewStyle;
}

const getVariantColors = (theme: Theme, variant: BadgeVariant, outlined: boolean) => {
  // Status colors mapeados al theme actual
  const statusKeys: Record<string, keyof typeof theme.color.state> = {
    active: 'active',
    pending: 'pending',
    draft: 'draft',
    completed: 'completed',
    cancelled: 'cancelled',
    overdue: 'overdue',
    paid: 'paid',
    partial: 'partial',
  };

  if (statusKeys[variant]) {
    const status = theme.color.state[statusKeys[variant]];
    return {
      backgroundColor: outlined ? 'transparent' : status.background,
      textColor: status.text,
      borderColor: status.border,
    };
  }

  // Semantic colors derivados del theme
  const semanticMap: Record<string, { bg: string; text: string; border: string }> = {
    default: {
      bg: theme.color.surface.muted,
      text: theme.color.text.muted,
      border: theme.color.border.subtle,
    },
    primary: {
      bg: theme.color.brand.primarySoft,
      text: theme.color.brand.primary,
      border: theme.color.border.default,
    },
    success: {
      bg: theme.color.state.success.background,
      text: theme.color.state.success.text,
      border: theme.color.state.success.border,
    },
    warning: {
      bg: theme.color.state.warning.background,
      text: theme.color.state.warning.text,
      border: theme.color.state.warning.border,
    },
    danger: {
      bg: theme.color.state.danger.background,
      text: theme.color.state.danger.text,
      border: theme.color.state.danger.border,
    },
    info: {
      bg: theme.color.state.info.background,
      text: theme.color.state.info.text,
      border: theme.color.state.info.border,
    },
  };

  const semantic = semanticMap[variant] || semanticMap.default;
  return {
    backgroundColor: outlined ? 'transparent' : semantic.bg,
    textColor: semantic.text,
    borderColor: semantic.border,
  };
};

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'default',
  size = 'medium',
  icon,
  pill = false,
  outlined = false,
  style,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const variantColors = getVariantColors(theme, variant, outlined);

  const containerStyles = [
    styles.base,
    styles[`size_${size}`],
    {
      backgroundColor: variantColors.backgroundColor,
      borderColor: variantColors.borderColor,
    },
    outlined && styles.outlined,
    pill && styles.pill,
    style,
  ];

  const getIconSize = (): number => {
    switch (size) {
      case 'small':
        return iconSizes.xs;
      case 'large':
        return iconSizes.md;
      default:
        return iconSizes.sm;
    }
  };

  return (
    <View style={containerStyles}>
      {icon && (
        <Ionicons
          name={icon}
          size={getIconSize()}
          color={variantColors.textColor}
          style={styles.icon}
        />
      )}
      <Text
        variant={size === 'small' ? 'labelSmall' : size === 'large' ? 'labelLarge' : 'labelMedium'}
        color={variantColors.textColor}
        style={size === 'small' ? styles.textSmall : undefined}
      >
        {label}
      </Text>
    </View>
  );
};

// ============================================
// STATUS BADGE (Preconfigurado para estados)
// ============================================
export interface StatusBadgeProps {
  status:
    | 'active'
    | 'pending'
    | 'draft'
    | 'completed'
    | 'cancelled'
    | 'overdue'
    | 'paid'
    | 'partial';
  label?: string;
  size?: BadgeSize;
  style?: ViewStyle;
}

const statusLabels: Record<string, string> = {
  active: 'Activo',
  pending: 'Pendiente',
  draft: 'Borrador',
  completed: 'Completado',
  cancelled: 'Cancelado',
  overdue: 'Vencido',
  paid: 'Pagado',
  partial: 'Parcial',
};

const statusIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  active: 'checkmark-circle',
  pending: 'time',
  draft: 'document-outline',
  completed: 'checkmark-done-circle',
  cancelled: 'close-circle',
  overdue: 'alert-circle',
  paid: 'checkmark-circle',
  partial: 'pie-chart',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'medium',
  style,
}) => {
  return (
    <Badge
      label={label || statusLabels[status]}
      variant={status}
      size={size}
      icon={statusIcons[status]}
      style={style}
    />
  );
};

// ============================================
// COUNTER BADGE (Para notificaciones)
// ============================================
export interface CounterBadgeProps {
  count: number;
  max?: number;
  variant?: 'primary' | 'danger' | 'success';
  style?: ViewStyle;
}

export const CounterBadge: React.FC<CounterBadgeProps> = ({
  count,
  max = 99,
  variant = 'danger',
  style,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const displayCount = count > max ? `${max}+` : count.toString();

  return (
    <View style={[styles.counterBadge, styles[`counter_${variant}`], style]}>
      <Text variant="labelSmall" color={theme.color.text.onAction}>
        {displayCount}
      </Text>
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
      borderRadius: theme.radii.sm,
      borderWidth: 1,
      alignSelf: 'flex-start',
    },

    outlined: {
      borderWidth: 1.5,
    },

    pill: {
      borderRadius: theme.radii.full,
    },

    icon: {
      marginRight: theme.space[1],
    },

    // ============================================
    // SIZE STYLES
    // ============================================
    size_small: {
      paddingVertical: theme.space[0.5],
      paddingHorizontal: theme.space[1.5],
    },

    size_medium: {
      paddingVertical: theme.space[1],
      paddingHorizontal: theme.space[2],
    },

    size_large: {
      paddingVertical: theme.space[1.5],
      paddingHorizontal: theme.space[3],
    },

    textSmall: {
      textTransform: 'none',
      letterSpacing: 0,
    },

    // ============================================
    // COUNTER BADGE STYLES
    // ============================================
    counterBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: theme.radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.space[1.5],
    },

    counter_primary: {
      backgroundColor: theme.color.action.primary.background,
    },

    counter_danger: {
      backgroundColor: theme.color.action.danger.background,
    },

    counter_success: {
      backgroundColor: theme.color.action.success.background,
    },
  });

export default Badge;
