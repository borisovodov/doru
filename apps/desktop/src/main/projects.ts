import {
  BrowserWindow,
  dialog,
  ipcMain,
  type IpcMainEvent,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from 'electron';
import { basename, dirname, join } from 'node:path';
import { MEDIA_DIR_NAME, TREE_FILE_EXTENSION, type ProjectBinding, type ProjectSummary } from '@doru/core';
import { GEDCOM_INTEROP_VISIBLE } from '@doru/platform';
import { createBookmark, releaseBookmarkAccess, startAccessing } from './bookmarks';
import { requestRendererAutosaves } from './closeGuard';
import { NodeFileSystem } from './filesystem';
import { openGedcomAsProject } from './gedcom';
import { log } from './log';
import { nls } from './nls';
import { copyMediaDirectory } from './projectMedia';
import { closeProjectRuntime, ensureRuntime, openUntitledStore } from './runtime';
import { updateSession } from './session';
import {
  activeBookmarks,
  isUntitledKey,
  projectWindows,
  recents,
  runtimes,
  openingDestinations,
  savingDestinations,
  savingProjects,
  untitledProjects,
} from './state';
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
const TRANSFER_ACK_TIMEOUT_MS = 2000;

/** Waits until the renderer has committed the rebound project path. */
function waitForTransferAck(window: BrowserWindow): Promise<boolean> {
  return new Promise((resolve) => {
    const finish = (acknowledged: boolean) => {
      clearTimeout(timer);
      ipcMain.removeListener('project:transfer-ack', onAck);
      resolve(acknowledged);
    };
    const onAck = (event: IpcMainEvent) => {
      if (event.sender === window.webContents) {
        finish(true);
      }
    };
    const timer = setTimeout(() => finish(false), TRANSFER_ACK_TIMEOUT_MS);
    ipcMain.on('project:transfer-ack', onAck);
  });
}

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
  if (savingDestinations.has(filePath) || openingDestinations.has(filePath)) {
    log.warn('destination is reserved by an in-progress operation', { path: filePath });
    return null;
  }
  openingDestinations.add(filePath);
  try {
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
        return await openProject({ dialog: true }, senderId);
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
  } finally {
    openingDestinations.delete(filePath);
  }
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
  if (savingDestinations.has(filePath) || openingDestinations.has(filePath)) {
    log.warn('destination is reserved by an in-progress operation', { path: filePath });
    return null;
  }
  openingDestinations.add(filePath);
  try {
    // The system save dialog already asked the user about replacing an
    // existing file, so honor that confirmation the way a document app would:
    // the project is replaced by a new, empty one. A window still showing the
    // old project is closed first so the store and the file watcher release
    // the path (Windows cannot delete a file that is open).
    const existingWindow = projectWindows.get(filePath);
    if (existingWindow && !existingWindow.isDestroyed()) {
      const closed = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => finish(false), 5000);
        const finish = (value: boolean) => {
          clearTimeout(timer);
          existingWindow.removeListener('closed', onClosed);
          resolve(value);
        };
        const onClosed = () => finish(true);
        existingWindow.once('closed', onClosed);
        existingWindow.close();
      });
      if (!closed) {
        return null;
      }
    } else {
      closeProjectRuntime(filePath);
    }
    if (await fs.exists(filePath)) {
      await fs.remove(filePath);
    }
    // Hand the reservation to openProject, which checks and re-claims it
    // synchronously before its first await.
    openingDestinations.delete(filePath);
    return await openProject({ path: filePath, fromPicker: true }, senderId);
  } finally {
    openingDestinations.delete(filePath);
  }
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
  if (savingProjects.has(projectKey)) {
    return null;
  }
  savingProjects.add(projectKey);
  let reservedDestination: string | undefined;
  try {
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
    if (
      (openElsewhere && !openElsewhere.isDestroyed()) ||
      savingDestinations.has(filePath) ||
      openingDestinations.has(filePath)
    ) {
      const message = nls.t('project.dialog.error.openInAnotherWindow');
      if (parent) {
        await dialog.showMessageBox(parent, { type: 'error', message });
      } else {
        dialog.showErrorBox(nls.t('project.dialog.save.title'), message);
      }
      return null;
    }
    savingDestinations.add(filePath);
    reservedDestination = filePath;

    // Pending drafts belong to the temporary store; block editing, then
    // persist them before the store closes so a failed write cannot discard
    // the editor's work. The barrier stays until the window is rebound.
    const sourceWindow = projectWindows.get(projectKey);
    const setTransfer = (active: boolean): void => {
      if (sourceWindow && !sourceWindow.isDestroyed()) {
        sourceWindow.webContents.send('project:transfer', active);
      }
    };
    setTransfer(true);
    if (sourceWindow && !sourceWindow.isDestroyed() && !(await requestRendererAutosaves(sourceWindow))) {
      setTransfer(false);
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
        await copyMediaDirectory(tempMediaDir, mediaDir);
      }
    } catch (error) {
      // The temporary files stay where they were; reopen the store so the
      // window keeps working and the project can be saved again.
      setTransfer(false);
      if (sourceWindow && !sourceWindow.isDestroyed()) {
        openUntitledStore(projectKey, untitled.tempPath);
      } else {
        closeProjectRuntime(projectKey);
      }
      const message = nls.t('project.dialog.error.saveFailed', error instanceof Error ? error.message : String(error));
      if (parent) {
        await dialog.showMessageBox(parent, { type: 'error', message });
      } else {
        dialog.showErrorBox(nls.t('project.dialog.save.title'), message);
      }
      return null;
    }

    let summary: ProjectSummary;
    try {
      ({ summary } = await ensureRuntime(filePath));
    } catch (error) {
      // Keep the temporary store usable: the destination copy can be reopened
      // later, while the window must stay editable after the barrier lifts.
      setTransfer(false);
      if (sourceWindow && !sourceWindow.isDestroyed()) {
        openUntitledStore(projectKey, untitled.tempPath);
      } else {
        closeProjectRuntime(projectKey);
      }
      const message = nls.t('project.dialog.error.saveFailed', error instanceof Error ? error.message : String(error));
      if (parent) {
        await dialog.showMessageBox(parent, { type: 'error', message });
      } else {
        dialog.showErrorBox(nls.t('project.dialog.save.title'), message);
      }
      return null;
    }

    // The destination is open; the temporary copy is no longer needed.
    try {
      await fs.remove(untitled.tempDir);
    } catch (error) {
      log.warn('could not remove the temporary project copy', error);
    }
    untitledProjects.delete(projectKey);

    const window = projectWindows.get(projectKey);
    projectWindows.delete(projectKey);
    if (window && !window.isDestroyed()) {
      bindWindowToProject(window, filePath);
      const acknowledged = await waitForTransferAck(window);
      if (acknowledged && !window.isDestroyed()) {
        window.webContents.send('project:transfer', false);
      } else if (!acknowledged) {
        // Reloading installs the destination binding from getCurrentProject and
        // clears the stale transfer barrier without exposing the removed store.
        log.error('renderer did not acknowledge the rebound project; reloading', { path: filePath });
        window.webContents.reload();
      }
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
  } finally {
    savingProjects.delete(projectKey);
    if (reservedDestination !== undefined) {
      savingDestinations.delete(reservedDestination);
    }
  }
}

export function openExternalPath(path: string): void {
  if (path.toLowerCase().endsWith(TREE_FILE_EXTENSION)) {
    void openProject({ path });
  } else if (isGedcomFile(path)) {
    void openGedcomAsProject(path);
  }
}
