import { BrowserWindow, dialog, type OpenDialogOptions } from 'electron';
import { randomUUID } from 'node:crypto';
import { dirname, extname, join } from 'node:path';
import { MEDIA_DIR_NAME, addMediaOp, type MediaRecord } from '@doru/core';
import { NodeFileSystem } from './filesystem';
import { log } from './log';
import { ensureRuntime } from './runtime';
import { focusedWindow } from './windows';

const fs = new NodeFileSystem();

/**
 * Resolves a media path stored in the database to an absolute path inside
 * the project's media folder. Returns null for paths that would escape it.
 */
function mediaAbsolutePath(projectPath: string, mediaPath: string): string | null {
  const normalized = mediaPath.replaceAll('\\', '/');
  if (!normalized.startsWith(`${MEDIA_DIR_NAME}/`) || normalized.includes('../')) {
    return null;
  }
  return join(dirname(projectPath), mediaPath);
}

export async function listMediaForPerson(
  projectPath: string,
  personId: string,
): Promise<Array<MediaRecord & { absolutePath: string }>> {
  const { runtime } = await ensureRuntime(projectPath);
  return runtime.repo
    .listMediaFor('person', personId)
    .map((media) => ({ ...media, absolutePath: join(dirname(projectPath), media.path) }));
}

export async function addMediaToPerson(
  projectPath: string,
  personId: string,
): Promise<Array<MediaRecord & { absolutePath: string }>> {
  const dialogOptions: OpenDialogOptions = {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'tiff'] }],
    title: 'Add photos',
  };
  const result =
    focusedWindow() !== null
      ? await dialog.showOpenDialog(focusedWindow() as BrowserWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);
  if (result.canceled || result.filePaths.length === 0) {
    return [];
  }
  const { runtime } = await ensureRuntime(projectPath);
  const mediaDir = join(dirname(projectPath), MEDIA_DIR_NAME);
  await fs.mkdir(mediaDir);
  const added: Array<MediaRecord & { absolutePath: string }> = [];
  for (const source of result.filePaths) {
    const name = `${randomUUID()}${extname(source)}`;
    const destination = join(mediaDir, name);
    await fs.copyFile(source, destination);
    const media: MediaRecord = {
      id: randomUUID(),
      path: join(MEDIA_DIR_NAME, name),
      targetType: 'person',
      targetId: personId,
    };
    runtime.queue.apply(addMediaOp(media), { repo: runtime.repo });
    added.push({ ...media, absolutePath: destination });
  }
  return added;
}

/**
 * Deletes the file copy backing a media record from the project's media
 * folder. Call after the record itself has been removed from the database.
 *
 * Note: undoing the deletion restores the record but not the file copy —
 * mirroring how undoing addMedia leaves the copy behind. Media files are
 * treated as derived assets, not undoable state.
 */
export async function removeMediaFile(projectPath: string, mediaPath: string): Promise<void> {
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
