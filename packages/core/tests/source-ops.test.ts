import { describe, expect, it } from 'vitest';
import { addNoteOp, addSourceOp } from '../src/ops/attachments';
import { cleanupRepo, makeRepo } from './helpers';

describe('source and note ops', () => {
  it('adds a source with a citation and undoes it', () => {
    const fixture = makeRepo();
    try {
      const ctx = { repo: fixture.repo };
      const op = addSourceOp(
        { id: 'S1', title: '1923 census' },
        { id: 'C1', sourceId: 'S1', targetType: 'person', targetId: 'P1', createdAt: 1, updatedAt: 1 },
      );
      op.apply(ctx);
      expect(fixture.repo.listSources()).toEqual([{ id: 'S1', title: '1923 census' }]);

      op.inverse(ctx);
      expect(fixture.repo.listSources()).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('writes a note and undoes it', () => {
    const fixture = makeRepo();
    try {
      const ctx = { repo: fixture.repo };
      const op = addNoteOp({ id: 'N1', text: 'Check the archive', targetType: 'person', targetId: 'P1' });
      op.apply(ctx);
      expect(fixture.repo.listNotes()).toHaveLength(1);
      expect(fixture.repo.listNotes()[0]?.text).toBe('Check the archive');

      op.inverse(ctx);
      expect(fixture.repo.listNotes()).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('binds the citation of a source-creation op to the new source', () => {
    const fixture = makeRepo();
    try {
      const op = addSourceOp(
        { id: 'S1', title: '1923 census' },
        { id: 'C1', sourceId: 'S_OTHER', targetType: 'person', targetId: 'P1', createdAt: 1, updatedAt: 1 },
      );
      op.apply({ repo: fixture.repo });
      expect(fixture.repo.getCitation('C1')?.sourceId).toBe('S1');
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('stores one citation text inline', () => {
    const fixture = makeRepo();
    try {
      fixture.repo.insertSource({ id: 'S1', title: 'Parish book' });
      fixture.repo.insertCitation({
        id: 'C1',
        sourceId: 'S1',
        targetType: 'person',
        targetId: 'P1',
        text: 'born 12 March 1923',
      });
      expect(fixture.repo.getCitation('C1')?.text).toBe('born 12 March 1923');

      fixture.repo.updateCitation({ ...fixture.repo.getCitation('C1')!, text: 'born 13 March 1923' });
      expect(fixture.repo.getCitation('C1')?.text).toBe('born 13 March 1923');

      fixture.repo.deleteCitation('C1');
      expect(fixture.repo.getCitation('C1')).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('lists citations for a target and removes them', () => {
    const fixture = makeRepo();
    try {
      fixture.repo.insertSource({ id: 'S1', title: 'Parish book' });
      fixture.repo.addSourceCitation('S1', 'person', 'P1');

      const citations = fixture.repo.listCitationsFor('person', 'P1');
      expect(citations).toHaveLength(1);
      expect(citations[0]?.source.title).toBe('Parish book');

      expect(fixture.repo.deleteCitation(citations[0]?.id ?? '')).toBe(true);
      expect(fixture.repo.listCitationsFor('person', 'P1')).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });
});
