import { describe, expect, it } from 'vitest';
import { normalizeTaskPriority } from '../src/model/types';

describe('task priority mapping', () => {
  it('maps the priorities found in the GEDCOM corpus', () => {
    expect(normalizeTaskPriority('HIGH')).toBe('high');
    expect(normalizeTaskPriority('High')).toBe('high');
    expect(normalizeTaskPriority('normal')).toBe('medium');
    expect(normalizeTaskPriority('1')).toBe('high');
    expect(normalizeTaskPriority('5')).toBe('medium');
    expect(normalizeTaskPriority('8')).toBe('low');
  });

  it('treats empty, missing, and unknown priorities as medium', () => {
    expect(normalizeTaskPriority(undefined)).toBe('medium');
    expect(normalizeTaskPriority('')).toBe('medium');
    expect(normalizeTaskPriority('needs review')).toBe('medium');
  });
});
