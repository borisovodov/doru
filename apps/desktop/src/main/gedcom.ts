import type { GedcomImportResult } from '@doru/core';

// GEDCOM import/export is being rebuilt in the @doru/gedcom package. The
// IPC surface stays wired to the UI, so the handlers remain registered but
// are no-ops until the library replaces them.

export async function importGedcom(_options: {
  projectPath: string;
  filePath?: string;
  dialog?: boolean;
}): Promise<GedcomImportResult | null> {
  return null;
}

export async function exportGedcom(_projectPath: string): Promise<{ path: string } | null> {
  return null;
}
