/**
 * The unified entry point: given raw bytes, detect the container (plain
 * GEDCOM stream vs GEDZIP archive) and, for plain streams, decode by
 * sniffing the encoding (UTF-8, or the 5.5.1 charset declared in the
 * header) — then parse with the one import grammar. The reported
 * version comes from the file's own `GEDC.VERS` declaration, not from
 * which decode path ran.
 */

import type { GedcomError, ParseResult } from './errors';
import { parseGedzip, type GedzipArchive } from './gedzip';
import { parseAny } from './parsing/assemble';
import type { GedcomDataset } from './structures';

/** The result of `parse`: the container and the parsed contents. */
export type ParsedGedcom =
  | { kind: 'dataset'; version: '7.0' | '5.5.1'; dataset: GedcomDataset }
  | { kind: 'gedzip'; archive: GedzipArchive };

/**
 * Parses GEDCOM bytes of any supported form: a GEDCOM 7.0 or 5.5.1
 * data stream (a file declaring 5.5.5 parses as 5.5.1) or a GEDZIP
 * archive.
 */
export function parse(bytes: Uint8Array): ParseResult<ParsedGedcom> {
  if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const archive = parseGedzip(bytes);
    if (!archive.ok) {
      return archive;
    }
    return { ok: true, value: { kind: 'gedzip', archive: archive.value } };
  }
  const result = parseAny(bytes);
  if (!result.ok) {
    return result;
  }
  const declared = result.value.header.gedcom.version;
  const version: '7.0' | '5.5.1' = /^7\./.test(declared) ? '7.0' : '5.5.1';
  return { ok: true, value: { kind: 'dataset', version, dataset: result.value } };
}

/**
 * The tolerant parse (see the README's Known strict decisions): every
 * problem the strict parser would report is recorded and skipped
 * instead of aborting — one error entry per offending line, structure
 * or record — and the best-effort dataset (or archive) is returned
 * alongside the full error list. `value` is undefined only when even
 * the container cannot be read (a malformed zip, an undecodable
 * stream with no fallback).
 */
export function parseTolerant(bytes: Uint8Array): { value: ParsedGedcom | undefined; errors: GedcomError[] } {
  const errors: GedcomError[] = [];
  if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const archive = parseGedzip(bytes);
    if (!archive.ok) {
      errors.push(archive.error);
      return { value: undefined, errors };
    }
    return { value: { kind: 'gedzip', archive: archive.value }, errors };
  }
  const result = parseAny(bytes, errors);
  if (!result.ok) {
    errors.push(result.error);
    return { value: undefined, errors };
  }
  const declared = result.value.header.gedcom.version;
  const version: '7.0' | '5.5.1' = /^7\./.test(declared) ? '7.0' : '5.5.1';
  return { value: { kind: 'dataset', version, dataset: result.value }, errors };
}
