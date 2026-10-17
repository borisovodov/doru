export { TreeCanvas, type TreeCanvasProps } from './tree/TreeCanvas';
export { PersonCard, type PersonCardData } from './tree/PersonCard';
export { PersonEditor, type PersonEditorProps } from './person/PersonEditor';
export {
  draftToRecord,
  newPersonDraft,
  personDraftMatches,
  personToDraft,
  type PersonDraft,
} from './person/draft';
export type { CitationInfo, MediaWithPath, PersonEditorApi } from './person/types';
export { PersonList, type PersonListProps } from './person/PersonList';
export { displayName } from './person/format';
export {
  SettingsView,
  type AiProviderInfo,
  type AiSettingsState,
  type SettingsViewProps,
} from './settings/SettingsView';
export { WelcomePage, type WelcomePageProps } from './welcome/WelcomePage';
export { EmptyEditorPage, type EmptyEditorPageProps } from './welcome/EmptyEditorPage';
export { PlaceholderView, type PlaceholderViewProps } from './placeholder/PlaceholderView';
export {
  ChatPanel,
  type ChatPanelProps,
  type ChatPermissionRequest,
  type ChatTranscriptMessage,
} from './chat/ChatPanel';
