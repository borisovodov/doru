import { BrowserWindow, dialog, type OpenDialogOptions, type SaveDialogOptions } from 'electron';
import { basename, dirname, join } from 'node:path';
import {
  Gedcom70Writer,
  ReadGedcomImporter,
  importGedcomOp,
  type GedcomImportResult,
} from '@doru/core';
import { NodeFileSystem } from './filesystem';
import { ensureRuntime } from './runtime';
import { focusedWindow } from './windows';

const fs = new NodeFileSystem();

export async function importGedcom(options: {
  projectPath: string;
  filePath?: string;
  dialog?: boolean;
}): Promise<GedcomImportResult | null> {
  let filePath = options.filePath;
  if (!filePath) {
    const dialogOptions: OpenDialogOptions = {
      properties: ['openFile'],
      filters: [{ name: 'GEDCOM', extensions: ['ged', 'gedcom'] }],
      title: 'Import GEDCOM',
    };
    const result =
      focusedWindow() !== null
        ? await dialog.showOpenDialog(focusedWindow() as BrowserWindow, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);
    if (result.canceled || result.filePaths[0] === undefined) {
      return null;
    }
    filePath = result.filePaths[0];
  }
  const { runtime } = await ensureRuntime(options.projectPath);
  const bytes = await fs.readBinary(filePath);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const doc = new ReadGedcomImporter().import(buffer);
  const op = importGedcomOp(filePath, doc);
  runtime.queue.apply(op, { repo: runtime.repo });
  return {
    importedPersons: op.insertedPersons.length,
    importedFamilies: op.insertedFamilies.length,
    totalPersons: runtime.repo.countPersons(),
  };
}

export async function exportGedcom(projectPath: string): Promise<{ path: string } | null> {
  const { runtime } = await ensureRuntime(projectPath);
  const dialogOptions: SaveDialogOptions = {
    defaultPath: join(dirname(projectPath), `${basename(projectPath).replace(/\.doru$/i, '')}.ged`),
    filters: [{ name: 'GEDCOM', extensions: ['ged'] }],
    title: 'Export GEDCOM',
  };
  const result =
    focusedWindow() !== null
      ? await dialog.showSaveDialog(focusedWindow() as BrowserWindow, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions);
  if (result.canceled || !result.filePath) {
    return null;
  }
  const content = new Gedcom70Writer().export(runtime.repo.toTreeDocument());
  await fs.writeFile(result.filePath, content);
  return { path: result.filePath };
}

export async function gedcomText(projectPath: string): Promise<string> {
  const { runtime } = await ensureRuntime(projectPath);
  return new Gedcom70Writer().export(runtime.repo.toTreeDocument());
}
