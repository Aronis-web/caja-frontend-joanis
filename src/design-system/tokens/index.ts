/**
 * Design System - Token Exports
 *
 * Punto de entrada central para todos los tokens del sistema de diseño.
 */

// Colors
export { colors } from './colors';
export type { Colors } from './colors';

// Typography
export {
  fontFamilies,
  fontSizes,
  lineHeights,
  fontWeights,
  letterSpacing,
  textVariants,
} from './typography';
export type { TextVariants, TextVariantKey } from './typography';

// Spacing
export {
  spacing,
  semanticSpacing,
  borderRadius,
  semanticBorderRadius,
  iconSizes,
  avatarSizes,
  touchTargets,
  zIndex,
} from './spacing';
export type { Spacing, BorderRadius } from './spacing';

// Shadows
export { shadows, semanticShadows, innerShadows, glowEffects } from './shadows';
export type { Shadows, SemanticShadows } from './shadows';

// Animations
export { durations, easings, springConfigs, semanticAnimations, activeOpacity } from './animations';
export type { Durations, SpringConfigs } from './animations';

// ============================================
// THEME OBJECT (Consolidado)
// ============================================
import { colors } from './colors';
import {
  fontFamilies,
  fontSizes,
  lineHeights,
  fontWeights,
  letterSpacing,
  textVariants,
} from './typography';
import {
  spacing,
  semanticSpacing,
  borderRadius,
  semanticBorderRadius,
  iconSizes,
  avatarSizes,
  touchTargets,
  zIndex,
} from './spacing';
import { shadows, semanticShadows, innerShadows, glowEffects } from './shadows';
import { durations, easings, springConfigs, semanticAnimations, activeOpacity } from './animations';

export const designTokens = {
  colors,
  typography: {
    fontFamilies,
    fontSizes,
    lineHeights,
    fontWeights,
    letterSpacing,
    textVariants,
  },
  spacing: {
    ...spacing,
    semantic: semanticSpacing,
  },
  borderRadius: {
    ...borderRadius,
    semantic: semanticBorderRadius,
  },
  sizing: {
    icons: iconSizes,
    avatars: avatarSizes,
    touchTargets,
  },
  shadows: {
    ...shadows,
    semantic: semanticShadows,
    inner: innerShadows,
    glow: glowEffects,
  },
  animation: {
    durations,
    easings,
    springs: springConfigs,
    semantic: semanticAnimations,
    activeOpacity,
  },
  zIndex,
} as const;

export type DesignTokens = typeof designTokens;

export default designTokens;
