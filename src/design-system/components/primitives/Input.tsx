/**
 * Input Component
 *
 * Campo de entrada de texto con estados y variantes.
 */

import React, { useState, forwardRef } from 'react';
import {
  View,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { iconSizes } from '../../tokens/spacing';
import { useTheme, useThemedStyles } from '../../themes';
import type { Theme } from '../../themes';
import { activeOpacity } from '../../tokens/animations';

export type InputSize = 'small' | 'medium' | 'large';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  /**
   * Etiqueta del campo
   */
  label?: string;

  /**
   * Texto de ayuda bajo el campo
   */
  helperText?: string;

  /**
   * Mensaje de error
   */
  error?: string;

  /**
   * Tamaño del input
   */
  size?: InputSize;

  /**
   * Icono a la izquierda
   */
  leftIcon?: keyof typeof Ionicons.glyphMap;

  /**
   * Icono a la derecha (o botón)
   */
  rightIcon?: keyof typeof Ionicons.glyphMap;

  /**
   * Callback al presionar icono derecho
   */
  onRightIconPress?: () => void;

  /**
   * Si el campo es obligatorio
   */
  required?: boolean;

  /**
   * Estilos del contenedor
   */
  containerStyle?: ViewStyle;

  /**
   * Estilos del input
   */
  inputStyle?: TextStyle;

  /**
   * Si el input está deshabilitado
   */
  disabled?: boolean;
}

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      helperText,
      error,
      size = 'medium',
      leftIcon,
      rightIcon,
      onRightIconPress,
      required = false,
      containerStyle,
      inputStyle,
      disabled = false,
      editable = true,
      secureTextEntry,
      ...props
    },
    ref
  ) => {
    const theme = useTheme();
    const styles = useThemedStyles(createStyles);
    const [isFocused, setIsFocused] = useState(false);
    const [isSecure, setIsSecure] = useState(secureTextEntry);

    const hasError = !!error;
    const isEditable = editable && !disabled;

    const inputContainerStyles = [
      styles.inputContainer,
      styles[`size_${size}`],
      isFocused && styles.inputContainerFocused,
      hasError && styles.inputContainerError,
      disabled && styles.inputContainerDisabled,
    ];

    const inputStyles = [
      styles.input,
      styles[`inputText_${size}`],
      leftIcon && styles.inputWithLeftIcon,
      (rightIcon || secureTextEntry) && styles.inputWithRightIcon,
      disabled && styles.inputDisabled,
      inputStyle,
    ];

    const handleFocus = (e: any) => {
      setIsFocused(true);
      props.onFocus?.(e);
    };

    const handleBlur = (e: any) => {
      setIsFocused(false);
      props.onBlur?.(e);
    };

    const toggleSecure = () => {
      setIsSecure(!isSecure);
    };

    const getIconColor = (): string => {
      if (disabled) return theme.color.icon.disabled;
      if (hasError) return theme.color.icon.danger;
      if (isFocused) return theme.color.icon.default;
      return theme.color.icon.subtle;
    };

    return (
      <View style={[styles.container, containerStyle]}>
        {/* Label */}
        {label && (
          <View style={styles.labelContainer}>
            <Text variant="labelMedium" color="secondary">
              {label}
            </Text>
            {required && (
              <Text variant="labelMedium" color={theme.color.text.danger}>
                {' *'}
              </Text>
            )}
          </View>
        )}

        {/* Input Container */}
        <View style={inputContainerStyles}>
          {/* Left Icon */}
          {leftIcon && (
            <View style={styles.leftIconContainer}>
              <Ionicons name={leftIcon} size={iconSizes.md} color={getIconColor()} />
            </View>
          )}

          {/* TextInput */}
          <TextInput
            ref={ref}
            style={inputStyles}
            placeholderTextColor={theme.color.text.placeholder}
            editable={isEditable}
            secureTextEntry={isSecure}
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...props}
          />

          {/* Right Icon / Password Toggle */}
          {secureTextEntry ? (
            <TouchableOpacity
              style={styles.rightIconContainer}
              onPress={toggleSecure}
              activeOpacity={activeOpacity.medium}
            >
              <Ionicons
                name={isSecure ? 'eye-outline' : 'eye-off-outline'}
                size={iconSizes.md}
                color={getIconColor()}
              />
            </TouchableOpacity>
          ) : rightIcon ? (
            <TouchableOpacity
              style={styles.rightIconContainer}
              onPress={onRightIconPress}
              disabled={!onRightIconPress}
              activeOpacity={onRightIconPress ? activeOpacity.medium : 1}
            >
              <Ionicons name={rightIcon} size={iconSizes.md} color={getIconColor()} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Helper Text / Error */}
        {(helperText || error) && (
          <Text
            variant="caption"
            color={hasError ? 'danger' : 'tertiary'}
            style={styles.helperText}
          >
            {error || helperText}
          </Text>
        )}
      </View>
    );
  }
);

Input.displayName = 'Input';

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      marginBottom: theme.space[4],
    },

    // ============================================
    // LABEL STYLES
    // ============================================
    labelContainer: {
      flexDirection: 'row',
      marginBottom: theme.space[1.5],
    },

    // ============================================
    // INPUT CONTAINER STYLES
    // ============================================
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.surface.base,
      borderWidth: 1.5,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.md,
      overflow: 'hidden',
    },

    inputContainerFocused: {
      borderColor: theme.color.border.focus,
      backgroundColor: theme.color.surface.base,
    },

    inputContainerError: {
      borderColor: theme.color.border.error,
      backgroundColor: theme.color.state.danger.background,
    },

    inputContainerDisabled: {
      backgroundColor: theme.color.surface.disabled,
      borderColor: theme.color.border.subtle,
    },

    // ============================================
    // SIZE STYLES
    // ============================================
    size_small: {
      minHeight: 40,
    },

    size_medium: {
      minHeight: 48,
    },

    size_large: {
      minHeight: 56,
    },

    // ============================================
    // INPUT STYLES
    // ============================================
    input: {
      flex: 1,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
      color: theme.color.text.body,
    },

    inputText_small: {
      ...theme.text.bodySmall,
    },

    inputText_medium: {
      ...theme.text.bodyMedium,
    },

    inputText_large: {
      ...theme.text.bodyLarge,
    },

    inputWithLeftIcon: {
      paddingLeft: theme.space[1],
    },

    inputWithRightIcon: {
      paddingRight: theme.space[1],
    },

    inputDisabled: {
      color: theme.color.text.disabled,
    },

    // ============================================
    // ICON STYLES
    // ============================================
    leftIconContainer: {
      paddingLeft: theme.space[3],
      justifyContent: 'center',
      alignItems: 'center',
    },

    rightIconContainer: {
      paddingRight: theme.space[3],
      justifyContent: 'center',
      alignItems: 'center',
      minWidth: 44,
      minHeight: 44,
    },

    // ============================================
    // HELPER TEXT STYLES
    // ============================================
    helperText: {
      marginTop: theme.space[1],
      marginLeft: theme.space[1],
    },
  });

export default Input;
