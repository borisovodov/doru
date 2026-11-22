import { useCallback, useEffect, useRef, useState, type FocusEvent } from 'react';
import { registerAutoSaveFlush } from './autosaveRegistry';

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
 * called first (the tab is deleting the entity).
 */
export function useAutoSaveOnBlur({ enabled, isDirty, save }: AutoSaveOnBlurOptions) {
  const saveRef = useRef(save);
  const dirtyRef = useRef(isDirty);
  const busyRef = useRef<boolean>(false);
  const queuedRef = useRef<boolean>(false);
  const cancelledRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);
  const failedRef = useRef<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    saveRef.current = save;
    dirtyRef.current = isDirty;
  }, [save, isDirty]);

  const setFailure = useCallback((value: boolean) => {
    failedRef.current = value;
    if (mountedRef.current) {
      setFailed(value);
    }
  }, []);

  const clearTimer = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = undefined;
  }, []);

  const flush = useCallback(async (): Promise<boolean> => {
    if (!enabled || cancelledRef.current) {
      return true;
    }
    if (busyRef.current) {
      queuedRef.current = true;
      return true;
    }
    if (!dirtyRef.current()) {
      setFailure(false);
      return true;
    }
    busyRef.current = true;
    let success = true;
    try {
      await saveRef.current();
    } catch {
      // The editor owns the error UI; keep the draft for the next attempt.
      success = false;
      setFailure(true);
    } finally {
      busyRef.current = false;
      // A concurrent flush marks the queue while this one is awaiting.
      // oxlint-disable-next-line typescript/no-unnecessary-condition
      if (queuedRef.current && !cancelledRef.current) {
        queuedRef.current = false;
        // Let React commit the save's state updates before the next dirty check.
        await new Promise((resolve) => setTimeout(resolve, 0));
        success = await flush();
      }
    }
    if (success) {
      setFailure(false);
    }
    return success;
  }, [enabled, setFailure]);

  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const flushForClose = useCallback(async (): Promise<boolean> => {
    clearTimer();
    while (busyRef.current) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return flush();
  }, [clearTimer, flush]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    queuedRef.current = false;
    clearTimer();
  }, [clearTimer]);

  const resume = useCallback(() => {
    cancelledRef.current = false;
  }, []);

  const retry = useCallback(() => {
    cancelledRef.current = false;
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
    if (!enabled) {
      return undefined;
    }
    return registerAutoSaveFlush(flushForClose);
  }, [enabled, flushForClose]);

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

  return { onBlur, failed, retry, cancel, resume };
}
