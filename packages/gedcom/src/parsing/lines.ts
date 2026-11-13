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

import type { GedcomError, SourcePosition } from '../errors';
import { fail } from '../errors';
import type { DecodedDocument, DecodedLine } from './decode';

/** The payload of one raw line after continuation merging. */
export type RawValue = { kind: 'absent' } | { kind: 'text'; text: string } | { kind: 'pointer'; pointer: string };

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
  'INDI',
  'FAM',
  'SOUR',
  'REPO',
  'NOTE',
  'OBJE',
  'SUBM',
  'SUBN',
  'SNOTE',
  '_CENR',
  '_PLAC',
  '_PLACE',
  '_LOC',
  '_PLAC_DEFN',
  '_PLC',
  '_TODO',
  '_TASK',
  '_EVENT_DEFN',
  '_EVDEF',
  '_ALIA',
  '_PUBLISH',
  '_GRP',
  '_OCUR',
]);

/** The shape of a real GEDCOM tag: the upper-case alphabet, digits and
 *  the underscore (both standards; the vendor catalogs keep the
 *  spelling). Prose words inside note text are lowercase (`jaar`,
 *  `children`) or carry punctuation (`-05-1857`) — the digit-leading
 *  note-run merge uses the shape to tell a line from text. */
const TAG_SHAPE = /^[A-Z0-9_]+$/;

/** The deepest level a real line reaches inside a note run; deeper
 *  "levels" are note text that starts with a number (`26 jaar`). The
 *  deliberate deep-nesting torture files use underscore tags, which
 *  the shape rule keeps as lines. */
const MAX_PLAUSIBLE_LEVEL = 9;

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
 *  body, no number-sign start, no control characters; non-ASCII
 *  characters are accepted — the 7.0 grammar allows them, and the
 *  wild writes them: `0 @家族1@ FAM`, `0 @شجرة عائلة@ INDI`, the
 *  unicode_xref-nonlatin fixture and the kahatTree exports). */
function checkXref(raw: string, position: SourcePosition): void {
  const body = raw.slice(1, -1);
  if (body[0] === '#') {
    fail('line.bad-xref', 'A cross-reference identifier must not begin with a number sign', {
      ...position,
      column: position.column + 1,
    });
  }
  if (body[0] !== undefined && body.charCodeAt(0) <= 0x7f && !ALPHANUM_551.test(body[0])) {
    fail('line.bad-xref', `Invalid first character "${body[0]}" in a cross-reference identifier`, {
      ...position,
      column: position.column + 1,
    });
  }
  for (let i = 0; i < body.length; i++) {
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
function parseValue(raw: string, rule: EscapeRule): RawValue {
  raw = sanitizeBanned(raw);
  // A line-comment value (`0 @F1@ FAM // Family for Peter's parents`,
  // `1 DEAT // Burial information suggests …` — the hand-annotated
  // ged_record samples) is dropped: it annotates the line, not the
  // data — the same rule the pointer comments follow.
  if (raw.replace(/^[ \t]+/, '').startsWith('//')) {
    return { kind: 'absent' };
  }
  // Escape artifacts inside a pointer token (`@<US20>F1@`, the
  // testfiles_sprint3.ged files, and `@<US01>I1@`, the US01–US06
  // test files: a US escape written bare inside the xref) are
  // stripped before the pointer production — the token names the same
  // record without the artifact. A trailing blank after the closing
  // at sign (`1 FAMC @F2@ `) is junk too; the pointer keeps the
  // trimmed token. Leading blanks are delimiters, not payload: the
  // double-space exports (`1 WIFE  @I5@`, the CS555 project files and
  // the PAF genealogy_test sample) still name a pointer. The first
  // identifier character follows the record-side rule (checkXref):
  // ASCII alphanumeric or any non-ASCII character (the
  // unicode_xref-nonlatin fixtures point at `@人物1@` and `@Мария@`).
  // Values that do not match the production stay text with the raw
  // bytes untouched.
  const lead = raw.replace(/^[ \t]+/, '');
  const stripped = lead.replace(/<US\d+>/g, '');
  if (
    lead[0] === '@' &&
    !lead.startsWith('@@') &&
    !lead.startsWith('@#') &&
    // oxlint-disable-next-line no-control-regex -- GEDCOM pointers reject NUL and other C0 controls
    /^@([A-Za-z0-9_]|[^\u0000-\u007f])[^@]*@\s*$/.test(stripped)
  ) {
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
  // The number-sign line comment after a pointer (`1 _OCREF @O1@
  // # Reference to shared census event`, the hand-written glamberson
  // extension examples): the `#` comment annotates the line and is
  // dropped the same way. A blank must separate the pointer from the
  // comment — an at-sign-joined `@X@#tag` stays text.
  // oxlint-disable-next-line no-control-regex -- GEDCOM pointers reject NUL and other C0 controls
  const hashCommentedPointer = /^(@(?:[A-Za-z0-9_]|[^\u0000-\u007f])[^@]*@)[ \t]+#.*$/.exec(lead);
  if (hashCommentedPointer !== null) {
    return { kind: 'pointer', pointer: hashCommentedPointer[1] as string };
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
        // A lone `@#` with no closing @ is literal text: real files
        // (the comprehensive test trees, the gedcom-go edge-case
        // fixture) carry `@#$%&*` inside free text, which is not an
        // escape. The characters stay verbatim and the scan
        // continues.
        out += '@#';
        i += 2;
        continue;
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
  // Extra spaces between the level and the xref/tag are delimiters
  // (`0              @1A@ INDI`, the PAF genealogy_test sample): the
  // whole run is skipped before the identifier is looked for.
  while (text[i] === ' ') {
    i++;
  }

  // Optional cross-reference identifier. The US escape artifact
  // inside an xref (`0 @<US01>I1@ INDI`, the US01–US06 test files)
  // is stripped the same way the pointer-value parser strips it —
  // the record and its pointers must name the same identifier.
  let xref: string | undefined;
  if (text[i] === '@') {
    let close = text.indexOf('@', i + 1);
    let repaired = false;
    if (close === -1) {
      // An unterminated xref (`0 @I1 SUBM`, the exporter dropped the
      // closing at sign) is closed at the next blank — the identifier
      // runs to there. Without a blank (the line ends mid-identifier)
      // there is nothing to repair.
      const blank = text.indexOf(' ', i + 1);
      const tab = text.indexOf('\t', i + 1);
      const end = blank === -1 ? tab : tab === -1 ? blank : Math.min(blank, tab);
      if (end === -1) {
        fail('line.bad-xref', 'Unterminated cross-reference identifier', at(i));
      }
      close = end;
      repaired = true;
    }
    const raw = (repaired ? `${text.slice(i, close)}@` : text.slice(i, close + 1)).replace(/<US\d+>/g, '');
    checkXref(raw, at(i));
    // An empty identifier (`0 @@ OBJE`) carries no name: the record
    // has no xref.
    if (raw !== '@@') {
      xref = raw;
    }
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
  let valueColumn = i < text.length ? trimCount + i + 2 : 0;
  if (i < text.length) {
    i++; // Skip the single delimiter; the rest is the value.
  }

  // Value.
  let value: RawValue = { kind: 'absent' };
  if (i < text.length) {
    value = parseValue(text.slice(i), rule);
  }
  if (value.kind === 'text' && tag !== 'CONC' && tag !== 'CONT' && value.text.trim() === '') {
    // A whitespace-only payload is no payload: the trailing spaces of
    // `0 @F1@ FAM          ` (the meganyim family.ged, the glamberson
    // examples_advanced.ged) and the empty `1 SEX ` (the gedcom4j
    // heuler sample) carry no data — the line parses as the bare tag.
    // CONC/CONT are exempt: their leading blanks are the payload (the
    // 5.x continuation rule).
    value = { kind: 'absent' };
    valueColumn = 0;
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
    if (node.xref !== undefined && node.level > 0 && !node.tag.startsWith('_') && node.value.kind === 'absent') {
      // The exporters write the pointer in the xref position
      // (`1 @I2@ HUSB`, the backend_family.ged exports): the xref
      // relocates into the value slot, where the tag expects it. The
      // misplaced identifier is not registered (it is not a record
      // line), so a relocation whose target does not exist stays a
      // dangling pointer — dropped silently by the resolve rules.
      const relocated = node.xref;
      const rest = { ...node };
      delete rest.xref;
      node = {
        ...rest,
        value: { kind: 'pointer', pointer: relocated },
        valueColumn: 0,
      };
    }
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
        fail(
          'line.xref-on-substructure',
          'A cross-reference identifier is only allowed on a record or on a tagged extension structure',
          node.position,
        );
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

  const mergeContinuation = (target: RawNode, continuation: RawNode, joiner: string): boolean => {
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
        // A continuation under a pointer line cannot merge into the
        // pointer (the gedbas exports write note text under the FAMC
        // pointer): the caller attaches the line as a child of the
        // pointer slot instead, and the dispatch keeps it as a
        // generic extension — the text is kept, nothing is guessed.
        return false;
      }
    }
    // A pointer-valued continuation (`1 CONC @NI156@`, the Ajmani
    // exports) keeps the pointer string as the text — the same rule
    // the missing-payload retry follows (the original pointer string
    // survives).
    const extra =
      continuation.value.kind === 'text'
        ? continuation.value.text
        : continuation.value.kind === 'pointer'
          ? continuation.value.pointer
          : '';
    target.value = { kind: 'text', text: target.value.text + joiner + extra };
    return true;
  };

  /**
   * The tags that never carry a payload and take part in the
   * glued-line resplit: the Geni.com exports lose the line break
   * between CHAN and its DATE (`1 CHAN 2 DATE 28 DEC 2019`, the
   * CompareGedcomsForDates BloodTree1 sample — 433 times in one
   * file). The payload of such a line is dropped by the dispatch
   * anyway (structure.unexpected-payload); when it is exactly the
   * well-formed line that belongs under the tag (level + 1), the line
   * is resplit instead — the data survives and the CHAN structure
   * gets its DATE. Nothing else is guessed: the resplit requires the
   * deeper level and a valid line shape.
   */
  const GLUED_SPLIT_TAGS: ReadonlySet<string> = new Set(['CHAN']);

  /** Matches a text that starts like a complete GEDCOM line: level,
   *  optional xref, tag. */
  const EMBEDDED_LINE = /^\d+[ \t]+(@[^@ \t]+@[ \t]+)?[A-Za-z0-9_]+([ \t]|$)/;

  /**
   * Retokenizes a node's text payload as a line of its own (the
   * embedded-line shape of the glued lines and the
   * continuation-wrapped lines), shifting the positions into the
   * original line. Returns null when the payload is not a well-formed
   * line — the text then stays the payload (the nothing-is-guessed
   * rule).
   */
  const tokenizeEmbeddedLine = (node: RawNode): RawNode | null => {
    if (node.value.kind !== 'text' || !EMBEDDED_LINE.test(node.value.text)) {
      return null;
    }
    try {
      const inner = tokenizeLine(
        { text: node.value.text, line: node.position.line, offset: node.position.offset },
        rule,
      );
      if (inner === null) {
        return null;
      }
      const shift = node.valueColumn > 0 ? node.valueColumn - 1 : 0;
      inner.position = { ...inner.position, column: inner.position.column + shift };
      if (inner.valueColumn > 0) {
        inner.valueColumn += shift;
      }
      return inner;
    } catch {
      return null;
    }
  };

  /** Places one tokenized node: the glued-line resplit, the
   *  continuation merge and unwrap, and the attach. Recursive — an
   *  unwrapped or resplit inner line goes through the same rules. */
  const placeNode = (node: RawNode): void => {
    // The glued-line resplit (see GLUED_SPLIT_TAGS).
    if (GLUED_SPLIT_TAGS.has(node.tag) && node.value.kind === 'text') {
      const inner = tokenizeEmbeddedLine(node);
      if (inner !== null && inner.level === node.level + 1) {
        attach({ ...node, value: { kind: 'absent' }, valueColumn: 0 });
        placeNode(inner);
        return;
      }
    }
    // A continuation line extends the payload of its parent line (the
    // enclosing line at level - 1) and must come before any other
    // substructure of that parent.
    if (node.level > 0 && (node.tag === 'CONC' || node.tag === 'CONT')) {
      let parent = stack[node.level - 1];
      if (parent === undefined) {
        // The exporter indented the continuation one level too deep
        // (`2 CONT Main decisive actions:` + `3 CONT - Delivers …`,
        // the three-body-problem fan trees): the deepest
        // text-bearing line on the stack is the continuation's
        // target — the immediately preceding text line, nothing
        // further is guessed.
        const candidate = stack[stack.length - 1];
        if (
          candidate !== undefined &&
          candidate.value.kind === 'text' &&
          (candidate.tag === 'NOTE' || candidate.tag === 'TEXT')
        ) {
          parent = candidate;
        } else {
          fail(
            'line.level-skip',
            `Level ${node.level} has no enclosing line at level ${node.level - 1}`,
            node.position,
          );
        }
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
      // The continuation-wrapped line: Family Tree Maker for Mac OS X
      // wraps whole lines into continuations of the preceding value —
      // `1 SEX M` + `2 CONT 2 SOUR @S453@` and `3 PAGE …West ` +
      // `4 CONT 4 CONC Virginia; Roll: …` (the gedcom4j willis
      // samples, HEAD.SOUR "Family Tree Maker for Mac OS X"). When
      // the payload is itself a complete line at the continuation's
      // own level and the merge target is not a prose slot (a NOTE or
      // TEXT — their payloads legitimately quote GEDCOM lines, the
      // TGC551 torture notes), the payload is that misplaced line: it
      // is processed in place of the continuation, so the SEX keeps
      // its enum value and the wrapped SOUR/PAGE text lands where the
      // exporter meant it.
      if (parent.tag !== 'NOTE' && parent.tag !== 'TEXT') {
        const inner = tokenizeEmbeddedLine(node);
        if (inner !== null && inner.level === node.level) {
          placeNode(inner);
          return;
        }
      }
      if (!mergeContinuation(parent, node, node.tag === 'CONT' ? '\n' : '')) {
        // The pointer-slot target: the line attaches as a regular
        // child (see mergeContinuation).
        attach(node);
      }
      return;
    }
    attach(node);
  };

  for (const line of document.lines) {
    try {
      // The unleveled-continuation merge: a line without a level
      // number that follows a NOTE/TEXT payload merges into it as a
      // newline continuation — human-edited files drop the CONT
      // prefixes (the Gedcom4Sharp Sopranos fixture, the
      // ancestry-quirks fixture, the MyHeritage Hebrew bios under the
      // citation TEXT). A numbered-list marker (`1. Jaume I`, the
      // myheritage sample notes) is free text too — no valid GEDCOM
      // line starts with digits and a dot. The CONC/CONT chain case
      // is covered because a merged continuation leaves its parent on
      // the stack. The merge also runs across blank lines: the
      // FamilySearch LifeSketch notes (the sandi-gedcom matic trees)
      // and the note rewrites of the escyb3 our-family-tree exports
      // carry paragraph blanks inside the run — the text is kept, and
      // a non-text anchor (a name, a pointer line, the file start,
      // TRLR) still keeps the line.bad-tag/line.bad-level error:
      // those lines have no principled home (the nothing-is-guessed
      // rule).
      const trimmed = line.text.replace(/^[ \t]+/, '');
      const anchor = stack[stack.length - 1];
      const anchorTakesText =
        anchor !== undefined && (anchor.tag === 'NOTE' || anchor.tag === 'TEXT') && anchor.value.kind !== 'pointer';
      const mergeIntoAnchor = (): void => {
        const target = anchor as RawNode;
        if (target.value.kind === 'absent') {
          target.value = { kind: 'text', text: trimmed };
        } else if (target.value.kind === 'text') {
          target.value = { kind: 'text', text: target.value.text + '\n' + trimmed };
        }
      };
      const digitStart = trimmed.length > 0 && DIGIT.test(trimmed[0] as string);
      const freeText = trimmed.length > 0 && (!digitStart || /^\d+\.\s/.test(trimmed));
      if (freeText) {
        if (anchorTakesText) {
          mergeIntoAnchor();
          continue;
        }
        if (trimmed[0] === '#') {
          // A full-line number-sign comment: the hand-written GEDCOM 7
          // extension examples (the glamberson gedcom-occurrences /
          // gedcom-evidence samples), the meganyim SSWFinalProject
          // files and the parser-project fixtures carry markdown
          // style comment banners between the records. A comment
          // annotates the file, it is no data — the line is dropped
          // (the same rule the `//` line comments follow). A `#` line
          // inside a note run still merges as text (the branch above
          // wins): note payloads legitimately carry markdown.
          continue;
        }
      }
      // A digit-leading line inside a note run is ambiguous: the
      // Dutch transcripts lose CONT prefixes on lines that start with
      // a number (`1 jaar en 3 mnd` — "1 year and 3 months", `26
      // jaar`, `28-05-1857`). The line is the note's text unless it
      // tokenizes as a line a GEDCOM file could really carry here: a
      // tag in the upper-case GEDCOM shape at a plausible level
      // (KNOWN shapes like `2 CONC e Vries`, vendor extensions like
      // `2 BOGUS x`). Anything else — a lowercase prose word in the
      // tag slot (`jaar`), a tag with punctuation (`-05-1857`), an
      // absurd level (`26 …`) — merges into the note: the text is
      // kept, and a fake `1 jaar` line would also poison the stack
      // and cascade bad-level errors over the rest of the run.
      let node: RawNode | null;
      try {
        node = tokenizeLine(line, rule);
      } catch (error) {
        if (digitStart && anchorTakesText) {
          mergeIntoAnchor();
          continue;
        }
        throw error;
      }
      if (
        node !== null &&
        digitStart &&
        anchorTakesText &&
        node.level >= 1 &&
        (node.level > MAX_PLAUSIBLE_LEVEL || !TAG_SHAPE.test(node.tag))
      ) {
        // Not a line a GEDCOM file could really carry here: the note's
        // text merges (see the comment above). Level 0 is exempt — a
        // record line always starts a record, whatever its tag
        // spelling (the GenoPro mixed-case entity records follow note
        // runs in the corpus trees).
        mergeIntoAnchor();
        continue;
      }
      if (node === null) {
        // Blank line. The 5.x rule officially ignores extra line
        // terminators only before the first line, but real files carry
        // blank lines anywhere (a quarter of the corpus files fail
        // otherwise), and every major reader skips them: a blank line
        // cannot disturb the hierarchy, the continuation merge, or any
        // value, so the line is dropped silently in any position (see
        // the README's Known strict decisions).
        continue;
      }
      // The Geni.com bare-identifier dialect: `0 I1234 INDI` spells the
      // cross-reference identifier without the @ delimiters. The shape
      // is unambiguous — a bare identifier in the tag position with a
      // record tag as the value — so the line is normalized to the
      // standard spelling (the full-leniency container rule).
      placeNode(
        node.level === 0 &&
          node.xref === undefined &&
          !RECORD_TAGS.has(node.tag) &&
          node.value.kind === 'text' &&
          RECORD_TAGS.has(node.value.text)
          ? { ...node, xref: `@${node.tag}@`, tag: node.value.text, value: { kind: 'absent' }, valueColumn: 0 }
          : node,
      );
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
