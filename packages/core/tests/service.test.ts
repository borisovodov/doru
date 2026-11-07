import { describe, expect, it } from 'vitest';
import { OpQueue } from '../src/ops/op';
import { TreeService } from '../src/service/tree';
import type { PersonRecord } from '../src/model/types';
import { cleanupRepo, makeRepo } from './helpers';

const person = (id: string, sex: PersonRecord['sex'] = 'U'): PersonRecord => ({
  id,
  names: [],
  sex,
  facts: [],
});

function makeService() {
  const fixture = makeRepo();
  const service = new TreeService(fixture.repo, new OpQueue());
  return { fixture, service };
}

describe('TreeService', () => {
  it('adds a relative as a child of the anchor’s existing family', () => {
    const { fixture, service } = makeService();
    try {
      service.addPerson(person('P1', 'M'));
      service.addFamily({ id: 'F1', partners: ['P1'], children: [] });

      const state = service.addRelative('child', 'P1', person('K1'));
      expect(state.canUndo).toBe(true);
      expect(fixture.repo.getFamily('F1')?.children).toEqual(['K1']);

      const undone = service.undo();
      expect(undone.canUndo).toBe(true);
      expect(fixture.repo.getPerson('K1')).toBeUndefined();
      expect(fixture.repo.getFamily('F1')?.children).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('adds a spouse creating a new family when the anchor has none', () => {
    const { fixture, service } = makeService();
    try {
      service.addPerson(person('P1', 'M'));

      service.addRelative('spouse', 'P1', person('S1', 'F'));
      const families = service.listFamilies();
      expect(families).toHaveLength(1);
      expect(families[0]?.partners).toEqual(['P1', 'S1']);

      service.undo();
      expect(service.listFamilies()).toEqual([]);
      expect(service.getPerson('S1')).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('adds a parent with the anchor as the child of a new family', () => {
    const { fixture, service } = makeService();
    try {
      service.addPerson(person('K1'));

      service.addRelative('parent', 'K1', person('F1', 'M'));
      const families = service.listFamilies();
      expect(families).toHaveLength(1);
      expect(families[0]?.partners).toEqual(['F1']);
      expect(families[0]?.children).toEqual(['K1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('reparents a child between families and restores both on undo', () => {
    const { fixture, service } = makeService();
    try {
      for (const id of ['A', 'B', 'K']) {
        service.addPerson(person(id));
      }
      service.addFamily({ id: 'F1', partners: ['A'], children: ['K'] });
      service.addFamily({ id: 'F2', partners: ['B'], children: [] });

      service.reparent('K', 'B');
      expect(fixture.repo.getFamily('F1')?.children).toEqual([]);
      expect(fixture.repo.getFamily('F2')?.children).toEqual(['K']);

      service.undo();
      expect(fixture.repo.getFamily('F1')?.children).toEqual(['K']);
      expect(fixture.repo.getFamily('F2')?.children).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('deletes a person detaching them from their families, restorable in one undo', () => {
    const { fixture, service } = makeService();
    try {
      service.addPerson(person('P1', 'M'));
      service.addPerson(person('P2', 'F'));
      service.addFamily({ id: 'F1', partners: ['P1', 'P2'], children: [] });

      service.deletePerson(person('P1', 'M'));
      expect(service.getPerson('P1')).toBeUndefined();
      expect(fixture.repo.getFamily('F1')?.partners).toEqual(['P2']);

      service.undo();
      expect(service.getPerson('P1')).toBeDefined();
      expect(fixture.repo.getFamily('F1')?.partners).toEqual(['P1', 'P2']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('counts notes, citations and media per person', () => {
    const { fixture, service } = makeService();
    try {
      service.addPerson(person('P1'));
      service.addPerson(person('P2'));
      service.addNote({ id: 'N1', text: 'note', targetType: 'person', targetId: 'P1' });
      service.addSource({ id: 'S1', title: 'Source' }, 'person', 'P1');
      service.addMedia({ id: 'M1', path: 'media/a.jpg', targetType: 'person', targetId: 'P1' });

      expect(service.personCounts(['P1', 'P2'])).toEqual({
        P1: { notes: 1, sources: 1, media: 1 },
        P2: { notes: 0, sources: 0, media: 0 },
      });
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('detachCitation of an unknown citation leaves the history alone', () => {
    const { fixture, service } = makeService();
    try {
      const state = service.detachCitation('missing');
      expect(state).toEqual({ canUndo: false, canRedo: false });
    } finally {
      cleanupRepo(fixture);
    }
  });
});
