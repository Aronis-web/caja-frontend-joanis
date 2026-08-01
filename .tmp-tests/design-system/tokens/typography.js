"use strict";
/**
 * Design System - Typography Tokens
 *
 * Sistema tipográfico moderno y legible.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.textVariants = exports.letterSpacing = exports.fontWeights = exports.lineHeights = exports.fontSizes = exports.fontFamilies = void 0;
const react_native_1 = require("react-native");
// ============================================
// FONT FAMILIES
// ============================================
exports.fontFamilies = {
    // Usar fuentes del sistema para mejor rendimiento
    regular: react_native_1.Platform.select({
        ios: 'System',
        android: 'Roboto',
        default: 'System',
    }),
    medium: react_native_1.Platform.select({
        ios: 'System',
        android: 'Roboto-Medium',
        default: 'System',
    }),
    semibold: react_native_1.Platform.select({
        ios: 'System',
        android: 'Roboto-Medium',
        default: 'System',
    }),
    bold: react_native_1.Platform.select({
        ios: 'System',
        android: 'Roboto-Bold',
        default: 'System',
    }),
};
// ============================================
// FONT SIZES
// ============================================
exports.fontSizes = {
    '2xs': 10,
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
    '5xl': 40,
};
// ============================================
// LINE HEIGHTS
// ============================================
exports.lineHeights = {
    tight: 1.1,
    snug: 1.25,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
};
// ============================================
// FONT WEIGHTS
// ============================================
exports.fontWeights = {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
};
// ============================================
// LETTER SPACING
// ============================================
exports.letterSpacing = {
    tighter: -0.5,
    tight: -0.25,
    normal: 0,
    wide: 0.25,
    wider: 0.5,
    widest: 1,
};
// ============================================
// TEXT VARIANTS (Estilos predefinidos)
// ============================================
exports.textVariants = {
    // Display - Para títulos principales muy grandes
    displayLarge: {
        fontSize: exports.fontSizes['5xl'],
        fontWeight: exports.fontWeights.bold,
        lineHeight: exports.fontSizes['5xl'] * exports.lineHeights.tight,
        letterSpacing: exports.letterSpacing.tight,
    },
    displayMedium: {
        fontSize: exports.fontSizes['4xl'],
        fontWeight: exports.fontWeights.bold,
        lineHeight: exports.fontSizes['4xl'] * exports.lineHeights.tight,
        letterSpacing: exports.letterSpacing.tight,
    },
    displaySmall: {
        fontSize: exports.fontSizes['3xl'],
        fontWeight: exports.fontWeights.bold,
        lineHeight: exports.fontSizes['3xl'] * exports.lineHeights.snug,
        letterSpacing: exports.letterSpacing.normal,
    },
    // Headings - Para encabezados de sección
    headingLarge: {
        fontSize: exports.fontSizes['2xl'],
        fontWeight: exports.fontWeights.semibold,
        lineHeight: exports.fontSizes['2xl'] * exports.lineHeights.snug,
        letterSpacing: exports.letterSpacing.normal,
    },
    headingMedium: {
        fontSize: exports.fontSizes.xl,
        fontWeight: exports.fontWeights.semibold,
        lineHeight: exports.fontSizes.xl * exports.lineHeights.snug,
        letterSpacing: exports.letterSpacing.normal,
    },
    headingSmall: {
        fontSize: exports.fontSizes.lg,
        fontWeight: exports.fontWeights.semibold,
        lineHeight: exports.fontSizes.lg * exports.lineHeights.snug,
        letterSpacing: exports.letterSpacing.normal,
    },
    // Title - Para títulos de cards, items, etc.
    titleLarge: {
        fontSize: exports.fontSizes.lg,
        fontWeight: exports.fontWeights.semibold,
        lineHeight: exports.fontSizes.lg * exports.lineHeights.normal,
        letterSpacing: exports.letterSpacing.normal,
    },
    titleMedium: {
        fontSize: exports.fontSizes.base,
        fontWeight: exports.fontWeights.semibold,
        lineHeight: exports.fontSizes.base * exports.lineHeights.normal,
        letterSpacing: exports.letterSpacing.normal,
    },
    titleSmall: {
        fontSize: exports.fontSizes.sm,
        fontWeight: exports.fontWeights.semibold,
        lineHeight: exports.fontSizes.sm * exports.lineHeights.normal,
        letterSpacing: exports.letterSpacing.normal,
    },
    // Body - Para texto de contenido
    bodyLarge: {
        fontSize: exports.fontSizes.base,
        fontWeight: exports.fontWeights.regular,
        lineHeight: exports.fontSizes.base * exports.lineHeights.normal,
        letterSpacing: exports.letterSpacing.normal,
    },
    bodyMedium: {
        fontSize: exports.fontSizes.sm,
        fontWeight: exports.fontWeights.regular,
        lineHeight: exports.fontSizes.sm * exports.lineHeights.normal,
        letterSpacing: exports.letterSpacing.normal,
    },
    bodySmall: {
        fontSize: exports.fontSizes.xs,
        fontWeight: exports.fontWeights.regular,
        lineHeight: exports.fontSizes.xs * exports.lineHeights.normal,
        letterSpacing: exports.letterSpacing.normal,
    },
    // Label - Para etiquetas de formularios, badges, etc.
    labelLarge: {
        fontSize: exports.fontSizes.sm,
        fontWeight: exports.fontWeights.medium,
        lineHeight: exports.fontSizes.sm * exports.lineHeights.normal,
        letterSpacing: exports.letterSpacing.wide,
    },
    labelMedium: {
        fontSize: exports.fontSizes.xs,
        fontWeight: exports.fontWeights.medium,
        lineHeight: exports.fontSizes.xs * exports.lineHeights.normal,
        letterSpacing: exports.letterSpacing.wide,
    },
    labelSmall: {
        fontSize: exports.fontSizes['2xs'],
        fontWeight: exports.fontWeights.medium,
        lineHeight: exports.fontSizes['2xs'] * exports.lineHeights.normal,
        letterSpacing: exports.letterSpacing.wider,
        textTransform: 'uppercase',
    },
    // Caption - Para texto secundario pequeño
    caption: {
        fontSize: exports.fontSizes.xs,
        fontWeight: exports.fontWeights.regular,
        lineHeight: exports.fontSizes.xs * exports.lineHeights.normal,
        letterSpacing: exports.letterSpacing.normal,
    },
    // Overline - Para etiquetas sobre contenido
    overline: {
        fontSize: exports.fontSizes['2xs'],
        fontWeight: exports.fontWeights.semibold,
        lineHeight: exports.fontSizes['2xs'] * exports.lineHeights.normal,
        letterSpacing: exports.letterSpacing.widest,
        textTransform: 'uppercase',
    },
    // Button - Para texto de botones
    buttonLarge: {
        fontSize: exports.fontSizes.base,
        fontWeight: exports.fontWeights.semibold,
        lineHeight: exports.fontSizes.base * exports.lineHeights.tight,
        letterSpacing: exports.letterSpacing.wide,
    },
    buttonMedium: {
        fontSize: exports.fontSizes.sm,
        fontWeight: exports.fontWeights.semibold,
        lineHeight: exports.fontSizes.sm * exports.lineHeights.tight,
        letterSpacing: exports.letterSpacing.wide,
    },
    buttonSmall: {
        fontSize: exports.fontSizes.xs,
        fontWeight: exports.fontWeights.semibold,
        lineHeight: exports.fontSizes.xs * exports.lineHeights.tight,
        letterSpacing: exports.letterSpacing.wide,
    },
    // Numeric - Para números y montos
    numericLarge: {
        fontSize: exports.fontSizes['2xl'],
        fontWeight: exports.fontWeights.bold,
        lineHeight: exports.fontSizes['2xl'] * exports.lineHeights.tight,
        letterSpacing: exports.letterSpacing.tight,
        fontVariant: ['tabular-nums'],
    },
    numericMedium: {
        fontSize: exports.fontSizes.lg,
        fontWeight: exports.fontWeights.bold,
        lineHeight: exports.fontSizes.lg * exports.lineHeights.tight,
        letterSpacing: exports.letterSpacing.tight,
        fontVariant: ['tabular-nums'],
    },
    numericSmall: {
        fontSize: exports.fontSizes.sm,
        fontWeight: exports.fontWeights.semibold,
        lineHeight: exports.fontSizes.sm * exports.lineHeights.tight,
        letterSpacing: exports.letterSpacing.tight,
        fontVariant: ['tabular-nums'],
    },
};
exports.default = {
    fontFamilies: exports.fontFamilies,
    fontSizes: exports.fontSizes,
    lineHeights: exports.lineHeights,
    fontWeights: exports.fontWeights,
    letterSpacing: exports.letterSpacing,
    textVariants: exports.textVariants,
};
