/**
 * Parser section: the to-do record and substructure.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). The full rules live in
 * the TodoRecord / TodoStructure JSDoc.
 */

import { dispatch, reqPtr, reqText } from './context';
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
  const setPriority = (child: RawNode): void => {
    // The Legacy/GenoPro spelling PRTY and the GEDCOM-L E1 `_PRTY`
    // share the one slot (see TodoStructure.priority).
    out.priority = reqText(child);
  };
  dispatch(
    node,
    out,
    {
      DESC: (child) => {
        out.description = reqText(child);
      },
      _CAT: (child) => {
        // GEDCOM-L E1: the category of the task (see
        // TodoStructure.category).
        out.category = reqText(child);
      },
      PRTY: setPriority,
      _PRTY: setPriority,
      TYPE: (child) => {
        // GEDCOM-L E1: the type of the task (see TodoStructure.type).
        out.type = reqText(child);
      },
      STAT: (child) => {
        out.status = reqText(child);
      },
      DATE: (child) => {
        out.date = parseDateStructure(child, ctx);
      },
      DATA: (child) => {
        // GEDCOM-L E1: the details of the solution (see
        // TodoStructure.data).
        out.data = reqText(child);
      },
      _CDATE: (child) => {
        // GEDCOM-L E1: the completion date (see
        // TodoStructure.closedDate).
        out.closedDate = parseDateStructure(child, ctx);
      },
      _RDATE: (child) => {
        // GEDCOM-L E1: the reminder date (see
        // TodoStructure.reminderDate).
        out.reminderDate = parseDateStructure(child, ctx);
      },
      REPO: (child) => {
        // GEDCOM-L E1: a pointer to a repository record (see
        // TodoStructure.repository).
        out.repository = reqPtr(child, ctx);
      },
      _UID: (child) => {
        // GEDCOM-L E1: unique identifiers of the task (see
        // TodoStructure.uids).
        (out.uids ??= []).push(reqText(child));
      },
      NOTE: (child) => {
        (out.notes ??= []).push(parseNoteStructure(child, ctx));
      },
    },
    ctx,
    ['DESC', '_CAT', 'PRTY', '_PRTY', 'TYPE', 'STAT', 'DATE', 'DATA', '_CDATE', '_RDATE', 'REPO'],
  );
  return out;
}
