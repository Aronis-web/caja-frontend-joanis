/**
 * useThemedStyles
 *
 * Memoiza la factory de estilos por tema usando WeakMap (factory) + Map (theme.name).
 * El callback recibe el theme actual y devuelve un objeto de estilos. La misma
 * referencia se reutiliza mientras factory + theme.name no cambien.
 */

import { useTheme } from './ThemeProvider';
import type { Theme } from './defaultLight';

type StyleFactory<T> = (theme: Theme) => T;

const factoryCache = new WeakMap<StyleFactory<unknown>, Map<string, unknown>>();

export function useThemedStyles<T>(factory: StyleFactory<T>): T {
  const theme = useTheme();
  let perTheme = factoryCache.get(factory as StyleFactory<unknown>);
  if (!perTheme) {
    perTheme = new Map();
    factoryCache.set(factory as StyleFactory<unknown>, perTheme);
  }
  let cached = perTheme.get(theme.name) as T | undefined;
  if (cached === undefined) {
    cached = factory(theme);
    perTheme.set(theme.name, cached);
  }
  return cached;
}

export default useThemedStyles;
