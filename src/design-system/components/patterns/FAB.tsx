/**
 * FAB (Floating Action Button) Component
 *
 * Botón de acción flotante.
 */

import React, { useState, useRef, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../primitives/Text';
import { iconSizes } from '../../tokens/spacing';
import { activeOpacity, springConfigs, durations } from '../../tokens/animations';
import { useTheme, useThemedStyles } from '../../themes';
import type { Theme } from '../../themes';

export type FABSize = 'small' | 'medium' | 'large';
export type FABVariant = 'primary' | 'secondary' | 'surface';

export interface FABProps {
  /**
   * Icono del FAB
   */
  icon: keyof typeof Ionicons.glyphMap;

  /**
   * Callback al presionar
   */
  onPress: () => void;

  /**
   * Etiqueta opcional (extended FAB)
   */
  label?: string;

  /**
   * Tamaño
   */
  size?: FABSize;

  /**
   * Variante de color
   */
  variant?: FABVariant;

  /**
   * Si está deshabilitado
   */
  disabled?: boolean;

  /**
   * Posición
   */
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';

  /**
   * Estilos adicionales
   */
  style?: ViewStyle;

  /**
   * TestID
   */
  testID?: string;
}

export const FAB: React.FC<FABProps> = ({
  icon,
  onPress,
  label,
  size = 'medium',
  variant = 'primary',
  disabled = false,
  position = 'bottom-right',
  style,
  testID,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      ...springConfigs.stiff,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      ...springConfigs.bouncy,
    }).start();
  };

  const getSize = (): number => {
    switch (size) {
      case 'small':
        return 40;
      case 'large':
        return 64;
      default:
        return 56;
    }
  };

  const getIconSize = (): number => {
    switch (size) {
      case 'small':
        return iconSizes.md;
      case 'large':
        return iconSizes['2xl'];
      default:
        return iconSizes.lg;
    }
  };

  const getBackgroundColor = (): string => {
    if (disabled) return theme.color.action.primary.backgroundDisabled;
    switch (variant) {
      case 'secondary':
        return theme.color.brand.accent;
      case 'surface':
        return theme.color.surface.base;
      default:
        return theme.color.action.primary.background;
    }
  };

  const getIconColor = (): string => {
    if (disabled) return theme.color.text.disabled;
    switch (variant) {
      case 'surface':
        return theme.color.icon.default;
      default:
        return theme.color.icon.inverse;
    }
  };

  const fabSize = getSize();

  const positionKey = `position_${position.replace('-', '_')}` as keyof typeof styles;
  const containerStyles = [styles.container, styles[positionKey], style];

  const fabStyles = [
    styles.fab,
    {
      width: label ? undefined : fabSize,
      height: fabSize,
      borderRadius: label ? theme.radii.xl : fabSize / 2,
      backgroundColor: getBackgroundColor(),
    },
    variant !== 'surface' && theme.shadow['2xl'],
    variant === 'surface' && theme.shadow.lg,
    label && styles.extended,
  ];

  return (
    <View style={containerStyles}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={fabStyles}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
          activeOpacity={1}
          testID={testID}
        >
          <Ionicons name={icon} size={getIconSize()} color={getIconColor()} />
          {label && (
            <Text
              variant="buttonMedium"
              color={variant === 'surface' ? 'primary' : theme.color.text.onAction}
              style={styles.label}
            >
              {label}
            </Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

// ============================================
// FAB GROUP (Multiple actions)
// ============================================
export interface FABAction {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}

export interface FABGroupProps {
  /**
   * Icono principal
   */
  icon: keyof typeof Ionicons.glyphMap;

  /**
   * Icono cuando está abierto
   */
  openIcon?: keyof typeof Ionicons.glyphMap;

  /**
   * Acciones disponibles
   */
  actions: FABAction[];

  /**
   * Variante de color
   */
  variant?: FABVariant;

  /**
   * Estilos adicionales
   */
  style?: ViewStyle;
}

export const FABGroup: React.FC<FABGroupProps> = ({
  icon,
  openIcon = 'close',
  actions,
  variant = 'primary',
  style,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [isOpen, setIsOpen] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const actionAnimations = useRef(actions.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // Rotate main FAB
    Animated.timing(rotateAnim, {
      toValue: isOpen ? 1 : 0,
      duration: durations.fast,
      useNativeDriver: true,
    }).start();

    // Animate actions
    const animations = actions.map((_, index) =>
      Animated.spring(actionAnimations[index], {
        toValue: isOpen ? 1 : 0,
        ...springConfigs.stiff,
        delay: isOpen ? index * 50 : (actions.length - index - 1) * 50,
        useNativeDriver: true,
      })
    );

    Animated.parallel(animations).start();
  }, [isOpen]);

  const toggleOpen = () => setIsOpen(!isOpen);

  const handleActionPress = (action: FABAction) => {
    setIsOpen(false);
    setTimeout(action.onPress, 150);
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <>
      {/* Backdrop - Cubre toda la pantalla */}
      {isOpen && (
        <TouchableOpacity
          style={styles.backdrop}
          onPress={() => setIsOpen(false)}
          activeOpacity={1}
        />
      )}

      {/* FAB Group Container - Posición fija en pantalla */}
      <View style={[styles.groupContainer, style]}>
        {/* Actions - Encima del botón principal */}
        {isOpen &&
          actions.map((action, index) => (
            <Animated.View
              key={index}
              style={[
                styles.actionContainer,
                {
                  opacity: actionAnimations[index],
                  transform: [
                    {
                      translateY: actionAnimations[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [30, 0],
                      }),
                    },
                    {
                      scale: actionAnimations[index],
                    },
                  ],
                },
              ]}
            >
              <View style={styles.actionLabel}>
                <Text variant="labelMedium" color="primary">
                  {action.label}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.actionFab, theme.shadow.md]}
                onPress={() => handleActionPress(action)}
                activeOpacity={activeOpacity.medium}
              >
                <Ionicons name={action.icon} size={iconSizes.md} color={theme.color.icon.default} />
              </TouchableOpacity>
            </Animated.View>
          ))}

        {/* Main FAB Button - Creado directamente sin usar componente FAB */}
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <TouchableOpacity
            style={[
              styles.mainFabButton,
              variant === 'primary' && { backgroundColor: theme.color.action.primary.background },
              variant === 'secondary' && { backgroundColor: theme.color.brand.accent },
              variant === 'surface' && { backgroundColor: theme.color.surface.base },
              theme.shadow['2xl'],
            ]}
            onPress={toggleOpen}
            activeOpacity={activeOpacity.medium}
          >
            <Ionicons
              name={isOpen ? openIcon : icon}
              size={iconSizes.lg}
              color={variant === 'surface' ? theme.color.icon.default : theme.color.icon.inverse}
            />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      zIndex: 1100, // Más alto que FloatingActionButton (1000)
      elevation: 15, // Android elevation
    },

    position_bottom_right: {
      bottom: 90, // Encima del FloatingActionButton del drawer (20 + 60 + 10 gap)
      right: 20, // Mismo right que FloatingActionButton
    },

    position_bottom_left: {
      bottom: 90,
      left: 20,
    },

    position_bottom_center: {
      bottom: 90,
      left: 0,
      right: 0,
      alignItems: 'center',
    },

    fab: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },

    extended: {
      paddingHorizontal: theme.space[4],
    },

    label: {
      marginLeft: theme.space[2],
    },

    // FAB Group styles
    groupContainer: {
      position: 'absolute',
      bottom: 90,
      right: 20,
      alignItems: 'flex-end',
      zIndex: 1100,
      elevation: 15,
    },

    mainFabButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },

    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.color.overlay.subtle,
      zIndex: 1050, // Entre el FloatingActionButton (1000) y el FABGroup (1100)
      elevation: 14,
    },

    actionContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.space[3],
    },

    actionLabel: {
      backgroundColor: theme.color.surface.base,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1.5],
      borderRadius: theme.radii.sm,
      marginRight: theme.space[3],
      ...theme.shadow.sm,
    },

    actionFab: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.color.surface.base,
      alignItems: 'center',
      justifyContent: 'center',
    },

    mainFab: {
      // No position since it's relative to group
    },
  });

export default FAB;
