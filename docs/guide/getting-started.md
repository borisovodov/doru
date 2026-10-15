# Quick start

1. Launch Dóru and click **Create New Project** (or **Open Project…**) on the
   start page.
2. **Create** asks for a location and a name and creates a `.doru` file there;
   **Open** opens an existing `.doru` file. The file *is* the project — its
   name is the project's name:

```
My Family.doru      the tree itself (SQLite, branded with an app id)
media/              photos and scans, created on demand (optional)
```

3. Get data in: click **Import GEDCOM…** and pick a `.ged` file (GEDCOM 5.5 /
   5.5.1 dialects are imported; exports are written as GEDCOM 7.0). Or start
   from scratch: an empty tree offers **Add the first person**, and every
   card can add children, spouses and parents.

Each project opens in its **own window**; persons, the tree editor and the
settings open as tabs inside it. Recently used projects are listed on the
start page, and your open project windows are restored on the next launch.
Double-clicking a `*.doru` file (or opening a
`doru://open?path=/…/family.doru` link) opens it in the running app.

## Next steps

- [Working with the tree](tree.md) — persons, families, sources, notes.
- [Configuration](configuration.md) — the `doru.json` reference.
- [AI and agents](agents.md) — let an agent read and edit your tree.
- [Themes](themes.md) — dark and light themes, chosen per OS appearance.
