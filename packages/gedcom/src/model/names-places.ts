import type {
  NameTypeEnum,
} from '../enumerations';
import type {
  Language,
  Latitude,
  ListText,
  Longitude,
  PersonalName,
  Text,
} from '../primitives';

import type { ExternalIdentifierStructure } from './common';
import type { GedcomStructureBase } from './extensions';
import type { NoteStructure } from './common';
import type { SourceCitation } from './sources-media';

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
  /** TYPE {1:1} — the phonetic method. */
  type: Text;
  /** <<PERSONAL_NAME_PIECES>> {0:1}. */
  pieces?: PersonalNamePieces;
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
  /** TYPE {1:1} — the romanization method. */
  type: Text;
  /** <<PERSONAL_NAME_PIECES>> {0:1}. */
  pieces?: PersonalNamePieces;
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
  /** LANG {1:1}, g7:LANG. */
  language: Language;
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
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
}

/**
 * GEDCOM 5.5.1 §2 (p.59), `PLACE_PHONETIC_VARIATION` — a phonetic
 * variation of the place name, using the method given by the required
 * TYPE substructure (`PHONETIC_TYPE`). Replaced by PLAC.TRAN in GEDCOM 7.0.
 */
export interface PhoneticPlaceVariation extends GedcomStructureBase {
  /** The FONE payload, {1:1} List:Text. */
  payload: ListText;
  /** TYPE {1:1} — the phonetic method. */
  type: Text;
}

/**
 * GEDCOM 5.5.1 §2 (p.59), `PLACE_ROMANIZED_VARIATION` — a romanized
 * variation of the place name, using the method given by the required
 * TYPE substructure (`ROMANIZED_TYPE`). Replaced by PLAC.TRAN in GEDCOM 7.0.
 */
export interface RomanizedPlaceVariation extends GedcomStructureBase {
  /** The ROMN payload, {1:1} List:Text. */
  payload: ListText;
  /** TYPE {1:1} — the romanization method. */
  type: Text;
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
  /** LANG {1:1}, g7:LANG. */
  language: Language;
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
