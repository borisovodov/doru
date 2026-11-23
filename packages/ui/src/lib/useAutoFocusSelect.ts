import { useEffect, useRef, type RefObject } from 'react';

/**
 * Places the cursor in a field when a new-entity tab opens and selects what
 * is already there, so typing replaces it. The `enabled` flag keeps the
 * effect off for existing records. A placeholder is browser-rendered text,
 * not a value, so it stays visible while the empty field is focused.
 */
export function useAutoFocusSelect<T extends HTMLInputElement | HTMLTextAreaElement>(
  enabled = true,
): RefObject<T | null> {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const field = ref.current;
    if (field === null) {
      return;
    }
    field.focus();
    field.select();
  }, [enabled]);

  return ref;
}
