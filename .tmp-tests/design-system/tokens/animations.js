"use strict";
/**
 * Design System - Animation Tokens
 *
 * Configuraciones de animación para transiciones suaves.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.activeOpacity = exports.semanticAnimations = exports.springConfigs = exports.easings = exports.durations = void 0;
// ============================================
// DURATIONS (en milisegundos)
// ============================================
exports.durations = {
    instant: 0,
    fastest: 50,
    faster: 100,
    fast: 150,
    normal: 200,
    slow: 300,
    slower: 400,
    slowest: 500,
};
// ============================================
// EASING FUNCTIONS
// ============================================
exports.easings = {
    // Entrada
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeInQuad: 'cubic-bezier(0.55, 0.085, 0.68, 0.53)',
    easeInCubic: 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
    // Salida
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeOutQuad: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    easeOutCubic: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
    // Entrada y Salida
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeInOutQuad: 'cubic-bezier(0.455, 0.03, 0.515, 0.955)',
    easeInOutCubic: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
    // Especiales
    linear: 'linear',
    spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
};
// ============================================
// SPRING CONFIGS (para React Native Animated)
// ============================================
exports.springConfigs = {
    // Suave - Para transiciones sutiles
    gentle: {
        tension: 120,
        friction: 14,
    },
    // Por defecto - Para la mayoría de animaciones
    default: {
        tension: 170,
        friction: 26,
    },
    // Firme - Para feedback rápido
    stiff: {
        tension: 210,
        friction: 20,
    },
    // Elástico - Para animaciones juguetonas
    bouncy: {
        tension: 180,
        friction: 12,
    },
    // Lento - Para animaciones dramáticas
    slow: {
        tension: 100,
        friction: 20,
    },
};
// ============================================
// SEMANTIC ANIMATIONS
// ============================================
exports.semanticAnimations = {
    // Fade
    fadeIn: {
        duration: exports.durations.fast,
    },
    fadeOut: {
        duration: exports.durations.fast,
    },
    // Scale
    scaleIn: {
        duration: exports.durations.fast,
        spring: exports.springConfigs.default,
    },
    scaleOut: {
        duration: exports.durations.faster,
    },
    // Slide
    slideInFromRight: {
        duration: exports.durations.normal,
        spring: exports.springConfigs.stiff,
    },
    slideInFromBottom: {
        duration: exports.durations.normal,
        spring: exports.springConfigs.default,
    },
    slideOutToRight: {
        duration: exports.durations.fast,
    },
    slideOutToBottom: {
        duration: exports.durations.fast,
    },
    // Press feedback
    pressIn: {
        duration: exports.durations.faster,
        scale: 0.97,
    },
    pressOut: {
        duration: exports.durations.fast,
        spring: exports.springConfigs.bouncy,
    },
    // Loading
    pulse: {
        duration: exports.durations.slower,
    },
    spin: {
        duration: 1000,
    },
    // Modal
    modalEnter: {
        duration: exports.durations.normal,
        spring: exports.springConfigs.stiff,
    },
    modalExit: {
        duration: exports.durations.fast,
    },
    // Toast
    toastEnter: {
        duration: exports.durations.normal,
        spring: exports.springConfigs.bouncy,
    },
    toastExit: {
        duration: exports.durations.fast,
    },
    // Drawer
    drawerEnter: {
        duration: exports.durations.normal,
        spring: exports.springConfigs.stiff,
    },
    drawerExit: {
        duration: exports.durations.fast,
    },
};
// ============================================
// ACTIVE OPACITY (para TouchableOpacity)
// ============================================
exports.activeOpacity = {
    none: 1,
    subtle: 0.9,
    light: 0.8,
    medium: 0.7,
    strong: 0.6,
    heavy: 0.5,
};
exports.default = {
    durations: exports.durations,
    easings: exports.easings,
    springConfigs: exports.springConfigs,
    semanticAnimations: exports.semanticAnimations,
    activeOpacity: exports.activeOpacity,
};
