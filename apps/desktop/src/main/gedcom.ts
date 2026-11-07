import { dialog } from 'electron';
import { basename, dirname, join } from 'node:path';
import {
  buildGedcomDataset,
  importGedcomDataset,
  SqliteTreeRepository,
  type GedcomImportResult,
  type ProjectBinding,
} from '@doru/core';
import { parseTolerant, serializeGedcom70Bytes } from '@doru/gedcom';
import { NodeFileSystem } from './filesystem';
import { log } from './log';
import { ensureRuntime, openUntitledStore, runtimeFilePath } from './runtime';
import { projectWindows, untitledProjects } from './state';
import { createUntitledProject, disposeUntitled } from './untitled';
import { bindingOf, openProjectInWindow } from './windows';

const fs = new NodeFileSystem();

/**
 * Opens a GEDCOM/GEDZIP file as a new, not-yet-saved project: the dataset
 * is parsed and mapped into a fresh tree, and the user can save it to a
 * `.doru` file through the save flow (see `saveProject` in projects.ts).
 *
 * Parsing is tolerant: malformed lines are skipped and reported in the
 * log; the import proceeds with what parsed. Only when the container
 * itself cannot be read does the import fail with a dialog.
 */
export async function openGedcomAsProject(
  filePath: string,
  senderId?: number,
): Promise<ProjectBinding | null> {
  const { key, info } = createUntitledProject(basename(filePath));
  let result: GedcomImportResult;
  try {
    const bytes = await fs.readBinary(filePath);
    const parsed = parseTolerant(bytes);
    if (parsed.value === undefined) {
      const error = parsed.errors[0];
      throw new Error(error ? `${error.code}: ${error.message}` : 'the file could not be parsed');
    }
    for (const error of parsed.errors) {
      log.warn('gedcom import: skipped', `${error.code}: ${error.message}`);
    }
    await fs.mkdir(info.tempDir);
    const runtime = openUntitledStore(key, info.tempPath);
    const repo = new SqliteTreeRepository(runtime.store.db);
    const dataset = parsed.value.kind === 'gedzip' ? parsed.value.archive.dataset : parsed.value.dataset;
    result = importGedcomDataset(dataset, repo);
    log.info('gedcom imported', result);
  } catch (error) {
    await disposeUntitled(key);
    dialog.showErrorBox(
      'GEDCOM Import',
      `Could not import ${basename(filePath)}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
  openProjectInWindow(key, senderId);
  return bindingOf(key);
}

/**
 * Exports a project as a GEDCOM 7.0 file. The user picks the destination in
 * a save dialog (the default name is the project's name with a `.ged`
 * extension); the export itself never modifies the project.
 */
export async function exportGedcom(projectPath: string): Promise<{ path: string } | null> {
  try {
    const { runtime } = await ensureRuntime(projectPath);
    const repo = new SqliteTreeRepository(runtime.store.db);
    const dataset = buildGedcomDataset(repo);
    const result = serializeGedcom70Bytes(dataset);
    if (!result.ok) {
      throw new Error(result.error.message);
    }
    const untitled = untitledProjects.get(projectPath);
    const stem = untitled
      ? untitled.name.replace(/\.(ged|gdz)$/i, '')
      : basename(projectPath, '.doru');
    const window = projectWindows.get(projectPath);
    const options: Electron.SaveDialogOptions = {
      title: 'Export GEDCOM',
      defaultPath: join(dirname(runtimeFilePath(projectPath)), `${stem}.ged`),
      filters: [{ name: 'GEDCOM', extensions: ['ged'] }],
    };
    const save = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options);
    if (save.canceled || !save.filePath) {
      return null;
    }
    await fs.writeBinary(save.filePath, result.value);
    log.info('gedcom exported', { path: save.filePath });
    return { path: save.filePath };
  } catch (error) {
    dialog.showErrorBox(
      'GEDCOM Export',
      `Could not export the project: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}
