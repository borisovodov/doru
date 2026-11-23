import { useCallback, useEffect, useRef, useState, type FocusEvent } from 'react';
import { registerAutoSaveFlush, useAutoSaveTabId } from './autosaveRegistry';

export interface AutoSaveOnBlurOptions {
  /** Autosave is off for new-entity forms; they are created explicitly. */
  enabled: boolean;
  /** True when the current draft differs from the persisted record. */
  isDirty: () => boolean;
  save: () => void | Promise<void>;
}

/**
 * Saves an existing entity when the user leaves one of its fields.
 *
 * Moving between fields coalesces through a short delay, so tabbing across a
 * form produces one write. Leaving the editor or clicking outside flushes
 * immediately. Controls marked `data-autosave-skip` (Save, Create, Delete)
 * are ignored so an explicit action is never preceded by an extra write.
 * A pending save is flushed when the editor unmounts unless `cancel` was
 * called first (the tab is deleting the entity); `cancel` also blocks closing
 * until the delete settles.
 */
export function useAutoSaveOnBlur({ enabled, isDirty, save }: AutoSaveOnBlurOptions) {
  const tabId = useAutoSaveTabId();
  const saveRef = useRef(save);
  const dirtyRef = useRef(isDirty);
  const cancelledRef = useRef<boolean>(false);
  const closeBlockedRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flushPromiseRef = useRef<Promise<boolean> | null>(null);
  const queuedRef = useRef<boolean>(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    saveRef.current = save;
    dirtyRef.current = isDirty;
  }, [save, isDirty]);

  const setFailure = useCallback((value: boolean) => {
    if (mountedRef.current) {
      setFailed(value);
    }
  }, []);

  const clearTimer = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = undefined;
  }, []);

  const flush = useCallback((): Promise<boolean> => {
    if (!enabled || cancelledRef.current) {
      return Promise.resolve(true);
    }
    if (flushPromiseRef.current !== null) {
      queuedRef.current = true;
      return flushPromiseRef.current;
    }
    const run = async (): Promise<boolean> => {
      let success = true;
      let again = true;
      while (again) {
        again = false;
        if (cancelledRef.current) {
          break;
        }
        if (!dirtyRef.current()) {
          setFailure(false);
          break;
        }
        try {
          await saveRef.current();
          success = true;
          setFailure(false);
        } catch {
          // The editor owns the error UI; keep the draft for the next attempt.
          success = false;
          setFailure(true);
        }
        // A concurrent flush marks the queue while this run is awaiting.
        // oxlint-disable-next-line typescript/no-unnecessary-condition
        if (queuedRef.current && !cancelledRef.current) {
          queuedRef.current = false;
          again = true;
          // Let React commit the saved baseline before the next dirty check.
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      return success;
    };
    const promise = run().finally(() => {
      if (flushPromiseRef.current === promise) {
        flushPromiseRef.current = null;
      }
    });
    flushPromiseRef.current = promise;
    return promise;
  }, [enabled, setFailure]);

  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const flushForClose = useCallback(async (): Promise<boolean> => {
    if (closeBlockedRef.current) {
      return false;
    }
    clearTimer();
    const success = await flush();
    return success && !closeBlockedRef.current;
  }, [clearTimer, flush]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    closeBlockedRef.current = true;
    queuedRef.current = false;
    clearTimer();
  }, [clearTimer]);

  const resume = useCallback(() => {
    cancelledRef.current = false;
    closeBlockedRef.current = false;
  }, []);

  /** Allows a successful deletion to close the tab while autosave stays off. */
  const release = useCallback(() => {
    closeBlockedRef.current = false;
  }, []);

  const retry = useCallback(() => {
    cancelledRef.current = false;
    closeBlockedRef.current = false;
    void flush();
  }, [flush]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimer();
      if (!cancelledRef.current) {
        // The tab is closing before the draft was persisted; flush it now.
        void flushRef.current();
      }
    };
  }, [clearTimer]);

  useEffect(() => {
    if (!enabled || tabId === null) {
      return undefined;
    }
    return registerAutoSaveFlush(tabId, {
      flush: flushForClose,
      isDirty: () => !cancelledRef.current && dirtyRef.current(),
    });
  }, [enabled, flushForClose, tabId]);

  const onBlur = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      if (!enabled || cancelledRef.current) {
        return;
      }
      const next = event.relatedTarget;
      if (next instanceof Element && next.closest('[data-autosave-skip]') !== null) {
        clearTimer();
        return;
      }
      const target = event.target;
      const composite = target instanceof Element ? target.closest('[data-autosave-field]') : null;
      if (composite !== null && next instanceof Node && composite.contains(next)) {
        return;
      }
      const isField =
        (target instanceof HTMLElement && target.matches('input, textarea, select, [contenteditable="true"]')) ||
        composite !== null;
      const leftEditor = next === null || !event.currentTarget.contains(next);
      if (!isField && !leftEditor) {
        return;
      }
      clearTimer();
      if (leftEditor) {
        void flush();
        return;
      }
      timerRef.current = setTimeout(() => void flush(), 250);
    },
    [clearTimer, enabled, flush],
  );

  return { onBlur, failed, retry, cancel, resume, release };
}
