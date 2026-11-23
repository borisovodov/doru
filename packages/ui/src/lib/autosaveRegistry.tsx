import { createContext, useContext, type ReactNode } from 'react';

type AutoSaveEntry = {
  flush: () => Promise<boolean>;
  isDirty: () => boolean;
  /** True while a write started by this editor is still unsettled. */
  isSaving?: () => boolean;
};

const AutoSaveTabContext = createContext<string | null>(null);

/** Makes the current workbench tab id available to entity editors. */
export function AutoSaveTabProvider({ tabId, children }: { tabId: string; children: ReactNode }) {
  return <AutoSaveTabContext.Provider value={tabId}>{children}</AutoSaveTabContext.Provider>;
}

/** The workbench tab id, or null outside a tab (gallery, unit tests). */
export function useAutoSaveTabId(): string | null {
  return useContext(AutoSaveTabContext);
}

const flushes = new Map<string, Set<AutoSaveEntry>>();

/** Registers one editor's close-time save; returns the unregister callback. */
export function registerAutoSaveFlush(tabId: string, entry: AutoSaveEntry): () => void {
  let set = flushes.get(tabId);
  if (set === undefined) {
    set = new Set();
    flushes.set(tabId, set);
  }
  set.add(entry);
  return () => {
    set.delete(entry);
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
 * false when any save failed or an editor is still dirty after the save, so
 * the caller can keep the tab open.
 */
export async function flushAutoSaves(tabId: string): Promise<boolean> {
  const set = flushes.get(tabId);
  if (set === undefined) {
    return true;
  }
  const entries = [...set];
  for (let round = 0; round < 2; round += 1) {
    const results = await Promise.all(entries.map((entry) => entry.flush().catch(() => false)));
    if (!results.every(Boolean)) {
      return false;
    }
    // Let React commit the save's state updates before asking the editors
    // whether the latest draft is now clean.
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (!entries.some((entry) => entry.isDirty() || entry.isSaving?.() === true)) {
      return true;
    }
  }
  return false;
}

/** Flushes every open editor; used before the whole window closes. */
export async function flushAllAutoSaves(): Promise<boolean> {
  for (let round = 0; round < 4; round += 1) {
    const results = await Promise.all([...flushes.keys()].map((tabId) => flushAutoSaves(tabId)));
    if (!results.every(Boolean)) {
      return false;
    }
    // A fast tab may become dirty or start another write while a slower one
    // is still saving; recheck dirty state and in-flight writes before
    // claiming the window is safe.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const busy = [...flushes.values()].some((set) =>
      [...set].some((entry) => entry.isDirty() || entry.isSaving?.() === true),
    );
    if (!busy) {
      return true;
    }
  }
  return false;
}
