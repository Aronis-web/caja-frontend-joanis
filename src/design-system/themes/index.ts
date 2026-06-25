/**
 * Design System - Themes Registry
 *
 * Punto de entrada para el sistema de temas: provider, hooks, store y temas base.
 */

import { defaultLight } from './defaultLight';
import { defaultDark } from './defaultDark';
import type { Theme } from './defaultLight';

export { defaultLight } from './defaultLight';
export { defaultDark } from './defaultDark';
export type { Theme } from './defaultLight';

export type ThemeName = 'defaultLight' | 'defaultDark';

export const themes: Record<ThemeName, Theme> = {
  defaultLight: defaultLight as unknown as Theme,
  defaultDark: defaultDark as unknown as Theme,
};

export { ThemeProvider, useTheme, useThemeValue, useThemeActions } from './ThemeProvider';

export { useThemedStyles } from './useThemedStyles';

export { useThemeStore } from './useThemeStore';
export type { ThemeMode } from './useThemeStore';
