/**
 * Design System - Shadow Tokens
 *
 * Sistema de sombras para crear profundidad y jerarquía visual.
 */

import { Platform, ViewStyle } from 'react-native';

// ============================================
// SHADOW DEFINITIONS
// ============================================

type ShadowStyle = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

// Función helper para crear sombras cross-platform
const createShadow = (
  offsetY: number,
  blur: number,
  opacity: number,
  elevation: number
): ShadowStyle => ({
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: offsetY },
  shadowOpacity: opacity,
  shadowRadius: blur,
  elevation: Platform.OS === 'android' ? elevation : 0,
});

// ============================================
// SHADOW VARIANTS
// ============================================
export const shadows = {
  // Sin sombra
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  } as ShadowStyle,

  // Sombra muy sutil - Para bordes sutiles
  xs: createShadow(1, 2, 0.05, 1),

  // Sombra pequeña - Para cards y elementos elevados
  sm: createShadow(1, 3, 0.1, 2),

  // Sombra media - Para dropdowns, popovers
  md: createShadow(4, 6, 0.1, 4),

  // Sombra grande - Para modales, drawers
  lg: createShadow(10, 15, 0.1, 8),

  // Sombra extra grande - Para elementos flotantes prominentes
  xl: createShadow(20, 25, 0.1, 12),

  // Sombra 2xl - Para FAB y elementos muy elevados
  '2xl': createShadow(25, 50, 0.15, 16),
} as const;

// ============================================
// SEMANTIC SHADOWS
// ============================================
export const semanticShadows = {
  // Cards
  card: shadows.sm,
  cardHover: shadows.md,
  cardPressed: shadows.xs,

  // Elevated surfaces
  elevated: shadows.md,

  // Dropdown menus
  dropdown: shadows.lg,

  // Modals
  modal: shadows.xl,

  // Drawers
  drawer: shadows.xl,

  // FAB
  fab: shadows['2xl'],
  fabPressed: shadows.lg,

  // Tooltips
  tooltip: shadows.md,

  // Toast notifications
  toast: shadows.lg,

  // Sticky headers
  stickyHeader: shadows.sm,

  // Bottom navigation
  bottomNav: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 8,
  } as ShadowStyle,
} as const;

// ============================================
// INNER SHADOWS (Simulados con borders)
// ============================================
export const innerShadows = {
  // Input focus
  inputFocus: {
    borderWidth: 2,
    borderColor: '#171717',
  },

  // Input error
  inputError: {
    borderWidth: 2,
    borderColor: '#EF4444',
  },

  // Pressed state
  pressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
} as const;

// ============================================
// GLOW EFFECTS (Para estados activos)
// ============================================
export const glowEffects = {
  primary: {
    shadowColor: '#171717',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 0,
  } as ShadowStyle,

  accent: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 0,
  } as ShadowStyle,

  success: {
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 0,
  } as ShadowStyle,

  danger: {
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 0,
  } as ShadowStyle,
} as const;

export type Shadows = typeof shadows;
export type SemanticShadows = typeof semanticShadows;

export default {
  shadows,
  semanticShadows,
  innerShadows,
  glowEffects,
};
