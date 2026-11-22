import { describe, expect, it } from 'vitest';
import { mergeDateBounds, type DateValue, type FactRecord } from '../src/model/types';
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
          fact('AFTER', { sortDate: { quality: 'after', component: { year: 1900 } } }),
          fact('EXACT', { sortDate: { quality: 'exact', component: { year: 1900 } } }),
          fact('BEFORE', { sortDate: { quality: 'before', component: { year: 1900 } } }),
        ],
      });

      expect(fixture.repo.listFactsForPerson('P1').map((entry) => entry.id)).toEqual(['BEFORE', 'EXACT', 'AFTER']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('compares fractional seconds and calendar month codes', () => {
    const fixture = makeRepo();
    try {
      fixture.repo.insertPerson({
        id: 'P1',
        names: [],
        sex: 'U',
        facts: [
          fact('LATER', {
            sortDate: {
              quality: 'exact',
              component: { year: 2022, month: 3, day: 27 },
              time: { hour: 16, minute: 2, fraction: '900' },
            },
          }),
          fact('EARLIER', {
            sortDate: {
              quality: 'exact',
              component: { year: 2022, month: 3, day: 27 },
              time: { hour: 16, minute: 2, fraction: '100' },
            },
          }),
          fact('BRUM', {
            sortDate: {
              quality: 'exact',
              component: { calendar: 'french_republican', year: 2, month: 'BRUM', day: 1 },
            },
          }),
          fact('VEND', {
            sortDate: {
              quality: 'exact',
              component: { calendar: 'french_republican', year: 2, month: 'VEND', day: 1 },
            },
          }),
        ],
      });

      expect(fixture.repo.listFactsForPerson('P1').map((entry) => entry.id)).toEqual([
        'VEND',
        'BRUM',
        'EARLIER',
        'LATER',
      ]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('uses the end of an open range that has no usable start', () => {
    const fixture = makeRepo();
    try {
      fixture.repo.insertPerson({
        id: 'P1',
        names: [],
        sex: 'U',
        facts: [
          fact('OPEN', {
            sortDate: { quality: 'range', component: { month: 12, day: 31 }, end: { year: 1900 } },
          }),
          fact('PRIOR', { date: day(1899, 1, 1) }),
          fact('NEXT', { date: day(1901, 1, 1) }),
        ],
      });

      expect(fixture.repo.listFactsForPerson('P1').map((entry) => entry.id)).toEqual(['PRIOR', 'OPEN', 'NEXT']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('sorts AFT by the end of the year or month', () => {
    const fixture = makeRepo();
    try {
      fixture.repo.insertPerson({
        id: 'P1',
        names: [],
        sex: 'U',
        facts: [
          fact('YEAR_AFTER', { sortDate: { quality: 'after', component: { year: 1900 } } }),
          fact('MONTH_AFTER', {
            sortDate: { quality: 'after', component: { year: 1900, month: 2 } },
          }),
          fact('FEB_FIRST', { sortDate: day(1900, 2, 1) }),
          fact('FEB_LAST', { sortDate: day(1900, 2, 28) }),
          fact('JAN_LAST', { sortDate: day(1900, 1, 31) }),
        ],
      });

      expect(fixture.repo.listFactsForPerson('P1').map((entry) => entry.id)).toEqual([
        'JAN_LAST',
        'FEB_FIRST',
        'FEB_LAST',
        'MONTH_AFTER',
        'YEAR_AFTER',
      ]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('uses the Julian leap rule for an AFT month boundary', () => {
    const fixture = makeRepo();
    try {
      fixture.repo.insertPerson({
        id: 'P1',
        names: [],
        sex: 'U',
        facts: [
          fact('AFTER_FEB', {
            sortDate: {
              quality: 'after',
              component: { calendar: 'julian', year: 1900, month: 2 },
            },
          }),
          fact('FEB_29', {
            sortDate: { quality: 'exact', component: { calendar: 'julian', year: 1900, month: 2, day: 29 } },
          }),
        ],
      });

      expect(fixture.repo.listFactsForPerson('P1').map((entry) => entry.id)).toEqual(['FEB_29', 'AFTER_FEB']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('uses the final month of a thirteen-month calendar for an AFT year', () => {
    const fixture = makeRepo();
    try {
      fixture.repo.insertPerson({
        id: 'P1',
        names: [],
        sex: 'U',
        facts: [
          fact('YEAR_AFTER', {
            sortDate: { quality: 'after', component: { calendar: 'french_republican', year: 3 } },
          }),
          fact('COMP', {
            sortDate: {
              quality: 'exact',
              component: { calendar: 'french_republican', year: 3, month: 'COMP', day: 6 },
            },
          }),
        ],
      });

      expect(fixture.repo.listFactsForPerson('P1').map((entry) => entry.id)).toEqual(['COMP', 'YEAR_AFTER']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('ignores a sort date in an opaque extension calendar', () => {
    const fixture = makeRepo();
    try {
      fixture.repo.insertPerson({
        id: 'P1',
        names: [],
        sex: 'U',
        facts: [
          fact('OPAQUE', {
            date: day(1900, 1, 1),
            sortDate: { quality: 'exact', component: { calendar: 'ext_cal', year: 42 } },
          }),
          fact('EARLIER', { date: day(1899, 1, 1) }),
          fact('LATER', { date: day(1901, 1, 1) }),
        ],
      });

      expect(fixture.repo.listFactsForPerson('P1').map((entry) => entry.id)).toEqual(['EARLIER', 'OPAQUE', 'LATER']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('falls back to the display date when a hint month cannot be resolved', () => {
    const fixture = makeRepo();
    try {
      fixture.repo.insertPerson({
        id: 'P1',
        names: [],
        sex: 'U',
        facts: [
          fact('ALIAS_HINT', {
            date: day(1900, 3, 1),
            sortDate: { quality: 'exact', component: { year: 1900, month: '_MAR', day: 1 } },
          }),
          fact('FEBRUARY', { sortDate: day(1900, 2, 1) }),
        ],
      });

      expect(fixture.repo.listFactsForPerson('P1').map((entry) => entry.id)).toEqual(['FEBRUARY', 'ALIAS_HINT']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('uses the end time when a range sorts by its end', () => {
    const fixture = makeRepo();
    try {
      const range = mergeDateBounds(
        { quality: 'exact', component: { month: 5 }, time: { hour: 18, minute: 0 } },
        { quality: 'exact', component: { year: 1900, month: 6, day: 1 }, time: { hour: 9, minute: 0 } },
      );
      fixture.repo.insertPerson({
        id: 'P1',
        names: [],
        sex: 'U',
        facts: [fact('RANGE', { sortDate: range }), fact('NOON', { sortDate: day(1900, 6, 1, 12, 0) })],
      });

      expect(fixture.repo.listFactsForPerson('P1').map((entry) => entry.id)).toEqual(['RANGE', 'NOON']);
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
          fact('F3', { date: day(1902, 1, 1) }),
        ],
      });

      expect(fixture.repo.listFactsForPerson('P1').map((entry) => entry.id)).toEqual(['F2', 'F1', 'F3']);
    } finally {
      cleanupRepo(fixture);
    }
  });
});
