/**
 * Design System - Base Theme Slots
 *
 * Slots compartidos entre todos los temas (no dependen de modo claro/oscuro):
 * tipografia, espaciado, radios, sombras, motion, sizing, zIndex.
 */

import {
  spacing,
  borderRadius,
  semanticBorderRadius,
  iconSizes,
  avatarSizes,
  touchTargets,
  zIndex,
} from '../tokens/spacing';
import { textVariants } from '../tokens/typography';
import { shadows, semanticShadows } from '../tokens/shadows';
import { durations, springConfigs, activeOpacity } from '../tokens/animations';

export const baseText = textVariants;

export const baseFonts = {
  regular: 'System',
  medium: 'System',
  semibold: 'System',
  bold: 'System',
  mono: 'monospace',
} as const;

export const baseSpace = spacing;

export const baseRadii = {
  ...borderRadius,
  semantic: semanticBorderRadius,
} as const;

export const baseShadow = {
  ...shadows,
  semantic: semanticShadows,
} as const;

export const baseMotion = {
  durations,
  springs: springConfigs,
  activeOpacity,
} as const;

export const baseIcon = iconSizes;

export const baseSizing = {
  avatar: avatarSizes,
  touchTarget: touchTargets,
} as const;

export const baseZIndex = zIndex;

export type BaseText = typeof baseText;
export type BaseFonts = typeof baseFonts;
export type BaseSpace = typeof baseSpace;
export type BaseRadii = typeof baseRadii;
export type BaseShadow = typeof baseShadow;
export type BaseMotion = typeof baseMotion;
export type BaseIcon = typeof baseIcon;
export type BaseSizing = typeof baseSizing;
export type BaseZIndex = typeof baseZIndex;
