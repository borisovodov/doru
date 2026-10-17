/**
 * Parser section: Records.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). Every function here
 * maps a raw-tree node onto the typed model and fails with a typed
 * error naming the offending line.
 */

import {
  EVENT_ATTRIBUTE_ENUM_VALUES,
  MEDIA_ENUM_VALUES,
  RESTRICTION_ENUM_VALUES,
  SEX_ENUM_VALUES,
  type MediaEnum,
} from '../enumerations';
import { fail } from '../errors';
import { type ListEnum } from '../primitives';
import {
  type FamilyRecord,
  type IndividualRecord,
  type MediaFile,
  type MediaFileTranslation,
  type MediaFormatStructure,
  type MediaStructure,
  type MultimediaRecord,
  type NoteRecord,
  type PlaceStructure,
  type RepositoryRecord,
  type SharedNoteRecord,
  type SourceDataEvent,
  type SourceRecord,
  type SourceRecordData,
  type SourceText,
  type SubmissionRecord,
  type SubmitterRecord,
} from '../structures';
import {
  atMostThree,
  dispatch,
  kids,
  noPayload,
  req,
  reqDigits,
  reqPtr,
  reqText,
  type Ctx,
} from './context';
import {
  SEX_551,
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
import { parseLanguage } from './header';
import { type RawNode } from './lines';
import {
  parsePersonalNameStructure,
  parsePlaceStructure,
} from './names-places';
import {
  parseMultimediaLink,
  parseSourceCitation,
  parseSourceRepositoryCitation,
} from './sources-media';
import {
  parseAddressStructure,
  parseAssociation,
  parseChangeDate,
  parseCreationDate,
  parseDatePeriodStructure,
  parseExternalIdentifier,
  parseNonEvent,
  parseNoteStructure,
  parseNoteTranslation,
  parseReferenceIdentifier,
  parseUniqueIdentifier,
} from './substructures';
import {
  parseEnum,
  parseListEnum,
  parseListText,
  parseMediaFormat551,
} from './types';

// Records
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
    handlers["EXID"] = (child) => {
      (rec.identifiers ??= []).push(parseExternalIdentifier(child, ctx));
    };
    for (const tag of FAMILY_EVENT_TAGS) {
      handlers[tag] = (child) => {
        (rec.events ??= []).push(parseFamilyEvent(child, ctx, tag));
      };
    }
  } else {
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
    handlers["EXID"] = (child) => {
      (rec.identifiers ??= []).push(parseExternalIdentifier(child, ctx));
    };
    for (const tag of ['BAPL', 'CONL', 'ENDL', 'INIL', 'SLGC']) {
      handlers[tag] = (child) => {
        (rec.ordinances ??= []).push(parseIndividualOrdinance(child, ctx, tag));
      };
    }
  } else {
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

export function parseMultimediaRecord(node: RawNode, ctx: Ctx): MultimediaRecord {
  noPayload(node);
  const rec: MultimediaRecord = { tag: 'OBJE', files: [], ...(node.xref === undefined ? {} : { xref: node.xref }) };
  const handlers: Record<string, (child: RawNode) => void> = {
    FILE: (child) => {
      rec.files.push(parseMediaFile(child, ctx));
    },
    NOTE: (child) => {
      (rec.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    SOUR: (child) => {
      (rec.citations ??= []).push(parseSourceCitation(child, ctx));
    },
    CHAN: (child) => {
      rec.changeDate = parseChangeDate(child, ctx);
    },
    REFN: (child) => {
      (rec.identifiers ??= []).push(parseReferenceIdentifier(child, ctx));
    },
  };
  if (ctx.version === '7.0') {
    handlers["RESN"] = (child) => {
      rec.restriction = parseListEnum(reqText(child), RESTRICTION_ENUM_VALUES, '7.0', child.position);
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
    handlers["RIN"] = (child) => {
      rec.automatedRecordId = reqText(child);
    };
  }
  dispatch(
    node,
    rec,
    handlers,
    ctx,
    ctx.version === '7.0' ? ['RESN', 'CHAN', 'CREA'] : ['CHAN', 'RIN'],
  );
  if (rec.files.length === 0) {
    fail('structure.missing-required', 'A multimedia record requires at least one FILE substructure', node.position);
  }
  return rec;
}

export function parseMediaFile(node: RawNode, ctx: Ctx): MediaFile {
  const file: MediaFile = { payload: reqText(node), form: null as unknown as MediaFormatStructure };
  dispatch(
    node,
    file,
    {
      FORM: (child) => {
        if (file.form !== (null as unknown as MediaFormatStructure)) {
          fail('structure.cardinality', 'At most one FORM is allowed under FILE', child.position);
        }
        file.form = parseMediaFormatStructure(child, ctx);
      },
      TITL: (child) => {
        file.title = reqText(child);
      },
      ...(ctx.version === '7.0'
        ? {
            TRAN: (child) => {
              (file.translations ??= []).push(parseMediaFileTranslation(child, ctx));
            },
          }
        : {}),
    },
    ctx,
  );
  if (file.form === (null as unknown as MediaFormatStructure)) {
    fail('structure.missing-required', 'The FILE structure requires a FORM substructure', node.position);
  }
  return file;
}

export function parseMediaFormatStructure(node: RawNode, ctx: Ctx): MediaFormatStructure {
  const format: MediaFormatStructure = {
    payload: ctx.version === '7.0' ? reqText(node) : parseMediaFormat551(reqText(node), node.position),
  };
  dispatch(
    node,
    format,
    {
      ...(ctx.version === '7.0'
        ? {
            MEDI: (child) => {
              format.medium = parseMediaStructure(child, ctx);
            },
          }
        : {
            TYPE: (child) => {
              format.medium = parseMediaType551(child);
            },
          }),
    },
    ctx,
  );
  return format;
}

export function parseMediaStructure(node: RawNode, ctx: Ctx): MediaStructure {
  const out: MediaStructure = { payload: parseEnum(reqText(node), MEDIA_ENUM_VALUES, ctx.version, node.position) };
  dispatch(
    node,
    out,
    {
      PHRASE: (child) => {
        out.phrase = reqText(child);
      },
    },
    ctx,
  );
  return out;
}

/** The 5.5.1 SOURCE_MEDIA_TYPE set (the 7.0 MEDI set without OTHER). */
export const MEDIA_551: Record<string, string> = {
  AUDIO: 'audio', BOOK: 'book', CARD: 'card', ELECTRONIC: 'electronic', FICHE: 'fiche',
  FILM: 'film', MAGAZINE: 'magazine', MANUSCRIPT: 'manuscript', MAP: 'map', NEWSPAPER: 'newspaper',
  PHOTO: 'photo', TOMBSTONE: 'tombstone', VIDEO: 'video',
};

export function parseMediaType551(node: RawNode): MediaStructure {
  const out: MediaStructure = {
    payload: parseEnum(reqText(node), MEDIA_551, '5.5.1', node.position) as MediaEnum,
  };
  if (node.children.length > 0) {
    fail('structure.unknown-tag', `The tag ${(node.children[0] as RawNode).tag} is not allowed under TYPE`, (node.children[0] as RawNode).position);
  }
  return out;
}

export function parseMediaFileTranslation(node: RawNode, ctx: Ctx): MediaFileTranslation {
  const out: MediaFileTranslation = { payload: reqText(node), form: null as unknown as MediaFormatStructure };
  dispatch(
    node,
    out,
    {
      FORM: (child) => {
        if (out.form !== (null as unknown as MediaFormatStructure)) {
          fail('structure.cardinality', 'At most one FORM is allowed under TRAN', child.position);
        }
        out.form = parseMediaFormatStructure(child, ctx);
      },
    },
    ctx,
  );
  if (out.form === (null as unknown as MediaFormatStructure)) {
    fail('structure.missing-required', 'The TRAN structure requires a FORM substructure', node.position);
  }
  return out;
}

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
    handlers["EXID"] = (child) => {
      (rec.identifiers ??= []).push(parseExternalIdentifier(child, ctx));
    };
  } else {
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
    handlers["EXID"] = (child) => {
      (rec.identifiers ??= []).push(parseExternalIdentifier(child, ctx));
    };
  } else {
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

// ---------------------------------------------------------------------------
