import { describe, expect, test } from 'vitest';
import { decodeDocument } from '../src/parsing/decode';
import { parseRawDocument, type RawNode } from '../src/parsing/lines';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function raw70(text: string): { nodes: RawNode[] } {
  const decoded = decodeDocument(enc(text), '7.0');
  if (!decoded.ok) {
    throw new Error(JSON.stringify(decoded));
  }
  return parseRawDocument(decoded.value, '7.0');
}

function raw551(text: string): { nodes: RawNode[] } {
  const decoded = decodeDocument(enc(text), '5.5.1');
  if (!decoded.ok) {
    throw new Error(JSON.stringify(decoded));
  }
  return parseRawDocument(decoded.value, '5.5.1');
}

function expectErr(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return (error as { code: string }).code;
  }
  throw new Error('expected an error');
}

describe('line tokenization (7.0)', () => {
  test('tokenizes a record with xref and value', () => {
    const { nodes } = raw70('0 @I1@ INDI\n1 NAME John /Doe/\n0 TRLR\n');
    expect(nodes).toHaveLength(2);
    expect(nodes[0]?.tag).toBe('INDI');
    expect(nodes[0]?.xref).toBe('@I1@');
    const name = nodes[0]?.children[0] as RawNode;
    expect(name.tag).toBe('NAME');
    expect(name.value).toEqual({ kind: 'text', text: 'John /Doe/' });
  });

  test('parses pointers and the void pointer', () => {
    const { nodes } = raw70('0 @F1@ FAM\n1 HUSB @I1@\n1 NOTE @VOID@\n0 TRLR\n');
    expect((nodes[0]?.children[0] as RawNode).value).toEqual({ kind: 'pointer', pointer: '@I1@' });
    expect((nodes[0]?.children[1] as RawNode).value).toEqual({ kind: 'pointer', pointer: '@VOID@' });
  });

  test('unescapes a doubled leading at-sign', () => {
    const { nodes } = raw70('0 HEAD\n1 NOTE @@me and @I are social\n0 TRLR\n');
    expect((nodes[0]?.children[0] as RawNode).value).toEqual({
      kind: 'text',
      text: '@me and @I are social',
    });
  });

  test('ignores leading whitespace', () => {
    const { nodes } = raw70(' 0 HEAD\n0 TRLR\n');
    expect(nodes[0]?.tag).toBe('HEAD');
  });

  test('ignores blank lines', () => {
    const { nodes } = raw70('0 HEAD\n\n0 TRLR\n');
    expect(nodes[0]?.tag).toBe('HEAD');
  });

  test('accepts a leading-zero level', () => {
    const { nodes } = raw70('0 HEAD\n01 GEDC\n0 TRLR\n');
    expect(nodes[0]?.children[0]?.tag).toBe('GEDC');
    expect(nodes[0]?.children[0]?.level).toBe(1);
  });

  test('tolerates a missing delimiter after the level', () => {
    const { nodes } = raw70('0 HEAD\n1GEDC\n0 TRLR\n');
    expect(nodes[0]?.children[0]?.tag).toBe('GEDC');
  });

  test('accepts lowercase tags', () => {
    const { nodes } = raw70('0 HEAD\n1 geDC\n0 TRLR\n');
    expect(nodes[0]?.children[0]?.tag).toBe('geDC');
  });

  test('accepts lowercase xrefs', () => {
    const { nodes } = raw70('0 @i1@ INDI\n0 TRLR\n');
    expect(nodes[0]?.xref).toBe('@i1@');
  });

  test('accepts @VOID@ as an xref', () => {
    const { nodes } = raw70('0 @VOID@ INDI\n0 TRLR\n');
    expect(nodes[0]?.xref).toBe('@VOID@');
  });

  test('keeps a single leading at-sign in a value as text', () => {
    const { nodes } = raw70('0 HEAD\n1 NOTE @foo\n0 TRLR\n');
    expect((nodes[0]?.children[0] as RawNode).value).toEqual({ kind: 'text', text: '@foo' });
  });

  test('banned characters: DEL and C0 are sanitized, C1 is tolerated', () => {
    // DEL and the C0 controls (except the tab) are dropped from the
    // value, the vertical tab becomes the newline; the line survives.
    const del = raw70(`0 HEAD\n1 NOTE bad${'\u007f'}char\n0 TRLR\n`);
    expect((del.nodes[0]?.children[0] as RawNode).value).toEqual({ kind: 'text', text: 'badchar' });
    const vt = raw70(`0 HEAD\n1 NOTE a${'\u000b'}b\n0 TRLR\n`);
    expect((vt.nodes[0]?.children[0] as RawNode).value).toEqual({ kind: 'text', text: 'a\nb' });
    // The 5.x rule does not check the C1 controls (the 7.0 rule does);
    // the lenient rule wins.
    const { nodes } = raw70(`0 HEAD\n1 NOTE ${'\u0085'}\n0 TRLR\n`);
    expect((nodes[0]?.children[0] as RawNode).value).toEqual({ kind: 'text', text: '\u0085' });
  });

  test('allows tabs inside values', () => {
    const { nodes } = raw70('0 HEAD\n1 NOTE a\tb\n0 TRLR\n');
    expect((nodes[0]?.children[0] as RawNode).value).toEqual({ kind: 'text', text: 'a\tb' });
  });

  test('relocates an xref on a substructure into the value slot', () => {
    const { nodes } = raw70('0 HEAD\n1 @X@ GEDC\n0 TRLR\n');
    expect((nodes[0]?.children[0] as RawNode).value).toEqual({ kind: 'pointer', pointer: '@X@' });
  });

  test('errors on an xref on a substructure that also has a value', () => {
    expect(expectErr(() => raw70('0 HEAD\n1 @X@ GEDC v\n0 TRLR\n'))).toBe('line.xref-on-substructure');
  });

  test('keeps duplicate xrefs; the first occurrence registers', () => {
    const { nodes } = raw70('0 @I1@ INDI\n0 @I1@ INDI\n0 TRLR\n');
    expect(nodes).toHaveLength(3);
    expect(nodes[0]?.xref).toBe('@I1@');
    expect(nodes[1]?.xref).toBe('@I1@');
  });

  test('repairs a level jump by attaching to the nearest enclosing line', () => {
    const { nodes } = raw70('0 HEAD\n2 GEDC\n0 TRLR\n');
    expect(nodes[0]?.tag).toBe('HEAD');
    expect((nodes[0]?.children[0] as RawNode | undefined)?.tag).toBe('GEDC');
  });

  test('merges CONT continuations preserving blank lines', () => {
    const { nodes } = raw70('0 HEAD\n1 NOTE first\n2 CONT   second\n2 CONT\n2 CONT third\n0 TRLR\n');
    const note = nodes[0]?.children[0] as RawNode;
    expect(note.value).toEqual({ kind: 'text', text: 'first\n  second\n\nthird' });
    expect(note.children).toHaveLength(0);
  });

  test('merges CONC (the 7.0 reservation is lifted)', () => {
    const { nodes } = raw70('0 HEAD\n1 NOTE a\n2 CONC b\n0 TRLR\n');
    expect((nodes[0]?.children[0] as RawNode).value).toEqual({ kind: 'text', text: 'ab' });
  });

  test('merges a continuation that follows other substructures', () => {
    const { nodes } = raw70('0 HEAD\n1 NOTE a\n2 MIME text/plain\n2 CONT b\n0 TRLR\n');
    const note = nodes[0]?.children[0] as RawNode;
    expect(note.value).toEqual({ kind: 'text', text: 'a\nb' });
    expect(note.children).toHaveLength(1);
  });

  test('re-targets a wrong-level continuation to the preceding text line', () => {
    const { nodes } = raw70('0 HEAD\n0 @I1@ INDI\n1 NAME A /B/\n1 NOTE a note\n1 CONT its continuation\n0 TRLR\n');
    const indi = nodes[1] as RawNode;
    const note = indi.children[1] as RawNode;
    expect(note.tag).toBe('NOTE');
    expect(note.value).toEqual({ kind: 'text', text: 'a note\nits continuation' });
  });

  test('rejects a continuation of a pointer', () => {
    expect(expectErr(() => raw70('0 HEAD\n1 SUBM @S1@\n2 CONT x\n0 TRLR\n'))).toBe(
      'line.continuation-no-payload',
    );
  });
});

describe('line tokenization (5.5.1)', () => {
  test('ignores leading whitespace', () => {
    const { nodes } = raw551('  0 HEAD\n1 CHAR ANSEL\n0 TRLR\n');
    expect(nodes[0]?.tag).toBe('HEAD');
  });

  test('ignores blank lines anywhere', () => {
    const { nodes } = raw551('\n\n0 HEAD\n1 CHAR ANSEL\n\n0 TRLR\n');
    expect(nodes[0]?.tag).toBe('HEAD');
  });

  test('the 99 level limit is lifted; deep levels attach to the nearest enclosing line', () => {
    const { nodes } = raw551('0 HEAD\n1 CHAR ANSEL\n100 NOTE x\n0 TRLR\n');
    expect((nodes[0]?.children[0] as RawNode | undefined)?.children[0]?.tag).toBe('NOTE');
    // A first line at a positive level still has no enclosing line.
    expect(expectErr(() => raw551('1 CHAR ANSEL\n0 TRLR\n'))).toBe('line.level-skip');
  });

  test('doubles at-signs in values', () => {
    const { nodes } = raw551('0 HEAD\n1 CHAR ANSEL\n1 NOTE a@@b\n0 TRLR\n');
    expect((nodes[0]?.children[1] as RawNode).value).toEqual({ kind: 'text', text: 'a@b' });
  });

  test('tolerates a lone at-sign anywhere in a value', () => {
    const doc = raw551('0 HEAD\n1 CHAR ANSEL\n1 NOTE a@b\n0 TRLR\n');
    const head = doc.nodes[0];
    expect(head?.children[1]?.value).toEqual({ kind: 'text', text: 'a@b' });
    // A leading single @ that is not a pointer is text too.
    const lone = raw551('0 HEAD\n1 CHAR ANSEL\n1 NOTE @lone\n0 TRLR\n');
    expect(lone.nodes[0]?.children[1]?.value).toEqual({ kind: 'text', text: '@lone' });
  });

  test('keeps escape sequences in values', () => {
    const { nodes } = raw551('0 HEAD\n1 CHAR ANSEL\n1 NOTE @#DHEBREW@ text\n0 TRLR\n');
    expect((nodes[0]?.children[1] as RawNode).value).toEqual({ kind: 'text', text: '@#DHEBREW@ text' });
  });

  test('rejects an unterminated escape', () => {
    expect(expectErr(() => raw551('0 HEAD\n1 CHAR ANSEL\n1 NOTE @#DHEBREW text\n0 TRLR\n'))).toBe(
      'line.bad-escape',
    );
  });

  test('allows tabs in values (5.5.5 legalized them)', () => {
    const { nodes } = raw551('0 HEAD\n1 CHAR ANSEL\n1 NOTE a\tb\n0 TRLR\n');
    expect((nodes[0]?.children[1] as RawNode).value).toEqual({ kind: 'text', text: 'a\tb' });
  });

  test('sanitizes the other control characters out of values', () => {
    // The C0 controls (except the tab) and DEL are dropped from the
    // value; the vertical tab becomes the newline; the line survives.
    const a = raw551(`0 HEAD\n1 CHAR ANSEL\n1 NOTE a${'\u0001'}b\n0 TRLR\n`);
    expect((a.nodes[0]?.children[1] as RawNode).value).toEqual({ kind: 'text', text: 'ab' });
    const b = raw551(`0 HEAD\n1 CHAR ANSEL\n1 NOTE a${'\u000b'}b\n0 TRLR\n`);
    expect((b.nodes[0]?.children[1] as RawNode).value).toEqual({ kind: 'text', text: 'a\nb' });
    const c = raw551(`0 HEAD\n1 CHAR ANSEL\n1 NOTE a${'\u007f'}b\n0 TRLR\n`);
    expect((c.nodes[0]?.children[1] as RawNode).value).toEqual({ kind: 'text', text: 'ab' });
  });

  test('merges CONC without a line break', () => {
    const { nodes } = raw551('0 HEAD\n1 CHAR ANSEL\n1 NOTE lon\n2 CONC g\n0 TRLR\n');
    expect((nodes[0]?.children[1] as RawNode).value).toEqual({ kind: 'text', text: 'long' });
  });

  test('parses 5.5.1 pointers', () => {
    const { nodes } = raw551('0 HEAD\n1 CHAR ANSEL\n0 @1@ INDI\n0 TRLR\n');
    expect(nodes[1]?.xref).toBe('@1@');
  });

  test('rejects an xref starting with a number sign', () => {
    expect(expectErr(() => raw551('0 HEAD\n1 CHAR ANSEL\n0 @#1@ INDI\n0 TRLR\n'))).toBe('line.bad-xref');
  });
});

describe('the control-char xref guard', () => {
  test('a control character inside an xref stays an error', () => {
    expect(expectErr(() => raw70(`0 HEAD\n1 @A \t 7@ NOTE x\n0 TRLR\n`))).toBe('line.banned-char');
  });
});

describe('the xref repairs', () => {
  test('accepts non-ASCII characters in xrefs', () => {
    const { nodes } = raw70('0 HEAD\n0 @家族1@ FAM\n1 HUSB @人物1@\n0 @人物1@ INDI\n1 NAME 田中 /一郎/\n0 TRLR\n');
    expect(nodes[1]?.xref).toBe('@家族1@');
    expect(nodes[2]?.xref).toBe('@人物1@');
  });

  test('an empty xref (@@) leaves the record without an identifier', () => {
    const { nodes } = raw70('0 HEAD\n0 @@ OBJE\n1 FILE p.jpg\n0 TRLR\n');
    expect(nodes[1]?.xref).toBeUndefined();
    expect(nodes[1]?.tag).toBe('OBJE');
  });

  test('an unterminated xref is closed at the next blank', () => {
    const { nodes } = raw70('0 HEAD\n0 @I1 SUBM\n1 NAME N\n0 TRLR\n');
    expect(nodes[1]?.xref).toBe('@I1@');
    expect(nodes[1]?.tag).toBe('SUBM');
  });
});
