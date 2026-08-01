"use strict";
/**
 * Theme Store
 *
 * Re-exporta el store global de tema desde `@/store/theme` para que la API
 * publica del design-system sea autocontenida.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = exports.useThemeStore = void 0;
var theme_1 = require("@/store/theme");
Object.defineProperty(exports, "useThemeStore", { enumerable: true, get: function () { return theme_1.useThemeStore; } });
Object.defineProperty(exports, "default", { enumerable: true, get: function () { return __importDefault(theme_1).default; } });
