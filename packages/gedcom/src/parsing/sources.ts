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
  GedcomStructureBase,
  MftSourceQuality,
  NoteRecord,
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
  dispatch,
  merge551RecordContacts,
  noPayload,
  parseImportReference,
  req,
  reqPtr,
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
  parsePrivacyFlag,
  parseSourceCitation,
  parseSourceRepositoryCitation,
  parseVendorFlag,
} from './sources-media';
import {
  parseAddressStructure,
  parseChangeDate,
  parseCreationDateLenient,
  parseDateExactStructure,
  parseDatePeriodStructure,
  parseDateStructure,
  parseExternalIdentifier,
  parseNoteStructure,
  parseNoteTranslation,
  parseReferenceIdentifier,
  parseUniqueIdentifier,
} from './substructures';

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
    '_SUBM': (child) => {
      // GDO: a pointer to the submitter record of this repository (see
      // RepositoryRecord.submitters).
      (rec.submitters ??= []).push(reqPtr(child, ctx));
    },
    '_IMPF': (child) => {
      // GDO: the import-file reference (see
      // RepositoryRecord.importReference).
      rec.importReference = parseImportReference(child, ctx);
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
    CREA: (child) => {
      const created = parseCreationDateLenient(child, ctx);
      if (created === undefined) {
        addExtension(rec, child, ctx);
      } else {
        rec.creationDate = created;
      }
    },
    UID: (child) => {
      (rec.identifiers ??= []).push(parseUniqueIdentifier(child));
    },
    '_UID': (child) => {
      (rec.identifiers ??= []).push(parseUniqueIdentifier(child));
    },
    EXID: (child) => {
      (rec.identifiers ??= []).push(parseExternalIdentifier(child, ctx));
    },
    RIN: (child) => {
      rec.automatedRecordId = reqText(child);
    },
    // The 7.0 REPOSITORY_RECORD carries <<NOTE_STRUCTURE>> {0:M}
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
    ['ADDR', 'CHAN', 'CREA', 'RIN'],
  );
  merge551RecordContacts(rec);
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
        const created = parseCreationDateLenient(child, ctx);
        if (created === undefined) {
          addExtension(rec, child, ctx);
        } else {
          rec.creationDate = created;
        }
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
      _SUBM: (child) => {
        // GDO: a pointer to the submitter record of this shared note
        // (see SharedNoteRecord.submitters).
        (rec.submitters ??= []).push(reqPtr(child, ctx));
      },
      _IMPF: (child) => {
        // GDO: the import-file reference (see
        // SharedNoteRecord.importReference).
        rec.importReference = parseImportReference(child, ctx);
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
      _SUBM: (child) => {
        // GDO: a pointer to the submitter record of this note (see
        // NoteRecord.submitters).
        (rec.submitters ??= []).push(reqPtr(child, ctx));
      },
      _IMPF: (child) => {
        // GDO: the import-file reference (see NoteRecord.importReference).
        rec.importReference = parseImportReference(child, ctx);
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
      // underscore extensions below them are kept beside the field so
      // their nesting survives the round trip (see
      // SourceRecord.authorExtensions).
      const base: GedcomStructureBase = {};
      dispatch(child, base, {}, ctx);
      if (base.extensions !== undefined) {
        rec.authorExtensions = base.extensions;
      }
    },
    TITL: (child) => {
      rec.title = reqText(child);
      const base: GedcomStructureBase = {};
      dispatch(child, base, {}, ctx);
      if (base.extensions !== undefined) {
        rec.titleExtensions = base.extensions;
      }
    },
    ABBR: (child) => {
      rec.abbreviation = reqText(child);
      const base: GedcomStructureBase = {};
      dispatch(child, base, {}, ctx);
      if (base.extensions !== undefined) {
        rec.abbreviationExtensions = base.extensions;
      }
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
            details.date = parseDateExactStructure(dateChild, ctx);
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
        addExtension(rec, child, ctx);
        return;
      }
      rec.citationDetailIncluded = parseReportFlag(child, '_TAG');
    },
    _TAG2: (child) => {
      // Legacy: include/exclude the citation itself on reports.
      if (child.value.kind === 'absent') {
        addExtension(rec, child, ctx);
        return;
      }
      rec.citationIncluded = parseReportFlag(child, '_TAG2');
    },
    _TAG3: (child) => {
      // Legacy: include/exclude the citation detail text on reports.
      if (child.value.kind === 'absent') {
        addExtension(rec, child, ctx);
        return;
      }
      rec.citationDetailTextIncluded = parseReportFlag(child, '_TAG3');
    },
    _TAG4: (child) => {
      // Legacy: include/exclude the citation detail notes on reports.
      if (child.value.kind === 'absent') {
        addExtension(rec, child, ctx);
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
    _URKU: (child) => {
      // PC-AHNEN: evidence of the event is available (see
      // SourceRecord.evidenceAvailable).
      rec.evidenceAvailable = parsePrivacyFlag(child, '_URKU');
    },
    _JAG: (child) => {
      // GenPlus: the volume year of the source (see
      // SourceRecord.volumeYear).
      rec.volumeYear = reqText(child);
    },
    _KTIT: (child) => {
      // GenPlus: the short title of the source — the vendor spelling
      // of the standard ABBR slot (see SourceRecord.abbreviation);
      // written back as the standard ABBR.
      rec.abbreviation = reqText(child);
    },
    _SUBQ: (child) => {
      // RootsMagic: the format used for subsequent citations of the
      // source, written under the SOUR record — the record-level twin
      // of the citation-level `_SUBQ` (see
      // SourceCitation.subsequentCitationFormat); the webtrees
      // per-vendor custom-tag registry labels it "Abbreviation"
      // (RootsMagic.php:
      // https://github.com/fisharebest/webtrees/blob/main/app/CustomTags/RootsMagic.php).
      rec.subsequentCitationFormat = reqText(child);
    },
    _BIBL: (child) => {
      // RootsMagic: the source's bibliography entry (same source as
      // `_SUBQ`). Not part of any GEDCOM version.
      rec.bibliography = reqText(child);
    },
    _SUBM: (child) => {
      // GDO: a pointer to the submitter record of this source (see
      // SourceRecord.submitters).
      (rec.submitters ??= []).push(reqPtr(child, ctx));
    },
    '_MEDI': (child) => {
      // Legacy writes the media type of the source with the standard
      // MEDI tag (see SourceRecord.medium); the underscore spelling is
      // recognized in both versions and is the write-back spelling.
      rec.medium = reqText(child);
    },
    _IMPF: (child) => {
      // GDO: the import-file reference (see SourceRecord.importReference).
      rec.importReference = parseImportReference(child, ctx);
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
  handlers['CREA'] = (child) => {
    const created = parseCreationDateLenient(child, ctx);
    if (created === undefined) {
      addExtension(rec, child, ctx);
    } else {
      rec.creationDate = created;
    }
  };
  handlers['UID'] = (child) => {
    (rec.identifiers ??= []).push(parseUniqueIdentifier(child));
  };
  handlers['_UID'] = (child) => {
    (rec.identifiers ??= []).push(parseUniqueIdentifier(child));
  };
  handlers['EXID'] = (child) => {
    (rec.identifiers ??= []).push(parseExternalIdentifier(child, ctx));
  };
  handlers['SNOTE'] = (child) => {
    // The 7.0 SOURCE_RECORD carries <<NOTE_STRUCTURE>> {0:M} (GEDCOM
    // 7.0 §3.2.2); accepted in any file.
    (rec.notes ??= []).push(parseNoteStructure(child, ctx));
  };
  handlers['RIN'] = (child) => {
    rec.automatedRecordId = reqText(child);
  };
  handlers['TYPE'] = (child) => {
    // Heredis and Généatique write the source kind with the standard
    // TYPE tag (the webtrees per-vendor custom-tag registries,
    // Heredis.php and Geneatique.php:
    // https://github.com/fisharebest/webtrees/tree/main/app/CustomTags);
    // the Family Historian spelling is `_TYPE` — both normalize into
    // sourceType and are written back as `_TYPE`.
    rec.sourceType = reqText(child);
  };
  handlers['QUAY'] = (child) => {
    // Heredis: the quality assessment of the whole source, written
    // with the standard QUAY tag at record level (the webtrees
    // per-vendor custom-tag registry, Heredis.php). No typed slot —
    // the record-level assessment stays a generic extension, dropped
    // on export in both versions (QUAY is a citation-only tag, and
    // neither target spells a non-underscore extension).
    addExtension(rec, child, ctx);
  };
  handlers['DATE'] = (child) => {
    // Legacy Family Tree writes the source's date at record level
    // (the canonical Legacy custom-tags sample, `1 DATE 29 Sep
    // 2016`). Neither standard has a DATE slot under the SOUR
    // record, so it stays a generic extension.
    addExtension(rec, child, ctx);
  };
  handlers['MEDI'] = (child) => {
    // Legacy: the media type of the source, the standard MEDI tag in
    // the non-standard SOUR-record position (the webtrees
    // per-vendor custom-tag registry, Legacy.php, "Media type";
    // see SourceRecord.medium for the export rule).
    rec.medium = reqText(child);
  };
  dispatch(
    node,
    rec,
    handlers,
    ctx,
    ['DATA', 'AUTH', 'TITL', 'ABBR', 'PUBL', 'TEXT', 'CHAN', 'CREA', 'RIN', '_TAG', '_TAG2', '_TAG3', '_TAG4', '_TYPE', '_MASTER', '_QUAL'],
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
    // The 7.0 SOUR.DATA carries <<NOTE_STRUCTURE>> {0:M} (GEDCOM 7.0
    // §3.2.2); accepted in any file.
    SNOTE: (child) => {
      (data.notes ??= []).push(parseNoteStructure(child, ctx));
    },
  };
  dispatch(node, data, handlers, ctx);
  return data;
}

export function parseSourceDataEvent(node: RawNode, ctx: Ctx): SourceDataEvent {
  const raw = reqText(node);
  // Both value forms parse: the `EVENTS_RECORDED` list (5.5.1 p.50) —
  // event-type tags plus any user-supplied value, comma-separated. The
  // known tags go to `payload`, the rest to `userDefined` verbatim (the
  // list has no ordering semantics in 5.5.1, so the grouping is
  // lossless); a 7.0 file writing an unlisted value imports the same
  // way.
  const out: SourceDataEvent = { payload: [] };
  for (const item of raw.split(',').map((part) => part.trim())) {
    const key = Object.keys(EVENT_ATTRIBUTE_ENUM_VALUES).find(
      (value) => value.toLowerCase() === item.toLowerCase(),
    );
    if (key !== undefined) {
      (out.payload as EventAttributeEnum[]).push(key as EventAttributeEnum);
    } else if (item.startsWith('_')) {
      // The 7.0 extension values go to the payload (like the citation
      // EVEN form).
      (out.payload as EventAttributeEnum[]).push(item as EventAttributeEnum);
    } else {
      (out.userDefined ??= []).push(item);
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
        out.place = parsePlaceStructure(child, ctx);
      },
    },
    ctx,
  );
  return out;
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
