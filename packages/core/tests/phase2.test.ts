import { describe, expect, it } from 'vitest';
import type { NoteRecord, PersonRecord } from '../src/model/types';
import { OpQueue, TreeService } from '../src';
import { cleanupRepo, flatPerson, makeRepo } from './helpers';

function person(id: string): PersonRecord {
  return { id, sex: 'U', names: [], facts: [] };
}

function service(fixture: ReturnType<typeof makeRepo>): TreeService {
  return new TreeService(fixture.repo, new OpQueue());
}

describe('Phase 2: notes', () => {
  it('splits a shared note when edited from one of its contexts', () => {
    const fixture = makeRepo();
    try {
      const svc = service(fixture);
      const repo = fixture.repo;
      repo.insertPerson(person('P1'));
      repo.insertPerson(person('P2'));

      const shared: NoteRecord = {
        id: 'N1',
        text: 'shared text',
        links: [
          { id: 'L1', targetType: 'person', targetId: 'P1' },
          { id: 'L2', targetType: 'person', targetId: 'P2' },
        ],
      };
      repo.insertNote(shared);

      // Editing from P1's context must not rewrite the shared text.
      svc.updateNote(repo.getNote('N1')!, { id: 'N1', text: 'only for P1' }, { id: 'L1', targetType: 'person', targetId: 'P1' });

      const p1Notes = repo.listNotesFor('person', 'P1');
      const p2Notes = repo.listNotesFor('person', 'P2');
      expect(p1Notes.map((note) => note.text)).toEqual(['only for P1']);
      expect(p2Notes.map((note) => note.text)).toEqual(['shared text']);
      expect(repo.getNote('N1')?.text).toBe('shared text');

      // One undo step returns the single shared note everywhere.
      svc.undo();
      expect(repo.listNotesFor('person', 'P1').map((note) => note.text)).toEqual(['shared text']);
      expect(repo.listNotesFor('person', 'P2').map((note) => note.text)).toEqual(['shared text']);
      expect(repo.listNotes()).toHaveLength(1);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('updates a single-context note in place', () => {
    const fixture = makeRepo();
    try {
      const svc = service(fixture);
      const repo = fixture.repo;
      repo.insertPerson(person('P1'));
      repo.insertNote({ id: 'N1', text: 'old', targetType: 'person', targetId: 'P1' });

      svc.updateNote(repo.getNote('N1')!, { id: 'N1', text: 'new' }, { id: 'L1', targetType: 'person', targetId: 'P1' });
      expect(repo.getNote('N1')?.text).toBe('new');
      expect(repo.listNotes()).toHaveLength(1);
    } finally {
      cleanupRepo(fixture);
    }
  });
});

describe('Phase 2: attachments cascade and undo', () => {
  it('deletes a person with every attachment and restores all of it on undo', () => {
    const fixture = makeRepo();
    try {
      const svc = service(fixture);
      const repo = fixture.repo;
      const ivan: PersonRecord = { id: 'P1', sex: 'M', names: [{ id: 'N1', given: 'Ivan', surname: 'Ivanov' }], facts: [] };
      repo.insertPerson(ivan);
      repo.insertSource({ id: 'S1', title: 'Parish register' });
      svc.attachSource('S1', 'person', 'P1');
      svc.addNote({ id: 'N1', text: 'check archive', targetType: 'person', targetId: 'P1' });
      svc.addIdentifier({ id: 'ID1', targetType: 'person', targetId: 'P1', namespace: 'uid', value: 'abc-123' });
      svc.addContact({ id: 'C1', targetType: 'person', targetId: 'P1', kind: 'email', value: 'i@example.org' });
      svc.addTag({ id: 'T1', name: 'reviewed' });
      svc.attachTag({ id: 'TL1', tagId: 'T1', targetType: 'person', targetId: 'P1' });

      svc.deletePerson(ivan);
      expect(repo.getPerson('P1')).toBeUndefined();
      expect(repo.listNotesFor('person', 'P1')).toEqual([]);
      expect(repo.listCitationsFor('person', 'P1')).toEqual([]);
      expect(repo.listIdentifiersFor('person', 'P1')).toEqual([]);
      expect(repo.listContactsFor('person', 'P1')).toEqual([]);
      expect(repo.listTagLinksFor('person', 'P1')).toEqual([]);
      // The shared source and tag survive; only the links are gone.
      expect(repo.listSources()).toHaveLength(1);
      expect(repo.listTags()).toHaveLength(1);

      svc.undo();
      expect(flatPerson(repo.getPerson('P1')!)).toEqual(ivan);
      expect(repo.listNotesFor('person', 'P1').map((note) => note.text)).toEqual(['check archive']);
      expect(repo.listCitationsFor('person', 'P1')).toHaveLength(1);
      expect(repo.listIdentifiersFor('person', 'P1').map((entry) => entry.value)).toEqual(['abc-123']);
      expect(repo.listContactsFor('person', 'P1').map((entry) => entry.value)).toEqual(['i@example.org']);
      expect(repo.listTagLinksFor('person', 'P1')).toHaveLength(1);
    } finally {
      cleanupRepo(fixture);
    }
  });
});

describe('Phase 2: change log', () => {
  it('records created/changed rows and forgets them with the entity', () => {
    const fixture = makeRepo();
    try {
      const svc = service(fixture);
      const repo = fixture.repo;
      const p = person('P1');
      svc.addPerson(p);
      expect(repo.listChangesFor('person', 'P1').map((change) => change.kind)).toEqual(['created']);

      svc.updatePerson(p, { ...p, names: [{ id: 'N1', given: 'Ivan' }] });
      expect(repo.listChangesFor('person', 'P1').map((change) => change.kind).sort()).toEqual(['changed', 'created']);

      // Deleting the person removes its history; undo restores it.
      const before = repo.listChangesFor('person', 'P1');
      svc.deletePerson(repo.getPerson('P1')!);
      expect(repo.listChangesFor('person', 'P1')).toEqual([]);

      svc.undo();
      // Undo restores the entity and its old history, then records its own
      // 'changed' row — the history is honest.
      expect(repo.listChangesFor('person', 'P1').map((change) => change.kind).sort()).toEqual([
        'changed',
        ...before.map((change) => change.kind),
      ].sort());
    } finally {
      cleanupRepo(fixture);
    }
  });
});

describe('Phase 2: fact details', () => {
  it('round-trips ages, participants and flags', () => {
    const fixture = makeRepo();
    try {
      const repo = fixture.repo;
      repo.insertPerson({
        id: 'P1',
        sex: 'F',
        names: [],
        facts: [
          {
            id: 'F1',
            personId: 'P1',
            tag: 'BIRT',
            date: { quality: 'exact', component: { year: 1900 } },
            ages: [{ id: 'A1', years: 0, bound: '<' }],
            participants: [{ id: 'W1', value: 'Dr. Smith', role: 'WITN', position: 0 }],
            flags: ['preferred'],
          },
        ],
      });

      const fact = repo.listFactsForPerson('P1')[0]!;
      expect(fact.ages).toEqual([{ id: 'A1', years: 0, bound: '<' }]);
      expect(fact.participants).toEqual([{ id: 'W1', value: 'Dr. Smith', role: 'WITN', position: 0 }]);
      expect(fact.flags).toEqual(['preferred']);

      // Facts without details hydrate without the fields.
      repo.updatePerson({ id: 'P1', sex: 'F', names: [], facts: [{ id: 'F2', personId: 'P1', tag: 'OCCU', value: 'Nurse' }] });
      expect(repo.listFactsForPerson('P1')[0]).toEqual(
        expect.objectContaining({ id: 'F2', tag: 'OCCU', value: 'Nurse' }),
      );
    } finally {
      cleanupRepo(fixture);
    }
  });
});

describe('Phase 2: sources and media', () => {
  it('round-trips a full source with texts, data events, repositories and templates', () => {
    const fixture = makeRepo();
    try {
      const repo = fixture.repo;
      repo.insertRepository({ id: 'R1', name: 'State archive' });
      repo.insertSource({
        id: 'S1',
        title: 'Parish register',
        author: 'Church',
        medium: 'book',
        texts: [{ id: 'T1', text: 'transcript', mime: 'text/plain' }],
        dataEvents: [{ id: 'E1', tag: 'CENS', date: { quality: 'exact', component: { year: 1897 } } }],
        repositories: [{ id: 'SR1', repositoryId: 'R1', callNumbers: [{ id: 'C1', value: 'F-123', medium: 'film' }] }],
        templateFields: [{ id: 'F1', name: 'Collection', value: 'Books' }],
      });

      const read = repo.getSource('S1')!;
      expect(read.title).toBe('Parish register');
      expect(read.texts).toEqual([{ id: 'T1', text: 'transcript', mime: 'text/plain' }]);
      expect(read.dataEvents).toEqual([
        { id: 'E1', tag: 'CENS', date: { id: expect.any(String), quality: 'exact', component: { year: 1897 } } },
      ]);
      expect(read.repositories?.[0]?.repositoryId).toBe('R1');
      expect(read.repositories?.[0]?.callNumbers).toEqual([{ id: 'C1', value: 'F-123', medium: 'film' }]);
      expect(read.templateFields).toEqual([{ id: 'F1', name: 'Collection', value: 'Books' }]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('deletes a media record left without links', () => {
    const fixture = makeRepo();
    try {
      const repo = fixture.repo;
      repo.insertPerson(person('P1'));
      repo.insertMedia({
        id: 'M1',
        files: [{ id: 'F1', path: 'media/a.jpg' }],
        links: [{ id: 'L1', mediaId: 'M1', targetType: 'person', targetId: 'P1' }],
      });

      repo.removeMediaLink('L1');
      // The link removal leaves the record with no links: the cascade removes it.
      expect(repo.listMediaFor('person', 'P1')).toEqual([]);
      expect(repo.getMedia('M1')).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });
});
