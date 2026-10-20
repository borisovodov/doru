import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { NodeFileSystem } from './filesystem';
import { log } from './log';
import { untitledProjects, type UntitledProjectInfo } from './state';

const fs = new NodeFileSystem();

/**
 * Lifecycle of not-yet-saved projects: a temporary folder under the OS
 * temp directory holding the `.doru` file (and the media folder next to
 * it). The folder is removed when the project is closed without saving;
 * saving moves its contents to the user-picked location instead.
 *
 * This module deliberately imports no window code: it is used both by the
 * window-close cleanup and by the save flow.
 */

export function createUntitledProject(name: string): { key: string; info: UntitledProjectInfo } {
  const id = randomUUID();
  const key = `untitled:${id}`;
  const info: UntitledProjectInfo = {
    tempDir: join(app.getPath('temp'), 'doru-untitled', id),
    tempPath: join(app.getPath('temp'), 'doru-untitled', id, 'project.doru'),
    name,
  };
  untitledProjects.set(key, info);
  return { key, info };
}

/** Removes the temporary files of a not-yet-saved project (never throws). */
export async function disposeUntitled(key: string): Promise<void> {
  const info = untitledProjects.get(key);
  if (!info) {
    return;
  }
  untitledProjects.delete(key);
  try {
    await fs.remove(info.tempDir);
  } catch (error) {
    log.warn('could not remove untitled project files', info.tempDir, error);
  }
}
