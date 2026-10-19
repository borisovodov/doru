/**
 * Parser section: Family and individual records.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). Every function here
 * maps a raw-tree node onto the typed model and fails with a typed
 * error naming the offending line.
 */

import {
  RESTRICTION_ENUM_VALUES,
  SEX_ENUM_VALUES,
} from '../enumerations';
import type {
  EventDetail,
  FamilyEventDetail,
  FamilyEventStructure,
  FamilyRecord,
  IndividualEventDetail,
  IndividualEventStructure,
  IndividualRecord,
  NameTypeStructure,
} from '../structures';
import type {
  Ctx,
} from './context';
import {
  dispatch,
  noPayload,
  reqPtr,
  reqText,
} from './context';
import {
  SEX_551,
  eventDetailHandlers,
  parseAliasLink,
  parseChildFamilyLink,
  parseFamilyChildCount,
  parseFamilyChildLink,
  parseFamilyEvent,
  parseFamilyFact,
  parseFamilyPartnerLink,
  parseFamilyResidence,
  parseFamilyResidence551,
  parseIndividualAttribute,
  parseIndividualEvent,
  parseIndividualOrdinance,
  parseSpouseFamilyLink,
  parseSpouseSealing,
} from './events';
import type {
  RawNode,
} from './lines';
import {
  parsePersonalNameStructure,
} from './names-places';
import {
  parseMultimediaLink,
  parseSourceCitation,
} from './sources-media';
import {
  parseAssociation,
  parseChangeDate,
  parseCreationDate,
  parseExternalIdentifier,
  parseNonEvent,
  parseNoteStructure,
  parseReferenceIdentifier,
  parseUniqueIdentifier,
} from './substructures';
import {
  parseEnum,
  parseListEnum,
  parsePersonalName,
} from './types';
import type {
  EventEnum,
  NameTypeEnum,
} from '../enumerations';
import {
  fail,
} from '../errors';
import type {
  Text,
} from '../primitives';

// ---------------------------------------------------------------------------

export const FAMILY_EVENT_TAGS = ['ANUL', 'CENS', 'DIV', 'DIVF', 'ENGA', 'MARB', 'MARC', 'MARL', 'MARR', 'MARS', 'EVEN'];
export const INDIVIDUAL_EVENT_TAGS = [
  'ADOP', 'BAPM', 'BARM', 'BASM', 'BIRT', 'BLES', 'BURI', 'CENS', 'CHR', 'CHRA', 'CONF', 'CREM',
  'DEAT', 'EMIG', 'FCOM', 'GRAD', 'IMMI', 'NATU', 'ORDN', 'PROB', 'RETI', 'WILL', 'EVEN',
];
export const INDIVIDUAL_ATTRIBUTE_TAGS = [
  'CAST', 'DSCR', 'EDUC', 'IDNO', 'NATI', 'NCHI', 'NMR', 'OCCU', 'PROP', 'RELI', 'RESI', 'SSN', 'TITL', 'FACT',
];

export function parseFamilyRecord(node: RawNode, ctx: Ctx): FamilyRecord {
  noPayload(node);
  const rec: FamilyRecord = { tag: 'FAM', ...(node.xref === undefined ? {} : { xref: node.xref }) };
  const handlers: Record<string, (child: RawNode) => void> = {
    RESN: (child) => {
      rec.restriction = parseListEnum(reqText(child), RESTRICTION_ENUM_VALUES, ctx.version, child.position);
    },
    HUSB: (child) => {
      rec.husband = parseFamilyPartnerLink(child, ctx);
    },
    WIFE: (child) => {
      rec.wife = parseFamilyPartnerLink(child, ctx);
    },
    CHIL: (child) => {
      (rec.children ??= []).push(parseFamilyChildLink(child, ctx));
    },
    SUBM: (child) => {
      (rec.submitters ??= []).push(reqPtr(child, ctx));
    },
    SLGS: (child) => {
      (rec.spouseSealings ??= []).push(parseSpouseSealing(child, ctx));
    },
    NOTE: (child) => {
      (rec.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    SOUR: (child) => {
      (rec.citations ??= []).push(parseSourceCitation(child, ctx));
    },
    OBJE: (child) => {
      (rec.media ??= []).push(parseMultimediaLink(child, ctx));
    },
    _WT_OBJE_SORT: (child) => {
      (rec.media ??= []).push(parseMultimediaLink(child, ctx));
    },
    _UPD: (child) => {
      rec.updatedAt = reqText(child);
    },
    _NONE: (child) => {
      noPayload(child);
      (rec.attributes ??= []).push({ tag: 'NCHI', payload: 0 });
    },
    _STAT: (child) => {
      rec.marriageStatus = reqText(child);
    },
    _COML: (child) => {
      pushVendorFamilyEvent(rec, child, ctx, 'MARR', 'Common law marriage');
    },
    _MBON: (child) => {
      pushVendorFamilyEvent(rec, child, ctx, 'EVEN', 'Marriage bond');
    },
    _SEPR: (child) => {
      pushVendorFamilyEvent(rec, child, ctx, 'EVEN', 'Separated');
    },
    CHAN: (child) => {
      rec.changeDate = parseChangeDate(child, ctx);
    },
    REFN: (child) => {
      (rec.identifiers ??= []).push(parseReferenceIdentifier(child, ctx));
    },
  };
  if (ctx.version === '7.0') {
    handlers["NCHI"] = (child) => {
      (rec.attributes ??= []).push(parseFamilyChildCount(child));
    };
    handlers["RESI"] = (child) => {
      (rec.attributes ??= []).push(parseFamilyResidence(child, ctx));
    };
    handlers["FACT"] = (child) => {
      (rec.attributes ??= []).push(parseFamilyFact(child, ctx));
    };
    handlers["NO"] = (child) => {
      (rec.nonEvents ??= []).push(parseNonEvent(child, ctx));
    };
    handlers["ASSO"] = (child) => {
      (rec.associations ??= []).push(parseAssociation(child, ctx));
    };
    handlers["CREA"] = (child) => {
      rec.creationDate = parseCreationDate(child, ctx);
    };
    handlers["UID"] = (child) => {
      (rec.identifiers ??= []).push(parseUniqueIdentifier(child));
    };
    handlers["_UID"] = (child) => {
      (rec.identifiers ??= []).push(parseUniqueIdentifier(child));
    };
    handlers["EXID"] = (child) => {
      (rec.identifiers ??= []).push(parseExternalIdentifier(child, ctx));
    };
    for (const tag of FAMILY_EVENT_TAGS) {
      handlers[tag] = (child) => {
        (rec.events ??= []).push(parseFamilyEvent(child, ctx, tag));
      };
    }
  } else {
    handlers['_UID'] = (child) => {
      (rec.identifiers ??= []).push(parseUniqueIdentifier(child));
    };
    handlers["NCHI"] = (child) => {
      (rec.attributes ??= []).push(parseFamilyChildCount(child));
    };
    for (const tag of FAMILY_EVENT_TAGS) {
      handlers[tag] = (child) => {
        (rec.events ??= []).push(parseFamilyEvent(child, ctx, tag));
      };
    }
    handlers["RESI"] = (child) => {
      (rec.attributes ??= []).push(parseFamilyResidence551(child, ctx));
    };
    handlers["RIN"] = (child) => {
      rec.automatedRecordId = reqText(child);
    };
  }
  dispatch(
    node,
    rec,
    handlers,
    ctx,
    ctx.version === '7.0' ? ['RESN', 'HUSB', 'WIFE', 'CHAN', 'CREA'] : ['RESN', 'NCHI', 'HUSB', 'WIFE', 'CHAN', 'RIN'],
  );
  return rec;
}

/**
 * A vendor name tag (`_MARNM`, `_AKA`, …): normalized into a NAME with
 * the given type; see the JSDoc of PersonalNameStructure.
 */
function pushVendorName(rec: IndividualRecord, node: RawNode, ctx: Ctx, nameType: NameTypeEnum, phrase?: string): void {
  const type: NameTypeStructure = { payload: nameType };
  if (phrase !== undefined) {
    type.phrase = phrase as Text;
  }
  (rec.names ??= []).push({
    tag: 'NAME',
    payload: parsePersonalName(reqText(node), ctx.version, node.position),
    type,
  });
}

/** A vendor physical descriptor (_EYEC, _HAIR, …): a FACT with a TYPE. */
function pushVendorAttribute(rec: IndividualRecord, node: RawNode, ctx: Ctx, type: string): void {
  const detail: EventDetail = {};
  const handlers = eventDetailHandlers(ctx, detail);
  handlers['TYPE'] = () => undefined;
  dispatch(node, detail, handlers, ctx);
  const raw = node.value.kind === 'text' ? node.value.text : '';
  (rec.attributes ??= []).push({
    tag: 'FACT',
    payload: raw,
    type,
    ...(Object.keys(detail).length === 0 ? {} : { detail: detail as IndividualEventDetail }),
  });
}

/** A vendor family-level fact (_COML, _MBON, _SEPR): a MARR or FAM.EVEN with a TYPE. */
function pushVendorFamilyEvent(rec: FamilyRecord, node: RawNode, ctx: Ctx, tag: 'MARR' | 'EVEN', type: string): void {
  const detail: EventDetail = {};
  const handlers = eventDetailHandlers(ctx, detail);
  handlers['TYPE'] = () => undefined;
  dispatch(node, detail, handlers, ctx);
  const familyDetail: FamilyEventDetail = {
    ...(Object.keys(detail).length === 0 ? {} : { detail }),
  };
  const eventDetail = Object.keys(detail).length === 0 ? {} : { detail: familyDetail };
  if (tag === 'MARR') {
    (rec.events ??= []).push({ tag: 'MARR', type, ...eventDetail } as FamilyEventStructure);
  } else {
    (rec.events ??= []).push({ tag: 'EVEN', payload: '', type, ...eventDetail } as FamilyEventStructure);
  }
}

/** A vendor negative (_NLIV, _NMAR, _NMR): a 7.0-style NO structure. */
function pushVendorNonEvent(rec: IndividualRecord, node: RawNode, ctx: Ctx, payload: EventEnum): void {
  void ctx;
  noPayload(node);
  if (node.children.length > 0) {
    fail('structure.unknown-tag', `The tag ${(node.children[0] as RawNode).tag} is not allowed under ${node.tag}`, (node.children[0] as RawNode).position);
  }
  (rec.nonEvents ??= []).push({ tag: 'NO', payload });
}

/** The FTM vendor fact tags (_MILT, _MDCL, _FOOT): an EVEN with a TYPE. */
function parseVendorFact(node: RawNode, ctx: Ctx, type: string): IndividualEventStructure {
  const detail: EventDetail = {};
  const handlers = eventDetailHandlers(ctx, detail);
  handlers['TYPE'] = () => undefined;
  dispatch(node, detail, handlers, ctx);
  return {
    tag: 'EVEN',
    payload: '',
    type,
    ...(Object.keys(detail).length === 0 ? {} : { detail: detail as IndividualEventDetail }),
  };
}

/** The FTM _DCAUSE fact: the death cause, kept in the DEAT event's CAUS. */
function upsertDeathCause(rec: IndividualRecord, node: RawNode, ctx: Ctx): void {
  let event = rec.events?.find((entry) => entry.tag === 'DEAT');
  if (event === undefined) {
    event = { tag: 'DEAT' };
    (rec.events ??= []).push(event);
  }
  event.detail ??= {};
  const raw = node.value.kind === 'text' ? node.value.text : undefined;
  if (raw !== undefined) {
    event.detail.cause = raw;
  }
  dispatch(node, event.detail, eventDetailHandlers(ctx, event.detail), ctx);
}

/** Sets the n-th tag mark, padding the gaps (see IndividualRecord.marks). */
function setMark(rec: IndividualRecord, index: number, node: RawNode): void {
  const marks = (rec.marks ??= []);
  while (marks.length <= index) {
    marks.push('');
  }
  marks[index] = reqText(node);
}

export function parseIndividualRecord(node: RawNode, ctx: Ctx): IndividualRecord {
  noPayload(node);
  const rec: IndividualRecord = { tag: 'INDI', ...(node.xref === undefined ? {} : { xref: node.xref }) };
  const handlers: Record<string, (child: RawNode) => void> = {
    RESN: (child) => {
      rec.restriction = parseListEnum(reqText(child), RESTRICTION_ENUM_VALUES, ctx.version, child.position);
    },
    NAME: (child) => {
      (rec.names ??= []).push(parsePersonalNameStructure(child, ctx));
    },
    _MARNM: (child) => {
      pushVendorName(rec, child, ctx, 'MARRIED');
    },
    _MARN: (child) => {
      pushVendorName(rec, child, ctx, 'MARRIED');
    },
    _AKA: (child) => {
      pushVendorName(rec, child, ctx, 'AKA');
    },
    _AKAN: (child) => {
      pushVendorName(rec, child, ctx, 'AKA');
    },
    _UPD: (child) => {
      rec.updatedAt = reqText(child);
    },
    _URL: (child) => {
      rec.url = reqText(child);
    },
    _TAG: (child) => {
      setMark(rec, 0, child);
    },
    _TAG2: (child) => {
      setMark(rec, 1, child);
    },
    _TAG3: (child) => {
      setMark(rec, 2, child);
    },
    _TAG4: (child) => {
      setMark(rec, 3, child);
    },
    _TAG5: (child) => {
      setMark(rec, 4, child);
    },
    _TAG6: (child) => {
      setMark(rec, 5, child);
    },
    _TAG7: (child) => {
      setMark(rec, 6, child);
    },
    _TAG8: (child) => {
      setMark(rec, 7, child);
    },
    _TAG9: (child) => {
      setMark(rec, 8, child);
    },
    _BIRN: (child) => {
      pushVendorName(rec, child, ctx, 'BIRTH');
    },
    _ADPN: (child) => {
      pushVendorName(rec, child, ctx, 'OTHER', 'Adopted name');
    },
    _CENN: (child) => {
      pushVendorName(rec, child, ctx, 'OTHER', 'Census name');
    },
    _CURN: (child) => {
      pushVendorName(rec, child, ctx, 'OTHER', 'Currently known as');
    },
    _FARN: (child) => {
      pushVendorName(rec, child, ctx, 'OTHER', 'Farm name');
    },
    _FKAN: (child) => {
      pushVendorName(rec, child, ctx, 'OTHER', 'Formally known as');
    },
    _GERN: (child) => {
      pushVendorName(rec, child, ctx, 'OTHER', 'German name');
    },
    _HEBN: (child) => {
      pushVendorName(rec, child, ctx, 'OTHER', 'Hebrew name');
    },
    _INDN: (child) => {
      pushVendorName(rec, child, ctx, 'OTHER', 'Indian name');
    },
    _OTHN: (child) => {
      pushVendorName(rec, child, ctx, 'OTHER', 'Other name');
    },
    _RELN: (child) => {
      pushVendorName(rec, child, ctx, 'OTHER', 'Religious name');
    },
    _SHON: (child) => {
      pushVendorName(rec, child, ctx, 'OTHER', 'Short name');
    },
    _SLDN: (child) => {
      pushVendorName(rec, child, ctx, 'OTHER', 'Soldier name');
    },
    _EYEC: (child) => {
      pushVendorAttribute(rec, child, ctx, 'Eye color');
    },
    _HAIR: (child) => {
      pushVendorAttribute(rec, child, ctx, 'Hair color');
    },
    _HEIG: (child) => {
      pushVendorAttribute(rec, child, ctx, 'Height');
    },
    _WEIG: (child) => {
      pushVendorAttribute(rec, child, ctx, 'Weight');
    },
    _BRTM: (child) => {
      (rec.events ??= []).push(parseVendorFact(child, ctx, 'Brit Mila'));
    },
    _FNRL: (child) => {
      (rec.events ??= []).push(parseVendorFact(child, ctx, 'Funeral'));
    },
    _INTE: (child) => {
      (rec.events ??= []).push(parseVendorFact(child, ctx, 'Interred'));
    },
    _YART: (child) => {
      (rec.events ??= []).push(parseVendorFact(child, ctx, 'Yahrzeit'));
    },
    _PRMN: (child) => {
      (rec.identifiers ??= []).push(parseReferenceIdentifier(child, ctx));
    },
    _NLIV: (child) => {
      pushVendorNonEvent(rec, child, ctx, 'DEAT');
    },
    _NMAR: (child) => {
      pushVendorNonEvent(rec, child, ctx, 'MARR');
    },
    _NMR: (child) => {
      pushVendorNonEvent(rec, child, ctx, 'MARR');
    },
    _DCAUSE: (child) => {
      upsertDeathCause(rec, child, ctx);
    },
    _MILT: (child) => {
      (rec.events ??= []).push(parseVendorFact(child, ctx, 'Military'));
    },
    _MDCL: (child) => {
      (rec.events ??= []).push(parseVendorFact(child, ctx, 'Medical'));
    },
    _FOOT: (child) => {
      (rec.events ??= []).push(parseVendorFact(child, ctx, 'Footnote'));
    },
    SEX: (child) => {
      const table = (ctx.version === '7.0' ? SEX_ENUM_VALUES : SEX_551) as Readonly<
        Record<'M' | 'F' | 'U' | 'X', string>
      >;
      rec.sex = parseEnum(reqText(child), table, ctx.version, child.position);
    },
    FAMC: (child) => {
      (rec.childFamilies ??= []).push(parseChildFamilyLink(child, ctx));
    },
    FAMS: (child) => {
      (rec.spouseFamilies ??= []).push(parseSpouseFamilyLink(child, ctx));
    },
    SUBM: (child) => {
      (rec.submitters ??= []).push(reqPtr(child, ctx));
    },
    ASSO: (child) => {
      (rec.associations ??= []).push(parseAssociation(child, ctx));
    },
    ALIA: (child) => {
      (rec.aliases ??= []).push(parseAliasLink(child, ctx));
    },
    ANCI: (child) => {
      (rec.ancestorInterests ??= []).push(reqPtr(child, ctx));
    },
    DESI: (child) => {
      (rec.descendantInterests ??= []).push(reqPtr(child, ctx));
    },
    NOTE: (child) => {
      (rec.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    SOUR: (child) => {
      (rec.citations ??= []).push(parseSourceCitation(child, ctx));
    },
    OBJE: (child) => {
      (rec.media ??= []).push(parseMultimediaLink(child, ctx));
    },
    _WT_OBJE_SORT: (child) => {
      (rec.media ??= []).push(parseMultimediaLink(child, ctx));
    },
    CHAN: (child) => {
      rec.changeDate = parseChangeDate(child, ctx);
    },
    REFN: (child) => {
      (rec.identifiers ??= []).push(parseReferenceIdentifier(child, ctx));
    },
  };
  const eventTags = INDIVIDUAL_EVENT_TAGS;
  const attributeTags = INDIVIDUAL_ATTRIBUTE_TAGS;
  if (ctx.version === '7.0') {
    handlers["NO"] = (child) => {
      (rec.nonEvents ??= []).push(parseNonEvent(child, ctx));
    };
    handlers["CREA"] = (child) => {
      rec.creationDate = parseCreationDate(child, ctx);
    };
    handlers["UID"] = (child) => {
      (rec.identifiers ??= []).push(parseUniqueIdentifier(child));
    };
    handlers["_UID"] = (child) => {
      (rec.identifiers ??= []).push(parseUniqueIdentifier(child));
    };
    handlers["EXID"] = (child) => {
      (rec.identifiers ??= []).push(parseExternalIdentifier(child, ctx));
    };
    for (const tag of ['BAPL', 'CONL', 'ENDL', 'INIL', 'SLGC']) {
      handlers[tag] = (child) => {
        (rec.ordinances ??= []).push(parseIndividualOrdinance(child, ctx, tag));
      };
    }
  } else {
    handlers['_UID'] = (child) => {
      (rec.identifiers ??= []).push(parseUniqueIdentifier(child));
    };
    handlers["RIN"] = (child) => {
      rec.automatedRecordId = reqText(child);
    };
    handlers["RFN"] = (child) => {
      rec.recordFileNumber = reqText(child);
    };
    handlers["AFN"] = (child) => {
      rec.ancestralFileNumber = reqText(child);
    };
    for (const tag of ['BAPL', 'CONL', 'ENDL', 'SLGC']) {
      handlers[tag] = (child) => {
        (rec.ordinances ??= []).push(parseIndividualOrdinance(child, ctx, tag));
      };
    }
  }
  for (const tag of eventTags) {
    handlers[tag] = (child) => {
      (rec.events ??= []).push(parseIndividualEvent(child, ctx, tag));
    };
  }
  for (const tag of attributeTags) {
    handlers[tag] = (child) => {
      (rec.attributes ??= []).push(parseIndividualAttribute(child, ctx, tag));
    };
  }
  dispatch(
    node,
    rec,
    handlers,
    ctx,
    ctx.version === '7.0' ? ['RESN', 'SEX', 'CHAN', 'CREA'] : ['RESN', 'SEX', 'CHAN', 'RIN', 'RFN', 'AFN'],
  );
  return rec;
}
