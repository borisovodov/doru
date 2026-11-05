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
  GedcomError,
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
 * The record tags of the typed grammar (mirrors the record dispatch of
 * parsing/document.ts): used to recognize the Geni.com bare-identifier
 * record dialect (`0 I1234 INDI`), where the identifier sits in the
 * tag position and the record tag in the value.
 */
const RECORD_TAGS: ReadonlySet<string> = new Set([
  'INDI', 'FAM', 'SOUR', 'REPO', 'NOTE', 'OBJE', 'SUBM', 'SUBN', 'SNOTE',
  '_CENR', '_PLAC', '_PLACE', '_LOC', '_PLAC_DEFN', '_PLC',
  '_TODO', '_TASK', '_EVENT_DEFN', '_EVDEF', '_ALIA', '_PUBLISH', '_GRP', '_OCUR',
]);

/**
 * Sanitizes the banned characters of a line value: the C0 control
 * characters other than the horizontal tab, plus DEL. GEDCOM 5.5.1
 * §1 disallows every control character; GEDCOM 5.5.5 (gedcom.org,
 * 2019) legalized the tab in user text ("Tab is Legal": most
 * applications already wrote tabs despite 5.5.1); GEDCOM 7.0 §1.1
 * bans the C1 controls too, but those cannot survive the decoders.
 * The parser accepts the tab in any file.
 *
 * The other controls are real in the wild and carry meaning: the
 * vertical tab (U+000B) is a line break inside note text (the
 * exporters write it where CONT belongs — `Subj: …\vDate: …\vFrom:
 * …`, the LydiaSHargrove and webprowett notes), so it becomes the
 * newline (the CONT semantics the model already carries). The
 * remaining controls are noise — they are dropped, and the line
 * survives (nothing is recorded: the resolution is defined). Only a
 * control character inside a cross-reference identifier stays an
 * error (see checkXref): the identifier itself is broken.
 */
function sanitizeBanned(text: string): string {
  let out = '';
  let changed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 0x0b) {
      out += '\n';
      changed = true;
      continue;
    }
    if ((c <= 0x1f && c !== 0x09) || c === 0x7f) {
      changed = true;
      continue;
    }
    out += text[i] as string;
  }
  return changed ? out : text;
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
  raw = sanitizeBanned(raw);
  // Escape artifacts inside a pointer token (`@<US20>F1@`, the
  // testfiles_sprint3.ged files, and `@<US01>I1@`, the US01–US06
  // test files: a US escape written bare inside the xref) are
  // stripped before the pointer production — the token names the same
  // record without the artifact. A trailing blank after the closing
  // at sign (`1 FAMC @F2@ `) is junk too; the pointer keeps the
  // trimmed token. Values that do not match the production stay text
  // with the raw bytes untouched.
  const stripped = raw.replace(/<US\d+>/g, '');
  if (raw[0] === '@' && !raw.startsWith('@@') && !raw.startsWith('@#') && /^@[A-Za-z0-9_][^@]*@\s*$/.test(stripped)) {
    return { kind: 'pointer', pointer: stripped.trim() };
  }
  // A pointer with a trailing C-style comment (`2 FAMC @F4@ /* note:
  // this ptr is not required but is allowed in 5.5 */`, real hand-built
  // files ship these) parses as the pointer; the comment is silently
  // dropped — it annotates the link, not the linked record, and there
  // is no model slot for it (the full-leniency container rule: the
  // pointer is the only information the value carries).
  const commentedPointer = /^(@[A-Za-z0-9_][^@]*@)\s*\/\*.*\*\/\s*$/.exec(raw);
  if (commentedPointer !== null) {
    return { kind: 'pointer', pointer: commentedPointer[1] as string };
  }
  // The line-comment spelling of the same shape (`1 WIFE @I9@ //
  // Assuming Unknown_spouse`, the gprime imp-sample files): the `//`
  // comment is dropped the same way.
  const lineCommentedPointer = /^(@[A-Za-z0-9_][^@]*@)\s*\/\/.*$/.exec(raw);
  if (lineCommentedPointer !== null) {
    return { kind: 'pointer', pointer: lineCommentedPointer[1] as string };
  }
  // A value that starts with a single @ but does not match the
  // pointer production (a list of pointers, a pointer with a comment
  // suffix, a stray @ before a word) is text: the leading @ is a
  // literal character (the full-leniency container rule — nothing is
  // dropped, nothing is guessed).
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
  // Leading zeroes are tolerated (the full-leniency container rule):
  // real files write `01 GEDC`, and the number value is unambiguous.
  // A missing space after the level (`1GEDC`, files in the wild) is
  // tolerated the same way: the tag starts right after the digits.
  if (text[i] === ' ') {
    i++;
  }

  // Optional cross-reference identifier. The US escape artifact
  // inside an xref (`0 @<US01>I1@ INDI`, the US01–US06 test files)
  // is stripped the same way the pointer-value parser strips it —
  // the record and its pointers must name the same identifier.
  let xref: string | undefined;
  if (text[i] === '@') {
    const close = text.indexOf('@', i + 1);
    if (close === -1) {
      fail('line.bad-xref', 'Unterminated cross-reference identifier', at(i));
    }
    const raw = text.slice(i, close + 1).replace(/<US\d+>/g, '');
    checkXref(raw, at(i));
    xref = raw;
    i = close + 1;
    // A missing space after the xref (`0 @I1@INDI`) is tolerated the
    // same way: the tag starts right after the identifier.
    if (text[i] === ' ') {
      i++;
    }
  }

  // Tag. Extra spaces before the tag are tolerated (the full-leniency
  // container rule: files in the wild write `1  SOUR`).
  while (i < text.length && text[i] === ' ') {
    i++;
  }
  const tagStart = i;
  while (i < text.length && text[i] !== ' ') {
    i++;
  }
  const tag = text.slice(tagStart, i);
  if (tag === '') {
    // A line without a tag (a stray `1 ` or `1  `) is skipped like a
    // blank line.
    return null;
  }
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
export function parseRawDocument(document: DecodedDocument, rule: EscapeRule, errors?: GedcomError[]): RawDocument {
  const roots: RawNode[] = [];
  const stack: RawNode[] = [];
  const seenXrefs = new Set<string>();

  // A document with content but without a single level-0 line is not
  // GEDCOM at all — the corpus carries REXX scripts, ASCII-art design
  // documents, VHDL sources and HTML pages under `.ged`/`.gdz` names.
  // One clear error replaces the per-line bad-level cascade (the
  // full-leniency container rule: the rest of the file is meaningless,
  // and there is nothing to parse line by line).
  const hasContent = document.lines.some((line) => line.text.trim() !== '');
  const hasLevel0 = document.lines.some((line) => /^[ \t]*0+[ \t]/.test(line.text));
  if (hasContent && !hasLevel0) {
    fail('document.not-gedcom', 'The document is not a GEDCOM file: no line starts with a level-0 record', {
      line: 1,
      column: 1,
      offset: 0,
    });
  }

  const attach = (node: RawNode): void => {
    if (node.level === 0) {
      roots.push(node);
      stack.length = 0;
      stack.push(node);
    } else {
      let parent = stack[node.level - 1];
      if (parent === undefined) {
        // A level jump is repaired by attaching the line to the
        // nearest enclosing line (the deepest one with a smaller
        // level), the lenient container rule real files force.
        for (let level = node.level - 2; level >= 0; level--) {
          const candidate = stack[level];
          if (candidate !== undefined) {
            parent = candidate;
            break;
          }
        }
      }
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
        // A duplicate cross-reference identifier: the first occurrence
        // wins (the full-leniency container rule); the later line
        // keeps its identifier in the model but does not re-register.
        return;
      }
      seenXrefs.add(node.xref);
    }
  };

  const mergeContinuation = (target: RawNode, continuation: RawNode, joiner: string): void => {
    // The order rule (a continuation must precede the target's other
    // substructures) is serialization pedantry: the model stores the
    // payload and the children independently, and the emitter writes
    // the continuation first again. A continuation that follows the
    // substructures merges into the payload all the same (the
    // full-leniency container rule — the text is kept).
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

  let sawBlank = false;
  for (const line of document.lines) {
    try {
      // The unleveled-continuation merge: a line without a level
      // number that directly follows a NOTE/TEXT payload merges into
      // it as a newline continuation — human-edited files drop the
      // CONT prefixes (the Gedcom4Sharp Sopranos fixture, the
      // ancestry-quirks fixture, the MyHeritage Hebrew bios under the
      // citation TEXT). A numbered-list marker (`1. Jaume I`, the
      // myheritage sample notes) is free text too: no valid GEDCOM
      // line starts with digits and a dot. The CONC/CONT chain case
      // is covered because a merged continuation leaves its parent on
      // the stack. A blank line ends the run, a pointer-valued note
      // cannot take text, and any other anchor keeps the
      // line.bad-tag/line.bad-level error — those lines have no
      // principled home (the nothing-is-guessed rule).
      const trimmed = line.text.replace(/^[ \t]+/, '');
      const freeText = trimmed.length > 0 && (!DIGIT.test(trimmed[0] as string) || /^\d+\.\s/.test(trimmed));
      if (freeText) {
        const anchor = stack[stack.length - 1];
        if (
          !sawBlank &&
          anchor !== undefined &&
          (anchor.tag === 'NOTE' || anchor.tag === 'TEXT') &&
          anchor.value.kind !== 'pointer'
        ) {
          if (anchor.value.kind === 'absent') {
            anchor.value = { kind: 'text', text: trimmed };
          } else {
            anchor.value = { kind: 'text', text: anchor.value.text + '\n' + trimmed };
          }
          continue;
        }
      }
      let node = tokenizeLine(line, rule);
      if (node === null) {
        // Blank line. The 5.x rule officially ignores extra line
        // terminators only before the first line, but real files carry
        // blank lines anywhere (a quarter of the corpus files fail
        // otherwise), and every major reader skips them: a blank line
        // cannot disturb the hierarchy, the continuation merge, or any
        // value, so the line is dropped silently in any position (see
        // the README's Known strict decisions).
        sawBlank = true;
        continue;
      }
      sawBlank = false;
      // The Geni.com bare-identifier dialect: `0 I1234 INDI` spells the
      // cross-reference identifier without the @ delimiters. The shape
      // is unambiguous — a bare identifier in the tag position with a
      // record tag as the value — so the line is normalized to the
      // standard spelling (the full-leniency container rule).
      if (
        node.level === 0 &&
        node.xref === undefined &&
        !RECORD_TAGS.has(node.tag) &&
        node.value.kind === 'text' &&
        RECORD_TAGS.has(node.value.text)
      ) {
        node = { ...node, xref: `@${node.tag}@`, tag: node.value.text, value: { kind: 'absent' }, valueColumn: 0 };
      }

      // A continuation line extends the payload of its parent line (the
      // enclosing line at level - 1) and must come before any other
      // substructure of that parent.
      if (node.level > 0 && (node.tag === 'CONC' || node.tag === 'CONT')) {
        let parent = stack[node.level - 1];
        if (parent === undefined) {
          fail('line.level-skip', `Level ${node.level} has no enclosing line at level ${node.level - 1}`, node.position);
        }
        // The wrong-level repair: a continuation whose natural target
        // cannot take text (a record line or a pointer) but whose last
        // child chain ends in a text payload continues that text —
        // the exporters drop one level of indentation (`1 NOTE …` +
        // `1 CONT …`, the GenMVD/Geni demo exports; `3 TEXT …` +
        // `2 CONC …`, the myheritage fixture). The immediately
        // preceding text-bearing line is the only candidate — nothing
        // further is guessed.
        if (parent.value.kind !== 'text' && parent.children.length > 0) {
          let candidate = parent.children[parent.children.length - 1];
          while (candidate !== undefined && candidate.children.length > 0) {
            candidate = candidate.children[candidate.children.length - 1];
          }
          if (candidate !== undefined && candidate.value.kind === 'text') {
            parent = candidate;
          }
        }
        mergeContinuation(parent, node, node.tag === 'CONT' ? '\n' : '');
        continue;
      }
      attach(node);
    } catch (error) {
      if (errors !== undefined) {
        // Tolerant mode: the error is recorded and the line is skipped.
        errors.push(error as GedcomError);
        continue;
      }
      throw error;
    }
  }

  return { nodes: roots };
}
