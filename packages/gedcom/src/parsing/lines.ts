/**
 * The line tokenizer and raw tree builder shared by the GEDCOM parsers.
 *
 * This layer validates the container format (GEDCOM 7.0 chapter 1 /
 * GEDCOM 5.5.1 chapter 1): levels, delimiters, tags, cross-reference
 * identifiers, pointers, escaped at-signs, escape sequences,
 * continuation lines and banned characters. The container rules are
 * the most lenient of the supported versions per dimension, so the
 * same bytes tokenize identically whatever version the file declares
 * (see the README's Known strict decisions). It does not
 * interpret the lineage-linked semantics — the assemblers do that.
 */

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
const TAG_CHAR_551 = /[A-Za-z0-9_]/;
const ALPHANUM_551 = /[A-Za-z0-9_]/;

/**
 * Checks the banned-character rule in a line value: the C0
 * control characters other than the horizontal tab, plus DEL. GEDCOM
 * 5.5.1 §1 disallows every control character; GEDCOM 5.5.5 (gedcom.org,
 * 2019) legalized the tab in user text ("Tab is Legal": most
 * applications already wrote tabs despite 5.5.1); GEDCOM 7.0 §1.1 bans
 * the C1 controls too, but those cannot survive the decoders. The
 * the parser accepts the tab in any file and bans the other C0
 * controls and DEL — the most lenient of the supported rules (see the
 * README's "Known strict decisions").
 */
function checkBanned(text: string, position: SourcePosition): void {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if ((c <= 0x1f && c !== 0x09) || c === 0x7f) {
      fail('line.banned-char', `Banned character U+${c.toString(16).toUpperCase()} in a line value`, {
        ...position,
        column: position.column + i,
      });
    }
  }
}

/** Validates a cross-reference identifier (the 5.x rule: alphanumeric
 *  body, no number-sign start, no control characters). */
function checkXref(raw: string, position: SourcePosition): void {
  const body = raw.slice(1, -1);
  if (body.length === 0) {
    fail('line.bad-xref', 'A cross-reference identifier must not be empty', position);
  }
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

/** Validates a tag (the 5.x rule: alphanumeric characters and the
 *  underscore). */
function checkTag(tag: string, position: SourcePosition): void {
  if (tag.length === 0) {
    fail('line.bad-tag', 'A line must have a tag', position);
  }
  for (let i = 0; i < tag.length; i++) {
    if (!TAG_CHAR_551.test(tag[i] as string)) {
      fail('line.bad-tag', `Invalid character "${tag[i]}" in tag "${tag}"`, {
        ...position,
        column: position.column + i,
      });
    }
  }
}

/**
 * The at-sign escaping convention of a document: GEDCOM 7.0 §1.3
 * doubles only the *first* at sign of a line value (interior `@@` is
 * two literal at signs — the official FamilySearch escapes.ged test
 * file exercises this), while GEDCOM 5.5.1 doubles every at sign. The
 * bytes are ambiguous without the declaration, so the convention is
 * read from the declared GEDC.VERS (like the charset declaration, it
 * is a self-description of the document, not a grammar selection).
 */
export type EscapeRule = '7.0' | '5.5.1';

/**
 * Parses a line value: a pointer or text with the document's at-sign
 * escape rule (a `@#…@` escape sequence is kept verbatim in either
 * rule; the calendar escapes it carries are the date parser's).
 */
function parseValue(raw: string, rule: EscapeRule, position: SourcePosition): RawValue {
  checkBanned(raw, position);
  if (raw[0] === '@' && !raw.startsWith('@@') && !raw.startsWith('@#')) {
    if (!/^@[A-Za-z0-9_][^@]*@$/.test(raw)) {
      fail('line.unescaped-at', 'A single @ in a line value must start a pointer or an escape, or be doubled', position);
    }
    return { kind: 'pointer', pointer: raw };
  }
  // Text with @@ unescaping and @#…@ escapes (a single space after an
  // escape is discarded). The 7.0 rule unescapes only the leading pair;
  // the 5.5.1 rule unescapes every pair.
  let out = '';
  let i = 0;
  while (i < raw.length) {
    const c = raw[i] as string;
    if (c === '@' && raw[i + 1] === '@' && (rule === '5.5.1' || i === 0)) {
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
      // A lone interior @ is tolerated as a literal character: real
      // files (the canonical Legacy custom-tags sample ships
      // `matt@gecom4j.org`, and emails break the doubling rule all the
      // time) carry unescaped @ inside text values, and every major
      // reader accepts them. The ambiguity the doubling rule guards
      // against exists only at the start of the value, which the
      // pointer/escape check above already resolves; the writers still
      // double the at sign on export.
      out += c;
      i++;
      continue;
    }
    out += c;
    i++;
  }
  return { kind: 'text', text: out };
}

/**
 * Tokenizes one decoded line. Returns null for blank lines (the caller
 * decides whether that is an error). The value is returned with `@@`
 * unescaped per the document's escape rule and the space after an
 * escape discarded.
 */
function tokenizeLine(line: DecodedLine, rule: EscapeRule): RawNode | null {
  const linePosition: SourcePosition = { line: line.line, column: 1, offset: line.offset };
  let text = line.text;
  let trimCount = 0;

  // Leading white space is ignored by reading systems (the 5.x rule;
  // leading whitespace is trimmed in every file).
  const match = /^[ \t]+/.exec(text);
  if (match) {
    trimCount = match[0].length;
    text = text.slice(trimCount);
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
    checkXref(raw, at(i));
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
  checkTag(tag, at(tagStart));
  const valueColumn = i < text.length ? trimCount + i + 2 : 0;
  if (i < text.length) {
    i++; // Skip the single delimiter; the rest is the value.
  }

  // Value.
  let value: RawValue = { kind: 'absent' };
  if (i < text.length) {
    value = parseValue(text.slice(i), rule, at(i));
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
 * collection and CONT/CONC continuation merging. The values are
 * unescaped per the document's declared at-sign rule (see EscapeRule).
 */
export function parseRawDocument(document: DecodedDocument, rule: EscapeRule): RawDocument {
  const roots: RawNode[] = [];
  const stack: RawNode[] = [];
  let sawContent = false;
  const seenXrefs = new Set<string>();

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
      if (node.level > 0 && !node.tag.startsWith('_')) {
        fail('line.xref-on-substructure', 'A cross-reference identifier is only allowed on a record or on a tagged extension structure', node.position);
      }
      if (seenXrefs.has(node.xref)) {
        fail('document.duplicate-xref', `Duplicate cross-reference identifier ${node.xref}`, node.position);
      }
      seenXrefs.add(node.xref);
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
      if (target.value.kind === 'absent') {
        // Real files continue an empty payload: the canonical Legacy
        // sample writes `0 @N1@ NOTE` + `1 CONC text`. Tolerated — the
        // empty payload becomes the empty string and the continuation
        // merges into it.
        target.value = { kind: 'text', text: '' };
      } else {
        fail(
          'line.continuation-no-payload',
          `A ${continuation.tag} line has no text payload to continue`,
          continuation.position,
        );
      }
    }
    if (continuation.value.kind === 'pointer') {
      fail('line.continuation-no-payload', 'A continuation line must not carry a pointer', continuation.position);
    }
    const extra = continuation.value.kind === 'text' ? continuation.value.text : '';
    target.value = { kind: 'text', text: target.value.text + joiner + extra };
  };

  for (const line of document.lines) {
    const node = tokenizeLine(line, rule);
    if (node === null) {
      // Blank line. Reading systems ignore extra line terminators
      // before the first line (the 5.x rule; they are accepted
      // them in every file).
      if (!sawContent) {
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
