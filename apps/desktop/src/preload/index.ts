import { contextBridge, ipcRenderer } from 'electron';

const api = {
  openProjectDialog: (): Promise<unknown> => ipcRenderer.invoke('project:open', { dialog: true }),
  openProjectPath: (path: string): Promise<unknown> => ipcRenderer.invoke('project:open', { path }),
  importGedcom: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('project:import', { projectPath, dialog: true }),
  importGedcomFile: (projectPath: string, filePath: string): Promise<unknown> =>
    ipcRenderer.invoke('project:import', { projectPath, filePath }),
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
  getTheme: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('theme:get', { projectPath }),
  onThemeChanged: (callback: (info: { projectPath: string }) => void): (() => void) => {
    const listener = (_event: unknown, info: { projectPath: string }) => callback(info);
    ipcRenderer.on('theme:changed', listener);
    return () => ipcRenderer.removeListener('theme:changed', listener);
  },
  getThemeState: (): Promise<unknown> => ipcRenderer.invoke('theme:state'),
  getThemeCss: (name: string): Promise<unknown> => ipcRenderer.invoke('theme:css', { name }),
  onThemeSystemChanged: (callback: (info: { systemDark: boolean }) => void): (() => void) => {
    const listener = (_event: unknown, info: { systemDark: boolean }) => callback(info);
    ipcRenderer.on('theme:system-changed', listener);
    return () => ipcRenderer.removeListener('theme:system-changed', listener);
  },
  onThemeConfigChanged: (
    callback: (config: { dark: string; light: string }) => void,
  ): (() => void) => {
    const listener = (_event: unknown, config: { dark: string; light: string }) => callback(config);
    ipcRenderer.on('theme:config-changed', listener);
    return () => ipcRenderer.removeListener('theme:config-changed', listener);
  },
  listNotes: (projectPath: string, personId?: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:notes', { projectPath, personId }),
  addNote: (projectPath: string, note: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:addNote', { projectPath, note }),
  getGedcomText: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:gedcomText', { projectPath }),
  getFamilies: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:families', { projectPath }),
  addFamily: (projectPath: string, family: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:addFamily', { projectPath, family }),
  updateFamily: (projectPath: string, before: unknown, after: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:updateFamily', { projectPath, before, after }),
  deleteFamily: (projectPath: string, family: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:deleteFamily', { projectPath, family }),
  getSources: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:sources', { projectPath }),
  addSource: (
    projectPath: string,
    source: unknown,
    targetType?: string,
    targetId?: string,
  ): Promise<unknown> => ipcRenderer.invoke('tree:addSource', { projectPath, source, targetType, targetId }),
  attachSource: (projectPath: string, sourceId: string, targetType: string, targetId: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:attachSource', { projectPath, sourceId, targetType, targetId }),
  detachCitation: (projectPath: string, citationId: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:detachCitation', { projectPath, citationId }),
  getCitations: (projectPath: string, personId: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:citations', { projectPath, personId }),
  getSession: (): Promise<unknown> => ipcRenderer.invoke('session:get'),
  getEvents: (projectPath: string, personId?: string, familyId?: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:events', { projectPath, personId, familyId }),
  addEvent: (projectPath: string, event: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:addEvent', { projectPath, event }),
  deleteEvent: (projectPath: string, event: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:deleteEvent', { projectPath, event }),
  getMedia: (projectPath: string, personId: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:media', { projectPath, personId }),
  addMedia: (projectPath: string, personId: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:addMedia', { projectPath, personId }),
  deleteMedia: (projectPath: string, media: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:deleteMedia', { projectPath, media }),
  getProjectSettings: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('project:settings', { projectPath }),
  getAiSettings: (): Promise<unknown> => ipcRenderer.invoke('settings:ai:get'),
  getAiProviders: (): Promise<unknown> => ipcRenderer.invoke('settings:ai:providers'),
  setAiSettings: (options: unknown): Promise<unknown> =>
    ipcRenderer.invoke('settings:ai:set', options),
  testAiConnection: (options?: unknown): Promise<unknown> =>
    ipcRenderer.invoke('settings:ai:test', options ?? {}),
  fetchAiModels: (options?: unknown): Promise<unknown> =>
    ipcRenderer.invoke('settings:ai:models', options ?? {}),
  onExternalOpen: (callback: (summary: unknown) => void): (() => void) => {
    const listener = (_event: unknown, summary: unknown) => callback(summary);
    ipcRenderer.on('project:external-open', listener);
    return () => ipcRenderer.removeListener('project:external-open', listener);
  },
};

contextBridge.exposeInMainWorld('doru', api);
