"use strict";
/**
 * Design System - Base Theme Slots
 *
 * Slots compartidos entre todos los temas (no dependen de modo claro/oscuro):
 * tipografia, espaciado, radios, sombras, motion, sizing, zIndex.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.baseZIndex = exports.baseSizing = exports.baseIcon = exports.baseMotion = exports.baseShadow = exports.baseRadii = exports.baseSpace = exports.baseFonts = exports.baseText = void 0;
const spacing_1 = require("../tokens/spacing");
const typography_1 = require("../tokens/typography");
const shadows_1 = require("../tokens/shadows");
const animations_1 = require("../tokens/animations");
exports.baseText = typography_1.textVariants;
exports.baseFonts = {
    regular: 'System',
    medium: 'System',
    semibold: 'System',
    bold: 'System',
    mono: 'monospace',
};
exports.baseSpace = spacing_1.spacing;
exports.baseRadii = {
    ...spacing_1.borderRadius,
    semantic: spacing_1.semanticBorderRadius,
};
exports.baseShadow = {
    ...shadows_1.shadows,
    semantic: shadows_1.semanticShadows,
};
exports.baseMotion = {
    durations: animations_1.durations,
    springs: animations_1.springConfigs,
    activeOpacity: animations_1.activeOpacity,
};
exports.baseIcon = spacing_1.iconSizes;
exports.baseSizing = {
    avatar: spacing_1.avatarSizes,
    touchTarget: spacing_1.touchTargets,
};
exports.baseZIndex = spacing_1.zIndex;
