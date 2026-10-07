import type { GedcomImportResult, ProjectSummary } from '@doru/core';

declare global {
  interface Window {
    doru: {
      openProjectDialog(): Promise<ProjectSummary | null>;
      openProjectPath(path: string): Promise<ProjectSummary | null>;
      importGedcom(projectPath: string): Promise<GedcomImportResult | null>;
    };
  }
}

export {};
