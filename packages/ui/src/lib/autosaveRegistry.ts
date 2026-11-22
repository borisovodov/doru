type AutoSaveFlush = () => Promise<boolean>;

const flushes = new Set<AutoSaveFlush>();

/** Registers an editor's close-time save; returns the unregister callback. */
export function registerAutoSaveFlush(flush: AutoSaveFlush): () => void {
  flushes.add(flush);
  return () => {
    flushes.delete(flush);
  };
}

/** True when any mounted entity editor can flush a pending draft. */
export function hasAutoSaves(): boolean {
  return flushes.size > 0;
}

/**
 * Flushes every mounted editor before a tab is closed. Returns false when any
 * save failed, so the caller can keep the tab open and show its error state.
 */
export async function flushAutoSaves(): Promise<boolean> {
  const results = await Promise.all([...flushes].map((flush) => flush().catch(() => false)));
  return results.every(Boolean);
}
