import type {
  NameTypeEnum,
} from '../enumerations';
import type {
  Language,
  Latitude,
  ListText,
  Longitude,
  PersonalName,
  Pointer,
  Text,
} from '../primitives';

import type { CensusRecord } from './census-record';
import type { CreationDate, DateStructure, ExternalIdentifierStructure, NoteStructure } from './common';
import type { GedcomStructureBase } from './extensions';
import type { MultimediaLink, SourceCitation } from './sources-media';
import type { PlaceRecord } from './place-record';

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §3.2.3 Substructures — names and places
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §3.2.3 PERSONAL_NAME_STRUCTURE — g7:INDI-NAME: a name of an individual,
 * represented the manner the name is normally spoken, with the surname
 * separated by slashes in the payload. The payload is the primary
 * representation; the pieces are optional auxiliary information.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.38), `PERSONAL_NAME_STRUCTURE` — the
 * same payload, TYPE and PIECES; 5.5.1 expresses name variants through the
 * phonetic (FONE) and romanized (ROMN) substructures (modelled as
 * `phonetic` / `romanized`), while 7.0 uses `translations` (TRAN + LANG).
 * NOTE and SOURCE_CITATION are 7.0-only here.
 */
export interface PersonalNameStructure extends GedcomStructureBase {
  tag: 'NAME';
  /** The NAME payload, {1:1} PersonalName. */
  payload: PersonalName;
  /** TYPE {0:1}, g7:NAME-TYPE — Enum of g7:enumset-NAME-TYPE. */
  type?: NameTypeStructure;
  /** <<PERSONAL_NAME_PIECES>> {0:1}. */
  pieces?: PersonalNamePieces;
  /**
   * `_PRIM Y` {0:1} — marks the primary name of the person. Written
   * by Legacy Family Tree under NAME (the same preferred-mark family
   * as its `_PREF`; see FamilyPartnerLink.preferred). Not part of any
   * GEDCOM version. Recognized on input and written back as
   * `_PRIM Y` in both versions.
   */
  primary?: boolean;
  /**
   * `_MIDN {0:1}` — the middle name, written under NAME as its own
   * line (the ged4web exports, e.g. the corpus file
   * GEDs_Gresham-187.ged: `2 _MIDN Newton`). Kept verbatim. Not part
   * of any GEDCOM version. Recognized on input and written back as
   * `_MIDN` in both versions.
   */
  middleName?: Text;
  /**
   * `_PATN {0:1}` — the patronymic (the father-derived name), written
   * under NAME as its own line (the Russian/Ukrainian trees, e.g. the
   * corpus file Емаши1811.ged). Kept verbatim. Not part of any GEDCOM
   * version. Recognized on input and written back as `_PATN` in both
   * versions.
   */
  patronymic?: Text;
  /**
   * CREA/`_CRE` {0:1} — the name entry's creation date (the MFT7
   * exports write `2 CREA` or `2 _CRE` with the DATE child under
   * NAME). Recognized on input with the creation-date grammar and
   * written back as CREA in 7.0 and `_CRE` in 5.5.1.
   */
  creationDate?: CreationDate;
  /**
   * `_RUFNAME` {0:1} — the call name (Rufname): the given name that
   * official German documents mark as the one in use (GEDCOM-L
   * agreement "NAME Ruf.B2"). The USM6 spelling `UGNM` (Der Stammbaum
   * ≤ V6, "Tabelle 2" of the GenWiki "GEDCOM/_Nutzerdef-Tag" article:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag) normalizes into
   * this slot in any file. Not part of any GEDCOM version.
   * Recognized on input and written back as `_RUFNAME` in both
   * versions.
   */
  callName?: Text;
  /**
   * `_USED` {0:1} — the given name used: which of the person's given
   * names they actually use (a "Tony" out of "Anthony Edward"). The
   * Family Historian convention under the NAME tag, documented in the
   * Family Historian User Group knowledge base, "GEDCOM Extension
   * List": <https://www.fhug.org.uk/kb/kb-article/gedcom-extension-list/>.
   * Not part of any GEDCOM version (under the header the same tag is
   * FH's used-record-ids list, which stays generic). Recognized on
   * input and written back as `_USED` in both versions.
   */
  givenNameUsed?: Text;
  /**
   * NAME_ {0:1} — the variants of the family name (surname variants).
   * Written by Der Stammbaum ≤ V6 (USM6) under the NAME tag (see the
   * GenWiki "GEDCOM/_Nutzerdef-Tag" article's "Tabelle 2",
   * "Varianten des Familiennamens"). Not part of any GEDCOM version.
   * Recognized in any file and written back as `_NAME_` in 5.5.1
   * (the underscore spelling — the USM6 wire spelling `NAME_` is
   * non-underscore, and 5.5.1 requires user-defined tags to begin
   * with an underscore; both spellings are recognized on input);
   * dropped on 7.0 output.
   */
  surnameVariants?: Text;
  /**
   * _HEB {0:1} — the name in Hebrew script. Written by phpGedView
   * under the NAME tag (the webtrees per-vendor custom-tag registry,
   * PhpGedView.php: `INDI:NAME:_HEB`:
   * https://github.com/fisharebest/webtrees/blob/main/app/CustomTags/PhpGedView.php);
   * not part of any GEDCOM version. Recognized on input and written
   * back as `_HEB` under the NAME line in both versions.
   */
  hebrewName?: Text;
  /**
   * _DATE {0:1} — a date associated with the name: the name's period of
   * use or the date it was recorded. Written by The Master Genealogist
   * (TMG-to-GEDCOM, see its "GEDCOM Tag Names" help:
   * https://tmgtogedcom.com/en/tag-names.htm); not part of any GEDCOM
   * version. Recognized on input and written back as `_DATE` under the
   * NAME line in both versions.
   */
  date?: DateStructure;
  /**
   * _ALIA {0:M} — an alias of the name, as pure text. Written by
   * PRO-GEN under the NAME tag (see the GenWiki
   * "GEDCOM/_Nutzerdef-Tag" catalog:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag); not part of any
   * GEDCOM version. Recognized on input and written back as `_ALIA`
   * under the NAME line in both versions.
   */
  aliases?: Text[];
  /**
   * ALIA {0:M} — an alias of the name written with the standard tag
   * spelling, with optional citations. The Master Genealogist
   * (TMG-to-GEDCOM) writes its name aliases under NAME with the
   * standard ALIA tag (`2 ALIA William/Pitt/`), attaching `3 SOUR`
   * citations; the Hawaiian Kings trees in the corpus use the shape
   * throughout. No GEDCOM version has the ALIA tag under NAME.
   * Recognized on input and written back as ALIA lines (with their
   * SOUR children) in both versions.
   */
  aliasLinks?: AliasTextLink[];
  /**
   * `_MARNM` {0:1} — the married name: the surname used (or once
   * used) after marriage, kept as a name-level value for programs
   * that cannot store several full NAME lines. Written under NAME by
   * Brother's Keeper 6+, Ancestral Quest 3, PAF 5, Stammbaumdrucker,
   * Family Tree Builder, webtrees and Ahnenblatt (the GenWiki
   * "GEDCOM/_Nutzerdef-Tag" catalog, "verwendet für verheiratete
   * Namen":
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag); Brother's
   * Keeper spells the same fact `_MARN`. Not part of any GEDCOM
   * version. Recognized on input (both spellings) and written back
   * as `_MARNM` in both versions.
   */
  marriedName?: Text;
  /**
   * TITL {0:1} — a title or honorific carried by the name itself
   * (`2 TITL Queen` under `1 NAME /Liliuokalani/`, the Hawaiian Kings
   * trees in the corpus). No GEDCOM version has the TITL tag under
   * NAME. Recognized on input and written back as `TITL` under the
   * NAME line in both versions.
   */
  title?: Text;
  /**
   * `_AKA` {0:M} — an "also known as" name variant of the person
   * (often the alternate surname), kept as free text: a further name
   * for programs that cannot store several NAME lines. Written under
   * NAME by Stammbaumdrucker, GenPlus, Family Tree Builder, PAF,
   * Ancestral Quest and webtrees (the GenWiki "GEDCOM/_Nutzerdef-Tag"
   * catalog: "als Ersatz für Programme, die keine Mehrfachnamen
   * verarbeiten" — https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag;
   * the webtrees per-vendor custom-tag registry documents the same
   * under `INDI:NAME:_AKA`, PersonalAncestralFile.php:
   * https://github.com/fisharebest/webtrees/blob/main/app/CustomTags/PersonalAncestralFile.php).
   * The BKW6/PAF5 spelling `_AKAN` carries the same fact. Not part of
   * any GEDCOM version. Recognized on input (both spellings) and
   * written back as `_AKA` in both versions.
   */
  alsoKnownAs?: Text[];
  /**
   * SECG {0:1} — the second and further given names: with several
   * given names, all of them from the second onward, kept apart from
   * the first (the vendor's "SECond Given name"). Written by Mac
   * Family Tree 7 as a subtag of NAME (see the GenWiki
   * "GEDCOM/_Nutzerdef-Tag" article's "Tabelle 2": "bei mehreren
   * Vornamen alle ab dem 2. als UnterTag von NAME"). Not part of any
   * GEDCOM version. Recognized in any file and written back as `_SECG`
   * in 5.5.1 (the underscore spelling — the MFT7 wire spelling `SECG`
   * is non-underscore; both spellings are recognized on input);
   * dropped on 7.0 output.
   */
  furtherGivenNames?: Text;
  /**
   * `_CENR @xref@` {0:M} — a pointer to the shared MagiKey census
   * record (MagiKey_CENR.yaml in the FamilySearch GEDCOM registry:
   * https://github.com/FamilySearch/GEDCOM-registries/blob/main/structure/extension/MagiKey_CENR.yaml),
   * linking the name as recorded in the census to the census it came
   * from (the registry's `INDI-NAME` superstructure). The pointer must
   * resolve to an existing `_CENR` record (`document.xref-not-found`
   * otherwise). Written back as `_CENR` in both versions.
   */
  censusLinks?: Pointer<CensusRecord>[];
  /**
   * _APID {0:M} — Ancestry.com record references, format `dbid::record`
   * (in the wild often prefixed, e.g. `1,7602::2771226`), written by
   * Ancestry tree downloads under names — not only under source
   * citations (the GenWiki "GEDCOM/_Nutzerdef-Tag" catalog lists
   * `INDI.NAME` as a superstructure:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag). Not part of any
   * GEDCOM version (documented by TMG to GEDCOM:
   * https://tmgtogedcom.com/en/apid.htm). Recognized on input and
   * written back as `_APID` in both versions.
   */
  ancestryPointers?: Text[];
  /**
   * OBJE {0:M} — exhibits (media) attached to the name. Written by
   * The Master Genealogist; its "GEDCOM Tag Names" help documents the
   * non-standard exhibit tag under NAME ("the GEDCOM spec has no OBJE
   * slot under NAME, so T2G writes the standard tag there, or `_OBJE`
   * for validators":
   * https://tmgtogedcom.com/en/tag-names.htm). Not part of any GEDCOM
   * version (neither standard has an OBJE slot under NAME). Recognized
   * on input (as `OBJE` in both versions and `_OBJE` as the vendor
   * spelling) and written back as the standard multimedia-link `OBJE`
   * pointer under the NAME in both versions.
   */
  media?: MultimediaLink[];
  /** TRAN {0:M}, g7:NAME-TRAN — translations or transliterations. Each must have a LANG substructure. When serializing to 5.5.1 each translation becomes FONE or ROMN with the method mapped from the language (kana/hangul → FONE, pinyin/romaji/wadegiles → ROMN); unknown languages are dropped. */
  translations?: NameTranslation[];
  /** FONE {0:M} — phonetic variations by writing-sound method. GEDCOM 5.5.1 §2 (p.38); replaced by TRAN in 7.0. When serializing to 7.0 each variation becomes a TRAN with the language mapped from the method; unknown methods are dropped. */
  phonetic?: PhoneticNameVariation[];
  /** ROMN {0:M} — romanized variations by romanization method. GEDCOM 5.5.1 §2 (p.38); replaced by TRAN in 7.0. When serializing to 7.0 each variation becomes a TRAN with the language mapped from the method; unknown methods are dropped. */
  romanized?: RomanizedNameVariation[];
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** <<SOURCE_CITATION>> {0:M}. */
  citations?: SourceCitation[];
}

/**
 * GEDCOM 5.5.1 §2 (p.55), `NAME_PHONETIC_VARIATION` — a phonetic variation
 * of the name, written in the same form as the payload but phonetically,
 * using the method given by the required TYPE substructure (`PHONETIC_TYPE`:
 * kana, hangul, or user-defined). Replaced by NAME.TRAN in GEDCOM 7.0.
 */
export interface PhoneticNameVariation extends GedcomStructureBase {
  /** The FONE payload, {1:1} PersonalName. */
  payload: PersonalName;
  /** TYPE {0:1} — the phonetic method. Missing TYPE is tolerated (the full-leniency container rule). */
  type?: Text;
  /** <<PERSONAL_NAME_PIECES>> {0:1}. */
  pieces?: PersonalNamePieces;
  /** <<NOTE_STRUCTURE>> {0:M}, GEDCOM 5.5.1 §2 (p.55) NAME_PHONETIC_VARIATION. */
  notes?: NoteStructure[];
  /** <<SOURCE_CITATION>> {0:M}, GEDCOM 5.5.1 §2 (p.55) NAME_PHONETIC_VARIATION. */
  citations?: SourceCitation[];
}

/**
 * A name-level alias written with the standard ALIA spelling, with
 * optional citations (see PersonalNameStructure.aliasLinks). TMG
 * writes its name aliases this way; no GEDCOM version has ALIA under
 * NAME.
 */
export interface AliasTextLink extends GedcomStructureBase {
  tag: 'ALIA';
  /** The ALIA payload, {1:1} Text. */
  value: Text;
  /** <<SOURCE_CITATION>> {0:M} — the citations backing the alias. */
  citations?: SourceCitation[];
}

/**
 * GEDCOM 5.5.1 §2 (p.56), `NAME_ROMANIZED_VARIATION` — a romanized
 * variation of the name, written in the same form as the payload, using
 * the method given by the required TYPE substructure
 * (`ROMANIZED_TYPE`: pinyin, romaji, wadegiles, or user-defined).
 * Replaced by NAME.TRAN in GEDCOM 7.0.
 */
export interface RomanizedNameVariation extends GedcomStructureBase {
  /** The ROMN payload, {1:1} PersonalName. */
  payload: PersonalName;
  /** TYPE {0:1} — the romanization method. Missing TYPE is tolerated (the full-leniency container rule). */
  type?: Text;
  /** <<PERSONAL_NAME_PIECES>> {0:1}. */
  pieces?: PersonalNamePieces;
  /** <<NOTE_STRUCTURE>> {0:M}, GEDCOM 5.5.1 §2 (p.56) NAME_ROMANIZED_VARIATION. */
  notes?: NoteStructure[];
  /** <<SOURCE_CITATION>> {0:M}, GEDCOM 5.5.1 §2 (p.56) NAME_ROMANIZED_VARIATION. */
  citations?: SourceCitation[];
}

/**
 * GEDCOM 7.0 §3.2.3 PERSONAL_NAME_STRUCTURE — g7:NAME-TYPE: an enumerated value
 * indicating the type of the name.
 *
 * GEDCOM 5.5.1 §2 (p.56), `NAME_TYPE` — identical context; see
 * `NameTypeEnum` for the 5.5.1 value differences.
 */
export interface NameTypeStructure extends GedcomStructureBase {
  /** The TYPE payload, {1:1} Enum of g7:enumset-NAME-TYPE. */
  payload: NameTypeEnum;
  /** PHRASE {0:1}, g7:PHRASE. */
  phrase?: Text;
}

/**
 * GEDCOM 7.0 §3.2.3 PERSONAL_NAME_PIECES — optional isolated name parts. Multiple
 * parts with the same tag express at least a user preference for
 * splitting; the specification does not define how they combine.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.37), `PERSONAL_NAME_PIECES` — the same
 * pieces; 5.5.1 allows at most one of each tag (comma-separated values)
 * and permits NOTE and SOURCE_CITATION substructures beneath the pieces
 * (removed in 7.0).
 */
export interface PersonalNamePieces extends GedcomStructureBase {
  /** NPFX {0:M}, g7:NPFX — text before the given and surname parts. */
  namePrefixes?: Text[];
  /** GIVN {0:M}, g7:GIVN — given or earned names. */
  givenNames?: Text[];
  /** NICK {0:M}, g7:NICK — descriptive or familiar names. */
  nicknames?: Text[];
  /** SPFX {0:M}, g7:SPFX — non-indexing pre-parts of a surname. */
  surnamePrefixes?: Text[];
  /** SURN {0:M}, g7:SURN — family names. */
  surnames?: Text[];
  /** NSFX {0:M}, g7:NSFX — text after the given and surname parts. */
  nameSuffixes?: Text[];
  /** <<NOTE_STRUCTURE>> {0:M} — 5.5.1-only. */
  notes?: NoteStructure[];
  /** <<SOURCE_CITATION>> {0:M} — 5.5.1-only. */
  citations?: SourceCitation[];
}

/**
 * GEDCOM 7.0 §3.2.3 PERSONAL_NAME_STRUCTURE — g7:NAME-TRAN: a translation or
 * transliteration of the name into a different language or script.
 *
 * 7.0-only: 5.5.1 expresses name variants through the FONE (phonetic) and
 * ROMN (romanized) substructures, modelled on PERSONAL_NAME_STRUCTURE as
 * `phonetic` / `romanized`, instead of TRAN.
 */
export interface NameTranslation extends GedcomStructureBase {
  /** The TRAN payload, {1:1} PersonalName. */
  payload: PersonalName;
  /** LANG {0:1}, g7:LANG. Missing LANG is tolerated (the full-leniency container rule). */
  language?: Language;
  /** <<PERSONAL_NAME_PIECES>> {0:1}. */
  pieces?: PersonalNamePieces;
}

/**
 * GEDCOM 7.0 §3.2.3 PLACE_STRUCTURE — g7:PLAC: a place, represented as a list of
 * jurisdictional entities ordered from the lowest to the highest
 * jurisdiction.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.38), `PLACE_STRUCTURE` — the same
 * payload, FORM and MAP; 5.5.1 expresses place variants through the
 * phonetic (FONE) and romanized (ROMN) substructures (modelled as
 * `phonetic` / `romanized`), while 7.0 uses `translations` (TRAN + LANG).
 * LANG and EXID are 7.0-only.
 */
/**
 * GEDCOM-L `_POST` — a postal code with the period it was in force
 * (postal systems change: old and new codes are stored side by side,
 * each dated). Used under a PLAC substructure and in the GEDCOM-L
 * `_LOC` place record (see PlaceRecord).
 */
export interface PostalCodeStructure extends GedcomStructureBase {
  /** The `_POST` payload, {1:1} Text. */
  code: Text;
  /** `DATE` {0:1} — the period the code was in force. */
  date?: DateStructure;
  /** <<SOURCE_CITATION>> {0:M}. */
  citations?: SourceCitation[];
}

export interface PlaceStructure extends GedcomStructureBase {
  tag: 'PLAC';
  /** The PLAC payload, {1:1} List:Text — jurisdiction names, smallest to largest; unknown jurisdictions are empty strings. */
  payload: ListText;
  /** FORM {0:1}, g7:PLAC-FORM — the jurisdiction types, with the same number of elements and order as the payload. */
  form?: ListText;
  /** LANG {0:1}, g7:LANG — the language of the payload. Dropped when serializing to 5.5.1. */
  language?: Language;
  /** TRAN {0:M}, g7:PLAC-TRAN — translations or transliterations. Each must have a LANG substructure. When serializing to 5.5.1 each translation becomes FONE or ROMN with the method mapped from the language; unknown languages are dropped. */
  translations?: PlaceTranslation[];
  /** FONE {0:M} — phonetic variations by writing-sound method. GEDCOM 5.5.1 §2 (p.38); replaced by TRAN in 7.0. When serializing to 7.0 each variation becomes a TRAN with the language mapped from the method; unknown methods are dropped. */
  phonetic?: PhoneticPlaceVariation[];
  /** ROMN {0:M} — romanized variations by romanization method. GEDCOM 5.5.1 §2 (p.38); replaced by TRAN in 7.0. When serializing to 7.0 each variation becomes a TRAN with the language mapped from the method; unknown methods are dropped. */
  romanized?: RomanizedPlaceVariation[];
  /** MAP {0:1}, g7:MAP — a representative point for the location. */
  map?: MapCoordinates;
  /** EXID {0:M}, g7:EXID — external identifiers for the place. Dropped when serializing to 5.5.1. */
  externalIds?: ExternalIdentifierStructure[];
  /**
   * `_PID` {0:1} — the place's id in the exporting system (`3 _PID
   * curie-joliot-place-q102317`, the Wikidata-style id of the Swarm
   * public-release family-tree packs). Kept verbatim. Not part of any
   * GEDCOM version. Recognized on input and written back as `_PID`
   * under the PLAC line in both versions.
   */
  placeId?: Text;
  /**
   * `_XREF {0:1}` — a pointer to the place's card record (the GenoPro
   * spelling of the place link, `3 _XREF @place00014@` under PLAC —
   * the same fact the GEDCOM-L `_LOC` link carries; see
   * PlaceStructure.location). Kept verbatim, unresolved: the target
   * card is a generic record that the export drops. Recognized on
   * input and written back as `_XREF` in both versions.
   */
  placeCard?: Text;
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /**
   * SOUR {0:M} — the citations attached to the PLAC line. Written by
   * The Master Genealogist (TMG-to-GEDCOM: the Hawaiian Kings trees
   * in the corpus put `3 SOUR` under the event `2 PLAC`, e.g.
   * `1 DEAT` / `2 PLAC Waikiki, O'ahu` / `3 SOUR @S307@`); no GEDCOM
   * version has a citation slot inside PLACE_STRUCTURE. Recognized on
   * input and written back as SOUR lines under the PLAC line in both
   * versions.
   */
  citations?: SourceCitation[];
  /**
   * _VERI Y {0:1} — the "verified" checkmark on the place. Written by
   * Legacy Family Tree (see its "Custom GEDCOM Tags" help: https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm);
   * not part of any GEDCOM version. Recognized on input and written
   * back as `_VERI` in both versions.
   */
  verified?: boolean;
  /**
   * `_GOV` {0:1} — the place's identifier in the GOV gazetteer
   * (GEDCOM-L, e.g. `WEIHEN_W6051`), written directly under the PLAC.
   * Recognized on input and written back as `_GOV` in both versions.
   */
  govId?: Text;
  /**
   * `_AON` {0:M} — alternative place names (GenPlus, "Alternativer
   * Ortsname"): other names the place is known by, written directly
   * under the PLAC (see the GenWiki "GEDCOM/_Nutzerdef-Tag" catalog:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag). Not part of any
   * GEDCOM version. Recognized on input and written back as `_AON` in
   * both versions.
   */
  alternativeNames?: Text[];
  /**
   * `_POST` {0:M} — postal codes with their validity periods (GEDCOM-L,
   * written directly under the PLAC). Recognized on input and written
   * back as `_POST` in both versions.
   */
  postalCodes?: PostalCodeStructure[];
  /**
   * `_MAIDENHEAD` {0:1} — the place's Maidenhead QTH locator (GEDCOM-L,
   * written directly under the PLAC). Recognized on input and written
   * back as `_MAIDENHEAD` in both versions.
   */
  maidenhead?: Text;
  /**
   * _HEB {0:1} — the place name in Hebrew script. Written by phpGedView
   * under the PLAC tag (the webtrees per-vendor custom-tag registry,
   * PhpGedView.php: `INDI:*:PLAC:_HEB`:
   * https://github.com/fisharebest/webtrees/blob/main/app/CustomTags/PhpGedView.php);
   * not part of any GEDCOM version. Recognized on input and written
   * back as `_HEB` under the PLAC line in both versions.
   */
  hebrewName?: Text;
  /**
   * The vendor master-place link: a `_LOC @xref@` child pointing at a
   * PlaceRecord (GEDCOM 5.5EL form), filled on input in both versions —
   * from the explicit pointer, or by name matching against a place
   * record whose payload equals this place's text. On output the link
   * is consumed: the record's map and notes are merged into each
   * referencing place and the records are dropped — except that a
   * GEDCOM-L record carrying the German fields (see PlaceRecord)
   * survives into the output as a `_LOC` record (both versions), and
   * then this pointer is written back as `_LOC`. See the
   * "Common GEDCOM Extensions" catalog:
   * https://jfcardinal.github.io/GEDCOM-5.5.2/extensions.html
   */
  location?: Pointer<PlaceRecord>;
}

/**
 * GEDCOM 5.5.1 §2 (p.59), `PLACE_PHONETIC_VARIATION` — a phonetic
 * variation of the place name, using the method given by the required
 * TYPE substructure (`PHONETIC_TYPE`). Replaced by PLAC.TRAN in GEDCOM 7.0.
 */
export interface PhoneticPlaceVariation extends GedcomStructureBase {
  /** The FONE payload, {1:1} List:Text. */
  payload: ListText;
  /** TYPE {0:1} — the phonetic method. Missing TYPE is tolerated (the full-leniency container rule). */
  type?: Text;
}

/**
 * GEDCOM 5.5.1 §2 (p.59), `PLACE_ROMANIZED_VARIATION` — a romanized
 * variation of the place name, using the method given by the required
 * TYPE substructure (`ROMANIZED_TYPE`). Replaced by PLAC.TRAN in GEDCOM 7.0.
 */
export interface RomanizedPlaceVariation extends GedcomStructureBase {
  /** The ROMN payload, {1:1} List:Text. */
  payload: ListText;
  /** TYPE {0:1} — the romanization method. Missing TYPE is tolerated (the full-leniency container rule). */
  type?: Text;
}

/**
 * GEDCOM 7.0 §3.2.3 PLACE_STRUCTURE — g7:PLAC-TRAN: a translation or transliteration
 * of the place into a different language or script. Should use the same
 * FORM as the payload.
 *
 * 7.0-only: 5.5.1 expresses place variants through the FONE (phonetic)
 * and ROMN (romanized) substructures, modelled on PLACE_STRUCTURE as
 * `phonetic` / `romanized`, instead of TRAN.
 */
export interface PlaceTranslation extends GedcomStructureBase {
  /** The TRAN payload, {1:1} List:Text. */
  payload: ListText;
  /** LANG {0:1}, g7:LANG. Missing LANG is tolerated (the full-leniency container rule). */
  language?: Language;
}

/**
 * GEDCOM 7.0 §3.2.3 PLACE_STRUCTURE — g7:MAP: a representative point for a location,
 * as defined by LATI and LONG substructures. Provides neither accuracy
 * nor region size.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.38), `MAP` — identical (LATI {1:1} +
 * LONG {1:1}).
 */
export interface MapCoordinates extends GedcomStructureBase {
  /** LATI {1:1}, g7:LATI — a latitudinal coordinate. */
  latitude: Latitude;
  /** LONG {1:1}, g7:LONG — a longitudinal coordinate. */
  longitude: Longitude;
}
