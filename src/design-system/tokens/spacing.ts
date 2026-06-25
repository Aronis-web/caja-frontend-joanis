/**
 * Design System - Spacing Tokens
 *
 * Sistema de espaciado consistente basado en múltiplos de 4.
 */

// ============================================
// SPACING (múltiplos de 4px)
// ============================================
export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  11: 44,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
  28: 112,
  32: 128,
} as const;

// ============================================
// SEMANTIC SPACING
// ============================================
export const semanticSpacing = {
  // Espaciados de componentes
  componentPaddingXs: spacing[2], // 8px
  componentPaddingSm: spacing[3], // 12px
  componentPaddingMd: spacing[4], // 16px
  componentPaddingLg: spacing[5], // 20px
  componentPaddingXl: spacing[6], // 24px

  // Espaciados de pantalla
  screenPaddingHorizontal: spacing[4], // 16px
  screenPaddingVertical: spacing[4], // 16px

  // Espaciado de secciones
  sectionGap: spacing[6], // 24px

  // Espaciado de items en listas
  listItemGap: spacing[3], // 12px
  listItemPadding: spacing[4], // 16px

  // Espaciado de formularios
  formFieldGap: spacing[4], // 16px
  formGroupGap: spacing[6], // 24px

  // Espaciado de cards
  cardPadding: spacing[4], // 16px
  cardGap: spacing[3], // 12px

  // Espaciado de modales
  modalPadding: spacing[5], // 20px

  // Espaciado de botones en grupo
  buttonGroupGap: spacing[2], // 8px

  // Espaciado inline (entre elementos en línea)
  inlineGapXs: spacing[1], // 4px
  inlineGapSm: spacing[2], // 8px
  inlineGapMd: spacing[3], // 12px
  inlineGapLg: spacing[4], // 16px
} as const;

// ============================================
// BORDER RADIUS
// ============================================
export const borderRadius = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  full: 9999,
} as const;

// ============================================
// SEMANTIC BORDER RADIUS
// ============================================
export const semanticBorderRadius = {
  button: borderRadius.md, // 8px
  buttonSmall: borderRadius.sm, // 6px
  buttonLarge: borderRadius.lg, // 12px

  card: borderRadius.lg, // 12px
  cardLarge: borderRadius.xl, // 16px

  input: borderRadius.md, // 8px

  badge: borderRadius.sm, // 6px
  badgePill: borderRadius.full, // pill

  modal: borderRadius.xl, // 16px

  avatar: borderRadius.full, // circle
  avatarSquare: borderRadius.md, // 8px

  chip: borderRadius.full, // pill

  tooltip: borderRadius.sm, // 6px

  fab: borderRadius.xl, // 16px
} as const;

// ============================================
// ICON SIZES
// ============================================
export const iconSizes = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
} as const;

// ============================================
// AVATAR SIZES
// ============================================
export const avatarSizes = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 56,
  '2xl': 64,
  '3xl': 80,
  '4xl': 96,
} as const;

// ============================================
// TOUCH TARGET (mínimo 44px para accesibilidad)
// ============================================
export const touchTargets = {
  minimum: 44,
  small: 36,
  medium: 44,
  large: 52,
} as const;

// ============================================
// Z-INDEX
// ============================================
export const zIndex = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  fixed: 300,
  modalBackdrop: 400,
  modal: 500,
  popover: 600,
  tooltip: 700,
  toast: 800,
  max: 9999,
} as const;

export type Spacing = typeof spacing;
export type BorderRadius = typeof borderRadius;

export default {
  spacing,
  semanticSpacing,
  borderRadius,
  semanticBorderRadius,
  iconSizes,
  avatarSizes,
  touchTargets,
  zIndex,
};
