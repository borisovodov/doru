/**
 * GEDCOM 7.0 §1.5 Extensions — the vendor master-place record, modelled
 * as an extension record.
 *
 * Neither GEDCOM version has a place entity: a place is inline text in
 * every event's PLAC substructure. Several vendors keep a shared
 * "card-file" of places instead, so map coordinates, notes and media
 * for a place are stored once rather than per event. The wire dialects,
 * all normalized into this one type on 5.5.1 input:
 *
 * - `_PLAC <name>` (RootsMagic, The Master Genealogist) — the name is
 *   the record payload; records usually have no cross-reference.
 * - `@xref@ _PLAC <name>` (Family Historian) — same, with an xref that
 *   Family Historian itself does not use as a pointer (events link by
 *   name matching).
 * - `_PLAC_DEFN` with a `PLAC <name>` child (Legacy Family Tree) — the
 *   name is a required child substructure, plus an optional `ABBR`.
 * - `_LOC` with a `NAME <name>` child (GEDCOM 5.5EL) — the name is a
 *   required child substructure; `_LOC` records form a hierarchy via a
 *   `_LOC @parent@` child, and events link to them explicitly with
 *   `_LOC @xref@` under PLAC.
 *
 * A `_LOC` record *without* a `NAME` child is not the GEDCOM-L place
 * record — that dialect requires the name. It is an extension record
 * whose contents the extension defines (the FamilySearch GEDCOM 7.0
 * test files exercise this form), and it parses as a generic
 * `ExtensionRecord` instead, preserved verbatim.
 *
 * The catalog source is John Cardinal's "Common GEDCOM Extensions":
 * https://jfcardinal.github.io/GEDCOM-5.5.2/extensions.html
 *
 * On input (both versions) every dialect is normalized to tag `_PLAC`
 * with the name as the payload (plus a one-entry `names` list, so the
 * `_LOC` write-back round-trips stably), and events that name a place
 * whose text matches a record's payload get their
 * `PlaceStructure.location` filled (records without an xref receive a
 * synthesized one, like the OBJE synthesis). On output the 7.0
 * serializer writes every card back as a `_LOC` extension record with
 * its full contents (GEDCOM 7.0 §1.5 allows extension records), keeping
 * the `_LOC` pointer on its referencing places — nothing is flattened
 * or dropped. The 5.5.1 serializer flattens instead: each card's map
 * and notes are merged into every referencing place that lacks its own
 * copy (citations and media have no standard slot under PLAC and are
 * dropped), the location links are consumed, and the records are not
 * written. The exception is the GEDCOM-L dialect: a record carrying
 * the German fields below (govId, postalCodes, administrativeIds,
 * demographicData, types, extra names, parents, denomination, or
 * events) is written back as a `_LOC` record in 5.5.1 too, with the
 * `_LOC` pointer kept on its referencing places.
 */
import type { Language, Pointer, Text, Xref } from '../primitives';
import type {
  ChangeDate,
  DateStructure,
  EventDetail,
  IdentifierStructure,
  NoteStructure,
} from './common';
import type { MapCoordinates, PostalCodeStructure } from './names-places';
import type { MultimediaLink, SourceCitation } from './sources-media';
import type { GedcomStructureBase } from './extensions';

/**
 * GEDCOM 5.5EL "Extended Locations" — one MAP entry in the EL coordinate
 * form: the coordinates as the payload plus the TYPE naming the
 * coordinate system. See PlaceRecord.elMaps.
 */
export interface ElMapStructure extends GedcomStructureBase {
  /** The MAP payload, {1:1} — the coordinates in the TYPE system. */
  payload: Text;
  /** TYPE {1:1} — the coordinate system: DEGREE (degrees) or MAIDENHEAD (a Maidenhead locator). */
  type: 'DEGREE' | 'MAIDENHEAD';
}

export interface PlaceRecord extends GedcomStructureBase {
  tag: '_PLAC';
  /** The record's cross-reference identifier (@…@); optional when nothing points to it. */
  xref?: Xref;
  /** The place name, {1:1} Text — the key events match by. */
  payload: Text;
  /** ABBR {0:1} — an abbreviation (Legacy `_PLAC_DEFN`). Written back under the `_LOC` record in 7.0; dropped on the 5.5.1 flattening. */
  abbreviation?: Text;
  /**
   * `_PREP` {0:1} — the location preposition: the word or phrase that
   * prefixes the place name in a report sentence (Legacy's
   * `_PLAC_DEFN` records; see its "Custom GEDCOM Tags" help:
   * https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm, and
   * the GenWiki "GEDCOM/_Nutzerdef-Tag" table:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag). Not part of any
   * GEDCOM version. Recognized on input and written back as `_PREP` in
   * both versions (the record survives as a `_LOC` record for it, like
   * the other card fields without a standard equivalent).
   */
  preposition?: Text;
  /** MAP {0:1} — a representative point for the location. */
  map?: MapCoordinates;
  /**
   * MAP {0:M} — the GEDCOM 5.5EL coordinate form: the MAP line carries
   * the coordinates as its payload (degrees `50.1234N 128.9876E` or a
   * Maidenhead locator `JO99HZ`) with a TYPE substructure naming the
   * coordinate system (DEGREE or MAIDENHEAD). The GEDCOM 5.5EL
   * specification ("Extended Locations", GenWiki:
   * https://wiki.genealogy.net/GEDCOM_5.5EL) defines several such MAP
   * entries per `_LOC` record, alongside the standard GEDCOM 5.5.1 MAP
   * with LATI/LONG children (modelled as `map`). The GEDCOM-L working
   * group deprecated the EL form in favour of the standard MAP plus
   * `_MAIDENHEAD`, but it is still written by GEDCOM 5.5EL exporters.
   * Recognized on input in both versions and written back as the
   * payload MAP + TYPE form under the `_LOC` record in both versions.
   */
  elMaps?: ElMapStructure[];
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** <<SOURCE_CITATION>> {0:M}. */
  citations?: SourceCitation[];
  /** <<MULTIMEDIA_LINK>> {0:M}. */
  media?: MultimediaLink[];
  /**
   * `_GOV` {0:1} — the place's identifier in the GOV gazetteer (GEDCOM-L,
   * e.g. `WEIHEN_W6051`). Written back as `_GOV` in both versions (the
   * record survives for this).
   */
  govId?: Text;
  /**
   * `_MAIDENHEAD` {0:1} — the place's Maidenhead QTH locator (GEDCOM-L).
   * Written back as `_MAIDENHEAD` in both versions.
   */
  maidenhead?: Text;
  /** `TYPE` {0:M} — the kind of place object (Ort, Kreis, …; GEDCOM-L), each optionally dated. */
  types?: PlaceTypeStructure[];
  /** `_POST` {0:M} — postal codes, each with the period it was in force (GEDCOM-L). */
  postalCodes?: PostalCodeStructure[];
  /** `_AIDN` {0:M} — administrative identifiers (Gemeindekennzahl, ISO 3166, …; GEDCOM-L). */
  administrativeIds?: AdministrativeIdStructure[];
  /** `_DMGD` {0:M} — demographical data with the required TYPE (GEDCOM-L). */
  demographicData?: DemographicDataStructure[];
  /** `NAME` {1:M} — the place names; `payload` is the first. The further entries are name variants (GEDCOM-L). */
  names?: PlaceNameStructure[];
  /** `RELI` {0:1} — the denomination of the place object (GEDCOM-L; churches in particular). */
  denomination?: Text;
  /** `EVEN` {0:M} — events of the place object with an event detail (GEDCOM-L). */
  events?: PlaceEventStructure[];
  /**
   * `_LOC @xref@` {0:M} — the parent places in the GEDCOM-L hierarchy,
   * each optionally qualified by the relationship kind (POLI =
   * administrative, RELI = ecclesiastical, GEOG = geographic, CULT =
   * cultural). Written back in both versions.
   */
  parents?: PlaceHierarchyLink[];
  /** <<IDENTIFIER_STRUCTURE>> {0:M} — REFN and the vendor `_UID` are recognized. */
  identifiers?: IdentifierStructure[];
  /** <<CHANGE_DATE>> {0:1}. */
  changeDate?: ChangeDate;
}

/**
 * GEDCOM-L `_LOC` record, production `TYPE` — the kind of a place object,
 * optionally dated and backed by the GOV object-type id. The GEDCOM-L
 * agreements (L1/L1.5) are documented in the GenWiki article
 * "GEDCOM/_LOC-Tag" (https://wiki.genealogy.net/GEDCOM/_LOC-Tag).
 */
export interface PlaceTypeStructure extends GedcomStructureBase {
  /** The TYPE payload, {1:1} Text — the place-object kind. */
  type: Text;
  /** `_GOVTYPE` {0:1} — the GOV object-type id (a small positive integer). */
  govTypeId?: Text;
  /** `DATE` {0:1} — the period the type was in force. */
  date?: DateStructure;
  /** <<SOURCE_CITATION>> {0:M}. */
  citations?: SourceCitation[];
}

/**
 * GEDCOM-L `_LOC` record, production `_AIDN` — an administrative or
 * official identifier (Gemeindekennzahl, ISO 3166, …) with the required
 * TYPE naming the identifier's kind.
 */
export interface AdministrativeIdStructure extends GedcomStructureBase {
  /** The `_AIDN` payload, {1:1} Text. */
  identifier: Text;
  /** `TYPE` {1:1} — the kind of identifier. */
  type: Text;
  /** `DATE` {0:1} — the period the identifier was in force. */
  date?: DateStructure;
  /** <<SOURCE_CITATION>> {0:M}. */
  citations?: SourceCitation[];
}

/**
 * GEDCOM-L `_LOC` record, production `_DMGD` — demographical data about
 * the place object (households, inhabitants, occupations, …) with the
 * required TYPE naming the data kind and an optional survey DATE.
 */
export interface DemographicDataStructure extends GedcomStructureBase {
  /** The `_DMGD` payload, {1:1} Text. */
  data: Text;
  /** `TYPE` {1:1} — the kind of demographical data. */
  type: Text;
  /** `DATE` {0:1} — when the data was surveyed. */
  date?: DateStructure;
  /** <<SOURCE_CITATION>> {0:M}. */
  citations?: SourceCitation[];
}

/**
 * GEDCOM-L `_LOC` record, production `NAME` — a place name, optionally
 * dated (names change: the validity period says when this name was in
 * force) and abbreviated. `payload` holds the first entry's name.
 */
export interface PlaceNameStructure extends GedcomStructureBase {
  /** The NAME payload, {1:1} Text. */
  name: Text;
  /** `DATE` {0:1} — the period the name was in force. */
  date?: DateStructure;
  /**
   * `ABBR` {0:M} — the abbreviations of the name. The GEDCOM-L
   * agreement L1 gives each NAME several abbreviations, each
   * optionally qualified by a TYPE naming its kind (GenWiki
   * "GEDCOM/_LOC-Tag": https://wiki.genealogy.net/GEDCOM/_LOC-Tag).
   * One place object typically carries several short forms of
   * different kinds side by side — an ISO 3166 code, the official
   * short form used in documents, a colloquial one — and the TYPE
   * keeps them apart. Written back as `_LOC` in both versions.
   */
  abbreviations?: PlaceAbbreviation[];
  /** `LANG` {0:1} — the language of the name. */
  language?: Language;
  /** <<SOURCE_CITATION>> {0:M}. */
  citations?: SourceCitation[];
}

/**
 * GEDCOM-L `_LOC` record, production `ABBR` (L1/L3) — one abbreviation
 * of a place name, optionally qualified by the kind of abbreviation.
 * L3 definitions: `<ABBREVIATION_OF_NAME>` {Size=1:20} — the
 * abbreviation of the place name, whose kind is further explained by
 * the optional TYPE; `<TYPE_OF_ABBREVIATION>` {Size=1:20} — the kind
 * of abbreviation, "z.B. ISO 3166". Documented in the GenWiki article
 * "GEDCOM/_LOC-Tag" (https://wiki.genealogy.net/GEDCOM/_LOC-Tag).
 */
export interface PlaceAbbreviation extends GedcomStructureBase {
  /** The ABBR payload, {1:1} Text — the abbreviation of the name. */
  abbreviation: Text;
  /** `TYPE` {0:1} — the kind of abbreviation (e.g. ISO 3166). */
  type?: Text;
}

/**
 * GEDCOM-L `_LOC` record, production `_LOC` — a link to a parent place
 * in the hierarchy, optionally qualified by the relationship kind and
 * the period the assignment was in force.
 */
export interface PlaceHierarchyLink extends GedcomStructureBase {
  /** The `_LOC` payload, {1:1} Pointer to the parent PlaceRecord. */
  parent: Pointer<PlaceRecord>;
  /** `TYPE` {0:1} — POLI (administrative), RELI (ecclesiastical), GEOG (geographic), or CULT (cultural). */
  type?: 'POLI' | 'RELI' | 'GEOG' | 'CULT';
  /** `DATE` {0:1} — the period the assignment was in force. */
  date?: DateStructure;
  /** <<SOURCE_CITATION>> {0:M}. */
  citations?: SourceCitation[];
}

/**
 * GEDCOM-L `_LOC` record, production `EVEN` — an event of the place
 * object (e.g. the granting of city rights) with an event detail.
 */
export interface PlaceEventStructure extends GedcomStructureBase {
  /** GEDCOM 5.5.1 §2 (p.33) `EVENT_DETAIL` context; the tag is EVEN. */
  tag: 'EVEN';
  /** The EVEN payload, {0:1} Text — the event descriptor. */
  payload?: Text;
  /** <<EVENT_DETAIL>> {0:1}. */
  detail?: EventDetail;
}
