import { describe, expect, it } from 'vitest';
import { addNoteOp, addSourceOp } from '../src/ops/source';
import { cleanupRepo, makeRepo } from './helpers';

describe('source and note ops', () => {
  it('adds a source with a citation and undoes it', () => {
    const fixture = makeRepo();
    try {
      const ctx = { repo: fixture.repo };
      const op = addSourceOp('user', { id: 'S1', title: '1923 census' }, { targetType: 'person', targetId: 'P1' });
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
      const op = addNoteOp('user', { id: 'N1', text: 'Check the archive', targetType: 'person', targetId: 'P1' });
      op.apply(ctx);
      expect(fixture.repo.listNotes()).toHaveLength(1);
      expect(fixture.repo.listNotes()[0]?.text).toBe('Check the archive');

      op.inverse(ctx);
      expect(fixture.repo.listNotes()).toEqual([]);
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
