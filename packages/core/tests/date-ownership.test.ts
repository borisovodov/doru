import { describe, expect, it } from 'vitest';
import type { PersonRecord } from '../src/model/types';
import { cleanupRepo, makeRepo, type RepoFixture } from './helpers';

const exact = (year: number) => ({ quality: 'exact' as const, component: { year } });

function dateCount(fixture: RepoFixture): number {
  return (fixture.store.db.prepare('SELECT COUNT(*) AS n FROM date').get() as { n: number }).n;
}

/**
 * Every date row must be referenced by exactly one owner column. This is a
 * test helper rather than a schema view: the invariant is enforced by the
 * repositories, not by SQLite.
 */
function expectNoOrphanDates(fixture: RepoFixture): void {
  const orphans = fixture.store.db
    .prepare(
      `SELECT id FROM date WHERE id NOT IN (
         SELECT period_date_id FROM person_name WHERE period_date_id IS NOT NULL
         UNION ALL SELECT date_id FROM family_partner WHERE date_id IS NOT NULL
         UNION ALL SELECT date_id FROM family_marriage_status WHERE date_id IS NOT NULL
         UNION ALL SELECT date_id FROM fact WHERE date_id IS NOT NULL
         UNION ALL SELECT sort_date_id FROM fact WHERE sort_date_id IS NOT NULL
         UNION ALL SELECT date_id FROM place_name WHERE date_id IS NOT NULL
         UNION ALL SELECT date_id FROM place_hierarchy WHERE date_id IS NOT NULL
         UNION ALL SELECT date_id FROM place_postal_code WHERE date_id IS NOT NULL
         UNION ALL SELECT publication_date_id FROM source WHERE publication_date_id IS NOT NULL
         UNION ALL SELECT date_id FROM source_data_event WHERE date_id IS NOT NULL
         UNION ALL SELECT date_id FROM citation WHERE date_id IS NOT NULL
         UNION ALL SELECT date_id FROM media WHERE date_id IS NOT NULL
         UNION ALL SELECT period_date_id FROM association WHERE period_date_id IS NOT NULL
       )`,
    )
    .all() as unknown as Array<{ id: string }>;
  expect(orphans).toEqual([]);

  const shared = fixture.store.db
    .prepare(
      `SELECT date_id, COUNT(*) AS n FROM (
         SELECT period_date_id AS date_id FROM person_name WHERE period_date_id IS NOT NULL
         UNION ALL SELECT date_id FROM family_partner WHERE date_id IS NOT NULL
         UNION ALL SELECT date_id FROM family_marriage_status WHERE date_id IS NOT NULL
         UNION ALL SELECT date_id FROM fact WHERE date_id IS NOT NULL
         UNION ALL SELECT sort_date_id FROM fact WHERE sort_date_id IS NOT NULL
         UNION ALL SELECT date_id FROM place_name WHERE date_id IS NOT NULL
         UNION ALL SELECT date_id FROM place_hierarchy WHERE date_id IS NOT NULL
         UNION ALL SELECT date_id FROM place_postal_code WHERE date_id IS NOT NULL
         UNION ALL SELECT publication_date_id FROM source WHERE publication_date_id IS NOT NULL
         UNION ALL SELECT date_id FROM source_data_event WHERE date_id IS NOT NULL
         UNION ALL SELECT date_id FROM citation WHERE date_id IS NOT NULL
         UNION ALL SELECT date_id FROM media WHERE date_id IS NOT NULL
         UNION ALL SELECT period_date_id FROM association WHERE period_date_id IS NOT NULL
       ) GROUP BY date_id HAVING n > 1`,
    )
    .all() as unknown as Array<{ date_id: string; n: number }>;
  expect(shared).toEqual([]);
}

describe('date ownership', () => {
  it('stores one date row per slot and links it forward', () => {
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
            date: { quality: 'range' as const, component: { year: 1901 }, end: { year: 1902 } },
            sortDate: exact(1903),
          },
        ],
      };
      fixture.repo.insertPerson(person);

      const name = fixture.store.db.prepare('SELECT period_date_id FROM person_name WHERE id = ?').get('N1') as {
        period_date_id: string;
      };
      const fact = fixture.store.db.prepare('SELECT date_id, sort_date_id FROM fact WHERE id = ?').get('F1') as {
        date_id: string;
        sort_date_id: string;
      };
      const dates = fixture.store.db.prepare('SELECT year, end_year FROM date WHERE id = ?');

      expect((dates.get(name.period_date_id) as { year: number }).year).toBe(1900);
      expect(dates.get(fact.date_id)).toEqual({ year: 1901, end_year: 1902 });
      expect((dates.get(fact.sort_date_id) as { year: number }).year).toBe(1903);
      expect(dateCount(fixture)).toBe(3);
      expectNoOrphanDates(fixture);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('replaces and clears date slots of an owner', () => {
    const fixture = makeRepo();
    try {
      const fact = {
        id: 'F1',
        personId: 'P1',
        tag: 'BIRT',
        date: { quality: 'range' as const, component: { year: 1901 }, end: { year: 1902 } },
      };
      fixture.repo.insertPerson({ id: 'P1', names: [], sex: 'M', facts: [fact] });
      expect(dateCount(fixture)).toBe(1);
      const original = fixture.store.db.prepare('SELECT date_id FROM fact WHERE id = ?').get('F1') as {
        date_id: string;
      };

      fixture.repo.updateFact({ ...fact, date: exact(1901) });
      const cleared = fixture.store.db.prepare('SELECT date_id FROM fact WHERE id = ?').get('F1') as {
        date_id: string | null;
      };
      expect(cleared.date_id).toBe(original.date_id);
      expect(fixture.store.db.prepare('SELECT quality, end_year FROM date WHERE id = ?').get(cleared.date_id)).toEqual({
        quality: 'exact',
        end_year: null,
      });
      expect(dateCount(fixture)).toBe(1);
      expectNoOrphanDates(fixture);

      fixture.repo.updateFact({ id: 'F1', personId: 'P1', tag: 'BIRT' });
      expect(dateCount(fixture)).toBe(0);
      expectNoOrphanDates(fixture);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('deletes dates with their owner and through cascades', () => {
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
        partnerLinks: [{ id: 'L1', personId: 'P1', date: exact(1902) }],
        marriageStatuses: [{ id: 'S1', status: 'married', date: exact(1903) }],
      });
      expect(dateCount(fixture)).toBe(4);

      fixture.repo.deletePerson('P1');
      expect(dateCount(fixture)).toBe(1);
      expectNoOrphanDates(fixture);

      fixture.repo.deleteFamily('FAM1');
      expect(dateCount(fixture)).toBe(0);
      expectNoOrphanDates(fixture);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('cleans dates of every owner type on delete', () => {
    const fixture = makeRepo();
    try {
      fixture.repo.insertPerson({ id: 'P1', names: [], sex: 'M', facts: [] });
      fixture.repo.insertPerson({ id: 'P2', names: [], sex: 'F', facts: [] });
      fixture.repo.insertPlace({ id: 'PL2', names: [] });
      fixture.repo.insertPlace({
        id: 'PL1',
        names: [{ id: 'PN1', kind: 'official', position: 0, value: 'Moscow', date: exact(1900) }],
        hierarchy: [{ id: 'H1', parentId: 'PL2', date: exact(1901) }],
        postalCodes: [{ id: 'PC1', code: '101000', date: exact(1902) }],
      });
      fixture.repo.insertAssociation({
        id: 'AS1',
        personId: 'P1',
        otherPersonId: 'P2',
        period: { quality: 'range', component: { year: 1907 }, end: { year: 1908 } },
      });
      fixture.repo.insertMedia({ id: 'M1', path: 'media/m1.jpg', date: exact(1909) });
      fixture.repo.insertSource({
        id: 'S1',
        pubDate: exact(1910),
        dataEvents: [{ id: 'E1', tag: 'EVEN', date: exact(1911) }],
      });
      fixture.repo.insertCitation({
        id: 'C1',
        sourceId: 'S1',
        targetType: 'person',
        targetId: 'P1',
        date: exact(1912),
      });
      expect(dateCount(fixture)).toBe(8);
      expectNoOrphanDates(fixture);

      fixture.repo.deleteAssociation('AS1');
      fixture.repo.deleteMedia('M1');
      fixture.repo.deleteSource('S1');
      fixture.repo.deletePlace('PL1');
      expect(dateCount(fixture)).toBe(0);
      expectNoOrphanDates(fixture);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('cleans replaced child rows instead of leaving orphan dates', () => {
    const fixture = makeRepo();
    try {
      fixture.repo.insertPerson({
        id: 'P1',
        names: [
          { id: 'N1', given: 'One', date: exact(1900) },
          { id: 'N2', given: 'Two', date: exact(1901) },
        ],
        sex: 'M',
        facts: [],
      });
      fixture.repo.insertPlace({
        id: 'PL1',
        names: [
          { id: 'PN1', kind: 'official', position: 0, value: 'One', date: exact(1902) },
          { id: 'PN2', kind: 'official', position: 1, value: 'Two', date: exact(1903) },
        ],
        postalCodes: [
          { id: 'PC1', code: '1', date: exact(1904) },
          { id: 'PC2', code: '2', date: exact(1905) },
        ],
      });
      fixture.repo.insertFamily({
        id: 'FAM1',
        partners: [],
        children: [],
        marriageStatuses: [
          { id: 'S1', status: 'married', date: exact(1906) },
          { id: 'S2', status: 'divorced', date: exact(1907) },
        ],
      });
      fixture.repo.insertSource({
        id: 'SRC1',
        dataEvents: [
          { id: 'E1', tag: 'EVEN', date: exact(1908) },
          { id: 'E2', tag: 'EVEN', date: exact(1909) },
        ],
      });
      expect(dateCount(fixture)).toBe(10);

      fixture.repo.updatePerson({
        ...fixture.repo.getPerson('P1')!,
        names: [{ id: 'N1', given: 'One', date: exact(1900) }],
      });
      fixture.repo.updatePlace({
        ...fixture.repo.getPlace('PL1')!,
        names: [{ id: 'PN1', kind: 'official', position: 0, value: 'One', date: exact(1902) }],
        postalCodes: [{ id: 'PC1', code: '1', date: exact(1904) }],
      });
      fixture.repo.updateFamily({
        ...fixture.repo.getFamily('FAM1')!,
        marriageStatuses: [{ id: 'S1', status: 'married', date: exact(1906) }],
      });
      fixture.repo.updateSource({
        ...fixture.repo.getSource('SRC1')!,
        dataEvents: [{ id: 'E1', tag: 'EVEN', date: exact(1908) }],
      });
      expect(dateCount(fixture)).toBe(5);
      expectNoOrphanDates(fixture);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('updates and clears single-slot dates on every entity', () => {
    const fixture = makeRepo();
    try {
      fixture.repo.insertPerson({ id: 'P1', names: [], sex: 'M', facts: [] });
      fixture.repo.insertPerson({ id: 'P2', names: [], sex: 'F', facts: [] });
      fixture.repo.insertMedia({ id: 'M1', path: 'media/m1.jpg', date: exact(1903) });
      fixture.repo.insertSource({
        id: 'S1',
        dataEvents: [{ id: 'E1', tag: 'EVEN', date: exact(1904) }],
      });
      fixture.repo.insertCitation({
        id: 'C1',
        sourceId: 'S1',
        targetType: 'person',
        targetId: 'P1',
        date: exact(1905),
      });
      fixture.repo.insertAssociation({
        id: 'AS1',
        personId: 'P1',
        otherPersonId: 'P2',
        period: exact(1907),
      });
      expect(dateCount(fixture)).toBe(4);

      const media = fixture.repo.getMedia('M1')!;
      delete media.date;
      fixture.repo.updateMedia(media);
      fixture.repo.updateSource({
        ...fixture.repo.getSource('S1')!,
        dataEvents: [{ id: 'E1', tag: 'EVEN' }],
      });
      const citation = fixture.repo.getCitation('C1')!;
      delete citation.date;
      fixture.repo.updateCitation(citation);
      const association = fixture.repo.listAssociations().find((entry) => entry.id === 'AS1')!;
      delete association.period;
      fixture.repo.updateAssociation(association);
      expect(dateCount(fixture)).toBe(0);
      expectNoOrphanDates(fixture);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps a surviving name date id when a copy is written first', () => {
    const fixture = makeRepo();
    try {
      fixture.repo.insertPerson({
        id: 'P1',
        names: [{ id: 'N1', given: 'Ivan', date: exact(1900) }],
        sex: 'M',
        facts: [],
      });
      const original = fixture.repo.getPerson('P1')!.names[0]!;
      const originalDateId = original.date!.id;
      const copy = { id: 'N2', given: 'Copy', date: original.date };

      fixture.repo.updatePerson({
        ...fixture.repo.getPerson('P1')!,
        names: [copy, original],
      });

      const names = new Map(fixture.repo.getPerson('P1')!.names.map((name) => [name.id, name]));
      expect(names.get('N1')?.date?.id).toBe(originalDateId);
      expect(names.get('N2')?.date?.id).toBeDefined();
      expect(names.get('N2')?.date?.id).not.toBe(originalDateId);
      expectNoOrphanDates(fixture);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps a family link date id reserved when a status copies it', () => {
    const fixture = makeRepo();
    try {
      fixture.repo.insertPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      fixture.repo.insertFamily({
        id: 'FAM1',
        partners: ['P1'],
        children: [],
        partnerLinks: [{ id: 'L1', personId: 'P1', date: exact(1901) }],
        marriageStatuses: [{ id: 'S1', status: 'married', date: exact(1902) }],
      });
      const family = fixture.repo.getFamily('FAM1')!;
      const partnerDate = family.partnerLinks![0]!.date!;

      fixture.repo.updateFamily({
        ...family,
        partners: [],
        partnerLinks: [],
        marriageStatuses: [{ id: 'S1', status: 'married', date: partnerDate }],
      });

      const status = fixture.repo.getFamily('FAM1')!.marriageStatuses![0]!;
      expect(status.date?.id).not.toBe(partnerDate.id);
      expectNoOrphanDates(fixture);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps a removed source event date id reserved when the publication copies it', () => {
    const fixture = makeRepo();
    try {
      fixture.repo.insertSource({
        id: 'S1',
        dataEvents: [{ id: 'E1', tag: 'EVEN', date: exact(1900) }],
      });
      const eventDate = fixture.repo.getSource('S1')!.dataEvents![0]!.date!;

      fixture.repo.updateSource({
        ...fixture.repo.getSource('S1')!,
        pubDate: eventDate,
        dataEvents: [],
      });

      const source = fixture.repo.getSource('S1')!;
      expect(source.pubDate?.id).not.toBe(eventDate.id);
      expect(source.dataEvents ?? []).toEqual([]);
      expectNoOrphanDates(fixture);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps a source event date fresh when it copies a cleared publication date', () => {
    const fixture = makeRepo();
    try {
      fixture.repo.insertSource({
        id: 'S1',
        pubDate: exact(1900),
        dataEvents: [{ id: 'E1', tag: 'EVEN' }],
      });
      const source = fixture.repo.getSource('S1')!;
      const publicationDate = source.pubDate!;
      fixture.repo.updateSource({
        ...source,
        pubDate: undefined,
        dataEvents: [{ id: 'E1', tag: 'EVEN', date: publicationDate }],
      });

      const updated = fixture.repo.getSource('S1')!;
      expect(updated.pubDate).toBeUndefined();
      expect(updated.dataEvents?.[0]?.date?.id).not.toBe(publicationDate.id);
      expectNoOrphanDates(fixture);
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
      expectNoOrphanDates(fixture);
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
      expectNoOrphanDates(fixture);
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

      const events = new Map((fixture.repo.getSource('S1')!.dataEvents ?? []).map((event) => [event.id, event]));
      expect(events.get('E1')?.date?.id).toBe(originalDateId);
      expect(events.get('E2')?.date?.id).toBeDefined();
      expect(events.get('E2')?.date?.id).not.toBe(originalDateId);
      expectNoOrphanDates(fixture);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps a removed name date id reserved when a fact copies it', () => {
    const fixture = makeRepo();
    try {
      fixture.repo.insertPerson({
        id: 'P1',
        names: [{ id: 'N1', given: 'Ivan', date: exact(1900) }],
        sex: 'M',
        facts: [],
      });
      const nameDate = fixture.repo.getPerson('P1')!.names[0]!.date!;

      fixture.repo.updatePerson({
        ...fixture.repo.getPerson('P1')!,
        names: [],
        facts: [{ id: 'F1', personId: 'P1', tag: 'BIRT', date: nameDate }],
      });

      const fact = fixture.repo.getPerson('P1')!.facts[0]!;
      expect(fact.date?.id).not.toBe(nameDate.id);
      expectNoOrphanDates(fixture);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps a cleared fact date id reserved when a later fact copies it', () => {
    const fixture = makeRepo();
    try {
      fixture.repo.insertPerson({
        id: 'P1',
        names: [],
        sex: 'M',
        facts: [{ id: 'F1', personId: 'P1', tag: 'BIRT', date: exact(1901) }],
      });
      const originalDate = fixture.repo.getPerson('P1')!.facts[0]!.date!;

      fixture.repo.updatePerson({
        ...fixture.repo.getPerson('P1')!,
        facts: [
          { id: 'F1', personId: 'P1', tag: 'BIRT' },
          { id: 'F2', personId: 'P1', tag: 'DEAT', date: originalDate },
        ],
      });

      const facts = new Map(fixture.repo.getPerson('P1')!.facts.map((fact) => [fact.id, fact]));
      expect(facts.get('F1')?.date).toBeUndefined();
      expect(facts.get('F2')?.date?.id).not.toBe(originalDate.id);
      expectNoOrphanDates(fixture);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('rejects deleting a date that is still referenced', () => {
    const fixture = makeRepo();
    try {
      fixture.repo.insertPerson({
        id: 'P1',
        names: [],
        sex: 'M',
        facts: [{ id: 'F1', personId: 'P1', tag: 'BIRT', date: exact(1901) }],
      });
      const fact = fixture.store.db.prepare('SELECT date_id FROM fact WHERE id = ?').get('F1') as {
        date_id: string;
      };
      expect(() => fixture.store.db.prepare('DELETE FROM date WHERE id = ?').run(fact.date_id)).toThrow(/FOREIGN KEY/);
    } finally {
      cleanupRepo(fixture);
    }
  });
});
