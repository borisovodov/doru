import { moveTab } from '@doru/workbench';
import type { OpenTab } from './types';

export interface TabsState {
  openTabs: OpenTab[];
  activeTabId: string | null;
}

export function openTab(state: TabsState, id: string): TabsState {
  if (state.openTabs.some((tab) => tab.id === id)) {
    return { ...state, activeTabId: id };
  }
  return {
    openTabs: [...state.openTabs, { id, closable: true }],
    activeTabId: id,
  };
}

export function closeTab(state: TabsState, id: string): TabsState {
  const index = state.openTabs.findIndex((tab) => tab.id === id);
  if (index === -1) {
    return state;
  }
  const openTabs = state.openTabs.filter((tab) => tab.id !== id);
  if (state.activeTabId !== id) {
    return { openTabs, activeTabId: state.activeTabId };
  }
  const next = openTabs[Math.min(index, openTabs.length - 1)] ?? null;
  return { openTabs, activeTabId: next?.id ?? null };
}

export function replaceTab(state: TabsState, oldId: string, newId: string): TabsState {
  const openTabs = state.openTabs.some((tab) => tab.id === newId)
    ? state.openTabs.filter((tab) => tab.id !== oldId)
    : state.openTabs.map((tab) => (tab.id === oldId ? { ...tab, id: newId } : tab));
  return {
    openTabs,
    activeTabId: state.activeTabId === oldId ? newId : state.activeTabId,
  };
}

export function nextTabId(state: TabsState): string | null {
  if (state.openTabs.length === 0) {
    return state.activeTabId;
  }
  const index = state.openTabs.findIndex((tab) => tab.id === state.activeTabId);
  return state.openTabs[(index + 1) % state.openTabs.length]?.id ?? state.activeTabId;
}

export function prevTabId(state: TabsState): string | null {
  if (state.openTabs.length === 0) {
    return state.activeTabId;
  }
  const index = state.openTabs.findIndex((tab) => tab.id === state.activeTabId);
  const previous = (index - 1 + state.openTabs.length) % state.openTabs.length;
  return state.openTabs[previous]?.id ?? state.activeTabId;
}

export function tabIdAt(state: TabsState, index: number): string | null {
  if (state.openTabs.length === 0) {
    return state.activeTabId;
  }
  return state.openTabs[Math.min(Math.max(index, 0), state.openTabs.length - 1)]?.id ?? state.activeTabId;
}

export function reorderTabs(state: TabsState, sourceId: string, dropIndex: number): TabsState {
  return { ...state, openTabs: moveTab(state.openTabs, sourceId, dropIndex) };
}
