import { describe, expect, it } from 'vitest';
import { nls } from '../src/nls';

describe('features nls', () => {
  it('resolves a working locale from the environment', () => {
    expect(nls.locale).toMatch(/^[a-z]{2}(-[a-z]{2})?$/);
    expect(nls.t('app.name')).toBe('Dóru');
  });
});
