/**
 * Parser section: the Ancestris `TITL` record.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). The full rules live in
 * the title-record model JSDoc.
 */

import { dispatch, reqPtr, reqText } from './context';
import type { Ctx } from './context';
import type { RawNode } from './lines';
import { parseChangeDate } from './substructures';
import type { TitleRecord } from '../structures';

/** Parses an Ancestris `TITL` record into a TitleRecord. */
export function parseTitleRecord(node: RawNode, ctx: Ctx): TitleRecord {
  const out: TitleRecord = {
    tag: 'TITL',
    ...(node.xref === undefined ? {} : { xref: node.xref }),
    ...(node.value.kind === 'text' ? { payload: node.value.text } : {}),
  };
  dispatch(
    node,
    out,
    {
      CHAN: (child) => {
        out.changeDate = parseChangeDate(child, ctx);
      },
      AUTH: (child) => {
        // A pointer to the author's INDI record, or free text (see
        // TitleRecord.author).
        out.author = child.value.kind === 'pointer' ? reqPtr(child, ctx) : reqText(child);
      },
      PUBL: (child) => {
        out.publisher = reqText(child);
      },
      SERS: (child) => {
        out.series = reqText(child);
      },
      ABBR: (child) => {
        out.abbreviation = reqText(child);
      },
      REPO: (child) => {
        out.repository = reqPtr(child, ctx);
      },
      NUMB: (child) => {
        out.sequenceNumber = reqText(child);
      },
      CALN: (child) => {
        out.callNumber = reqText(child);
      },
    },
    ctx,
  );
  return out;
}
