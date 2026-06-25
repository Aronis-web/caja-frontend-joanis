/**
 * Design System - Animation Tokens
 *
 * Configuraciones de animación para transiciones suaves.
 */

// ============================================
// DURATIONS (en milisegundos)
// ============================================
export const durations = {
  instant: 0,
  fastest: 50,
  faster: 100,
  fast: 150,
  normal: 200,
  slow: 300,
  slower: 400,
  slowest: 500,
} as const;

// ============================================
// EASING FUNCTIONS
// ============================================
export const easings = {
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
} as const;

// ============================================
// SPRING CONFIGS (para React Native Animated)
// ============================================
export const springConfigs = {
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
} as const;

// ============================================
// SEMANTIC ANIMATIONS
// ============================================
export const semanticAnimations = {
  // Fade
  fadeIn: {
    duration: durations.fast,
  },
  fadeOut: {
    duration: durations.fast,
  },

  // Scale
  scaleIn: {
    duration: durations.fast,
    spring: springConfigs.default,
  },
  scaleOut: {
    duration: durations.faster,
  },

  // Slide
  slideInFromRight: {
    duration: durations.normal,
    spring: springConfigs.stiff,
  },
  slideInFromBottom: {
    duration: durations.normal,
    spring: springConfigs.default,
  },
  slideOutToRight: {
    duration: durations.fast,
  },
  slideOutToBottom: {
    duration: durations.fast,
  },

  // Press feedback
  pressIn: {
    duration: durations.faster,
    scale: 0.97,
  },
  pressOut: {
    duration: durations.fast,
    spring: springConfigs.bouncy,
  },

  // Loading
  pulse: {
    duration: durations.slower,
  },
  spin: {
    duration: 1000,
  },

  // Modal
  modalEnter: {
    duration: durations.normal,
    spring: springConfigs.stiff,
  },
  modalExit: {
    duration: durations.fast,
  },

  // Toast
  toastEnter: {
    duration: durations.normal,
    spring: springConfigs.bouncy,
  },
  toastExit: {
    duration: durations.fast,
  },

  // Drawer
  drawerEnter: {
    duration: durations.normal,
    spring: springConfigs.stiff,
  },
  drawerExit: {
    duration: durations.fast,
  },
} as const;

// ============================================
// ACTIVE OPACITY (para TouchableOpacity)
// ============================================
export const activeOpacity = {
  none: 1,
  subtle: 0.9,
  light: 0.8,
  medium: 0.7,
  strong: 0.6,
  heavy: 0.5,
} as const;

export type Durations = typeof durations;
export type SpringConfigs = typeof springConfigs;

export default {
  durations,
  easings,
  springConfigs,
  semanticAnimations,
  activeOpacity,
};
