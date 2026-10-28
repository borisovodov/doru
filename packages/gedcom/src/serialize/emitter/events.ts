/**
 * Serializer section: family and individual event/attribute detail emitters.
 *
 * Part of the serializer split; see serialize.ts for the public API.
 * These functions are projections: see the README's Serialization
 * section for what is translated and what is dropped.
 */

import type {
  FamilyEventDetail,
  IndividualEventDetail,
  LdsOrdinanceDetail,
} from '../../structures';
import type {
  ExtensionStructure,
} from '../../structures';
import type {
  Version,
} from '../writer';
import {
  Writer,
} from '../writer';
import {
  emitPlace,
} from './names-places';
import {
  emitAge,
  emitDate,
  emitDateExact,
  emitEventDetail,
  emitExtensions,
  emitNoteStructure,
  emitSourceCitation,
} from './structures';
import {
  ordStat,
  ptr,
} from './values';

export function emitFamilyDetail(w: Writer, version: Version, level: number, detail: FamilyEventDetail | undefined, type: string | undefined): void {
  if (type !== undefined) {
    w.line(level, 'TYPE', { value: type });
  }
  if (detail === undefined) {
    return;
  }
  if (detail.husband !== undefined) {
    w.line(level, 'HUSB');
    emitAge(w, version, level + 1, detail.husband.age);
  }
  if (detail.wife !== undefined) {
    w.line(level, 'WIFE');
    emitAge(w, version, level + 1, detail.wife.age);
  }
  if (detail.detail !== undefined) {
    emitEventDetail(w, version, level, detail.detail);
  }
}

export function emitFamilyEvent(w: Writer, version: Version, event: {
  tag: string;
  payload?: true | string;
  type?: string;
  detail?: FamilyEventDetail;
  extensions?: ExtensionStructure[];
}): void {
  if (event.tag === 'EVEN') {
    if (version === '7.0') {
      w.line(1, 'EVEN', { value: event.payload as string });
    } else {
      w.line(1, 'EVEN', { value: (event.payload as string) || undefined });
    }
    emitFamilyDetail(w, version, 2, event.detail, event.type);
    emitExtensions(w, version, 2, event);
    return;
  }
  if (version === '7.0') {
    w.line(1, event.tag, { value: event.payload === true ? 'Y' : undefined });
  } else if (event.tag === 'MARR') {
    w.line(1, 'MARR', { value: event.payload === true ? 'Y' : undefined });
  } else {
    // 5.5.1 cannot carry the Y assertion here; the value is dropped.
    w.line(1, event.tag);
  }
  emitFamilyDetail(w, version, 2, event.detail, event.type);
  emitExtensions(w, version, 2, event);
}

export function emitIndividualDetail(w: Writer, version: Version, level: number, detail: IndividualEventDetail | undefined, type: string | undefined): void {
  if (type !== undefined) {
    w.line(level, 'TYPE', { value: type });
  }
  if (detail === undefined) {
    return;
  }
  if (detail.age !== undefined) {
    emitAge(w, version, level, detail.age);
  }
  emitEventDetail(w, version, level, detail);
}

export function emitIndividualEvent(w: Writer, version: Version, event: {
  tag: string;
  payload?: true | string;
  type?: string;
  detail?: IndividualEventDetail;
  familyChild?: string;
  adoptionFamily?: { family: string; adoption?: { payload: string; phrase?: string } };
  birthType?: string;
  extensions?: ExtensionStructure[];
}): void {
  if (event.tag === 'EVEN') {
    w.line(1, 'EVEN', { value: (event.payload as string) || undefined });
    emitIndividualDetail(w, version, 2, event.detail, event.type);
    emitExtensions(w, version, 2, event);
    return;
  }
  if (version === '7.0') {
    w.line(1, event.tag, { value: event.payload === true ? 'Y' : undefined });
  } else if (event.tag === 'BIRT' || event.tag === 'CHR' || event.tag === 'DEAT') {
    w.line(1, event.tag, { value: event.payload === true ? 'Y' : undefined });
  } else {
    // 5.5.1 cannot carry the Y assertion here; the value is dropped.
    w.line(1, event.tag);
  }
  if (event.tag === 'ADOP' && event.adoptionFamily !== undefined) {
    ptr(w, version, 2, 'FAMC', event.adoptionFamily.family);
    if (event.adoptionFamily.adoption !== undefined) {
      w.line(3, 'ADOP', { value: event.adoptionFamily.adoption.payload });
      if (event.adoptionFamily.adoption.phrase !== undefined) {
        w.line(4, 'PHRASE', { value: event.adoptionFamily.adoption.phrase });
      }
    }
  }
  if ((event.tag === 'BIRT' || event.tag === 'CHR') && event.familyChild !== undefined) {
    ptr(w, version, 2, 'FAMC', event.familyChild);
  }
  if (version === '5.5.1' && event.tag === 'BIRT' && event.birthType !== undefined) {
    // USM6: the birth type (see BirthEvent.birthType); 7.0 cannot spell
    // the non-underscore tag.
    w.line(2, 'BTYP', { value: event.birthType });
  }
  emitIndividualDetail(w, version, 2, event.detail, event.type);
  emitExtensions(w, version, 2, event);
}

export function emitLdsDetail(w: Writer, version: Version, level: number, detail: LdsOrdinanceDetail | undefined, _ordinance: string): void {
  if (detail === undefined) {
    return;
  }
  if (detail.date !== undefined) {
    emitDate(w, version, level, 'DATE', detail.date);
  }
  if (detail.temple !== undefined) {
    w.line(level, 'TEMP', { value: detail.temple });
  }
  if (detail.place !== undefined) {
    emitPlace(w, version, level, detail.place);
  }
  if (detail.status !== undefined) {
    const value = ordStat(w, version, detail.status.payload);
    if (value !== undefined) {
      w.line(level, 'STAT', { value });
      emitDateExact(w, version, level + 1, 'DATE', detail.status.date, detail.status.date.time);
    }
  }
  for (const note of detail.notes ?? []) {
    emitNoteStructure(w, version, level, note);
  }
  for (const citation of detail.citations ?? []) {
    emitSourceCitation(w, version, level, citation);
  }
}

