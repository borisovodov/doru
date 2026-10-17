/**
 * GEDZIP reading and writing (GEDCOM 7.0 chapter 4).
 *
 * A GEDZIP file is a zip archive bundling a GEDCOM 7.0 data stream (the
 * entry `gedcom.ged`) with the local files referenced by the dataset's
 * `FILE` payloads. Zip entry names are case-sensitive UTF-8 and are not
 * percent-escaped: they equal the `FILE` payload strings verbatim.
 *
 * `fflate` is the package's single runtime dependency and provides the
 * zip layer.
 */

import { unzipSync, zipSync } from 'fflate';
import { fail, run, type ParseResult } from './errors';
import { parseGedcom70 } from './parsing/assemble';
import type { FilePath } from './primitives';
import { serializeGedcom70Bytes } from './serialize/serialize';
import type { GedcomDataset } from './structures';

/** The name of the dataset entry inside a GEDZIP archive. */
export const GEDZIP_DATASET_ENTRY = 'gedcom.ged';

/**
 * A GEDZIP archive: a zip archive containing exactly one data stream and
 * one entry per local file referenced by the dataset. The version number
 * of a GEDZIP file is the same as the version number of the dataset it
 * contains; saved as a file, it should use the extension `.gdz`.
 */
export interface GedzipArchive {
  /** GEDCOM 7.0 §4 — the entry named `gedcom.ged`: the data stream. */
  dataset: GedcomDataset;
  /**
   * GEDCOM 7.0 §4 — one entry per local file `g7:type-FilePath` payload in
   * `gedcom.ged`, with the same zip file name as the payload. Zip file
   * names are case-sensitive UTF-8 and are not percent-escaped (unlike
   * FilePath payloads). The reserved names `gedcom.ged`, `MANIFEST.MF`
   * and any `META-INF/` prefix should not be used.
   */
  mediaFiles: GedzipMediaEntry[];
}

/**
 * GEDCOM 7.0 §4 — a media entry of a GEDZIP archive: the zip file name
 * (equal to the FilePath payload referencing it) and the file contents.
 */
export interface GedzipMediaEntry {
  /** GEDCOM 7.0 §4 — the zip file name; directory separators are `/`. */
  name: FilePath;
  /** GEDCOM 7.0 §4 — the file contents. */
  contents: Uint8Array;
}

/**
 * Parses a GEDZIP archive: unzips it, parses the `gedcom.ged` entry as a
 * GEDCOM 7.0 data stream, and surfaces every other entry as a media
 * file. Zip directory markers (names ending in `/`) are skipped.
 */
export function parseGedzip(bytes: Uint8Array): ParseResult<GedzipArchive> {
  return run(() => {
    let entries: Record<string, Uint8Array>;
    const seen = new Set<string>();
    try {
      entries = unzipSync(bytes, {
        filter: (file) => {
          if (seen.has(file.name)) {
            fail('gedzip.duplicate-entry', `Duplicate archive entry "${file.name}"`);
          }
          seen.add(file.name);
          return true;
        },
      });
    } catch (error) {
      // Re-throw our own typed errors (thrown by the duplicate filter);
      // anything else is a malformed archive. fflate's own failures may
      // carry non-string codes, so check for a string code.
      if (typeof (error as { code?: unknown }).code === 'string') {
        throw error;
      }
      fail('gedzip.invalid-archive', 'The input is not a valid zip archive');
    }
    const datasetBytes = entries[GEDZIP_DATASET_ENTRY];
    if (datasetBytes === undefined) {
      fail('gedzip.missing-dataset', `The archive has no ${GEDZIP_DATASET_ENTRY} entry`);
    }
    const dataset = parseGedcom70(datasetBytes);
    if (!dataset.ok) {
      throw dataset.error;
    }
    const mediaFiles: GedzipMediaEntry[] = [];
    for (const [name, contents] of Object.entries(entries)) {
      if (name === GEDZIP_DATASET_ENTRY || name.endsWith('/')) {
        continue;
      }
      mediaFiles.push({ name, contents });
    }
    return { dataset: dataset.value, mediaFiles };
  });
}

/**
 * Serializes a GEDZIP archive: the dataset as a GEDCOM 7.0 UTF-8 stream
 * in the `gedcom.ged` entry plus one entry per media file.
 */
export function serializeGedzip(archive: GedzipArchive): ParseResult<Uint8Array> {
  return run<Uint8Array>(() => {
    const datasetBytes = serializeGedcom70Bytes(archive.dataset);
    if (!datasetBytes.ok) {
      throw datasetBytes.error;
    }
    const entries: Record<string, Uint8Array> = { [GEDZIP_DATASET_ENTRY]: datasetBytes.value };
    for (const media of archive.mediaFiles) {
      if (media.name === GEDZIP_DATASET_ENTRY || media.name.endsWith('/')) {
        fail(
          'gedzip.duplicate-entry',
          `The media file name "${media.name}" collides with the dataset entry or is a directory name`,
        );
      }
      if (media.name in entries) {
        fail('gedzip.duplicate-entry', `Duplicate archive entry "${media.name}"`);
      }
      entries[media.name] = media.contents;
    }
    return zipSync(entries);
  });
}
