import { describe, expect, it } from 'vitest';
import type { PersonRecord } from '../src/model/types';
import { OpQueue, TreeService } from '../src';
import { cleanupRepo, makeRepo } from './helpers';

function person(id: string): PersonRecord {
  return { id, sex: 'U', names: [], facts: [] };
}

function service(fixture: ReturnType<typeof makeRepo>): TreeService {
  return new TreeService(fixture.repo, new OpQueue());
}

describe('Phase 3: relations', () => {
  it('round-trips associations with a period and undo', () => {
    const fixture = makeRepo();
    try {
      const svc = service(fixture);
      const repo = fixture.repo;
      repo.insertPerson(person('P1'));
      repo.insertPerson(person('P2'));

      svc.addAssociation({
        id: 'A1',
        personId: 'P1',
        otherPersonId: 'P2',
        role: 'GODP',
        relationship: 'godparent',
        periodStart: { quality: 'exact', component: { year: 1900 } },
        periodEnd: { quality: 'exact', component: { year: 1905 } },
      });
      expect(repo.listAssociationsFor('P1')).toEqual([
        expect.objectContaining({ id: 'A1', otherPersonId: 'P2', relationship: 'godparent' }),
      ]);
      expect(repo.listAssociationsFor('P2')).toHaveLength(1);

      svc.undo();
      expect(repo.listAssociationsFor('P1')).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('round-trips aliases and ordinances', () => {
    const fixture = makeRepo();
    try {
      const svc = service(fixture);
      const repo = fixture.repo;
      repo.insertPerson(person('P1'));
      repo.insertPerson(person('P2'));

      svc.addAlias('P1', 'P2');
      expect(repo.listAliasesFor('P1').map((alias) => alias.aliasId)).toEqual(['P2']);

      svc.addOrdinance({
        id: 'O1',
        kind: 'BAPL',
        targetType: 'person',
        targetId: 'P1',
        date: { quality: 'exact', component: { year: 1920 } },
        temple: 'SALT',
        status: 'COMPLETED',
      });
      expect(repo.listOrdinancesFor('person', 'P1')).toEqual([
        expect.objectContaining({ id: 'O1', kind: 'BAPL', temple: 'SALT', status: 'COMPLETED' }),
      ]);
    } finally {
      cleanupRepo(fixture);
    }
  });
});

describe('Phase 3: research layer', () => {
  it('round-trips todos', () => {
    const fixture = makeRepo();
    try {
      const repo = fixture.repo;
      repo.insertPerson(person('P1'));

      repo.insertTodo({
        id: 'T1',
        text: 'check the archive',
        targetType: 'person',
        targetId: 'P1',
        priority: 'high',
        status: 'open',
        createdDate: { quality: 'exact', component: { year: 2026 } },
      });
      expect(repo.listTodosFor('person', 'P1')).toEqual([
        expect.objectContaining({ id: 'T1', text: 'check the archive', status: 'open' }),
      ]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('round-trips duplicates and titles', () => {
    const fixture = makeRepo();
    try {
      const repo = fixture.repo;
      repo.insertPerson(person('P1'));
      repo.insertPerson(person('P2'));

      repo.insertDuplicate({ id: 'D1', personId: 'P1', otherPersonId: 'P2', assessment: 'maybe' });
      expect(repo.listDuplicates()).toEqual([
        expect.objectContaining({ id: 'D1', personId: 'P1', otherPersonId: 'P2' }),
      ]);

      repo.insertTitle({ id: 'T1', name: 'Parish books of Tver', publisher: 'Archive', callNumber: 'F-123' });
      expect(repo.listTitles()).toEqual([
        expect.objectContaining({ id: 'T1', name: 'Parish books of Tver', callNumber: 'F-123' }),
      ]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('cascades ordinances, todos and record submitters with the person and restores them on undo', () => {
    const fixture = makeRepo();
    try {
      const svc = service(fixture);
      const repo = fixture.repo;
      const p = person('P1');
      repo.insertPerson(p);

      svc.addOrdinance({ id: 'O1', kind: 'BAPL', targetType: 'person', targetId: 'P1' });
      svc.addTodo({ id: 'T1', text: 'todo', targetType: 'person', targetId: 'P1' });
      repo.insertSubmitter({ id: 'S1', name: 'Sub' });
      repo.insertRecordSubmitter('RS1', 'S1', 'person', 'P1');

      svc.deletePerson(p);
      expect(repo.listOrdinancesFor('person', 'P1')).toEqual([]);
      expect(repo.listTodosFor('person', 'P1')).toEqual([]);
      expect(repo.listSubmittersFor('person', 'P1')).toEqual([]);
      // The submitter survives; only the record link goes.
      expect(repo.getSubmitter('S1')).toBeDefined();

      svc.undo();
      expect(repo.listOrdinancesFor('person', 'P1').map((entry) => entry.id)).toEqual(['O1']);
      expect(repo.listTodosFor('person', 'P1').map((entry) => entry.id)).toEqual(['T1']);
      expect(repo.listSubmittersFor('person', 'P1')).toEqual(['S1']);
    } finally {
      cleanupRepo(fixture);
    }
  });
});
