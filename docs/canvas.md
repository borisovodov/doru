# `@doru/canvas`: the internal canvas runtime

`@doru/canvas` is the shared interaction layer for pannable, zoomable 2D
canvases. It was extracted when the tree editor dropped React Flow. It is not
a general node-graph framework: it has no node/edge data model, no change
sets, no selection model and no connection handles. The feature that uses it
owns all of those decisions.

## Boundaries

- React + `d3-zoom`/`d3-selection` only.
- No `@doru/core`, `@doru/ui`, `@doru/platform` or other workspace imports.
- No Electron, no Node built-ins, no localization strings.
- Structure comes from CSS Modules; colors and domain styling come from the
  caller.

## Coordinate model

There are two coordinate spaces:

- **world** — the layout's stable coordinate system; card positions, band
  rectangles and edge geometry live here;
- **screen** — pixels relative to the canvas element.

A viewport is `{ x, y, zoom }` and maps world to screen:

```
screen = world * zoom + { x, y }
world  = (screen - { x, y }) / zoom
```

The `CanvasWorld` layer receives one CSS `transform: translate(x, y) scale(k)`
on the canvas element. Cards and edges are absolutely positioned in world
coordinates inside that layer. Panning and zooming therefore never re-render
the cards; only the background and screen-space overlays subscribe to the
viewport store.

## Viewport and gestures

- `d3-zoom` owns drag-panning and touch input.
- A custom wheel handler gives the trackpad model:
  - two-finger scroll pans;
  - Ctrl+wheel (Cmd+wheel on macOS) or pinch zooms around the pointer;
  - double-click zoom is disabled.
- `CanvasProvider` creates a tiny `useSyncExternalStore` viewport store.
  `CanvasWorld` is updated imperatively through a ref; `CanvasBackground` and
  `CanvasOverlay` use `useCanvasViewport()` and re-render on zoom/pan.
- The canvas has no per-node `ResizeObserver`. One container observer reads
  `clientWidth`/`clientHeight` and may schedule a pending fit in
  `requestAnimationFrame`; it never changes layout.

## Fit

`fitViewport(bounds, width, height, options)` centers bounds with a padding
fraction and clamps zoom. `Canvas` accepts `fitBounds` and `fitKey`:

- fit on the first visible (non-zero) size;
- fit again when `fitKey` changes;
- never fit on window/container resize or on data edits that keep the shape.

The feature builds `fitKey` from the chart shape (focus, card keys and
bounds), not from person-record identity. That is why a rename does not reset
the user's camera.

`useCanvas()` exposes `fit`, `setViewport`, `zoomIn`, `zoomOut`,
`getViewport`, `screenToWorld` and `worldToScreen` for buttons and other
children of the provider.

## Overlays and panels

- `CanvasPanel` is a screen-space panel at one of four corners.
- `CanvasOverlay` is anchored to a world rectangle but stays at a constant
  screen size (used for the selected card's action toolbar).
- `CanvasBackground` draws the dots pattern in screen space, offset and scaled
  by the viewport, with a minimum on-screen gap and dot size so the pattern
  stays readable at low zoom instead of collapsing into a solid tint. It can
  also fade the pattern down to a configurable minimum opacity as the gap
  shrinks, before it becomes visual noise.
- Elements with `data-canvas-no-pan` do not start a pan; elements with
  `data-canvas-no-wheel` do not pan on wheel.

## Testing

Pure geometry (`screenToWorld`, `worldToScreen`, `fitViewport`) is
unit-tested. Interaction is covered by Playwright: panning, zoom buttons, fit,
selection and the absence of `ResizeObserver` loop errors in the
console/window error stream.
