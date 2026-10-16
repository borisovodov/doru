/**
 * GEDCOM import and export for Dóru.
 *
 * Home of the GEDCOM reader/writer for the 5.5.1 and 7.0 dialects plus
 * GEDZIP (.gdz) archives. Deliberately free of runtime dependencies and of
 * Electron or @doru/* imports, so the format layer stays testable in
 * isolation.
 */

/** GEDCOM dialect versions. */
export type GedcomVersion = '5.5.1' | '7.0';

/** How a GEDCOM stream is packed on disk: plain text or gzip (GEDZIP). */
export type GedcomContainer = 'plain' | 'gedzip';
