/**
 * GEDCOM 7.0 §1.5 Extensions — the Legacy Family Tree event-definition
 * record, modelled as an extension record.
 *
 * `0 _EVENT_DEFN` starts an Event Definition record that describes the
 * attributes of an event or fact type: which fields are shown on
 * reports and the sentence templates used to word them. Written by
 * Legacy Family Tree and Personal Ancestral File (see the Legacy
 * "Custom GEDCOM Tags" help:
 * https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm). The
 * GEDCOM 5.5.5 draft (§2, the event definition record) defines the
 * same record as `0 @X@ _EVDEF` with the TYPE, TITL, ABBR, SENT,
 * ROLE, PLAC, DATE and DESC members — the spelling RootsMagic
 * writes for its fact-type definitions (`0 _EVDEF BIRT` + `1 TITL
 * Birth` + `1 ABBR Birth` + `1 SENT [person] was born…` + `1 ROLE
 * Witness` blocks; observed in real RootsMagic exports). Not
 * part of any released GEDCOM version. Recognized on input in both
 * spellings and written back as `_EVENT_DEFN` in both versions.
 *
 * The vendor's help enumerates the members but not the wire shape, so
 * the parser accepts every documented form: the defined event/fact tag
 * may be the record payload (`0 _EVENT_DEFN BIRT` — real Legacy files
 * write the definition's name there), a bare standard-tag child
 * (`1 BIRT`, which the GEDCOM-L agreement N4 permits under a
 * user-defined tag), or the legacy `_TYPE` child; the `TYPE` child
 * carries the event kind code (`I`/`F`), `TITL` the display title, and
 * the definition members (`_CONF_FLAG`, `_DATE_TYPE`, `_DESC_FLAG`,
 * `_PLACE_TYPE`, `_PP_EXCLUDE`, `_INC_NOTES`, the `_SEN1`–`_SEN8`
 * sentences, the per-role `ROLE` sentence sets and the PAF5 sentence
 * set) are typed; everything else stays a generic extension, preserved
 * verbatim.
 */
import type { Text, Xref } from '../primitives';
import type { GedcomStructureBase } from './extensions';

export interface EventDefinitionRecord extends GedcomStructureBase {
  tag: '_EVENT_DEFN';
  /** The record's cross-reference identifier (@…@); optional when nothing points to it. */
  xref?: Xref;
  /**
   * The event or fact tag this record defines (e.g. `BIRT` or the
   * custom event name), in the vendor's spelling: the record payload
   * (real Legacy files write the definition's name there), a bare
   * standard-tag child (`1 BIRT`, which the GEDCOM-L agreement N4
   * permits under a user-defined tag), or the legacy `_TYPE` child.
   * Written back as the record payload.
   */
  eventType?: Text;
  /**
   * TYPE {0:1} — the event kind code: `I` for an individual event, `F`
   * for a family event (the values of the real Legacy exports, e.g.
   * the gedcom4j "legacycustomtags.ged" sample). Free text — the
   * vendor documents no value set. Recognized on input and written
   * back as `TYPE` in both versions.
   */
  kind?: Text;
  /**
   * TITL {0:1} — the display title of the definition. Written by
   * Legacy under the record (same real-file source as `kind`); a bare
   * `TITL` child without a payload still names the standard TITL
   * attribute as the defined tag (see `eventType`). Recognized on
   * input and written back as `TITL` in both versions.
   */
  title?: Text;
  /**
   * ROLE {0:M} — the per-role sentence sets: for each witness role of
   * the event, a block with the role name as the payload, the eight
   * role sentences (`_SEN1`…`_SEN8`) and the `_DEF` default-role mark
   * (real Legacy exports, same source as `kind`). Recognized on input
   * and written back as the ROLE blocks in both versions.
   */
  witnessRoles?: WitnessRoleSentenceSet[];
  /**
   * _INC_NOTES {0:1} — the event's notes are included in reports (a
   * presence flag; real Legacy exports, same source as `kind`).
   * Recognized on input (an absent value or `Y` marks the flag set,
   * `N` clears it) and written back as `_INC_NOTES` in both versions.
   */
  includeNotes?: boolean;
  /**
   * _CONF_FLAG Y {0:1} — the event type is confidential or private
   * (a definition-level flag; the vendor's link from a definition to
   * its event type is undocumented, so it is not projected onto
   * individual events). Recognized on input and written back as
   * `_CONF_FLAG` in both versions.
   */
  confidentialFlag?: boolean;
  /** _DATE_TYPE {0:1} — whether a Date field is shown for this event; free text (YES/NO in the wild). The RootsMagic `_EVDEF` spelling `DATE Y`/`N` (see the record JSDoc) normalizes into this slot. */
  dateType?: Text;
  /** _DESC_FLAG {0:1} — whether a Description field is shown for this event; free text. The RootsMagic `_EVDEF` spelling `DESC Y`/`N` (see the record JSDoc) normalizes into this slot. */
  descriptionFlag?: Text;
  /** _PLACE_TYPE {0:1} — whether a Place field is shown for this event; free text. The RootsMagic `_EVDEF` spelling `PLAC Y`/`N` (see the record JSDoc) normalizes into this slot. */
  placeType?: Text;
  /** _PP_EXCLUDE {0:1} — the event is excluded from the Potential Problems reporting; free text. */
  potentialProblemsExcluded?: Text;
  /**
   * ABBR {0:1} — the abbreviation of the defined event (the GEDCOM
   * 5.5.5 draft event definition record; RootsMagic writes e.g.
   * `1 ABBR Birth`). Recognized on input and written back as `ABBR`
   * in both versions.
   */
  abbreviation?: Text;
  /**
   * SENT {0:1} — the event's sentence template (the GEDCOM 5.5.5
   * draft event definition record; RootsMagic writes e.g.
   * `1 SENT [person] was born< [Date]>< [PlaceDetails]>…`). Kept
   * verbatim; written back as `SENT` in both versions.
   */
  sentence?: Text;
  /** _SEN1 {0:1} … _SEN8 {0:1} — the eight Legacy sentence definitions, kept in order (gaps stay empty). */
  sentences?: Text[];
  /** The PAF5 sentence set: _SENM/_SENF/_SENU and the Date-Only / Place-Only / Date-and-Place variants. */
  pafSentences?: PafSentenceDefinitions;
}

/**
 * One witness-role block under an `_EVENT_DEFN` record: `1 ROLE <role
 * name>` with the eight role sentence definitions (`_SEN1`…`_SEN8`,
 * kept in order, gaps stay empty) and the `_DEF` mark that the role is
 * the default one. Real Legacy exports (e.g. the gedcom4j
 * "legacycustomtags.ged" sample); not part of any GEDCOM version.
 * Written back as the ROLE block in both versions.
 */
export interface WitnessRoleSentenceSet extends GedcomStructureBase {
  tag: 'ROLE';
  /** The ROLE payload, {1:1} — the role name (e.g. `Witness`). */
  role: Text;
  /** _SEN1 {0:1} … _SEN8 {0:1} — the eight role sentences, kept in order (gaps stay empty). */
  sentences?: Text[];
  /**
   * SENT {0:1} — the role's sentence template (the GEDCOM 5.5.5
   * draft event definition record; RootsMagic writes `2 SENT
   * [ThisPerson] witnessed the birth of [person]…` under the ROLE
   * block). Written back as `SENT` in both versions.
   */
  sentence?: Text;
  /** _DEF {0:1} — the role is the default one (a presence flag). */
  defaultRole?: boolean;
}

/**
 * The PAF5 event sentence set under an `_EVENT_DEFN` record: one full
 * sentence per gender (`_SENM`, `_SENF`, `_SENU`) plus the variants for
 * when only the Date, only the Place, or the Date and Place are filled
 * in (`_SENDOM`/`_SENPOM`/`_SENDPM` for Male, `_SENDOF`/`_SENPOF`/
 * `_SENDPF` for Female, `_SENDOU`/`_SENPOU`/`_SENDPU` for Unknown).
 * All {0:1}; written back in both versions.
 */
export interface PafSentenceDefinitions {
  /** _SENM {0:1} — the full sentence for a Male individual. */
  male?: Text;
  /** _SENF {0:1} — the full sentence for a Female individual. */
  female?: Text;
  /** _SENU {0:1} — the full sentence for an individual of unknown gender. */
  unknown?: Text;
  /** _SENDOM {0:1} — Male, Date only. */
  maleDateOnly?: Text;
  /** _SENPOM {0:1} — Male, Place only. */
  malePlaceOnly?: Text;
  /** _SENDPM {0:1} — Male, Date and Place. */
  maleDateAndPlace?: Text;
  /** _SENDOF {0:1} — Female, Date only. */
  femaleDateOnly?: Text;
  /** _SENPOF {0:1} — Female, Place only. */
  femalePlaceOnly?: Text;
  /** _SENDPF {0:1} — Female, Date and Place. */
  femaleDateAndPlace?: Text;
  /** _SENDOU {0:1} — Unknown gender, Date only. */
  unknownDateOnly?: Text;
  /** _SENPOU {0:1} — Unknown gender, Place only. */
  unknownPlaceOnly?: Text;
  /** _SENDPU {0:1} — Unknown gender, Date and Place. */
  unknownDateAndPlace?: Text;
}
