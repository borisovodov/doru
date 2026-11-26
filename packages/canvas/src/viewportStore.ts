import type { Viewport } from './types';

/** A tiny external store so only viewport consumers re-render on pan/zoom. */
export class ViewportStore {
  private state: Viewport = { x: 0, y: 0, zoom: 1 };
  private readonly listeners = new Set<() => void>();

  getSnapshot = (): Viewport => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  set = (next: Viewport): void => {
    if (next.x === this.state.x && next.y === this.state.y && next.zoom === this.state.zoom) {
      return;
    }
    this.state = next;
    for (const listener of this.listeners) {
      listener();
    }
  };
}
