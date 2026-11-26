import { describe, expect, it } from 'vitest';
import { parseGedcom551 } from '../src/parsing/assemble';
import { serializeGedcom551 } from '../src/serialize/serialize';
import type { GedcomDataset, IndividualRecord } from '../src/structures';

const HEADER = ['0 HEAD', '1 GEDC', '2 VERS 5.5.1', '1 CHAR UTF-8'];
const TRAILER = ['0 TRLR'];

function parseFixture(lines: string[]): { dataset: GedcomDataset; individual: IndividualRecord } {
  const parsed = parseGedcom551(new TextEncoder().encode([...HEADER, ...lines, ...TRAILER].join('\n')));
  if (!parsed.ok) {
    throw new Error('fixture failed to parse');
  }
  const dataset = parsed.value;
  const individual = dataset.records.find((record): record is IndividualRecord => record.tag === 'INDI');
  if (individual === undefined) {
    throw new Error('fixture has no INDI record');
  }
  return { dataset, individual };
}

function serialize551(dataset: GedcomDataset): string {
  const serialized = serializeGedcom551(dataset);
  if (!serialized.ok) {
    throw new Error(serialized.error.message);
  }
  return serialized.value;
}

describe('individual contact projection', () => {
  it('keeps the address note under ADDR when contact siblings are written', () => {
    const { dataset } = parseFixture([
      '0 @I1@ INDI',
      '1 NAME Ivan /Petrov/',
      '1 ADDR Main St',
      '2 NOTE address note',
      '1 PHON 123',
    ]);
    const text = serialize551(dataset);

    expect(text).toContain('1 ADDR Main St');
    expect(text).toContain('2 NOTE address note');
    expect(text).toContain('1 PHON 123');
    expect(text.indexOf('2 NOTE address note')).toBeLessThan(text.indexOf('1 PHON 123'));
  });

  it('merges distinct address and record contact values', () => {
    const { dataset } = parseFixture([
      '0 @I1@ INDI',
      '1 NAME Ivan /Petrov/',
      '1 ADDR Main St',
      '2 EMAIL address@example.org',
      '1 EMAIL record@example.org',
    ]);
    const text = serialize551(dataset);

    expect(text).toContain('1 EMAIL address@@example.org');
    expect(text).toContain('1 EMAIL record@@example.org');
  });

  it('does not let an empty address array suppress record contacts', () => {
    const { dataset, individual } = parseFixture([
      '0 @I1@ INDI',
      '1 NAME Ivan /Petrov/',
      '1 ADDR Main St',
      '1 EMAIL record@example.org',
    ]);
    individual.address!.email = [];
    const text = serialize551(dataset);

    expect(text).toContain('1 EMAIL record@@example.org');
  });

  it('writes repeated person websites into the 5.5.1 address block', () => {
    const { dataset } = parseFixture([
      '0 @I1@ INDI',
      '1 NAME Ivan /Petrov/',
      '1 ADDR Main St',
      '2 WWW https://one.example',
      '2 WWW https://two.example',
    ]);
    const text = serialize551(dataset);

    expect(text).toContain('1 WWW https://one.example');
    expect(text).toContain('1 WWW https://two.example');
  });
});
