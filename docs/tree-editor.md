# Tree editor: architecture, decisions and future work

The interactive family tree lives in the tree tab of the desktop app. This
document captures the architecture, the decisions made while building it,
the remaining work and the pitfalls discovered along the way.

## Architecture

- **Layout is pure math in `packages/core/src/layout/`.** `layoutPedigree`
  turns the domain model (persons + families) into card positions and edge
  geometry with no DOM, React or d3-selection involved. The same code can
  back a future static chart export (e.g. the MCP `charts_render` tool).
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
- **React Flow is the canvas runtime only** (viewport, gestures, selection,
  minimap). It never owns the data: nodes/edges are projected from the pure
  layout (`features/src/tree/project.ts`) in controlled mode.
- **Deterministic auto-layout.** Positions are computed, never stored — the
  `.doru` file holds no coordinates. The fit is computed from the exact
  layout bounds (`features/src/tree/fit.ts`), never zooms in beyond 1, and
  re-runs on canvas resize.
- **Every mutation is one compound op.** Adding a relative, deleting a
  person and reparenting are single ops in `packages/core/src/ops/person.ts`
  that also manage the family links — one Cmd+Z undoes a whole user action.
- **Bulk reads.** `tree:all` (all persons + families) and
  `tree:personCounts` (badge counts for a list of persons) avoid N+1 IPC.

## Decisions

- The full person editor stays a tab (PersonTab); the card action "Edit"
  opens it. The canvas handles structure and quick edits.
- Default focus is `suggestFocusPerson`: a childless child (youngest
  generation), then any child, then the first person.
- Manual card positions are not persisted; auto-layout is the source of
  truth. Revisit only if a free-form mode is wanted.
- Chart kinds: ancestors → descendants → hourglass → family.
- Dependencies: only d3 (pure math) and React Flow. No dagre/elk/genealogy
  libraries — the layout is domain code we own.

## Future work

- Photos on cards (the `doru-media://` protocol exists) and richer badges.
- Inline editing of names/dates directly on the card (currently a form
  panel).
- Hover tooltips with quick actions on cards.
- Relationship calculator (BFS over families in core).
- Circular fan chart (polar projection of the same graph).
- Chart export to PNG/PDF (layout + static SVG rendering via main).
- Filters: hide living people, direct line only, default generation count.
- Duplicate detection and a `mergePersonsOp`.
- Timeline view (life lines); places/map overlay.
- "See also" polish for collapsed/duplicated persons (the cycle link exists).

## Pitfalls and lessons

- **React Flow v12**
  - Controlled mode silently drops selection changes unless `onNodesChange`
    / `onEdgesChange` are wired with `applyNodeChanges`/`applyEdgeChanges`.
  - Edges require `Handle`s on nodes (error #008) — the pedigree edges use
    invisible handles and carry their own geometry in edge data.
  - The pane's double-click zoom (d3-zoom) calls `stopImmediatePropagation`,
    which kills React's `onDoubleClick` anywhere inside the pane — set
    `zoomOnDoubleClick={false}` when double-click has its own meaning.
  - `useNodesInitialized` stays `false` until the `nodes` prop changes
    identity; do not gate viewport logic on it.
  - React StrictMode double-mounts the flow subtree, and the second pan/zoom
    instance resets the viewport — schedule fit as a macrotask.
  - `fitView` zooms small charts in up to `maxZoom`; compute the fit
    manually from layout bounds and cap zoom at 1.
- **Dóru specifics**
  - `@doru/core`'s entry pulls `node:sqlite` into the renderer; runtime
    imports from the renderer must use the pure `@doru/core/layout` subpath.
  - `listPersons` defaults to a limit of 100 — canvases need the full
    `tree:all` endpoint; keep paginated reads for lists.
  - GEDCOM importer keeps pointers as ids (`@I1@`, `@F1@`) — fixtures and
    tests must not assume pretty ids.
  - Vitest uses `Object.is` — normalize `-0` in layout math.
- **Tooling**
  - Playwright-launched Electron windows do not resize like native ones;
    launch the app directly (`npx electron apps/desktop <project>.doru`)
    for manual testing.
  - Destructive test scripts must use isolated projects — a shared demo
    file gets corrupted by delete/reparent experiments.
