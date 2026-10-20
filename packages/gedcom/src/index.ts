/**
 * GEDCOM import and export for Dóru.
 *
 * Home of the GEDCOM reader/writer for the 5.5.1 and 7.0 dialects plus
 * GEDZIP (.gdz) archives. Deliberately free of runtime dependencies and of
 * Electron or @doru/* imports, so the format layer stays testable in
 * isolation.
 *
 * This module currently exports the complete TypeScript object model of
 * the GEDCOM specifications — a single model spanning both supported
 * versions:
 * - `primitives.ts` — container identifiers, data types, known calendars
 * - `enumerations.ts` — enumeration sets
 * - `structures.ts` — barrel over `model/`: the genealogical structures
 *   split by specification section (extensions, document, records, and
 *   the substructure groups)
 * - `parsing/` — the strict assemblers, split by structure group
 * - `serialize/` — the projecting serializers (writer, format, tables,
 *   emitter sections, prepare)
 * - `gedzip.ts` — the GEDZIP file format (GEDCOM 7.0 chapter 4)
 *
 * Every element cites both specs where they agree (`GEDCOM 7.0 §…` and
 * `GEDCOM 5.5.1 §…`); elements that exist in only one version are marked
 * as such.
 */

/** How a GEDCOM stream is packed on disk: plain text or gzip (GEDZIP). */
export type GedcomContainer = 'plain' | 'gedzip';

export * from './primitives';
export * from './dates';
export * from './enumerations';
export * from './structures';
export * from './gedzip';
export * from './errors';
export { parse, type ParsedGedcom } from './detect';
export { parseGedcom70, parseGedcom551 } from './parsing/assemble';
export {
  serializeGedcom70,
  serializeGedcom551,
  serializeGedcom70Bytes,
  serializeGedcom551Bytes,
} from './serialize/serialize';
