import { describe, expect, test } from 'vitest';
import { parseGedcom551 } from '../src/parsing/assemble';
import { serializeGedcom551 } from '../src/serialize/serialize';
import type { GedcomDataset } from '../src/structures';

const ascii = (s: string): number[] => [...new TextEncoder().encode(s)];

/** A 5.5.1 document with the given CHAR value and the name payload as raw bytes. */
function documentWith(charset: string, nameBytes: number[]): Uint8Array {
  const head = ascii(`0 HEAD\n1 SOUR X\n1 SUBM @S1@\n1 GEDC\n2 VERS 5.5.1\n2 FORM LINEAGE-LINKED\n1 CHAR ${charset}\n0 @S1@ SUBM\n1 NAME T\n0 @I1@ INDI\n1 NAME `);
  const tail = ascii('\n0 TRLR\n');
  return new Uint8Array([...head, ...nameBytes, ...tail]);
}

function namesOf(dataset: GedcomDataset): string[] {
  const record = dataset.records.find((r) => r.xref === '@I1@');
  if (record === undefined || record.tag !== 'INDI') {
    throw new Error('expected @I1@ INDI');
  }
  return (record.names ?? []).map((name) =>
    [name.payload.given, name.payload.surname].filter((part) => part !== '').join(' ').trim(),
  );
}

function expectName(charset: string, nameBytes: number[], expected: string): void {
  const result = parseGedcom551(documentWith(charset, nameBytes));
  if (!result.ok) {
    throw new Error(JSON.stringify(result.error));
  }
  expect(namesOf(result.value)).toEqual([expected]);
  const serialized = serializeGedcom551(result.value);
  if (!serialized.ok) {
    throw new Error(JSON.stringify(serialized.error));
  }
  // The 5.5.1 serializer writes names in the slashed form (given/surname/);
  // the point here is that the decoded Unicode text survives into the
  // always-UTF-8 export.
  for (const part of expected.split(' ')) {
    expect(serialized.value).toContain(part);
  }
}

describe('the out-of-spec 5.5.1 charsets', () => {
  test('CP1252 (CHAR ANSI): curly quotes and accents', () => {
    // 0x93 = “, 0x94 = ”, 0xE9 = é, 0xF4 = ô.
    expectName('ANSI', [0x93, ...ascii('J'), 0xe9, ...ascii('r'), 0xf4, ...ascii('me'), 0x94, ...ascii(' /Doe/')], '\u201cJ\u00e9r\u00f4me\u201d Doe');
  });

  test('CP1252 byte holes decode to the C1 controls of the same number', () => {
    // 0x81 is undefined in CP1252; the Windows/Python cp1252 tables
    // map it to U+0081, and files in the wild carry it.
    expectName('ANSI', [...ascii('Jo'), 0x81], `Jo${'\u0081'}`);
  });

  test('CP850 (CHAR IBM-PC): the DOS e-acute', () => {
    expectName('IBM-PC', ascii('Jos') .concat([0x82]) .concat(ascii(' /Doe/')), 'Jos\u00e9 Doe');
  });

  test('CP850 (CHAR DOS)', () => {
    expectName('DOS', ascii('Jos') .concat([0x82]) .concat(ascii(' /Doe/')), 'Jos\u00e9 Doe');
  });

  test('Mac Roman (CHAR MACINTOSH): the Mac e-acute', () => {
    expectName('MACINTOSH', ascii('Jos') .concat([0x8e]) .concat(ascii(' /Doe/')), 'Jos\u00e9 Doe');
  });

  test('WINDOWS-1252 is an alias of CP1252', () => {
    expectName('WINDOWS-1252', [...ascii('Jos'), 0xe9, ...ascii(' /Doe/')], 'Jos\u00e9 Doe');
  });

  test('the spec charsets still work', () => {
    // ANSEL: 0xE2 is the combining acute, followed by the base 'e' (0x65).
    expectName('ANSEL', [...ascii('Jos'), 0xe2, 0x65, ...ascii(' /Doe/')], 'Jos\u00e9 Doe');
    expectName('UTF-8', ascii('Jos\u00e9 /Doe/'), 'Jos\u00e9 Doe');
    expectName('ASCII', ascii('Jose /Doe/'), 'Jose Doe');
  });

  test('a genuinely unknown charset is still rejected', () => {
    const result = parseGedcom551(documentWith('EBCDIC', ascii('Jose /Doe/')));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('decoding.unknown-charset');
    }
  });

  test('the utf8bom spelling is UTF-8', () => {
    expectName('utf8bom', ascii('Jos\u00e9 /Doe/'), 'Jos\u00e9 Doe');
  });

  test('a letterless CHAR value decodes as CP1252', () => {
    // The lifelines exports carry a lone euro marker byte as the CHAR
    // value: it names no character set, and CP1252 maps every byte.
    expectName('\u20ac', ascii('Jose /Doe/'), 'Jose Doe');
  });
});

describe('the mislabeled-ASCII western fallback', () => {
  /** A 5.5.1 ASCII-declared document whose NOTE lines carry the given raw bytes. */
  function asciiDocWith(noteLines: number[][]): Uint8Array {
    const head = ascii('0 HEAD\n1 SOUR X\n1 SUBM @S1@\n1 GEDC\n2 VERS 5.5.1\n2 FORM LINEAGE-LINKED\n1 CHAR ASCII\n0 @S1@ SUBM\n1 NAME T\n0 @I1@ INDI\n1 NAME A /B/\n');
    const parts: number[] = [...head];
    noteLines.forEach((bytes, i) => {
      parts.push(...ascii(`1 NOTE n${i} `), ...bytes, ...ascii('\n'));
    });
    parts.push(...ascii('0 TRLR\n'));
    return new Uint8Array(parts);
  }

  test('systematic Latin-1 bytes under CHAR ASCII decode as windows-1252', () => {
    // The gramps import test corpus (data/tests/imp/Latin_1_*.ged):
    // French accents written in Latin-1 under an ASCII declaration —
    // every high-byte line fails ASCII, the document is really
    // windows-1252, and nothing is recorded.
    const lines: number[][] = [];
    for (let i = 0; i < 12; i++) {
      lines.push([...ascii('Jos'), 0xe9, ...ascii(' /Doe/')]);
    }
    const result = parseGedcom551(asciiDocWith(lines));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const record = result.value.records.find((r) => r.xref === '@I1@');
    if (record?.tag !== 'INDI') {
      throw new Error('expected @I1@ INDI');
    }
    expect(record.notes?.length).toBe(12);
    const first = record.notes?.[0];
    expect(first && 'payload' in first ? first.payload : '').toBe('n0 Jos\u00e9 /Doe/');
  });

  test('a few stray high bytes keep their decoding errors', () => {
    // Below the fallback threshold the honest report stands (the
    // TGC551 torture-test rule).
    const lines: number[][] = [[...ascii('ok')], [...ascii('Jos'), 0xe9], [...ascii('fine')]];
    const bytes = asciiDocWith(lines);
    const strict = parseGedcom551(bytes);
    expect(strict.ok).toBe(false);
    if (!strict.ok) {
      expect(strict.error.code).toBe('decoding.invalid-ansel');
    }
  });
});
