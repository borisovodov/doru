import { useCallback, useEffect, useRef, type FocusEvent } from 'react';

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
 */
export function useAutoSaveOnBlur({ enabled, isDirty, save }: AutoSaveOnBlurOptions) {
  const saveRef = useRef(save);
  const dirtyRef = useRef(isDirty);
  const busyRef = useRef(false);
  const queuedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    saveRef.current = save;
    dirtyRef.current = isDirty;
  }, [save, isDirty]);

  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
    },
    [],
  );

  const flush = useCallback(async () => {
    if (!enabled) {
      return;
    }
    if (busyRef.current) {
      queuedRef.current = true;
      return;
    }
    if (!dirtyRef.current()) {
      return;
    }
    busyRef.current = true;
    try {
      await saveRef.current();
    } catch {
      // The editor owns the error UI; keep the draft for the next attempt.
    } finally {
      busyRef.current = false;
      if (queuedRef.current) {
        queuedRef.current = false;
        void flush();
      }
    }
  }, [enabled]);

  const onBlur = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      if (!enabled) {
        return;
      }
      const next = event.relatedTarget;
      if (next instanceof Element && next.closest('[data-autosave-skip]') !== null) {
        return;
      }
      const target = event.target;
      const isField =
        target instanceof HTMLElement && target.matches('input, textarea, select, [contenteditable="true"]');
      const leftEditor = next === null || !event.currentTarget.contains(next);
      if (!isField && !leftEditor) {
        return;
      }
      clearTimeout(timerRef.current);
      if (leftEditor) {
        void flush();
        return;
      }
      timerRef.current = setTimeout(() => void flush(), 250);
    },
    [enabled, flush],
  );

  return { onBlur };
}
