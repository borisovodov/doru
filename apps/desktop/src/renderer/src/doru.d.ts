import type {
  GedcomImportResult,
  PersonRecord,
  ProjectSummary,
  RecentProject,
  TreeStats,
  UndoRedoState,
} from '@doru/core';

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
      onExternalOpen(callback: (summary: ProjectSummary) => void): () => void;
    };
  }
}

export {};
