import { describe, expect, it } from 'vitest';
import type { DateValue, FamilyRecord, PersonRecord } from '../src/model/types';
import { cleanupRepo, makeRepo } from './helpers';

const birth: DateValue = { year: 1923, month: 3, quality: 'exact' };

const ivan: PersonRecord = {
  id: 'P1',
  names: [{ given: 'Ivan', surname: 'Ivanov' }],
  sex: 'M',
  birth,
};

const maria: PersonRecord = {
  id: 'P2',
  names: [{ given: 'Maria', surname: 'Petrova' }],
  sex: 'F',
};

describe('SqliteTreeRepository', () => {
  it('round-trips persons including JSON fields', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPerson(ivan);
      repo.insertPerson(maria);

      expect(repo.countPersons()).toBe(2);
      expect(repo.getPerson('P1')).toEqual(ivan);
      expect(repo.getPerson('missing')).toBeUndefined();

      const list = repo.listPersons();
      expect(list.map((p) => p.id)).toEqual(['P1', 'P2']);

      const found = repo.listPersons({ search: 'petr' });
      expect(found.map((p) => p.id)).toEqual(['P2']);

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

      const renamed: PersonRecord = { ...ivan, names: [{ full: 'Ivan Ivanovich Ivanov' }] };
      repo.updatePerson(renamed);
      expect(repo.getPerson('P1')).toEqual(renamed);

      expect(repo.deletePerson('P1')).toBe(true);
      expect(repo.deletePerson('P1')).toBe(false);
      expect(repo.countPersons()).toBe(1);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('stores families with parents and children', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPerson(ivan);
      repo.insertPerson(maria);

      const child: PersonRecord = { id: 'P3', names: [], sex: 'U' };
      repo.insertPerson(child);

      const family: FamilyRecord = { id: 'F1', parents: ['P1', 'P2'], children: ['P3'] };
      repo.insertFamily(family);

      expect(repo.getFamily('F1')).toEqual(family);
      expect(repo.listFamilies()).toEqual([family]);
      expect(repo.countFamilies()).toBe(1);

      const extended: FamilyRecord = { id: 'F1', parents: ['P1'], children: ['P3'] };
      repo.updateFamily(extended);
      expect(repo.getFamily('F1')).toEqual(extended);

      expect(repo.deleteFamily('F1')).toBe(true);
      expect(repo.listFamilies()).toEqual([]);
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
      repo.insertFamily({ id: 'F1', parents: ['P1'], children: ['P2'] });

      repo.deletePerson('P1');
      expect(repo.getFamily('F1')).toEqual({ id: 'F1', parents: [], children: ['P2'] });
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('searches persons with FTS5 prefix matching', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPerson(ivan);
      repo.insertPerson(maria);

      expect(repo.listPersons({ search: 'petr' }).map((p) => p.id)).toEqual(['P2']);
      expect(repo.listPersons({ search: 'Ivan' }).map((p) => p.id)).toEqual(['P1']);
      expect(repo.listPersons({ search: 'no-such-person' })).toEqual([]);
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
});
