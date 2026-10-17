/**
 * Strict parse and serialization errors of the GEDCOM reader/writer.
 *
 * The parser is deliberately strict: every violation of GEDCOM 7.0.18 or
 * GEDCOM 5.5.1 is reported as a typed error with a unique code and the
 * source position of the offending line. Internally the parser fails fast
 * (the first problem aborts the parse); the public API surfaces the error
 * as a value, never as an exception. Error codes are granular so that
 * corpus runs can be aggregated per problem class.
 */

/** A position in the decoded document. */
export interface SourcePosition {
  /** 1-based line number. */
  line: number;
  /** 1-based column in decoded characters. */
  column: number;
  /** Byte offset of the start of the line in the input. */
  offset: number;
}

/** The first position of a document (used for errors without a line). */
export const DOCUMENT_START: SourcePosition = { line: 1, column: 1, offset: 0 };

export type GedcomErrorCode =
  // Decoding and character sets.
  | 'decoding.invalid-utf8'
  | 'decoding.invalid-utf16'
  | 'decoding.bom'
  | 'decoding.missing-charset'
  | 'decoding.unknown-charset'
  | 'decoding.invalid-ansel'
  // Line-level container errors.
  | 'line.blank'
  | 'line.leading-whitespace'
  | 'line.bad-level'
  | 'line.level-limit'
  | 'line.level-skip'
  | 'line.missing-delimiter'
  | 'line.bad-tag'
  | 'line.reserved-tag'
  | 'line.bad-xref'
  | 'line.xref-on-substructure'
  | 'line.bad-pointer'
  | 'line.unescaped-at'
  | 'line.bad-escape'
  | 'line.banned-char'
  | 'line.too-long'
  | 'line.continuation-no-payload'
  | 'line.continuation-out-of-order'
  // Document-level errors.
  | 'document.missing-header'
  | 'document.missing-trailer'
  | 'document.trailer-not-last'
  | 'document.duplicate-xref'
  | 'document.xref-not-found'
  | 'document.missing-gedc'
  | 'document.missing-gedc-vers'
  | 'document.wrong-version'
  // Structure-level errors.
  | 'structure.unknown-tag'
  | 'structure.cardinality'
  | 'structure.missing-required'
  | 'structure.missing-payload'
  | 'structure.unexpected-payload'
  | 'structure.record-without-xref'
  // Payload data type errors.
  | 'enum.invalid-value'
  | 'date.invalid'
  | 'date.bad-day'
  | 'date.bad-month'
  | 'date.bad-year'
  | 'date.bad-epoch'
  | 'date.reserved-calendar'
  | 'time.invalid'
  | 'age.invalid'
  | 'list.invalid'
  | 'name.invalid'
  | 'latitude.invalid'
  | 'longitude.invalid'
  | 'tagdef.invalid'
  | 'charset.invalid'
  | 'filepath.invalid'
  | 'uri.invalid'
  // Serialization errors (no source position).
  | 'serialize.missing-field'
  | 'serialize.unsupported-value'
  | 'serialize.invalid-text'
  // GEDZIP errors.
  | 'gedzip.invalid-archive'
  | 'gedzip.missing-dataset'
  | 'gedzip.duplicate-entry';

export interface GedcomError {
  code: GedcomErrorCode;
  message: string;
  position?: SourcePosition;
}

/** The result of a parse or serialization: either the value or one error. */
export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: GedcomError };

export function ok<T>(value: T): ParseResult<T> {
  return { ok: true, value };
}

/**
 * Throws a typed error (used internally; the public API converts the
 * thrown error into a `ParseResult`).
 */
export function fail(code: GedcomErrorCode, message: string, position?: SourcePosition): never {
  const error: GedcomError = position === undefined ? { code, message } : { code, message, position };
  throw error;
}

/** Runs a parser and converts its thrown errors into a ParseResult. */
export function run<T>(fn: () => T): ParseResult<T> {
  try {
    return ok(fn());
  } catch (error) {
    return { ok: false, error: error as GedcomError };
  }
}
