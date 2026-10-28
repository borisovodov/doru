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
  MftSourceQuality,
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
  addExtension,
  atMostThree,
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
  parseVendorFlag,
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
    '_EMAIL': (child) => {
      // FH (up to V6.2): the repository e-mail — the vendor spelling of
      // the standard EMAIL slot (see RepositoryRecord.email).
      (rec.email ??= []).push(reqText(child));
    },
    '_WEB': (child) => {
      // FH (up to V6.2): the repository web address — the vendor
      // spelling of the standard WWW slot.
      (rec.www ??= []).push(reqText(child));
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
    // The 5.5.1/5.5.5 ADDRESS_STRUCTURE position: the floating contact
    // lines PHON/EMAIL/FAX/WWW {0:3} sit beside ADDR (GEDCOM 5.5.1 §2
    // p.31; 5.5.5 adds the record-level positions, REPO and SUBM alike).
    // The parser also accepts them under ADDR (the 5.5.5 spelling); the
    // 5.5.1 serializer writes them back into the address block.
    handlers["PHON"] = (_child) => {
      if (rec.phone === undefined) {
        rec.phone = atMostThree(node, 'PHON').map((item) => reqText(item));
      }
    };
    handlers["EMAIL"] = (_child) => {
      if (rec.email === undefined) {
        rec.email = atMostThree(node, 'EMAIL').map((item) => reqText(item));
      }
    };
    handlers["FAX"] = (_child) => {
      if (rec.fax === undefined) {
        rec.fax = atMostThree(node, 'FAX').map((item) => reqText(item));
      }
    };
    handlers["WWW"] = (_child) => {
      if (rec.www === undefined) {
        rec.www = atMostThree(node, 'WWW').map((item) => reqText(item));
      }
    };
  }
  if (ctx.version === '7.0') {
    // The 7.0 REPOSITORY_RECORD carries <<NOTE_STRUCTURE>> {0:M}
    // (GEDCOM 7.0 §3.2.2); 5.5.1 stays strict.
    handlers['SNOTE'] = (child) => {
      (rec.notes ??= []).push(parseNoteStructure(child, ctx));
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
    _ITALIC: (child) => {
      // Legacy / AQ: the source title prints in italics (see
      // SourceRecord.titleItalic).
      rec.titleItalic = parseVendorFlag(child, '_ITALIC');
    },
    _PAREN: (child) => {
      // Legacy / AQ: the publication facts print in parentheses (see
      // SourceRecord.publicationParenthesized).
      rec.publicationParenthesized = parseVendorFlag(child, '_PAREN');
    },
    _QUOTED: (child) => {
      // Legacy / AQ: the source title prints in quotes (see
      // SourceRecord.titleQuoted).
      rec.titleQuoted = parseVendorFlag(child, '_QUOTED');
    },
    _SOUR: (child) => {
      // The relocated citation under the SOUR record (registry:
      // _SOUR.yaml): the standard SOUR tag moved under the record,
      // with the same payload and substructures as SOURCE_CITATION.
      (rec.relocatedCitations ??= []).push(parseSourceCitation(child, ctx));
    },
    _TAG: (child) => {
      // Legacy: the report inclusion flag (see
      // SourceRecord.citationDetailIncluded). The vendor documents the
      // SOUR-position form only with a value (`_TAG NO`/`_TAG YES`); a
      // bare `_TAG` under SOUR is the undocumented "tagged" marking of
      // the same tag name and stays a generic extension.
      if (child.value.kind === 'absent') {
        addExtension(rec, child);
        return;
      }
      rec.citationDetailIncluded = parseReportFlag(child, '_TAG');
    },
    _TAG2: (child) => {
      // Legacy: include/exclude the citation itself on reports.
      if (child.value.kind === 'absent') {
        addExtension(rec, child);
        return;
      }
      rec.citationIncluded = parseReportFlag(child, '_TAG2');
    },
    _TAG3: (child) => {
      // Legacy: include/exclude the citation detail text on reports.
      if (child.value.kind === 'absent') {
        addExtension(rec, child);
        return;
      }
      rec.citationDetailTextIncluded = parseReportFlag(child, '_TAG3');
    },
    _TAG4: (child) => {
      // Legacy: include/exclude the citation detail notes on reports.
      if (child.value.kind === 'absent') {
        addExtension(rec, child);
        return;
      }
      rec.citationDetailNotesIncluded = parseReportFlag(child, '_TAG4');
    },
    _TYPE: (child) => {
      // FH: the source record type (see SourceRecord.sourceType).
      rec.sourceType = reqText(child);
    },
    _MASTER: (child) => {
      // AQ: the source appears in the Master listing (see
      // SourceRecord.masterListing).
      rec.masterListing = parseVendorFlag(child, '_MASTER');
    },
    _QUAL: (child) => {
      // MFT7: the source-quality block (see SourceRecord.quality).
      rec.quality = parseMftSourceQuality(child, ctx);
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
    handlers["SNOTE"] = (child) => {
      // The 7.0 SOURCE_RECORD carries <<NOTE_STRUCTURE>> {0:M} (GEDCOM
      // 7.0 §3.2.2); 5.5.1 stays strict.
      (rec.notes ??= []).push(parseNoteStructure(child, ctx));
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
    ctx.version === '7.0'
      ? ['DATA', 'AUTH', 'TITL', 'ABBR', 'PUBL', 'TEXT', 'CHAN', 'CREA', '_TAG', '_TAG2', '_TAG3', '_TAG4', '_TYPE', '_MASTER', '_QUAL']
      : ['DATA', 'AUTH', 'TITL', 'ABBR', 'PUBL', 'TEXT', 'CHAN', 'RIN', '_TAG', '_TAG2', '_TAG3', '_TAG4', '_TYPE', '_MASTER', '_QUAL'],
  );
  return rec;
}

/**
 * Parses a Legacy SOUR report flag (`_TAG` … `_TAG4`): the value is
 * required and spells YES/NO (the vendor's "Custom GEDCOM Tags" help
 * documents `_TAG NO`, `_TAG3 YES`, …); `Y`/`YES` marks the inclusion,
 * `N`/`NO` the exclusion.
 */
function parseReportFlag(node: RawNode, tag: string): boolean {
  const text = reqText(node).toUpperCase();
  if (text === 'Y' || text === 'YES') {
    return true;
  }
  if (text === 'N' || text === 'NO') {
    return false;
  }
  fail('enum.invalid-value', `The ${tag} value must be YES or NO, not "${text}"`, node.position);
}

/** Parses the MFT7 `_QUAL` source-quality block (see MftSourceQuality). */
function parseMftSourceQuality(node: RawNode, ctx: Ctx): MftSourceQuality {
  noPayload(node);
  const out: MftSourceQuality = { tag: '_QUAL' };
  dispatch(
    node,
    out,
    {
      _SOUR: (child) => {
        out.source = reqText(child);
      },
      _INFO: (child) => {
        out.information = reqText(child);
      },
      _EVID: (child) => {
        out.evidence = reqText(child);
      },
    },
    ctx,
    ['_SOUR', '_INFO', '_EVID'],
  );
  return out;
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
  const handlers: Record<string, (child: RawNode) => void> = {
    EVEN: (child) => {
      (data.events ??= []).push(parseSourceDataEvent(child, ctx));
    },
    AGNC: (child) => {
      data.agency = reqText(child);
    },
    NOTE: (child) => {
      (data.notes ??= []).push(parseNoteStructure(child, ctx));
    },
  };
  if (ctx.version === '7.0') {
    // The 7.0 SOUR.DATA carries <<NOTE_STRUCTURE>> {0:M} (GEDCOM 7.0
    // §3.2.2); 5.5.1 stays strict.
    handlers['SNOTE'] = (child) => {
      (data.notes ??= []).push(parseNoteStructure(child, ctx));
    };
  }
  dispatch(node, data, handlers, ctx);
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
