/**
 * The strict line tokenizer and raw tree builder shared by the GEDCOM 7.0
 * and 5.5.1 parsers.
 *
 * This layer validates the container format (GEDCOM 7.0 chapter 1 /
 * GEDCOM 5.5.1 chapter 1): levels, delimiters, tags, cross-reference
 * identifiers, pointers, escaped at-signs, 5.5.1 escape sequences,
 * continuation lines and banned characters. It does not interpret the
 * lineage-linked semantics — the per-version assemblers do that.
 */

import type {
  GedcomVersion,
} from '../primitives';
import type {
  SourcePosition,
} from '../errors';
import {
  fail,
} from '../errors';
import type {
  DecodedDocument,
  DecodedLine,
} from './decode';


/** The payload of one raw line after continuation merging. */
export type RawValue =
  | { kind: 'absent' }
  | { kind: 'text'; text: string }
  | { kind: 'pointer'; pointer: string };

/** One raw structure node (a record or a substructure). */
export interface RawNode {
  level: number;
  tag: string;
  xref?: string;
  value: RawValue;
  /** Position of the line start. */
  position: SourcePosition;
  /** Column (1-based) where the value starts; 0 when there is none. */
  valueColumn: number;
  children: RawNode[];
}

/** The raw document: level-0 nodes in order. */
export interface RawDocument {
  nodes: RawNode[];
}

const DIGIT = /[0-9]/;
const UPPER = /[A-Z]/;
const TAG_CHAR = /[A-Z0-9_]/;
const TAG_CHAR_551 = /[A-Za-z0-9_]/;
const XREF_CHAR = /[A-Z0-9_]/;
const ALPHANUM_551 = /[A-Za-z0-9_]/;

/** Checks GEDCOM 7.0 §1.1 banned characters in a value. */
function checkBanned70(text: string, position: SourcePosition): void {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    const banned =
      (c <= 0x1f && c !== 0x09) ||
      c === 0x7f ||
      (c >= 0x80 && c <= 0x9f) ||
      (c >= 0xd800 && c <= 0xdfff) ||
      c === 0xfffe ||
      c === 0xffff;
    if (banned) {
      fail('line.banned-char', `Banned character U+${c.toString(16).toUpperCase()} in a line value`, {
        ...position,
        column: position.column + i,
      });
    }
  }
}

/** Checks GEDCOM 5.5.1 banned characters (control chars, DEL) in a value. */
function checkBanned551(text: string, position: SourcePosition): void {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c <= 0x1f || c === 0x7f) {
      fail('line.banned-char', `Banned character U+${c.toString(16).toUpperCase()} in a line value`, {
        ...position,
        column: position.column + i,
      });
    }
  }
}

/** Validates a cross-reference identifier per version. */
function checkXref(raw: string, version: GedcomVersion, position: SourcePosition): void {
  const body = raw.slice(1, -1);
  if (body.length === 0) {
    fail('line.bad-xref', 'A cross-reference identifier must not be empty', position);
  }
  if (version === '7.0') {
    for (let i = 0; i < body.length; i++) {
      if (!XREF_CHAR.test(body[i] as string)) {
        fail(
          'line.bad-xref',
          `Invalid character "${body[i]}" in a cross-reference identifier; only uppercase letters, digits and underscores are allowed`,
          { ...position, column: position.column + 1 + i },
        );
      }
    }
  } else {
    if (body[0] === '#') {
      fail('line.bad-xref', 'A cross-reference identifier must not begin with a number sign', {
        ...position,
        column: position.column + 1,
      });
    }
    if (!ALPHANUM_551.test(body[0] as string)) {
      fail('line.bad-xref', `Invalid first character "${body[0]}" in a cross-reference identifier`, {
        ...position,
        column: position.column + 1,
      });
    }
    for (let i = 1; i < body.length; i++) {
      const c = body.charCodeAt(i);
      if (c <= 0x1f || c === 0x7f) {
        fail('line.banned-char', 'Control characters are not allowed in a cross-reference identifier', {
          ...position,
          column: position.column + 1 + i,
        });
      }
    }
  }
}

/** Validates a tag per version. */
function checkTag(tag: string, version: GedcomVersion, position: SourcePosition): void {
  if (tag.length === 0) {
    fail('line.bad-tag', 'A line must have a tag', position);
  }
  if (version === '7.0') {
    const isStd = UPPER.test(tag[0] as string);
    const isExt = tag[0] === '_' && tag.length > 1;
    if (!isStd && !isExt) {
      fail(
        'line.bad-tag',
        `Invalid tag "${tag}": standard tags start with an uppercase letter, extension tags with an underscore`,
        position,
      );
    }
    const bodyStart = isExt ? 1 : 0;
    for (let i = bodyStart; i < tag.length; i++) {
      if (!TAG_CHAR.test(tag[i] as string)) {
        fail('line.bad-tag', `Invalid character "${tag[i]}" in tag "${tag}"`, {
          ...position,
          column: position.column + i,
        });
      }
    }
  } else {
    for (let i = 0; i < tag.length; i++) {
      if (!TAG_CHAR_551.test(tag[i] as string)) {
        fail('line.bad-tag', `Invalid character "${tag[i]}" in tag "${tag}"`, {
          ...position,
          column: position.column + i,
        });
      }
    }
  }
}

/**
 * Parses a line value: a pointer, void pointer (7.0), or text with the
 * version's at-sign and escape rules.
 */
function parseValue(raw: string, version: GedcomVersion, position: SourcePosition): RawValue {
  if (version === '7.0') {
    checkBanned70(raw, position);
    if (raw[0] === '@') {
      if (raw === '@VOID@') {
        return { kind: 'pointer', pointer: raw };
      }
      const xrefMatch = /^@[A-Z0-9_]+@$/.exec(raw);
      if (xrefMatch) {
        return { kind: 'pointer', pointer: raw };
      }
      if (raw.startsWith('@@')) {
        return { kind: 'text', text: raw.slice(1) };
      }
      fail('line.unescaped-at', 'A line value beginning with a single @ must be a pointer or must double the @', position);
    }
    return { kind: 'text', text: raw };
  }

  checkBanned551(raw, position);
  if (raw[0] === '@' && !raw.startsWith('@@') && !raw.startsWith('@#')) {
    if (!/^@[A-Za-z0-9_][^@]*@$/.test(raw)) {
      fail('line.unescaped-at', 'A single @ in a line value must start a pointer or an escape, or be doubled', position);
    }
    return { kind: 'pointer', pointer: raw };
  }
  // Text with @@ doubling and @#…@ escapes (a single space after an
  // escape is discarded).
  let out = '';
  let i = 0;
  while (i < raw.length) {
    const c = raw[i] as string;
    if (c === '@' && raw[i + 1] === '@') {
      out += '@';
      i += 2;
      continue;
    }
    if (c === '@' && raw[i + 1] === '#') {
      const close = raw.indexOf('@', i + 2);
      if (close === -1) {
        fail('line.bad-escape', 'Unterminated escape sequence', { ...position, column: position.column + i });
      }
      out += raw.slice(i, close + 1);
      i = close + 1;
      continue;
    }
    if (c === '@') {
      fail('line.unescaped-at', 'A single @ in a line value must start a pointer or an escape, or be doubled', {
        ...position,
        column: position.column + i,
      });
    }
    out += c;
    i++;
  }
  return { kind: 'text', text: out };
}

/**
 * Tokenizes one decoded line. Returns null for blank lines (the caller
 * decides whether that is an error). The value is returned with `@@`
 * unescaped and, for 5.5.1, the space after an escape discarded.
 */
function tokenizeLine(line: DecodedLine, version: GedcomVersion): RawNode | null {
  const linePosition: SourcePosition = { line: line.line, column: 1, offset: line.offset };
  let text = line.text;
  let trimCount = 0;

  if (version === '5.5.1') {
    // GEDCOM 5.5.1: leading white space is ignored by reading systems.
    const match = /^[ \t]+/.exec(text);
    if (match) {
      trimCount = match[0].length;
      text = text.slice(trimCount);
    }
  }
  if (text.length === 0) {
    return null;
  }
  if (text[0] === ' ' || text[0] === '\t') {
    fail('line.leading-whitespace', 'Leading white space before the level is prohibited', linePosition);
  }
  // Column of text[i] is trimCount + i + 1.
  const at = (i: number): SourcePosition => ({ ...linePosition, column: trimCount + i + 1 });

  // Level.
  let level = 0;
  let i = 0;
  while (i < text.length && DIGIT.test(text[i] as string)) {
    level = level * 10 + (text.charCodeAt(i) - 48);
    i++;
  }
  if (i === 0) {
    fail('line.bad-level', `Expected a level number at the start of the line, got "${text[0]}"`, linePosition);
  }
  if (i > 1 && text[0] === '0') {
    fail('line.bad-level', 'Level numbers must not have leading zeroes', linePosition);
  }
  if (version === '5.5.1' && level > 99) {
    fail('line.level-limit', `Level ${level} exceeds the 5.5.1 maximum of 99`, linePosition);
  }
  if (text[i] !== ' ') {
    fail('line.missing-delimiter', 'A level number must be followed by a single space', at(i));
  }
  i++;

  // Optional cross-reference identifier.
  let xref: string | undefined;
  if (text[i] === '@') {
    const close = text.indexOf('@', i + 1);
    if (close === -1) {
      fail('line.bad-xref', 'Unterminated cross-reference identifier', at(i));
    }
    const raw = text.slice(i, close + 1);
    checkXref(raw, version, at(i));
    if (version === '7.0' && raw === '@VOID@') {
      fail('line.bad-xref', '@VOID@ is a pointer value, not a cross-reference identifier', at(i));
    }
    xref = raw;
    i = close + 1;
    if (text[i] !== ' ') {
      fail('line.missing-delimiter', 'A cross-reference identifier must be followed by a single space', at(i));
    }
    i++;
  }

  // Tag.
  const tagStart = i;
  while (i < text.length && text[i] !== ' ') {
    i++;
  }
  const tag = text.slice(tagStart, i);
  checkTag(tag, version, at(tagStart));
  const valueColumn = i < text.length ? trimCount + i + 2 : 0;
  if (i < text.length) {
    i++; // Skip the single delimiter; the rest is the value.
  }

  // Value.
  let value: RawValue = { kind: 'absent' };
  if (i < text.length) {
    value = parseValue(text.slice(i), version, at(i));
  }

  return {
    level,
    tag,
    ...(xref === undefined ? {} : { xref }),
    value,
    position: linePosition,
    valueColumn,
    children: [],
  };
}

/**
 * Builds the raw tree from decoded lines: level hierarchy, xref
 * collection and CONT/CONC continuation merging.
 */
export function parseRawDocument(document: DecodedDocument, version: GedcomVersion): RawDocument {
  const roots: RawNode[] = [];
  const stack: RawNode[] = [];
  let sawContent = false;
  let lastXref: string | null = null;

  const attach = (node: RawNode): void => {
    if (node.level === 0) {
      roots.push(node);
      stack.length = 0;
      stack.push(node);
    } else {
      const parent = stack[node.level - 1];
      if (parent === undefined) {
        fail('line.level-skip', `Level ${node.level} has no enclosing line at level ${node.level - 1}`, node.position);
      }
      parent.children.push(node);
      stack.length = node.level;
      stack.push(node);
    }
    if (node.xref !== undefined) {
      if (node.level > 0) {
        fail('line.xref-on-substructure', 'A cross-reference identifier is only allowed on a record (level 0)', node.position);
      }
      if (lastXref === node.xref) {
        fail('document.duplicate-xref', `Duplicate cross-reference identifier ${node.xref}`, node.position);
      }
      lastXref = node.xref;
    }
  };

  const mergeContinuation = (target: RawNode, continuation: RawNode, joiner: string): void => {
    if (target.children.length > 0) {
      fail(
        'line.continuation-out-of-order',
        'A continuation line must immediately follow the line it continues, before any other substructures',
        continuation.position,
      );
    }
    if (target.value.kind !== 'text') {
      fail(
        'line.continuation-no-payload',
        `A ${continuation.tag} line has no text payload to continue`,
        continuation.position,
      );
    }
    if (continuation.value.kind === 'pointer') {
      fail('line.continuation-no-payload', 'A continuation line must not carry a pointer', continuation.position);
    }
    const extra = continuation.value.kind === 'text' ? continuation.value.text : '';
    target.value = { kind: 'text', text: target.value.text + joiner + extra };
  };

  for (const line of document.lines) {
    const node = tokenizeLine(line, version);
    if (node === null) {
      // Blank line. 5.5.1 reading systems ignore extra line terminators
      // before the first line.
      if (!sawContent && version === '5.5.1') {
        continue;
      }
      fail('line.blank', 'Blank lines are not allowed in a GEDCOM transmission', {
        line: line.line,
        column: 1,
        offset: line.offset,
      });
    }
    sawContent = true;

    // A continuation line extends the payload of its parent line (the
    // enclosing line at level - 1) and must come before any other
    // substructure of that parent.
    if (node.level > 0 && (node.tag === 'CONC' || node.tag === 'CONT')) {
      if (node.tag === 'CONC' && version === '7.0') {
        fail('line.reserved-tag', 'CONC is reserved in GEDCOM 7.0 and must not appear', node.position);
      }
      const parent = stack[node.level - 1];
      if (parent === undefined) {
        fail('line.level-skip', `Level ${node.level} has no enclosing line at level ${node.level - 1}`, node.position);
      }
      mergeContinuation(parent, node, node.tag === 'CONT' ? '\n' : '');
      continue;
    }
    attach(node);
  }

  return { nodes: roots };
}
