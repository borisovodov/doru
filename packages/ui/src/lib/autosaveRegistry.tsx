import { createContext, useContext, type ReactNode } from 'react';

type AutoSaveFlush = () => Promise<boolean>;

const AutoSaveTabContext = createContext<string | null>(null);

/** Makes the current workbench tab id available to entity editors. */
export function AutoSaveTabProvider({ tabId, children }: { tabId: string; children: ReactNode }) {
  return <AutoSaveTabContext.Provider value={tabId}>{children}</AutoSaveTabContext.Provider>;
}

/** The workbench tab id, or null outside a tab (gallery, unit tests). */
export function useAutoSaveTabId(): string | null {
  return useContext(AutoSaveTabContext);
}

const flushes = new Map<string, Set<AutoSaveFlush>>();

/** Registers one editor's close-time save; returns the unregister callback. */
export function registerAutoSaveFlush(tabId: string, flush: AutoSaveFlush): () => void {
  let set = flushes.get(tabId);
  if (set === undefined) {
    set = new Set();
    flushes.set(tabId, set);
  }
  set.add(flush);
  return () => {
    set.delete(flush);
    if (set.size === 0) {
      flushes.delete(tabId);
    }
  };
}

/** True when the tab has any mounted editor that can flush a draft. */
export function hasAutoSaves(tabId: string): boolean {
  return flushes.has(tabId);
}

/**
 * Flushes the entity editors mounted in one tab before it closes. Returns
 * false when any save failed, so the caller can keep the tab open.
 */
export async function flushAutoSaves(tabId: string): Promise<boolean> {
  const set = flushes.get(tabId);
  if (set === undefined) {
    return true;
  }
  const results = await Promise.all([...set].map((flush) => flush().catch(() => false)));
  return results.every(Boolean);
}
