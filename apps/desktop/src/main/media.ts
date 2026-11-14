import { BrowserWindow, dialog, type OpenDialogOptions } from 'electron';
import { randomUUID } from 'node:crypto';
import { dirname, extname, join } from 'node:path';
import { MEDIA_DIR_NAME, type MediaFile, type MediaRecord } from '@doru/core';
import { NodeFileSystem } from './filesystem';
import { log } from './log';
import { ensureRuntime, runtimeFilePath } from './runtime';
import { focusedWindow } from './windows';

const fs = new NodeFileSystem();

export interface MediaFileWithPath extends MediaFile {
  absolutePath: string;
}

export interface MediaWithPath extends Omit<MediaRecord, 'files'> {
  /** Absolute path of the first file, for the compact preview. */
  absolutePath: string;
  files?: MediaFileWithPath[] | undefined;
}

/**
 * Resolves a media path stored in the database to an absolute path inside
 * the project's media folder. Returns null for paths that would escape it.
 */
function mediaAbsolutePath(projectPath: string, mediaPath: string): string | null {
  const normalized = mediaPath.replaceAll('\\', '/');
  if (!normalized.startsWith(`${MEDIA_DIR_NAME}/`) || normalized.includes('../')) {
    return null;
  }
  return join(dirname(runtimeFilePath(projectPath)), mediaPath);
}

function withPaths(projectPath: string, media: MediaRecord): MediaWithPath {
  const sourceFiles: MediaFile[] =
    media.files ?? (media.path !== undefined ? [{ id: media.id, path: media.path }] : []);
  const files = sourceFiles.flatMap((file) => {
    const absolutePath = mediaAbsolutePath(projectPath, file.path);
    return absolutePath === null ? [] : [{ ...file, absolutePath }];
  });
  return {
    ...media,
    absolutePath: files[0]?.absolutePath ?? '',
    files: files.length > 0 ? files : undefined,
  };
}

async function pickMediaFiles(): Promise<string[]> {
  const dialogOptions: OpenDialogOptions = {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'tiff'] }],
    title: 'Add photos',
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
  return runtime.service.listMediaFor(targetType, targetId).map((media) => withPaths(projectPath, media));
}

/** Every media record in the project, with resolvable absolute paths. */
export async function listAllMedia(projectPath: string): Promise<MediaWithPath[]> {
  const { runtime } = await ensureRuntime(projectPath);
  return runtime.service.listAllMedia().map((media) => withPaths(projectPath, media));
}

export async function addMediaToTarget(
  projectPath: string,
  targetType: string,
  targetId: string,
): Promise<MediaWithPath[]> {
  const sources = await pickMediaFiles();
  if (sources.length === 0) {
    return [];
  }
  const { runtime } = await ensureRuntime(projectPath);
  const mediaDir = join(dirname(runtimeFilePath(projectPath)), MEDIA_DIR_NAME);
  await fs.mkdir(mediaDir);
  const added: MediaWithPath[] = [];
  for (const source of sources) {
    const name = `${randomUUID()}${extname(source)}`;
    const destination = join(mediaDir, name);
    await fs.copyFile(source, destination);
    const media: MediaRecord = {
      id: randomUUID(),
      path: join(MEDIA_DIR_NAME, name),
      targetType,
      targetId,
    };
    runtime.service.addMedia(media);
    added.push(withPaths(projectPath, media));
  }
  return added;
}

/** Copies more files into an existing media record. */
export async function addFilesToMedia(projectPath: string, mediaId: string): Promise<MediaWithPath | undefined> {
  const sources = await pickMediaFiles();
  if (sources.length === 0) {
    return undefined;
  }
  const { runtime } = await ensureRuntime(projectPath);
  const before = runtime.service.getMedia(mediaId);
  if (before === undefined) {
    return undefined;
  }
  const mediaDir = join(dirname(runtimeFilePath(projectPath)), MEDIA_DIR_NAME);
  await fs.mkdir(mediaDir);
  const added: MediaFile[] = [];
  const destinations: string[] = [];
  try {
    for (const source of sources) {
      const name = `${randomUUID()}${extname(source)}`;
      const destination = join(mediaDir, name);
      await fs.copyFile(source, destination);
      destinations.push(destination);
      added.push({ id: randomUUID(), path: join(MEDIA_DIR_NAME, name) });
    }
    const after: MediaRecord = { ...before, files: [...(before.files ?? []), ...added] };
    runtime.service.updateMedia(before, after);
    return withPaths(projectPath, runtime.service.getMedia(mediaId) ?? after);
  } catch (error) {
    for (const destination of destinations) {
      try {
        await fs.remove(destination);
      } catch {
        // Best effort: the database was not updated, the copied file is garbage.
      }
    }
    throw error;
  }
}

/** Removes one file row and its copy from the project's media folder. */
export async function removeFileFromMedia(
  projectPath: string,
  media: MediaRecord,
  file: MediaFile,
): Promise<MediaWithPath | undefined> {
  const { runtime } = await ensureRuntime(projectPath);
  const before = runtime.service.getMedia(media.id) ?? media;
  const files = (before.files ?? []).filter((entry) => entry.id !== file.id);
  if (files.length === (before.files ?? []).length) {
    return undefined;
  }
  runtime.service.updateMedia(before, { ...before, files });
  await removeMediaFile(projectPath, file.path);
  return withPaths(projectPath, runtime.service.getMedia(media.id) ?? { ...before, files });
}

/**
 * Deletes the file copies backing a media record from the project's media
 * folder. Call after the record itself has been removed from the database.
 *
 * Note: undoing the deletion restores the record but not the file copies —
 * mirroring how undoing addMedia leaves the copy behind. Media files are
 * treated as derived assets, not undoable state.
 */
export async function removeMediaFiles(projectPath: string, media: MediaRecord): Promise<void> {
  const paths = media.files?.map((file) => file.path) ?? (media.path !== undefined ? [media.path] : []);
  for (const path of paths) {
    await removeMediaFile(projectPath, path);
  }
}

async function removeMediaFile(projectPath: string, mediaPath: string): Promise<void> {
  const absolute = mediaAbsolutePath(projectPath, mediaPath);
  if (!absolute) {
    return;
  }
  try {
    await fs.remove(absolute);
  } catch (error) {
    log.warn('could not remove media file', absolute, error);
  }
}
