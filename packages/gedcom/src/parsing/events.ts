/**
 * Parser section: Family/individual links, events, attributes, ordinances.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). Every function here
 * maps a raw-tree node onto the typed model and fails with a typed
 * error naming the offending line.
 */

import type {
  OrdinanceStatusEnum,
} from '../enumerations';
import {
  ADOPTION_ENUM_VALUES,
  FAMILY_CHILD_STATUS_ENUM_VALUES,
  ORDINANCE_STATUS_ENUM_VALUES,
  PEDIGREE_ENUM_VALUES,
  QUALITY_ENUM_VALUES,
  RESTRICTION_ENUM_VALUES,
} from '../enumerations';
import {
  fail,
} from '../errors';
import type {
  AdoptionFamilyLink,
  AdoptionStructure,
  AgeStructure,
  AliasLink,
  AssociationStructure,
  ChildFamilyLink,
  DateExactStructure,
  EventDetail,
  FactFlag,
  FamilyChildCountAttribute,
  FamilyChildLink,
  FamilyChildStatusStructure,
  FamilyEventDetail,
  FamilyEventStructure,
  FamilyGenericAttribute,
  FamilyPartnerEventDetail,
  FamilyPartnerLink,
  FamilyResidenceAttribute,
  GedcomStructureBase,
  IndividualAttributeStructure,
  IndividualEventDetail,
  IndividualEventStructure,
  LdsIndividualOrdinance,
  LdsOrdinanceDetail,
  OrdinanceStatusStructure,
  PedigreeStructure,
  ProfileLink,
  ChildSealingOrdinance,
  SpouseFamilyLink,
  SpouseSealingOrdinance,
  UsmBirthType,
} from '../structures';
import type {
  Ctx,
} from './context';
import {
  addExtension,
  dispatch,
  noPayload,
  one,
  req,
  reqDigits,
  reqPtr,
  reqText,
  yFlag,
} from './context';
import type {
  RawNode,
} from './lines';
import {
  parseMapCoordinates,
  parseMftCoordinates,
  parsePersonalNameStructure,
  parsePlaceStructure,
} from './names-places';
import {
  parseMultimediaLink,
  parsePrivacyFlag,
  parseSourceCitation,
  parseSureFlag,
  parseUsmCode,
  parseUsmFlag,
  parseVendorFlag,
  parseYNFlag,
} from './sources-media';
import {
  parseAddressStructure,
  parseAgeStructure,
  parseAssociation,
  parseChangeDate,
  parseCreationDateLenient,
  parseDateExactStructure,
  parseDateStructure,
  parseNoteStructure,
  parseSharedParticipant,
  parseSortDate551,
  parseSortDateStructure,
} from './substructures';
import {
  parseEnum,
  parseListEnum,
} from './types';
import {
  parseAge551,
  parseTime551,
} from './types';
import type {
  TimeValue,
} from '../primitives';

// Family/individual links, events, attributes, ordinances
// ---------------------------------------------------------------------------

/** The documented USM6 birth-type digits (`BTYP` under BIRT; see
 *  UsmBirthType). */
export const USM_BIRTH_TYPES = ['1', '2', '3', '4'] as const;

/**
 * The event/attribute TYPE payload: in 7.0 a missing line value is the
 * empty string payload (GEDCOM 7.0 §1.2 makes missing and empty
 * payloads equivalent, and §1.3 notes the empty-payload encoding for
 * Text payloads), so the bare `2 TYPE` round-trips a 5.5.1 TYPE-less
 * EVEN. A bare TYPE line is the empty type in any file.
 */
function parseEventType(node: RawNode, _ctx: Ctx): string {
  if (node.value.kind === 'absent') {
    return '';
  }
  return reqText(node);
}

/** The documented USM6 parent–child relation digits (`MTYP` under
 *  INDI.FAMC; see UsmParentalRelationKind). */
export const USM_PARENTAL_RELATION_KINDS = ['1', '2', '3', '4', '5', '6'] as const;

/** The documented USM6 family relationship digits (`UTYP` under FAM; see
 *  UsmUnionKind). */
export const USM_UNION_KINDS = ['1', '2', '3', '4', '5'] as const;

/** The Family Historian fact-flag tags: the four `__` children of the
 *  `_FLGS` block under an event or attribute (see FactFlag). */
const FH_FACT_FLAGS: ReadonlySet<string> = new Set(['__PRIVATE', '__PREFERRED', '__TENTATIVE', '__REJECTED']);

export function parseFamilyPartnerLink(node: RawNode, ctx: Ctx): FamilyPartnerLink {
  const out: FamilyPartnerLink = { partner: reqPtr(node, ctx) };
  dispatch(
    node,
    out,
    {
      PHRASE: (child) => {
        out.phrase = reqText(child);
      },
      '_PREF': (child) => {
        out.preferred = parseYNFlag(child, '_PREF');
      },
      '_NAM': (child) => {
        // GES2000: the married name of this partner ("Ehenamen des
        // Mannes oder der Frau"), used like INDI.NAME (see
        // FamilyPartnerLink.name).
        out.name = parsePersonalNameStructure(child, ctx);
      },
      '_ZVST': (child) => {
        // GES2000: the partner's civil status at the time of the
        // marriage (see FamilyPartnerLink.civilStatus).
        out.civilStatus = reqText(child);
      },
      '_NR': (child) => {
        // GES2000: the ordinal number of the marriage for this partner
        // (see FamilyPartnerLink.marriageNumber).
        out.marriageNumber = reqDigits(child);
      },
    },
    ctx,
    ['PHRASE', '_PREF', '_NAM', '_ZVST', '_NR'],
  );
  return out;
}

export function parseFamilyChildLink(node: RawNode, ctx: Ctx): FamilyChildLink {
  const out: FamilyChildLink = { child: reqPtr(node, ctx) };
  const handlers: Record<string, (child: RawNode) => void> = {
    PHRASE: (child) => {
      out.phrase = reqText(child);
    },
    NOTE: (child) => {
      (out.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    QUOT: (child) => {
      // A quotation attached to the child link (novel/game character
      // trees): kept as an inline NOTE.
      (out.notes ??= []).push({ tag: 'NOTE', payload: reqText(child) });
    },
    SLGC: (child) => {
      // The child's sealing under the CHIL link (see
      // FamilyChildLink.sealings).
      (out.sealings ??= []).push(parseChildSealing(child, ctx));
    },
  };
  handlers['_FREL'] = (child) => {
    out.fatherRelation = reqText(child);
  };
  handlers['_MREL'] = (child) => {
    out.motherRelation = reqText(child);
  };
  handlers['_PREF'] = (child) => {
    out.preferred = parseYNFlag(child, '_PREF');
  };
  handlers['_STAT'] = (child) => {
    out.multiplicity = reqText(child);
  };
  dispatch(node, out, handlers, ctx);
  return out;
}

export function parseChildFamilyLink(node: RawNode, ctx: Ctx): ChildFamilyLink {
  const out: ChildFamilyLink = { family: reqPtr(node, ctx) };
  const handlers: Record<string, (child: RawNode) => void> = {
    PEDI: (child) => {
      out.pedigree = parsePedigree(child, ctx);
    },
    STAT: (child) => {
      out.status = parseFamilyChildStatus(child, ctx);
    },
    '_PRIMARY': (child) => {
      out.primary = parseYNFlag(child, '_PRIMARY');
    },
    '_PREF': (child) => {
      out.preferred = parseYNFlag(child, '_PREF');
    },
    '_FREL': (child) => {
      // The AGES! position of the relation tags (under INDI.FAMC;
      // under FAM.CHIL they are typed on FamilyChildLink).
      out.fatherRelation = reqText(child);
    },
    '_MREL': (child) => {
      out.motherRelation = reqText(child);
    },
    '_HUSB': (child) => {
      // AQ: the child's status within the family on the father's side
      // (see ChildFamilyLink.fatherChildStatus).
      out.fatherChildStatus = reqText(child);
    },
    '_WIFE': (child) => {
      // AQ: the child's status within the family on the mother's side
      // (see ChildFamilyLink.motherChildStatus).
      out.motherChildStatus = reqText(child);
    },
    '_PEDI': (child) => {
      // Family Historian: the pedigree on an additional parent-family
      // link, the vendor spelling of the standard PEDI (the FHUG
      // "GEDCOM Extension List":
      // https://www.fhug.org.uk/kb/kb-article/gedcom-extension-list/).
      out.pedigree = parsePedigree(child, ctx);
    },
    '_PLINK': (child) => {
      // The Swarm family-tree packs: a FamilySearch profile link
      // attached to the FAMC link (see ProfileLink).
      const link: ProfileLink = {
        tag: '_PLINK',
        ...(child.value.kind === 'pointer' ? { individual: child.value.pointer } : {}),
      };
      dispatch(
        child,
        link,
        {
          '_FTSID': (grandchild) => {
            link.familyTreeId = reqText(grandchild);
          },
          PEDI: (grandchild) => {
            link.pedigree = parsePedigree(grandchild, ctx);
          },
          SOUR: (grandchild) => {
            (link.citations ??= []).push(parseSourceCitation(grandchild, ctx));
          },
        },
        ctx,
      );
      (out.profileLinks ??= []).push(link);
    },
    NOTE: (child) => {
      (out.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    QUOT: (child) => {
      // A quotation attached to the child link (novel/game character
      // trees): kept as an inline NOTE.
      (out.notes ??= []).push({ tag: 'NOTE', payload: reqText(child) });
    },
  };
  // The 7.0 INDI.FAMC link carries <<NOTE_STRUCTURE>> {0:M} (GEDCOM
  // 7.0 §3.2.2); accepted in any file. A PHRASE
  // directly under FAMC is not legal in any version (the PEDI/STAT
  // children carry their own PHRASE {0:1}) and is discarded.
  handlers['SNOTE'] = (child) => {
    (out.notes ??= []).push(parseNoteStructure(child, ctx));
  };
  // The the USM6 MTYP spelling is accepted in any file.
  handlers['MTYP'] = (child) => {
    // USM6: the kind of parent–child relationship (see
    // ChildFamilyLink.parentalRelationKind).
    out.parentalRelationKind = parseUsmCode(child, 'MTYP', USM_PARENTAL_RELATION_KINDS);
  };
  handlers['_MTYP'] = (child) => {
    // The underscore write-back spelling of the USM6 MTYP (both
    // spellings are recognized).
    out.parentalRelationKind = parseUsmCode(child, '_MTYP', USM_PARENTAL_RELATION_KINDS);
  };
  dispatch(node, out, handlers, ctx, ['PEDI', '_PEDI', 'STAT', '_PRIMARY', '_PREF', '_FREL', '_MREL', '_HUSB', '_WIFE', 'MTYP', '_MTYP']);
  return out;
}

/**
 * The SEX_VALUE set accepted on input: the 5.5.1 values M, F, U
 * (GEDCOM 5.5.1 §2 p.61) plus the GEDCOM 5.5.5 additions X (intersex)
 * and N (not recorded; the record did not record a sex, unlike U which
 * merely says it is not known yet — 5.5.5 §2 p.104). The 5.5.1
 * serializer drops X and N.
 */
export const SEX_551: Record<'M' | 'F' | 'U' | 'X' | 'N', string> = {
  M: 'male', F: 'female', U: 'undetermined', X: 'intersex', N: 'not recorded',
};

export function parsePedigree(node: RawNode, ctx: Ctx): PedigreeStructure {
  const raw = reqText(node);
  const upper = raw.toUpperCase();
  const known = (Object.keys(PEDIGREE_ENUM_VALUES) as string[]).some((key) => key.toUpperCase() === upper);
  const out: PedigreeStructure = {
    ...(known
      ? { payload: parseEnum(raw, PEDIGREE_ENUM_VALUES, node.position) }
      : // A descriptive value ("Adopted (father)") is kept as the
        // OTHER pedigree with the phrase (the full-leniency container
        // rule — nothing is dropped).
        { payload: 'OTHER' as PedigreeStructure['payload'], phrase: raw }),
  };
  dispatch(
    node,
    out,
    {
      PHRASE: (child) => {
        out.phrase = reqText(child);
      },
    },
    ctx,
  );
  return out;
}

export function parseFamilyChildStatus(node: RawNode, ctx: Ctx): FamilyChildStatusStructure {
  const out: FamilyChildStatusStructure = {
    payload: parseEnum(reqText(node), FAMILY_CHILD_STATUS_ENUM_VALUES, node.position),
  };
  dispatch(
    node,
    out,
    {
      PHRASE: (child) => {
        out.phrase = reqText(child);
      },
    },
    ctx,
  );
  return out;
}

export function parseSpouseFamilyLink(node: RawNode, ctx: Ctx): SpouseFamilyLink {
  const out: SpouseFamilyLink = { family: reqPtr(node, ctx) };
  const handlers: Record<string, (child: RawNode) => void> = {
    NOTE: (child) => {
      (out.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    DATE: (child) => {
      // The date of the family link itself (files in the wild write
      // `2 DATE` under FAMS — see SpouseFamilyLink.date).
      out.date = parseDateStructure(child, ctx);
    },
    '_PREF': (child) => {
      out.preferred = parseYNFlag(child, '_PREF');
    },
    // The 7.0 INDI.FAMS link carries <<NOTE_STRUCTURE>> {0:M} (GEDCOM
    // 7.0 §3.2.2); accepted in any file. A PHRASE
    // under FAMS is not legal in any version and is discarded.
    SNOTE: (child) => {
      (out.notes ??= []).push(parseNoteStructure(child, ctx));
    },
  };
  dispatch(node, out, handlers, ctx);
  return out;
}

export function parseAliasLink(node: RawNode, ctx: Ctx): AliasLink {
  const out: AliasLink = { individual: reqPtr(node, ctx) };
  dispatch(
    node,
    out,
    {
      PHRASE: (child) => {
        out.phrase = reqText(child);
      },
    },
    ctx,
  );
  return out;
}

export function parseFamilyPartnerEventDetail(node: RawNode, ctx: Ctx): FamilyPartnerEventDetail {
  noPayload(node);
  const out: Omit<FamilyPartnerEventDetail, 'age'> = {};
  let age: AgeStructure | undefined;
  dispatch(
    node,
    out,
    {
      AGE: (child) => {
        age = parseAgeStructure(child, ctx);
      },
    },
    ctx,
  );
  if (age === undefined) {
    fail('structure.missing-required', `The ${node.tag} structure requires an AGE substructure`, node.position);
  }
  return { ...out, age };
}

/**
 * Parses the AGES! `_WTN` witness pointer under a birth event: an
 * ASSO link whose ROLE is WITN, with the optional TYPE descriptor kept
 * in the ROLE PHRASE (see EventDetail.associations).
 */
function parseBirthWitness(node: RawNode, ctx: Ctx): AssociationStructure {
  const out: AssociationStructure = { tag: 'ASSO', individual: reqPtr(node, ctx) };
  let phrase: string | undefined;
  dispatch(
    node,
    out,
    {
      TYPE: (child) => {
        phrase = reqText(child);
      },
    },
    ctx,
    ['TYPE'],
  );
  out.role = phrase === undefined ? { payload: 'WITN' } : { payload: 'WITN', phrase };
  return out;
}

/** The event-detail handlers (DATE/PLAC/…), mutating the given detail. */
export function eventDetailHandlers(ctx: Ctx, detail: EventDetail): Record<string, (child: RawNode) => void> {
  const handlers: Record<string, (child: RawNode) => void> = {
    DATE: (child) => {
      detail.date = parseDateStructure(child, ctx);
    },
    TIME: (child) => {
      // Pro-Gen writes the event time beside DATE (the standard slot
      // is DATE.TIME): when the DATE has already parsed, the time
      // attaches to it. A TIME without a parsed DATE — or one the
      // time grammar rejects (`2:00pm`) — stays a generic extension
      // of the detail (nothing is dropped).
      if (detail.date !== undefined && detail.date.time === undefined) {
        try {
          detail.date.time = parseTime551(reqText(child), child.position);
          return;
        } catch (error) {
          const code = (error as { code?: string }).code;
          if (code === 'time.invalid') {
            addExtension(detail, child, ctx);
            return;
          }
          throw error;
        }
      }
      addExtension(detail, child, ctx);
    },
    '_PRIM': (child) => {
      // Legacy: the primary event mark — the `_PRIM` spelling of the
      // `_PRI` slot (see EventDetail.primary).
      detail.primary = parseYNFlag(child, '_PRIM');
    },
    '_DATE2': (child) => {
      // The vendor end date ("bis-Datum"); same value grammar as DATE.
      detail.endDate = parseDateStructure(child, ctx);
    },
    PLAC: (child) => {
      detail.place = parsePlaceStructure(child, ctx);
    },
    '_GODP': (child) => {
      (detail.godparents ??= []).push(reqText(child));
    },
    '_WITN': (child) => {
      (detail.witnesses ??= []).push(reqText(child));
    },
    ADDR: (child) => {
      detail.address = parseAddressStructure(child, ctx);
    },
    AGNC: (child) => {
      detail.agency = reqText(child);
    },
    RELI: (child) => {
      detail.religiousAffiliation = reqText(child);
    },
    CAUS: (child) => {
      detail.cause = reqText(child);
    },
    QUAY: (child) => {
      // The event's own reliability assessment (see
      // EventDetail.quality).
      detail.quality = parseEnum(reqText(child), QUALITY_ENUM_VALUES, child.position);
    },
    CHAN: (child) => {
      // The change date attached to the event (see
      // EventDetail.changeDate).
      detail.changeDate = parseChangeDate(child, ctx);
    },
    CREA: (child) => {
      // The creation date attached to the event (see
      // EventDetail.creationDate); an undecodable form stays a
      // generic extension (nothing is dropped).
      const created = parseCreationDateLenient(child, ctx);
      if (created === undefined) {
        addExtension(detail, child, ctx);
      } else {
        detail.creationDate = created;
      }
    },
    '_FNA': (child) => {
      // Heredis: the event flag (see EventDetail.fna).
      detail.fna = parseYNFlag(child, '_FNA');
    },
    '_COR': (child) => {
      // MFT7: the event's coordinates (see EventDetail.map).
      detail.map = parseMftCoordinates(child, ctx, detail);
    },
    '_DESCRIPTION': (child) => {
      // MyHeritage: the event's description-aware flag (see
      // EventDetail.descriptionAware).
      detail.descriptionAware = parseYNFlag(child, '_DESCRIPTION');
    },
    MAP: (child) => {
      // The standard spelling of the event's coordinates (see
      // EventDetail.map); recognized in any file.
      detail.map = parseMapCoordinates(child, ctx);
    },
    '_SENT': (child) => {
      // RootsMagic: the event sentence (report wording).
      detail.sentence = reqText(child);
    },
    '_OVER': (child) => {
      // Legacy Family Tree: the event sentence override — the same slot
      // RootsMagic spells _SENT (see EventDetail.sentence).
      detail.sentence = reqText(child);
    },
    '_PPFX': (child) => {
      // RootsMagic: the place prefix (report wording).
      detail.placePrefix = reqText(child);
    },
    '_PRI': (child) => {
      // AGES!: the primary event flag (see EventDetail.primary).
      detail.primary = parsePrivacyFlag(child, '_PRI');
    },
    '_EVN': (child) => {
      // BKW6+: the event number, referenced by witness ASSO links (see
      // EventDetail.eventNumber).
      detail.eventNumber = reqText(child);
    },
    RESN: (child) => {
      detail.restriction = parseListEnum(reqText(child), RESTRICTION_ENUM_VALUES, child.position).filter((value) => value.toUpperCase() !== 'NONE');
    },
    NOTE: (child) => {
      (detail.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    SOUR: (child) => {
      (detail.citations ??= []).push(parseSourceCitation(child, ctx));
    },
    OBJE: (child) => {
      (detail.media ??= []).push(parseMultimediaLink(child, ctx));
    },
    '_WT_OBJE_SORT': (child) => {
      (detail.media ??= []).push(parseMultimediaLink(child, ctx));
    },
    RIN: (child) => {
      // Ancestry.com Family Trees: the record-level RIN repeated under
      // the event (see EventDetail.automatedRecordId).
      detail.automatedRecordId = reqText(child);
    },
  };
  handlers['_SDATE'] = (child) => {
    detail.sortDate = parseSortDate551(child, ctx);
  };
  handlers['_SHAR'] = (child) => {
    (detail.associations ??= []).push(parseSharedParticipant(child, ctx));
  };
  handlers['_ASSO'] = (child) => {
    // The German GEDCOM-L agreement A3: an event participant as a
    // pointer, like _SHAR (Taufpate, Arbeitgeber, Trauzeuge, ...).
    (detail.associations ??= []).push(parseAssociation(child, ctx));
  };
  handlers['_UID'] = (child) => {
    (detail.uniqueIds ??= []).push(reqText(child));
  };
  handlers['_PLAC'] = (child) => {
    (detail.additionalPlaces ??= []).push(parsePlaceStructure(child, ctx));
  };
  handlers['_PRIV'] = (child) => {
    if (parsePrivacyFlag(child, '_PRIV')) {
      const restriction = (detail.restriction ??= []);
      if (!restriction.includes('PRIVACY')) {
        restriction.push('PRIVACY');
      }
    }
  };
  handlers['_CENR'] = (child) => {
    // The MagiKey census link (registry: MagiKey_CENR.yaml): a pointer
    // to the shared census record, used under events and attributes
    // like SOUR points to a source record. The pointer must resolve.
    (detail.censusLinks ??= []).push(reqPtr(child, ctx));
  };
  handlers['_APID'] = (child) => {
    // The Ancestry record reference attached to events and attributes
    // (see EventDetail.ancestryPointers).
    (detail.ancestryPointers ??= []).push(reqText(child));
  };
  handlers['_SHAN'] = (child) => {
    // FH: a fact witness given by name only (see EventDetail.witnesses).
    (detail.witnesses ??= []).push(reqText(child));
  };
  handlers['_WTN'] = (child) => {
    // AGES!: the person present at birth — a pointer, optionally with
    // a TYPE descriptor (the GenWiki "GEDCOM/_Nutzerdef-Tag" table:
    // https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag). Typed as a
    // witness association: the descriptor becomes the ROLE PHRASE.
    (detail.associations ??= []).push(parseBirthWitness(child, ctx));
  };
  handlers['_EMAIL'] = (child) => {
    // FH (up to V6.2): the fact e-mail — the vendor spelling of the
    // standard EMAIL slot (see EventDetail.email).
    (detail.email ??= []).push(reqText(child));
  };
  handlers['_WEB'] = (child) => {
    // FH (up to V6.2): the fact web address — the vendor spelling of
    // the standard WWW slot (see EventDetail.www).
    (detail.www ??= []).push(reqText(child));
  };
  handlers['_FLGS'] = (child) => {
    // FH: the fact flags of this event or attribute (see
    // EventDetail.factFlags): each child is a `__` tag spelling one of
    // the four documented flags; an unrecognized child stays a generic
    // extension of the detail, preserved verbatim.
    noPayload(child);
    for (const flag of child.children) {
      if (FH_FACT_FLAGS.has(flag.tag) && flag.children.length === 0) {
        (detail.factFlags ??= []).push(flag.tag.slice(2) as FactFlag);
      } else {
        addExtension(detail, flag, ctx);
      }
    }
  };
  handlers['_CREA'] = (child) => {
    // Heredis: the date the event was created (see
    // EventDetail.createdAt).
    detail.createdAt = reqText(child);
  };
  handlers['_CRE'] = (child) => {
    // MFT7: the date the event was created ("Datensatz, Ereignis";
    // same slot and source as `_CREA`).
    detail.createdAt = reqText(child);
  };
  handlers['_CREAT'] = (child) => {
    // GenPlus: the date the event was created (same slot as `_CREA`).
    detail.createdAt = reqText(child);
  };
  // The the phpGedView CEME spelling and the
  // non-underscore RootsMagic SENT/PPFX spellings are accepted in any
  // file, as are the USM6 POTM/SRCH/NOTRY spellings.
  handlers['CEME'] = (child) => {
    // phpGedView: the cemetery of the burial (see
    // EventDetail.cemetery).
    detail.cemetery = reqText(child);
  };
  handlers['_CEME'] = (child) => {
    // The underscore write-back spelling of the phpGedView CEME (the
    // wire spelling is non-underscore; both are recognized).
    detail.cemetery = reqText(child);
  };
  handlers['SENT'] = (child) => {
    // The non-underscore RootsMagic spelling of the sentence.
    detail.sentence = reqText(child);
  };
  handlers['PPFX'] = (child) => {
    // The non-underscore RootsMagic spelling of the place prefix.
    detail.placePrefix = reqText(child);
  };
  handlers['PHON'] = (child) => {
    (detail.phone ??= []).push(reqText(child));
  };
  handlers['EMAIL'] = (child) => {
    (detail.email ??= []).push(reqText(child));
  };
  handlers['FAX'] = (child) => {
    (detail.fax ??= []).push(reqText(child));
  };
  handlers['WWW'] = (child) => {
    (detail.www ??= []).push(reqText(child));
  };
  handlers['POTM'] = (child) => {
    // USM6: the event occurred post mortem (see
    // EventDetail.posthumous).
    detail.posthumous = parseUsmFlag(child, 'POTM');
  };
  handlers['_POTM'] = (child) => {
    // The underscore write-back spelling of the USM6 POTM (both
    // spellings are recognized).
    detail.posthumous = parseUsmFlag(child, '_POTM');
  };
  handlers['SRCH'] = (child) => {
    // USM6: where to research the event further (see
    // EventDetail.furtherResearch).
    detail.furtherResearch = reqText(child);
  };
  handlers['_SRCH'] = (child) => {
    // The underscore write-back spelling of the USM6 SRCH.
    detail.furtherResearch = reqText(child);
  };
  handlers['NOTRY'] = (child) => {
    // USM6: the notary who recorded the event (see
    // EventDetail.notary).
    detail.notary = reqText(child);
  };
  handlers['_NOTRY'] = (child) => {
    // The underscore write-back spelling of the USM6 NOTRY.
    detail.notary = reqText(child);
  };
  handlers['SNOTE'] = (child) => {
    // The 7.0 EVENT_DETAIL carries <<NOTE_STRUCTURE>> {0:M} (GEDCOM
    // 7.0 §3.2.3); accepted in any file.
    (detail.notes ??= []).push(parseNoteStructure(child, ctx));
  };
  handlers['SDATE'] = (child) => {
    detail.sortDate = parseSortDateStructure(child, ctx);
  };
  handlers['UID'] = (child) => {
    (detail.uniqueIds ??= []).push(reqText(child));
  };
  handlers['ASSO'] = (child) => {
    // The 7.0 ASSO and the Gramps witness convention parse with the
    // same handlers (see parseAssociation).
    (detail.associations ??= []).push(parseAssociation(child, ctx));
  };
  return handlers;
}

/**
 * Canonicalizes the detail-level contacts: the contact substructures
 * PHON/EMAIL/FAX/WWW belong to the ADDRESS_STRUCTURE (siblings of
 * ADDR, GEDCOM 5.5.1 §2 p.31), so contacts parsed beside an ADDR are
 * relocated into the address block in every file. Called after the
 * detail of an event, attribute or census-relocated structure has
 * finished parsing.
 */
export function merge551DetailContacts(detail: EventDetail): void {
  const address = detail.address;
  if (address === undefined) {
    return;
  }
  if (detail.phone !== undefined) {
    address.phone = [...(address.phone ?? []), ...detail.phone];
    delete detail.phone;
  }
  if (detail.email !== undefined) {
    address.email = [...(address.email ?? []), ...detail.email];
    delete detail.email;
  }
  if (detail.fax !== undefined) {
    address.fax = [...(address.fax ?? []), ...detail.fax];
    delete detail.fax;
  }
  if (detail.www !== undefined) {
    address.www = [...(address.www ?? []), ...detail.www];
    delete detail.www;
  }
}

export interface EventShape extends GedcomStructureBase {
  tag: string;
  payload?: true | string | number;
  type?: string;
  detail?: FamilyEventDetail | IndividualEventDetail | LdsOrdinanceDetail;
  familyChild?: string;
  adoptionFamily?: AdoptionFamilyLink;
  /**
   * The vendor fields below belong to one concrete event/attribute
   * structure of the target union (see their JSDoc); the builders fill
   * them while the record parses, and the return casts assert that the
   * tag maps onto the matching union member.
   */
  /** Legacy: the marriage report labels (see MarriageEvent.husbandLabel). */
  husbandLabel?: string;
  /** Legacy: the marriage report labels (see MarriageEvent.wifeLabel). */
  wifeLabel?: string;
  /** Legacy: the marriage report phrases (see MarriageEvent.reportPhrases). */
  reportPhrases?: string[];
  /** Legacy: the preferred event mark (see FamilyEventBase.preferred). */
  preferred?: boolean;
  /** USM6: the birth type (see BirthEvent.birthType). */
  birthType?: UsmBirthType;
  /** USM6: the child-count certainty (see
   *  IndividualChildCountAttribute.childCountCertain). */
  childCountCertain?: boolean;
  /** Ahnenblatt: the primary occupation flag (see OccupationAttribute.primary). */
  primary?: boolean;
}

/** Assigns the optional `Y` flag, leaving the field unset when absent. */
export function setY(event: EventShape, node: RawNode): void {
  const y = yFlag(node);
  if (y !== undefined) {
    event.payload = y;
  }
}

/** Sets the n-th Legacy marriage report phrase slot, padding the gaps
 *  (see MarriageEvent.reportPhrases). */
function setReportPhrase(event: { reportPhrases?: string[] }, index: number, text: string): void {
  const phrases = (event.reportPhrases ??= []);
  while (phrases.length <= index) {
    phrases.push('');
  }
  phrases[index] = text;
}

export function parseFamilyEvent(node: RawNode, ctx: Ctx, tag: string): FamilyEventStructure {
  const detail: EventDetail = {};
  const familyDetail: FamilyEventDetail = {};
  const event: EventShape = { tag };
  const handlers = eventDetailHandlers(ctx, detail);
  handlers["TYPE"] = (child) => {
    event.type = parseEventType(child, ctx);
  };
  handlers["HUSB"] = (child) => {
    familyDetail.husband = parseFamilyPartnerEventDetail(child, ctx);
  };
  handlers["WIFE"] = (child) => {
    familyDetail.wife = parseFamilyPartnerEventDetail(child, ctx);
  };
  handlers['_PREF'] = (child) => {
    // Legacy: the preferred event of its kind (see
    // FamilyEventBase.preferred).
    event.preferred = parseYNFlag(child, '_PREF');
  };
  if (tag === 'MARR') {
    // The Legacy report labels and phrases of the marriage (see the
    // fields of MarriageEvent).
    handlers['_HTITL'] = (child) => {
      event.husbandLabel = reqText(child);
    };
    handlers['_WTITL'] = (child) => {
      event.wifeLabel = reqText(child);
    };
    handlers['_RPT_PHRS'] = (child) => {
      setReportPhrase(event, 0, reqText(child));
    };
    handlers['_RPT_PHRS2'] = (child) => {
      setReportPhrase(event, 1, reqText(child));
    };
  }

  if (tag === 'EVEN') {
    const raw = node.value.kind === 'text' ? node.value.text : undefined;
    event.payload = raw ?? '';
    // The TYPE is optional (the 5.5.1 rule; 7.0
    // requires it) and the bare TYPE line the empty type.
    const typeNode = one(node, 'TYPE');
    event.type = typeNode === undefined ? '' : parseEventType(typeNode, ctx);
  } else {
    // The Y assertion is accepted on every family event
    // (the 7.0 rule; 5.5.1 restricts it to MARR) and the bare form
    // everywhere.
    setY(event, node);
  }

  dispatch(node, event, handlers, ctx);
  merge551DetailContacts(detail);
  if (Object.keys(detail).length > 0) {
    familyDetail.detail = detail;
  }
  if (familyDetail.husband !== undefined || familyDetail.wife !== undefined || familyDetail.detail !== undefined) {
    event.detail = familyDetail;
  }
  // The tag selects the union member (see EventShape).
  return event as unknown as FamilyEventStructure;
}

export function parseFamilyChildCount(node: RawNode, ctx: Ctx): FamilyChildCountAttribute {
  const out: FamilyChildCountAttribute = { tag: 'NCHI', payload: reqDigits(node) };
  // Both grammars parse: the 7.0 TYPE + FAMILY_EVENT_DETAIL and the
  // 5.5.1 bare count with the USM6 SURE child.
  const detail: EventDetail = {};
  const familyDetail: FamilyEventDetail = {};
  const handlers = eventDetailHandlers(ctx, detail);
  handlers['TYPE'] = (child) => {
    out.type = parseEventType(child, ctx);
  };
  handlers['HUSB'] = (child) => {
    familyDetail.husband = parseFamilyPartnerEventDetail(child, ctx);
  };
  handlers['WIFE'] = (child) => {
    familyDetail.wife = parseFamilyPartnerEventDetail(child, ctx);
  };
  handlers['SURE'] = (child) => {
    // USM6: the given child count is certain (see
    // FamilyChildCountAttribute.childCountCertain), in both the USM6
    // wire spelling and the underscore write-back spelling.
    out.childCountCertain = parseSureFlag(child);
  };
  handlers['_SURE'] = (child) => {
    out.childCountCertain = parseSureFlag(child);
  };
  dispatch(node, out, handlers, ctx, ['TYPE', 'HUSB', 'WIFE', 'SURE', '_SURE']);
  merge551DetailContacts(detail);
  if (Object.keys(detail).length > 0) {
    familyDetail.detail = detail;
  }
  if (familyDetail.husband !== undefined || familyDetail.wife !== undefined || familyDetail.detail !== undefined) {
    out.detail = familyDetail;
  }
  return out;
}

export function parseFamilyResidence(node: RawNode, ctx: Ctx): FamilyResidenceAttribute {
  const detail: EventDetail = {};
  const familyDetail: FamilyEventDetail = {};
  const out: FamilyResidenceAttribute = {
    tag: 'RESI',
    // The payload is optional: the 7.0 Text payload may be empty (a
    // missing payload is equivalent to the empty string, GEDCOM 7.0
    // §1.2), and the GEDCOM-L addendum gives the 5.5.1 form an
    // optional <RESIDENCE_DESCRIPTOR> line value ("GEDCOM 5.5.1
    // Specification GEDCOM-L Addendum", §5.9) — both keep the text in
    // the same slot.
    ...(node.value.kind === 'absent' ? {} : { payload: reqText(node) }),
  };
  const handlers = eventDetailHandlers(ctx, detail);
  handlers["TYPE"] = (child) => {
    out.type = parseEventType(child, ctx);
  };
  handlers["HUSB"] = (child) => {
    // The FAMILY_EVENT_DETAIL under FAM.RESI: the husband's age.
    familyDetail.husband = parseFamilyPartnerEventDetail(child, ctx);
  };
  handlers["WIFE"] = (child) => {
    familyDetail.wife = parseFamilyPartnerEventDetail(child, ctx);
  };
  dispatch(node, out, handlers, ctx, ['TYPE', 'HUSB', 'WIFE']);
  merge551DetailContacts(detail);
  if (Object.keys(detail).length > 0) {
    familyDetail.detail = detail;
  }
  if (familyDetail.husband !== undefined || familyDetail.wife !== undefined || familyDetail.detail !== undefined) {
    out.detail = familyDetail;
  }
  return out;
}

export function parseFamilyFact(node: RawNode, ctx: Ctx): FamilyGenericAttribute {
  const detail: EventDetail = {};
  const familyDetail: FamilyEventDetail = {};
  const out: FamilyGenericAttribute = { tag: 'FACT', payload: reqText(node), type: parseEventType(req(node, 'TYPE'), ctx) };
  const handlers = eventDetailHandlers(ctx, detail);
  handlers["TYPE"] = () => undefined;
  handlers["HUSB"] = (child) => {
    // The 7.0 FAMILY_EVENT_DETAIL under FAM.FACT: the husband's age.
    familyDetail.husband = parseFamilyPartnerEventDetail(child, ctx);
  };
  handlers["WIFE"] = (child) => {
    familyDetail.wife = parseFamilyPartnerEventDetail(child, ctx);
  };
  dispatch(node, out, handlers, ctx, ['HUSB', 'WIFE']);
  if (Object.keys(detail).length > 0) {
    familyDetail.detail = detail;
  }
  if (familyDetail.husband !== undefined || familyDetail.wife !== undefined || familyDetail.detail !== undefined) {
    out.detail = familyDetail;
  }
  return out;
}

export function parseIndividualEvent(node: RawNode, ctx: Ctx, tag: string): IndividualEventStructure {
  const detail: IndividualEventDetail = {};
  const event: EventShape = { tag };
  let aldfaerNode: RawNode | undefined;
  let aldfaerTime: TimeValue | undefined;
  const handlers = eventDetailHandlers(ctx, detail);
  handlers["TYPE"] = (child) => {
    event.type = parseEventType(child, ctx);
  };
  handlers["AGE"] = (child) => {
    detail.age = parseAgeStructure(child, ctx);
  };
  handlers["FAMC"] = (child) => {
    if (tag === 'ADOP') {
      event.adoptionFamily = parseAdoptionFamilyLink(child, ctx);
    } else if (tag === 'BIRT' || tag === 'CHR') {
      event.familyChild = reqPtr(child, ctx);
      for (const grandchild of child.children) {
        // Full leniency: unexpected children stay generic extensions.
        addExtension(event, grandchild, ctx);
      }
    } else {
      // Full leniency: a FAMC in any other event stays a generic
      // extension instead of failing.
      addExtension(event, child, ctx);
    }
  };
  if (tag === 'BIRT') {
    handlers['BTYP'] = (child) => {
      // USM6: the birth type (see BirthEvent.birthType); the USM6
      // spelling is accepted in any file.
      event.birthType = parseUsmCode(child, 'BTYP', USM_BIRTH_TYPES);
    };
    handlers['_BTYP'] = (child) => {
      // The underscore write-back spelling of the USM6 BTYP (the USM6
      // wire spelling is non-underscore; both are recognized).
      event.birthType = parseUsmCode(child, '_BTYP', USM_BIRTH_TYPES);
    };
  } else if (tag === 'BURI') {
    handlers['AGED'] = (child) => {
      // USM6: the age at death, written under the burial. Normalized
      // into the standard AGE of the burial detail (the same slot the
      // standard grammar provides); the write-back uses `AGE`. The
      // wire value is a plain number of years (`AGED 80`); the full
      // AGE grammar is tolerated too.
      if (detail.age !== undefined) {
        // First occurrence wins.
        return;
      }
      const raw = reqText(child);
      const payload = /^\d+$/.test(raw) ? { years: Number(raw) } : parseAge551(raw, child.position);
      detail.age = { payload };
    };
  }
  if (tag === 'BIRT') {
    handlers['_LENGTH'] = (child) => {
      // Aldfaer: the length at birth (see EventDetail.birthLength).
      detail.birthLength = reqText(child);
    };
    handlers['_WEIGHT'] = (child) => {
      // Aldfaer: the weight at birth (see EventDetail.birthWeight).
      detail.birthWeight = reqText(child);
    };
  }
  if (tag === 'BIRT' || tag === 'DEAT') {
    handlers['_ALDFAER_TIME'] = (child) => {
      // Aldfaer: the time of birth/death, written directly under the
      // event (beside DATE). Attached to the date's TIME slot after
      // the dispatch when a DATE exists; without a DATE the line stays
      // a generic extension of the detail (preserved verbatim — there
      // is no time-only slot).
      aldfaerNode = child;
      aldfaerTime = parseTime551(reqText(child), child.position);
    };
  }

  if (tag === 'EVEN') {
    const raw = node.value.kind === 'text' ? node.value.text : undefined;
    event.payload = raw ?? '';
    // The TYPE is optional (the 5.5.1 rule; 7.0
    // requires it) and the bare TYPE line the empty type.
    const typeNode = one(node, 'TYPE');
    event.type = typeNode === undefined ? '' : parseEventType(typeNode, ctx);
  } else {
    // The Y assertion is accepted on every individual
    // event (the 7.0 rule; 5.5.1 restricts it to ADOP/BIRT/CHR/DEAT)
    // and the bare form everywhere.
    setY(event, node);
  }

  dispatch(node, event, handlers, ctx, ['BTYP', '_BTYP', 'AGED']);
  merge551DetailContacts(detail);
  if (aldfaerNode !== undefined && aldfaerTime !== undefined) {
    // The Aldfaer time under BIRT/DEAT (see the handler above): attach
    // it to the date's TIME slot when a DATE exists; otherwise the
    // line stays a generic extension of the detail.
    if (detail.date !== undefined && detail.date.time === undefined) {
      detail.date.time = aldfaerTime;
    } else {
      addExtension(detail, aldfaerNode, ctx);
    }
  }
  if (Object.keys(detail).length > 0) {
    event.detail = detail;
  }
  // The tag selects the union member (see EventShape).
  return event as unknown as IndividualEventStructure;
}

export function parseAdoptionFamilyLink(node: RawNode, ctx: Ctx): AdoptionFamilyLink {
  const out: AdoptionFamilyLink = { family: reqPtr(node, ctx) };
  dispatch(
    node,
    out,
    {
      ADOP: (child) => {
        out.adoption = parseAdoptionStructure(child, ctx);
      },
    },
    ctx,
  );
  return out;
}

export function parseAdoptionStructure(node: RawNode, ctx: Ctx): AdoptionStructure {
  const out: AdoptionStructure = { payload: parseEnum(reqText(node), ADOPTION_ENUM_VALUES, node.position) };
  dispatch(
    node,
    out,
    {
      PHRASE: (child) => {
        out.phrase = reqText(child);
      },
    },
    ctx,
  );
  return out;
}

export function parseIndividualAttribute(node: RawNode, ctx: Ctx, tag: string): IndividualAttributeStructure {
  const detail: IndividualEventDetail = {};
  const event: EventShape = { tag };
  if (tag === 'NCHI' || tag === 'NMR') {
    event.payload = reqDigits(node);
  } else if (tag === 'RESI' && node.value.kind === 'absent') {
    // The 5.5.1 grammar (GEDCOM 5.5.1 §2 p.33) gives INDI.RESI no
    // payload: the residence is carried by the detail's ADDR/PLAC. In
    // 7.0 the Text payload may be empty and a missing payload is
    // equivalent to the empty string (GEDCOM 7.0 §1.2).
  } else if (tag === 'FACT' && node.value.kind === 'absent' && node.children.some((child) => child.tag === 'TYPE')) {
    // A payload-less FACT with a TYPE child: the import form the
    // GEDCOM-L agreement PLAC P8 prescribes for the Swiss Bürgerort
    // (a bare `1 FACT` + `2 TYPE Bürgerort` + `2 PLAC …`; see the
    // GenWiki "GEDCOM/PLAC-Tag" article:
    // https://wiki.genealogy.net/GEDCOM/PLAC-Tag). The missing
    // payload is the empty string (GEDCOM 7.0 §1.2).
    event.payload = '';
  } else {
    event.payload = reqText(node);
  }
  const handlers = eventDetailHandlers(ctx, detail);
  handlers["TYPE"] = (child) => {
    event.type = parseEventType(child, ctx);
  };
  handlers["AGE"] = (child) => {
    detail.age = parseAgeStructure(child, ctx);
  };
  if (tag === 'NCHI') {
    handlers['SURE'] = (child) => {
      // USM6: the given child count is certain (see
      // IndividualChildCountAttribute.childCountCertain);
      // the USM6 spelling is accepted in any file.
      event.childCountCertain = parseSureFlag(child);
    };
    handlers['_SURE'] = (child) => {
      // The underscore write-back spelling of the USM6 SURE.
      event.childCountCertain = parseSureFlag(child);
    };
  }
  if (tag === 'OCCU') {
    handlers['_PRIM'] = (child) => {
      // Ahnenblatt: the primary occupation flag (see
      // OccupationAttribute.primary).
      event.primary = parseVendorFlag(child, '_PRIM');
    };
  }
  // The TYPE is optional on the generic IDNO and
  // FACT attributes (the 5.5.1 grammar letter omits TYPE from the
  // syntax, a known spec inconsistency: the 5.5.1 text says the same
  // thing about the TYPE as 7.0 §3.3.2.1 while the syntax does not
  // contain it; GEDCOM 5.5.5 restores the TYPE to the syntax).
  dispatch(node, event, handlers, ctx, ['SURE', '_SURE', '_PRIM']);
  merge551DetailContacts(detail);
  if (Object.keys(detail).length > 0) {
    event.detail = detail;
  }
  // The tag selects the union member (see EventShape).
  return event as unknown as IndividualAttributeStructure;
}

export function parseIndividualOrdinance(node: RawNode, ctx: Ctx, tag: string): LdsIndividualOrdinance {
  const detail: LdsOrdinanceDetail = {};
  const event: EventShape = { tag };
  const handlers: Record<string, (child: RawNode) => void> = {
    DATE: (child) => {
      detail.date = parseDateStructure(child, ctx);
    },
    TEMP: (child) => {
      detail.temple = reqText(child);
    },
    PLAC: (child) => {
      detail.place = parsePlaceStructure(child, ctx);
    },
    STAT: (child) => {
      detail.status = parseOrdinanceStatus(child, ctx, tag);
    },
    NOTE: (child) => {
      (detail.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    SOUR: (child) => {
      (detail.citations ??= []).push(parseSourceCitation(child, ctx));
    },
    FAMC: (child) => {
      if (tag === 'SLGC') {
        event.familyChild = reqPtr(child, ctx);
      } else {
        // Full leniency: a FAMC under another ordinance stays a
        // generic extension.
        addExtension(event, child, ctx);
      }
    },
    // The 7.0 ordinance details carry <<NOTE_STRUCTURE>> {0:M} (GEDCOM
    // 7.0 §3.2.3); accepted in any file.
    SNOTE: (child) => {
      (detail.notes ??= []).push(parseNoteStructure(child, ctx));
    },
  };
  dispatch(node, event, handlers, ctx);
  if (Object.keys(detail).length > 0) {
    event.detail = detail;
  }
  // The tag selects the union member (see EventShape).
  return event as unknown as LdsIndividualOrdinance;
}

/** The 5.5.1 per-ordinance status value sets (canonical 7.0 spellings). */
export const LDS_STATUS_551: Record<string, Record<string, string>> = {
  BAPL: { CHILD: '', COMPLETED: '', EXCLUDED: '', 'PRE-1970': 'PRE_1970', STILLBORN: '', SUBMITTED: '', UNCLEARED: '' },
  CONL: { CHILD: '', COMPLETED: '', EXCLUDED: '', 'PRE-1970': 'PRE_1970', STILLBORN: '', SUBMITTED: '', UNCLEARED: '' },
  ENDL: { CHILD: '', COMPLETED: '', EXCLUDED: '', 'PRE-1970': 'PRE_1970', STILLBORN: '', SUBMITTED: '', UNCLEARED: '' },
  SLGC: { BIC: '', COMPLETED: '', EXCLUDED: '', DNS: '', 'PRE-1970': 'PRE_1970', STILLBORN: '', SUBMITTED: '', UNCLEARED: '' },
  SLGS: { CANCELED: '', COMPLETED: '', DNS: '', EXCLUDED: '', 'DNS/CAN': 'DNS_CAN', 'PRE-1970': 'PRE_1970', SUBMITTED: '', UNCLEARED: '' },
};

export function parseOrdinanceStatus(node: RawNode, ctx: Ctx, ordinance: string): OrdinanceStatusStructure {
  const raw = reqText(node);
  // The value grammar: the 7.0 enumset first (case-insensitive,
  // extension values accepted), then the 5.5.1 per-ordinance spellings
  // (canonical 7.0 spellings returned; a 5.5.1-only value like
  // CANCELED is kept verbatim). Both are accepted in any file.
  let payload: OrdinanceStatusEnum;
  const known = Object.keys(ORDINANCE_STATUS_ENUM_VALUES).find(
    (value) => value.toLowerCase() === raw.toLowerCase(),
  );
  if (known !== undefined || raw.startsWith('_')) {
    payload = parseEnum(raw, ORDINANCE_STATUS_ENUM_VALUES, node.position);
  } else {
    const table = LDS_STATUS_551[ordinance];
    if (table === undefined) {
      fail('structure.unknown-tag', `Unknown ordinance ${ordinance}`, node.position);
    }
    const upper = raw.toUpperCase();
    const canonical = table[upper];
    if (canonical === undefined) {
      fail('enum.invalid-value', `"${raw}" is not a permitted status for ${ordinance}`, node.position);
    }
    payload = (canonical === '' ? upper : canonical) as OrdinanceStatusEnum;
  }
  let date: DateExactStructure | undefined;
  const out: Omit<OrdinanceStatusStructure, 'date'> = { payload };
  dispatch(
    node,
    out,
    {
      DATE: (child) => {
        date = parseDateExactStructure(child, ctx);
      },
    },
    ctx,
  );
  if (date === undefined) {
    // A STAT without DATE is tolerated (the full-leniency container
    // rule).
  }
  return { ...out, ...(date === undefined ? {} : { date }) };
}

export function parseSpouseSealing(node: RawNode, ctx: Ctx): SpouseSealingOrdinance {
  noPayload(node);
  const detail: LdsOrdinanceDetail = {};
  const out: SpouseSealingOrdinance = { tag: 'SLGS' };
  const handlers: Record<string, (child: RawNode) => void> = {
    DATE: (child) => {
      detail.date = parseDateStructure(child, ctx);
    },
    TEMP: (child) => {
      detail.temple = reqText(child);
    },
    PLAC: (child) => {
      detail.place = parsePlaceStructure(child, ctx);
    },
    STAT: (child) => {
      detail.status = parseOrdinanceStatus(child, ctx, 'SLGS');
    },
    NOTE: (child) => {
      (detail.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    SOUR: (child) => {
      (detail.citations ??= []).push(parseSourceCitation(child, ctx));
    },
    // The 7.0 LDS_SPOUSE_SEALING carries <<NOTE_STRUCTURE>> {0:M}
    // (GEDCOM 7.0 §3.2.3); accepted in any file.
    SNOTE: (child) => {
      (detail.notes ??= []).push(parseNoteStructure(child, ctx));
    },
  };
  dispatch(node, out, handlers, ctx);
  if (Object.keys(detail).length > 0) {
    out.detail = detail;
  }
  return out;
}

/** Parses the LDS child sealing under a FAM record (see
 *  ChildSealingOrdinance) — the same ordinance-detail grammar the
 *  spouse sealing carries, spelled SLGC. */
export function parseChildSealing(node: RawNode, ctx: Ctx): ChildSealingOrdinance {
  const sealing = parseSpouseSealing(node, ctx);
  return { tag: 'SLGC', ...(sealing.detail === undefined ? {} : { detail: sealing.detail }) };
}
