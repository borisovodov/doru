import { ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';
import {
  addEventOp,
  addFamilyOp,
  addNoteOp,
  addPersonOp,
  addSourceOp,
  attachCitationOp,
  deleteEventOp,
  deleteFamilyOp,
  deleteMediaOp,
  detachCitationOp,
  updateFamilyOp,
  updatePersonOp,
  type EventRecord,
  type FamilyRecord,
  type MediaRecord,
  type NoteRecord,
  type PersonRecord,
  type SourceRecord,
} from '@doru/core';
import { gedcomText } from './gedcom';
import { addMediaToPerson, listMediaForPerson } from './media';
import { ensureRuntime } from './runtime';

export function registerTreeIpc(): void {
  ipcMain.handle(
    'tree:list',
    async (_event, options: { projectPath: string; search?: string; limit?: number; offset?: number }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.repo.listPersons({
        search: options.search,
        limit: options.limit ?? 100,
        offset: options.offset ?? 0,
      });
    },
  );

  ipcMain.handle('tree:stats', async (_event, options: { projectPath: string }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return { persons: runtime.repo.countPersons(), families: runtime.repo.countFamilies() };
  });

  ipcMain.handle('tree:undoState', async (_event, options: { projectPath: string }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
  });

  ipcMain.handle('tree:undo', async (_event, options: { projectPath: string }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    runtime.queue.undo({ repo: runtime.repo });
    return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
  });

  ipcMain.handle('tree:redo', async (_event, options: { projectPath: string }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    runtime.queue.redo({ repo: runtime.repo });
    return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
  });

  ipcMain.handle('tree:addPerson', async (_event, options: { projectPath: string; person: PersonRecord }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    runtime.queue.apply(addPersonOp(options.person), { repo: runtime.repo });
    return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
  });

  ipcMain.handle(
    'tree:updatePerson',
    async (_event, options: { projectPath: string; before: PersonRecord; after: PersonRecord }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      runtime.queue.apply(updatePersonOp(options.before, options.after), { repo: runtime.repo });
      return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
    },
  );

  ipcMain.handle(
    'tree:notes',
    async (_event, options: { projectPath: string; personId?: string }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      const notes = runtime.repo.listNotes();
      if (!options.personId) {
        return notes;
      }
      return notes.filter(
        (note) => note.targetType === 'person' && note.targetId === options.personId,
      );
    },
  );

  ipcMain.handle('tree:addNote', async (_event, options: { projectPath: string; note: NoteRecord }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    runtime.queue.apply(addNoteOp(options.note), { repo: runtime.repo });
    return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
  });

  ipcMain.handle('tree:families', async (_event, options: { projectPath: string }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.repo.listFamilies();
  });

  ipcMain.handle('tree:addFamily', async (_event, options: { projectPath: string; family: FamilyRecord }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    runtime.queue.apply(addFamilyOp(options.family), { repo: runtime.repo });
    return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
  });

  ipcMain.handle(
    'tree:updateFamily',
    async (_event, options: { projectPath: string; before: FamilyRecord; after: FamilyRecord }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      runtime.queue.apply(updateFamilyOp(options.before, options.after), { repo: runtime.repo });
      return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
    },
  );

  ipcMain.handle('tree:deleteFamily', async (_event, options: { projectPath: string; family: FamilyRecord }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    runtime.queue.apply(deleteFamilyOp(options.family), { repo: runtime.repo });
    return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
  });

  ipcMain.handle('tree:sources', async (_event, options: { projectPath: string }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.repo.listSources();
  });

  ipcMain.handle(
    'tree:addSource',
    async (
      _event,
      options: { projectPath: string; source: SourceRecord; targetType?: string; targetId?: string },
    ) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      const citation =
        options.targetType && options.targetId
          ? { targetType: options.targetType, targetId: options.targetId }
          : undefined;
      runtime.queue.apply(addSourceOp(options.source, citation), { repo: runtime.repo });
      return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
    },
  );

  ipcMain.handle(
    'tree:attachSource',
    async (_event, options: { projectPath: string; sourceId: string; targetType: string; targetId: string }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      runtime.queue.apply(
        attachCitationOp({
          id: randomUUID(),
          sourceId: options.sourceId,
          targetType: options.targetType,
          targetId: options.targetId,
        }),
        { repo: runtime.repo },
      );
      return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
    },
  );

  ipcMain.handle('tree:detachCitation', async (_event, options: { projectPath: string; citationId: string }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    const citation = runtime.repo.getCitation(options.citationId);
    if (citation) {
      runtime.queue.apply(detachCitationOp(citation), { repo: runtime.repo });
    }
    return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
  });

  ipcMain.handle(
    'tree:citations',
    async (_event, options: { projectPath: string; personId: string }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.repo.listCitationsFor('person', options.personId);
    },
  );

  ipcMain.handle(
    'tree:events',
    async (_event, options: { projectPath: string; personId?: string; familyId?: string }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      if (options.personId) {
        return runtime.repo.listEventsForPerson(options.personId);
      }
      if (options.familyId) {
        return runtime.repo.listEventsForFamily(options.familyId);
      }
      return [];
    },
  );

  ipcMain.handle('tree:addEvent', async (_event, options: { projectPath: string; event: EventRecord }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    runtime.queue.apply(addEventOp(options.event), { repo: runtime.repo });
    return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
  });

  ipcMain.handle('tree:deleteEvent', async (_event, options: { projectPath: string; event: EventRecord }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    runtime.queue.apply(deleteEventOp(options.event), { repo: runtime.repo });
    return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
  });

  ipcMain.handle('tree:media', async (_event, options: { projectPath: string; personId: string }) =>
    listMediaForPerson(options.projectPath, options.personId),
  );

  ipcMain.handle('tree:addMedia', async (_event, options: { projectPath: string; personId: string }) =>
    addMediaToPerson(options.projectPath, options.personId),
  );

  ipcMain.handle('tree:deleteMedia', async (_event, options: { projectPath: string; media: MediaRecord }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    runtime.queue.apply(deleteMediaOp(options.media), { repo: runtime.repo });
    return { canUndo: runtime.queue.canUndo(), canRedo: runtime.queue.canRedo() };
  });

  ipcMain.handle('tree:gedcomText', async (_event, options: { projectPath: string }) =>
    gedcomText(options.projectPath),
  );
}
