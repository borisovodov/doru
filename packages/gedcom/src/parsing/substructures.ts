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
  addExtension,
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
  parseYNFlag,
} from './sources-media';
import {
  parsePlaceStructure,
} from './names-places';
import {
  parseAge,
  parseDatePeriod70,
  parseDateValue,
  parseEnum,
  parseTime70,
  type TagResolver,
} from './types';

// Substructures
// ---------------------------------------------------------------------------

export function parseAddressStructure(node: RawNode, ctx: Ctx): AddressStructure {
  // The ADDR payload is required in 5.5.1 ({1:1}, split across CONT
  // lines) and forbidden in 5.5.5 ("must not have a line value", the
  // structured ADR1–CTRY form) — both parse; the payload is absent in
  // the 5.5.5 form.
  const out: AddressStructure =
    node.value.kind === 'text' ? { payload: node.value.text } : {};
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
    PHON: (child) => {
      // The 5.5.1/5.5.5 ADDRESS_STRUCTURE position of the contacts:
      // siblings of ADR1–CTRY (GEDCOM 5.5.1 §2 p.31); the 7.0 grammar
      // places them beside ADDR, and the two positions are accepted
      // positions in any file.
      (out.phone ??= []).push(reqText(child));
    },
    EMAIL: (child) => {
      (out.email ??= []).push(reqText(child));
    },
    FAX: (child) => {
      (out.fax ??= []).push(reqText(child));
    },
    WWW: (child) => {
      (out.www ??= []).push(reqText(child));
    },
    URL: (child) => {
      // PAF writes the web address with the URL tag; GEDCOM 5.5.5
      // recommends readers "Accept URL as a synonym for WWW" (5.5.5
      // §2 p.65). Normalized into the standard www slot.
      (out.www ??= []).push(reqText(child));
    },
    NOTE: (child) => {
      // The standard 5.5.1 ADDRESS_STRUCTURE note slot (see
      // AddressStructure.notes).
      (out.notes ??= []).push(parseNoteStructure(child, ctx));
    },
  };
  dispatch(node, out, handlers, ctx, ['ADR1', 'ADR2', 'ADR3', 'CITY', 'STAE', 'POST', 'CTRY']);
  return out;
}

export function parseAssociation(node: RawNode, ctx: Ctx): AssociationStructure {
  const out: AssociationStructure = { tag: 'ASSO', individual: reqPtr(node, ctx) };
  const setRole = (child: RawNode): void => {
    // The Gramps `_ROLE` spelling: a free-text descriptor, kept as an
    // OTHER role with the phrase.
    out.role = { payload: 'OTHER', phrase: reqText(child) };
  };
  const handlers: Record<string, (child: RawNode) => void> = {
    PHRASE: (child) => {
      out.phrase = reqText(child);
    },
    ROLE: (child) => {
      out.role = parseRole(child, ctx);
    },
    RELA: (child) => {
      out.role = { payload: 'OTHER', phrase: reqText(child) };
    },
    '_ROLE': setRole,
    // The Gramps `TYPE INDI` marker carries no model data.
    TYPE: () => undefined,
    NOTE: (child) => {
      (out.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    QUOT: (child) => {
      // A quotation attached to the association (novel/game character
      // trees): kept as an inline NOTE.
      (out.notes ??= []).push({ tag: 'NOTE', payload: reqText(child) });
    },
    SOUR: (child) => {
      (out.citations ??= []).push(parseSourceCitation(child, ctx));
    },
    // The 7.0 ASSOCIATION_STRUCTURE carries <<NOTE_STRUCTURE>> {0:M}
    // (GEDCOM 7.0 §3.2.3); accepted in any file.
    SNOTE: (child) => {
      (out.notes ??= []).push(parseNoteStructure(child, ctx));
    },
  };
  dispatch(node, out, handlers, ctx, ['PHRASE', 'ROLE', 'RELA']);
  return out;
}

export function parseRole(node: RawNode, ctx: Ctx): RoleStructure {
  const raw = reqText(node);
  // Both value forms parse: the 7.0 ROLE enum (with the PHRASE child and
  // the `_` extension values), the 5.5.1 ROLE_IN_EVENT values (the six
  // tags, case-insensitive), a parenthesized descriptor, and a bare
  // free-text descriptor — the last two normalize to OTHER + phrase.
  const upper = raw.toUpperCase();
  if (raw in ROLE_ENUM_VALUES || raw.startsWith('_')) {
    const out: RoleStructure = { payload: raw as RoleStructure['payload'] };
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
  if (upper === 'CHIL' || upper === 'HUSB' || upper === 'WIFE' || upper === 'MOTH' || upper === 'FATH' || upper === 'SPOU') {
    const out: RoleStructure = { payload: upper as 'CHIL' | 'HUSB' | 'WIFE' | 'MOTH' | 'FATH' | 'SPOU' };
    for (const child of node.children) {
      // Full leniency: unexpected children stay generic extensions.
      addExtension(out, child, ctx);
    }
    return out;
  }
  // A parenthesized descriptor or the Gramps-style bare descriptor:
  // OTHER + phrase; a PHRASE child overrides the descriptor.
  const out: RoleStructure = {
    payload: 'OTHER',
    phrase: raw.startsWith('(') && raw.endsWith(')') ? raw.slice(1, -1) : raw,
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

export function parseChangeDate(node: RawNode, ctx: Ctx): ChangeDate {
  noPayload(node);
  const base: Omit<ChangeDate, 'date'> = { tag: 'CHAN' };
  let date: DateExactStructure | undefined;
  const handlers: Record<string, (child: RawNode) => void> = {
    DATE: (child) => {
      date = parseDateExactStructure(child, ctx);
    },
    NOTE: (child) => {
      (base.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    SOUR: (child) => {
      // Citations under the CHAN block (see ChangeDate.citations).
      (base.citations ??= []).push(parseSourceCitation(child, ctx));
    },
    '_WT_USER': (child) => {
      // webtrees: the user name of the user who made the change (see
      // ChangeDate.user).
      base.user = reqText(child);
    },
    '_PGVU': (child) => {
      // phpGedView: the same slot webtrees spells `_WT_USER` (the
      // webtrees per-vendor custom-tag registry, PhpGedView.php; see
      // ChangeDate.user).
      base.user = reqText(child);
    },
    // The 7.0 CHANGE_DATE carries <<NOTE_STRUCTURE>> {0:M} (GEDCOM 7.0
    // §3.2.3); accepted in any file.
    SNOTE: (child) => {
      (base.notes ??= []).push(parseNoteStructure(child, ctx));
    },
  };
  dispatch(node, base, handlers, ctx);
  if (date === undefined) {
    fail('structure.missing-required', 'The CHAN structure requires a DATE substructure', node.position);
  }
  return { ...base, date };
}

export function parseCreationDate(node: RawNode, ctx: Ctx): CreationDate {
  noPayload(node);
  const out: Omit<CreationDate, 'date'> = { tag: 'CREA' };
  let date: DateExactStructure | undefined;
  dispatch(
    node,
    out,
    {
      DATE: (child) => {
        date = parseDateExactStructure(child, ctx);
      },
    },
    ctx,
  );
  if (date === undefined) {
    fail('structure.missing-required', 'The CREA structure requires a DATE substructure', node.position);
  }
  return { ...out, date };
}

/**
 * The lenient CREA: the standard payload-less form parses as the
 * creation date; the MFT7 payload form (`1 CREA <date text>` — the
 * non-underscore spelling in LEGACY_GENERIC_TAGS) stays a generic
 * extension of the record instead of failing the import.
 */
export function parseCreationDateLenient(node: RawNode, ctx: Ctx): CreationDate | undefined {
  if (node.value.kind !== 'absent') {
    return undefined;
  }
  return parseCreationDate(node, ctx);
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
 *  `TagResolver` in types.ts): maps an extension tag to its URIs. */
function tagResolver(ctx: Ctx): TagResolver {
  return (tag) => ctx.schemaTags.get(tag);
}

export function parseDateStructure(node: RawNode, ctx: Ctx): DateStructure {
  const out: DateStructure = {};
  const raw = node.value.kind === 'text' ? node.value.text : undefined;
  // Both forms parse (see parseDateValue): a bare DATE line is
  // the empty date form (7.0), and the 5.5.1 forms (INT, dual years,
  // calendar escapes) parse alongside the 7.0 forms.
  if (raw === undefined) {
    out.value = { kind: 'unknown' };
  } else {
    try {
      applyDateValue551(out, parseDateValue(raw, node.position, tagResolver(ctx)), raw);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== undefined && code.startsWith('date.')) {
        // An unparseable date is kept whole as the phrase (the
        // full-leniency container rule — nothing is dropped).
        out.value = { kind: 'unknown' };
        out.phrase = raw;
      } else {
        throw error;
      }
    }
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
      SOUR: (child) => {
        // TMG: citations attached to the DATE line (see
        // DateStructure.citations).
        (out.citations ??= []).push(parseSourceCitation(child, ctx));
      },
    },
    ctx,
    ['TIME', 'PHRASE'],
  );
  return out;
}

export function parseDateExactStructure(node: RawNode, ctx: Ctx): DateExactStructure {
  const raw = reqText(node);
  // The ISO-8601 timestamp form (`2022-08-24T12:26:24.532Z`, the
  // geneafinder exports write it as the CHAN.DATE value): the date
  // part becomes the DateExact value and the time part the TimeValue
  // (the fraction and the Z survive). Out-of-range components fall
  // through to the normal parser, which reports them.
  const iso = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?(Z)?$/.exec(raw.trim());
  if (iso !== null) {
    const month = (['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const)[Number(iso[2]) - 1];
    const day = Number(iso[3]);
    const hour = Number(iso[4]);
    const minute = Number(iso[5]);
    const second = iso[6] === undefined ? undefined : Number(iso[6]);
    if (
      month !== undefined &&
      day >= 1 && day <= 31 &&
      hour >= 0 && hour <= 23 &&
      minute >= 0 && minute <= 59 &&
      (second === undefined || (second >= 0 && second <= 59))
    ) {
      const out: DateExactStructure = {
        value: {
          day,
          month,
          year: Number(iso[1]),
        },
        time: {
          hour,
          minute,
          ...(second === undefined ? {} : { second }),
          ...(iso[7] === undefined ? {} : { fraction: iso[7] }),
          ...(iso[8] === undefined ? {} : { utc: true }),
        },
      };
      return out;
    }
  }
  const parsed = parseDateValue(raw, node.position, tagResolver(ctx));
  const value = parsed.value;
  if (value.kind === 'date' && value.year !== undefined && value.month !== undefined && value.day !== undefined) {
    const out: DateExactStructure = {
      value: {
        day: value.day,
        month: value.month as 'JAN' | 'FEB' | 'MAR' | 'APR' | 'MAY' | 'JUN' | 'JUL' | 'AUG' | 'SEP' | 'OCT' | 'NOV' | 'DEC',
        year: value.year,
        ...(value.epoch === undefined ? {} : { epoch: value.epoch }),
      },
    };
    const timeNode = one(node, 'TIME');
    if (timeNode !== undefined) {
      out.time = parseTime70(reqText(timeNode), timeNode.position);
    }
    return out;
  }
  if (parsed.dualYear || parsed.phrase !== undefined) {
    fail('date.invalid', `Invalid DATE_EXACT "${raw}"`, node.position);
  }
  // A year-only (or month+year, or month-only) exact date: tolerated
  // with the absent components unset (the full-leniency container
  // rule — real files write year-only CHANGE_DATEs).
  const out: DateExactStructure = {
    value: {
      ...(value.kind === 'date' && value.year !== undefined ? { year: value.year } : {}),
      ...(value.kind === 'date' && value.month !== undefined
        ? { month: value.month as 'JAN' | 'FEB' | 'MAR' | 'APR' | 'MAY' | 'JUN' | 'JUL' | 'AUG' | 'SEP' | 'OCT' | 'NOV' | 'DEC' }
        : {}),
      ...(value.kind === 'date' && value.day !== undefined ? { day: value.day } : {}),
      ...(value.kind === 'date' && value.epoch !== undefined ? { epoch: value.epoch } : {}),
    },
  };
  const timeNode = one(node, 'TIME');
  if (timeNode !== undefined) {
    out.time = parseTime70(reqText(timeNode), timeNode.position);
  }
  return out;
}

export function parseDatePeriodStructure(node: RawNode, ctx: Ctx): DatePeriodStructure {
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

export function parseSortDateStructure(node: RawNode, ctx: Ctx): SortDateStructure {
  const out: SortDateStructure = {};
  const raw = node.value.kind === 'text' ? node.value.text : undefined;
  if (raw !== undefined) {
    applyDateValue551(out, parseDateValue(raw, node.position, tagResolver(ctx)), raw);
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

export function parseAgeStructure(
  node: RawNode,
  ctx: Ctx,
  extra?: Record<string, (child: RawNode) => void>,
): AgeStructure {
  const raw = node.value.kind === 'text' ? node.value.text : undefined;
  const out: AgeStructure =
    raw === undefined || raw.trim() === ''
      ? // The empty age form (GEDCOM 7.0 §2.6 / 5.5.1 AGE_AT_EVENT):
        // no payload, optionally a PHRASE.
        {}
      : (() => {
          // The lenient age forms real files carry (the full-leniency
          // container rule — nothing is dropped):
          // - `29-30` (an age range): the lower bound becomes the
          //   years, the raw range is kept in the MagiKey `_AGER`
          //   slot;
          // - `84v` (a number with a stray letter): the number is the
          //   years;
          // - an otherwise unparseable value (a stray word): the
          //   empty age form.
          const trimmed = raw.trim();
          const range = /^(\d+)-(\d+)$/.exec(trimmed);
          if (range !== null) {
            return { payload: { years: Number(range[1]) }, ageRange: `${range[1]}-${range[2]}` };
          }
          const bare = /^(\d+)([A-Za-z])?$/.exec(trimmed);
          if (bare !== null && (bare[2] === undefined || !'ymwd'.includes((bare[2] as string).toLowerCase()))) {
            return { payload: { years: Number(bare[1]) } };
          }
          try {
            return { payload: parseAge(trimmed, node.position) };
          } catch (error) {
            if ((error as { code?: string }).code === 'age.invalid') {
              return {};
            }
            throw error;
          }
        })();
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
        const [low, high] = text.split('-').map((part) => Number(part)) as [number, number];
        if (low >= high) {
          fail('age.invalid', `Invalid age range "${text}"; the range is at least the first bound and less than the second, so the first bound must be lower`, child.position);
        }
        out.ageRange = text;
      },
      // An extension-defined substructure of a standard AGE (e.g. the
      // MagiKey census AGE's NCHI, MagiKey_CENR_SEX_AGE.yaml): the
      // caller supplies the handler.
      ...(extra ?? {}),
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

/** Parses a 5.5.1 `_SDATE` line into a SortDateStructure (the same
 *  date value grammar as DATE). */
export function parseSortDate551(node: RawNode, ctx: Ctx): SortDateStructure {
  const out: SortDateStructure = {};
  const raw = node.value.kind === 'text' ? node.value.text : undefined;
  if (raw !== undefined) {
    applyDateValue551(out, parseDateValue(raw, node.position), raw);
  }
  for (const child of node.children) {
    // Full leniency: unexpected children stay generic extensions.
    addExtension(out, child, ctx);
  }
  return out;
}

/** Parses a 5.5.1 `_SHAR @xref@` line with an optional `_ROLE` (or `ROLE`) descriptor into an AssociationStructure. */
export function parseSharedParticipant(node: RawNode, ctx: Ctx): AssociationStructure {
  const out: AssociationStructure = { tag: 'ASSO', individual: reqPtr(node, ctx) };
  let roleSeen = false;
  const setRole = (child: RawNode): void => {
    if (roleSeen) {
      // First occurrence wins (the full-leniency container rule).
      return;
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
      '_PRIM': (child) => {
        // TMG: the "Primary Indicator Tag" under a shared event — the
        // event is primary for this co-participant (see
        // AssociationStructure.primary).
        out.primary = parseYNFlag(child, '_PRIM');
      },
    },
    ctx,
  );
  return out;
}

export function parseUniqueIdentifier(node: RawNode, ctx: Ctx): UniqueIdentifierStructure {
  const out: UniqueIdentifierStructure = { tag: 'UID', payload: reqText(node) };
  for (const child of node.children) {
    // Full leniency: unexpected children stay generic extensions.
    addExtension(out, child, ctx);
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
    payload: parseEnum(reqText(node), EVENT_ENUM_VALUES, node.position),
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
    for (const child of node.children) {
      // Full leniency: unexpected children stay generic extensions.
      addExtension(out, child, ctx);
    }
    return out;
  }
  if (node.tag !== 'NOTE') {
    // An internal-contract guard, not a leniency target: callers must
    // only pass NOTE/SNOTE nodes here.
    fail('structure.unknown-tag', `Unknown note structure tag ${node.tag}`, node.position);
  }
  if (node.value.kind === 'pointer') {
    // The pointer form (GEDCOM 5.5.1 §2 p.37): may carry SOUR {0:M}
    // lines — each a bare pointer to a source record ("SOURce tags
    // subordinate to the note structure can only contain a pointer to
    // an associated source record"), no substructures of their own.
    if (ctx.xrefs.has(node.value.pointer)) {
      const out: NoteReference = { tag: 'NOTE', note: resolvePtr(node.value.pointer, ctx, node) };
      dispatch(
        node,
        out,
        {
          SOUR: (child) => {
            const source = reqPtr(child, ctx);
            for (const grandchild of child.children) {
              // Full leniency: unexpected children under the NOTE SOUR
              // pointer stay generic extensions.
              addExtension(out, grandchild, ctx);
            }
            (out.citations ??= []).push({ tag: 'SOUR', source });
          },
        },
        ctx,
      );
      return out;
    }
    // A pointer-shaped value with no matching record: the raw text is
    // kept as the note payload instead of failing the import (a 7.0
    // file writing a literal `@…@` should double the at sign; real
    // files break the rule, and the raw text round-trips verbatim).
  }
  // The inline note (the pointer form is handled above): the payload is
  // the note text, the raw pointer text of a dangling pointer, or the
  // empty string for a payload-less line.
  const raw = node.value.kind === 'text' ? node.value.text : undefined;
  const out: Note = { tag: 'NOTE', payload: raw ?? (node.value.kind === 'pointer' ? node.value.pointer : '') };
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
      DATE: (child) => {
        // TMG: the date the note was recorded, under the note itself
        // (see Note.date).
        out.date = parseDateStructure(child, ctx);
      },
      PLAC: (child) => {
        // TMG: the place associated with the note, under the note
        // itself (see Note.place).
        out.place = parsePlaceStructure(child, ctx);
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
  // A TRAN without a MIME/LANG substructure (the maximal70 test files
  // write `2 TRAN British English` bare) keeps the translation text
  // alone — the payload is the data, the kind declaration is not (the
  // full-leniency container rule).
  return out;
}

// ---------------------------------------------------------------------------
