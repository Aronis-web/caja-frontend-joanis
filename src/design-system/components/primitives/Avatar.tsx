/**
 * Avatar Component
 *
 * Avatar para usuarios con imagen o iniciales.
 */

import React from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { colors } from '../../tokens/colors';
import { avatarSizes, borderRadius, iconSizes } from '../../tokens/spacing';
import { useTheme, useThemedStyles } from '../../themes';
import type { Theme } from '../../themes';

export type AvatarSize = 'xs' | 'small' | 'medium' | 'large' | 'xl' | '2xl';

export interface AvatarProps {
  /**
   * URL de la imagen
   */
  source?: string;

  /**
   * Nombre para generar iniciales
   */
  name?: string;

  /**
   * Tamaño del avatar
   */
  size?: AvatarSize;

  /**
   * Si es cuadrado en vez de circular
   */
  square?: boolean;

  /**
   * Color de fondo personalizado
   */
  backgroundColor?: string;

  /**
   * Estilos adicionales
   */
  style?: ViewStyle;
}

const sizeMap: Record<AvatarSize, keyof typeof avatarSizes> = {
  xs: 'xs',
  small: 'sm',
  medium: 'md',
  large: 'lg',
  xl: 'xl',
  '2xl': '2xl',
};

const getInitials = (name: string): string => {
  const words = name.trim().split(' ').filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
};

const getBackgroundColor = (name: string): string => {
  // Generar un color consistente basado en el nombre
  const colorOptions = [
    colors.primary[700],
    colors.accent[600],
    colors.success[600],
    colors.warning[600],
    colors.info[600],
    colors.primary[500],
    colors.accent[500],
    colors.success[500],
  ];

  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colorOptions[hash % colorOptions.length];
};

export const Avatar: React.FC<AvatarProps> = ({
  source,
  name,
  size = 'medium',
  square = false,
  backgroundColor,
  style,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const dimension = avatarSizes[sizeMap[size]];
  const radius = square ? borderRadius.md : dimension / 2;

  const getFontSize = (): number => {
    switch (size) {
      case 'xs':
        return 10;
      case 'small':
        return 12;
      case 'medium':
        return 14;
      case 'large':
        return 18;
      case 'xl':
        return 22;
      case '2xl':
        return 28;
      default:
        return 14;
    }
  };

  const getIconSize = (): number => {
    switch (size) {
      case 'xs':
        return iconSizes.xs;
      case 'small':
        return iconSizes.sm;
      case 'medium':
        return iconSizes.md;
      case 'large':
        return iconSizes.lg;
      case 'xl':
        return iconSizes.xl;
      case '2xl':
        return iconSizes['2xl'];
      default:
        return iconSizes.md;
    }
  };

  const containerStyles = [
    styles.container,
    {
      width: dimension,
      height: dimension,
      borderRadius: radius,
      backgroundColor:
        backgroundColor || (name ? getBackgroundColor(name) : theme.color.surface.muted),
    },
    style,
  ];

  // Si hay imagen
  if (source) {
    return (
      <View style={containerStyles}>
        <Image
          source={{ uri: source }}
          style={[
            styles.image,
            {
              width: dimension,
              height: dimension,
              borderRadius: radius,
            },
          ]}
        />
      </View>
    );
  }

  // Si hay nombre, mostrar iniciales
  if (name) {
    return (
      <View style={containerStyles}>
        <Text
          variant="titleMedium"
          color={theme.color.text.onAction}
          style={{ fontSize: getFontSize() }}
        >
          {getInitials(name)}
        </Text>
      </View>
    );
  }

  // Fallback: icono de persona
  return (
    <View style={containerStyles}>
      <Ionicons name="person" size={getIconSize()} color={theme.color.icon.inverse} />
    </View>
  );
};

// ============================================
// AVATAR GROUP
// ============================================
export interface AvatarGroupProps {
  /**
   * Lista de avatares
   */
  avatars: Array<{ source?: string; name?: string }>;

  /**
   * Máximo de avatares a mostrar
   */
  max?: number;

  /**
   * Tamaño de los avatares
   */
  size?: AvatarSize;

  /**
   * Estilos adicionales
   */
  style?: ViewStyle;
}

export const AvatarGroup: React.FC<AvatarGroupProps> = ({
  avatars,
  max = 4,
  size = 'medium',
  style,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const visibleAvatars = avatars.slice(0, max);
  const remainingCount = avatars.length - max;
  const dimension = avatarSizes[sizeMap[size]];
  const overlap = dimension * 0.3;

  return (
    <View style={[styles.group, style]}>
      {visibleAvatars.map((avatar, index) => (
        <View
          key={index}
          style={[
            styles.groupItem,
            {
              marginLeft: index === 0 ? 0 : -overlap,
              zIndex: visibleAvatars.length - index,
            },
          ]}
        >
          <Avatar
            source={avatar.source}
            name={avatar.name}
            size={size}
            style={styles.groupAvatar}
          />
        </View>
      ))}
      {remainingCount > 0 && (
        <View
          style={[
            styles.groupItem,
            {
              marginLeft: -overlap,
              zIndex: 0,
            },
          ]}
        >
          <View
            style={[
              styles.container,
              styles.groupAvatar,
              {
                width: dimension,
                height: dimension,
                borderRadius: dimension / 2,
                backgroundColor: theme.color.surface.muted,
              },
            ]}
          >
            <Text variant="labelSmall" color="secondary">
              +{remainingCount}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },

    image: {
      resizeMode: 'cover',
    },

    // Group styles
    group: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    groupItem: {
      // Position for overlap effect
    },

    groupAvatar: {
      borderWidth: 2,
      borderColor: theme.color.surface.base,
    },
  });

export default Avatar;
