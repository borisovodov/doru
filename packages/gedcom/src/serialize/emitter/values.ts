/**
 * Serializer section: pointer emission and value spellings.
 *
 * Part of the serializer split; see serialize.ts for the public API.
 * These functions are projections: see the README's Serialization
 * section for what is translated and what is dropped.
 */

import type {
  MediaType,
} from '../../primitives';
import {
  LANGUAGE_IDS_551,
  MULTIMEDIA_FORMATS_551,
} from '../../primitives';
import {
  LANGUAGE_TO_551,
  MEDIA_TYPE_TO_551,
} from '../tables';
import type {
  Version,
} from '../writer';
import {
  Writer,
} from '../writer';

export function ptr(w: Writer, version: Version, level: number, tag: string, pointer: string): void {
  if (pointer === '@VOID@' && version === '5.5.1') {
    // A void pointer has nothing to point at in 5.5.1; the link is
    // dropped. (prepareFor551 removes all such links; REPO and SOUR
    // citations handle theirs inline.)
    return;
  }
  w.line(level, tag, { value: pointer });
}

export function restrictionList(_w: Writer, version: Version, values: Array<string | `_${string}`>): string {
  return values.map((value) => (version === '5.5.1' ? value.toLowerCase() : value)).join(', ');
}

export function pedigree(_w: Writer, version: Version, value: string): string | undefined {
  if (version === '7.0') {
    return value;
  }
  if (value === 'OTHER') {
    // 5.5.1 cannot spell OTHER; the PEDI line is dropped.
    return undefined;
  }
  return value.toLowerCase();
}

export function famcStat(_w: Writer, version: Version, value: string): string {
  if (version === '7.0') {
    return value;
  }
  return value.toLowerCase();
}

export function sex(_w: Writer, version: Version, value: string): string | undefined {
  if (version === '5.5.1' && (value === 'X' || value === 'N')) {
    // 5.5.1 cannot spell X (7.0/5.5.5-only) or N (5.5.5-only); the SEX
    // line is dropped.
    return undefined;
  }
  if (version === '7.0' && value === 'N') {
    // N is GEDCOM 5.5.5-only (5.5.5 §2 p.104); 7.0 has no such value,
    // so the SEX line is dropped.
    return undefined;
  }
  return value;
}

export function ordStat(_w: Writer, version: Version, value: string): string | undefined {
  if (version === '7.0') {
    return value;
  }
  if (value === 'PRE_1970') {
    return 'PRE-1970';
  }
  if (value === 'DNS_CAN') {
    return 'DNS/CAN';
  }
  if (value === 'INFANT') {
    // 5.5.1 cannot spell INFANT; the whole STAT substructure is dropped.
    return undefined;
  }
  return value;
}

export function medi551(_w: Writer, _version: Version, value: string): string | undefined {
  if (value === 'OTHER') {
    // 5.5.1 cannot spell OTHER; the TYPE line is dropped.
    return undefined;
  }
  return value.toLowerCase();
}

export function mediaType(_w: Writer, version: Version, value: MediaType): string | undefined {
  if (version === '7.0') {
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
  return undefined;
}

export function language(_w: Writer, version: Version, value: string): string | undefined {
  if (version === '7.0') {
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
  return undefined;
}
