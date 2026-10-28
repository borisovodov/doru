import type {
  EventEnum,
  RestrictionEnum,
  RoleEnum,
} from '../enumerations';
import type {
  AgeValue,
  DateExact,
  DatePeriodValue,
  DateValue,
  Language,
  ListEnum,
  MediaType,
  Pointer,
  Special,
  Text,
  TimeValue,
  Uri,
} from '../primitives';

import type { GedcomStructureBase } from './extensions';
import type { CensusRecord } from './census-record';
import type { IndividualRecord } from './records';
import type { MultimediaLink } from './sources-media';
import type { NoteRecord } from './records';
import type { SharedNoteRecord } from './records';
import type { SourceCitation } from './sources-media';
import type { PlaceStructure } from './names-places';

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §3.2.3 Substructures — address, dates, identifiers, notes
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §3.2.3 ADDRESS_STRUCTURE — g7:ADDR: a specific building, plot, or
 * location. The payload is the full formatted address as it would appear
 * on a mailing label; if the substructures and the payload disagree, the
 * payload shall be taken as correct.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.31), `ADDRESS_STRUCTURE` — the same
 * structure, but in 5.5.1 it also carries the contact substructures PHON,
 * EMAIL, FAX and WWW {0:3} each (modelled as the optional arrays below);
 * in 7.0 they moved to the record level and are absent here.
 */
export interface AddressStructure extends GedcomStructureBase {
  /** The ADDR payload, {1:1} Special — the full formatted address. In 5.5.1 the payload is split across ADDR plus up to 3 CONT continuation lines. */
  payload: Special;
  /** ADR1 {0:1}, g7:ADR1 — first line of the address; should not be added to new files. */
  line1?: Special;
  /** ADR2 {0:1}, g7:ADR2 — second line of the address; should not be added to new files. */
  line2?: Special;
  /** ADR3 {0:1}, g7:ADR3 — third line of the address; should not be added to new files. */
  line3?: Special;
  /** CITY {0:1}, g7:CITY — the name of the city. */
  city?: Special;
  /** STAE {0:1}, g7:STAE — a geographical division of a larger jurisdictional area. */
  state?: Special;
  /** POST {0:1}, g7:POST — a postal code. */
  postalCode?: Special;
  /** CTRY {0:1}, g7:CTRY — the name of the country. */
  country?: Special;
  /**
   * _PRIV {0:1} — marks the address as private. Written by Legacy
   * Family Tree (see its "Custom GEDCOM Tags" help:
   * https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm); not
   * part of any GEDCOM version (no standard has a restriction slot
   * under an address). Recognized on input and written back as `_PRIV`
   * in both versions.
   */
  private?: boolean;
  /**
   * _NAME {0:1} — the name of the addressee, written by PAF and Family
   * Origins under the address block (see the Legacy "User-Defined
   * GEDCOM Tags" help:
   * https://www.legacyfamilytree.se/WEB_US/user_defined_gedcom_tags.htm);
   * not part of any GEDCOM version. Recognized on input and written
   * back as `_NAME` in both versions.
   */
  name?: Text;
  /** PHON {0:3} — GEDCOM 5.5.1-only; 7.0 keeps phone numbers on the records. The 5.5.1 limit of 3 is enforced at validation time. Cross-version serialization relocates the values: to the record/detail level for 7.0, and into this address for 5.5.1. */
  phone?: Special[];
  /** EMAIL {0:3} — GEDCOM 5.5.1-only; 7.0 keeps email addresses on the records. The 5.5.1 limit of 3 is enforced at validation time. Cross-version serialization relocates the values: to the record/detail level for 7.0, and into this address for 5.5.1. */
  email?: Special[];
  /** FAX {0:3} — GEDCOM 5.5.1-only; 7.0 keeps fax numbers on the records. The 5.5.1 limit of 3 is enforced at validation time. Cross-version serialization relocates the values: to the record/detail level for 7.0, and into this address for 5.5.1. */
  fax?: Special[];
  /** WWW {0:3} — GEDCOM 5.5.1-only; 7.0 keeps web addresses on the records. The 5.5.1 limit of 3 is enforced at validation time. Cross-version serialization relocates the values: to the record/detail level for 7.0, and into this address for 5.5.1. */
  www?: Special[];
  /**
   * _SORT {0:1} — the spelling of the addressee's name used when
   * sorting addresses for a report. Written by Legacy Family Tree
   * under its address blocks (see its "Custom GEDCOM Tags" help:
   * https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm);
   * not part of any GEDCOM version. Recognized on input and written
   * back as `_SORT` in both versions.
   */
  sortName?: Text;
  /**
   * _LIST1 {0:1} — marks the address as part of Legacy's "Newsletter"
   * report grouping (the vendor's "Custom GEDCOM Tags" help documents
   * the value `YES`:
   * https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm);
   * not part of any GEDCOM version. Recognized on input (an absent
   * value, `Y`, or `YES` marks the flag set; `N`/`NO` clears it) and
   * written back as `_LIST1 YES` in both versions.
   */
  newsletterList?: boolean;
  /**
   * _LIST2 {0:1} — marks the address as part of Legacy's "Family
   * Association" report grouping. Same source, value convention and
   * serialization as `newsletterList`; written back as `_LIST2 YES`.
   */
  familyAssociationList?: boolean;
  /**
   * _LIST3 {0:1} — marks the address as part of Legacy's "Birthday"
   * report grouping. Same source, value convention and serialization
   * as `newsletterList`; written back as `_LIST3 YES`.
   */
  birthdayList?: boolean;
  /**
   * _LIST4 {0:1} — marks the address as part of Legacy's "Research"
   * report grouping. Same source, value convention and serialization
   * as `newsletterList`; written back as `_LIST4 YES`.
   */
  researchList?: boolean;
  /**
   * _LIST5 {0:1} — marks the address as part of Legacy's "Christmas"
   * report grouping. Same source, value convention and serialization
   * as `newsletterList`; written back as `_LIST5 YES`.
   */
  christmasList?: boolean;
  /**
   * _LIST6 {0:1} — marks the address as part of Legacy's "Holiday"
   * report grouping. Same source, value convention and serialization
   * as `newsletterList`; written back as `_LIST6 YES`.
   */
  holidayList?: boolean;
}

/**
 * GEDCOM 7.0 §3.2.3 ASSOCIATION_STRUCTURE — g7:ASSO: an individual associated with
 * the subject of the superstructure. The nature of the association is
 * given by the ROLE substructure.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.31), `ASSOCIATION_STRUCTURE` — the same
 * pointer, but 5.5.1 states the association with the RELA tag (a free-text
 * relation descriptor, modelled as `relationship`) instead of the ROLE
 * enumeration; in 5.5.1 `role` is absent, in 7.0 `relationship` is absent.
 */
export interface AssociationStructure extends GedcomStructureBase {
  tag: 'ASSO';
  /** The ASSO payload, {1:1} pointer to an INDI record; a voidPtr with a PHRASE describes an unreferenced person. */
  individual: Pointer<IndividualRecord>;
  /** PHRASE {0:1}, g7:PHRASE. */
  phrase?: Text;
  /** ROLE {1:1}, g7:ROLE — Enum of g7:enumset-ROLE. Required in 7.0; 5.5.1 uses RELA instead. When serializing to 5.5.1 the role is spelled out as the free-text RELA descriptor (OTHER uses the phrase); an association with neither is dropped. */
  role?: RoleStructure;
  /** RELA {1:1} — a free-text relation descriptor. GEDCOM 5.5.1 §2 (p.60); 7.0 uses ROLE instead. When serializing to 7.0 the descriptor becomes ROLE OTHER with the descriptor kept in the PHRASE. */
  relationship?: Text;
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** <<SOURCE_CITATION>> {0:M}. */
  citations?: SourceCitation[];
}

/**
 * GEDCOM 7.0 §3.2.3 ASSOCIATION_STRUCTURE — g7:ROLE: an enumerated value indicating
 * what role a person played in an event or a person's life.
 *
 * GEDCOM 5.5.1 §2 (p.61), `ROLE_IN_EVENT` — the same context; 5.5.1
 * additionally allows any free-form role descriptor enclosed in
 * parentheses, which is normalized on import to OTHER with the
 * descriptor kept in the ROLE.PHRASE substructure.
 */
export interface RoleStructure extends GedcomStructureBase {
  /** The ROLE payload, {1:1} Enum of g7:enumset-ROLE. */
  payload: RoleEnum;
  /** PHRASE {0:1}, g7:PHRASE. */
  phrase?: Text;
}

/**
 * GEDCOM 7.0 §3.2.3 CHANGE_DATE — g7:CHAN: the date of the most recent modification
 * of the superstructure, optionally with notes about that modification.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.31), `CHANGE_DATE` — identical.
 */
export interface ChangeDate extends GedcomStructureBase {
  tag: 'CHAN';
  /** DATE {1:1}, g7:DATE-exact — the date of the most recent modification. */
  date: DateExactStructure;
  /** <<NOTE_STRUCTURE>> {0:M} — may describe previous changes as well. */
  notes?: NoteStructure[];
  /**
   * _WT_USER {0:1} — the user name of the user who made the change.
   * Written by webtrees (and kiwitrees) under CHAN (see the GenWiki
   * "GEDCOM/_Nutzerdef-Tag" table:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag); not part of any
   * GEDCOM version. Recognized on input and written back as `_WT_USER`
   * in both versions.
   */
  user?: Text;
}

/**
 * GEDCOM 7.0 §3.2.3 CREATION_DATE — g7:CREA: the date of the initial creation of the
 * superstructure. Should not be modified after the structure is created.
 *
 * 7.0-only: 5.5.1 has no CREA.
 */
export interface CreationDate extends GedcomStructureBase {
  tag: 'CREA';
  /** DATE {1:1}, g7:DATE-exact. */
  date: DateExactStructure;
}

/**
 * GEDCOM 7.0 §3.2.3 DATE_VALUE — g7:DATE: a date, optionally with a time and/or a
 * phrase. The payload is a DateValue; it may be empty when a PHRASE or
 * TIME is desired instead.
 *
 * GEDCOM 5.5.1 §2 Primitive Elements (p.47), `DATE_VALUE` — identical
 * context; 5.5.1 keeps the phrase inside the payload (parenthesized) and
 * supports the `INT` (interpreted) prefix, both moved to the PHRASE
 * substructure in 7.0.
 */
export interface DateStructure extends GedcomStructureBase {
  /** The DATE payload, {1:1} DateValue; absent when the payload is the empty string. */
  value?: DateValue;
  /** TIME {0:1}, g7:TIME — asserts the event happened at a specific time on a single day. */
  time?: TimeValue;
  /** PHRASE {0:1}, g7:PHRASE — textual information that cannot be expressed in the payload. */
  phrase?: Text;
}

/**
 * GEDCOM 7.0 §3.2.3 — g7:DATE-exact: a fully-known Gregorian date with an optional
 * time. Used by CHANGE_DATE, CREATION_DATE, HEAD.DATE,
 * HEAD.SOUR.DATA.DATE and ord-STAT.DATE.
 *
 * GEDCOM 5.5.1 §2 — the same context (CHAN.DATE `CHANGE_DATE` p.44,
 * HEAD.DATE `TRANSMISSION_DATE` p.63, HEAD.SOUR.DATA.DATE
 * `PUBLICATION_DATE` p.59, STAT.DATE).
 */
export interface DateExactStructure extends GedcomStructureBase {
  /** The DATE payload, {1:1} DateExact. */
  value: DateExact;
  /** TIME {0:1}, g7:TIME. */
  time?: TimeValue;
}

/**
 * GEDCOM 7.0 §3.2.3 — g7:NO-DATE / g7:DATA-EVEN-DATE: a DatePeriod payload with an
 * optional phrase. The payload may be empty.
 *
 * GEDCOM 5.5.1 §2 Primitive Elements (p.46), `DATE_PERIOD` — identical
 * form for DATA.DATE.
 */
export interface DatePeriodStructure extends GedcomStructureBase {
  /** The DATE payload, DatePeriod; absent when the payload is the empty string. */
  value?: DatePeriodValue;
  /** PHRASE {0:1}, g7:PHRASE. */
  phrase?: Text;
}

/**
 * GEDCOM 7.0 §3.2.3 EVENT_DETAIL — g7:SDATE: a date used as a sorting hint. Intended
 * for use when the actual date is unknown but the display order depends
 * on date; it conveys no historical meaning.
 *
 * 7.0-only: 5.5.1 has no SDATE.
 */
export interface SortDateStructure extends GedcomStructureBase {
  /** The SDATE payload, {0:1} DateValue. */
  value?: DateValue;
  /** TIME {0:1}, g7:TIME. */
  time?: TimeValue;
  /** PHRASE {0:1}, g7:PHRASE. */
  phrase?: Text;
}

/**
 * GEDCOM 7.0 §3.2.3 EVENT_DETAIL — substructures shared by most individual and
 * family events and attributes.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.32), `EVENT_DETAIL` — the same set of
 * substructures; 5.5.1 has no PHON/EMAIL/FAX/WWW, SDATE, ASSO or UID here
 * (all 7.0-only) and places the TYPE tag inside this structure (in 7.0 it
 * sits directly under the event/attribute).
 */
export interface EventDetail extends GedcomStructureBase {
  /** <<DATE_VALUE>> {0:1}, g7:DATE. */
  date?: DateStructure;
  /**
   * `_DATE2` {0:1} — the end date of an event ("bis-Datum"): the
   * second date of a date range, complementing DATE (a marriage "from
   * … to …", a residence period). Written by PAF, Ancestral Quest,
   * Ancestry Family Tree, Family Trees Quick & Easy, Heritage Family
   * Tree Deluxe and PhpGedView; the Legacy catalog records AQ3's
   * meaning ("used for second date in a date range",
   * https://www.legacyfamilytree.se/WEB_US/user_defined_gedcom_tags.htm)
   * and the GenWiki "GEDCOM/_Nutzerdef-Tag" table of the GEDCOM-L
   * working group spells out the semantics — "'bis-Datum', also
   * Endedatum eines Ereignisses. Wert wie be DATE — Value same as
   * DATE" (https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag). The
   * payload uses the same date grammar as DATE. Not part of any GEDCOM
   * version (neither 5.5.1 nor 7.0 has a separate end-date slot; the
   * 7.0 DATE can express FROM/TO inside one payload, but merging two
   * separately entered dates would invent data the vendor did not
   * record). Recognized on input in both versions and written back as
   * `_DATE2` in both versions.
   */
  endDate?: DateStructure;
  /** <<PLACE_STRUCTURE>> {0:1}, g7:PLAC. */
  place?: PlaceStructure;
  /**
   * `_PLAC` {0:M} — additional places of the event (the Family
   * Historian convention for "from → to" places such as an emigration),
   * ordered by importance with the primary place first. Not part of any
   * GEDCOM version (see the "Common GEDCOM Extensions" catalog:
   * https://jfcardinal.github.io/GEDCOM-5.5.2/extensions.html).
   * Recognized on input and written back as `_PLAC` in both versions.
   */
  additionalPlaces?: PlaceStructure[];
  /** <<ADDRESS_STRUCTURE>> {0:1}, g7:ADDR. */
  address?: AddressStructure;
  /** PHON {0:M}, g7:PHON. */
  phone?: Special[];
  /** EMAIL {0:M}, g7:EMAIL. */
  email?: Special[];
  /** FAX {0:M}, g7:FAX. */
  fax?: Special[];
  /** WWW {0:M}, g7:WWW. */
  www?: Special[];
  /** AGNC {0:1}, g7:AGNC — the entity responsible for the associated context. */
  agency?: Text;
  /** RELI {0:1}, g7:RELI — a religious denomination associated with the event or attribute. */
  religiousAffiliation?: Text;
  /** CAUS {0:1}, g7:CAUS — the reasons which precipitated an event. */
  cause?: Text;
  /**
   * _SENT {0:1} — the event sentence (report wording). Written by
   * RootsMagic under events and facts (see the Legacy "User-Defined
   * GEDCOM Tags" help, which catalogs the non-underscore `SENT`
   * spelling:
   * https://www.legacyfamilytree.se/WEB_US/user_defined_gedcom_tags.htm);
   * not part of any GEDCOM version. Legacy Family Tree names the same
   * slot `_OVER` ("An event sentence override", its "Custom GEDCOM
   * Tags" help:
   * https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm; the
   * GenWiki "GEDCOM/_Nutzerdef-Tag" table confirms the position under
   * events). Both spellings are recognized on input — `_SENT` in both
   * versions plus `SENT` on 5.x input, `_OVER` in both versions — and
   * written back as `_SENT` in both versions.
   */
  sentence?: Text;
  /**
   * _PPFX {0:1} — the place prefix (report wording). Written by
   * RootsMagic under events and facts (the Legacy catalog spells it
   * without the underscore); not part of any GEDCOM version. Recognized
   * on input as `_PPFX` in both versions and as `PPFX` on 5.x input;
   * written back as `_PPFX` in both versions.
   */
  placePrefix?: Text;
  /**
   * `_GODP` {0:M} — the godparents, as free text (names and
   * descriptions, not pointers): the German GEDCOM-L convention
   * (agreement ASSO A4), usually under a baptism or christening. Not
   * part of any GEDCOM version. Recognized on input and written back
   * as `_GODP` in both versions.
   */
  godparents?: Text[];
  /**
   * `_WITN` {0:M} — the witnesses, as free text (names, not pointers):
   * the German GEDCOM-L convention (agreement ASSO A4), usually under
   * a marriage. Not part of any GEDCOM version. Recognized on input
   * and written back as `_WITN` in both versions.
   */
  witnesses?: Text[];
  /** RESN {0:1}, g7:RESN — List:Enum of g7:enumset-RESN. */
  restriction?: ListEnum<RestrictionEnum>;
  /**
   * SDATE {0:1}, g7:SDATE — a sorting hint. 5.5.1 has no SDATE; the
   * vendor extension `_SDATE` with the same value format is written
   * there instead (documented in the "Common GEDCOM Extensions"
   * catalog: https://jfcardinal.github.io/GEDCOM-5.5.2/extensions.html).
   * The vendor tag is also recognized on 7.0 input.
   */
  sortDate?: SortDateStructure;
  /**
   * <<ASSOCIATION_STRUCTURE>> {0:M} — 5.5.1 events have no ASSO; the
   * co-participant vendor extensions `_SHAR @xref@` with an optional
   * `_ROLE` (or `ROLE`) descriptor are written there instead, with the
   * free-text descriptor kept as ROLE OTHER + PHRASE (see the "Common
   * GEDCOM Extensions" catalog:
   * https://jfcardinal.github.io/GEDCOM-5.5.2/extensions.html). The
   * vendor tags are also recognized on 7.0 input, as is the German
   * GEDCOM-L `_ASSO` (agreement A3). An association without a role (a
   * bare `_SHAR`) cannot be spelled in 7.0 and is dropped when
   * serializing to 7.0.
   */
  associations?: AssociationStructure[];
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** <<SOURCE_CITATION>> {0:M}. */
  citations?: SourceCitation[];
  /** <<MULTIMEDIA_LINK>> {0:M}. */
  media?: MultimediaLink[];
  /**
   * UID {0:M}, g7:UID. 5.5.1 has no UID; the vendor extension `_UID` is
   * written there instead (see the "Common GEDCOM Extensions" catalog:
   * https://jfcardinal.github.io/GEDCOM-5.5.2/extensions.html). The
   * vendor tag is also recognized on 7.0 input.
   */
  uniqueIds?: Special[];
  /**
   * `_CENR @xref@` {0:M} — a pointer to the shared MagiKey census
   * record (MagiKey_CENR.yaml in the FamilySearch GEDCOM registry:
   * https://github.com/FamilySearch/GEDCOM-registries/blob/main/structure/extension/MagiKey_CENR.yaml).
   * The registry names `BIRT`, `INDI-CENS` and `OCCU` {0:M} each as
   * superstructures: the link is "semantically similar to `SOUR`, but
   * points to a census record rather than a source record", so the
   * census is stored once and the events of every recorded person
   * reference it. The parser recognizes the link in any event or
   * attribute detail (the pointer payload is unambiguous); the pointer
   * must resolve to an existing `_CENR` record
   * (`document.xref-not-found` otherwise). Written back as `_CENR` in
   * both versions.
   */
  censusLinks?: Pointer<CensusRecord>[];
  /**
   * _APID {0:M} — Ancestry.com record references, format `dbid::record`
   * (in the wild often prefixed, e.g. `1,7602::2771226`), written by
   * Ancestry tree downloads under events and attributes — not only
   * under source citations (the GenWiki "GEDCOM/_Nutzerdef-Tag"
   * catalog lists `INDI.Events` as a superstructure:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag). Not part of any
   * GEDCOM version (documented by TMG to GEDCOM:
   * https://tmgtogedcom.com/en/apid.htm). Recognized on input and
   * written back as `_APID` in both versions.
   */
  ancestryPointers?: Text[];
  /**
   * _PRI {0:1} — marks the event or attribute as the primary one of its
   * kind for the subject (the birth, the residence, …). Written by
   * AGES! as the bare tag (see the GenWiki "GEDCOM/_Nutzerdef-Tag"
   * table: https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag); not part
   * of any GEDCOM version. Recognized on input (an absent value or `Y`
   * marks the flag set, `N` clears it) and written back as the bare
   * `_PRI` in both versions.
   */
  primary?: boolean;
  /**
   * _EVN {0:1} — the event number, a free-text number the vendor
   * assigns to each event and references from witness links ("Witness
   * at event _EVN ##"). Written by Brother's Keeper 6+ (see the
   * GenWiki "GEDCOM/_Nutzerdef-Tag" table:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag); not part of any
   * GEDCOM version. Recognized on input and written back as `_EVN` in
   * both versions.
   */
  eventNumber?: Text;
}

/**
 * GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_DETAIL — substructures shared by most
 * individual events and attributes: the EVENT_DETAIL plus the age of the
 * individual.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.34), `INDIVIDUAL_EVENT_DETAIL` —
 * identical ({1:1} EVENT_DETAIL plus {0:1} AGE).
 */
export interface IndividualEventDetail extends EventDetail {
  /** AGE {0:1}, g7:AGE — the age of the individual at the time the event occurred. */
  age?: AgeStructure;
}

/**
 * GEDCOM 7.0 §3.2.3 FAMILY_EVENT_DETAIL — substructures shared by most family events
 * and attributes: the ages of each partner at the event, plus the
 * EVENT_DETAIL.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.32), `FAMILY_EVENT_DETAIL` — identical.
 */
export interface FamilyEventDetail extends GedcomStructureBase {
  /** HUSB {0:1}, g7:HUSB — details of the FAM-HUSB partner. */
  husband?: FamilyPartnerEventDetail;
  /** WIFE {0:1}, g7:WIFE — details of the FAM-WIFE partner. */
  wife?: FamilyPartnerEventDetail;
  /** <<EVENT_DETAIL>> {0:1}. */
  detail?: EventDetail;
}

/**
 * GEDCOM 7.0 §3.2.3 FAMILY_EVENT_DETAIL — g7:HUSB / g7:WIFE: the age of one partner
 * at the time of the event.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.32), `FAMILY_EVENT_DETAIL` — identical.
 */
export interface FamilyPartnerEventDetail extends GedcomStructureBase {
  /** AGE {1:1}, g7:AGE — the age of the partner at the event. */
  age: AgeStructure;
}

/**
 * GEDCOM 7.0 §3.2.3 — g7:AGE: the age of an individual at the time an event
 * occurred, with an optional phrase.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.32), `AGE` — identical context; see the
 * `AgeValue` primitive for the 5.5.1 keyword values.
 */
export interface AgeStructure extends GedcomStructureBase {
  /**
   * The AGE payload, {1:1} Age; absent for the empty age form. The 7.0
   * grammar permits omitting the payload entirely "if no suitable form
   * is known but a substructure (such as a PHRASE) is desired"
   * (GEDCOM 7.0 §2.6), and the 5.5.1 AGE_AT_EVENT grammar
   * (GEDCOM 5.5.1 §2 p.42) is likewise satisfied by the empty form.
   */
  payload?: AgeValue;
  /** PHRASE {0:1}, g7:PHRASE. */
  phrase?: Text;
  /**
   * _AGER {0:1} — an age range "Integer-Integer" (e.g. 16-26: at
   * least the first, less than the second), bounding the AGE payload
   * from both sides where the AGE grammar only allows one bound. The
   * MagiKey extension, registered in the FamilySearch GEDCOM registry
   * (structure/extension/MagiKey_AGER.yaml; a substructure of AGE).
   * Recognized on input and written back as `_AGER` in both versions.
   */
  ageRange?: Text;
}

/**
 * GEDCOM 7.0 §3.2.3 IDENTIFIER_STRUCTURE — g7:REFN: a user-generated identifier for
 * a structure.
 *
 * GEDCOM 5.5.1 §2 (p.63), `USER_REFERENCE_NUMBER` — identical tag and
 * meaning; in 5.5.1 REFN may repeat ({0:M}) at the record level.
 */
export interface ReferenceIdentifierStructure extends GedcomStructureBase {
  tag: 'REFN';
  /** The REFN payload, {1:1} Special. */
  payload: Special;
  /** TYPE {0:1}, g7:TYPE. */
  type?: Text;
}

/**
 * GEDCOM 7.0 §3.2.3 IDENTIFIER_STRUCTURE — g7:UID: a globally-unique identifier of
 * the superstructure, to be preserved across edits. It is recommended
 * that new identifiers be formatted as UUIDs per RFC 9562 Section 4.
 *
 * 7.0-only: 5.5.1 has no UID. The vendor extension `_UID` is
 * normalized into this structure on input in both versions, and it is
 * serialized back to 5.5.1 as `_UID`. The wild formats in real files
 * include the PAF 32+4-hex checksum form (see the "Common GEDCOM
 * Extensions" catalog:
 * https://jfcardinal.github.io/GEDCOM-5.5.2/extensions.html).
 */
export interface UniqueIdentifierStructure extends GedcomStructureBase {
  tag: 'UID';
  /** The UID payload, {1:1} Special. */
  payload: Special;
}

/**
 * GEDCOM 7.0 §3.2.3 IDENTIFIER_STRUCTURE — g7:EXID: an identifier for the subject of
 * the superstructure, maintained by the external authority given in TYPE.
 * 7.0-only: 5.5.1 has no EXID.
 */
export interface ExternalIdentifierStructure extends GedcomStructureBase {
  tag: 'EXID';
  /** The EXID payload, {1:1} Special. */
  payload: Special;
  /** TYPE {0:1}, g7:EXID-TYPE — the authority issuing the EXID, as a URI. Deprecated to omit. */
  type?: Uri;
}

/**
 * GEDCOM 7.0 §3.2.3 IDENTIFIER_STRUCTURE — the union of the three identifier
 * structures.
 */
export type IdentifierStructure =
  | ReferenceIdentifierStructure
  | UniqueIdentifierStructure
  | ExternalIdentifierStructure;

/**
 * GEDCOM 7.0 §3.2.3 NON_EVENT_STRUCTURE — g7:NO: indicates that a specific type of
 * event, given in the payload, did not happen within a given date period
 * (or never happened if there is no DATE substructure).
 *
 * 7.0-only: 5.5.1 explicitly leaves a convention for never-happened
 * events to a future release. On 5.5.1 input the Brother's Keeper
 * negatives `_NLIV` and `_NMAR`/`_NMR` normalize into bare NO DEAT and
 * NO MARR structures, and a bare NO DEAT/NO MARR on an individual is
 * written back to 5.5.1 as `_NLIV`/`_NMAR`. The FAM-level Ahnenblatt
 * `_MARR N` (and the BKW `_NMR Y`) are the same concept for a couple:
 * they normalize into a bare FAM NO MARR, which 5.5.1 writes back as
 * `_MARR N`.
 */
export interface NonEventStructure extends GedcomStructureBase {
  tag: 'NO';
  /** The NO payload, {1:1} Enum of g7:enumset-EVEN. */
  payload: EventEnum;
  /** DATE {0:1}, g7:NO-DATE — the DatePeriod during which the event did not occur. */
  date?: DatePeriodStructure;
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** <<SOURCE_CITATION>> {0:M}. */
  citations?: SourceCitation[];
}

/**
 * GEDCOM 7.0 §3.2.3 NOTE_STRUCTURE — g7:NOTE: a catch-all location for information
 * that does not fully fit within other structures.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.37), `NOTE_STRUCTURE` — identical inline
 * form; MIME, LANG and TRAN are 7.0-only.
 */
export interface Note extends GedcomStructureBase {
  tag: 'NOTE';
  /** The NOTE payload, {1:1} Text. */
  payload: Text;
  /** MIME {0:1}, g7:MIME — the media type of the payload. Dropped when serializing to 5.5.1. */
  mediaType?: MediaType;
  /** LANG {0:1}, g7:LANG — the language of the payload. Dropped when serializing to 5.5.1. */
  language?: Language;
  /** TRAN {0:M}, g7:NOTE-TRAN — translations of the payload. Each must have a MIME or LANG substructure or both. Dropped when serializing to 5.5.1. */
  translations?: NoteTranslation[];
  /** <<SOURCE_CITATION>> {0:M}. */
  citations?: SourceCitation[];
  /**
   * _PRIV {0:1} — marks the note as private: text the author recorded
   * as not for publication (living persons, sensitive material).
   * Written by WinFamily as the non-underscore `NOTP` — "Private
   * note", see the Legacy "User-Defined GEDCOM Tags" help
   * (https://www.legacyfamilytree.se/WEB_US/user_defined_gedcom_tags.htm)
   * and the GenWiki "GEDCOM/_Nutzerdef-Tag" table
   * (https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag); `NOTP` is
   * recognized on 5.x input and normalizes into an inline NOTE with
   * this flag set. The flag's wire spelling under a note is `_PRIV`
   * (the same presence-style flag Legacy writes under ADDR and
   * events): an absent value or `Y` marks the flag set, `N` clears
   * it. Written back as `_PRIV Y` in both versions; the `NOTP`
   * spelling itself is not written back (its payload becomes the
   * standard NOTE).
   */
  private?: boolean;
}

/**
 * GEDCOM 7.0 §3.2.3 NOTE_STRUCTURE — g7:SNOTE: a pointer to a note shared by
 * multiple structures.
 */
export interface SharedNoteReference extends GedcomStructureBase {
  tag: 'SNOTE';
  /** The SNOTE payload, {1:1} pointer to a SNOTE record. */
  note: Pointer<SharedNoteRecord>;
}

/**
 * GEDCOM 5.5.1 §2 Substructures (p.37), `NOTE_STRUCTURE` — a pointer to a
 * NOTE record, 5.5.1's shared-note mechanism. GEDCOM 7.0 replaced this
 * with the SNOTE pointer; both variants exist in this model.
 *
 * In 5.5.1 the pointer form may carry SOUR {0:M} lines beneath it — each
 * a bare pointer to a source record ("SOURce tags subordinate to the
 * note structure can only contain a pointer to an associated source
 * record", GEDCOM 5.5.1 §2 p.37), modelled as minimal citations. The
 * 7.0 SNOTE pointer has no substructure slot, so the citations are
 * dropped when serializing to 7.0.
 */
export interface NoteReference extends GedcomStructureBase {
  tag: 'NOTE';
  /** The NOTE payload, {1:1} pointer to a NOTE record. */
  note: Pointer<NoteRecord>;
  /** SOUR {0:M} — GEDCOM 5.5.1-only: bare pointers to the source records documenting the note. Dropped when serializing to 7.0. */
  citations?: SourceCitation[];
}

/**
 * GEDCOM 7.0 §3.2.3 NOTE_STRUCTURE — a note structure: an inline NOTE, a
 * GEDCOM 5.5.1 NOTE-record pointer, or a GEDCOM 7.0 SNOTE-record pointer.
 * Narrow the pointer variants with the `in` operator (`'note' in value`).
 */
export type NoteStructure = Note | NoteReference | SharedNoteReference;

/**
 * GEDCOM 7.0 §3.2.3 NOTE_STRUCTURE / SHARED_NOTE_RECORD — g7:NOTE-TRAN: a
 * translation of the note payload into a different language, script, or
 * media type.
 *
 * 7.0-only: 5.5.1 has no TRAN.
 */
export interface NoteTranslation extends GedcomStructureBase {
  /** The TRAN payload, {1:1} Text. */
  payload: Text;
  /** MIME {0:1}, g7:MIME — missing means the same as the superstructure. */
  mediaType?: MediaType;
  /** LANG {0:1}, g7:LANG — missing means the same as the superstructure. */
  language?: Language;
}
