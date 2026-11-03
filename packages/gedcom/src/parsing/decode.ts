/**
 * Character decoding for GEDCOM input.
 *
 * GEDCOM 7.0 mandates UTF-8 (with an optional BOM). GEDCOM 5.5.1 declares
 * the character set in the header CHAR tag: ANSEL (preferred), ASCII,
 * UTF-8, or UNICODE (UTF-16). The ANSEL table is GEDCOM 5.5.1 Appendix C
 * (ANSI/NISO Z39.47-1985).
 *
 * Decoding is line-based so that every error can carry the byte offset of
 * the offending line. UTF-8 and ANSEL characters never contain 0x0A/0x0D
 * bytes, so byte-level line splitting is safe for them; UTF-16 is decoded
 * as a whole and split afterwards.
 */

import type {
  GedcomVersion,
} from '../primitives';
import type {
  GedcomError,
  ParseResult,
} from '../errors';
import {
  DOCUMENT_START,
  ok,
} from '../errors';

/**
 * Character sets declared by the GEDCOM 5.5.1 header. ANSEL, ASCII,
 * UTF-8, and UNICODE are the GEDCOM 5.5.1 §3 (p.77) set; CP1252
 * (Windows Western), CP850 (DOS Western), and MACINTOSH (classic Mac
 * Roman) are not in the specification but are written by real software,
 * so the parser accepts them under the de-facto CHAR spellings below.
 */
export type Charset551 = 'ANSEL' | 'ASCII' | 'UTF-8' | 'UNICODE' | 'CP1252' | 'CP850' | 'MACINTOSH' | 'LATIN1';

/**
 * Maps a 5.5.1 CHAR value to a decoder. The GEDCOM 5.5.1 §3 (p.77)
 * spellings (ANSEL, ASCII, UTF-8, UNICODE) plus the de-facto spellings
 * found in files: UTF8, UTF-16 (UNICODE); ANSI, WINDOWS, WINDOWS-1252,
 * CP1252, IBM WINDOWS (Windows Western; FTM writes ANSI); IBM-PC,
 * IBMPC, DOS, CP850, IBM850, MS-DOS (DOS Western); MAC, MACINTOSH (Mac
 * Roman); LATIN1, ISO-8859-1 (ISO Latin-1). The value is matched
 * case-insensitively; anything else is a decoding error.
 */
const CHARSET551_ALIASES: Readonly<Record<string, Charset551>> = {
  ANSEL: 'ANSEL',
  ASCII: 'ASCII',
  'UTF-8': 'UTF-8',
  UTF8: 'UTF-8',
  UNICODE: 'UNICODE',
  'UTF-16': 'UNICODE',
  ANSI: 'CP1252',
  CP1252: 'CP1252',
  WINDOWS: 'CP1252',
  'WINDOWS-1252': 'CP1252',
  'IBM WINDOWS': 'CP1252',
  'IBM-PC': 'CP850',
  IBMPC: 'CP850',
  DOS: 'CP850',
  'MS-DOS': 'CP850',
  CP850: 'CP850',
  IBM850: 'CP850',
  MAC: 'MACINTOSH',
  MACINTOSH: 'MACINTOSH',
  LATIN1: 'LATIN1',
  'ISO-8859-1': 'LATIN1',
};

/** Normalizes a CHAR value to a decoder charset, or undefined when unknown. */
export function normalizeCharset551(value: string): Charset551 | undefined {
  return CHARSET551_ALIASES[value.trim().toUpperCase()];
}

/**
 * GEDCOM 5.5.1 Appendix C — ANSEL spacing characters (single-byte
 * replacements): byte value to Unicode code point.
 */
export const ANSEL_SPACING: ReadonlyMap<number, number> = new Map([
  [0xa1, 0x0141], // slash L, uppercase
  [0xa2, 0x00d8], // slash O, uppercase
  [0xa3, 0x0110], // slash D, uppercase
  [0xa4, 0x00de], // thorn, uppercase
  [0xa5, 0x00c6], // AE ligature, uppercase
  [0xa6, 0x0152], // OE ligature, uppercase
  [0xa7, 0x02b9], // modifier letter prime (miagkii znak, the Cyrillic soft sign)
  [0xa8, 0x00b7], // middle dot
  [0xa9, 0x266d], // musical flat
  [0xaa, 0x00ae], // registered trademark
  [0xab, 0x00b1], // plus or minus
  [0xac, 0x01a0], // hook O, uppercase
  [0xad, 0x01af], // hook U, uppercase
  [0xae, 0x02be], // alif
  [0xaf, 0x02bf], // ayn
  [0xb0, 0x02bf], // ayn
  [0xb1, 0x0142], // slash l, lowercase
  [0xb2, 0x00f8], // slash o, lowercase
  [0xb3, 0x0111], // slash d, lowercase
  [0xb4, 0x00fe], // thorn, lowercase
  [0xb5, 0x00e6], // ae ligature, lowercase
  [0xb6, 0x0153], // oe ligature, lowercase
  [0xb7, 0x02ba], // modifier letter double prime (tverdyi znak, the Cyrillic hard sign)
  [0xb8, 0x0131], // dotless i, lowercase
  [0xb9, 0x00a3], // British pound
  [0xba, 0x00f0], // eth
  [0xbc, 0x01a1], // hook o, lowercase
  [0xbd, 0x01b0], // hook u, lowercase
  [0xc0, 0x00b0], // degree sign
  [0xc1, 0x2113], // script l (litre sign)
  [0xc2, 0x2117], // phonograph copyright mark
  [0xc3, 0x00a9], // copyright mark
  [0xc4, 0x266f], // musical sharp
  [0xc5, 0x00bf], // inverted question mark
  [0xc6, 0x00a1], // inverted exclamation mark
  [0xcf, 0x00df], // ess-zed
]);

/**
 * GEDCOM 5.5.1 Appendix C — ANSEL non-spacing (combining) characters:
 * byte value to Unicode combining code point.
 */
export const ANSEL_NONSPACING: ReadonlyMap<number, number> = new Map([
  [0xe0, 0x0309], // hook above
  [0xe1, 0x0300], // grave accent
  [0xe2, 0x0301], // acute accent
  [0xe3, 0x0302], // circumflex accent
  [0xe4, 0x0303], // tilde
  [0xe5, 0x0304], // macron
  [0xe6, 0x0306], // breve
  [0xe7, 0x0307], // dot above
  [0xe8, 0x0308], // umlaut (diaeresis)
  [0xe9, 0x030c], // hacek
  [0xea, 0x030a], // circle above (angstrom)
  [0xeb, 0xfe20], // ligature, left half
  [0xec, 0xfe21], // ligature, right half
  [0xed, 0x0315], // high comma, off center
  [0xee, 0x030b], // double acute accent
  [0xef, 0x0310], // candrabindu
  [0xf0, 0x0327], // cedilla
  [0xf1, 0x0328], // right hook (ogonek)
  [0xf2, 0x0323], // dot below
  [0xf3, 0x0324], // double dot below (diaeresis below)
  [0xf4, 0x0325], // circle below (ring below)
  [0xf5, 0x0333], // double underscore (double low line)
  [0xf6, 0x0332], // underscore
  [0xf7, 0x0326], // left hook (comma below)
  [0xf8, 0x031c], // right cedilla (left half ring below)
  [0xf9, 0x032e], // half circle below (breve below)
  [0xfa, 0xfe22], // double tilde, left half
  [0xfb, 0xfe23], // double tilde, right half
  [0xfe, 0x0313], // high comma, centered
]);

const UTF8_BOM_CHAR = '\uFEFF';

/** One decoded line with its byte offset and 1-based line number. */
export interface DecodedLine {
  text: string;
  line: number;
  offset: number;
}

/* A decoded document: the full text and its lines with byte offsets. */
export interface DecodedDocument {
  text: string;
  lines: DecodedLine[];
}

/** The bytes of one raw line (excluding the terminator) with its offset. */
interface RawByteLine {
  bytes: Uint8Array;
  offset: number;
}

/** Splits bytes into lines on any of CR LF, CR, LF CR, LF. */
function splitByteLines(bytes: Uint8Array): RawByteLine[] {
  const lines: RawByteLine[] = [];
  let start = 0;
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i] as number;
    if (b === 0x0a || b === 0x0d) {
      lines.push({ bytes: bytes.subarray(start, i), offset: start });
      if (b === 0x0d && bytes[i + 1] === 0x0a) {
        i++;
      } else if (b === 0x0a && bytes[i + 1] === 0x0d) {
        i++;
      }
      i++;
      start = i;
    } else {
      i++;
    }
  }
  if (start < bytes.length) {
    lines.push({ bytes: bytes.subarray(start), offset: start });
  }
  return lines;
}

/**
 * Decodes one UTF-8 line (with fatal errors); a leading BOM is
 * stripped. `allowCp1252Fallback` retries the line as CP1252 (the
 * single-byte encoding these files actually use when they declare
 * UTF-8 but hold 8-bit text, see the README's Known strict
 * decisions): the sniffing entry point passes false so a 5.5.1
 * charset declaration still wins over the fallback.
 */
function decodeUtf8Line(
  line: RawByteLine,
  lineNumber: number,
  allowCp1252Fallback: boolean,
): ParseResult<string> {
  try {
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(line.bytes);
    // A byte-order mark is only standard at the start of the
    // document; real files carry one at later line starts too (e.g.
    // after concatenating two exports). The mark is stripped
    // wherever it appears.
    return ok(text.startsWith(UTF8_BOM_CHAR) ? text.slice(1) : text);
  } catch {
    if (allowCp1252Fallback) {
      return decodeSingleByteLine(line, 'CP1252');
    }
    return {
      ok: false,
      error: {
        code: 'decoding.invalid-utf8',
        message: 'The line is not valid UTF-8',
        position: { line: lineNumber, column: 1, offset: line.offset },
      },
    };
  }
}

/** Decodes one ANSEL line (GEDCOM 5.5.1 Appendix C). */
function decodeAnselLine(line: RawByteLine, lineNumber: number): ParseResult<string> {
  // ANSEL stores a non-spacing (combining) character BEFORE the base
  // character it modifies. The marks are buffered and attached after the
  // next base character (Unicode canonical order), then the line is
  // NFC-normalized so that precomposable sequences (e + acute → é)
  // collapse into single code points.
  let out = '';
  let pendingMarks = '';
  for (let i = 0; i < line.bytes.length; i++) {
    const b = line.bytes[i] as number;
    if (b <= 0x7f) {
      out += String.fromCharCode(b);
      if (pendingMarks !== '') {
        out += pendingMarks;
        pendingMarks = '';
      }
      continue;
    }
    const spacing = ANSEL_SPACING.get(b);
    if (spacing !== undefined) {
      out += String.fromCharCode(spacing);
      if (pendingMarks !== '') {
        out += pendingMarks;
        pendingMarks = '';
      }
      continue;
    }
    const nonspacing = ANSEL_NONSPACING.get(b);
    if (nonspacing !== undefined) {
      pendingMarks += String.fromCharCode(nonspacing);
      continue;
    }
    return {
      ok: false,
      error: {
        code: 'decoding.invalid-ansel',
        message: `Byte 0x${b.toString(16).toUpperCase()} is not defined in the ANSEL character set`,
        position: { line: lineNumber, column: i + 1, offset: line.offset },
      },
    };
  }
  if (pendingMarks !== '') {
    // A line ending in a non-spacing mark (files in the wild cut the
    // base character off — e.g. the gedcom4j "issue81" sample): the
    // pending marks are appended as-is instead of failing the line.
    out += pendingMarks;
  }
  return ok(out.normalize('NFC'));
}

/**
 * GEDCOM 5.5.1 out-of-spec character sets written by real software,
 * indexed by the byte value minus 0x80. CP1252 defines 0x80-0x9F with
 * five holes (0x81, 0x8D, 0x8F, 0x90, 0x9D), which decode to the C1
 * controls of the same number (see decodeSingleByteLine); bytes at and
 * above 0xA0 are ISO 8859-1 identity. CP850 and Mac Roman define all of
 * 0x80-0xFF.
 */
const CP1252_TABLE: ReadonlyMap<number, number> = new Map([
  [0x80, 0x20ac], [0x82, 0x201a], [0x83, 0x0192], [0x84, 0x201e],
  [0x85, 0x2026], [0x86, 0x2020], [0x87, 0x2021], [0x88, 0x02c6],
  [0x89, 0x2030], [0x8a, 0x0160], [0x8b, 0x2039], [0x8c, 0x0152],
  [0x8e, 0x017d], [0x91, 0x2018], [0x92, 0x2019], [0x93, 0x201c],
  [0x94, 0x201d], [0x95, 0x2022], [0x96, 0x2013], [0x97, 0x2014],
  [0x98, 0x02dc], [0x99, 0x2122], [0x9a, 0x0161], [0x9b, 0x203a],
  [0x9c, 0x0153], [0x9e, 0x017e], [0x9f, 0x0178],
]);
const CP850_TABLE: readonly number[] = [
  0x00c7, 0x00fc, 0x00e9, 0x00e2, 0x00e4, 0x00e0, 0x00e5, 0x00e7,
  0x00ea, 0x00eb, 0x00e8, 0x00ef, 0x00ee, 0x00ec, 0x00c4, 0x00c5,
  0x00c9, 0x00e6, 0x00c6, 0x00f4, 0x00f6, 0x00f2, 0x00fb, 0x00f9,
  0x00ff, 0x00d6, 0x00dc, 0x00f8, 0x00a3, 0x00d8, 0x00d7, 0x0192,
  0x00e1, 0x00ed, 0x00f3, 0x00fa, 0x00f1, 0x00d1, 0x00aa, 0x00ba,
  0x00bf, 0x00ae, 0x00ac, 0x00bd, 0x00bc, 0x00a1, 0x00ab, 0x00bb,
  0x2591, 0x2592, 0x2593, 0x2502, 0x2524, 0x00c1, 0x00c2, 0x00c0,
  0x00a9, 0x2563, 0x2551, 0x2557, 0x255d, 0x00a2, 0x00a5, 0x2510,
  0x2514, 0x2534, 0x252c, 0x251c, 0x2500, 0x253c, 0x00e3, 0x00c3,
  0x255a, 0x2554, 0x2569, 0x2566, 0x2560, 0x2550, 0x256c, 0x00a4,
  0x00f0, 0x00d0, 0x00ca, 0x00cb, 0x00c8, 0x0131, 0x00cd, 0x00ce,
  0x00cf, 0x2518, 0x250c, 0x2588, 0x2584, 0x00a6, 0x00cc, 0x2580,
  0x00d3, 0x00df, 0x00d4, 0x00d2, 0x00f5, 0x00d5, 0x00b5, 0x00fe,
  0x00de, 0x00da, 0x00db, 0x00d9, 0x00fd, 0x00dd, 0x00af, 0x00b4,
  0x00ad, 0x00b1, 0x2017, 0x00be, 0x00b6, 0x00a7, 0x00f7, 0x00b8,
  0x00b0, 0x00a8, 0x00b7, 0x00b9, 0x00b3, 0x00b2, 0x25a0, 0x00a0,
];
const MACINTOSH_TABLE: readonly number[] = [
  0x00c4, 0x00c5, 0x00c7, 0x00c9, 0x00d1, 0x00d6, 0x00dc, 0x00e1,
  0x00e0, 0x00e2, 0x00e4, 0x00e3, 0x00e5, 0x00e7, 0x00e9, 0x00e8,
  0x00ea, 0x00eb, 0x00ed, 0x00ec, 0x00ee, 0x00ef, 0x00f1, 0x00f3,
  0x00f2, 0x00f4, 0x00f6, 0x00f5, 0x00fa, 0x00f9, 0x00fb, 0x00fc,
  0x2020, 0x00b0, 0x00a2, 0x00a3, 0x00a7, 0x2022, 0x00b6, 0x00df,
  0x00ae, 0x00a9, 0x2122, 0x00b4, 0x00a8, 0x2260, 0x00c6, 0x00d8,
  0x221e, 0x00b1, 0x2264, 0x2265, 0x00a5, 0x00b5, 0x2202, 0x2211,
  0x220f, 0x03c0, 0x222b, 0x00aa, 0x00ba, 0x03a9, 0x00e6, 0x00f8,
  0x00bf, 0x00a1, 0x00ac, 0x221a, 0x0192, 0x2248, 0x2206, 0x00ab,
  0x00bb, 0x2026, 0x00a0, 0x00c0, 0x00c3, 0x00d5, 0x0152, 0x0153,
  0x2013, 0x2014, 0x201c, 0x201d, 0x2018, 0x2019, 0x00f7, 0x25ca,
  0x00ff, 0x0178, 0x2044, 0x20ac, 0x2039, 0x203a, 0xfb01, 0xfb02,
  0x2021, 0x00b7, 0x201a, 0x201e, 0x2030, 0x00c2, 0x00ca, 0x00c1,
  0x00cb, 0x00c8, 0x00cd, 0x00ce, 0x00cf, 0x00cc, 0x00d3, 0x00d4,
  0xf8ff, 0x00d2, 0x00da, 0x00db, 0x00d9, 0x0131, 0x02c6, 0x02dc,
  0x00af, 0x02d8, 0x02d9, 0x02da, 0x00b8, 0x02dd, 0x02db, 0x02c7,
];

/** Decodes one single-byte out-of-spec line (CP1252, CP850, Mac
 *  Roman, Latin-1). The five CP1252 holes (0x81, 0x8D, 0x8F, 0x90,
 *  0x9D) decode to the C1 controls of the same number (the
 *  Windows/Python `cp1252` behavior): files in the wild carry these
 *  bytes, and rejecting the line loses the whole document. */
function decodeSingleByteLine(
  line: RawByteLine,
  charset: 'CP1252' | 'CP850' | 'MACINTOSH' | 'LATIN1',
): ParseResult<string> {
  let out = '';
  for (let i = 0; i < line.bytes.length; i++) {
    const b = line.bytes[i] as number;
    let code: number;
    if (b <= 0x7f) {
      code = b;
    } else if (charset === 'CP850') {
      code = CP850_TABLE[b - 0x80] as number;
    } else if (charset === 'MACINTOSH') {
      code = MACINTOSH_TABLE[b - 0x80] as number;
    } else if (charset === 'LATIN1') {
      // ISO 8859-1 is the identity mapping for every byte above 0x7F.
      code = b;
    } else if (b >= 0xa0) {
      code = b;
    } else {
      code = CP1252_TABLE.get(b) ?? b;
    }
    out += String.fromCharCode(code);
  }
  return ok(out);
}

/** Decodes one ASCII line; bytes above 0x7F are errors. */
function decodeAsciiLine(line: RawByteLine, lineNumber: number): ParseResult<string> {
  for (let i = 0; i < line.bytes.length; i++) {
    const b = line.bytes[i] as number;
    if (b > 0x7f) {
      return {
        ok: false,
        error: {
          code: 'decoding.invalid-ansel',
          message: `Byte 0x${b.toString(16).toUpperCase()} is not valid in the ASCII character set`,
          position: { line: lineNumber, column: i + 1, offset: line.offset },
        },
      };
    }
  }
  return ok(new TextDecoder('ascii').decode(line.bytes));
}

/**
 * Detects the byte order of a BOM-less UTF-16 stream from the byte
 * pattern: ASCII interleaved with NULs reads 0x00 at every odd offset
 * in little-endian and at every even offset in big-endian.
 */
function utf16Endianness(bytes: Uint8Array): 'le' | 'be' | undefined {
  const n = Math.min(bytes.length, 256);
  let oddZero = 0;
  let evenZero = 0;
  for (let i = 0; i < n; i++) {
    if (bytes[i] === 0) {
      if (i % 2 === 1) {
        oddZero += 1;
      } else {
        evenZero += 1;
      }
    }
  }
  if (oddZero > n / 4 && evenZero < n / 8) {
    return 'le';
  }
  if (evenZero > n / 4 && oddZero < n / 8) {
    return 'be';
  }
  return undefined;
}

/** Decodes a UTF-16 (UNICODE) document. A BOM selects the byte order;
 *  without one (files in the wild cut it off — e.g. the geneweb export
 *  tests) the byte pattern picks it. A trailing dangling byte (an
 *  odd-length file, e.g. truncated on export) is ignored: its half
 *  code unit cannot be decoded, and dropping it keeps the rest of the
 *  document readable. */
function decodeUtf16Document(bytes: Uint8Array): ParseResult<DecodedDocument> {
  let encoding: 'utf-16le' | 'utf-16be';
  let start: number;
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    encoding = 'utf-16le';
    start = 2;
  } else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    encoding = 'utf-16be';
    start = 2;
  } else {
    const sniffed = utf16Endianness(bytes);
    if (sniffed === undefined) {
      return {
        ok: false,
        error: {
          code: 'decoding.bom',
          message: 'The UNICODE character set requires a byte-order mark (FF FE or FE FF)',
          position: DOCUMENT_START,
        },
      };
    }
    encoding = sniffed === 'le' ? 'utf-16le' : 'utf-16be';
    start = 0;
  }
  let text: string;
  try {
    const body = bytes.subarray(start, bytes.length - ((bytes.length - start) % 2));
    text = new TextDecoder(encoding, { fatal: true, ignoreBOM: true }).decode(body);
  } catch {
    return {
      ok: false,
      error: { code: 'decoding.invalid-utf16', message: 'Input is not valid UTF-16', position: DOCUMENT_START },
    };
  }
  if (text.startsWith(UTF8_BOM_CHAR)) {
    text = text.slice(1);
  }
  const lines: DecodedLine[] = [];
  let lineNumber = 1;
  let lineStart = 0;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '\r' || c === '\n') {
      lines.push({ text: text.slice(lineStart, i), line: lineNumber, offset: start + lineStart * 2 });
      lineNumber++;
      if (c === '\r' && text[i + 1] === '\n') {
        i++;
      } else if (c === '\n' && text[i + 1] === '\r') {
        i++;
      }
      i++;
      lineStart = i;
    } else {
      i++;
    }
  }
  if (lineStart < text.length) {
    lines.push({ text: text.slice(lineStart), line: lineNumber, offset: start + lineStart * 2 });
  }
  return ok({ text, lines });
}

/** The raw header fields of one line (ASCII-compatible header scan). */
interface RawHeaderLine {
  level: number;
  tag: string;
  value?: string;
}

/**
 * Tokenizes an ASCII-compatible header line. Returns null for lines that
 * cannot be header lines; the strict parser reports those separately.
 */
function tokenizeAsciiLine(text: string): RawHeaderLine | null {
  let i = 0;
  while (i < text.length && (text[i] === ' ' || text[i] === '\t')) {
    i++;
  }
  let level = 0;
  const levelStart = i;
  while (i < text.length) {
    const code = text.charCodeAt(i);
    if (code < 48 || code > 57) {
      break;
    }
    level = level * 10 + (code - 48);
    i++;
  }
  if (i === levelStart || text[i] !== ' ') {
    return null;
  }
  i++;
  if (text[i] === '@') {
    const close = text.indexOf('@', i + 1);
    if (close === -1) {
      return null;
    }
    i = close + 1;
    if (i >= text.length || text[i] !== ' ') {
      return null;
    }
    i++;
  }
  const tagStart = i;
  while (i < text.length && text[i] !== ' ' && text[i] !== '\t') {
    i++;
  }
  if (i === tagStart) {
    return null;
  }
  const tag = text.slice(tagStart, i);
  if (i < text.length) {
    i++;
    return { level, tag, value: text.slice(i) };
  }
  return { level, tag };
}

/**
 * Detects the GEDCOM 5.5.1 character set from the header CHAR tag
 * (GEDCOM 5.5.1 §2 p.44, §3 p.77). The header is ASCII-compatible in all
 * of the 5.5.1 character sets, so it can be scanned before decoding.
 */
export function detectCharset551(bytes: Uint8Array): ParseResult<Charset551> {
  // A UTF-16 (UNICODE) stream announces itself with a BOM; nothing else is
  // ASCII-scannable in that case.
  if (bytes.length >= 2 && ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff))) {
    return ok('UNICODE');
  }
  const lines = splitByteLines(bytes);
  let charset: string | undefined;
  let seenHead = false;
  for (const line of lines) {
    const parsed = tokenizeAsciiLine(new TextDecoder('ascii').decode(line.bytes));
    if (!parsed) {
      continue;
    }
    if (parsed.level === 1 && parsed.tag === 'CHAR') {
      charset = parsed.value;
      break;
    }
    if (parsed.level === 0) {
      if (parsed.tag === 'HEAD') {
        seenHead = true;
      } else if (seenHead) {
        // The header ends at the first data record after the HEAD.
        break;
      }
      // A level-0 record before the HEAD (files in the wild start
      // with a NOTE) does not stop the scan.
    }
  }
  if (charset === undefined) {
    // A BOM-less UTF-16 stream is not ASCII-scannable; sniff its byte
    // order and scan the header as UTF-16 (files in the wild cut the
    // BOM off — e.g. the geneweb export tests).
    const endianness = utf16Endianness(bytes);
    if (endianness !== undefined) {
      const text = new TextDecoder(endianness === 'le' ? 'utf-16le' : 'utf-16be', { fatal: true, ignoreBOM: true }).decode(
        bytes.subarray(0, Math.min(bytes.length, 2048)),
      );
      for (const line of text.split(/\r\n|\n|\r/)) {
        const parsed = tokenizeAsciiLine(line);
        if (parsed === null) {
          continue;
        }
        if (parsed.level === 1 && parsed.tag === 'CHAR') {
          // The stream is UTF-16 by pattern; its CHAR value names the
          // content charset, which for these files is UNICODE.
          return ok('UNICODE');
        }
        if (parsed.level === 0 && parsed.tag !== 'HEAD') {
          break;
        }
      }
    }
    return {
      ok: false,
      error: {
        code: 'decoding.missing-charset',
        message: 'The header has no CHAR tag; GEDCOM 5.5.1 requires one',
        position: DOCUMENT_START,
      },
    };
  }
  const normalized = normalizeCharset551(charset);
  if (normalized !== undefined) {
    return ok(normalized);
  }
  return {
    ok: false,
    error: {
      code: 'decoding.unknown-charset',
      message: `Unknown character set "${charset}"; expected ANSEL, UTF-8, UNICODE, ASCII, CP1252, CP850, MACINTOSH, or LATIN1`,
      position: DOCUMENT_START,
    },
  };
}

/**
 * Decodes a document for GEDCOM 7.0 (UTF-8) or GEDCOM 5.5.1 (per the
 * header CHAR tag) into lines with byte offsets. The UTF-8 decode
 * carries the CP1252 line fallback (see decodeUtf8Line): both versions
 * declare UTF-8, so a fallback here never overrides a different
 * declared charset.
 */
export function decodeDocument(bytes: Uint8Array, version: GedcomVersion, errors?: GedcomError[]): ParseResult<DecodedDocument> {
  if (version === '7.0') {
    return decodeWithCharset(bytes, 'UTF-8', true, errors);
  }
  const detected = detectCharset551(bytes);
  if (!detected.ok) {
    return detected;
  }
  return decodeWithCharset(bytes, detected.value, detected.value === 'UTF-8', errors);
}

/**
 * Decodes a document by sniffing its encoding: a strict full UTF-8
 * decode is tried first (the GEDCOM 7.0 charset, without the CP1252
 * fallback so that a declared 5.5.1 charset still wins), and a failure
 * falls back to the header CHAR tag (the 5.5.1 charsets; a UTF-16
 * stream announces itself with a BOM and fails the UTF-8 decode). When
 * the header declares no 5.5.1 charset, the UTF-8 failure is the
 * honest report (a 7.0 file with invalid UTF-8). This is the decode of
 * the `parse` entry point: the file's own declarations select the
 * encoding.
 */
export function decodeSniffed(bytes: Uint8Array, errors?: GedcomError[]): ParseResult<DecodedDocument> {
  // The first UTF-8 attempt always runs strictly (no per-line
  // recording): with the tolerant per-line skips it would "succeed"
  // on any bytes and mask a declared (or BOM-detected) charset.
  const utf8 = decodeWithCharset(bytes, 'UTF-8', false, undefined);
  if (utf8.ok) {
    return utf8;
  }
  const detected = detectCharset551(bytes);
  if (!detected.ok) {
    if (errors !== undefined) {
      // Tolerant mode: the charset-detection failure is recorded and
      // the document decodes as UTF-8 with per-line skips.
      errors.push(detected.error);
      return decodeWithCharset(bytes, 'UTF-8', true, errors);
    }
    // A BOM-flagged UTF-16 stream skips the UTF-8 attempt in
    // detectCharset551; otherwise a missing/unknown CHAR is the 5.5.1
    // report — unless the UTF-8 failure itself is the honest error
    // (a 7.0 file with invalid UTF-8).
    return utf8.error.code === 'decoding.invalid-utf8' ? utf8 : detected;
  }
  return decodeWithCharset(bytes, detected.value, detected.value === 'UTF-8', errors);
}

/** Decodes the document in one charset into lines with byte offsets. */
function decodeWithCharset(bytes: Uint8Array, charset: Charset551, utf8Fallback: boolean, errors?: GedcomError[]): ParseResult<DecodedDocument> {
  if (charset === 'UNICODE') {
    return decodeUtf16Document(bytes);
  }
  const rawLines = splitByteLines(bytes);
  const lines: DecodedLine[] = [];
  let text = '';
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i] as RawByteLine;
    const lineNumber = i + 1;
    let result: ParseResult<string>;
    if (charset === 'UTF-8') {
      result = decodeUtf8Line(raw, lineNumber, utf8Fallback);
    } else if (charset === 'ANSEL') {
      result = decodeAnselLine(raw, lineNumber);
    } else if (charset === 'CP1252' || charset === 'CP850' || charset === 'MACINTOSH' || charset === 'LATIN1') {
      result = decodeSingleByteLine(raw, charset);
    } else {
      result = decodeAsciiLine(raw, lineNumber);
    }
    if (!result.ok) {
      if (errors !== undefined) {
        // Tolerant mode: the undecodable line is recorded and skipped
        // (it becomes a blank line).
        errors.push(result.error);
        lines.push({ text: '', line: lineNumber, offset: raw.offset });
        if (i > 0) {
          text += '\n';
        }
        continue;
      }
      return result;
    }
    lines.push({ text: result.value, line: lineNumber, offset: raw.offset });
    if (i > 0) {
      text += '\n';
    }
    text += result.value;
  }
  return ok({ text, lines });
}
