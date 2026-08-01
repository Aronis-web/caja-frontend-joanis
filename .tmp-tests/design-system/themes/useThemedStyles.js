"use strict";
/**
 * useThemedStyles
 *
 * Memoiza la factory de estilos por tema usando WeakMap (factory) + Map (theme.name).
 * El callback recibe el theme actual y devuelve un objeto de estilos. La misma
 * referencia se reutiliza mientras factory + theme.name no cambien.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.useThemedStyles = useThemedStyles;
const ThemeProvider_1 = require("./ThemeProvider");
const factoryCache = new WeakMap();
function useThemedStyles(factory) {
    const theme = (0, ThemeProvider_1.useTheme)();
    let perTheme = factoryCache.get(factory);
    if (!perTheme) {
        perTheme = new Map();
        factoryCache.set(factory, perTheme);
    }
    let cached = perTheme.get(theme.name);
    if (cached === undefined) {
        cached = factory(theme);
        perTheme.set(theme.name, cached);
    }
    return cached;
}
exports.default = useThemedStyles;
