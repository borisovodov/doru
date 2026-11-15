import type { RestrictionEnum } from '../enumerations';
import type { Xref, FilePath, Integer, ListEnum, MediaType, Pointer, Text } from '../primitives';
import type { ChangeDate } from './common';
import type { CreationDate } from './common';
import type { TagLink } from './evidence-record';
import type { DateStructure } from './common';
import type { GedcomStructureBase } from './extensions';
import type { IdentifierStructure } from './common';
import type { ImportFileReference } from './common';
import type { MediaStructure } from './sources-media';
import type { NoteStructure } from './common';
import type { SourceCitation } from './sources-media';
import type { AncestryClone } from './individual-record';
import type { SubmitterRecord } from './submitter-record';

/**
 * GEDCOM 7.0 §3.2.2 MULTIMEDIA_RECORD — g7:record-OBJE: a multimedia record
 * referring to one or more external digital files.
 *
 * GEDCOM 5.5.1 §2 Record Structures (p.26), `MULTIMEDIA_RECORD` — the same
 * record; 5.5.1 has no RESN or IDENTIFIER_STRUCTURE and classifies the
 * medium via FILE.FORM.TYPE instead of FILE.FORM.MEDI.
 */
export interface MultimediaRecord extends GedcomStructureBase {
  tag: 'OBJE';
  /** The record's cross-reference identifier (@…@); optional when nothing points to it. GEDCOM 7.0 §1.3; GEDCOM 5.5.1 §2 Primitive Elements (p.64), `XREF` (max 22 characters). */
  xref?: Xref;
  /** RESN {0:1}, g7:RESN — List:Enum of g7:enumset-RESN. */
  restriction?: ListEnum<RestrictionEnum>;
  /** FILE {1:M}, g7:FILE — the external files, grouped together. */
  files: MediaFile[];
  /**
   * FORM {0:1} — the record-level multimedia format of the GEDCOM
   * 5.5 embedded-multimedia shape (`MULTIMEDIA_RECORD` := FORM {1:1}
   * + BLOB {1:1} with the encoded CONT lines). GEDCOM 5.5.1
   * eliminated BLOB and added FILE with the FORM beneath it (the
   * FamilySearch changelog, version 5.5.1: "Removed the option for
   * encoding embedded multimedia objects… The BLOB tag was
   * eliminated", https://gedcom.io/changelog/#version-551), so
   * neither target version can spell the shape. It is recognized on
   * input in any file — 5.5-era files, the nonconforming exports
   * that keep writing it under 5.5.1 declarations (the corpus GT4
   * demo file, the gramps MediaTest.ged import fixture) and the
   * Généatique record-level FORM beside FILE lines (the webtrees
   * per-vendor custom-tag registry, Geneatique.php, `OBJE:FORM` =
   * MultimediaFormat:
   * https://github.com/fisharebest/webtrees/blob/main/app/CustomTags/Geneatique.php)
   * — and kept in the model; both exports drop it, and a record left
   * without any FILE is dropped entirely by the projections
   * (serialize/prepare.ts). The FILE-level format is MediaFile.form.
   */
  embeddedForm?: Text;
  /**
   * BLOB {0:1} — the embedded multimedia content of the GEDCOM 5.5
   * record shape (see `embeddedForm`): the BLOB block's CONT lines
   * joined with newlines, kept as decoded text. The 5.5 encoding is
   * a text-safe form of the binary object. GEDCOM 5.5.1 eliminated
   * BLOB (the FamilySearch changelog,
   * https://gedcom.io/changelog/#version-551): the slot is recognized
   * on input in any file and kept in the model, and both exports drop
   * it — with the whole record when it has no FILE.
   */
  embeddedBlob?: Text;
  /**
   * _DATE {0:1} — a date associated with the media object, usually the
   * date of a picture or video. Written by Legacy Family Tree under
   * OBJE (see its "Custom GEDCOM Tags" help:
   * https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm);
   * not part of any GEDCOM version. Recognized on input and written
   * back as `_DATE` in both versions.
   */
  date?: DateStructure;
  /**
   * PLAC {0:1} — the place associated with the media object, usually
   * where a picture was taken. Written by Ancestry.com Family Trees
   * under the OBJE record with the standard PLAC tag (the webtrees
   * per-vendor custom-tag registry, Ancestry.php:
   * https://github.com/fisharebest/webtrees/blob/main/app/CustomTags/Ancestry.php);
   * not part of any GEDCOM version. Recognized on input (like the
   * standard DATE above) and written back as `_PLAC` in both versions.
   */
  place?: Text;
  /**
   * _PRIM Y {0:1} — marks the preferred media object, the record-level
   * twin of MultimediaLink.primary (same sources). Recognized on input
   * and written back as `_PRIM` in both versions.
   */
  primary?: boolean;
  /**
   * _SCBK Y {0:1} — marks the media object for inclusion in a
   * scrapbook, the record-level twin of MultimediaLink.scrapbook (same
   * sources). Recognized on input and written back as `_SCBK` in both
   * versions.
   */
  scrapbook?: boolean;
  /**
   * _SSHOW Y {0:1} — marks the media object for inclusion in a slide
   * show, the record-level twin of MultimediaLink.slideshow (same
   * sources). Recognized on input and written back as `_SSHOW` in both
   * versions.
   */
  slideshow?: boolean;
  /**
   * _TYPE {0:1} — the kind of the media object (Photo, Sound, Video,
   * …). Written by Ancestral Quest, Family Origins, PAF and Legacy
   * under OBJE (see the Legacy "User-Defined GEDCOM Tags" help:
   * https://www.legacyfamilytree.se/WEB_US/user_defined_gedcom_tags.htm);
   * not part of any GEDCOM version. Recognized on input and written
   * back as `_TYPE` in both versions.
   */
  objectType?: Text;
  /**
   * _SOUND {0:1} — a sound file attached to the picture or video.
   * Written by Legacy Family Tree under OBJE (see its "Custom GEDCOM
   * Tags" help: https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm); not part of any GEDCOM version. Recognized
   * on input and written back as `_SOUND` in both versions.
   */
  soundFile?: Text;
  /**
   * _CREA {0:1} — the date the media object was created (a free text
   * value; the wire format is undocumented, so it is kept verbatim).
   * Written by Ancestry.com Family Trees under the OBJE record (the
   * webtrees per-vendor custom-tag registry, Ancestry.php, "Creation":
   * https://github.com/fisharebest/webtrees/blob/main/app/CustomTags/Ancestry.php);
   * not part of any GEDCOM version. Recognized on input and written
   * back as `_CREA` in both versions.
   */
  createdAt?: Text;
  /**
   * _KEYS {0:1} — keywords of the media object. Written by Family
   * Historian under the OBJE record (the Family Historian User Group
   * knowledge base, "GEDCOM Extension List", "Multimedia: _NOTE,
   * _FILE, _DATE, _KEYS":
   * https://www.fhug.org.uk/kb/kb-article/gedcom-extension-list/); not
   * part of any GEDCOM version. Recognized on input and written back
   * as `_KEYS` in both versions.
   */
  keywords?: Text;
  /**
   * _FILE {0:1} — the path of the media file. Written by Family
   * Historian under the OBJE record (same source as `keywords`; the
   * FHUG list documents the tag and its "path" meaning). Not part of
   * any GEDCOM version. Recognized on input and written back as
   * `_FILE` in both versions.
   */
  filePath?: Text;
  /**
   * _NOTE {0:1} — a media note. Written by Family Historian under the
   * OBJE record (same source as `keywords`). Not part of any GEDCOM
   * version. Recognized on input and written back as `_NOTE` in both
   * versions.
   */
  mediaNote?: Text;
  /**
   * _OID {0:1} — the media object's identifier, a UUID. Written by
   * Ancestry.com Family Trees under the OBJE record (the wire format
   * is undocumented; the shape is taken from Ancestry's own exports,
   * e.g. the GEDCOM.NET test tree — see AncestryClone). Not part of
   * any GEDCOM version. Recognized on input and written back as `_OID`
   * in both versions.
   */
  objectId?: Text;
  /**
   * _USER {0:1} — the token of the Ancestry user who created the media
   * object (kept verbatim; a base64-looking opaque string). Written by
   * Ancestry.com Family Trees under the OBJE record (same source as
   * `objectId`), with the `_ENCR 1` substructure marking the token
   * encrypted. Not part of any GEDCOM version. Recognized on input and
   * written back as the `_USER`/`_ENCR` pair in both versions.
   */
  user?: Text;
  /**
   * _ENCR {0:1} — 1 when the `_USER` token of this record is
   * encrypted; the substructure of `_USER` (same source as `user`).
   * Only emitted together with `user`.
   */
  userEncrypted?: boolean;
  /**
   * _ORIG {0:1} — the origin of the media object: `acom`
   * (ancestry.com), `u` (user upload), `newspapers`, `fold3`, … (kept
   * verbatim). Written by Ancestry.com Family Trees under the OBJE
   * record (same source as `objectId`). Not part of any GEDCOM
   * version. Recognized on input and written back as `_ORIG` in both
   * versions.
   */
  origin?: Text;
  /**
   * _ATL {0:1} — the attachment flag (Y/N). Written by Ancestry.com
   * Family Trees under the OBJE record (same source as `objectId`).
   * Not part of any GEDCOM version. Recognized on input (Y/N) and
   * written back as `_ATL Y` in both versions when set.
   */
  attachment?: boolean;
  /**
   * _META {0:1} — the media metadata XML block
   * (`<metadataxml>…</metadataxml>`, kept verbatim; CONC continuations
   * are merged into the value). Written by Ancestry.com Family Trees
   * under the OBJE record (same source as `objectId`). Not part of any
   * GEDCOM version. Recognized on input and written back as `_META` in
   * both versions.
   */
  metadata?: Text;
  /**
   * _DSCR {0:1} — the description of the media object (free text;
   * Ancestry writes "(Ancestry media: Description)" as the placeholder
   * of an empty description). Written by Ancestry.com Family Trees
   * under the OBJE record (same source as `objectId`). Not part of any
   * GEDCOM version. Recognized on input and written back as `_DSCR`
   * in both versions.
   */
  description?: Text;
  /**
   * _MSER {0:1} — the record is the master (original) media object;
   * its clones (the `_CLON` blocks of other records) link back to it.
   * Written by Ancestry.com Family Trees under the OBJE record as the
   * bare tag with the `_LKID` link id beneath (same source as
   * `objectId`). Not part of any GEDCOM version. Recognized on input
   * (the bare tag marks the flag) and written back as `_MSER` with
   * its `_LKID` in both versions.
   */
  master?: boolean;
  /**
   * _LKID {0:1} — the link id tying the clones to this master record
   * (a UUID, the same value as the master's `_OID`); the substructure
   * of `_MSER` (same source as `master`). Only emitted together with
   * `master`.
   */
  masterLinkId?: Text;
  /**
   * `_CUTOUT Y` {0:1} — the photo is displayed cut out (its
   * background removed). Written by MyHeritage under the media link
   * (observed in the corpus file bs.ged); not part of any GEDCOM
   * version. Recognized on input and written back as `_CUTOUT Y` in
   * both versions.
   */
  cutout?: boolean;
  /**
   * `_PRIM_CUTOUT Y` {0:1} — the primary cutout mark of the photo
   * (same source as `cutout`). Recognized on input and written back
   * as `_PRIM_CUTOUT Y` in both versions.
   */
  primaryCutout?: boolean;
  /**
   * `_PARENTPHOTO Y` {0:1} — the media object is the parent's photo
   * (same source as `cutout`). Recognized on input and written back
   * as `_PARENTPHOTO Y` in both versions.
   */
  parentPhoto?: boolean;
  /**
   * `_PERSONALPHOTO Y` {0:1} — the media object is the person's own
   * photo (same source as `cutout`). Recognized on input and written
   * back as `_PERSONALPHOTO Y` in both versions.
   */
  personalPhoto?: boolean;
  /**
   * `_PARENTRIN {0:1}` — the parent's record id (`MH:P500006`, the
   * MyHeritage person id; same source as `cutout`). Kept verbatim.
   * Recognized on input and written back as `_PARENTRIN` in both
   * versions.
   */
  parentRecordId?: Text;
  /**
   * AUTH {0:1} — the author of the media object, written with the
   * standard AUTH tag under the OBJE record (the ged4web exports,
   * e.g. the corpus file GEDs_Gresham-187.ged). Neither standard has
   * the slot. Recognized on input and written back as `AUTH` in both
   * versions.
   */
  author?: Text;
  /**
   * _CLON {0:M} — the clones of this media object (the same object
   * linked from another tree or person); see AncestryClone.
   */
  clones?: AncestryClone[];
  /**
   * TITL {0:1} — the media object's title at the record level (the
   * ged4web exports; the FILE-level TITL is MediaFile.title). Neither
   * standard has the record-level slot. Recognized on input and
   * written back as `TITL` in both versions.
   */
  title?: Text;
  /** <<IDENTIFIER_STRUCTURE>> {0:M}. */
  identifiers?: IdentifierStructure[];
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** <<SOURCE_CITATION>> {0:M}. */
  citations?: SourceCitation[];
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
   * _SUBM {0:M} — a pointer to the submitter record of this media
   * object. Written by GDO under every record (see
   * SourceRecord.submitters); not part of any GEDCOM version.
   * Recognized on input and written back as `_SUBM` in both versions.
   */
  submitters?: Pointer<SubmitterRecord>[];
  /**
   * _IMPF {0:1} — the GDO import-file reference (see
   * ImportFileReference): the record's cross-reference in the file it
   * was imported from. Recognized on input and written back as the
   * `_IMPF` block in both versions.
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
 * GEDCOM 7.0 §3.2.2 MULTIMEDIA_RECORD — g7:FILE: a reference to an external file.
 *
 * GEDCOM 5.5.1 §2 Record Structures (p.26), `MULTIMEDIA_RECORD` — the same
 * FILE {1:M} + FORM {1:1} + TITL {0:1}; in 5.5.1 the medium is classified
 * by FILE.FORM.TYPE (`SOURCE_MEDIA_TYPE`) instead of FILE.FORM.MEDI, and
 * TRAN is 7.0-only.
 */
/**
 * A `FILE` directly under a SOUR record (see SourceRecord.files): the
 * path of a media file attached to the source without a separate OBJE
 * record. Neither standard has the slot; the form is the bare path.
 */
export interface SourceFileStructure extends GedcomStructureBase {
  tag: 'FILE';
  /** The FILE payload, {1:1} FilePath — the media file path. */
  payload: FilePath;
}

export interface MediaFile extends GedcomStructureBase {
  /** The FILE payload, {1:1} FilePath — the media file path. A bare FILE line (no payload) is tolerated as the empty path: Ancestry.com Family Trees writes it with FORM/TITL substructures and no file name; it is written back as the bare FILE line. */
  payload: FilePath;
  /** FORM {0:1}, g7:FORM — the media type of the file. Missing FORM is tolerated (the full-leniency container rule). */
  form?: MediaFormatStructure;
  /** TITL {0:1}, g7:TITL — a title of the file. */
  title?: Text;
  /**
   * `_TEXT`/TEXT {0:1} — the file's transcription text (the FTM
   * embedded-media shape writes it under the FILE line). Neither
   * standard has the slot. Recognized on input and written back as
   * `_TEXT` under the FILE line in both versions.
   */
  text?: Text;
  /**
   * `_DATE`/DATE {0:1} — the file's date (FTM writes the file
   * modification timestamp under the FILE line: `2 _DATE 5/20/2017
   * 1:51:01 PM`, kept verbatim). Neither standard has the slot.
   * Recognized on input and written back as `_DATE` under the FILE
   * line in both versions.
   */
  date?: Text;
  /**
   * _CTYP {0:1} — the content type of the picture (person, group,
   * place, signature, tombstone, document, heirloom). Written by
   * Ahnenblatt under OBJE.FILE (see the GenWiki
   * "GEDCOM/_Nutzerdef-Tag" table:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag); not part of any
   * GEDCOM version. Recognized on input and written back as `_CTYP`
   * under the FILE line in both versions.
   */
  contentType?: Text;
  /**
   * _ALTPATH {0:1} — an alternative or relative file path, without
   * the file name ("alternativer bzw. relativer Dateipfad ohne
   * Dateinamen"). Written by Ahnenblatt under OBJE.FILE (same source
   * as `contentType`); not part of any GEDCOM version. Recognized on
   * input and written back as `_ALTPATH` under the FILE line in both
   * versions.
   */
  alternatePath?: Text;
  /**
   * `_FILESIZE {0:1}` — the size of the media file in bytes. Written
   * by Family Tree Builder under the OBJE record and by MyHeritage
   * under the inline OBJE (`2 _FILESIZE 406254`; the webtrees
   * per-vendor custom-tag registry, FamilyTreeBuilder.php, "File
   * size"). Not part of any GEDCOM version. Recognized on input and
   * written back as `_FILESIZE` in both versions.
   */
  fileSize?: Integer;
  /**
   * `_ALBUM {0:1}` — the XREF of the album the media file belongs to
   * (a `@A…@` identifier; real exports carry dangling references, so
   * the value is kept verbatim, unresolved). Written by Family Tree
   * Builder and MyHeritage under the OBJE (the webtrees per-vendor
   * custom-tag registry, FamilyTreeBuilder.php, "Album — XREF to an
   * album"). Not part of any GEDCOM version. Recognized on input and
   * written back as `_ALBUM` in both versions.
   */
  album?: Text;
  /**
   * `_PHOTO_RIN {0:1}` — the record id of the photo in the exporting
   * system (MyHeritage exports: `2 _PHOTO_RIN MH:P500064`; the
   * webtrees per-vendor custom-tag registry, FamilyTreeBuilder.php,
   * "Record ID number"). Not part of any GEDCOM version. Recognized
   * on input and written back as `_PHOTO_RIN` in both versions.
   */
  recordId?: Text;
  /** TRAN {0:M}, g7:FILE-TRAN — the same content in a different digital format. */
  translations?: MediaFileTranslation[];
}

/**
 * GEDCOM 7.0 §3.2.2 MULTIMEDIA_RECORD — g7:FORM: the media type of the file
 * referenced by the superstructure, with an optional medium.
 */
export interface MediaFormatStructure extends GedcomStructureBase {
  /**
   * The FORM payload, {1:1} MediaType. 7.0 files carry an RFC 2045
   * media type; a 5.x file carries one of the fixed
   * `MULTIMEDIA_FORMATS_551` extensions, or one of the 17 GEDCOM
   * 5.5.5 formats (5.5.5 §2 p.94–95). On 5.5.1 output only the seven
   * 5.5.1 formats can be named (plus the RFC 2045 types that map onto
   * them): a 5.5.5-only format (`PNG`, `PDF`, …) has no 5.5.1
   * spelling, so the whole FILE is dropped on 5.5.1 export (see
   * emitMediaFile). 7.0 output writes the payload verbatim.
   */
  payload: MediaType;
  /** MEDI {0:1}, g7:MEDI — Enum of g7:enumset-MEDI; the medium from which the file was derived. */
  medium?: MediaStructure;
  /**
   * _MTYPE {0:1} — the display kind of the media: `portrait`,
   * `document`, `headstone`, `story`, `place`, `newspaperarticle`,
   * `marriagecertificate`, `obituary`, … (free text, kept verbatim).
   * Written by Ancestry.com Family Trees under OBJE.FILE.FORM (the
   * wire format is undocumented; the shape is taken from Ancestry's
   * own exports — the GEDCOM.NET test tree:
   * https://github.com/JasonRawlins/Gedcom, GedcomNetTestTree.ged).
   * Not part of any GEDCOM version. Recognized on input and written
   * back as `_MTYPE` under the FORM line in both versions.
   */
  kind?: Text;
  /**
   * _STYPE {0:1} — the stored encoding of the file: `jpeg`, `png`,
   * `pjpeg`, `x-inline` (the inline story text), `pdf`, `msword`, …
   * (free text, kept verbatim). Written by Ancestry.com Family Trees
   * under OBJE.FILE.FORM (same source as `kind`). Not part of any
   * GEDCOM version. Recognized on input and written back as `_STYPE`
   * under the FORM line in both versions.
   */
  storageType?: Text;
  /**
   * _SIZE {0:1} — the size of the media file in bytes. Written by
   * Ancestry.com Family Trees under OBJE.FILE.FORM (same source as
   * `kind`). Not part of any GEDCOM version. Recognized on input and
   * written back as `_SIZE` under the FORM line in both versions.
   */
  size?: Integer;
  /**
   * _WDTH {0:1} — the width of the picture in pixels. Written by
   * Ancestry.com Family Trees under OBJE.FILE.FORM (same source as
   * `kind`). Not part of any GEDCOM version. Recognized on input and
   * written back as `_WDTH` under the FORM line in both versions.
   */
  width?: Integer;
  /**
   * _HGHT {0:1} — the height of the picture in pixels. Written by
   * Ancestry.com Family Trees under OBJE.FILE.FORM (same source as
   * `kind`). Not part of any GEDCOM version. Recognized on input and
   * written back as `_HGHT` under the FORM line in both versions.
   */
  height?: Integer;
}

/**
 * GEDCOM 7.0 §3.2.2 MULTIMEDIA_RECORD — g7:FILE-TRAN: a representation of the file in
 * a different digital format (not a different human language).
 */
export interface MediaFileTranslation extends GedcomStructureBase {
  /** The TRAN payload, {1:1} FilePath. */
  payload: FilePath;
  /** FORM {1:1}, g7:FORM — the media type of the translated file. */
  form: MediaFormatStructure;
}
