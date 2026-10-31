import type {
  Integer,
  Text,
} from '../primitives';

import type { FamilyEventDetail } from './common';
import type { GedcomStructureBase } from './extensions';

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §3.2.3 FAMILY_ATTRIBUTE_STRUCTURE / FAMILY_EVENT_STRUCTURE
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §2.4 / GEDCOM 7.0 §3.2.3 — the optional `Y` payload of event structures: the event
 * is known to have occurred without providing any additional information
 * about it (GEDCOM 7.0 §3.3.1).
 */
export type EventAssertion = 'Y';

/** Base of the family attribute structures of GEDCOM 7.0 §3.2.3. */
interface FamilyAttributeBase<Tag extends string, TPayload> extends GedcomStructureBase {
  tag: Tag;
  /** {1:1} — the payload of the attribute. */
  payload: TPayload;
  /** TYPE {0:1}, g7:TYPE — a descriptive word or phrase further classifying the attribute. */
  type?: Text;
  /** <<FAMILY_EVENT_DETAIL>> {0:1}. */
  detail?: FamilyEventDetail;
}

/**
 * GEDCOM 7.0 §3.2.3 FAMILY_ATTRIBUTE_STRUCTURE — g7:FAM-NCHI: the number of children
 * that belong to this family. GEDCOM 7.0 §3.3.2.2.
 *
 * GEDCOM 5.5.1 §2 Record Structures (p.24), `FAM_RECORD` — in 5.5.1 NCHI
 * sits directly under the FAM record ({0:1}) with the same
 * `COUNT_OF_CHILDREN` meaning and no substructures. In 7.0 it is one of
 * the FAMILY_ATTRIBUTE_STRUCTUREs: the full TYPE {0:1} and
 * FAMILY_EVENT_DETAIL {0:1} (the partners' ages plus an EVENT_DETAIL)
 * apply (GEDCOM 7.0 §3.2.3 FAMILY_ATTRIBUTE_STRUCTURE). The TYPE and
 * the detail are dropped when serializing to 5.5.1 (its NCHI is bare).
 *
 * The vendor childless marker `_NONE` under FAM — "the couple had no
 * children", an explicit assertion that distinguishes a childless
 * couple from one whose children are merely unrecorded — normalizes on
 * input (both versions) into this structure with the payload 0. Two
 * spellings exist in the wild and both are accepted: the bare `_NONE`
 * of Legacy Family Tree ("Custom GEDCOM Tags" help: "_NONE = Indicates
 * that a couple had no children (under a FAM record)",
 * https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm) and
 * the `_NONE Y` of Ahnenblatt — the only documented value, a positive
 * assertion by analogy with the standard `MARR Y` event payload,
 * catalogued by the GEDCOM-L working group in the GenWiki
 * "GEDCOM/_Nutzerdef-Tag" table
 * (https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag). Any other value
 * is a strict error (`enum.invalid-value`). The serializers write the
 * standard `NCHI 0` in both versions; the vendor tag itself is not
 * written back (the construct has a standard equivalent).
 */
export interface FamilyChildCountAttribute extends FamilyAttributeBase<'NCHI', Integer> {
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

/**
 * GEDCOM 7.0 §3.2.3 FAMILY_ATTRIBUTE_STRUCTURE — g7:FAM-RESI: an address or place of
 * residence where a family resided. GEDCOM 7.0 §3.3.2.2.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.32), `FAMILY_EVENT_STRUCTURE` — in
 * 5.5.1 FAM.RESI is a family *event* with no payload, so the payload is
 * optional here (required in 7.0, forbidden in 5.5.1). The GEDCOM-L
 * addendum gives the 5.5.1 FAM.RESI an optional residence descriptor
 * payload instead ("GEDCOM 5.5.1 Specification GEDCOM-L Addendum",
 * §5.9, 2nd release 2020-12-01, eds. A. Emmerich & D. Hesmer), which
 * is accepted on 5.x input and written back on 5.5.1 output.
 */
export interface FamilyResidenceAttribute extends GedcomStructureBase {
  tag: 'RESI';
  /** The RESI payload, {1:1} Text in 7.0 (may be empty; a missing payload is equivalent to the empty string, GEDCOM 7.0 §1.2); optional on 5.x input via the GEDCOM-L addendum §5.9. */
  payload?: Text;
  /** TYPE {0:1}, g7:TYPE — a descriptive word or phrase further classifying the attribute. */
  type?: Text;
  /** <<FAMILY_EVENT_DETAIL>> {0:1}. */
  detail?: FamilyEventDetail;
}

/**
 * GEDCOM 7.0 §3.2.3 FAMILY_ATTRIBUTE_STRUCTURE — g7:FAM-FACT: a generic family
 * attribute; must have a TYPE substructure to define what kind of
 * attribute is being provided. GEDCOM 7.0 §3.3.2.2.
 *
 * 7.0-only: 5.5.1 has no FAM.FACT.
 */
export interface FamilyGenericAttribute extends GedcomStructureBase {
  tag: 'FACT';
  /** The FACT payload, {1:1} Text. */
  payload: Text;
  /** TYPE {1:1}, g7:TYPE — required for FAM.FACT. */
  type: Text;
  /** <<FAMILY_EVENT_DETAIL>> {0:1}. */
  detail?: FamilyEventDetail;
}

/** GEDCOM 7.0 §3.2.3 FAMILY_ATTRIBUTE_STRUCTURE — the union of family attributes. */
export type FamilyAttributeStructure =
  | FamilyChildCountAttribute
  | FamilyResidenceAttribute
  | FamilyGenericAttribute;

/** Base of the family event structures of GEDCOM 7.0 §3.2.3.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.32), `FAMILY_EVENT_STRUCTURE` — the
 * same event set; in 5.5.1 only MARR has the optional `Y` payload, and
 * RESI is one of the family events there (modelled here as
 * `FamilyResidenceAttribute` with an optional payload).
 */
interface FamilyEventBase<Tag extends string> extends GedcomStructureBase {
  tag: Tag;
  /** {1:1} — `[Y|<NULL>]`: the optional `Y` payload asserting the event occurred (GEDCOM 7.0 §3.3.1). */
  payload?: EventAssertion;
  /** TYPE {0:1}, g7:TYPE — a descriptive word or phrase further classifying the event. */
  type?: Text;
  /** <<FAMILY_EVENT_DETAIL>> {0:1}. */
  detail?: FamilyEventDetail;
}

/** GEDCOM 7.0 §3.2.3 FAMILY_EVENT_STRUCTURE — g7:ANUL: annulment. GEDCOM 7.0 §3.3.1.2. */
export interface AnnulmentEvent extends FamilyEventBase<'ANUL'> {}

/** GEDCOM 7.0 §3.2.3 FAMILY_EVENT_STRUCTURE — g7:FAM-CENS: census. GEDCOM 7.0 §3.3.1.2. */
export interface FamilyCensusEvent extends FamilyEventBase<'CENS'> {}

/** GEDCOM 7.0 §3.2.3 FAMILY_EVENT_STRUCTURE — g7:DIV: divorce. GEDCOM 7.0 §3.3.1.2. */
export interface DivorceEvent extends FamilyEventBase<'DIV'> {}

/** GEDCOM 7.0 §3.2.3 FAMILY_EVENT_STRUCTURE — g7:DIVF: divorce filed. GEDCOM 7.0 §3.3.1.2. */
export interface DivorceFilingEvent extends FamilyEventBase<'DIVF'> {}

/** GEDCOM 7.0 §3.2.3 FAMILY_EVENT_STRUCTURE — g7:ENGA: engagement. GEDCOM 7.0 §3.3.1.2. */
export interface EngagementEvent extends FamilyEventBase<'ENGA'> {}

/** GEDCOM 7.0 §3.2.3 FAMILY_EVENT_STRUCTURE — g7:MARB: marriage bann. GEDCOM 7.0 §3.3.1.2. */
export interface MarriageBannEvent extends FamilyEventBase<'MARB'> {}

/** GEDCOM 7.0 §3.2.3 FAMILY_EVENT_STRUCTURE — g7:MARC: marriage contract. GEDCOM 7.0 §3.3.1.2. */
export interface MarriageContractEvent extends FamilyEventBase<'MARC'> {}

/** GEDCOM 7.0 §3.2.3 FAMILY_EVENT_STRUCTURE — g7:MARL: marriage license. GEDCOM 7.0 §3.3.1.2. */
export interface MarriageLicenseEvent extends FamilyEventBase<'MARL'> {}

/** GEDCOM 7.0 §3.2.3 FAMILY_EVENT_STRUCTURE — g7:MARR: marriage. GEDCOM 7.0 §3.3.1.2. */
export interface MarriageEvent extends FamilyEventBase<'MARR'> {}

/** GEDCOM 7.0 §3.2.3 FAMILY_EVENT_STRUCTURE — g7:MARS: marriage settlement. GEDCOM 7.0 §3.3.1.2. */
export interface MarriageSettlementEvent extends FamilyEventBase<'MARS'> {}

/**
 * GEDCOM 7.0 §3.2.3 FAMILY_EVENT_STRUCTURE — g7:FAM-EVEN: a generic family event;
 * must have a TYPE substructure to define what kind of event is being
 * provided. GEDCOM 7.0 §3.3.1.2.
 */
export interface FamilyGenericEvent extends GedcomStructureBase {
  tag: 'EVEN';
  /** The EVEN payload, {1:1} Text — may be the empty string. */
  payload: Text;
  /** TYPE {1:1}, g7:TYPE — required for FAM.EVEN. */
  type: Text;
  /** <<FAMILY_EVENT_DETAIL>> {0:1}. */
  detail?: FamilyEventDetail;
}

/** GEDCOM 7.0 §3.2.3 FAMILY_EVENT_STRUCTURE — the union of family events. */
export type FamilyEventStructure =
  | AnnulmentEvent
  | FamilyCensusEvent
  | DivorceEvent
  | DivorceFilingEvent
  | EngagementEvent
  | MarriageBannEvent
  | MarriageContractEvent
  | MarriageLicenseEvent
  | MarriageEvent
  | MarriageSettlementEvent
  | FamilyGenericEvent;
