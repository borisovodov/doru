import { ipcMain } from 'electron';
import type {
  AddressRecord,
  AssociationRecord,
  CitationRecord,
  ContactRecord,
  FactRecord,
  FamilyRecord,
  IdentifierRecord,
  MediaRecord,
  NoteRecord,
  PersonRecord,
  NoteLinkRecord,
  PlaceRecord,
  RepositoryRecord,
  RestrictionRecord,
  SourceRecord,
  SubmitterRecord,
  TagLinkRecord,
  TagRecord,
  TitleRecord,
  TodoRecord,
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
    'tree:aliases',
    async (_event, options: { projectPath: string; personId: string }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.listAliasesFor(options.personId);
    },
  );

  ipcMain.handle(
    'tree:addAlias',
    async (_event, options: { projectPath: string; personId: string; aliasId: string }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.addAlias(options.personId, options.aliasId);
    },
  );

  ipcMain.handle(
    'tree:deleteAlias',
    async (_event, options: { projectPath: string; id: string; personId: string; aliasId: string }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.deleteAlias(options.id, options.personId, options.aliasId);
    },
  );

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

  ipcMain.handle(
    'tree:updateNote',
    async (
      _event,
      options: { projectPath: string; before: NoteRecord; after: NoteRecord; context?: NoteLinkRecord },
    ) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.updateNote(options.before, options.after, options.context);
    },
  );

  ipcMain.handle('tree:deleteNote', async (_event, options: { projectPath: string; note: NoteRecord }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.deleteNote(options.note);
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

  ipcMain.handle(
    'tree:updateTag',
    async (_event, options: { projectPath: string; before: TagRecord; after: TagRecord }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.updateTag(options.before, options.after);
    },
  );

  ipcMain.handle('tree:deleteTag', async (_event, options: { projectPath: string; tag: TagRecord }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.deleteTag(options.tag);
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
    'tree:updateSource',
    async (_event, options: { projectPath: string; before: SourceRecord; after: SourceRecord }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.updateSource(options.before, options.after);
    },
  );

  ipcMain.handle('tree:deleteSource', async (_event, options: { projectPath: string; source: SourceRecord }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.deleteSource(options.source);
  });

  ipcMain.handle(
    'tree:updateCitation',
    async (_event, options: { projectPath: string; before: CitationRecord; after: CitationRecord }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.updateCitation(options.before, options.after);
    },
  );

  ipcMain.handle('tree:repositories', async (_event, options: { projectPath: string }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.listRepositories();
  });

  ipcMain.handle('tree:places', async (_event, options: { projectPath: string }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.listPlaces();
  });

  ipcMain.handle('tree:addPlace', async (_event, options: { projectPath: string; place: PlaceRecord }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.addPlace(options.place);
  });

  ipcMain.handle(
    'tree:updatePlace',
    async (_event, options: { projectPath: string; before: PlaceRecord; after: PlaceRecord }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.updatePlace(options.before, options.after);
    },
  );

  ipcMain.handle('tree:deletePlace', async (_event, options: { projectPath: string; place: PlaceRecord }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.deletePlace(options.place);
  });

  ipcMain.handle(
    'tree:factsForPlace',
    async (_event, options: { projectPath: string; placeId: string }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.listFactsForPlace(options.placeId);
    },
  );

  ipcMain.handle(
    'tree:addRepository',
    async (_event, options: { projectPath: string; repository: RepositoryRecord }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.addRepository(options.repository);
    },
  );

  ipcMain.handle(
    'tree:updateRepository',
    async (_event, options: { projectPath: string; before: RepositoryRecord; after: RepositoryRecord }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.updateRepository(options.before, options.after);
    },
  );

  ipcMain.handle(
    'tree:deleteRepository',
    async (_event, options: { projectPath: string; repository: RepositoryRecord }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.deleteRepository(options.repository);
    },
  );

  ipcMain.handle('tree:submitters', async (_event, options: { projectPath: string }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.listSubmitters();
  });

  ipcMain.handle('tree:titles', async (_event, options: { projectPath: string }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.listTitles();
  });

  ipcMain.handle(
    'tree:addTitle',
    async (_event, options: { projectPath: string; title: TitleRecord }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.addTitle(options.title);
    },
  );

  ipcMain.handle(
    'tree:updateTitle',
    async (_event, options: { projectPath: string; before: TitleRecord; after: TitleRecord }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.updateTitle(options.before, options.after);
    },
  );

  ipcMain.handle(
    'tree:deleteTitle',
    async (_event, options: { projectPath: string; title: TitleRecord }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.deleteTitle(options.title);
    },
  );

  ipcMain.handle(
    'tree:addSubmitter',
    async (_event, options: { projectPath: string; submitter: SubmitterRecord }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.addSubmitter(options.submitter);
    },
  );

  ipcMain.handle(
    'tree:updateSubmitter',
    async (_event, options: { projectPath: string; before: SubmitterRecord; after: SubmitterRecord }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.updateSubmitter(options.before, options.after);
    },
  );

  ipcMain.handle(
    'tree:deleteSubmitter',
    async (_event, options: { projectPath: string; submitter: SubmitterRecord }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.deleteSubmitter(options.submitter);
    },
  );

  ipcMain.handle(
    'tree:recordSubmitters',
    async (_event, options: { projectPath: string; targetType: string; targetId: string }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.listRecordSubmittersFor(options.targetType, options.targetId);
    },
  );

  ipcMain.handle(
    'tree:addRecordSubmitter',
    async (_event, options: { projectPath: string; submitterId: string; targetType: string; targetId: string }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.addRecordSubmitter(options.submitterId, options.targetType, options.targetId);
    },
  );

  ipcMain.handle(
    'tree:deleteRecordSubmitter',
    async (_event, options: { projectPath: string; id: string; submitterId: string; targetType: string; targetId: string }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.deleteRecordSubmitter(options.id, options.submitterId, options.targetType, options.targetId);
    },
  );

  ipcMain.handle('tree:addAddress', async (_event, options: { projectPath: string; address: AddressRecord }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.addAddress(options.address);
  });

  ipcMain.handle(
    'tree:updateAddress',
    async (_event, options: { projectPath: string; before: AddressRecord; after: AddressRecord }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.updateAddress(options.before, options.after);
    },
  );

  ipcMain.handle(
    'tree:deleteAddress',
    async (_event, options: { projectPath: string; address: AddressRecord }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.deleteAddress(options.address);
    },
  );

  ipcMain.handle('tree:address', async (_event, options: { projectPath: string; id: string }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.getAddress(options.id);
  });

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
      return runtime.service.listCitationRecordsFor('person', options.personId);
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

  ipcMain.handle('tree:todos', async (_event, options: { projectPath: string }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.listTodos();
  });

  ipcMain.handle('tree:addTodo', async (_event, options: { projectPath: string; todo: TodoRecord }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.addTodo(options.todo);
  });

  ipcMain.handle(
    'tree:updateTodo',
    async (_event, options: { projectPath: string; before: TodoRecord; after: TodoRecord }) => {
      const { runtime } = await ensureRuntime(options.projectPath);
      return runtime.service.updateTodo(options.before, options.after);
    },
  );

  ipcMain.handle('tree:deleteTodo', async (_event, options: { projectPath: string; todo: TodoRecord }) => {
    const { runtime } = await ensureRuntime(options.projectPath);
    return runtime.service.deleteTodo(options.todo);
  });
}
