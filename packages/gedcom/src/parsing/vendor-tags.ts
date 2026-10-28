/**
 * The non-underscore vendor tags of GEDCOM 5.x.
 *
 * Written by Generations, Reunion, Family Tree Maker 5 (DOS), The Master
 * Genealogist, Family Origins, WinFamily and early Roots versions; mostly
 * tags dropped from GEDCOM 5.3/5.4 or invented outright. Catalogued by
 * Legacy Family Tree in its "User-Defined GEDCOM Tags" help under "Tags
 * Not Specified in GEDCOM 5.5":
 * https://www.legacyfamilytree.se/WEB_US/user_defined_gedcom_tags.htm
 * (canonical copy of
 * https://legacyfamilytree.com/help/en/articles/12810050-gedcom-tags-custom-tags-in-other-programs).
 * Version-history cross-check: Tamura Jones, "GEDCOM Tags":
 * https://www.tamurajones.net/GEDCOMTags.xhtml
 *
 * Policy (the decision formerly recorded as "keep rejecting" in
 * docs/vendor-extensions.md chapter 8):
 *
 * - **Accepted on 5.x input** (files declaring 5.5.1 or 5.5.5). Where
 *   the meaning is documented, the tag is typed: it normalizes into the
 *   model slot that carries the same fact (a name, an event/attribute
 *   with a TYPE, a note, a non-event, an association, an identifier, an
 *   ordinance, the URL), with the exact rule per tag below — the same
 *   standard-first normalization the underscore vendor tags use. A tag
 *   whose position *is* standard always parses as the standard structure
 *   (handlers win — e.g. `NATI` under INDI stays a standard attribute,
 *   `WIFE` under FAM stays a partner link, `DESC` under SUBN stays the
 *   generation count). Where no typed rule applies (a different context,
 *   or a tag whose meaning the catalogs do not document), the tag
 *   becomes a generic `ExtensionStructure`/`ExtensionRecord`, preserved
 *   verbatim. GEDCOM 7.0 input stays strict: these tags are not valid
 *   7.0 (`structure.unknown-tag`), because 7.0 §1.3 defines stdTags only
 *   via the specification and §1.5 requires extension tags to be
 *   underscore-prefixed.
 * - **Standard-first export.** The typed constructs are written in the
 *   standard spelling of the target version (`CIRC` → `EVEN` + `TYPE
 *   Circumcision`, `URL` → `_URL`, `UMAR` → `_NMAR`, `FATH` → `ASSO` +
 *   `RELA Father` / `ASSO` + `ROLE OTHER` + `PHRASE Father`, …); the
 *   vendor tag itself is not written back. The generic remainder is
 *   re-emitted verbatim on 5.5.1 export and dropped on 7.0 export
 *   (7.0 cannot spell a non-underscore extension tag).
 * - Unknown non-underscore tags remain strict errors
 *   (`structure.unknown-tag`) — the list below is closed.
 */

import type { NameTypeEnum } from '../enumerations';

/**
 * The typed normalization of one legacy tag under INDI. `kind` selects
 * the model slot; the meaning of each value is the tag's description in
 * the Legacy catalog (see the module JSDoc).
 */
export type LegacyIndividualRule =
  /** An "also known as" name: names[] with the given NAME-TYPE. */
  | { kind: 'name'; nameType: NameTypeEnum }
  /** A further name variant: names[] with TYPE OTHER and the PHRASE label. */
  | { kind: 'nameOther'; phrase: string }
  /** A standard event spelled by an old tag (BLESS → BLES). */
  | { kind: 'standardEvent'; tag: 'BLES' }
  /** An event fact: EVEN with the TYPE (the payload text is kept). */
  | { kind: 'event'; type: string }
  /** An attribute fact: FACT with the TYPE (the payload text is kept). */
  | { kind: 'fact'; type: string }
  /** A standard attribute spelled by an old tag (RESIR → RESI, NMAR → NMR). */
  | { kind: 'attribute'; tag: 'RESI' | 'NMR' }
  /** An educational attainment: the EDUC attribute with the TYPE. */
  | { kind: 'educ'; type: string }
  /** Free text: an inline NOTE. */
  | { kind: 'note' }
  /** A negation (UMAR, "unmarried"): a bare NO structure. */
  | { kind: 'negative'; event: 'MARR' }
  /** The individual's web address: IndividualRecord.url (export `_URL`). */
  | { kind: 'url' }
  /** An identifier: REFN, optionally with the TYPE. */
  | { kind: 'refn'; type?: string }
  /** A person link: ASSO with the RELA descriptor; a text payload
   *  instead of a pointer becomes FACT + TYPE. */
  | { kind: 'association'; relationship: string }
  /** The FTM5 LDS wrapper: its children parse as LDS ordinances. */
  | { kind: 'lds' };

/**
 * The typed normalization of one legacy tag under FAM.
 */
export interface LegacyFamilyRule {
  kind: 'marriage' | 'even';
  /** The TYPE the fact normalizes into. */
  type: string;
}

/** The INDI-level typed rules, by tag (5.x input only). */
export const LEGACY_INDIVIDUAL_TAGS: Readonly<Record<string, LegacyIndividualRule>> = {
  // Names.
  AKA: { kind: 'name', nameType: 'AKA' }, // FO, FTM, Leg, PAF: also known as.
  NAMR: { kind: 'nameOther', phrase: 'Religious name' }, // FTW5, Gen, Reunion.
  // Standard events.
  BLESS: { kind: 'standardEvent', tag: 'BLES' }, // Reunion: blessing.
  // Events.
  ARVL: { kind: 'event', type: 'Arrival' }, // FTW5.
  BLSL: { kind: 'event', type: 'LDS blessing' }, // FTW5.
  CIRC: { kind: 'event', type: 'Circumcision' }, // Gen (the non-underscore twin of _CIRC).
  DPRT: { kind: 'event', type: 'Departure' }, // FTW5.
  EXCO: { kind: 'event', type: 'Excommunicated' }, // FO, Gen, TMG (twin of _EXCM).
  HOSP: { kind: 'event', type: 'Hospitalization' }, // Gen.
  MILA: { kind: 'event', type: 'Military award' }, // Gen.
  MILD: { kind: 'event', type: 'Military discharge' }, // Gen.
  MILF: { kind: 'event', type: 'Military service' }, // Reunion, Gen: served in the military.
  MILI: { kind: 'event', type: 'Military' }, // Reunion.
  MILT: { kind: 'event', type: 'Military' }, // Gen (twin of _MILT).
  MISN: { kind: 'event', type: 'Mission' }, // Gen (twin of _MISN).
  MOVE: { kind: 'event', type: 'Move' }, // Gen.
  NAMG: { kind: 'event', type: 'Naming' }, // Gen: the naming ceremony.
  PASL: { kind: 'event', type: 'Passenger' }, // TMG.
  PURC: { kind: 'event', type: 'Land purchase' }, // Reunion, Gen.
  REBA: { kind: 'event', type: 'Rebaptism' }, // TMG.
  // Attributes (FACT + TYPE).
  ATTR: { kind: 'fact', type: 'Attribute' }, // FTW5, TMG; a TYPE child overrides.
  BIC: { kind: 'fact', type: 'Born in covenant' }, // TMG.
  CANC: { kind: 'fact', type: 'Sealing canceled' }, // TMG.
  CEME: { kind: 'fact', type: 'Cemetery' }, // FTW5.
  CITN: { kind: 'fact', type: 'Citizenship' }, // Reunion, Gen.
  CODI: { kind: 'fact', type: 'Codicil' }, // TMG.
  COLO: { kind: 'fact', type: 'Skin color' }, // FTW5, Gen, Reunion.
  COYN: { kind: 'fact', type: 'County' }, // FTW5.
  CRIM: { kind: 'fact', type: 'Criminal' }, // TMG.
  CSTA: { kind: 'fact', type: 'Child status' }, // Reunion.
  CUTOFFYR: { kind: 'fact', type: 'Cutoff year' }, // FTW5.
  DETA: { kind: 'fact', type: 'Source detail' }, // Reunion.
  DWEL: { kind: 'fact', type: 'Dwelling' }, // FTW5.
  EDTN: { kind: 'fact', type: 'Edition' }, // Reunion, Gen.
  EDTR: { kind: 'fact', type: 'Editor' }, // Reunion.
  EMAL: { kind: 'fact', type: 'Email' }, // Gen.
  ENMPL: { kind: 'fact', type: 'Employment' }, // TMG (twin of _EMPLOY).
  EYES: { kind: 'fact', type: 'Eye color' }, // Reunion (twin of _EYEC).
  FAX: { kind: 'fact', type: 'Fax' }, // Gen, RM.
  FMT: { kind: 'fact', type: 'Date format' }, // FTW5.
  FOST: { kind: 'fact', type: 'Foster child' }, // FTW5.
  HAIR: { kind: 'fact', type: 'Hair color' }, // Gen, Reunion (twin of _HAIR).
  HEAL: { kind: 'fact', type: 'Medical' }, // Reunion.
  HEIG: { kind: 'fact', type: 'Height' }, // Gen, Reunion (twin of _HEIG).
  HOBB: { kind: 'fact', type: 'Hobbies' }, // Gen, Reunion.
  HONO: { kind: 'fact', type: 'Honors' }, // Gen, Reunion.
  ILLE: { kind: 'fact', type: 'Illegitimate' }, // FTW5.
  ILLN: { kind: 'fact', type: 'Illness' }, // Gen.
  ISA: { kind: 'fact', type: 'Is a kind of' }, // FTW5 (outside the SCHEMA block).
  ISSU: { kind: 'fact', type: 'Issue' }, // Reunion.
  LOCA: { kind: 'fact', type: 'Source locality' }, // Gen.
  LVG: { kind: 'fact', type: 'Living' }, // FTW5.
  LVNG: { kind: 'fact', type: 'Living' }, // Gen.
  MIDSC: { kind: 'fact', type: 'Miscellaneous' }, // TMG.
  MISC: { kind: 'fact', type: 'Miscellaneous' }, // FTW5, Gen.
  NAMS: { kind: 'fact', type: 'Namesake' }, // FO, TMG, Reunion (twin of _NAMS).
  NULL: { kind: 'fact', type: 'Ordinance nullified' }, // TMG.
  ORDI: { kind: 'fact', type: 'Ordinance' }, // unknown program.
  ORDL: { kind: 'fact', type: 'LDS ordination' }, // FTW5.
  ORIG: { kind: 'fact', type: 'Origin' }, // unknown program.
  PERI: { kind: 'fact', type: 'Period' }, // Reunion.
  PPFX: { kind: 'fact', type: 'Place prefix' }, // RM.
  PRES: { kind: 'fact', type: 'Sealing presumed canceled' }, // TMG.
  PUBL: { kind: 'fact', type: 'Publication' }, // Reunion (outside SOUR, where it is standard).
  RACE: { kind: 'fact', type: 'Race' }, // FTW, Gen, Reunion.
  RATI: { kind: 'fact', type: 'Ratification' }, // unknown program.
  REAS: { kind: 'fact', type: 'Reason' }, // FO7 (outside its _CORR context).
  REGI: { kind: 'fact', type: 'Register' }, // Reunion, Gen.
  RESE: { kind: 'fact', type: 'Resealed' }, // TMG.
  RESP: { kind: 'fact', type: 'Response' }, // FO7.
  REST: { kind: 'fact', type: 'Restored' }, // TMG.
  RPLY: { kind: 'fact', type: 'Reply status' }, // FO7.
  SENT: { kind: 'fact', type: 'Event sentence' }, // RM.
  SLGP: { kind: 'fact', type: 'Sealing to parent' }, // FTW5.
  STAL: { kind: 'fact', type: 'Stake' }, // TMG.
  STAKE: { kind: 'fact', type: 'Stake' }, // FTW5.
  STIL: { kind: 'fact', type: 'Stillborn' }, // FTW5, TMG.
  STLB: { kind: 'fact', type: 'Stillborn' }, // Gen.
  TOWN: { kind: 'fact', type: 'Town' }, // FTW5.
  UNIT: { kind: 'fact', type: 'Unit' }, // FTW5.
  VOIL: { kind: 'fact', type: 'Void living' }, // TMG.
  VOL: { kind: 'fact', type: 'Volume' }, // Reunion, Gen.
  WEIG: { kind: 'fact', type: 'Weight' }, // Gen, Reunion (twin of _WEIG).
  // Educational attainment.
  DEGR: { kind: 'educ', type: 'Degree' }, // Reunion (twin of _DEG).
  // Standard attributes.
  RESIR: { kind: 'attribute', tag: 'RESI' }, // Reunion: residence.
  NMAR: { kind: 'attribute', tag: 'NMR' }, // FTW5: number of marriages (unlike the BKW _NMAR, which means never married).
  // Notes.
  COMML: { kind: 'note' }, // FTW5: comment (unlike the BKW _COML, common law marriage).
  DESC: { kind: 'note' }, // Reunion: description.
  DESR: { kind: 'note' }, // TMG: description.
  HIST: { kind: 'note' }, // Reunion: research notes.
  INFO: { kind: 'note' }, // FTW5.
  REMA: { kind: 'note' }, // FTW5: remarks.
  // Negations.
  UMAR: { kind: 'negative', event: 'MARR' }, // Reunion: unmarried.
  // Scalar fields.
  URL: { kind: 'url' }, // Reunion (the non-underscore twin of _URL).
  // Identifiers.
  FILN: { kind: 'refn', type: 'File number' }, // Reunion, Gen.
  HISTID: { kind: 'refn', type: 'History ID' }, // FTW5.
  NUMB: { kind: 'refn' }, // FTW5, RootsIII, TMG: number.
  // Person links.
  CLER: { kind: 'association', relationship: 'Clergy' }, // Reunion, Gen.
  CNTC: { kind: 'association', relationship: 'Contact' }, // Reunion (contact person).
  CPLR: { kind: 'association', relationship: 'Compiler' }, // Reunion, Gen (person, not program).
  DAU: { kind: 'association', relationship: 'Daughter' }, // FTW5.
  FATH: { kind: 'association', relationship: 'Father' }, // FTW5.
  FRND: { kind: 'association', relationship: 'Friend' }, // Gen.
  INTE: { kind: 'association', relationship: 'Interviewer' }, // Reunion (unlike the BKW _INTE, interred).
  INTV: { kind: 'association', relationship: 'Interviewed' }, // Reunion.
  MOTH: { kind: 'association', relationship: 'Mother' }, // FTW5.
  OWNR: { kind: 'association', relationship: 'Owner' }, // Reunion.
  PART: { kind: 'association', relationship: 'Partner' }, // Gen.
  RECO: { kind: 'association', relationship: 'Recorder' }, // Reunion.
  SIBL: { kind: 'association', relationship: 'Sibling' }, // FTW5.
  SON: { kind: 'association', relationship: 'Son' }, // FTW5.
  WIFE: { kind: 'association', relationship: 'Wife' }, // FTW5 (under INDI; under FAM it is the standard partner link).
  // The FTM5 LDS ordinance wrapper.
  LDS: { kind: 'lds' }, // FTW5.
};

/** The FAM-level typed rules, by tag (5.x input only). */
export const LEGACY_FAMILY_TAGS: Readonly<Record<string, LegacyFamilyRule>> = {
  CLAW: { kind: 'marriage', type: 'Common law marriage' }, // Reunion (twin of _COML).
  SEPA: { kind: 'even', type: 'Separated' }, // Reunion, Gen (twin of _SEPR).
  FEMA: { kind: 'even', type: 'Female children' }, // FTW5: the count of female children.
  MALE: { kind: 'even', type: 'Male children' }, // FTW5: the count of male children.
};

/**
 * The legacy tags with no typed rule: their meaning is undocumented
 * (the catalogs mark them "???") or their position is (SCHEMA, LABL,
 * outside their schema context) or their semantics would not survive
 * the normalization (NOTP: a *private* note). They stay generic
 * extensions, preserved verbatim (dropped on 7.0 export).
 */
export const LEGACY_GENERIC_TAGS: ReadonlySet<string> = new Set([
  'COMP', // Reunion: ???.
  'DATV', // Reunion: ???.
  'DETS', // Gen: ???.
  'EARL', // Reunion: ???.
  'HISTB', // Reunion: ???.
  'LABL', // FTW3-5: schema label (typed under HEAD.SCHEMA; generic elsewhere).
  'MSTAT', // Mac Genealogy: death status; Tamura Jones documents the 5.3 MSTAT as marriage status — conflicting meanings.
  'NAMM', // Reunion: "Name ???".
  'NOTP', // WinFamily: private note (the privacy flag has no NOTE slot).
  'PRTY', // FTW7: ???.
  'SCHEMA', // FTW5: schema block (typed under HEAD; generic elsewhere).
]);

/**
 * GEDCOM 5.x non-underscore vendor tags, accepted on 5.x input: the
 * typed rules above where they apply, and as generic extensions
 * everywhere else (the closed list from the Legacy catalog, "Tags Not
 * Specified in GEDCOM 5.5").
 */
export const NON_UNDERSCORE_VENDOR_TAGS: ReadonlySet<string> = new Set([
  ...Object.keys(LEGACY_INDIVIDUAL_TAGS),
  ...Object.keys(LEGACY_FAMILY_TAGS),
  ...LEGACY_GENERIC_TAGS,
  // Tags whose position under INDI or FAM is standard (handlers win
  // there); accepted generically in every other context.
  'IDNO', // Ancestral Quest: reference number (standard 7.0 IDNO attribute).
  'NATI', // Reunion: nationality (standard 5.5.1/7.0 NATI attribute).
  'SUBM', // FamHer: "association to a parent" (standard SUBM pointer elsewhere).
]);
