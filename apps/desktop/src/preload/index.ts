import { contextBridge, ipcRenderer } from 'electron';

const api = {
  platform: process.platform,
  getCurrentProject: (): Promise<unknown> => ipcRenderer.invoke('project:current'),
  onProjectBound: (callback: (info: unknown) => void): (() => void) => {
    const listener = (_event: unknown, info: unknown) => callback(info);
    ipcRenderer.on('project:bind', listener);
    return () => ipcRenderer.removeListener('project:bind', listener);
  },
  openProjectDialog: (): Promise<unknown> => ipcRenderer.invoke('project:open', { dialog: true }),
  openProjectPath: (path: string): Promise<unknown> => ipcRenderer.invoke('project:open', { path }),
  createProjectDialog: (): Promise<unknown> => ipcRenderer.invoke('project:create'),
  saveProject: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('project:save', { projectPath }),
  recentProjects: (): Promise<unknown> => ipcRenderer.invoke('project:recent'),
  removeRecentProject: (path: string): Promise<unknown> =>
    ipcRenderer.invoke('project:recent:remove', { path }),
  listPersons: (projectPath: string, search?: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:list', { projectPath, search }),
  all: (projectPath: string): Promise<unknown> => ipcRenderer.invoke('tree:all', { projectPath }),
  treeStats: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:stats', { projectPath }),
  undo: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:undo', { projectPath }),
  redo: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:redo', { projectPath }),
  addPerson: (projectPath: string, person: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:addPerson', { projectPath, person }),
  updatePerson: (projectPath: string, before: unknown, after: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:updatePerson', { projectPath, before, after }),
  deletePerson: (projectPath: string, person: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:deletePerson', { projectPath, person }),
  reparent: (projectPath: string, childId: string, newParentId: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:reparent', { projectPath, childId, newParentId }),
  addRelative: (
    projectPath: string,
    relation: string,
    anchorId: string,
    person: unknown,
  ): Promise<unknown> => ipcRenderer.invoke('tree:addRelative', { projectPath, relation, anchorId, person }),
  exportGedcom: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('project:export', { projectPath }),
  sendChat: (projectPath: string, messages: unknown[]): Promise<unknown> =>
    ipcRenderer.invoke('chat:send', { projectPath, messages }),
  cancelChat: (projectPath: string): void => ipcRenderer.send('chat:cancel', projectPath),
  onChatEvent: (callback: (event: unknown) => void): (() => void) => {
    const listener = (_event: unknown, chatEvent: unknown) => callback(chatEvent);
    ipcRenderer.on('chat:event', listener);
    return () => ipcRenderer.removeListener('chat:event', listener);
  },
  getThemeState: (): Promise<unknown> => ipcRenderer.invoke('theme:state'),
  setTheme: (name: string): Promise<unknown> => ipcRenderer.invoke('theme:set', name),
  openThemesFolder: (): Promise<unknown> => ipcRenderer.invoke('themes:open-folder'),
  getAbout: (): Promise<unknown> => ipcRenderer.invoke('app:about'),
  openLogs: (): Promise<unknown> => ipcRenderer.invoke('logs:open'),
  getThemeCss: (name: string, mode: 'dark' | 'light'): Promise<unknown> =>
    ipcRenderer.invoke('theme:css', { name, mode }),
  onThemeSystemChanged: (callback: (info: { systemDark: boolean }) => void): (() => void) => {
    const listener = (_event: unknown, info: { systemDark: boolean }) => callback(info);
    ipcRenderer.on('theme:system-changed', listener);
    return () => ipcRenderer.removeListener('theme:system-changed', listener);
  },
  onThemeSettingsChanged: (callback: (name: string) => void): (() => void) => {
    const listener = (_event: unknown, name: string) => callback(name);
    ipcRenderer.on('theme:settings-changed', listener);
    return () => ipcRenderer.removeListener('theme:settings-changed', listener);
  },
  onMenuToggleAgentChat: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on('menu:toggle-agent-chat', listener);
    return () => ipcRenderer.removeListener('menu:toggle-agent-chat', listener);
  },
  openExternal: (url: string): Promise<unknown> => ipcRenderer.invoke('shell:openExternal', url),
  listNotes: (projectPath: string, personId?: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:notes', { projectPath, personId }),
  personCounts: (projectPath: string, personIds: string[]): Promise<unknown> =>
    ipcRenderer.invoke('tree:personCounts', { projectPath, personIds }),
  addNote: (projectPath: string, note: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:addNote', { projectPath, note }),
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
  getAiSettings: (): Promise<unknown> => ipcRenderer.invoke('settings:ai:get'),
  getAiProviders: (): Promise<unknown> => ipcRenderer.invoke('settings:ai:providers'),
  setAiSettings: (options: unknown): Promise<unknown> =>
    ipcRenderer.invoke('settings:ai:set', options),
  testAiConnection: (options?: unknown): Promise<unknown> =>
    ipcRenderer.invoke('settings:ai:test', options ?? {}),
  fetchAiModels: (options?: unknown): Promise<unknown> =>
    ipcRenderer.invoke('settings:ai:models', options ?? {}),
};

contextBridge.exposeInMainWorld('doru', api);
