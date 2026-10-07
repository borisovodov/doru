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
  addPerson: (projectPath: string, person: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:addPerson', { projectPath, person }),
  updatePerson: (projectPath: string, before: unknown, after: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:updatePerson', { projectPath, before, after }),
  exportGedcom: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('project:export', { projectPath }),
  sendChat: (projectPath: string, messages: unknown[]): Promise<unknown> =>
    ipcRenderer.invoke('chat:send', { projectPath, messages }),
  onChatPermission: (callback: (request: unknown) => void): (() => void) => {
    const listener = (_event: unknown, request: unknown) => callback(request);
    ipcRenderer.on('chat:permission', listener);
    return () => ipcRenderer.removeListener('chat:permission', listener);
  },
  respondChatPermission: (id: string, allow: boolean): void =>
    ipcRenderer.send('chat:permission-response', { id, allow }),
  onExternalOpen: (callback: (summary: unknown) => void): (() => void) => {
    const listener = (_event: unknown, summary: unknown) => callback(summary);
    ipcRenderer.on('project:external-open', listener);
    return () => ipcRenderer.removeListener('project:external-open', listener);
  },
};

contextBridge.exposeInMainWorld('doru', api);
