/**
 * Serializer section: the MagiKey `_CENR` census record.
 *
 * The census record is the MagiKey extension registered in the
 * FamilySearch GEDCOM registry
 * (structure/extension/MagiKey_record_CENR.yaml); it is written back
 * in both versions.
 */

import type {
  CensusIndividual,
  CensusRecord,
  CensusRelative,
  CensusRelocatedAttribute,
  CensusRelocatedEvent,
} from '../../structures';
import type {
  Version,
  Writer,
} from '../writer';
import {
  emitPersonalName,
} from './names-places';
import {
  emitAge,
  emitDate,
  emitDateExact,
  emitEventDetail,
  emitExtensions,
  emitNoteStructure,
} from './structures';
import {
  ptr,
} from './values';

export function emitCensusRecord(w: Writer, version: Version, rec: CensusRecord): void {
  w.line(0, '_CENR', { xref: rec.xref });
  if (rec.schedule !== undefined) {
    w.line(1, '_SCHD', { value: rec.schedule });
  }
  for (const sex of rec.sexes ?? []) {
    w.line(1, 'SEX', { value: sex.payload });
    emitAge(w, version, 2, sex.age);
    if (sex.count !== undefined) {
      // The count of individuals in the age range (registry:
      // MagiKey_CENR_SEX_AGE.yaml; see CensusSexStructure.count).
      w.line(3, 'NCHI', { value: String(sex.count) });
    }
    if (sex.type !== undefined) {
      w.line(2, 'TYPE', { value: sex.type });
    }
  }
  emitDate(w, version, 1, 'DATE', rec.date);
  w.line(1, 'PLAC', { value: rec.place });
  if (rec.source !== undefined) {
    if (rec.source.source !== undefined) {
      ptr(w, version, 1, 'SOUR', rec.source.source);
    } else if (rec.source.description !== undefined) {
      w.line(1, 'SOUR', { value: rec.source.description });
    }
  }
  for (const entry of rec.entries) {
    emitCensusIndividual(w, version, entry);
  }
  if (rec.changeDate !== undefined) {
    w.line(1, 'CHAN');
    emitDateExact(w, version, 2, 'DATE', rec.changeDate.date, rec.changeDate.date.time);
    for (const note of rec.changeDate.notes ?? []) {
      emitNoteStructure(w, version, 2, note);
    }
    if (rec.changeDate.user !== undefined) {
      // webtrees: the user who made the change (see ChangeDate.user).
      w.line(2, '_WT_USER', { value: rec.changeDate.user });
    }
  }
  emitExtensions(w, version, 1, rec);
}

function emitCensusIndividual(w: Writer, version: Version, entry: CensusIndividual): void {
  ptr(w, version, 1, 'INDI', entry.individual);
  if (entry.father !== undefined) {
    emitCensusRelative(w, version, entry.father);
  }
  if (entry.mother !== undefined) {
    emitCensusRelative(w, version, entry.mother);
  }
  if (entry.maritalStatus !== undefined) {
    w.line(2, '_MSTAT', { value: entry.maritalStatus });
  }
  if (entry.age !== undefined) {
    emitAge(w, version, 2, entry.age);
  }
  if (entry.birth !== undefined) {
    emitCensusRelocatedEvent(w, version, entry.birth, 2);
  }
  for (const fact of entry.facts ?? []) {
    emitCensusRelocatedAttribute(w, version, fact, 2);
  }
  if (entry.name !== undefined) {
    emitPersonalName(w, version, 2, entry.name);
  }
  if (entry.occupation !== undefined) {
    emitCensusRelocatedAttribute(w, version, entry.occupation, 2);
  }
  if (entry.role !== undefined) {
    w.line(2, 'ROLE', { value: entry.role });
  }
  if (entry.sex !== undefined) {
    w.line(2, 'SEX', { value: entry.sex });
  }
  emitExtensions(w, version, 2, entry);
}

function emitCensusRelative(w: Writer, version: Version, rel: CensusRelative): void {
  w.line(2, rel.tag);
  if (rel.age !== undefined) {
    emitAge(w, version, 3, rel.age);
  }
  if (rel.birth !== undefined) {
    emitCensusRelocatedEvent(w, version, rel.birth, 3);
  }
  if (rel.fact !== undefined) {
    emitCensusRelocatedAttribute(w, version, rel.fact, 3);
  }
  if (rel.marriage !== undefined) {
    emitCensusRelocatedEvent(w, version, rel.marriage, 3);
  }
  if (rel.occupation !== undefined) {
    emitCensusRelocatedAttribute(w, version, rel.occupation, 3);
  }
  emitExtensions(w, version, 3, rel);
}

function emitCensusRelocatedEvent(w: Writer, version: Version, event: CensusRelocatedEvent, level: number): void {
  w.line(level, event.tag, { value: event.payload === true ? 'Y' : undefined });
  if (event.detail !== undefined) {
    emitEventDetail(w, version, level + 1, event.detail);
  }
  emitExtensions(w, version, level, event);
}

function emitCensusRelocatedAttribute(w: Writer, version: Version, attr: CensusRelocatedAttribute, level: number): void {
  w.line(level, attr.tag, { value: attr.payload });
  if (attr.detail !== undefined) {
    emitEventDetail(w, version, level + 1, attr.detail);
  }
  emitExtensions(w, version, level, attr);
}
