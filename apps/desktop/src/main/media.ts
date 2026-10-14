import { BrowserWindow, dialog, type OpenDialogOptions } from 'electron';
import { randomUUID } from 'node:crypto';
import { dirname, extname, join } from 'node:path';
import { MEDIA_DIR_NAME, addMediaOp, type MediaRecord } from '@doru/core';
import { NodeFileSystem } from './filesystem';
import { ensureRuntime } from './runtime';
import { focusedWindow } from './windows';

const fs = new NodeFileSystem();

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
