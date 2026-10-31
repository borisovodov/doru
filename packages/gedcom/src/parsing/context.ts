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
  ImportFileReference,
  MultimediaRecord,
} from '../structures';
import type {
  GedcomVersion,
} from '../primitives';
import type {
  RawNode,
} from './lines';
import {
  NON_UNDERSCORE_VENDOR_TAGS,
} from './vendor-tags';
import {
  resolveStandardTagByUri,
} from './schema-tags';

/** The declared specification version of the document being parsed. */
export interface Ctx {
  version: GedcomVersion;
  xrefs: Set<string>;
  synthetic: MultimediaRecord[];
  syntheticIndex: number;
  /**
   * The HEAD.SCHMA tag definitions (GEDCOM 7.0 §2.14): each extension
   * tag and the URIs it abbreviates within this document, filled while
   * the header parses. GEDCOM 7.0 §1.5.1 permits one tag for several
   * URIs when the named concepts cannot appear in the same place; the
   * declaration order is kept and the context picks the meaning (see
   * resolveDocumentedTag and parsing/document.ts).
   */
  schemaTags: Map<string, string[]>;
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

export function addExtension(out: GedcomStructureBase, node: RawNode, ctx: Ctx): void {
  const list = out.extensions ?? [];
  list.push(parseExtension(node, ctx));
  out.extensions = list;
}

/**
 * Canonicalizes the 5.5.1 record-level contacts (REPO/SUBM/CORP): the
 * contact substructures PHON/EMAIL/FAX/WWW belong to the
 * ADDRESS_STRUCTURE (siblings of ADDR, GEDCOM 5.5.1 §2 p.31), so
 * contacts parsed beside an ADDR are relocated into the address block.
 * Contacts without an address block stay at the record level (the
 * lenient floating form). Called after a record has finished parsing
 * (5.5.1 input only).
 */
export function merge551RecordContacts(rec: {
  address?: { phone?: string[]; email?: string[]; fax?: string[]; www?: string[] };
  phone?: string[];
  email?: string[];
  fax?: string[];
  www?: string[];
}): void {
  const address = rec.address;
  if (address === undefined) {
    return;
  }
  if (rec.phone !== undefined) {
    address.phone = [...(address.phone ?? []), ...rec.phone];
    delete rec.phone;
  }
  if (rec.email !== undefined) {
    address.email = [...(address.email ?? []), ...rec.email];
    delete rec.email;
  }
  if (rec.fax !== undefined) {
    address.fax = [...(address.fax ?? []), ...rec.fax];
    delete rec.fax;
  }
  if (rec.www !== undefined) {
    address.www = [...(address.www ?? []), ...rec.www];
    delete rec.www;
  }
}

export function parseExtension(node: RawNode, ctx: Ctx): ExtensionStructure {
  const out: ExtensionStructure = {
    tag: node.tag,
    ...(node.xref === undefined ? {} : { xref: node.xref }),
    children: node.children.map((child) => parseExtension(child, ctx)),
  };
  if (node.value.kind === 'text') {
    out.payload = node.value.text;
  } else if (node.value.kind === 'pointer') {
    // A pointer-shaped payload (see ExtensionStructure.payloadKind).
    // It is marked but deliberately NOT resolved: the official
    // FamilySearch 7.0 corpus itself ships pointer-shaped text in
    // extension payloads (extensions.ged: `1 _IN @B1@` with no @B1@
    // record — the extension defines the payload as an identifier, not
    // a record pointer), so failing on an unresolved target would
    // reject valid-in-practice files. The mark lets the serializers
    // protect the payload against the projections that drop records
    // (see serialize/prepare.ts).
    out.payload = node.value.pointer;
    out.payloadKind = 'pointer';
  }
  return out;
}

/**
 * Parses the GDO `_IMPF` import-file reference (see
 * ImportFileReference): the record's cross-reference in the file it
 * was imported from (a free text value — it names a record of another
 * file and is not resolved against this document's xrefs) plus the
 * PAGE child holding the imported file's id.
 */
export function parseImportReference(node: RawNode, ctx: Ctx): ImportFileReference {
  const out: ImportFileReference = {
    tag: '_IMPF',
    ...(node.value.kind === 'text'
      ? { record: node.value.text }
      : node.value.kind === 'pointer' ? { record: node.value.pointer } : {}),
  };
  dispatch(
    node,
    out,
    {
      PAGE: (child) => {
        out.page = reqText(child);
      },
    },
    ctx,
    ['PAGE'],
  );
  return out;
}

/**
 * Resolves a SCHMA-documented extension tag against the handlers of the
 * current context (GEDCOM 7.0 §1.5.1): a tag may be declared with
 * several URIs when the named concepts cannot appear in the same place,
 * so the context picks the meaning. The standard tag named by the one
 * URI that has a slot here wins ("standard-first", see
 * parsing/schema-tags.ts); several matching URIs or none keep the
 * extension meaning (guessing would invent data).
 */
function resolveDocumentedTag(
  tag: string,
  ctx: Ctx,
  handlers: Record<string, (child: RawNode) => void>,
): string | undefined {
  const uris = ctx.schemaTags.get(tag);
  if (uris === undefined) {
    return undefined;
  }
  let found: string | undefined;
  for (const uri of uris) {
    const standard = resolveStandardTagByUri(uri);
    if (standard === undefined || handlers[standard] === undefined) {
      continue;
    }
    if (found !== undefined && found !== standard) {
      // Two declarations both name a standard structure with a slot
      // here; the spec forbids such reuse in one place, so the tag
      // keeps its extension meaning rather than guessing.
      return undefined;
    }
    found = standard;
  }
  return found;
}

export function dispatch(
  node: RawNode,
  out: GedcomStructureBase,
  handlers: Record<string, (child: RawNode) => void>,
  ctx: Ctx,
  singles: readonly string[] = [],
  fallback: 'error' | 'extension' = 'error',
): void {
  const seen = new Set<string>();
  for (const child of node.children) {
    let tag = child.tag;
    let resolved: RawNode = child;
    if (handlers[tag] === undefined && tag.startsWith('_') && ctx.version === '7.0') {
      // A SCHMA-documented extension tag whose URI names a standard
      // structure type with a slot here parses as that structure —
      // standard-first (see parsing/schema-tags.ts). A documented tag
      // without a slot here keeps its extension meaning and stays
      // generic.
      const standard = resolveDocumentedTag(tag, ctx, handlers);
      if (standard !== undefined) {
        tag = standard;
        resolved = { ...child, tag: standard };
      }
    }
    if (handlers[tag] === undefined) {
      if (tag.startsWith('_')) {
        addExtension(out, child, ctx);
        continue;
      }
      if (ctx.version === '5.5.1' && NON_UNDERSCORE_VENDOR_TAGS.has(tag)) {
        // The non-underscore vendor tags of 5.x (see vendor-tags.ts):
        // accepted as generic extensions where the standard grammar has
        // no slot for them. 7.0 input stays strict.
        addExtension(out, child, ctx);
        continue;
      }
      if (fallback === 'extension') {
        // An extension record's grammar is defined by the extension
        // itself (GEDCOM 7.0 §1.5): a standard tag the typed grammar
        // does not know is an extension-defined substructure and is
        // preserved verbatim instead of failing the import.
        addExtension(out, child, ctx);
        continue;
      }
      fail('structure.unknown-tag', `The tag ${tag} is not allowed in this context (${node.tag})`, child.position);
    }
    if (singles.includes(tag)) {
      if (seen.has(tag)) {
        fail('structure.cardinality', `At most one ${tag} is allowed here`, child.position);
      }
      seen.add(tag);
    }
    (handlers[tag] as (child: RawNode) => void)(resolved);
  }
}

// ---------------------------------------------------------------------------
