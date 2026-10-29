import type {
  AdoptionEnum,
} from '../enumerations';
import type {
  Integer,
  Pointer,
  Special,
  Text,
} from '../primitives';

import type { EventAssertion } from './family-structures';
import type { FamilyRecord } from './records';
import type { UsmBirthType } from './records';
import type { GedcomStructureBase } from './extensions';
import type { IndividualEventDetail } from './common';

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE / INDIVIDUAL_EVENT_STRUCTURE
// ---------------------------------------------------------------------------

/** Base of the individual attribute structures of GEDCOM 7.0 §3.2.3.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.33), `INDIVIDUAL_ATTRIBUTE_STRUCTURE` —
 * the same attribute set.
 */
interface IndividualAttributeBase<Tag extends string, TPayload> extends GedcomStructureBase {
  tag: Tag;
  /** {1:1} — the payload of the attribute. */
  payload: TPayload;
  /** TYPE {0:1}, g7:TYPE — a descriptive word or phrase further classifying the attribute. */
  type?: Text;
  /** <<INDIVIDUAL_EVENT_DETAIL>> {0:1}. */
  detail?: IndividualEventDetail;
}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE — g7:CAST: caste. GEDCOM 7.0 §3.3.2.1. */
export interface CasteAttribute extends IndividualAttributeBase<'CAST', Text> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE — g7:DSCR: physical description. GEDCOM 7.0 §3.3.2.1. */
export interface PhysicalDescriptionAttribute extends IndividualAttributeBase<'DSCR', Text> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE — g7:EDUC: education. GEDCOM 7.0 §3.3.2.1. */
export interface EducationAttribute extends IndividualAttributeBase<'EDUC', Text> {}

/**
 * GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE — g7:IDNO: a number or other
 * string assigned to identify a person within some significant external
 * system; must have a TYPE substructure. GEDCOM 7.0 §3.3.2.1.
 */
export interface IdentificationNumberAttribute extends GedcomStructureBase {
  tag: 'IDNO';
  /** The IDNO payload, {1:1} Special. */
  payload: Special;
  /** TYPE {1:1}, g7:TYPE — required for IDNO. */
  type: Text;
  /** <<INDIVIDUAL_EVENT_DETAIL>> {0:1}. */
  detail?: IndividualEventDetail;
}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE — g7:NATI: nationality. GEDCOM 7.0 §3.3.2.1. */
export interface NationalityAttribute extends IndividualAttributeBase<'NATI', Text> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE — g7:INDI-NCHI: the number of children this person is known to be the parent of. GEDCOM 7.0 §3.3.2.1. */
export interface IndividualChildCountAttribute extends IndividualAttributeBase<'NCHI', Integer> {
  /**
   * SURE {0:1} — the given child count is certain. Written by Der
   * Stammbaum ≤ V6 (USM6) under the INDI or FAM NCHI with the value
   * `1` (the documented example: "SURE 1 in INDI/FAM.NCHI - angeg.
   * Anz Kinder gesichert", the GenWiki "GEDCOM/_Nutzerdef-Tag"
   * article's "Tabelle 2":
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag). Not part of any
   * GEDCOM version. Recognized on 5.x input (`1` marks the flag set,
   * `0` clears it) and written back as `SURE 1`/`SURE 0` under the
   * NCHI line in 5.5.1; dropped on 7.0 output.
   */
  childCountCertain?: boolean;
}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE — g7:NMR: the number of times this person has participated in a family as a spouse or parent. GEDCOM 7.0 §3.3.2.1. */
export interface MarriageCountAttribute extends IndividualAttributeBase<'NMR', Integer> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE — g7:OCCU: occupation. GEDCOM 7.0 §3.3.2.1. */
export interface OccupationAttribute extends IndividualAttributeBase<'OCCU', Text> {
  /**
   * _PRIM Y {0:1} — marks the occupation as the primary one. Written by
   * Ahnenblatt under OCCU (see the GenWiki "GEDCOM/_Nutzerdef-Tag"
   * catalog: https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag); not
   * part of any GEDCOM version. Recognized on input and written back as
   * `_PRIM Y` under the OCCU line in both versions.
   */
  primary?: boolean;
}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE — g7:PROP: property. GEDCOM 7.0 §3.3.2.1. */
export interface PropertyAttribute extends IndividualAttributeBase<'PROP', Text> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE — g7:INDI-RELI: religion. GEDCOM 7.0 §3.3.2.1. */
export interface IndividualReligionAttribute extends IndividualAttributeBase<'RELI', Text> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE — g7:INDI-RESI: residence. GEDCOM 7.0 §3.3.2.1. */
export interface IndividualResidenceAttribute extends GedcomStructureBase {
  tag: 'RESI';
  /**
   * The RESI payload, {1:1} Text in 7.0 (may be empty; a missing
   * payload is equivalent to the empty string, GEDCOM 7.0 §1.2); the
   * 5.5.1 grammar (GEDCOM 5.5.1 §2 p.33) gives INDI.RESI no payload —
   * the residence is carried by the ADDR/PLAC substructures of the
   * detail. 5.5.1 input may still carry a payload (real files do); it
   * is kept.
   */
  payload?: Text;
  /** TYPE {0:1}, g7:TYPE — a descriptive word or phrase further classifying the attribute. */
  type?: Text;
  /** <<INDIVIDUAL_EVENT_DETAIL>> {0:1}. */
  detail?: IndividualEventDetail;
}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE — g7:SSN: social security number; a type of IDNO. GEDCOM 7.0 §3.3.2.1. */
export interface SocialSecurityNumberAttribute extends IndividualAttributeBase<'SSN', Special> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE — g7:INDI-TITL: title. GEDCOM 7.0 §3.3.2.1. */
export interface IndividualTitleAttribute extends IndividualAttributeBase<'TITL', Text> {}

/**
 * GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE — g7:INDI-FACT: a generic
 * individual attribute; must have a TYPE substructure to define what kind
 * of attribute is being provided. GEDCOM 7.0 §3.3.2.1.
 */
export interface IndividualGenericAttribute extends GedcomStructureBase {
  tag: 'FACT';
  /** The FACT payload, {1:1} Text. */
  payload: Text;
  /** TYPE {1:1}, g7:TYPE — required for INDI.FACT. */
  type: Text;
  /** <<INDIVIDUAL_EVENT_DETAIL>> {0:1}. */
  detail?: IndividualEventDetail;
}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE — the union of individual attributes. */
export type IndividualAttributeStructure =
  | CasteAttribute
  | PhysicalDescriptionAttribute
  | EducationAttribute
  | IdentificationNumberAttribute
  | NationalityAttribute
  | IndividualChildCountAttribute
  | MarriageCountAttribute
  | OccupationAttribute
  | PropertyAttribute
  | IndividualReligionAttribute
  | IndividualResidenceAttribute
  | SocialSecurityNumberAttribute
  | IndividualTitleAttribute
  | IndividualGenericAttribute;

/** Base of the individual event structures of GEDCOM 7.0 §3.2.3.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.34), `INDIVIDUAL_EVENT_STRUCTURE` —
 * the same event set; in 5.5.1 ADOP, BIRT, CHR and DEAT have the
 * optional `Y` payload (the model accepts the assertion on every event
 * as a superset, like the 7.0 grammar).
 */
interface IndividualEventBase<Tag extends string> extends GedcomStructureBase {
  tag: Tag;
  /** {1:1} — `[Y|<NULL>]`: the optional `Y` payload asserting the event occurred (GEDCOM 7.0 §3.3.1). */
  payload?: EventAssertion;
  /** TYPE {0:1}, g7:TYPE — a descriptive word or phrase further classifying the event. */
  type?: Text;
  /** <<INDIVIDUAL_EVENT_DETAIL>> {0:1}. */
  detail?: IndividualEventDetail;
}

/**
 * GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:ADOP: adoption; creation of a
 * legally approved child-parent relationship. May have a FAMC with an
 * optional ADOP substructure indicating which parents adopted.
 * GEDCOM 7.0 §3.3.1.1.
 */
export interface AdoptionEvent extends IndividualEventBase<'ADOP'> {
  /** FAMC {0:1}, g7:ADOP-FAMC — the individual or couple that adopted this individual. */
  adoptionFamily?: AdoptionFamilyLink;
}

/**
 * GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:ADOP-FAMC: the family that
 * adopted the individual, with an indication of which parent(s) adopted.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.34), `INDIVIDUAL_EVENT_STRUCTURE` —
 * identical (ADOP.FAMC + ADOP {0:1} `ADOPTED_BY_WHICH_PARENT`).
 */
export interface AdoptionFamilyLink extends GedcomStructureBase {
  /** The FAMC payload, {1:1} pointer to a FAM record. */
  family: Pointer<FamilyRecord>;
  /** ADOP {0:1}, g7:FAMC-ADOP — Enum of g7:enumset-ADOP. */
  adoption?: AdoptionStructure;
}

/**
 * GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:FAMC-ADOP: an enumerated value
 * indicating which parent(s) in the family adopted this individual.
 */
export interface AdoptionStructure extends GedcomStructureBase {
  /** The ADOP payload, {1:1} Enum of g7:enumset-ADOP. */
  payload: AdoptionEnum;
  /** PHRASE {0:1}, g7:PHRASE. */
  phrase?: Text;
}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:BAPM: baptism. GEDCOM 7.0 §3.3.1.1. */
export interface BaptismEvent extends IndividualEventBase<'BAPM'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:BARM: Bar Mitzvah. GEDCOM 7.0 §3.3.1.1. */
export interface BarMitzvahEvent extends IndividualEventBase<'BARM'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:BASM: Bas Mitzvah. GEDCOM 7.0 §3.3.1.1. */
export interface BasMitzvahEvent extends IndividualEventBase<'BASM'> {}

/**
 * GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:BIRT: birth; entering into life.
 * May have a FAMC (bare pointer) indicating the family at birth.
 * GEDCOM 7.0 §3.3.1.1.
 */
export interface BirthEvent extends IndividualEventBase<'BIRT'> {
  /** FAMC {0:1}, g7:FAMC — the family with which this event is associated. */
  familyChild?: Pointer<FamilyRecord>;
  /**
   * BTYP {0:1} — the birth type: 1 = single birth, 2 = twin, 3 =
   * multiple birth, 4 = the child died at birth. Written by Der
   * Stammbaum ≤ V6 (USM6) under BIRT; the values are documented in the
   * GenWiki "GEDCOM/_Nutzerdef-Tag" article's "Tabelle 2" (see
   * UsmBirthType). Not part of any GEDCOM version. Recognized on 5.x
   * input and written back as `BTYP` in 5.5.1; dropped on 7.0 output
   * (7.0 cannot spell a non-underscore extension tag).
   */
  birthType?: UsmBirthType;
}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:BLES: blessing. GEDCOM 7.0 §3.3.1.1. */
export interface BlessingEvent extends IndividualEventBase<'BLES'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:BURI: depositing remains. GEDCOM 7.0 §3.3.1.1. */
export interface BurialEvent extends IndividualEventBase<'BURI'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:INDI-CENS: census. GEDCOM 7.0 §3.3.1.1. */
export interface CensusEvent extends IndividualEventBase<'CENS'> {}

/**
 * GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:CHR: christening. May have a
 * FAMC (bare pointer) indicating the family at christening. GEDCOM 7.0 §3.3.1.1.
 */
export interface ChristeningEvent extends IndividualEventBase<'CHR'> {
  /** FAMC {0:1}, g7:FAMC — the family with which this event is associated. */
  familyChild?: Pointer<FamilyRecord>;
}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:CHRA: adult christening. GEDCOM 7.0 §3.3.1.1. */
export interface AdultChristeningEvent extends IndividualEventBase<'CHRA'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:CONF: confirmation. GEDCOM 7.0 §3.3.1.1. */
export interface ConfirmationEvent extends IndividualEventBase<'CONF'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:CREM: cremation. GEDCOM 7.0 §3.3.1.1. */
export interface CremationEvent extends IndividualEventBase<'CREM'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:DEAT: death. GEDCOM 7.0 §3.3.1.1. */
export interface DeathEvent extends IndividualEventBase<'DEAT'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:EMIG: emigration. GEDCOM 7.0 §3.3.1.1. */
export interface EmigrationEvent extends IndividualEventBase<'EMIG'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:FCOM: first communion. GEDCOM 7.0 §3.3.1.1. */
export interface FirstCommunionEvent extends IndividualEventBase<'FCOM'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:GRAD: graduation. GEDCOM 7.0 §3.3.1.1. */
export interface GraduationEvent extends IndividualEventBase<'GRAD'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:IMMI: immigration. GEDCOM 7.0 §3.3.1.1. */
export interface ImmigrationEvent extends IndividualEventBase<'IMMI'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:NATU: naturalization. GEDCOM 7.0 §3.3.1.1. */
export interface NaturalizationEvent extends IndividualEventBase<'NATU'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:ORDN: ordination. GEDCOM 7.0 §3.3.1.1. */
export interface OrdinationEvent extends IndividualEventBase<'ORDN'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:PROB: probate. GEDCOM 7.0 §3.3.1.1. */
export interface ProbateEvent extends IndividualEventBase<'PROB'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:RETI: retirement. GEDCOM 7.0 §3.3.1.1. */
export interface RetirementEvent extends IndividualEventBase<'RETI'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:WILL: will. GEDCOM 7.0 §3.3.1.1. */
export interface WillEvent extends IndividualEventBase<'WILL'> {}

/**
 * GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:INDI-EVEN: a generic individual
 * event; must have a TYPE substructure to define what kind of event is
 * being provided. GEDCOM 7.0 §3.3.1.1.
 */
export interface IndividualGenericEvent extends GedcomStructureBase {
  tag: 'EVEN';
  /** The EVEN payload, {1:1} Text — may be the empty string. */
  payload: Text;
  /** TYPE {1:1}, g7:TYPE — required for INDI.EVEN. */
  type: Text;
  /** <<INDIVIDUAL_EVENT_DETAIL>> {0:1}. */
  detail?: IndividualEventDetail;
}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — the union of individual events. */
export type IndividualEventStructure =
  | AdoptionEvent
  | BaptismEvent
  | BarMitzvahEvent
  | BasMitzvahEvent
  | BirthEvent
  | BlessingEvent
  | BurialEvent
  | CensusEvent
  | ChristeningEvent
  | AdultChristeningEvent
  | ConfirmationEvent
  | CremationEvent
  | DeathEvent
  | EmigrationEvent
  | FirstCommunionEvent
  | GraduationEvent
  | ImmigrationEvent
  | NaturalizationEvent
  | OrdinationEvent
  | ProbateEvent
  | RetirementEvent
  | WillEvent
  | IndividualGenericEvent;
