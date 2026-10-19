import { BrowserWindow, dialog, type OpenDialogOptions, type SaveDialogOptions } from 'electron';
import { TREE_FILE_EXTENSION, type ProjectSummary } from '@doru/core';
import { createBookmark, releaseBookmarkAccess, startAccessing } from './bookmarks';
import { ensureRuntime } from './runtime';
import { updateSession } from './session';
import { activeBookmarks, projectWindows, recents, runtimes, windowProject } from './state';
import { bindWindowToProject, createWindow, focusedWindow, windowById } from './windows';

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
  const senderWindow = senderId !== undefined ? windowById(senderId) : null;
  const senderBound = senderId !== undefined ? windowProject.get(senderId) : undefined;
  if (senderWindow && !senderWindow.isDestroyed() && senderBound === null) {
    bindWindowToProject(senderWindow, filePath);
  } else if (senderId === undefined) {
    const emptyWindow =
      BrowserWindow.getAllWindows().find(
        (window) => !window.isDestroyed() && windowProject.get(window.webContents.id) === null,
      ) ?? null;
    if (emptyWindow) {
      bindWindowToProject(emptyWindow, filePath);
    } else {
      createWindow(filePath);
    }
  } else {
    createWindow(filePath);
  }
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

export function openExternalPath(path: string): void {
  if (!path.toLowerCase().endsWith(TREE_FILE_EXTENSION)) {
    return;
  }
  void openProject({ path });
}
