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
import type {
  EventAttributeEnum,
} from '../enumerations';
import {
  fail,
} from '../errors';
import type {
  EvidenceTemplate,
  EvidenceTemplateField,
  NoteRecord,
  PlaceStructure,
  RepositoryRecord,
  SharedNoteRecord,
  SourceDataEvent,
  SourcePublicationDetails,
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
  parseDateExactStructure,
  parseDatePeriodStructure,
  parseDateStructure,
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
    '_DATE': (child) => {
      // The community _DATE extension under REPO (registry: _DATE.yaml).
      (rec.dates ??= []).push(parseDateStructure(child, ctx));
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
      // The leaf payload fields have no substructures of their own;
      // dispatch keeps underscore extensions and rejects the rest.
      dispatch(child, rec, {}, ctx);
    },
    TITL: (child) => {
      rec.title = reqText(child);
      dispatch(child, rec, {}, ctx);
    },
    ABBR: (child) => {
      rec.abbreviation = reqText(child);
      dispatch(child, rec, {}, ctx);
    },
    PUBL: (child) => {
      rec.publication = reqText(child);
      // The Ancestry publication details (registry: Ancestry_PUBL_DATE
      // and Ancestry_PUBL_PLAC yaml): DATE {0:1} and PLAC {0:1}.
      const details: SourcePublicationDetails = {};
      dispatch(
        child,
        details,
        {
          DATE: (dateChild) => {
            details.date = parseDateExactStructure(dateChild, ctx, true);
          },
          PLAC: (placeChild) => {
            details.place = reqText(placeChild);
          },
        },
        ctx,
        ['DATE', 'PLAC'],
      );
      if (Object.keys(details).length > 0) {
        rec.publicationDetails = details;
      }
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
  const raw = reqText(node);
  let out: SourceDataEvent;
  if (ctx.version === '7.0') {
    out = {
      payload: parseListEnum(raw, EVENT_ATTRIBUTE_ENUM_VALUES, '7.0', node.position),
    };
  } else {
    // 5.5.1 `EVENTS_RECORDED` (p.50): event-type tags plus any
    // user-supplied value, comma-separated. The known tags go to
    // `payload`, the rest to `userDefined` verbatim (the list has no
    // ordering semantics in 5.5.1, so the grouping is lossless).
    out = { payload: [] };
    for (const item of raw.split(',').map((part) => part.trim())) {
      const key = Object.keys(EVENT_ATTRIBUTE_ENUM_VALUES).find(
        (value) => value.toLowerCase() === item.toLowerCase(),
      );
      if (key !== undefined) {
        (out.payload as EventAttributeEnum[]).push(key as EventAttributeEnum);
      } else {
        (out.userDefined ??= []).push(item);
      }
    }
  }
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
