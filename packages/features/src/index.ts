export { TreeCanvas, type TreeCanvasProps } from './tree/TreeCanvas';
export { PersonCard, type PersonCardData } from './tree/PersonCard';
export { PersonEditor, type PersonEditorProps } from './person/PersonEditor';
export {
  draftToRecord,
  newPersonDraft,
  personDraftMatches,
  personToDraft,
  type PersonDraft,
} from '@doru/ui';
export type { FamilyEditorApi, MediaWithPath, PersonEditorApi, PlaceEditorApi, RegistriesEditorApi, SourceEditorApi } from './person/types';
export { PersonList, type PersonListProps } from './person/PersonList';
export { displayName, familyLabel, lifeSpan } from '@doru/ui';
export { NotesSection } from './person/NotesSection';
export { SourcesSection } from './person/SourcesSection';
export { TagsSection } from './person/TagsSection';
export { ContributorsSection } from '@doru/ui';
export { ContactsSection, IdentifiersSection, RestrictionsSection } from './person/AttachmentsSection';
export { SidebarFamilies } from './sidebar/SidebarFamilies';
export { SidebarFacts } from './sidebar/SidebarFacts';
export { SidebarPlaces } from './sidebar/SidebarPlaces';
export { SidebarMedia, type SidebarMediaItem } from './sidebar/SidebarMedia';
export { SidebarSources } from './sidebar/SidebarSources';
export { SidebarSearch } from './sidebar/SidebarSearch';
export { RepositoryList, SubmitterList, TitleList } from './sidebar/RegistryLists';
export { FamilyInfoList } from './sidebar/FamilyView';
export { SourceCitationsList, EntityTab } from './sidebar/SourceView';
export { SourceEditor } from './source/SourceEditor';
export { sourceDraftToRecord, sourceToDraft, emptySourceDraft, sourceDraftMatches, type SourceDraft } from '@doru/ui';
export { FamilyEditor } from './family/FamilyEditor';
export { familyDraftToRecord, familyToDraft, emptyFamilyDraft, familyDraftMatches, type FamilyDraft } from '@doru/ui';
export { AddressFields } from '@doru/ui';
export {
  addressDraftEmpty,
  addressDraftToRecord,
  addressLabel,
  addressToDraft,
  emptyAddressDraft,
  type AddressDraft,
} from '@doru/ui';
export { PlaceEditor } from './place/PlaceEditor';
export { PlaceFactsList } from './place/PlaceFactsList';
export { placeDraftToRecord, placeToDraft, emptyPlaceDraft, placeDraftMatches, type PlaceDraft } from './place/placeDraft';
export { SettingsView, type SettingsViewProps, type ThemeEntry, type AiTestState } from './settings/SettingsView';
export type { AiCatalogModelInfo, AiProviderInfo, AiSettingsState, ModelFetchState } from './settings/types';
export { NoticesView, type NoticesViewProps } from './notices/NoticesView';
export type { ThirdPartyNotice } from './notices/types';
export { WelcomePage, type WelcomePageProps } from './welcome/WelcomePage';
export { EmptyEditorPage, type EmptyEditorPageProps } from './welcome/EmptyEditorPage';
export { PlaceholderView, type PlaceholderViewProps } from './placeholder/PlaceholderView';
export { TasksView } from './tasks/TasksView';
export { TaskEditorFields } from '@doru/ui';
export { todoDraftToRecord, todoToDraft, emptyTodoDraft, type TodoDraft } from '@doru/ui';
export { ChatPanel, type ChatPanelProps } from './chat/ChatPanel';
export { ChatSetupPlaceholder, type ChatSetupPlaceholderProps } from './chat/ChatSetupPlaceholder';
export type { ChatSessionMeta, ChatTranscriptMessage } from '@doru/ai';
