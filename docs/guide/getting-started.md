# Quick start

1. Launch Dóru and click **Open Project…** (or press `F1` → Open Project).
   Choose or create a folder — this folder *is* your project.
2. Dóru creates the project skeleton automatically (silently):

```
My Family/
├── tree.doru         the tree itself (SQLite, branded with an app id)
├── settings.json     project settings (reserved for future use)
├── theme.css         your custom theme overrides (see Themes)
├── history.jsonl     audit log — every change with its author
├── media/            place photos and scanned documents here
└── export/           default location for GEDCOM exports
```

3. Get data in: click **Import GEDCOM…** and pick a `.ged` file (GEDCOM 5.5 /
   5.5.1 dialects are imported; exports are written as GEDCOM 7.0). Or start
   from scratch with **Add Person**.

Projects can be opened in tabs — several trees side by side. Recently used
projects are listed in the sidebar, and your open tabs are restored on the
next launch. Double-clicking a `*.doru` file (or opening a `doru://open?path=…`
link) opens it in the running app.

## Next steps

- [Working with the tree](tree.md) — persons, families, sources, notes.
- [Configuration](configuration.md) — the `doru.json` reference.
- [AI and agents](agents.md) — let an agent read and edit your tree.
- [Themes](themes.md) — make it yours with `theme.css`.
