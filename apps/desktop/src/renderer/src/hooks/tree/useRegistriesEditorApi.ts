import { useMemo } from 'react';
import type { RegistriesEditorApi } from '@doru/features';
import type { RefreshTree } from './types';
import type { useAttachmentMethods } from './useAttachmentMethods';

export function useRegistriesEditorApi(
  projectPath: string | null | undefined,
  refreshTree: RefreshTree,
  attachmentMethods: ReturnType<typeof useAttachmentMethods>,
): RegistriesEditorApi {
  const registriesApi = useMemo<RegistriesEditorApi>(
    () => ({
      ...attachmentMethods,
      getRepositories: () => (projectPath ? window.doru.getRepositories(projectPath) : Promise.resolve([])),
      addRepository: async (repository) => {
        if (!projectPath) return;
        await window.doru.addRepository(projectPath, repository);
        await refreshTree();
      },
      updateRepository: async (before, after) => {
        if (!projectPath) return;
        await window.doru.updateRepository(projectPath, before, after);
        await refreshTree();
      },
      deleteRepository: async (repository) => {
        if (!projectPath) return;
        await window.doru.deleteRepository(projectPath, repository);
        await refreshTree();
      },
      getSubmitters: () => (projectPath ? window.doru.getSubmitters(projectPath) : Promise.resolve([])),
      addSubmitter: async (submitter) => {
        if (!projectPath) return;
        await window.doru.addSubmitter(projectPath, submitter);
        await refreshTree();
      },
      updateSubmitter: async (before, after) => {
        if (!projectPath) return;
        await window.doru.updateSubmitter(projectPath, before, after);
        await refreshTree();
      },
      deleteSubmitter: async (submitter) => {
        if (!projectPath) return;
        await window.doru.deleteSubmitter(projectPath, submitter);
        await refreshTree();
      },
      addAddress: async (address) => {
        if (!projectPath) return;
        await window.doru.addAddress(projectPath, address);
        await refreshTree();
      },
      updateAddress: async (before, after) => {
        if (!projectPath) return;
        await window.doru.updateAddress(projectPath, before, after);
        await refreshTree();
      },
      deleteAddress: async (address) => {
        if (!projectPath) return;
        await window.doru.deleteAddress(projectPath, address);
        await refreshTree();
      },
      getAddress: (id) => (projectPath ? window.doru.getAddress(projectPath, id) : Promise.resolve(undefined)),
    }),
    [projectPath, refreshTree, attachmentMethods],
  );
  return registriesApi;
}
