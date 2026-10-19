/**
 * The strict assembler: maps the raw tree onto the typed model.
 *
 * One parameterized implementation serves both GEDCOM 7.0 and GEDCOM 5.5.1
 * (the per-version differences are handled where the grammars differ).
 * Every violation — unknown tags, cardinality, missing payloads, bad enum
 * values, dangling pointers — is a typed error with the position of the
 * offending line.
 */

import type {
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
} from './decode';
import {
  parseDocument,
} from './document';
import {
  parseRawDocument,
} from './lines';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Parses a GEDCOM 7.0.18 data stream into the typed model. */
export function parseGedcom70(input: Uint8Array): ParseResult<GedcomDataset> {
  return run(() => parseGedcom(input, '7.0'));
}

/** Parses a GEDCOM 5.5.1 transmission into the typed model. */
export function parseGedcom551(input: Uint8Array): ParseResult<GedcomDataset> {
  return run(() => parseGedcom(input, '5.5.1'));
}

function parseGedcom(input: Uint8Array, version: '7.0' | '5.5.1'): GedcomDataset {
  const decoded = decodeDocument(input, version);
  if (!decoded.ok) {
    throw decoded.error;
  }
  const raw = parseRawDocument(decoded.value, version);
  return parseDocument(raw, version);
}
