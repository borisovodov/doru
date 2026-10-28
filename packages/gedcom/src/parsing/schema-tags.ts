/**
 * GEDCOM 7.0 §1.5 documented-extension resolution.
 *
 * A HEAD.SCHMA `TAG` entry declares an extension tag together with the
 * URI it abbreviates (GEDCOM 7.0 §2.14). When that URI is a `g7:` URI
 * of a standard structure type, the extension tag is a documented alias
 * of the standard structure: "If a documented extension tag has the URI
 * of a standard structure type, it has the same meaning as that
 * structure type but can be used where that structure type cannot"
 * (the GEDCOM 7.0.4 clarification). Such a tag parses as the standard
 * structure — the same standard-first normalization the vendor
 * extensions use — and is written back in the standard spelling.
 *
 * A tag declared with a non-`g7:` URI (`http://example.com/…`) has no
 * standard meaning, and a documented tag used where the standard
 * structure has no slot keeps its extension meaning: both stay generic
 * `ExtensionStructure`/`ExtensionRecord`, preserved verbatim.
 */

/** The g7: term URI prefix of the standard vocabulary. */
const G7_URI_PREFIX = 'https://gedcom.io/terms/v7/';

/** Standard tags whose g7: URI segment differs from the tag spelling. */
const SEGMENT_ALIASES: ReadonlyMap<string, string> = new Map([
  // The shared-note record's structure-type URI is g7:record-SNORE.
  ['SNORE', 'SNOTE'],
]);

/** The standard 7.0 tags a documented extension tag may abbreviate
 *  (the wire spellings of the standard structures). */
const STANDARD_TAGS_70: ReadonlySet<string> = new Set([
  'ABBR', 'ADDR', 'ADR1', 'ADR2', 'ADR3', 'ADOP', 'AGE', 'AGNC', 'ALIA',
  'ANCI', 'ANUL', 'ASSO', 'AUTH',
  'BAPL', 'BAPM', 'BARM', 'BASM', 'BIRT', 'BLES', 'BURI',
  'CALN', 'CAST', 'CAUS', 'CENS', 'CHAN', 'CHIL', 'CHR', 'CHRA', 'CITY',
  'CONF', 'COPR', 'CORP', 'CREA', 'CREM', 'CROP', 'CTRY',
  'DATA', 'DATE', 'DEAT', 'DEST', 'DESI', 'DIV', 'DIVF', 'DSCR',
  'EDUC', 'EMAIL', 'EMIG', 'ENGA', 'ENDL', 'EVEN', 'EXID',
  'FACT', 'FAM', 'FAMC', 'FAMS', 'FAX', 'FCOM', 'FILE', 'FORM',
  'GEDC', 'GIVN', 'GRAD',
  'HEIGHT', 'HUSB',
  'IDNO', 'IMMI', 'INDI', 'INIL',
  'LANG', 'LATI', 'LEFT', 'LONG',
  'MAP', 'MARB', 'MARC', 'MARL', 'MARR', 'MARS', 'MEDI', 'MIME',
  'NAME', 'NATI', 'NATU', 'NCHI', 'NICK', 'NMR', 'NO', 'NOTE', 'NPFX',
  'NSFX',
  'OBJE', 'OCCU', 'ORDN',
  'PEDI', 'PHRASE', 'PHON', 'PLAC', 'POST', 'PROB', 'PROP', 'PUBL',
  'REFN', 'RELI', 'REPO', 'RESI', 'RESN', 'RETI', 'ROLE',
  'SCHMA', 'SDATE', 'SEX', 'SLGC', 'SLGS', 'SNOTE', 'SOUR', 'SPFX',
  'SSN', 'STAE', 'STAT', 'SUBM', 'SURN',
  'TEMP', 'TEXT', 'TIME', 'TITL', 'TOP', 'TRAN', 'TYPE',
  'UID',
  'VERS',
  'WIDTH', 'WIFE', 'WILL', 'WWW',
]);

/** The record-level standard tags (GEDCOM 7.0 §3.2.2). */
export const RECORD_TAGS_70: ReadonlySet<string> = new Set([
  'INDI', 'FAM', 'OBJE', 'SNOTE', 'SOUR', 'REPO', 'SUBM',
]);

/** URI segments that name payload types, not structure types. */
const NON_STRUCTURE_SEGMENTS: ReadonlySet<string> = new Set([
  'enum', 'enumset', 'cal', 'month', 'type',
]);

/**
 * The standard tag a g7: term URI names, or undefined when the URI
 * names no standard structure type (a non-g7: URI, a payload type, or
 * an unknown tag). The last URI segment carries the tag spelling —
 * `g7:INDI-BIRT` → `BIRT`, `g7:record-SUBM` → `SUBM` — with the
 * explicit exceptions of `SEGMENT_ALIASES` (`g7:record-SNORE` →
 * `SNOTE`).
 */
export function resolveStandardTagByUri(uri: string | undefined): string | undefined {
  if (uri === undefined || !uri.startsWith(G7_URI_PREFIX)) {
    return undefined;
  }
  const segments = uri.slice(G7_URI_PREFIX.length).split('-');
  const segment = segments[segments.length - 1] as string;
  if (segments.length > 1 && NON_STRUCTURE_SEGMENTS.has(segments[segments.length - 2] as string)) {
    return undefined;
  }
  const alias = SEGMENT_ALIASES.get(segment);
  if (alias !== undefined) {
    return alias;
  }
  return STANDARD_TAGS_70.has(segment) ? segment : undefined;
}
