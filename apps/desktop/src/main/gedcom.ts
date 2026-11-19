import { dialog } from 'electron';
import { randomUUID } from 'node:crypto';
import { basename, dirname, extname, isAbsolute, join } from 'node:path';
import {
  buildGedcomDataset,
  importGedcomDataset,
  MEDIA_DIR_NAME,
  SqliteTreeRepository,
  type GedcomImportResult,
  type ProjectBinding,
} from '@doru/core';
import {
  parseTolerant,
  serializeGedcom70Bytes,
  serializeGedzip,
  type GedcomDataset,
  type GedzipMediaEntry,
} from '@doru/gedcom';
import { NodeFileSystem } from './filesystem';
import { resolveMediaPath } from './mediaPaths';
import { log } from './log';
import { ensureRuntime, openUntitledStore, runtimeFilePath } from './runtime';
import { projectWindows, untitledProjects } from './state';
import { createUntitledProject, disposeUntitled } from './untitled';
import { bindingOf, openProjectInWindow } from './windows';

const fs = new NodeFileSystem();

/** Copies GEDCOM media into the project folder and maps FILE paths to them. */
async function prepareGedcomMedia(
  dataset: GedcomDataset,
  entries: GedzipMediaEntry[] | undefined,
  sourcePath: string,
  tempDir: string,
): Promise<Map<string, string>> {
  const paths = new Map<string, string>();
  const mediaDir = join(tempDir, MEDIA_DIR_NAME);
  await fs.mkdir(mediaDir);
  const store = async (contents: Uint8Array, original: string): Promise<void> => {
    const name = `${randomUUID()}${extname(original) || '.bin'}`;
    await fs.writeBinary(join(mediaDir, name), contents);
    paths.set(original, `${MEDIA_DIR_NAME}/${name}`);
  };
  if (entries !== undefined) {
    for (const entry of entries) {
      if (!paths.has(entry.name)) {
        await store(entry.contents, entry.name);
      }
    }
    return paths;
  }
  for (const record of dataset.records) {
    if (record.tag !== 'OBJE') {
      continue;
    }
    const storeReachable = async (original: string): Promise<void> => {
      if (original === '' || paths.has(original)) {
        return;
      }
      const candidate = isAbsolute(original) ? original : join(dirname(sourcePath), original);
      if (await fs.exists(candidate)) {
        await store(await fs.readBinary(candidate), original);
      }
    };
    for (const file of record.files) {
      await storeReachable(file.payload);
      for (const translation of file.translations ?? []) {
        await storeReachable(translation.payload);
      }
    }
  }
  return paths;
}

/**
 * Opens a GEDCOM/GEDZIP file as a new, not-yet-saved project: the dataset
 * is parsed and mapped into a fresh tree, and the user can save it to a
 * `.doru` file through the save flow (see `saveProject` in projects.ts).
 *
 * Parsing is tolerant: malformed lines are skipped and reported in the
 * log; the import proceeds with what parsed. Only when the container
 * itself cannot be read does the import fail with a dialog.
 */
export async function openGedcomAsProject(filePath: string, senderId?: number): Promise<ProjectBinding | null> {
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
    const mediaEntries = parsed.value.kind === 'gedzip' ? parsed.value.archive.mediaFiles : undefined;
    const mediaPaths = await prepareGedcomMedia(dataset, mediaEntries, filePath, info.tempDir);
    result = importGedcomDataset(dataset, repo, mediaPaths);
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
 * Exports a project as a GEDCOM 7.0 stream or a GEDZIP archive. The format
 * is chosen in the Export tab; the save dialog opens only after the user
 * confirms there. The export itself never modifies the project.
 */
export async function exportGedcom(
  projectPath: string,
  format: 'ged' | 'gdz' = 'ged',
): Promise<{ path: string } | null> {
  try {
    const { runtime } = await ensureRuntime(projectPath);
    const repo = new SqliteTreeRepository(runtime.store.db);
    const dataset = buildGedcomDataset(repo);
    let result: ReturnType<typeof serializeGedcom70Bytes>;
    if (format === 'gdz') {
      const mediaFiles: GedzipMediaEntry[] = [];
      const seen = new Set<string>();
      const appendFile = async (path: string): Promise<void> => {
        const normalized = path.replaceAll('\\', '/');
        if (seen.has(normalized) || !normalized.startsWith(`${MEDIA_DIR_NAME}/`) || normalized.includes('../')) {
          return;
        }
        const absolute = await resolveMediaPath(dirname(runtimeFilePath(projectPath)), normalized);
        if (absolute !== null && (await fs.exists(absolute))) {
          mediaFiles.push({ name: normalized, contents: await fs.readBinary(absolute) });
          seen.add(normalized);
        }
      };
      for (const media of repo.listAllMedia()) {
        for (const file of media.files ?? []) {
          await appendFile(file.path);
          for (const translation of file.translations ?? []) {
            await appendFile(translation.path);
          }
        }
      }
      result = serializeGedzip({ dataset, mediaFiles });
    } else {
      result = serializeGedcom70Bytes(dataset);
    }
    if (!result.ok) {
      throw new Error(result.error.message);
    }
    const untitled = untitledProjects.get(projectPath);
    const stem = untitled ? untitled.name.replace(/\.(ged|gdz)$/i, '') : basename(projectPath, '.doru');
    const window = projectWindows.get(projectPath);
    const extension = format === 'gdz' ? 'gdz' : 'ged';
    const options: Electron.SaveDialogOptions = {
      title: 'Export GEDCOM',
      defaultPath: join(dirname(runtimeFilePath(projectPath)), `${stem}.${extension}`),
      filters: format === 'gdz' ? [{ name: 'GEDZIP', extensions: ['gdz'] }] : [{ name: 'GEDCOM', extensions: ['ged'] }],
    };
    const save = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options);
    if (save.canceled || !save.filePath) {
      return null;
    }
    await fs.writeBinary(save.filePath, result.value);
    log.info('gedcom exported', { path: save.filePath, format });
    return { path: save.filePath };
  } catch (error) {
    dialog.showErrorBox(
      'GEDCOM Export',
      `Could not export the project: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}
