/**
 * §4 The FamilySearch GEDZIP file format of the GEDCOM 7.0.18 specification.
 *
 * GEDZIP bundles a dataset with its external files in a zip archive, as
 * defined by the .ZIP File Format Specification and standardized by
 * ISO/IEC 21320-1:2015. The version number of a GEDZIP file is the same
 * as the version number of the dataset it contains. When saved as a file,
 * a GEDZIP should use the filename extension `.gdz`.
 */

import type { GedcomDataset } from './structures';
import type { FilePath } from './primitives';

/**
 * §4 — a GEDZIP archive: a zip archive containing exactly one data stream
 * and one entry per local file referenced by the dataset.
 */
export interface GedzipArchive {
  /** §4 — the entry named `gedcom.ged`: the data stream. */
  dataset: GedcomDataset;
  /**
   * §4 — one entry per local file `g7:type-FilePath` payload in
   * `gedcom.ged`, with the same zip file name as the payload. Zip file
   * names are case-sensitive UTF-8 and are not percent-escaped (unlike
   * FilePath payloads). The reserved names `gedcom.ged`, `MANIFEST.MF`
   * and any `META-INF/` prefix should not be used.
   */
  mediaFiles: GedzipMediaEntry[];
}

/**
 * §4 — a media entry of a GEDZIP archive: the zip file name (equal to the
 * FilePath payload referencing it) and the file contents.
 */
export interface GedzipMediaEntry {
  /** §4 — the zip file name; directory separators are `/`. */
  name: FilePath;
  /** §4 — the file contents. */
  contents: Uint8Array;
}
