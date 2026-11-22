import { afterEach, describe, expect, it } from 'vitest';
import { getSystemLocale, normalizeSystemLocale, setSystemLocale } from '../src/system-locale';

afterEach(() => {
  setSystemLocale(undefined);
});

describe('normalizeSystemLocale', () => {
  it('folds the macOS ICU region override into a BCP 47 region', () => {
    expect(normalizeSystemLocale('en-US@rg=ruzzzz')).toBe('en-RU');
    expect(normalizeSystemLocale('en@rg=gbzzzz')).toBe('en-GB');
  });

  it('returns plain language tags unchanged', () => {
    expect(normalizeSystemLocale('en-US')).toBe('en-US');
    expect(normalizeSystemLocale('ru-RU')).toBe('ru-RU');
    expect(normalizeSystemLocale('de')).toBe('de');
  });

  it('converts POSIX spellings reported by Linux', () => {
    expect(normalizeSystemLocale('en_US.UTF-8')).toBe('en-US');
    expect(normalizeSystemLocale('ru_RU.UTF-8')).toBe('ru-RU');
    expect(normalizeSystemLocale('de_DE@euro')).toBe('de-DE');
    expect(normalizeSystemLocale('en_GB.utf8@rg=ruzzzz')).toBe('en-RU');
  });
});

describe('system locale', () => {
  it('starts empty and stores the value reported by the main process', () => {
    expect(getSystemLocale()).toBeUndefined();
    setSystemLocale('en-US@rg=ruzzzz');
    expect(getSystemLocale()).toBe('en-US@rg=ruzzzz');
    setSystemLocale(undefined);
    expect(getSystemLocale()).toBeUndefined();
  });
});
