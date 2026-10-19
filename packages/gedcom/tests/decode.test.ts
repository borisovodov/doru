import { describe, expect, test } from 'vitest';
import { decodeDocument, detectCharset551 } from '../src/parsing/decode';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function expectOk<T>(result: { ok: boolean; value?: T; error?: unknown }): T {
  if (!result.ok) {
    throw new Error(`expected success, got: ${JSON.stringify(result)}`);
  }
  return result.value as T;
}

function expectErr(result: { ok: boolean; error?: { code: string } }): string {
  if (result.ok) {
    throw new Error('expected an error');
  }
  return (result.error as { code: string }).code;
}

describe('decodeDocument (7.0 UTF-8)', () => {
  test('decodes plain UTF-8 lines with offsets', () => {
    const result = expectOk(decodeDocument(enc('0 HEAD\n1 GEDC\n0 TRLR\n'), '7.0'));
    expect(result.lines).toHaveLength(3);
    expect(result.lines[0]).toEqual({ text: '0 HEAD', line: 1, offset: 0 });
    expect(result.lines[1]).toEqual({ text: '1 GEDC', line: 2, offset: 7 });
    expect(result.lines[2]).toEqual({ text: '0 TRLR', line: 3, offset: 14 });
  });

  test('strips the BOM on the first line only', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...enc('0 HEAD\n0 TRLR\n')]);
    const result = expectOk(decodeDocument(bytes, '7.0'));
    expect(result.lines[0]?.text).toBe('0 HEAD');
  });

  test('rejects a BOM on a later line', () => {
    const bytes = new Uint8Array([...enc('0 HEAD\n'), 0xef, 0xbb, 0xbf, ...enc('0 TRLR\n')]);
    expect(expectErr(decodeDocument(bytes, '7.0'))).toBe('decoding.bom');
  });

  test('rejects invalid UTF-8 with the line position', () => {
    const bytes = new Uint8Array([...enc('0 HEAD\n'), 0x66, 0xff, 0x21, ...enc('\n0 TRLR\n')]);
    const result = decodeDocument(bytes, '7.0');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('decoding.invalid-utf8');
      expect(result.error.position?.line).toBe(2);
      expect(result.error.position?.offset).toBe(7);
    }
  });

  test('handles CR, LF and CRLF terminators uniformly', () => {
    const result = expectOk(decodeDocument(enc('0 HEAD\r1 GEDC\r\n0 TRLR\n'), '7.0'));
    expect(result.lines.map((line) => line.text)).toEqual(['0 HEAD', '1 GEDC', '0 TRLR']);
  });
});

describe('detectCharset551', () => {
  test('reads CHAR from the header', () => {
    expect(expectOk(detectCharset551(enc('0 HEAD\n1 CHAR ANSEL\n0 TRLR')))).toBe('ANSEL');
  });

  test('is case-insensitive and trims', () => {
    expect(expectOk(detectCharset551(enc('0 HEAD\n1 CHAR utf-8\n0 TRLR')))).toBe('UTF-8');
  });

  test('stops scanning at the first record', () => {
    const result = detectCharset551(enc('0 HEAD\n0 @I1@ INDI\n1 CHAR ANSEL\n0 TRLR'));
    expect(expectErr(result)).toBe('decoding.missing-charset');
  });

  test('reports a missing CHAR tag', () => {
    expect(expectErr(detectCharset551(enc('0 HEAD\n0 TRLR')))).toBe('decoding.missing-charset');
  });

  test('reports an unknown character set', () => {
    expect(expectErr(detectCharset551(enc('0 HEAD\n1 CHAR EBCDIC\n0 TRLR')))).toBe('decoding.unknown-charset');
  });

  test('accepts the out-of-spec spellings written by real software', () => {
    expect(expectOk(detectCharset551(enc('0 HEAD\n1 CHAR ANSI\n0 TRLR')))).toBe('CP1252');
    expect(expectOk(detectCharset551(enc('0 HEAD\n1 CHAR IBM-PC\n0 TRLR')))).toBe('CP850');
    expect(expectOk(detectCharset551(enc('0 HEAD\n1 CHAR MACINTOSH\n0 TRLR')))).toBe('MACINTOSH');
    expect(expectOk(detectCharset551(enc('0 HEAD\n1 CHAR WINDOWS-1252\n0 TRLR')))).toBe('CP1252');
  });

  test('recognizes a UTF-16 BOM', () => {
    const bytes = new Uint8Array([0xff, 0xfe, 0x30, 0x00, 0x20, 0x00]);
    expect(expectOk(detectCharset551(bytes))).toBe('UNICODE');
  });
});

describe('decodeDocument (5.5.1)', () => {
  test('decodes ANSEL bytes per Appendix C with NFC normalization', () => {
    // "café" as c a f, acute accent, e. ANSEL non-spacing characters are
    // stored before the base character they modify; the decoder attaches
    // them after the base and NFC-normalizes (e + combining acute → é).
    const bytes = new Uint8Array([...enc('0 HEAD\n1 CHAR ANSEL\n1 NOTE caf'), 0xe2, ...enc('e\n0 TRLR')]);
    const result = expectOk(decodeDocument(bytes, '5.5.1'));
    expect(result.lines[2]?.text).toBe('1 NOTE café');
  });

  test('precomposes ANSEL umlauts', () => {
    // E8 (umlaut) + 'a' → NFC 'ä' (U+00E4).
    const bytes = new Uint8Array([...enc('0 HEAD\n1 CHAR ANSEL\n1 NOTE '), 0xe8, ...enc('a\n0 TRLR')]);
    const result = expectOk(decodeDocument(bytes, '5.5.1'));
    expect(result.lines[2]?.text).toBe('1 NOTE ä');
  });

  test('keeps non-precomposable marks in canonical order after the base', () => {
    // E5 (macron) + 'x' has no precomposed form; NFC keeps x + U+0304.
    const bytes = new Uint8Array([...enc('0 HEAD\n1 CHAR ANSEL\n1 NOTE '), 0xe5, ...enc('x\n0 TRLR')]);
    const result = expectOk(decodeDocument(bytes, '5.5.1'));
    expect(result.lines[2]?.text).toBe('1 NOTE x\u0304');
  });

  test('rejects a dangling non-spacing character without a base', () => {
    const bytes = new Uint8Array([...enc('0 HEAD\n1 CHAR ANSEL\n1 NOTE caf'), 0xe2, ...enc('\n0 TRLR')]);
    const result = decodeDocument(bytes, '5.5.1');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('decoding.invalid-ansel');
      expect(result.error.position?.line).toBe(3);
    }
  });

  test('decodes ANSEL spacing characters', () => {
    // A5 = AE ligature uppercase.
    const bytes = new Uint8Array([...enc('0 HEAD\n1 CHAR ANSEL\n1 NOTE '), 0xa5, ...enc('\n0 TRLR')]);
    const result = expectOk(decodeDocument(bytes, '5.5.1'));
    expect(result.lines[2]?.text).toBe('1 NOTE Æ');
  });

  test('rejects undefined ANSEL bytes', () => {
    const bytes = new Uint8Array([...enc('0 HEAD\n1 CHAR ANSEL\n1 NOTE '), 0x99, ...enc('\n0 TRLR')]);
    const result = decodeDocument(bytes, '5.5.1');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('decoding.invalid-ansel');
      expect(result.error.position?.line).toBe(3);
    }
  });

  test('rejects bytes above 0x7F in ASCII', () => {
    const bytes = new Uint8Array([...enc('0 HEAD\n1 CHAR ASCII\n1 NOTE '), 0xe9, ...enc('\n0 TRLR')]);
    expect(expectErr(decodeDocument(bytes, '5.5.1'))).toBe('decoding.invalid-ansel');
  });

  test('requires a BOM for UNICODE and decodes UTF-16LE', () => {
    const missing = expectErr(decodeDocument(enc('0 HEAD\n1 CHAR UNICODE\n0 TRLR'), '5.5.1'));
    expect(missing).toBe('decoding.bom');
    const body = '0 HEAD\r\n0 TRLR\r\n';
    const bytes = new Uint8Array(2 + body.length * 2);
    bytes[0] = 0xff;
    bytes[1] = 0xfe;
    for (let i = 0; i < body.length; i++) {
      bytes[2 + i * 2] = body.charCodeAt(i);
    }
    const result = expectOk(decodeDocument(bytes, '5.5.1'));
    expect(result.lines.map((line) => line.text)).toEqual(['0 HEAD', '0 TRLR']);
  });
});
