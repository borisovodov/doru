/**
 * The strict serializers: the typed model back to GEDCOM 7.0 or 5.5.1
 * text. Each serializer emits only what its version can represent;
 * constructs of the other version are reported as typed errors.
 */

import { DOCUMENT_START, fail, run, type ParseResult } from '../errors';
import { LANGUAGE_IDS_551, MULTIMEDIA_FORMATS_551 } from '../primitives';
import type {
  AgeValue,
  Calendar,
  DateExact,
  DateValue,
  Epoch,
  GedcomMonth,
  MediaType,
  PersonalName,
  TimeValue,
} from '../primitives';
import type {
  AddressStructure,
  AgeStructure,
  AssociationStructure,
  CallNumberStructure,
  ChangeDate,
  CreationDate,
  DateExactStructure,
  DatePeriodStructure,
  DateStructure,
  EventDetail,
  ExtensionStructure,
  FamilyEventDetail,
  GedcomDataset,
  GedcomStructureBase,
  Header,
  IndividualEventDetail,
  LdsOrdinanceDetail,
  MediaFile,
  MediaFormatStructure,
  MediaStructure,
  MultimediaLink,
  NameTypeStructure,
  NonEventStructure,
  Note,
  NoteReference,
  NoteStructure,
  NoteTranslation,
  PersonalNamePieces,
  PersonalNameStructure,
  PlaceStructure,
  SourceCitation,
  SourceText,
} from '../structures';

type Version = '7.0' | '5.5.1';

/** GEDCOM 5.5.1 media-type to MULTIMEDIA_FORMAT mapping (reverse table). */
const MEDIA_TYPE_TO_551: ReadonlyMap<string, string> = new Map([
  ['image/bmp', 'bmp'],
  ['image/gif', 'gif'],
  ['image/jpeg', 'jpg'],
  ['image/tiff', 'tif'],
  ['image/x-tiff', 'tif'],
  ['audio/wav', 'wav'],
  ['audio/x-wav', 'wav'],
  ['audio/vnd.wave', 'wav'],
]);

/** BCP 47 primary subtag to the 5.5.1 LANGUAGE_ID name. */
const LANGUAGE_TO_551: ReadonlyMap<string, string> = new Map([
  ['af', 'Afrikaans'],
  ['sq', 'Albanian'],
  ['ang', 'Anglo-Saxon'],
  ['ca', 'Catalan'],
  ['cs', 'Czech'],
  ['da', 'Danish'],
  ['nl', 'Dutch'],
  ['en', 'English'],
  ['eo', 'Esperanto'],
  ['et', 'Estonian'],
  ['fo', 'Faroese'],
  ['fi', 'Finnish'],
  ['fr', 'French'],
  ['de', 'German'],
  ['haw', 'Hawaiian'],
  ['hu', 'Hungarian'],
  ['is', 'Icelandic'],
  ['id', 'Indonesian'],
  ['it', 'Italian'],
  ['lv', 'Latvian'],
  ['lt', 'Lithuanian'],
  ['nv', 'Navaho'],
  ['no', 'Norwegian'],
  ['nb', 'Norwegian'],
  ['nn', 'Norwegian'],
  ['pl', 'Polish'],
  ['pt', 'Portuguese'],
  ['ro', 'Romanian'],
  ['sh', 'Serbo_Croa'],
  ['sk', 'Slovak'],
  ['sl', 'Slovene'],
  ['es', 'Spanish'],
  ['sv', 'Swedish'],
  ['tr', 'Turkish'],
  ['wen', 'Wendic'],
  ['hsb', 'Wendic'],
  ['dsb', 'Wendic'],
  ['am', 'Amharic'],
  ['ar', 'Arabic'],
  ['hy', 'Armenian'],
  ['as', 'Assamese'],
  ['be', 'Belorusian'],
  ['bn', 'Bengali'],
  ['bg', 'Bulgarian'],
  ['my', 'Burmese'],
  ['yue', 'Cantonese'],
  ['cu', 'Church-Slavic'],
  ['ka', 'Georgian'],
  ['el', 'Greek'],
  ['gu', 'Gujarati'],
  ['he', 'Hebrew'],
  ['hi', 'Hindi'],
  ['ja', 'Japanese'],
  ['kn', 'Kannada'],
  ['km', 'Khmer'],
  ['ko', 'Korean'],
  ['lo', 'Lao'],
  ['mk', 'Macedonian'],
  ['ml', 'Malayalam'],
  ['zh', 'Mandarin'],
  ['mr', 'Marathi'],
  ['ne', 'Nepali'],
  ['or', 'Oriya'],
  ['pa', 'Panjabi'],
  ['fa', 'Persian'],
  ['ru', 'Russian'],
  ['sa', 'Sanskrit'],
  ['sr', 'Serb'],
  ['tl', 'Tagalog'],
  ['ta', 'Tamil'],
  ['te', 'Telugu'],
  ['th', 'Thai'],
  ['bo', 'Tibetan'],
  ['uk', 'Ukrainian'],
  ['ur', 'Urdu'],
  ['vi', 'Vietnamese'],
  ['yi', 'Yiddish'],
]);

/**
 * The line writer. Handles value escaping, multiline CONT splitting and,
 * for 5.5.1, the 255-character line limit with CONC splitting.
 */
class Writer {
  readonly version: Version;
  readonly lines: string[] = [];

  constructor(version: Version) {
    this.version = version;
  }

  line(level: number, tag: string, options: { xref?: string | undefined; value?: string | undefined } = {}): void {
    const prefix = `${level} ${options.xref === undefined ? '' : `${options.xref} `}${tag}`;
    let value = options.value ?? '';
    const looksLikePointer = (v: string): boolean =>
      v === '@VOID@' || /^@[A-Za-z0-9_][^@]*@$/.test(v);
    if (this.version === '7.0') {
      value = value.startsWith('@') && !looksLikePointer(value) ? `@${value}` : value;
      const parts = value.split('\n');
      this.lines.push(parts.length === 0 || parts[0] === '' ? prefix : `${prefix} ${parts[0]}`);
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i] as string;
        const escaped = part.startsWith('@') ? `@${part}` : part;
        this.lines.push(part === '' ? `${level + 1} CONT` : `${level + 1} CONT ${escaped}`);
      }
      return;
    }
    // 5.5.1: double every @ (except in pointer values and inside @#…@
    // escape sequences) and enforce the 255-character line limit.
    if (looksLikePointer(value)) {
      // Pointer values are emitted verbatim.
    } else {
      let escaped = '';
      let i = 0;
      while (i < value.length) {
        const c = value[i] as string;
        if (c === '@' && value[i + 1] === '#') {
          const close = value.indexOf('@', i + 2);
          escaped += close === -1 ? value.slice(i) : value.slice(i, close + 1);
          i = close === -1 ? value.length : close + 1;
          continue;
        }
        escaped += c === '@' ? '@@' : c;
        i++;
      }
      value = escaped;
    }
    const parts = value.split('\n');
    const overhead = prefix.length + 1;
    const limit = 255 - overhead;
    const emitSegment = (segment: string, baseLevel: number): void => {
      if (segment.length <= limit) {
        this.lines.push(segment === '' ? prefix : `${prefix} ${segment}`);
        return;
      }
      // Split at the largest non-space position within the limit so that
      // the next segment does not start with a space.
      let cut = limit;
      while (cut > 0 && segment[cut] === ' ') {
        cut--;
      }
      if (cut <= 0) {
        cut = limit;
      }
      this.lines.push(`${prefix} ${segment.slice(0, cut)}`);
      let rest = segment.slice(cut);
      while (rest.length > limit) {
        let next = limit;
        while (next > 0 && rest[next] === ' ') {
          next--;
        }
        if (next <= 0) {
          next = limit;
        }
        this.lines.push(`${baseLevel + 1} CONC ${rest.slice(0, next)}`);
        rest = rest.slice(next);
      }
      this.lines.push(rest === '' ? `${baseLevel + 1} CONC` : `${baseLevel + 1} CONC ${rest}`);
    };
    emitSegment(parts[0] ?? '', level);
    for (let i = 1; i < parts.length; i++) {
      const cont = new Writer('5.5.1');
      const part = parts[i] as string;
      const contPrefix = `${level + 1} CONT`;
      const contOverhead = contPrefix.length + 1;
      const contLimit = 255 - contOverhead;
      if (part.length <= contLimit) {
        this.lines.push(part === '' ? contPrefix : `${contPrefix} ${part}`);
      } else {
        let cut = contLimit;
        while (cut > 0 && part[cut] === ' ') {
          cut--;
        }
        if (cut <= 0) {
          cut = contLimit;
        }
        this.lines.push(`${contPrefix} ${part.slice(0, cut)}`);
        let rest = part.slice(cut);
        while (rest.length > contLimit) {
          this.lines.push(`${level + 2} CONC ${rest.slice(0, contLimit)}`);
          rest = rest.slice(contLimit);
        }
        this.lines.push(rest === '' ? `${level + 2} CONC` : `${level + 2} CONC ${rest}`);
      }
      void cont;
    }
  }
}

// ---------------------------------------------------------------------------
// Value formatting
// ---------------------------------------------------------------------------

function calendarEscape551(calendar: Calendar): string {
  switch (calendar) {
    case 'GREGORIAN':
      return '';
    case 'JULIAN':
      return '@#DJULIAN@ ';
    case 'FRENCH_R':
      return '@#DFRENCH R@ ';
    case 'HEBREW':
      return '@#DHEBREW@ ';
    default:
      return '';
  }
}

function epochSuffix(epoch: Epoch | undefined, version: Version): string {
  if (epoch === undefined) {
    return '';
  }
  return version === '7.0' ? ' BCE' : ' B.C.';
}

function formatDateFields(
  fields: { calendar?: Calendar; day?: number; month?: GedcomMonth; year: number; epoch?: Epoch },
  version: Version,
): string {
  const calendar = fields.calendar ?? 'GREGORIAN';
  const escape = version === '5.5.1' ? calendarEscape551(calendar) : calendar === 'GREGORIAN' ? '' : `${calendar} `;
  const dayMonth = fields.day !== undefined && fields.month !== undefined ? `${fields.day} ${fields.month} ` : fields.month !== undefined ? `${fields.month} ` : '';
  return `${escape}${dayMonth}${fields.year}${epochSuffix(fields.epoch, version)}`;
}

function formatDateValue70(value: DateValue): string {
  switch (value.kind) {
    case 'date':
      return formatDateFields(value, '7.0');
    case 'range':
      return `BET ${formatDateFields(value.start, '7.0')} AND ${formatDateFields(value.end, '7.0')}`;
    case 'bound':
      return `${value.modifier} ${formatDateFields(value.date, '7.0')}`;
    case 'approx':
      return `${value.modifier} ${formatDateFields(value.date, '7.0')}`;
    case 'period': {
      if (value.from !== undefined && value.to !== undefined) {
        return `FROM ${formatDateFields(value.from, '7.0')} TO ${formatDateFields(value.to, '7.0')}`;
      }
      if (value.from !== undefined) {
        return `FROM ${formatDateFields(value.from, '7.0')}`;
      }
      if (value.to !== undefined) {
        return `TO ${formatDateFields(value.to, '7.0')}`;
      }
      return '';
    }
    case 'unknown':
      return '';
  }
}

function formatDateValue551(value: DateValue): string {
  switch (value.kind) {
    case 'date':
      return formatDateFields(value, '5.5.1');
    case 'range':
      return `BET ${formatDateFields(value.start, '5.5.1')} AND ${formatDateFields(value.end, '5.5.1')}`;
    case 'bound':
      return `${value.modifier} ${formatDateFields(value.date, '5.5.1')}`;
    case 'approx':
      return `${value.modifier} ${formatDateFields(value.date, '5.5.1')}`;
    case 'period': {
      if (value.from !== undefined && value.to !== undefined) {
        return `FROM ${formatDateFields(value.from, '5.5.1')} TO ${formatDateFields(value.to, '5.5.1')}`;
      }
      if (value.from !== undefined) {
        return `FROM ${formatDateFields(value.from, '5.5.1')}`;
      }
      if (value.to !== undefined) {
        return `TO ${formatDateFields(value.to, '5.5.1')}`;
      }
      return '';
    }
    case 'unknown':
      return '';
  }
}

function formatDateExact(value: DateExact, version: Version): string {
  if (version === '7.0') {
    return `${value.day} ${value.month} ${value.year}${epochSuffix(value.epoch, '7.0')}`;
  }
  const fields: { calendar: Calendar; day: number; month: GedcomMonth; year: number; epoch?: Epoch } = {
    calendar: 'GREGORIAN',
    day: value.day,
    month: value.month,
    year: value.year,
  };
  if (value.epoch !== undefined) {
    fields.epoch = value.epoch;
  }
  return formatDateFields(fields, '5.5.1');
}

function formatTime(value: TimeValue, version: Version): string {
  let out = `${value.hour}:${value.minute}`;
  if (value.second !== undefined) {
    out += `:${value.second}`;
    if (value.fraction !== undefined) {
      out += `.${value.fraction}`;
    }
  }
  if (version === '7.0' && value.utc === true) {
    out += 'Z';
  }
  return out;
}

function formatAge70(value: AgeValue): string {
  if (value.description !== undefined) {
    fail('serialize.unsupported-value', `The age keyword ${value.description} cannot be represented in GEDCOM 7.0`);
  }
  const parts: string[] = [];
  if (value.years !== undefined) {
    parts.push(`${value.years}y`);
  }
  if (value.months !== undefined) {
    parts.push(`${value.months}m`);
  }
  if (value.weeks !== undefined) {
    parts.push(`${value.weeks}w`);
  }
  if (value.days !== undefined) {
    parts.push(`${value.days}d`);
  }
  return `${value.bound ?? ''}${parts.join(' ')}`.trim();
}

function formatAge551(value: AgeValue): string {
  if (value.description !== undefined) {
    return value.description;
  }
  if (value.weeks !== undefined) {
    fail('serialize.unsupported-value', 'Weeks cannot be represented in a GEDCOM 5.5.1 age');
  }
  const parts: string[] = [];
  if (value.years !== undefined) {
    parts.push(`${value.years}y`);
  }
  if (value.months !== undefined) {
    parts.push(`${value.months}m`);
  }
  if (value.days !== undefined) {
    parts.push(`${value.days}d`);
  }
  return `${value.bound ?? ''}${parts.join(' ')}`.trim();
}

function formatName70(value: PersonalName): string {
  return `${value.given ?? ''}/${value.surname ?? ''}/${value.suffix ?? ''}`;
}

function formatName551(value: PersonalName): string {
  return `${value.given ?? ''}/${value.surname ?? ''}/${value.suffix ?? ''}`;
}

// ---------------------------------------------------------------------------
// Serializer
// ---------------------------------------------------------------------------

class Emitter {
  readonly version: Version;
  readonly w: Writer;

  constructor(version: Version) {
    this.version = version;
    this.w = new Writer(version);
  }

  private v70(text: string): never {
    fail('serialize.unsupported-value', `${text} cannot be represented in GEDCOM 7.0`);
  }

  private v551(text: string): never {
    fail('serialize.unsupported-value', `${text} cannot be represented in GEDCOM 5.5.1`);
  }

  ptr(level: number, tag: string, pointer: string, options: { empty551?: boolean } = {}): void {
    if (pointer === '@VOID@' && this.version === '5.5.1') {
      if (options.empty551) {
        this.w.line(level, tag);
        return;
      }
      this.v551(`the void pointer ${pointer}`);
    }
    this.w.line(level, tag, { value: pointer });
  }

  emitDataset(dataset: GedcomDataset): void {
    this.emitHeader(dataset.header);
    if (this.version === '5.5.1' && dataset.submission !== undefined) {
      this.emitSubmission(dataset.submission);
    } else if (this.version === '7.0' && dataset.submission !== undefined) {
      this.v70('the SUBN submission record');
    }
    for (const record of dataset.records) {
      this.emitRecord(record);
    }
    this.w.line(0, 'TRLR');
  }

  // -- Header ---------------------------------------------------------------

  private emitHeader(header: Header): void {
    const h = header;
    this.w.line(0, 'HEAD');
    if (this.version === '7.0') {
      if (h.schema !== undefined) {
        this.w.line(1, 'SCHMA');
        for (const def of h.schema.tagDefinitions) {
          this.w.line(2, 'TAG', { value: `${def.payload.tag} ${def.payload.uri}` });
        }
      }
      if (h.submission !== undefined || h.fileName !== undefined) {
        this.v70('the 5.5.1 SUBN/FILE header fields');
      }
      if (h.gedcom.form !== undefined) {
        this.v70('the 5.5.1 GEDC.FORM field');
      }
    } else {
      if (h.schema !== undefined) {
        this.v551('the SCHMA header');
      }
      if (h.source === undefined) {
        fail('serialize.missing-field', 'The 5.5.1 header requires SOUR');
      }
      if (h.submitter === undefined) {
        fail('serialize.missing-field', 'The 5.5.1 header requires SUBM');
      }
      if (h.gedcom.form === undefined) {
        fail('serialize.missing-field', 'The 5.5.1 header requires GEDC.FORM');
      }
    }
    if (h.source !== undefined) {
      this.emitHeaderSource(h.source);
    }
    if (h.destination !== undefined) {
      this.w.line(1, 'DEST', { value: h.destination });
    }
    if (h.date !== undefined) {
      this.emitDateExact(1, 'DATE', h.date, h.date.time);
    }
    if (h.submitter !== undefined) {
      this.ptr(1, 'SUBM', h.submitter);
    }
    if (this.version === '5.5.1') {
      if (h.submission !== undefined) {
        this.ptr(1, 'SUBN', h.submission);
      }
      if (h.fileName !== undefined) {
        this.w.line(1, 'FILE', { value: h.fileName });
      }
    }
    if (h.copyright !== undefined) {
      this.w.line(1, 'COPR', { value: h.copyright });
    }
    this.w.line(1, 'GEDC');
    this.w.line(2, 'VERS', { value: this.version === '7.0' ? '7.0' : '5.5.1' });
    if (this.version === '5.5.1') {
      this.w.line(2, 'FORM', { value: 'LINEAGE-LINKED' });
    }
    if (this.version === '5.5.1') {
      // Export is always UTF-8 (the model is post-decode).
      this.w.line(1, 'CHAR', { value: 'UTF-8' });
    }
    if (h.language !== undefined) {
      this.w.line(1, 'LANG', { value: this.language(h.language) });
    }
    if (h.place !== undefined) {
      this.w.line(1, 'PLAC');
      this.w.line(2, 'FORM', { value: h.place.form.join(', ') });
    }
    if (h.note !== undefined) {
      this.emitNoteStructure(1, h.note);
    }
    this.emitExtensions(1, h);
  }

  private emitHeaderSource(source: {
    payload: string;
    version?: string;
    name?: string;
    corporation?: {
      payload: string;
      address?: AddressStructure;
      phone?: string[];
      email?: string[];
      fax?: string[];
      www?: string[];
    };
    data?: {
      payload: string;
      date?: DateExactStructure;
      copyright?: string;
    };
  }): void {
    this.w.line(1, 'SOUR', { value: source.payload });
    if (source.version !== undefined) {
      this.w.line(2, 'VERS', { value: source.version });
    }
    if (source.name !== undefined) {
      this.w.line(2, 'NAME', { value: source.name });
    }
    if (source.corporation !== undefined) {
      this.emitCorporation(source.corporation);
    }
    if (source.data !== undefined) {
      this.w.line(2, 'DATA', { value: source.data.payload });
      if (source.data.date !== undefined) {
        this.emitDateExact(3, 'DATE', source.data.date, source.data.date.time);
      }
      if (source.data.copyright !== undefined) {
        this.w.line(3, 'COPR', { value: source.data.copyright });
      }
    }
  }

  private emitCorporation(corp: {
    payload: string;
    address?: AddressStructure;
    phone?: string[];
    email?: string[];
    fax?: string[];
    www?: string[];
  }): void {
    this.w.line(2, 'CORP', { value: corp.payload });
    if (corp.address !== undefined) {
      this.emitAddress(3, corp.address);
    }
    if (this.version === '7.0') {
      for (const value of corp.phone ?? []) {
        this.w.line(3, 'PHON', { value });
      }
      for (const value of corp.email ?? []) {
        this.w.line(3, 'EMAIL', { value });
      }
      for (const value of corp.fax ?? []) {
        this.w.line(3, 'FAX', { value });
      }
      for (const value of corp.www ?? []) {
        this.w.line(3, 'WWW', { value });
      }
    }
  }

  // -- Records ----------------------------------------------------------------

  private emitRecord(record: GedcomDataset['records'][number]): void {
    switch (record.tag) {
      case 'FAM':
        this.emitFamily(record);
        return;
      case 'INDI':
        this.emitIndividual(record);
        return;
      case 'OBJE':
        this.emitMultimedia(record);
        return;
      case 'REPO':
        this.emitRepository(record);
        return;
      case 'SNOTE':
        if (this.version !== '7.0') {
          this.v551('the SNOTE record');
        }
        this.emitSharedNote(record);
        return;
      case 'NOTE':
        if (this.version !== '5.5.1') {
          this.v70('the NOTE record');
        }
        this.emitNoteRecord(record);
        return;
      case 'SOUR':
        this.emitSource(record);
        return;
      case 'SUBM':
        this.emitSubmitter(record);
        return;
      case 'SUBN':
        this.v551('a SUBN record outside the header position');
      default:
        this.emitExtension(0, record as ExtensionStructure, (record as { xref?: string }).xref);
        return;
    }
  }

  private commonRecordFields(rec: {
    identifiers?: Array<{ tag: string; payload: string; type?: string }>;
    notes?: NoteStructure[];
    citations?: SourceCitation[];
    media?: MultimediaLink[];
    changeDate?: ChangeDate;
    creationDate?: CreationDate;
    automatedRecordId?: string;
    extensions?: ExtensionStructure[];
  }, level: number): void {
    for (const identifier of rec.identifiers ?? []) {
      if (identifier.tag === 'UID' && this.version !== '7.0') {
        this.v551('the UID identifier');
      }
      if (identifier.tag === 'EXID' && this.version !== '7.0') {
        this.v551('the EXID identifier');
      }
      this.w.line(level, identifier.tag, { value: identifier.payload });
      if (identifier.type !== undefined) {
        this.w.line(level + 1, 'TYPE', { value: identifier.type });
      }
    }
    for (const note of rec.notes ?? []) {
      this.emitNoteStructure(level, note);
    }
    for (const citation of rec.citations ?? []) {
      this.emitSourceCitation(level, citation);
    }
    for (const media of rec.media ?? []) {
      this.emitMultimediaLink(level, media);
    }
    if (rec.changeDate !== undefined) {
      this.w.line(level, 'CHAN');
      this.emitDateExact(level + 1, 'DATE', rec.changeDate.date, rec.changeDate.date.time);
      for (const note of rec.changeDate.notes ?? []) {
        this.emitNoteStructure(level + 1, note);
      }
    }
    if (rec.creationDate !== undefined) {
      if (this.version !== '7.0') {
        this.v551('the CREA structure');
      }
      this.w.line(level, 'CREA');
      this.emitDateExact(level + 1, 'DATE', rec.creationDate.date, rec.creationDate.date.time);
    }
    if (rec.automatedRecordId !== undefined) {
      if (this.version !== '5.5.1') {
        this.v70('the 5.5.1 RIN field');
      }
      this.w.line(level, 'RIN', { value: rec.automatedRecordId });
    }
    this.emitExtensions(level, rec);
  }

  private emitFamily(rec: {
    tag: 'FAM';
    restriction?: Array<string | `_${string}`>;
    attributes?: Array<{ tag: string; payload?: string | number; type?: string; detail?: FamilyEventDetail }>;
    events?: Array<{ tag: string; payload?: true | string; type?: string; detail?: FamilyEventDetail }>;
    nonEvents?: NonEventStructure[];
    husband?: { partner: string; phrase?: string };
    wife?: { partner: string; phrase?: string };
    children?: Array<{ child: string; phrase?: string }>;
    associations?: AssociationStructure[];
    submitters?: string[];
    spouseSealings?: Array<{ tag: 'SLGS'; detail?: LdsOrdinanceDetail }>;
    identifiers?: Array<{ tag: string; payload: string; type?: string }>;
    notes?: NoteStructure[];
    citations?: SourceCitation[];
    media?: MultimediaLink[];
    changeDate?: ChangeDate;
    creationDate?: CreationDate;
    automatedRecordId?: string;
    extensions?: ExtensionStructure[];
    xref?: string;
  }): void {
    this.w.line(0, 'FAM', { xref: rec.xref });
    if (rec.restriction !== undefined) {
      this.w.line(1, 'RESN', { value: this.restrictionList(rec.restriction) });
    }
    for (const attribute of rec.attributes ?? []) {
      if (attribute.tag === 'NCHI') {
        this.w.line(1, 'NCHI', { value: String(attribute.payload) });
        this.emitFamilyDetail(2, attribute.detail, attribute.type);
        continue;
      }
      if (attribute.tag === 'RESI') {
        if (this.version === '7.0') {
          this.w.line(1, 'RESI', { value: (attribute.payload as string) ?? '' });
          this.emitFamilyDetail(2, attribute.detail, attribute.type);
        } else {
          this.w.line(1, 'RESI');
          this.emitFamilyDetail(2, attribute.detail, attribute.type);
        }
        continue;
      }
      // FACT is 7.0-only.
      if (this.version !== '7.0') {
        this.v551('the FAM.FACT attribute');
      }
      this.w.line(1, 'FACT', { value: (attribute.payload as string) ?? '' });
      if (attribute.type !== undefined) {
        this.w.line(2, 'TYPE', { value: attribute.type });
      }
      this.emitFamilyDetail(2, attribute.detail, undefined);
    }
    for (const event of rec.events ?? []) {
      this.emitFamilyEvent(event);
    }
    for (const nonEvent of rec.nonEvents ?? []) {
      if (this.version !== '7.0') {
        this.v551('the NO structure');
      }
      this.w.line(1, 'NO', { value: nonEvent.payload });
      if (nonEvent.date !== undefined) {
        this.w.line(2, 'DATE', { value: formatDateValue70(nonEvent.date.value ?? { kind: 'period' }) });
        if (nonEvent.date.phrase !== undefined) {
          this.w.line(3, 'PHRASE', { value: nonEvent.date.phrase });
        }
      }
      for (const note of nonEvent.notes ?? []) {
        this.emitNoteStructure(2, note);
      }
      for (const citation of nonEvent.citations ?? []) {
        this.emitSourceCitation(2, citation);
      }
    }
    if (rec.husband !== undefined) {
      this.ptr(1, 'HUSB', rec.husband.partner);
      if (rec.husband.phrase !== undefined) {
        this.w.line(2, 'PHRASE', { value: rec.husband.phrase });
      }
    }
    if (rec.wife !== undefined) {
      this.ptr(1, 'WIFE', rec.wife.partner);
      if (rec.wife.phrase !== undefined) {
        this.w.line(2, 'PHRASE', { value: rec.wife.phrase });
      }
    }
    for (const child of rec.children ?? []) {
      this.ptr(1, 'CHIL', child.child);
      if (child.phrase !== undefined) {
        this.w.line(2, 'PHRASE', { value: child.phrase });
      }
    }
    for (const association of rec.associations ?? []) {
      if (this.version !== '7.0') {
        this.v551('an ASSO under FAM');
      }
      this.emitAssociation(1, association);
    }
    for (const submitter of rec.submitters ?? []) {
      this.ptr(1, 'SUBM', submitter);
    }
    for (const sealing of rec.spouseSealings ?? []) {
      this.w.line(1, 'SLGS');
      this.emitLdsDetail(2, sealing.detail, 'SLGS');
    }
    this.commonRecordFields(rec, 1);
  }

  private emitFamilyDetail(level: number, detail: FamilyEventDetail | undefined, type: string | undefined): void {
    if (type !== undefined) {
      this.w.line(level, 'TYPE', { value: type });
    }
    if (detail === undefined) {
      return;
    }
    if (detail.husband !== undefined) {
      this.w.line(level, 'HUSB');
      this.emitAge(level + 1, detail.husband.age);
    }
    if (detail.wife !== undefined) {
      this.w.line(level, 'WIFE');
      this.emitAge(level + 1, detail.wife.age);
    }
    if (detail.detail !== undefined) {
      this.emitEventDetail(level, detail.detail);
    }
  }

  private emitFamilyEvent(event: {
    tag: string;
    payload?: true | string;
    type?: string;
    detail?: FamilyEventDetail;
  }): void {
    if (event.tag === 'EVEN') {
      if (this.version === '7.0') {
        this.w.line(1, 'EVEN', { value: event.payload as string });
      } else {
        this.w.line(1, 'EVEN', { value: (event.payload as string) || undefined });
      }
      this.emitFamilyDetail(2, event.detail, event.type);
      return;
    }
    if (this.version === '7.0') {
      this.w.line(1, event.tag, { value: event.payload === true ? 'Y' : undefined });
    } else if (event.tag === 'MARR') {
      this.w.line(1, 'MARR', { value: event.payload === true ? 'Y' : undefined });
    } else if (event.payload === true) {
      this.v551(`the Y payload on ${event.tag}`);
    } else {
      this.w.line(1, event.tag);
    }
    this.emitFamilyDetail(2, event.detail, event.type);
  }

  private emitIndividual(rec: {
    tag: 'INDI';
    restriction?: Array<string | `_${string}`>;
    names?: PersonalNameStructure[];
    sex?: string;
    attributes?: Array<{ tag: string; payload: string | number; type?: string; detail?: IndividualEventDetail }>;
    events?: Array<{ tag: string; payload?: true | string; type?: string; detail?: IndividualEventDetail; familyChild?: string; adoptionFamily?: { family: string; adoption?: { payload: string; phrase?: string } } }>;
    nonEvents?: NonEventStructure[];
    ordinances?: Array<{ tag: string; detail?: LdsOrdinanceDetail; familyChild?: string }>;
    childFamilies?: Array<{ family: string; pedigree?: { payload: string; phrase?: string }; status?: { payload: string; phrase?: string }; notes?: NoteStructure[] }>;
    spouseFamilies?: Array<{ family: string; notes?: NoteStructure[] }>;
    submitters?: string[];
    associations?: AssociationStructure[];
    aliases?: Array<{ individual: string; phrase?: string }>;
    ancestorInterests?: string[];
    descendantInterests?: string[];
    identifiers?: Array<{ tag: string; payload: string; type?: string }>;
    notes?: NoteStructure[];
    citations?: SourceCitation[];
    media?: MultimediaLink[];
    changeDate?: ChangeDate;
    creationDate?: CreationDate;
    automatedRecordId?: string;
    recordFileNumber?: string;
    ancestralFileNumber?: string;
    extensions?: ExtensionStructure[];
    xref?: string;
  }): void {
    this.w.line(0, 'INDI', { xref: rec.xref });
    if (rec.restriction !== undefined) {
      this.w.line(1, 'RESN', { value: this.restrictionList(rec.restriction) });
    }
    for (const name of rec.names ?? []) {
      this.emitPersonalName(1, name);
    }
    if (rec.sex !== undefined) {
      this.w.line(1, 'SEX', { value: this.sex(rec.sex) });
    }
    for (const attribute of rec.attributes ?? []) {
      if (this.version === '5.5.1' && attribute.type !== undefined && attribute.tag !== 'IDNO' && attribute.tag !== 'FACT') {
        // 5.5.1 keeps TYPE inside the event detail; the emission is the
        // same level, so it is fine to emit it.
      }
      this.w.line(1, attribute.tag, { value: String(attribute.payload) });
      this.emitIndividualDetail(2, attribute.detail, attribute.type);
    }
    for (const event of rec.events ?? []) {
      this.emitIndividualEvent(event);
    }
    for (const nonEvent of rec.nonEvents ?? []) {
      if (this.version !== '7.0') {
        this.v551('the NO structure');
      }
      this.w.line(1, 'NO', { value: nonEvent.payload });
      if (nonEvent.date !== undefined) {
        this.w.line(2, 'DATE', { value: formatDateValue70(nonEvent.date.value ?? { kind: 'period' }) });
        if (nonEvent.date.phrase !== undefined) {
          this.w.line(3, 'PHRASE', { value: nonEvent.date.phrase });
        }
      }
      for (const note of nonEvent.notes ?? []) {
        this.emitNoteStructure(2, note);
      }
      for (const citation of nonEvent.citations ?? []) {
        this.emitSourceCitation(2, citation);
      }
    }
    for (const ordinance of rec.ordinances ?? []) {
      this.w.line(1, ordinance.tag);
      this.emitLdsDetail(2, ordinance.detail, ordinance.tag);
      if (ordinance.familyChild !== undefined) {
        this.ptr(2, 'FAMC', ordinance.familyChild);
      }
    }
    for (const link of rec.childFamilies ?? []) {
      this.ptr(1, 'FAMC', link.family);
      if (link.pedigree !== undefined) {
        this.w.line(2, 'PEDI', { value: this.pedigree(link.pedigree.payload) });
        if (link.pedigree.phrase !== undefined) {
          this.w.line(3, 'PHRASE', { value: link.pedigree.phrase });
        }
      }
      if (link.status !== undefined) {
        this.w.line(2, 'STAT', { value: this.famcStat(link.status.payload) });
        if (link.status.phrase !== undefined) {
          this.w.line(3, 'PHRASE', { value: link.status.phrase });
        }
      }
      for (const note of link.notes ?? []) {
        this.emitNoteStructure(2, note);
      }
    }
    for (const link of rec.spouseFamilies ?? []) {
      this.ptr(1, 'FAMS', link.family);
      for (const note of link.notes ?? []) {
        this.emitNoteStructure(2, note);
      }
    }
    for (const submitter of rec.submitters ?? []) {
      this.ptr(1, 'SUBM', submitter);
    }
    for (const association of rec.associations ?? []) {
      this.emitAssociation(1, association);
    }
    for (const alias of rec.aliases ?? []) {
      this.ptr(1, 'ALIA', alias.individual);
      if (alias.phrase !== undefined) {
        this.w.line(2, 'PHRASE', { value: alias.phrase });
      }
    }
    for (const submitter of rec.ancestorInterests ?? []) {
      this.ptr(1, 'ANCI', submitter);
    }
    for (const submitter of rec.descendantInterests ?? []) {
      this.ptr(1, 'DESI', submitter);
    }
    if (rec.recordFileNumber !== undefined) {
      if (this.version !== '5.5.1') {
        this.v70('the 5.5.1 RFN field');
      }
      this.w.line(1, 'RFN', { value: rec.recordFileNumber });
    }
    if (rec.ancestralFileNumber !== undefined) {
      if (this.version !== '5.5.1') {
        this.v70('the 5.5.1 AFN field');
      }
      this.w.line(1, 'AFN', { value: rec.ancestralFileNumber });
    }
    this.commonRecordFields(rec, 1);
  }

  private emitIndividualDetail(level: number, detail: IndividualEventDetail | undefined, type: string | undefined): void {
    if (type !== undefined) {
      this.w.line(level, 'TYPE', { value: type });
    }
    if (detail === undefined) {
      return;
    }
    if (detail.age !== undefined) {
      this.emitAge(level, detail.age);
    }
    this.emitEventDetail(level, detail);
  }

  private emitIndividualEvent(event: {
    tag: string;
    payload?: true | string;
    type?: string;
    detail?: IndividualEventDetail;
    familyChild?: string;
    adoptionFamily?: { family: string; adoption?: { payload: string; phrase?: string } };
  }): void {
    if (event.tag === 'EVEN') {
      this.w.line(1, 'EVEN', { value: (event.payload as string) || undefined });
      this.emitIndividualDetail(2, event.detail, event.type);
      return;
    }
    if (this.version === '7.0') {
      this.w.line(1, event.tag, { value: event.payload === true ? 'Y' : undefined });
    } else if (event.tag === 'BIRT' || event.tag === 'CHR' || event.tag === 'DEAT') {
      this.w.line(1, event.tag, { value: event.payload === true ? 'Y' : undefined });
    } else if (event.payload === true) {
      this.v551(`the Y payload on ${event.tag}`);
    } else {
      this.w.line(1, event.tag);
    }
    if (event.tag === 'ADOP' && event.adoptionFamily !== undefined) {
      this.ptr(2, 'FAMC', event.adoptionFamily.family);
      if (event.adoptionFamily.adoption !== undefined) {
        this.w.line(3, 'ADOP', { value: event.adoptionFamily.adoption.payload });
        if (event.adoptionFamily.adoption.phrase !== undefined) {
          this.w.line(4, 'PHRASE', { value: event.adoptionFamily.adoption.phrase });
        }
      }
    }
    if ((event.tag === 'BIRT' || event.tag === 'CHR') && event.familyChild !== undefined) {
      this.ptr(2, 'FAMC', event.familyChild);
    }
    this.emitIndividualDetail(2, event.detail, event.type);
  }

  private emitLdsDetail(level: number, detail: LdsOrdinanceDetail | undefined, _ordinance: string): void {
    if (detail === undefined) {
      return;
    }
    if (detail.date !== undefined) {
      this.emitDate(level, 'DATE', detail.date);
    }
    if (detail.temple !== undefined) {
      this.w.line(level, 'TEMP', { value: detail.temple });
    }
    if (detail.place !== undefined) {
      this.emitPlace(level, detail.place);
    }
    if (detail.status !== undefined) {
      this.w.line(level, 'STAT', { value: this.ordStat(detail.status.payload) });
      this.emitDateExact(level + 1, 'DATE', detail.status.date, detail.status.date.time);
    }
    for (const note of detail.notes ?? []) {
      this.emitNoteStructure(level, note);
    }
    for (const citation of detail.citations ?? []) {
      this.emitSourceCitation(level, citation);
    }
  }

  private emitMultimedia(rec: {
    tag: 'OBJE';
    restriction?: Array<string | `_${string}`>;
    files: MediaFile[];
    identifiers?: Array<{ tag: string; payload: string; type?: string }>;
    notes?: NoteStructure[];
    citations?: SourceCitation[];
    changeDate?: ChangeDate;
    creationDate?: CreationDate;
    automatedRecordId?: string;
    extensions?: ExtensionStructure[];
    xref?: string;
  }): void {
    this.w.line(0, 'OBJE', { xref: rec.xref });
    if (rec.restriction !== undefined) {
      if (this.version !== '7.0') {
        this.v551('a RESN under OBJE');
      }
      this.w.line(1, 'RESN', { value: this.restrictionList(rec.restriction) });
    }
    for (const file of rec.files) {
      this.emitMediaFile(1, file);
    }
    this.commonRecordFields(rec, 1);
  }

  private emitMediaFile(level: number, file: MediaFile): void {
    this.w.line(level, 'FILE', { value: file.payload });
    this.emitMediaFormat(level + 1, file.form);
    if (file.title !== undefined) {
      this.w.line(level + 1, 'TITL', { value: file.title });
    }
    if (this.version === '7.0') {
      for (const translation of file.translations ?? []) {
        this.w.line(level + 1, 'TRAN', { value: translation.payload });
        this.emitMediaFormat(level + 2, translation.form);
      }
    }
  }

  private emitMediaFormat(level: number, format: MediaFormatStructure): void {
    this.w.line(level, 'FORM', { value: this.mediaType(format.payload) });
    if (format.medium !== undefined) {
      if (this.version === '7.0') {
        this.emitMedia(level + 1, format.medium);
      } else {
        this.w.line(level + 1, 'TYPE', { value: this.medi551(format.medium.payload) });
      }
    }
  }

  private emitMedia(level: number, medium: MediaStructure): void {
    this.w.line(level, 'MEDI', { value: medium.payload });
    if (medium.phrase !== undefined) {
      this.w.line(level + 1, 'PHRASE', { value: medium.phrase });
    }
  }

  private emitRepository(rec: {
    tag: 'REPO';
    name: string;
    address?: AddressStructure;
    phone?: string[];
    email?: string[];
    fax?: string[];
    www?: string[];
    notes?: NoteStructure[];
    identifiers?: Array<{ tag: string; payload: string; type?: string }>;
    changeDate?: ChangeDate;
    creationDate?: CreationDate;
    automatedRecordId?: string;
    extensions?: ExtensionStructure[];
    xref?: string;
  }): void {
    this.w.line(0, 'REPO', { xref: rec.xref });
    this.w.line(1, 'NAME', { value: rec.name });
    if (rec.address !== undefined) {
      this.emitAddress(1, rec.address);
    }
    if (this.version === '7.0') {
      for (const value of rec.phone ?? []) {
        this.w.line(1, 'PHON', { value });
      }
      for (const value of rec.email ?? []) {
        this.w.line(1, 'EMAIL', { value });
      }
      for (const value of rec.fax ?? []) {
        this.w.line(1, 'FAX', { value });
      }
      for (const value of rec.www ?? []) {
        this.w.line(1, 'WWW', { value });
      }
    }
    this.commonRecordFields(rec, 1);
  }

  private emitSharedNote(rec: {
    tag: 'SNOTE';
    payload: string;
    mediaType?: string;
    language?: string;
    translations?: NoteTranslation[];
    citations?: SourceCitation[];
    identifiers?: Array<{ tag: string; payload: string; type?: string }>;
    changeDate?: ChangeDate;
    creationDate?: CreationDate;
    extensions?: ExtensionStructure[];
    xref?: string;
  }): void {
    this.w.line(0, 'SNOTE', { xref: rec.xref, value: rec.payload });
    if (rec.mediaType !== undefined) {
      this.w.line(1, 'MIME', { value: rec.mediaType });
    }
    if (rec.language !== undefined) {
      this.w.line(1, 'LANG', { value: rec.language });
    }
    for (const translation of rec.translations ?? []) {
      this.w.line(1, 'TRAN', { value: translation.payload });
      if (translation.mediaType !== undefined) {
        this.w.line(2, 'MIME', { value: translation.mediaType });
      }
      if (translation.language !== undefined) {
        this.w.line(2, 'LANG', { value: translation.language });
      }
    }
    this.commonRecordFields(rec, 1);
  }

  private emitNoteRecord(rec: {
    tag: 'NOTE';
    payload: string;
    identifiers?: Array<{ tag: string; payload: string; type?: string }>;
    citations?: SourceCitation[];
    changeDate?: ChangeDate;
    automatedRecordId?: string;
    extensions?: ExtensionStructure[];
    xref?: string;
  }): void {
    this.w.line(0, 'NOTE', { xref: rec.xref, value: rec.payload });
    this.commonRecordFields(rec, 1);
  }

  private emitSource(rec: {
    tag: 'SOUR';
    data?: {
      events?: Array<{ payload: Array<string | `_${string}`>; date?: DatePeriodStructure; place?: PlaceStructure }>;
      agency?: string;
      notes?: NoteStructure[];
    };
    author?: string;
    title?: string;
    abbreviation?: string;
    publication?: string;
    text?: SourceText;
    repositoryCitations?: Array<{ repository: string; notes?: NoteStructure[]; callNumbers?: CallNumberStructure[] }>;
    identifiers?: Array<{ tag: string; payload: string; type?: string }>;
    notes?: NoteStructure[];
    media?: MultimediaLink[];
    changeDate?: ChangeDate;
    creationDate?: CreationDate;
    automatedRecordId?: string;
    extensions?: ExtensionStructure[];
    xref?: string;
  }): void {
    this.w.line(0, 'SOUR', { xref: rec.xref });
    if (rec.data !== undefined) {
      this.w.line(1, 'DATA');
      for (const event of rec.data.events ?? []) {
        this.w.line(2, 'EVEN', { value: event.payload.join(', ') });
        if (event.date !== undefined) {
          this.w.line(3, 'DATE', {
            value: this.version === '7.0' ? formatDateValue70(event.date.value ?? { kind: 'period' }) : formatDateValue551(event.date.value ?? { kind: 'period' }),
          });
          if (event.date.phrase !== undefined) {
            this.w.line(4, 'PHRASE', { value: event.date.phrase });
          }
        }
        if (event.place !== undefined) {
          this.emitPlace(3, event.place);
        }
      }
      if (rec.data.agency !== undefined) {
        this.w.line(2, 'AGNC', { value: rec.data.agency });
      }
      for (const note of rec.data.notes ?? []) {
        this.emitNoteStructure(2, note);
      }
    }
    if (rec.author !== undefined) {
      this.w.line(1, 'AUTH', { value: rec.author });
    }
    if (rec.title !== undefined) {
      this.w.line(1, 'TITL', { value: rec.title });
    }
    if (rec.abbreviation !== undefined) {
      this.w.line(1, 'ABBR', { value: rec.abbreviation });
    }
    if (rec.publication !== undefined) {
      this.w.line(1, 'PUBL', { value: rec.publication });
    }
    if (rec.text !== undefined) {
      this.w.line(1, 'TEXT', { value: rec.text.payload });
      if (this.version === '7.0') {
        if (rec.text.mediaType !== undefined) {
          this.w.line(2, 'MIME', { value: rec.text.mediaType });
        }
        if (rec.text.language !== undefined) {
          this.w.line(2, 'LANG', { value: rec.text.language });
        }
      }
    }
    for (const citation of rec.repositoryCitations ?? []) {
      this.emitRepositoryCitation(1, citation);
    }
    this.commonRecordFields(rec, 1);
  }

  private emitRepositoryCitation(level: number, citation: {
    repository: string;
    notes?: NoteStructure[];
    callNumbers?: CallNumberStructure[];
  }): void {
    if (this.version === '7.0') {
      this.ptr(level, 'REPO', citation.repository);
    } else if (citation.repository === '@VOID@') {
      this.w.line(level, 'REPO');
    } else {
      this.ptr(level, 'REPO', citation.repository);
    }
    for (const note of citation.notes ?? []) {
      this.emitNoteStructure(level + 1, note);
    }
    for (const callNumber of citation.callNumbers ?? []) {
      this.w.line(level + 1, 'CALN', { value: callNumber.payload });
      if (callNumber.medium !== undefined) {
        this.emitMedia(level + 2, callNumber.medium);
      }
    }
  }

  private emitSubmitter(rec: {
    tag: 'SUBM';
    name: string;
    address?: AddressStructure;
    phone?: string[];
    email?: string[];
    fax?: string[];
    www?: string[];
    media?: MultimediaLink[];
    languages?: string[];
    identifiers?: Array<{ tag: string; payload: string; type?: string }>;
    notes?: NoteStructure[];
    changeDate?: ChangeDate;
    creationDate?: CreationDate;
    registeredRfn?: string;
    automatedRecordId?: string;
    extensions?: ExtensionStructure[];
    xref?: string;
  }): void {
    this.w.line(0, 'SUBM', { xref: rec.xref });
    this.w.line(1, 'NAME', { value: rec.name });
    if (rec.address !== undefined) {
      this.emitAddress(1, rec.address);
    }
    if (this.version === '7.0') {
      for (const value of rec.phone ?? []) {
        this.w.line(1, 'PHON', { value });
      }
      for (const value of rec.email ?? []) {
        this.w.line(1, 'EMAIL', { value });
      }
      for (const value of rec.fax ?? []) {
        this.w.line(1, 'FAX', { value });
      }
      for (const value of rec.www ?? []) {
        this.w.line(1, 'WWW', { value });
      }
    }
    for (const media of rec.media ?? []) {
      this.emitMultimediaLink(1, media);
    }
    for (const language of rec.languages ?? []) {
      this.w.line(1, 'LANG', { value: this.language(language) });
    }
    if (rec.registeredRfn !== undefined) {
      if (this.version !== '5.5.1') {
        this.v70('the 5.5.1 RFN field');
      }
      this.w.line(1, 'RFN', { value: rec.registeredRfn });
    }
    this.commonRecordFields(rec, 1);
  }

  private emitSubmission(rec: {
    tag: 'SUBN';
    submitter?: string;
    familyFile?: string;
    temple?: string;
    generationsOfAncestors?: number;
    generationsOfDescendants?: number;
    ordinanceProcessFlag?: 'yes' | 'no';
    notes?: NoteStructure[];
    changeDate?: ChangeDate;
    automatedRecordId?: string;
    extensions?: ExtensionStructure[];
    xref?: string;
  }): void {
    this.w.line(0, 'SUBN', { xref: rec.xref });
    if (rec.submitter !== undefined) {
      this.ptr(1, 'SUBM', rec.submitter);
    }
    if (rec.familyFile !== undefined) {
      this.w.line(1, 'FAMF', { value: rec.familyFile });
    }
    if (rec.temple !== undefined) {
      this.w.line(1, 'TEMP', { value: rec.temple });
    }
    if (rec.generationsOfAncestors !== undefined) {
      this.w.line(1, 'ANCE', { value: String(rec.generationsOfAncestors) });
    }
    if (rec.generationsOfDescendants !== undefined) {
      this.w.line(1, 'DESC', { value: String(rec.generationsOfDescendants) });
    }
    if (rec.ordinanceProcessFlag !== undefined) {
      this.w.line(1, 'ORDI', { value: rec.ordinanceProcessFlag });
    }
    for (const note of rec.notes ?? []) {
      this.emitNoteStructure(1, note);
    }
    if (rec.changeDate !== undefined) {
      this.w.line(1, 'CHAN');
      this.emitDateExact(2, 'DATE', rec.changeDate.date, rec.changeDate.date.time);
      for (const note of rec.changeDate.notes ?? []) {
        this.emitNoteStructure(2, note);
      }
    }
    if (rec.automatedRecordId !== undefined) {
      this.w.line(1, 'RIN', { value: rec.automatedRecordId });
    }
    this.emitExtensions(1, rec);
  }

  // -- Substructures -----------------------------------------------------------

  private emitAddress(level: number, address: AddressStructure): void {
    this.w.line(level, 'ADDR', { value: address.payload });
    if (address.line1 !== undefined) {
      this.w.line(level + 1, 'ADR1', { value: address.line1 });
    }
    if (address.line2 !== undefined) {
      this.w.line(level + 1, 'ADR2', { value: address.line2 });
    }
    if (address.line3 !== undefined) {
      this.w.line(level + 1, 'ADR3', { value: address.line3 });
    }
    if (address.city !== undefined) {
      this.w.line(level + 1, 'CITY', { value: address.city });
    }
    if (address.state !== undefined) {
      this.w.line(level + 1, 'STAE', { value: address.state });
    }
    if (address.postalCode !== undefined) {
      this.w.line(level + 1, 'POST', { value: address.postalCode });
    }
    if (address.country !== undefined) {
      this.w.line(level + 1, 'CTRY', { value: address.country });
    }
    if (this.version === '5.5.1') {
      for (const value of address.phone ?? []) {
        this.w.line(level + 1, 'PHON', { value });
      }
      for (const value of address.email ?? []) {
        this.w.line(level + 1, 'EMAIL', { value });
      }
      for (const value of address.fax ?? []) {
        this.w.line(level + 1, 'FAX', { value });
      }
      for (const value of address.www ?? []) {
        this.w.line(level + 1, 'WWW', { value });
      }
    } else if (address.phone !== undefined || address.email !== undefined || address.fax !== undefined || address.www !== undefined) {
      this.v70('the 5.5.1 contact fields inside ADDR');
    }
  }

  private emitAssociation(level: number, association: AssociationStructure): void {
    this.ptr(level, 'ASSO', association.individual);
    if (association.phrase !== undefined) {
      this.w.line(level + 1, 'PHRASE', { value: association.phrase });
    }
    if (this.version === '7.0') {
      if (association.role === undefined) {
        fail('serialize.missing-field', 'A 7.0 ASSO requires a ROLE');
      }
      this.w.line(level + 1, 'ROLE', { value: association.role.payload });
      if (association.role.phrase !== undefined) {
        this.w.line(level + 2, 'PHRASE', { value: association.role.phrase });
      }
    } else {
      if (association.relationship === undefined) {
        fail('serialize.missing-field', 'A 5.5.1 ASSO requires a RELA');
      }
      this.w.line(level + 1, 'RELA', { value: association.relationship });
    }
    for (const note of association.notes ?? []) {
      this.emitNoteStructure(level + 1, note);
    }
    for (const citation of association.citations ?? []) {
      this.emitSourceCitation(level + 1, citation);
    }
  }

  private emitDate(level: number, tag: string, date: DateStructure): void {
    if (this.version === '7.0') {
      const raw = date.value === undefined ? '' : formatDateValue70(date.value);
      this.w.line(level, tag, { value: raw === '' ? undefined : raw });
      if (date.time !== undefined) {
        this.w.line(level + 1, 'TIME', { value: formatTime(date.time, '7.0') });
      }
      if (date.phrase !== undefined) {
        this.w.line(level + 1, 'PHRASE', { value: date.phrase });
      }
      return;
    }
    // 5.5.1: value + optional phrase. A phrase with a value becomes a NOTE
    // subordinate to the DATE (GEDCOM 5.5.1 §2 p.48); a phrase without a
    // value becomes the parenthesized form.
    if (date.value === undefined) {
      if (date.phrase !== undefined) {
        this.w.line(level, tag, { value: `(${date.phrase})` });
      } else {
        this.w.line(level, tag);
      }
      return;
    }
    const raw = formatDateValue551(date.value);
    this.w.line(level, tag, { value: raw === '' ? undefined : raw });
    if (date.phrase !== undefined) {
      this.w.line(level + 1, 'NOTE', { value: date.phrase });
    }
  }

  private emitDateExact(level: number, tag: string, date: DateExactStructure, time?: TimeValue): void {
    this.w.line(level, tag, { value: formatDateExact(date.value, this.version) });
    if (time !== undefined) {
      this.w.line(level + 1, 'TIME', { value: formatTime(time, this.version) });
    }
  }

  private emitAge(level: number, age: AgeStructure): void {
    this.w.line(level, 'AGE', { value: this.version === '7.0' ? formatAge70(age.payload) : formatAge551(age.payload) });
    if (age.phrase !== undefined) {
      this.w.line(level + 1, 'PHRASE', { value: age.phrase });
    }
  }

  private emitEventDetail(level: number, detail: EventDetail): void {
    if (detail.date !== undefined) {
      this.emitDate(level, 'DATE', detail.date);
    }
    if (detail.place !== undefined) {
      this.emitPlace(level, detail.place);
    }
    if (detail.address !== undefined) {
      this.emitAddress(level, detail.address);
    }
    if (detail.phone !== undefined && this.version === '7.0') {
      for (const value of detail.phone) {
        this.w.line(level, 'PHON', { value });
      }
    }
    if (detail.email !== undefined && this.version === '7.0') {
      for (const value of detail.email) {
        this.w.line(level, 'EMAIL', { value });
      }
    }
    if (detail.fax !== undefined && this.version === '7.0') {
      for (const value of detail.fax) {
        this.w.line(level, 'FAX', { value });
      }
    }
    if (detail.www !== undefined && this.version === '7.0') {
      for (const value of detail.www) {
        this.w.line(level, 'WWW', { value });
      }
    }
    if (detail.agency !== undefined) {
      this.w.line(level, 'AGNC', { value: detail.agency });
    }
    if (detail.religiousAffiliation !== undefined) {
      this.w.line(level, 'RELI', { value: detail.religiousAffiliation });
    }
    if (detail.cause !== undefined) {
      this.w.line(level, 'CAUS', { value: detail.cause });
    }
    if (detail.restriction !== undefined) {
      this.w.line(level, 'RESN', { value: this.restrictionList(detail.restriction) });
    }
    if (detail.sortDate !== undefined) {
      if (this.version !== '7.0') {
        this.v551('the SDATE structure');
      }
      const raw = detail.sortDate.value === undefined ? '' : formatDateValue70(detail.sortDate.value);
      this.w.line(level, 'SDATE', { value: raw === '' ? undefined : raw });
      if (detail.sortDate.time !== undefined) {
        this.w.line(level + 1, 'TIME', { value: formatTime(detail.sortDate.time, '7.0') });
      }
      if (detail.sortDate.phrase !== undefined) {
        this.w.line(level + 1, 'PHRASE', { value: detail.sortDate.phrase });
      }
    }
    for (const association of detail.associations ?? []) {
      this.emitAssociation(level, association);
    }
    for (const note of detail.notes ?? []) {
      this.emitNoteStructure(level, note);
    }
    for (const citation of detail.citations ?? []) {
      this.emitSourceCitation(level, citation);
    }
    for (const media of detail.media ?? []) {
      this.emitMultimediaLink(level, media);
    }
    for (const uid of detail.uniqueIds ?? []) {
      if (this.version !== '7.0') {
        this.v551('the UID structure');
      }
      this.w.line(level, 'UID', { value: uid });
    }
  }

  private emitNoteStructure(level: number, note: NoteStructure): void {
    if (note.tag === 'SNOTE') {
      if (this.version !== '7.0') {
        this.v551('the SNOTE pointer');
      }
      this.ptr(level, 'SNOTE', note.note);
      return;
    }
    if (note.tag === 'NOTE' && 'note' in note) {
      // The 5.5.1 NOTE-record pointer.
      if (this.version !== '5.5.1') {
        this.v70('the NOTE-record pointer');
      }
      this.ptr(level, 'NOTE', (note as NoteReference).note);
      return;
    }
    const inline = note as Note;
    this.w.line(level, 'NOTE', { value: inline.payload });
    if (this.version === '7.0') {
      if (inline.mediaType !== undefined) {
        this.w.line(level + 1, 'MIME', { value: inline.mediaType });
      }
      if (inline.language !== undefined) {
        this.w.line(level + 1, 'LANG', { value: inline.language });
      }
      for (const translation of inline.translations ?? []) {
        this.w.line(level + 1, 'TRAN', { value: translation.payload });
        if (translation.mediaType !== undefined) {
          this.w.line(level + 2, 'MIME', { value: translation.mediaType });
        }
        if (translation.language !== undefined) {
          this.w.line(level + 2, 'LANG', { value: translation.language });
        }
      }
    } else if (inline.mediaType !== undefined || inline.language !== undefined || inline.translations !== undefined) {
      this.v551('the 7.0 MIME/LANG/TRAN note substructures');
    }
    for (const citation of inline.citations ?? []) {
      this.emitSourceCitation(level + 1, citation);
    }
  }

  private emitPersonalName(level: number, name: PersonalNameStructure): void {
    this.w.line(level, 'NAME', { value: this.version === '7.0' ? formatName70(name.payload) : formatName551(name.payload) });
    if (name.type !== undefined) {
      this.emitNameType(level + 1, name.type);
    }
    this.emitNamePieces(level + 1, name.pieces);
    if (this.version === '7.0') {
      for (const translation of name.translations ?? []) {
        this.w.line(level + 1, 'TRAN', { value: formatName70(translation.payload) });
        this.w.line(level + 2, 'LANG', { value: translation.language });
        this.emitNamePieces(level + 2, translation.pieces);
      }
      for (const note of name.notes ?? []) {
        this.emitNoteStructure(level + 1, note);
      }
      for (const citation of name.citations ?? []) {
        this.emitSourceCitation(level + 1, citation);
      }
    } else {
      if (name.translations !== undefined) {
        this.v551('the 7.0 NAME.TRAN structure');
      }
      for (const variation of name.phonetic ?? []) {
        this.w.line(level + 1, 'FONE', { value: formatName551(variation.payload) });
        this.w.line(level + 2, 'TYPE', { value: variation.type });
        this.emitNamePieces(level + 2, variation.pieces);
      }
      for (const variation of name.romanized ?? []) {
        this.w.line(level + 1, 'ROMN', { value: formatName551(variation.payload) });
        this.w.line(level + 2, 'TYPE', { value: variation.type });
        this.emitNamePieces(level + 2, variation.pieces);
      }
    }
  }

  private emitNameType(level: number, type: NameTypeStructure): void {
    if (this.version === '7.0') {
      this.w.line(level, 'TYPE', { value: type.payload });
      if (type.phrase !== undefined) {
        this.w.line(level + 1, 'PHRASE', { value: type.phrase });
      }
      return;
    }
    // 5.5.1: the known set in lowercase, or the phrase as the user-defined
    // value. OTHER and PROFESSIONAL have no 5.5.1 spelling.
    const known: Record<string, string> = { AKA: 'aka', BIRTH: 'birth', IMMIGRANT: 'immigrant', MAIDEN: 'maiden', MARRIED: 'married' };
    const spelled = known[type.payload];
    if (spelled !== undefined) {
      this.w.line(level, 'TYPE', { value: spelled });
      return;
    }
    if (type.payload === 'OTHER' && type.phrase !== undefined) {
      this.w.line(level, 'TYPE', { value: type.phrase });
      return;
    }
    this.v551(`the NAME.TYPE value ${type.payload}`);
  }

  private emitNamePieces(level: number, pieces: PersonalNamePieces | undefined): void {
    if (pieces === undefined) {
      return;
    }
    const emit = (tag: string, values: string[] | undefined): void => {
      if (values === undefined) {
        return;
      }
      if (this.version === '7.0') {
        for (const value of values) {
          this.w.line(level, tag, { value });
        }
      } else {
        this.w.line(level, tag, { value: values.join(', ') });
      }
    };
    emit('NPFX', pieces.namePrefixes);
    emit('GIVN', pieces.givenNames);
    emit('NICK', pieces.nicknames);
    emit('SPFX', pieces.surnamePrefixes);
    emit('SURN', pieces.surnames);
    emit('NSFX', pieces.nameSuffixes);
    for (const note of pieces.notes ?? []) {
      if (this.version !== '5.5.1') {
        this.v70('the 5.5.1 NOTE under the name pieces');
      }
      this.emitNoteStructure(level, note);
    }
    for (const citation of pieces.citations ?? []) {
      if (this.version !== '5.5.1') {
        this.v70('the 5.5.1 SOUR under the name pieces');
      }
      this.emitSourceCitation(level, citation);
    }
  }

  private emitPlace(level: number, place: PlaceStructure): void {
    this.w.line(level, 'PLAC', { value: place.payload.join(', ') });
    if (place.form !== undefined) {
      this.w.line(level + 1, 'FORM', { value: place.form.join(', ') });
    }
    if (this.version === '7.0') {
      if (place.language !== undefined) {
        this.w.line(level + 1, 'LANG', { value: place.language });
      }
      for (const translation of place.translations ?? []) {
        this.w.line(level + 1, 'TRAN', { value: translation.payload.join(', ') });
        this.w.line(level + 2, 'LANG', { value: translation.language });
      }
      for (const externalId of place.externalIds ?? []) {
        this.w.line(level + 1, 'EXID', { value: externalId.payload });
        if (externalId.type !== undefined) {
          this.w.line(level + 2, 'TYPE', { value: externalId.type });
        }
      }
      for (const note of place.notes ?? []) {
        this.emitNoteStructure(level + 1, note);
      }
    } else {
      if (place.language !== undefined || place.translations !== undefined || place.externalIds !== undefined) {
        this.v551('the 7.0 PLAC LANG/TRAN/EXID substructures');
      }
      for (const variation of place.phonetic ?? []) {
        this.w.line(level + 1, 'FONE', { value: variation.payload.join(', ') });
        this.w.line(level + 2, 'TYPE', { value: variation.type });
      }
      for (const variation of place.romanized ?? []) {
        this.w.line(level + 1, 'ROMN', { value: variation.payload.join(', ') });
        this.w.line(level + 2, 'TYPE', { value: variation.type });
      }
      for (const note of place.notes ?? []) {
        this.emitNoteStructure(level + 1, note);
      }
    }
    if (place.map !== undefined) {
      this.w.line(level + 1, 'MAP');
      this.w.line(level + 2, 'LATI', { value: `${place.map.latitude.direction}${place.map.latitude.degrees}` });
      this.w.line(level + 2, 'LONG', { value: `${place.map.longitude.direction}${place.map.longitude.degrees}` });
    }
  }

  private emitSourceCitation(level: number, citation: SourceCitation): void {
    if (this.version === '7.0') {
      if (citation.description !== undefined) {
        this.v70('the 5.5.1 free-text SOUR description');
      }
      this.ptr(level, 'SOUR', citation.source);
      this.emitCitationCommon(level, citation);
      return;
    }
    if (citation.source === '@VOID@') {
      if (citation.description === undefined) {
        this.v551('a void SOUR pointer without a description');
      }
      this.w.line(level, 'SOUR', { value: citation.description ?? '' });
      for (const text of citation.data?.texts ?? []) {
        this.w.line(level + 1, 'TEXT', { value: text.payload });
      }
      for (const media of citation.media ?? []) {
        this.emitMultimediaLink(level + 1, media);
      }
      for (const note of citation.notes ?? []) {
        this.emitNoteStructure(level + 1, note);
      }
      if (citation.quality !== undefined) {
        this.w.line(level + 1, 'QUAY', { value: citation.quality });
      }
      return;
    }
    this.ptr(level, 'SOUR', citation.source);
    this.emitCitationCommon(level, citation);
  }

  private emitCitationCommon(level: number, citation: SourceCitation): void {
    if (citation.page !== undefined) {
      this.w.line(level + 1, 'PAGE', { value: citation.page });
    }
    if (citation.data !== undefined) {
      this.w.line(level + 1, 'DATA');
      if (citation.data.date !== undefined) {
        this.emitDate(level + 2, 'DATE', citation.data.date);
      }
      for (const text of citation.data.texts ?? []) {
        this.w.line(level + 2, 'TEXT', { value: text.payload });
        if (this.version === '7.0') {
          if (text.mediaType !== undefined) {
            this.w.line(level + 3, 'MIME', { value: text.mediaType });
          }
          if (text.language !== undefined) {
            this.w.line(level + 3, 'LANG', { value: text.language });
          }
        }
      }
    }
    if (citation.event !== undefined) {
      this.w.line(level + 1, 'EVEN', { value: citation.event.payload });
      if (citation.event.phrase !== undefined) {
        if (this.version !== '7.0') {
          this.v551('a PHRASE under SOUR.EVEN');
        }
        this.w.line(level + 2, 'PHRASE', { value: citation.event.phrase });
      }
      if (citation.event.role !== undefined) {
        if (this.version === '7.0') {
          this.w.line(level + 2, 'ROLE', { value: citation.event.role.payload });
          if (citation.event.role.phrase !== undefined) {
            this.w.line(level + 3, 'PHRASE', { value: citation.event.role.phrase });
          }
        } else {
          const role = citation.event.role;
          const known = ['CHIL', 'HUSB', 'WIFE', 'MOTH', 'FATH', 'SPOU'];
          if (known.includes(role.payload)) {
            this.w.line(level + 2, 'ROLE', { value: role.payload });
          } else if (role.payload === 'OTHER' && role.phrase !== undefined) {
            this.w.line(level + 2, 'ROLE', { value: `(${role.phrase})` });
          } else {
            this.v551(`the role ${role.payload}`);
          }
        }
      }
    }
    for (const media of citation.media ?? []) {
      this.emitMultimediaLink(level + 1, media);
    }
    for (const note of citation.notes ?? []) {
      this.emitNoteStructure(level + 1, note);
    }
    if (citation.quality !== undefined) {
      this.w.line(level + 1, 'QUAY', { value: citation.quality });
    }
  }

  private emitMultimediaLink(level: number, link: MultimediaLink): void {
    this.ptr(level, 'OBJE', link.object);
    if (this.version === '7.0') {
      if (link.crop !== undefined) {
        this.w.line(level + 1, 'CROP');
        if (link.crop.top !== undefined) {
          this.w.line(level + 2, 'TOP', { value: String(link.crop.top) });
        }
        if (link.crop.left !== undefined) {
          this.w.line(level + 2, 'LEFT', { value: String(link.crop.left) });
        }
        if (link.crop.height !== undefined) {
          this.w.line(level + 2, 'HEIGHT', { value: String(link.crop.height) });
        }
        if (link.crop.width !== undefined) {
          this.w.line(level + 2, 'WIDTH', { value: String(link.crop.width) });
        }
      }
      if (link.title !== undefined) {
        this.w.line(level + 1, 'TITL', { value: link.title });
      }
    } else if (link.crop !== undefined || link.title !== undefined) {
      this.v551('a CROP/TITL under OBJE');
    }
  }

  private emitExtension(level: number, ext: ExtensionStructure, xref: string | undefined): void {
    const payload = ext.payload === undefined ? undefined : ext.payload;
    this.w.line(level, ext.tag, { xref, value: payload });
    for (const child of ext.children) {
      this.emitExtension(level + 1, child, undefined);
    }
  }

  private emitExtensions(level: number, structure: GedcomStructureBase): void {
    for (const ext of structure.extensions ?? []) {
      this.emitExtension(level, ext, undefined);
    }
  }

  // -- Value spellings ---------------------------------------------------------

  private restrictionList(values: Array<string | `_${string}`>): string {
    return values.map((value) => (this.version === '5.5.1' ? value.toLowerCase() : value)).join(', ');
  }

  private pedigree(value: string): string {
    if (this.version === '7.0') {
      return value;
    }
    if (value === 'OTHER') {
      this.v551('the PEDI value OTHER');
    }
    return value.toLowerCase();
  }

  private famcStat(value: string): string {
    if (this.version === '7.0') {
      return value;
    }
    return value.toLowerCase();
  }

  private sex(value: string): string {
    if (this.version === '5.5.1' && value === 'X') {
      this.v551('the SEX value X');
    }
    return value;
  }

  private ordStat(value: string): string {
    if (this.version === '7.0') {
      return value;
    }
    if (value === 'PRE_1970') {
      return 'PRE-1970';
    }
    if (value === 'DNS_CAN') {
      return 'DNS/CAN';
    }
    if (value === 'INFANT') {
      this.v551('the INFANT status');
    }
    return value;
  }

  private medi551(value: string): string {
    if (value === 'OTHER') {
      this.v551('the MEDI value OTHER');
    }
    return value.toLowerCase();
  }

  private mediaType(value: MediaType): string {
    if (this.version === '7.0') {
      return value;
    }
    const known = (MULTIMEDIA_FORMATS_551 as readonly string[]).includes(value);
    if (known) {
      return value;
    }
    const mapped = MEDIA_TYPE_TO_551.get(value.toLowerCase());
    if (mapped !== undefined) {
      return mapped;
    }
    this.v551(`the media type "${value}"`);
  }

  private language(value: string): string {
    if (this.version === '7.0') {
      return value;
    }
    // A 5.5.1 table name passes through verbatim.
    const own = (LANGUAGE_IDS_551 as readonly string[]).find(
      (id) => id.toLowerCase() === value.toLowerCase(),
    );
    if (own !== undefined) {
      return own;
    }
    const mapped = LANGUAGE_TO_551.get(value.toLowerCase());
    if (mapped !== undefined) {
      return mapped;
    }
    this.v551(`the language "${value}"`);
  }
}

function emit(version: Version, dataset: GedcomDataset): string {
  const emitter = new Emitter(version);
  emitter.emitDataset(dataset);
  const text = emitter.w.lines.join('\r\n');
  return `${text}\r\n`;
}

/** Serializes the dataset as GEDCOM 7.0 text. */
export function serializeGedcom70(dataset: GedcomDataset): ParseResult<string> {
  return run(() => emit('7.0', dataset));
}

/** Serializes the dataset as GEDCOM 5.5.1 text. */
export function serializeGedcom551(dataset: GedcomDataset): ParseResult<string> {
  return run(() => emit('5.5.1', dataset));
}

void DOCUMENT_START;
