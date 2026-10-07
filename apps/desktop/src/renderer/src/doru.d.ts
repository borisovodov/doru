import type { ProjectSummary } from '@doru/core';

declare global {
  interface Window {
    doru: {
      openProjectDialog(): Promise<ProjectSummary | null>;
      openProjectPath(path: string): Promise<ProjectSummary | null>;
    };
  }
}

export {};
