# Tree editor: architecture, decisions and future work

The interactive family tree lives in the tree tab of the desktop app. This
document captures the architecture, the decisions made while building it and
the pitfalls discovered along the way. Future work lives in GitHub issues (see
the "Tree editor" issue track).

## Architecture

- **Layout is pure math in `packages/core/src/layout/`.** `layoutPedigree`
  turns the domain model (persons + families) into card positions and edge
  geometry with no DOM, React or d3-selection involved.
  - `types.ts` — the public shapes and layout defaults;
  - `graph.ts` — DAG → tree conversion (role duplication, cycle guards);
  - `directional.ts` — ancestor/descendant tidy trees (d3-hierarchy);
  - `family.ts` — the shallow family view laid out directly;
  - `pedigree.ts` — dispatch, hourglass merge, focus heuristics.
- **Genealogy is a DAG, not a tree.** Second marriages and pedigree collapse
  are handled by duplicating a person per family role. Card keys are
  role-based and stable: `person:<id>@focus`, `person:<id>@spouse:<fam>`,
  `person:<id>@child:<fam>`.
- **Couples** are tidy-tree slots expanded into two adjacent cards with a
  marriage edge between them and a pedigree "bracket" (Z-shaped edge)
  dropping to the children.
- **`@doru/canvas` is the canvas runtime.** The internal package owns the
  viewport (`d3-zoom`), the transformed world layer, screen-space panels and
  overlays. The tree feature maps the pure layout to positioned cards and
  precomputed SVG paths. The canvas never owns domain data and never measures
  DOM nodes.
- **Positions are computed, never stored.** The `.doru` file holds no
  coordinates. Cards have fixed sizes and the layout is the only source of
  their world positions.
- **Fit is a camera command, not a layout pass.** It runs on the first visible
  size and when the chart shape changes (focus, chart kind, card keys,
  bounds). A rename or date edit recomputes the layout but keeps the same
  shape key, so the user's zoom and pan survive. Container resize and tab
  switching preserve the camera; the Fit button restores a fitted view.
- **Every mutation is one compound op.** Adding a relative and deleting a
  person are single ops in `packages/core/src/ops/person.ts` that also manage
  the family links — one Cmd+Z undoes a whole user action.
- **Bulk reads.** `tree:all` (all persons + families) and
  `tree:personCounts` (badge counts for a list of persons) avoid N+1 IPC.

## Decisions

- The full person editor stays a tab (PersonTab); the card action "Edit" opens
  it. The canvas handles structure and quick edits.
- Default focus is `suggestFocusPerson`: a childless child (youngest
  generation), then any child, then the first person.
- Manual card positions are not persisted; auto-layout is the source of
  truth. There is no free-form positioning and no multi-select.
- Delete/Backspace is not bound on the canvas. Deletion goes through the card
  toolbar (a domain op with undo), so React Flow's accidental "remove the node
  from the view only" behaviour cannot come back.
- Chart kinds: ancestors → descendants → hourglass → family.
- Dependencies: `d3-hierarchy` for pure layout math in `@doru/core`, and
  `d3-zoom` in `@doru/canvas` for the viewport. The canvas library itself is
  ours; there is no general node-graph framework dependency.

## Pitfalls and lessons

- **Canvas runtime**
  - Node measurement is deliberately absent. Cards have fixed sizes and edges
    are plain SVG paths from layout geometry; do not add a ResizeObserver per
    card.
  - The only ResizeObserver observes the canvas container. It reads its size
    and may schedule a pending fit in `requestAnimationFrame`; it never
    changes layout. This is what keeps the browser's "ResizeObserver loop"
    warning away.
  - Pan is a CSS `transform` on one world layer, not React state. Cards must
    not re-render on pan/zoom; only the background and the anchored overlay
    subscribe to the viewport.
  - Cards are not draggable: positions come from the layout, and dragging
    anywhere on the canvas pans it.
  - Selection is a single card key owned by the tree feature. It is
    independent of layout re-computation, so badge counts, photos or a rename
    cannot clear the selected card's toolbar.
  - The card toolbar is a screen-space `CanvasOverlay` anchored to the card's
    world rectangle. It stays at a constant size at every zoom level.
  - Trackpad model: two-finger scroll pans, pinch (ctrl+wheel on macOS) zooms,
    mouse users zoom with Ctrl/Cmd+wheel or the zoom buttons. Double-click
    zoom is disabled because double-click refocuses the chart.
- **Dóru specifics**
  - `@doru/core`'s entry pulls `node:sqlite` into the renderer; runtime
    imports from the renderer must use the pure `@doru/core/layout` subpath.
  - `listPersons` defaults to a limit of 100 — canvases need the full
    `tree:all` endpoint; keep paginated reads for lists.
  - E2E seeds use literal ids (`I1`, `F1`) — tests must not assume pretty ids.
  - Vitest uses `Object.is` — normalize `-0` in layout math.
- **Tooling**
  - Playwright-launched Electron windows do not resize like native ones;
    launch the app directly (`npx electron apps/desktop <project>.doru`) for
    manual testing.
  - Destructive test scripts must use isolated projects — a shared demo file
    gets corrupted by delete experiments.
