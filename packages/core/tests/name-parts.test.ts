import { describe, expect, it } from 'vitest';
import { partsFromFlat } from '../src/db/nameRepo';

describe('name parts', () => {
  it('keeps the id of the part that supplied an edited flat field', () => {
    const parts = partsFromFlat({ id: 'N1', given: 'Jane', surname: 'Doe' }, [
      { id: 'A', kind: 'given', value: 'Mary', position: 0 },
      { id: 'B', kind: 'given', value: 'Jane', position: 1 },
      { id: 'S', kind: 'surname', value: 'Doe', position: 2 },
    ]);
    expect(parts.find((part) => part.kind === 'given')?.id).toBe('A');
  });
});
