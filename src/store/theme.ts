/**
 * Theme Store - Gestion del tema (claro / oscuro / sistema)
 *
 * Zustand store con persistencia para el modo de tema. Soporta override
 * explicito de tema y deteccion automatica del esquema del sistema.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ColorScheme = 'light' | 'dark';

export interface ThemeStoreState {
  mode: ThemeMode;
  systemScheme: ColorScheme;
  themeOverride: string | null;
  isDarkMode: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  setSystemScheme: (scheme: ColorScheme) => void;
  setThemeOverride: (name: string | null) => void;
}

const computeIsDark = (mode: ThemeMode, systemScheme: ColorScheme): boolean =>
  mode === 'dark' || (mode === 'system' && systemScheme === 'dark');

export const useThemeStore = create<ThemeStoreState>()(
  persist(
    (set, get) => ({
      mode: 'light',
      systemScheme: 'light',
      themeOverride: null,
      isDarkMode: false,

      setMode: (mode) => {
        set({ mode, isDarkMode: computeIsDark(mode, get().systemScheme) });
      },

      toggleMode: () => {
        const newMode: ThemeMode = get().isDarkMode ? 'light' : 'dark';
        set({ mode: newMode, isDarkMode: newMode === 'dark' });
      },

      setSystemScheme: (scheme) => {
        set({ systemScheme: scheme, isDarkMode: computeIsDark(get().mode, scheme) });
      },

      setThemeOverride: (name) => {
        set({ themeOverride: name });
      },
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        mode: state.mode,
        themeOverride: state.themeOverride,
        isDarkMode: state.isDarkMode,
      }),
    }
  )
);

export default useThemeStore;
