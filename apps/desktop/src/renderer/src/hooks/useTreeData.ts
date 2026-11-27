import { useAttachmentMethods } from './tree/useAttachmentMethods';
import { useFamilyEditorApi } from './tree/useFamilyEditorApi';
import { useMediaApis } from './tree/useMediaApis';
import { usePeopleActions } from './tree/usePeopleActions';
import { usePersonEditorApi } from './tree/usePersonEditorApi';
import { usePlaceEditorApi } from './tree/usePlaceEditorApi';
import { useRegistriesEditorApi } from './tree/useRegistriesEditorApi';
import { useSourceEditorApi } from './tree/useSourceEditorApi';
import { useTitleEditorApi } from './tree/useTitleEditorApi';
import { useTaskEditorApi } from './tree/useTaskEditorApi';
import { useTreeHistory } from './tree/useTreeHistory';
import { useTreeSnapshot } from './tree/useTreeSnapshot';

export function useTreeData(projectPath: string | null | undefined) {
  const snapshot = useTreeSnapshot(projectPath);
  const { refreshTree } = snapshot;
  const { undo, redo } = useTreeHistory(projectPath, refreshTree);
  const { addRelative, personCounts, deletePerson } = usePeopleActions(projectPath, refreshTree);
  const { addStandaloneMedia, addStandaloneMediaUrl, mediaApi, mediaAdminApi } = useMediaApis(projectPath, refreshTree);
  const api = usePersonEditorApi(projectPath, refreshTree, mediaApi);
  const attachmentMethods = useAttachmentMethods(projectPath, refreshTree, mediaApi);
  const sourceApi = useSourceEditorApi(projectPath, refreshTree, attachmentMethods);
  const placeApi = usePlaceEditorApi(projectPath, refreshTree, attachmentMethods);
  const familyApi = useFamilyEditorApi(projectPath, refreshTree, attachmentMethods);
  const registriesApi = useRegistriesEditorApi(projectPath, refreshTree, attachmentMethods);
  const titlesApi = useTitleEditorApi(projectPath, refreshTree, attachmentMethods);
  const tasksApi = useTaskEditorApi(projectPath, refreshTree, attachmentMethods);

  return {
    ...snapshot,
    undo,
    redo,
    addRelative,
    deletePerson,
    personCounts,
    addStandaloneMedia,
    addStandaloneMediaUrl,
    mediaApi,
    mediaAdminApi,
    api,
    sourceApi,
    placeApi,
    familyApi,
    registriesApi,
    tasksApi,
    titlesApi,
  };
}
