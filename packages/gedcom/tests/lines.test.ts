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

  test('errors on leading whitespace', () => {
    expect(expectErr(() => raw70(' 0 HEAD\n0 TRLR\n'))).toBe('line.leading-whitespace');
  });

  test('errors on blank lines', () => {
    expect(expectErr(() => raw70('0 HEAD\n\n0 TRLR\n'))).toBe('line.blank');
  });

  test('errors on a leading-zero level', () => {
    expect(expectErr(() => raw70('0 HEAD\n01 GEDC\n0 TRLR\n'))).toBe('line.bad-level');
  });

  test('errors on a missing delimiter', () => {
    expect(expectErr(() => raw70('0 HEAD\n1GEDC\n0 TRLR\n'))).toBe('line.missing-delimiter');
  });

  test('errors on a bad tag character', () => {
    expect(expectErr(() => raw70('0 HEAD\n1 geDC\n0 TRLR\n'))).toBe('line.bad-tag');
  });

  test('errors on a bad xref', () => {
    expect(expectErr(() => raw70('0 @i1@ INDI\n0 TRLR\n'))).toBe('line.bad-xref');
  });

  test('rejects @VOID@ as an xref', () => {
    expect(expectErr(() => raw70('0 @VOID@ INDI\n0 TRLR\n'))).toBe('line.bad-xref');
  });

  test('errors on a single leading at-sign in a value', () => {
    expect(expectErr(() => raw70('0 HEAD\n1 NOTE @foo\n0 TRLR\n'))).toBe('line.unescaped-at');
  });

  test('errors on banned characters', () => {
    expect(expectErr(() => raw70(`0 HEAD\n1 NOTE bad${'\u007f'}char\n0 TRLR\n`))).toBe('line.banned-char');
    expect(expectErr(() => raw70(`0 HEAD\n1 NOTE ${'\u0085'}\n0 TRLR\n`))).toBe('line.banned-char');
  });

  test('allows tabs inside values', () => {
    const { nodes } = raw70('0 HEAD\n1 NOTE a\tb\n0 TRLR\n');
    expect((nodes[0]?.children[0] as RawNode).value).toEqual({ kind: 'text', text: 'a\tb' });
  });

  test('errors on an xref on a substructure', () => {
    expect(expectErr(() => raw70('0 HEAD\n1 @X@ GEDC\n0 TRLR\n'))).toBe('line.xref-on-substructure');
  });

  test('errors on duplicate xrefs', () => {
    expect(expectErr(() => raw70('0 @I1@ INDI\n0 @I1@ INDI\n0 TRLR\n'))).toBe('document.duplicate-xref');
  });

  test('errors on a level skip', () => {
    expect(expectErr(() => raw70('0 HEAD\n2 GEDC\n0 TRLR\n'))).toBe('line.level-skip');
  });

  test('merges CONT continuations preserving blank lines', () => {
    const { nodes } = raw70('0 HEAD\n1 NOTE first\n2 CONT   second\n2 CONT\n2 CONT third\n0 TRLR\n');
    const note = nodes[0]?.children[0] as RawNode;
    expect(note.value).toEqual({ kind: 'text', text: 'first\n  second\n\nthird' });
    expect(note.children).toHaveLength(0);
  });

  test('rejects CONC in 7.0 as reserved', () => {
    expect(expectErr(() => raw70('0 HEAD\n1 NOTE a\n2 CONC b\n0 TRLR\n'))).toBe('line.reserved-tag');
  });

  test('rejects a continuation after other substructures', () => {
    expect(
      expectErr(() => raw70('0 HEAD\n1 NOTE a\n2 MIME text/plain\n2 CONT b\n0 TRLR\n')),
    ).toBe('line.continuation-out-of-order');
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

  test('ignores leading blank lines only', () => {
    const { nodes } = raw551('\n\n0 HEAD\n1 CHAR ANSEL\n0 TRLR\n');
    expect(nodes[0]?.tag).toBe('HEAD');
    expect(expectErr(() => raw551('0 HEAD\n1 CHAR ANSEL\n\n0 TRLR\n'))).toBe('line.blank');
  });

  test('enforces the 99 level limit', () => {
    expect(expectErr(() => raw551('0 HEAD\n1 CHAR ANSEL\n100 NOTE x\n0 TRLR\n'))).toBe('line.level-limit');
  });

  test('doubles at-signs in values', () => {
    const { nodes } = raw551('0 HEAD\n1 CHAR ANSEL\n1 NOTE a@@b\n0 TRLR\n');
    expect((nodes[0]?.children[1] as RawNode).value).toEqual({ kind: 'text', text: 'a@b' });
  });

  test('rejects a lone at-sign in a value', () => {
    expect(expectErr(() => raw551('0 HEAD\n1 CHAR ANSEL\n1 NOTE a@b\n0 TRLR\n'))).toBe('line.unescaped-at');
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

  test('still rejects the other control characters', () => {
    expect(expectErr(() => raw551(`0 HEAD\n1 CHAR ANSEL\n1 NOTE a${'\u0001'}b\n0 TRLR\n`))).toBe('line.banned-char');
    expect(expectErr(() => raw551(`0 HEAD\n1 CHAR ANSEL\n1 NOTE a${'\u000b'}b\n0 TRLR\n`))).toBe('line.banned-char');
    expect(expectErr(() => raw551(`0 HEAD\n1 CHAR ANSEL\n1 NOTE a${'\u007f'}b\n0 TRLR\n`))).toBe('line.banned-char');
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
