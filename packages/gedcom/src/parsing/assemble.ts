/**
 * The strict assembler: maps the raw tree onto the typed model.
 *
 * One parameterized implementation serves GEDCOM 7.0 and GEDCOM 5.5.1
 * (the per-version differences are handled where the grammars differ).
 * A file declaring GEDCOM 5.5.5 parses under the 5.5.1 rules — the
 * 5.5.5 vocabulary (SEX X/N, BCE/BC, year-less dates, the JPEG/TIFF
 * media formats) is part of the 5.x grammar (see the README). Every
 * violation — unknown tags, cardinality, missing payloads, bad enum
 * values, dangling pointers — is a typed error with the position of the
 * offending line.
 */

import type {
  GedcomError,
  ParseResult,
} from '../errors';
import {
  run,
} from '../errors';
import type {
  GedcomDataset,
} from '../structures';
import {
  decodeDocument,
  decodeSniffed,
  type DecodedDocument,
} from './decode';
import {
  parseDocument,
} from './document';
import {
  parseRawDocument,
  type EscapeRule,
} from './lines';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Parses a GEDCOM 7.0 data stream into the typed model. */
export function parseGedcom70(input: Uint8Array): ParseResult<GedcomDataset> {
  return run(() => parseGedcom(input, '7.0'));
}

/**
 * Parses a GEDCOM 5.5.1 transmission into the typed model. A file
 * declaring `GEDC.VERS 5.5.5` parses too, under the same rules.
 */
export function parseGedcom551(input: Uint8Array): ParseResult<GedcomDataset> {
  return run(() => parseGedcom(input, '5.5.1'));
}

/**
 * Reads the declared GEDC.VERS from the decoded header lines to pick
 * the document's at-sign escape rule (see EscapeRule): the declaration
 * is the only signal that disambiguates the two conventions, and the
 * header always precedes the body (the VERS value itself is ASCII, so
 * the scan needs no decoding). A missing declaration defaults to the
 * 5.x rule; the header validation reports the real error afterwards.
 */
function declaredEscapeRule(document: DecodedDocument): EscapeRule {
  for (let i = 0; i < document.lines.length - 1; i++) {
    const line = document.lines[i] as DecodedDocument['lines'][number];
    if (/^\s*\d+ GEDC\s*$/.test(line.text)) {
      const match = /^\s*\d+ VERS\s+(\S.*)$/.exec((document.lines[i + 1] as DecodedDocument['lines'][number]).text);
      if (match !== null) {
        return /^7\./.test(match[1] as string) ? '7.0' : '5.5.1';
      }
    }
  }
  return '5.5.1';
}

function parseGedcom(input: Uint8Array, version: '7.0' | '5.5.1', errors?: GedcomError[]): GedcomDataset {
  const decoded = decodeDocument(input, version, errors);
  if (!decoded.ok) {
    throw decoded.error;
  }
  const raw = parseRawDocument(decoded.value, declaredEscapeRule(decoded.value), errors);
  return parseDocument(raw, errors);
}

/**
 * Parses GEDCOM bytes of any supported charset: UTF-8, or the 5.5.1
 * charset declared in the header (the `parse` entry's decode — see
 * decodeSniffed). The grammar behind it is the same import grammar as
 * everywhere else.
 */
export function parseAny(input: Uint8Array, errors?: GedcomError[]): ParseResult<GedcomDataset> {
  return run(() => {
    const decoded = decodeSniffed(input, errors);
    if (!decoded.ok) {
      throw decoded.error;
    }
    const raw = parseRawDocument(decoded.value, declaredEscapeRule(decoded.value), errors);
    return parseDocument(raw, errors);
  });
}
