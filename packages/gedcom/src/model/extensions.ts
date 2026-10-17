import type {
  Xref,
  ExtensionTag,
  Tag,
  Text,
} from '../primitives';

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §1.5 Extensions
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §1.5 Extensions — a tagged extension structure. Tagged extension
 * structures may appear as records or as substructures of any other
 * structure. The payload type of an extension is defined by the extension
 * itself and is therefore kept as unparsed text.
 *
 * GEDCOM 5.5.1 §2 (p.56), `NEW_TAG` — 5.5.1 user-defined tags follow the
 * same underscore convention but have no documented-extension schema
 * mechanism (SCHEMA was removed in draft 5.4).
 */
export interface ExtensionStructure {
  /** GEDCOM 7.0 §1.5 — the tag: `extTag` for a tagged extension, or a `stdTag` for an extension-defined substructure. */
  tag: Tag;
  /** GEDCOM 7.0 §1.5 — payload, if any; its data type is defined by the extension. */
  payload?: Text;
  /** GEDCOM 7.0 §1.5 — extension-defined substructures; their meaning is defined by the tagged extension structure they occur within. */
  children: ExtensionStructure[];
}

/**
 * GEDCOM 7.0 §1.5 Extensions — an extension record: a tagged extension structure at
 * record level (level 0).
 */
export interface ExtensionRecord extends ExtensionStructure {
  /** GEDCOM 7.0 §1.5 — extension records are always tagged with an `extTag`. */
  tag: ExtensionTag;
  /** The record's cross-reference identifier (@…@); optional when nothing points to it. GEDCOM 7.0 §1.3; GEDCOM 5.5.1 §2 Primitive Elements (p.64), `XREF` (max 22 characters). */
  xref?: Xref;
}

/**
 * Base of every standard structure: any structure may carry extension
 * substructures (GEDCOM 7.0 §1.5: "Tagged extension structures may appear as records
 * or substructures of any other structure").
 */
export interface GedcomStructureBase {
  /** GEDCOM 7.0 §1.5 — extension substructures of this structure. */
  extensions?: ExtensionStructure[];
}
