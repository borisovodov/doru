/**
 * Parser section: the MagiKey `_CENR` census record.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). The census record is the
 * MagiKey extension registered in the FamilySearch GEDCOM registry
 * (structure/extension/MagiKey_record_CENR.yaml and the MagiKey tag
 * pages under https://armidalesoftware.com/issue/tags/).
 */

import {
  fail,
} from '../errors';
import type {
  CensusIndividual,
  CensusRecord,
  CensusRelative,
  CensusRelocatedAttribute,
  CensusRelocatedEvent,
  CensusSexStructure,
  CensusSourceReference,
  EventDetail,
} from '../structures';
import type {
  Ctx,
} from './context';
import {
  dispatch,
  noPayload,
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
} from './events';
import {
  parseAge,
  parseChangeDate,
  parseDateStructure,
} from './substructures';

// MagiKey census record
// ---------------------------------------------------------------------------

export function parseCensusRecord(node: RawNode, ctx: Ctx): CensusRecord {
  noPayload(node);
  const rec: CensusRecord = {
    tag: '_CENR',
    date: null as unknown as CensusRecord['date'],
    place: null as unknown as CensusRecord['place'],
    entries: null as unknown as CensusRecord['entries'],
    ...(node.xref === undefined ? {} : { xref: node.xref }),
  };
  dispatch(
    node,
    rec,
    {
      '_SCHD': (child) => {
        rec.schedule = reqText(child);
      },
      'SEX': (child) => {
        (rec.sexes ??= []).push(parseCensusSex(child, ctx));
      },
      'INDI': (child) => {
        (rec.entries ??= []).push(parseCensusIndividual(child, ctx));
      },
      'DATE': (child) => {
        rec.date = parseDateStructure(child, ctx);
      },
      'PLAC': (child) => {
        rec.place = reqText(child);
      },
      'SOUR': (child) => {
        rec.source = parseCensusSource(child, ctx);
      },
      'CHAN': (child) => {
        rec.changeDate = parseChangeDate(child, ctx);
      },
    },
    ctx,
    ['_SCHD', 'DATE', 'PLAC', 'SOUR', 'CHAN'],
  );
  if (rec.date === null) {
    fail('structure.missing-required', 'The _CENR record requires a DATE substructure', node.position);
  }
  if (rec.place === null) {
    fail('structure.missing-required', 'The _CENR record requires a PLAC substructure', node.position);
  }
  if (rec.entries === null || rec.entries.length === 0) {
    fail('structure.missing-required', 'The _CENR record requires at least one INDI substructure', node.position);
  }
  return rec as CensusRecord;
}

function parseCensusSex(node: RawNode, ctx: Ctx): CensusSexStructure {
  const out: CensusSexStructure = { tag: 'SEX', payload: reqText(node), age: null as unknown as CensusSexStructure['age'] };
  dispatch(
    node,
    out,
    {
      AGE: (child) => {
        out.age = parseAge(child, ctx);
      },
      TYPE: (child) => {
        out.type = reqText(child);
      },
    },
    ctx,
    ['AGE', 'TYPE'],
  );
  if (out.age === null) {
    fail('structure.missing-required', 'The SEX structure under _CENR requires an AGE substructure', node.position);
  }
  return out as CensusSexStructure;
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
        out.age = parseAge(child, ctx);
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
        out.role = reqText(child);
      },
      SEX: (child) => {
        out.sex = reqText(child);
      },
    },
    ctx,
    ['FATH', 'MOTH', '_MSTAT', 'AGE', 'BIRT', 'NAME', 'OCCU', 'ROLE', 'SEX'],
  );
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
        out.age = parseAge(child, ctx);
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
