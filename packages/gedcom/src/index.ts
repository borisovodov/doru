/**
 * GEDCOM import and export for Dóru.
 *
 * Home of the GEDCOM reader/writer for the 5.5.1 and 7.0 dialects plus
 * GEDZIP (.gdz) archives. Deliberately free of runtime dependencies and of
 * Electron or @doru/* imports, so the format layer stays testable in
 * isolation.
 *
 * This module currently exports the complete TypeScript object model of
 * The FamilySearch GEDCOM Specification 7.0.18:
 * - `primitives.ts` — container identifiers (§1.3), data types (chapter 2),
 *   known calendars (chapter 6)
 * - `enumerations.ts` — enumeration sets (§3.4)
 * - `structures.ts` — genealogical structures (chapter 3)
 * - `gedzip.ts` — the GEDZIP file format (chapter 4)
 */

/** GEDCOM dialect versions. */
export type GedcomVersion = '5.5.1' | '7.0';

/** How a GEDCOM stream is packed on disk: plain text or gzip (GEDZIP). */
export type GedcomContainer = 'plain' | 'gedzip';

export * from './primitives';
export * from './enumerations';
export * from './structures';
export * from './gedzip';
