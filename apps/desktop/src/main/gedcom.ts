import { dialog } from 'electron';
import { basename } from 'node:path';
import type { GedcomImportResult, ProjectBinding } from '@doru/core';
import { NodeFileSystem } from './filesystem';
import { openUntitledStore } from './runtime';
import { createUntitledProject, disposeUntitled } from './untitled';
import { bindingOf, openProjectInWindow } from './windows';

const fs = new NodeFileSystem();

// The actual GEDCOM parsing and the dataset → tree mapping live in the
// @doru/gedcom package, which is not wired to the tree database yet. Until
// that integration lands, the import handlers are stubs: opening a
// .ged/.gdz file still opens a new, not-yet-saved project (empty for now),
// and importing into an open project is a no-op.

/**
 * Imports a GEDCOM/GEDZIP file into an open project. Not implemented yet —
 * returns null, leaving the tree untouched.
 */
export async function importGedcom(_options: {
  projectPath: string;
  filePath?: string;
  dialog?: boolean;
}): Promise<GedcomImportResult | null> {
  return null;
}

/**
 * Opens a GEDCOM/GEDZIP file as a new, not-yet-saved project. The import
 * itself is stubbed until @doru/gedcom is wired to the tree database, so
 * the project opens empty; the user can save it to a `.doru` file through
 * the save flow (see `saveProject` in projects.ts).
 */
export async function openGedcomAsProject(
  filePath: string,
  senderId?: number,
): Promise<ProjectBinding | null> {
  const { key, info } = createUntitledProject(basename(filePath));
  try {
    await fs.mkdir(info.tempDir);
    openUntitledStore(key, info.tempPath);
  } catch (error) {
    await disposeUntitled(key);
    dialog.showErrorBox(
      'GEDCOM Import',
      `Could not open ${basename(filePath)}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
  openProjectInWindow(key, senderId);
  return bindingOf(key);
}

/**
 * Exports a project as GEDCOM. Not implemented yet: the serializer exists in
 * @doru/gedcom, but the loss warning and the target-version choice are
 * product decisions that come after the import path lands.
 */
export async function exportGedcom(_projectPath: string): Promise<{ path: string } | null> {
  return null;
}
