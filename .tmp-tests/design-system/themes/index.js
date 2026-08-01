"use strict";
/**
 * Design System - Themes Registry
 *
 * Punto de entrada para el sistema de temas: provider, hooks, store y temas base.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.useThemeStore = exports.useThemedStyles = exports.useThemeActions = exports.useThemeValue = exports.useTheme = exports.ThemeProvider = exports.themes = exports.defaultDark = exports.defaultLight = void 0;
const defaultLight_1 = require("./defaultLight");
const defaultDark_1 = require("./defaultDark");
var defaultLight_2 = require("./defaultLight");
Object.defineProperty(exports, "defaultLight", { enumerable: true, get: function () { return defaultLight_2.defaultLight; } });
var defaultDark_2 = require("./defaultDark");
Object.defineProperty(exports, "defaultDark", { enumerable: true, get: function () { return defaultDark_2.defaultDark; } });
exports.themes = {
    defaultLight: defaultLight_1.defaultLight,
    defaultDark: defaultDark_1.defaultDark,
};
var ThemeProvider_1 = require("./ThemeProvider");
Object.defineProperty(exports, "ThemeProvider", { enumerable: true, get: function () { return ThemeProvider_1.ThemeProvider; } });
Object.defineProperty(exports, "useTheme", { enumerable: true, get: function () { return ThemeProvider_1.useTheme; } });
Object.defineProperty(exports, "useThemeValue", { enumerable: true, get: function () { return ThemeProvider_1.useThemeValue; } });
Object.defineProperty(exports, "useThemeActions", { enumerable: true, get: function () { return ThemeProvider_1.useThemeActions; } });
var useThemedStyles_1 = require("./useThemedStyles");
Object.defineProperty(exports, "useThemedStyles", { enumerable: true, get: function () { return useThemedStyles_1.useThemedStyles; } });
var useThemeStore_1 = require("./useThemeStore");
Object.defineProperty(exports, "useThemeStore", { enumerable: true, get: function () { return useThemeStore_1.useThemeStore; } });
