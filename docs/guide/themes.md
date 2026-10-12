# Themes

The interface is styled entirely through CSS custom properties. The cascade:

1. **Built-in theme** — `doru-dark` or `doru-light`, chosen per OS appearance
   in `doru.json` (see [Configuration](configuration.md)). Switch your OS to
   light mode and Dóru follows instantly; no in-app toggle.
2. **Your overrides** — the project's `theme.css`, applied on top and
   hot-reloaded: edit the file in any editor and the app restyles immediately.

Example `theme.css` that gives the project a warmer look:

```css
:root {
  --doru-accent: #b08968;
  --doru-side-bar-bg: #1f1b18;
  --doru-editor-bg: #171310;
}
```

Available variables:

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
