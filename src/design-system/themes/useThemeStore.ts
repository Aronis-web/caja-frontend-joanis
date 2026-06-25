/**
 * Theme Store
 *
 * Re-exporta el store global de tema desde `@/store/theme` para que la API
 * publica del design-system sea autocontenida.
 */

export { useThemeStore, default } from '@/store/theme';
export type { ThemeMode, ThemeStoreState } from '@/store/theme';
