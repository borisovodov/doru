/**
 * Parser section: the Legacy Family Tree to-do record.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). The full rules live in
 * the TodoRecord JSDoc.
 */

import { dispatch, reqText } from './context';
import type { Ctx } from './context';
import type { RawNode } from './lines';
import type { TodoRecord } from '../structures';

/** Parses a `_TODO` record into a TodoRecord. */
export function parseTodoRecord(node: RawNode, ctx: Ctx): TodoRecord {
  const out: TodoRecord = { tag: '_TODO', payload: reqText(node), ...(node.xref === undefined ? {} : { xref: node.xref }) };
  dispatch(
    node,
    out,
    {
      _CAT: (child) => {
        out.category = reqText(child);
      },
      _CDATE: (child) => {
        out.closedDate = reqText(child);
      },
      _LOCL: (child) => {
        out.locality = reqText(child);
      },
      _RDATE: (child) => {
        out.reminderDate = reqText(child);
      },
    },
    ctx,
    ['_CAT', '_CDATE', '_LOCL', '_RDATE'],
  );
  return out;
}
