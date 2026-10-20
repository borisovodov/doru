/**
 * GEDCOM 7.0 §3.4 Enumeration Values of the GEDCOM 7.0.18 specification.
 *
 * Each enumeration set is modelled as a union of string literals derived
 * from a `const` table that records the specification's meaning of every
 * value, plus the extension production `extTag` (GEDCOM 7.0 §1.5: enumerated values
 * may be extended with new values that match `extTag`). The URI of each
 * value is `g7:enum-<value>` unless noted otherwise in GEDCOM 7.0 §3.4.
 *
 * GEDCOM 5.5.1 defines the same value sets as inline "controlled line_value
 * choices" of its primitive elements (GEDCOM 5.5.1 §2 Primitive Elements,
 * p.41–65); each set below cites its 5.5.1 counterpart. 5.5.1 considers
 * all controlled values case insensitive and spells most of them
 * lowercase; values added in 7.0 are marked as such.
 */

import type { ExtensionTag } from './primitives';

/**
 * GEDCOM 7.0 §3.4 g7:enumset-ADOP — which parent(s) in the family adopted this
 * individual. Used by g7:FAMC-ADOP.
 *
 * GEDCOM 5.5.1 §2 (p.42), `ADOPTED_BY_WHICH_PARENT` — identical values
 * (HUSB, WIFE, BOTH), spelled uppercase in both versions.
 */
export const ADOPTION_ENUM_VALUES = {
  /** Adopted by the HUSB of the FAM pointed to by FAMC. URI: `g7:enum-ADOP-HUSB`. */
  HUSB: 'Adopted by the HUSB of the FAM pointed to by FAMC.',
  /** Adopted by the WIFE of the FAM pointed to by FAMC. URI: `g7:enum-ADOP-WIFE`. */
  WIFE: 'Adopted by the WIFE of the FAM pointed to by FAMC.',
  /** Adopted by both HUSB and WIFE of the FAM pointed to by FAMC. */
  BOTH: 'Adopted by both HUSB and WIFE of the FAM pointed to by FAMC.',
} as const;

/** GEDCOM 7.0 §3.4 g7:enumset-ADOP. */
export type AdoptionEnum = keyof typeof ADOPTION_ENUM_VALUES | ExtensionTag;

/**
 * GEDCOM 7.0 §3.4 g7:enumset-EVEN — an event-type tag name, but not the generic EVEN
 * tag. Values are the tags of the individual events (GEDCOM 7.0 §3.3.1.1) and family
 * events (GEDCOM 7.0 §3.3.1.2). Used by the payload of g7:NO.
 *
 * 7.0-only: g7:NO does not exist in 5.5.1. The 5.5.1 counterpart of this
 * value set is the union of `EVENT_TYPE_INDIVIDUAL` and
 * `EVENT_TYPE_FAMILY` (GEDCOM 5.5.1 §2 p.49), which additionally includes
 * the generic EVEN tag (covered here by `EventAttributeEnum`).
 */
export const EVENT_ENUM_VALUES = {
  ADOP: 'adoption',
  BAPM: 'baptism',
  BARM: 'Bar Mitzvah',
  BASM: 'Bas Mitzvah',
  BIRT: 'birth',
  BLES: 'blessing',
  BURI: 'depositing remains',
  CENS: 'census',
  CHR: 'christening',
  CHRA: 'adult christening',
  CONF: 'confirmation',
  CREM: 'cremation',
  DEAT: 'death',
  EMIG: 'emigration',
  FCOM: 'first communion',
  GRAD: 'graduation',
  IMMI: 'immigration',
  NATU: 'naturalization',
  ORDN: 'ordination',
  PROB: 'probate',
  RETI: 'retirement',
  WILL: 'will',
  ANUL: 'annulment',
  DIV: 'divorce',
  DIVF: 'divorce filed',
  ENGA: 'engagement',
  MARB: 'marriage bann',
  MARC: 'marriage contract',
  MARL: 'marriage license',
  MARR: 'marriage',
  MARS: 'marriage settlement',
} as const;

export type EventEnum = keyof typeof EVENT_ENUM_VALUES | ExtensionTag;

/**
 * GEDCOM 7.0 §3.4 g7:enumset-EVENATTR — an event- or attribute-type tag name: the
 * g7:enumset-EVEN values plus the generic EVEN and FACT tags and the tags
 * of the individual attributes (GEDCOM 7.0 §3.3.2.1). Used by g7:DATA-EVEN and
 * g7:SOUR-EVEN.
 *
 * GEDCOM 5.5.1 §2 (p.48), `EVENT_ATTRIBUTE_TYPE` — the union of
 * `EVENT_TYPE_INDIVIDUAL`, `EVENT_TYPE_FAMILY` and `ATTRIBUTE_TYPE`
 * (CAST, EDUC, NATI, OCCU, PROP, RELI, RESI, TITL, FACT); identical
 * concept, the same tag set as here.
 */
export const EVENT_ATTRIBUTE_ENUM_VALUES = {
  ...EVENT_ENUM_VALUES,
  EVEN: 'a generic event',
  FACT: 'a generic attribute',
  CAST: 'caste',
  DSCR: 'physical description',
  EDUC: 'education',
  IDNO: 'identification number',
  NATI: 'nationality',
  NCHI: 'number of children',
  NMR: 'number of marriages',
  OCCU: 'occupation',
  PROP: 'property',
  RELI: 'religion',
  RESI: 'residence',
  SSN: 'social security number',
  TITL: 'title',
} as const;

export type EventAttributeEnum = keyof typeof EVENT_ATTRIBUTE_ENUM_VALUES | ExtensionTag;

/**
 * GEDCOM 7.0 §3.4 g7:enumset-MEDI — the medium in which information is stored.
 *
 * GEDCOM 5.5.1 §2 (p.62), `SOURCE_MEDIA_TYPE` — identical values spelled
 * lowercase (audio, book, card, electronic, fiche, film, magazine,
 * manuscript, map, newspaper, photo, tombstone, video); OTHER is 7.0-only
 * and is dropped when serializing to 5.5.1 (the TYPE line disappears).
 * In 5.5.1 the set is also used by the FILE.FORM.TYPE tag.
 */
export const MEDIA_ENUM_VALUES = {
  /** An audio recording. */
  AUDIO: 'An audio recording.',
  /** A bound book. */
  BOOK: 'A bound book.',
  /** A card or file entry. */
  CARD: 'A card or file entry.',
  /** A digital artifact such as a computer file or a scan. */
  ELECTRONIC: 'A digital artifact such as a computer file or a scan.',
  /** Microfiche. */
  FICHE: 'Microfiche.',
  /** Microfilm. */
  FILM: 'Microfilm.',
  /** Printed periodical. */
  MAGAZINE: 'Printed periodical.',
  /** Written pages. */
  MANUSCRIPT: 'Written pages.',
  /** Cartographic map. */
  MAP: 'Cartographic map.',
  /** Printed newspaper. */
  NEWSPAPER: 'Printed newspaper.',
  /** Photograph. */
  PHOTO: 'Photograph.',
  /** Burial marker or related memorial. */
  TOMBSTONE: 'Burial marker or related memorial.',
  /** Motion picture recording. */
  VIDEO: 'Motion picture recording.',
  /** A value not listed here; should have a PHRASE substructure. */
  OTHER: 'A value not listed here; should have a PHRASE substructure.',
} as const;

/** GEDCOM 7.0 §3.4 g7:enumset-MEDI. */
export type MediaEnum = keyof typeof MEDIA_ENUM_VALUES | ExtensionTag;

/**
 * GEDCOM 7.0 §3.4 g7:enumset-PEDI — the type of child-to-family relationship
 * represented by the superstructure.
 *
 * GEDCOM 5.5.1 §2 (p.57), `PEDIGREE_LINKAGE_TYPE` — identical values
 * (adopted, birth, foster, sealing, lowercase); OTHER is 7.0-only and is
 * dropped when serializing to 5.5.1 (the PEDI line disappears).
 */
export const PEDIGREE_ENUM_VALUES = {
  /** Adoptive parents. */
  ADOPTED: 'Adoptive parents.',
  /** Family structure at time of birth. */
  BIRTH: 'Family structure at time of birth.',
  /** The child was included in a foster or guardian family. */
  FOSTER: 'The child was included in a foster or guardian family.',
  /** The child was sealed to parents other than birth parents. */
  SEALING: 'The child was sealed to parents other than birth parents.',
  /** A value not listed here; should have a PHRASE substructure. */
  OTHER: 'A value not listed here; should have a PHRASE substructure.',
} as const;

/** GEDCOM 7.0 §3.4 g7:enumset-PEDI. */
export type PedigreeEnum = keyof typeof PEDIGREE_ENUM_VALUES | ExtensionTag;

/**
 * GEDCOM 7.0 §3.4 g7:enumset-QUAY — the credibility of a piece of information, based
 * on its supporting evidence. The values look like integers but do not
 * have numeric meaning.
 *
 * GEDCOM 5.5.1 §2 (p.43), `CERTAINTY_ASSESSMENT` — identical values and
 * meanings.
 */
export const QUALITY_ENUM_VALUES = {
  /** Unreliable evidence or estimated data. */
  '0': 'Unreliable evidence or estimated data.',
  /** Questionable reliability of evidence (interviews, census, oral genealogies, or potential for bias, such as an autobiography). */
  '1': 'Questionable reliability of evidence (interviews, census, oral genealogies, or potential for bias, such as an autobiography).',
  /** Secondary evidence, data officially recorded sometime after the event. */
  '2': 'Secondary evidence, data officially recorded sometime after the event.',
  /** Direct and primary evidence used, or by dominance of the evidence. */
  '3': 'Direct and primary evidence used, or by dominance of the evidence.',
} as const;

/** GEDCOM 7.0 §3.4 g7:enumset-QUAY. */
export type QualityEnum = keyof typeof QUALITY_ENUM_VALUES | ExtensionTag;

/**
 * GEDCOM 7.0 §3.4 g7:enumset-RESN — access to information may be denied or otherwise
 * restricted. When a list of values is present, all apply.
 *
 * GEDCOM 5.5.1 §2 (p.60), `RESTRICTION_NOTICE` — identical values
 * (confidential, locked, privacy, lowercase).
 */
export const RESTRICTION_ENUM_VALUES = {
  /** This data was marked as confidential by the user. */
  CONFIDENTIAL: 'This data was marked as confidential by the user.',
  /** Some systems may ignore changes to this data. */
  LOCKED: 'Some systems may ignore changes to this data.',
  /** This data is not to be shared outside of a trusted circle, generally because it contains information about living individuals. This definition is known to admit multiple interpretations, so use of the PRIVACY restriction notice is not recommended. */
  PRIVACY: 'This data is not to be shared outside of a trusted circle, generally because it contains information about living individuals. This definition is known to admit multiple interpretations, so use of the PRIVACY restriction notice is not recommended.',
} as const;

/** GEDCOM 7.0 §3.4 g7:enumset-RESN. */
export type RestrictionEnum = keyof typeof RESTRICTION_ENUM_VALUES | ExtensionTag;

/**
 * GEDCOM 7.0 §3.4 g7:enumset-ROLE — the role a person played in an event or a
 * person's life.
 *
 * GEDCOM 5.5.1 §2 (p.61), `ROLE_IN_EVENT` — a subset of this set (CHIL,
 * HUSB, WIFE, MOTH, FATH, SPOU); 5.5.1 additionally allows any free-form
 * role descriptor enclosed in parentheses. The remaining values here
 * (CLERGY, FRIEND, GODP, MULTIPLE, NGHBR, OFFICIATOR, PARENT, WITN) and
 * OTHER are 7.0-only. A parenthesized 5.5.1 descriptor is normalized on
 * import to OTHER with the descriptor kept in the ROLE.PHRASE
 * substructure.
 */
export const ROLE_ENUM_VALUES = {
  /** Child. */
  CHIL: 'Child.',
  /** Religious official in event; implies OFFICIATOR. */
  CLERGY: 'Religious official in event; implies OFFICIATOR.',
  /** Father; implies PARENT. */
  FATH: 'Father; implies PARENT.',
  /** Friend. */
  FRIEND: 'Friend.',
  /** Godparent or related role in other religions. */
  GODP: 'Godparent or related role in other religions.',
  /** Husband; implies SPOU. */
  HUSB: 'Husband; implies SPOU.',
  /** Mother; implies PARENT. */
  MOTH: 'Mother; implies PARENT.',
  /** A sibling from the same pregnancy (twin, triplet, quadruplet, and so on). A PHRASE can be used to specify the kind of multiple birth. */
  MULTIPLE: 'A sibling from the same pregnancy (twin, triplet, quadruplet, and so on). A PHRASE can be used to specify the kind of multiple birth.',
  /** Neighbor. */
  NGHBR: 'Neighbor.',
  /** Officiator of the event. */
  OFFICIATOR: 'Officiator of the event.',
  /** Parent. */
  PARENT: 'Parent.',
  /** Spouse. */
  SPOU: 'Spouse.',
  /** Wife; implies SPOU. */
  WIFE: 'Wife; implies SPOU.',
  /** Witness. */
  WITN: 'Witness.',
  /** A value not listed here; should have a PHRASE substructure. */
  OTHER: 'A value not listed here; should have a PHRASE substructure.',
} as const;

/** GEDCOM 7.0 §3.4 g7:enumset-ROLE. */
export type RoleEnum = keyof typeof ROLE_ENUM_VALUES | ExtensionTag;

/**
 * GEDCOM 7.0 §3.4 g7:enumset-SEX — the sex of the individual at birth. This can
 * describe an individual's reproductive or sexual anatomy at birth; gender
 * identity or sexual preference are not given their own tag.
 *
 * GEDCOM 5.5.1 §2 (p.61), `SEX_VALUE` — values M, F and U only. X and N
 * are the GEDCOM 5.5.5 additions (`SEX_VALUE`, 5.5.5 §2 p.104: X =
 * intersex; N = "Not recorded", distinguished from U: the record did
 * not record a sex, or it is sure that there is no record). The 5.x
 * parser accepts all five values in any 5.x file; the serializers
 * project: 5.5.1 drops X and N (the SEX line disappears), 7.0 drops N.
 */
export const SEX_ENUM_VALUES = {
  /** Male. */
  M: 'Male.',
  /** Female. */
  F: 'Female.',
  /** Does not fit the typical definition of only Male or only Female. */
  X: 'Does not fit the typical definition of only Male or only Female.',
  /** Cannot be determined from available sources. */
  U: 'Cannot be determined from available sources.',
  /** The record did not record a sex, or it is sure that there is no record. GEDCOM 5.5.5 §2 (p.104) only. */
  N: 'The record did not record a sex, or it is sure that there is no record.',
} as const;

/** GEDCOM 7.0 §3.4 g7:enumset-SEX. */
export type SexEnum = keyof typeof SEX_ENUM_VALUES | ExtensionTag;


/**
 * GEDCOM 7.0 §3.4 g7:enumset-FAMC-STAT — the state or condition of a researcher's
 * belief in a family connection.
 *
 * GEDCOM 5.5.1 §2 (p.44), `CHILD_LINKAGE_STATUS` — identical values
 * (challenged, disproven, proven, lowercase).
 */
export const FAMILY_CHILD_STATUS_ENUM_VALUES = {
  /** Linking this child to this family is suspect, but the linkage has been neither proven nor disproven. */
  CHALLENGED: 'Linking this child to this family is suspect, but the linkage has been neither proven nor disproven.',
  /** There has been a claim by some that this child belongs to this family, but the linkage has been disproven. */
  DISPROVEN: 'There has been a claim by some that this child belongs to this family, but the linkage has been disproven.',
  /** Linking this child to this family has been proven. */
  PROVEN: 'Linking this child to this family has been proven.',
} as const;

/** GEDCOM 7.0 §3.4 g7:enumset-FAMC-STAT. */
export type FamilyChildStatusEnum =
  | keyof typeof FAMILY_CHILD_STATUS_ENUM_VALUES
  | ExtensionTag;

/**
 * GEDCOM 7.0 §3.4 g7:enumset-ord-STAT — the state or condition of a Latter-day Saint
 * ordinance. The interpretation of these values is subject to individual
 * user interpretation; the "applies to" and "status" columns are
 * recommendations, not requirements.
 *
 * GEDCOM 5.5.1 §2 (p.51–52) defines four per-ordinance sets
 * (`LDS_BAPTISM_DATE_STATUS`, `LDS_ENDOWMENT_DATE_STATUS`,
 * `LDS_CHILD_SEALING_DATE_STATUS`, `LDS_SPOUSE_SEALING_DATE_STATUS`)
 * with the same values, but 5.5.1 spells PRE-1970 and DNS/CAN with a
 * hyphen and slash (7.0: PRE_1970, DNS_CAN) and has no INFANT value
 * (dropped when serializing to 5.5.1: the whole STAT substructure
 * disappears). This model keeps the single 7.0 set: the 5.5.1 spellings
 * are treated as serialization aliases, and the 5.5.1 per-ordinance
 * subsets are a subset of this union and are enforced at validation
 * time, not in the types.
 */
export const ORDINANCE_STATUS_ENUM_VALUES = {
  /** Born in the covenant, so child to parent sealing ordinance is not required. Applies to: SLGC. Status: current. */
  BIC: 'Born in the covenant, so child to parent sealing ordinance is not required.',
  /** Canceled and considered invalid. Applies to: SLGS. Status: current. */
  CANCELED: 'Canceled and considered invalid.',
  /** Died before 8 years old, so ordinances other than child to parent sealing are not required. Applies to: all but SLGC. Status: current. */
  CHILD: 'Died before 8 years old, so ordinances other than child to parent sealing are not required.',
  /** Completed, but the date is not known. Applies to: all. Status: deprecated, use DATE BEF date instead. */
  COMPLETED: 'Completed, but the date is not known.',
  /** Patron excluded this ordinance from being cleared in this submission. Applies to: all. Status: deprecated. */
  EXCLUDED: 'Patron excluded this ordinance from being cleared in this submission.',
  /** This ordinance is not authorized. Applies to: SLGC, SLGS. Status: current. */
  DNS: 'This ordinance is not authorized.',
  /** This ordinance is not authorized, and the previous ordinance is cancelled. Applies to: SLGS. Status: current. */
  DNS_CAN: 'This ordinance is not authorized, and the previous ordinance is cancelled.',
  /** Died before less than 1 year old, baptism or endowment not required. Applies to: all but SLGC. Status: deprecated, use CHILD instead. */
  INFANT: 'Died before less than 1 year old, baptism or endowment not required.',
  /** Ordinance was likely completed because an ordinance for this person was converted from temple records of work completed before 1970. Applies to: all. Status: deprecated, use DATE BEF 1970 instead. */
  PRE_1970: 'Ordinance was likely completed because an ordinance for this person was converted from temple records of work completed before 1970.',
  /** Born dead, so no ordinances are required. Applies to: all. Status: current. */
  STILLBORN: 'Born dead, so no ordinances are required.',
  /** Ordinance was previously submitted. Applies to: all. Status: deprecated. */
  SUBMITTED: 'Ordinance was previously submitted.',
  /** Data for clearing the ordinance request was insufficient. Applies to: all. Status: deprecated. */
  UNCLEARED: 'Data for clearing the ordinance request was insufficient.',
} as const;

/** GEDCOM 7.0 §3.4 g7:enumset-ord-STAT. */
export type OrdinanceStatusEnum =
  | keyof typeof ORDINANCE_STATUS_ENUM_VALUES
  | ExtensionTag;

/**
 * GEDCOM 7.0 §3.4 g7:enumset-NAME-TYPE — the type of a name.
 *
 * GEDCOM 5.5.1 §2 (p.56), `NAME_TYPE` — values aka, birth, immigrant,
 * maiden, married (lowercase) plus an arbitrary user-defined value;
 * PROFESSIONAL and OTHER are 7.0-only, and 7.0 restricts non-standard
 * values to extension tags. An arbitrary 5.5.1 user-defined value is
 * normalized on import to OTHER with the text kept in the TYPE.PHRASE
 * substructure.
 */
export const NAME_TYPE_ENUM_VALUES = {
  /** Also known as, alias, etc. */
  AKA: 'Also known as, alias, etc.',
  /** Name given at or near birth. */
  BIRTH: 'Name given at or near birth.',
  /** Name assumed at the time of immigration. */
  IMMIGRANT: 'Name assumed at the time of immigration.',
  /** Maiden name, name before first marriage. */
  MAIDEN: 'Maiden name, name before first marriage.',
  /** Married name, assumed as part of marriage. */
  MARRIED: 'Married name, assumed as part of marriage.',
  /** Name used professionally (pen, screen, stage name). */
  PROFESSIONAL: 'Name used professionally (pen, screen, stage name).',
  /** A value not listed here; should have a PHRASE substructure. */
  OTHER: 'A value not listed here; should have a PHRASE substructure.',
} as const;

/** GEDCOM 7.0 §3.4 g7:enumset-NAME-TYPE. */
export type NameTypeEnum = keyof typeof NAME_TYPE_ENUM_VALUES | ExtensionTag;
