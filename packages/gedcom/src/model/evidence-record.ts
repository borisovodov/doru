/**
 * GEDCOM 7.0 §1.5 Extensions — the evidence, research and tag records
 * of the glamberson extension family, modelled as extension records.
 *
 * Three published extension specifications share the corpus files (all
 * declare their tags in HEAD.SCHMA with the repository URLs):
 *
 * - the gedcom-evidence extension
 *   (https://github.com/glamberson/gedcom-evidence): the `_EVID`
 *   evidence container (v1 "specification.md" with `_TYPE`/`_ID`, v2
 *   "record/extension/record-EVID.yaml" with `_DTYPE`/`_FIND`/`_ANAL` —
 *   the model is the union), the `_RDOC` research documentation and
 *   the `_RACT` research activity records, and the person/family-side
 *   `_EVREF` reference (v1 spells the link `_EVID`, normalized here to
 *   the current `_EVREF` like `_TASK` normalizes to `_TODO`) with the
 *   `_EVEN_EVID` attached-evidence event;
 * - the gedcom-tags extension
 *   (https://github.com/glamberson/gedcom-tags, tag-extension.md): the
 *   `_TAG` organizational-tag record with its `_COLOR` and
 *   `_ATTR`/`_VALUE` vendor attributes, applied to any record with a
 *   `_TAG @xref@` link;
 * - the gedcom-occurrences `_ATTR`/`_VALUE` pair
 *   (https://github.com/glamberson/gedcom-occurrences,
 *   occurrence-extension.md) — the same attribute shape, see
 *   VendorAttribute.
 *
 * Not part of any GEDCOM version. Recognized on input and written back
 * as the same records, structures and links in both versions
 * (extension records are valid in 5.5.1 and 7.0 alike).
 */
import type { Pointer, Special, Text, Xref } from '../primitives';
import type {
  AgeStructure,
  ChangeDate,
  DateStructure,
  NoteStructure,
} from './common';
import type { GedcomStructureBase } from './extensions';
import type { IndividualRecord } from './records';
import type { PlaceStructure } from './names-places';
import type { SourceCitation } from './sources-media';

/**
 * One `_EVID` record: a piece of evidence as an independent object —
 * the information a source states, kept without identity conclusions
 * ("floating evidence" that several people may reference with
 * different confidence). The grammar is the union of the v1
 * specification (`_TYPE`, `_ID {1:M}`, `SOUR {1:M}`, NOTE, CHAN) and
 * the v2 registry YAML (DATE, SNOTE, UID, `_DTYPE`, `_FIND {0:M}`,
 * `_ANAL {0:M}`); the gramps census example of the gedcom-occurrences
 * repository additionally links related documents with `_RDOC @xref@`
 * (in that file the pointer targets a media record — the payload is
 * kept verbatim, nothing is guessed).
 */
export interface EvidenceRecord extends GedcomStructureBase {
  tag: '_EVID';
  /** The record's cross-reference identifier (@…@); optional when nothing points to it. */
  xref?: Xref;
  /** `_TYPE` {0:1} — the v1 evidence kind (Person, Event, Relationship, Place, Other), kept verbatim. */
  type?: Text;
  /** `_DTYPE` {0:1} — the v2 document type (Census, Death certificate, …), kept verbatim. */
  documentType?: Text;
  /** `_ID` {0:M} — the v1 identifiers: text from the source that identifies the subject ("John Smith", "aged 40", …). */
  identifiers?: Text[];
  /** `_FIND` {0:M} — the v2 findings: specific facts extracted from the evidence. */
  findings?: EvidenceFinding[];
  /** `_ANAL` {0:M} — the v2 analysis notes. */
  analysis?: Text[];
  /** DATE {0:1} — the v2 date of the evidence. */
  date?: DateStructure;
  /** <<SOURCE_CITATION>> {1:M} — the sources the evidence came from. */
  citations?: SourceCitation[];
  /** <<NOTE_STRUCTURE>> {0:M} (NOTE and SNOTE). */
  notes?: NoteStructure[];
  /** UID {0:M} — the v2 unique identifiers. */
  uids?: Special[];
  /** `_RDOC @xref@` {0:M} — related research documents (the census-example link form; the target record kind is the writer's choice). */
  documents?: Pointer<ResearchDocumentRecord>[];
  /** CHAN {0:1}. */
  changeDate?: ChangeDate;
}

/**
 * One `_FIND` under an `_EVID` record or an `_EVEN_EVID` event (the v2
 * registry YAML, structure/extension/_FIND.yaml): a specific fact or
 * piece of information extracted from evidence, preserving the source
 * wording. The v1 `_RACT` activity record uses the same tag with the
 * `_EVID` pointers beneath (the findings the search produced).
 */
export interface EvidenceFinding extends GedcomStructureBase {
  tag: '_FIND';
  /** The _FIND payload, {1:1} Text — the finding as the source states it. */
  payload: Text;
  /** TYPE {1:1} — the kind of finding (Name and Age, Birth Information, …), kept verbatim. */
  type?: Text;
  /** DATE {0:1}. */
  date?: DateStructure;
  /** PLAC {0:1}. */
  place?: PlaceStructure;
  /** <<AGE_AT_EVENT>> {0:1}. */
  age?: AgeStructure;
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** `_EVID @xref@` {0:M} — the v1 activity-record form: the evidence records the finding produced. */
  evidence?: Pointer<EvidenceRecord>[];
}

/**
 * One person/family-side reference to an evidence record: the v1
 * `n _EVID @xref@` link under INDI/FAM (specification.md, "Structure
 * Extensions") and the v2 `_EVREF` (structure/extension/_EVREF.yaml,
 * superstructures INDI {0:M} and FAM {0:M}) — one slot, both input
 * spellings, written back as `_EVREF` in both versions (the current
 * spec spelling, like `_TASK` writes back `_TODO`). The gramps census
 * example also carries the link under NAME.
 */
export interface EvidenceReference extends GedcomStructureBase {
  tag: '_EVREF';
  /** The payload, {1:1} — the pointer to the `_EVID` record. */
  evidence: Pointer<EvidenceRecord>;
  /**
   * `_CONF` {0:1} — the researcher's confidence that the evidence
   * applies to this subject. The v1 scale is the integer 0–5, the v2
   * enumeration is High/Medium/Low/Hypothesis
   * (enumeration-set/extension/enumset-Confidence.yaml); the payload
   * is kept verbatim (the Hutson `_CONF` fields keep their free text
   * the same way).
   */
  confidence?: Text;
  /** `_USED` {0:1} — how the evidence was used (v2, structure/extension/_USED.yaml). */
  used?: Text;
  /** `_RDOC @xref@` {0:M} — the v1 research documents explaining the confidence. */
  documents?: Pointer<ResearchDocumentRecord>[];
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** QUAY {0:1} — the v2 data-quality assessment beside the confidence. */
  quality?: Text;
}

/**
 * One `_EVEN_EVID` under INDI (the v2 "event container" pattern,
 * structure/extension/_EVEN_EVID.yaml): evidence of an event that
 * definitively belongs to this person — the discovery/analysis event
 * with its findings, sources and confidence.
 */
export interface EvidenceEvent extends GedcomStructureBase {
  tag: '_EVEN_EVID';
  /** TYPE {1:1} — the kind of evidence event (Evidence Discovery, …), kept verbatim. */
  type?: Text;
  /** DATE {0:1}. */
  date?: DateStructure;
  /** <<SOURCE_CITATION>> {1:M}. */
  citations?: SourceCitation[];
  /** `_FIND` {0:M} — the findings of this evidence event. */
  findings?: EvidenceFinding[];
  /** `_CONF` {0:1} — the confidence (see EvidenceReference.confidence). */
  confidence?: Text;
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
}

/**
 * One `_RDOC` record (the v1 specification.md): research
 * documentation — analysis, reasoning and proof arguments correlating
 * evidence and stating conclusions.
 */
export interface ResearchDocumentRecord extends GedcomStructureBase {
  tag: '_RDOC';
  /** The record's cross-reference identifier (@…@); optional when nothing points to it. */
  xref?: Xref;
  /** `_TITL` {0:1} — the document title. */
  title?: Text;
  /** `_TEXT` {1:1} — the document text (CONT lines merge into the payload). */
  text?: Text;
  /** `_SUBJ @xref@` {0:M} — the subjects of the document. */
  subjects?: Pointer<IndividualRecord>[];
  /** `_EVID @xref@` {0:M} — the evidence records the document correlates. */
  evidence?: Pointer<EvidenceRecord>[];
  /** `_CONC` {0:M} — the stated conclusions (subject + text). */
  conclusions?: ResearchConclusion[];
  /** AUTH {0:1} — the document author. */
  author?: Text;
  /** DATE {0:1} — the document date. */
  date?: DateStructure;
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** CHAN {0:1}. */
  changeDate?: ChangeDate;
}

/** One `_CONC` conclusion block of a `_RDOC` record: `_SUBJ` {1:1} + `_TEXT` {1:1}. */
export interface ResearchConclusion extends GedcomStructureBase {
  tag: '_CONC';
  /** `_SUBJ @xref@` {1:1} — the subject the conclusion is about. */
  subject?: Pointer<IndividualRecord>;
  /** `_TEXT` {1:1} — the conclusion text. */
  text?: Text;
}

/**
 * One `_RACT` record (the v1 specification.md): a research activity —
 * a search, review, analysis or correspondence, with its target,
 * venue, result and findings; the negative results document the
 * exhaustive search the Genealogical Proof Standard requires.
 */
export interface ResearchActivityRecord extends GedcomStructureBase {
  tag: '_RACT';
  /** The record's cross-reference identifier (@…@); optional when nothing points to it. */
  xref?: Xref;
  /** `_TYPE` {1:1} — the activity kind (Search, Review, Analysis, Correspondence), kept verbatim. */
  type?: Text;
  /** `_PURP` {0:1} — the purpose of the activity. */
  purpose?: Text;
  /** `_TARG` {0:1} — the target of the activity. */
  target?: Text;
  /** `_VENU` {0:1} — the venue (repository, website, …). */
  venue?: Text;
  /** `_RSLT` {0:1} — the result (Found, NotFound, Partial, Pending), kept verbatim. */
  result?: Text;
  /** `_FIND` {0:M} — the findings, each optionally linking its `_EVID` records. */
  findings?: EvidenceFinding[];
  /** DATE {1:1} — the activity date. */
  date?: DateStructure;
  /** `_RSRCH` {0:1} — the researcher. */
  researcher?: Text;
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** CHAN {0:1}. */
  changeDate?: ChangeDate;
}

/**
 * One `_TAG` record (the gedcom-tags extension, tag-extension.md): a
 * reusable organizational marker with a name, an optional `#RRGGBB`
 * color and vendor attributes. Records carry the tag with a
 * `_TAG @xref@` link (see TagLink).
 */
export interface TagRecord extends GedcomStructureBase {
  tag: '_TAG';
  /** The record's cross-reference identifier (@…@); optional when nothing points to it. */
  xref?: Xref;
  /** NAME {1:1} — the human-readable tag name. */
  name?: Text;
  /** `_COLOR` {0:1} — the visual color, a `#RRGGBB` hex value kept verbatim. */
  color?: Text;
  /** `_ATTR` {0:M} — the vendor attributes (name + `_VALUE`). */
  attributes?: VendorAttribute[];
}

/**
 * One `_TAG @xref@` link under a record (the gedcom-tags "Tag
 * Application"): the tag applied to the record, with the optional date
 * of the application and notes. The extension applies tags to ANY
 * record type; the typed slots exist on the records the corpus files
 * carry (INDI, FAM, SOUR, REPO, OBJE, NOTE) — links under other
 * records stay generic extensions.
 */
export interface TagLink extends GedcomStructureBase {
  tag: '_TAG';
  /** The payload, {1:1} — the pointer to the `_TAG` record. */
  target: Pointer<TagRecord>;
  /** DATE {0:1} — when the tag was applied. */
  date?: DateStructure;
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
}

/**
 * One `_ATTR` name/value pair: the gedcom-tags vendor attribute
 * (tag-extension.md: the payload is the attribute name, `_VALUE`
 * {1:1} the value) and the gedcom-occurrences custom attribute
 * (occurrence-extension.md: the same shape under `_OCUR`/`_OCREF`,
 * with NOTE children). Recognized in both positions and written back
 * as the `_ATTR` + `_VALUE` block in both versions.
 */
export interface VendorAttribute extends GedcomStructureBase {
  tag: '_ATTR';
  /** The _ATTR payload, {1:1} — the attribute name. */
  payload: Text;
  /** `_VALUE` {1:1} — the attribute value. */
  value?: Text;
  /** <<NOTE_STRUCTURE>> {0:M} — notes about the attribute (the occurrences spelling). */
  notes?: NoteStructure[];
}

/**
 * One `_OCREF` under INDI/FAM or (the backward-compatibility position
 * of the occurrence-extension spec) under an event: the reference to a
 * shared occurrence with this subject's participation data — ROLE,
 * AGE, notes, citations and custom attributes. Replaces the bare
 * pointer list the earlier model kept.
 */
export interface OccurrenceReference extends GedcomStructureBase {
  tag: '_OCREF';
  /** The payload, {1:1} — the pointer to the `_OCUR` record. */
  occurrence: Pointer<import('./occurrence-record').OccurrenceRecord>;
  /** ROLE {0:1} — the subject's role in the occurrence (Head, Spouse, Witness, …), kept verbatim. */
  role?: Text;
  /** <<AGE_AT_EVENT>> {0:1} — the subject's age at the occurrence. */
  age?: AgeStructure;
  /** <<NOTE_STRUCTURE>> {0:M} — participation notes. */
  notes?: NoteStructure[];
  /** <<SOURCE_CITATION>> {0:M} — sources for this participation. */
  citations?: SourceCitation[];
  /** `_ATTR` {0:M} — custom attributes (occurrence-extension.md). */
  attributes?: VendorAttribute[];
}
