import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  AddressRecord,
  FamilyRecord,
  PersonRecord,
  PlaceRecord,
  RepositoryRecord,
  SourceRecord,
  SubmitterRecord,
  TitleRecord,
  TaskRecord,
} from '@doru/core';
import { flushAllAutoSaves, flushAutoSaves, hasAutoSaves } from '@doru/ui';
import type { MediaWithPath } from '@doru/ui/domain';
import type { TabInfo } from '@doru/workbench';
import { tabDescriptors, tabLabel } from '../tabs/registry';
import {
  closeTab as closeTabState,
  nextTabId,
  openTab as openTabState,
  prevTabId,
  reorderTabs as reorderTabsState,
  replaceTab as replaceTabState,
  tabIdAt,
  type TabsState,
} from '../tabs/state';
import {
  TREE_TAB_ID,
  type EntityOpeners,
  type EntityTabKind,
  type NewTabOpeners,
  type StaticOpeners,
  type TabLabelContext,
  type TabsApi,
} from '../tabs/types';

const EMPTY_STATE: TabsState = { openTabs: [], activeTabId: null };

export function useTabs(
  persons: PersonRecord[],
  families: FamilyRecord[],
  sources: SourceRecord[],
  places: PlaceRecord[],
  repositories: RepositoryRecord[],
  submitters: SubmitterRecord[],
  addresses: AddressRecord[],
  tasks: TaskRecord[],
  titles: TitleRecord[],
  media: MediaWithPath[],
): TabsApi {
  const [state, setState] = useState<TabsState>(EMPTY_STATE);
  // Each opened tab gets an identity token, so a close that finishes after the
  // same id was closed and reopened cannot close the newer instance.
  const tokensRef = useRef(new Map<string, string>());

  const openTab = useCallback((id: string) => {
    if (!tokensRef.current.has(id)) {
      tokensRef.current.set(id, crypto.randomUUID());
    }
    setState((current) => openTabState(current, id));
  }, []);

  const closeTab = useCallback((id: string) => {
    const token = tokensRef.current.get(id);
    if (token === undefined || !hasAutoSaves(id)) {
      tokensRef.current.delete(id);
      setState((current) => closeTabState(current, id));
      return;
    }
    // Keep a tab with a failed close-time save open; its editor shows Retry.
    void flushAutoSaves(id).then((saved) => {
      if (!saved || tokensRef.current.get(id) !== token) {
        return;
      }
      tokensRef.current.delete(id);
      setState((current) => closeTabState(current, id));
    });
  }, []);

  const replaceTab = useCallback((oldId: string, newId: string) => {
    if (oldId !== newId) {
      const token = tokensRef.current.get(oldId);
      if (token !== undefined && !tokensRef.current.has(newId)) {
        tokensRef.current.set(newId, token);
      }
      tokensRef.current.delete(oldId);
    }
    setState((current) => replaceTabState(current, oldId, newId));
  }, []);

  const resetToTree = useCallback(async () => {
    if (!(await flushAllAutoSaves())) {
      return false;
    }
    tokensRef.current = new Map([[TREE_TAB_ID, crypto.randomUUID()]]);
    setState({ openTabs: [{ id: TREE_TAB_ID, closable: true }], activeTabId: TREE_TAB_ID });
    return true;
  }, []);

  const ensureTreeTab = useCallback(() => {
    if (!tokensRef.current.has(TREE_TAB_ID)) {
      tokensRef.current.set(TREE_TAB_ID, crypto.randomUUID());
    }
    setState((current) => openTabState(current, TREE_TAB_ID));
  }, []);

  const nextTab = useCallback(() => {
    setState((current) => {
      const activeTabId = nextTabId(current);
      return activeTabId === current.activeTabId ? current : { ...current, activeTabId };
    });
  }, []);

  const prevTab = useCallback(() => {
    setState((current) => {
      const activeTabId = prevTabId(current);
      return activeTabId === current.activeTabId ? current : { ...current, activeTabId };
    });
  }, []);

  const openTabAt = useCallback((index: number) => {
    setState((current) => {
      const activeTabId = tabIdAt(current, index);
      return activeTabId === current.activeTabId ? current : { ...current, activeTabId };
    });
  }, []);

  const reorderTabs = useCallback((sourceId: string, dropIndex: number) => {
    setState((current) => reorderTabsState(current, sourceId, dropIndex));
  }, []);

  const setActiveTabId = useCallback((id: string | null) => {
    setState((current) => (current.activeTabId === id ? current : { ...current, activeTabId: id }));
  }, []);

  const open = useMemo(() => {
    const openers = {} as EntityOpeners;
    for (const descriptor of tabDescriptors) {
      const prefix = descriptor.prefix;
      if (prefix !== undefined) {
        openers[descriptor.kind as EntityTabKind] = (entityId: string) => openTab(`${prefix}${entityId}`);
      }
    }
    return openers;
  }, [openTab]);

  const openNew = useMemo(() => {
    const openers = {} as NewTabOpeners;
    for (const descriptor of tabDescriptors) {
      const prefix = descriptor.prefix;
      const createId = descriptor.newId;
      if (prefix !== undefined && createId !== undefined) {
        openers[descriptor.kind as keyof NewTabOpeners] = () => openTab(`${prefix}${createId()}`);
      }
    }
    return openers;
  }, [openTab]);

  const openStatic = useMemo(() => {
    const openers = {} as StaticOpeners;
    for (const descriptor of tabDescriptors) {
      const id = descriptor.id;
      if (id !== undefined) {
        openers[descriptor.kind as keyof StaticOpeners] = () => openTab(id);
      }
    }
    return openers;
  }, [openTab]);

  const labelContext: TabLabelContext = {
    persons,
    families,
    sources,
    places,
    repositories,
    submitters,
    addresses,
    tasks,
    titles,
    media,
  };

  const tabInfos: TabInfo[] = state.openTabs.map((tab) => ({
    id: tab.id,
    label: tabLabel(tab.id, labelContext),
    closable: tab.closable,
  }));

  return {
    openTabs: state.openTabs,
    activeTabId: state.activeTabId,
    tabInfos,
    setActiveTabId,
    resetToTree,
    ensureTreeTab,
    openTab,
    closeTab,
    replaceTab,
    nextTab,
    prevTab,
    openTabAt,
    reorderTabs,
    open,
    openNew,
    openStatic,
  };
}
