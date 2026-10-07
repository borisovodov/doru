import { contextBridge, ipcRenderer } from 'electron';

const api = {
  openProjectDialog: (): Promise<unknown> => ipcRenderer.invoke('project:open', { dialog: true }),
  openProjectPath: (path: string): Promise<unknown> => ipcRenderer.invoke('project:open', { path }),
  importGedcom: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('project:import', { projectPath, dialog: true }),
  recentProjects: (): Promise<unknown> => ipcRenderer.invoke('project:recent'),
  closeProject: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('project:close', { path: projectPath }),
  onExternalOpen: (callback: (summary: unknown) => void): (() => void) => {
    const listener = (_event: unknown, summary: unknown) => callback(summary);
    ipcRenderer.on('project:external-open', listener);
    return () => ipcRenderer.removeListener('project:external-open', listener);
  },
};

contextBridge.exposeInMainWorld('doru', api);
