/**
 * Parser section: the occurrence record of the glamberson
 * gedcom-occurrences extension.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). The full rules live in
 * the OccurrenceRecord JSDoc.
 */

import { dispatch, noPayload, reqPtr, reqText } from './context';
import type { Ctx } from './context';
import type { RawNode } from './lines';
import type { OccurrenceParticipant, OccurrenceRecord } from '../structures';
import { parseAgeStructure, parseChangeDate, parseDateStructure, parseNoteStructure } from './substructures';
import { parsePlaceStructure } from './names-places';
import { parseMultimediaLink, parseSourceCitation } from './sources-media';
import { parseVendorAttribute } from './evidence';

/** Parses a `_OCUR` record into an OccurrenceRecord. */
export function parseOccurrenceRecord(node: RawNode, ctx: Ctx): OccurrenceRecord {
  noPayload(node);
  const out: OccurrenceRecord = { tag: '_OCUR', ...(node.xref === undefined ? {} : { xref: node.xref }) };
  dispatch(
    node,
    out,
    {
      TYPE: (child) => {
        out.type = reqText(child);
      },
      DATE: (child) => {
        out.date = parseDateStructure(child, ctx);
      },
      PLAC: (child) => {
        out.place = parsePlaceStructure(child, ctx);
      },
      CAUS: (child) => {
        // occurrence-extension.md: the cause (for deaths etc.).
        out.cause = reqText(child);
      },
      AGNC: (child) => {
        // occurrence-extension.md: the agency (for official occurrences).
        out.agency = reqText(child);
      },
      RELI: (child) => {
        // occurrence-extension.md: the religion (for religious occurrences).
        out.religion = reqText(child);
      },
      _PART: (child) => {
        const participant: OccurrenceParticipant = { tag: '_PART', individual: reqPtr(child, ctx) };
        dispatch(
          child,
          participant,
          {
            ROLE: (grandchild) => {
              participant.role = reqText(grandchild);
            },
            AGE: (grandchild) => {
              participant.age = parseAgeStructure(grandchild, ctx);
            },
            NOTE: (grandchild) => {
              (participant.notes ??= []).push(parseNoteStructure(grandchild, ctx));
            },
            SOUR: (grandchild) => {
              (participant.citations ??= []).push(parseSourceCitation(grandchild, ctx));
            },
          },
          ctx,
          ['ROLE', 'AGE'],
        );
        (out.participants ??= []).push(participant);
      },
      _ATTR: (child) => {
        // occurrence-extension.md: the custom attributes.
        (out.attributes ??= []).push(parseVendorAttribute(child, ctx));
      },
      NOTE: (child) => {
        (out.notes ??= []).push(parseNoteStructure(child, ctx));
      },
      SOUR: (child) => {
        (out.citations ??= []).push(parseSourceCitation(child, ctx));
      },
      OBJE: (child) => {
        // occurrence-extension.md: media for the occurrence.
        (out.media ??= []).push(parseMultimediaLink(child, ctx));
      },
      UID: (child) => {
        // occurrence-extension.md: the GRAMPS event handles.
        (out.uids ??= []).push(reqText(child));
      },
      CHAN: (child) => {
        out.changeDate = parseChangeDate(child, ctx);
      },
    },
    ctx,
    ['TYPE', 'DATE', 'PLAC', 'CAUS', 'AGNC', 'RELI', 'CHAN'],
  );
  return out;
}
