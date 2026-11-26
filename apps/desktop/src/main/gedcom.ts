import { dialog } from 'electron';
import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
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
import { downloadRemoteMedia, isDownloadableMediaUrl, isExternalMediaUrl, remoteMediaExtension } from './mediaDownload';
import { resolveImportFile, resolveMediaPath } from './mediaPaths';
import { log } from './log';
import { nls } from './nls';
import { ensureRuntime, openUntitledStore, runtimeFilePath } from './runtime';
import { projectWindows, untitledProjects } from './state';
import { createUntitledProject, disposeUntitled } from './untitled';
import { bindingOf, openProjectInWindow } from './windows';

const fs = new NodeFileSystem();

const REMOTE_MEDIA_CONCURRENCY = 4;
const REMOTE_MEDIA_TOTAL_LIMIT = 500 * 1024 * 1024;
const REMOTE_MEDIA_FILE_LIMIT = 100 * 1024 * 1024;
const REMOTE_MEDIA_MAX_URLS = 1000;
const REMOTE_MEDIA_TOTAL_TIME_MS = 10 * 60_000;
const REMOTE_MEDIA_FILE_TIMEOUT_MS = 30_000;

/** The log surface used while copying media; injectable for tests. */
export interface GedcomMediaLogger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
}

/** Injectable seams for unit tests; production uses the defaults. */
export interface GedcomMediaDependencies {
  download?: typeof downloadRemoteMedia | undefined;
  write?: ((path: string, contents: Uint8Array) => Promise<void>) | undefined;
  logger?: GedcomMediaLogger | undefined;
}

/** Keeps credentials, query tokens and fragments out of the import log. */
function redactMediaUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}/…`;
  } catch {
    return 'invalid media URL';
  }
}

/** Maps items with bounded concurrency, preserving the input order. */
async function mapWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  map: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      if (item === undefined) {
        return;
      }
      await map(item);
    }
  });
  await Promise.all(workers);
}

/** Copies GEDCOM media into the project folder and maps FILE paths to them. */
export async function prepareGedcomMedia(
  dataset: GedcomDataset,
  entries: GedzipMediaEntry[] | undefined,
  sourcePath: string,
  tempDir: string,
  dependencies: GedcomMediaDependencies = {},
): Promise<Map<string, string>> {
  const download = dependencies.download ?? downloadRemoteMedia;
  const write = dependencies.write ?? ((path: string, contents: Uint8Array) => fs.writeBinary(path, contents));
  const logger = dependencies.logger ?? log;
  const paths = new Map<string, string>();
  const mediaDir = join(tempDir, MEDIA_DIR_NAME);
  await fs.mkdir(mediaDir);
  const store = async (contents: Uint8Array, original: string, extension?: string): Promise<void> => {
    const name = `${randomUUID()}${extension ?? (extname(original) || '.bin')}`;
    await write(join(mediaDir, name), contents);
    paths.set(original, `${MEDIA_DIR_NAME}/${name}`);
  };
  if (entries !== undefined) {
    for (const entry of entries) {
      if (!paths.has(entry.name)) {
        await store(entry.contents, entry.name);
      }
    }
  }

  let remoteBytes = 0;
  let reservedBytes = 0;
  let remoteDownloaded = 0;
  let remoteFailed = 0;
  let remoteDeadline = 0;
  const storeRemote = async (original: string): Promise<void> => {
    if (paths.has(original)) {
      return;
    }
    const remaining = REMOTE_MEDIA_TOTAL_LIMIT - remoteBytes - reservedBytes;
    if (remaining <= 0) {
      remoteFailed += 1;
      logger.warn('gedcom import: remote media skipped, total size limit reached');
      return;
    }
    const remainingTime = remoteDeadline - Date.now();
    if (remainingTime <= 0) {
      remoteFailed += 1;
      logger.warn('gedcom import: remote media skipped, total time limit reached');
      return;
    }
    const reserved = Math.min(REMOTE_MEDIA_FILE_LIMIT, remaining);
    reservedBytes += reserved;
    let downloaded: Awaited<ReturnType<typeof download>>;
    try {
      downloaded = await download(original, {
        maxBytes: reserved,
        timeoutMs: Math.min(REMOTE_MEDIA_FILE_TIMEOUT_MS, remainingTime),
      });
    } catch (error) {
      remoteFailed += 1;
      logger.warn('gedcom import: could not download media URL', redactMediaUrl(original), error);
      return;
    } finally {
      reservedBytes -= reserved;
    }
    // Project-write failures are not per-payload and must propagate.
    remoteBytes += downloaded.bytes.byteLength;
    await store(downloaded.bytes, original, remoteMediaExtension(downloaded.contentType, original));
    remoteDownloaded += 1;
  };

  const storeReachable = async (original: string): Promise<void> => {
    if (original === '' || paths.has(original)) {
      return;
    }
    let contents: Uint8Array | undefined;
    try {
      // A GEDCOM from another person may name any readable file: only
      // payloads whose canonical path stays beside the source file may be
      // imported.
      const candidate = resolve(dirname(sourcePath), original);
      const safe = await resolveImportFile(dirname(sourcePath), candidate);
      if (safe === null) {
        logger.warn('gedcom import: skipped media outside the source folder', original);
        return;
      }
      if (!(await fs.exists(safe)) || !(await stat(safe)).isFile()) {
        return;
      }
      contents = await fs.readBinary(safe);
      if ((await resolveImportFile(dirname(sourcePath), candidate)) !== safe) {
        return;
      }
    } catch (error) {
      // Unreadable payloads stay external and hidden; they must not abort
      // the whole import.
      logger.warn('gedcom import: could not read media payload', original, error);
      return;
    }
    // Project-write failures are not per-payload and must propagate.
    await store(contents, original);
  };

  const remoteUrls = new Set<string>();
  const localPaths = new Set<string>();
  for (const record of dataset.records) {
    if (record.tag !== 'OBJE') {
      continue;
    }
    for (const file of record.files) {
      const payload = file.payload;
      if (payload === '' || paths.has(payload)) {
        continue;
      }
      if (isDownloadableMediaUrl(payload)) {
        remoteUrls.add(payload);
      } else if (isExternalMediaUrl(payload)) {
        // ftp:// and file:// stay external references.
        logger.warn('gedcom import: external media URL left as a reference', redactMediaUrl(payload));
      } else {
        localPaths.add(payload);
      }
    }
  }
  for (const original of localPaths) {
    await storeReachable(original);
  }
  remoteDeadline = Date.now() + REMOTE_MEDIA_TOTAL_TIME_MS;
  const urls = [...remoteUrls];
  const cappedUrls = urls.slice(0, REMOTE_MEDIA_MAX_URLS);
  const skippedUrls = urls.length - cappedUrls.length;
  if (skippedUrls > 0) {
    remoteFailed += skippedUrls;
    logger.warn('gedcom import: remote media skipped, URL count limit reached', { skipped: skippedUrls });
  }
  await mapWithConcurrency(cappedUrls, REMOTE_MEDIA_CONCURRENCY, storeRemote);
  if (remoteDownloaded > 0 || remoteFailed > 0) {
    logger.info('gedcom import: remote media', {
      downloaded: remoteDownloaded,
      failed: remoteFailed,
      bytes: remoteBytes,
    });
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
      nls.t('gedcom.dialog.import.error.title'),
      nls.t(
        'gedcom.dialog.import.error.message',
        basename(filePath),
        error instanceof Error ? error.message : String(error),
      ),
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
          const info = await stat(absolute);
          if (!info.isFile()) {
            return;
          }
          const contents = await fs.readBinary(absolute);
          // Re-check containment after reading: a replaced ancestor must not
          // let bytes from outside the project reach the archive.
          if ((await resolveMediaPath(dirname(runtimeFilePath(projectPath)), normalized)) !== absolute) {
            return;
          }
          mediaFiles.push({ name: normalized, contents });
          seen.add(normalized);
        }
      };
      for (const media of repo.listAllMedia()) {
        await appendFile(media.path);
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
      title: nls.t('gedcom.dialog.export.title'),
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
      nls.t('gedcom.dialog.export.error.title'),
      nls.t('gedcom.dialog.export.error.message', error instanceof Error ? error.message : String(error)),
    );
    return null;
  }
}
