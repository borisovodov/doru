import { describe, expect, it } from 'vitest';
import { layoutPedigree } from '../src/layout/pedigree';
import { renderPedigreeSvg } from '../src/layout/svg';
import type { FamilyRecord, PersonRecord } from '../src/model/types';

const person = (id: string, sex: PersonRecord['sex'] = 'U', birthYear?: number): PersonRecord => ({
  id,
  names: [{ given: id, surname: 'Doru' }],
  sex,
  ...(birthYear !== undefined ? { birth: { year: birthYear, quality: 'exact' } } : {}),
});

const family = (id: string, parents: string[], children: string[]): FamilyRecord => ({
  id,
  parents,
  children,
});

describe('renderPedigreeSvg', () => {
  it('renders cards with names, years and edges for a nuclear family', () => {
    const persons = [person('child'), person('father', 'M', 1923), person('mother', 'F', 1927)];
    const families = [family('F1', ['father', 'mother'], ['child'])];
    const layout = layoutPedigree('child', persons, families);
    expect(layout).not.toBeNull();
    const svg = renderPedigreeSvg(layout!, persons);

    expect(svg).toContain('<svg');
    expect(svg).toContain('father Doru');
    expect(svg).toContain('mother Doru');
    expect(svg).toContain('child Doru');
    expect(svg).toContain('1923');
    // One marriage edge plus two pedigree brackets.
    expect(svg.match(/<path /g)).toHaveLength(3);
    expect(svg).toContain('</svg>');
  });

  it('escapes XML-special characters in names', () => {
    const persons = [
      { id: 'a', names: [{ given: 'O\u2019Brien <Jr.>', surname: 'Doru' }], sex: 'U' as const },
    ];
    const layout = layoutPedigree('a', persons, []);
    const svg = renderPedigreeSvg(layout!, persons);
    expect(svg).not.toContain('<Jr.>');
    expect(svg).toContain('&lt;Jr.&gt;');
  });

  it('marks deceased persons with a dagger', () => {
    const persons = [
      { id: 'a', names: [{ given: 'Old', surname: 'Doru' }], sex: 'M' as const, death: { year: 2000, quality: 'exact' as const } },
    ];
    const layout = layoutPedigree('a', persons, []);
    const svg = renderPedigreeSvg(layout!, persons);
    expect(svg).toContain('\u{2020}');
  });

  it('sizes the viewBox around the layout bounds', () => {
    const persons = [person('a', 'U')];
    const layout = layoutPedigree('a', persons, []);
    const svg = renderPedigreeSvg(layout!, persons, { padding: 10 });
    expect(svg).toContain('viewBox="0 0 200 84"');
  });
});
