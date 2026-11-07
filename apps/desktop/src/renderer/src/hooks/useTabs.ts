import { useCallback, useState } from 'react';
import type { FamilyRecord, PersonRecord, SourceRecord } from '@doru/core';
import { displayName, familyLabel } from '@doru/features';
import { moveTab, nls, type TabInfo } from '@doru/workbench';

const TREE_TAB_ID = 'tree';
const SETTINGS_TAB_ID = 'settings';
const NOTICES_TAB_ID = 'notices';
const EXPORT_TAB_ID = 'export';
const PERSON_TAB_PREFIX = 'person:';
const FAMILY_TAB_PREFIX = 'family:';
const SOURCE_TAB_PREFIX = 'source:';

interface OpenTab {
  id: string;
  label: string;
  closable: boolean;
}

function tabLabel(tab: OpenTab, persons: PersonRecord[], families: FamilyRecord[], sources: SourceRecord[]): string {
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
  if (tab.id.startsWith(FAMILY_TAB_PREFIX)) {
    const familyId = tab.id.slice(FAMILY_TAB_PREFIX.length);
    const family = families.find((entry) => entry.id === familyId);
    if (family) {
      const personById = new Map(persons.map((person) => [person.id, person]));
      return familyLabel(family, personById);
    }
  }
  if (tab.id.startsWith(SOURCE_TAB_PREFIX)) {
    const sourceId = tab.id.slice(SOURCE_TAB_PREFIX.length);
    const source = sources.find((entry) => entry.id === sourceId);
    if (source) {
      return source.title;
    }
  }
  return tab.label;
}

export function useTabs(persons: PersonRecord[], families: FamilyRecord[], sources: SourceRecord[]) {
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

  /** Cycles to the tab after the active one, wrapping at the end. */
  const nextTab = useCallback(() => {
    setActiveTabId((active) => {
      if (openTabs.length === 0) {
        return active;
      }
      const index = openTabs.findIndex((entry) => entry.id === active);
      return openTabs[(index + 1) % openTabs.length]?.id ?? active;
    });
  }, [openTabs]);

  /** Cycles to the tab before the active one, wrapping at the start. */
  const prevTab = useCallback(() => {
    setActiveTabId((active) => {
      if (openTabs.length === 0) {
        return active;
      }
      const index = openTabs.findIndex((entry) => entry.id === active);
      const previous = (index - 1 + openTabs.length) % openTabs.length;
      return openTabs[previous]?.id ?? active;
    });
  }, [openTabs]);

  /**
   * Selects the tab at the given 0-based position, clamped to the last tab
   * so ⌘9 still lands on a tab when fewer than nine are open.
   */
  const openTabAt = useCallback(
    (index: number) => {
      const target = openTabs[Math.min(Math.max(index, 0), openTabs.length - 1)];
      if (target) {
        setActiveTabId(target.id);
      }
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

  const openFamilyTab = useCallback(
    (familyId: string) => {
      openTab({ id: `${FAMILY_TAB_PREFIX}${familyId}`, label: familyId });
    },
    [openTab],
  );

  const openSourceTab = useCallback(
    (sourceId: string) => {
      openTab({ id: `${SOURCE_TAB_PREFIX}${sourceId}`, label: sourceId });
    },
    [openTab],
  );

  const openSettingsTab = useCallback(() => {
    openTab({ id: SETTINGS_TAB_ID, label: nls.t('workbench.settings') });
  }, [openTab]);

  const openNoticesTab = useCallback(() => {
    openTab({ id: NOTICES_TAB_ID, label: nls.t('notices.title') });
  }, [openTab]);

  const openExportTab = useCallback(() => {
    openTab({ id: EXPORT_TAB_ID, label: nls.t('workbench.exportGedcom') });
  }, [openTab]);

  const reorderTabs = useCallback((sourceId: string, dropIndex: number) => {
    setOpenTabs((current) => moveTab(current, sourceId, dropIndex));
  }, []);

  const tabInfos: TabInfo[] = openTabs.map((tab) => ({
    id: tab.id,
    label: tabLabel(tab, persons, families, sources),
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
    nextTab,
    prevTab,
    openTabAt,
    openPersonTab,
    openFamilyTab,
    openSourceTab,
    openSettingsTab,
    openNoticesTab,
    openExportTab,
    reorderTabs,
  };
}

export {
  SETTINGS_TAB_ID,
  TREE_TAB_ID,
  NOTICES_TAB_ID,
  EXPORT_TAB_ID,
  PERSON_TAB_PREFIX,
  FAMILY_TAB_PREFIX,
  SOURCE_TAB_PREFIX,
};
