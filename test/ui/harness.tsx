import '@testing-library/jest-dom/vitest';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';

/** Renders a component with the shared jsdom setup (nls bundles are static). */
export function renderUi(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>): RenderResult {
  return render(ui, options);
}

/**
 * Builds a typed API stub: declared members behave as given, every other
 * method resolves to `undefined`. Tests must override every member the
 * component actually calls and returns data from.
 */
export function stubApi<T extends object>(overrides: Partial<T>): T {
  return new Proxy(overrides, {
    get(target, property, receiver) {
      if (Reflect.has(target, property)) {
        return Reflect.get(target, property, receiver) as unknown;
      }
      return () => Promise.resolve(undefined);
    },
  }) as T;
}
