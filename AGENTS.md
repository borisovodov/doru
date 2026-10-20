# AGENTS.md

Instructions for AI agents and contributors working on this repository.

## Project

Dóru — local-first genealogy for the AI era: Electron + TypeScript, monorepo,
SQLite-based tree documents (`.doru` files), text-based config/themes, MCP
host+server, ACP agents, agent chat. MIT-licensed; no
accounts, no cloud, no telemetry — user data never leaves the machine unless
the user explicitly sends it.

Design rationale: [docs/architecture.md](docs/architecture.md). Deliberate
non-goals: [docs/decisions.md](docs/decisions.md).

## Language policy

- All documents (README.md, AGENTS.md, CONTRIBUTING.md, docs/, commit
  messages) are written in **English only**.
- All code — identifiers, comments, docstrings — is written in **English
  only**.
- Commit messages: English, concise, imperative mood.
- **Pull request titles are user-facing; the rest of a PR is for
  maintainers.** GitHub release notes are generated from merged PR titles,
  and the releases page doubles as the changelog that users are pointed to.
  Write PR titles as plain sentences a non-technical reader understands — no
  conventional-commit or area prefixes (`feat:`, `fix:`, `chore:`, `docs:`,
  `ci:`, `style:`, `website:`, …). The PR body and commit messages stay as
  they are today: technical, imperative, written for maintainers.

## Localization rules (applies to all UI code)

- Never hardcode user-facing strings in the UI. All UI strings go through the
  nls layer with keys of the form `area.feature.message` (see
  docs/architecture.md, Localization section).
- **`npm run check:nls` enforces this in CI** (also on every PR): every
  English key must exist, be non-empty and use the same `{n}` placeholders in
  all 17 locales, and UI code must not hardcode JSX text or literal
  `title`/`placeholder`/`alt`/`aria-label` strings. Escape hatch for
  genuinely universal strings: a `nls-ignore` comment on the same or previous
  line. The checker is part of the CI setup and lives in
  `.github/scripts/check-nls.ts` — not in the `scripts/` dev helpers.
- The base language is English: the English source text doubles as the
  fallback value. Add the English bundle entry first, then translations.
- Locale bundles mirror the common IDE display language set: en, ru, fr, de,
  it, es, pt-br, cs, pl, hu, bg, el, tr, ja, ko, zh-cn, zh-tw.
- MCP tool names and other machine identifiers stay in English; only their
  human-readable descriptions are localized.
- MCP tool names must match `^[a-zA-Z0-9_-]+$` — use underscore separators
  (`tree_query`, `sources_add`, `charts_render`). Strict providers (e.g.
  DeepSeek) reject dots and colons.
- Breaking our own APIs — including MCP tool names and website URLs — is
  fine before 1.0.0; do not add compatibility shims.
- **No migrations before 1.0.0.** The project format, the SQLite schema, and
  storage layouts change freely; do not write code that upgrades old data or
  reads old formats. Newer versions may simply not understand files written by
  older ones.
- The UI locale always follows the operating system; there is no in-app
  language setting (see docs/decisions.md).

## Architecture conventions

- Strict package boundaries: `packages/core` must not import `platform`,
  `workbench`, or anything UI-related. UI and agents access the domain model
  only through services.
- SQLite is only touched by the Electron main process; renderer and agents go
  through IPC/MCP tools.
- Every tree mutation goes through ops (command pattern with inverse) so that
  undo/redo stays consistent.
- Keep the service layer free of Electron-specific APIs where feasible
  (allows future Capacitor/mobile reuse).
- **One window per open project file.** The main process maps project keys
  (`.doru` paths, or `untitled:` ids for GEDCOM imports that were never
  saved) to `BrowserWindow`s (`projectWindows`) and webContents ids to
  projects (`windowProject`); opening a file focuses its window or binds a
  welcome window instead of creating duplicates. Window-close cleanup must
  read the *current* binding from `windowProject` — never capture the
  creation-time path in the `closed` closure (a rebinding leaks a destroyed
  window).
- **Tabs are entities, not projects.** The renderer keeps open tabs in
  `openTabs` with ids `tree`, `settings`, `person:<id>`, `person:new:<uuid>`.
  Tabs are kept alive via the `.editor-stack`/`.editor-pane` pattern (inactive
  panes are hidden, not unmounted). The welcome page is the editor-area state
  with zero tabs — it is not a window type of its own. `Cmd/Ctrl+W` closes the
  active tab via renderer keybindings, not via the application menu.
- **UI drags are pointer-based, not HTML5 drag-and-drop** (tab reorder,
  side-bar sashes): `setPointerCapture` + a gesture threshold + Escape
  cancel. Native drag sessions flash the macOS copy cursor and fight our
  cursor/ghost styling. Use custom tooltips instead of `title` (broken under
  the drag region on macOS), and always reset `padding: 0` on icon-only
  buttons — the UA button padding collapses flex child SVGs. See the
  "Interaction conventions" bullet in docs/architecture.md.
- **macOS app icons.** The icon source of truth is the Icon Composer project
  `apps/desktop/build/Icon.icon`. electron-builder renders the app bundle icon
  from it at package time (actool, Xcode 26+). `npm run icon:mac -w
  @doru/desktop` regenerates the committed `build/icon.icns` (DMG volume icon)
  and `build/icon-dev.png` (macOS dev dock icon); commit both after editing
  `Icon.icon`. Dev uses that PNG because Electron's `nativeImage` cannot load
  `.icns` files — the packaged app gets its icon via Info.plist
  (`CFBundleIconName`/`Assets.car`), which is macOS, not Electron.
- **Recent projects carry security-scoped bookmarks (macOS).** Every macOS
  build — MAS, Homebrew, direct download alike — mints a security-scoped
  bookmark for a tree file the moment it opens (koffi FFI →
  CoreFoundation `CFURLCreateBookmarkData`; Electron can only resolve them
  via `app.startAccessingSecurityScopedResource`) and stores it in
  `recent.json`. Reopening a recent project resolves the bookmark, so a
  sandboxed MAS build behaves exactly like an unsandboxed one; if the file is
  still not readable, a user-initiated open falls back to the file dialog.
  MAS entitlements (`apps/desktop/build/entitlements.mas*.plist`) cover
  outbound network, user-selected file access, and app-scope bookmarks.
- **Future work lives in GitHub issues, not in docs.** When a design document
  lists "future work"/"todo" items, file them as issues (`gh issue create`)
  and keep the document to what exists and why. Never leave roadmap-style
  lists in the repository text.

## Verification

- Unit tests: vitest (`npm test`). E2E: Playwright against Electron
  (`npm run build` first, then `npm run e2e`).
- Localization guard: `npm run check:nls` (runs in CI). Fails on incomplete
  locale bundles or hardcoded user-facing UI strings.
- Typecheck all workspaces: `npm run typecheck` (this also covers the root
  `tsconfig.json`: `playwright.config.ts`, `vitest.config.ts`, `e2e/`, and the
  dev helper scripts).
- Dev helper scripts (`scripts/*.ts`, `apps/*/scripts/*.ts`) are TypeScript
  run directly by Node's built-in type stripping (Node ≥ 24): `node
  scripts/ui-check.ts`. They must therefore use only erasable syntax — no
  enums, namespaces, or parameter properties.
- Build the desktop app: `npm run build`; run it in dev mode: `npm run dev`.
- **Dev runs get their own `userData`.** The main process takes a
  single-instance lock on `userData`; two dev instances sharing
  `~/Library/Application Support/Doru` kill each other (the loser quits
  immediately). Always start dev with an isolated user-data dir:
  `DORU_USER_DATA="$(mktemp -d -t doru-dev-)" npm run dev` — or point at a
  stable per-session tmp path if you want recents to survive restarts. Do not
  rely on the default userData during a session, and never quit other
  sessions' instances to free the lock.
- Run tests before considering a change complete.
- **Restart `npm run dev` after editing `apps/desktop/src/main` or
  `src/preload`** — electron-vite's watcher does not reliably rebuild the main
  process or the preload bundle. Renderer changes hot-reload fine.
- npm 11 blocks dependency install scripts unless they are approved in the
  root `allowScripts` field of `package.json` (keep it in sync when adding
  packages with install scripts: `npm install-scripts approve <pkg>`).
- Electron 44+ ships no install script; the root `postinstall` extracts the
  binary via `node node_modules/electron/install.js`. If Electron fails with
  "Electron uninstall", run that command manually and verify `path.txt` points
  to `Electron.app/Contents/MacOS/Electron` (macOS).
- E2E specs must launch the app with an isolated `DORU_USER_DATA` env var (see
  `e2e/smoke.spec.ts`): the single-instance lock otherwise collides with a
  running dev instance.
- Drag simulations in e2e: first `mouse.move` past the 4px gesture threshold
  before the real drag, and assert with retrying `expect(locator).toHaveText`
  instead of one-shot reads — pointer events need both.
- In tests, close the `TreeStore` before removing temp dirs — Windows fails
  with `EPERM` on open files.
- Validate workflow changes with `actionlint .github/workflows/…` before
  pushing: the `secrets` context is not allowed in `if` conditions of steps.
- **Releases are cut by CI.** Pushing a `v*` tag triggers the Release
  workflow, which builds the installers and creates the GitHub release with
  generated notes and assets. Just bump the versions and push the tag — never
  run `gh release create` by hand and never force-move a release tag: every
  workflow run appends its own notes block to the existing release body.
- **macOS installers are Developer ID–signed and notarized in CI.** The
  Release workflow imports the signing certificate into a throwaway keychain
  on the macOS runner (`MAC_CSC_LINK` base64 PKCS#12, `MAC_CSC_KEY_PASSWORD`)
  and notarizes the dmg/zip through the App Store Connect API
  (`APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, `APPLE_API_KEY` written to
  `/tmp/AuthKey.p8`, `--config.mac.notarize=true`). This is what makes
  Squirrel.Mac auto-update possible for site builds. Rotate the repo secrets
  whenever the certificates or API keys are renewed.
- **Version bumps and the lockfile land in one commit.** After bumping
  `version` in the root and workspace `package.json` files, run
  `npm install --package-lock-only` so `package-lock.json` records the new
  versions, and commit the bump together with the lockfile update. Note:
  `npm run build` does *not* touch the lockfile — releasing without the sync
  leaves a stale lock and forces a lockfile-only follow-up commit.
