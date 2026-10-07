import type { GedcomImportResult, ProjectSummary, RecentProject } from '@doru/core';

declare global {
  interface Window {
    doru: {
      openProjectDialog(): Promise<ProjectSummary | null>;
      openProjectPath(path: string): Promise<ProjectSummary | null>;
      importGedcom(projectPath: string): Promise<GedcomImportResult | null>;
      recentProjects(): Promise<RecentProject[]>;
      closeProject(projectPath: string): Promise<void>;
      onExternalOpen(callback: (summary: ProjectSummary) => void): () => void;
    };
  }
}

export {};
