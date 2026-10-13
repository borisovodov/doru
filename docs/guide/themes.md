# Themes

The interface is styled entirely through CSS custom properties, applied at the
app level — never per project.

- **Built-in themes** — `doru-dark` and `doru-light`, chosen per OS appearance
  in `doru.json` (see [Configuration](configuration.md)). Switch your OS to
  light mode and Dóru follows instantly; there is no in-app toggle.
- Built-in themes ship as real files in the app's `themes/` directory, and the
  same mechanism could serve user-installed themes later.

Available variables (used by the workbench and the feature views):

| Variable | Meaning |
|---|---|
| `--doru-activity-bar-bg` | leftmost icon strip background |
| `--doru-side-bar-bg` | sidebar background |
| `--doru-editor-bg` | main editor background |
| `--doru-panel-bg` | bottom panel (chat) background |
| `--doru-fg` / `--doru-fg-dim` | main and muted text |
| `--doru-border` | borders and separators |
| `--doru-accent` | highlights, active tabs, buttons |
| `--doru-input-bg` | inputs, chips, code blocks |
