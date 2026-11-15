import { useMemo } from 'react';
import type { FamilyEditorApi } from '@doru/features';
import type { RefreshTree } from './types';
import type { useAttachmentMethods } from './useAttachmentMethods';

export function useFamilyEditorApi(
  projectPath: string | null | undefined,
  refreshTree: RefreshTree,
  attachmentMethods: ReturnType<typeof useAttachmentMethods>,
): FamilyEditorApi {
  const familyApi = useMemo<FamilyEditorApi>(
    () => ({
      ...attachmentMethods,
      getAssociationsForFamily: (familyId) =>
        projectPath
          ? window.doru
              .getAllAssociations(projectPath)
              .then((all) => all.filter((association) => association.familyId === familyId))
          : Promise.resolve([]),
      addAssociation: async (association) => {
        if (!projectPath) return;
        await window.doru.addAssociation(projectPath, association);
        await refreshTree();
      },
      updateAssociation: async (before, after) => {
        if (!projectPath) return;
        await window.doru.updateAssociation(projectPath, before, after);
        await refreshTree();
      },
      deleteAssociation: async (association) => {
        if (!projectPath) return;
        await window.doru.deleteAssociation(projectPath, association);
        await refreshTree();
      },
      getFacts: (personId, familyId) =>
        projectPath ? window.doru.getFacts(projectPath, personId, familyId) : Promise.resolve([]),
      addFact: async (fact) => {
        if (!projectPath) {
          return;
        }
        await window.doru.addFact(projectPath, fact);
        await refreshTree();
      },
      updateFact: async (before, after) => {
        if (!projectPath) {
          return;
        }
        await window.doru.updateFact(projectPath, before, after);
        await refreshTree();
      },
      deleteFact: async (fact) => {
        if (!projectPath) {
          return;
        }
        await window.doru.deleteFact(projectPath, fact);
        await refreshTree();
      },
      getPlaces: () => (projectPath ? window.doru.getPlaces(projectPath) : Promise.resolve([])),
      getAddresses: () => (projectPath ? window.doru.listAddresses(projectPath) : Promise.resolve([])),
      addAddress: async (address) => {
        if (projectPath) {
          await window.doru.addAddress(projectPath, address);
          await refreshTree();
        }
        return address;
      },
      updateAddress: async (before, after) => {
        if (projectPath) {
          await window.doru.updateAddress(projectPath, before, after);
          await refreshTree();
        }
        return after;
      },
      updateFamily: async (before, after) => {
        if (!projectPath) {
          return;
        }
        await window.doru.updateFamily(projectPath, before, after);
        await refreshTree();
      },
      deleteFamily: async (family) => {
        if (!projectPath) {
          return;
        }
        await window.doru.deleteFamily(projectPath, family);
        await refreshTree();
      },
      getSubmitters: () => (projectPath ? window.doru.getSubmitters(projectPath) : Promise.resolve([])),
      getRecordSubmitters: (targetType, targetId) =>
        projectPath ? window.doru.getRecordSubmitters(projectPath, targetType, targetId) : Promise.resolve([]),
      addRecordSubmitter: async (submitterId, targetType, targetId) => {
        if (!projectPath) {
          return;
        }
        await window.doru.addRecordSubmitter(projectPath, submitterId, targetType, targetId);
        await refreshTree();
      },
      deleteRecordSubmitter: async (id, submitterId, targetType, targetId) => {
        if (!projectPath) {
          return;
        }
        await window.doru.deleteRecordSubmitter(projectPath, id, submitterId, targetType, targetId);
        await refreshTree();
      },
    }),
    [projectPath, refreshTree, attachmentMethods],
  );
  return familyApi;
}
