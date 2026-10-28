/**
 * Parser section: the Legacy `_EVENT_DEFN` record.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout).
 */

import {
  fail,
} from '../errors';
import type {
  EventDefinitionRecord,
  PafSentenceDefinitions,
} from '../structures';
import type {
  Ctx,
} from './context';
import {
  addExtension,
  reqText,
} from './context';
import type {
  RawNode,
} from './lines';
import {
  parsePrivacyFlag,
} from './sources-media';
import {
  NON_UNDERSCORE_VENDOR_TAGS,
} from './vendor-tags';

/** The standard event and attribute tags a definition may name (5.x
 *  event/attribute sets: the individual and family events, EVEN/FACT,
 *  and the individual attributes). */
const EVENT_DEFINITION_TYPE_TAGS: ReadonlySet<string> = new Set([
  'ADOP', 'BAPM', 'BARM', 'BASM', 'BIRT', 'BLES', 'BURI', 'CENS', 'CHR', 'CHRA', 'CONF', 'CREM',
  'DEAT', 'EMIG', 'FCOM', 'GRAD', 'IMMI', 'NATU', 'ORDN', 'PROB', 'RETI', 'WILL',
  'ANUL', 'DIV', 'DIVF', 'ENGA', 'MARB', 'MARC', 'MARL', 'MARR', 'MARS',
  'EVEN', 'FACT',
  'CAST', 'DSCR', 'EDUC', 'IDNO', 'NATI', 'NCHI', 'NMR', 'OCCU', 'PROP', 'RELI', 'RESI', 'SSN', 'TITL',
]);

/** The PAF5 sentence tags and their fields (see PafSentenceDefinitions). */
const PAF_SENTENCE_TAGS: Readonly<Record<string, keyof PafSentenceDefinitions>> = {
  _SENM: 'male',
  _SENF: 'female',
  _SENU: 'unknown',
  _SENDOM: 'maleDateOnly',
  _SENPOM: 'malePlaceOnly',
  _SENDPM: 'maleDateAndPlace',
  _SENDOF: 'femaleDateOnly',
  _SENPOF: 'femalePlaceOnly',
  _SENDPF: 'femaleDateAndPlace',
  _SENDOU: 'unknownDateOnly',
  _SENPOU: 'unknownPlaceOnly',
  _SENDPU: 'unknownDateAndPlace',
};

/** Sets the n-th Legacy sentence, padding the gaps (see
 *  EventDefinitionRecord.sentences). */
function setSentence(rec: EventDefinitionRecord, index: number, node: RawNode): void {
  const sentences = (rec.sentences ??= []);
  while (sentences.length <= index) {
    sentences.push('');
  }
  sentences[index] = reqText(node);
}

/**
 * Parses a `_EVENT_DEFN` record. The vendor's help enumerates the
 * members but not the wire shape, so the defined event tag is accepted
 * in every documented form — the record payload, a standard-tag child,
 * or a TYPE/_TYPE child — and the known members are typed; everything
 * else stays a generic extension.
 */
export function parseEventDefinitionRecord(node: RawNode, _ctx: Ctx): EventDefinitionRecord {
  const rec: EventDefinitionRecord = {
    tag: '_EVENT_DEFN',
    ...(node.xref === undefined ? {} : { xref: node.xref }),
    ...(node.value.kind === 'text' ? { eventType: node.value.text } : {}),
  };
  const setType = (tag: string): void => {
    if (rec.eventType !== undefined) {
      fail('structure.cardinality', `At most one event type is allowed in an _EVENT_DEFN record`, node.position);
    }
    rec.eventType = tag;
  };
  for (const child of node.children) {
    if (EVENT_DEFINITION_TYPE_TAGS.has(child.tag)) {
      if (child.value.kind !== 'absent') {
        fail('structure.unexpected-payload', `The ${child.tag} line must not carry a value`, child.position);
      }
      setType(child.tag);
      continue;
    }
    if (child.tag === 'TYPE' || child.tag === '_TYPE') {
      setType(reqText(child));
      continue;
    }
    if (child.tag === '_CONF_FLAG') {
      rec.confidentialFlag = parsePrivacyFlag(child, '_CONF_FLAG');
      continue;
    }
    if (child.tag === '_DATE_TYPE') {
      rec.dateType = reqText(child);
      continue;
    }
    if (child.tag === '_DESC_FLAG') {
      rec.descriptionFlag = reqText(child);
      continue;
    }
    if (child.tag === '_PLACE_TYPE') {
      rec.placeType = reqText(child);
      continue;
    }
    if (child.tag === '_PP_EXCLUDE') {
      rec.potentialProblemsExcluded = reqText(child);
      continue;
    }
    const sentenceMatch = /^_SEN([1-8])$/.exec(child.tag);
    if (sentenceMatch !== null) {
      setSentence(rec, Number(sentenceMatch[1]) - 1, child);
      continue;
    }
    const pafField = PAF_SENTENCE_TAGS[child.tag];
    if (pafField !== undefined) {
      const paf = (rec.pafSentences ??= {});
      paf[pafField] = reqText(child);
      continue;
    }
    if (child.tag.startsWith('_') || NON_UNDERSCORE_VENDOR_TAGS.has(child.tag)) {
      addExtension(rec, child);
      continue;
    }
    fail('structure.unknown-tag', `The tag ${child.tag} is not allowed under _EVENT_DEFN`, child.position);
  }
  return rec;
}
