import { describe, expect, it } from 'vitest';
import { parseProtocolUrl } from '../src/main/protocol-url';

describe('parseProtocolUrl', () => {
  it('extracts the path from a doru://open link', () => {
    expect(parseProtocolUrl('doru://open?path=/Users/boris/Family.doru')).toBe(
      '/Users/boris/Family.doru',
    );
  });

  it('decodes URL-encoded paths', () => {
    expect(
      parseProtocolUrl(
        'doru://open?path=%2FUsers%2Fboris%2F%D0%9C%D0%BE%D1%8F%20%D1%81%D0%B5%D0%BC%D1%8C%D1%8F.doru',
      ),
    ).toBe('/Users/boris/Моя семья.doru');
  });

  it('ignores unknown query parameters', () => {
    expect(parseProtocolUrl('doru://open?path=/tmp/family.doru&foo=bar')).toBe(
      '/tmp/family.doru',
    );
  });

  it('matches the scheme case-insensitively', () => {
    expect(parseProtocolUrl('DORU://open?path=/tmp/family.doru')).toBe(
      '/tmp/family.doru',
    );
  });

  it('returns null for links without a path', () => {
    expect(parseProtocolUrl('doru://open')).toBeNull();
    expect(parseProtocolUrl('doru://open?path=')).toBeNull();
  });

  it('returns null for non-doru schemes', () => {
    expect(parseProtocolUrl('http://open?path=/tmp/family.doru')).toBeNull();
    expect(parseProtocolUrl('file:///tmp/family.doru')).toBeNull();
  });

  it('returns null for unparseable input', () => {
    expect(parseProtocolUrl('not a url')).toBeNull();
  });
});
