import { ipcMain } from 'electron';
import type {
  AssociationRecord,
  ContactRecord,
  FactRecord,
  FamilyRecord,
  IdentifierRecord,
  MediaRecord,
  NoteRecord,
  PersonRecord,
  RestrictionRecord,
  SourceRecord,
  TagLinkRecord,
  TagRecord,
} from '@doru/core';
import { addMediaToPerson, listAllMedia, listMediaForPerson, removeMediaFile } from './media';
import { ensureRuntime } from './runtime';

/**
 * The tree IPC surface: thin handlers that forward the renderer's calls to
 * the project's `TreeService`. No domain logic lives here.
 */
export function registerTreeIpc(): void {
  ipcMain.handle(
    'tree:list',
    async (_event, options: { projectPath: string; search?: string; limit?: number; offset?: number }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.listPersons({
        search: options.search,
        limit: options.limit ?? 100,
        offset: options.offset ?? 0,
      });
    },
  );

  ipcMain.handle('tree:all', async (_event, options: { projectPath: string }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return {
      persons: runtime.service.listAllPersons(),
      families: runtime.service.listFamilies(),
    };
  });

  ipcMain.handle('tree:stats', async (_event, options: { projectPath: string }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.stats();
  });

  ipcMain.handle('tree:undo', async (_event, options: { projectPath: string }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.undo();
  });

  ipcMain.handle('tree:redo', async (_event, options: { projectPath: string }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.redo();
  });

  ipcMain.handle('tree:addPerson', async (_event, options: { projectPath: string; person: PersonRecord }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.addPerson(options.person);
  });

  ipcMain.handle(
    'tree:updatePerson',
    async (_event, options: { projectPath: string; before: PersonRecord; after: PersonRecord }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.updatePerson(options.before, options.after);
    },
  );

  ipcMain.handle(
    'tree:deletePerson',
    async (_event, options: { projectPath: string; person: PersonRecord }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.deletePerson(options.person);
    },
  );

  ipcMain.handle(
    'tree:reparent',
    async (_event, options: { projectPath: string; childId: string; newParentId: string }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.reparent(options.childId, options.newParentId);
    },
  );

  ipcMain.handle(
    'tree:addRelative',
    async (
      _event,
      options: {
        projectPath: string;
        relation: 'child' | 'spouse' | 'parent';
        anchorId: string;
        person: PersonRecord;
      },
    ) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.addRelative(options.relation, options.anchorId, options.person);
    },
  );

  ipcMain.handle(
    'tree:notes',
    async (_event, options: { projectPath: string; personId?: string }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      if (!options.personId) {
        return runtime.service.listNotes();
      }
      return runtime.service.listNotesFor('person', options.personId);
    },
  );

  ipcMain.handle(
    'tree:personCounts',
    async (_event, options: { projectPath: string; personIds: string[] }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.personCounts(options.personIds);
    },
  );

  ipcMain.handle('tree:addNote', async (_event, options: { projectPath: string; note: NoteRecord }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.addNote(options.note);
  });

  ipcMain.handle('tree:families', async (_event, options: { projectPath: string }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.listFamilies();
  });

  ipcMain.handle('tree:addFamily', async (_event, options: { projectPath: string; family: FamilyRecord }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.addFamily(options.family);
  });

  ipcMain.handle(
    'tree:updateFamily',
    async (_event, options: { projectPath: string; before: FamilyRecord; after: FamilyRecord }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.updateFamily(options.before, options.after);
    },
  );

  ipcMain.handle('tree:deleteFamily', async (_event, options: { projectPath: string; family: FamilyRecord }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.deleteFamily(options.family);
  });

  ipcMain.handle(
    'tree:associations',
    async (_event, options: { projectPath: string; personId: string }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.listAssociationsFor(options.personId);
    },
  );

  ipcMain.handle(
    'tree:addAssociation',
    async (_event, options: { projectPath: string; association: AssociationRecord }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.addAssociation(options.association);
    },
  );

  ipcMain.handle(
    'tree:updateAssociation',
    async (_event, options: { projectPath: string; before: AssociationRecord; after: AssociationRecord }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.updateAssociation(options.before, options.after);
    },
  );

  ipcMain.handle(
    'tree:deleteAssociation',
    async (_event, options: { projectPath: string; association: AssociationRecord }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.deleteAssociation(options.association);
    },
  );

  ipcMain.handle(
    'tree:identifiers',
    async (_event, options: { projectPath: string; personId: string }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.listIdentifiersFor('person', options.personId);
    },
  );

  ipcMain.handle(
    'tree:addIdentifier',
    async (_event, options: { projectPath: string; identifier: IdentifierRecord }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.addIdentifier(options.identifier);
    },
  );

  ipcMain.handle(
    'tree:deleteIdentifier',
    async (_event, options: { projectPath: string; identifier: IdentifierRecord }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.deleteIdentifier(options.identifier);
    },
  );

  ipcMain.handle(
    'tree:contacts',
    async (_event, options: { projectPath: string; personId: string }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.listContactsFor('person', options.personId);
    },
  );

  ipcMain.handle('tree:addContact', async (_event, options: { projectPath: string; contact: ContactRecord }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.addContact(options.contact);
  });

  ipcMain.handle(
    'tree:deleteContact',
    async (_event, options: { projectPath: string; contact: ContactRecord }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.deleteContact(options.contact);
    },
  );

  ipcMain.handle(
    'tree:restrictions',
    async (_event, options: { projectPath: string; personId: string }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.listRestrictionsFor('person', options.personId);
    },
  );

  ipcMain.handle(
    'tree:addRestriction',
    async (_event, options: { projectPath: string; restriction: RestrictionRecord }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.addRestriction(options.restriction);
    },
  );

  ipcMain.handle(
    'tree:deleteRestriction',
    async (_event, options: { projectPath: string; restriction: RestrictionRecord }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.deleteRestriction(options.restriction);
    },
  );

  ipcMain.handle('tree:tags', async (_event, options: { projectPath: string }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.listTags();
  });

  ipcMain.handle(
    'tree:tagLinks',
    async (_event, options: { projectPath: string; personId: string }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.listTagLinksFor('person', options.personId);
    },
  );

  ipcMain.handle('tree:addTag', async (_event, options: { projectPath: string; tag: TagRecord }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.addTag(options.tag);
  });

  ipcMain.handle('tree:attachTag', async (_event, options: { projectPath: string; link: TagLinkRecord }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.attachTag(options.link);
  });

  ipcMain.handle('tree:detachTag', async (_event, options: { projectPath: string; link: TagLinkRecord }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.detachTag(options.link);
  });

  ipcMain.handle(
    'tree:changes',
    async (_event, options: { projectPath: string; personId: string }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.listChangesFor('person', options.personId);
    },
  );

  ipcMain.handle('tree:sources', async (_event, options: { projectPath: string }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.listSources();
  });

  ipcMain.handle(
    'tree:addSource',
    async (
      _event,
      options: { projectPath: string; source: SourceRecord; targetType?: string; targetId?: string },
    ) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.addSource(options.source, options.targetType, options.targetId);
    },
  );

  ipcMain.handle(
    'tree:attachSource',
    async (_event, options: { projectPath: string; sourceId: string; targetType: string; targetId: string }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.attachSource(options.sourceId, options.targetType, options.targetId);
    },
  );

  ipcMain.handle('tree:detachCitation', async (_event, options: { projectPath: string; citationId: string }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.detachCitation(options.citationId);
  });

  ipcMain.handle(
    'tree:citations',
    async (_event, options: { projectPath: string; personId: string }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.listCitationsFor('person', options.personId);
    },
  );

  ipcMain.handle('tree:allCitations', async (_event, options: { projectPath: string }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.listAllCitations();
  });

  ipcMain.handle(
    'tree:facts',
    async (_event, options: { projectPath: string; personId?: string; familyId?: string }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.listFactsFor(options.personId, options.familyId);
    },
  );

  ipcMain.handle('tree:allFacts', async (_event, options: { projectPath: string }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.listAllFacts();
  });

  ipcMain.handle('tree:addFact', async (_event, options: { projectPath: string; fact: FactRecord }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.addFact(options.fact);
  });

  ipcMain.handle(
    'tree:updateFact',
    async (_event, options: { projectPath: string; before: FactRecord; after: FactRecord }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.updateFact(options.before, options.after);
    },
  );

  ipcMain.handle('tree:deleteFact', async (_event, options: { projectPath: string; fact: FactRecord }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.deleteFact(options.fact);
  });

  ipcMain.handle('tree:media', async (_event, options: { projectPath: string; personId: string }) =>
    listMediaForPerson(options.projectPath, options.personId),
  );

  ipcMain.handle('tree:allMedia', async (_event, options: { projectPath: string }) =>
    listAllMedia(options.projectPath),
  );

  ipcMain.handle('tree:addMedia', async (_event, options: { projectPath: string; personId: string }) =>
    addMediaToPerson(options.projectPath, options.personId),
  );

  ipcMain.handle('tree:deleteMedia', async (_event, options: { projectPath: string; media: MediaRecord }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    const state = runtime.service.deleteMedia(options.media);
    await removeMediaFile(options.projectPath, options.media.path ?? '');
    return state;
  });
}
