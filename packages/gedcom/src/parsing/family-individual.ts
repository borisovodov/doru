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
} from '../enumerations';
import type {
  EventDetail,
  FamilyEventDetail,
  FamilyEventStructure,
  FamilyPartnerLink,
  FamilyRecord,
  IndividualEventDetail,
  IndividualEventStructure,
  IndividualRecord,
  InternetSearchStructure,
  MarriageStatusStructure,
  NameTypeStructure,
  Note,
  WebTagStructure,
} from '../structures';
import type {
  Ctx,
} from './context';
import {
  dispatch,
  addExtension,
  noPayload,
  parseImportReference,
  req,
  reqPtr,
  reqText,
  resolvePtr,
} from './context';
import {
  SEX_551,
  SEX_70,
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
  parsePlaceStructure,
} from './names-places';
import {
  parseMultimediaLink,
  parsePrivacyFlag,
  parseSourceCitation,
  parseUsmCode,
  parseUsmFlag,
  parseVendorFlag,
} from './sources-media';
import {
  parseAssociation,
  parseGrampsAssociation,
  parseChangeDate,
  parseCreationDate,
  parseDateStructure,
  parseExternalIdentifier,
  parseNonEvent,
  parseNoteStructure,
  parseReferenceIdentifier,
  parseUniqueIdentifier,
  parseAge,
} from './substructures';
import {
  USM_UNION_KINDS,
} from './events';
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
  let lastPartner: FamilyPartnerLink | undefined;
  const handlers: Record<string, (child: RawNode) => void> = {
    RESN: (child) => {
      rec.restriction = parseListEnum(reqText(child), RESTRICTION_ENUM_VALUES, ctx.version, child.position);
    },
    HUSB: (child) => {
      rec.husband = parseFamilyPartnerLink(child, ctx);
      lastPartner = rec.husband;
    },
    WIFE: (child) => {
      rec.wife = parseFamilyPartnerLink(child, ctx);
      lastPartner = rec.wife;
    },
    CHIL: (child) => {
      (rec.children ??= []).push(parseFamilyChildLink(child, ctx));
    },
    SUBM: (child) => {
      (rec.submitters ??= []).push(reqPtr(child, ctx));
      // A pointer line has no standard children; keep any vendor
      // children verbatim as record extensions instead of discarding
      // them (see the HEAD.SUBM handling in parsing/header.ts).
      for (const grandchild of child.children) {
        addExtension(rec, grandchild, ctx);
      }
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
      // The marriage status (see MarriageStatusStructure): the bare
      // status line of Legacy/AQ/Ages!/GDO/webtrees, or the full
      // GEDCOM-L FAM F7 STATUS_STRUCTURE with the DATE, PLAC, NOTE and
      // SOUR substructures.
      const entry: MarriageStatusStructure = { payload: reqText(child) };
      dispatch(
        child,
        entry,
        {
          DATE: (grandchild) => {
            entry.date = parseDateStructure(grandchild, ctx);
          },
          PLAC: (grandchild) => {
            entry.place = parsePlaceStructure(grandchild, ctx);
          },
          NOTE: (grandchild) => {
            (entry.notes ??= []).push(parseNoteStructure(grandchild, ctx));
          },
          SOUR: (grandchild) => {
            (entry.citations ??= []).push(parseSourceCitation(grandchild, ctx));
          },
        },
        ctx,
        ['DATE', 'PLAC'],
      );
      (rec.marriageStatuses ??= []).push(entry);
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
    _WITN: (child) => {
      // The German GEDCOM-L agreement ASSO A4: the witnesses of the
      // family as free text (see FamilyRecord.witnesses).
      (rec.witnesses ??= []).push(reqText(child));
    },
    _GODT: (child) => {
      // GES2000: the godparents and witnesses of the family as free
      // text ("Paten und Zeugen als Text", the GenWiki
      // "GEDCOM/_Nutzerdef-Tag" table) — the same slot `_WITN`
      // carries (see FamilyRecord.witnesses).
      (rec.witnesses ??= []).push(reqText(child));
    },
    _MARRNAME: (child) => {
      // Legacy Family Tree: the married name of one partner, written
      // directly after the HUSB/WIFE line it refers to (see
      // FamilyPartnerLink.name). Without a preceding partner line the
      // reference is undefined and the tag stays a generic extension.
      if (lastPartner === undefined) {
        addExtension(rec, child, ctx);
        return;
      }
      lastPartner.name = parsePersonalNameStructure(child, ctx);
    },
    _MARRNAMEHUSB: (child) => {
      // Familienbuch: the married name of the husband, written like the
      // Legacy `_MARRNAME` (the GenWiki "GEDCOM/_Nutzerdef-Tag" table:
      // https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag).
      if (lastPartner === undefined) {
        addExtension(rec, child, ctx);
        return;
      }
      lastPartner.name = parsePersonalNameStructure(child, ctx);
    },
    _MARRNAMEWIFE: (child) => {
      // Familienbuch: the married name of the wife; same convention as
      // `_MARRNAMEHUSB`.
      if (lastPartner === undefined) {
        addExtension(rec, child, ctx);
        return;
      }
      lastPartner.name = parsePersonalNameStructure(child, ctx);
    },
    _SUBM: (child) => {
      // GDO: a pointer to the submitter record — the vendor spelling
      // of the standard SUBM slot (see FamilyRecord.submitters).
      (rec.submitters ??= []).push(reqPtr(child, ctx));
    },
    _IMPF: (child) => {
      // GDO: the import-file reference (see FamilyRecord.importReference).
      rec.importReference = parseImportReference(child, ctx);
    },
    _CREA: (child) => {
      // Heredis: the date the record was created (see
      // FamilyRecord.createdAt).
      rec.createdAt = reqText(child);
    },
    _COML: (child) => {
      pushVendorFamilyEvent(rec, child, ctx, 'MARR', 'Common law marriage');
    },
    _MBON: (child) => {
      pushVendorFamilyEvent(rec, child, ctx, 'EVEN', 'Marriage bond');
    },
    _MARI: (child) => {
      // BKW6+ / webtrees: the marriage intention — a FAM EVEN like the
      // standard MARB/MARC/MARL family (see the GenWiki
      // "GEDCOM/_Nutzerdef-Tag" table).
      pushVendorFamilyEvent(rec, child, ctx, 'EVEN', 'Marriage intention');
    },
    _CREAT: (child) => {
      // GenPlus: the date the record was created (see
      // FamilyRecord.createdAt).
      rec.createdAt = reqText(child);
    },
    _SEPR: (child) => {
      pushVendorFamilyEvent(rec, child, ctx, 'EVEN', 'Separated');
    },
    _TAG2: (child) => {
      setMark(rec, 0, child);
    },
    _TAG3: (child) => {
      setMark(rec, 1, child);
    },
    _TAG4: (child) => {
      setMark(rec, 2, child);
    },
    _TAG5: (child) => {
      setMark(rec, 3, child);
    },
    _TAG6: (child) => {
      setMark(rec, 4, child);
    },
    _TAG7: (child) => {
      setMark(rec, 5, child);
    },
    _TAG8: (child) => {
      setMark(rec, 6, child);
    },
    _TAG9: (child) => {
      setMark(rec, 7, child);
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
      (rec.attributes ??= []).push(parseFamilyChildCount(child, ctx));
    };
    handlers["RESI"] = (child) => {
      (rec.attributes ??= []).push(parseFamilyResidence(child, ctx));
    };
    handlers["FACT"] = (child) => {
      (rec.attributes ??= []).push(parseFamilyFact(child, ctx));
    };
    handlers["SNOTE"] = (child) => {
      // The 7.0 FAMILY_RECORD carries <<NOTE_STRUCTURE>> {0:M} (GEDCOM
      // 7.0 §3.2.2); 5.5.1 stays strict.
      (rec.notes ??= []).push(parseNoteStructure(child, ctx));
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
      (rec.attributes ??= []).push(parseFamilyChildCount(child, ctx));
    };
    handlers["ASSO"] = (child) => {
      // GEDCOM 5.5EL adds an ASSO slot to the FAM_RECORD — the people
      // associated with the family ("witnesses of a marriage, priests,
      // registrars"; the GEDCOM 5.5EL spec, e.g. the English GenWiki
      // page "Gedcom 5.5EL":
      // http://wiki-en.genealogy.net/Gedcom_5.5EL). The 5.5.1 FAM
      // grammar has no ASSO, so the file is 5.5EL-flavoured; the
      // association normalizes exactly like the GEDCOM-L `_ASSO`
      // spelling (agreement A3) and is written back as `_ASSO`.
      (rec.associations ??= []).push(parseGrampsAssociation(child, ctx));
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
    handlers['UTYP'] = (child) => {
      // USM6: the kind of relationship the partners are in (see
      // FamilyRecord.unionKind).
      rec.unionKind = parseUsmCode(child, 'UTYP', USM_UNION_KINDS);
    };
    applyLegacyFamilyTags(rec, handlers, ctx);
  }
  dispatch(
    node,
    rec,
    handlers,
    ctx,
    ctx.version === '7.0'
      ? ['RESN', 'HUSB', 'WIFE', 'CHAN', 'CREA', '_MSTAT', '_MEND']
      : ['RESN', 'NCHI', 'HUSB', 'WIFE', 'CHAN', 'RIN', '_MSTAT', '_MEND', 'UTYP'],
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

/** The Ahnenblatt `_INET` internet-search block (see
 *  IndividualRecord.internetSearch / InternetSearchStructure): the
 *  five substructures are kept verbatim as free text (their individual
 *  meanings are not separately catalogued). */
function parseInternetSearch(node: RawNode, ctx: Ctx): InternetSearchStructure {
  noPayload(node);
  const out: InternetSearchStructure = { tag: '_INET' };
  dispatch(
    node,
    out,
    {
      _MHRM: (child) => {
        out.mhrm = reqText(child);
      },
      _MHSM: (child) => {
        out.mhsm = reqText(child);
      },
      _MHAV: (child) => {
        out.mhav = reqText(child);
      },
      _RDATE: (child) => {
        out.researchDate = reqText(child);
      },
      _SDATE: (child) => {
        out.searchDate = reqText(child);
      },
    },
    ctx,
    ['_MHRM', '_MHSM', '_MHAV', '_RDATE', '_SDATE'],
  );
  return out;
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

/** A vendor person link (_LEGA): an ASSO pointer with the given RELA
 *  descriptor when the vendor writes none (the Gramps ASSO convention,
 *  like the association rules of vendor-tags.ts). */
function pushVendorAssociation(rec: IndividualRecord, node: RawNode, ctx: Ctx, relationship: string): void {
  const link = parseGrampsAssociation(node, ctx);
  link.role = link.role ?? { payload: 'OTHER', phrase: relationship };
  (rec.associations ??= []).push(link);
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
      addExtension(rec, child, ctx);
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

/** An INDI-level legacy private note tag (NOTP): an inline NOTE with the
 *  privacy flag set (see Note.private). */
function pushLegacyPrivateNote(rec: IndividualRecord, node: RawNode, ctx: Ctx): void {
  const raw = node.value.kind === 'text' ? node.value.text : '';
  if (raw === '') {
    fail('structure.missing-payload', `The ${node.tag} line requires a text value`, node.position);
  }
  const note: Note = { tag: 'NOTE', payload: raw, private: true };
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
        case 'privateNote':
          pushLegacyPrivateNote(rec, child, ctx);
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
        case 'fsftid':
          // The RootsMagic non-underscore FSFTID: the same slot _FSFTID
          // carries (see IndividualRecord.familySearchId).
          rec.familySearchId = reqText(child);
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
      if (rule.kind === 'note') {
        // The phpGedView COMM comment: an inline FAM note (see the
        // vendor-tags module JSDoc for the source).
        const raw = child.value.kind === 'text' ? child.value.text : '';
        if (raw === '') {
          fail('structure.missing-payload', `The ${child.tag} line requires a text value`, child.position);
        }
        const note: Note = { tag: 'NOTE', payload: raw };
        dispatch(
          child,
          note,
          {
            SOUR: (grandchild) => {
              (note.citations ??= []).push(parseSourceCitation(grandchild, ctx));
            },
          },
          ctx,
        );
        (rec.notes ??= []).push(note);
        return;
      }
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

/** Sets the n-th tag mark, padding the gaps (see IndividualRecord.marks /
 *  FamilyRecord.marks). */
function setMark(rec: { marks?: Text[] }, index: number, node: RawNode): void {
  const marks = (rec.marks ??= []);
  while (marks.length <= index) {
    marks.push('');
  }
  marks[index] = reqText(node);
}

/** Parses the FH record flags: a `_FLGS` block whose children each
 *  spell one flag as the generated `__` tag plus the flag name as the
 *  payload (see IndividualRecord.recordFlags). */
function parseFhRecordFlags(rec: IndividualRecord, node: RawNode): void {
  noPayload(node);
  for (const flag of node.children) {
    if (flag.children.length > 0) {
      fail('structure.unknown-tag', `The tag ${(flag.children[0] as RawNode).tag} is not allowed under ${flag.tag}`, (flag.children[0] as RawNode).position);
    }
    (rec.recordFlags ??= []).push({ tag: flag.tag, name: reqText(flag) });
  }
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
    _FID: (child) => {
      // MFT7 / Familienbuch: the FamilySearch Family Tree person id
      // (the GenWiki "GEDCOM/_Nutzerdef-Tag" table:
      // https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag) — the same
      // slot _FSFTID carries.
      rec.familySearchId = reqText(child);
    },
    _AHNNR: (child) => {
      // GES2000: the ancestor-table (Kekulé) number — the same slot
      // Ancestris' _SOSA carries (see IndividualRecord.sosaNumber).
      rec.sosaNumber = reqText(child);
    },
    _CREAT: (child) => {
      // GenPlus: the date the record was created (see
      // IndividualRecord.createdAt).
      rec.createdAt = reqText(child);
    },
    _CREA: (child) => {
      // MFT7 (as `_CRE`) and Heredis: the date the record or event was
      // created — the same slot `_CREAT` carries (see the GenWiki
      // "GEDCOM/_Nutzerdef-Tag" catalog:
      // https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag).
      rec.createdAt = reqText(child);
    },
    _CRE: (child) => {
      // MFT7: the date the record or event was created (same slot and
      // source as `_CREA`).
      rec.createdAt = reqText(child);
    },
    _BKM: (child) => {
      // MFT7: the person is bookmarked (see IndividualRecord.bookmarked).
      rec.bookmarked = parseVendorFlag(child, '_BKM');
    },
    _STP: (child) => {
      // MFT7: the start person (see IndividualRecord.startPerson).
      rec.startPerson = parseVendorFlag(child, '_STP');
    },
    _ADPF: (child) => {
      // BKW6+: the person was adopted by their father (see
      // IndividualRecord.adoptedByFather).
      rec.adoptedByFather = parseVendorFlag(child, '_ADPF');
    },
    _ADPM: (child) => {
      // BKW6+: the person was adopted by their mother (see
      // IndividualRecord.adoptedByMother).
      rec.adoptedByMother = parseVendorFlag(child, '_ADPM');
    },
    _PRIVATE: (child) => {
      // TNG: the person is marked private (see the webtrees
      // per-vendor custom-tag registry, TheNextGeneration.php:
      // https://github.com/fisharebest/webtrees/blob/main/app/CustomTags/TheNextGeneration.php);
      // the flag projects onto the standard RESN PRIVACY restriction,
      // like the event `_PRIV` does.
      if (parsePrivacyFlag(child, '_PRIVATE')) {
        const restriction = (rec.restriction ??= []);
        if (!restriction.includes('PRIVACY')) {
          restriction.push('PRIVACY');
        }
      }
    },
    _GODP: (child) => {
      // The German GEDCOM-L agreement ASSO A4: the godparents of the
      // individual as free text at the record level (see
      // IndividualRecord.godparents).
      (rec.godparents ??= []).push(reqText(child));
    },
    _WITN: (child) => {
      // The German GEDCOM-L agreement ASSO A4: the witnesses of the
      // individual as free text at the record level (see
      // IndividualRecord.witnesses).
      (rec.witnesses ??= []).push(reqText(child));
    },
    _WEBTAG: (child) => {
      // RootsMagic: an external web link, the NAME text plus the URL
      // address (see IndividualRecord.webTags).
      const tag: WebTagStructure = { url: reqText(req(child, 'URL')) };
      dispatch(
        child,
        tag,
        {
          NAME: (grandchild) => {
            tag.name = reqText(grandchild);
          },
          URL: () => undefined,
        },
        ctx,
        ['NAME', 'URL'],
      );
      (rec.webTags ??= []).push(tag);
    },
    _FLGS: (child) => {
      // FH: the record flags (see IndividualRecord.recordFlags).
      parseFhRecordFlags(rec, child);
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
    _CALL: (child) => {
      pushVendorName(rec, child, ctx, 'OTHER', 'Called name');
    },
    _FRKA: (child) => {
      pushVendorName(rec, child, ctx, 'OTHER', 'Formerly known as');
    },
    _HNM: (child) => {
      pushVendorName(rec, child, ctx, 'OTHER', 'Hebrew name');
    },
    _INDG: (child) => {
      pushVendorName(rec, child, ctx, 'OTHER', 'Indigenous name');
    },
    _LNCH: (child) => {
      pushVendorName(rec, child, ctx, 'OTHER', 'Legal name change');
    },
    _HEIRATNAME: (child) => {
      // AF2000: the name after marriage — the same slot _MARNM carries.
      pushVendorName(rec, child, ctx, 'MARRIED');
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
    _MEDC: (child) => {
      // PAF5 (also written by BKW6+ and webtrees): a medical condition,
      // a FACT with the TYPE "Medical condition" — the same
      // normalization as the FTM _MDCL twin, kept as FACT (a
      // condition, not an event). The GenWiki "GEDCOM/_Nutzerdef-Tag"
      // table of the GEDCOM-L working group documents the meaning
      // ("Medical condition", https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag);
      // the Legacy "User-Defined GEDCOM Tags" catalog lists the tag
      // without a description
      // (https://www.legacyfamilytree.se/WEB_US/user_defined_gedcom_tags.htm).
      pushVendorAttribute(rec, child, ctx, 'FACT', 'Medical condition');
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
    // The further vendor fact tags of the closed catalogs (the Legacy
    // "User-Defined GEDCOM Tags" help:
    // https://www.legacyfamilytree.se/WEB_US/user_defined_gedcom_tags.htm
    // and the GenWiki "GEDCOM/_Nutzerdef-Tag" table:
    // https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag), typed like the
    // FTM set above:
    // - _ATTR (Family Historian: a custom attribute with a TYPE child,
    //   the FHUG "GEDCOM Extension List":
    //   https://www.fhug.org.uk/kb/kb-article/gedcom-extension-list/)
    //   becomes FACT with the TYPE;
    // - _MILI (Brother's Keeper, webtrees: military) becomes the same
    //   EVEN + TYPE "Military" the _MILT twin carries;
    // - _HOL (webtrees, phpGedView: the person was a Holocaust victim)
    //   and _ELEC (FTW8: elected to an office) become FACT + TYPE;
    // - _EYES (Generations: the eye color) becomes the same
    //   FACT + TYPE "Eye color" the _EYEC twin carries;
    // - _BUERGERORT and _HEIM (Swiss "Bürgerort", the place of
    //   citizenship: Ahnenforscher 2000, Stammbaumdrucker, Familienbuch,
    //   Ahnenblatt and GenPlus) become FACT + TYPE "Bürgerort", the
    //   import form the GEDCOM-L agreement PLAC P8 prescribes;
    // - _LIVING (TNG: the person is living) becomes FACT + TYPE
    //   "Living", like the FTW5 LVG twin.
    _ATTR: (child) => {
      // FH: a custom attribute with a TYPE child — the same FACT + TYPE
      // shape the FTM ATTR rule carries; the TYPE child names the fact.
      pushLegacyIndividualAttribute(rec, child, ctx, 'FACT', 'Attribute');
    },
    _MILI: (child) => {
      (rec.events ??= []).push(parseVendorFact(child, ctx, 'Military'));
    },
    _HOL: (child) => {
      pushVendorAttribute(rec, child, ctx, 'FACT', 'Holocaust');
    },
    _ELEC: (child) => {
      pushVendorAttribute(rec, child, ctx, 'FACT', 'Elected');
    },
    _EYES: (child) => {
      pushVendorAttribute(rec, child, ctx, 'FACT', 'Eye color');
    },
    _BUERGERORT: (child) => {
      pushVendorAttribute(rec, child, ctx, 'FACT', 'Bürgerort');
    },
    _HEIM: (child) => {
      pushVendorAttribute(rec, child, ctx, 'FACT', 'Bürgerort');
    },
    _LIVING: (child) => {
      // The TNG living flag: a presence-style marker, so a bare tag
      // gets the `Y` payload the other flag conventions use (the
      // FACT grammar requires a value).
      const raw = child.value.kind === 'text' ? child.value.text : 'Y';
      const detail: EventDetail = {};
      const handlers = eventDetailHandlers(ctx, detail);
      handlers['TYPE'] = () => undefined;
      dispatch(child, detail, handlers, ctx);
      (rec.attributes ??= []).push({
        tag: 'FACT',
        payload: raw,
        type: 'Living',
        ...(Object.keys(detail).length === 0 ? {} : { detail: detail as IndividualEventDetail }),
      });
    },
    _LEBENSORT: (child) => {
      // AF2000 / Stammbaumdrucker: the Lebensort — the location of
      // residency ("Location of residency", the GenWiki
      // "GEDCOM/_Nutzerdef-Tag" table), a FACT with the TYPE.
      pushVendorAttribute(rec, child, ctx, 'FACT', 'Lebensort');
    },
    _REL: (child) => {
      // GES2000: the Kindstand — the child status of the person
      // (e.g. "a" = adopted); the same normalization as the Reunion
      // `CSTA` fact.
      pushVendorAttribute(rec, child, ctx, 'FACT', 'Child status');
    },
    _NCHI: (child) => {
      // GES2000: the person's running number as a child in the family
      // ("Laufende Nummer als Kind in der Familie"), a FACT.
      pushVendorAttribute(rec, child, ctx, 'FACT', 'Birth order');
    },
    _NOTH: (child) => {
      // GES2000: the Heimatort as a text field, a FACT with the TYPE.
      pushVendorAttribute(rec, child, ctx, 'FACT', 'Heimatort');
    },
    _SURN: (child) => {
      // GES2000: the Sippenname — the clan name, a NAME with TYPE
      // OTHER and the PHRASE label.
      pushVendorName(rec, child, ctx, 'OTHER', 'Clan name');
    },
    _INET: (child) => {
      // Ahnenblatt: the internet-search details block (see
      // IndividualRecord.internetSearch / InternetSearchStructure).
      rec.internetSearch = parseInternetSearch(child, ctx);
    },
    _SUBM: (child) => {
      // GDO: a pointer to the submitter record — the vendor spelling
      // of the standard SUBM slot (see IndividualRecord.submitters).
      (rec.submitters ??= []).push(reqPtr(child, ctx));
    },
    _IMPF: (child) => {
      // GDO: the import-file reference (see
      // IndividualRecord.importReference).
      rec.importReference = parseImportReference(child, ctx);
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
    _EMAIL: (child) => {
      // Brother's Keeper, Family Origins, PAF: the individual's e-mail
      // address under INDI (see IndividualRecord.email).
      (rec.email ??= []).push(reqText(child));
    },
    _INIT: (child) => {
      // Ancestry.com Family Trees: the LDS initiatory ordinance, the
      // vendor spelling of the 7.0 INIL (the webtrees per-vendor
      // custom-tag registry, Ancestry.php:
      // https://github.com/fisharebest/webtrees/blob/main/app/CustomTags/Ancestry.php).
      // Parsed like the INIL ordinance; 5.5.1 has no INIL, so the
      // exporter writes the `_INIT` spelling back there.
      (rec.ordinances ??= []).push(parseIndividualOrdinance(child, ctx, 'INIL'));
    },
    _ORDI: (child) => {
      // Ancestry.com Family Trees: the ordination event, spelled with
      // the underscore (same source as `_INIT`); normalizes into the
      // standard ORDN event of GEDCOM 5.5.1 §2 (p.28) / 7.0 §3.3.1. The
      // vendor asserts the event with a `Y` payload, which the 5.5.1
      // ORDN grammar has no slot for (only ADOP/BIRT/CHR/DEAT take the
      // Y assertion, GEDCOM 5.5.1 §2 p.34); the assertion is dropped
      // like the standard event payloads.
      const asserted = child.value.kind === 'text' && child.value.text === 'Y';
      (rec.events ??= []).push(parseIndividualEvent(asserted ? { ...child, value: { kind: 'absent' } } : child, ctx, 'ORDN'));
    },
    _ORIG: (child) => {
      // Ancestry.com Family Trees: the person's origin, a FACT (same
      // source as `_INIT`).
      pushLegacyIndividualAttribute(rec, child, ctx, 'FACT', 'Origin');
    },
    _DEST: (child) => {
      // Ancestry.com Family Trees: the person's destination, a FACT
      // (same source as `_INIT`).
      pushLegacyIndividualAttribute(rec, child, ctx, 'FACT', 'Destination');
    },
    _LEGA: (child) => {
      // Reunion: the legatee of the person's will — an association like
      // the Gramps ASSO convention (the webtrees per-vendor custom-tag
      // registry, Reunion.php:
      // https://github.com/fisharebest/webtrees/blob/main/app/CustomTags/Reunion.php).
      pushVendorAssociation(rec, child, ctx, 'Legatee');
    },
    _PURC: (child) => {
      // Reunion: the purchase of land, an event (same source as _LEGA).
      pushLegacyIndividualEvent(rec, child, ctx, 'Land purchase');
    },
    _SALE: (child) => {
      // Reunion: the sale of land, an event (same source as _LEGA).
      pushLegacyIndividualEvent(rec, child, ctx, 'Land sale');
    },
    SEX: (child) => {
      const table = (ctx.version === '7.0' ? SEX_70 : SEX_551) as Readonly<
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
      // A pointer line has no standard children; keep any vendor
      // children verbatim as record extensions instead of discarding
      // them (see the HEAD.SUBM handling in parsing/header.ts).
      for (const grandchild of child.children) {
        addExtension(rec, grandchild, ctx);
      }
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
    handlers["SNOTE"] = (child) => {
      // The 7.0 INDIVIDUAL_RECORD carries <<NOTE_STRUCTURE>> {0:M}
      // (GEDCOM 7.0 §3.2.2); 5.5.1 stays strict.
      (rec.notes ??= []).push(parseNoteStructure(child, ctx));
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
    handlers['SIGN'] = (child) => {
      // USM6: the person can sign (see IndividualRecord.canSign).
      rec.canSign = parseUsmFlag(child, 'SIGN');
    };
    handlers["EMAIL"] = (child) => {
      // PAF writes the individual's e-mail address under INDI with the
      // standard EMAIL tag (the webtrees per-vendor custom-tag registry,
      // PersonalAncestralFile.php:
      // https://github.com/fisharebest/webtrees/blob/main/app/CustomTags/PersonalAncestralFile.php);
      // the Brother's Keeper spelling is `_EMAIL` — both normalize into
      // IndividualRecord.email.
      (rec.email ??= []).push(reqText(child));
    };
    handlers["ADDR"] = (child) => {
      // PAF writes the person's contact address directly under INDI
      // (same source as EMAIL above). No typed slot — the address and
      // its ADR1/CITY/... children are kept verbatim as record
      // extensions (written back on 5.5.1 output, dropped on 7.0 where
      // INDI has no address position either).
      addExtension(rec, child, ctx);
    };
    handlers["PHON"] = (child) => {
      // PAF: the person's phone number under INDI (same source); kept
      // verbatim as a record extension.
      addExtension(rec, child, ctx);
    };
    handlers["FAX"] = (child) => {
      // PAF: the person's fax number under INDI (same source); kept
      // verbatim as a record extension.
      addExtension(rec, child, ctx);
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
    ctx.version === '7.0'
      ? ['RESN', 'SEX', 'CHAN', 'CREA', '_BKM', '_STP', '_FLGS']
      : ['RESN', 'SEX', 'CHAN', 'RIN', 'RFN', 'AFN', '_BKM', '_STP', '_FLGS', 'SIGN'],
  );
  return rec;
}
