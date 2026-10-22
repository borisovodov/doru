# Contributing to Dóru

Thanks for your interest in contributing! Dóru is a local-first, MIT-licensed
genealogy app for the AI era — your data stays on your machine. This guide
covers how to set up the project and propose changes.

## Before you start

- Read [AGENTS.md](AGENTS.md) — it defines the language policy, localization
  rules, and architecture conventions that all contributions must follow.
- [docs/architecture.md](docs/architecture.md) explains the "why" behind the
  design; [docs/decisions.md](docs/decisions.md) lists deliberate non-goals.
  All documents and code are in English.

## Getting started

Requirements: Node.js >= 22.13 (Dóru uses the built-in `node:sqlite`) and npm.

```sh
npm install
npm run dev        # run the desktop app in dev mode
```

## Verification

Run all of these before opening a pull request:

```sh
npm test           # unit tests (vitest)
npm run typecheck  # strict TypeScript across all workspaces
npm run build      # production build (electron-vite)
npm run e2e        # Playwright smoke test against the built app
```

## Repository layout

- `apps/desktop` — Electron shell: main process, preload, renderer bootstrap
- `apps/website` — VitePress site (landing + synced user guide)
- `packages/platform` — base services: DI, commands, events, config, theming,
  localization (nls)
- `packages/core` — genealogy domain: GEDCOM, ops, SQLite tree store, project
  self-healing (no UI dependencies)
- `packages/workbench` — the desktop workbench UI shell (activity bar,
  sidebars, editor area, tabs)
- `packages/features` — domain UI
- `packages/ai` — agent layer: connectors, tools

Note: `apps/website/docs/` and `apps/website/public/icon.png` are generated
from `docs/guide/` and the app icon by the sync script (part of
`npm run site:build`) — edit the sources, not the generated files.

Note: `apps/desktop/build` holds the app icons — the Icon Composer project
`Icon.icon` plus the generated `icon.icns` (DMG volume icon) and
`icon-dev.png` (macOS dev dock icon). After editing `Icon.icon`, regenerate
and commit both with `npm run icon:mac -w @doru/desktop` (macOS, Xcode 26+).

## Troubleshooting

- **"Electron failed to install correctly"** — the postinstall download is
  flaky. Delete `node_modules/electron/dist` and `node_modules/electron/path.txt`,
  then run `node node_modules/electron/install.js`.
- **"Electron uninstall" from electron-vite while `dist/` exists** — the
  install script extracted the binary but never wrote `path.txt` (seen with
  Node ≥ 26, where extract-zip's promise does not resolve). Create the file
  manually: content `Electron.app/Contents/MacOS/Electron` on macOS, `electron`
  on Linux, `electron.exe` on Windows.
- **`npm install` skips install scripts** (npm 11 asks for approval) — the
  Electron binary and native deps are not installed. Re-run
  `node node_modules/electron/install.js` after approving or the install stays
  incomplete.

## Making changes

- Open an issue first for anything non-trivial, or comment on an existing one.
- Keep pull requests focused and small; describe what and why.
- All user-facing strings go through the nls layer (see AGENTS.md); never
  hardcode UI text.
- Commit messages in English, concise, imperative mood (e.g. `fix: handle
  corrupted tree files gracefully`).
- Add or update tests for new behavior in `packages/*/tests`.

## Code of conduct

Participation is governed by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Release signing

Linux and Windows builds are **experimental**: they are built by CI, but have
not yet been verified on real Windows/Linux machines. Full instructions for
obtaining and renewing the signing credentials — including the required
GitHub repository secrets — are in [docs/signing.md](docs/signing.md).

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE.md).
