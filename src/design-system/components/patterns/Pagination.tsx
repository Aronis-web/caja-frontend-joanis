/**
 * Pagination Component
 *
 * Controles de paginación para listas.
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../primitives/Text';
import { iconSizes } from '../../tokens/spacing';
import { activeOpacity } from '../../tokens/animations';
import { useTheme, useThemedStyles } from '../../themes';
import type { Theme } from '../../themes';
import { useMeasuredFloatingFooter } from '../../layout/FloatingFooterProvider';

export interface PaginationProps {
  /**
   * Página actual
   */
  currentPage: number;

  /**
   * Total de páginas
   */
  totalPages: number;

  /**
   * Total de items
   */
  totalItems?: number;

  /**
   * Items por página
   */
  itemsPerPage?: number;

  /**
   * Callback al cambiar de página
   */
  onPageChange: (page: number) => void;

  /**
   * Si está cargando
   */
  loading?: boolean;

  /**
   * Variante visual
   */
  variant?: 'simple' | 'full' | 'compact';

  /**
   * Estilos adicionales
   */
  style?: ViewStyle;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  loading = false,
  variant = 'full',
  style,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { onLayout: onFooterLayout } = useMeasuredFloatingFooter();
  const canGoPrevious = currentPage > 1 && !loading;
  const canGoNext = currentPage < totalPages && !loading;

  const handlePrevious = () => {
    if (canGoPrevious) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (canGoNext) {
      onPageChange(currentPage + 1);
    }
  };

  // Compact variant - Solo flechas
  if (variant === 'compact') {
    return (
      <View onLayout={onFooterLayout} style={[styles.compactContainer, style]}>
        <TouchableOpacity
          style={[styles.compactButton, !canGoPrevious && styles.buttonDisabled]}
          onPress={handlePrevious}
          disabled={!canGoPrevious}
          activeOpacity={activeOpacity.medium}
        >
          <Ionicons
            name="chevron-back"
            size={iconSizes.md}
            color={canGoPrevious ? theme.color.icon.default : theme.color.icon.disabled}
          />
        </TouchableOpacity>

        <Text variant="labelMedium" color="secondary">
          {currentPage} / {totalPages}
        </Text>

        <TouchableOpacity
          style={[styles.compactButton, !canGoNext && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={!canGoNext}
          activeOpacity={activeOpacity.medium}
        >
          <Ionicons
            name="chevron-forward"
            size={iconSizes.md}
            color={canGoNext ? theme.color.icon.default : theme.color.icon.disabled}
          />
        </TouchableOpacity>
      </View>
    );
  }

  // Simple variant - Sin info adicional
  if (variant === 'simple') {
    return (
      <View onLayout={onFooterLayout} style={[styles.simpleContainer, style]}>
        <TouchableOpacity
          style={[styles.navButton, !canGoPrevious && styles.buttonDisabled]}
          onPress={handlePrevious}
          disabled={!canGoPrevious}
          activeOpacity={activeOpacity.medium}
        >
          <Ionicons
            name="chevron-back"
            size={iconSizes.sm}
            color={canGoPrevious ? theme.color.icon.inverse : theme.color.icon.disabled}
          />
          <Text
            variant="buttonSmall"
            color={canGoPrevious ? theme.color.text.onAction : theme.color.text.disabled}
            style={styles.navButtonText}
          >
            Anterior
          </Text>
        </TouchableOpacity>

        <View style={styles.pageIndicator}>
          <Text variant="labelMedium" color="primary">
            Página {currentPage} de {totalPages}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.navButton, !canGoNext && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={!canGoNext}
          activeOpacity={activeOpacity.medium}
        >
          <Text
            variant="buttonSmall"
            color={canGoNext ? theme.color.text.onAction : theme.color.text.disabled}
            style={styles.navButtonText}
          >
            Siguiente
          </Text>
          <Ionicons
            name="chevron-forward"
            size={iconSizes.sm}
            color={canGoNext ? theme.color.icon.inverse : theme.color.icon.disabled}
          />
        </TouchableOpacity>
      </View>
    );
  }

  // Full variant - Con toda la información
  return (
    <View onLayout={onFooterLayout} style={[styles.container, theme.shadow.xs, style]}>
      {/* Previous Button */}
      <TouchableOpacity
        style={[styles.navButton, !canGoPrevious && styles.buttonDisabled]}
        onPress={handlePrevious}
        disabled={!canGoPrevious}
        activeOpacity={activeOpacity.medium}
      >
        <Ionicons
          name="chevron-back"
          size={iconSizes.sm}
          color={canGoPrevious ? theme.color.icon.inverse : theme.color.icon.disabled}
        />
        <Text
          variant="buttonSmall"
          color={canGoPrevious ? theme.color.text.onAction : theme.color.text.disabled}
          style={styles.navButtonText}
        >
          Anterior
        </Text>
      </TouchableOpacity>

      {/* Center Info */}
      <View style={styles.centerInfo}>
        <Text variant="titleSmall" color="primary">
          Página {currentPage} de {totalPages}
        </Text>
        {totalItems !== undefined && itemsPerPage !== undefined && (
          <Text variant="caption" color="tertiary" style={styles.itemsInfo}>
            {Math.min(currentPage * itemsPerPage, totalItems)} de {totalItems} registros
          </Text>
        )}
      </View>

      {/* Next Button */}
      <TouchableOpacity
        style={[styles.navButton, !canGoNext && styles.buttonDisabled]}
        onPress={handleNext}
        disabled={!canGoNext}
        activeOpacity={activeOpacity.medium}
      >
        <Text
          variant="buttonSmall"
          color={canGoNext ? theme.color.text.onAction : theme.color.text.disabled}
          style={styles.navButtonText}
        >
          Siguiente
        </Text>
        <Ionicons
          name="chevron-forward"
          size={iconSizes.sm}
          color={canGoNext ? theme.color.icon.inverse : theme.color.icon.disabled}
        />
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // Full variant
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.color.surface.base,
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
    },

    navButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.action.primary.background,
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[3],
      borderRadius: theme.radii.md,
      minWidth: 110,
    },

    buttonDisabled: {
      backgroundColor: theme.color.action.primary.backgroundDisabled,
    },

    navButtonText: {
      marginHorizontal: theme.space[1],
    },

    centerInfo: {
      alignItems: 'center',
      flex: 1,
      paddingHorizontal: theme.space[2],
    },

    itemsInfo: {
      marginTop: theme.space[0.5],
    },

    // Simple variant
    simpleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
      backgroundColor: theme.color.surface.base,
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
    },

    pageIndicator: {
      alignItems: 'center',
    },

    // Compact variant
    compactContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[3],
      paddingVertical: theme.space[2],
    },

    compactButton: {
      padding: theme.space[2],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.subtle,
    },
  });

export default Pagination;
