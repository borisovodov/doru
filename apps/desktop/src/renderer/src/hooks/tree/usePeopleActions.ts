import { useCallback } from 'react';
import type { PersonRecord } from '@doru/core';
import type { RefreshTree } from './types';

export function usePeopleActions(projectPath: string | null | undefined, refreshTree: RefreshTree) {
  /**
   * Creates a person and links them to `anchorId`: as a child, as a spouse
   * (reusing the anchor's family or creating one), or as a parent (a new
   * family with the anchor as the child). A single compound op — one undo
   * removes the person and the link.
   */
  const addRelative = useCallback(
    async (relation: 'child' | 'spouse' | 'parent', anchorId: string, person: PersonRecord) => {
      if (!projectPath) {
        return;
      }
      await window.doru.addRelative(projectPath, relation, anchorId, person);
      await refreshTree();
    },
    [projectPath, refreshTree],
  );

  const personCounts = useCallback(
    (personIds: string[]) => {
      if (!projectPath || personIds.length === 0) {
        return Promise.resolve({} as Record<string, { notes: number; sources: number; media: number }>);
      }
      return window.doru.personCounts(projectPath, personIds);
    },
    [projectPath],
  );

  /**
   * Deletes the person record together with their family links (a single
   * compound op, so one undo restores everything).
   */
  const deletePerson = useCallback(
    async (person: PersonRecord) => {
      if (!projectPath) {
        return;
      }
      await window.doru.deletePerson(projectPath, person);
      await refreshTree();
    },
    [projectPath, refreshTree],
  );
  return { addRelative, personCounts, deletePerson };
}
