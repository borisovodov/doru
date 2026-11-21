import { describe, expect, it } from 'vitest';
import { canonicalizeTaskStatus, normalizeTaskStatus } from '../src/model/types';

describe('task status mapping', () => {
  it('maps the statuses found in the GEDCOM corpus', () => {
    expect(canonicalizeTaskStatus('Open')).toBe('open');
    expect(canonicalizeTaskStatus('Completed')).toBe('closed');
    expect(canonicalizeTaskStatus('INPROGRESS')).toBe('in-progress');
    expect(canonicalizeTaskStatus('InProgress')).toBe('in-progress');
  });

  it('maps common spelling and case variants', () => {
    expect(canonicalizeTaskStatus('in progress')).toBe('in-progress');
    expect(canonicalizeTaskStatus('in_progress')).toBe('in-progress');
    expect(canonicalizeTaskStatus('on hold')).toBe('waiting');
    expect(canonicalizeTaskStatus('done')).toBe('closed');
    expect(canonicalizeTaskStatus('complete')).toBe('closed');
  });

  it('keeps unknown text unmapped and treats it as open for display', () => {
    expect(canonicalizeTaskStatus('needs review')).toBeUndefined();
    expect(canonicalizeTaskStatus('constructor')).toBeUndefined();
    expect(normalizeTaskStatus('needs review')).toBe('open');
    expect(normalizeTaskStatus('constructor')).toBe('open');
    expect(normalizeTaskStatus(undefined)).toBe('open');
    expect(normalizeTaskStatus('')).toBe('open');
  });
});
