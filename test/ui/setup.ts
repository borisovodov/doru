import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver = ResizeObserverStub;

class IntersectionObserverStub implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly scrollMargin = '';
  readonly thresholds: readonly number[] = [];
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
globalThis.IntersectionObserver = IntersectionObserverStub;

window.matchMedia = (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;

Element.prototype.scrollIntoView = () => {};
Element.prototype.setPointerCapture = () => {};
Element.prototype.releasePointerCapture = () => {};
Element.prototype.hasPointerCapture = () => false;

globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
  callback(Date.now());
  return 0;
};
globalThis.cancelAnimationFrame = () => {};

// jsdom ships no canvas backend; TabBar measures label widths via a 2D context.
HTMLCanvasElement.prototype.getContext = (() => ({
  font: '',
  measureText: (text: string) => ({ width: text.length * 8 }),
})) as unknown as typeof HTMLCanvasElement.prototype.getContext;

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
