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
  /**
   * `'pointer'` — the payload is pointer-shaped: the line value matched
   * the Xref production (GEDCOM 7.0 §1.3 Lines; GEDCOM 5.5.1 §2
   * Primitive Elements — a text value must double its leading `@`, so
   * the wire syntax is unambiguous). The raw `@…@` spelling is kept.
   * The mark is deliberately NOT resolved into a record pointer: the
   * official FamilySearch 7.0 test corpus ships pointer-shaped *text*
   * in extension payloads (extensions.ged: `1 _IN @B1@` with no @B1@
   * record — the extension defines the payload as an identifier), so
   * an unresolved target cannot be an error. The serializers instead
   * use the mark to keep such payloads' targets alive through the
   * projections that drop records (see serialize/prepare.ts).
   */
  payloadKind?: 'pointer';
  /**
   * The structure's cross-reference identifier (@…@). GEDCOM 7.0 §1.5
   * permits one on a tagged extension structure at any level, not only
   * on records ("A tagged extension structure … may also have a
   * cross-reference identifier"); GEDCOM 5.5.1 §2 Primitive Elements
   * (p.64), `XREF`, likewise (max 22 characters). The identifier is
   * registered as a pointer target during parsing and written back on
   * serialization.
   */
  xref?: Xref;
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
