# Quick start

1. Launch Dóru and click **Create New Project** (or **Open or Import
   GEDCOM…**) on the start page.
2. **Create** asks for a location and a name and creates a `.doru` file there;
   **Open or Import GEDCOM** opens an existing `.doru` file, or a
   `.ged`/`.gdz` GEDCOM file — a GEDCOM file starts a new, not-yet-saved
   project (the import itself is still being rebuilt, so it opens empty for
   now; save it to `.doru` afterwards). The file *is* the project — its name
   is the project's name:

```
My Family.doru      the tree itself (SQLite, branded with an app id)
media/              photos and scans, created on demand (optional)
```

3. Get data in: a new tree shows one empty card — click it, type the name,
   confirm with the checkmark, and the first person appears on the canvas;
   every card can add children, spouses and parents the same way. GEDCOM
   files come in through **Open or Import GEDCOM** (step 2); **Export
   GEDCOM…** is not wired up yet — GEDCOM support is being rebuilt in the
   `@doru/gedcom` package.

Each project opens in its **own window**; persons, the tree editor and the
settings open as tabs inside it. Recently used projects are listed on the
start page, and your open project windows are restored on the next launch.
Double-clicking a `*.doru` file (or opening a
`doru://open?path=/…/family.doru` link) opens it in the running app.

## Opening projects from links

The app registers the `doru://` URL scheme, so a `doru://open?path=…` link
opens the project — or imports the file, for `.ged`/`.gdz` — even when the
app is not running yet:

- The path must be **absolute and URL-encoded** (`%20` for spaces, and so
  on), e.g. `doru://open?path=%2FUsers%2Fyou%2FFamily.doru`.
- If the app is not running, the link launches it and opens the project
  right away.
- If the app is already running, the project opens in the running instance
  — a second instance is never started, the existing window is focused.
- Links only work for the file types the app opens directly: `.doru`
  projects and `.ged`/`.gdz` GEDCOM files.

On macOS, `open "doru://open?path=…"` sends the link from the terminal or
from other apps; on Linux, `xdg-open` does the same.

## Next steps

- [Working with the tree](tree.md) — persons, families, sources, notes.
- [Settings](settings.md) — the `settings.json` reference.
- [AI and agents](agents.md) — let an agent read and edit your tree.
- [Themes](themes.md) — one theme with dark and light palettes, chosen per OS
  appearance.
