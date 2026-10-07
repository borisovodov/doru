import { describe, expect, it } from 'vitest';
import { LocalizationService, resolveLocale } from '../src/nls';

describe('resolveLocale', () => {
  it('resolves exact and regional locales', () => {
    expect(resolveLocale('en-US')).toBe('en');
    expect(resolveLocale('ru-RU')).toBe('ru');
    expect(resolveLocale('de-DE')).toBe('de');
    expect(resolveLocale('fr')).toBe('fr');
  });

  it('maps language families to the matching bundle', () => {
    expect(resolveLocale('pt-BR')).toBe('pt-br');
    expect(resolveLocale('pt-PT')).toBe('pt-br');
    expect(resolveLocale('zh-CN')).toBe('zh-cn');
    expect(resolveLocale('zh-Hans')).toBe('zh-cn');
    expect(resolveLocale('zh-TW')).toBe('zh-tw');
    expect(resolveLocale('zh-Hant')).toBe('zh-tw');
  });

  it('falls back to English for unknown locales', () => {
    expect(resolveLocale('xx-XX')).toBe('en');
    expect(resolveLocale('')).toBe('en');
  });
});

describe('LocalizationService', () => {
  it('falls back to the English source text for missing keys', () => {
    const service = new LocalizationService('ru');
    expect(service.t('app.name')).toBe('Doru');
    expect(service.t('workbench.undo')).toBe('Отменить');
    service.setLocale('en');
    expect(service.t('workbench.undo')).toBe('Undo');
  });

  it('interpolates arguments', () => {
    const service = new LocalizationService('en');
    expect(service.t('features.tree.importResult', 12, 3)).toBe('Imported 12 persons and 3 families');
  });
});
