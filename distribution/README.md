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
