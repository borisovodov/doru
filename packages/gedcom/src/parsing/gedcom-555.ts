/**
 * The GEDCOM 5.5.5 draft's full-word tag spellings.
 *
 * The abandoned GEDCOM 5.5.5 draft (FamilySearch, 1999 — the
 * "next-generation" 5.x proposal) renamed every standard tag to its
 * full-word spelling: `INDIVIDUAL` for INDI, `BIRTH` for BIRT,
 * `OCCUPATION` for OCCU, `GIVEN_NAME` for GIVN, and so on. (This is
 * the 1999 draft, not the 2019 gedcom.org 5.5.5 release, which kept
 * the 5.5.1 tag spellings.) Files in the wild ship the draft
 * vocabulary — the published 5.5.5 sample (`555SAMPLE-FTM.GED` in the
 * corpus: `0 HEADER`, `1 SOURCE FTW`, `1 DESTINATION FTW`,
 * `1 CHARACTER IBMPC`, `1 SUBMITTER`, `0 INDIVIDUAL`, `1 MARRIAGE`,
 * `1 ADDRESS`, `0 REPOSITORY`, `0 TRAILER`) and the FamilySearch
 * gedcom5-conversion test resources
 * (<https://github.com/FamilySearch/gedcom5-conversion>; Case006 and
 * its siblings write both spellings side by side: `1 OCCU` next to
 * `1 OCCUPATION`, `1 NATI` next to `1 NATIONALITY`, `1 IDNO` next to
 * `1 IDENT_NUMBER`).
 *
 * Each spelling maps to the standard tag it renames; both pipelines
 * parse the same import grammar, so a file may mix the draft and the
 * standard spellings freely (the draft files do). The draft-only
 * additions without a standard equivalent (MOVE, CASTE, DWELL, RACE,
 * ENLIST) stay generic — renaming them would invent meaning.
 *
 * The alias fires only where the full word itself has no handler:
 * the GenoPro dialect's own `INDIVIDUAL`/`FAMILY` children under
 * PEDIGREELINK keep their GenoPro meaning (see parsing/genopro.ts).
 */

/** The 5.5.5 draft full-word spelling → the standard tag it renames. */
export const GEDCOM_555_TAG_ALIASES: Readonly<Record<string, string>> = {
  // Records.
  HEADER: 'HEAD',
  TRAILER: 'TRLR',
  SUBMITTER: 'SUBM',
  INDIVIDUAL: 'INDI',
  FAMILY: 'FAM',
  SOURCE: 'SOUR',
  REPOSITORY: 'REPO',
  MULTIMEDIA: 'OBJE',
  // Header.
  CHARACTER: 'CHAR',
  DESTINATION: 'DEST',
  VERSION: 'VERS',
  GEDCOM: 'GEDC',
  COPYRIGHT: 'COPR',
  LANGUAGE: 'LANG',
  CORPORATION: 'CORP',
  CALL_NUMBER: 'CALN',
  // Individual events.
  BIRTH: 'BIRT',
  DEATH: 'DEAT',
  BURIAL: 'BURI',
  CHRISTENING: 'CHR',
  ADOPTION: 'ADOP',
  CENSUS: 'CENS',
  RETIREMENT: 'RETI',
  EMIGRATION: 'EMIG',
  IMMIGRATION: 'IMMI',
  NATURALIZATION: 'NATU',
  PROBATE: 'PROB',
  GRADUATION: 'GRAD',
  ORDINATION: 'ORDN',
  BAPTISM: 'BAPM',
  BAPT: 'BAPM',
  BAR_MITZVAH: 'BARM',
  BAS_MITZVAH: 'BASM',
  BAT_MITZVAH: 'BATM',
  BLESSING: 'BLES',
  CONFIRMATION: 'CONF',
  FIRST_COMMUNION: 'FCOM',
  ADULT_CHRISTNG: 'CHRA',
  CREMATION: 'CREM',
  // Family events and links.
  MARRIAGE: 'MARR',
  DIVORCE: 'DIV',
  HUSBAND: 'HUSB',
  CHILD: 'CHIL',
  FAMILY_CHILD: 'FAMC',
  FAMILY_SPOUSE: 'FAMS',
  // Attributes.
  OCCUPATION: 'OCCU',
  NATIONALITY: 'NATI',
  PROPERTY: 'PROP',
  RESIDENCE: 'RESI',
  TITLE: 'TITL',
  EDUCATION: 'EDUC',
  RELIGION: 'RELI',
  PHY_DESCRIPTION: 'DSCR',
  IDENT_NUMBER: 'REFN',
  IDNO: 'REFN',
  CHILDREN_COUNT: 'NCHI',
  MARRIAGE_COUNT: 'NMR',
  SOC_SEC_NUMBER: 'SSN',
  PHONE: 'PHON',
  // Name pieces.
  GIVEN_NAME: 'GIVN',
  SURNAME: 'SURN',
  NAME_PREFIX: 'NPFX',
  NAME_SUFFIX: 'NSFX',
  SURNAME_PREFIX: 'SPFX',
  NICKNAME: 'NICK',
  // Shared substructures.
  PLACE: 'PLAC',
  ADDRESS: 'ADDR',
  STATE: 'STAE',
  POSTAL_CODE: 'POST',
  COUNTRY: 'CTRY',
  QUALITY: 'QUAY',
  RELATIONSHIP: 'RELA',
  CAUSE: 'CAUS',
  AGENCY: 'AGNC',
  CONTINUED: 'CONT',
};
