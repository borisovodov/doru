/**
 * Parser section: Family and individual records.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). Every function here
 * maps a raw-tree node onto the typed model and fails with a typed
 * error naming the offending line.
 */

import type {
  AssociationStructure,
  EventDetail,
  ExtensionStructure,
  FamilyEventDetail,
  FamilyPartnerLink,
  FamilyRecord,
  IndividualEventDetail,
  IndividualEventStructure,
  IndividualRecord,
  InternetSearchStructure,
  CorrespondenceStructure,
  MarriageStatusStructure,
  RecordFlagStructure,
  NameTypeStructure,
  Note,
  WebTagStructure,
  WebLinkStructure,
} from '../structures';
import type { Ctx } from './context';
import { dispatch, addExtension, noPayload, one, parseImportReference, reqPtr, reqText, resolvePtr } from './context';
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
  parseIndividualAttribute,
  parseIndividualEvent,
  parseIndividualOrdinance,
  parseSpouseFamilyLink,
  parseSpouseSealing,
  parseChildSealing,
} from './events';
import { parseTodoStructure } from './todo';
import { parseEvidenceEvent, parseEvidenceReference, parseOccurrenceReference, parseTagLink } from './evidence';
import { parseGenoproContainer } from './genopro';
import { parseAddressStructure } from './substructures';
import type { RawNode } from './lines';
import { parsePersonalNameStructure, parsePlaceStructure } from './names-places';
import {
  parseMultimediaLink,
  parsePrivacyFlag,
  parseSourceCitation,
  parseUsmCode,
  parseYNFlag,
  parseUsmFlagLenient,
  parseVendorFlag,
} from './sources-media';
import {
  parseAssociation,
  parseChangeDate,
  parseCreationDateLenient,
  parseDateStructure,
  parseExternalIdentifier,
  parseNonEvent,
  parseNoteStructure,
  parseReferenceIdentifier,
  parseUniqueIdentifier,
  parseAgeStructure,
} from './substructures';
import { USM_UNION_KINDS } from './events';
import { parseEnum, parsePersonalName, parseRestrictionList } from './types';
import { LEGACY_FAMILY_TAGS, LEGACY_INDIVIDUAL_TAGS } from './vendor-tags';
import type { EventEnum, NameTypeEnum } from '../enumerations';
import { fail } from '../errors';
import type { Text } from '../primitives';

// ---------------------------------------------------------------------------

export const FAMILY_EVENT_TAGS = [
  'ANUL',
  'CENS',
  'DIV',
  'DIVF',
  'ENGA',
  'MARB',
  'MARC',
  'MARL',
  'MARR',
  'MARS',
  'EVEN',
];
export const INDIVIDUAL_EVENT_TAGS = [
  'ADOP',
  'BAPM',
  'BARM',
  'BASM',
  'BIRT',
  'BLES',
  'BURI',
  'CENS',
  'CHR',
  'CHRA',
  'CONF',
  'CREM',
  'DEAT',
  'EMIG',
  'FCOM',
  'GRAD',
  'IMMI',
  'NATU',
  'ORDN',
  'PROB',
  'RETI',
  'WILL',
  'EVEN',
];
export const INDIVIDUAL_ATTRIBUTE_TAGS = [
  'CAST',
  'DSCR',
  'EDUC',
  'IDNO',
  'NATI',
  'NCHI',
  'NMR',
  'OCCU',
  'PROP',
  'RELI',
  'RESI',
  'SSN',
  'TITL',
  'FACT',
];

export function parseFamilyRecord(node: RawNode, ctx: Ctx): FamilyRecord {
  noPayload(node);
  const rec: FamilyRecord = { tag: 'FAM', ...(node.xref === undefined ? {} : { xref: node.xref }) };
  let lastPartner: FamilyPartnerLink | undefined;
  const handlers: Record<string, (child: RawNode) => void> = {
    RESN: (child) => {
      rec.restriction = parseRestrictionList(reqText(child), child.position);
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
    SLGC: (child) => {
      // The child sealing under the FAM record (see
      // ChildSealingOrdinance).
      (rec.childSealings ??= []).push(parseChildSealing(child, ctx));
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
    _MHID: (child) => {
      // MyHeritage: the family's tree identifier (see
      // FamilyRecord.myHeritageId).
      rec.myHeritageId = reqText(child);
    },
    _OCREF: (child) => {
      // The gedcom-occurrences extension lists FAM as an `_OCREF`
      // superstructure (see FamilyRecord.occurrences).
      (rec.occurrences ??= []).push(parseOccurrenceReference(child, ctx));
    },
    _EVREF: (child) => {
      // The gedcom-evidence `_EVREF.yaml` lists FAM as a
      // superstructure (see FamilyRecord.evidence).
      (rec.evidence ??= []).push(parseEvidenceReference(child, ctx));
    },
    _EVID: (child) => {
      // The gedcom-evidence v1 link spelling (see the INDI handler).
      if (child.value.kind === 'pointer') {
        (rec.evidence ??= []).push(parseEvidenceReference(child, ctx));
      } else {
        addExtension(rec, child, ctx);
      }
    },
    _TAG: (child) => {
      // The gedcom-tags application link (see FamilyRecord.tagLinks);
      // a text-payload `_TAG` under FAM stays a generic extension.
      if (child.value.kind === 'pointer') {
        (rec.tagLinks ??= []).push(parseTagLink(child, ctx));
        return;
      }
      addExtension(rec, child, ctx);
    },
    _CONF: (child) => {
      // The confidence level of the family record (see
      // FamilyRecord.confidence); a value-less line stays a generic
      // extension.
      if (child.value.kind === 'text') {
        rec.confidence = child.value.text;
      } else {
        addExtension(rec, child, ctx);
      }
    },
    _CURRENT: (child) => {
      // The current-family flag (see FamilyRecord.current).
      rec.current = parseVendorFlag(child, '_CURRENT');
    },
    _PRIMARY: (child) => {
      // The primary-family flag (see FamilyRecord.primary).
      rec.primary = parseVendorFlag(child, '_PRIMARY');
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
        fail(
          'enum.invalid-value',
          `The _NONE value must be Y or absent (the couple had no children), got "${child.value.text}"`,
          child.position,
        );
      }
      for (const grandchild of child.children) {
        // Full leniency: unexpected children stay generic extensions.
        addExtension(rec, grandchild, ctx);
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
      // union; no other FAM _TYPE value is defined there. Other
      // programs write relationship-kind values under FAM _TYPE
      // anyway — a value other than same-sex is kept as a generic
      // extension of the record instead of failing the whole import
      // (the MSTAT conflict policy).
      const value = reqText(child).toUpperCase();
      if (value === 'SAME-SEX') {
        rec.sameSexUnion = true;
      } else {
        addExtension(rec, child, ctx);
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
      // family as a pointer; 5.5.1 FAM has no standard ASSO slot.
      (rec.associations ??= []).push(parseAssociation(child, ctx));
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
    _CRE: (child) => {
      // MFT7: the record creation — the structured form (a bare line
      // with the DATE child) or the free text the `_CREA` slot carries.
      if (child.value.kind === 'absent') {
        const created = parseCreationDateLenient(child, ctx);
        if (created === undefined) {
          addExtension(rec, child, ctx);
        } else {
          rec.creationDate = created;
        }
      } else {
        rec.createdAt = reqText(child);
      }
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
      setMark(rec, 0, child, ctx);
    },
    _TAG3: (child) => {
      setMark(rec, 1, child, ctx);
    },
    _TAG4: (child) => {
      setMark(rec, 2, child, ctx);
    },
    _TAG5: (child) => {
      setMark(rec, 3, child, ctx);
    },
    _TAG6: (child) => {
      setMark(rec, 4, child, ctx);
    },
    _TAG7: (child) => {
      setMark(rec, 5, child, ctx);
    },
    _TAG8: (child) => {
      setMark(rec, 6, child, ctx);
    },
    _TAG9: (child) => {
      setMark(rec, 7, child, ctx);
    },
    CHAN: (child) => {
      rec.changeDate = parseChangeDate(child, ctx);
    },
    REFN: (child) => {
      (rec.identifiers ??= []).push(parseReferenceIdentifier(child, ctx));
    },
    _PRMN: (child) => {
      // BKW6+: the family's permanent number, the FAM twin of the
      // typed INDI `_PRMN` (the webtrees per-vendor custom-tag
      // registry, BrothersKeeper.php: `FAM:_PRMN`:
      // https://github.com/fisharebest/webtrees/blob/main/app/CustomTags/BrothersKeeper.php).
      // Normalized into the REFN identifier slot; written back as the
      // standard REFN.
      (rec.identifiers ??= []).push(parseReferenceIdentifier(child, ctx));
    },
    _FA1: (child) => {
      pushFtmFamilyFact(rec, child, ctx, 1);
    },
    _FA2: (child) => {
      pushFtmFamilyFact(rec, child, ctx, 2);
    },
    _FA3: (child) => {
      pushFtmFamilyFact(rec, child, ctx, 3);
    },
    _FA4: (child) => {
      pushFtmFamilyFact(rec, child, ctx, 4);
    },
    _FA5: (child) => {
      pushFtmFamilyFact(rec, child, ctx, 5);
    },
    _FA6: (child) => {
      pushFtmFamilyFact(rec, child, ctx, 6);
    },
    _FA7: (child) => {
      pushFtmFamilyFact(rec, child, ctx, 7);
    },
    _FA8: (child) => {
      pushFtmFamilyFact(rec, child, ctx, 8);
    },
    _FA9: (child) => {
      pushFtmFamilyFact(rec, child, ctx, 9);
    },
    _FA10: (child) => {
      pushFtmFamilyFact(rec, child, ctx, 10);
    },
    _FA11: (child) => {
      pushFtmFamilyFact(rec, child, ctx, 11);
    },
    _FA12: (child) => {
      pushFtmFamilyFact(rec, child, ctx, 12);
    },
    _FA13: (child) => {
      pushFtmFamilyFact(rec, child, ctx, 13);
    },
  };
  handlers['NCHI'] = (child) => {
    (rec.attributes ??= []).push(parseFamilyChildCount(child, ctx));
  };
  handlers['RESI'] = (child) => {
    (rec.attributes ??= []).push(parseFamilyResidence(child, ctx));
  };
  handlers['FACT'] = (child) => {
    (rec.attributes ??= []).push(parseFamilyFact(child, ctx));
  };
  handlers['SNOTE'] = (child) => {
    // The 7.0 FAMILY_RECORD carries <<NOTE_STRUCTURE>> {0:M} (GEDCOM
    // 7.0 §3.2.2); accepted in any file.
    (rec.notes ??= []).push(parseNoteStructure(child, ctx));
  };
  handlers['NO'] = (child) => {
    (rec.nonEvents ??= []).push(parseNonEvent(child, ctx));
  };
  handlers['CREA'] = (child) => {
    const created = parseCreationDateLenient(child, ctx);
    if (created === undefined) {
      addExtension(rec, child, ctx);
    } else {
      rec.creationDate = created;
    }
  };
  handlers['UID'] = (child) => {
    (rec.identifiers ??= []).push(parseUniqueIdentifier(child, ctx));
  };
  handlers['_UID'] = (child) => {
    (rec.identifiers ??= []).push(parseUniqueIdentifier(child, ctx));
  };
  handlers['EXID'] = (child) => {
    (rec.identifiers ??= []).push(parseExternalIdentifier(child, ctx));
  };
  handlers['RIN'] = (child) => {
    rec.automatedRecordId = reqText(child);
  };
  handlers['UTYP'] = (child) => {
    // USM6: the kind of relationship the partners are in (see
    // FamilyRecord.unionKind); the USM6 spelling is accepted in any file
    // spelling in any file.
    rec.unionKind = parseUsmCode(child, 'UTYP', USM_UNION_KINDS);
  };
  handlers['_UTYP'] = (child) => {
    // The underscore write-back spelling of the USM6 UTYP (the USM6
    // wire spelling is non-underscore; see FamilyRecord.unionKind
    // for the export rule). Both spellings are recognized.
    rec.unionKind = parseUsmCode(child, '_UTYP', USM_UNION_KINDS);
  };
  handlers['_UST'] = (child) => {
    // Heredis: the union status of the couple (see
    // FamilyRecord.unionStatus).
    rec.unionStatus = reqText(child);
  };
  handlers['_PREF'] = (child) => {
    // Legacy: the preferred family (see FamilyRecord.preferred).
    rec.preferred = parseYNFlag(child, '_PREF');
  };
  handlers['RELATION'] = (child) => {
    // GenoPro: the kind of the union (Marriage, Divorce,
    // CommittedRelationship, SeparationLegal, Widowed, …) — the same
    // free-text slot Heredis' `_UST` carries (see
    // FamilyRecord.unionStatus).
    rec.unionStatus = reqText(child);
  };
  handlers['_GCID'] = (child) => {
    // GEDitCOM II: the record's id (see FamilyRecord.geditcomId).
    rec.geditcomId = reqText(child);
  };
  handlers['NUMB'] = (child) => {
    // The exporter's running number for the family (see
    // FamilyRecord.sequenceNumber).
    rec.sequenceNumber = reqText(child);
  };
  handlers['_FTSID'] = (child) => {
    // The Swarm family-tree packs: the family's FamilySearch tree id
    // (see FamilyRecord.familyTreeSystemId).
    rec.familyTreeSystemId = reqText(child);
  };
  handlers['QUOT'] = (child) => {
    // A quotation of the family (novel/game character trees write the
    // family's quote under QUOT): kept as an inline NOTE — the FAM
    // FACT structure is 7.0-only and would be dropped on 5.5.1
    // export, while the NOTE round-trips in both versions.
    (rec.notes ??= []).push({ tag: 'NOTE', payload: reqText(child) });
  };
  handlers['RFN'] = (child) => {
    // Pro-Gen writes the reference number with the standard RFN tag
    // under FAM (the webtrees per-vendor custom-tag registry,
    // ProGen.php: `FAM:RFN`); the 5.5.1 and 7.0 FAM grammars have
    // only REFN there, so the value normalizes into the REFN
    // identifier slot and is written back as the standard REFN.
    (rec.identifiers ??= []).push(parseReferenceIdentifier(child, ctx));
  };
  handlers['ASSO'] = (child) => {
    // The 7.0 FAM ASSO and the GEDCOM 5.5EL ASSO slot ("witnesses of a
    // marriage, priests, registrars"; the GEDCOM 5.5EL spec, e.g. the
    // English GenWiki page "Gedcom 5.5EL":
    // http://wiki-en.genealogy.net/Gedcom_5.5EL) parse with the same
    // handlers (see parseAssociation).
    (rec.associations ??= []).push(parseAssociation(child, ctx));
  };
  for (const tag of FAMILY_EVENT_TAGS) {
    handlers[tag] = (child) => {
      (rec.events ??= []).push(parseFamilyEvent(child, ctx, tag));
    };
  }
  applyLegacyFamilyTags(rec, handlers, ctx);
  dispatch(node, rec, handlers, ctx, ['RESN', 'HUSB', 'WIFE', 'CHAN', '_MSTAT', '_MEND']);
  return rec;
}

/**
 * A vendor name tag (`_MARNM`, `_AKA`, …): normalized into a NAME with
 * the given type; see the JSDoc of PersonalNameStructure.
 */
function pushVendorName(
  rec: IndividualRecord,
  node: RawNode,
  _ctx: Ctx,
  nameType: NameTypeEnum,
  phrase?: string,
): void {
  const type: NameTypeStructure = { payload: nameType };
  if (phrase !== undefined) {
    type.phrase = phrase;
  }
  (rec.names ??= []).push({
    tag: 'NAME',
    payload: parsePersonalName(reqText(node), node.position),
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
    ...(Object.keys(detail).length === 0 ? {} : { detail: detail }),
  });
}

/** A vendor person link (_LEGA): an ASSO pointer with the given RELA
 *  descriptor when the vendor writes none (the Gramps ASSO convention,
 *  like the association rules of vendor-tags.ts). */
function pushVendorAssociation(rec: IndividualRecord, node: RawNode, ctx: Ctx, relationship: string): void {
  const link = parseAssociation(node, ctx);
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
    detail.age = parseAgeStructure(child, ctx);
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
function pushLegacyIndividualAttribute(
  rec: IndividualRecord,
  node: RawNode,
  ctx: Ctx,
  tag: 'FACT' | 'EDUC',
  type: string,
): void {
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
    ...(Object.keys(detail).length === 0 ? {} : { detail: detail }),
  });
}

/** An INDI-level legacy person link: a pointer payload becomes an ASSO
 *  with the RELA descriptor; a text payload becomes FACT + TYPE. */
function pushLegacyAssociation(rec: IndividualRecord, node: RawNode, ctx: Ctx, relationship: string): void {
  if (node.value.kind === 'pointer') {
    const association: AssociationStructure = {
      tag: 'ASSO',
      individual: resolvePtr(node.value.pointer, ctx, node),
      relationship,
    };
    for (const child of node.children) {
      // Full leniency: unexpected children stay generic extensions.
      addExtension(association, child, ctx);
    }
    (rec.associations ??= []).push(association);
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
    // Full leniency: any other child stays a generic extension.
    addExtension(rec, child, ctx);
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

/**
 * The FTM/FTW `_FA1`–`_FA13` user fact under INDI ("definitions for
 * facts", the Legacy "User-Defined GEDCOM Tags" help; the GenWiki
 * "GEDCOM/_Nutzerdef-Tag" table reads "Fakten — FACT in 5.5.1"; the
 * webtrees per-vendor custom-tag registry, FamilyTreeMaker.php, lists
 * `INDI:_FA1` … `INDI:_FA13`). A fact entry whose label is declared
 * in the HEAD.SCHEMA block (see Header.schema53): the TYPE resolves
 * from the schema label of the context chain `INDI/_FAn`, falling
 * back to `Fact n`. The payload text is kept.
 */
function pushFtmFact(rec: IndividualRecord, node: RawNode, ctx: Ctx, n: number): void {
  const type = ctx.schema53Labels.get(`INDI/${node.tag}`) ?? `Fact ${n}`;
  pushLegacyIndividualAttribute(rec, node, ctx, 'FACT', type);
}

/**
 * The FTM/FTW `_FA1`–`_FA13` user fact under FAM (same sources as the
 * INDI form): a FAM EVEN with the TYPE resolved from the schema label
 * of the context chain `FAM/_FAn` (fallback `Fact n`). FAM EVEN
 * carries the fact in both versions, unlike FAM FACT which is
 * 7.0-only.
 */
function pushFtmFamilyFact(rec: FamilyRecord, node: RawNode, ctx: Ctx, n: number): void {
  const type = ctx.schema53Labels.get(`FAM/${node.tag}`) ?? `Fact ${n}`;
  const detail: EventDetail = {};
  const handlers = eventDetailHandlers(ctx, detail);
  handlers['TYPE'] = () => undefined;
  dispatch(node, detail, handlers, ctx);
  const raw = node.value.kind === 'text' ? node.value.text : '';
  const familyDetail: FamilyEventDetail = {
    ...(Object.keys(detail).length === 0 ? {} : { detail }),
  };
  (rec.events ??= []).push({ tag: 'EVEN', payload: raw, type, ...familyDetail });
}

/** Applies the typed legacy INDI rules (see vendor-tags.ts) in any file. */
function applyLegacyIndividualTags(
  rec: IndividualRecord,
  handlers: Record<string, (child: RawNode) => void>,
  ctx: Ctx,
): void {
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

/** Applies the typed legacy FAM rules (see vendor-tags.ts) in any file. */
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
        (rec.events ??= []).push({ tag: 'MARR', type: rule.type, ...eventDetail });
      } else {
        (rec.events ??= []).push({ tag: 'EVEN', payload: raw === 'Y' ? '' : raw, type: rule.type, ...eventDetail });
      }
    };
  }
}

/** A vendor family-level fact (_COML, _MBON, _SEPR): a MARR or FAM.EVEN with a TYPE. */
/** A FAM-level vendor negative (`_MARR N` / `_NMR Y`): a bare NO MARR. */
function pushFamNonEvent(rec: FamilyRecord, node: RawNode, ctx: Ctx, expected: 'N' | 'Y'): void {
  const value = reqText(node).toUpperCase();
  if (value !== expected) {
    fail('enum.invalid-value', `The ${node.tag} payload must be "${expected}"`, node.position);
  }
  for (const child of node.children) {
    // Full leniency: unexpected children stay generic extensions.
    addExtension(rec, child, ctx);
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
    (rec.events ??= []).push({ tag: 'MARR', type, ...eventDetail });
  } else {
    (rec.events ??= []).push({ tag: 'EVEN', payload: '', type, ...eventDetail });
  }
}

/** A vendor negative (_NLIV, _NMAR, _NMR): a 7.0-style NO structure. */
function pushVendorNonEvent(rec: IndividualRecord, node: RawNode, ctx: Ctx, payload: EventEnum): void {
  noPayload(node);
  for (const child of node.children) {
    // Full leniency: unexpected children stay generic extensions.
    addExtension(rec, child, ctx);
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
    ...(Object.keys(detail).length === 0 ? {} : { detail: detail }),
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
function setMark(
  rec: { marks?: Text[]; extensions?: ExtensionStructure[] },
  index: number,
  node: RawNode,
  ctx: Ctx,
): void {
  if (node.value.kind === 'absent') {
    // A bare _TAG carries no value: the vendor's "tagged" marking of
    // the record, which stays a generic extension (like the
    // SOUR-position bare _TAG; see parsing/sources.ts). Real Legacy
    // exports write the bare form.
    addExtension(rec, node, ctx);
    return;
  }
  const marks = (rec.marks ??= []);
  while (marks.length <= index) {
    marks.push('');
  }
  marks[index] = reqText(node);
}

/** Parses the FH record flags: a `_FLGS` block whose children each
 *  spell one flag as the generated `__` tag plus the flag name as the
 *  payload (see IndividualRecord.recordFlags). */
function parseFhRecordFlags(rec: IndividualRecord, node: RawNode, ctx: Ctx): void {
  noPayload(node);
  for (const flag of node.children) {
    const entry: RecordFlagStructure = { tag: flag.tag, name: reqText(flag) };
    for (const grandchild of flag.children) {
      // Full leniency: unexpected children stay generic extensions.
      addExtension(entry, grandchild, ctx);
    }
    (rec.recordFlags ??= []).push(entry);
  }
}

export function parseIndividualRecord(node: RawNode, ctx: Ctx): IndividualRecord {
  noPayload(node);
  const rec: IndividualRecord = { tag: 'INDI', ...(node.xref === undefined ? {} : { xref: node.xref }) };
  const handlers: Record<string, (child: RawNode) => void> = {
    RESN: (child) => {
      rec.restriction = parseRestrictionList(reqText(child), child.position);
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
    _BERUF_KB: (child) => {
      // OFB-Werkstatt: the bare `_BERUF_KB` line in place of an OCCU
      // (the current exporter's form) — an occupation attribute whose
      // payload is the empty string and whose church-book wording is
      // the asRecorded slot (see OccupationAttribute.asRecorded). The
      // write-back emits the OCCU + `_BERUF_KB` pair.
      (rec.attributes ??= []).push({
        tag: 'OCCU',
        payload: '',
        asRecorded: reqText(child),
      });
    },
    _ALTER_KB: (child) => {
      // OFB-Werkstatt: the age as stated in the entry (see
      // IndividualRecord.ageAsRecorded).
      rec.ageAsRecorded = reqText(child);
    },
    _TODURSACHE: (child) => {
      // OFB-Werkstatt: the cause of death in the church book's wording
      // (see IndividualRecord.deathCauseAsRecorded).
      rec.deathCauseAsRecorded = reqText(child);
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
    _FSID: (child) => {
      // A further spelling of the FamilySearch Family Tree person id
      // (observed in Ancestry-linked exports, e.g. `_FSID PHMS-V5X`) —
      // the same slot _FSFTID carries.
      rec.familySearchId = reqText(child);
    },
    _MHID: (child) => {
      // MyHeritage: the person's tree identifier (see
      // IndividualRecord.myHeritageId).
      rec.myHeritageId = reqText(child);
    },
    _AMTID: (child) => {
      // RootsMagic: the Ancestry Member Tree reference (see
      // IndividualRecord.ancestryMemberTreeId).
      rec.ancestryMemberTreeId = reqText(child);
    },
    _SOSADABOVILLE: (child) => {
      // Ancestris: the Sosa–d'Aboville number (see
      // IndividualRecord.sosaDAboville).
      rec.sosaDAboville = reqText(child);
    },
    _OCREF: (child) => {
      // The glamberson gedcom-occurrences extension: the reference to
      // the occurrence record the person appears in, with the
      // participation data (see IndividualRecord.occurrences).
      (rec.occurrences ??= []).push(parseOccurrenceReference(child, ctx));
    },
    _EVREF: (child) => {
      // The glamberson gedcom-evidence extension: the reference to a
      // floating evidence record (see IndividualRecord.evidence).
      (rec.evidence ??= []).push(parseEvidenceReference(child, ctx));
    },
    _EVID: (child) => {
      // The gedcom-evidence v1 link spelling normalizes into the
      // `_EVREF` slot — but only with a pointer payload: the
      // slaktforskning examples write `2 _EVID <uuid>` under events
      // (a different, undocumented convention), and a text-payload
      // `_EVID` anywhere stays a generic extension (nothing is
      // guessed).
      if (child.value.kind === 'pointer') {
        (rec.evidence ??= []).push(parseEvidenceReference(child, ctx));
      } else {
        addExtension(rec, child, ctx);
      }
    },
    _EVEN_EVID: (child) => {
      // The gedcom-evidence v2 attached-evidence event (see
      // IndividualRecord.evidenceEvents).
      (rec.evidenceEvents ??= []).push(parseEvidenceEvent(child, ctx));
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
      if (child.value.kind === 'absent') {
        // The structured form: a bare line with the DATE child.
        const created = parseCreationDateLenient(child, ctx);
        if (created === undefined) {
          addExtension(rec, child, ctx);
        } else {
          rec.creationDate = created;
        }
      } else {
        rec.createdAt = reqText(child);
      }
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
      // address (see IndividualRecord.webTags). A missing or
      // value-less URL is tolerated (the full-leniency container
      // rule).
      const urlNode = one(child, 'URL');
      const tag: WebTagStructure = {
        ...(urlNode !== undefined && urlNode.value.kind === 'text' ? { url: reqText(urlNode) } : {}),
      };
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
      parseFhRecordFlags(rec, child, ctx);
    },
    _TODO: (child) => {
      (rec.todos ??= []).push(parseTodoStructure(child, ctx));
    },
    _TAG: (child) => {
      // The pointer payload is the gedcom-tags application link (see
      // IndividualRecord.tagLinks); the text payload is the Legacy
      // Tag-1 mark.
      if (child.value.kind === 'pointer') {
        (rec.tagLinks ??= []).push(parseTagLink(child, ctx));
        return;
      }
      setMark(rec, 0, child, ctx);
    },
    _TAG2: (child) => {
      setMark(rec, 1, child, ctx);
    },
    _TAG3: (child) => {
      setMark(rec, 2, child, ctx);
    },
    _TAG4: (child) => {
      setMark(rec, 3, child, ctx);
    },
    _TAG5: (child) => {
      setMark(rec, 4, child, ctx);
    },
    _TAG6: (child) => {
      setMark(rec, 5, child, ctx);
    },
    _TAG7: (child) => {
      setMark(rec, 6, child, ctx);
    },
    _TAG8: (child) => {
      setMark(rec, 7, child, ctx);
    },
    _TAG9: (child) => {
      setMark(rec, 8, child, ctx);
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
    _MIL: (child) => {
      // The Case006 long-spelling twin of _MILT (the FamilySearch
      // gedcom5-conversion test corpus): military service.
      (rec.events ??= []).push(parseVendorFact(child, ctx, 'Military'));
    },
    _MILITARY_SERVICE: (child) => {
      // The Case006 long spelling: military service.
      (rec.events ??= []).push(parseVendorFact(child, ctx, 'Military service'));
    },
    _MISE: (child) => {
      // The Case006 long spelling: military service.
      (rec.events ??= []).push(parseVendorFact(child, ctx, 'Military service'));
    },
    _DEGREE: (child) => {
      // The Case006 long spelling of _DEG: the EDUC attribute with
      // TYPE "Degree".
      pushVendorAttribute(rec, child, ctx, 'EDUC', 'Degree');
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
        ...(Object.keys(detail).length === 0 ? {} : { detail: detail }),
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
      (rec.identifiers ??= []).push(parseUniqueIdentifier(child, ctx));
    },
    _EMAIL: (child) => {
      // Brother's Keeper, Family Origins, PAF: the individual's e-mail
      // address under INDI (see IndividualRecord.email).
      (rec.email ??= []).push(reqText(child));
    },
    EMAIL: (child) => {
      // The standard-tag spelling of the INDI-level e-mail.
      (rec.email ??= []).push(reqText(child));
    },
    PHON: (child) => {
      // PAF and the ged4web exports: the individual's phone number
      // directly under INDI (see IndividualRecord.phone).
      (rec.phone ??= []).push(reqText(child));
    },
    _PHON: (child) => {
      // The underscore spelling of the INDI-level phone number.
      (rec.phone ??= []).push(reqText(child));
    },
    FAX: (child) => {
      // PAF: the individual's fax number under INDI (see
      // IndividualRecord.fax).
      (rec.fax ??= []).push(reqText(child));
    },
    ISDEAD: (child) => {
      // GenoPro: the person's vital flag (see
      // IndividualRecord.deceased).
      rec.deceased = parseYNFlag(child, 'ISDEAD');
    },
    _PHOTO: (child) => {
      // MyHeritage: a pointer to the person's photo record — the same
      // wire semantics an OBJE media link carries (see
      // IndividualRecord.media).
      (rec.media ??= []).push({ tag: 'OBJE', object: reqPtr(child, ctx) });
    },
    _WLNK: (child) => {
      // The web-link block under INDI (see
      // IndividualRecord.webLinks): the TITL description and the NOTE
      // payload carrying the URL.
      const link: WebLinkStructure = { tag: '_WLNK' };
      dispatch(
        child,
        link,
        {
          TITL: (grandchild) => {
            link.title = reqText(grandchild);
          },
          NOTE: (grandchild) => {
            link.url = reqText(grandchild);
          },
        },
        ctx,
      );
      (rec.webLinks ??= []).push(link);
    },
    OCCUPATIONS: (child) => {
      (rec.occupations ??= []).push(...parseGenoproContainer(child, ctx));
    },
    EDUCATIONS: (child) => {
      (rec.educations ??= []).push(...parseGenoproContainer(child, ctx));
    },
    CONTACTS: (child) => {
      (rec.contacts ??= []).push(...parseGenoproContainer(child, ctx));
    },
    UNIONS: (child) => {
      (rec.marriages ??= []).push(...parseGenoproContainer(child, ctx));
    },
    TWINS: (child) => {
      (rec.twins ??= []).push(...parseGenoproContainer(child, ctx));
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
      (rec.events ??= []).push(
        parseIndividualEvent(asserted ? { ...child, value: { kind: 'absent' } } : child, ctx, 'ORDN'),
      );
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
    // The FAM-event tags under INDI: a person-level marriage,
    // divorce, engagement, … event written by game-generated exports
    // (the CK3DynastyGenerator files) and hand-edited files. Neither
    // standard has a person-level MARR, so they normalize into the
    // standard EVEN + TYPE (the same slot the legacy event tags use);
    // the event detail children (DATE, PLAC, NOTE, SOUR, …) type
    // through the normal event-detail grammar.
    MARR: (child) => {
      pushLegacyIndividualEvent(rec, child, ctx, 'Marriage');
    },
    DIV: (child) => {
      pushLegacyIndividualEvent(rec, child, ctx, 'Divorce');
    },
    ANUL: (child) => {
      pushLegacyIndividualEvent(rec, child, ctx, 'Annulment');
    },
    ENGA: (child) => {
      pushLegacyIndividualEvent(rec, child, ctx, 'Engagement');
    },
    MARB: (child) => {
      pushLegacyIndividualEvent(rec, child, ctx, 'Marriage bann');
    },
    MARC: (child) => {
      pushLegacyIndividualEvent(rec, child, ctx, 'Marriage contract');
    },
    MARL: (child) => {
      pushLegacyIndividualEvent(rec, child, ctx, 'Marriage license');
    },
    MARS: (child) => {
      pushLegacyIndividualEvent(rec, child, ctx, 'Marriage settlement');
    },
    SEX: (child) => {
      const text = reqText(child).trim();
      const upper = text.toUpperCase();
      // The lenient sex: the long spellings (Male/MALE/Female/FEMALE)
      // normalize into the standard letters; OTHER is the MyFamily
      // spelling of the X value ("does not fit the typical definition
      // of only Male or only Female" — the MyFamily23Nov2017544
      // exports); anything else goes through the enum (which rejects
      // it with the diagnostic).
      if (upper === 'MALE') {
        rec.sex = 'M';
      } else if (upper === 'FEMALE') {
        rec.sex = 'F';
      } else if (upper === 'OTHER') {
        rec.sex = 'X';
      } else {
        rec.sex = parseEnum(upper, SEX_551, child.position);
      }
      // Children of the SEX line have no slot in any version. The
      // FTM Mac exports attach full source citations to the SEX fact
      // (the gedcom4j willis samples, where the continuation bug also
      // wraps them into CONT lines) — those type into the dedicated
      // sexCitations slot and are projected onto record-level INDI
      // citations on export; anything else stays a record extension,
      // preserved verbatim (the dispatch fallback). Bare lines follow
      // the standard dispatch retry/drop rule (the Ancestry-derived
      // fixtures ship bare `2 SOUR` under SEX, like they do under
      // NAME).
      dispatch(
        child,
        rec,
        {
          SOUR: (grandchild) => {
            (rec.sexCitations ??= []).push(parseSourceCitation(grandchild, ctx));
          },
        },
        ctx,
      );
    },
    _CORR: (child) => {
      // FO7: the correspondence entry block (see
      // IndividualRecord.correspondence / CorrespondenceStructure):
      // the REAS (reason), RESP (response) and RPLY (reply status)
      // children; anything else stays a generic extension of the block.
      const entry: CorrespondenceStructure = { tag: '_CORR' };
      dispatch(
        child,
        entry,
        {
          REAS: (grandchild) => {
            entry.reason = reqText(grandchild);
          },
          RESP: (grandchild) => {
            entry.response = reqText(grandchild);
          },
          RPLY: (grandchild) => {
            entry.replyStatus = reqText(grandchild);
          },
        },
        ctx,
        ['REAS', 'RESP', 'RPLY'],
      );
      rec.correspondence = entry;
    },
    _DIVERSES: (child) => {
      // AF2000: a container for assorted data ("Container für diverse
      // Daten mit Sub-Tags TITL als Benennung NOTE als Text", the
      // GenWiki "GEDCOM/_Nutzerdef-Tag" table:
      // https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag). Normalized
      // into a FACT whose TYPE is the TITL text and whose payload is
      // the NOTE text; the GenWiki table itself recommends "EVEN, FACT
      // besser" for new files.
      let type = 'Diverses';
      let payload = '';
      const detail: EventDetail = {};
      const handlers = eventDetailHandlers(ctx, detail);
      handlers['TITL'] = (grandchild) => {
        type = reqText(grandchild);
      };
      handlers['NOTE'] = (grandchild) => {
        payload = reqText(grandchild);
      };
      dispatch(child, detail, handlers, ctx);
      (rec.attributes ??= []).push({
        tag: 'FACT',
        payload,
        type,
        ...(Object.keys(detail).length === 0 ? {} : { detail: detail }),
      });
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
    _FA1: (child) => {
      pushFtmFact(rec, child, ctx, 1);
    },
    _FA2: (child) => {
      pushFtmFact(rec, child, ctx, 2);
    },
    _FA3: (child) => {
      pushFtmFact(rec, child, ctx, 3);
    },
    _FA4: (child) => {
      pushFtmFact(rec, child, ctx, 4);
    },
    _FA5: (child) => {
      pushFtmFact(rec, child, ctx, 5);
    },
    _FA6: (child) => {
      pushFtmFact(rec, child, ctx, 6);
    },
    _FA7: (child) => {
      pushFtmFact(rec, child, ctx, 7);
    },
    _FA8: (child) => {
      pushFtmFact(rec, child, ctx, 8);
    },
    _FA9: (child) => {
      pushFtmFact(rec, child, ctx, 9);
    },
    _FA10: (child) => {
      pushFtmFact(rec, child, ctx, 10);
    },
    _FA11: (child) => {
      pushFtmFact(rec, child, ctx, 11);
    },
    _FA12: (child) => {
      pushFtmFact(rec, child, ctx, 12);
    },
    _FA13: (child) => {
      pushFtmFact(rec, child, ctx, 13);
    },
    ASSO: (child) => {
      (rec.associations ??= []).push(parseAssociation(child, ctx));
    },
    ALIA: (child) => {
      if (child.value.kind === 'text') {
        // A text payload in the pointer slot: files in the wild write
        // `1 ALIA /Becky/` — an "also known as" name instead of a
        // pointer to another INDI (BURNETT.GED, GRAY, the norse-gods
        // trees). Kept as a NAME with the AKA type (the
        // standard-first normalization of the legacy AKA rule) —
        // nothing is dropped.
        pushVendorName(rec, child, ctx, 'AKA');
        return;
      }
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
  handlers['NO'] = (child) => {
    (rec.nonEvents ??= []).push(parseNonEvent(child, ctx));
  };
  handlers['CREA'] = (child) => {
    const created = parseCreationDateLenient(child, ctx);
    if (created === undefined) {
      addExtension(rec, child, ctx);
    } else {
      rec.creationDate = created;
    }
  };
  handlers['UID'] = (child) => {
    (rec.identifiers ??= []).push(parseUniqueIdentifier(child, ctx));
  };
  handlers['_UID'] = (child) => {
    (rec.identifiers ??= []).push(parseUniqueIdentifier(child, ctx));
  };
  handlers['EXID'] = (child) => {
    (rec.identifiers ??= []).push(parseExternalIdentifier(child, ctx));
  };
  handlers['SNOTE'] = (child) => {
    // The 7.0 INDIVIDUAL_RECORD carries <<NOTE_STRUCTURE>> {0:M}
    // (GEDCOM 7.0 §3.2.2); accepted in any file.
    (rec.notes ??= []).push(parseNoteStructure(child, ctx));
  };
  handlers['RIN'] = (child) => {
    rec.automatedRecordId = reqText(child);
  };
  handlers['_FIL'] = (child) => {
    // Heredis: the person's filiation — their child status relative
    // to the recorded parents (see IndividualRecord.filiation).
    rec.filiation = reqText(child);
  };
  handlers['_MTTAG'] = (child) => {
    // MyHeritage: a pointer to a tree tag applied to the person (see
    // IndividualRecord.treeTags).
    (rec.treeTags ??= []).push(reqPtr(child, ctx));
  };
  handlers['_APID'] = (child) => {
    // Ancestry: the record-level Ancestry reference (see
    // IndividualRecord.ancestryPointers).
    (rec.ancestryPointers ??= []).push(reqText(child));
  };
  handlers['_FTSID'] = (child) => {
    // The Swarm family-tree packs: the person's FamilySearch tree id
    // (see IndividualRecord.familyTreeSystemId).
    rec.familyTreeSystemId = reqText(child);
  };
  handlers['_GCID'] = (child) => {
    // GEDitCOM II: the record's id (see IndividualRecord.geditcomId).
    rec.geditcomId = reqText(child);
  };
  handlers['NUMB'] = (child) => {
    // The exporter's running number for the person (see
    // IndividualRecord.sequenceNumber).
    rec.sequenceNumber = reqText(child);
  };
  handlers['_SOSAN'] = (child) => {
    // Ancestris: the Sosa number with the leading zeros
    // (`1 _SOSAN 00004`) — the same slot `_SOSA` carries (see
    // IndividualRecord.sosaNumber).
    rec.sosaNumber = reqText(child);
  };
  handlers['RFN'] = (child) => {
    rec.recordFileNumber = reqText(child);
  };
  handlers['AFN'] = (child) => {
    rec.ancestralFileNumber = reqText(child);
  };
  handlers['SIGN'] = (child) => {
    // USM6: the person can sign (see IndividualRecord.canSign).
    // Heredis writes the person's signature (free text) under the
    // same tag — a payload that is not one of the flag spellings
    // stays a generic extension instead of failing the import.
    const flag = parseUsmFlagLenient(child);
    if (flag === undefined) {
      addExtension(rec, child, ctx);
    } else {
      rec.canSign = flag;
    }
  };
  handlers['_SIGN'] = (child) => {
    // The underscore write-back spelling of the USM6 SIGN (the USM6
    // wire spelling is non-underscore; see IndividualRecord.canSign
    // for the export rule). Both spellings follow the same lenient
    // rule.
    const flag = parseUsmFlagLenient(child);
    if (flag === undefined) {
      addExtension(rec, child, ctx);
    } else {
      rec.canSign = flag;
    }
  };
  handlers['AGE'] = (child) => {
    // GEDCOM-L Addendum §8.2: an AGE at level 1 in the INDI record
    // is interpreted as the age at death and subordinated to DEAT
    // (`1 AGE 65y` becomes `1 DEAT` + `2 AGE 65y`). The addendum
    // names the interpretation a suggestion for importing faulty
    // files; this package follows it. The
    // level-1 AGE is accepted in any file.
    const age = parseAgeStructure(child, ctx);
    let event = rec.events?.find((entry) => entry.tag === 'DEAT');
    if (event === undefined) {
      event = { tag: 'DEAT' };
      (rec.events ??= []).push(event);
    }
    event.detail ??= {};
    event.detail.age = age;
  };
  handlers['EMAIL'] = (child) => {
    // PAF writes the individual's e-mail address under INDI with the
    // standard EMAIL tag (the webtrees per-vendor custom-tag registry,
    // PersonalAncestralFile.php:
    // https://github.com/fisharebest/webtrees/blob/main/app/CustomTags/PersonalAncestralFile.php);
    // the Brother's Keeper spelling is `_EMAIL` — both normalize into
    // IndividualRecord.email.
    (rec.email ??= []).push(reqText(child));
  };
  handlers['ADDR'] = (child) => {
    // PAF writes the person's contact address directly under INDI
    // (see IndividualRecord.address) — the full address grammar
    // (ADR1/CITY/..., contacts, the `_NAME` label) types into the
    // record slot and is written back as the ADDR block in 5.5.1.
    rec.address = parseAddressStructure(child, ctx);
  };
  for (const tag of ['BAPL', 'CONL', 'ENDL', 'INIL', 'SLGC']) {
    handlers[tag] = (child) => {
      (rec.ordinances ??= []).push(parseIndividualOrdinance(child, ctx, tag));
    };
  }
  applyLegacyIndividualTags(rec, handlers, ctx);
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
  dispatch(node, rec, handlers, ctx, ['RESN', 'SEX', 'CHAN', '_BKM', '_STP', '_FLGS']);
  return rec;
}
