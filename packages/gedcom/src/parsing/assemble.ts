/**
 * The strict assembler: maps the raw tree onto the typed model.
 *
 * One parameterized implementation serves both GEDCOM 7.0 and GEDCOM 5.5.1
 * (the per-version differences are handled where the grammars differ).
 * Every violation — unknown tags, cardinality, missing payloads, bad enum
 * values, dangling pointers — is a typed error with the position of the
 * offending line.
 */

import { DOCUMENT_START, fail, run, type ParseResult } from '../errors';
import {
  ADOPTION_ENUM_VALUES,
  EVENT_ATTRIBUTE_ENUM_VALUES,
  EVENT_ENUM_VALUES,
  FAMILY_CHILD_STATUS_ENUM_VALUES,
  MEDIA_ENUM_VALUES,
  NAME_TYPE_ENUM_VALUES,
  ORDINANCE_STATUS_ENUM_VALUES,
  PEDIGREE_ENUM_VALUES,
  QUALITY_ENUM_VALUES,
  RESTRICTION_ENUM_VALUES,
  ROLE_ENUM_VALUES,
  SEX_ENUM_VALUES,
} from '../enumerations';
import type { MediaEnum, OrdinanceStatusEnum } from '../enumerations';
import type { CharacterSet, ListEnum } from '../primitives';
import type {
  AddressStructure,
  AdoptionFamilyLink,
  AdoptionStructure,
  AgeStructure,
  AliasLink,
  AssociationStructure,
  CallNumberStructure,
  ChangeDate,
  CharacterSetStructure,
  ChildFamilyLink,
  Corporation,
  CreationDate,
  CropStructure,
  DateExactStructure,
  DatePeriodStructure,
  DateStructure,
  EventDetail,
  ExternalIdentifierStructure,
  ExtensionRecord,
  ExtensionStructure,
  FamilyChildCountAttribute,
  FamilyChildLink,
  FamilyChildStatusStructure,
  FamilyEventDetail,
  FamilyEventStructure,
  FamilyGenericAttribute,
  FamilyPartnerEventDetail,
  FamilyPartnerLink,
  FamilyRecord,
  FamilyResidenceAttribute,
  Gedcom,
  GedcomDataset,
  GedcomRecord,
  GedcomStructureBase,
  Header,
  HeaderPlace,
  HeaderSource,
  HeaderSourceData,
  IndividualAttributeStructure,
  IndividualEventDetail,
  IndividualEventStructure,
  IndividualRecord,
  LdsIndividualOrdinance,
  LdsOrdinanceDetail,
  MapCoordinates,
  MediaFile,
  MediaFileTranslation,
  MediaFormatStructure,
  MediaStructure,
  MultimediaLink,
  MultimediaRecord,
  NameTranslation,
  NameTypeStructure,
  NonEventStructure,
  Note,
  NoteRecord,
  NoteReference,
  NoteStructure,
  NoteTranslation,
  OrdinanceStatusStructure,
  PedigreeStructure,
  PersonalNamePieces,
  PersonalNameStructure,
  PhoneticNameVariation,
  PhoneticPlaceVariation,
  PlaceStructure,
  PlaceTranslation,
  ReferenceIdentifierStructure,
  RepositoryRecord,
  RoleStructure,
  RomanizedNameVariation,
  RomanizedPlaceVariation,
  Schema,
  SharedNoteRecord,
  SharedNoteReference,
  SortDateStructure,
  SourceCitation,
  SourceCitationData,
  SourceCitationEvent,
  SourceDataEvent,
  SourceRecord,
  SourceRecordData,
  SourceRepositoryCitation,
  SourceText,
  SpouseFamilyLink,
  SpouseSealingOrdinance,
  SubmissionRecord,
  SubmitterRecord,
  TagDefinitionStructure,
  Trailer,
  UniqueIdentifierStructure,
} from '../structures';
import { decodeDocument } from './decode';
import { parseRawDocument, type RawNode } from './lines';
import {
  parseAge551,
  parseAge70,
  parseDateExact70,
  parseDatePeriod70,
  parseDateValue551,
  parseDateValue70,
  parseEnum,
  parseLanguage551,
  parseLatitude,
  parseListEnum,
  parseListText,
  parseLongitude,
  parseMediaFormat551,
  parsePersonalName,
  parseTagDefinition,
  parseTime551,
  parseTime70,
} from './types';

interface Ctx {
  version: '7.0' | '5.5.1';
  xrefs: Set<string>;
  synthetic: MultimediaRecord[];
  syntheticIndex: number;
}

// ---------------------------------------------------------------------------
// Payload readers
// ---------------------------------------------------------------------------

function reqText(node: RawNode): string {
  if (node.value.kind !== 'text') {
    fail('structure.missing-payload', `The ${node.tag} line requires a text value`, node.position);
  }
  return node.value.text;
}

function resolvePtr(pointer: string, ctx: Ctx, node: RawNode): string {
  if (ctx.version === '7.0' && pointer === '@VOID@') {
    return pointer;
  }
  if (!ctx.xrefs.has(pointer)) {
    fail('document.xref-not-found', `Pointer ${pointer} does not match any cross-reference identifier`, node.position);
  }
  return pointer;
}

function reqPtr(node: RawNode, ctx: Ctx): string {
  if (node.value.kind !== 'pointer') {
    fail('structure.missing-payload', `The ${node.tag} line requires a pointer value`, node.position);
  }
  return resolvePtr(node.value.pointer, ctx, node);
}

function optPtr(node: RawNode, ctx: Ctx): string | undefined {
  if (node.value.kind === 'absent') {
    return undefined;
  }
  if (node.value.kind !== 'pointer') {
    fail('structure.unexpected-payload', `The ${node.tag} line must not carry a text value`, node.position);
  }
  return resolvePtr(node.value.pointer, ctx, node);
}

function noPayload(node: RawNode): void {
  if (node.value.kind !== 'absent') {
    fail('structure.unexpected-payload', `The ${node.tag} line must not have a value`, node.position);
  }
}

/** The optional `Y` assertion payload. */
function yFlag(node: RawNode): true | undefined {
  if (node.value.kind === 'absent') {
    return undefined;
  }
  if (node.value.kind === 'text' && node.value.text === 'Y') {
    return true;
  }
  fail('structure.unexpected-payload', `The ${node.tag} payload must be Y or absent`, node.position);
}

function reqDigits(node: RawNode): number {
  const text = reqText(node);
  if (!/^\d+$/.test(text)) {
    fail('structure.unexpected-payload', `The ${node.tag} payload must be a non-negative integer, got "${text}"`, node.position);
  }
  return Number(text);
}

// ---------------------------------------------------------------------------
// Children helpers
// ---------------------------------------------------------------------------

function kids(node: RawNode, tag: string): RawNode[] {
  return node.children.filter((child) => child.tag === tag);
}

/** At most one occurrence; a second is a cardinality error. */
function one(node: RawNode, tag: string): RawNode | undefined {
  const list = kids(node, tag);
  if (list.length > 1) {
    fail('structure.cardinality', `At most one ${tag} is allowed here`, (list[1] as RawNode).position);
  }
  return list[0];
}

/** Exactly one occurrence. */
function req(node: RawNode, tag: string): RawNode {
  const found = one(node, tag);
  if (found === undefined) {
    fail('structure.missing-required', `The ${node.tag} structure requires a ${tag} substructure`, node.position);
  }
  return found;
}

/** GEDCOM 5.5.1 {0:3} limits. */
function atMostThree(node: RawNode, tag: string): RawNode[] {
  const list = kids(node, tag);
  if (list.length > 3) {
    fail('structure.cardinality', `At most 3 ${tag} substructures are allowed`, (list[3] as RawNode).position);
  }
  return list;
}

function addExtension(out: GedcomStructureBase, node: RawNode): void {
  const list = out.extensions ?? [];
  list.push(parseExtension(node));
  out.extensions = list;
}

function parseExtension(node: RawNode): ExtensionStructure {
  const payload =
    node.value.kind === 'text' ? node.value.text : node.value.kind === 'pointer' ? node.value.pointer : undefined;
  return {
    tag: node.tag,
    ...(payload === undefined ? {} : { payload }),
    children: node.children.map(parseExtension),
  };
}

function dispatch(
  node: RawNode,
  out: GedcomStructureBase,
  handlers: Record<string, (child: RawNode) => void>,
  _ctx: Ctx,
  singles: readonly string[] = [],
): void {
  const seen = new Set<string>();
  for (const child of node.children) {
    const handler = handlers[child.tag];
    if (handler === undefined) {
      if (child.tag.startsWith('_')) {
        addExtension(out, child);
        continue;
      }
      fail('structure.unknown-tag', `The tag ${child.tag} is not allowed in this context (${node.tag})`, child.position);
    }
    if (singles.includes(child.tag)) {
      if (seen.has(child.tag)) {
        fail('structure.cardinality', `At most one ${child.tag} is allowed here`, child.position);
      }
      seen.add(child.tag);
    }
    handler(child);
  }
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

function parseDocument(raw: { nodes: RawNode[] }, version: '7.0' | '5.5.1'): GedcomDataset {
  const ctx: Ctx = {
    version,
    xrefs: new Set(raw.nodes.map((node) => node.xref).filter((xref): xref is string => xref !== undefined)),
    synthetic: [],
    syntheticIndex: 0,
  };
  const nodes = raw.nodes;

  if (nodes.length === 0 || nodes[0]?.tag !== 'HEAD') {
    fail('document.missing-header', 'The document must begin with a HEAD line', nodes[0]?.position ?? DOCUMENT_START);
  }
  const header = parseHeader(nodes[0] as RawNode, ctx);

  let index = 1;
  let submission: SubmissionRecord | undefined;
  if (version === '5.5.1' && nodes[index]?.tag === 'SUBN') {
    submission = parseSubmissionRecord(nodes[index] as RawNode, ctx);
    index++;
  }

  const records: GedcomRecord[] = [];
  let trailer: Trailer | undefined;
  for (; index < nodes.length; index++) {
    const node = nodes[index] as RawNode;
    if (node.tag === 'TRLR') {
      noPayload(node);
      if (node.children.length > 0) {
        fail('structure.unexpected-payload', 'The TRLR line must not have substructures', (node.children[0] as RawNode).position);
      }
      if (node.xref !== undefined) {
        fail('line.xref-on-substructure', 'The TRLR pseudo-structure must not have a cross-reference identifier', node.position);
      }
      trailer = { tag: 'TRLR' };
      if (index !== nodes.length - 1) {
        fail('document.trailer-not-last', 'The TRLR line must be the last line of the document', node.position);
      }
      continue;
    }
    if (trailer !== undefined) {
      fail('document.trailer-not-last', 'The TRLR line must be the last line of the document', node.position);
    }
    records.push(parseRecord(node, ctx));
  }
  if (trailer === undefined) {
    fail('document.missing-trailer', 'The document must end with a TRLR line', DOCUMENT_START);
  }

  records.push(...ctx.synthetic);
  return {
    header,
    ...(submission === undefined ? {} : { submission }),
    records,
    trailer,
  };
}

function parseRecord(node: RawNode, ctx: Ctx): GedcomRecord {
  switch (node.tag) {
    case 'FAM':
      return parseFamilyRecord(node, ctx);
    case 'INDI':
      return parseIndividualRecord(node, ctx);
    case 'OBJE':
      return parseMultimediaRecord(node, ctx);
    case 'REPO':
      return parseRepositoryRecord(node, ctx);
    case 'SNOTE':
      if (ctx.version !== '7.0') {
        fail('structure.unknown-tag', 'The SNOTE record does not exist in GEDCOM 5.5.1', node.position);
      }
      return parseSharedNoteRecord(node, ctx);
    case 'NOTE':
      if (ctx.version !== '5.5.1') {
        fail('structure.unknown-tag', 'The NOTE record does not exist in GEDCOM 7.0 (use SNOTE)', node.position);
      }
      return parseNoteRecord(node, ctx);
    case 'SOUR':
      return parseSourceRecord(node, ctx);
    case 'SUBM':
      return parseSubmitterRecord(node, ctx);
    case 'SUBN':
      fail('structure.unknown-tag', 'The SUBN record must immediately follow the header', node.position);
    default:
      if (node.tag.startsWith('_')) {
        return parseExtension(node) as ExtensionRecord;
      }
      fail('structure.unknown-tag', `Unknown record tag ${node.tag}`, node.position);
  }
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function parseHeader(node: RawNode, ctx: Ctx): Header {
  noPayload(node);
  if (node.xref !== undefined) {
    fail('line.xref-on-substructure', 'The HEAD pseudo-structure must not have a cross-reference identifier', node.position);
  }
  const header: Header = { tag: 'HEAD', gedcom: null as unknown as Gedcom };
  dispatch(
    node,
    header,
    {
      GEDC: (child) => {
        if (header.gedcom !== (null as unknown as Gedcom)) {
          fail('structure.cardinality', 'At most one GEDC is allowed in the header', child.position);
        }
        header.gedcom = parseGedc(child, ctx);
      },
      ...(ctx.version === '7.0'
        ? {
            SCHMA: (child) => {
              header.schema = parseSchema(child, ctx);
            },
          }
        : {}),
      SOUR: (child) => {
        header.source = parseHeaderSource(child, ctx);
      },
      DEST: (child) => {
        header.destination = reqText(child);
      },
      DATE: (child) => {
        header.date = parseDateExactStructure(child, ctx, ctx.version === '7.0');
      },
      SUBM: (child) => {
        header.submitter = reqPtr(child, ctx);
      },
      ...(ctx.version === '5.5.1'
        ? {
            SUBN: (child) => {
              header.submission = reqPtr(child, ctx);
            },
            FILE: (child) => {
              header.fileName = reqText(child);
            },
          }
        : {}),
      COPR: (child) => {
        header.copyright = reqText(child);
      },
      LANG: (child) => {
        header.language = parseLanguage(child, ctx);
      },
      PLAC: (child) => {
        header.place = parseHeaderPlace(child, ctx);
      },
      NOTE: (child) => {
        header.note = parseNoteStructure(child, ctx);
      },
      ...(ctx.version === '5.5.1'
        ? {
            CHAR: (child) => {
              header.characterSet = parseCharacterSetStructure(child);
            },
          }
        : {}),
    },
    ctx,
    ['SCHMA', 'SOUR', 'DEST', 'DATE', 'SUBM', 'SUBN', 'FILE', 'COPR', 'LANG', 'PLAC', 'NOTE', 'CHAR'],
  );
  if (header.gedcom === (null as unknown as Gedcom)) {
    fail('structure.missing-required', 'The header requires a GEDC substructure', node.position);
  }
  if (ctx.version === '5.5.1') {
    if (header.source === undefined) {
      fail('structure.missing-required', 'The 5.5.1 header requires a SOUR substructure', node.position);
    }
    if (header.submitter === undefined) {
      fail('structure.missing-required', 'The 5.5.1 header requires a SUBM substructure', node.position);
    }
    if (header.characterSet === undefined) {
      fail('structure.missing-required', 'The 5.5.1 header requires a CHAR substructure', node.position);
    }
  }
  return header;
}

function parseGedc(node: RawNode, ctx: Ctx): Gedcom {
  noPayload(node);
  const gedcom: Gedcom = { version: reqText(req(node, 'VERS')) };
  const formNode = one(node, 'FORM');
  if (ctx.version === '5.5.1') {
    if (formNode === undefined) {
      fail('structure.missing-required', 'The 5.5.1 GEDC structure requires a FORM substructure', node.position);
    }
    const form = reqText(formNode);
    if (form.toUpperCase() !== 'LINEAGE-LINKED') {
      fail('enum.invalid-value', `Unknown GEDCOM form "${form}"; expected LINEAGE-LINKED`, formNode.position);
    }
    gedcom.form = form;
  } else if (formNode !== undefined) {
    fail('structure.unknown-tag', 'The FORM tag is not allowed under GEDC in GEDCOM 7.0', formNode.position);
  }
  dispatch(node, gedcom, { VERS: () => undefined, FORM: () => undefined }, ctx);
  if (ctx.version === '7.0') {
    if (!/^7\./.test(gedcom.version)) {
      fail('document.wrong-version', `GEDC.VERS "${gedcom.version}" is not a GEDCOM 7.x version`, node.position);
    }
  } else if (/^7\./.test(gedcom.version)) {
    fail('document.wrong-version', `GEDC.VERS "${gedcom.version}" is not a GEDCOM 5.x version`, node.position);
  }
  return gedcom;
}

function parseSchema(node: RawNode, ctx: Ctx): Schema {
  noPayload(node);
  const schema: Schema = { tagDefinitions: [] };
  dispatch(
    node,
    schema,
    {
      TAG: (child) => {
        schema.tagDefinitions.push(parseTagDefinitionStructure(child));
      },
    },
    ctx,
  );
  return schema;
}

function parseTagDefinitionStructure(node: RawNode): TagDefinitionStructure {
  if (node.children.length > 0) {
    fail('structure.unexpected-payload', 'A TAG definition must not have substructures', (node.children[0] as RawNode).position);
  }
  return { payload: parseTagDefinition(reqText(node), node.position) };
}

function parseHeaderSource(node: RawNode, ctx: Ctx): HeaderSource {
  const source: HeaderSource = { payload: reqText(node) };
  if (ctx.version === '5.5.1' && /\s/.test(source.payload)) {
    fail('enum.invalid-value', 'The 5.5.1 APPROVED_SYSTEM_ID must not contain spaces (use underscores)', node.position);
  }
  dispatch(
    node,
    source,
    {
      VERS: (child) => {
        source.version = reqText(child);
      },
      NAME: (child) => {
        source.name = reqText(child);
      },
      CORP: (child) => {
        source.corporation = parseCorporation(child, ctx);
      },
      DATA: (child) => {
        source.data = parseHeaderSourceData(child, ctx);
      },
    },
    ctx,
  );
  return source;
}

function parseCorporation(node: RawNode, ctx: Ctx): Corporation {
  const corp: Corporation = { payload: reqText(node) };
  dispatch(
    node,
    corp,
    {
      ADDR: (child) => {
        corp.address = parseAddressStructure(child, ctx);
      },
      PHON: (child) => {
        (corp.phone ??= []).push(reqText(child));
      },
      EMAIL: (child) => {
        (corp.email ??= []).push(reqText(child));
      },
      FAX: (child) => {
        (corp.fax ??= []).push(reqText(child));
      },
      WWW: (child) => {
        (corp.www ??= []).push(reqText(child));
      },
    },
    ctx,
  );
  return corp;
}

function parseHeaderSourceData(node: RawNode, ctx: Ctx): HeaderSourceData {
  const data: HeaderSourceData = { payload: reqText(node) };
  dispatch(
    node,
    data,
    {
      DATE: (child) => {
        data.date = parseDateExactStructure(child, ctx, ctx.version === '7.0');
      },
      COPR: (child) => {
        data.copyright = reqText(child);
      },
    },
    ctx,
  );
  return data;
}

function parseHeaderPlace(node: RawNode, ctx: Ctx): HeaderPlace {
  noPayload(node);
  const place: HeaderPlace = { form: parseListText(reqText(req(node, 'FORM'))) };
  dispatch(node, place, { FORM: () => undefined }, ctx);
  return place;
}

function parseCharacterSetStructure(node: RawNode): CharacterSetStructure {
  const text = reqText(node);
  const upper = text.toUpperCase();
  if (upper !== 'ANSEL' && upper !== 'ASCII' && upper !== 'UTF-8' && upper !== 'UNICODE') {
    fail('charset.invalid', `Unknown character set "${text}"; expected ANSEL, UTF-8, UNICODE, or ASCII`, node.position);
  }
  const out: CharacterSetStructure = { payload: upper as CharacterSet };
  dispatch(
    node,
    out,
    {
      VERS: (child) => {
        out.version = reqText(child);
      },
    },
    { version: '5.5.1', xrefs: new Set(), synthetic: [], syntheticIndex: 0 },
  );
  return out;
}

function parseLanguage(node: RawNode, ctx: Ctx): string {
  const text = reqText(node);
  if (ctx.version === '5.5.1') {
    return parseLanguage551(text, node.position);
  }
  return text;
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

const FAMILY_EVENT_TAGS = ['ANUL', 'CENS', 'DIV', 'DIVF', 'ENGA', 'MARB', 'MARC', 'MARL', 'MARR', 'MARS', 'EVEN'];
const INDIVIDUAL_EVENT_TAGS = [
  'ADOP', 'BAPM', 'BARM', 'BASM', 'BIRT', 'BLES', 'BURI', 'CENS', 'CHR', 'CHRA', 'CONF', 'CREM',
  'DEAT', 'EMIG', 'FCOM', 'GRAD', 'IMMI', 'NATU', 'ORDN', 'PROB', 'RETI', 'WILL', 'EVEN',
];
const INDIVIDUAL_ATTRIBUTE_TAGS = [
  'CAST', 'DSCR', 'EDUC', 'IDNO', 'NATI', 'NCHI', 'NMR', 'OCCU', 'PROP', 'RELI', 'RESI', 'SSN', 'TITL', 'FACT',
];

function parseFamilyRecord(node: RawNode, ctx: Ctx): FamilyRecord {
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

function parseIndividualRecord(node: RawNode, ctx: Ctx): IndividualRecord {
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

function parseMultimediaRecord(node: RawNode, ctx: Ctx): MultimediaRecord {
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

function parseMediaFile(node: RawNode, ctx: Ctx): MediaFile {
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

function parseMediaFormatStructure(node: RawNode, ctx: Ctx): MediaFormatStructure {
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

function parseMediaStructure(node: RawNode, ctx: Ctx): MediaStructure {
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
const MEDIA_551: Record<string, string> = {
  AUDIO: 'audio', BOOK: 'book', CARD: 'card', ELECTRONIC: 'electronic', FICHE: 'fiche',
  FILM: 'film', MAGAZINE: 'magazine', MANUSCRIPT: 'manuscript', MAP: 'map', NEWSPAPER: 'newspaper',
  PHOTO: 'photo', TOMBSTONE: 'tombstone', VIDEO: 'video',
};

function parseMediaType551(node: RawNode): MediaStructure {
  const out: MediaStructure = {
    payload: parseEnum(reqText(node), MEDIA_551, '5.5.1', node.position) as MediaEnum,
  };
  if (node.children.length > 0) {
    fail('structure.unknown-tag', `The tag ${(node.children[0] as RawNode).tag} is not allowed under TYPE`, (node.children[0] as RawNode).position);
  }
  return out;
}

function parseMediaFileTranslation(node: RawNode, ctx: Ctx): MediaFileTranslation {
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

function parseRepositoryRecord(node: RawNode, ctx: Ctx): RepositoryRecord {
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

function parseSharedNoteRecord(node: RawNode, ctx: Ctx): SharedNoteRecord {
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

function parseNoteRecord(node: RawNode, ctx: Ctx): NoteRecord {
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

function parseSourceRecord(node: RawNode, ctx: Ctx): SourceRecord {
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

function parseSourceRecordData(node: RawNode, ctx: Ctx): SourceRecordData {
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

function parseSourceDataEvent(node: RawNode, ctx: Ctx): SourceDataEvent {
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

function parseSourceJurisdictionPlace(node: RawNode, ctx: Ctx): PlaceStructure {
  // 5.5.1: a plain place name; 7.0: a full PLACE_STRUCTURE.
  if (ctx.version === '5.5.1') {
    if (node.children.length > 0) {
      fail('structure.unknown-tag', `The tag ${(node.children[0] as RawNode).tag} is not allowed under PLAC here`, (node.children[0] as RawNode).position);
    }
    return { tag: 'PLAC', payload: parseListText(reqText(node)) };
  }
  return parsePlaceStructure(node, ctx);
}

function parseSourceText(node: RawNode, ctx: Ctx): SourceText {
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

function parseSubmitterRecord(node: RawNode, ctx: Ctx): SubmitterRecord {
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

function parseSubmissionRecord(node: RawNode, ctx: Ctx): SubmissionRecord {
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
// Substructures
// ---------------------------------------------------------------------------

function parseAddressStructure(node: RawNode, ctx: Ctx): AddressStructure {
  const out: AddressStructure = { payload: reqText(node) };
  const handlers: Record<string, (child: RawNode) => void> = {
    ADR1: (child) => {
      out.line1 = reqText(child);
    },
    ADR2: (child) => {
      out.line2 = reqText(child);
    },
    ADR3: (child) => {
      out.line3 = reqText(child);
    },
    CITY: (child) => {
      out.city = reqText(child);
    },
    STAE: (child) => {
      out.state = reqText(child);
    },
    POST: (child) => {
      out.postalCode = reqText(child);
    },
    CTRY: (child) => {
      out.country = reqText(child);
    },
  };
  if (ctx.version === '5.5.1') {
    handlers["PHON"] = (_child) => {
      if (out.phone === undefined) {
        out.phone = atMostThree(node, 'PHON').map((item) => reqText(item));
      }
    };
    handlers["EMAIL"] = (_child) => {
      if (out.email === undefined) {
        out.email = atMostThree(node, 'EMAIL').map((item) => reqText(item));
      }
    };
    handlers["FAX"] = (_child) => {
      if (out.fax === undefined) {
        out.fax = atMostThree(node, 'FAX').map((item) => reqText(item));
      }
    };
    handlers["WWW"] = (_child) => {
      if (out.www === undefined) {
        out.www = atMostThree(node, 'WWW').map((item) => reqText(item));
      }
    };
  }
  dispatch(node, out, handlers, ctx, ['ADR1', 'ADR2', 'ADR3', 'CITY', 'STAE', 'POST', 'CTRY']);
  return out;
}

function parseAssociation(node: RawNode, ctx: Ctx): AssociationStructure {
  const out: AssociationStructure = { tag: 'ASSO', individual: reqPtr(node, ctx) };
  dispatch(
    node,
    out,
    {
      PHRASE: (child) => {
        out.phrase = reqText(child);
      },
      ROLE: (child) => {
        out.role = parseRole(child, ctx);
      },
      RELA: (child) => {
        out.relationship = reqText(child);
      },
      NOTE: (child) => {
        (out.notes ??= []).push(parseNoteStructure(child, ctx));
      },
      SOUR: (child) => {
        (out.citations ??= []).push(parseSourceCitation(child, ctx));
      },
    },
    ctx,
    ['PHRASE', 'ROLE', 'RELA'],
  );
  if (ctx.version === '7.0' && out.role === undefined) {
    fail('structure.missing-required', 'The ASSO structure requires a ROLE substructure', node.position);
  }
  if (ctx.version === '5.5.1' && out.relationship === undefined) {
    fail('structure.missing-required', 'The 5.5.1 ASSO structure requires a RELA substructure', node.position);
  }
  return out;
}

function parseRole(node: RawNode, ctx: Ctx): RoleStructure {
  const raw = reqText(node);
  if (ctx.version === '7.0') {
    const out: RoleStructure = { payload: parseEnum(raw, ROLE_ENUM_VALUES, '7.0', node.position) };
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
  // 5.5.1 ROLE_IN_EVENT: one of six tags (case-insensitive) or a
  // parenthesized descriptor (normalized to OTHER + phrase).
  if (node.children.length > 0) {
    fail('structure.unknown-tag', `The tag ${(node.children[0] as RawNode).tag} is not allowed under ROLE`, (node.children[0] as RawNode).position);
  }
  const upper = raw.toUpperCase();
  if (upper === 'CHIL' || upper === 'HUSB' || upper === 'WIFE' || upper === 'MOTH' || upper === 'FATH' || upper === 'SPOU') {
    return { payload: upper as 'CHIL' | 'HUSB' | 'WIFE' | 'MOTH' | 'FATH' | 'SPOU' };
  }
  if (raw.startsWith('(') && raw.endsWith(')') && raw.length >= 2) {
    return { payload: 'OTHER', phrase: raw.slice(1, -1) };
  }
  fail('enum.invalid-value', `"${raw}" is not a permitted ROLE_IN_EVENT value`, node.position);
}

function parseChangeDate(node: RawNode, ctx: Ctx): ChangeDate {
  noPayload(node);
  const out: ChangeDate = { tag: 'CHAN', date: null as unknown as DateExactStructure };
  dispatch(
    node,
    out,
    {
      DATE: (child) => {
        out.date = parseDateExactStructure(child, ctx, true);
      },
      NOTE: (child) => {
        (out.notes ??= []).push(parseNoteStructure(child, ctx));
      },
    },
    ctx,
  );
  if (out.date === (null as unknown as DateExactStructure)) {
    fail('structure.missing-required', 'The CHAN structure requires a DATE substructure', node.position);
  }
  return out;
}

function parseCreationDate(node: RawNode, ctx: Ctx): CreationDate {
  noPayload(node);
  const out: CreationDate = { tag: 'CREA', date: null as unknown as DateExactStructure };
  dispatch(
    node,
    out,
    {
      DATE: (child) => {
        out.date = parseDateExactStructure(child, ctx, true);
      },
    },
    ctx,
  );
  if (out.date === (null as unknown as DateExactStructure)) {
    fail('structure.missing-required', 'The CREA structure requires a DATE substructure', node.position);
  }
  return out;
}

function parseDateStructure(node: RawNode, ctx: Ctx): DateStructure {
  const out: DateStructure = {};
  const raw = node.value.kind === 'text' ? node.value.text : undefined;
  if (ctx.version === '7.0') {
    out.value = raw === undefined ? { kind: 'unknown' } : parseDateValue70(raw, node.position);
    dispatch(
      node,
      out,
      {
        TIME: (child) => {
          out.time = parseTime70(reqText(child), child.position);
        },
        PHRASE: (child) => {
          out.phrase = reqText(child);
        },
      },
      ctx,
      ['TIME', 'PHRASE'],
    );
    return out;
  }
  if (raw === undefined) {
    fail('structure.missing-payload', 'The 5.5.1 DATE line requires a value', node.position);
  }
  if (node.children.length > 0) {
    fail('structure.unknown-tag', `The tag ${(node.children[0] as RawNode).tag} is not allowed under DATE`, (node.children[0] as RawNode).position);
  }
  const parsed = parseDateValue551(raw, node.position);
  out.value = parsed.value;
  const phrase = parsed.phrase ?? (parsed.dualYear ? raw : undefined);
  if (phrase !== undefined) {
    out.phrase = phrase;
  }
  return out;
}

function parseDateExactStructure(node: RawNode, ctx: Ctx, allowTime: boolean): DateExactStructure {
  const raw = reqText(node);
  if (ctx.version === '7.0') {
    const out: DateExactStructure = { value: parseDateExact70(raw, node.position) };
    dispatch(
      node,
      out,
      {
        TIME: (child) => {
          if (!allowTime) {
            fail('structure.unknown-tag', 'A TIME is not allowed under this DATE', child.position);
          }
          out.time = parseTime70(reqText(child), child.position);
        },
      },
      ctx,
    );
    return out;
  }
  const parsed = parseDateValue551(raw, node.position);
  const value = parsed.value;
  if (value.kind !== 'date' || value.day === undefined || value.month === undefined) {
    fail('date.invalid', `Invalid 5.5.1 DATE_EXACT "${raw}"; expected "<day> <month> <year>"`, node.position);
  }
  if (parsed.dualYear || parsed.phrase !== undefined) {
    fail('date.invalid', `Invalid 5.5.1 DATE_EXACT "${raw}"`, node.position);
  }
  const out: DateExactStructure = {
    value: {
      day: value.day,
      month: value.month as 'JAN' | 'FEB' | 'MAR' | 'APR' | 'MAY' | 'JUN' | 'JUL' | 'AUG' | 'SEP' | 'OCT' | 'NOV' | 'DEC',
      year: value.year,
      ...(value.epoch === undefined ? {} : { epoch: value.epoch }),
    },
  };
  if (allowTime) {
    const timeNode = one(node, 'TIME');
    if (timeNode !== undefined) {
      out.time = parseTime551(reqText(timeNode), timeNode.position);
    }
  } else if (node.children.length > 0) {
    fail('structure.unknown-tag', `The tag ${(node.children[0] as RawNode).tag} is not allowed under DATE`, (node.children[0] as RawNode).position);
  }
  return out;
}

function parseDatePeriodStructure(node: RawNode, ctx: Ctx): DatePeriodStructure {
  if (ctx.version === '7.0') {
    const raw = node.value.kind === 'text' ? node.value.text : undefined;
    const out: DatePeriodStructure = { value: raw === undefined ? { kind: 'period' } : parseDatePeriod70(raw, node.position) };
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
  const out: DatePeriodStructure = { value: parseDatePeriod70(reqText(node), node.position) };
  if (node.children.length > 0) {
    fail('structure.unknown-tag', `The tag ${(node.children[0] as RawNode).tag} is not allowed under DATE`, (node.children[0] as RawNode).position);
  }
  return out;
}

function parseSortDateStructure(node: RawNode, ctx: Ctx): SortDateStructure {
  const out: SortDateStructure = {};
  const raw = node.value.kind === 'text' ? node.value.text : undefined;
  if (raw !== undefined) {
    out.value = parseDateValue70(raw, node.position);
  }
  dispatch(
    node,
    out,
    {
      TIME: (child) => {
        out.time = parseTime70(reqText(child), child.position);
      },
      PHRASE: (child) => {
        out.phrase = reqText(child);
      },
    },
    ctx,
  );
  return out;
}

function parseAge(node: RawNode, ctx: Ctx): AgeStructure {
  const out: AgeStructure = {
    payload: ctx.version === '7.0' ? parseAge70(reqText(node), node.position) : parseAge551(reqText(node), node.position),
  };
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

function parseReferenceIdentifier(node: RawNode, ctx: Ctx): ReferenceIdentifierStructure {
  const out: ReferenceIdentifierStructure = { tag: 'REFN', payload: reqText(node) };
  dispatch(
    node,
    out,
    {
      TYPE: (child) => {
        out.type = reqText(child);
      },
    },
    ctx,
  );
  return out;
}

function parseUniqueIdentifier(node: RawNode): UniqueIdentifierStructure {
  const out: UniqueIdentifierStructure = { tag: 'UID', payload: reqText(node) };
  if (node.children.length > 0) {
    fail('structure.unknown-tag', `The tag ${(node.children[0] as RawNode).tag} is not allowed under UID`, (node.children[0] as RawNode).position);
  }
  return out;
}

function parseExternalIdentifier(node: RawNode, ctx: Ctx): ExternalIdentifierStructure {
  const out: ExternalIdentifierStructure = { tag: 'EXID', payload: reqText(node) };
  dispatch(
    node,
    out,
    {
      TYPE: (child) => {
        const text = reqText(child);
        if (text === '' || /[\s\u0000-\u001f\u007f]/.test(text)) {
          fail('uri.invalid', `Invalid URI "${text}"`, child.position);
        }
        out.type = text;
      },
    },
    ctx,
  );
  return out;
}

function parseNonEvent(node: RawNode, ctx: Ctx): NonEventStructure {
  const out: NonEventStructure = {
    tag: 'NO',
    payload: parseEnum(reqText(node), EVENT_ENUM_VALUES, '7.0', node.position),
  };
  dispatch(
    node,
    out,
    {
      DATE: (child) => {
        out.date = parseDatePeriodStructure(child, ctx);
      },
      NOTE: (child) => {
        (out.notes ??= []).push(parseNoteStructure(child, ctx));
      },
      SOUR: (child) => {
        (out.citations ??= []).push(parseSourceCitation(child, ctx));
      },
    },
    ctx,
  );
  return out;
}

function parseNoteStructure(node: RawNode, ctx: Ctx): NoteStructure {
  if (node.tag === 'SNOTE') {
    const out: SharedNoteReference = { tag: 'SNOTE', note: reqPtr(node, ctx) };
    if (node.children.length > 0) {
      fail('structure.unknown-tag', `The tag ${(node.children[0] as RawNode).tag} is not allowed under SNOTE`, (node.children[0] as RawNode).position);
    }
    return out;
  }
  if (node.tag !== 'NOTE') {
    fail('structure.unknown-tag', `Unknown note structure tag ${node.tag}`, node.position);
  }
  if (ctx.version === '5.5.1' && node.value.kind === 'pointer') {
    const out: NoteReference = { tag: 'NOTE', note: resolvePtr(node.value.pointer, ctx, node) };
    if (node.children.length > 0) {
      fail('structure.unknown-tag', `The tag ${(node.children[0] as RawNode).tag} is not allowed under NOTE`, (node.children[0] as RawNode).position);
    }
    return out;
  }
  const raw = node.value.kind === 'text' ? node.value.text : undefined;
  const out: Note = { tag: 'NOTE', payload: raw ?? '' };
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
      TRAN: (child) => {
        (out.translations ??= []).push(parseNoteTranslation(child, ctx));
      },
      SOUR: (child) => {
        (out.citations ??= []).push(parseSourceCitation(child, ctx));
      },
    },
    ctx,
  );
  return out;
}

function parseNoteTranslation(node: RawNode, ctx: Ctx): NoteTranslation {
  const out: NoteTranslation = { payload: reqText(node) };
  let sawKind = false;
  dispatch(
    node,
    out,
    {
      MIME: (child) => {
        out.mediaType = reqText(child);
        sawKind = true;
      },
      LANG: (child) => {
        out.language = reqText(child);
        sawKind = true;
      },
    },
    ctx,
  );
  if (!sawKind) {
    fail('structure.missing-required', 'A NOTE.TRAN requires a MIME or LANG substructure', node.position);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Names and places
// ---------------------------------------------------------------------------

/** 7.0 name pieces: repeated tags ({0:M}). */
function pieces70(out: PersonalNamePieces, tag: string, child: RawNode): void {
  if (child.children.length > 0) {
    fail('structure.unknown-tag', `The tag ${(child.children[0] as RawNode).tag} is not allowed under ${tag}`, (child.children[0] as RawNode).position);
  }
  const text = reqText(child);
  switch (tag) {
    case 'NPFX':
      (out.namePrefixes ??= []).push(text);
      break;
    case 'GIVN':
      (out.givenNames ??= []).push(text);
      break;
    case 'NICK':
      (out.nicknames ??= []).push(text);
      break;
    case 'SPFX':
      (out.surnamePrefixes ??= []).push(text);
      break;
    case 'SURN':
      (out.surnames ??= []).push(text);
      break;
    case 'NSFX':
      (out.nameSuffixes ??= []).push(text);
      break;
  }
}

/** 5.5.1 name pieces: single occurrence ({0:1}), comma-separated values. */
function pieces551(out: PersonalNamePieces, tag: string, child: RawNode): void {
  if (child.children.length > 0) {
    fail('structure.unknown-tag', `The tag ${(child.children[0] as RawNode).tag} is not allowed under ${tag}`, (child.children[0] as RawNode).position);
  }
  const parts = reqText(child).split(',').map((part) => part.trim());
  switch (tag) {
    case 'NPFX':
      out.namePrefixes = parts;
      break;
    case 'GIVN':
      out.givenNames = parts;
      break;
    case 'NICK':
      out.nicknames = parts;
      break;
    case 'SPFX':
      out.surnamePrefixes = parts;
      break;
    case 'SURN':
      out.surnames = parts;
      break;
    case 'NSFX':
      out.nameSuffixes = parts;
      break;
  }
}

const PIECE_TAGS = ['NPFX', 'GIVN', 'NICK', 'SPFX', 'SURN', 'NSFX'];

function parsePersonalNameStructure(node: RawNode, ctx: Ctx): PersonalNameStructure {
  const out: PersonalNameStructure = {
    tag: 'NAME',
    payload: parsePersonalName(reqText(node), ctx.version, node.position),
  };
  const handlers: Record<string, (child: RawNode) => void> = {
    TYPE: (child) => {
      out.type = parseNameType(child, ctx);
    },
  };
  for (const tag of PIECE_TAGS) {
    handlers[tag] = (child) => {
      out.pieces ??= {};
      if (ctx.version === '7.0') {
        pieces70(out.pieces, tag, child);
      } else {
        pieces551(out.pieces, tag, child);
      }
    };
  }
  if (ctx.version === '7.0') {
    handlers["TRAN"] = (child) => {
      (out.translations ??= []).push(parseNameTranslation(child, ctx));
    };
    handlers["NOTE"] = (child) => {
      (out.notes ??= []).push(parseNoteStructure(child, ctx));
    };
    handlers["SOUR"] = (child) => {
      (out.citations ??= []).push(parseSourceCitation(child, ctx));
    };
  } else {
    handlers["FONE"] = (child) => {
      (out.phonetic ??= []).push(parsePhoneticNameVariation(child, ctx));
    };
    handlers["ROMN"] = (child) => {
      (out.romanized ??= []).push(parseRomanizedNameVariation(child, ctx));
    };
    handlers["NOTE"] = (child) => {
      out.pieces ??= {};
      (out.pieces.notes ??= []).push(parseNoteStructure(child, ctx));
    };
    handlers["SOUR"] = (child) => {
      out.pieces ??= {};
      (out.pieces.citations ??= []).push(parseSourceCitation(child, ctx));
    };
  }
  dispatch(node, out, handlers, ctx);
  return out;
}

function parseNameType(node: RawNode, ctx: Ctx): NameTypeStructure {
  const raw = reqText(node);
  if (ctx.version === '7.0') {
    const out: NameTypeStructure = { payload: parseEnum(raw, NAME_TYPE_ENUM_VALUES, '7.0', node.position) };
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
  if (node.children.length > 0) {
    fail('structure.unknown-tag', `The tag ${(node.children[0] as RawNode).tag} is not allowed under TYPE`, (node.children[0] as RawNode).position);
  }
  const known = ['AKA', 'BIRTH', 'IMMIGRANT', 'MAIDEN', 'MARRIED'];
  const upper = raw.toUpperCase();
  if (known.includes(upper)) {
    return { payload: upper as 'AKA' | 'BIRTH' | 'IMMIGRANT' | 'MAIDEN' | 'MARRIED' };
  }
  // 5.5.1 arbitrary user-defined value: normalized to OTHER + phrase.
  return { payload: 'OTHER', phrase: raw };
}

function parseNameTranslation(node: RawNode, ctx: Ctx): NameTranslation {
  const out: NameTranslation = {
    payload: parsePersonalName(reqText(node), '7.0', node.position),
    language: reqText(req(node, 'LANG')),
  };
  const handlers: Record<string, (child: RawNode) => void> = { LANG: () => undefined };
  for (const tag of PIECE_TAGS) {
    handlers[tag] = (child) => {
      out.pieces ??= {};
      pieces70(out.pieces, tag, child);
    };
  }
  dispatch(node, out, handlers, ctx);
  return out;
}

function parsePhoneticNameVariation(node: RawNode, ctx: Ctx): PhoneticNameVariation {
  const out: PhoneticNameVariation = {
    payload: parsePersonalName(reqText(node), '5.5.1', node.position),
    type: reqText(req(node, 'TYPE')),
  };
  const handlers: Record<string, (child: RawNode) => void> = { TYPE: () => undefined };
  for (const tag of PIECE_TAGS) {
    handlers[tag] = (child) => {
      out.pieces ??= {};
      pieces551(out.pieces, tag, child);
    };
  }
  dispatch(node, out, handlers, ctx);
  return out;
}

function parseRomanizedNameVariation(node: RawNode, ctx: Ctx): RomanizedNameVariation {
  const out: RomanizedNameVariation = {
    payload: parsePersonalName(reqText(node), '5.5.1', node.position),
    type: reqText(req(node, 'TYPE')),
  };
  const handlers: Record<string, (child: RawNode) => void> = { TYPE: () => undefined };
  for (const tag of PIECE_TAGS) {
    handlers[tag] = (child) => {
      out.pieces ??= {};
      pieces551(out.pieces, tag, child);
    };
  }
  dispatch(node, out, handlers, ctx);
  return out;
}

function parsePlaceStructure(node: RawNode, ctx: Ctx): PlaceStructure {
  const out: PlaceStructure = { tag: 'PLAC', payload: parseListText(reqText(node)) };
  const handlers: Record<string, (child: RawNode) => void> = {
    FORM: (child) => {
      out.form = parseListText(reqText(child));
    },
    MAP: (child) => {
      out.map = parseMapCoordinates(child, ctx);
    },
    NOTE: (child) => {
      (out.notes ??= []).push(parseNoteStructure(child, ctx));
    },
  };
  if (ctx.version === '7.0') {
    handlers["LANG"] = (child) => {
      out.language = reqText(child);
    };
    handlers["TRAN"] = (child) => {
      (out.translations ??= []).push(parsePlaceTranslation(child, ctx));
    };
    handlers["EXID"] = (child) => {
      (out.externalIds ??= []).push(parseExternalIdentifier(child, ctx));
    };
  } else {
    handlers["FONE"] = (child) => {
      (out.phonetic ??= []).push(parsePhoneticPlaceVariation(child));
    };
    handlers["ROMN"] = (child) => {
      (out.romanized ??= []).push(parseRomanizedPlaceVariation(child));
    };
  }
  dispatch(node, out, handlers, ctx, ['FORM', 'MAP']);
  return out;
}

function parsePlaceTranslation(node: RawNode, ctx: Ctx): PlaceTranslation {
  const out: PlaceTranslation = {
    payload: parseListText(reqText(node)),
    language: reqText(req(node, 'LANG')),
  };
  dispatch(node, out, { LANG: () => undefined }, ctx);
  return out;
}

function parsePhoneticPlaceVariation(node: RawNode): PhoneticPlaceVariation {
  const out: PhoneticPlaceVariation = {
    payload: parseListText(reqText(node)),
    type: reqText(req(node, 'TYPE')),
  };
  if (node.children.some((child) => child.tag !== 'TYPE')) {
    fail('structure.unknown-tag', 'Unexpected substructure under FONE', node.position);
  }
  return out;
}

function parseRomanizedPlaceVariation(node: RawNode): RomanizedPlaceVariation {
  const out: RomanizedPlaceVariation = {
    payload: parseListText(reqText(node)),
    type: reqText(req(node, 'TYPE')),
  };
  if (node.children.some((child) => child.tag !== 'TYPE')) {
    fail('structure.unknown-tag', 'Unexpected substructure under ROMN', node.position);
  }
  return out;
}

function parseMapCoordinates(node: RawNode, ctx: Ctx): MapCoordinates {
  noPayload(node);
  const latNode = req(node, 'LATI');
  const lonNode = req(node, 'LONG');
  const out: MapCoordinates = {
    latitude: parseLatitude(reqText(latNode), latNode.position),
    longitude: parseLongitude(reqText(lonNode), lonNode.position),
  };
  dispatch(node, out, { LATI: () => undefined, LONG: () => undefined }, ctx);
  return out;
}

// ---------------------------------------------------------------------------
// Sources and media links
// ---------------------------------------------------------------------------

function parseSourceCitation(node: RawNode, ctx: Ctx): SourceCitation {
  if (ctx.version === '7.0') {
    const out: SourceCitation = { tag: 'SOUR', source: reqPtr(node, ctx) };
    dispatch(
      node,
      out,
      {
        PAGE: (child) => {
          out.page = reqText(child);
        },
        DATA: (child) => {
          out.data = parseSourceCitationData(child, ctx);
        },
        EVEN: (child) => {
          out.event = parseSourceCitationEvent(child, ctx);
        },
        QUAY: (child) => {
          out.quality = parseEnum(reqText(child), QUALITY_ENUM_VALUES, '7.0', child.position);
        },
        OBJE: (child) => {
          (out.media ??= []).push(parseMultimediaLink(child, ctx));
        },
        NOTE: (child) => {
          (out.notes ??= []).push(parseNoteStructure(child, ctx));
        },
      },
      ctx,
      ['PAGE', 'DATA', 'EVEN', 'QUAY'],
    );
    return out;
  }
  // 5.5.1: pointer form or free-text description form.
  if (node.value.kind === 'pointer') {
    const out: SourceCitation = { tag: 'SOUR', source: resolvePtr(node.value.pointer, ctx, node) };
    dispatch(
      node,
      out,
      {
        PAGE: (child) => {
          out.page = reqText(child);
        },
        DATA: (child) => {
          out.data = parseSourceCitationData(child, ctx);
        },
        EVEN: (child) => {
          out.event = parseSourceCitationEvent(child, ctx);
        },
        QUAY: (child) => {
          out.quality = parseEnum(reqText(child), QUALITY_ENUM_VALUES, '5.5.1', child.position);
        },
        OBJE: (child) => {
          (out.media ??= []).push(parseMultimediaLink(child, ctx));
        },
        NOTE: (child) => {
          (out.notes ??= []).push(parseNoteStructure(child, ctx));
        },
      },
      ctx,
      ['PAGE', 'DATA', 'EVEN', 'QUAY'],
    );
    return out;
  }
  if (node.value.kind === 'absent') {
    fail('structure.missing-payload', 'The 5.5.1 SOUR line requires a pointer or a source description', node.position);
  }
  const out: SourceCitation = { tag: 'SOUR', source: '@VOID@', description: node.value.text };
  dispatch(
    node,
    out,
    {
      TEXT: (child) => {
        out.data ??= {};
        (out.data.texts ??= []).push(parseSourceText(child, ctx));
      },
      QUAY: (child) => {
        out.quality = parseEnum(reqText(child), QUALITY_ENUM_VALUES, '5.5.1', child.position);
      },
      OBJE: (child) => {
        (out.media ??= []).push(parseMultimediaLink(child, ctx));
      },
      NOTE: (child) => {
        (out.notes ??= []).push(parseNoteStructure(child, ctx));
      },
    },
    ctx,
    ['QUAY'],
  );
  return out;
}

function parseSourceCitationData(node: RawNode, ctx: Ctx): SourceCitationData {
  noPayload(node);
  const out: SourceCitationData = {};
  dispatch(
    node,
    out,
    {
      DATE: (child) => {
        out.date = parseDateStructure(child, ctx);
      },
      TEXT: (child) => {
        (out.texts ??= []).push(parseSourceText(child, ctx));
      },
    },
    ctx,
  );
  return out;
}

function parseSourceCitationEvent(node: RawNode, ctx: Ctx): SourceCitationEvent {
  const out: SourceCitationEvent = {
    payload: parseEnum(reqText(node), EVENT_ATTRIBUTE_ENUM_VALUES, ctx.version, node.position),
  };
  const handlers: Record<string, (child: RawNode) => void> = {
    ROLE: (child) => {
      out.role = parseRole(child, ctx);
    },
  };
  if (ctx.version === '7.0') {
    handlers["PHRASE"] = (child) => {
      out.phrase = reqText(child);
    };
  }
  dispatch(node, out, handlers, ctx);
  return out;
}

function parseSourceRepositoryCitation(node: RawNode, ctx: Ctx): SourceRepositoryCitation {
  const pointer = optPtr(node, ctx);
  const out: SourceRepositoryCitation = { tag: 'REPO', repository: pointer ?? '@VOID@' };
  dispatch(
    node,
    out,
    {
      NOTE: (child) => {
        (out.notes ??= []).push(parseNoteStructure(child, ctx));
      },
      CALN: (child) => {
        (out.callNumbers ??= []).push(parseCallNumber(child, ctx));
      },
    },
    ctx,
  );
  return out;
}

function parseCallNumber(node: RawNode, ctx: Ctx): CallNumberStructure {
  const out: CallNumberStructure = { payload: reqText(node) };
  dispatch(
    node,
    out,
    {
      MEDI: (child) => {
        out.medium = parseMediaStructure(child, ctx);
      },
    },
    ctx,
  );
  return out;
}

function parseMultimediaLink(node: RawNode, ctx: Ctx): MultimediaLink {
  if (ctx.version === '7.0') {
    const out: MultimediaLink = { tag: 'OBJE', object: reqPtr(node, ctx) };
    dispatch(
      node,
      out,
      {
        CROP: (child) => {
          out.crop = parseCrop(child, ctx);
        },
        TITL: (child) => {
          out.title = reqText(child);
        },
      },
      ctx,
    );
    return out;
  }
  // 5.5.1: pointer form, or inline form (synthesized into a record).
  if (node.value.kind === 'pointer') {
    const out: MultimediaLink = { tag: 'OBJE', object: resolvePtr(node.value.pointer, ctx, node) };
    if (node.children.length > 0) {
      fail('structure.unknown-tag', `The tag ${(node.children[0] as RawNode).tag} is not allowed under OBJE`, (node.children[0] as RawNode).position);
    }
    return out;
  }
  if (node.value.kind !== 'absent') {
    fail('structure.unexpected-payload', 'The 5.5.1 OBJE line takes a pointer or nothing', node.position);
  }
  const record: MultimediaRecord = { tag: 'OBJE', files: [] };
  let title: string | undefined;
  dispatch(
    node,
    record,
    {
      FILE: (child) => {
        record.files.push(parseMediaFile(child, ctx));
      },
      TITL: (child) => {
        title = reqText(child);
      },
    },
    ctx,
  );
  if (record.files.length === 0) {
    fail('structure.missing-required', 'An inline OBJE requires at least one FILE substructure', node.position);
  }
  if (title !== undefined) {
    (record.files[0] as MediaFile).title = title;
  }
  // Synthesize a multimedia record (the GEDCOM 7.0 normalization).
  let xref: string;
  do {
    xref = `@_SYNO${ctx.syntheticIndex}@`;
    ctx.syntheticIndex++;
  } while (ctx.xrefs.has(xref));
  ctx.xrefs.add(xref);
  ctx.synthetic.push(record);
  return { tag: 'OBJE', object: xref };
}

function parseCrop(node: RawNode, ctx: Ctx): CropStructure {
  noPayload(node);
  const out: CropStructure = {};
  dispatch(
    node,
    out,
    {
      TOP: (child) => {
        out.top = reqDigits(child);
      },
      LEFT: (child) => {
        out.left = reqDigits(child);
      },
      HEIGHT: (child) => {
        out.height = reqDigits(child);
      },
      WIDTH: (child) => {
        out.width = reqDigits(child);
      },
    },
    ctx,
  );
  return out;
}

// ---------------------------------------------------------------------------
// Family/individual links, events, attributes, ordinances
// ---------------------------------------------------------------------------

function parseFamilyPartnerLink(node: RawNode, ctx: Ctx): FamilyPartnerLink {
  const out: FamilyPartnerLink = { partner: reqPtr(node, ctx) };
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

function parseFamilyChildLink(node: RawNode, ctx: Ctx): FamilyChildLink {
  const out: FamilyChildLink = { child: reqPtr(node, ctx) };
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

function parseChildFamilyLink(node: RawNode, ctx: Ctx): ChildFamilyLink {
  const out: ChildFamilyLink = { family: reqPtr(node, ctx) };
  dispatch(
    node,
    out,
    {
      PEDI: (child) => {
        out.pedigree = parsePedigree(child, ctx);
      },
      STAT: (child) => {
        out.status = parseFamilyChildStatus(child, ctx);
      },
      NOTE: (child) => {
        (out.notes ??= []).push(parseNoteStructure(child, ctx));
      },
    },
    ctx,
  );
  return out;
}

/** The 5.5.1 SEX_VALUE set (no X). */
const SEX_551: Record<'M' | 'F' | 'U', string> = { M: 'male', F: 'female', U: 'undetermined' };

/** The 5.5.1 PEDIGREE_LINKAGE_TYPE set (no OTHER). */
const PEDI_551: Record<'ADOPTED' | 'BIRTH' | 'FOSTER' | 'SEALING', string> = {
  ADOPTED: 'adopted', BIRTH: 'birth', FOSTER: 'foster', SEALING: 'sealing',
};

function parsePedigree(node: RawNode, ctx: Ctx): PedigreeStructure {
  const table = (ctx.version === '7.0' ? PEDIGREE_ENUM_VALUES : PEDI_551) as Readonly<
    Record<'ADOPTED' | 'BIRTH' | 'FOSTER' | 'OTHER' | 'SEALING', string>
  >;
  const out: PedigreeStructure = { payload: parseEnum(reqText(node), table, ctx.version, node.position) };
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

function parseFamilyChildStatus(node: RawNode, ctx: Ctx): FamilyChildStatusStructure {
  const out: FamilyChildStatusStructure = {
    payload: parseEnum(reqText(node), FAMILY_CHILD_STATUS_ENUM_VALUES, ctx.version, node.position),
  };
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

function parseSpouseFamilyLink(node: RawNode, ctx: Ctx): SpouseFamilyLink {
  const out: SpouseFamilyLink = { family: reqPtr(node, ctx) };
  dispatch(
    node,
    out,
    {
      NOTE: (child) => {
        (out.notes ??= []).push(parseNoteStructure(child, ctx));
      },
    },
    ctx,
  );
  return out;
}

function parseAliasLink(node: RawNode, ctx: Ctx): AliasLink {
  const out: AliasLink = { individual: reqPtr(node, ctx) };
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

function parseFamilyPartnerEventDetail(node: RawNode, ctx: Ctx): FamilyPartnerEventDetail {
  noPayload(node);
  const out: FamilyPartnerEventDetail = { age: null as unknown as AgeStructure };
  dispatch(
    node,
    out,
    {
      AGE: (child) => {
        out.age = parseAge(child, ctx);
      },
    },
    ctx,
  );
  if (out.age === (null as unknown as AgeStructure)) {
    fail('structure.missing-required', `The ${node.tag} structure requires an AGE substructure`, node.position);
  }
  return out;
}

/** The event-detail handlers (DATE/PLAC/…), mutating the given detail. */
function eventDetailHandlers(ctx: Ctx, detail: EventDetail): Record<string, (child: RawNode) => void> {
  const handlers: Record<string, (child: RawNode) => void> = {
    DATE: (child) => {
      detail.date = parseDateStructure(child, ctx);
    },
    PLAC: (child) => {
      detail.place = parsePlaceStructure(child, ctx);
    },
    ADDR: (child) => {
      detail.address = parseAddressStructure(child, ctx);
    },
    AGNC: (child) => {
      detail.agency = reqText(child);
    },
    RELI: (child) => {
      detail.religiousAffiliation = reqText(child);
    },
    CAUS: (child) => {
      detail.cause = reqText(child);
    },
    RESN: (child) => {
      detail.restriction = parseListEnum(reqText(child), RESTRICTION_ENUM_VALUES, ctx.version, child.position);
    },
    NOTE: (child) => {
      (detail.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    SOUR: (child) => {
      (detail.citations ??= []).push(parseSourceCitation(child, ctx));
    },
    OBJE: (child) => {
      (detail.media ??= []).push(parseMultimediaLink(child, ctx));
    },
  };
  if (ctx.version === '7.0') {
    handlers["PHON"] = (child) => {
      (detail.phone ??= []).push(reqText(child));
    };
    handlers["EMAIL"] = (child) => {
      (detail.email ??= []).push(reqText(child));
    };
    handlers["FAX"] = (child) => {
      (detail.fax ??= []).push(reqText(child));
    };
    handlers["WWW"] = (child) => {
      (detail.www ??= []).push(reqText(child));
    };
    handlers["SDATE"] = (child) => {
      detail.sortDate = parseSortDateStructure(child, ctx);
    };
    handlers["ASSO"] = (child) => {
      (detail.associations ??= []).push(parseAssociation(child, ctx));
    };
    handlers["UID"] = (child) => {
      (detail.uniqueIds ??= []).push(reqText(child));
    };
  }
  return handlers;
}

interface EventShape extends GedcomStructureBase {
  tag: string;
  payload?: true | string | number;
  type?: string;
  detail?: FamilyEventDetail | IndividualEventDetail | LdsOrdinanceDetail;
  familyChild?: string;
  adoptionFamily?: AdoptionFamilyLink;
}

/** Assigns the optional `Y` flag, leaving the field unset when absent. */
function setY(event: EventShape, node: RawNode): void {
  const y = yFlag(node);
  if (y !== undefined) {
    event.payload = y;
  }
}

function parseFamilyEvent(node: RawNode, ctx: Ctx, tag: string): FamilyEventStructure {
  const detail: EventDetail = {};
  const familyDetail: FamilyEventDetail = {};
  const event = {} as EventShape;
  event.tag = tag;
  const handlers = eventDetailHandlers(ctx, detail);
  handlers["TYPE"] = (child) => {
    event.type = reqText(child);
  };
  handlers["HUSB"] = (child) => {
    familyDetail.husband = parseFamilyPartnerEventDetail(child, ctx);
  };
  handlers["WIFE"] = (child) => {
    familyDetail.wife = parseFamilyPartnerEventDetail(child, ctx);
  };

  if (tag === 'EVEN') {
    const raw = node.value.kind === 'text' ? node.value.text : undefined;
    (event as { payload?: string }).payload = raw ?? '';
    if (ctx.version === '7.0') {
      const typeNode = req(node, 'TYPE');
      event.type = reqText(typeNode);
    } else {
      const typeNode = one(node, 'TYPE');
      event.type = typeNode === undefined ? '' : reqText(typeNode);
    }
  } else if (ctx.version === '7.0') {
    setY(event, node);
  } else if (tag === 'MARR') {
    setY(event, node);
  } else {
    noPayload(node);
  }

  dispatch(node, event, handlers, ctx);
  if (Object.keys(detail).length > 0) {
    familyDetail.detail = detail;
  }
  if (familyDetail.husband !== undefined || familyDetail.wife !== undefined || familyDetail.detail !== undefined) {
    event.detail = familyDetail;
  }
  return event as unknown as FamilyEventStructure;
}

function parseFamilyChildCount(node: RawNode): FamilyChildCountAttribute {
  const out: FamilyChildCountAttribute = { tag: 'NCHI', payload: reqDigits(node) };
  if (node.children.length > 0) {
    fail('structure.unknown-tag', `The tag ${(node.children[0] as RawNode).tag} is not allowed under NCHI`, (node.children[0] as RawNode).position);
  }
  return out;
}

function parseFamilyResidence(node: RawNode, ctx: Ctx): FamilyResidenceAttribute {
  const detail: EventDetail = {};
  const familyDetail: FamilyEventDetail = {};
  const out: FamilyResidenceAttribute = { tag: 'RESI', payload: reqText(node) };
  const handlers = eventDetailHandlers(ctx, detail);
  handlers["TYPE"] = (child) => {
    out.type = reqText(child);
  };
  dispatch(node, out, handlers, ctx);
  if (Object.keys(detail).length > 0) {
    familyDetail.detail = detail;
  }
  if (familyDetail.detail !== undefined) {
    out.detail = familyDetail;
  }
  return out;
}

function parseFamilyResidence551(node: RawNode, ctx: Ctx): FamilyResidenceAttribute {
  noPayload(node);
  const detail: EventDetail = {};
  const familyDetail: FamilyEventDetail = {};
  const out: FamilyResidenceAttribute = { tag: 'RESI' };
  const handlers = eventDetailHandlers(ctx, detail);
  handlers["TYPE"] = (child) => {
    out.type = reqText(child);
  };
  dispatch(node, out, handlers, ctx);
  if (Object.keys(detail).length > 0) {
    familyDetail.detail = detail;
  }
  if (familyDetail.detail !== undefined) {
    out.detail = familyDetail;
  }
  return out;
}

function parseFamilyFact(node: RawNode, ctx: Ctx): FamilyGenericAttribute {
  const detail: EventDetail = {};
  const familyDetail: FamilyEventDetail = {};
  const out: FamilyGenericAttribute = { tag: 'FACT', payload: reqText(node), type: reqText(req(node, 'TYPE')) };
  const handlers = eventDetailHandlers(ctx, detail);
  handlers["TYPE"] = () => undefined;
  dispatch(node, out, handlers, ctx);
  if (Object.keys(detail).length > 0) {
    familyDetail.detail = detail;
  }
  if (familyDetail.detail !== undefined) {
    out.detail = familyDetail;
  }
  return out;
}

function parseIndividualEvent(node: RawNode, ctx: Ctx, tag: string): IndividualEventStructure {
  const detail: IndividualEventDetail = {};
  const event = {} as EventShape;
  event.tag = tag;
  const handlers = eventDetailHandlers(ctx, detail);
  handlers["TYPE"] = (child) => {
    event.type = reqText(child);
  };
  handlers["AGE"] = (child) => {
    detail.age = parseAge(child, ctx);
  };
  handlers["FAMC"] = (child) => {
    if (tag === 'ADOP') {
      event.adoptionFamily = parseAdoptionFamilyLink(child, ctx);
    } else if (tag === 'BIRT' || tag === 'CHR') {
      event.familyChild = reqPtr(child, ctx);
      if (child.children.length > 0) {
        fail('structure.unknown-tag', `The tag ${(child.children[0] as RawNode).tag} is not allowed under FAMC`, (child.children[0] as RawNode).position);
      }
    } else {
      fail('structure.unknown-tag', 'A FAMC is only allowed under ADOP, BIRT or CHR', child.position);
    }
  };

  if (tag === 'EVEN') {
    const raw = node.value.kind === 'text' ? node.value.text : undefined;
    (event as { payload?: string }).payload = raw ?? '';
    if (ctx.version === '7.0') {
      event.type = reqText(req(node, 'TYPE'));
    } else {
      const typeNode = one(node, 'TYPE');
      event.type = typeNode === undefined ? '' : reqText(typeNode);
    }
  } else if (ctx.version === '7.0') {
    setY(event, node);
  } else if (tag === 'BIRT' || tag === 'CHR' || tag === 'DEAT') {
    setY(event, node);
  } else {
    noPayload(node);
  }

  dispatch(node, event, handlers, ctx);
  if (Object.keys(detail).length > 0) {
    event.detail = detail;
  }
  return event as unknown as IndividualEventStructure;
}

function parseAdoptionFamilyLink(node: RawNode, ctx: Ctx): AdoptionFamilyLink {
  const out: AdoptionFamilyLink = { family: reqPtr(node, ctx) };
  dispatch(
    node,
    out,
    {
      ADOP: (child) => {
        out.adoption = parseAdoptionStructure(child, ctx);
      },
    },
    ctx,
  );
  return out;
}

function parseAdoptionStructure(node: RawNode, ctx: Ctx): AdoptionStructure {
  const out: AdoptionStructure = { payload: parseEnum(reqText(node), ADOPTION_ENUM_VALUES, ctx.version, node.position) };
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

function parseIndividualAttribute(node: RawNode, ctx: Ctx, tag: string): IndividualAttributeStructure {
  const detail: IndividualEventDetail = {};
  const event = {} as EventShape;
  event.tag = tag;
  if (tag === 'NCHI' || tag === 'NMR') {
    event.payload = reqDigits(node);
  } else {
    event.payload = reqText(node);
  }
  const handlers = eventDetailHandlers(ctx, detail);
  handlers["TYPE"] = (child) => {
    event.type = reqText(child);
  };
  handlers["AGE"] = (child) => {
    detail.age = parseAge(child, ctx);
  };
  dispatch(node, event, handlers, ctx);
  if ((tag === 'IDNO' || tag === 'FACT') && event.type === undefined) {
    fail('structure.missing-required', `The ${tag} attribute requires a TYPE substructure`, node.position);
  }
  if (Object.keys(detail).length > 0) {
    event.detail = detail;
  }
  return event as unknown as IndividualAttributeStructure;
}

function parseIndividualOrdinance(node: RawNode, ctx: Ctx, tag: string): LdsIndividualOrdinance {
  const detail: LdsOrdinanceDetail = {};
  const event = {} as EventShape;
  event.tag = tag;
  const handlers: Record<string, (child: RawNode) => void> = {
    DATE: (child) => {
      detail.date = parseDateStructure(child, ctx);
    },
    TEMP: (child) => {
      detail.temple = reqText(child);
    },
    PLAC: (child) => {
      detail.place = ctx.version === '7.0' ? parsePlaceStructure(child, ctx) : parseSourceJurisdictionPlace(child, ctx);
    },
    STAT: (child) => {
      detail.status = parseOrdinanceStatus(child, ctx, tag);
    },
    NOTE: (child) => {
      (detail.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    SOUR: (child) => {
      (detail.citations ??= []).push(parseSourceCitation(child, ctx));
    },
    FAMC: (child) => {
      if (tag === 'SLGC') {
        event.familyChild = reqPtr(child, ctx);
      } else {
        fail('structure.unknown-tag', `A FAMC is not allowed under ${tag}`, child.position);
      }
    },
  };
  dispatch(node, event, handlers, ctx);
  if (Object.keys(detail).length > 0) {
    (event as unknown as { detail?: LdsOrdinanceDetail }).detail = detail;
  }
  return event as unknown as LdsIndividualOrdinance;
}

/** The 5.5.1 per-ordinance status value sets (canonical 7.0 spellings). */
const LDS_STATUS_551: Record<string, Record<string, string>> = {
  BAPL: { CHILD: '', COMPLETED: '', EXCLUDED: '', 'PRE-1970': 'PRE_1970', STILLBORN: '', SUBMITTED: '', UNCLEARED: '' },
  CONL: { CHILD: '', COMPLETED: '', EXCLUDED: '', 'PRE-1970': 'PRE_1970', STILLBORN: '', SUBMITTED: '', UNCLEARED: '' },
  ENDL: { CHILD: '', COMPLETED: '', EXCLUDED: '', 'PRE-1970': 'PRE_1970', STILLBORN: '', SUBMITTED: '', UNCLEARED: '' },
  SLGC: { BIC: '', COMPLETED: '', EXCLUDED: '', DNS: '', 'PRE-1970': 'PRE_1970', STILLBORN: '', SUBMITTED: '', UNCLEARED: '' },
  SLGS: { CANCELED: '', COMPLETED: '', DNS: '', EXCLUDED: '', 'DNS/CAN': 'DNS_CAN', 'PRE-1970': 'PRE_1970', SUBMITTED: '', UNCLEARED: '' },
};

function parseOrdinanceStatus(node: RawNode, ctx: Ctx, ordinance: string): OrdinanceStatusStructure {
  const raw = reqText(node);
  const out: OrdinanceStatusStructure = {
    payload: null as unknown as OrdinanceStatusEnum,
    date: null as unknown as DateExactStructure,
  };
  if (ctx.version === '7.0') {
    out.payload = parseEnum(raw, ORDINANCE_STATUS_ENUM_VALUES, '7.0', node.position);
    dispatch(
      node,
      out,
      {
        DATE: (child) => {
          out.date = parseDateExactStructure(child, ctx, true);
        },
      },
      ctx,
    );
  } else {
    const table = LDS_STATUS_551[ordinance];
    if (table === undefined) {
      fail('structure.unknown-tag', `Unknown ordinance ${ordinance}`, node.position);
    }
    const upper = raw.toUpperCase();
    const canonical = table[upper];
    if (canonical === undefined) {
      fail('enum.invalid-value', `"${raw}" is not a permitted status for ${ordinance} in 5.5.1`, node.position);
    }
    out.payload = (canonical === '' ? upper : canonical) as OrdinanceStatusEnum;
    const dateNode = req(node, 'DATE');
    out.date = parseDateExactStructure(dateNode, ctx, false);
    if (node.children.some((child) => child.tag !== 'DATE')) {
      fail('structure.unknown-tag', 'Only a DATE substructure is allowed under STAT', node.position);
    }
  }
  if (out.date === (null as unknown as DateExactStructure)) {
    fail('structure.missing-required', 'The STAT structure requires a DATE substructure', node.position);
  }
  return out;
}

function parseSpouseSealing(node: RawNode, ctx: Ctx): SpouseSealingOrdinance {
  noPayload(node);
  const detail: LdsOrdinanceDetail = {};
  const out: SpouseSealingOrdinance = { tag: 'SLGS' };
  const handlers: Record<string, (child: RawNode) => void> = {
    DATE: (child) => {
      detail.date = parseDateStructure(child, ctx);
    },
    TEMP: (child) => {
      detail.temple = reqText(child);
    },
    PLAC: (child) => {
      detail.place = ctx.version === '7.0' ? parsePlaceStructure(child, ctx) : parseSourceJurisdictionPlace(child, ctx);
    },
    STAT: (child) => {
      detail.status = parseOrdinanceStatus(child, ctx, 'SLGS');
    },
    NOTE: (child) => {
      (detail.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    SOUR: (child) => {
      (detail.citations ??= []).push(parseSourceCitation(child, ctx));
    },
  };
  dispatch(node, out, handlers, ctx);
  if (Object.keys(detail).length > 0) {
    out.detail = detail;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Parses a GEDCOM 7.0.18 data stream into the typed model. */
export function parseGedcom70(input: Uint8Array): ParseResult<GedcomDataset> {
  return run(() => parseGedcom(input, '7.0'));
}

/** Parses a GEDCOM 5.5.1 transmission into the typed model. */
export function parseGedcom551(input: Uint8Array): ParseResult<GedcomDataset> {
  return run(() => parseGedcom(input, '5.5.1'));
}

function parseGedcom(input: Uint8Array, version: '7.0' | '5.5.1'): GedcomDataset {
  const decoded = decodeDocument(input, version);
  if (!decoded.ok) {
    throw decoded.error;
  }
  const raw = parseRawDocument(decoded.value, version);
  return parseDocument(raw, version);
}
