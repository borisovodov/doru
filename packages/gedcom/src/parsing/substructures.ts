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
  UniqueIdentifierStructure,
} from '../structures';
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
  parseSourceCitation,
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
  if (raw.startsWith('(') && raw.endsWith(')') && raw.length >= 2) {
    return { payload: 'OTHER', phrase: raw.slice(1, -1) };
  }
  fail('enum.invalid-value', `"${raw}" is not a permitted ROLE_IN_EVENT value`, node.position);
}

export function parseChangeDate(node: RawNode, ctx: Ctx): ChangeDate {
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

export function parseCreationDate(node: RawNode, ctx: Ctx): CreationDate {
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

export function parseDateStructure(node: RawNode, ctx: Ctx): DateStructure {
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

export function parseDatePeriodStructure(node: RawNode, ctx: Ctx): DatePeriodStructure {
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

export function parseSortDateStructure(node: RawNode, ctx: Ctx): SortDateStructure {
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

export function parseAge(node: RawNode, ctx: Ctx): AgeStructure {
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

/**
 * GEDCOM 5.5.1 vendor extension `_SDATE` — a sort date with the same
 * value format as DATE. Normalized into the 7.0 SortDateStructure; see
 * the JSDoc of EventDetail.sortDate for the serialization rules.
 */
export function parseSortDate551(node: RawNode): SortDateStructure {
  const out: SortDateStructure = {};
  const raw = node.value.kind === 'text' ? node.value.text : undefined;
  if (raw !== undefined) {
    const parsed = parseDateValue551(raw, node.position);
    out.value = parsed.value;
    const phrase = parsed.phrase ?? (parsed.dualYear ? raw : undefined);
    if (phrase !== undefined) {
      out.phrase = phrase;
    }
  }
  if (node.children.length > 0) {
    fail('structure.unknown-tag', `The tag ${(node.children[0] as RawNode).tag} is not allowed under _SDATE`, (node.children[0] as RawNode).position);
  }
  return out;
}

/**
 * GEDCOM 5.5.1 vendor extension `_SHAR @xref@` with an optional `_ROLE`
 * (or `ROLE`) descriptor: a co-participant of an event. Normalized into
 * the 7.0 ASSOCIATION_STRUCTURE with the free-text descriptor kept as
 * ROLE OTHER + PHRASE. See the JSDoc of EventDetail.associations for
 * the serialization rules.
 */
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
