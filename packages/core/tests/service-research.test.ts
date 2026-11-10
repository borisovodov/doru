import { describe, expect, it } from 'vitest';
import type {
  AssociationRecord,
  CensusRecord,
  DuplicateCandidateRecord,
  EvidenceRecord,
  OrdinanceRecord,
  ResearchActivityRecord,
  ResearchDocumentRecord,
  TitleRecord,
  TodoRecord,
} from '../src/model/types';
import { OpQueue } from '../src/ops/op';
import { TreeService } from '../src/service/tree';
import { cleanupRepo, makeRepo } from './helpers';

function makeService() {
  const fixture = makeRepo();
  const service = new TreeService(fixture.repo, new OpQueue());
  // Several research records carry foreign keys to persons.
  for (const id of ['P1', 'P2']) {
    fixture.repo.insertPerson({ id, names: [], sex: 'U', facts: [] });
  }
  return { fixture, service };
}

const association = (overrides: Partial<AssociationRecord> = {}): AssociationRecord => ({
  id: 'A1',
  personId: 'P1',
  otherPersonId: 'P2',
  role: 'witness',
  ...overrides,
});

const ordinance = (overrides: Partial<OrdinanceRecord> = {}): OrdinanceRecord => ({
  id: 'O1',
  kind: 'baptism',
  targetType: 'person',
  targetId: 'P1',
  ...overrides,
});

const todo = (overrides: Partial<TodoRecord> = {}): TodoRecord => ({
  id: 'T1',
  text: 'Order the birth record',
  status: 'open',
  ...overrides,
});

const evidence = (overrides: Partial<EvidenceRecord> = {}): EvidenceRecord => ({
  id: 'EV1',
  type: 'birth certificate',
  findings: [{ id: 'F1', type: 'birth date', value: '1923-03-01' }],
  links: [],
  ...overrides,
});

const document = (overrides: Partial<ResearchDocumentRecord> = {}): ResearchDocumentRecord => ({
  id: 'D1',
  title: 'Petrov notes',
  text: 'Notes about the Petrov family.',
  ...overrides,
});

const activity = (overrides: Partial<ResearchActivityRecord> = {}): ResearchActivityRecord => ({
  id: 'RA1',
  type: 'visit',
  purpose: 'check the archive',
  ...overrides,
});

const census = (overrides: Partial<CensusRecord> = {}): CensusRecord => ({
  id: 'C1',
  schedule: 'RG 13',
  entries: [],
  ...overrides,
});

const duplicate = (overrides: Partial<DuplicateCandidateRecord> = {}): DuplicateCandidateRecord => ({
  id: 'DU1',
  personId: 'P1',
  otherPersonId: 'P2',
  ...overrides,
});

const title = (overrides: Partial<TitleRecord> = {}): TitleRecord => ({
  id: 'TL1',
  name: 'The Parish Registers',
  ...overrides,
});

describe('TreeService research layer', () => {
  it('adds, updates, deletes and restores an association', () => {
    const { fixture, service } = makeService();
    try {
      service.addAssociation(association());
      expect(fixture.repo.listAssociations()).toEqual([association()]);
      expect(fixture.repo.listAssociationsFor('P1')).toEqual([association()]);
      expect(fixture.repo.listAssociationsFor('P9')).toEqual([]);

      const after = association({ role: 'godparent', phrase: 'sponsored' });
      service.updateAssociation(association(), after);
      expect(fixture.repo.listAssociations()).toEqual([after]);

      service.deleteAssociation(after);
      expect(fixture.repo.listAssociations()).toEqual([]);

      service.undo();
      expect(fixture.repo.listAssociations()).toEqual([after]);
      service.undo();
      expect(fixture.repo.listAssociations()).toEqual([association()]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('links and unlinks an alias', () => {
    const { fixture, service } = makeService();
    try {
      service.addAlias('P1', 'P2');
      expect(fixture.repo.listAliasesFor('P1')).toEqual([{ id: expect.any(String), aliasId: 'P2' }]);

      const [alias] = fixture.repo.listAliasesFor('P1')!;
      service.deleteAlias(alias!.id, 'P1', 'P2');
      expect(fixture.repo.listAliasesFor('P1')).toEqual([]);

      service.undo();
      expect(fixture.repo.listAliasesFor('P1')).toHaveLength(1);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('adds, updates, deletes and restores an ordinance with its attachments', () => {
    const { fixture, service } = makeService();
    try {
      service.addOrdinance(ordinance());
      expect(fixture.repo.listOrdinances()).toEqual([ordinance()]);
      expect(fixture.repo.listOrdinancesFor('person', 'P1')).toEqual([ordinance()]);
      expect(fixture.repo.listOrdinancesFor('person', 'P9')).toEqual([]);

      service.addNote({ id: 'N1', text: 'baptism entry', targetType: 'ordinance', targetId: 'O1' });
      const after = ordinance({ status: 'completed' });
      service.updateOrdinance(ordinance(), after);
      expect(fixture.repo.listOrdinances()).toEqual([after]);

      service.deleteOrdinance(after);
      expect(fixture.repo.listOrdinances()).toEqual([]);
      expect(fixture.repo.listNotesFor('ordinance', 'O1')).toEqual([]);

      service.undo();
      expect(fixture.repo.listOrdinances()).toEqual([after]);
      expect(fixture.repo.listNotesFor('ordinance', 'O1').map((note) => note.id)).toEqual(['N1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('adds, updates, deletes and restores a todo with its attachments', () => {
    const { fixture, service } = makeService();
    try {
      service.addTodo(todo());
      expect(fixture.repo.listTodos()).toEqual([todo()]);
      expect(fixture.repo.listTodosFor('person', 'P1')).toEqual([]);
      service.addTodo(todo({ id: 'T2', targetType: 'person', targetId: 'P1' }));
      expect(fixture.repo.listTodosFor('person', 'P1')).toEqual([todo({ id: 'T2', targetType: 'person', targetId: 'P1' })]);

      const after = todo({ status: 'done', closedDate: { quality: 'exact' as const, component: { year: 2026 } } });
      service.updateTodo(todo(), after);
      expect(fixture.repo.listTodos().find((entry) => entry.id === 'T1')).toMatchObject(after);

      service.deleteTodo(after);
      expect(fixture.repo.listTodos().find((entry) => entry.id === 'T1')).toBeUndefined();
      service.undo();
      expect(fixture.repo.listTodos().find((entry) => entry.id === 'T1')).toMatchObject(after);

      // Repo-level cascade helper.
      fixture.repo.deleteAttachmentsFor('person', 'P1');
      expect(fixture.repo.listTodosFor('person', 'P1')).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('adds, updates, deletes and restores evidence with links and attachments', () => {
    const { fixture, service } = makeService();
    try {
      service.addEvidence(evidence());
      expect(fixture.repo.getEvidence('EV1')).toEqual(evidence());
      expect(fixture.repo.listEvidence()).toEqual([evidence()]);
      expect(fixture.repo.getEvidence('missing')).toBeUndefined();

      fixture.repo.insertEvidenceLink({ id: 'EL1', evidenceId: 'EV1', targetType: 'person', targetId: 'P1' });
      expect(fixture.repo.listEvidenceLinksFor('person', 'P1').map((link) => link.id)).toEqual(['EL1']);

      service.addNote({ id: 'N1', text: 'see the scan', targetType: 'evidence', targetId: 'EV1' });
      const after = evidence({ analysis: 'checked against the parish copy' });
      service.updateEvidence(evidence(), after);
      expect(fixture.repo.getEvidence('EV1')).toEqual(after);

      service.deleteEvidence(after);
      expect(fixture.repo.getEvidence('EV1')).toBeUndefined();
      expect(fixture.repo.listNotesFor('evidence', 'EV1')).toEqual([]);

      service.undo();
      expect(fixture.repo.getEvidence('EV1')).toEqual(after);
      expect(fixture.repo.listNotesFor('evidence', 'EV1').map((note) => note.id)).toEqual(['N1']);

      fixture.repo.deleteAttachmentsFor('person', 'P1');
      expect(fixture.repo.listEvidenceLinksFor('person', 'P1')).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('adds, updates, deletes and restores a research document', () => {
    const { fixture, service } = makeService();
    try {
      service.addResearchDocument(document());
      expect(fixture.repo.listResearchDocuments()).toEqual([document()]);
      expect(fixture.repo.getResearchDocument('D1')).toEqual(document());
      expect(fixture.repo.getResearchDocument('missing')).toBeUndefined();

      const after = document({ text: 'Rewritten notes.' });
      service.updateResearchDocument(document(), after);
      expect(fixture.repo.getResearchDocument('D1')).toEqual(after);

      service.deleteResearchDocument(after);
      expect(fixture.repo.getResearchDocument('D1')).toBeUndefined();
      service.undo();
      expect(fixture.repo.getResearchDocument('D1')).toEqual(after);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('adds, updates, deletes and restores a research activity', () => {
    const { fixture, service } = makeService();
    try {
      service.addResearchActivity(activity());
      expect(fixture.repo.listResearchActivities()).toEqual([activity()]);

      const after = activity({ result: 'found the entry' });
      service.updateResearchActivity(activity(), after);
      expect(fixture.repo.listResearchActivities()).toEqual([after]);

      service.deleteResearchActivity(after);
      expect(fixture.repo.listResearchActivities()).toEqual([]);
      service.undo();
      expect(fixture.repo.listResearchActivities()).toEqual([after]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('adds, updates, deletes and restores a census with entries', () => {
    const { fixture, service } = makeService();
    try {
      service.addCensus(census());
      expect(fixture.repo.getCensus('C1')).toEqual(census());
      expect(fixture.repo.listCensuses()).toEqual([census()]);
      expect(fixture.repo.getCensus('missing')).toBeUndefined();

      const after = census({
        entries: [{ id: 'CE1', personId: 'P1', ageValue: '17', occupation: 'smith' }],
      });
      service.updateCensus(census(), after);
      expect(fixture.repo.getCensus('C1')).toEqual(after);

      service.deleteCensus(after);
      expect(fixture.repo.getCensus('C1')).toBeUndefined();
      service.undo();
      expect(fixture.repo.getCensus('C1')).toEqual(after);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('adds, updates, deletes and restores a duplicate candidate', () => {
    const { fixture, service } = makeService();
    try {
      service.addDuplicate(duplicate());
      expect(fixture.repo.listDuplicates()).toEqual([duplicate()]);

      const after = duplicate({ status: 'rejected', assessment: 'different lines' });
      service.updateDuplicate(duplicate(), after);
      expect(fixture.repo.listDuplicates()).toEqual([after]);

      service.deleteDuplicate(after);
      expect(fixture.repo.listDuplicates()).toEqual([]);
      service.undo();
      expect(fixture.repo.listDuplicates()).toEqual([after]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('adds, updates, deletes and restores a title', () => {
    const { fixture, service } = makeService();
    try {
      service.addTitle(title());
      expect(fixture.repo.listTitles()).toEqual([title()]);

      const after = title({ author: 'Ivan Petrov' });
      service.updateTitle(title(), after);
      expect(fixture.repo.listTitles()).toEqual([after]);

      service.deleteTitle(after);
      expect(fixture.repo.listTitles()).toEqual([]);
      service.undo();
      expect(fixture.repo.listTitles()).toEqual([after]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('reports the history state and re-applies the last op on redo', () => {
    const { fixture, service } = makeService();
    try {
      expect(service.undo()).toEqual({ canUndo: false, canRedo: false });

      service.addTodo(todo());
      const after = service.addTodo(todo({ id: 'T2' }));
      expect(after).toEqual({ canUndo: true, canRedo: false });

      expect(service.undo()).toEqual({ canUndo: true, canRedo: true });
      expect(fixture.repo.listTodos().map((entry) => entry.id)).toEqual(['T1']);

      expect(service.redo()).toEqual({ canUndo: true, canRedo: false });
      expect(fixture.repo.listTodos().map((entry) => entry.id)).toEqual(['T1', 'T2']);
    } finally {
      cleanupRepo(fixture);
    }
  });
});
