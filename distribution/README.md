# Packaging

Shared release metadata for the distribution channels (Homebrew, Scoop,
Flathub, Snap Store) and the tooling that keeps it fresh. Nothing here is
published on its own — the channel manifests and store listings consume the
files in `metadata/`.

## Metadata

| File | Contents | Consumed by |
|---|---|---|
| `metadata/summary.md` | One-line summary (38 chars, well under the 78-char Snap limit) | Snap `summary`, Flathub `<summary>`, Homebrew cask `desc`, Scoop `description` |
| `metadata/description.md` | Full description, Markdown | Snap `description` (the store renders Markdown), Flathub `<description>` (as `<p>` blocks), store listing pages |
| `metadata/org.doru.doru.metainfo.xml` | AppStream metainfo: id, name, summary, description, categories, keywords, OARS content rating, URLs, screenshots | Flathub (copied into the `flathub/org.doru.doru` repo; validated by `flatpak-builder-lint`) |
| `metadata/screenshots/*.png` | 3200×1800 PNG screenshots (1600×900 logical window at 2x) | Flathub (referenced from the metainfo), Snap Store listing, website |

## Identifiers and categories

- App id / Linux desktop name: `org.doru.doru` (set in
  `apps/desktop/package.json`); Flatpak uses the same id.
- Snap name: `doru` (free as of 2026-10; register before first upload).
- Homebrew cask token: `doru`; Scoop manifest: `doru`.
- XDG categories (Flatpak desktop file and metainfo): `Education;Science;`.
  The Linux `deb`/`AppImage` builds set `Education` via
  `electron-builder.yml`.
- Snap Store category: `Education` (chosen in the store dashboard after the
  name is registered; snapcraft.yaml has no category field).
- macOS categories are platform-specific and already set:
  `public.app-category.lifestyle` for direct builds, MAS handles its own
  listing separately.
- License: MIT (SPDX `MIT`). The metainfo text itself is CC0-1.0.
- Homepage: https://doru.family — Source: https://github.com/borisovodov/doru

## Keeping it fresh

- **Screenshots** — regenerate after any notable UI change:
  `npm run build && node scripts/capture-screenshots.ts`. The script runs the
  built app against throwaway temp dirs (isolated `DORU_USER_DATA`, a seeded
  tree file) and forces the English locale with `--lang=en-US`, so output is
  deterministic and contains no user data.
- **Text** — `summary.md` and `description.md` are the source of truth;
  after editing them, mirror the changes into
  `org.doru.doru.metainfo.xml` and the channel manifests.
- **Screenshot URLs** — the metainfo references the PNGs through
  `raw.githubusercontent.com` URLs, so they render everywhere without a
  website deploy. If they move (e.g. to a CDN on doru.family), update the
  metainfo in the same commit.

## Distribution tests

`distribution-tests.yml` installs the freshly built artifact through each
real channel and verifies the install location, display names, icon, the
`.doru`/`.ged`/`.gdz` file associations, a real launch, and the first-run
files. It runs only from the Release workflow (which waits for it) or
manually via `workflow_dispatch` (with a `channels` input) — it is
deliberately not part of the per-push CI.

The channel manifests are taken live from the distributor repositories
(`borisovodov/homebrew-taps`, `borisovodov/flatpak`,
`borisovodov/bucket`) at their current `main` — a breakage there means users
are broken right now. Each manifest is transformed in place: the released
version/hashes are replaced with the locally built artifact's and the
artifact is served from a local HTTP server. Nothing is duplicated into
this repository.

Known deviations of the test environment from a real user install, decided
one by one (each is documented at the point of use in
`.github/scripts/dist-tests/`):

- **macOS**: the test build is unsigned, and a headless runner has nobody
  to click through the first-launch verification dialog — `open` would
  block forever, so the app is launched by direct exec.
- **Linux (cask)**: no display server — the app runs under `xvfb` +
  `dbus-run-session` with `--no-sandbox --disable-gpu`.
- **Flatpak**: the bundle is unsigned and installed from a local
  `--no-gpg-verify` remote; `XDG_DATA_DIRS` is set explicitly (on a real
  machine the flatpak profile snippet adds the exports dir); first-run
  files are checked in `~/.var/app/org.doru.doru/config/Doru`, where
  flatpak redirects `XDG_CONFIG_HOME`.
- **Windows (Scoop)**: only the x64 manifest variant is exercised (no
  arm64 runners); the bucket is cloned from the local checkout instead of
  GitHub.
- **Common**: manifests get a synthetic version (`0.0.0-test`); file
  association checks poll with retries because Launch Services and the
  gio MIME caches are asynchronous.
