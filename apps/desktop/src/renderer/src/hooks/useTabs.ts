import { useCallback, useMemo, useState } from 'react';
import type {
  AddressRecord,
  FamilyRecord,
  PersonRecord,
  PlaceRecord,
  RepositoryRecord,
  SourceRecord,
  SubmitterRecord,
  TitleRecord,
  TodoRecord,
} from '@doru/core';
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
  todos: TodoRecord[],
  titles: TitleRecord[],
  media: MediaWithPath[],
): TabsApi {
  const [state, setState] = useState<TabsState>(EMPTY_STATE);

  const openTab = useCallback((id: string) => {
    setState((current) => openTabState(current, id));
  }, []);

  const closeTab = useCallback((id: string) => {
    setState((current) => closeTabState(current, id));
  }, []);

  const replaceTab = useCallback((oldId: string, newId: string) => {
    setState((current) => replaceTabState(current, oldId, newId));
  }, []);

  const resetToTree = useCallback(() => {
    setState({ openTabs: [{ id: TREE_TAB_ID, closable: true }], activeTabId: TREE_TAB_ID });
  }, []);

  const ensureTreeTab = useCallback(() => {
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
    todos,
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
