"use strict";
/**
 * Design System - Spacing Tokens
 *
 * Sistema de espaciado consistente basado en múltiplos de 4.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.zIndex = exports.touchTargets = exports.avatarSizes = exports.iconSizes = exports.semanticBorderRadius = exports.borderRadius = exports.semanticSpacing = exports.spacing = void 0;
// ============================================
// SPACING (múltiplos de 4px)
// ============================================
exports.spacing = {
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
};
// ============================================
// SEMANTIC SPACING
// ============================================
exports.semanticSpacing = {
    // Espaciados de componentes
    componentPaddingXs: exports.spacing[2], // 8px
    componentPaddingSm: exports.spacing[3], // 12px
    componentPaddingMd: exports.spacing[4], // 16px
    componentPaddingLg: exports.spacing[5], // 20px
    componentPaddingXl: exports.spacing[6], // 24px
    // Espaciados de pantalla
    screenPaddingHorizontal: exports.spacing[4], // 16px
    screenPaddingVertical: exports.spacing[4], // 16px
    // Espaciado de secciones
    sectionGap: exports.spacing[6], // 24px
    // Espaciado de items en listas
    listItemGap: exports.spacing[3], // 12px
    listItemPadding: exports.spacing[4], // 16px
    // Espaciado de formularios
    formFieldGap: exports.spacing[4], // 16px
    formGroupGap: exports.spacing[6], // 24px
    // Espaciado de cards
    cardPadding: exports.spacing[4], // 16px
    cardGap: exports.spacing[3], // 12px
    // Espaciado de modales
    modalPadding: exports.spacing[5], // 20px
    // Espaciado de botones en grupo
    buttonGroupGap: exports.spacing[2], // 8px
    // Espaciado inline (entre elementos en línea)
    inlineGapXs: exports.spacing[1], // 4px
    inlineGapSm: exports.spacing[2], // 8px
    inlineGapMd: exports.spacing[3], // 12px
    inlineGapLg: exports.spacing[4], // 16px
};
// ============================================
// BORDER RADIUS
// ============================================
exports.borderRadius = {
    none: 0,
    xs: 4,
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    '2xl': 20,
    '3xl': 24,
    full: 9999,
};
// ============================================
// SEMANTIC BORDER RADIUS
// ============================================
exports.semanticBorderRadius = {
    button: exports.borderRadius.md, // 8px
    buttonSmall: exports.borderRadius.sm, // 6px
    buttonLarge: exports.borderRadius.lg, // 12px
    card: exports.borderRadius.lg, // 12px
    cardLarge: exports.borderRadius.xl, // 16px
    input: exports.borderRadius.md, // 8px
    badge: exports.borderRadius.sm, // 6px
    badgePill: exports.borderRadius.full, // pill
    modal: exports.borderRadius.xl, // 16px
    avatar: exports.borderRadius.full, // circle
    avatarSquare: exports.borderRadius.md, // 8px
    chip: exports.borderRadius.full, // pill
    tooltip: exports.borderRadius.sm, // 6px
    fab: exports.borderRadius.xl, // 16px
};
// ============================================
// ICON SIZES
// ============================================
exports.iconSizes = {
    xs: 12,
    sm: 16,
    md: 20,
    lg: 24,
    xl: 28,
    '2xl': 32,
    '3xl': 40,
    '4xl': 48,
};
// ============================================
// AVATAR SIZES
// ============================================
exports.avatarSizes = {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 48,
    xl: 56,
    '2xl': 64,
    '3xl': 80,
    '4xl': 96,
};
// ============================================
// TOUCH TARGET (mínimo 44px para accesibilidad)
// ============================================
exports.touchTargets = {
    minimum: 44,
    small: 36,
    medium: 44,
    large: 52,
};
// ============================================
// Z-INDEX
// ============================================
exports.zIndex = {
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
};
exports.default = {
    spacing: exports.spacing,
    semanticSpacing: exports.semanticSpacing,
    borderRadius: exports.borderRadius,
    semanticBorderRadius: exports.semanticBorderRadius,
    iconSizes: exports.iconSizes,
    avatarSizes: exports.avatarSizes,
    touchTargets: exports.touchTargets,
    zIndex: exports.zIndex,
};
