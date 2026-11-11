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
  sendChat: (projectPath: string, sessionId: string, text: string): Promise<unknown> =>
    ipcRenderer.invoke('chat:send', { projectPath, sessionId, text }),
  cancelChat: (projectPath: string, sessionId: string): void =>
    ipcRenderer.send('chat:cancel', { projectPath, sessionId }),
  onChatEvent: (callback: (event: unknown) => void): (() => void) => {
    const listener = (_event: unknown, chatEvent: unknown) => callback(chatEvent);
    ipcRenderer.on('chat:event', listener);
    return () => ipcRenderer.removeListener('chat:event', listener);
  },
  listChatSessions: (projectKey: string): Promise<unknown> =>
    ipcRenderer.invoke('chat:sessions:list', projectKey),
  createChatSession: (projectKey: string): Promise<unknown> =>
    ipcRenderer.invoke('chat:sessions:create', projectKey),
  deleteChatSession: (projectKey: string, id: string): Promise<unknown> =>
    ipcRenderer.invoke('chat:sessions:delete', { projectKey, id }),
  getChatTranscript: (projectKey: string, id: string): Promise<unknown> =>
    ipcRenderer.invoke('chat:sessions:transcript', { projectKey, id }),
  onTreeExternalChange: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on('tree:externalChange', listener);
    return () => ipcRenderer.removeListener('tree:externalChange', listener);
  },
  getThemeState: (): Promise<unknown> => ipcRenderer.invoke('theme:state'),
  setTheme: (name: string): Promise<unknown> => ipcRenderer.invoke('theme:set', name),
  openThemesFolder: (): Promise<unknown> => ipcRenderer.invoke('themes:open-folder'),
  getAbout: (): Promise<unknown> => ipcRenderer.invoke('app:about'),
  copyText: (text: string): Promise<void> => ipcRenderer.invoke('clipboard:writeText', text),
  openLogs: (): Promise<unknown> => ipcRenderer.invoke('logs:open'),
  getThemeCss: (name: string, mode: 'dark' | 'light'): Promise<unknown> =>
    ipcRenderer.invoke('theme:css', { name, mode }),
  onThemeSystemChanged: (callback: (info: { systemDark: boolean }) => void): (() => void) => {
    const listener = (_event: unknown, info: { systemDark: boolean }) => callback(info);
    ipcRenderer.on('theme:system-changed', listener);
    return () => ipcRenderer.removeListener('theme:system-changed', listener);
  },
  onThemeSettingsChanged: (callback: (state: unknown) => void): (() => void) => {
    const listener = (_event: unknown, state: unknown) => callback(state);
    ipcRenderer.on('theme:settings-changed', listener);
    return () => ipcRenderer.removeListener('theme:settings-changed', listener);
  },
  onAiSettingsChanged: (callback: (state: unknown) => void): (() => void) => {
    const listener = (_event: unknown, state: unknown) => callback(state);
    ipcRenderer.on('settings:ai:changed', listener);
    return () => ipcRenderer.removeListener('settings:ai:changed', listener);
  },
  menuAction: (action: string): Promise<void> => ipcRenderer.invoke('menu:action', action),
  onMenuCommand: (callback: (commandId: string) => void): (() => void) => {
    const listener = (_event: unknown, commandId: string) => callback(commandId);
    ipcRenderer.on('menu:command', listener);
    return () => ipcRenderer.removeListener('menu:command', listener);
  },
  openExternal: (url: string): Promise<unknown> => ipcRenderer.invoke('shell:openExternal', url),
  listNotes: (projectPath: string, personId?: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:notes', { projectPath, personId }),
  personCounts: (projectPath: string, personIds: string[]): Promise<unknown> =>
    ipcRenderer.invoke('tree:personCounts', { projectPath, personIds }),
  addNote: (projectPath: string, note: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:addNote', { projectPath, note }),
  updateNote: (projectPath: string, before: unknown, after: unknown, context?: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:updateNote', { projectPath, before, after, context }),
  deleteNote: (projectPath: string, note: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:deleteNote', { projectPath, note }),
  getFamilies: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:families', { projectPath }),
  addFamily: (projectPath: string, family: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:addFamily', { projectPath, family }),
  updateFamily: (projectPath: string, before: unknown, after: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:updateFamily', { projectPath, before, after }),
  deleteFamily: (projectPath: string, family: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:deleteFamily', { projectPath, family }),
  getAssociations: (projectPath: string, personId: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:associations', { projectPath, personId }),
  addAssociation: (projectPath: string, association: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:addAssociation', { projectPath, association }),
  updateAssociation: (projectPath: string, before: unknown, after: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:updateAssociation', { projectPath, before, after }),
  deleteAssociation: (projectPath: string, association: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:deleteAssociation', { projectPath, association }),
  getIdentifiers: (projectPath: string, personId: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:identifiers', { projectPath, personId }),
  addIdentifier: (projectPath: string, identifier: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:addIdentifier', { projectPath, identifier }),
  deleteIdentifier: (projectPath: string, identifier: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:deleteIdentifier', { projectPath, identifier }),
  getContacts: (projectPath: string, personId: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:contacts', { projectPath, personId }),
  addContact: (projectPath: string, contact: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:addContact', { projectPath, contact }),
  deleteContact: (projectPath: string, contact: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:deleteContact', { projectPath, contact }),
  getRestrictions: (projectPath: string, personId: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:restrictions', { projectPath, personId }),
  addRestriction: (projectPath: string, restriction: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:addRestriction', { projectPath, restriction }),
  deleteRestriction: (projectPath: string, restriction: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:deleteRestriction', { projectPath, restriction }),
  getTags: (projectPath: string): Promise<unknown> => ipcRenderer.invoke('tree:tags', { projectPath }),
  getTagLinks: (projectPath: string, personId: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:tagLinks', { projectPath, personId }),
  addTag: (projectPath: string, tag: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:addTag', { projectPath, tag }),
  attachTag: (projectPath: string, link: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:attachTag', { projectPath, link }),
  detachTag: (projectPath: string, link: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:detachTag', { projectPath, link }),
  getChanges: (projectPath: string, personId: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:changes', { projectPath, personId }),
  getSources: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:sources', { projectPath }),
  addSource: (
    projectPath: string,
    source: unknown,
    targetType?: string,
    targetId?: string,
  ): Promise<unknown> => ipcRenderer.invoke('tree:addSource', { projectPath, source, targetType, targetId }),
  updateSource: (projectPath: string, before: unknown, after: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:updateSource', { projectPath, before, after }),
  deleteSource: (projectPath: string, source: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:deleteSource', { projectPath, source }),
  updateCitation: (projectPath: string, before: unknown, after: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:updateCitation', { projectPath, before, after }),
  getRepositories: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:repositories', { projectPath }),
  getPlaces: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:places', { projectPath }),
  addPlace: (projectPath: string, place: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:addPlace', { projectPath, place }),
  updatePlace: (projectPath: string, before: unknown, after: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:updatePlace', { projectPath, before, after }),
  deletePlace: (projectPath: string, place: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:deletePlace', { projectPath, place }),
  getFactsForPlace: (projectPath: string, placeId: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:factsForPlace', { projectPath, placeId }),
  addRepository: (projectPath: string, repository: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:addRepository', { projectPath, repository }),
  updateRepository: (projectPath: string, before: unknown, after: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:updateRepository', { projectPath, before, after }),
  deleteRepository: (projectPath: string, repository: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:deleteRepository', { projectPath, repository }),
  getSubmitters: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:submitters', { projectPath }),
  addSubmitter: (projectPath: string, submitter: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:addSubmitter', { projectPath, submitter }),
  updateSubmitter: (projectPath: string, before: unknown, after: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:updateSubmitter', { projectPath, before, after }),
  deleteSubmitter: (projectPath: string, submitter: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:deleteSubmitter', { projectPath, submitter }),
  getHeader: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:header', { projectPath }),
  saveHeader: (projectPath: string, header: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:saveHeader', { projectPath, header }),
  addAddress: (projectPath: string, address: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:addAddress', { projectPath, address }),
  updateAddress: (projectPath: string, before: unknown, after: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:updateAddress', { projectPath, before, after }),
  deleteAddress: (projectPath: string, address: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:deleteAddress', { projectPath, address }),
  getAddress: (projectPath: string, id: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:address', { projectPath, id }),
  attachSource: (projectPath: string, sourceId: string, targetType: string, targetId: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:attachSource', { projectPath, sourceId, targetType, targetId }),
  detachCitation: (projectPath: string, citationId: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:detachCitation', { projectPath, citationId }),
  getCitations: (projectPath: string, personId: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:citations', { projectPath, personId }),
  getAllCitations: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:allCitations', { projectPath }),
  getFacts: (projectPath: string, personId?: string, familyId?: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:facts', { projectPath, personId, familyId }),
  getAllFacts: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:allFacts', { projectPath }),
  addFact: (projectPath: string, fact: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:addFact', { projectPath, fact }),
  updateFact: (projectPath: string, before: unknown, after: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:updateFact', { projectPath, before, after }),
  deleteFact: (projectPath: string, fact: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tree:deleteFact', { projectPath, fact }),
  getMedia: (projectPath: string, personId: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:media', { projectPath, personId }),
  getAllMedia: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('tree:allMedia', { projectPath }),
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
  getDoruModelState: (): Promise<unknown> => ipcRenderer.invoke('settings:ai:doruModel:get'),
  downloadDoruModel: (): Promise<unknown> => ipcRenderer.invoke('settings:ai:doruModel:download'),
  cancelDoruModelDownload: (): Promise<unknown> => ipcRenderer.invoke('settings:ai:doruModel:cancel'),
  deleteDoruModel: (): Promise<unknown> => ipcRenderer.invoke('settings:ai:doruModel:delete'),
  onDoruModelState: (callback: (state: unknown) => void): (() => void) => {
    const listener = (_event: unknown, state: unknown) => callback(state);
    ipcRenderer.on('settings:ai:doruModel:changed', listener);
    return () => ipcRenderer.removeListener('settings:ai:doruModel:changed', listener);
  },
};

contextBridge.exposeInMainWorld('doru', api);
