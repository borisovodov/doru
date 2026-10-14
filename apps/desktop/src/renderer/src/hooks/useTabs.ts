import { useCallback, useState } from 'react';
import type { PersonRecord } from '@doru/core';
import { displayName } from '@doru/features';
import { moveTab, nls, type TabInfo } from '@doru/workbench';

const TREE_TAB_ID = 'tree';
const SETTINGS_TAB_ID = 'settings';
const PERSON_TAB_PREFIX = 'person:';

interface OpenTab {
  id: string;
  label: string;
  closable: boolean;
}

function tabLabel(tab: OpenTab, persons: PersonRecord[]): string {
  if (tab.id.startsWith(PERSON_TAB_PREFIX)) {
    const personId = tab.id.slice(PERSON_TAB_PREFIX.length);
    if (personId.startsWith('new:')) {
      return nls.t('features.tree.addPerson');
    }
    const person = persons.find((entry) => entry.id === personId);
    if (person) {
      return displayName(person);
    }
  }
  return tab.label;
}

export function useTabs(persons: PersonRecord[]) {
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const resetToTree = useCallback(() => {
    setOpenTabs([{ id: TREE_TAB_ID, label: nls.t('features.tree.title'), closable: true }]);
    setActiveTabId(TREE_TAB_ID);
  }, []);

  const ensureTreeTab = useCallback(() => {
    setOpenTabs((current) =>
      current.some((entry) => entry.id === TREE_TAB_ID)
        ? current
        : [...current, { id: TREE_TAB_ID, label: nls.t('features.tree.title'), closable: true }],
    );
    setActiveTabId(TREE_TAB_ID);
  }, []);

  const openTab = useCallback((tab: { id: string; label: string }) => {
    setOpenTabs((current) =>
      current.some((entry) => entry.id === tab.id)
        ? current
        : [...current, { ...tab, closable: true }],
    );
    setActiveTabId(tab.id);
  }, []);

  const closeTab = useCallback(
    (id: string) => {
      const index = openTabs.findIndex((entry) => entry.id === id);
      if (index === -1) {
        return;
      }
      const remaining = openTabs.filter((entry) => entry.id !== id);
      setOpenTabs(remaining);
      setActiveTabId((active) => {
        if (active !== id) {
          return active;
        }
        if (remaining.length === 0) {
          return null;
        }
        return remaining[Math.min(index, remaining.length - 1)]?.id ?? null;
      });
    },
    [openTabs],
  );

  const openPersonTab = useCallback(
    (personId: string) => {
      const person = persons.find((entry) => entry.id === personId);
      openTab({
        id: `${PERSON_TAB_PREFIX}${personId}`,
        label: person ? displayName(person) : personId,
      });
    },
    [persons, openTab],
  );

  const openNewPersonTab = useCallback(() => {
    openTab({
      id: `${PERSON_TAB_PREFIX}new:${crypto.randomUUID()}`,
      label: nls.t('features.tree.addPerson'),
    });
  }, [openTab]);

  const openSettingsTab = useCallback(() => {
    openTab({ id: SETTINGS_TAB_ID, label: nls.t('workbench.settings') });
  }, [openTab]);

  const reorderTabs = useCallback((sourceId: string, dropIndex: number) => {
    setOpenTabs((current) => moveTab(current, sourceId, dropIndex));
  }, []);

  const tabInfos: TabInfo[] = openTabs.map((tab) => ({
    id: tab.id,
    label: tabLabel(tab, persons),
    closable: tab.closable,
  }));

  return {
    openTabs,
    activeTabId,
    setActiveTabId,
    tabInfos,
    resetToTree,
    ensureTreeTab,
    openTab,
    closeTab,
    openPersonTab,
    openNewPersonTab,
    openSettingsTab,
    reorderTabs,
  };
}

export { SETTINGS_TAB_ID, TREE_TAB_ID, PERSON_TAB_PREFIX };
