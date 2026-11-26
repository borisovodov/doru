import { describe, expect, it } from 'vitest';
import { addFamilyOp } from '../src/ops/family';
import { OpQueue } from '../src/ops/op';
import { cleanupRepo, makeRepo } from './helpers';

describe('db cleanup paths', () => {
  it('restores media evidence for a snapshot captured outside a transaction', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      repo.insertMedia({
        id: 'M1',
        path: 'media/a.jpg',
        targetType: 'person',
        targetId: 'P1',
      });
      repo.insertNote({ id: 'N1', text: 'media note', targetType: 'media', targetId: 'M1' });
      const snapshot = repo.listAttachmentsFor('person', 'P1');
      repo.deleteAttachmentsFor('media', 'M1');
      expect(repo.listAttachmentsFor('media', 'M1').notes).toEqual([]);

      repo.restoreAttachments(snapshot);
      expect(repo.listAttachmentsFor('media', 'M1').notes.map((note) => note.id)).toEqual(['N1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('deletes and restores a note with its target', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      repo.insertNote({ id: 'N1', text: 'note', targetType: 'person', targetId: 'P1' });
      const snapshot = repo.listAttachmentsFor('person', 'P1');

      repo.deleteAttachmentsFor('person', 'P1');
      expect(repo.getNote('N1')).toBeUndefined();

      repo.restoreAttachments(snapshot);
      expect(repo.getNote('N1')).toMatchObject({ id: 'N1', targetType: 'person', targetId: 'P1' });
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores each target note independently after a place cascade', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPlace({ id: 'PL1', names: [{ id: 'PN1', kind: 'official', position: 0, value: 'Moscow' }] });
      repo.insertNote({ id: 'N1', text: 'place note', targetType: 'place', targetId: 'PL1' });
      repo.insertNote({ id: 'N2', text: 'name note', targetType: 'place_name', targetId: 'PN1' });
      const placeSnapshot = repo.listAttachmentsFor('place', 'PL1');
      const nameSnapshot = repo.listAttachmentsFor('place_name', 'PN1');

      repo.deletePlace('PL1');
      expect(repo.getNote('N1')).toBeUndefined();
      expect(repo.getNote('N2')).toBeUndefined();

      repo.insertPlace({ id: 'PL1', names: [{ id: 'PN1', kind: 'official', position: 0, value: 'Moscow' }] });
      repo.restoreAttachments(placeSnapshot);
      repo.restoreAttachments(nameSnapshot);

      expect(repo.listNotesFor('place', 'PL1').map((note) => note.text)).toEqual(['place note']);
      expect(repo.listNotesFor('place_name', 'PN1').map((note) => note.text)).toEqual(['name note']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores only the notes the operation removed', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      repo.insertPerson({ id: 'P2', names: [], sex: 'U', facts: [] });
      repo.insertNote({ id: 'N1', text: 'first', targetType: 'person', targetId: 'P1' });
      repo.insertNote({ id: 'N2', text: 'second', targetType: 'person', targetId: 'P2' });
      const snapshot = repo.listAttachmentsFor('person', 'P1');

      repo.deleteAttachmentsFor('person', 'P1');
      repo.deleteAttachmentsFor('person', 'P2');

      repo.restoreAttachments(snapshot);
      expect(repo.listNotesFor('person', 'P1').map((note) => note.id)).toEqual(['N1']);
      expect(repo.listNotesFor('person', 'P2')).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('leaves another target note untouched when one target is deleted', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      repo.insertPerson({ id: 'P2', names: [], sex: 'U', facts: [] });
      repo.insertNote({ id: 'N1', text: 'first', targetType: 'person', targetId: 'P1' });
      repo.insertNote({ id: 'N2', text: 'second', targetType: 'person', targetId: 'P2' });

      repo.deleteAttachmentsFor('person', 'P1');
      expect(repo.listNotesFor('person', 'P1')).toEqual([]);
      expect(repo.listNotesFor('person', 'P2').map((note) => note.id)).toEqual(['N2']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('does not recreate a media record another writer deleted afterwards', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      repo.insertPerson({ id: 'P2', names: [], sex: 'U', facts: [] });
      repo.insertMedia({ id: 'M1', path: 'media/a.jpg', targetType: 'person', targetId: 'P1' });
      repo.addMediaLink('M1', { id: 'L2', mediaId: 'M1', targetType: 'person', targetId: 'P2' });
      let snapshot = repo.listAttachmentsFor('person', 'P1');
      repo.transaction(() => {
        snapshot = repo.listAttachmentsFor('person', 'P1');
        repo.deleteAttachmentsFor('person', 'P1');
      });
      expect(repo.getMedia('M1')).toBeDefined();

      // Another writer deletes the media record and its evidence.
      repo.deleteMedia('M1');
      repo.restoreAttachments(snapshot);
      expect(repo.getMedia('M1')).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores only the media links the operation removed', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertMedia({ id: 'M1', path: 'media/a.jpg', targetType: 'person', targetId: 'P1' });
      repo.addMediaLink('M1', { id: 'L2', mediaId: 'M1', targetType: 'person', targetId: 'P2' });
      const snapshot = repo.listAttachmentsFor('person', 'P1');

      repo.deleteAttachmentsFor('person', 'P1');
      repo.deleteAttachmentsFor('person', 'P2');
      // The shared media record survives losing every link.
      expect(repo.getMedia('M1')?.links).toEqual([]);

      repo.restoreAttachments(snapshot);
      expect(repo.getMedia('M1')).toBeDefined();
      expect(repo.listMediaFor('person', 'P1').map((entry) => entry.id)).toEqual(['M1']);
      expect(repo.listMediaFor('person', 'P2')).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('rejects updating a media record that no longer exists', () => {
    const fixture = makeRepo();
    try {
      expect(() => fixture.repo.updateMedia({ id: 'M404', path: 'media/gone.jpg', title: 'Gone' })).toThrow(
        /no longer exists/,
      );
      expect(fixture.repo.getMedia('M404')).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('rejects an update for a deleted task', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertTask({ id: 'T1', text: 'Task', targets: [] });
      repo.deleteTask('T1');

      expect(() => repo.updateTask({ id: 'T1', text: 'Edited', targets: [], createdAt: 1 })).toThrow(
        /no longer exists/,
      );
      expect(repo.listTasks()).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('deletes sources and citations together with their date rows', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertSource({ id: 'S1', title: 'Book', pubDate: { quality: 'exact', component: { year: 1920 } } });
      repo.insertCitation({
        id: 'C1',
        sourceId: 'S1',
        targetType: 'person',
        targetId: 'P1',
        date: { quality: 'exact', component: { year: 2025 } },
      });
      repo.insertCitation({
        id: 'C2',
        sourceId: 'S1',
        targetType: 'person',
        targetId: 'P2',
        date: { quality: 'exact', component: { year: 2026 } },
      });

      // Cascade over a target deletes its citations with their dates.
      repo.deleteAttachmentsFor('person', 'P2');
      expect(repo.listCitationRecordsFor('person', 'P2')).toEqual([]);

      // Deleting one citation cleans its date row.
      repo.deleteCitation('C1');
      expect(repo.listCitationRecordsFor('person', 'P1')).toEqual([]);

      // Deleting the source cleans the publication date row.
      repo.deleteSource('S1');
      expect(repo.listSources()).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });
});

describe('date cleanup on delete/update', () => {
  it('deletes name and association dates with the person', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPerson({
        id: 'P1',
        names: [
          {
            id: 'N1',
            given: 'Ivan',
            date: { quality: 'exact', component: { year: 1900 } },
          },
        ],
        sex: 'M',
        facts: [],
      });
      repo.insertPerson({ id: 'P2', names: [], sex: 'F', facts: [] });
      repo.insertAssociation({
        id: 'A1',
        personId: 'P1',
        otherPersonId: 'P2',
        period: { quality: 'range', component: { year: 1920 }, end: { year: 1930 } },
      });
      repo.deletePerson('P1');
      const count = (fixture.store.db.prepare('SELECT COUNT(*) AS n FROM date').get() as { n: number }).n;
      expect(count).toBe(0);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('deletes postal-code dates with the place', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPlace({
        id: 'PL1',
        names: [{ id: 'PN1', kind: 'official', position: 0, value: 'Moscow' }],
        postalCodes: [{ id: 'PC1', code: '101000', date: { quality: 'exact', component: { year: 1920 } } }],
      });
      repo.deletePlace('PL1');
      const count = (fixture.store.db.prepare('SELECT COUNT(*) AS n FROM date').get() as { n: number }).n;
      expect(count).toBe(0);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('replaces source event dates instead of leaking the old row', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertSource({
        id: 'S1',
        title: 'Book',
        dataEvents: [{ id: 'E1', tag: 'CENS', date: { quality: 'exact', component: { year: 1900 } } }],
      });
      repo.updateSource({
        id: 'S1',
        title: 'Book',
        dataEvents: [{ id: 'E1', tag: 'CENS', date: { quality: 'exact', component: { year: 1901 } } }],
      });
      const count = (fixture.store.db.prepare('SELECT COUNT(*) AS n FROM date').get() as { n: number }).n;
      expect(count).toBe(1);
    } finally {
      cleanupRepo(fixture);
    }
  });
});

describe('op queue edges', () => {
  it('redo on an empty stack is undefined', () => {
    const queue = new OpQueue();
    expect(queue.redo({ repo: undefined as never })).toBeUndefined();
  });

  it('the family op inverse removes the family', () => {
    const fixture = makeRepo();
    try {
      const ctx = { repo: fixture.repo };
      const op = addFamilyOp({ id: 'F1', partners: [], children: [] });
      op.apply(ctx);
      expect(fixture.repo.getFamily('F1')).toBeDefined();
      op.inverse(ctx);
      expect(fixture.repo.getFamily('F1')).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });
});
