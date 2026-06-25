/**
 * EmptyState Component
 *
 * Estado vacío para listas y pantallas sin datos.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../primitives/Text';
import { Button } from '../primitives/Button';
import { iconSizes } from '../../tokens/spacing';
import { useTheme, useThemedStyles } from '../../themes';
import type { Theme } from '../../themes';

export interface EmptyStateProps {
  /**
   * Icono a mostrar
   */
  icon?: keyof typeof Ionicons.glyphMap;

  /**
   * Emoji alternativo al icono
   */
  emoji?: string;

  /**
   * Título principal
   */
  title: string;

  /**
   * Descripción secundaria
   */
  description?: string;

  /**
   * Texto del botón de acción
   */
  actionLabel?: string;

  /**
   * Callback del botón de acción
   */
  onAction?: () => void;

  /**
   * Variante de tamaño
   */
  size?: 'small' | 'medium' | 'large';

  /**
   * Estilos adicionales
   */
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  emoji,
  title,
  description,
  actionLabel,
  onAction,
  size = 'medium',
  style,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const getIconSize = (): number => {
    switch (size) {
      case 'small':
        return iconSizes['3xl'];
      case 'large':
        return iconSizes['4xl'] + 16;
      default:
        return iconSizes['4xl'];
    }
  };

  const getEmojiSize = (): number => {
    switch (size) {
      case 'small':
        return 40;
      case 'large':
        return 72;
      default:
        return 56;
    }
  };

  return (
    <View style={[styles.container, styles[`container_${size}`], style]}>
      {/* Icon or Emoji */}
      <View style={[styles.iconContainer, styles[`iconContainer_${size}`]]}>
        {emoji ? (
          <Text style={{ fontSize: getEmojiSize() }}>{emoji}</Text>
        ) : icon ? (
          <View style={styles.iconBackground}>
            <Ionicons name={icon} size={getIconSize()} color={theme.color.icon.subtle} />
          </View>
        ) : (
          <View style={styles.iconBackground}>
            <Ionicons
              name="folder-open-outline"
              size={getIconSize()}
              color={theme.color.icon.subtle}
            />
          </View>
        )}
      </View>

      {/* Title */}
      <Text
        variant={size === 'large' ? 'headingMedium' : 'titleMedium'}
        color="primary"
        align="center"
        style={styles.title}
      >
        {title}
      </Text>

      {/* Description */}
      {description && (
        <Text variant="bodyMedium" color="secondary" align="center" style={styles.description}>
          {description}
        </Text>
      )}

      {/* Action Button */}
      {actionLabel && onAction && (
        <View style={styles.actionContainer}>
          <Button
            title={actionLabel}
            onPress={onAction}
            variant="primary"
            size={size === 'small' ? 'small' : 'medium'}
          />
        </View>
      )}
    </View>
  );
};

// ============================================
// ERROR STATE
// ============================================
export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  style?: ViewStyle;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Algo salió mal',
  description = 'No pudimos cargar la información. Por favor intenta de nuevo.',
  onRetry,
  retryLabel = 'Reintentar',
  style,
}) => {
  return (
    <EmptyState
      icon="alert-circle-outline"
      title={title}
      description={description}
      actionLabel={onRetry ? retryLabel : undefined}
      onAction={onRetry}
      style={style}
    />
  );
};

// ============================================
// NO RESULTS STATE
// ============================================
export interface NoResultsStateProps {
  searchTerm?: string;
  onClear?: () => void;
  style?: ViewStyle;
}

export const NoResultsState: React.FC<NoResultsStateProps> = ({ searchTerm, onClear, style }) => {
  return (
    <EmptyState
      icon="search-outline"
      title="Sin resultados"
      description={
        searchTerm
          ? `No encontramos resultados para "${searchTerm}"`
          : 'No hay coincidencias con tu búsqueda'
      }
      actionLabel={onClear ? 'Limpiar búsqueda' : undefined}
      onAction={onClear}
      size="small"
      style={style}
    />
  );
};

// ============================================
// NO CONNECTION STATE
// ============================================
export interface NoConnectionStateProps {
  onRetry?: () => void;
  style?: ViewStyle;
}

export const NoConnectionState: React.FC<NoConnectionStateProps> = ({ onRetry, style }) => {
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title="Sin conexión"
      description="Verifica tu conexión a internet e intenta de nuevo"
      actionLabel={onRetry ? 'Reintentar' : undefined}
      onAction={onRetry}
      style={style}
    />
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
    },

    container_small: {
      padding: theme.space[4],
    },

    container_medium: {
      padding: theme.space[6],
    },

    container_large: {
      padding: theme.space[8],
    },

    iconContainer: {
      marginBottom: theme.space[4],
    },

    iconContainer_small: {
      marginBottom: theme.space[3],
    },

    iconContainer_medium: {
      marginBottom: theme.space[4],
    },

    iconContainer_large: {
      marginBottom: theme.space[6],
    },

    iconBackground: {
      backgroundColor: theme.color.surface.muted,
      borderRadius: 9999,
      padding: theme.space[4],
    },

    title: {
      marginBottom: theme.space[2],
    },

    description: {
      maxWidth: 300,
      marginBottom: theme.space[4],
    },

    actionContainer: {
      marginTop: theme.space[2],
    },
  });

export default EmptyState;
