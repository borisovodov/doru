import { describe, expect, it } from 'vitest';
import { addFamilyOp } from '../src/ops/family';
import { OpQueue } from '../src/ops/op';
import { cleanupRepo, makeRepo } from './helpers';

describe('db cleanup paths', () => {
  it('deletes change rows with their dates through the cascade', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertChange({
        id: 'CH1',
        targetType: 'person',
        targetId: 'P1',
        kind: 'created',
        date: { quality: 'exact', component: { year: 2026, month: 1, day: 2 } },
      });
      expect(repo.listChangesFor('person', 'P1')).toHaveLength(1);
      repo.deleteAttachmentsFor('person', 'P1');
      expect(repo.listChangesFor('person', 'P1')).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('deletes a note when its last link goes away', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertNote({ id: 'N1', text: 'lone note', targetType: 'person', targetId: 'P1' });
      const [link] = repo.listNotesFor('person', 'P1')[0]!.links ?? [];
      repo.removeNoteLink(link!.id);
      expect(repo.getNote('N1')).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('cleans and restores the attachments of a note that loses its last link', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertNote({ id: 'N1', text: 'linked note', targetType: 'person', targetId: 'P1' });
      repo.insertIdentifier({ id: 'NI1', targetType: 'note', targetId: 'N1', namespace: 'uid', value: 'note-1' });
      const snapshot = repo.listAttachmentsFor('person', 'P1');

      repo.deleteAttachmentsFor('person', 'P1');
      expect(repo.getNote('N1')).toBeUndefined();
      expect(repo.listIdentifiersFor('note', 'N1')).toEqual([]);

      repo.restoreAttachments(snapshot);
      expect(repo.getNote('N1')).toBeDefined();
      expect(repo.listIdentifiersFor('note', 'N1').map((entry) => entry.id)).toEqual(['NI1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores a note whose last link is spread across two deleted targets', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPlace({ id: 'PL1', names: [{ id: 'PN1', kind: 'official', position: 0, value: 'Moscow' }] });
      repo.insertNote({ id: 'N1', text: 'shared note', targetType: 'place', targetId: 'PL1' });
      repo.addNoteLink('N1', { id: 'L2', targetType: 'place_name', targetId: 'PN1' });
      repo.insertIdentifier({ id: 'NI1', targetType: 'note', targetId: 'N1', namespace: 'uid', value: 'note-1' });
      const placeSnapshot = repo.listAttachmentsFor('place', 'PL1');
      const nameSnapshot = repo.listAttachmentsFor('place_name', 'PN1');

      repo.deletePlace('PL1');
      expect(repo.getNote('N1')).toBeUndefined();
      expect(repo.listIdentifiersFor('note', 'N1')).toEqual([]);

      repo.insertPlace({ id: 'PL1', names: [{ id: 'PN1', kind: 'official', position: 0, value: 'Moscow' }] });
      repo.restoreAttachments(placeSnapshot);
      repo.restoreAttachments(nameSnapshot);

      expect(repo.getNote('N1')).toBeDefined();
      expect(repo.listIdentifiersFor('note', 'N1').map((entry) => entry.id)).toEqual(['NI1']);
      expect(repo.listNotesFor('place', 'PL1').map((entry) => entry.id)).toEqual(['N1']);
      expect(repo.listNotesFor('place_name', 'PN1').map((entry) => entry.id)).toEqual(['N1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores only the links the operation removed', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertNote({ id: 'N1', text: 'shared note', targetType: 'person', targetId: 'P1' });
      repo.addNoteLink('N1', { id: 'L2', targetType: 'person', targetId: 'P2' });
      repo.insertIdentifier({ id: 'NI1', targetType: 'note', targetId: 'N1', namespace: 'uid', value: 'note-1' });
      const snapshot = repo.listAttachmentsFor('person', 'P1');

      repo.deleteAttachmentsFor('person', 'P1');
      // Another writer independently removes the remaining link.
      repo.deleteAttachmentsFor('person', 'P2');

      repo.restoreAttachments(snapshot);
      expect(repo.getNote('N1')).toBeDefined();
      expect(repo.listIdentifiersFor('note', 'N1').map((entry) => entry.id)).toEqual(['NI1']);
      expect(repo.listNotesFor('person', 'P1').map((entry) => entry.id)).toEqual(['N1']);
      expect(repo.listNotesFor('person', 'P2')).toEqual([]);
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
      repo.insertIdentifier({ id: 'MI1', targetType: 'media', targetId: 'M1', namespace: 'uid', value: 'm1' });
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
      expect(repo.listIdentifiersFor('media', 'M1')).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('does not recreate a note another writer deleted afterwards', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      repo.insertPerson({ id: 'P2', names: [], sex: 'U', facts: [] });
      repo.insertNote({ id: 'N1', text: 'shared', targetType: 'person', targetId: 'P1' });
      repo.addNoteLink('N1', { id: 'L2', targetType: 'person', targetId: 'P2' });
      let snapshot = repo.listAttachmentsFor('person', 'P1');
      repo.transaction(() => {
        snapshot = repo.listAttachmentsFor('person', 'P1');
        repo.deleteAttachmentsFor('person', 'P1');
      });
      expect(repo.getNote('N1')).toBeDefined();

      repo.deleteAttachmentsFor('person', 'P2');
      repo.restoreAttachments(snapshot);
      expect(repo.getNote('N1')).toBeUndefined();
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
      expect(repo.getMedia('M1')).toBeUndefined();

      repo.restoreAttachments(snapshot);
      expect(repo.getMedia('M1')).toBeDefined();
      expect(repo.listMediaFor('person', 'P1').map((entry) => entry.id)).toEqual(['M1']);
      expect(repo.listMediaFor('person', 'P2')).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps note attachments while another link survives', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertNote({ id: 'N1', text: 'shared note', targetType: 'person', targetId: 'P1' });
      repo.addNoteLink('N1', { id: 'L2', targetType: 'person', targetId: 'P2' });
      repo.insertIdentifier({ id: 'NI1', targetType: 'note', targetId: 'N1', namespace: 'uid', value: 'note-1' });

      repo.deleteAttachmentsFor('person', 'P1');
      expect(repo.getNote('N1')).toBeDefined();
      expect(repo.listIdentifiersFor('note', 'N1').map((entry) => entry.id)).toEqual(['NI1']);
      expect(repo.listNotesFor('person', 'P1')).toEqual([]);
      expect(repo.listNotesFor('person', 'P2').map((entry) => entry.id)).toEqual(['N1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('rejects updating a media record that no longer exists', () => {
    const fixture = makeRepo();
    try {
      expect(() => fixture.repo.updateMedia({ id: 'M404', title: 'Gone' })).toThrow(/no longer exists/);
      expect(fixture.repo.getMedia('M404')).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('does not leak a date when a stale update targets a deleted todo', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertTodo({ id: 'T1', text: 'Task' });
      repo.deleteTodo('T1');

      expect(() =>
        repo.updateTodo({
          id: 'T1',
          text: 'Edited',
          createdDate: { quality: 'exact', component: { year: 2026, month: 1, day: 2 } },
        }),
      ).toThrow(/no longer exists/);
      const { n } = fixture.store.db.prepare('SELECT COUNT(*) AS n FROM date').get() as { n: number };
      expect(n).toBe(0);
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
        periodStart: { quality: 'exact', component: { year: 1920 } },
        periodEnd: { quality: 'exact', component: { year: 1930 } },
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

  it('replaces and deletes tag-link dates', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertTag({ id: 'T1', name: 'favorites' });
      repo.insertTagLink({
        id: 'TL1',
        tagId: 'T1',
        targetType: 'person',
        targetId: 'P1',
        date: { quality: 'exact', component: { year: 1920 } },
      });
      repo.updateTagLink({
        id: 'TL1',
        tagId: 'T1',
        targetType: 'person',
        targetId: 'P1',
        date: { quality: 'exact', component: { year: 1921 } },
      });
      expect((fixture.store.db.prepare('SELECT COUNT(*) AS n FROM date').get() as { n: number }).n).toBe(1);
      repo.deleteTagLink('TL1');
      expect((fixture.store.db.prepare('SELECT COUNT(*) AS n FROM date').get() as { n: number }).n).toBe(0);
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
