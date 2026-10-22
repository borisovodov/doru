import { existsSync, statSync, watch, type FSWatcher } from 'node:fs';
import { basename, dirname } from 'node:path';
import { OpQueue, type MutationContext, type Op } from '@doru/core';
import { log } from './log';
import { projectWindows } from './state';

/**
 * Watches open project files for external changes — another Dóru instance,
 * an ACP agent, or any MCP client writing through its own connection — and
 * tells the bound window to reload. The app's own writes are stamped through
 * `trackedQueue`, and the watcher echoes they produce are ignored.
 */

/** Timestamps of the app's own latest write, per project path. */
const selfWrites = new Map<string, number>();

/** Live watchers, per project path. */
const watchers = new Map<string, FSWatcher>();

/** Pending debounce timers, per project path. */
const timers = new Map<string, NodeJS.Timeout>();

/** File mtime at the last notified change, per project path. */
const notifiedMtimes = new Map<string, number>();

/** A burst of file events coalesces into one notification (SQLite writes fan out). */
const DEBOUNCE_MS = 250;

/** Events this soon after the app's own write are its watcher echo. */
const SELF_WRITE_GRACE_MS = 1500;

export function markSelfWrite(projectPath: string): void {
  selfWrites.set(projectPath, Date.now());
}

/** True when an event at `now` is (probably) the echo of the app's own write. */
export function isSelfWriteEcho(projectPath: string, now: number): boolean {
  const stamp = selfWrites.get(projectPath);
  return stamp !== undefined && now - stamp < SELF_WRITE_GRACE_MS;
}

/**
 * A project op queue that stamps the project as self-written on every
 * mutation made by the app itself — ops are the only write path. A subclass
 * of `OpQueue`, so runtimes keep working with the same nominal type.
 */
export class StampedOpQueue extends OpQueue {
  constructor(private readonly onWrite: () => void) {
    super();
  }

  override apply(op: Op, ctx: MutationContext): void {
    super.apply(op, ctx);
    this.onWrite();
  }

  override undo(ctx: MutationContext): Op | undefined {
    const op = super.undo(ctx);
    if (op) {
      this.onWrite();
    }
    return op;
  }

  override redo(ctx: MutationContext): Op | undefined {
    const op = super.redo(ctx);
    if (op) {
      this.onWrite();
    }
    return op;
  }
}

function notify(projectPath: string): void {
  const window = projectWindows.get(projectPath);
  if (!window || window.isDestroyed()) {
    return;
  }
  window.webContents.send('tree:externalChange');
  log.debug('tree: external change detected', { projectPath });
}

export function startTreeWatcher(projectPath: string): void {
  if (watchers.has(projectPath)) {
    return;
  }
  const fileName = basename(projectPath);
  let watcher: FSWatcher;
  try {
    // The directory is watched rather than the file so atomic rewrites and
    // the journal churn around SQLite writes still produce events.
    watcher = watch(dirname(projectPath), (_event, changed) => {
      if (changed !== fileName) {
        return;
      }
      const now = Date.now();
      if (isSelfWriteEcho(projectPath, now) || !existsSync(projectPath)) {
        return;
      }
      const pending = timers.get(projectPath);
      if (pending) {
        clearTimeout(pending);
      }
      timers.set(
        projectPath,
        setTimeout(() => {
          timers.delete(projectPath);
          try {
            const mtime = statSync(projectPath).mtimeMs;
            if (notifiedMtimes.get(projectPath) === mtime) {
              return;
            }
            notifiedMtimes.set(projectPath, mtime);
          } catch {
            return;
          }
          notify(projectPath);
        }, DEBOUNCE_MS),
      );
    });
  } catch {
    log.warn('could not watch the project file', { projectPath });
    return;
  }
  watcher.unref();
  watchers.set(projectPath, watcher);
  log.debug('tree: watcher started', { projectPath });
}

export function stopTreeWatcher(projectPath: string): void {
  const pending = timers.get(projectPath);
  if (pending) {
    clearTimeout(pending);
  }
  timers.delete(projectPath);
  selfWrites.delete(projectPath);
  notifiedMtimes.delete(projectPath);
  const watcher = watchers.get(projectPath);
  if (watcher) {
    watcher.close();
    watchers.delete(projectPath);
  }
}
