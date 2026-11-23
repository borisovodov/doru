import { BrowserWindow, dialog, type OpenDialogOptions, type SaveDialogOptions } from 'electron';
import { basename, dirname, join } from 'node:path';
import { MEDIA_DIR_NAME, TREE_FILE_EXTENSION, type ProjectBinding, type ProjectSummary } from '@doru/core';
import { GEDCOM_INTEROP_VISIBLE } from '@doru/platform';
import { createBookmark, releaseBookmarkAccess, startAccessing } from './bookmarks';
import { requestRendererAutosaves } from './closeGuard';
import { NodeFileSystem } from './filesystem';
import { openGedcomAsProject } from './gedcom';
import { log } from './log';
import { nls } from './nls';
import { closeProjectRuntime, ensureRuntime, openUntitledStore } from './runtime';
import { updateSession } from './session';
import { activeBookmarks, isUntitledKey, projectWindows, recents, runtimes, untitledProjects } from './state';
import { startTreeWatcher } from './tree-watcher';
import {
  bindingOf,
  bindWindowToProject,
  createWindow,
  focusedWindow,
  openProjectInWindow,
  windowById,
} from './windows';

const fs = new NodeFileSystem();

/** File extensions the app opens directly (imports or opens a project). */
export const GEDCOM_EXTENSIONS = ['.ged', '.gdz'];

export function isGedcomFile(path: string): boolean {
  const lower = path.toLowerCase();
  return GEDCOM_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/**
 * Regrants access to a project file before opening it (macOS).
 *
 * Files picked in a dialog or double-clicked in Finder are accessible for the
 * current launch by themselves. A file reopened from recents or the session
 * restore is only accessible if a stored security-scoped bookmark resolves —
 * otherwise the open below fails and the caller falls back to the dialog.
 */
async function grantAccess(filePath: string): Promise<void> {
  if (activeBookmarks.has(filePath)) {
    return;
  }
  const entry = (await recents.current?.list())?.find((item) => item.path === filePath);
  const stop = entry?.bookmark ? startAccessing(entry.bookmark) : null;
  if (stop) {
    activeBookmarks.set(filePath, stop);
  }
}

function releaseAccess(filePath: string): void {
  releaseBookmarkAccess(activeBookmarks.get(filePath));
  activeBookmarks.delete(filePath);
}

export interface OpenProjectOptions {
  /** Show the Open dialog instead of using `path`. */
  dialog?: boolean;
  path?: string;
  /** The path was chosen in a native file picker; never reopen the picker on failure. */
  fromPicker?: boolean;
}

export async function openProject(options: OpenProjectOptions, senderId?: number): Promise<ProjectSummary | null> {
  let filePath = options.path;
  const fromPicker = filePath === undefined || options.fromPicker === true;
  if (!filePath) {
    const dialogOptions: OpenDialogOptions = {
      properties: ['openFile'],
      filters: [{ name: nls.t('project.dialog.open.filter'), extensions: ['doru'] }],
      title: nls.t('project.dialog.open.title'),
    };
    const parent = focusedWindow();
    const result =
      parent !== null ? await dialog.showOpenDialog(parent, dialogOptions) : await dialog.showOpenDialog(dialogOptions);
    if (result.canceled || result.filePaths[0] === undefined) {
      return null;
    }
    filePath = result.filePaths[0];
  }
  if (!filePath.toLowerCase().endsWith(TREE_FILE_EXTENSION)) {
    return null;
  }
  const existingWindow = projectWindows.get(filePath);
  if (existingWindow) {
    if (existingWindow.isDestroyed()) {
      projectWindows.delete(filePath);
    } else {
      if (existingWindow.isMinimized()) {
        existingWindow.restore();
      }
      existingWindow.focus();
      return {
        path: filePath,
        schemaVersion: runtimes.get(filePath)?.store.userVersion() ?? 0,
        created: false,
      };
    }
  }
  let summary: ProjectSummary;
  try {
    await grantAccess(filePath);
    summary = (await ensureRuntime(filePath)).summary;
  } catch (error) {
    // The file is not readable: a sandboxed build without a working bookmark,
    // the file was moved or deleted, or its schema version is not understood
    // by this build. Log the reason and drop the held access, if any.
    log.error('failed to open project', filePath, error);
    releaseAccess(filePath);
    if (fromPicker) {
      // The user already chose this file; reopening the picker would just
      // loop on the same broken file. Report the failure instead.
      await showOpenProjectError(filePath, error, senderId);
      return null;
    }
    if (senderId !== undefined) {
      // A user-initiated reopen failed — let them pick the file again.
      return openProject({ dialog: true }, senderId);
    }
    return null;
  }
  openProjectInWindow(filePath, senderId);
  startTreeWatcher(filePath);
  if (recents.current) {
    const bookmark = await createBookmark(summary.path);
    await recents.current.touch(summary.path, bookmark);
    updateSession((session) => {
      const paths = session.paths.filter((entry) => entry !== summary.path);
      return { paths: [...paths, summary.path], activePath: summary.path };
    });
  }
  return summary;
}

/** Shows the failure of a user-picked file in the locale of the app. */
async function showOpenProjectError(filePath: string, error: unknown, senderId?: number): Promise<void> {
  const detail = error instanceof Error ? error.message : String(error);
  const options = {
    type: 'error' as const,
    message: nls.t('project.open.error.title'),
    detail: nls.t('project.open.error.message', basename(filePath), detail),
  };
  const parent = senderId !== undefined ? windowById(senderId) : focusedWindow();
  if (parent !== null) {
    await dialog.showMessageBox(parent, options);
  } else {
    await dialog.showMessageBox(options);
  }
}

/**
 * Opens a file picked by the user (or handed over by the OS): a `.doru`
 * file opens its project, a `.ged`/`.gdz` file is imported into a new,
 * not-yet-saved project.
 */
export function openFileAsProject(
  filePath: string,
  senderId?: number,
  fromPicker = false,
): Promise<ProjectSummary | ProjectBinding | null> {
  if (filePath.toLowerCase().endsWith(TREE_FILE_EXTENSION)) {
    return openProject({ path: filePath, fromPicker }, senderId);
  }
  if (isGedcomFile(filePath)) {
    return openGedcomAsProject(filePath, senderId);
  }
  return Promise.resolve(null);
}

/**
 * The Open dialog: project files and, while `GEDCOM_INTEROP_VISIBLE` is on,
 * GEDCOM files in one list. A `.doru` file opens its project; a `.ged`/`.gdz`
 * file starts a new, not-yet-saved project that the user saves to `.doru`
 * later (see `openFileAsProject`).
 *
 * A single filter entry keeps every extension selectable on macOS, where a
 * multi-filter panel greys out files outside the active filter.
 */
export async function openAnyProjectDialog(senderId?: number): Promise<ProjectSummary | ProjectBinding | null> {
  const dialogOptions: OpenDialogOptions = GEDCOM_INTEROP_VISIBLE
    ? {
        properties: ['openFile'],
        filters: [{ name: nls.t('project.dialog.openGedcom.filter'), extensions: ['doru', 'ged', 'gdz'] }],
        title: nls.t('project.dialog.openGedcom.title'),
      }
    : {
        properties: ['openFile'],
        filters: [{ name: nls.t('project.dialog.open.filter'), extensions: ['doru'] }],
        title: nls.t('project.dialog.open.title'),
      };
  const parent = senderId !== undefined ? windowById(senderId) : focusedWindow();
  const result =
    parent !== null ? await dialog.showOpenDialog(parent, dialogOptions) : await dialog.showOpenDialog(dialogOptions);
  if (result.canceled || result.filePaths[0] === undefined) {
    return null;
  }
  return openFileAsProject(result.filePaths[0], senderId, true);
}

export async function createProject(senderId?: number): Promise<ProjectSummary | null> {
  const dialogOptions: SaveDialogOptions = {
    filters: [{ name: nls.t('project.dialog.open.filter'), extensions: ['doru'] }],
    title: nls.t('project.dialog.create.title'),
    buttonLabel: nls.t('project.dialog.create.button'),
    defaultPath: nls.t('project.dialog.create.defaultName'),
  };
  const result =
    focusedWindow() !== null
      ? await dialog.showSaveDialog(focusedWindow() as BrowserWindow, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions);
  if (result.canceled || !result.filePath) {
    return null;
  }
  const filePath = result.filePath.toLowerCase().endsWith(TREE_FILE_EXTENSION)
    ? result.filePath
    : `${result.filePath}${TREE_FILE_EXTENSION}`;
  // The system save dialog already asked the user about replacing an
  // existing file, so honor that confirmation the way a document app would:
  // the project is replaced by a new, empty one. A window still showing the
  // old project is closed first so the store and the file watcher release
  // the path (Windows cannot delete a file that is open).
  const existingWindow = projectWindows.get(filePath);
  if (existingWindow && !existingWindow.isDestroyed()) {
    await new Promise<void>((resolve) => {
      existingWindow.once('closed', resolve);
      existingWindow.close();
    });
  } else {
    closeProjectRuntime(filePath);
  }
  if (await fs.exists(filePath)) {
    await fs.remove(filePath);
  }
  return openProject({ path: filePath, fromPicker: true }, senderId);
}

/**
 * Saves a not-yet-saved project: asks for a `.doru` location, moves the
 * temporary files there, reopens the store at the real path and rebinds the
 * window. Saved projects autosave on every mutation, so saving them is a
 * no-op that reports the current binding.
 */
export async function saveProject(projectKey: string): Promise<ProjectBinding | null> {
  if (!isUntitledKey(projectKey)) {
    return bindingOf(projectKey);
  }
  const untitled = untitledProjects.get(projectKey);
  if (!untitled) {
    return null;
  }
  const parent = projectWindows.get(projectKey) ?? focusedWindow();
  const dialogOptions: SaveDialogOptions = {
    filters: [{ name: nls.t('project.dialog.open.filter'), extensions: ['doru'] }],
    title: nls.t('project.dialog.save.title'),
    buttonLabel: nls.t('project.dialog.save.button'),
    defaultPath: `${untitled.name.replace(/\.(ged|gdz)$/i, '')}.doru`,
  };
  const result =
    parent !== null ? await dialog.showSaveDialog(parent, dialogOptions) : await dialog.showSaveDialog(dialogOptions);
  if (result.canceled || !result.filePath) {
    return null;
  }
  const filePath = result.filePath.toLowerCase().endsWith(TREE_FILE_EXTENSION)
    ? result.filePath
    : `${result.filePath}${TREE_FILE_EXTENSION}`;
  const openElsewhere = projectWindows.get(filePath);
  if (openElsewhere && !openElsewhere.isDestroyed()) {
    const message = nls.t('project.dialog.error.openInAnotherWindow');
    if (parent) {
      await dialog.showMessageBox(parent, { type: 'error', message });
    } else {
      dialog.showErrorBox(nls.t('project.dialog.save.title'), message);
    }
    return null;
  }

  // Pending drafts belong to the temporary store; persist them before the
  // store closes so a failed write cannot discard the editor's work.
  const sourceWindow = projectWindows.get(projectKey);
  if (sourceWindow && !sourceWindow.isDestroyed() && !(await requestRendererAutosaves(sourceWindow))) {
    const message = nls.t('project.dialog.error.saveFailed', nls.t('features.tree.autosaveFailed'));
    if (parent) {
      await dialog.showMessageBox(parent, { type: 'error', message });
    } else {
      dialog.showErrorBox(nls.t('project.dialog.save.title'), message);
    }
    return null;
  }

  // Flush and detach the temporary store before moving its files. The
  // temporary files are kept: they are moved below.
  closeProjectRuntime(projectKey, { removeUntitledFiles: false });
  try {
    await fs.mkdir(dirname(filePath));
    await fs.copyFile(untitled.tempPath, filePath);
    const tempMediaDir = join(untitled.tempDir, MEDIA_DIR_NAME);
    if (await fs.exists(tempMediaDir)) {
      const mediaDir = join(dirname(filePath), MEDIA_DIR_NAME);
      await fs.mkdir(mediaDir);
      for (const entry of await fs.readdir(tempMediaDir)) {
        await fs.copyFile(join(tempMediaDir, entry), join(mediaDir, entry));
      }
    }
  } catch (error) {
    // The temporary files stay where they were; reopen the store so the
    // window keeps working and the project can be saved again.
    openUntitledStore(projectKey, untitled.tempPath);
    const message = nls.t('project.dialog.error.saveFailed', error instanceof Error ? error.message : String(error));
    if (parent) {
      await dialog.showMessageBox(parent, { type: 'error', message });
    } else {
      dialog.showErrorBox(nls.t('project.dialog.save.title'), message);
    }
    return null;
  }

  // The destination holds the project now; drop the temporary copy.
  await fs.remove(untitled.tempDir);
  untitledProjects.delete(projectKey);

  const { summary } = await ensureRuntime(filePath);
  const window = projectWindows.get(projectKey);
  projectWindows.delete(projectKey);
  if (window && !window.isDestroyed()) {
    bindWindowToProject(window, filePath);
  } else {
    createWindow(filePath);
  }
  startTreeWatcher(filePath);
  const binding = bindingOf(filePath);
  if (recents.current) {
    const bookmark = await createBookmark(summary.path);
    await recents.current.touch(summary.path, bookmark);
  }
  updateSession((session) => {
    const paths = session.paths.filter((entry) => entry !== filePath);
    return { paths: [...paths, filePath], activePath: filePath };
  });
  return binding;
}

export function openExternalPath(path: string): void {
  if (path.toLowerCase().endsWith(TREE_FILE_EXTENSION)) {
    void openProject({ path });
  } else if (isGedcomFile(path)) {
    void openGedcomAsProject(path);
  }
}
