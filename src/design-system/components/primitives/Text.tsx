/**
 * Text Component
 *
 * Componente de texto con variantes tipográficas predefinidas.
 */

import React from 'react';
import { Text as RNText, TextProps as RNTextProps, TextStyle } from 'react-native';
import { textVariants, TextVariantKey } from '../../tokens/typography';
import { useTheme } from '../../themes';

// Aliases de compatibilidad: nombres legacy → llaves del theme actual.
const TEXT_COLOR_ALIASES: Record<string, string> = {
  primary: 'body',
  secondary: 'muted',
  tertiary: 'subtle',
};

export type TextColorName =
  | 'heading'
  | 'body'
  | 'muted'
  | 'subtle'
  | 'disabled'
  | 'placeholder'
  | 'inverse'
  | 'link'
  | 'success'
  | 'warning'
  | 'danger'
  | 'onAction'
  // Aliases legacy soportados
  | 'primary'
  | 'secondary'
  | 'tertiary';

export interface TextProps extends RNTextProps {
  /**
   * Variante tipográfica predefinida
   */
  variant?: TextVariantKey;

  /**
   * Color del texto (nombre del theme o string crudo)
   */
  color?: TextColorName | string;

  /**
   * Alineación del texto
   */
  align?: 'left' | 'center' | 'right' | 'auto';

  /**
   * Si el texto debe ser seleccionable
   */
  selectable?: boolean;

  /**
   * Children
   */
  children: React.ReactNode;
}

export const Text: React.FC<TextProps> = ({
  variant = 'bodyMedium',
  color = 'body',
  align = 'auto',
  selectable = false,
  style,
  children,
  ...props
}) => {
  const theme = useTheme();
  const variantStyle = textVariants[variant];

  const resolvedKey = TEXT_COLOR_ALIASES[color] ?? color;
  const themeColors = theme.color.text as Record<string, string>;
  const colorValue = themeColors[resolvedKey] ?? color;

  const textStyle: TextStyle = {
    ...variantStyle,
    color: colorValue,
    textAlign: align,
  };

  return (
    <RNText style={[textStyle, style]} selectable={selectable} {...props}>
      {children}
    </RNText>
  );
};

// ============================================
// SEMANTIC TEXT COMPONENTS
// ============================================

export const DisplayText: React.FC<
  Omit<TextProps, 'variant'> & { size?: 'small' | 'medium' | 'large' }
> = ({ size = 'medium', ...props }) => {
  const variants: Record<string, TextVariantKey> = {
    small: 'displaySmall',
    medium: 'displayMedium',
    large: 'displayLarge',
  };
  return <Text variant={variants[size]} {...props} />;
};

export const Heading: React.FC<
  Omit<TextProps, 'variant'> & { size?: 'small' | 'medium' | 'large' }
> = ({ size = 'medium', ...props }) => {
  const variants: Record<string, TextVariantKey> = {
    small: 'headingSmall',
    medium: 'headingMedium',
    large: 'headingLarge',
  };
  return <Text variant={variants[size]} {...props} />;
};

export const Title: React.FC<
  Omit<TextProps, 'variant'> & { size?: 'small' | 'medium' | 'large' }
> = ({ size = 'medium', ...props }) => {
  const variants: Record<string, TextVariantKey> = {
    small: 'titleSmall',
    medium: 'titleMedium',
    large: 'titleLarge',
  };
  return <Text variant={variants[size]} {...props} />;
};

export const Body: React.FC<
  Omit<TextProps, 'variant'> & { size?: 'small' | 'medium' | 'large' }
> = ({ size = 'medium', ...props }) => {
  const variants: Record<string, TextVariantKey> = {
    small: 'bodySmall',
    medium: 'bodyMedium',
    large: 'bodyLarge',
  };
  return <Text variant={variants[size]} {...props} />;
};

export const Label: React.FC<
  Omit<TextProps, 'variant'> & { size?: 'small' | 'medium' | 'large' }
> = ({ size = 'medium', color = 'secondary', ...props }) => {
  const variants: Record<string, TextVariantKey> = {
    small: 'labelSmall',
    medium: 'labelMedium',
    large: 'labelLarge',
  };
  return <Text variant={variants[size]} color={color} {...props} />;
};

export const Caption: React.FC<Omit<TextProps, 'variant'>> = ({ color = 'tertiary', ...props }) => {
  return <Text variant="caption" color={color} {...props} />;
};

export const Numeric: React.FC<
  Omit<TextProps, 'variant'> & { size?: 'small' | 'medium' | 'large' }
> = ({ size = 'medium', ...props }) => {
  const variants: Record<string, TextVariantKey> = {
    small: 'numericSmall',
    medium: 'numericMedium',
    large: 'numericLarge',
  };
  return <Text variant={variants[size]} {...props} />;
};

export default Text;
