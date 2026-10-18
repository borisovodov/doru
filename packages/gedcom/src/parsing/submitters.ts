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
  atMostThree,
  dispatch,
  kids,
  noPayload,
  req,
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
  parseCreationDate,
  parseExternalIdentifier,
  parseNoteStructure,
  parseReferenceIdentifier,
  parseUniqueIdentifier,
} from './substructures';

export function parseSubmitterRecord(node: RawNode, ctx: Ctx): SubmitterRecord {
  noPayload(node);
  const rec: SubmitterRecord = { tag: 'SUBM', name: reqText(req(node, 'NAME')), ...(node.xref === undefined ? {} : { xref: node.xref }) };
  const handlers: Record<string, (child: RawNode) => void> = {
    NAME: () => undefined,
    ADDR: (child) => {
      rec.address = parseAddressStructure(child, ctx);
    },
    OBJE: (child) => {
      (rec.media ??= []).push(parseMultimediaLink(child, ctx));
    },
    LANG: (_child) => {
      const languages = ctx.version === '5.5.1' ? atMostThree(node, 'LANG') : kids(node, 'LANG');
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
  };
  if (ctx.version === '7.0') {
    handlers["PHON"] = (child) => {
      (rec.phone ??= []).push(reqText(child));
    };
    handlers["EMAIL"] = (child) => {
      (rec.email ??= []).push(reqText(child));
    };
    handlers["FAX"] = (child) => {
      (rec.fax ??= []).push(reqText(child));
    };
    handlers["WWW"] = (child) => {
      (rec.www ??= []).push(reqText(child));
    };
    handlers["CREA"] = (child) => {
      rec.creationDate = parseCreationDate(child, ctx);
    };
    handlers["UID"] = (child) => {
      (rec.identifiers ??= []).push(parseUniqueIdentifier(child));
    };
    handlers["EXID"] = (child) => {
      (rec.identifiers ??= []).push(parseExternalIdentifier(child, ctx));
    };
  } else {
    handlers['_UID'] = (child) => {
      // The vendor extension.
      (rec.identifiers ??= []).push(parseUniqueIdentifier(child));
    };
    handlers["RFN"] = (child) => {
      rec.registeredRfn = reqText(child);
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
    ctx.version === '7.0' ? ['ADDR', 'CHAN', 'CREA'] : ['ADDR', 'CHAN', 'RFN', 'RIN'],
  );
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
        const value = reqText(child);
        if (value.toLowerCase() !== 'yes' && value.toLowerCase() !== 'no') {
          fail('enum.invalid-value', `The ORDI payload must be yes or no, got "${value}"`, child.position);
        }
        rec.ordinanceProcessFlag = value.toLowerCase() === 'yes' ? 'yes' : 'no';
      },
      RIN: (child) => {
        rec.automatedRecordId = reqText(child);
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
