"use strict";
/**
 * Design System - Shadow Tokens
 *
 * Sistema de sombras para crear profundidad y jerarquía visual.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.glowEffects = exports.innerShadows = exports.semanticShadows = exports.shadows = void 0;
const react_native_1 = require("react-native");
// Función helper para crear sombras cross-platform
const createShadow = (offsetY, blur, opacity, elevation) => ({
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: offsetY },
    shadowOpacity: opacity,
    shadowRadius: blur,
    elevation: react_native_1.Platform.OS === 'android' ? elevation : 0,
});
// ============================================
// SHADOW VARIANTS
// ============================================
exports.shadows = {
    // Sin sombra
    none: {
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
    },
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
};
// ============================================
// SEMANTIC SHADOWS
// ============================================
exports.semanticShadows = {
    // Cards
    card: exports.shadows.sm,
    cardHover: exports.shadows.md,
    cardPressed: exports.shadows.xs,
    // Elevated surfaces
    elevated: exports.shadows.md,
    // Dropdown menus
    dropdown: exports.shadows.lg,
    // Modals
    modal: exports.shadows.xl,
    // Drawers
    drawer: exports.shadows.xl,
    // FAB
    fab: exports.shadows['2xl'],
    fabPressed: exports.shadows.lg,
    // Tooltips
    tooltip: exports.shadows.md,
    // Toast notifications
    toast: exports.shadows.lg,
    // Sticky headers
    stickyHeader: exports.shadows.sm,
    // Bottom navigation
    bottomNav: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 8,
    },
};
// ============================================
// INNER SHADOWS (Simulados con borders)
// ============================================
exports.innerShadows = {
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
};
// ============================================
// GLOW EFFECTS (Para estados activos)
// ============================================
exports.glowEffects = {
    primary: {
        shadowColor: '#171717',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 0,
    },
    accent: {
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 0,
    },
    success: {
        shadowColor: '#22C55E',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 0,
    },
    danger: {
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 0,
    },
};
exports.default = {
    shadows: exports.shadows,
    semanticShadows: exports.semanticShadows,
    innerShadows: exports.innerShadows,
    glowEffects: exports.glowEffects,
};
