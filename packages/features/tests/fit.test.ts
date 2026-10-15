import { describe, expect, it } from 'vitest';
import type { PedigreeLayout } from '@doru/core';
import { computeFit } from '../src/tree/fit';

function layoutOf(width: number, height: number, minX: number, minY: number): PedigreeLayout {
  return {
    cards: [],
    edges: [],
    focusKey: 'person:x@focus',
    width,
    height,
    minX,
    minY,
  };
}

describe('computeFit', () => {
  it('centers the chart bounds in the canvas', () => {
    const layout = layoutOf(200, 100, 50, 10);
    const viewport = computeFit(layout, 1000, 500);
    expect(viewport.x).toBeCloseTo((1000 - 200 * viewport.zoom) / 2 - 50 * viewport.zoom);
    expect(viewport.y).toBeCloseTo((500 - 100 * viewport.zoom) / 2 - 10 * viewport.zoom);
  });

  it('never zooms in beyond 1 for small charts', () => {
    const viewport = computeFit(layoutOf(100, 50, 0, 0), 2000, 2000);
    expect(viewport.zoom).toBe(1);
  });

  it('zooms out for large charts and stays above the floor', () => {
    const viewport = computeFit(layoutOf(10_000, 10_000, 0, 0), 1000, 800);
    expect(viewport.zoom).toBeGreaterThanOrEqual(0.1);
    expect(viewport.zoom).toBeLessThan(1);
  });

  it('keeps zoom at the floor for enormous charts', () => {
    const viewport = computeFit(layoutOf(1_000_000, 1_000_000, 0, 0), 1000, 800);
    expect(viewport.zoom).toBe(0.1);
  });
});
