"use strict";
/**
 * Design System - Main Entry Point
 *
 * Sistema de diseño unificado para la aplicación.
 * Exporta todos los tokens y componentes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScreenHeader = exports.ChipGroup = exports.Chip = exports.Divider = exports.AvatarGroup = exports.Avatar = exports.IconButton = exports.CounterBadge = exports.StatusBadge = exports.Badge = exports.Input = exports.CardDivider = exports.CardFooter = exports.CardContent = exports.CardHeader = exports.Card = exports.Button = exports.Numeric = exports.Caption = exports.Label = exports.Body = exports.Title = exports.Heading = exports.DisplayText = exports.Text = exports.designTokens = exports.activeOpacity = exports.semanticAnimations = exports.springConfigs = exports.easings = exports.durations = exports.glowEffects = exports.innerShadows = exports.semanticShadows = exports.shadows = exports.zIndex = exports.touchTargets = exports.avatarSizes = exports.iconSizes = exports.semanticBorderRadius = exports.borderRadius = exports.semanticSpacing = exports.spacing = exports.textVariants = exports.letterSpacing = exports.fontWeights = exports.lineHeights = exports.fontSizes = exports.fontFamilies = exports.colors = void 0;
exports.useMeasuredFloatingFooter = exports.useRegisterFloatingFooter = exports.useFloatingFooterHeight = exports.useFloatingActionBottomOffset = exports.getFloatingActionBottomOffset = exports.FloatingFooterProvider = exports.useThemeStore = exports.useThemedStyles = exports.useThemeActions = exports.useThemeValue = exports.useTheme = exports.ThemeProvider = exports.themes = exports.defaultDark = exports.defaultLight = exports.Pagination = exports.FABGroup = exports.FAB = exports.ListSectionHeader = exports.ListItem = exports.NoConnectionState = exports.NoResultsState = exports.ErrorState = exports.EmptyState = exports.SearchWithFilters = exports.SearchBar = exports.Spacer = exports.Row = exports.Section = exports.ScreenContainer = exports.LargeHeader = void 0;
// ============================================
// TOKENS
// ============================================
var tokens_1 = require("./tokens");
// Colors
Object.defineProperty(exports, "colors", { enumerable: true, get: function () { return tokens_1.colors; } });
// Typography
Object.defineProperty(exports, "fontFamilies", { enumerable: true, get: function () { return tokens_1.fontFamilies; } });
Object.defineProperty(exports, "fontSizes", { enumerable: true, get: function () { return tokens_1.fontSizes; } });
Object.defineProperty(exports, "lineHeights", { enumerable: true, get: function () { return tokens_1.lineHeights; } });
Object.defineProperty(exports, "fontWeights", { enumerable: true, get: function () { return tokens_1.fontWeights; } });
Object.defineProperty(exports, "letterSpacing", { enumerable: true, get: function () { return tokens_1.letterSpacing; } });
Object.defineProperty(exports, "textVariants", { enumerable: true, get: function () { return tokens_1.textVariants; } });
// Spacing
Object.defineProperty(exports, "spacing", { enumerable: true, get: function () { return tokens_1.spacing; } });
Object.defineProperty(exports, "semanticSpacing", { enumerable: true, get: function () { return tokens_1.semanticSpacing; } });
Object.defineProperty(exports, "borderRadius", { enumerable: true, get: function () { return tokens_1.borderRadius; } });
Object.defineProperty(exports, "semanticBorderRadius", { enumerable: true, get: function () { return tokens_1.semanticBorderRadius; } });
Object.defineProperty(exports, "iconSizes", { enumerable: true, get: function () { return tokens_1.iconSizes; } });
Object.defineProperty(exports, "avatarSizes", { enumerable: true, get: function () { return tokens_1.avatarSizes; } });
Object.defineProperty(exports, "touchTargets", { enumerable: true, get: function () { return tokens_1.touchTargets; } });
Object.defineProperty(exports, "zIndex", { enumerable: true, get: function () { return tokens_1.zIndex; } });
// Shadows
Object.defineProperty(exports, "shadows", { enumerable: true, get: function () { return tokens_1.shadows; } });
Object.defineProperty(exports, "semanticShadows", { enumerable: true, get: function () { return tokens_1.semanticShadows; } });
Object.defineProperty(exports, "innerShadows", { enumerable: true, get: function () { return tokens_1.innerShadows; } });
Object.defineProperty(exports, "glowEffects", { enumerable: true, get: function () { return tokens_1.glowEffects; } });
// Animations
Object.defineProperty(exports, "durations", { enumerable: true, get: function () { return tokens_1.durations; } });
Object.defineProperty(exports, "easings", { enumerable: true, get: function () { return tokens_1.easings; } });
Object.defineProperty(exports, "springConfigs", { enumerable: true, get: function () { return tokens_1.springConfigs; } });
Object.defineProperty(exports, "semanticAnimations", { enumerable: true, get: function () { return tokens_1.semanticAnimations; } });
Object.defineProperty(exports, "activeOpacity", { enumerable: true, get: function () { return tokens_1.activeOpacity; } });
// Consolidated theme object
Object.defineProperty(exports, "designTokens", { enumerable: true, get: function () { return tokens_1.designTokens; } });
// ============================================
// COMPONENTS
// ============================================
var components_1 = require("./components");
// Primitives
Object.defineProperty(exports, "Text", { enumerable: true, get: function () { return components_1.Text; } });
Object.defineProperty(exports, "DisplayText", { enumerable: true, get: function () { return components_1.DisplayText; } });
Object.defineProperty(exports, "Heading", { enumerable: true, get: function () { return components_1.Heading; } });
Object.defineProperty(exports, "Title", { enumerable: true, get: function () { return components_1.Title; } });
Object.defineProperty(exports, "Body", { enumerable: true, get: function () { return components_1.Body; } });
Object.defineProperty(exports, "Label", { enumerable: true, get: function () { return components_1.Label; } });
Object.defineProperty(exports, "Caption", { enumerable: true, get: function () { return components_1.Caption; } });
Object.defineProperty(exports, "Numeric", { enumerable: true, get: function () { return components_1.Numeric; } });
Object.defineProperty(exports, "Button", { enumerable: true, get: function () { return components_1.Button; } });
Object.defineProperty(exports, "Card", { enumerable: true, get: function () { return components_1.Card; } });
Object.defineProperty(exports, "CardHeader", { enumerable: true, get: function () { return components_1.CardHeader; } });
Object.defineProperty(exports, "CardContent", { enumerable: true, get: function () { return components_1.CardContent; } });
Object.defineProperty(exports, "CardFooter", { enumerable: true, get: function () { return components_1.CardFooter; } });
Object.defineProperty(exports, "CardDivider", { enumerable: true, get: function () { return components_1.CardDivider; } });
Object.defineProperty(exports, "Input", { enumerable: true, get: function () { return components_1.Input; } });
Object.defineProperty(exports, "Badge", { enumerable: true, get: function () { return components_1.Badge; } });
Object.defineProperty(exports, "StatusBadge", { enumerable: true, get: function () { return components_1.StatusBadge; } });
Object.defineProperty(exports, "CounterBadge", { enumerable: true, get: function () { return components_1.CounterBadge; } });
Object.defineProperty(exports, "IconButton", { enumerable: true, get: function () { return components_1.IconButton; } });
Object.defineProperty(exports, "Avatar", { enumerable: true, get: function () { return components_1.Avatar; } });
Object.defineProperty(exports, "AvatarGroup", { enumerable: true, get: function () { return components_1.AvatarGroup; } });
Object.defineProperty(exports, "Divider", { enumerable: true, get: function () { return components_1.Divider; } });
Object.defineProperty(exports, "Chip", { enumerable: true, get: function () { return components_1.Chip; } });
Object.defineProperty(exports, "ChipGroup", { enumerable: true, get: function () { return components_1.ChipGroup; } });
// Layout
Object.defineProperty(exports, "ScreenHeader", { enumerable: true, get: function () { return components_1.ScreenHeader; } });
Object.defineProperty(exports, "LargeHeader", { enumerable: true, get: function () { return components_1.LargeHeader; } });
Object.defineProperty(exports, "ScreenContainer", { enumerable: true, get: function () { return components_1.ScreenContainer; } });
Object.defineProperty(exports, "Section", { enumerable: true, get: function () { return components_1.Section; } });
Object.defineProperty(exports, "Row", { enumerable: true, get: function () { return components_1.Row; } });
Object.defineProperty(exports, "Spacer", { enumerable: true, get: function () { return components_1.Spacer; } });
// Patterns
Object.defineProperty(exports, "SearchBar", { enumerable: true, get: function () { return components_1.SearchBar; } });
Object.defineProperty(exports, "SearchWithFilters", { enumerable: true, get: function () { return components_1.SearchWithFilters; } });
Object.defineProperty(exports, "EmptyState", { enumerable: true, get: function () { return components_1.EmptyState; } });
Object.defineProperty(exports, "ErrorState", { enumerable: true, get: function () { return components_1.ErrorState; } });
Object.defineProperty(exports, "NoResultsState", { enumerable: true, get: function () { return components_1.NoResultsState; } });
Object.defineProperty(exports, "NoConnectionState", { enumerable: true, get: function () { return components_1.NoConnectionState; } });
Object.defineProperty(exports, "ListItem", { enumerable: true, get: function () { return components_1.ListItem; } });
Object.defineProperty(exports, "ListSectionHeader", { enumerable: true, get: function () { return components_1.ListSectionHeader; } });
Object.defineProperty(exports, "FAB", { enumerable: true, get: function () { return components_1.FAB; } });
Object.defineProperty(exports, "FABGroup", { enumerable: true, get: function () { return components_1.FABGroup; } });
Object.defineProperty(exports, "Pagination", { enumerable: true, get: function () { return components_1.Pagination; } });
// ============================================
// THEMES (semantic theming + provider)
// ============================================
var themes_1 = require("./themes");
Object.defineProperty(exports, "defaultLight", { enumerable: true, get: function () { return themes_1.defaultLight; } });
Object.defineProperty(exports, "defaultDark", { enumerable: true, get: function () { return themes_1.defaultDark; } });
Object.defineProperty(exports, "themes", { enumerable: true, get: function () { return themes_1.themes; } });
Object.defineProperty(exports, "ThemeProvider", { enumerable: true, get: function () { return themes_1.ThemeProvider; } });
Object.defineProperty(exports, "useTheme", { enumerable: true, get: function () { return themes_1.useTheme; } });
Object.defineProperty(exports, "useThemeValue", { enumerable: true, get: function () { return themes_1.useThemeValue; } });
Object.defineProperty(exports, "useThemeActions", { enumerable: true, get: function () { return themes_1.useThemeActions; } });
Object.defineProperty(exports, "useThemedStyles", { enumerable: true, get: function () { return themes_1.useThemedStyles; } });
Object.defineProperty(exports, "useThemeStore", { enumerable: true, get: function () { return themes_1.useThemeStore; } });
// ============================================
// LAYOUT (floating footer registry)
// ============================================
var FloatingFooterProvider_1 = require("./layout/FloatingFooterProvider");
Object.defineProperty(exports, "FloatingFooterProvider", { enumerable: true, get: function () { return FloatingFooterProvider_1.FloatingFooterProvider; } });
Object.defineProperty(exports, "getFloatingActionBottomOffset", { enumerable: true, get: function () { return FloatingFooterProvider_1.getFloatingActionBottomOffset; } });
Object.defineProperty(exports, "useFloatingActionBottomOffset", { enumerable: true, get: function () { return FloatingFooterProvider_1.useFloatingActionBottomOffset; } });
Object.defineProperty(exports, "useFloatingFooterHeight", { enumerable: true, get: function () { return FloatingFooterProvider_1.useFloatingFooterHeight; } });
Object.defineProperty(exports, "useRegisterFloatingFooter", { enumerable: true, get: function () { return FloatingFooterProvider_1.useRegisterFloatingFooter; } });
Object.defineProperty(exports, "useMeasuredFloatingFooter", { enumerable: true, get: function () { return FloatingFooterProvider_1.useMeasuredFloatingFooter; } });
// ============================================
// DEFAULT EXPORT
// ============================================
const tokens_2 = require("./tokens");
exports.default = tokens_2.designTokens;
