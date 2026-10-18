/**
 * Parser section: Repository, notes and sources.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). Every function here
 * maps a raw-tree node onto the typed model and fails with a typed
 * error naming the offending line.
 */

import {
  EVENT_ATTRIBUTE_ENUM_VALUES,
} from '../enumerations';
import {
  fail,
} from '../errors';
import type {
  ListEnum,
} from '../primitives';
import type {
  EvidenceTemplate,
  EvidenceTemplateField,
  NoteRecord,
  PlaceStructure,
  RepositoryRecord,
  SharedNoteRecord,
  SourceDataEvent,
  SourceRecord,
  SourceRecordData,
  SourceText,
} from '../structures';
import type {
  Ctx,
} from './context';
import {
  dispatch,
  noPayload,
  req,
  reqText,
} from './context';
import type {
  RawNode,
} from './lines';
import {
  parsePlaceStructure,
} from './names-places';
import {
  parseMultimediaLink,
  parseSourceCitation,
  parseSourceRepositoryCitation,
} from './sources-media';
import {
  parseAddressStructure,
  parseChangeDate,
  parseCreationDate,
  parseDatePeriodStructure,
  parseExternalIdentifier,
  parseNoteStructure,
  parseNoteTranslation,
  parseReferenceIdentifier,
  parseUniqueIdentifier,
} from './substructures';
import {
  parseListEnum,
  parseListText,
} from './types';

export function parseRepositoryRecord(node: RawNode, ctx: Ctx): RepositoryRecord {
  noPayload(node);
  const rec: RepositoryRecord = { tag: 'REPO', name: reqText(req(node, 'NAME')), ...(node.xref === undefined ? {} : { xref: node.xref }) };
  const handlers: Record<string, (child: RawNode) => void> = {
    NAME: () => undefined,
    ADDR: (child) => {
      rec.address = parseAddressStructure(child, ctx);
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
    handlers["_UID"] = (child) => {
      (rec.identifiers ??= []).push(parseUniqueIdentifier(child));
    };
    handlers["EXID"] = (child) => {
      (rec.identifiers ??= []).push(parseExternalIdentifier(child, ctx));
    };
  } else {
    handlers['_UID'] = (child) => {
      (rec.identifiers ??= []).push(parseUniqueIdentifier(child));
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
    ctx.version === '7.0' ? ['ADDR', 'CHAN', 'CREA'] : ['ADDR', 'CHAN', 'RIN'],
  );
  return rec;
}

export function parseSharedNoteRecord(node: RawNode, ctx: Ctx): SharedNoteRecord {
  const rec: SharedNoteRecord = { tag: 'SNOTE', payload: reqText(node), ...(node.xref === undefined ? {} : { xref: node.xref }) };
  dispatch(
    node,
    rec,
    {
      MIME: (child) => {
        rec.mediaType = reqText(child);
      },
      LANG: (child) => {
        rec.language = reqText(child);
      },
      TRAN: (child) => {
        (rec.translations ??= []).push(parseNoteTranslation(child, ctx));
      },
      SOUR: (child) => {
        (rec.citations ??= []).push(parseSourceCitation(child, ctx));
      },
      CHAN: (child) => {
        rec.changeDate = parseChangeDate(child, ctx);
      },
      CREA: (child) => {
        rec.creationDate = parseCreationDate(child, ctx);
      },
      REFN: (child) => {
        (rec.identifiers ??= []).push(parseReferenceIdentifier(child, ctx));
      },
      UID: (child) => {
        (rec.identifiers ??= []).push(parseUniqueIdentifier(child));
      },
      EXID: (child) => {
        (rec.identifiers ??= []).push(parseExternalIdentifier(child, ctx));
      },
    },
    ctx,
    ['MIME', 'LANG', 'CHAN', 'CREA'],
  );
  return rec;
}

export function parseNoteRecord(node: RawNode, ctx: Ctx): NoteRecord {
  const rec: NoteRecord = { tag: 'NOTE', payload: reqText(node), ...(node.xref === undefined ? {} : { xref: node.xref }) };
  dispatch(
    node,
    rec,
    {
      SOUR: (child) => {
        (rec.citations ??= []).push(parseSourceCitation(child, ctx));
      },
      CHAN: (child) => {
        rec.changeDate = parseChangeDate(child, ctx);
      },
      REFN: (child) => {
        (rec.identifiers ??= []).push(parseReferenceIdentifier(child, ctx));
      },
      RIN: (child) => {
        rec.automatedRecordId = reqText(child);
      },
      _UID: (child) => {
        (rec.identifiers ??= []).push(parseUniqueIdentifier(child));
      },
    },
    ctx,
    ['CHAN', 'RIN'],
  );
  return rec;
}

export function parseSourceRecord(node: RawNode, ctx: Ctx): SourceRecord {
  noPayload(node);
  const rec: SourceRecord = { tag: 'SOUR', ...(node.xref === undefined ? {} : { xref: node.xref }) };
  const handlers: Record<string, (child: RawNode) => void> = {
    DATA: (child) => {
      rec.data = parseSourceRecordData(child, ctx);
    },
    AUTH: (child) => {
      rec.author = reqText(child);
    },
    TITL: (child) => {
      rec.title = reqText(child);
    },
    ABBR: (child) => {
      rec.abbreviation = reqText(child);
    },
    PUBL: (child) => {
      rec.publication = reqText(child);
    },
    TEXT: (child) => {
      rec.text = parseSourceText(child, ctx);
    },
    _TMPLT: (child) => {
      rec.template = parseEvidenceTemplate(child, ctx);
    },
    _FULL: (child) => {
      rec.fullFootnote = reqText(child);
    },
    REPO: (child) => {
      (rec.repositoryCitations ??= []).push(parseSourceRepositoryCitation(child, ctx));
    },
    NOTE: (child) => {
      (rec.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    OBJE: (child) => {
      (rec.media ??= []).push(parseMultimediaLink(child, ctx));
    },
    CHAN: (child) => {
      rec.changeDate = parseChangeDate(child, ctx);
    },
    REFN: (child) => {
      (rec.identifiers ??= []).push(parseReferenceIdentifier(child, ctx));
    },
  };
  if (ctx.version === '7.0') {
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
  } else {
    handlers['_UID'] = (child) => {
      (rec.identifiers ??= []).push(parseUniqueIdentifier(child));
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
    ctx.version === '7.0' ? ['DATA', 'AUTH', 'TITL', 'ABBR', 'PUBL', 'TEXT', 'CHAN', 'CREA'] : ['DATA', 'AUTH', 'TITL', 'ABBR', 'PUBL', 'TEXT', 'CHAN', 'RIN'],
  );
  return rec;
}

/** Parses the vendor `_TMPLT` source template (see SourceRecord.template). */
export function parseEvidenceTemplate(node: RawNode, ctx: Ctx): EvidenceTemplate {
  noPayload(node);
  const out: EvidenceTemplate = { tag: '_TMPLT', fields: [] };
  dispatch(
    node,
    out,
    {
      TID: (child) => {
        out.templateId = reqText(child);
      },
      FIELD: (child) => {
        out.fields.push(parseEvidenceTemplateField(child, ctx));
      },
    },
    ctx,
    ['TID'],
  );
  return out;
}

/** Parses one FIELD of an evidence template (NAME {1:1}, VALUE {0:1}). */
function parseEvidenceTemplateField(node: RawNode, ctx: Ctx): EvidenceTemplateField {
  noPayload(node);
  const out: EvidenceTemplateField = { tag: 'FIELD', name: reqText(req(node, 'NAME')) };
  dispatch(
    node,
    out,
    {
      NAME: () => undefined,
      VALUE: (child) => {
        out.value = reqText(child);
      },
    },
    ctx,
    ['VALUE'],
  );
  return out;
}

export function parseSourceRecordData(node: RawNode, ctx: Ctx): SourceRecordData {
  noPayload(node);
  const data: SourceRecordData = {};
  dispatch(
    node,
    data,
    {
      EVEN: (child) => {
        (data.events ??= []).push(parseSourceDataEvent(child, ctx));
      },
      AGNC: (child) => {
        data.agency = reqText(child);
      },
      NOTE: (child) => {
        (data.notes ??= []).push(parseNoteStructure(child, ctx));
      },
    },
    ctx,
  );
  return data;
}

export function parseSourceDataEvent(node: RawNode, ctx: Ctx): SourceDataEvent {
  const out: SourceDataEvent = {
    payload: parseListEnum(reqText(node), EVENT_ATTRIBUTE_ENUM_VALUES, ctx.version, node.position) as ListEnum<never>,
  };
  dispatch(
    node,
    out,
    {
      DATE: (child) => {
        out.date = parseDatePeriodStructure(child, ctx);
      },
      PLAC: (child) => {
        out.place = parseSourceJurisdictionPlace(child, ctx);
      },
    },
    ctx,
  );
  return out;
}

export function parseSourceJurisdictionPlace(node: RawNode, ctx: Ctx): PlaceStructure {
  // 5.5.1: a plain place name; 7.0: a full PLACE_STRUCTURE.
  if (ctx.version === '5.5.1') {
    if (node.children.length > 0) {
      fail('structure.unknown-tag', `The tag ${(node.children[0] as RawNode).tag} is not allowed under PLAC here`, (node.children[0] as RawNode).position);
    }
    return { tag: 'PLAC', payload: parseListText(reqText(node)) };
  }
  return parsePlaceStructure(node, ctx);
}

export function parseSourceText(node: RawNode, ctx: Ctx): SourceText {
  const out: SourceText = { payload: reqText(node) };
  dispatch(
    node,
    out,
    {
      MIME: (child) => {
        out.mediaType = reqText(child);
      },
      LANG: (child) => {
        out.language = reqText(child);
      },
    },
    ctx,
  );
  return out;
}
