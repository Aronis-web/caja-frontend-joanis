/**
 * ScreenContainer Component
 *
 * Contenedor base para pantallas con configuraciones comunes.
 */

import React from 'react';
import {
  View,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ViewStyle,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { spacing } from '../../tokens/spacing';
import { useTheme, useThemedStyles } from '../../themes';
import type { Theme } from '../../themes';
import { Text } from '../primitives/Text';

export interface ScreenContainerProps {
  /**
   * Contenido de la pantalla
   */
  children: React.ReactNode;

  /**
   * Color de fondo
   */
  backgroundColor?: string;

  /**
   * Si es scrolleable
   */
  scroll?: boolean;

  /**
   * Padding horizontal
   */
  padding?: 'none' | 'small' | 'medium' | 'large';

  /**
   * Si muestra RefreshControl
   */
  refreshing?: boolean;

  /**
   * Callback al hacer pull to refresh
   */
  onRefresh?: () => void;

  /**
   * Edges de SafeArea a aplicar
   */
  safeAreaEdges?: Edge[];

  /**
   * Si evita el teclado
   */
  keyboardAvoiding?: boolean;

  /**
   * Estilos adicionales del contenedor
   */
  style?: ViewStyle;

  /**
   * Estilos adicionales del contenido
   */
  contentContainerStyle?: ViewStyle;

  /**
   * Header component
   */
  header?: React.ReactNode;

  /**
   * Footer component (sticky al fondo)
   */
  footer?: React.ReactNode;

  /**
   * TestID
   */
  testID?: string;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  children,
  backgroundColor,
  scroll = false,
  padding = 'medium',
  refreshing = false,
  onRefresh,
  safeAreaEdges = ['top'],
  keyboardAvoiding = false,
  style,
  contentContainerStyle,
  header,
  footer,
  testID,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const resolvedBackground = backgroundColor ?? theme.color.background.subtle;
  const getPadding = () => {
    switch (padding) {
      case 'none':
        return 0;
      case 'small':
        return spacing[3];
      case 'large':
        return spacing[6];
      default:
        return spacing[4];
    }
  };

  const paddingValue = getPadding();

  const renderContent = () => {
    if (scroll) {
      return (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            {
              paddingHorizontal: paddingValue,
              paddingBottom: footer ? spacing[20] : spacing[6],
            },
            contentContainerStyle,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.color.brand.primary}
                colors={[theme.color.brand.primary]}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      );
    }

    return (
      <View
        style={[
          styles.staticContent,
          {
            paddingHorizontal: paddingValue,
          },
          contentContainerStyle,
        ]}
      >
        {children}
      </View>
    );
  };

  const content = (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: resolvedBackground }, style]}
      edges={safeAreaEdges}
      testID={testID}
    >
      {header}
      {renderContent()}
      {footer && <View style={styles.footer}>{footer}</View>}
    </SafeAreaView>
  );

  if (keyboardAvoiding) {
    return (
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {content}
      </KeyboardAvoidingView>
    );
  }

  return content;
};

// ============================================
// SECTION (Para agrupar contenido)
// ============================================
export interface SectionProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  style?: ViewStyle;
}

export const Section: React.FC<SectionProps> = ({ children, title, subtitle, action, style }) => {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.section, style]}>
      {(title || action) && (
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            {title && (
              <Text variant="titleMedium" color="primary">
                {title}
              </Text>
            )}
            {subtitle && (
              <Text variant="caption" color="tertiary" style={styles.sectionSubtitle}>
                {subtitle}
              </Text>
            )}
          </View>
          {action}
        </View>
      )}
      {children}
    </View>
  );
};

// ============================================
// ROW (Fila horizontal)
// ============================================
export interface RowProps {
  children: React.ReactNode;
  align?: 'start' | 'center' | 'end' | 'between' | 'around';
  verticalAlign?: 'start' | 'center' | 'end';
  gap?: 'none' | 'small' | 'medium' | 'large';
  wrap?: boolean;
  style?: ViewStyle;
}

export const Row: React.FC<RowProps> = ({
  children,
  align = 'start',
  verticalAlign = 'center',
  gap = 'medium',
  wrap = false,
  style,
}) => {
  const styles = useThemedStyles(createStyles);
  const alignMap: Record<string, ViewStyle['justifyContent']> = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
    between: 'space-between',
    around: 'space-around',
  };

  const verticalAlignMap: Record<string, ViewStyle['alignItems']> = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
  };

  const gapMap: Record<string, number> = {
    none: 0,
    small: spacing[2],
    medium: spacing[3],
    large: spacing[4],
  };

  return (
    <View
      style={[
        styles.row,
        {
          justifyContent: alignMap[align],
          alignItems: verticalAlignMap[verticalAlign],
          gap: gapMap[gap],
          flexWrap: wrap ? 'wrap' : 'nowrap',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

// ============================================
// SPACER
// ============================================
export interface SpacerProps {
  size?: 'xs' | 'small' | 'medium' | 'large' | 'xl';
  horizontal?: boolean;
}

export const Spacer: React.FC<SpacerProps> = ({ size = 'medium', horizontal = false }) => {
  const sizeMap: Record<string, number> = {
    xs: spacing[2],
    small: spacing[3],
    medium: spacing[4],
    large: spacing[6],
    xl: spacing[8],
  };

  const dimension = sizeMap[size];

  return (
    <View
      style={{
        width: horizontal ? dimension : undefined,
        height: horizontal ? undefined : dimension,
      }}
    />
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },

    keyboardAvoid: {
      flex: 1,
    },

    scrollView: {
      flex: 1,
    },

    staticContent: {
      flex: 1,
    },

    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.color.surface.base,
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
    },

    // Section styles
    section: {
      marginBottom: theme.space[6],
    },

    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.space[3],
    },

    sectionTitleContainer: {
      flex: 1,
    },

    sectionSubtitle: {
      marginTop: theme.space[0.5],
    },

    // Row styles
    row: {
      flexDirection: 'row',
    },
  });

export default ScreenContainer;
