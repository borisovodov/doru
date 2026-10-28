/**
 * Parser section: Substructures.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). Every function here
 * maps a raw-tree node onto the typed model and fails with a typed
 * error naming the offending line.
 */

import {
  EVENT_ENUM_VALUES,
  ROLE_ENUM_VALUES,
} from '../enumerations';
import {
  fail,
} from '../errors';
import type {
  AddressStructure,
  AgeStructure,
  AssociationStructure,
  ChangeDate,
  CreationDate,
  DateExactStructure,
  DatePeriodStructure,
  DateStructure,
  ExternalIdentifierStructure,
  NonEventStructure,
  Note,
  NoteReference,
  NoteStructure,
  NoteTranslation,
  ReferenceIdentifierStructure,
  RoleStructure,
  SharedNoteReference,
  SortDateStructure,
  SourceCitation,
  UniqueIdentifierStructure,
} from '../structures';
import type {
  DateValue,
} from '../primitives';
import type {
  Ctx,
} from './context';
import {
  atMostThree,
  dispatch,
  noPayload,
  one,
  reqPtr,
  reqText,
  resolvePtr,
} from './context';
import type {
  RawNode,
} from './lines';
import {
  parsePrivacyFlag,
  parseSourceCitation,
  parseVendorFlag,
} from './sources-media';
import {
  parseAge551,
  parseAge70,
  parseDateExact70,
  parseDatePeriod70,
  parseDateValue551,
  parseDateValue70,
  parseEnum,
  parseTime551,
  parseTime70,
} from './types';

// Substructures
// ---------------------------------------------------------------------------

export function parseAddressStructure(node: RawNode, ctx: Ctx): AddressStructure {
  const out: AddressStructure = { payload: reqText(node) };
  const handlers: Record<string, (child: RawNode) => void> = {
    _EMAIL: (child) => {
      (out.email ??= []).push(reqText(child));
    },
    _PRIV: (child) => {
      out.private = parsePrivacyFlag(child, '_PRIV');
    },
    _NAME: (child) => {
      out.name = reqText(child);
    },
    _SORT: (child) => {
      // Legacy: the name spelling used for sorting addresses in a
      // report (see AddressStructure.sortName).
      out.sortName = reqText(child);
    },
    _LIST1: (child) => {
      // Legacy: the "Newsletter" address grouping (see
      // AddressStructure.newsletterList).
      out.newsletterList = parseVendorFlag(child, '_LIST1');
    },
    _LIST2: (child) => {
      out.familyAssociationList = parseVendorFlag(child, '_LIST2');
    },
    _LIST3: (child) => {
      out.birthdayList = parseVendorFlag(child, '_LIST3');
    },
    _LIST4: (child) => {
      out.researchList = parseVendorFlag(child, '_LIST4');
    },
    _LIST5: (child) => {
      out.christmasList = parseVendorFlag(child, '_LIST5');
    },
    _LIST6: (child) => {
      out.holidayList = parseVendorFlag(child, '_LIST6');
    },
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

export function parseAssociation(node: RawNode, ctx: Ctx): AssociationStructure {
  const out: AssociationStructure = { tag: 'ASSO', individual: reqPtr(node, ctx) };
  const handlers: Record<string, (child: RawNode) => void> = {
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
  };
  if (ctx.version === '7.0') {
    // The 7.0 ASSOCIATION_STRUCTURE carries <<NOTE_STRUCTURE>> {0:M}
    // (GEDCOM 7.0 §3.2.3); 5.5.1 stays strict.
    handlers['SNOTE'] = (child) => {
      (out.notes ??= []).push(parseNoteStructure(child, ctx));
    };
  }
  dispatch(node, out, handlers, ctx, ['PHRASE', 'ROLE', 'RELA']);
  if (ctx.version === '7.0' && out.role === undefined) {
    fail('structure.missing-required', 'The ASSO structure requires a ROLE substructure', node.position);
  }
  if (ctx.version === '5.5.1' && out.relationship === undefined) {
    fail('structure.missing-required', 'The 5.5.1 ASSO structure requires a RELA substructure', node.position);
  }
  return out;
}

export function parseRole(node: RawNode, ctx: Ctx): RoleStructure {
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
  if (raw.startsWith('(') && raw.endsWith(')')) {
    return { payload: 'OTHER', phrase: raw.slice(1, -1) };
  }
  fail('enum.invalid-value', `"${raw}" is not a permitted ROLE_IN_EVENT value`, node.position);
}

export function parseChangeDate(node: RawNode, ctx: Ctx): ChangeDate {
  noPayload(node);
  const base: Omit<ChangeDate, 'date'> = { tag: 'CHAN' };
  let date: DateExactStructure | undefined;
  const handlers: Record<string, (child: RawNode) => void> = {
    DATE: (child) => {
      date = parseDateExactStructure(child, ctx, true);
    },
    NOTE: (child) => {
      (base.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    '_WT_USER': (child) => {
      // webtrees: the user name of the user who made the change (see
      // ChangeDate.user).
      base.user = reqText(child);
    },
  };
  if (ctx.version === '7.0') {
    // The 7.0 CHANGE_DATE carries <<NOTE_STRUCTURE>> {0:M} (GEDCOM 7.0
    // §3.2.3); 5.5.1 stays strict.
    handlers['SNOTE'] = (child) => {
      (base.notes ??= []).push(parseNoteStructure(child, ctx));
    };
  }
  dispatch(node, base, handlers, ctx);
  if (date === undefined) {
    fail('structure.missing-required', 'The CHAN structure requires a DATE substructure', node.position);
  }
  return { ...base, date };
}

export function parseCreationDate(node: RawNode, ctx: Ctx): CreationDate {
  noPayload(node);
  let date: DateExactStructure | undefined;
  dispatch(
    node,
    {},
    {
      DATE: (child) => {
        date = parseDateExactStructure(child, ctx, true);
      },
    },
    ctx,
  );
  if (date === undefined) {
    fail('structure.missing-required', 'The CREA structure requires a DATE substructure', node.position);
  }
  return { tag: 'CREA', date };
}

/** Handlers for a `DATE {0:1}` + `<<SOURCE_CITATION>> {0:M}` pair (the GEDCOM-L place records). */
export function datedSourceHandlers(
  ctx: Ctx,
  target: { date?: DateStructure; citations?: SourceCitation[] },
): Record<string, (child: RawNode) => void> {
  return {
    DATE: (child) => {
      target.date = parseDateStructure(child, ctx);
    },
    SOUR: (child) => {
      (target.citations ??= []).push(parseSourceCitation(child, ctx));
    },
  };
}

/**
 * Applies a 5.5.1 DateValue parse result to a `{ value, phrase }` target:
 * a dual year keeps the raw text as the phrase when no explicit phrase
 * was present.
 */
function applyDateValue551(
  target: { value?: DateValue; phrase?: string },
  parsed: { value: DateValue; dualYear: boolean; phrase?: string },
  raw: string,
): void {
  target.value = parsed.value;
  const phrase = parsed.phrase ?? (parsed.dualYear ? raw : undefined);
  if (phrase !== undefined) {
    target.phrase = phrase;
  }
}

/** The SCHMA tag resolver of the document (see Ctx.schemaTags and
 *  `TagResolver` in types.ts): maps an extension tag to its URI. */
function tagResolver(ctx: Ctx): ((tag: string) => string | undefined) {
  return (tag) => ctx.schemaTags.get(tag);
}

export function parseDateStructure(node: RawNode, ctx: Ctx): DateStructure {
  const out: DateStructure = {};
  const raw = node.value.kind === 'text' ? node.value.text : undefined;
  if (ctx.version === '7.0') {
    out.value = raw === undefined ? { kind: 'unknown' } : parseDateValue70(raw, node.position, tagResolver(ctx));
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
  applyDateValue551(out, parseDateValue551(raw, node.position), raw);
  return out;
}

export function parseDateExactStructure(node: RawNode, ctx: Ctx, allowTime: boolean): DateExactStructure {
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
  if (value.kind !== 'date' || value.day === undefined || value.month === undefined || value.year === undefined) {
    fail('date.invalid', `Invalid ${ctx.version} DATE_EXACT "${raw}"; expected "<day> <month> <year>"`, node.position);
  }
  if (parsed.dualYear || parsed.phrase !== undefined) {
    fail('date.invalid', `Invalid ${ctx.version} DATE_EXACT "${raw}"`, node.position);
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

export function parseDatePeriodStructure(node: RawNode, ctx: Ctx): DatePeriodStructure {
  if (ctx.version === '7.0') {
    const raw = node.value.kind === 'text' ? node.value.text : undefined;
    const out: DatePeriodStructure = { value: raw === undefined ? { kind: 'period' } : parseDatePeriod70(raw, node.position, tagResolver(ctx)) };
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

export function parseSortDateStructure(node: RawNode, ctx: Ctx): SortDateStructure {
  const out: SortDateStructure = {};
  const raw = node.value.kind === 'text' ? node.value.text : undefined;
  if (raw !== undefined) {
    out.value = parseDateValue70(raw, node.position, tagResolver(ctx));
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

export function parseAge(node: RawNode, ctx: Ctx): AgeStructure {
  const raw = node.value.kind === 'text' ? node.value.text : undefined;
  const out: AgeStructure =
    raw === undefined || raw.trim() === ''
      ? // The empty age form (GEDCOM 7.0 §2.6 / 5.5.1 AGE_AT_EVENT):
        // no payload, optionally a PHRASE.
        {}
      : { payload: ctx.version === '7.0' ? parseAge70(raw, node.position) : parseAge551(raw, node.position) };
  dispatch(
    node,
    out,
    {
      PHRASE: (child) => {
        out.phrase = reqText(child);
      },
      '_AGER': (child) => {
        // The MagiKey age range "Integer-Integer" (MagiKey_AGER.yaml):
        // at least the first bound, less than the second.
        const text = reqText(child);
        if (!/^\d+-\d+$/.test(text)) {
          fail('age.invalid', `Invalid age range "${text}"; expected "<integer>-<integer>"`, child.position);
        }
        out.ageRange = text;
      },
    },
    ctx,
    ['PHRASE', '_AGER'],
  );
  return out;
}

export function parseReferenceIdentifier(node: RawNode, ctx: Ctx): ReferenceIdentifierStructure {
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

/** Parses a 5.5.1 `_SDATE` line into a SortDateStructure (same value format as DATE). */
export function parseSortDate551(node: RawNode): SortDateStructure {
  const out: SortDateStructure = {};
  const raw = node.value.kind === 'text' ? node.value.text : undefined;
  if (raw !== undefined) {
    applyDateValue551(out, parseDateValue551(raw, node.position), raw);
  }
  if (node.children.length > 0) {
    fail('structure.unknown-tag', `The tag ${(node.children[0] as RawNode).tag} is not allowed under _SDATE`, (node.children[0] as RawNode).position);
  }
  return out;
}

/** Parses a 5.5.1 `_SHAR @xref@` line with an optional `_ROLE` (or `ROLE`) descriptor into an AssociationStructure. */
/**
 * The Gramps witness convention: a standard `ASSO @xref@` under a 5.5.1
 * family event with a `TYPE INDI` marker and a free-text `RELA` (or
 * `ROLE`) role. Normalized into the ASSOCIATION_STRUCTURE like `_SHAR`.
 */
export function parseGrampsAssociation(node: RawNode, ctx: Ctx): AssociationStructure {
  const out: AssociationStructure = { tag: 'ASSO', individual: reqPtr(node, ctx) };
  let roleSeen = false;
  const setRole = (child: RawNode): void => {
    if (roleSeen) {
      fail('structure.cardinality', 'At most one role is allowed under ASSO', child.position);
    }
    roleSeen = true;
    out.role = { payload: 'OTHER', phrase: reqText(child) };
  };
  dispatch(
    node,
    out,
    {
      TYPE: () => undefined,
      RELA: setRole,
      ROLE: setRole,
      '_ROLE': setRole,
      PHRASE: (child) => {
        out.phrase = reqText(child);
      },
    },
    ctx,
  );
  return out;
}

export function parseSharedParticipant(node: RawNode, ctx: Ctx): AssociationStructure {
  const out: AssociationStructure = { tag: 'ASSO', individual: reqPtr(node, ctx) };
  let roleSeen = false;
  const setRole = (child: RawNode): void => {
    if (roleSeen) {
      fail('structure.cardinality', 'At most one role is allowed under _SHAR', child.position);
    }
    roleSeen = true;
    out.role = { payload: 'OTHER', phrase: reqText(child) };
  };
  dispatch(
    node,
    out,
    {
      '_ROLE': setRole,
      ROLE: setRole,
    },
    ctx,
  );
  return out;
}

export function parseUniqueIdentifier(node: RawNode): UniqueIdentifierStructure {
  const out: UniqueIdentifierStructure = { tag: 'UID', payload: reqText(node) };
  if (node.children.length > 0) {
    fail('structure.unknown-tag', `The tag ${(node.children[0] as RawNode).tag} is not allowed under UID`, (node.children[0] as RawNode).position);
  }
  return out;
}

export function parseExternalIdentifier(node: RawNode, ctx: Ctx): ExternalIdentifierStructure {
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

export function parseNonEvent(node: RawNode, ctx: Ctx): NonEventStructure {
  const out: NonEventStructure = {
    tag: 'NO',
    payload: parseEnum(reqText(node), EVENT_ENUM_VALUES, '7.0', node.position),
  };
  const handlers: Record<string, (child: RawNode) => void> = {
    DATE: (child) => {
      out.date = parseDatePeriodStructure(child, ctx);
    },
    NOTE: (child) => {
      (out.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    SNOTE: (child) => {
      // 7.0: the NON_EVENT_STRUCTURE carries <<NOTE_STRUCTURE>> {0:M},
      // so the shared-note pointer form is legal (GEDCOM 7.0 §3.2.3).
      (out.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    SOUR: (child) => {
      (out.citations ??= []).push(parseSourceCitation(child, ctx));
    },
  };
  dispatch(node, out, handlers, ctx);
  return out;
}

export function parseNoteStructure(node: RawNode, ctx: Ctx): NoteStructure {
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
    // GEDCOM 5.5.1 §2 (p.37): the pointer form may carry SOUR {0:M}
    // lines — each a bare pointer to a source record ("SOURce tags
    // subordinate to the note structure can only contain a pointer to
    // an associated source record"), no substructures of their own.
    const out: NoteReference = { tag: 'NOTE', note: resolvePtr(node.value.pointer, ctx, node) };
    dispatch(
      node,
      out,
      {
        SOUR: (child) => {
          const source = reqPtr(child, ctx);
          if (child.children.length > 0) {
            fail('structure.unknown-tag', `The tag ${(child.children[0] as RawNode).tag} is not allowed under the NOTE SOUR pointer`, (child.children[0] as RawNode).position);
          }
          (out.citations ??= []).push({ tag: 'SOUR', source });
        },
      },
      ctx,
    );
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
      '_PRIV': (child) => {
        // The note privacy flag: WinFamily's NOTP normalizes into this
        // (see Note.private); the wire spelling under a note is _PRIV.
        out.private = parsePrivacyFlag(child, '_PRIV');
      },
      SOUR: (child) => {
        (out.citations ??= []).push(parseSourceCitation(child, ctx));
      },
    },
    ctx,
  );
  return out;
}

export function parseNoteTranslation(node: RawNode, ctx: Ctx): NoteTranslation {
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
