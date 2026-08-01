"use strict";
/**
 * Design System - Token Exports
 *
 * Punto de entrada central para todos los tokens del sistema de diseño.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.designTokens = exports.activeOpacity = exports.semanticAnimations = exports.springConfigs = exports.easings = exports.durations = exports.glowEffects = exports.innerShadows = exports.semanticShadows = exports.shadows = exports.zIndex = exports.touchTargets = exports.avatarSizes = exports.iconSizes = exports.semanticBorderRadius = exports.borderRadius = exports.semanticSpacing = exports.spacing = exports.textVariants = exports.letterSpacing = exports.fontWeights = exports.lineHeights = exports.fontSizes = exports.fontFamilies = exports.colors = void 0;
// Colors
var colors_1 = require("./colors");
Object.defineProperty(exports, "colors", { enumerable: true, get: function () { return colors_1.colors; } });
// Typography
var typography_1 = require("./typography");
Object.defineProperty(exports, "fontFamilies", { enumerable: true, get: function () { return typography_1.fontFamilies; } });
Object.defineProperty(exports, "fontSizes", { enumerable: true, get: function () { return typography_1.fontSizes; } });
Object.defineProperty(exports, "lineHeights", { enumerable: true, get: function () { return typography_1.lineHeights; } });
Object.defineProperty(exports, "fontWeights", { enumerable: true, get: function () { return typography_1.fontWeights; } });
Object.defineProperty(exports, "letterSpacing", { enumerable: true, get: function () { return typography_1.letterSpacing; } });
Object.defineProperty(exports, "textVariants", { enumerable: true, get: function () { return typography_1.textVariants; } });
// Spacing
var spacing_1 = require("./spacing");
Object.defineProperty(exports, "spacing", { enumerable: true, get: function () { return spacing_1.spacing; } });
Object.defineProperty(exports, "semanticSpacing", { enumerable: true, get: function () { return spacing_1.semanticSpacing; } });
Object.defineProperty(exports, "borderRadius", { enumerable: true, get: function () { return spacing_1.borderRadius; } });
Object.defineProperty(exports, "semanticBorderRadius", { enumerable: true, get: function () { return spacing_1.semanticBorderRadius; } });
Object.defineProperty(exports, "iconSizes", { enumerable: true, get: function () { return spacing_1.iconSizes; } });
Object.defineProperty(exports, "avatarSizes", { enumerable: true, get: function () { return spacing_1.avatarSizes; } });
Object.defineProperty(exports, "touchTargets", { enumerable: true, get: function () { return spacing_1.touchTargets; } });
Object.defineProperty(exports, "zIndex", { enumerable: true, get: function () { return spacing_1.zIndex; } });
// Shadows
var shadows_1 = require("./shadows");
Object.defineProperty(exports, "shadows", { enumerable: true, get: function () { return shadows_1.shadows; } });
Object.defineProperty(exports, "semanticShadows", { enumerable: true, get: function () { return shadows_1.semanticShadows; } });
Object.defineProperty(exports, "innerShadows", { enumerable: true, get: function () { return shadows_1.innerShadows; } });
Object.defineProperty(exports, "glowEffects", { enumerable: true, get: function () { return shadows_1.glowEffects; } });
// Animations
var animations_1 = require("./animations");
Object.defineProperty(exports, "durations", { enumerable: true, get: function () { return animations_1.durations; } });
Object.defineProperty(exports, "easings", { enumerable: true, get: function () { return animations_1.easings; } });
Object.defineProperty(exports, "springConfigs", { enumerable: true, get: function () { return animations_1.springConfigs; } });
Object.defineProperty(exports, "semanticAnimations", { enumerable: true, get: function () { return animations_1.semanticAnimations; } });
Object.defineProperty(exports, "activeOpacity", { enumerable: true, get: function () { return animations_1.activeOpacity; } });
// ============================================
// THEME OBJECT (Consolidado)
// ============================================
const colors_2 = require("./colors");
const typography_2 = require("./typography");
const spacing_2 = require("./spacing");
const shadows_2 = require("./shadows");
const animations_2 = require("./animations");
exports.designTokens = {
    colors: colors_2.colors,
    typography: {
        fontFamilies: typography_2.fontFamilies,
        fontSizes: typography_2.fontSizes,
        lineHeights: typography_2.lineHeights,
        fontWeights: typography_2.fontWeights,
        letterSpacing: typography_2.letterSpacing,
        textVariants: typography_2.textVariants,
    },
    spacing: {
        ...spacing_2.spacing,
        semantic: spacing_2.semanticSpacing,
    },
    borderRadius: {
        ...spacing_2.borderRadius,
        semantic: spacing_2.semanticBorderRadius,
    },
    sizing: {
        icons: spacing_2.iconSizes,
        avatars: spacing_2.avatarSizes,
        touchTargets: spacing_2.touchTargets,
    },
    shadows: {
        ...shadows_2.shadows,
        semantic: shadows_2.semanticShadows,
        inner: shadows_2.innerShadows,
        glow: shadows_2.glowEffects,
    },
    animation: {
        durations: animations_2.durations,
        easings: animations_2.easings,
        springs: animations_2.springConfigs,
        semantic: animations_2.semanticAnimations,
        activeOpacity: animations_2.activeOpacity,
    },
    zIndex: spacing_2.zIndex,
};
exports.default = exports.designTokens;
