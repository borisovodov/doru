import { contextBridge, ipcRenderer } from 'electron';

const api = {
  openProjectDialog: (): Promise<unknown> => ipcRenderer.invoke('project:open', { dialog: true }),
  openProjectPath: (path: string): Promise<unknown> => ipcRenderer.invoke('project:open', { path }),
  importGedcom: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('project:import', { projectPath, dialog: true }),
  recentProjects: (): Promise<unknown> => ipcRenderer.invoke('project:recent'),
  closeProject: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('project:close', { path: projectPath }),
  listPersons: (projectPath: string, search?: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:list', { projectPath, search }),
  treeStats: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:stats', { projectPath }),
  getUndoState: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:undoState', { projectPath }),
  undo: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:undo', { projectPath }),
  redo: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:redo', { projectPath }),
  onExternalOpen: (callback: (summary: unknown) => void): (() => void) => {
    const listener = (_event: unknown, summary: unknown) => callback(summary);
    ipcRenderer.on('project:external-open', listener);
    return () => ipcRenderer.removeListener('project:external-open', listener);
  },
};

contextBridge.exposeInMainWorld('doru', api);
