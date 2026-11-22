import { describe, expect, it } from 'vitest';
import type { DateValue, FactRecord } from '../src/model/types';
import { cleanupRepo, makeRepo } from './helpers';

const day = (year: number, month: number, dayOfMonth: number, hour = 0, minute = 0): DateValue => ({
  quality: 'exact',
  component: { year, month, day: dayOfMonth },
  ...(hour !== 0 || minute !== 0 ? { time: { hour, minute } } : {}),
});

const fact = (id: string, overrides: Partial<FactRecord> = {}): FactRecord => ({
  id,
  personId: 'P1',
  tag: 'EVEN',
  ...overrides,
});

describe('fact date ordering', () => {
  it('prefers sortDate and compares the full day and time', () => {
    const fixture = makeRepo();
    try {
      fixture.repo.insertPerson({
        id: 'P1',
        names: [],
        sex: 'U',
        facts: [
          fact('F1', { date: day(1900, 1, 1), sortDate: day(1900, 5, 20) }),
          fact('F2', { date: day(1900, 2, 1), sortDate: day(1900, 5, 10) }),
          fact('F3', { date: day(1900, 5, 15) }),
          fact('F4', { sortDate: day(1900, 5, 20, 16, 3) }),
          fact('F5', { sortDate: day(1900, 5, 20, 16, 2) }),
          fact('F6'),
        ],
      });

      expect(fixture.repo.listFactsForPerson('P1').map((entry) => entry.id)).toEqual([
        'F2',
        'F3',
        'F1',
        'F5',
        'F4',
        'F6',
      ]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('places BEF before and AFT after the same component', () => {
    const fixture = makeRepo();
    try {
      fixture.repo.insertPerson({
        id: 'P1',
        names: [],
        sex: 'U',
        facts: [
          fact('BEFORE', { sortDate: { quality: 'before', component: { year: 1900 } } }),
          fact('EXACT', { sortDate: { quality: 'exact', component: { year: 1900 } } }),
          fact('AFTER', { sortDate: { quality: 'after', component: { year: 1900 } } }),
        ],
      });

      expect(fixture.repo.listFactsForPerson('P1').map((entry) => entry.id)).toEqual(['BEFORE', 'EXACT', 'AFTER']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('falls back to date when sortDate only has a phrase', () => {
    const fixture = makeRepo();
    try {
      fixture.repo.insertPerson({
        id: 'P1',
        names: [],
        sex: 'U',
        facts: [
          fact('F1', { date: day(1901, 1, 1), sortDate: { quality: 'unknown', text: 'after the war' } }),
          fact('F2', { date: day(1900, 1, 1) }),
        ],
      });

      expect(fixture.repo.listFactsForPerson('P1').map((entry) => entry.id)).toEqual(['F2', 'F1']);
    } finally {
      cleanupRepo(fixture);
    }
  });
});
