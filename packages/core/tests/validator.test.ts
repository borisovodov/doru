import { describe, expect, it } from 'vitest';
import { emptyDocument } from '../src/model/types';
import { detectParentCycles } from '../src/validate/validator';

describe('detectParentCycles', () => {
  it('finds a person who is their own ancestor', () => {
    const doc = emptyDocument();
    doc.persons.set('A', { id: 'A', names: [], sex: 'U' });
    doc.persons.set('B', { id: 'B', names: [], sex: 'U' });
    doc.families.set('F1', { id: 'F1', parents: ['B'], children: ['A'] });
    doc.families.set('F2', { id: 'F2', parents: ['A'], children: ['B'] });

    const issues = detectParentCycles(doc);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]?.kind).toBe('person.cycle');
    expect(issues[0]?.ids).toContain('A');
  });

  it('reports nothing for an acyclic tree', () => {
    const doc = emptyDocument();
    doc.persons.set('A', { id: 'A', names: [], sex: 'U' });
    doc.persons.set('B', { id: 'B', names: [], sex: 'U' });
    doc.families.set('F1', { id: 'F1', parents: ['B'], children: ['A'] });

    expect(detectParentCycles(doc)).toEqual([]);
  });
});
