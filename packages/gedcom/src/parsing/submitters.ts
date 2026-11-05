/**
 * Parser section: Submitter and submission records.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). Every function here
 * maps a raw-tree node onto the typed model and fails with a typed
 * error naming the offending line.
 */

import {
  fail,
} from '../errors';
import type {
  SubmissionRecord,
  SubmitterRecord,
} from '../structures';
import type {
  Ctx,
} from './context';
import {
  addExtension,
  dispatch,
  kids,
  merge551RecordContacts,
  noPayload,
  one,
  parseImportReference,
  reqDigits,
  reqPtr,
  reqText,
} from './context';
import {
  parseLanguage,
} from './header';
import type {
  RawNode,
} from './lines';
import {
  parseMultimediaLink,
} from './sources-media';
import {
  parseAddressStructure,
  parseChangeDate,
  parseCreationDateLenient,
  parseExternalIdentifier,
  parseNoteStructure,
  parseReferenceIdentifier,
  parseUniqueIdentifier,
} from './substructures';

export function parseSubmitterRecord(node: RawNode, ctx: Ctx): SubmitterRecord {
  noPayload(node);
  // A missing or value-less NAME is tolerated (the full-leniency
  // container rule): the name defaults to the empty string.
  const nameNode = one(node, 'NAME');
  const rec: SubmitterRecord = {
    tag: 'SUBM',
    name: nameNode !== undefined && nameNode.value.kind === 'text' ? nameNode.value.text : '',
    ...(node.xref === undefined ? {} : { xref: node.xref }),
  };
  const handlers: Record<string, (child: RawNode) => void> = {
    NAME: () => undefined,
    ADDR: (child) => {
      rec.address = parseAddressStructure(child, ctx);
    },
    '_EMAIL': (child) => {
      // FH (up to V6.2): the submitter e-mail — the vendor spelling of
      // the standard EMAIL slot (see SubmitterRecord.email).
      (rec.email ??= []).push(reqText(child));
    },
    '_WEB': (child) => {
      // FH (up to V6.2): the submitter web address — the vendor
      // spelling of the standard WWW slot.
      (rec.www ??= []).push(reqText(child));
    },
    '_SUBM': (child) => {
      // GDO: a pointer to another submitter record (see
      // SubmitterRecord.submitters).
      (rec.submitters ??= []).push(reqPtr(child, ctx));
    },
    '_IMPF': (child) => {
      // GDO: the import-file reference (see
      // SubmitterRecord.importReference).
      rec.importReference = parseImportReference(child, ctx);
    },
    OBJE: (child) => {
      (rec.media ??= []).push(parseMultimediaLink(child, ctx));
    },
    LANG: (_child) => {
      const languages = kids(node, 'LANG');
      if (languages.length > 0 && rec.languages === undefined) {
        rec.languages = languages.map((lang) => parseLanguage(lang, ctx));
      }
    },
    NOTE: (child) => {
      (rec.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    CHAN: (child) => {
      rec.changeDate = parseChangeDate(child, ctx);
    },
    REFN: (child) => {
      (rec.identifiers ??= []).push(parseReferenceIdentifier(child, ctx));
    },
    PHON: (child) => {
      (rec.phone ??= []).push(reqText(child));
    },
    EMAIL: (child) => {
      (rec.email ??= []).push(reqText(child));
    },
    FAX: (child) => {
      (rec.fax ??= []).push(reqText(child));
    },
    WWW: (child) => {
      (rec.www ??= []).push(reqText(child));
    },
    '_SKYPEID': (child) => {
      // The FOAF Skype id (see SubmitterRecord.skypeId).
      rec.skypeId = reqText(child);
    },
    '_JABBERID': (child) => {
      // The FOAF Jabber id (see SubmitterRecord.jabberId).
      rec.jabberId = reqText(child);
    },
    CREA: (child) => {
      const created = parseCreationDateLenient(child, ctx);
      if (created === undefined) {
        addExtension(rec, child, ctx);
      } else {
        rec.creationDate = created;
      }
    },
    UID: (child) => {
      (rec.identifiers ??= []).push(parseUniqueIdentifier(child, ctx));
    },
    '_UID': (child) => {
      (rec.identifiers ??= []).push(parseUniqueIdentifier(child, ctx));
    },
    EXID: (child) => {
      (rec.identifiers ??= []).push(parseExternalIdentifier(child, ctx));
    },
    RFN: (child) => {
      rec.registeredRfn = reqText(child);
    },
    RIN: (child) => {
      rec.automatedRecordId = reqText(child);
    },
    '_GCID': (child) => {
      // GEDitCOM II: the record's id (see
      // IndividualRecord.geditcomId).
      rec.geditcomId = reqText(child);
    },
    // The 7.0 SUBMITTER_RECORD carries <<NOTE_STRUCTURE>> {0:M}
    // (GEDCOM 7.0 §3.2.2); accepted in any file.
    SNOTE: (child) => {
      (rec.notes ??= []).push(parseNoteStructure(child, ctx));
    },
  };
  dispatch(
    node,
    rec,
    handlers,
    ctx,
    ['ADDR', 'CHAN', 'CREA', 'RFN', 'RIN'],
  );
  merge551RecordContacts(rec);
  return rec;
}

export function parseSubmissionRecord(node: RawNode, ctx: Ctx): SubmissionRecord {
  noPayload(node);
  const rec: SubmissionRecord = { tag: 'SUBN', ...(node.xref === undefined ? {} : { xref: node.xref }) };
  dispatch(
    node,
    rec,
    {
      SUBM: (child) => {
        rec.submitter = reqPtr(child, ctx);
      },
      FAMF: (child) => {
        rec.familyFile = reqText(child);
      },
      TEMP: (child) => {
        rec.temple = reqText(child);
      },
      ANCE: (child) => {
        rec.generationsOfAncestors = reqDigits(child);
      },
      DESC: (child) => {
        rec.generationsOfDescendants = reqDigits(child);
      },
      ORDI: (child) => {
        // The wild writes the abbreviated spellings (`1 ORDI N`, the
        // legacy-gedcom samples) beside yes/no.
        const value = reqText(child).toLowerCase();
        if (value === 'y' || value === 'yes') {
          rec.ordinanceProcessFlag = 'yes';
        } else if (value === 'n' || value === 'no') {
          rec.ordinanceProcessFlag = 'no';
        } else {
          fail('enum.invalid-value', `The ORDI payload must be yes or no, got "${value}"`, child.position);
        }
      },
      RIN: (child) => {
        rec.automatedRecordId = reqText(child);
      },
      _SUBM: (child) => {
        // GDO: a pointer to the submitter record of this submission
        // (see SubmissionRecord.submitters).
        (rec.submitters ??= []).push(reqPtr(child, ctx));
      },
      _IMPF: (child) => {
        // GDO: the import-file reference (see
        // SubmissionRecord.importReference).
        rec.importReference = parseImportReference(child, ctx);
      },
      NOTE: (child) => {
        (rec.notes ??= []).push(parseNoteStructure(child, ctx));
      },
      CHAN: (child) => {
        rec.changeDate = parseChangeDate(child, ctx);
      },
    },
    ctx,
    ['SUBM', 'FAMF', 'TEMP', 'ANCE', 'DESC', 'ORDI', 'RIN', 'CHAN'],
  );
  return rec;
}
