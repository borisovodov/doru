import type {
  EventAttributeEnum,
  MediaEnum,
  QualityEnum,
} from '../enumerations';
import type {
  Integer,
  Pointer,
  Special,
  Text,
} from '../primitives';

import type { GedcomStructureBase } from './extensions';
import type { MultimediaRecord } from './records';
import type { NoteStructure } from './common';
import type { RepositoryRecord } from './records';
import type { SourceRecord } from './records';
import type { SourceText } from './records';
import type { DateStructure } from './common';
import type { RoleStructure } from './common';

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §3.2.3 Substructures — sources and media
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §3.2.3 SOURCE_CITATION — g7:SOUR: a citation indicating that the
 * pointed-to source record supports the claims made in the superstructure.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.39), `SOURCE_CITATION` — the same
 * structure; 5.5.1 additionally permits a non-pointer form whose payload
 * is a free-text source description (modelled as `description`) instead of
 * an xref, and its SOUR.EVEN has no PHRASE.
 */
export interface SourceCitation extends GedcomStructureBase {
  tag: 'SOUR';
  /** The SOUR payload, {1:1} pointer to a SOUR record; a voidPtr may be used with the citation text in PAGE. */
  source: Pointer<SourceRecord>;
  /**
   * SOUR {1:1} — a free-text source description used by systems without
   * SOURCE_RECORDs. GEDCOM 5.5.1 §2 (p.61), `SOURCE_DESCRIPTION`;
   * removed in 7.0 (use a void pointer with PAGE instead). When
   * serializing to 7.0 the description becomes the PAGE.
   */
  description?: Text;
  /** PAGE {0:1}, g7:PAGE — a specific location within the information referenced. */
  page?: Text;
  /** DATA {0:1}, g7:SOUR-DATA — the relevant data from the source. */
  data?: SourceCitationData;
  /** EVEN {0:1}, g7:SOUR-EVEN — Enum of g7:enumset-EVENATTR: what event the relevant material was recording. */
  event?: SourceCitationEvent;
  /** QUAY {0:1}, g7:QUAY — Enum of g7:enumset-QUAY: an estimation of the reliability of the source for these claims. */
  quality?: QualityEnum;
  /** <<MULTIMEDIA_LINK>> {0:M} — digital copies of the cited part of the source. */
  media?: MultimediaLink[];
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /**
   * _APID {0:M} — Ancestry.com record references, format `dbid::record`
   * (in the wild often prefixed, e.g. `1,7602::2771226`), written by
   * Ancestry tree downloads and read by Family Tree Maker. Not part of
   * any GEDCOM version (documented by TMG to GEDCOM:
   * https://tmgtogedcom.com/en/apid.htm). Dropped when serializing to
   * 7.0 (Ancestry's GEDCOM 7 exports use the registered PUBL.DATE/PLAC
   * extensions instead).
   */
  ancestryPointers?: Text[];
}

/**
 * GEDCOM 7.0 §3.2.3 SOURCE_CITATION — g7:SOUR-DATA: the relevant data from the
 * source.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.39), `SOURCE_CITATION` — identical
 * (DATE `ENTRY_RECORDING_DATE` {0:1}, TEXT {0:M}).
 */
export interface SourceCitationData extends GedcomStructureBase {
  /** <<DATE_VALUE>> {0:1} — when the data was entered into the source. */
  date?: DateStructure;
  /** TEXT {0:M}, g7:TEXT — the relevant text from the source. */
  texts?: SourceText[];
}

/**
 * GEDCOM 7.0 §3.2.3 SOURCE_CITATION — g7:SOUR-EVEN: the type of event or attribute
 * responsible for the source entry being recorded.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.39), `SOURCE_CITATION` — identical EVEN
 * `EVENT_TYPE_CITED_FROM` (p.49) and ROLE `ROLE_IN_EVENT` (p.61);
 * PHRASE is 7.0-only.
 */
export interface SourceCitationEvent extends GedcomStructureBase {
  /** The EVEN payload, {1:1} Enum of g7:enumset-EVENATTR. */
  payload: EventAttributeEnum;
  /** PHRASE {0:1}, g7:PHRASE. */
  phrase?: Text;
  /** ROLE {0:1}, g7:ROLE — Enum of g7:enumset-ROLE: what role the subject played in the event. */
  role?: RoleStructure;
}

/**
 * GEDCOM 7.0 §3.2.3 SOURCE_REPOSITORY_CITATION — g7:REPO: a pointer to the name and
 * address record of the holder of the source document.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.40), `SOURCE_REPOSITORY_CITATION` — the
 * same structure; in 5.5.1 the REPO payload may be empty (`[ptr|<NULL>]`).
 * An empty 5.5.1 REPO is normalized on import to the void pointer
 * `@VOID@`, which 7.0 provides exactly for this case.
 */
export interface SourceRepositoryCitation extends GedcomStructureBase {
  tag: 'REPO';
  /** The REPO payload, {1:1} pointer to a REPO record. */
  repository: Pointer<RepositoryRecord>;
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** CALN {0:M}, g7:CALN — the call number of the source at that repository. */
  callNumbers?: CallNumberStructure[];
}

/**
 * GEDCOM 7.0 §3.2.3 SOURCE_REPOSITORY_CITATION — g7:CALN: an identification or
 * reference description used to file and retrieve items from the holdings
 * of a repository. Despite the word "number", may contain any character.
 *
 * GEDCOM 5.5.1 §2 (p.61), `SOURCE_CALL_NUMBER` — identical CALN {0:M} +
 * MEDI {0:1}; PHRASE is 7.0-only.
 */
export interface CallNumberStructure extends GedcomStructureBase {
  /** The CALN payload, {1:1} Special. */
  payload: Special;
  /** MEDI {0:1}, g7:MEDI — Enum of g7:enumset-MEDI: the medium found at that call number. */
  medium?: MediaStructure;
}

/**
 * GEDCOM 7.0 §3.2.3 SOURCE_REPOSITORY_CITATION / MULTIMEDIA_RECORD — g7:MEDI: an
 * enumerated value providing information about the medium in which
 * information is stored.
 *
 * GEDCOM 5.5.1 §2 (p.62), `SOURCE_MEDIA_TYPE` — identical value set
 * (lowercase); PHRASE is 7.0-only.
 */
export interface MediaStructure extends GedcomStructureBase {
  /** The MEDI payload, {1:1} Enum of g7:enumset-MEDI. */
  payload: MediaEnum;
  /** PHRASE {0:1}, g7:PHRASE. */
  phrase?: Text;
}

/**
 * GEDCOM 7.0 §3.2.3 MULTIMEDIA_LINK — g7:OBJE: links the superstructure to the
 * MULTIMEDIA_RECORD with the given pointer.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.37), `MULTIMEDIA_LINK` — 5.5.1
 * additionally permits an inline form (OBJE without a pointer, carrying
 * FILE/FORM/MEDI/TITL directly). This model keeps the 7.0 pointer-only
 * shape: an inline 5.5.1 OBJE is normalized on import by synthesizing a
 * MULTIMEDIA_RECORD from its files and replacing the inline form with a
 * pointer to it. (Both versions always keep the media bytes in external
 * files; 5.5.1 removed its embedded-BLOB form.)
 */
export interface MultimediaLink extends GedcomStructureBase {
  tag: 'OBJE';
  /** The OBJE payload, {1:1} pointer to an OBJE record. */
  object: Pointer<MultimediaRecord>;
  /** CROP {0:1}, g7:CROP — a subregion of an image to display. Dropped when serializing to 5.5.1. */
  crop?: CropStructure;
  /** TITL {0:1}, g7:TITL — supersedes any OBJE.FILE.TITL in the multimedia record. Dropped when serializing to 5.5.1. */
  title?: Text;
  /**
   * _PRIM Y {0:1} — marks the preferred/primary multimedia item.
   * Written by Legacy Family Tree, Family Tree Maker, RootsMagic,
   * rootstrust and others; not part of any GEDCOM version (see the
   * "Common GEDCOM Extensions" catalog:
   * https://jfcardinal.github.io/GEDCOM-5.5.2/extensions.html). Dropped
   * when serializing to 7.0 (7.0 has no primary marker; presentation
   * order is used instead).
   */
  primary?: boolean;
}

/**
 * GEDCOM 7.0 §3.2.3 MULTIMEDIA_LINK — g7:CROP: a subregion of an image to display.
 * LEFT and TOP indicate the top-left corner; WIDTH and HEIGHT the extent.
 * Omitted LEFT and TOP default to 0; omitted WIDTH and HEIGHT default to
 * the image size minus the corner.
 *
 * 7.0-only: 5.5.1 has no CROP.
 */
export interface CropStructure extends GedcomStructureBase {
  /** TOP {0:1}, g7:TOP — pixels to not display from the top. */
  top?: Integer;
  /** LEFT {0:1}, g7:LEFT — pixels to not display from the left. */
  left?: Integer;
  /** HEIGHT {0:1}, g7:HEIGHT — how many pixels to display vertically. */
  height?: Integer;
  /** WIDTH {0:1}, g7:WIDTH — how many pixels to display horizontally. */
  width?: Integer;
}
