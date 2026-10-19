/**
 * The unified entry point: given raw bytes, detect the container (plain
 * GEDCOM stream vs GEDZIP archive) and, for plain streams, the
 * specification version — then parse accordingly.
 *
 * Detection strategy:
 * - bytes starting with the zip magic `PK` are a GEDZIP archive
 *   (`parseGedzip`; a GEDCOM stream can never start with `PK`, because
 *   its first line starts with a level number);
 * - otherwise the bytes are tried as GEDCOM 7.0 first; if that fails
 *   with `document.wrong-version` (the header declares 5.x) or with a
 *   `decoding.*` error (the stream may use a 5.5.1 charset), the bytes
 *   are tried as GEDCOM 5.5.1;
 * - any other 7.0 failure is reported as-is (it is a 7.0-format
 *   problem), and when the 5.5.1 attempt also fails, its error is
 *   reported.
 */

import type { ParseResult } from './errors';
import { parseGedzip, type GedzipArchive } from './gedzip';
import { parseGedcom551, parseGedcom70 } from './parsing/assemble';
import type { GedcomDataset } from './structures';

/** The result of `parse`: the container and the parsed contents. */
export type ParsedGedcom =
  | { kind: 'dataset'; version: '7.0' | '5.5.1'; dataset: GedcomDataset }
  | { kind: 'gedzip'; archive: GedzipArchive };

/**
 * Parses GEDCOM bytes of any supported form: a GEDCOM 7.0 or 5.5.1 data
 * stream or a GEDZIP archive.
 */
export function parse(bytes: Uint8Array): ParseResult<ParsedGedcom> {
  if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const archive = parseGedzip(bytes);
    if (!archive.ok) {
      return archive;
    }
    return { ok: true, value: { kind: 'gedzip', archive: archive.value } };
  }
  const as70 = parseGedcom70(bytes);
  if (as70.ok) {
    return { ok: true, value: { kind: 'dataset', version: '7.0', dataset: as70.value } };
  }
  const fallback = as70.error.code === 'document.wrong-version' || as70.error.code.startsWith('decoding.');
  if (!fallback) {
    return as70;
  }
  const as551 = parseGedcom551(bytes);
  if (as551.ok) {
    return { ok: true, value: { kind: 'dataset', version: '5.5.1', dataset: as551.value } };
  }
  return as551;
}
