import type {
  EventRecord,
  FamilyRecord,
  GedcomImportResult,
  MediaRecord,
  NoteRecord,
  PersonRecord,
  ProjectSummary,
  RecentProject,
  SourceRecord,
  TreeStats,
  UndoRedoState,
} from '@doru/core';
import type { ChatMessage, ChatSendResult } from '@doru/ai';

export type NameFormat = 'given-first' | 'surname-first';

export interface MediaWithPath extends MediaRecord {
  absolutePath: string;
}

export interface ChatPermissionRequest {
  id: string;
  tool: string;
  arguments: Record<string, unknown>;
}

declare global {
  interface Window {
    doru: {
      openProjectDialog(): Promise<ProjectSummary | null>;
      openProjectPath(path: string): Promise<ProjectSummary | null>;
      importGedcom(projectPath: string): Promise<GedcomImportResult | null>;
      importGedcomFile(
        projectPath: string,
        filePath: string,
      ): Promise<GedcomImportResult | null>;
      recentProjects(): Promise<RecentProject[]>;
      closeProject(projectPath: string): Promise<void>;
      listPersons(projectPath: string, search?: string): Promise<PersonRecord[]>;
      treeStats(projectPath: string): Promise<TreeStats>;
      getUndoState(projectPath: string): Promise<UndoRedoState>;
      undo(projectPath: string): Promise<UndoRedoState>;
      redo(projectPath: string): Promise<UndoRedoState>;
      addPerson(projectPath: string, person: PersonRecord): Promise<UndoRedoState>;
      updatePerson(
        projectPath: string,
        before: PersonRecord,
        after: PersonRecord,
      ): Promise<UndoRedoState>;
      exportGedcom(projectPath: string): Promise<{ path: string } | null>;
      sendChat(projectPath: string, messages: ChatMessage[]): Promise<ChatSendResult>;
      onChatPermission(callback: (request: ChatPermissionRequest) => void): () => void;
      respondChatPermission(id: string, allow: boolean): void;
      getTheme(projectPath: string): Promise<{ css: string }>;
      onThemeChanged(callback: (info: { projectPath: string }) => void): () => void;
      getThemeState(): Promise<{
        systemDark: boolean;
        config: { dark: string; light: string };
        themes: Array<{ name: string; type: 'dark' | 'light' }>;
      }>;
      getThemeCss(name: string): Promise<string>;
      onThemeSystemChanged(callback: (info: { systemDark: boolean }) => void): () => void;
      onThemeConfigChanged(callback: (config: { dark: string; light: string }) => void): () => void;
      listNotes(projectPath: string, personId?: string): Promise<NoteRecord[]>;
      addNote(projectPath: string, note: NoteRecord): Promise<UndoRedoState>;
      getGedcomText(projectPath: string): Promise<string>;
      getFamilies(projectPath: string): Promise<FamilyRecord[]>;
      addFamily(projectPath: string, family: FamilyRecord): Promise<UndoRedoState>;
      updateFamily(
        projectPath: string,
        before: FamilyRecord,
        after: FamilyRecord,
      ): Promise<UndoRedoState>;
      deleteFamily(projectPath: string, family: FamilyRecord): Promise<UndoRedoState>;
      getSources(projectPath: string): Promise<SourceRecord[]>;
      addSource(
        projectPath: string,
        source: SourceRecord,
        targetType?: string,
        targetId?: string,
      ): Promise<UndoRedoState>;
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
      ): Promise<Array<{ id: string; source: SourceRecord }>>;
      getSession(): Promise<{ paths: string[]; activePath: string | null }>;
      getEvents(
        projectPath: string,
        personId?: string,
        familyId?: string,
      ): Promise<EventRecord[]>;
      addEvent(projectPath: string, event: EventRecord): Promise<UndoRedoState>;
      deleteEvent(projectPath: string, event: EventRecord): Promise<UndoRedoState>;
      getMedia(projectPath: string, personId: string): Promise<MediaWithPath[]>;
      addMedia(projectPath: string, personId: string): Promise<MediaWithPath[]>;
      deleteMedia(projectPath: string, media: MediaRecord): Promise<UndoRedoState>;
      getProjectSettings(projectPath: string): Promise<{ nameFormat: NameFormat }>;
      onExternalOpen(callback: (summary: ProjectSummary) => void): () => void;
    };
  }
}
