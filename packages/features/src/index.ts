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
export { SettingsView, type SettingsViewProps, type ThemeEntry, type AiTestState } from './settings/SettingsView';
export type { AiCatalogModelInfo, AiProviderInfo, AiSettingsState, ModelFetchState } from './settings/types';
export { NoticesView, type NoticesViewProps } from './notices/NoticesView';
export type { ThirdPartyNotice } from './notices/types';
export { WelcomePage, type WelcomePageProps } from './welcome/WelcomePage';
export { EmptyEditorPage, type EmptyEditorPageProps } from './welcome/EmptyEditorPage';
export { PlaceholderView, type PlaceholderViewProps } from './placeholder/PlaceholderView';
export { ChatPanel, type ChatPanelProps } from './chat/ChatPanel';
export { ChatSetupPlaceholder, type ChatSetupPlaceholderProps } from './chat/ChatSetupPlaceholder';
export type { ChatSessionMeta, ChatTranscriptMessage } from '@doru/ai';
