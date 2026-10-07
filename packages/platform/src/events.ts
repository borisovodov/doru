import type { IDisposable } from './di';

export class Emitter<T> {
  private readonly listeners = new Set<(event: T) => void>();

  event(listener: (event: T) => void): IDisposable {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }

  fire(event: T): void {
    for (const listener of [...this.listeners]) {
      listener(event);
    }
  }
}
