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
  ParseResult,
} from '../errors';
import {
  DOCUMENT_START,
  ok,
} from '../errors';

/** Character sets declared by the GEDCOM 5.5.1 header. */
export type Charset551 = 'ANSEL' | 'ASCII' | 'UTF-8' | 'UNICODE';

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
  [0xa8, 0x00b7], // middle dot
  [0xa9, 0x266d], // musical flat
  [0xaa, 0x00ae], // registered trademark
  [0xab, 0x00b1], // plus or minus
  [0xae, 0x02be], // alif
  [0xb0, 0x02bf], // ayn
  [0xb1, 0x0142], // slash l, lowercase
  [0xb2, 0x00f8], // slash o, lowercase
  [0xb3, 0x0111], // slash d, lowercase
  [0xb4, 0x00fe], // thorn, lowercase
  [0xb5, 0x00e6], // ae ligature, lowercase
  [0xb6, 0x0153], // oe ligature, lowercase
  [0xb8, 0x0131], // dotless i, lowercase
  [0xb9, 0x00a3], // British pound
  [0xba, 0x00f0], // eth
  [0xc3, 0x00a9], // copyright mark
  [0xc5, 0x00bf], // inverted question mark
  [0xc6, 0x00a1], // inverted exclamation mark
  [0xcf, 0x00df], // ess-zed
]);

/**
 * GEDCOM 5.5.1 Appendix C — ANSEL non-spacing (combining) characters:
 * byte value to Unicode combining code point.
 */
export const ANSEL_NONSPACING: ReadonlyMap<number, number> = new Map([
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
  [0xed, 0x0315], // high comma, off center
  [0xee, 0x030b], // double acute accent
  [0xf0, 0x0327], // cedilla
  [0xf1, 0x0328], // right hook (ogonek)
  [0xf6, 0x0332], // underscore
  [0xfe, 0x0313], // high comma, centered
]);

const UTF8_BOM_CHAR = '\uFEFF';

/** One decoded line with its byte offset and 1-based line number. */
export interface DecodedLine {
  text: string;
  line: number;
  offset: number;
}

/** A decoded document: the full text and its lines with byte offsets. */
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

/** Decodes one UTF-8 line (with fatal errors); BOM allowed on line 1. */
function decodeUtf8Line(line: RawByteLine, lineNumber: number, isFirst: boolean): ParseResult<string> {
  try {
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(line.bytes);
    if (text.startsWith(UTF8_BOM_CHAR)) {
      if (!isFirst) {
        return {
          ok: false,
          error: {
            code: 'decoding.bom',
            message: 'A byte-order mark is only allowed as the first character of the document',
            position: { line: lineNumber, column: 1, offset: line.offset },
          },
        };
      }
      return ok(text.slice(1));
    }
    return ok(text);
  } catch {
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
    return {
      ok: false,
      error: {
        code: 'decoding.invalid-ansel',
        message: 'A non-spacing ANSEL character must be followed by a base character',
        position: { line: lineNumber, column: line.bytes.length, offset: line.offset },
      },
    };
  }
  return ok(out.normalize('NFC'));
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

/** Decodes a UTF-16 (UNICODE) document; a BOM is required. */
function decodeUtf16Document(bytes: Uint8Array): ParseResult<DecodedDocument> {
  let encoding: 'utf-16le' | 'utf-16be';
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    encoding = 'utf-16le';
  } else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    encoding = 'utf-16be';
  } else {
    return {
      ok: false,
      error: {
        code: 'decoding.bom',
        message: 'The UNICODE character set requires a byte-order mark (FF FE or FE FF)',
        position: DOCUMENT_START,
      },
    };
  }
  let text: string;
  try {
    text = new TextDecoder(encoding, { fatal: true, ignoreBOM: true }).decode(bytes.subarray(2));
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
  let start = 0;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '\r' || c === '\n') {
      lines.push({ text: text.slice(start, i), line: lineNumber, offset: 2 + start * 2 });
      lineNumber++;
      if (c === '\r' && text[i + 1] === '\n') {
        i++;
      } else if (c === '\n' && text[i + 1] === '\r') {
        i++;
      }
      i++;
      start = i;
    } else {
      i++;
    }
  }
  if (start < text.length) {
    lines.push({ text: text.slice(start), line: lineNumber, offset: 2 + start * 2 });
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
  for (const line of lines) {
    const parsed = tokenizeAsciiLine(new TextDecoder('ascii').decode(line.bytes));
    if (!parsed) {
      continue;
    }
    if (parsed.level === 1 && parsed.tag === 'CHAR') {
      charset = parsed.value;
      break;
    }
    // The header ends at the first data record (level 0 after HEAD).
    if (parsed.level === 0 && parsed.tag !== 'HEAD') {
      break;
    }
  }
  if (charset === undefined) {
    return {
      ok: false,
      error: {
        code: 'decoding.missing-charset',
        message: 'The header has no CHAR tag; GEDCOM 5.5.1 requires one',
        position: DOCUMENT_START,
      },
    };
  }
  const upper = charset.toUpperCase();
  if (upper === 'ANSEL' || upper === 'UTF-8' || upper === 'UNICODE' || upper === 'ASCII') {
    return ok(upper);
  }
  return {
    ok: false,
    error: {
      code: 'decoding.unknown-charset',
      message: `Unknown character set "${charset}"; expected ANSEL, UTF-8, UNICODE, or ASCII`,
      position: DOCUMENT_START,
    },
  };
}

/**
 * Decodes a document for GEDCOM 7.0 (UTF-8) or GEDCOM 5.5.1 (per the
 * header CHAR tag) into lines with byte offsets.
 */
export function decodeDocument(bytes: Uint8Array, version: '7.0' | '5.5.1'): ParseResult<DecodedDocument> {
  let charset: Charset551;
  if (version === '7.0') {
    charset = 'UTF-8';
  } else {
    const detected = detectCharset551(bytes);
    if (!detected.ok) {
      return detected;
    }
    charset = detected.value;
  }
  if (charset === 'UNICODE') {
    return decodeUtf16Document(bytes);
  }
  const rawLines = splitByteLines(bytes);
  const lines: DecodedLine[] = [];
  let text = '';
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i] as RawByteLine;
    const lineNumber = i + 1;
    const isFirst = lineNumber === 1;
    let result: ParseResult<string>;
    if (charset === 'UTF-8') {
      result = decodeUtf8Line(raw, lineNumber, isFirst);
    } else if (charset === 'ANSEL') {
      result = decodeAnselLine(raw, lineNumber);
    } else {
      result = decodeAsciiLine(raw, lineNumber);
    }
    if (!result.ok) {
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
