import type {
  GedcomImportResult,
  NoteRecord,
  PersonRecord,
  ProjectSummary,
  RecentProject,
  TreeStats,
  UndoRedoState,
} from '@doru/core';
import type { ChatMessage, ChatSendResult } from '@doru/ai';

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
      listNotes(projectPath: string, personId?: string): Promise<NoteRecord[]>;
      addNote(projectPath: string, note: NoteRecord): Promise<UndoRedoState>;
      getGedcomText(projectPath: string): Promise<string>;
      onExternalOpen(callback: (summary: ProjectSummary) => void): () => void;
    };
  }
}
