/**
 * Parser section: the MagiKey `_CENR` census record.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). The census record is the
 * MagiKey extension registered in the FamilySearch GEDCOM registry
 * (structure/extension/MagiKey_record_CENR.yaml and the MagiKey tag
 * pages under https://armidalesoftware.com/issue/tags/).
 */

import type {
  SexEnum,
} from '../enumerations';
import {
  fail,
} from '../errors';
import type {
  AgeStructure,
  CensusIndividual,
  CensusRecord,
  CensusRelative,
  CensusRelocatedAttribute,
  CensusRelocatedEvent,
  CensusSexStructure,
  CensusSourceReference,
  DateStructure,
  EventDetail,
  RoleStructure,
} from '../structures';
import type {
  Text,
} from '../primitives';
import type {
  Ctx,
} from './context';
import {
  addExtension,
  dispatch,
  noPayload,
  reqDigits,
  reqPtr,
  reqText,
  resolvePtr,
  yFlag,
} from './context';
import type {
  RawNode,
} from './lines';
import {
  parsePersonalNameStructure,
} from './names-places';
import {
  eventDetailHandlers,
  merge551DetailContacts,
  SEX_551,
} from './events';
import {
  parseAgeStructure,
  parseChangeDate,
  parseDateStructure,
} from './substructures';
import {
  parseEnum,
} from './types';

// MagiKey census record
// ---------------------------------------------------------------------------

export function parseCensusRecord(node: RawNode, ctx: Ctx): CensusRecord {
  noPayload(node);
  const out: Omit<CensusRecord, 'date' | 'place' | 'entries'> = {
    tag: '_CENR',
    ...(node.xref === undefined ? {} : { xref: node.xref }),
  };
  let date: DateStructure | undefined;
  let place: Text | undefined;
  let entries: CensusIndividual[] | undefined;
  dispatch(
    node,
    out,
    {
      '_SCHD': (child) => {
        out.schedule = reqText(child);
      },
      'SEX': (child) => {
        (out.sexes ??= []).push(parseCensusSex(child, ctx));
      },
      'INDI': (child) => {
        (entries ??= []).push(parseCensusIndividual(child, ctx));
      },
      'DATE': (child) => {
        date = parseDateStructure(child, ctx);
      },
      'PLAC': (child) => {
        place = reqText(child);
      },
      'SOUR': (child) => {
        out.source = parseCensusSource(child, ctx);
      },
      'CHAN': (child) => {
        out.changeDate = parseChangeDate(child, ctx);
      },
    },
    ctx,
    ['_SCHD', 'DATE', 'PLAC', 'SOUR', 'CHAN'],
  );
  if (date === undefined) {
    fail('structure.missing-required', 'The _CENR record requires a DATE substructure', node.position);
  }
  if (place === undefined) {
    fail('structure.missing-required', 'The _CENR record requires a PLAC substructure', node.position);
  }
  if (entries === undefined || entries.length === 0) {
    fail('structure.missing-required', 'The _CENR record requires at least one INDI substructure', node.position);
  }
  return { ...out, date, place, entries };
}

function parseCensusSex(node: RawNode, ctx: Ctx): CensusSexStructure {
  const out: Omit<CensusSexStructure, 'age'> = { tag: 'SEX', payload: reqText(node) };
  let age: AgeStructure | undefined;
  dispatch(
    node,
    out,
    {
      AGE: (child) => {
        // The census AGE is the standard AGE tag with
        // extension-defined substructures (registry:
        // MagiKey_CENR_SEX_AGE.yaml): `_AGER` (kept in the age's
        // ageRange) and NCHI — the count of individuals in the age
        // range, typed as `count`. Real MagiKey files sometimes omit
        // the NCHI, so it stays optional here.
        let count: number | undefined;
        age = parseAgeStructure(child, ctx, {
          NCHI: (grandchild) => {
            count = reqDigits(grandchild);
          },
        });
        if (count !== undefined) {
          out.count = count;
        }
      },
      TYPE: (child) => {
        out.type = reqText(child);
      },
    },
    ctx,
    ['AGE', 'TYPE'],
  );
  if (age === undefined) {
    fail('structure.missing-required', 'The SEX structure under _CENR requires an AGE substructure', node.position);
  }
  return { ...out, age };
}

function parseCensusIndividual(node: RawNode, ctx: Ctx): CensusIndividual {
  const out: CensusIndividual = { tag: 'INDI', individual: reqPtr(node, ctx) };
  dispatch(
    node,
    out,
    {
      FATH: (child) => {
        out.father = parseCensusRelative(child, ctx, 'FATH');
      },
      MOTH: (child) => {
        out.mother = parseCensusRelative(child, ctx, 'MOTH');
      },
      '_MSTAT': (child) => {
        out.maritalStatus = reqText(child);
      },
      AGE: (child) => {
        out.age = parseAgeStructure(child, ctx);
      },
      BIRT: (child) => {
        out.birth = parseCensusRelocatedEvent(child, ctx, 'BIRT');
      },
      FACT: (child) => {
        (out.facts ??= []).push(parseCensusRelocatedAttribute(child, ctx, 'FACT'));
      },
      NAME: (child) => {
        out.name = parsePersonalNameStructure(child, ctx);
      },
      OCCU: (child) => {
        out.occupation = parseCensusRelocatedAttribute(child, ctx, 'OCCU');
      },
      ROLE: (child) => {
        out.role = parseCensusRole(child, ctx);
      },
      SEX: (child) => {
        out.sex = parseCensusSexValue(child, ctx);
      },
    },
    ctx,
    ['FATH', 'MOTH', '_MSTAT', 'AGE', 'BIRT', 'NAME', 'OCCU', 'ROLE', 'SEX'],
  );
  return out;
}

/**
 * The census INDI's SEX: the registry (MagiKey_CENR_INDI.yaml) wires it
 * to the standard SEX structure, so it is typed like the INDI SEX —
 * the full value set, case-insensitive on input and canonicalized
 * (`m` → `male`).
 */
function parseCensusSexValue(node: RawNode, _ctx: Ctx): SexEnum {
  const table = SEX_551 as Readonly<
    Record<'M' | 'F' | 'U' | 'X' | 'N', string>
  >;
  return parseEnum(reqText(node), table, node.position) as SexEnum;
}

/**
 * The census INDI's ROLE: the registry (MagiKey_CENR_INDI.yaml) wires
 * it to the v5.5.1 ROLE structure, whose ROLE_IN_EVENT grammar is one
 * of the six tags or a parenthesized descriptor — in both document
 * versions. Real MagiKey files also write bare descriptors (`Head`),
 * which are normalized to OTHER with the text kept in the phrase (the
 * write-back spells them parenthesized). Documented leniency, like the
 * standard 5.5.1 ROLE.
 */
function parseCensusRole(node: RawNode, ctx: Ctx): RoleStructure {
  const raw = reqText(node);
  const upper = raw.toUpperCase();
  const out: RoleStructure =
    upper === 'CHIL' || upper === 'HUSB' || upper === 'WIFE' || upper === 'MOTH' || upper === 'FATH' || upper === 'SPOU'
      ? { payload: upper as 'CHIL' | 'HUSB' | 'WIFE' | 'MOTH' | 'FATH' | 'SPOU' }
      : raw.startsWith('(') && raw.endsWith(')')
        ? { payload: 'OTHER', phrase: raw.slice(1, -1) }
        : // The lenient bare-descriptor form of real MagiKey files (`Head`).
          { payload: 'OTHER', phrase: raw };
  for (const child of node.children) {
    // Full leniency: unexpected children stay generic extensions.
    addExtension(out, child, ctx);
  }
  return out;
}

function parseCensusRelative(node: RawNode, ctx: Ctx, tag: 'FATH' | 'MOTH'): CensusRelative {
  noPayload(node);
  const out: CensusRelative = { tag };
  dispatch(
    node,
    out,
    {
      AGE: (child) => {
        out.age = parseAgeStructure(child, ctx);
      },
      BIRT: (child) => {
        out.birth = parseCensusRelocatedEvent(child, ctx, 'BIRT');
      },
      FACT: (child) => {
        out.fact = parseCensusRelocatedAttribute(child, ctx, 'FACT');
      },
      MARR: (child) => {
        out.marriage = parseCensusRelocatedEvent(child, ctx, 'MARR');
      },
      OCCU: (child) => {
        out.occupation = parseCensusRelocatedAttribute(child, ctx, 'OCCU');
      },
    },
    ctx,
    ['AGE', 'BIRT', 'FACT', 'MARR', 'OCCU'],
  );
  return out;
}

function parseCensusRelocatedEvent(node: RawNode, ctx: Ctx, tag: 'BIRT' | 'MARR'): CensusRelocatedEvent {
  const payload = yFlag(node);
  const detail: EventDetail = {};
  const out: CensusRelocatedEvent = { tag, ...(payload === undefined ? {} : { payload }), detail };
  dispatch(node, out, eventDetailHandlers(ctx, detail), ctx);
  merge551DetailContacts(detail);
  if (Object.keys(detail).length === 0) {
    delete out.detail;
  }
  return out;
}

function parseCensusRelocatedAttribute(node: RawNode, ctx: Ctx, tag: 'FACT' | 'OCCU'): CensusRelocatedAttribute {
  const raw = node.value.kind === 'text' ? node.value.text : undefined;
  const detail: EventDetail = {};
  const out: CensusRelocatedAttribute = { tag, ...(raw === undefined ? {} : { payload: raw }), detail };
  dispatch(node, out, eventDetailHandlers(ctx, detail), ctx);
  merge551DetailContacts(detail);
  if (Object.keys(detail).length === 0) {
    delete out.detail;
  }
  return out;
}

function parseCensusSource(node: RawNode, ctx: Ctx): CensusSourceReference {
  const out: CensusSourceReference = {};
  if (node.value.kind === 'pointer') {
    out.source = resolvePtr(node.value.pointer, ctx, node);
  } else if (node.value.kind === 'text') {
    out.description = node.value.text;
  } else {
    fail('structure.missing-payload', 'The SOUR line under _CENR requires a pointer or a source description', node.position);
  }
  dispatch(node, out, {}, ctx);
  return out;
}
