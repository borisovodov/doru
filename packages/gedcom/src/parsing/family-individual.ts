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
  Note,
} from '../structures';
import type {
  Ctx,
} from './context';
import {
  dispatch,
  addExtension,
  noPayload,
  reqPtr,
  reqText,
  resolvePtr,
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
import {
  parseTodoStructure,
} from './todo';
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
  parseGrampsAssociation,
  parseChangeDate,
  parseCreationDate,
  parseExternalIdentifier,
  parseNonEvent,
  parseNoteStructure,
  parseReferenceIdentifier,
  parseUniqueIdentifier,
  parseAge,
} from './substructures';
import {
  parseEnum,
  parseListEnum,
  parsePersonalName,
} from './types';
import {
  LEGACY_FAMILY_TAGS,
  LEGACY_INDIVIDUAL_TAGS,
  NON_UNDERSCORE_VENDOR_TAGS,
} from './vendor-tags';
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
      // The "couple had no children" marker: Legacy Family Tree writes
      // the bare `_NONE`, Ahnenblatt writes `_NONE Y` (the only value
      // the GenWiki catalog documents, by analogy with `MARR Y`). Both
      // spell the same fact and normalize into the standard `NCHI 0`;
      // the sources and export rule are recorded on
      // FamilyChildCountAttribute.
      if (child.value.kind === 'pointer') {
        fail('structure.unexpected-payload', 'The _NONE line must not carry a pointer', child.position);
      }
      if (child.value.kind === 'text' && child.value.text.toUpperCase() !== 'Y') {
        fail('enum.invalid-value', `The _NONE value must be Y or absent (the couple had no children), got "${child.value.text}"`, child.position);
      }
      if (child.children.length > 0) {
        fail('structure.unknown-tag', `The tag ${(child.children[0] as RawNode).tag} is not allowed under _NONE`, (child.children[0] as RawNode).position);
      }
      (rec.attributes ??= []).push({ tag: 'NCHI', payload: 0 });
    },
    _STAT: (child) => {
      rec.marriageStatus = reqText(child);
    },
    _MSTAT: (child) => {
      // FTW: the status at the beginning of the marriage.
      rec.marriageBeginningStatus = reqText(child);
    },
    _MEND: (child) => {
      // FTW: the status at the end of the marriage.
      rec.marriageEndingStatus = reqText(child);
    },
    _TODO: (child) => {
      (rec.todos ??= []).push(parseTodoStructure(child, ctx));
    },
    _TYPE: (child) => {
      // The GEDCOM-L convention: _TYPE same-sex marks a same-sex
      // union; no other FAM _TYPE value is defined.
      const value = reqText(child).toUpperCase();
      if (value === 'SAME-SEX') {
        rec.sameSexUnion = true;
      } else {
        fail('enum.invalid-value', `The FAM _TYPE "${value}" must be "same-sex"`, child.position);
      }
    },
    _MARR: (child) => {
      // Ahnenblatt: _MARR N marks the couple as NOT married (the only
      // defined value, analogous to MARR Y) — a FAM-level NO MARR.
      pushFamNonEvent(rec, child, ctx, 'N');
    },
    _NMR: (child) => {
      // BKW: _NMR Y marks the couple as not married — the same NO MARR.
      pushFamNonEvent(rec, child, ctx, 'Y');
    },
    _LIV: (child) => {
      // GenPlus/PRO-GEN: Lebensgemeinschaft (cohabitation), an event
      // with the usual DATE/PLAC/... detail.
      pushVendorFamilyEvent(rec, child, ctx, 'EVEN', 'Cohabitation');
    },
    _ASSO: (child) => {
      // The German GEDCOM-L agreement A3: a person's relation to the
      // family as a pointer; 5.5.1 FAM has no standard ASSO slot. The
      // RELA descriptor normalizes like the Gramps ASSO convention.
      (rec.associations ??= []).push(parseGrampsAssociation(child, ctx));
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
    applyLegacyFamilyTags(rec, handlers, ctx);
  }
  dispatch(
    node,
    rec,
    handlers,
    ctx,
    ctx.version === '7.0' ? ['RESN', 'HUSB', 'WIFE', 'CHAN', 'CREA', '_MSTAT', '_MEND'] : ['RESN', 'NCHI', 'HUSB', 'WIFE', 'CHAN', 'RIN', '_MSTAT', '_MEND'],
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
function pushVendorAttribute(rec: IndividualRecord, node: RawNode, ctx: Ctx, tag: 'FACT' | 'EDUC', type: string): void {
  const detail: EventDetail = {};
  const handlers = eventDetailHandlers(ctx, detail);
  handlers['TYPE'] = () => undefined;
  dispatch(node, detail, handlers, ctx);
  const raw = node.value.kind === 'text' ? node.value.text : '';
  (rec.attributes ??= []).push({
    tag,
    payload: raw,
    type,
    ...(Object.keys(detail).length === 0 ? {} : { detail: detail as IndividualEventDetail }),
  });
}

// ---------------------------------------------------------------------------
// The non-underscore legacy vendor tags of GEDCOM 5.x (see vendor-tags.ts)
// ---------------------------------------------------------------------------

/** An INDI-level legacy event tag: EVEN with the TYPE; the payload text
 *  is kept (a bare `Y` assertion is dropped, like the standard event
 *  payloads). */
function pushLegacyIndividualEvent(rec: IndividualRecord, node: RawNode, ctx: Ctx, type: string): void {
  const detail: IndividualEventDetail = {};
  const handlers = eventDetailHandlers(ctx, detail);
  handlers['TYPE'] = () => undefined;
  handlers['AGE'] = (child) => {
    detail.age = parseAge(child, ctx);
  };
  dispatch(node, detail, handlers, ctx);
  const raw = node.value.kind === 'text' ? node.value.text : '';
  (rec.events ??= []).push({
    tag: 'EVEN',
    payload: raw === 'Y' ? '' : raw,
    type,
    ...(Object.keys(detail).length === 0 ? {} : { detail }),
  });
}

/** An INDI-level legacy attribute tag: FACT (or EDUC) with the TYPE; a
 *  TYPE child overrides the default. The payload text is kept. */
function pushLegacyIndividualAttribute(rec: IndividualRecord, node: RawNode, ctx: Ctx, tag: 'FACT' | 'EDUC', type: string): void {
  const detail: EventDetail = {};
  const handlers = eventDetailHandlers(ctx, detail);
  let typeValue = type;
  handlers['TYPE'] = (child) => {
    typeValue = reqText(child);
  };
  dispatch(node, detail, handlers, ctx);
  const raw = node.value.kind === 'text' ? node.value.text : '';
  (rec.attributes ??= []).push({
    tag,
    payload: raw,
    type: typeValue,
    ...(Object.keys(detail).length === 0 ? {} : { detail: detail as IndividualEventDetail }),
  });
}

/** An INDI-level legacy person link: a pointer payload becomes an ASSO
 *  with the RELA descriptor; a text payload becomes FACT + TYPE. */
function pushLegacyAssociation(rec: IndividualRecord, node: RawNode, ctx: Ctx, relationship: string): void {
  if (node.value.kind === 'pointer') {
    if (node.children.length > 0) {
      fail('structure.unknown-tag', `The tag ${(node.children[0] as RawNode).tag} is not allowed under ${node.tag}`, (node.children[0] as RawNode).position);
    }
    (rec.associations ??= []).push({
      tag: 'ASSO',
      individual: resolvePtr(node.value.pointer, ctx, node),
      relationship,
    });
    return;
  }
  pushLegacyIndividualAttribute(rec, node, ctx, 'FACT', relationship);
}

/** The FTM5 `LDS` wrapper: its children parse as LDS individual
 *  ordinances (BAPL/CONL/ENDL/SLGC); anything else falls back to the
 *  extension rules. */
function parseLegacyLdsBlock(rec: IndividualRecord, node: RawNode, ctx: Ctx): void {
  noPayload(node);
  for (const child of node.children) {
    const tag = child.tag;
    if (tag === 'BAPL' || tag === 'CONL' || tag === 'ENDL' || tag === 'SLGC') {
      (rec.ordinances ??= []).push(parseIndividualOrdinance(child, ctx, tag));
      continue;
    }
    if (tag.startsWith('_') || NON_UNDERSCORE_VENDOR_TAGS.has(tag)) {
      addExtension(rec, child);
      continue;
    }
    fail('structure.unknown-tag', `The tag ${tag} is not allowed under LDS`, child.position);
  }
}

/** An INDI-level legacy note tag (HIST, INFO, …): an inline NOTE. */
function pushLegacyNote(rec: IndividualRecord, node: RawNode, ctx: Ctx): void {
  const raw = node.value.kind === 'text' ? node.value.text : '';
  if (raw === '') {
    fail('structure.missing-payload', `The ${node.tag} line requires a text value`, node.position);
  }
  const note: Note = { tag: 'NOTE', payload: raw };
  dispatch(
    node,
    note,
    {
      SOUR: (child) => {
        (note.citations ??= []).push(parseSourceCitation(child, ctx));
      },
    },
    ctx,
  );
  (rec.notes ??= []).push(note);
}

/** Applies the typed legacy INDI rules (see vendor-tags.ts) on 5.x input. */
function applyLegacyIndividualTags(rec: IndividualRecord, handlers: Record<string, (child: RawNode) => void>, ctx: Ctx): void {
  for (const [tag, rule] of Object.entries(LEGACY_INDIVIDUAL_TAGS)) {
    handlers[tag] = (child) => {
      switch (rule.kind) {
        case 'name':
          pushVendorName(rec, child, ctx, rule.nameType);
          return;
        case 'nameOther':
          pushVendorName(rec, child, ctx, 'OTHER', rule.phrase);
          return;
        case 'standardEvent':
          (rec.events ??= []).push(parseIndividualEvent(child, ctx, rule.tag));
          return;
        case 'event':
          pushLegacyIndividualEvent(rec, child, ctx, rule.type);
          return;
        case 'fact':
          pushLegacyIndividualAttribute(rec, child, ctx, 'FACT', rule.type);
          return;
        case 'educ':
          pushLegacyIndividualAttribute(rec, child, ctx, 'EDUC', rule.type);
          return;
        case 'attribute':
          (rec.attributes ??= []).push(parseIndividualAttribute(child, ctx, rule.tag));
          return;
        case 'note':
          pushLegacyNote(rec, child, ctx);
          return;
        case 'negative':
          pushVendorNonEvent(rec, child, ctx, rule.event);
          return;
        case 'url':
          rec.url = reqText(child);
          return;
        case 'refn':
          if (rule.type === undefined) {
            (rec.identifiers ??= []).push(parseReferenceIdentifier(child, ctx));
          } else {
            (rec.identifiers ??= []).push({ tag: 'REFN', payload: reqText(child), type: rule.type });
          }
          return;
        case 'association':
          pushLegacyAssociation(rec, child, ctx, rule.relationship);
          return;
        case 'lds':
          parseLegacyLdsBlock(rec, child, ctx);
          return;
      }
    };
  }
}

/** Applies the typed legacy FAM rules (see vendor-tags.ts) on 5.x input. */
function applyLegacyFamilyTags(rec: FamilyRecord, handlers: Record<string, (child: RawNode) => void>, ctx: Ctx): void {
  for (const [tag, rule] of Object.entries(LEGACY_FAMILY_TAGS)) {
    handlers[tag] = (child) => {
      const detail: EventDetail = {};
      const eventHandlers = eventDetailHandlers(ctx, detail);
      eventHandlers['TYPE'] = () => undefined;
      dispatch(child, detail, eventHandlers, ctx);
      const raw = child.value.kind === 'text' ? child.value.text : '';
      const familyDetail: FamilyEventDetail = {
        ...(Object.keys(detail).length === 0 ? {} : { detail }),
      };
      const eventDetail = Object.keys(familyDetail).length === 0 ? {} : { detail: familyDetail };
      if (rule.kind === 'marriage') {
        (rec.events ??= []).push({ tag: 'MARR', type: rule.type, ...eventDetail } as FamilyEventStructure);
      } else {
        (rec.events ??= []).push({ tag: 'EVEN', payload: raw === 'Y' ? '' : raw, type: rule.type, ...eventDetail } as FamilyEventStructure);
      }
    };
  }
}

/** A vendor family-level fact (_COML, _MBON, _SEPR): a MARR or FAM.EVEN with a TYPE. */
/** A FAM-level vendor negative (`_MARR N` / `_NMR Y`): a bare NO MARR. */
function pushFamNonEvent(rec: FamilyRecord, node: RawNode, ctx: Ctx, expected: 'N' | 'Y'): void {
  void ctx;
  const value = reqText(node).toUpperCase();
  if (value !== expected) {
    fail('enum.invalid-value', `The ${node.tag} payload must be "${expected}"`, node.position);
  }
  if (node.children.length > 0) {
    fail('structure.unknown-tag', `The tag ${(node.children[0] as RawNode).tag} is not allowed under ${node.tag}`, (node.children[0] as RawNode).position);
  }
  (rec.nonEvents ??= []).push({ tag: 'NO', payload: 'MARR' });
}

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
    _SOSA: (child) => {
      rec.sosaNumber = reqText(child);
    },
    _FSFTID: (child) => {
      rec.familySearchId = reqText(child);
    },
    _TODO: (child) => {
      (rec.todos ??= []).push(parseTodoStructure(child, ctx));
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
      pushVendorAttribute(rec, child, ctx, 'FACT', 'Eye color');
    },
    _HAIR: (child) => {
      pushVendorAttribute(rec, child, ctx, 'FACT', 'Hair color');
    },
    _HEIG: (child) => {
      pushVendorAttribute(rec, child, ctx, 'FACT', 'Height');
    },
    _WEIG: (child) => {
      pushVendorAttribute(rec, child, ctx, 'FACT', 'Weight');
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
    // The FTM201x / Ancestry fact tags (GenWiki "GEDCOM/_Nutzerdef-Tag"
    // table: https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag), the same
    // normalization as the older FTM set above:
    // - _CIRC (circumcision) and _FUN (funeral) become EVEN + TYPE, like
    //   the BKW _BRTM/_FNRL spellings of the same facts;
    // - _DEG (degree) becomes the standard EDUC attribute with TYPE
    //   "Degree";
    // - _EMPLOY (employment) becomes FACT + TYPE "Employment" — not the
    //   standard OCCU: Ancestry distinguishes the two ("_EMPLOY = Beruf,
    //   OCCU = Beschäftigung"), so merging would collide;
    // - _DNA (DNA markers) and _NAMS (namesake, kept free text: the
    //   catalog does not say whether it is a name or a pointer) become
    //   FACT + TYPE;
    // - _MILTID (military identification number) becomes the REFN
    //   identifier with TYPE "Military" (like the BKW _PRMN).
    _CIRC: (child) => {
      (rec.events ??= []).push(parseVendorFact(child, ctx, 'Circumcision'));
    },
    _FUN: (child) => {
      (rec.events ??= []).push(parseVendorFact(child, ctx, 'Funeral'));
    },
    _DEG: (child) => {
      pushVendorAttribute(rec, child, ctx, 'EDUC', 'Degree');
    },
    _EMPLOY: (child) => {
      pushVendorAttribute(rec, child, ctx, 'FACT', 'Employment');
    },
    _DNA: (child) => {
      pushVendorAttribute(rec, child, ctx, 'FACT', 'DNA');
    },
    _NAMS: (child) => {
      pushVendorAttribute(rec, child, ctx, 'FACT', 'Namesake');
    },
    _MILTID: (child) => {
      (rec.identifiers ??= []).push({ tag: 'REFN', payload: reqText(child), type: 'Military' });
    },
    _EXCM: (child) => {
      (rec.events ??= []).push(parseVendorFact(child, ctx, 'Excommunicated'));
    },
    _MISN: (child) => {
      (rec.events ??= []).push(parseVendorFact(child, ctx, 'Mission'));
    },
    _UNKN: (child) => {
      (rec.identifiers ??= []).push(parseUniqueIdentifier(child));
    },
    SEX: (child) => {
      const table = (ctx.version === '7.0' ? SEX_ENUM_VALUES : SEX_551) as Readonly<
        Record<'M' | 'F' | 'U' | 'X' | 'N', string>
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
    applyLegacyIndividualTags(rec, handlers, ctx);
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
