import { describe, expect, test } from 'vitest';
import { Writer } from '../src/serialize/writer';
import {
  calendarEscape551,
  epochSuffix,
  formatAge551,
  formatAge70,
  formatDateExact,
  formatDateFields,
  formatDateValue551,
  formatDateValue70,
  formatName551,
  formatName70,
  formatTime,
} from '../src/serialize/format';
import {
  famcStat,
  language,
  medi551,
  mediaType,
  ordStat,
  pedigree,
  ptr,
  restrictionList,
  sex,
} from '../src/serialize/emitter/values';

describe('Writer (7.0)', () => {
  test('escapes a leading at-sign unless it is a pointer', () => {
    const w = new Writer('7.0');
    w.line(1, 'NOTE', { value: '@me and @I' });
    w.line(1, 'NOTE', { value: '@I1@' });
    w.line(1, 'NOTE', { value: '@VOID@' });
    expect(w.lines).toEqual(['1 NOTE @@me and @I', '1 NOTE @I1@', '1 NOTE @VOID@']);
  });

  test('splits multiline payloads with CONT and escapes a leading at-sign per part', () => {
    const w = new Writer('7.0');
    w.line(0, 'NOTE', { value: 'first\n@second\nthird\n' });
    expect(w.lines).toEqual(['0 NOTE first', '1 CONT @@second', '1 CONT third', '1 CONT']);
  });

  test('writes an empty payload as a bare tag', () => {
    const w = new Writer('7.0');
    w.line(1, 'NOTE', { value: '' });
    expect(w.lines).toEqual(['1 NOTE']);
  });

  test('writes xrefs', () => {
    const w = new Writer('7.0');
    w.line(0, 'INDI', { xref: '@I1@' });
    expect(w.lines).toEqual(['0 @I1@ INDI']);
  });
});

describe('Writer (5.5.1)', () => {
  test('keeps pointer values verbatim', () => {
    const w = new Writer('5.5.1');
    w.line(1, 'SOUR', { value: '@S1@' });
    w.line(1, 'SUBM', { value: '@VOID@' });
    expect(w.lines).toEqual(['1 SOUR @S1@', '1 SUBM @VOID@']);
  });

  test('doubles at-signs but preserves escape sequences', () => {
    const w = new Writer('5.5.1');
    w.line(1, 'DATE', { value: '@#DJULIAN@ 5 OCT 1582' });
    w.line(1, 'NOTE', { value: 'a@b' });
    expect(w.lines).toEqual(['1 DATE @#DJULIAN@ 5 OCT 1582', '1 NOTE a@@b']);
  });

  test('keeps an unterminated escape verbatim', () => {
    const w = new Writer('5.5.1');
    w.line(1, 'NOTE', { value: '@#DNOPE' });
    expect(w.lines).toEqual(['1 NOTE @#DNOPE']);
  });

  test('splits long values with CONC at the limit', () => {
    const w = new Writer('5.5.1');
    // '1 NOTE ' prefix is 6 chars; the payload limit is 255 - 7 = 248.
    w.line(1, 'NOTE', { value: 'x'.repeat(500) });
    expect(w.lines).toHaveLength(3);
    expect(w.lines[0]).toBe(`1 NOTE ${'x'.repeat(248)}`);
    expect(w.lines[1]).toBe(`2 CONC ${'x'.repeat(248)}`);
    expect(w.lines[2]).toBe(`2 CONC ${'x'.repeat(4)}`);
  });

  test('does not split mid-word when the cut lands on spaces', () => {
    const w = new Writer('5.5.1');
    w.line(1, 'NOTE', { value: `${'a'.repeat(246)}   bbb` });
    // The cut at 248 lands on spaces; it walks back to the non-space.
    expect(w.lines[0]).toBe(`1 NOTE ${'a'.repeat(245)}`);
    expect(w.lines[1]).toBe('2 CONC a   bbb');
  });

  test('falls back to the hard limit for an all-space segment', () => {
    const w = new Writer('5.5.1');
    w.line(1, 'NOTE', { value: `${' '.repeat(300)}end` });
    expect(w.lines[0]).toBe(`1 NOTE ${' '.repeat(248)}`);
    expect(w.lines[1]).toBe(`2 CONC ${' '.repeat(52)}end`);
  });

  test('splits long CONT parts with CONC', () => {
    const w = new Writer('5.5.1');
    w.line(0, 'NOTE', { value: `first\n${'y'.repeat(500)}` });
    // 1 CONT prefix is 6 chars; the CONT payload limit is 255 - 7 = 248.
    expect(w.lines[0]).toBe('0 NOTE first');
    expect(w.lines[1]).toBe(`1 CONT ${'y'.repeat(248)}`);
    expect(w.lines[2]).toBe(`2 CONC ${'y'.repeat(248)}`);
    expect(w.lines[3]).toBe(`2 CONC ${'y'.repeat(4)}`);
  });

  test('splits a CONT part at a non-space position', () => {
    const w = new Writer('5.5.1');
    w.line(0, 'NOTE', { value: `first\n${'a'.repeat(246)}   b` });
    expect(w.lines[1]).toBe(`1 CONT ${'a'.repeat(245)}`);
    expect(w.lines[2]).toBe('2 CONC a   b');
  });

  test('emits an empty CONT part as a bare CONT', () => {
    const w = new Writer('5.5.1');
    w.line(0, 'NOTE', { value: 'first\n' });
    expect(w.lines).toEqual(['0 NOTE first', '1 CONT']);
  });
});

describe('value formatting', () => {
  test('calendarEscape551', () => {
    expect(calendarEscape551('GREGORIAN')).toBe('');
    expect(calendarEscape551('JULIAN')).toBe('@#DJULIAN@ ');
    expect(calendarEscape551('FRENCH_R')).toBe('@#DFRENCH R@ ');
    expect(calendarEscape551('HEBREW')).toBe('@#DHEBREW@ ');
    expect(calendarEscape551('_EXT' as never)).toBe('');
  });

  test('epochSuffix', () => {
    expect(epochSuffix(undefined, '7.0')).toBe('');
    expect(epochSuffix('BCE', '7.0')).toBe(' BCE');
    expect(epochSuffix('BCE', '5.5.1')).toBe(' B.C.');
  });

  test('formatDateFields', () => {
    expect(formatDateFields({ year: 1900 }, '7.0')).toBe('1900');
    expect(formatDateFields({ calendar: 'HEBREW', month: 'TSH', year: 5750 }, '7.0')).toBe('HEBREW TSH 5750');
    expect(formatDateFields({ calendar: 'JULIAN', day: 5, month: 'OCT', year: 1582 }, '5.5.1')).toBe('@#DJULIAN@ 5 OCT 1582');
    expect(formatDateFields({ calendar: 'FRENCH_R', day: 5, month: 'VEND', year: 8, epoch: 'BCE' }, '5.5.1')).toBe('@#DFRENCH R@ 5 VEND 8 B.C.');
  });

  test('formatDateValue70 covers every variant', () => {
    expect(formatDateValue70({ kind: 'date', calendar: 'GREGORIAN', year: 1900 })).toBe('1900');
    expect(
      formatDateValue70({ kind: 'range', start: { calendar: 'GREGORIAN', year: 1900 }, end: { calendar: 'GREGORIAN', year: 1910 } }),
    ).toBe('BET 1900 AND 1910');
    expect(formatDateValue70({ kind: 'bound', modifier: 'AFT', date: { calendar: 'GREGORIAN', year: 1900 } })).toBe('AFT 1900');
    expect(formatDateValue70({ kind: 'approx', modifier: 'ABT', date: { calendar: 'GREGORIAN', year: 1900 } })).toBe('ABT 1900');
    expect(
      formatDateValue70({ kind: 'period', from: { calendar: 'GREGORIAN', year: 1900 }, to: { calendar: 'GREGORIAN', year: 1910 } }),
    ).toBe('FROM 1900 TO 1910');
    expect(formatDateValue70({ kind: 'period', from: { calendar: 'GREGORIAN', year: 1900 } })).toBe('FROM 1900');
    expect(formatDateValue70({ kind: 'period', to: { calendar: 'GREGORIAN', year: 1900 } })).toBe('TO 1900');
    expect(formatDateValue70({ kind: 'period' })).toBe('');
    expect(formatDateValue70({ kind: 'unknown' })).toBe('');
  });

  test('formatDateValue551 covers every variant', () => {
    expect(formatDateValue551({ kind: 'date', calendar: 'JULIAN', year: 1582 })).toBe('@#DJULIAN@ 1582');
    expect(
      formatDateValue551({ kind: 'range', start: { calendar: 'GREGORIAN', year: 1900 }, end: { calendar: 'GREGORIAN', year: 1910 } }),
    ).toBe('BET 1900 AND 1910');
    expect(formatDateValue551({ kind: 'bound', modifier: 'BEF', date: { calendar: 'GREGORIAN', year: 1900 } })).toBe('BEF 1900');
    expect(formatDateValue551({ kind: 'approx', modifier: 'EST', date: { calendar: 'GREGORIAN', year: 1900 } })).toBe('EST 1900');
    expect(
      formatDateValue551({ kind: 'period', from: { calendar: 'GREGORIAN', year: 1900 }, to: { calendar: 'GREGORIAN', year: 1910 } }),
    ).toBe('FROM 1900 TO 1910');
    expect(formatDateValue551({ kind: 'period', from: { calendar: 'GREGORIAN', year: 1900 } })).toBe('FROM 1900');
    expect(formatDateValue551({ kind: 'period', to: { calendar: 'GREGORIAN', year: 1900 } })).toBe('TO 1900');
    expect(formatDateValue551({ kind: 'period' })).toBe('');
    expect(formatDateValue551({ kind: 'unknown' })).toBe('');
  });

  test('formatDateExact', () => {
    expect(formatDateExact({ day: 1, month: 'JAN', year: 1900 }, '7.0')).toBe('1 JAN 1900');
    // GEDCOM 7.0 §2.4 DateExact = day month year has no epoch production:
    // an epoch on the model value is not emitted (the output always
    // matches the grammar).
    expect(formatDateExact({ day: 1, month: 'JAN', year: 44, epoch: 'BCE' }, '7.0')).toBe('1 JAN 44');
    expect(formatDateExact({ day: 1, month: 'JAN', year: 44, epoch: 'BCE' }, '5.5.1')).toBe('1 JAN 44 B.C.');
  });

  test('formatTime', () => {
    expect(formatTime({ hour: 10, minute: 30 }, '7.0')).toBe('10:30');
    expect(formatTime({ hour: 10, minute: 30, second: 5, fraction: '25' }, '7.0')).toBe('10:30:5.25');
    expect(formatTime({ hour: 10, minute: 30, second: 5, fraction: '25', utc: true }, '7.0')).toBe('10:30:5.25Z');
    expect(formatTime({ hour: 10, minute: 30, second: 5, utc: true }, '5.5.1')).toBe('10:30:5');
  });

  test('formatAge70 and formatAge551', () => {
    // GEDCOM 7.0 §2.6 `Age = [[ageBound D] ageDuration]`: the bound is
    // separated from the duration by a space.
    expect(formatAge70({ years: 5, months: 3, weeks: 2, days: 1, bound: '<' })).toBe('< 5y 3m 2w 1d');
    expect(formatAge70({ bound: '>' })).toBe('>');
    expect(formatAge551({ description: 'CHILD' })).toBe('CHILD');
    expect(formatAge551({ years: 5, months: 3, days: 1, bound: '>' })).toBe('>5y 3m 1d');
    expect(formatAge551({ weeks: 2 })).toBe('');
  });

  test('formatName70 and formatName551', () => {
    expect(formatName70({ given: 'Ivan', surname: 'Ivanov', suffix: 'Jr' })).toBe('Ivan/Ivanov/Jr');
    expect(formatName70({})).toBe('//');
    expect(formatName551({ given: 'Ivan' })).toBe('Ivan//');
    expect(formatName551({ surname: 'Ivanov' })).toBe('/Ivanov/');
  });
});

describe('value spellings', () => {
  test('restrictionList lowercases for 5.5.1', () => {
    expect(restrictionList(new Writer('7.0'), '7.0', ['CONFIDENTIAL'])).toBe('CONFIDENTIAL');
    expect(restrictionList(new Writer('5.5.1'), '5.5.1', ['CONFIDENTIAL'])).toBe('confidential');
  });

  test('pedigree', () => {
    expect(pedigree(new Writer('7.0'), '7.0', 'ADOPTED')).toBe('ADOPTED');
    expect(pedigree(new Writer('5.5.1'), '5.5.1', 'ADOPTED')).toBe('adopted');
    expect(pedigree(new Writer('5.5.1'), '5.5.1', 'OTHER')).toBeUndefined();
  });

  test('famcStat', () => {
    expect(famcStat(new Writer('7.0'), '7.0', 'PROVEN')).toBe('PROVEN');
    expect(famcStat(new Writer('5.5.1'), '5.5.1', 'PROVEN')).toBe('proven');
  });

  test('sex drops X for 5.5.1', () => {
    expect(sex(new Writer('7.0'), '7.0', 'X')).toBe('X');
    expect(sex(new Writer('5.5.1'), '5.5.1', 'X')).toBeUndefined();
    expect(sex(new Writer('5.5.1'), '5.5.1', 'M')).toBe('M');
  });

  test('ordStat spellings', () => {
    expect(ordStat(new Writer('7.0'), '7.0', 'PRE_1970')).toBe('PRE_1970');
    expect(ordStat(new Writer('5.5.1'), '5.5.1', 'PRE_1970')).toBe('PRE-1970');
    expect(ordStat(new Writer('5.5.1'), '5.5.1', 'DNS_CAN')).toBe('DNS/CAN');
    expect(ordStat(new Writer('5.5.1'), '5.5.1', 'INFANT')).toBeUndefined();
    expect(ordStat(new Writer('5.5.1'), '5.5.1', 'COMPLETED')).toBe('COMPLETED');
  });

  test('medi551', () => {
    expect(medi551(new Writer('5.5.1'), '5.5.1', 'OTHER')).toBeUndefined();
    expect(medi551(new Writer('5.5.1'), '5.5.1', 'AUDIO')).toBe('audio');
  });

  test('mediaType', () => {
    expect(mediaType(new Writer('7.0'), '7.0', 'image/jpeg')).toBe('image/jpeg');
    expect(mediaType(new Writer('5.5.1'), '5.5.1', 'jpg')).toBe('jpg');
    expect(mediaType(new Writer('5.5.1'), '5.5.1', 'image/jpeg')).toBe('jpg');
    expect(mediaType(new Writer('5.5.1'), '5.5.1', 'application/pdf')).toBeUndefined();
  });

  test('language', () => {
    expect(language(new Writer('7.0'), '7.0', 'ru')).toBe('ru');
    expect(language(new Writer('5.5.1'), '5.5.1', 'English')).toBe('English');
    expect(language(new Writer('5.5.1'), '5.5.1', 'ru')).toBe('Russian');
    expect(language(new Writer('5.5.1'), '5.5.1', 'xx-unknown')).toBeUndefined();
  });

  test('ptr handles void pointers for 5.5.1', () => {
    const w = new Writer('5.5.1');
    ptr(w, '5.5.1', 1, 'REPO', '@VOID@');
    ptr(w, '5.5.1', 1, 'REPO', '@R1@');
    ptr(w, '7.0', 1, 'REPO', '@VOID@');
    expect(w.lines).toEqual(['1 REPO @R1@', '1 REPO @VOID@']);
  });
});
