import { ipcMain } from 'electron';
import type { ProjectBinding } from '@doru/core';
import { exportGedcom, importGedcom } from './gedcom';
import { createProject, openAnyProjectDialog, openFileAsProject, saveProject } from './projects';
import { recents, windowProject } from './state';
import { bindingOf } from './windows';

export function registerProjectIpc(): void {
  ipcMain.handle(
    'project:open',
    (event, options: { dialog?: boolean; path?: string } = {}) =>
      options.path
        ? openFileAsProject(options.path, event.sender.id)
        : openAnyProjectDialog(event.sender.id),
  );

  ipcMain.handle('project:create', (event) => createProject(event.sender.id));

  ipcMain.handle(
    'project:import',
    (_event, options: { projectPath: string; filePath?: string; dialog?: boolean }) =>
      importGedcom(options),
  );

  ipcMain.handle('project:save', (_event, options: { projectPath: string }) =>
    saveProject(options.projectPath),
  );

  ipcMain.handle('project:recent', () => recents.current?.list() ?? []);

  ipcMain.handle('project:current', (event): ProjectBinding | null => {
    const bound = windowProject.get(event.sender.id) ?? null;
    return bound === null ? null : bindingOf(bound);
  });

  ipcMain.handle('project:export', async (_event, options: { projectPath: string }) =>
    exportGedcom(options.projectPath),
  );
}
