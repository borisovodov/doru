import { describe, expect, it } from 'vitest';
import { computePedigree } from '../src/pedigree';
import type { PersonRecord } from '../src/model/types';
import { cleanupRepo, makeRepo } from './helpers';

const person = (id: string): PersonRecord => ({ id, names: [], sex: 'U' });

describe('computePedigree', () => {
  it('walks ancestors through family links', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      for (const id of ['child', 'mother', 'father', 'grandma']) {
        repo.insertPerson(person(id));
      }
      repo.insertFamily({ id: 'F1', parents: ['father', 'mother'], children: ['child'] });
      repo.insertFamily({ id: 'F2', parents: ['grandma'], children: ['mother'] });

      const pedigree = computePedigree(repo, 'child');
      expect(pedigree?.id).toBe('child');
      const parentIds = pedigree?.parents.map((p) => p.id).sort();
      expect(parentIds).toEqual(['father', 'mother']);
      const mother = pedigree?.parents.find((p) => p.id === 'mother');
      expect(mother?.parents.map((p) => p.id)).toEqual(['grandma']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('returns undefined for an unknown person', () => {
    const fixture = makeRepo();
    try {
      expect(computePedigree(fixture.repo, 'missing')).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });
});
