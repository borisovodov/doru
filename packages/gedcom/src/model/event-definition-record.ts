/**
 * GEDCOM 7.0 §1.5 Extensions — the Legacy Family Tree event-definition
 * record, modelled as an extension record.
 *
 * `0 _EVENT_DEFN` starts an Event Definition record that describes the
 * attributes of an event or fact type: which fields are shown on
 * reports and the sentence templates used to word them. Written by
 * Legacy Family Tree and Personal Ancestral File (see the Legacy
 * "Custom GEDCOM Tags" help:
 * https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm). Not
 * part of any GEDCOM version. Recognized on input and written back as
 * `_EVENT_DEFN` in both versions.
 *
 * The vendor's help enumerates the members but not the wire shape, so
 * the parser accepts every documented form: the defined event/fact tag
 * may be the record payload (`0 _EVENT_DEFN BIRT`), a standard-tag
 * child (`1 BIRT`, which the GEDCOM-L agreement N4 permits under a
 * user-defined tag), or a `TYPE`/`_TYPE` child; the definition members
 * (`_CONF_FLAG`, `_DATE_TYPE`, `_DESC_FLAG`, `_PLACE_TYPE`,
 * `_PP_EXCLUDE`, the `_SEN1`–`_SEN8` sentences and the PAF5 sentence
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
   * The event or fact tag this record defines (e.g. `BIRT`), in the
   * vendor's spelling: the record payload, a standard-tag child, or a
   * `TYPE`/`_TYPE` child. Written back as the record payload.
   */
  eventType?: Text;
  /**
   * _CONF_FLAG Y {0:1} — the event type is confidential or private
   * (a definition-level flag; the vendor's link from a definition to
   * its event type is undocumented, so it is not projected onto
   * individual events). Recognized on input and written back as
   * `_CONF_FLAG` in both versions.
   */
  confidentialFlag?: boolean;
  /** _DATE_TYPE {0:1} — whether a Date field is shown for this event; free text (YES/NO in the wild). */
  dateType?: Text;
  /** _DESC_FLAG {0:1} — whether a Description field is shown for this event; free text. */
  descriptionFlag?: Text;
  /** _PLACE_TYPE {0:1} — whether a Place field is shown for this event; free text. */
  placeType?: Text;
  /** _PP_EXCLUDE {0:1} — the event is excluded from the Potential Problems reporting; free text. */
  potentialProblemsExcluded?: Text;
  /** _SEN1 {0:1} … _SEN8 {0:1} — the eight Legacy sentence definitions, kept in order (gaps stay empty). */
  sentences?: Text[];
  /** The PAF5 sentence set: _SENM/_SENF/_SENU and the Date-Only / Place-Only / Date-and-Place variants. */
  pafSentences?: PafSentenceDefinitions;
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
