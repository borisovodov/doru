import { describe, expect, it } from 'vitest';
import type { PersonRecord } from '../src/model/types';
import { cleanupRepo, makeRepo, type RepoFixture } from './helpers';

const exact = (year: number) => ({ quality: 'exact' as const, component: { year } });

function dateRoles(fixture: RepoFixture): Array<{ ownerType: string; ownerId: string; role: string }> {
  const rows = fixture.store.db
    .prepare('SELECT owner_type, owner_id, role FROM date ORDER BY owner_type, owner_id, role')
    .all() as unknown as Array<{ owner_type: string; owner_id: string; role: string }>;
  return rows.map((row) => ({ ownerType: row.owner_type, ownerId: row.owner_id, role: row.role }));
}

function dateCount(fixture: RepoFixture): number {
  return (fixture.store.db.prepare('SELECT COUNT(*) AS n FROM date').get() as { n: number }).n;
}

describe('date ownership', () => {
  it('stores one row per owner and role', () => {
    const fixture = makeRepo();
    try {
      const person: PersonRecord = {
        id: 'P1',
        names: [{ id: 'N1', given: 'Ivan', date: exact(1900) }],
        sex: 'M',
        facts: [
          {
            id: 'F1',
            personId: 'P1',
            tag: 'BIRT',
            date: exact(1901),
            endDate: exact(1902),
            sortDate: exact(1903),
          },
        ],
      };
      fixture.repo.insertPerson(person);

      expect(dateRoles(fixture)).toEqual([
        { ownerType: 'fact', ownerId: 'F1', role: 'end' },
        { ownerType: 'fact', ownerId: 'F1', role: 'event' },
        { ownerType: 'fact', ownerId: 'F1', role: 'sort' },
        { ownerType: 'person_name', ownerId: 'N1', role: 'period' },
      ]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('replaces and clears the roles of an owner on update', () => {
    const fixture = makeRepo();
    try {
      const fact = { id: 'F1', personId: 'P1', tag: 'BIRT', date: exact(1901), endDate: exact(1902) };
      fixture.repo.insertPerson({ id: 'P1', names: [], sex: 'M', facts: [fact] });
      expect(dateCount(fixture)).toBe(2);

      fixture.repo.updateFact({ ...fact, endDate: undefined });
      expect(dateRoles(fixture)).toEqual([{ ownerType: 'fact', ownerId: 'F1', role: 'event' }]);

      fixture.repo.updateFact({ ...fact, date: undefined, endDate: undefined });
      expect(dateRoles(fixture)).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('deletes dates with their owner and through foreign-key cascades', () => {
    const fixture = makeRepo();
    try {
      fixture.repo.insertPerson({
        id: 'P1',
        names: [{ id: 'N1', given: 'Ivan', date: exact(1900) }],
        sex: 'M',
        facts: [{ id: 'F1', personId: 'P1', tag: 'BIRT', date: exact(1901) }],
      });
      fixture.repo.insertFamily({
        id: 'FAM1',
        partners: ['P1'],
        children: [],
        marriageStatuses: [{ id: 'S1', status: 'married', date: exact(1902) }],
      });
      expect(dateCount(fixture)).toBe(3);

      fixture.repo.deletePerson('P1');
      expect(dateCount(fixture)).toBe(1);
      expect(dateRoles(fixture)).toEqual([{ ownerType: 'family_marriage_status', ownerId: 'S1', role: 'date' }]);

      fixture.repo.deleteFamily('FAM1');
      expect(dateCount(fixture)).toBe(0);
    } finally {
      cleanupRepo(fixture);
    }
  });
});
