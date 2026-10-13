# Quick start

1. Launch Dóru and click **Create New Project** (or **Open Project…**) on the
   start page. Choose or create a folder — this folder *is* your project.
2. Dóru creates the project skeleton automatically (silently):

```
My Family/
├── tree.doru         the tree itself (SQLite, branded with an app id)
└── media/            place photos and scanned documents here
```

3. Get data in: click **Import GEDCOM…** and pick a `.ged` file (GEDCOM 5.5 /
   5.5.1 dialects are imported; exports are written as GEDCOM 7.0). Or start
   from scratch with **Add Person**.

Projects can be opened in tabs — several trees side by side. Recently used
projects are listed on the start page, and your open tabs are restored on the
next launch. Double-clicking a `*.doru` file (or opening a `doru://open?path=…`
link) opens it in the running app.

## Next steps

- [Working with the tree](tree.md) — persons, families, sources, notes.
- [Configuration](configuration.md) — the `doru.json` reference.
- [AI and agents](agents.md) — let an agent read and edit your tree.
- [Themes](themes.md) — dark and light themes, chosen per OS appearance.
