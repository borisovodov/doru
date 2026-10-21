import { BrowserWindow, dialog, type OpenDialogOptions, type SaveDialogOptions } from 'electron';
import { dirname, join } from 'node:path';
import {
  MEDIA_DIR_NAME,
  TREE_FILE_EXTENSION,
  type ProjectBinding,
  type ProjectSummary,
} from '@doru/core';
import { createBookmark, releaseBookmarkAccess, startAccessing } from './bookmarks';
import { NodeFileSystem } from './filesystem';
import { openGedcomAsProject } from './gedcom';
import { closeProjectRuntime, ensureRuntime, openUntitledStore } from './runtime';
import { updateSession } from './session';
import {
  activeBookmarks,
  isUntitledKey,
  projectWindows,
  recents,
  runtimes,
  untitledProjects,
} from './state';
import { bindingOf, bindWindowToProject, createWindow, focusedWindow, openProjectInWindow, windowById } from './windows';

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

export async function openProject(
  options: { dialog?: boolean; path?: string },
  senderId?: number,
): Promise<ProjectSummary | null> {
  let filePath = options.path;
  const pickedViaDialog = filePath === undefined;
  if (!filePath) {
    const dialogOptions: OpenDialogOptions = {
      properties: ['openFile'],
      filters: [{ name: 'Dóru project', extensions: ['doru'] }],
      title: 'Open Project',
    };
    const parent = focusedWindow();
    const result =
      parent !== null
        ? await dialog.showOpenDialog(parent, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);
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
    // or the file was moved or deleted. Drop the held access, if any.
    releaseAccess(filePath);
    if (senderId !== undefined && !pickedViaDialog) {
      // A user-initiated reopen failed — let them pick the file again.
      return openProject({ dialog: true }, senderId);
    }
    return null;
  }
  openProjectInWindow(filePath, senderId);
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

/**
 * Opens a file picked by the user (or handed over by the OS): a `.doru`
 * file opens its project, a `.ged`/`.gdz` file is imported into a new,
 * not-yet-saved project.
 */
export function openFileAsProject(
  filePath: string,
  senderId?: number,
): Promise<ProjectSummary | ProjectBinding | null> {
  if (filePath.toLowerCase().endsWith(TREE_FILE_EXTENSION)) {
    return openProject({ path: filePath }, senderId);
  }
  if (isGedcomFile(filePath)) {
    return openGedcomAsProject(filePath, senderId);
  }
  return Promise.resolve(null);
}

/**
 * The Open dialog: project files and GEDCOM files in one list. A `.doru`
 * file opens its project; a `.ged`/`.gdz` file starts a new, not-yet-saved
 * project that the user saves to `.doru` later (see `openFileAsProject`).
 *
 * A single filter entry keeps every extension selectable on macOS, where a
 * multi-filter panel greys out files outside the active filter.
 */
export async function openAnyProjectDialog(
  senderId?: number,
): Promise<ProjectSummary | ProjectBinding | null> {
  const dialogOptions: OpenDialogOptions = {
    properties: ['openFile'],
    filters: [
      { name: 'Dóru project or GEDCOM file', extensions: ['doru', 'ged', 'gdz'] },
    ],
    title: 'Open or Import GEDCOM',
  };
  const parent = senderId !== undefined ? windowById(senderId) : focusedWindow();
  const result =
    parent !== null
      ? await dialog.showOpenDialog(parent, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);
  if (result.canceled || result.filePaths[0] === undefined) {
    return null;
  }
  return openFileAsProject(result.filePaths[0], senderId);
}

export async function createProject(senderId?: number): Promise<ProjectSummary | null> {
  const dialogOptions: SaveDialogOptions = {
    filters: [{ name: 'Dóru project', extensions: ['doru'] }],
    title: 'Create New Project',
    buttonLabel: 'Create',
    defaultPath: 'Family Tree.doru',
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
  return openProject({ path: filePath }, senderId);
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
    filters: [{ name: 'Dóru project', extensions: ['doru'] }],
    title: 'Save Project',
    buttonLabel: 'Save',
    defaultPath: `${untitled.name.replace(/\.(ged|gdz)$/i, '')}.doru`,
  };
  const result =
    parent !== null
      ? await dialog.showSaveDialog(parent, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions);
  if (result.canceled || !result.filePath) {
    return null;
  }
  const filePath = result.filePath.toLowerCase().endsWith(TREE_FILE_EXTENSION)
    ? result.filePath
    : `${result.filePath}${TREE_FILE_EXTENSION}`;
  const openElsewhere = projectWindows.get(filePath);
  if (openElsewhere && !openElsewhere.isDestroyed()) {
    const message = 'This file is already open in another window.';
    if (parent) {
      await dialog.showMessageBox(parent, { type: 'error', message });
    } else {
      dialog.showErrorBox('Save Project', message);
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
    const message = `Could not save the project: ${error instanceof Error ? error.message : String(error)}`;
    if (parent) {
      await dialog.showMessageBox(parent, { type: 'error', message });
    } else {
      dialog.showErrorBox('Save Project', message);
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
