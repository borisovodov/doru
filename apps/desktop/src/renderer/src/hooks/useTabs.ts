import { useCallback, useState } from 'react';
import type {
  FamilyRecord,
  PersonRecord,
  PlaceRecord,
  RepositoryRecord,
  SourceRecord,
  SubmitterRecord,
  TitleRecord,
  TodoRecord,
} from '@doru/core';
import { placeName } from '@doru/core/model';
import { displayName, familyLabel } from '@doru/features';
import { moveTab, nls, type TabInfo } from '@doru/workbench';

const TREE_TAB_ID = 'tree';
const SETTINGS_TAB_ID = 'settings';
const NOTICES_TAB_ID = 'notices';
const EXPORT_TAB_ID = 'export';
const PERSON_TAB_PREFIX = 'person:';
const FAMILY_TAB_PREFIX = 'family:';
const SOURCE_TAB_PREFIX = 'source:';
const PLACE_TAB_PREFIX = 'place:';
const REPOSITORY_TAB_PREFIX = 'repository:';
const SUBMITTER_TAB_PREFIX = 'submitter:';
const TASK_TAB_PREFIX = 'task:';
const TITLE_TAB_PREFIX = 'title:';

interface OpenTab {
  id: string;
  label: string;
  closable: boolean;
}

function tabLabel(
  tab: OpenTab,
  persons: PersonRecord[],
  families: FamilyRecord[],
  sources: SourceRecord[],
  places: PlaceRecord[],
  repositories: RepositoryRecord[],
  submitters: SubmitterRecord[],
  todos: TodoRecord[],
  titles: TitleRecord[],
): string {
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
    if (sourceId.startsWith('new:')) {
      return nls.t('features.tree.source.newSource');
    }
    const source = sources.find((entry) => entry.id === sourceId);
    if (source) {
      return source.title ?? '';
    }
  }
  if (tab.id.startsWith(PLACE_TAB_PREFIX)) {
    const placeId = tab.id.slice(PLACE_TAB_PREFIX.length);
    if (placeId.startsWith('new:')) {
      return nls.t('features.tree.place.newPlace');
    }
    const place = places.find((entry) => entry.id === placeId);
    if (place) {
      return placeName(place);
    }
  }
  if (tab.id.startsWith(REPOSITORY_TAB_PREFIX)) {
    const repositoryId = tab.id.slice(REPOSITORY_TAB_PREFIX.length);
    if (repositoryId.startsWith('new:')) {
      return nls.t('features.tree.repository.newRepository');
    }
    const repository = repositories.find((entry) => entry.id === repositoryId);
    if (repository) {
      return repository.name || '—';
    }
  }
  if (tab.id.startsWith(SUBMITTER_TAB_PREFIX)) {
    const submitterId = tab.id.slice(SUBMITTER_TAB_PREFIX.length);
    if (submitterId.startsWith('new:')) {
      return nls.t('features.tree.submitter.newSubmitter');
    }
    const submitter = submitters.find((entry) => entry.id === submitterId);
    if (submitter) {
      return submitter.name || '—';
    }
  }
  if (tab.id.startsWith(TITLE_TAB_PREFIX)) {
    const titleId = tab.id.slice(TITLE_TAB_PREFIX.length);
    if (titleId.startsWith('new:')) {
      return nls.t('features.tree.title.newTitle');
    }
    const title = titles.find((entry) => entry.id === titleId);
    if (title) {
      return title.name || '—';
    }
  }
  if (tab.id.startsWith(TASK_TAB_PREFIX)) {
    const taskId = tab.id.slice(TASK_TAB_PREFIX.length);
    if (taskId.startsWith('new:')) {
      return nls.t('features.tasks.newTask');
    }
    const todo = todos.find((entry) => entry.id === taskId);
    if (todo) {
      return todo.text || '—';
    }
  }
  return tab.label;
}

export function useTabs(
  persons: PersonRecord[],
  families: FamilyRecord[],
  sources: SourceRecord[],
  places: PlaceRecord[],
  repositories: RepositoryRecord[],
  submitters: SubmitterRecord[],
  todos: TodoRecord[],
  titles: TitleRecord[],
) {
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

  /** Re-keys a tab (a new: id becomes the created entity's id). */
  const replaceTab = useCallback((oldId: string, newId: string) => {
    setOpenTabs((current) =>
      current.some((entry) => entry.id === newId)
        ? current.filter((entry) => entry.id !== oldId)
        : current.map((entry) => (entry.id === oldId ? { ...entry, id: newId } : entry)),
    );
    setActiveTabId((active) => (active === oldId ? newId : active));
  }, []);

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

  const openPlaceTab = useCallback(
    (placeId: string) => {
      openTab({ id: `${PLACE_TAB_PREFIX}${placeId}`, label: placeId });
    },
    [openTab],
  );

  const openRepositoryTab = useCallback(
    (repositoryId: string) => {
      openTab({ id: `${REPOSITORY_TAB_PREFIX}${repositoryId}`, label: repositoryId });
    },
    [openTab],
  );

  const openSubmitterTab = useCallback(
    (submitterId: string) => {
      openTab({ id: `${SUBMITTER_TAB_PREFIX}${submitterId}`, label: submitterId });
    },
    [openTab],
  );

  const openTaskTab = useCallback(
    (todoId: string) => {
      const todo = todos.find((entry) => entry.id === todoId);
      openTab({ id: `${TASK_TAB_PREFIX}${todoId}`, label: todo?.text ?? todoId });
    },
    [todos, openTab],
  );

  const openNewTaskTab = useCallback(() => {
    openTab({ id: `${TASK_TAB_PREFIX}new:${crypto.randomUUID()}`, label: nls.t('features.tasks.newTask') });
  }, [openTab]);

  const openTitleTab = useCallback(
    (titleId: string) => {
      const title = titles.find((entry) => entry.id === titleId);
      openTab({ id: `${TITLE_TAB_PREFIX}${titleId}`, label: title?.name ?? titleId });
    },
    [titles, openTab],
  );

  const openNewTitleTab = useCallback(() => {
    openTab({ id: `${TITLE_TAB_PREFIX}new:${crypto.randomUUID()}`, label: nls.t('features.tree.title.newTitle') });
  }, [openTab]);

  const openNewPersonTab = useCallback(() => {
    openTab({ id: `${PERSON_TAB_PREFIX}new:${crypto.randomUUID()}`, label: nls.t('features.tree.addPerson') });
  }, [openTab]);

  const openNewPlaceTab = useCallback(() => {
    openTab({ id: `${PLACE_TAB_PREFIX}new:${crypto.randomUUID()}`, label: nls.t('features.tree.place.newPlace') });
  }, [openTab]);

  const openNewSourceTab = useCallback(() => {
    openTab({ id: `${SOURCE_TAB_PREFIX}new:${crypto.randomUUID()}`, label: nls.t('features.tree.source.newSource') });
  }, [openTab]);

  const openNewRepositoryTab = useCallback(() => {
    openTab({ id: `${REPOSITORY_TAB_PREFIX}new:${crypto.randomUUID()}`, label: nls.t('features.tree.repository.newRepository') });
  }, [openTab]);

  const openNewSubmitterTab = useCallback(() => {
    openTab({ id: `${SUBMITTER_TAB_PREFIX}new:${crypto.randomUUID()}`, label: nls.t('features.tree.submitter.newSubmitter') });
  }, [openTab]);

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
    label: tabLabel(tab, persons, families, sources, places, repositories, submitters, todos, titles),
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
    replaceTab,
    nextTab,
    prevTab,
    openTabAt,
    openPersonTab,
    openFamilyTab,
    openSourceTab,
    openPlaceTab,
    openRepositoryTab,
    openSubmitterTab,
    openTaskTab,
    openNewTaskTab,
    openTitleTab,
    openNewTitleTab,
    openNewPersonTab,
    openNewPlaceTab,
    openNewSourceTab,
    openNewRepositoryTab,
    openNewSubmitterTab,
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
  PLACE_TAB_PREFIX,
  REPOSITORY_TAB_PREFIX,
  SUBMITTER_TAB_PREFIX,
  TASK_TAB_PREFIX,
  TITLE_TAB_PREFIX,
};
