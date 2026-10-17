/**
 * GEDCOM 7.0 §3 Genealogical structures of the GEDCOM 7.0.18 specification.
 *
 * The structure organization rules are defined in GEDCOM 7.0 §3.2 (metasyntax rules
 * such as FAMILY_RECORD or PLACE_STRUCTURE); the meaning of each structure
 * is defined in GEDCOM 7.0 §3.3. Every interface cites the metasyntax rule it models
 * and its `g7:` URI. Field JSDoc comments record the GEDCOM tag and the
 * cardinality (`{0:1}`, `{1:1}`, `{0:M}`, `{1:M}`) of the substructure.
 *
 * This is a single model spanning GEDCOM 7.0 and GEDCOM 5.5.1. 5.5.1
 * references point into The GEDCOM Standard 5.5.1 chapter 2: record
 * structures p.23, substructures p.31, primitive elements p.41. Structures
 * and fields that exist only in one version are marked as such.
 *
 * Cardinality mapping to TypeScript:
 * - `{0:1}` — optional field
 * - `{1:1}` — required field
 * - `{0:M}` — optional array field
 * - `{1:M}` — required array field
 *
 * This file is a barrel: the model lives in `src/model/`, split by
 * specification section (extensions, document, records, and the
 * substructure groups). Everything else in the package imports the model
 * through this barrel, so the split is invisible to callers.
 */

export * from './model/extensions';
export * from './model/document';
export * from './model/records';
export * from './model/common';
export * from './model/names-places';
export * from './model/sources-media';
export * from './model/family-structures';
export * from './model/individual-structures';
export * from './model/lds';
