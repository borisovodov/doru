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
  ChildFamilyLink,
  DateExactStructure,
  EventDetail,
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
  SpouseFamilyLink,
  SpouseSealingOrdinance,
} from '../structures';
import type {
  Ctx,
} from './context';
import {
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
  parsePlaceStructure,
} from './names-places';
import {
  parseSourceJurisdictionPlace,
} from './sources';
import {
  parseMultimediaLink,
  parsePrivacyFlag,
  parseSourceCitation,
  parseYNFlag,
} from './sources-media';
import {
  parseAddressStructure,
  parseAge,
  parseAssociation,
  parseDateExactStructure,
  parseDateStructure,
  parseGrampsAssociation,
  parseNoteStructure,
  parseSharedParticipant,
  parseSortDate551,
  parseSortDateStructure,
} from './substructures';
import {
  parseEnum,
  parseListEnum,
} from './types';

// Family/individual links, events, attributes, ordinances
// ---------------------------------------------------------------------------

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
    },
    ctx,
    ['PHRASE', '_PREF'],
  );
  return out;
}

export function parseFamilyChildLink(node: RawNode, ctx: Ctx): FamilyChildLink {
  const out: FamilyChildLink = { child: reqPtr(node, ctx) };
  const handlers: Record<string, (child: RawNode) => void> = {
    PHRASE: (child) => {
      out.phrase = reqText(child);
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
    NOTE: (child) => {
      (out.notes ??= []).push(parseNoteStructure(child, ctx));
    },
  };
  if (ctx.version === '7.0') {
    // The 7.0 INDI.FAMC link carries <<NOTE_STRUCTURE>> {0:M} (GEDCOM
    // 7.0 §3.2.2); 5.5.1 stays strict.
    handlers['SNOTE'] = (child) => {
      (out.notes ??= []).push(parseNoteStructure(child, ctx));
    };
  }
  dispatch(node, out, handlers, ctx, ['PEDI', 'STAT', '_PRIMARY', '_PREF', '_FREL', '_MREL']);
  return out;
}

/**
 * The SEX_VALUE set accepted in any 5.x file: the 5.5.1 values M, F, U
 * (GEDCOM 5.5.1 §2 p.61) plus the GEDCOM 5.5.5 additions X (intersex)
 * and N (not recorded; the record did not record a sex, unlike U which
 * merely says it is not known yet — 5.5.5 §2 p.104). The 5.5.1
 * serializer drops X and N.
 */
export const SEX_551: Record<'M' | 'F' | 'U' | 'X' | 'N', string> = {
  M: 'male', F: 'female', U: 'undetermined', X: 'intersex', N: 'not recorded',
};

/** The 5.5.1 PEDIGREE_LINKAGE_TYPE set (no OTHER). */
export const PEDI_551: Record<'ADOPTED' | 'BIRTH' | 'FOSTER' | 'SEALING', string> = {
  ADOPTED: 'adopted', BIRTH: 'birth', FOSTER: 'foster', SEALING: 'sealing',
};

export function parsePedigree(node: RawNode, ctx: Ctx): PedigreeStructure {
  const table = (ctx.version === '7.0' ? PEDIGREE_ENUM_VALUES : PEDI_551) as Readonly<
    Record<'ADOPTED' | 'BIRTH' | 'FOSTER' | 'OTHER' | 'SEALING', string>
  >;
  const out: PedigreeStructure = { payload: parseEnum(reqText(node), table, ctx.version, node.position) };
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
    payload: parseEnum(reqText(node), FAMILY_CHILD_STATUS_ENUM_VALUES, ctx.version, node.position),
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
    '_PREF': (child) => {
      out.preferred = parseYNFlag(child, '_PREF');
    },
  };
  if (ctx.version === '7.0') {
    // The 7.0 INDI.FAMS link carries <<NOTE_STRUCTURE>> {0:M} (GEDCOM
    // 7.0 §3.2.2); 5.5.1 stays strict.
    handlers['SNOTE'] = (child) => {
      (out.notes ??= []).push(parseNoteStructure(child, ctx));
    };
  }
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
  let age: AgeStructure | undefined;
  dispatch(
    node,
    {},
    {
      AGE: (child) => {
        age = parseAge(child, ctx);
      },
    },
    ctx,
  );
  if (age === undefined) {
    fail('structure.missing-required', `The ${node.tag} structure requires an AGE substructure`, node.position);
  }
  return { age };
}

/** The event-detail handlers (DATE/PLAC/…), mutating the given detail. */
export function eventDetailHandlers(ctx: Ctx, detail: EventDetail): Record<string, (child: RawNode) => void> {
  const handlers: Record<string, (child: RawNode) => void> = {
    DATE: (child) => {
      detail.date = parseDateStructure(child, ctx);
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
    RESN: (child) => {
      detail.restriction = parseListEnum(reqText(child), RESTRICTION_ENUM_VALUES, ctx.version, child.position);
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
  };
  handlers['_SDATE'] = (child) => {
    detail.sortDate = parseSortDate551(child);
  };
  handlers['_SHAR'] = (child) => {
    (detail.associations ??= []).push(parseSharedParticipant(child, ctx));
  };
  handlers['_ASSO'] = (child) => {
    // The German GEDCOM-L agreement A3: an event participant as a
    // pointer, like _SHAR (Taufpate, Arbeitgeber, Trauzeuge, ...). The
    // RELA descriptor normalizes like the Gramps ASSO convention.
    (detail.associations ??= []).push(parseGrampsAssociation(child, ctx));
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
  if (ctx.version === '5.5.1') {
    // The Gramps witness convention; normalized like _SHAR.
    handlers['ASSO'] = (child) => {
      (detail.associations ??= []).push(parseGrampsAssociation(child, ctx));
    };
    // The non-underscore RootsMagic spellings of the sentence and place
    // prefix (the Legacy catalog lists them without the underscore);
    // 7.0 input stays strict for non-extension tags.
    handlers['SENT'] = (child) => {
      detail.sentence = reqText(child);
    };
    handlers['PPFX'] = (child) => {
      detail.placePrefix = reqText(child);
    };
  }
  if (ctx.version === '7.0') {
    handlers["PHON"] = (child) => {
      (detail.phone ??= []).push(reqText(child));
    };
    handlers["EMAIL"] = (child) => {
      (detail.email ??= []).push(reqText(child));
    };
    handlers["FAX"] = (child) => {
      (detail.fax ??= []).push(reqText(child));
    };
    handlers["WWW"] = (child) => {
      (detail.www ??= []).push(reqText(child));
    };
    handlers["SNOTE"] = (child) => {
      // The 7.0 EVENT_DETAIL carries <<NOTE_STRUCTURE>> {0:M} (GEDCOM
      // 7.0 §3.2.3); 5.5.1 stays strict.
      (detail.notes ??= []).push(parseNoteStructure(child, ctx));
    };
    handlers["SDATE"] = (child) => {
      detail.sortDate = parseSortDateStructure(child, ctx);
    };
    handlers["ASSO"] = (child) => {
      (detail.associations ??= []).push(parseAssociation(child, ctx));
    };
    handlers["UID"] = (child) => {
      (detail.uniqueIds ??= []).push(reqText(child));
    };
  }
  return handlers;
}

export interface EventShape extends GedcomStructureBase {
  tag: string;
  payload?: true | string | number;
  type?: string;
  detail?: FamilyEventDetail | IndividualEventDetail | LdsOrdinanceDetail;
  familyChild?: string;
  adoptionFamily?: AdoptionFamilyLink;
}

/** Assigns the optional `Y` flag, leaving the field unset when absent. */
export function setY(event: EventShape, node: RawNode): void {
  const y = yFlag(node);
  if (y !== undefined) {
    event.payload = y;
  }
}

export function parseFamilyEvent(node: RawNode, ctx: Ctx, tag: string): FamilyEventStructure {
  const detail: EventDetail = {};
  const familyDetail: FamilyEventDetail = {};
  const event = {} as EventShape;
  event.tag = tag;
  const handlers = eventDetailHandlers(ctx, detail);
  handlers["TYPE"] = (child) => {
    event.type = reqText(child);
  };
  handlers["HUSB"] = (child) => {
    familyDetail.husband = parseFamilyPartnerEventDetail(child, ctx);
  };
  handlers["WIFE"] = (child) => {
    familyDetail.wife = parseFamilyPartnerEventDetail(child, ctx);
  };

  if (tag === 'EVEN') {
    const raw = node.value.kind === 'text' ? node.value.text : undefined;
    (event as { payload?: string }).payload = raw ?? '';
    if (ctx.version === '7.0') {
      const typeNode = req(node, 'TYPE');
      event.type = reqText(typeNode);
    } else {
      const typeNode = one(node, 'TYPE');
      event.type = typeNode === undefined ? '' : reqText(typeNode);
    }
  } else if (ctx.version === '7.0') {
    setY(event, node);
  } else if (tag === 'MARR') {
    setY(event, node);
  } else {
    noPayload(node);
  }

  dispatch(node, event, handlers, ctx);
  if (Object.keys(detail).length > 0) {
    familyDetail.detail = detail;
  }
  if (familyDetail.husband !== undefined || familyDetail.wife !== undefined || familyDetail.detail !== undefined) {
    event.detail = familyDetail;
  }
  return event as unknown as FamilyEventStructure;
}

export function parseFamilyChildCount(node: RawNode, ctx: Ctx): FamilyChildCountAttribute {
  const out: FamilyChildCountAttribute = { tag: 'NCHI', payload: reqDigits(node) };
  if (ctx.version === '7.0') {
    // 7.0 FAMILY_ATTRIBUTE_STRUCTURE: TYPE {0:1} plus the
    // FAMILY_EVENT_DETAIL (the partners' ages and an EVENT_DETAIL).
    // 5.5.1 NCHI is bare and stays strict below.
    const detail: EventDetail = {};
    const familyDetail: FamilyEventDetail = {};
    const handlers = eventDetailHandlers(ctx, detail);
    handlers['TYPE'] = (child) => {
      out.type = reqText(child);
    };
    handlers['HUSB'] = (child) => {
      familyDetail.husband = parseFamilyPartnerEventDetail(child, ctx);
    };
    handlers['WIFE'] = (child) => {
      familyDetail.wife = parseFamilyPartnerEventDetail(child, ctx);
    };
    dispatch(node, out, handlers, ctx, ['TYPE', 'HUSB', 'WIFE']);
    if (Object.keys(detail).length > 0) {
      familyDetail.detail = detail;
    }
    if (familyDetail.husband !== undefined || familyDetail.wife !== undefined || familyDetail.detail !== undefined) {
      out.detail = familyDetail;
    }
    return out;
  }
  if (node.children.length > 0) {
    fail('structure.unknown-tag', `The tag ${(node.children[0] as RawNode).tag} is not allowed under NCHI`, (node.children[0] as RawNode).position);
  }
  return out;
}

export function parseFamilyResidence(node: RawNode, ctx: Ctx): FamilyResidenceAttribute {
  const detail: EventDetail = {};
  const familyDetail: FamilyEventDetail = {};
  const out: FamilyResidenceAttribute = {
    tag: 'RESI',
    // The 7.0 Text payload may be empty: a missing payload is
    // equivalent to the empty string (GEDCOM 7.0 §1.2), and the
    // residence is carried by the detail's ADDR/PLAC.
    ...(node.value.kind === 'absent' ? {} : { payload: reqText(node) }),
  };
  const handlers = eventDetailHandlers(ctx, detail);
  handlers["TYPE"] = (child) => {
    out.type = reqText(child);
  };
  handlers["HUSB"] = (child) => {
    // The 7.0 FAMILY_EVENT_DETAIL under FAM.RESI: the husband's age.
    familyDetail.husband = parseFamilyPartnerEventDetail(child, ctx);
  };
  handlers["WIFE"] = (child) => {
    familyDetail.wife = parseFamilyPartnerEventDetail(child, ctx);
  };
  dispatch(node, out, handlers, ctx, ['TYPE', 'HUSB', 'WIFE']);
  if (Object.keys(detail).length > 0) {
    familyDetail.detail = detail;
  }
  if (familyDetail.husband !== undefined || familyDetail.wife !== undefined || familyDetail.detail !== undefined) {
    out.detail = familyDetail;
  }
  return out;
}

export function parseFamilyResidence551(node: RawNode, ctx: Ctx): FamilyResidenceAttribute {
  noPayload(node);
  const detail: EventDetail = {};
  const familyDetail: FamilyEventDetail = {};
  const out: FamilyResidenceAttribute = { tag: 'RESI' };
  const handlers = eventDetailHandlers(ctx, detail);
  handlers["TYPE"] = (child) => {
    out.type = reqText(child);
  };
  dispatch(node, out, handlers, ctx);
  if (Object.keys(detail).length > 0) {
    familyDetail.detail = detail;
  }
  if (familyDetail.detail !== undefined) {
    out.detail = familyDetail;
  }
  return out;
}

export function parseFamilyFact(node: RawNode, ctx: Ctx): FamilyGenericAttribute {
  const detail: EventDetail = {};
  const familyDetail: FamilyEventDetail = {};
  const out: FamilyGenericAttribute = { tag: 'FACT', payload: reqText(node), type: reqText(req(node, 'TYPE')) };
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
  const event = {} as EventShape;
  event.tag = tag;
  const handlers = eventDetailHandlers(ctx, detail);
  handlers["TYPE"] = (child) => {
    event.type = reqText(child);
  };
  handlers["AGE"] = (child) => {
    detail.age = parseAge(child, ctx);
  };
  handlers["FAMC"] = (child) => {
    if (tag === 'ADOP') {
      event.adoptionFamily = parseAdoptionFamilyLink(child, ctx);
    } else if (tag === 'BIRT' || tag === 'CHR') {
      event.familyChild = reqPtr(child, ctx);
      if (child.children.length > 0) {
        fail('structure.unknown-tag', `The tag ${(child.children[0] as RawNode).tag} is not allowed under FAMC`, (child.children[0] as RawNode).position);
      }
    } else {
      fail('structure.unknown-tag', 'A FAMC is only allowed under ADOP, BIRT or CHR', child.position);
    }
  };

  if (tag === 'EVEN') {
    const raw = node.value.kind === 'text' ? node.value.text : undefined;
    (event as { payload?: string }).payload = raw ?? '';
    if (ctx.version === '7.0') {
      event.type = reqText(req(node, 'TYPE'));
    } else {
      const typeNode = one(node, 'TYPE');
      event.type = typeNode === undefined ? '' : reqText(typeNode);
    }
  } else if (ctx.version === '7.0') {
    setY(event, node);
  } else if (tag === 'BIRT' || tag === 'CHR' || tag === 'DEAT') {
    setY(event, node);
  } else {
    noPayload(node);
  }

  dispatch(node, event, handlers, ctx);
  if (Object.keys(detail).length > 0) {
    event.detail = detail;
  }
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
  const out: AdoptionStructure = { payload: parseEnum(reqText(node), ADOPTION_ENUM_VALUES, ctx.version, node.position) };
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
  const event = {} as EventShape;
  event.tag = tag;
  if (tag === 'NCHI' || tag === 'NMR') {
    event.payload = reqDigits(node);
  } else if (tag === 'RESI' && node.value.kind === 'absent') {
    // The 5.5.1 grammar (GEDCOM 5.5.1 §2 p.33) gives INDI.RESI no
    // payload: the residence is carried by the detail's ADDR/PLAC. In
    // 7.0 the Text payload may be empty and a missing payload is
    // equivalent to the empty string (GEDCOM 7.0 §1.2).
  } else {
    event.payload = reqText(node);
  }
  const handlers = eventDetailHandlers(ctx, detail);
  handlers["TYPE"] = (child) => {
    event.type = reqText(child);
  };
  handlers["AGE"] = (child) => {
    detail.age = parseAge(child, ctx);
  };
  dispatch(node, event, handlers, ctx);
  if ((tag === 'IDNO' || tag === 'FACT') && event.type === undefined) {
    fail('structure.missing-required', `The ${tag} attribute requires a TYPE substructure`, node.position);
  }
  if (Object.keys(detail).length > 0) {
    event.detail = detail;
  }
  return event as unknown as IndividualAttributeStructure;
}

export function parseIndividualOrdinance(node: RawNode, ctx: Ctx, tag: string): LdsIndividualOrdinance {
  const detail: LdsOrdinanceDetail = {};
  const event = {} as EventShape;
  event.tag = tag;
  const handlers: Record<string, (child: RawNode) => void> = {
    DATE: (child) => {
      detail.date = parseDateStructure(child, ctx);
    },
    TEMP: (child) => {
      detail.temple = reqText(child);
    },
    PLAC: (child) => {
      detail.place = ctx.version === '7.0' ? parsePlaceStructure(child, ctx) : parseSourceJurisdictionPlace(child, ctx);
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
        fail('structure.unknown-tag', `A FAMC is not allowed under ${tag}`, child.position);
      }
    },
  };
  if (ctx.version === '7.0') {
    // The 7.0 ordinance details carry <<NOTE_STRUCTURE>> {0:M} (GEDCOM
    // 7.0 §3.2.3); 5.5.1 stays strict.
    handlers['SNOTE'] = (child) => {
      (detail.notes ??= []).push(parseNoteStructure(child, ctx));
    };
  }
  dispatch(node, event, handlers, ctx);
  if (Object.keys(detail).length > 0) {
    (event as unknown as { detail?: LdsOrdinanceDetail }).detail = detail;
  }
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
  let payload: OrdinanceStatusEnum;
  let date: DateExactStructure | undefined;
  if (ctx.version === '7.0') {
    payload = parseEnum(raw, ORDINANCE_STATUS_ENUM_VALUES, '7.0', node.position);
    dispatch(
      node,
      {},
      {
        DATE: (child) => {
          date = parseDateExactStructure(child, ctx, true);
        },
      },
      ctx,
    );
  } else {
    const table = LDS_STATUS_551[ordinance];
    if (table === undefined) {
      fail('structure.unknown-tag', `Unknown ordinance ${ordinance}`, node.position);
    }
    const upper = raw.toUpperCase();
    const canonical = table[upper];
    if (canonical === undefined) {
      fail('enum.invalid-value', `"${raw}" is not a permitted status for ${ordinance} in 5.5.1`, node.position);
    }
    payload = (canonical === '' ? upper : canonical) as OrdinanceStatusEnum;
    const dateNode = req(node, 'DATE');
    date = parseDateExactStructure(dateNode, ctx, false);
    if (node.children.some((child) => child.tag !== 'DATE')) {
      fail('structure.unknown-tag', 'Only a DATE substructure is allowed under STAT', node.position);
    }
  }
  if (date === undefined) {
    fail('structure.missing-required', 'The STAT structure requires a DATE substructure', node.position);
  }
  return { payload, date };
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
      detail.place = ctx.version === '7.0' ? parsePlaceStructure(child, ctx) : parseSourceJurisdictionPlace(child, ctx);
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
  };
  if (ctx.version === '7.0') {
    // The 7.0 LDS_SPOUSE_SEALING carries <<NOTE_STRUCTURE>> {0:M}
    // (GEDCOM 7.0 §3.2.3); 5.5.1 stays strict.
    handlers['SNOTE'] = (child) => {
      (detail.notes ??= []).push(parseNoteStructure(child, ctx));
    };
  }
  dispatch(node, out, handlers, ctx);
  if (Object.keys(detail).length > 0) {
    out.detail = detail;
  }
  return out;
}
