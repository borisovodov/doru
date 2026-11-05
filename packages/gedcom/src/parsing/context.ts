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
  GedcomError,
} from '../errors';
import type {
  RawNode,
} from './lines';
import {
  resolveStandardTagByUri,
} from './schema-tags';

/** The shared state of one parse: the known xrefs, the synthetic
 *  multimedia records synthesized from inline 5.5.1 OBJE links, and
 *  the header's extension declarations. */
export interface Ctx {
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
  /**
   * The HEAD.SCHEMA user-tag labels (the GEDCOM 5.3/FTM schema block,
   * see Header.schema53): each declared tag's context chain (joined
   * with `/`, e.g. `INDI/_FA1`) mapped to its LABL text, filled while
   * the header parses. The FTM `_FA1`–`_FA13` fact handlers resolve
   * their TYPE from it.
   */
  schema53Labels: Map<string, string>;
  /**
   * The error sink of the tolerant parse (see parseTolerant): when
   * present, every error is recorded here (up to
   * MAX_TOLERANT_ERRORS entries) and the offending construct is
   * skipped instead of aborting the parse. Absent in the strict
   * (fail-fast) pipeline.
   */
  errors?: GedcomError[];
}

/** The cap on recorded errors per document (see Ctx.errors). */
export const MAX_TOLERANT_ERRORS = 10_000;

/** Records an error in tolerant mode; returns true when the caller
 *  should skip the offending construct, false when the error should
 *  propagate (strict mode). The list is capped: a cascade (one broken
 *  line orphaning thousands of others) would otherwise dominate the
 *  report with duplicates of the same root cause. */
export function tolerate(ctx: Ctx, error: unknown): boolean {
  if (ctx.errors === undefined) {
    return false;
  }
  if (ctx.errors.length < MAX_TOLERANT_ERRORS) {
    ctx.errors.push(error as GedcomError);
  }
  return true;
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
  if (pointer === '@VOID@') {
    return pointer;
  }
  if (!ctx.xrefs.has(pointer)) {
    fail('document.xref-not-found', `Pointer ${pointer} does not match any cross-reference identifier`, node.position);
  }
  return pointer;
}

export function reqPtr(node: RawNode, ctx: Ctx): string {
  if (node.value.kind !== 'pointer') {
    // The Geni.com bare-identifier dialect writes pointers without
    // the @ delimiters (`1 FAMC F0515745826`, and files in the wild
    // bare numeric ids: `1 CHIL 0515745826`): the identifier shape
    // is unambiguous, so the value is wrapped into the standard
    // spelling (the full-leniency container rule). A dangling target
    // is dropped like any other dangling pointer.
    if (node.value.kind === 'text' && /^[A-Za-z0-9_]+$/.test(node.value.text)) {
      return resolvePtr(`@${node.value.text}@`, ctx, node);
    }
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

/** The optional `Y` assertion payload. A non-`Y` text payload is kept
 *  verbatim (the full-leniency container rule — files in the wild put
 *  descriptive text on the event line). */
export function yFlag(node: RawNode): true | string | undefined {
  if (node.value.kind === 'absent') {
    return undefined;
  }
  if (node.value.kind === 'text') {
    if (node.value.text === 'Y') {
      return true;
    }
    return node.value.text;
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
    // First occurrence wins (the full-leniency container rule).
    return list[0];
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

/** GEDCOM 5.5.1 {0:3} limits. The later entries beyond the third are
 *  dropped (the full-leniency container rule: first occurrences win). */
export function atMostThree(node: RawNode, tag: string): RawNode[] {
  return kids(node, tag).slice(0, 3);
}

export function addExtension(out: GedcomStructureBase, node: RawNode, ctx: Ctx): void {
  const list = out.extensions ?? [];
  list.push(parseExtension(node, ctx));
  out.extensions = list;
}

/**
 * Canonicalizes the record-level contacts (REPO/SUBM/CORP): the
 * contact substructures PHON/EMAIL/FAX/WWW belong to the
 * ADDRESS_STRUCTURE (siblings of ADDR, GEDCOM 5.5.1 §2 p.31), so
 * contacts parsed beside an ADDR are relocated into the address block
 * in every file. Contacts without an address block stay at the record
 * level (the lenient floating form). Called after a record has
 * finished parsing.
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

/** Builds one extension node (payload handling shared by the
 *  iterative walker below). */
function extensionOf(node: RawNode): ExtensionStructure {
  const out: ExtensionStructure = {
    tag: node.tag,
    ...(node.xref === undefined ? {} : { xref: node.xref }),
    children: [],
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

export function parseExtension(node: RawNode, ctx: Ctx): ExtensionStructure {
  void ctx;
  // An iterative depth-first build: a hand-made file can nest
  // thousands of levels (the vscode-gedcom "numbered list" fixture
  // nests 9000), and a recursive build would blow the JS stack.
  const root = extensionOf(node);
  const stack: Array<{ parent: ExtensionStructure; siblings: RawNode[]; index: number }> = [
    { parent: root, siblings: node.children, index: 0 },
  ];
  while (stack.length > 0) {
    const frame = stack[stack.length - 1] as { parent: ExtensionStructure; siblings: RawNode[]; index: number };
    if (frame.index >= frame.siblings.length) {
      stack.pop();
      continue;
    }
    const child = frame.siblings[frame.index] as RawNode;
    frame.index += 1;
    const out = extensionOf(child);
    frame.parent.children.push(out);
    stack.push({ parent: out, siblings: child.children, index: 0 });
  }
  return root;
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
): void {
  const seen = new Set<string>();
  for (const child of node.children) {
    let tag = child.tag;
    let resolved: RawNode = child;
    if (handlers[tag] === undefined && tag.startsWith('_')) {
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
      // A tag the typed grammar has no slot for — an underscore
      // extension tag, a non-underscore vendor tag, or a standard
      // tag in a position the standard does not define — becomes a
      // generic extension structure, preserved verbatim. This is
      // the full-leniency tag rule (see the README's Known strict
      // decisions): the tag's meaning stays in the pile instead of
      // failing the import; unknown tags are never rejected by
      // spelling.
      addExtension(out, child, ctx);
      continue;
    }
    if (singles.includes(tag)) {
      if (seen.has(tag)) {
        // First occurrence wins (the full-leniency container rule):
        // the later line is dropped silently.
        continue;
      }
      seen.add(tag);
    }
    try {
      (handlers[tag] as (child: RawNode) => void)(resolved);
    } catch (error) {
      const err = error as { code?: string; position?: { line?: number } };
      if (err.code === 'structure.missing-payload' && err.position?.line === child.position.line) {
        // A line whose required payload is absent (or a pointer in a
        // text slot) is retried with the value coerced to text — the
        // original pointer string survives, an absent payload becomes
        // the empty text (the full-leniency container rule, see the
        // README's Known strict decisions): real files ship bare
        // `1 NAME`, `1 SUBN`, `1 OCCU`, `2 SOUR` and `1 TITL @R5@`
        // lines, and keeping the line with an empty payload loses
        // less than dropping it — its substructures survive. The
        // repair is a resolution: nothing is recorded when it
        // succeeds. When the retry fails too (pointer slots with no
        // value), the line is dropped — that case has no resolution,
        // and the error is recorded.
        const coerced: RawNode = {
          ...resolved,
          value: resolved.value.kind === 'pointer' ? { kind: 'text', text: resolved.value.pointer } : { kind: 'text', text: '' },
          valueColumn: 0,
        };
        try {
          (handlers[tag] as (child: RawNode) => void)(coerced);
        } catch {
          // The line is dropped. A bare line carries no data — the
          // drop is a resolution and stays silent. A line that had a
          // value the slot cannot keep (a text in a pointer slot)
          // loses data — that drop is the unresolved error.
          if (resolved.value.kind !== 'absent') {
            void tolerate(ctx, error);
          }
        }
        continue;
      }
      if (err.code === 'structure.unexpected-payload' && err.position?.line === child.position.line) {
        // A line carrying a stray value parses without it (the
        // full-leniency container rule). The repair is a resolution:
        // nothing is recorded when it succeeds.
        try {
          (handlers[tag] as (child: RawNode) => void)({ ...resolved, value: { kind: 'absent' }, valueColumn: 0 });
        } catch (retryError) {
          void tolerate(ctx, error);
          throw retryError;
        }
        continue;
      }
      if (err.code === 'document.xref-not-found' && err.position?.line === child.position.line) {
        // A dangling pointer link is dropped silently: the target
        // record is not in the document, and the link carries
        // nothing without it — the pointer string alone is
        // meaningless, so it is neither imported nor recorded as an
        // error (the resolution is defined: drop the dead link).
        continue;
      }
      if (tolerate(ctx, error)) {
        // Tolerant mode: the error is recorded and the line is skipped.
        continue;
      }
      throw error;
    }
  }
}

// ---------------------------------------------------------------------------
