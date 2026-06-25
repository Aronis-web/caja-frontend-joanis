/**
 * ThemeProvider
 *
 * Provee dos contextos: el valor del tema (theme/themeName/mode/isDark) y las
 * acciones para cambiarlo (setMode/toggleMode/setThemeOverride). Aplica
 * side-effects de plataforma (meta color-scheme + body bg en web, electronAPI
 * para sincronizar la barra de titulo nativa).
 */

import React, { createContext, ReactNode, useContext, useEffect, useMemo } from 'react';
import { Appearance } from 'react-native';
import { useThemeStore } from '@/store/theme';
import type { ThemeMode } from '@/store/theme';
import { themes, type Theme, type ThemeName } from './index';

interface ThemeContextValue {
  theme: Theme;
  themeName: ThemeName;
  mode: ThemeMode;
  isDark: boolean;
}

interface ThemeActionsValue {
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  setThemeOverride: (name: string | null) => void;
}

const ThemeValueContext = createContext<ThemeContextValue | undefined>(undefined);
const ThemeActionsContext = createContext<ThemeActionsValue | undefined>(undefined);

const applyDomSideEffects = (theme: Theme) => {
  if (typeof document === 'undefined') return;
  document.documentElement.style.colorScheme = theme.scheme;
  document.body.style.backgroundColor = theme.color.background.canvas;
  let meta = document.querySelector('meta[name="color-scheme"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'color-scheme';
    document.head.appendChild(meta);
  }
  meta.content = theme.scheme;
  const electronAPI = (globalThis as { electronAPI?: { setTheme?: (s: string) => void } })
    .electronAPI;
  electronAPI?.setTheme?.(theme.scheme);
};

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const mode = useThemeStore((s) => s.mode);
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const themeOverride = useThemeStore((s) => s.themeOverride);

  useEffect(() => {
    const sync = (scheme: string | null | undefined) => {
      useThemeStore.getState().setSystemScheme(scheme === 'dark' ? 'dark' : 'light');
    };
    sync(Appearance.getColorScheme());
    const sub = Appearance.addChangeListener(({ colorScheme }) => sync(colorScheme));
    return () => sub.remove();
  }, []);

  const themeName = (themeOverride ?? (isDarkMode ? 'defaultDark' : 'defaultLight')) as ThemeName;
  const theme = themes[themeName] ?? themes.defaultLight;

  useEffect(() => {
    applyDomSideEffects(theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, themeName, mode, isDark: theme.scheme === 'dark' }),
    [theme, themeName, mode]
  );

  const actions = useMemo<ThemeActionsValue>(() => {
    const s = useThemeStore.getState();
    return {
      setMode: s.setMode,
      toggleMode: s.toggleMode,
      setThemeOverride: s.setThemeOverride,
    };
  }, []);

  return (
    <ThemeActionsContext.Provider value={actions}>
      <ThemeValueContext.Provider value={value}>{children}</ThemeValueContext.Provider>
    </ThemeActionsContext.Provider>
  );
};

export const useTheme = (): Theme => {
  const ctx = useContext(ThemeValueContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
  return ctx.theme;
};

export const useThemeValue = (): ThemeContextValue => {
  const ctx = useContext(ThemeValueContext);
  if (!ctx) throw new Error('useThemeValue debe usarse dentro de <ThemeProvider>');
  return ctx;
};

export const useThemeActions = (): ThemeActionsValue => {
  const ctx = useContext(ThemeActionsContext);
  if (!ctx) throw new Error('useThemeActions debe usarse dentro de <ThemeProvider>');
  return ctx;
};

export default ThemeProvider;
