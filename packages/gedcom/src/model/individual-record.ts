import type { RestrictionEnum, SexEnum } from '../enumerations';
import type { Xref, ListEnum, Pointer, Text } from '../primitives';
import type { AddressStructure } from './common';
import type { AssociationStructure } from './common';
import type { ChangeDate } from './common';
import type { CreationDate } from './common';
import type { ContactRecord, EducationRecord, MarriageRecord, OccupationRecord, TwinRecord } from './genopro-entity';
import type { EvidenceEvent, EvidenceReference, OccurrenceReference, TagLink } from './evidence-record';
import type { TreeTagRecord } from './tree-tag-record';
import type { GedcomStructureBase } from './extensions';
import type { IdentifierStructure } from './common';
import type { ImportFileReference } from './common';
import type { IndividualAttributeStructure } from './individual-structures';
import type { IndividualEventStructure } from './individual-structures';
import type { LdsIndividualOrdinance } from './lds';
import type { MultimediaLink } from './sources-media';
import type { NonEventStructure } from './common';
import type { NoteStructure } from './common';
import type { PersonalNameStructure } from './names-places';
import type { SourceCitation } from './sources-media';
import type { TodoStructure } from './todo-record';
import type {
  RecordFlagStructure,
  InternetSearchStructure,
  CorrespondenceStructure,
  WebTagStructure,
} from './vendor-structures';
import type { ChildFamilyLink, SpouseFamilyLink, AliasLink, WebLinkStructure } from './individual-links';
import type { SubmitterRecord } from './submitter-record';

/**
 * GEDCOM 7.0 §3.2.2 INDIVIDUAL_RECORD — g7:record-INDI: a compilation of facts or
 * hypothesized facts about an individual. Facts may be distributed across
 * multiple INDI records connected by ALIA pointers.
 *
 * GEDCOM 5.5.1 §2 Record Structures (p.25), `INDIVIDUAL_RECORD` — the same
 * record; 5.5.1 additionally has RFN, AFN and RIN and lacks the 7.0-only
 * NON_EVENT, INIL ordinance and CREA substructures.
 */
export interface IndividualRecord extends GedcomStructureBase {
  tag: 'INDI';
  /** The record's cross-reference identifier (@…@); optional when nothing points to it. GEDCOM 7.0 §1.3; GEDCOM 5.5.1 §2 Primitive Elements (p.64), `XREF` (max 22 characters). */
  xref?: Xref;
  /** RESN {0:1}, g7:RESN — List:Enum of g7:enumset-RESN. */
  restriction?: ListEnum<RestrictionEnum>;
  /** <<PERSONAL_NAME_STRUCTURE>> {0:M}. */
  names?: PersonalNameStructure[];
  /**
   * SEX {0:1}, g7:SEX — Enum of g7:enumset-SEX (M, F, X, U). The
   * GEDCOM 5.5.5 values are also accepted in any file: X (intersex;
   * also a 7.0 value) and N (not recorded; 5.5.5 §2 p.104 only). On
   * export the serializers project: 5.5.1 drops X and N (the SEX line
   * disappears), 7.0 drops N (see the `sex` projection in
   * serialize/emitter/values.ts).
   */
  sex?: SexEnum;
  /**
   * SOUR {0:M} — the citations attached to the SEX line. Family Tree
   * Maker for Mac OS X treats SEX as a citeable fact and writes full
   * source citations under it (`1 SEX M` + `2 SOUR @S453@` with
   * PAGE/DATA/TEXT, the gedcom4j willis samples — where a
   * continuation bug wraps the lines into `2 CONT 2 SOUR …`, see the
   * README's container leniencies; the gemenet Genoese-merchant trees
   * and the Ancestry-derived fixtures carry the same shape). Neither
   * grammar gives SEX substructures. Recognized on input and written back
   * under the same SEX structure in both versions for round-trip fidelity
   * when a SEX value can be written; if the value is unset or unsupported by
   * the target version, the citations fall back to the standard record-level
   * INDI citations instead of producing a bare SEX line.
   */
  sexCitations?: SourceCitation[];
  /** <<INDIVIDUAL_ATTRIBUTE_STRUCTURE>> {0:M}. */
  attributes?: IndividualAttributeStructure[];
  /** <<INDIVIDUAL_EVENT_STRUCTURE>> {0:M}. */
  events?: IndividualEventStructure[];
  /** <<NON_EVENT_STRUCTURE>> {0:M} — 7.0-only. When serializing to 5.5.1 the NO rule applies: every NO is dropped, records left empty by that are dropped too, and pointers to dropped records are removed (serialize/prepare.ts). */
  nonEvents?: NonEventStructure[];
  /**
   * _UPD {0:1} — the record's last-updated timestamp (a free text
   * value). Written by MyHeritage; not part of any GEDCOM version (see
   * GED-VIEW's summary: https://ged-view.com/guides/custom-gedcom-tags).
   * Recognized on input and written back as `_UPD` in both versions.
   */
  updatedAt?: Text;
  /**
   * `_ALTER_KB {0:1}` — the age as stated in the church book entry,
   * often down to years, months and days (a computed birth date
   * belongs under BIRT.DATE with CAL instead). The OFB-Werkstatt
   * convention — the same tag reference as occupationAsRecorded.
   * Recognized on input and written back as `_ALTER_KB` in both
   * versions.
   */
  ageAsRecorded?: Text;
  /**
   * `_TODURSACHE {0:1}` — the cause of death in the wording of the
   * church book entry. The OFB-Werkstatt convention — the same tag
   * reference as occupationAsRecorded. Recognized on input and
   * written back as `_TODURSACHE` in both versions.
   */
  deathCauseAsRecorded?: Text;
  /**
   * _CREAT {0:1} — the date the record was created (a free text value;
   * the wire format of GenPlus, which writes it, is undocumented, so
   * the value is kept verbatim rather than parsed into the 7.0 CREA
   * structure). Catalogued by the GEDCOM-L working group in the
   * GenWiki "GEDCOM/_Nutzerdef-Tag" table
   * (https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag); not part of
   * any GEDCOM version. Recognized on input and written back as
   * `_CREAT` in both versions.
   */
  createdAt?: Text;
  /**
   * _URL {0:1} — an internet address of the individual. Written by
   * Legacy Family Tree under INDI (see its "Custom GEDCOM Tags" help:
   * https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm); not part of any GEDCOM version. Recognized on input and
   * written back as `_URL` in both versions.
   */
  url?: Text;
  /**
   * _SOSA {0:1} — the individual's Sosa–Stradonitz (Ahnentafel)
   * number. Written by Ancestris, the French GEDCOM editor (see its
   * user guide, "Tags": https://docs.ancestris.org/books/user-guide/page/tags);
   * the same slot also accepts GES2000's `_AHNNR` (the ancestor-table
   * number, catalogued by the GEDCOM-L working group in the GenWiki
   * "GEDCOM/_Nutzerdef-Tag" table:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag). Not part of any
   * GEDCOM version. Recognized on input and written back as `_SOSA` in
   * both versions.
   */
  sosaNumber?: Text;
  /**
   * _FSFTID {0:1} — the person's FamilySearch Family Tree identifier
   * (PID, e.g. `KWJ1-2B3`), the permanent id of the person in the
   * FamilySearch shared tree. Written by Familienbuch, Legacy Family
   * Tree, Ancestral Quest, Family Historian and webtrees (catalogued
   * by the GEDCOM-L working group in the GenWiki
   * "GEDCOM/_Nutzerdef-Tag" table:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag); Mac Family Tree
   * and Familienbuch write the same value as `_FID`, and RootsMagic
   * writes the non-underscore `FSFTID` — both normalize into this
   * field. Not part of any GEDCOM version. Recognized on input and
   * written back as `_FSFTID` in both versions.
   */
  familySearchId?: Text;
  /**
   * `_FTSID` {0:1} — the person's id in the FamilySearch shared tree
   * in the UUID form written by the Swarm public-release family-tree
   * pack builder (HEAD.SOUR "SwarmFamilyTreePacks" in the samoilev_swarm
   * corpus files) — the same fact the `_FSFTID` PID spelling carries
   * (see `familySearchId`), in a different id form, so it keeps its
   * own slot. Not part of any GEDCOM version. Recognized on input and
   * written back as `_FTSID` in both versions.
   */
  familyTreeSystemId?: Text;
  /**
   * ADDR {0:1} — the person's contact address, written directly under
   * the INDI record (PAF and other exporters; neither standard has
   * the position — the 5.5.1/7.0 address lives under events).
   * Recognized on input with the full address grammar (the `_NAME`
   * label, ADR1–CTRY, contacts) and written back as the ADDR block
   * under the INDI record in 5.5.1; dropped on 7.0 output (7.0 has no
   * INDI address position either).
   */
  address?: AddressStructure;
  /**
   * `_MHID` {0:1} — the person's MyHeritage family-tree identifier
   * (`individual-12345` in MyHeritage exports; the same tag under FAM
   * carries the tree's family id, `family-555`). The MyHeritage
   * "My Heritage Family Tree" export writes it under every INDI and
   * FAM record. Not part of any GEDCOM version. Recognized on input
   * and written back as `_MHID` in both versions.
   */
  myHeritageId?: Text;
  /**
   * `_FIL` {0:1} — the person's filiation: their child status relative
   * to the parents recorded in the file. Written by Heredis under
   * every INDI record (observed in Heredis exports — e.g. the corpus
   * file "Dudouyt Heredis 2014-Export.ged", HEAD.SOUR "Heredis
   * MAC2021"); the observed value set is LEGITIMATE_CHILD,
   * NATURAL_CHILD, ADOPTED_CHILD and RELATIONSHIP_UNKNOW, kept
   * verbatim (free text; Heredis does not document the wire format —
   * the webtrees per-vendor registry lists `INDI:_FIL` as "what do
   * they mean?", https://github.com/fisharebest/webtrees, Heredis.php).
   * Not part of any GEDCOM version. Recognized on input and written
   * back as `_FIL` in both versions.
   */
  filiation?: Text;
  /**
  /**
   * `_GCID` {0:1} — the record's GEDitCOM id (a UUID assigned by
   * GEDitCOM II, John A. Nairn / RSAC Software — HEAD.SOUR "GEDitCOM
   * II" in the corpus file Ajmani.ged). Not part of any GEDCOM
   * version. Recognized on input and written back as `_GCID` in both
   * versions.
   */
  geditcomId?: Text;
  /**
   * NUMB {0:1} — a running number the exporter assigns to the record
   * (`1 NUMB 1`, the French gedcom-to-xml files). Kept verbatim. Not
   * part of any GEDCOM version. Recognized on input and written back
   * as `NUMB` in both versions.
   */
  sequenceNumber?: Text;
  /**
   * `_MTTAG {0:M}` — pointers to the MyHeritage tree tags applied to
   * the person (`1 _MTTAG @T10@`; see TreeTagRecord). Not part of any
   * GEDCOM version. Recognized on input and written back as `_MTTAG`
   * in both versions.
   */
  treeTags?: Pointer<TreeTagRecord>[];
  /**
   * `_AMTID` {0:1} — the person's Ancestry Member Tree reference
   * (`412781982829:1030:210595317`: the tree id, family id and person
   * id RootsMagic records for its Ancestry sync; observed in real
   * RootsMagic exports). Not part of any GEDCOM version. Recognized on
   * input and written back as `_AMTID` in both versions.
   */
  ancestryMemberTreeId?: Text;
  /**
   * `_APID` {0:M} — Ancestry.com record references directly under the
   * INDI record, format `dbid::record` (in the wild often prefixed,
   * e.g. `1,7602::12345`) — the same tag and value shape the
   * citations carry (see SourceCitation.ancestryPointers). Not part
   * of any GEDCOM version (documented by TMG to GEDCOM:
   * https://tmgtogedcom.com/en/apid.htm). Recognized on input and
   * written back as `_APID` in both versions.
   */
  ancestryPointers?: Text[];
  /**
   * `_SOSADABOVILLE` {0:1} — the person's Sosa–d'Aboville number
   * (`1 G1`: the Sosa generation followed by the position letter
   * within it), the numbering Ancestris assigns in its d'Aboville
   * view (the Ancestris user guide, "Tags":
   * https://docs.ancestris.org/books/user-guide/page/tags — the same
   * page documents `_SOSA`). Kept as free text. Not part of any
   * GEDCOM version. Recognized on input and written back as
   * `_SOSADABOVILLE` in both versions.
   */
  sosaDAboville?: Text;
  /**
   * `_OCREF @xref@` {0:M} — the references to shared occurrence
   * records (the glamberson gedcom-occurrences extension, see
   * OccurrenceRecord): the documented occurrences of the person in a
   * source the record describes, with the participation data (ROLE,
   * AGE, notes, citations) the extension's v0.2.0 spec defines
   * (https://github.com/glamberson/gedcom-occurrences,
   * occurrence-extension.md). The pointer must resolve to an existing
   * `_OCUR` record (`document.xref-not-found` otherwise). Written back
   * as `_OCREF` in both versions.
   */
  occurrences?: OccurrenceReference[];
  /**
   * `_EVREF @xref@` {0:M} — the references to floating evidence
   * records (the glamberson gedcom-evidence extension; the v1 `_EVID`
   * link spelling normalizes into the same slot, see
   * EvidenceReference). Written back as `_EVREF` in both versions.
   */
  evidence?: EvidenceReference[];
  /**
   * `_EVEN_EVID` {0:M} — the attached-evidence events (the
   * gedcom-evidence v2 "event container" pattern, see EvidenceEvent).
   * Written back in both versions.
   */
  evidenceEvents?: EvidenceEvent[];
  /**
   * `_TAG @xref@` {0:M} — the organizational tags applied to the
   * record (the glamberson gedcom-tags extension, see TagLink).
   * Written back in both versions.
   */
  tagLinks?: TagLink[];
  /**
   * _TAG {0:1} and _TAG2–_TAG9 {0:1 each} — the individual's named
   * tag marks (Tag 1 through Tag 9), kept in order. Written by Legacy
   * Family Tree under INDI (see its "Custom GEDCOM Tags" help: https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm);
   * not part of any GEDCOM version. Recognized on input and written
   * back as `_TAG`/`_TAG2`… in both versions.
   */
  marks?: Text[];
  /**
   * `_EMAIL` {0:M} — the individual's e-mail addresses. Written by
   * Brother's Keeper, Family Origins and PAF under INDI (catalogued by
   * the GEDCOM-L working group in the GenWiki "GEDCOM/_Nutzerdef-Tag"
   * table: https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag, and the
   * Legacy "User-Defined GEDCOM Tags" help:
   * https://www.legacyfamilytree.se/WEB_US/user_defined_gedcom_tags.htm);
   * not part of any GEDCOM version (the contact fields of the ADDRESS
   * and event structures are the standard positions). Recognized on
   * input and written back as `_EMAIL` in both versions.
   */
  email?: Text[];
  /**
   * PHON {0:M} — the individual's phone numbers, written directly
   * under the INDI record (PAF and the ged4web exports; the standard
   * positions are the event/address contacts). Not part of any GEDCOM
   * version. Recognized on input and written back as `PHON` in both
   * versions.
   */
  phone?: Text[];
  /**
   * FAX {0:M} — the individual's fax numbers, written directly under
   * the INDI record (PAF; see `phone`). Not part of any GEDCOM
   * version. Recognized on input and written back as `FAX` in both
   * versions.
   */
  fax?: Text[];
  /**
   * ISDEAD {0:1} — the person's vital flag (Y/N): the GenoPro trees
   * assert the person is dead without a DEAT event (observed in the
   * linguatree family tree, HEAD.SOUR "GenoPro"). Not part of any
   * GEDCOM version. Recognized on input and written back as
   * `ISDEAD Y`/`ISDEAD N` in both versions.
   */
  deceased?: boolean;
  /**
   * `_WLNK {0:M}` — an external web link attached to the person: the
   * TITL description and the NOTE payload carrying the URL (observed
   * in the Ancestry-family exports, e.g. nextjs-genealogy's
   * data_family.ged). Not part of any GEDCOM version. Recognized on
   * input and written back as the `_WLNK` block in both versions.
   */
  webLinks?: WebLinkStructure[];
  /**
   * OCCUPATIONS/EDUCATIONS/CONTACTS/UNIONS/TWINS {0:M} — pointers to
   * the GenoPro entity records of the person (see the
   * genopro-entity model). Recognized on input and written back as
   * the container lines in both versions.
   */
  occupations?: Pointer<OccupationRecord>[];
  educations?: Pointer<EducationRecord>[];
  contacts?: Pointer<ContactRecord>[];
  marriages?: Pointer<MarriageRecord>[];
  twins?: Pointer<TwinRecord>[];
  /**
   * _TODO {0:M} — research tasks attached to the individual: the
   * GenoPro / RootsMagic / Ahnenblatt to-do structure with the
   * sub-tags DESC, PRTY, STAT, DATE and NOTE (see TodoStructure; the
   * GenWiki "GEDCOM/_Nutzerdef-Tag" catalog lists it under INDI:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag). Not part of
   * any GEDCOM version. Recognized on input and written back as
   * `_TODO` in both versions.
   */
  todos?: TodoStructure[];
  /**
   * SIGN {0:1} — the person can sign (write their name). Written by
   * Der Stammbaum ≤ V6 (USM6) under INDI with a yes/no value; the
   * meaning is documented in the GenWiki "GEDCOM/_Nutzerdef-Tag"
   * article's "Tabelle 2" ("Person kann unterschreiben [ja/nein]"):
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag. Not part of any
   * GEDCOM version. Heredis writes the person's *signature* (free
   * text) under the same tag (the webtrees per-vendor custom-tag
   * registry, Heredis.php:
   * https://github.com/fisharebest/webtrees/blob/main/app/CustomTags/Heredis.php)
   * — a payload that is not one of the flag spellings (`Y`, `YES`,
   * `J`/`JA`, `1` set the flag; `N`, `NO`, `NEIN`, `0` clear it) is
   * therefore kept as a generic extension of the record instead of
   * failing the import. The 5.5.1 write-back uses the underscore
   * spelling `_SIGN 1`/`_SIGN 0` (the USM6 wire spelling is a
   * non-underscore vendor tag, and 5.5.1 requires user-defined tags
   * to begin with an underscore; both spellings are recognized on
   * input); 7.0 output drops the tag.
   */
  canSign?: boolean;
  /**
   * _CORR {0:1} — the correspondence entry of Family Origins (FO7): a
   * block with the children REAS (the reason), RESP (the response) and
   * RPLY (the reply status). Catalogued in the Legacy "User-Defined
   * GEDCOM Tags" help ("Correspondence entry", with the REAS/RESP/RPLY
   * sub-tags: https://www.legacyfamilytree.se/WEB_US/user_defined_gedcom_tags.htm);
   * not part of any GEDCOM version. Recognized on input and written
   * back as the `_CORR` block in both versions. (The bare
   * non-underscore REAS/RESP/RPLY under INDI are typed separately as
   * FACTs — see the legacy rules of parsing/vendor-tags.ts.)
   */
  correspondence?: CorrespondenceStructure;
  /**
   * _BKM {0:1} — the person is bookmarked. Written by Mac Family Tree
   * 7 under INDI (see the GenWiki "GEDCOM/_Nutzerdef-Tag" table:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag); not part of any
   * GEDCOM version. Recognized on input in both versions (the
   * presence-style flag convention: an absent value or `Y` marks the
   * flag set, `N` clears it) and written back as `_BKM Y` in both
   * versions.
   */
  bookmarked?: boolean;
  /**
   * _STP {0:1} — the start person: the individual shown first when the
   * file is opened. Written by Mac Family Tree 7 under INDI (same
   * source as `bookmarked`); not part of any GEDCOM version.
   * Recognized on input in both versions with the same presence-style
   * convention and written back as `_STP Y` in both versions.
   */
  startPerson?: boolean;
  /**
   * _ADPF {0:1} — the person was adopted by their father. Written by
   * Brother's Keeper 6+ under INDI (see the GenWiki
   * "GEDCOM/_Nutzerdef-Tag" catalog:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag); not part of any
   * GEDCOM version. Recognized on input in both versions (the
   * presence-style flag convention: an absent value or `Y` marks the
   * flag set, `N` clears it) and written back as `_ADPF Y` in both
   * versions.
   */
  adoptedByFather?: boolean;
  /**
   * _ADPM {0:1} — the person was adopted by their mother. Written by
   * Brother's Keeper 6+ under INDI (same source and export rule as
   * `adoptedByFather`); written back as `_ADPM Y`.
   */
  adoptedByMother?: boolean;
  /**
   * _GODP {0:M} — the godparents of the individual, as free text
   * (names, not pointers): the German GEDCOM-L convention (agreement
   * ASSO A4) places the text form under the individual record or under
   * the baptism/christening event (see the GenWiki "GEDCOM/ASSO-Tag"
   * article: https://wiki.genealogy.net/GEDCOM/ASSO-Tag). Not part of
   * any GEDCOM version. Recognized on input and written back as `_GODP`
   * in both versions. (Under an event the same tag types into
   * EventDetail.godparents.)
   */
  godparents?: Text[];
  /**
   * _WITN {0:M} — the witnesses of the individual, as free text
   * (names, not pointers): the German GEDCOM-L convention (agreement
   * ASSO A4); same source and export rule as `godparents`. (Under an
   * event the same tag types into EventDetail.witnesses.)
   */
  witnesses?: Text[];
  /**
   * _WEBTAG {0:M} — external web links: the RootsMagic `_WEBTAG` block
   * with the NAME text and the URL address (see WebTagStructure and the
   * webtrees per-vendor custom-tag registry, RootsMagic.php:
   * <https://github.com/fisharebest/webtrees/blob/main/app/CustomTags/RootsMagic.php>).
   * Not part of any GEDCOM version. Recognized on input and written
   * back as the `_WEBTAG` blocks in both versions.
   */
  webTags?: WebTagStructure[];
  /**
   * _FLGS {0:1} — the record flags: the Family Historian marks
   * attached to an individual record, each flag a child line whose
   * double-underscore tag is generated from the flag name and whose
   * payload is the full name (see RecordFlagStructure). Documented in
   * the Family Historian User Group knowledge base, "GEDCOM Extension
   * List": <https://www.fhug.org.uk/kb/kb-article/gedcom-extension-list/>.
   * Not part of any GEDCOM version. Recognized on input and written
   * back as the `_FLGS` block in both versions.
   */
  recordFlags?: RecordFlagStructure[];
  /**
   * _INET {0:1} — the Ahnenblatt internet-search block (see
   * InternetSearchStructure): the record's internet-search details,
   * kept verbatim. Not part of any GEDCOM version. Recognized on
   * input and written back as the `_INET` block in both versions.
   */
  internetSearch?: InternetSearchStructure;
  /** <<LDS_INDIVIDUAL_ORDINANCE>> {0:M}. */
  ordinances?: LdsIndividualOrdinance[];
  /** FAMC {0:M}, g7:INDI-FAMC — the families in which this individual appears as a child. */
  childFamilies?: ChildFamilyLink[];
  /** FAMS {0:M}, g7:FAMS — the families in which this individual appears as a partner. */
  spouseFamilies?: SpouseFamilyLink[];
  /** SUBM {0:M}, g7:SUBM — submitters that contributed this record. */
  submitters?: Pointer<SubmitterRecord>[];
  /** <<ASSOCIATION_STRUCTURE>> {0:M}. */
  associations?: AssociationStructure[];
  /** ALIA {0:M}, g7:ALIA — links to other INDI records about the same individual. */
  aliases?: AliasLink[];
  /** ANCI {0:M}, g7:ANCI — interest in additional research for ancestors. */
  ancestorInterests?: Pointer<SubmitterRecord>[];
  /** DESI {0:M}, g7:DESI — interest in research to identify additional descendants. */
  descendantInterests?: Pointer<SubmitterRecord>[];
  /** <<IDENTIFIER_STRUCTURE>> {0:M}. */
  identifiers?: IdentifierStructure[];
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** <<SOURCE_CITATION>> {0:M}. */
  citations?: SourceCitation[];
  /** <<MULTIMEDIA_LINK>> {0:M}. */
  media?: MultimediaLink[];
  /** <<CHANGE_DATE>> {0:1}. */
  changeDate?: ChangeDate;
  /** <<CREATION_DATE>> {0:1} — 7.0-only. Dropped when serializing to 5.5.1. */
  creationDate?: CreationDate;
  /**
   * RFN {0:1} — a permanent record file number uniquely identifying this
   * record within a registered network resource.
   * GEDCOM 5.5.1 §2 (p.57). Removed in GEDCOM 7.0; dropped when
   * serializing to 7.0.
   */
  recordFileNumber?: Text;
  /**
   * AFN {0:1} — the unique permanent record number of this individual in
   * Ancestral File. GEDCOM 5.5.1 §2 (p.42). Removed in GEDCOM 7.0;
   * dropped when serializing to 7.0.
   */
  ancestralFileNumber?: Text;
  /**
   * RIN {0:1} — a record identification number assigned by the source
   * system. GEDCOM 5.5.1 §2 (p.43). Removed in GEDCOM 7.0; dropped when
   * serializing to 7.0.
   */
  automatedRecordId?: Text;
  /**
   * _IMPF {0:1} — the GDO import-file reference (see
   * ImportFileReference): the record's cross-reference in the file it
   * was imported from. Recognized on input and written back as the
   * `_IMPF` block in both versions.
   */
  importReference?: ImportFileReference;
}

/**
 * The Ancestry.com Family Trees media clone block: `_CLON {0:M}` under
 * the OBJE record, one per clone of the media object (the same object
 * linked from another tree or person). The wire format is
 * undocumented; the shape is taken from Ancestry's own exports — e.g.
 * the GEDCOM.NET test tree (HEAD.SOUR "Ancestry.com Family Trees",
 * VERS 2025.08): https://github.com/JasonRawlins/Gedcom (file
 * GedcomNetTestTree.ged) — where each block carries `_TID` (tree id),
 * `_PID` (person id), `_OID` (object id), `_USER` (user token, with
 * the `_ENCR` encrypted flag) and `_DATE` (clone timestamp). Not part
 * of any GEDCOM version; recognized on input and written back as the
 * `_CLON` block in both versions.
 */
export interface AncestryClone extends GedcomStructureBase {
  tag: '_CLON';
  /** _TID {0:1} — the id of the tree the clone belongs to (kept verbatim). */
  treeId?: Text;
  /** _PID {0:1} — the id of the person the clone belongs to (kept verbatim). */
  personId?: Text;
  /** _OID {0:1} — the clone's object id (a UUID). */
  objectId?: Text;
  /** _USER {0:1} — the clone's user token (kept verbatim). */
  user?: Text;
  /** _ENCR {0:1} — 1 when the clone's `_USER` token is encrypted. */
  userEncrypted?: boolean;
  /** _DATE {0:1} — the clone timestamp (kept verbatim; the wire format is undocumented). */
  date?: Text;
}
