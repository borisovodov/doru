import { describe, expect, it } from 'vitest';
import type { DateValue, FamilyRecord, PersonRecord } from '../src/model/types';
import { cleanupRepo, flatFamily, flatPerson, makeRepo } from './helpers';

const birth: DateValue = { quality: 'exact', component: { year: 1923, month: 3 } };

const ivan: PersonRecord = {
  id: 'P1',
  names: [{ id: 'N1', given: 'Ivan', surname: 'Ivanov' }],
  sex: 'M',
  facts: [{ id: 'B1', personId: 'P1', tag: 'BIRT', date: birth, place: 'Moscow' }],
};

const maria: PersonRecord = {
  id: 'P2',
  names: [{ id: 'N2', given: 'Maria', surname: 'Petrova' }],
  sex: 'F',
  facts: [],
};

describe('SqliteTreeRepository', () => {
  it('round-trips persons including names and facts', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPerson(ivan);
      repo.insertPerson(maria);

      expect(repo.countPersons()).toBe(2);
      expect(flatPerson(repo.getPerson('P1')!)).toEqual(ivan);
      expect(repo.getPerson('missing')).toBeUndefined();

      const list = repo.listPersons();
      expect(list.map((p) => p.id)).toEqual(['P1', 'P2']);

      const found = repo.listPersons({ search: 'petr' });
      expect(found.map((p) => p.id)).toEqual(['P2']);

      const males = repo.listPersons({ sex: 'M' });
      expect(males.map((p) => p.id)).toEqual(['P1']);

      const females = repo.listPersons({ sex: 'F' });
      expect(females.map((p) => p.id)).toEqual(['P2']);

      const femaleIvanovs = repo.listPersons({ search: 'ivan', sex: 'F' });
      expect(femaleIvanovs).toEqual([]);

      const maleIvanovs = repo.listPersons({ search: 'ivan', sex: 'M' });
      expect(maleIvanovs.map((p) => p.id)).toEqual(['P1']);

      const limited = repo.listPersons({ limit: 1 });
      expect(limited).toHaveLength(1);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('updates and deletes persons', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPerson(ivan);
      repo.insertPerson(maria);

      expect(repo.listAllPersons()).toHaveLength(2);

      const renamed: PersonRecord = { ...ivan, names: [{ id: 'N1', full: 'Ivan Ivanovich Ivanov' }] };
      repo.updatePerson(renamed);
      expect(flatPerson(repo.getPerson('P1')!)).toEqual(renamed);

      expect(repo.deletePerson('P1')).toBe(true);
      expect(repo.deletePerson('P1')).toBe(false);
      expect(repo.countPersons()).toBe(1);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('synchronizes facts on person update by id', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPerson(ivan);

      const death: DateValue = { quality: 'exact', component: { year: 1999 } };
      const updated: PersonRecord = {
        ...ivan,
        facts: [
          { ...ivan.facts[0]!, date: { quality: 'exact', component: { year: 1924 } } },
          { id: 'D1', personId: 'P1', tag: 'DEAT', date: death },
        ],
      };
      repo.updatePerson(updated);
      expect(flatPerson(repo.getPerson('P1')!)).toEqual(updated);

      const withoutDeath: PersonRecord = { ...updated, facts: [updated.facts[0]!] };
      repo.updatePerson(withoutDeath);
      expect(flatPerson(repo.getPerson('P1')!)).toEqual(withoutDeath);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('stores families with ordered partners and children', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPerson(ivan);
      repo.insertPerson(maria);

      const child: PersonRecord = { id: 'P3', names: [], sex: 'U', facts: [] };
      repo.insertPerson(child);

      const family: FamilyRecord = { id: 'F1', partners: ['P1', 'P2'], children: ['P3'] };
      repo.insertFamily(family);

      expect(flatFamily(repo.getFamily('F1')!)).toEqual(family);
      expect(repo.listFamilies().map(flatFamily)).toEqual([family]);
      expect(repo.countFamilies()).toBe(1);

      const extended: FamilyRecord = { id: 'F1', partners: ['P1'], children: ['P3'] };
      repo.updateFamily(extended);
      expect(flatFamily(repo.getFamily('F1')!)).toEqual(extended);

      expect(repo.deleteFamily('F1')).toBe(true);
      expect(repo.listFamilies()).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps partner order across reads', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      for (const id of ['A', 'B', 'C']) {
        repo.insertPerson({ id, names: [], sex: 'U', facts: [] });
      }
      repo.insertFamily({ id: 'F1', partners: ['C', 'A', 'B'], children: [] });
      expect(repo.getFamily('F1')?.partners).toEqual(['C', 'A', 'B']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps child order across reads and updates', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      for (const id of ['A', 'B', 'C', 'D']) {
        repo.insertPerson({ id, names: [], sex: 'U', facts: [] });
      }
      repo.insertFamily({ id: 'F1', partners: ['A'], children: ['D', 'B', 'C'] });
      expect(repo.getFamily('F1')?.children).toEqual(['D', 'B', 'C']);

      repo.updateFamily({ id: 'F1', partners: ['A'], children: ['C', 'D'] });
      expect(repo.getFamily('F1')?.children).toEqual(['C', 'D']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('lists only the families a person belongs to', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      for (const id of ['A', 'B', 'C', 'D']) {
        repo.insertPerson({ id, names: [], sex: 'U', facts: [] });
      }
      repo.insertFamily({ id: 'F1', partners: ['A', 'B'], children: ['C'] });
      repo.insertFamily({ id: 'F2', partners: ['D'], children: [] });

      expect(repo.listFamiliesForPerson('A').map((family) => family.id)).toEqual(['F1']);
      expect(repo.listFamiliesForPerson('C').map((family) => family.id)).toEqual(['F1']);
      expect(repo.listFamiliesForPerson('D').map((family) => family.id)).toEqual(['F2']);
      expect(repo.listFamiliesForPerson('missing')).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('searches names case-insensitively and by substring in any script', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPerson(ivan);
      repo.insertPerson(maria);
      const boris: PersonRecord = {
        id: 'P3',
        names: [{ id: 'N4', given: 'Борис', surname: 'Ёлкин' }],
        sex: 'M',
        facts: [],
      };
      repo.insertPerson(boris);

      expect(repo.listPersons({ search: 'борис' }).map((p) => p.id)).toEqual(['P3']);
      expect(repo.listPersons({ search: 'БОРИС' }).map((p) => p.id)).toEqual(['P3']);
      expect(repo.listPersons({ search: 'ёлк' }).map((p) => p.id)).toEqual(['P3']);
      expect(repo.listPersons({ search: 'борис ёлкин' }).map((p) => p.id)).toEqual(['P3']);
      expect(repo.listPersons({ search: 'petr' }).map((p) => p.id)).toEqual(['P2']);
      // Terms shorter than three characters fall back to a full scan.
      expect(repo.listPersons({ search: 'бо' }).map((p) => p.id)).toEqual(['P3']);

      // Updates re-index the name: the old name stops matching.
      repo.updatePerson({ ...boris, names: [{ id: 'N4', given: 'Пётр', surname: 'Сидоров' }] });
      expect(repo.listPersons({ search: 'борис' })).toEqual([]);
      expect(repo.listPersons({ search: 'сидор' }).map((p) => p.id)).toEqual(['P3']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('cascades family links when a person is deleted', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPerson(ivan);
      repo.insertPerson(maria);
      repo.insertFamily({ id: 'F1', partners: ['P1'], children: ['P2'] });

      repo.deletePerson('P1');
      expect(flatFamily(repo.getFamily('F1')!)).toEqual({ id: 'F1', partners: [], children: ['P2'] });
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('cascades facts and names when a person is deleted', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPerson(ivan);

      repo.deletePerson('P1');
      expect(repo.listFactsForPerson('P1')).toEqual([]);
      expect(repo.listPersons({ search: 'ivan' })).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('searches across multiple names of one person', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPerson(ivan);
      repo.insertPerson(maria);

      expect(repo.listPersons({ search: 'petr' }).map((p) => p.id)).toEqual(['P2']);
      expect(repo.listPersons({ search: 'Ivan' }).map((p) => p.id)).toEqual(['P1']);
      expect(repo.listPersons({ search: 'no-such-person' })).toEqual([]);

      const renamed: PersonRecord = {
        ...ivan,
        names: [
          { id: 'N1', given: 'Ivan', surname: 'Ivanov' },
          { id: 'N3', surname: 'Sidorov' },
        ],
      };
      repo.updatePerson(renamed);
      expect(repo.listPersons({ search: 'sidor' }).map((p) => p.id)).toEqual(['P1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('normalizes date fields into columns and orders facts by sort year', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      const person: PersonRecord = {
        id: 'P1',
        names: [],
        sex: 'U',
        facts: [
          {
            id: 'F1',
            personId: 'P1',
            tag: 'RESI',
            date: { quality: 'range', component: { year: 1900 }, end: { year: 1905 } },
          },
          { id: 'F2', personId: 'P1', tag: 'BIRT', date: { quality: 'before', component: { year: 1850 } } },
          { id: 'F3', personId: 'P1', tag: 'OCCU', value: 'Merchant' },
          { id: 'F4', personId: 'P1', tag: 'DEAT', date: { quality: 'unknown', text: 'after the war' } },
          { id: 'F5', personId: 'P1', tag: 'BURI', date: { quality: 'exact', component: { year: 10, epoch: 'BCE' } } },
        ],
      };
      repo.insertPerson(person);

      const facts = repo.listFactsForPerson('P1');
      expect(facts.map((f) => f.id)).toEqual(['F5', 'F2', 'F1', 'F3', 'F4']);
      expect(facts[0]?.date).toEqual({
        id: expect.any(String),
        quality: 'exact',
        component: { year: 10, epoch: 'BCE' },
      });
      expect(facts[4]?.date).toEqual({ id: expect.any(String), quality: 'unknown', text: 'after the war' });
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('rejects a fact without exactly one owner', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      expect(() => repo.insertFact({ id: 'F1', tag: 'BIRT' })).toThrow();
      expect(() => repo.insertFact({ id: 'F2', tag: 'BIRT', personId: 'P1', familyId: 'missing' })).toThrow();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('rolls back a failed transaction', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      expect(() =>
        repo.transaction(() => {
          repo.insertPerson(ivan);
          throw new Error('boom');
        }),
      ).toThrow('boom');
      expect(repo.countPersons()).toBe(0);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('stores name parts and variants and projects the flat pieces', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      const person: PersonRecord = {
        id: 'P1',
        sex: 'M',
        names: [
          {
            id: 'N1',
            type: 'birth',
            primary: true,
            parts: [
              { id: 'G1', kind: 'given', value: 'Ivan', position: 0 },
              { id: 'G2', kind: 'given', value: 'Petrovich', position: 1 },
              { id: 'SP1', kind: 'surnamePrefix', value: 'van', position: 2 },
              { id: 'S1', kind: 'surname', value: 'Ivanov', position: 3 },
            ],
            variants: [{ id: 'V1', kind: 'phonetic', language: 'ru-Latn', given: 'Ivan', surname: 'Ivanov' }],
          },
        ],
        facts: [],
      };
      repo.insertPerson(person);

      const read = repo.getPerson('P1')!;
      expect(read.names).toHaveLength(1);
      const name = read.names[0]!;
      // Flat projections derive from the parts.
      expect(name.given).toBe('Ivan');
      expect(name.surname).toBe('Ivanov');
      expect(name.surnamePrefix).toBe('van');
      expect(name.type).toBe('birth');
      expect(name.primary).toBe(true);
      // The parts themselves survive, in order.
      expect(name.parts?.map((part) => [part.kind, part.value])).toEqual([
        ['given', 'Ivan'],
        ['given', 'Petrovich'],
        ['surnamePrefix', 'van'],
        ['surname', 'Ivanov'],
      ]);
      // Variants hang off the name and are searchable too.
      expect(name.variants).toHaveLength(1);
      expect(name.variants?.[0]?.given).toBe('Ivan');
      expect(repo.listPersons({ search: 'petrovich' }).map((p) => p.id)).toEqual(['P1']);
      expect(repo.listPersons({ search: 'ivanov' }).map((p) => p.id)).toEqual(['P1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps family link ids stable across updates from flat arrays', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      for (const id of ['A', 'B', 'C']) {
        repo.insertPerson({ id, names: [], sex: 'U', facts: [] });
      }
      repo.insertFamily({ id: 'F1', partners: ['A', 'B'], children: ['C'] });
      const before = repo.getFamily('F1')!;
      const partnerIds = new Set(before.partnerLinks?.map((link) => link.id));
      const childIds = new Set(before.childLinks?.map((link) => link.id));

      // A UI-style update carrying only the flat arrays must not churn ids.
      repo.updateFamily({ id: 'F1', partners: ['B', 'A'], children: ['C'] });
      const after = repo.getFamily('F1')!;
      expect(after.partners).toEqual(['B', 'A']);
      for (const link of after.partnerLinks ?? []) {
        expect(partnerIds.has(link.id)).toBe(true);
      }
      for (const link of after.childLinks ?? []) {
        expect(childIds.has(link.id)).toBe(true);
      }
    } finally {
      cleanupRepo(fixture);
    }
  });
});
