import { BrowserWindow, ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';

const FLUSH_TIMEOUT_MS = 2000;
const pending = new Map<string, (ok: boolean) => void>();
const flushed = new WeakSet<BrowserWindow>();
const inFlight = new WeakMap<BrowserWindow, Promise<boolean>>();
let registered = false;

function registerIpc(): void {
  if (registered) {
    return;
  }
  registered = true;
  ipcMain.on('app:flush-autosaves:result', (_event, id: unknown, ok: unknown) => {
    if (typeof id !== 'string') {
      return;
    }
    const resolve = pending.get(id);
    if (resolve !== undefined) {
      pending.delete(id);
      resolve(ok === true);
    }
  });
}

/** True once this window answered a successful flush and may close. */
export function hasFlushedBeforeClose(window: BrowserWindow): boolean {
  return flushed.has(window);
}

/** Drops close permissions from a quit attempt that did not complete. */
export function forgetFlushedBeforeClose(windows: Iterable<BrowserWindow>): void {
  for (const window of windows) {
    flushed.delete(window);
    inFlight.delete(window);
  }
}

/**
 * Asks a renderer to persist every open editor without granting a close.
 * File moves and project rebinds use this before the old store goes away.
 */
export function requestRendererAutosaves(window: BrowserWindow): Promise<boolean> {
  return requestRendererFlush(window);
}

function requestRendererFlush(window: BrowserWindow): Promise<boolean> {
  const contents = window.webContents;
  if (contents.isDestroyed() || contents.isLoading()) {
    return Promise.resolve(true);
  }
  registerIpc();
  const id = randomUUID();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      // An editor that never answers is a failed flush: keep its window open
      // instead of discarding the draft.
      pending.delete(id);
      resolve(false);
    }, FLUSH_TIMEOUT_MS);
    pending.set(id, (ok) => {
      clearTimeout(timer);
      resolve(ok);
    });
    contents.send('app:flush-autosaves', id);
  });
}

/**
 * Asks a renderer to persist every open editor before its window closes.
 * Repeated requests share one IPC round-trip so the quit and window-close
 * paths can both await the same flush. A failed flush is retryable.
 */
export function flushWindowBeforeClose(window: BrowserWindow): Promise<boolean> {
  if (flushed.has(window)) {
    return Promise.resolve(true);
  }
  const existing = inFlight.get(window);
  if (existing !== undefined) {
    return existing;
  }
  const promise = requestRendererFlush(window).then((ok) => {
    if (ok) {
      flushed.add(window);
    }
    return ok;
  });
  inFlight.set(window, promise);
  void promise.finally(() => {
    if (inFlight.get(window) === promise) {
      inFlight.delete(window);
    }
  });
  return promise;
}
