import { describe, expect, it } from 'vitest';
import { refineTreeQueryInput, repairToolInput } from '../src/agent';

describe('repairToolInput', () => {
  it('returns the intact JSON object when the rest parses', () => {
    expect(repairToolInput('{"query": "sex:M"}')).toBe('{"query": "sex:M"}');
  });

  it('drops trailing garbage after the object (small models append it)', () => {
    expect(repairToolInput('{"query": "sex:M"}]}.')).toBe('{"query": "sex:M"}');
  });

  it('skips filler text before the object', () => {
    expect(repairToolInput('here you go: {"a": 1} and more')).toBe('{"a": 1}');
  });

  it('handles nested objects and braces inside strings', () => {
    expect(repairToolInput('{"op": {"kind": "person.add"}, "note": "}"} trailing')).toBe(
      '{"op": {"kind": "person.add"}, "note": "}"}',
    );
  });

  it('returns null when no complete object exists', () => {
    expect(repairToolInput('not json at all')).toBeNull();
    expect(repairToolInput('{"unclosed": ')).toBeNull();
    expect(repairToolInput('')).toBeNull();
  });
});

describe('refineTreeQueryInput', () => {
  it('moves a "sex:M"-style query into the sex field', () => {
    expect(refineTreeQueryInput({ query: 'sex:M' })).toEqual({ sex: 'M' });
    expect(refineTreeQueryInput({ query: 'gender: female' })).toEqual({ sex: 'F' });
    expect(refineTreeQueryInput({ query: 'Sex = u' })).toEqual({ sex: 'U' });
  });

  it('keeps other fields while moving the filter', () => {
    expect(refineTreeQueryInput({ query: 'sex:m', limit: 5 })).toEqual({ sex: 'M', limit: 5 });
  });

  it('passes ordinary queries and inputs through', () => {
    expect(refineTreeQueryInput({ query: 'Ivan' })).toEqual({ query: 'Ivan' });
    expect(refineTreeQueryInput({ sex: 'F' })).toEqual({ sex: 'F' });
    expect(refineTreeQueryInput({})).toEqual({});
    expect(refineTreeQueryInput('not an object')).toBe('not an object');
    expect(refineTreeQueryInput(null)).toBeNull();
  });
});
