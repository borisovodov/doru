import { contextBridge, ipcRenderer } from 'electron';

const api = {
  openProjectDialog: (): Promise<unknown> => ipcRenderer.invoke('project:open', { dialog: true }),
  openProjectPath: (path: string): Promise<unknown> => ipcRenderer.invoke('project:open', { path }),
  importGedcom: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('project:import', { projectPath, dialog: true }),
};

contextBridge.exposeInMainWorld('doru', api);
