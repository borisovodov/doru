import { ipcMain } from 'electron';
import { exportGedcom, importGedcom } from './gedcom';
import { createProject, openProject } from './projects';
import { recents, windowProject } from './state';

export function registerProjectIpc(): void {
  ipcMain.handle(
    'project:open',
    (event, options: { dialog?: boolean; path?: string } = {}) => openProject(options, event.sender.id),
  );

  ipcMain.handle('project:create', (event) => createProject(event.sender.id));

  ipcMain.handle(
    'project:import',
    (_event, options: { projectPath: string; filePath?: string; dialog?: boolean }) =>
      importGedcom(options),
  );

  ipcMain.handle('project:recent', () => recents.current?.list() ?? []);

  ipcMain.handle('project:current', (event) => windowProject.get(event.sender.id) ?? null);

  ipcMain.handle('project:export', async (_event, options: { projectPath: string }) =>
    exportGedcom(options.projectPath),
  );
}
