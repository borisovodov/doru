/**
 * Parser section: Ctx, payload readers, children helpers.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). Every function here
 * maps a raw-tree node onto the typed model and fails with a typed
 * error naming the offending line.
 */

import {
  fail,
} from '../errors';
import type {
  ExtensionStructure,
  GedcomStructureBase,
  MultimediaRecord,
} from '../structures';
import type {
  GedcomVersion,
} from '../primitives';
import type {
  RawNode,
} from './lines';

/** The declared specification version of the document being parsed. */
export interface Ctx {
  version: GedcomVersion;
  xrefs: Set<string>;
  synthetic: MultimediaRecord[];
  syntheticIndex: number;
}

// ---------------------------------------------------------------------------
// Payload readers
// ---------------------------------------------------------------------------

export function reqText(node: RawNode): string {
  if (node.value.kind !== 'text') {
    fail('structure.missing-payload', `The ${node.tag} line requires a text value`, node.position);
  }
  return node.value.text;
}

export function resolvePtr(pointer: string, ctx: Ctx, node: RawNode): string {
  if (ctx.version === '7.0' && pointer === '@VOID@') {
    return pointer;
  }
  if (!ctx.xrefs.has(pointer)) {
    fail('document.xref-not-found', `Pointer ${pointer} does not match any cross-reference identifier`, node.position);
  }
  return pointer;
}

export function reqPtr(node: RawNode, ctx: Ctx): string {
  if (node.value.kind !== 'pointer') {
    fail('structure.missing-payload', `The ${node.tag} line requires a pointer value`, node.position);
  }
  return resolvePtr(node.value.pointer, ctx, node);
}

export function optPtr(node: RawNode, ctx: Ctx): string | undefined {
  if (node.value.kind === 'absent') {
    return undefined;
  }
  if (node.value.kind !== 'pointer') {
    fail('structure.unexpected-payload', `The ${node.tag} line must not carry a text value`, node.position);
  }
  return resolvePtr(node.value.pointer, ctx, node);
}

export function noPayload(node: RawNode): void {
  if (node.value.kind !== 'absent') {
    fail('structure.unexpected-payload', `The ${node.tag} line must not have a value`, node.position);
  }
}

/** The optional `Y` assertion payload. */
export function yFlag(node: RawNode): true | undefined {
  if (node.value.kind === 'absent') {
    return undefined;
  }
  if (node.value.kind === 'text' && node.value.text === 'Y') {
    return true;
  }
  fail('structure.unexpected-payload', `The ${node.tag} payload must be Y or absent`, node.position);
}

export function reqDigits(node: RawNode): number {
  const text = reqText(node);
  if (!/^\d+$/.test(text)) {
    fail('structure.unexpected-payload', `The ${node.tag} payload must be a non-negative integer, got "${text}"`, node.position);
  }
  const value = Number(text);
  if (!Number.isSafeInteger(value)) {
    fail('integer.out-of-range', `The integer "${text}" is beyond the exactly representable range`, node.position);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Children helpers
// ---------------------------------------------------------------------------

export function kids(node: RawNode, tag: string): RawNode[] {
  return node.children.filter((child) => child.tag === tag);
}

/** At most one occurrence; a second is a cardinality error. */
export function one(node: RawNode, tag: string): RawNode | undefined {
  const list = kids(node, tag);
  if (list.length > 1) {
    fail('structure.cardinality', `At most one ${tag} is allowed here`, (list[1] as RawNode).position);
  }
  return list[0];
}

/** Exactly one occurrence. */
export function req(node: RawNode, tag: string): RawNode {
  const found = one(node, tag);
  if (found === undefined) {
    fail('structure.missing-required', `The ${node.tag} structure requires a ${tag} substructure`, node.position);
  }
  return found;
}

/** GEDCOM 5.5.1 {0:3} limits. */
export function atMostThree(node: RawNode, tag: string): RawNode[] {
  const list = kids(node, tag);
  if (list.length > 3) {
    fail('structure.cardinality', `At most 3 ${tag} substructures are allowed`, (list[3] as RawNode).position);
  }
  return list;
}

export function addExtension(out: GedcomStructureBase, node: RawNode): void {
  const list = out.extensions ?? [];
  list.push(parseExtension(node));
  out.extensions = list;
}

export function parseExtension(node: RawNode): ExtensionStructure {
  const payload =
    node.value.kind === 'text' ? node.value.text : node.value.kind === 'pointer' ? node.value.pointer : undefined;
  return {
    tag: node.tag,
    ...(payload === undefined ? {} : { payload }),
    children: node.children.map(parseExtension),
  };
}

export function dispatch(
  node: RawNode,
  out: GedcomStructureBase,
  handlers: Record<string, (child: RawNode) => void>,
  _ctx: Ctx,
  singles: readonly string[] = [],
): void {
  const seen = new Set<string>();
  for (const child of node.children) {
    const handler = handlers[child.tag];
    if (handler === undefined) {
      if (child.tag.startsWith('_')) {
        addExtension(out, child);
        continue;
      }
      fail('structure.unknown-tag', `The tag ${child.tag} is not allowed in this context (${node.tag})`, child.position);
    }
    if (singles.includes(child.tag)) {
      if (seen.has(child.tag)) {
        fail('structure.cardinality', `At most one ${child.tag} is allowed here`, child.position);
      }
      seen.add(child.tag);
    }
    handler(child);
  }
}

// ---------------------------------------------------------------------------
