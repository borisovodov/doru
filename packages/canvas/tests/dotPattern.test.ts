import { describe, expect, it } from 'vitest';
import { dotPattern, type DotPatternOptions } from '../src/dotPattern';

const options: DotPatternOptions = {
  gap: 64,
  size: 2,
  minGap: 8,
  minSize: 2,
  fadeGap: 32,
  minOpacity: 0.2,
};

describe('dotPattern', () => {
  it('clamps the on-screen gap and dot size at low zoom', () => {
    const pattern = dotPattern(0.1, options);
    expect(pattern.gapPx).toBe(8);
    expect(pattern.radiusPx).toBe(1);
    expect(pattern.opacity).toBeCloseTo(0.2);
  });

  it('keeps full opacity at the fade start and above', () => {
    expect(dotPattern(0.5, options).opacity).toBe(1);
    expect(dotPattern(1, options).opacity).toBe(1);
  });

  it('interpolates the fade between minGap and fadeGap', () => {
    expect(dotPattern(0.25, options).opacity).toBeCloseTo(0.2 + 0.8 * (8 / 24));
  });

  it('keeps full opacity when no fade gap is configured', () => {
    expect(dotPattern(0.1, { ...options, fadeGap: undefined }).opacity).toBe(1);
  });

  it('disables the fade for an empty range', () => {
    expect(dotPattern(0.1, { ...options, fadeGap: options.minGap }).opacity).toBe(1);
    expect(dotPattern(0.1, { ...options, fadeGap: options.minGap - 1 }).opacity).toBe(1);
  });

  it('clamps the opacity floor to the 0..1 range', () => {
    expect(dotPattern(0.1, { ...options, minOpacity: 2 }).opacity).toBe(1);
    expect(dotPattern(0.1, { ...options, minOpacity: -1 }).opacity).toBe(0);
  });

  it('uses the canvas zoom floor for the pattern scale', () => {
    expect(dotPattern(0, options).gapPx).toBe(8);
    expect(dotPattern(0, options).radiusPx).toBe(1);
  });
});
