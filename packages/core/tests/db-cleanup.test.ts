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
      repo.insertCitation({ id: 'C2', sourceId: 'S1', targetType: 'person', targetId: 'P2', date: { quality: 'exact', component: { year: 2026 } } });

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
