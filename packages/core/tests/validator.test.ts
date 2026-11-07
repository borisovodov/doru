import { describe, expect, it } from 'vitest';
import { emptyDocument } from '../src/model/types';
import { detectParentCycles } from '../src/validate/validator';

const person = (id: string) => ({ id, names: [], sex: 'U' as const, facts: [] });

describe('detectParentCycles', () => {
  it('finds a person who is their own ancestor', () => {
    const doc = emptyDocument();
    doc.persons.set('A', person('A'));
    doc.persons.set('B', person('B'));
    doc.families.set('F1', { id: 'F1', partners: ['B'], children: ['A'] });
    doc.families.set('F2', { id: 'F2', partners: ['A'], children: ['B'] });

    const issues = detectParentCycles(doc);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]?.kind).toBe('person.cycle');
    expect(issues[0]?.ids).toContain('A');
  });

  it('reports nothing for an acyclic tree', () => {
    const doc = emptyDocument();
    doc.persons.set('A', person('A'));
    doc.persons.set('B', person('B'));
    doc.families.set('F1', { id: 'F1', partners: ['B'], children: ['A'] });

    expect(detectParentCycles(doc)).toEqual([]);
  });
});
