import type {
  AddressRecord,
  AssociationRecord,
  ChangeRecord,
  CitationRecord,
  ContactRecord,
  FactRecord,
  FamilyRecord,
  HeaderRecord,
  IdentifierRecord,
  MediaRecord,
  NoteLinkRecord,
  NoteRecord,
  PersonRecord,
  PlaceRecord,
  ProjectBinding,
  ProjectSummary,
  RecentProject,
  RestrictionRecord,
  RepositoryRecord,
  SourceRecord,
  SubmitterRecord,
  TagLinkRecord,
  TagRecord,
  TreeStats,
  UndoRedoState,
} from '@doru/core';
import type {
  AgentStep,
  ChatSendResult,
  ChatSessionMeta,
  ChatTranscriptMessage,
  DoruModelState,
} from '@doru/ai';
import type {
  AiProviderInfo,
  AiSettingsState,
  MediaWithPath,
} from '@doru/features';

declare global {
  interface Window {
    doru: {
      readonly platform: string;
      getCurrentProject(): Promise<ProjectBinding | null>;
      onProjectBound(callback: (info: ProjectBinding) => void): () => void;
      openProjectDialog(): Promise<ProjectSummary | ProjectBinding | null>;
      openProjectPath(path: string): Promise<ProjectSummary | ProjectBinding | null>;
      createProjectDialog(): Promise<ProjectSummary | null>;
      saveProject(projectPath: string): Promise<ProjectBinding | null>;
      recentProjects(): Promise<RecentProject[]>;
      removeRecentProject(path: string): Promise<RecentProject[]>;
      listPersons(projectPath: string, search?: string): Promise<PersonRecord[]>;
      /** Every person and family in the tree (no pagination). */
      all(projectPath: string): Promise<{ persons: PersonRecord[]; families: FamilyRecord[] }>;
      treeStats(projectPath: string): Promise<TreeStats>;
      undo(projectPath: string): Promise<UndoRedoState>;
      redo(projectPath: string): Promise<UndoRedoState>;
      addPerson(projectPath: string, person: PersonRecord): Promise<UndoRedoState>;
      updatePerson(
        projectPath: string,
        before: PersonRecord,
        after: PersonRecord,
      ): Promise<UndoRedoState>;
      deletePerson(projectPath: string, person: PersonRecord): Promise<UndoRedoState>;
      reparent(
        projectPath: string,
        childId: string,
        newParentId: string,
      ): Promise<UndoRedoState>;
      addRelative(
        projectPath: string,
        relation: 'child' | 'spouse' | 'parent',
        anchorId: string,
        person: PersonRecord,
      ): Promise<UndoRedoState>;
      exportGedcom(projectPath: string): Promise<{ path: string } | null>;
      sendChat(projectPath: string, sessionId: string, text: string): Promise<ChatSendResult>;
      cancelChat(projectPath: string, sessionId: string): void;
      onChatEvent(
        callback: (
          event: { sessionId: string } & ({ type: 'textDelta'; text: string } | { type: 'step'; step: AgentStep }),
        ) => void,
      ): () => void;
      listChatSessions(projectKey: string): Promise<ChatSessionMeta[]>;
      createChatSession(projectKey: string): Promise<ChatSessionMeta>;
      deleteChatSession(projectKey: string, id: string): Promise<void>;
      getChatTranscript(projectKey: string, id: string): Promise<ChatTranscriptMessage[]>;
      /** Fires when the project file changed on disk outside the app (agents, MCP clients). */
      onTreeExternalChange(callback: () => void): () => void;
      getThemeState(): Promise<{
        systemDark: boolean;
        theme: string;
        themes: Array<{ id: string; name: string }>;
      }>;
      setTheme(name: string): Promise<string>;
      openThemesFolder(): Promise<void>;
      getAbout(): Promise<{ version: string }>;
      copyText(text: string): Promise<void>;
      openLogs(): Promise<string>;
      getThemeCss(name: string, mode: 'dark' | 'light'): Promise<string>;
      onThemeSystemChanged(callback: (info: { systemDark: boolean }) => void): () => void;
      onThemeSettingsChanged(
        callback: (state: {
          systemDark: boolean;
          theme: string;
          themes: Array<{ id: string; name: string }>;
        }) => void,
      ): () => void;
      /**
       * Executes a main-process window action from a menu entry (reload,
       * zoom, quit…). The in-window menu on Windows/Linux is the counterpart
       * of the native roles the macOS menu renders.
       */
      menuAction(action: string): Promise<void>;
      /** A native menu item was chosen; `commandId` runs through the CommandService. */
      onMenuCommand(callback: (commandId: string) => void): () => void;
      onAiSettingsChanged(callback: (state: AiSettingsState) => void): () => void;
      /** Opens a link from a chat reply in the system browser (http/https only). */
      openExternal(url: string): Promise<boolean>;
      listNotes(projectPath: string, personId?: string): Promise<NoteRecord[]>;
      personCounts(
        projectPath: string,
        personIds: string[],
      ): Promise<Record<string, { notes: number; sources: number; media: number }>>;
      addNote(projectPath: string, note: NoteRecord): Promise<UndoRedoState>;
      updateNote(
        projectPath: string,
        before: NoteRecord,
        after: NoteRecord,
        context?: NoteLinkRecord,
      ): Promise<UndoRedoState>;
      deleteNote(projectPath: string, note: NoteRecord): Promise<UndoRedoState>;
      getFamilies(projectPath: string): Promise<FamilyRecord[]>;
      addFamily(projectPath: string, family: FamilyRecord): Promise<UndoRedoState>;
      updateFamily(
        projectPath: string,
        before: FamilyRecord,
        after: FamilyRecord,
      ): Promise<UndoRedoState>;
      deleteFamily(projectPath: string, family: FamilyRecord): Promise<UndoRedoState>;
      getAssociations(projectPath: string, personId: string): Promise<AssociationRecord[]>;
      addAssociation(projectPath: string, association: AssociationRecord): Promise<UndoRedoState>;
      updateAssociation(
        projectPath: string,
        before: AssociationRecord,
        after: AssociationRecord,
      ): Promise<UndoRedoState>;
      deleteAssociation(projectPath: string, association: AssociationRecord): Promise<UndoRedoState>;
      getIdentifiers(projectPath: string, personId: string): Promise<IdentifierRecord[]>;
      addIdentifier(projectPath: string, identifier: IdentifierRecord): Promise<UndoRedoState>;
      deleteIdentifier(projectPath: string, identifier: IdentifierRecord): Promise<UndoRedoState>;
      getContacts(projectPath: string, personId: string): Promise<ContactRecord[]>;
      addContact(projectPath: string, contact: ContactRecord): Promise<UndoRedoState>;
      deleteContact(projectPath: string, contact: ContactRecord): Promise<UndoRedoState>;
      getRestrictions(projectPath: string, personId: string): Promise<RestrictionRecord[]>;
      addRestriction(projectPath: string, restriction: RestrictionRecord): Promise<UndoRedoState>;
      deleteRestriction(projectPath: string, restriction: RestrictionRecord): Promise<UndoRedoState>;
      getTags(projectPath: string): Promise<TagRecord[]>;
      getTagLinks(
        projectPath: string,
        personId: string,
      ): Promise<Array<{ tagId: string; link: TagLinkRecord }>>;
      addTag(projectPath: string, tag: TagRecord): Promise<UndoRedoState>;
      attachTag(projectPath: string, link: TagLinkRecord): Promise<UndoRedoState>;
      detachTag(projectPath: string, link: TagLinkRecord): Promise<UndoRedoState>;
      getChanges(projectPath: string, personId: string): Promise<ChangeRecord[]>;
      getSources(projectPath: string): Promise<SourceRecord[]>;
      addSource(
        projectPath: string,
        source: SourceRecord,
        targetType?: string,
        targetId?: string,
      ): Promise<UndoRedoState>;
      updateSource(
        projectPath: string,
        before: SourceRecord,
        after: SourceRecord,
      ): Promise<UndoRedoState>;
      deleteSource(projectPath: string, source: SourceRecord): Promise<UndoRedoState>;
      updateCitation(
        projectPath: string,
        before: CitationRecord,
        after: CitationRecord,
      ): Promise<UndoRedoState>;
      getRepositories(projectPath: string): Promise<RepositoryRecord[]>;
      addRepository(projectPath: string, repository: RepositoryRecord): Promise<UndoRedoState>;
      updateRepository(
        projectPath: string,
        before: RepositoryRecord,
        after: RepositoryRecord,
      ): Promise<UndoRedoState>;
      deleteRepository(projectPath: string, repository: RepositoryRecord): Promise<UndoRedoState>;
      getSubmitters(projectPath: string): Promise<SubmitterRecord[]>;
      addSubmitter(projectPath: string, submitter: SubmitterRecord): Promise<UndoRedoState>;
      updateSubmitter(
        projectPath: string,
        before: SubmitterRecord,
        after: SubmitterRecord,
      ): Promise<UndoRedoState>;
      deleteSubmitter(projectPath: string, submitter: SubmitterRecord): Promise<UndoRedoState>;
      getHeader(projectPath: string): Promise<HeaderRecord>;
      saveHeader(projectPath: string, header: HeaderRecord): Promise<UndoRedoState>;
      addAddress(projectPath: string, address: AddressRecord): Promise<UndoRedoState>;
      updateAddress(
        projectPath: string,
        before: AddressRecord,
        after: AddressRecord,
      ): Promise<UndoRedoState>;
      deleteAddress(projectPath: string, address: AddressRecord): Promise<UndoRedoState>;
      getAddress(projectPath: string, id: string): Promise<AddressRecord | undefined>;
      getPlaces(projectPath: string): Promise<PlaceRecord[]>;
      addPlace(projectPath: string, place: PlaceRecord): Promise<UndoRedoState>;
      updatePlace(
        projectPath: string,
        before: PlaceRecord,
        after: PlaceRecord,
      ): Promise<UndoRedoState>;
      deletePlace(projectPath: string, place: PlaceRecord): Promise<UndoRedoState>;
      getFactsForPlace(projectPath: string, placeId: string): Promise<FactRecord[]>;
      attachSource(
        projectPath: string,
        sourceId: string,
        targetType: string,
        targetId: string,
      ): Promise<UndoRedoState>;
      detachCitation(projectPath: string, citationId: string): Promise<UndoRedoState>;
      getCitations(
        projectPath: string,
        personId: string,
      ): Promise<CitationRecord[]>;
      getAllCitations(projectPath: string): Promise<CitationRecord[]>;
      getFacts(
        projectPath: string,
        personId?: string,
        familyId?: string,
      ): Promise<FactRecord[]>;
      getAllFacts(projectPath: string): Promise<FactRecord[]>;
      addFact(projectPath: string, fact: FactRecord): Promise<UndoRedoState>;
      updateFact(
        projectPath: string,
        before: FactRecord,
        after: FactRecord,
      ): Promise<UndoRedoState>;
      deleteFact(projectPath: string, fact: FactRecord): Promise<UndoRedoState>;
      getMedia(projectPath: string, personId: string): Promise<MediaWithPath[]>;
      getAllMedia(projectPath: string): Promise<MediaWithPath[]>;
      addMedia(projectPath: string, personId: string): Promise<MediaWithPath[]>;
      deleteMedia(projectPath: string, media: MediaRecord): Promise<UndoRedoState>;
      getAiSettings(): Promise<AiSettingsState>;
      getAiProviders(): Promise<AiProviderInfo[]>;
      setAiSettings(options: {
        provider?: string;
        baseUrl?: string;
        model?: string;
        reasoning?: string;
        apiKey?: string;
        clearKey?: boolean;
        acpCommand?: string;
        acpArgs?: string[];
      }): Promise<AiSettingsState>;
      testAiConnection(options?: {
        provider?: string;
        baseUrl?: string;
        apiKey?: string;
        model?: string;
      }): Promise<{ ok: boolean; error?: string }>;
      fetchAiModels(options?: {
        provider?: string;
        baseUrl?: string;
        apiKey?: string;
        model?: string;
      }): Promise<{ models: string[]; error?: string }>;
      getDoruModelState(): Promise<DoruModelState>;
      downloadDoruModel(): Promise<DoruModelState>;
      cancelDoruModelDownload(): Promise<DoruModelState>;
      deleteDoruModel(): Promise<DoruModelState>;
      onDoruModelState(callback: (state: DoruModelState) => void): () => void;
    };
  }
}
