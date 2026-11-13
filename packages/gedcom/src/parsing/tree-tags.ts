/**
 * Parser section: the MyHeritage tree-tag records.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). The full rules live in
 * the TreeTagRecord JSDoc.
 */

import { addExtension, dispatch, noPayload, reqPtr, reqText } from './context';
import type { Ctx } from './context';
import type { RawNode } from './lines';
import { parseUsmFlagLenient } from './sources-media';
import type { TreeCategoryRecord, TreeTagRecord } from '../structures';

/** Parses a MyHeritage `_MTTAG` record into a TreeTagRecord. */
export function parseTreeTagRecord(node: RawNode, ctx: Ctx): TreeTagRecord {
  noPayload(node);
  const out: TreeTagRecord = { tag: '_MTTAG', ...(node.xref === undefined ? {} : { xref: node.xref }) };
  dispatch(
    node,
    out,
    {
      NAME: (child) => {
        out.name = reqText(child);
      },
      RIN: (child) => {
        out.automatedRecordId = reqText(child);
      },
      _VISI: (child) => {
        const flag = parseUsmFlagLenient(child);
        if (flag === undefined) {
          addExtension(out, child, ctx);
        } else {
          out.visible = flag;
        }
      },
      _MTCAT: (child) => {
        out.category = reqPtr(child, ctx);
      },
    },
    ctx,
  );
  return out;
}

/** Parses a MyHeritage `_MTCAT` record into a TreeCategoryRecord. */
export function parseTreeCategoryRecord(node: RawNode, ctx: Ctx): TreeCategoryRecord {
  noPayload(node);
  const out: TreeCategoryRecord = { tag: '_MTCAT', ...(node.xref === undefined ? {} : { xref: node.xref }) };
  dispatch(
    node,
    out,
    {
      NAME: (child) => {
        out.name = reqText(child);
      },
      RIN: (child) => {
        out.automatedRecordId = reqText(child);
      },
    },
    ctx,
  );
  return out;
}
