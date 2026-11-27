import { BrowserWindow, dialog, type OpenDialogOptions } from 'electron';
import { randomUUID } from 'node:crypto';
import { rename, stat, unlink } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import {
  isIngestMediaPath,
  MEDIA_DIR_NAME,
  MEDIA_INGEST_EXTENSIONS,
  mediaTitleFromPath,
  type MediaRecord,
} from '@doru/core';
import { NodeFileSystem } from './filesystem';
import { log } from './log';
import { ingestMediaFile, MediaIngestError, type IngestedMedia } from './mediaIngest';
import { readMediaFileFacts, type MediaFileFacts } from './mediaFacts';
import { addStoredMedia, type MediaTarget } from './mediaRecord';
import { redactMediaUrl } from './mediaDownload';
import { addRemoteMediaRecord, RemoteMediaError } from './mediaUrl';
import { resolveMediaPath, symlinkChainResolvesTo } from './mediaPaths';
import { nls } from './nls';
import { ensureRuntime, runtimeFilePath } from './runtime';
import { focusedWindow } from './windows';

const fs = new NodeFileSystem();

export type { MediaFileFacts };

export interface MediaWithPath extends MediaRecord {
  /** Absolute path of the single file; empty for external/unresolved media. */
  absolutePath: string;
  facts?: MediaFileFacts | undefined;
}

/**
 * Resolves a media path stored in the database to an absolute path inside
 * the project's media folder. Returns null for paths that would escape it or
 * that name an external URL.
 */
function mediaAbsolutePath(projectPath: string, mediaPath: string): Promise<string | null> {
  return resolveMediaPath(dirname(runtimeFilePath(projectPath)), mediaPath);
}

const MEDIA_FACT_CONCURRENCY = 4;

/** Maps items with bounded concurrency, preserving the input order. */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  map: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      if (item === undefined) {
        return;
      }
      results[index] = await map(item);
    }
  });
  await Promise.all(workers);
  return results;
}

async function withPath(projectPath: string, media: MediaRecord): Promise<MediaWithPath> {
  const absolutePath = await mediaAbsolutePath(projectPath, media.path);
  return {
    ...media,
    absolutePath: absolutePath ?? '',
    ...(absolutePath !== null ? { facts: await readMediaFileFacts(absolutePath) } : {}),
  };
}

async function pickMediaFiles(): Promise<string[]> {
  const dialogOptions: OpenDialogOptions = {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: nls.t('media.dialog.addPhotos.filter'), extensions: [...MEDIA_INGEST_EXTENSIONS] }],
    title: nls.t('media.dialog.addPhotos.title'),
  };
  const result =
    focusedWindow() !== null
      ? await dialog.showOpenDialog(focusedWindow() as BrowserWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);
  return result.canceled ? [] : result.filePaths;
}

export async function listMediaForTarget(
  projectPath: string,
  targetType: string,
  targetId: string,
): Promise<MediaWithPath[]> {
  const { runtime } = await ensureRuntime(projectPath);
  return mapWithConcurrency(runtime.service.listMediaFor(targetType, targetId), MEDIA_FACT_CONCURRENCY, (media) =>
    withPath(projectPath, media),
  );
}

/** Every media record in the project, with resolvable absolute paths. */
export async function listAllMedia(projectPath: string): Promise<MediaWithPath[]> {
  const { runtime } = await ensureRuntime(projectPath);
  return mapWithConcurrency(runtime.service.listAllMedia(), MEDIA_FACT_CONCURRENCY, (media) =>
    withPath(projectPath, media),
  );
}

/** Validates, converts and stores picked files, skipping rejected ones. */
async function addPickedMedia(
  projectPath: string,
  sources: readonly string[],
  target?: MediaTarget,
): Promise<MediaWithPath[]> {
  if (sources.length === 0) {
    return [];
  }
  const { runtime } = await ensureRuntime(projectPath);
  const mediaDir = join(dirname(runtimeFilePath(projectPath)), MEDIA_DIR_NAME);
  await fs.mkdir(mediaDir);
  const added: MediaWithPath[] = [];
  for (const source of sources) {
    if (!isIngestMediaPath(source)) {
      log.warn('skipped media file', basename(source), 'unsupported-format');
      continue;
    }
    let ingested: IngestedMedia;
    try {
      ingested = await ingestMediaFile(source);
    } catch (error) {
      if (error instanceof MediaIngestError) {
        log.warn('skipped media file', basename(source), error.reason);
        continue;
      }
      throw error;
    }
    const media = await addStoredMedia(mediaDir, ingested, mediaTitleFromPath(source), target, runtime.service);
    added.push(await withPath(projectPath, media));
  }
  return added;
}

/** Downloads a direct image URL, converts it and stores a normal media record. */
async function addRemoteMedia(projectPath: string, value: string, target?: MediaTarget): Promise<MediaWithPath> {
  const { runtime } = await ensureRuntime(projectPath);
  const mediaDir = join(dirname(runtimeFilePath(projectPath)), MEDIA_DIR_NAME);
  await fs.mkdir(mediaDir);
  try {
    const media = await addRemoteMediaRecord(mediaDir, value, target, runtime.service);
    return await withPath(projectPath, media);
  } catch (error) {
    if (error instanceof RemoteMediaError) {
      log.warn('skipped media URL', redactMediaUrl(value), error.code);
      throw new Error('media URL could not be added', { cause: error });
    }
    throw error;
  }
}

export async function addMediaToTarget(
  projectPath: string,
  targetType: string,
  targetId: string,
): Promise<MediaWithPath[]> {
  const sources = await pickMediaFiles();
  return addPickedMedia(projectPath, sources, { targetType, targetId });
}

export async function addMediaUrlToTarget(
  projectPath: string,
  targetType: string,
  targetId: string,
  url: string,
): Promise<MediaWithPath> {
  return addRemoteMedia(projectPath, url, { targetType, targetId });
}

/** Picks files and creates media records without attaching them to a target. */
export async function addStandaloneMedia(projectPath: string): Promise<MediaWithPath[]> {
  const sources = await pickMediaFiles();
  return addPickedMedia(projectPath, sources);
}

export async function addStandaloneMediaUrl(projectPath: string, url: string): Promise<MediaWithPath> {
  return addRemoteMedia(projectPath, url);
}

/**
 * Deletes the file copy backing a media record from the project's media
 * folder. Call after the record itself has been removed from the database.
 *
 * Note: undoing the deletion restores the record but not the file copy —
 * mirroring how undoing addMedia leaves the copy behind. Media files are
 * treated as derived assets, not undoable state.
 */
export async function removeMediaFile(projectPath: string, media: MediaRecord): Promise<void> {
  const { runtime } = await ensureRuntime(projectPath);
  const references = (): Promise<Set<string>> =>
    resolveMediaReferencePaths(projectPath, () => runtime.service.listAllMedia());
  const initial = await references();
  await removeMediaFileCopy(projectPath, media.path, references, initial);
}

function mediaReferenceSignature(media: MediaRecord[]): string {
  return media.map((record) => record.path).join('\u0000');
}

/** Canonical identities of every stored local media file. */
async function resolveReferenceSet(projectPath: string, media: MediaRecord[]): Promise<Set<string>> {
  const resolved = new Set<string>();
  for (const record of media) {
    const absolute = await mediaAbsolutePath(projectPath, record.path);
    if (absolute !== null) {
      resolved.add(absolute);
      resolved.add(resolve(dirname(runtimeFilePath(projectPath)), record.path));
    }
  }
  return resolved;
}

async function resolveMediaReferencePaths(projectPath: string, getMedia: () => MediaRecord[]): Promise<Set<string>> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const media = getMedia();
    const signature = mediaReferenceSignature(media);
    const resolved = await resolveReferenceSet(projectPath, media);
    if (mediaReferenceSignature(getMedia()) === signature) {
      return resolved;
    }
  }
  return resolveReferenceSet(projectPath, getMedia());
}

async function removeMediaFileCopy(
  projectPath: string,
  mediaPath: string,
  references: () => Promise<Set<string>> = async () => new Set(),
  referenced?: Set<string>,
): Promise<void> {
  const absolute = await mediaAbsolutePath(projectPath, mediaPath);
  if (!absolute) {
    return;
  }
  if ((referenced ?? (await references())).has(absolute)) {
    return;
  }
  let trash: string | undefined;
  try {
    const info = await stat(absolute);
    if (!info.isFile()) {
      return;
    }
    // Move the bytes aside first: if undo restores a reference during the
    // final check, the original file can be put back without data loss.
    trash = `${absolute}.doru-deleting-${randomUUID()}`;
    await rename(absolute, trash);
    const current = await references();
    let stillReferenced = current.has(absolute);
    if (!stillReferenced) {
      for (const reference of current) {
        // Follow the whole symlink chain: an alias may point at another link
        // whose final target is the staged file.
        if (await symlinkChainResolvesTo(reference, absolute)) {
          stillReferenced = true;
          break;
        }
      }
    }
    if (stillReferenced) {
      await rename(trash, absolute);
      trash = undefined;
      return;
    }
    await unlink(trash);
    trash = undefined;
  } catch (error) {
    log.warn('could not remove media file', absolute, error);
    if (trash !== undefined) {
      try {
        await rename(trash, absolute);
      } catch {
        // Best effort: the original bytes may already be gone.
      }
    }
  }
}
