/**
 * Parser section: the Legacy `_EVENT_DEFN` record.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout).
 */

import { fail } from '../errors';
import type { EventDefinitionRecord, PafSentenceDefinitions, WitnessRoleSentenceSet } from '../structures';
import type { Ctx } from './context';
import { addExtension } from './context';
import type { RawNode } from './lines';
import { parsePrivacyFlag } from './sources-media';

/** The standard event and attribute tags a definition may name (5.x
 *  event/attribute sets: the individual and family events, EVEN/FACT,
 *  and the individual attributes). TITL is deliberately absent: a bare
 *  `TITL` child still names the attribute (handled separately), while
 *  a payloaded `TITL` is the definition's display title — real Legacy
 *  files use the payloaded form. */
const EVENT_DEFINITION_TYPE_TAGS: ReadonlySet<string> = new Set([
  'ADOP',
  'BAPM',
  'BARM',
  'BASM',
  'BIRT',
  'BLES',
  'BURI',
  'CENS',
  'CHR',
  'CHRA',
  'CONF',
  'CREM',
  'DEAT',
  'EMIG',
  'FCOM',
  'GRAD',
  'IMMI',
  'NATU',
  'ORDN',
  'PROB',
  'RETI',
  'WILL',
  'ANUL',
  'DIV',
  'DIVF',
  'ENGA',
  'MARB',
  'MARC',
  'MARL',
  'MARR',
  'MARS',
  'EVEN',
  'FACT',
  'CAST',
  'DSCR',
  'EDUC',
  'IDNO',
  'NATI',
  'NCHI',
  'NMR',
  'OCCU',
  'PROP',
  'RELI',
  'RESI',
  'SSN',
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
 *  EventDefinitionRecord.sentences). A bare sentence line carries no
 *  data and is kept as the empty sentence. */
function setSentence(rec: EventDefinitionRecord, index: number, node: RawNode): void {
  const sentences = (rec.sentences ??= []);
  while (sentences.length <= index) {
    sentences.push('');
  }
  sentences[index] = node.value.kind === 'text' ? node.value.text : '';
}

/**
 * Parses a `_EVENT_DEFN` record. The vendor's help enumerates the
 * members but not the wire shape, so the parser accepts every form the
 * real Legacy exports use: the defined event/fact tag comes from the
 * record payload (the definition's name), a bare standard-tag child,
 * or the legacy `_TYPE` child; the `TYPE` child carries the event kind
 * code, `TITL` the display title, and the known members (the ROLE
 * sentence blocks, the flags and the sentence sets) are typed;
 * everything else stays a generic extension.
 */
export function parseEventDefinitionRecord(node: RawNode, ctx: Ctx): EventDefinitionRecord {
  const rec: EventDefinitionRecord = {
    tag: '_EVENT_DEFN',
    ...(node.xref === undefined ? {} : { xref: node.xref }),
    ...(node.value.kind === 'text' ? { eventType: node.value.text } : {}),
  };
  const setType = (tag: string): void => {
    if (rec.eventType !== undefined) {
      // First occurrence wins (the full-leniency container rule).
      return;
    }
    rec.eventType = tag;
  };
  const setKind = (code: string): void => {
    if (rec.kind !== undefined) {
      // First occurrence wins.
      return;
    }
    rec.kind = code;
  };
  // A bare line carries no data; every text slot below reads the
  // empty string (the full-leniency container rule — the same retry
  // the dispatch applies elsewhere; this parser iterates its
  // children directly).
  const text = (n: RawNode): string => (n.value.kind === 'text' ? n.value.text : '');
  for (const child of node.children) {
    if (EVENT_DEFINITION_TYPE_TAGS.has(child.tag)) {
      if (child.value.kind !== 'absent') {
        fail('structure.unexpected-payload', `The ${child.tag} line must not carry a value`, child.position);
      }
      setType(child.tag);
      continue;
    }
    if (child.tag === 'TITL') {
      // A payloaded TITL is the definition's display title (the real
      // Legacy form); a bare TITL names the standard TITL attribute as
      // the defined tag.
      if (child.value.kind === 'absent') {
        setType('TITL');
      } else {
        if (rec.title !== undefined) {
          // First occurrence wins.
          continue;
        }
        rec.title = text(child);
      }
      continue;
    }
    if (child.tag === 'TYPE') {
      // The event kind code (I = individual, F = family in the real
      // Legacy exports; the GEDCOM 5.5.5 draft / RootsMagic `_EVDEF`
      // writes P for a person event — see EventDefinitionRecord.kind).
      setKind(text(child));
      continue;
    }
    if (child.tag === '_TYPE') {
      // The legacy underscore spelling: the defined event tag, kept as
      // an eventType source for backward compatibility (no real file
      // with this form was found).
      setType(text(child));
      continue;
    }
    if (child.tag === 'ROLE') {
      (rec.witnessRoles ??= []).push(parseWitnessRole(child, ctx));
      continue;
    }
    if (child.tag === '_INC_NOTES') {
      rec.includeNotes = parsePrivacyFlag(child, '_INC_NOTES');
      continue;
    }
    if (child.tag === '_CONF_FLAG') {
      rec.confidentialFlag = parsePrivacyFlag(child, '_CONF_FLAG');
      continue;
    }
    if (child.tag === '_DATE_TYPE') {
      rec.dateType = text(child);
      continue;
    }
    if (child.tag === '_DESC_FLAG') {
      rec.descriptionFlag = text(child);
      continue;
    }
    if (child.tag === '_PLACE_TYPE') {
      rec.placeType = text(child);
      continue;
    }
    if (child.tag === '_PP_EXCLUDE') {
      rec.potentialProblemsExcluded = text(child);
      continue;
    }
    if (child.tag === 'ABBR') {
      // The GEDCOM 5.5.5 draft / RootsMagic `_EVDEF` abbreviation of
      // the defined event (see EventDefinitionRecord.abbreviation).
      rec.abbreviation = text(child);
      continue;
    }
    if (child.tag === 'SENT') {
      // The GEDCOM 5.5.5 draft / RootsMagic `_EVDEF` sentence
      // template (see EventDefinitionRecord.sentence).
      rec.sentence = text(child);
      continue;
    }
    if (child.tag === 'PLAC') {
      // The RootsMagic `_EVDEF` spelling of the place-field flag
      // (`PLAC Y`/`N`) — the same slot `_PLACE_TYPE` carries (see
      // EventDefinitionRecord.placeType).
      rec.placeType = text(child);
      continue;
    }
    if (child.tag === 'DATE') {
      // The RootsMagic `_EVDEF` spelling of the date-field flag
      // (`DATE Y`/`N`) — the same slot `_DATE_TYPE` carries (see
      // EventDefinitionRecord.dateType).
      rec.dateType = text(child);
      continue;
    }
    if (child.tag === 'DESC') {
      // The RootsMagic `_EVDEF` spelling of the description-field
      // flag (`DESC Y`/`N`) — the same slot `_DESC_FLAG` carries (see
      // EventDefinitionRecord.descriptionFlag).
      rec.descriptionFlag = text(child);
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
      paf[pafField] = text(child);
      continue;
    }
    // Full leniency: any other child stays a generic extension.
    addExtension(rec, child, ctx);
    continue;
  }
  return rec;
}

/** Parses one witness-role block under an `_EVENT_DEFN` record (see
 *  WitnessRoleSentenceSet): `ROLE <name>` with the eight `_SEN1`–`_SEN8`
 *  sentences and the `_DEF` default-role mark. */
function parseWitnessRole(node: RawNode, ctx: Ctx): WitnessRoleSentenceSet {
  // A bare ROLE line carries no data and keeps the empty role name.
  const out: WitnessRoleSentenceSet = {
    tag: 'ROLE',
    role: node.value.kind === 'text' ? node.value.text : '',
  };
  const setSentence = (index: number, child: RawNode): void => {
    const sentences = (out.sentences ??= []);
    while (sentences.length <= index) {
      sentences.push('');
    }
    // A bare sentence line carries no data and is kept as the empty
    // sentence (the full-leniency container rule).
    sentences[index] = child.value.kind === 'text' ? child.value.text : '';
  };
  for (const child of node.children) {
    const sentenceMatch = /^_SEN([1-8])$/.exec(child.tag);
    if (sentenceMatch !== null) {
      setSentence(Number(sentenceMatch[1]) - 1, child);
      continue;
    }
    if (child.tag === 'SENT') {
      // The GEDCOM 5.5.5 draft / RootsMagic `_EVDEF` role sentence
      // template (see WitnessRoleSentenceSet.sentence); a bare line
      // is the empty template.
      out.sentence = child.value.kind === 'text' ? child.value.text : '';
      continue;
    }
    if (child.tag === '_DEF') {
      out.defaultRole = parsePrivacyFlag(child, '_DEF');
      continue;
    }
    // Full leniency: any other child stays a generic extension.
    addExtension(out, child, ctx);
    continue;
  }
  return out;
}
