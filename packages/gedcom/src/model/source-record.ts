import type { EventAttributeEnum, QualityEnum } from '../enumerations';
import type { Xref, Language, ListEnum, MediaType, Pointer, Text } from '../primitives';
import type { ChangeDate } from './common';
import type { CreationDate } from './common';
import type { TitleRecord } from './title-record';
import type { TagLink } from './evidence-record';
import type { DateExactStructure } from './common';
import type { DateStructure } from './common';
import type { DatePeriodStructure } from './common';
import type { ExtensionStructure } from './extensions';
import type { GedcomStructureBase } from './extensions';
import type { IdentifierStructure } from './common';
import type { ImportFileReference } from './common';
import type { MultimediaLink } from './sources-media';
import type { NoteStructure } from './common';
import type { PlaceStructure } from './names-places';
import type { SourceCitation } from './sources-media';
import type { SourceRepositoryCitation } from './sources-media';
import type { MftSourceQuality, WebTagStructure } from './vendor-structures';
import type { SourceFileStructure } from './multimedia-record';
import type { SubmitterRecord } from './submitter-record';

/**
 * GEDCOM 7.0 §3.2.2 SOURCE_RECORD — g7:record-SOUR: a description of an entire
 * source.
 *
 * GEDCOM 5.5.1 §2 Record Structures (p.27), `SOURCE_RECORD` — the same
 * record; 5.5.1 has no IDENTIFIER_STRUCTURE, no MIME/LANG under TEXT, and
 * the DATA.PLAC payload is a plain place name rather than a full
 * PLACE_STRUCTURE.
 */
export interface SourceRecord extends GedcomStructureBase {
  tag: 'SOUR';
  /** The record's cross-reference identifier (@…@); optional when nothing points to it. GEDCOM 7.0 §1.3; GEDCOM 5.5.1 §2 Primitive Elements (p.64), `XREF` (max 22 characters). */
  xref?: Xref;
  /** DATA {0:1}, g7:DATA — the content of the source (as opposed to metadata about it). */
  data?: SourceRecordData;
  /** AUTH {0:1}, g7:AUTH — the person, agency, or entity who created the record. */
  author?: Text;
  /** TITL {0:1}, g7:TITL — the title of the source. */
  title?: Text;
  /**
   * TITL {0:1} — the pointer form of the title: a pointer to an
   * Ancestris `TITL` record (see TitleRecord). The kennedy sample in
   * the corpus writes `1 TITL @R5@` under the SOUR record, with the
   * bibliography carried by the title record. Recognized on input and
   * written back as the pointer TITL line in both versions.
   */
  titlRef?: Pointer<TitleRecord>;
  /**
   * DATE {0:1} — the date of the source record itself. Written by the
   * Canvas Roots exports (`1 DATE 1910` under `0 @S1@ SOUR`, the
   * gedcom-sample-medium-sources fixture in the corpus); no GEDCOM
   * version has a DATE slot under SOUR. Recognized on input and
   * written back as a DATE line in both versions.
   */
  date?: DateStructure;
  /**
   * PLAC {0:1} — the place of the source record itself (the same
   * Canvas Roots shape as SourceRecord.date). Recognized on input and
   * written back as a PLAC line in both versions.
   */
  place?: PlaceStructure;
  /** ABBR {0:1}, g7:ABBR — a short name used for sorting, filing, and retrieving records. */
  abbreviation?: Text;
  /**
   * Underscore extensions of the AUTH line, kept beside the field so
   * the original nesting survives the round trip (the leaf payload
   * fields have no standard substructures; see parsing/sources.ts).
   * Written back under AUTH in both versions.
   */
  authorExtensions?: ExtensionStructure[];
  /** Underscore extensions of the TITL line; same convention as `authorExtensions`. */
  titleExtensions?: ExtensionStructure[];
  /** Underscore extensions of the ABBR line; same convention as `authorExtensions`. */
  abbreviationExtensions?: ExtensionStructure[];
  /**
   * _SUBQ {0:1} — the format used for subsequent citations of the
   * source, written by RootsMagic under the SOUR record (the
   * record-level twin of SourceCitation.subsequentCitationFormat; the
   * webtrees per-vendor custom-tag registry, RootsMagic.php, labels it
   * "Abbreviation":
   * https://github.com/fisharebest/webtrees/blob/main/app/CustomTags/RootsMagic.php).
   * Not part of any GEDCOM version. Recognized on input and written
   * back as `_SUBQ` in both versions.
   */
  subsequentCitationFormat?: Text;
  /**
   * _BIBL {0:1} — the source's bibliography entry, written by
   * RootsMagic under the SOUR record (same source as
   * `subsequentCitationFormat`). Not part of any GEDCOM version.
   * Recognized on input and written back as `_BIBL` in both versions.
   */
  bibliography?: Text;
  /**
   * MEDI {0:1} — the media type of the source (the webtrees
   * per-vendor custom-tag registry, Legacy.php, "Media type":
   * https://github.com/fisharebest/webtrees/blob/main/app/CustomTags/Legacy.php;
   * written by Legacy Family Tree under the SOUR record with the
   * standard tag in a non-standard position — neither the 5.5.1 nor
   * the 7.0 SOURCE_RECORD has a MEDI slot, and 7.0 §1.5 requires
   * extension tags to be underscore-prefixed). The value is free text
   * (in practice the 7.0 enumset-MEDI vocabulary). Not part of any
   * GEDCOM version. Recognized in any file as `MEDI` and in both
   * versions as `_MEDI`; written back as `_MEDI` in both versions.
   */
  medium?: Text;
  /** PUBL {0:1}, g7:PUBL — when and where the record was created. */
  publication?: Text;
  /**
   * DATE / PLAC under PUBL {0:1 each} — the publication date and
   * place: the Ancestry.com Family Trees extensions, registered in the
   * FamilySearch GEDCOM registry
   * (structure/extension/Ancestry_PUBL_DATE.yaml and
   * Ancestry_PUBL_PLAC.yaml). Nonconformant uses of the standard tags
   * (GEDCOM 7.0 §1.5 permits them only under extension tags), accepted
   * per the registry. Written back in 7.0; dropped when serializing to
   * 5.5.1 (the 5.5.1 PUBL is a bare text payload with no
   * substructures, so the details have no 5.5.1 slot).
   */
  publicationDetails?: SourcePublicationDetails;
  /**
   * TEXT {0:M} — verbatim copies of descriptions contained within the
   * source. GEDCOM 5.5.1 allows several; 7.0 permits one standard TEXT, so
   * the serializer writes the first as TEXT and the rest as the documented
   * `_TEXT` extension.
   */
  texts?: SourceText[];
  /** <<SOURCE_REPOSITORY_CITATION>> {0:M}. */
  repositoryCitations?: SourceRepositoryCitation[];
  /** <<IDENTIFIER_STRUCTURE>> {0:M}. */
  identifiers?: IdentifierStructure[];
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** <<MULTIMEDIA_LINK>> {0:M}. */
  media?: MultimediaLink[];
  /**
   * `_URL` {0:1} — the web address of the source. Written by the
   * Hutson family-tree data under the SOUR record (the writing
   * project's own data dictionary, in the file header: "_URL = web
   * address of the source", https://github.com/CuriousG102/family-tree);
   * the webtrees per-vendor custom-tag registry types the standard
   * `URL` under SOUR the same way (PhpGedView.php). Not part of any
   * GEDCOM version. Recognized on input and written back as `_URL` in
   * both versions.
   */
  url?: Text;
  /**
   * `_CONF` {0:1} — the confidence level of the source (the Hutson
   * convention, same source as `url`: Primary / Secondary / Tentative
   * / Provided). Not part of any GEDCOM version. Recognized on input
   * and written back as `_CONF` in both versions.
   */
  confidence?: Text;
  /**
   * `_ACC` {0:1} — the date the source was accessed (the Hutson
   * convention, same source as `url`; the values are ISO-style
   * `2026-07-11`, kept as free text). Not part of any GEDCOM version.
   * Recognized on input and written back as `_ACC` in both versions.
   */
  accessDate?: Text;
  /**
   * QUAY {0:1} — the certainty assessment of the source as a whole,
   * written by Heredis with the standard QUAY tag at record level (the
   * webtrees per-vendor custom-tag registry, Heredis.php, `SOUR:QUAY` =
   * CertaintyAssessment "Quality of data":
   * https://github.com/fisharebest/webtrees/blob/main/app/CustomTags/Heredis.php;
   * the alainamand and Dudouyt Heredis exports in the corpus). No
   * GEDCOM version has the slot (5.5.1 puts QUAY under the citation's
   * DATA, 7.0 keeps it on citations only). Recognized on input and
   * written back as the same record-level QUAY for round-trip fidelity.
   */
  certainty?: QualityEnum;
  /**
   * _UPD {0:1} — the record's last-updated timestamp, kept verbatim
   * (the wire format is undocumented). Written by MyHeritage under any
   * record (the webtrees per-vendor custom-tag registry, MyHeritage.php,
   * `*:_UPD` "Updated at":
   * https://github.com/fisharebest/webtrees/blob/main/app/CustomTags/MyHeritage.php;
   * the corpus carries it on the SOUR records of the MyHeritage-processed
   * exports) — the same slot `IndividualRecord.updatedAt` and
   * `FamilyRecord.updatedAt` carry. Not part of any GEDCOM version.
   * Recognized on input and written back as `_UPD` in both versions.
   */
  updatedAt?: Text;
  /**
   * `_APID` {0:M} — Ancestry.com record references at the record
   * level, format `dbid::record` (in the wild often prefixed, e.g.
   * `1,1030::0`) — the same tag and value shape the citations carry
   * (see SourceCitation.ancestryPointers; written by Ancestry tree
   * downloads under the SOUR record too). Not part of any GEDCOM
   * version (documented by TMG to GEDCOM:
   * https://tmgtogedcom.com/en/apid.htm). Recognized on input and
   * written back as `_APID` in both versions.
   */
  ancestryPointers?: Text[];
  /**
   * `_FTSID` {0:1} — the source's id in the FamilySearch shared tree,
   * the UUID form written by the Swarm public-release family-tree
   * pack builder under the SOUR record (see
   * IndividualRecord.familyTreeSystemId). Not part of any GEDCOM
   * version. Recognized on input and written back as `_FTSID` in both
   * versions.
   */
  familyTreeSystemId?: Text;
  /**
   * `_WEBTAG {0:M}` — an external web link attached to the source
   * record: the NAME link text plus the URL address (the same
   * RootsMagic block the individuals carry, written under SOUR too;
   * see WebTagStructure). Not part of any GEDCOM version. Recognized
   * on input and written back as the `_WEBTAG` block in both
   * versions.
   */
  webTags?: WebTagStructure[];
  /**
   * FILE {0:M} — media files attached directly to the source record
   * (a file path without a separate OBJE record; the obsidian
   * charted-roots fixture writes the census images this way,
   * https://github.com/banisterious/obsidian-charted-roots). Neither
   * standard has a FILE slot under SOUR. Recognized on input and
   * written back as `FILE` under the SOUR record in both versions.
   */
  files?: SourceFileStructure[];
  /** <<CHANGE_DATE>> {0:1}. */
  changeDate?: ChangeDate;
  /** <<CREATION_DATE>> {0:1} — 7.0-only. Dropped when serializing to 5.5.1. */
  creationDate?: CreationDate;
  /**
   * RIN {0:1} — a record identification number assigned by the source
   * system. GEDCOM 5.5.1 §2 (p.43). Removed in GEDCOM 7.0; dropped when
   * serializing to 7.0.
   */
  automatedRecordId?: Text;
  /**
   * _TMPLT {0:1} — the Evidence Explained source template used to enter
   * the source: named FIELD/VALUE pairs (page, URL, film number, …)
   * plus an optional TID template identifier. Written by RootsMagic and
   * Family Tree Maker; not part of any GEDCOM version (see GED-VIEW's
   * summary: https://ged-view.com/guides/custom-gedcom-tags).
   * Recognized on input and written back as `_TMPLT` in both versions.
   */
  template?: EvidenceTemplate;
  /**
   * _FULL {0:1} — the text created by formatting the source's full
   * footnote template. Written by TMG-to-GEDCOM (see its "GEDCOM Tag
   * Names" help: https://tmgtogedcom.com/en/tag-names.htm); not part of
   * any GEDCOM version. Recognized on input and written back as `_FULL`
   * in both versions.
   */
  fullFootnote?: Text;
  /**
   * `_SOUR {0:M}` — a relocated citation under the source record
   * (structure/extension/_SOUR.yaml in the FamilySearch GEDCOM
   * registry, marked prerelease there): the standard `SOUR` tag moved
   * under the SOUR record, linking this source to another source it
   * was relocated from. The registry gives it the same payload (a
   * pointer to a SOUR record) and the same substructures as
   * SOURCE_CITATION (NOTE, OBJE, PAGE, QUAY, SNOTE, SOUR-DATA,
   * SOUR-EVEN). Recognized on input in both versions and written back
   * as `_SOUR` under the record in both versions.
   */
  relocatedCitations?: SourceCitation[];
  /**
   * `_ITALIC Y` {0:1} — marks the source title for printing in italics
   * on reports. Written by Legacy Family Tree and Ancestral Quest (see
   * Legacy's "Custom GEDCOM Tags" help:
   * https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm, and
   * the GenWiki "GEDCOM/_Nutzerdef-Tag" table:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag); not part of any
   * GEDCOM version. Recognized on input (an absent value, `Y`, or
   * `YES` marks the flag set; `N`/`NO` clears it) and written back as
   * `_ITALIC Y` in both versions.
   */
  titleItalic?: boolean;
  /**
   * `_PAREN` {0:1} — marks the publication facts of the source for
   * printing within parentheses on reports. Written by Legacy Family
   * Tree and Ancestral Quest (same sources as `titleItalic`); not part
   * of any GEDCOM version. Recognized on input with the same value
   * convention as `titleItalic` (the Legacy catalog documents the bare
   * tag) and written back as `_PAREN Y` in both versions.
   */
  publicationParenthesized?: boolean;
  /**
   * `_QUOTED Y` {0:1} — marks the source title for printing within
   * quotes on reports. Written by Legacy Family Tree and Ancestral
   * Quest (same sources as `titleItalic`); not part of any GEDCOM
   * version. Recognized on input with the same value convention as
   * `titleItalic` and written back as `_QUOTED Y` in both versions.
   */
  titleQuoted?: boolean;
  /**
   * `_TAG YES`/`_TAG NO` {0:1} — include or exclude the source
   * citation detail on reports. Written by Legacy Family Tree under a
   * SOUR record (its "Custom GEDCOM Tags" help documents the two
   * value spellings: "_TAG NO - When used under a SOUR record,
   * indicates to exclude the source citation detail on reports":
   * https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm).
   * Not part of any GEDCOM version (the same tag names under an INDI
   * record are the tag marks of IndividualRecord.marks; under an
   * address or place they mark a "tagged" item, a meaning the catalog
   * does not document beyond the tag itself — a bare tag without a
   * value is likewise not typed and stays a generic extension).
   * Recognized on input with the value required (`Y`/`YES` includes,
   * `N`/`NO` excludes) and written back as `_TAG YES`/`_TAG NO` in
   * both versions.
   */
  citationDetailIncluded?: boolean;
  /**
   * `_TAG2 YES`/`_TAG2 NO` {0:1} — include or exclude the source
   * citation itself on reports. Written by Legacy Family Tree under a
   * SOUR record ("_TAG2 NO - … indicates to exclude the source
   * citation on reports"; same source and export rule as
   * `citationDetailIncluded`).
   */
  citationIncluded?: boolean;
  /**
   * `_TAG3 YES`/`_TAG3 NO` {0:1} — include or exclude the source
   * citation detail text on reports. Written by Legacy Family Tree
   * under a SOUR record ("_TAG3 YES - … indicates to include the
   * source citation detail text on reports"; same source and export
   * rule as `citationDetailIncluded`).
   */
  citationDetailTextIncluded?: boolean;
  /**
   * `_TAG4 YES`/`_TAG4 NO` {0:1} — include or exclude the source
   * citation detail notes on reports. Written by Legacy Family Tree
   * under a SOUR record ("_TAG4 YES - … indicates to include the
   * source citation detail notes on reports"; same source and export
   * rule as `citationDetailIncluded`).
   */
  citationDetailNotesIncluded?: boolean;
  /**
   * _TYPE {0:1} — the type of the source record (Census, Birth
   * Certificate, …), the Family Historian classification of a source.
   * Documented in the Family Historian User Group knowledge base,
   * "GEDCOM Extension List":
   * <https://www.fhug.org.uk/kb/kb-article/gedcom-extension-list/>.
   * Not part of any GEDCOM version (under an OBJE record the same tag
   * is the media object kind, MultimediaRecord.objectType). Recognized
   * on input and written back as `_TYPE` in both versions.
   */
  sourceType?: Text;
  /**
   * _MASTER {0:1} — the source is to appear in the Master listing of
   * the program. Written by Ancestral Quest under a SOUR record
   * ("indicates source is to appear in Master listing", the Legacy
   * "User-Defined GEDCOM Tags" help:
   * https://www.legacyfamilytree.se/WEB_US/user_defined_gedcom_tags.htm).
   * Not part of any GEDCOM version. Recognized on input (the
   * presence-style flag convention: an absent value or `Y` marks the
   * flag set, `N` clears it) and written back as `_MASTER Y` in both
   * versions.
   */
  masterListing?: boolean;
  /**
   * _QUAL {0:1} — the Mac Family Tree 7 quality assessment of the
   * source: the `_SOUR`/`_INFO`/`_EVID` children rate the source
   * itself, the information in it, and the evidence (see
   * MftSourceQuality). Not part of any GEDCOM version. Recognized on
   * input in both versions and written back as the `_QUAL` block in
   * both versions.
   */
  quality?: MftSourceQuality;
  /**
   * _URKU {0:1} — "evidence of the event is available"
   * ("Ereignisnachweis liegt vor"), a presence flag. Written by
   * PC-AHNEN under a SOUR record (see the GenWiki
   * "GEDCOM/_Nutzerdef-Tag" table:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag); not part of any
   * GEDCOM version. Recognized on input (the presence-style flag
   * convention: an absent value or `Y` marks the flag set, `N` clears
   * it) and written back as `_URKU Y` in both versions.
   */
  evidenceAvailable?: boolean;
  /**
   * _JAG {0:1} — the volume year of the source ("Jahrgang einer
   * Quelle"), free text. Written by GenPlus under a SOUR record (same
   * source as `evidenceAvailable`); not part of any GEDCOM version.
   * Recognized on input and written back as `_JAG` in both versions.
   */
  volumeYear?: Text;
  /**
   * _SUBM {0:M} — a pointer to the submitter record of this source.
   * Written by GDO under every record ("Zeiger auf Einreicher-DS",
   * the GenWiki "GEDCOM/_Nutzerdef-Tag" table:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag); not part of any
   * GEDCOM version (FAM and INDI carry the same fact in the standard
   * SUBM {0:M} slot). Recognized on input and written back as `_SUBM`
   * in both versions.
   */
  submitters?: Pointer<SubmitterRecord>[];
  /**
   * _IMPF {0:1} — the cross-reference of this record in the file it
   * was imported from, with a PAGE child holding the id of the
   * imported file. Written by GDO at level 1 of every record ("XREF
   * for record of imported file with subtag PAGE: ID of record", same
   * source as `submitters`); not part of any GEDCOM version.
   * Recognized on input and written back as the `_IMPF` block in both
   * versions.
   */
  importReference?: ImportFileReference;
  /**
   * `_TAG @xref@` {0:M} — the organizational tags applied to the
   * record (the glamberson gedcom-tags extension applies tags to any
   * record type, tag-extension.md; see TagLink). Written back in both
   * versions.
   */
  tagLinks?: TagLink[];
}

/**
 * The vendor `_TMPLT` Evidence Explained source template: a template
 * identifier plus named field/value pairs. See SourceRecord.template.
 */
export interface EvidenceTemplate extends GedcomStructureBase {
  tag: '_TMPLT';
  /** TID {0:1} — the template identifier. */
  templateId?: Text;
  /** FIELD {1:M} — the template fields. */
  fields: EvidenceTemplateField[];
}

/**
 * One FIELD of an EvidenceTemplate: a NAME {1:1} with an optional
 * VALUE {0:1}. See SourceRecord.template.
 */
export interface EvidenceTemplateField extends GedcomStructureBase {
  tag: 'FIELD';
  /** NAME {1:1} — the field name. */
  name: Text;
  /** VALUE {0:1} — the field value. */
  value?: Text;
}

/**
 * GEDCOM 7.0 §3.2.2 SOURCE_RECORD — g7:DATA: a description of the content of the
 * source.
 *
 * GEDCOM 5.5.1 §2 Record Structures (p.27), `SOURCE_RECORD` — identical
 * DATA {0:1} (EVEN, DATE, PLAC, AGNC, NOTE).
 */
export interface SourceRecordData extends GedcomStructureBase {
  /** EVEN {0:M}, g7:DATA-EVEN — List:Enum of g7:enumset-EVENATTR: the types of events recorded in the source. */
  events?: SourceDataEvent[];
  /** AGNC {0:1}, g7:AGNC — the organization responsible for creating or archiving the records. */
  agency?: Text;
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
}

/**
 * GEDCOM 7.0 §3.2.2 SOURCE_RECORD — g7:DATA-EVEN: the types of events recorded in a
 * particular source.
 *
 * GEDCOM 5.5.1 §2 Record Structures (p.27), `SOURCE_RECORD` — identical
 * EVEN {0:M} with the comma-separated `EVENTS_RECORDED` list; 5.5.1's
 * DATA.PLAC payload is a plain place name (`SOURCE_JURISDICTION_PLACE`)
 * rather than a full PLACE_STRUCTURE and is modelled as a PlaceStructure
 * with only the payload filled.
 */
export interface SourceDataEvent extends GedcomStructureBase {
  /** The EVEN payload, {1:1} List:Enum of g7:enumset-EVENATTR. */
  payload: ListEnum<EventAttributeEnum>;
  /** DATE {0:1}, g7:DATA-EVEN-DATE — the DatePeriod covered by the entire source. */
  date?: DatePeriodStructure;
  /** <<PLACE_STRUCTURE>> {0:1}. The 5.5.1 spelling is the bare `SOURCE_JURISDICTION_PLACE` (GEDCOM 5.5.1 §2 p.27), so on 5.5.1 output only the payload is written and the 7.0 place substructures (FORM/MAP/NOTE/…) are dropped. */
  place?: PlaceStructure;
  /**
   * The user-supplied values of the 5.5.1 `EVENTS_RECORDED` list,
   * kept verbatim: GEDCOM 5.5.1 §2 (p.50) permits any value alongside
   * the `EVENT_ATTRIBUTE_TYPE` tags — "If the event or attribute
   * doesn't translate to one of these tag codes, then a user supplied
   * value is expected and will be generally classified in the category
   * of other". The known tags go to `payload`, everything else here;
   * the list has no ordering semantics in 5.5.1, so the grouping is
   * lossless. 7.0 has no slot for these values (only extTag extension
   * values, which stay in `payload`): when serializing to 7.0 an EVEN
   * whose payload is empty is dropped entirely, otherwise the
   * user-defined values are dropped silently. 5.5.1 writes them back
   * verbatim after the enums.
   */
  userDefined?: Text[];
}

/**
 * The Ancestry.com Family Trees publication details under SOUR.PUBL:
 * the publication date (a DateExact) and place (a place name), each
 * {0:1}. See SourceRecord.publicationDetails.
 */
export interface SourcePublicationDetails extends GedcomStructureBase {
  /** DATE {0:1} — the publication date (a DateExact). */
  date?: DateExactStructure;
  /** PLAC {0:1} — the publication place (a plain place name). */
  place?: Text;
}

/**
 * GEDCOM 7.0 §3.2.2 SOURCE_RECORD — g7:TEXT: a verbatim copy of text contained in
 * the source.
 *
 * GEDCOM 5.5.1 §2 (p.63), `TEXT_FROM_SOURCE` — identical context; MIME and
 * LANG are 7.0-only.
 */
export interface SourceText extends GedcomStructureBase {
  /** The TEXT payload, {1:1} Text. */
  payload: Text;
  /** MIME {0:1}, g7:MIME. */
  mediaType?: MediaType;
  /** LANG {0:1}, g7:LANG. */
  language?: Language;
}
