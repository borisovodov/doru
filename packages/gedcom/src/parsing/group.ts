/**
 * Parser section: the GEDKeeper group record.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). The full rules live in
 * the GroupRecord JSDoc.
 */

import { dispatch, noPayload, reqText } from './context';
import type { Ctx } from './context';
import type { RawNode } from './lines';
import type { GroupRecord } from '../structures';
import { parseNoteStructure } from './substructures';

/** Parses a GEDKeeper `_GRP` record into a GroupRecord. */
export function parseGroupRecord(node: RawNode, ctx: Ctx): GroupRecord {
  noPayload(node);
  const out: GroupRecord = { tag: '_GRP', ...(node.xref === undefined ? {} : { xref: node.xref }) };
  dispatch(
    node,
    out,
    {
      NAME: (child) => {
        out.name = reqText(child);
      },
      NOTE: (child) => {
        (out.notes ??= []).push(parseNoteStructure(child, ctx));
      },
    },
    ctx,
  );
  return out;
}
