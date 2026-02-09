import React, { ComponentType, lazy, Suspense } from 'react';
import { LazyLoadFallback } from '@/components/common/LazyLoadFallback';

/**
 * Utility to create lazy-loaded components with Suspense boundary
 */
export function lazyLoad<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallbackMessage?: string
): React.FC<React.ComponentProps<T>> {
  const LazyComponent = lazy(importFunc);

  return (props: React.ComponentProps<T>) => (
    <Suspense fallback={<LazyLoadFallback message={fallbackMessage} />}>
      <LazyComponent {...props} />
    </Suspense>
  );
}

/**
 * Preload a lazy-loaded component
 */
export function preloadComponent(importFunc: () => Promise<any>): void {
  importFunc();
}
