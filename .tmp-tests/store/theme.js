"use strict";
/**
 * Theme Store - Gestion del tema (claro / oscuro / sistema)
 *
 * Zustand store con persistencia para el modo de tema. Soporta override
 * explicito de tema y deteccion automatica del esquema del sistema.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useThemeStore = void 0;
const zustand_1 = require("zustand");
const middleware_1 = require("zustand/middleware");
const async_storage_1 = __importDefault(require("@react-native-async-storage/async-storage"));
const computeIsDark = (mode, systemScheme) => mode === 'dark' || (mode === 'system' && systemScheme === 'dark');
exports.useThemeStore = (0, zustand_1.create)()((0, middleware_1.persist)((set, get) => ({
    mode: 'light',
    systemScheme: 'light',
    themeOverride: null,
    isDarkMode: false,
    setMode: (mode) => {
        set({ mode, isDarkMode: computeIsDark(mode, get().systemScheme) });
    },
    toggleMode: () => {
        const newMode = get().isDarkMode ? 'light' : 'dark';
        set({ mode: newMode, isDarkMode: newMode === 'dark' });
    },
    setSystemScheme: (scheme) => {
        set({ systemScheme: scheme, isDarkMode: computeIsDark(get().mode, scheme) });
    },
    setThemeOverride: (name) => {
        set({ themeOverride: name });
    },
}), {
    name: 'theme-storage',
    storage: (0, middleware_1.createJSONStorage)(() => async_storage_1.default),
    partialize: (state) => ({
        mode: state.mode,
        themeOverride: state.themeOverride,
        isDarkMode: state.isDarkMode,
    }),
}));
exports.default = exports.useThemeStore;
