/**
 * Parser section: the to-do record and substructure.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). The full rules live in
 * the TodoRecord / TodoStructure JSDoc.
 */

import { dispatch, reqText } from './context';
import type { Ctx } from './context';
import type { RawNode } from './lines';
import type { TodoRecord, TodoStructure } from '../structures';
import { parseDateStructure, parseNoteStructure } from './substructures';

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

/** Parses the `_TODO` substructure under INDI/FAM (see TodoStructure). */
export function parseTodoStructure(node: RawNode, ctx: Ctx): TodoStructure {
  const raw = node.value.kind === 'text' ? node.value.text : undefined;
  const out: TodoStructure = { tag: '_TODO', ...(raw === undefined ? {} : { payload: raw }) };
  dispatch(
    node,
    out,
    {
      DESC: (child) => {
        out.description = reqText(child);
      },
      PRTY: (child) => {
        out.priority = reqText(child);
      },
      STAT: (child) => {
        out.status = reqText(child);
      },
      DATE: (child) => {
        out.date = parseDateStructure(child, ctx);
      },
      NOTE: (child) => {
        (out.notes ??= []).push(parseNoteStructure(child, ctx));
      },
    },
    ctx,
    ['DESC', 'PRTY', 'STAT', 'DATE'],
  );
  return out;
}
