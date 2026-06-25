/**
 * FloatingFooterProvider
 *
 * Registry global de footers flotantes (ej. barras pegadas al borde inferior).
 * Permite que un FAB calcule su offset bottom dinamicamente segun la suma de
 * footers visibles en pantalla + safe area + tier (modulo o root).
 *
 * Uso:
 *   - Envolver la app con <FloatingFooterProvider>
 *   - En un footer:  const { onLayout } = useMeasuredFloatingFooter()
 *   - En un FAB:     const bottom = useFloatingActionBottomOffset('menu')
 */

import React, { ReactNode, useCallback, useId, useLayoutEffect, useRef } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { create, type StoreApi, type UseBoundStore } from 'zustand';

type FooterMap = Record<string, number>;

interface FooterStoreState {
  footers: FooterMap;
  height: number;
  registerFooter: (id: string, height: number) => void;
  unregisterFooter: (id: string) => void;
}

const sumMax = (map: FooterMap): number => {
  const values = Object.values(map);
  return values.length > 0 ? Math.max(...values) : 0;
};

// Singleton global: el store debe sobrevivir al unmount del Provider
const STORE_KEY = '__erpAioFloatingFooterStore__';
const globalAny = globalThis as { [k: string]: unknown };

type FooterStore = UseBoundStore<StoreApi<FooterStoreState>>;

const createFooterStore = (): FooterStore =>
  create<FooterStoreState>((set) => ({
    footers: {},
    height: 0,
    registerFooter: (id, height) =>
      set((state) => {
        if (state.footers[id] === height) return state;
        const next = { ...state.footers, [id]: height };
        return { footers: next, height: sumMax(next) };
      }),
    unregisterFooter: (id) =>
      set((state) => {
        if (!(id in state.footers)) return state;
        const next = { ...state.footers };
        delete next[id];
        return { footers: next, height: sumMax(next) };
      }),
  }));

const useFooterStore: FooterStore =
  (globalAny[STORE_KEY] as FooterStore | undefined) ??
  ((globalAny[STORE_KEY] = createFooterStore()) as FooterStore);

export const FloatingFooterProvider: React.FC<{ children: ReactNode }> = ({ children }) => (
  <>{children}</>
);

type Tier = 'module' | 'root' | 'menu';

interface OffsetParams {
  footerHeight: number;
  safeAreaBottom?: number;
  tier?: Tier;
  bottom?: number;
}

export const getFloatingActionBottomOffset = ({
  footerHeight,
  safeAreaBottom = 0,
  tier = 'module',
  bottom,
}: OffsetParams): number =>
  safeAreaBottom + footerHeight + (bottom ?? 2) + (tier === 'module' ? 66 : 0);

export const useFloatingFooterHeight = (): number => useFooterStore((s) => s.height);

export const useFloatingActionBottomOffset = (
  tier: Tier = 'module',
  safeAreaBottom = 0,
  bottom?: number
): number => {
  const footerHeight = useFloatingFooterHeight();
  return getFloatingActionBottomOffset({ footerHeight, safeAreaBottom, tier, bottom });
};

export const useRegisterFloatingFooter = () => ({
  registerFooter: useFooterStore((s) => s.registerFooter),
  unregisterFooter: useFooterStore((s) => s.unregisterFooter),
});

export const useMeasuredFloatingFooter = (defaultHeight = 60) => {
  const id = useId();
  const { registerFooter, unregisterFooter } = useRegisterFloatingFooter();
  const lastHeight = useRef(0);

  useLayoutEffect(() => {
    const initial = lastHeight.current || defaultHeight;
    lastHeight.current = initial;
    registerFooter(id, initial);
    return () => {
      unregisterFooter(id);
    };
  }, [id, registerFooter, unregisterFooter, defaultHeight]);

  return {
    onLayout: useCallback(
      (e: LayoutChangeEvent) => {
        const h = Math.round(e.nativeEvent.layout.height);
        if (h > 0 && h !== lastHeight.current) {
          lastHeight.current = h;
          registerFooter(id, h);
        }
      },
      [id, registerFooter]
    ),
  };
};
