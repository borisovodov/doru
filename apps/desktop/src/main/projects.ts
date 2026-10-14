import { BrowserWindow, dialog, type OpenDialogOptions, type SaveDialogOptions } from 'electron';
import { TREE_FILE_EXTENSION, type ProjectSummary } from '@doru/core';
import { ensureRuntime } from './runtime';
import { updateSession } from './session';
import { projectWindows, recents, runtimes, windowProject } from './state';
import { bindWindowToProject, createWindow, focusedWindow, windowById } from './windows';

export async function openProject(
  options: { dialog?: boolean; path?: string },
  senderId?: number,
): Promise<ProjectSummary | null> {
  let filePath = options.path;
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
  const { summary } = await ensureRuntime(filePath);
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
    await recents.current.touch(summary.path);
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
