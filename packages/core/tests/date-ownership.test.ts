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

  it('keeps a surviving name date id when a copy is written first', () => {
    const fixture = makeRepo();
    try {
      const person: PersonRecord = {
        id: 'P1',
        names: [{ id: 'N1', given: 'Ivan', date: exact(1900) }],
        sex: 'M',
        facts: [],
      };
      fixture.repo.insertPerson(person);
      const original = fixture.repo.getPerson('P1')!.names[0]!;
      const originalDateId = original.date!.id;
      const copy = { id: 'N2', given: 'Copy', date: original.date };

      fixture.repo.updatePerson({ ...person, names: [copy, original] });

      const names = new Map(fixture.repo.getPerson('P1')!.names.map((name) => [name.id, name]));
      expect(names.get('N1')?.date?.id).toBe(originalDateId);
      expect(names.get('N2')?.date?.id).toBeDefined();
      expect(names.get('N2')?.date?.id).not.toBe(originalDateId);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps a surviving family link date id when a copy is written first', () => {
    const fixture = makeRepo();
    try {
      fixture.repo.insertPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      fixture.repo.insertPerson({ id: 'P2', names: [], sex: 'U', facts: [] });
      fixture.repo.insertFamily({
        id: 'FAM1',
        partners: ['P1'],
        children: [],
        partnerLinks: [{ id: 'L1', personId: 'P1', date: exact(1901) }],
      });
      const family = fixture.repo.getFamily('FAM1')!;
      const original = family.partnerLinks![0]!;
      const originalDateId = original.date!.id;
      const copy = { ...original, id: 'L2', personId: 'P2' };

      fixture.repo.updateFamily({
        ...family,
        partners: ['P2', 'P1'],
        partnerLinks: [copy, original],
      });

      const links = new Map((fixture.repo.getFamily('FAM1')!.partnerLinks ?? []).map((link) => [link.id, link]));
      expect(links.get('L1')?.date?.id).toBe(originalDateId);
      expect(links.get('L2')?.date?.id).toBeDefined();
      expect(links.get('L2')?.date?.id).not.toBe(originalDateId);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps a surviving place name date id when a copy is written first', () => {
    const fixture = makeRepo();
    try {
      fixture.repo.insertPlace({
        id: 'PL1',
        names: [{ id: 'PN1', kind: 'official', position: 0, value: 'One', date: exact(1902) }],
      });
      const place = fixture.repo.getPlace('PL1')!;
      const original = place.names[0]!;
      const originalDateId = original.date!.id;
      const copy = { ...original, id: 'PN2', value: 'Copy' };

      fixture.repo.updatePlace({ ...place, names: [copy, original] });

      const names = new Map(fixture.repo.getPlace('PL1')!.names.map((name) => [name.id, name]));
      expect(names.get('PN1')?.date?.id).toBe(originalDateId);
      expect(names.get('PN2')?.date?.id).toBeDefined();
      expect(names.get('PN2')?.date?.id).not.toBe(originalDateId);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps a surviving source event date id when a copy is written first', () => {
    const fixture = makeRepo();
    try {
      fixture.repo.insertSource({
        id: 'S1',
        dataEvents: [{ id: 'E1', tag: 'EVEN', date: exact(1903) }],
      });
      const source = fixture.repo.getSource('S1')!;
      const original = source.dataEvents![0]!;
      const originalDateId = original.date!.id;
      const copy = { ...original, id: 'E2' };

      fixture.repo.updateSource({ ...source, dataEvents: [copy, original] });

      const events = new Map(fixture.repo.getSource('S1')!.dataEvents!.map((event) => [event.id, event]));
      expect(events.get('E1')?.date?.id).toBe(originalDateId);
      expect(events.get('E2')?.date?.id).toBeDefined();
      expect(events.get('E2')?.date?.id).not.toBe(originalDateId);
    } finally {
      cleanupRepo(fixture);
    }
  });
});
