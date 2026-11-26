import { describe, expect, it } from 'vitest';
import { fitViewport, rectsIntersect, screenToWorld, worldToScreen, type Rect } from '../src';

function bounds(width: number, height: number, x = 0, y = 0): Rect {
  return { x, y, width, height };
}

describe('fitViewport', () => {
  it('centers the bounds in the canvas', () => {
    const viewport = fitViewport(bounds(200, 100, 50, 10), 1000, 500);
    expect(viewport.x).toBeCloseTo((1000 - 200 * viewport.zoom) / 2 - 50 * viewport.zoom);
    expect(viewport.y).toBeCloseTo((500 - 100 * viewport.zoom) / 2 - 10 * viewport.zoom);
  });

  it('never zooms in beyond maxZoom for small charts', () => {
    const viewport = fitViewport(bounds(100, 50), 2000, 2000, { maxZoom: 1 });
    expect(viewport.zoom).toBe(1);
  });

  it('zooms out for large charts and stays above the floor', () => {
    const viewport = fitViewport(bounds(10_000, 10_000), 1000, 800);
    expect(viewport.zoom).toBeGreaterThanOrEqual(0.1);
    expect(viewport.zoom).toBeLessThan(1);
  });

  it('keeps zoom at the floor for enormous charts', () => {
    const viewport = fitViewport(bounds(1_000_000, 1_000_000), 1000, 800);
    expect(viewport.zoom).toBe(0.1);
  });

  it('respects custom min and max zoom', () => {
    const viewport = fitViewport(bounds(10, 10), 1000, 800, { minZoom: 0.5, maxZoom: 0.75 });
    expect(viewport.zoom).toBe(0.75);
  });
});

describe('coordinate conversion', () => {
  it('round-trips screen and world points', () => {
    const viewport = { x: 40, y: -12, zoom: 1.5 };
    const point = { x: 320, y: 180 };
    const roundTrip = worldToScreen(screenToWorld(point, viewport), viewport);
    expect(roundTrip.x).toBeCloseTo(point.x);
    expect(roundTrip.y).toBeCloseTo(point.y);
  });
});

describe('rectsIntersect', () => {
  it('detects overlapping rectangles', () => {
    expect(rectsIntersect(bounds(10, 10), bounds(5, 5))).toBe(true);
  });

  it('rejects touching and disjoint rectangles', () => {
    expect(rectsIntersect(bounds(10, 10), bounds(10, 0))).toBe(false);
    expect(rectsIntersect(bounds(10, 10), bounds(10, 10, 20, 20))).toBe(false);
  });
});
