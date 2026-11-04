/**
 * Parser section: the vendor master-place records and their links.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). The three wire dialects
 * (`_PLAC`, `_LOC`, `_PLAC_DEFN`) normalize into one PlaceRecord; the
 * full rules live in the PlaceRecord JSDoc.
 */

import { fail } from '../errors';
import { collectPlaces } from '../places';
import { isPlaceRecord } from '../structures';
import { dispatch, req, reqPtr, reqText } from './context';
import type { Ctx } from './context';
import type { RawNode } from './lines';
import { eventDetailHandlers, merge551DetailContacts } from './events';
import { parseMapCoordinates, parseMftCoordinates } from './names-places';
import { parseMultimediaLink, parseSourceCitation } from './sources-media';
import {
  datedSourceHandlers,
  parseChangeDate,
  parseExternalIdentifier,
  parseNoteStructure,
  parseReferenceIdentifier,
  parseUniqueIdentifier,
} from './substructures';
import type {
  AdministrativeIdStructure,
  DemographicDataStructure,
  ElMapStructure,
  GedcomRecord,
  PlaceAbbreviation,
  PlaceHierarchyLink,
  PlaceNameStructure,
  PlaceRecord,
  PlaceTypeStructure,
  PostalCodeStructure,
} from '../structures';
import type { EventDetail } from '../structures';
import type { PlaceEventStructure } from '../structures';

/** Parses a `_PLAC`, `_PLAC` (FTB), `_LOC`, `_PLAC_DEFN` or `_PLC`
 *  (GEDKeeper) record into a PlaceRecord. */
export function parsePlaceRecord(node: RawNode, ctx: Ctx): PlaceRecord {
  let payload: string;
  if (node.tag === '_PLAC' || node.tag === '_PLACE') {
    // The payload dialects (_PLAC; Family Tree Builder's `_PLACE`) carry
    // the place name in the record payload.
    payload = reqText(node);
  } else if (node.tag === '_PLAC_DEFN') {
    payload = reqText(req(node, 'PLAC'));
  } else {
    if (node.value.kind !== 'absent') {
      fail('structure.unexpected-payload', `The ${node.tag} line must not have a payload`, node.position);
    }
    // 5.5EL and GEDKeeper keep the name in a NAME child (1:M); the
    // GEDKeeper Windsor dialect spells it `_PLACE`. The names are
    // collected by the NAME/_PLACE handlers below; the payload is
    // derived from the first one after dispatch. req() would enforce
    // at-most-one; only the presence is checked here.
    if (!node.children.some((child) => child.tag === 'NAME' || child.tag === '_PLACE')) {
      fail('structure.missing-required', `The ${node.tag} record requires a NAME child`, node.position);
    }
    payload = '';
  }
  const out: PlaceRecord = { tag: '_PLAC', payload, ...(node.xref === undefined ? {} : { xref: node.xref }) };
  const handlers: Record<string, (child: RawNode) => void> = {
    NAME: (child) => {
      const entry: PlaceNameStructure = { name: reqText(child) };
      (out.names ??= []).push(entry);
      dispatch(child, entry, {
        ...datedSourceHandlers(ctx, entry),
        ABBR: (grandchild) => {
          // GEDCOM-L L1: ABBR {0:M} — a name carries several
          // abbreviations of different kinds, each optionally
          // qualified by one TYPE (L3, e.g. "ISO 3166").
          const abbr: PlaceAbbreviation = { abbreviation: reqText(grandchild) };
          (entry.abbreviations ??= []).push(abbr);
          let sawType = false;
          dispatch(grandchild, abbr, {
            TYPE: (greatGrandchild) => {
              if (sawType) {
                // First occurrence wins.
                return;
              }
              sawType = true;
              abbr.type = reqText(greatGrandchild);
            },
          }, ctx);
        },
        LANG: (grandchild) => {
          entry.language = reqText(grandchild);
        },
        _LANG: (grandchild) => {
          // The historical GEDCOM 5.5EL spelling of the name language
          // (superseded by the GEDCOM-L LANG child; see the English
          // GenWiki article "Gedcom 5.5EL":
          // http://wiki-en.genealogy.net/Gedcom_5.5EL). Both spellings
          // normalize into PlaceNameStructure.language; the write-back
          // uses LANG.
          entry.language = reqText(grandchild);
        },
        NAMC: (grandchild) => {
          // GEDCOM 5.5EL gives the `_LOC` name an optional NAMC child,
          // an addition to the place name (the GEDCOM 5.5EL spec, e.g.
          // the English GenWiki page "Gedcom 5.5EL":
          // http://wiki-en.genealogy.net/Gedcom_5.5EL). GEDCOM-L's
          // successor slot is ABBR (L1/L3); NAMC survives for 5.5EL
          // files and is written back as NAMC.
          entry.addition = reqText(grandchild);
        },
      }, ctx);
    },
    TYPE: (child) => {
      const entry: PlaceTypeStructure = { type: reqText(child) };
      (out.types ??= []).push(entry);
      dispatch(child, entry, {
        ...datedSourceHandlers(ctx, entry),
        '_GOVTYPE': (grandchild) => {
          entry.govTypeId = reqText(grandchild);
        },
      }, ctx);
    },
    '_GOV': (child) => {
      out.govId = reqText(child);
    },
    '_MAIDENHEAD': (child) => {
      out.maidenhead = reqText(child);
    },
    '_POST': (child) => {
      const entry: PostalCodeStructure = { code: reqText(child) };
      (out.postalCodes ??= []).push(entry);
      dispatch(child, entry, datedSourceHandlers(ctx, entry), ctx);
    },
    'POST': (child) => {
      // The historical GEDCOM 5.5EL spelling of the postal code under
      // the _LOC record (superseded by the GEDCOM-L `_POST` spelling,
      // which normalizes into the same PlaceRecord.postalCodes slot).
      // Accepted in any file; written back as `_POST`.
      const entry: PostalCodeStructure = { code: reqText(child) };
      (out.postalCodes ??= []).push(entry);
      dispatch(child, entry, datedSourceHandlers(ctx, entry), ctx);
    },
    '_AIDN': (child) => {
      const entry: AdministrativeIdStructure = {
        identifier: reqText(child),
        type: reqText(req(child, 'TYPE')),
      };
      (out.administrativeIds ??= []).push(entry);
      dispatch(child, entry, { ...datedSourceHandlers(ctx, entry), TYPE: () => undefined }, ctx);
    },
    '_DMGD': (child) => {
      const entry: DemographicDataStructure = {
        data: reqText(child),
        type: reqText(req(child, 'TYPE')),
      };
      (out.demographicData ??= []).push(entry);
      dispatch(child, entry, { ...datedSourceHandlers(ctx, entry), TYPE: () => undefined }, ctx);
    },
    RELI: (child) => {
      out.denomination = reqText(child);
    },
    EVEN: (child) => {
      const detail: EventDetail = {};
      const raw = child.value.kind === 'text' ? child.value.text : '';
      const event: PlaceEventStructure = {
        tag: 'EVEN',
        ...(raw === '' ? {} : { payload: raw }),
      };
      (out.events ??= []).push(event);
      const handlers = eventDetailHandlers(ctx, detail);
      handlers['TYPE'] = (grandchild) => {
        // GEDCOM 5.5.1 §2 p.32 EVENT_DETAIL `n TYPE <EVENT_DESCRIPTOR>`
        // {0:1}: 5.5EL gives the `_LOC` event the full 5.5.1 event
        // detail (see EventDetail.type).
        detail.type = reqText(grandchild);
      };
      dispatch(child, detail, handlers, ctx);
      merge551DetailContacts(detail);
      if (Object.keys(detail).length > 0) {
        event.detail = detail;
      }
    },
    '_LOC': (child) => {
      const entry: PlaceHierarchyLink = { parent: reqPtr(child, ctx) };
      (out.parents ??= []).push(entry);
      dispatch(child, entry, {
        ...datedSourceHandlers(ctx, entry),
        TYPE: (grandchild) => {
          const value = reqText(grandchild).toUpperCase();
          if (value === 'POLI' || value === 'RELI' || value === 'GEOG' || value === 'CULT') {
            entry.type = value;
          } else {
            fail('enum.invalid-value', `The _LOC hierarchy TYPE "${value}" must be POLI, RELI, GEOG, or CULT`, grandchild.position);
          }
        },
      }, ctx);
    },
    '_PLP': (child) => {
      // GEDKeeper: the parent place of the `_PLC` record — the same
      // slot `_LOC @parent@` carries (see PlaceRecord.parents).
      const entry: PlaceHierarchyLink = { parent: reqPtr(child, ctx) };
      (out.parents ??= []).push(entry);
      dispatch(child, entry, datedSourceHandlers(ctx, entry), ctx);
    },
    FORM: (child) => {
      // GEDKeeper: the display form of the place name (see
      // PlaceRecord.form).
      out.form = reqText(child);
    },
    RIN: (child) => {
      // GEDKeeper: the record id of the place (see
      // PlaceRecord.automatedRecordId).
      out.automatedRecordId = reqText(child);
    },
    '_GCID': (child) => {
      // GEDitCOM II: the record's id (see
      // IndividualRecord.geditcomId).
      out.geditcomId = reqText(child);
    },
    ABBR: (child) => {
      out.abbreviation = reqText(child);
    },
    '_PREP': (child) => {
      // Legacy: the location preposition of the place card (see
      // PlaceRecord.preposition).
      out.preposition = reqText(child);
    },
    MAP: (child) => {
      if (child.value.kind === 'text') {
        // The GEDCOM 5.5EL coordinate form: the payload carries the
        // coordinates and the required TYPE names the system (DEGREE or
        // MAIDENHEAD; see PlaceRecord.elMaps). The standard MAP (no
        // payload, LATI/LONG children) is the `map` field below.
        const type = reqText(req(child, 'TYPE')).toUpperCase();
        if (type !== 'DEGREE' && type !== 'MAIDENHEAD') {
          fail('enum.invalid-value', `The 5.5EL MAP TYPE "${type}" must be DEGREE or MAIDENHEAD`, child.position);
        }
        const entry: ElMapStructure = { payload: child.value.text, type };
        (out.elMaps ??= []).push(entry);
        dispatch(child, entry, { TYPE: () => undefined }, ctx, ['TYPE']);
        return;
      }
      const map = parseMapCoordinates(child, ctx);
      if (map !== undefined) {
        out.map = map;
      }
    },
    '_COR': (child) => {
      // MFT7: the place card's coordinates, the DMS block at the
      // record level (see PlaceRecord.map).
      const map = parseMftCoordinates(child, ctx, out);
      if (map !== undefined) {
        out.map = map;
      }
    },
    NOTE: (child) => {
      (out.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    SOUR: (child) => {
      (out.citations ??= []).push(parseSourceCitation(child, ctx));
    },
    OBJE: (child) => {
      (out.media ??= []).push(parseMultimediaLink(child, ctx));
    },
    REFN: (child) => {
      (out.identifiers ??= []).push(parseReferenceIdentifier(child, ctx));
    },
    '_UID': (child) => {
      (out.identifiers ??= []).push(parseUniqueIdentifier(child, ctx));
    },
    CHAN: (child) => {
      out.changeDate = parseChangeDate(child, ctx);
    },
  };
  // The the 7.0 identifier and note-pointer spellings
  // are accepted in any file (the 5.5.1 _UID spelling above stays
  // strict by position; the canonical choice is step 2).
  handlers['UID'] = (child) => {
    (out.identifiers ??= []).push(parseUniqueIdentifier(child, ctx));
  };
  handlers['EXID'] = (child) => {
    (out.identifiers ??= []).push(parseExternalIdentifier(child, ctx));
  };
  handlers['SNOTE'] = (child) => {
    (out.notes ??= []).push(parseNoteStructure(child, ctx));
  };
  if (node.tag === '_PLAC_DEFN') {
    // The required PLAC child was consumed above.
    handlers['PLAC'] = () => undefined;
  }
  // The place record is an extension record: its grammar is defined by
  // the vendor dialect, so standard tags the typed grammar does not
  // know (the FamilySearch test files put `SUBM` and `DATE` under a
  // `_LOC`, GEDCOM 7.0 §1.5 extension-defined substructures) are
  // preserved as generic extensions instead of failing the import.
  // MAP is not in the singles list: the GEDCOM 5.5EL form allows
  // several MAP entries ({0:M}; see PlaceRecord.elMaps).
  // The GEDKeeper Windsor dialect spells the name child `_PLACE`; it
  // parses into the same name entry the NAME child carries.
  handlers['_PLACE'] = handlers['NAME'] as (child: RawNode) => void;
  dispatch(node, out, handlers, ctx, ['ABBR', '_PREP', 'CHAN']);
  if (node.tag === '_LOC' || node.tag === '_PLC') {
    // NAME {1:M}; the first entry is the payload used for name matching.
    if (out.names === undefined || out.names.length === 0) {
      fail('structure.missing-required', `The ${node.tag} record requires a NAME child`, node.position);
    }
    out.payload = (out.names[0] as PlaceNameStructure).name;
  } else if (payload !== '' && out.names === undefined) {
    // The payload dialects (_PLAC/_PLAC_DEFN) carry the name in the
    // payload; normalized into the same NAME list the _LOC dialect
    // uses, so the `_LOC` write-back (the emitter's canonical
    // spelling) round-trips stably.
    out.names = [{ name: payload }];
  }
  return out;
}

/**
 * Materializes the name-based links between events and place records:
 * a place whose text equals a card's payload gets its `location` set to
 * the card (cards without an xref receive a synthesized one). Explicit
 * `_LOC` pointers are already typed by the place parser; unmatched or
 * ambiguous names stay unlinked (no errors).
 */
export function linkPlacesByName(records: GedcomRecord[], ctx: Ctx): void {
  const cards = new Map<string, PlaceRecord>();
  for (const record of records) {
    if (isPlaceRecord(record)) {
      if (!cards.has(record.payload)) {
        cards.set(record.payload, record);
      }
    }
  }
  if (cards.size === 0) {
    return;
  }
  for (const place of collectPlaces(records)) {
    if (place.location !== undefined) {
      continue;
    }
    const card = cards.get(place.payload.join(', '));
    if (card === undefined) {
      continue;
    }
    if (card.xref === undefined) {
      let xref: string;
      do {
        xref = `@_SYNP${ctx.syntheticIndex}@`;
        ctx.syntheticIndex++;
      } while (ctx.xrefs.has(xref));
      ctx.xrefs.add(xref);
      card.xref = xref;
    }
    place.location = card.xref;
  }
}
