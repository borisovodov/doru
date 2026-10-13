# Themes

The interface is styled entirely through CSS custom properties, applied at the
app level — never per project.

- **Built-in themes** — `doru-dark` and `doru-light`, chosen per OS appearance
  in `doru.json` (see [Configuration](configuration.md)). Switch your OS to
  light mode and Dóru follows instantly; there is no in-app toggle.
- Built-in themes are single JSON palette files in the app's `themes/`
  directory: the `colors` map is resolved to `--doru-*` CSS custom properties
  at startup (one file per theme, no CSS). The same mechanism could serve
  user-installed themes later.

The palette follows the app icon: a deep forest green with warm paper tones.
The dark theme layers surfaces from a near-black green-tinted canvas to
lighter chrome and popovers; the light theme uses warm paper and cream.

Available variables:

| Variable | Meaning |
|---|---|
| `--doru-bg-canvas` | main editor background |
| `--doru-bg-chrome` | activity bar, sidebars, tab strip |
| `--doru-bg-raised` | cards, chips, the chat input |
| `--doru-bg-popover` | menus and pickers |
| `--doru-bg-input` | buttons, inputs, selects |
| `--doru-fg` / `--doru-fg-muted` / `--doru-fg-faint` | main, muted and faint text |
| `--doru-border` / `--doru-border-strong` | hairlines and stronger borders |
| `--doru-accent` / `--doru-accent-hover` / `--doru-accent-active` | accent (forest/sage green) |
| `--doru-on-accent` | text on the accent background |
| `--doru-accent-alpha` | translucent accent (chips, chat bubbles) |
| `--doru-focus` | focus ring color |
| `--doru-overlay-hover` / `--doru-overlay-pressed` | hover/pressed overlays |
| `--doru-success` / `--doru-warning` / `--doru-danger` / `--doru-info` | state colors |
| `--doru-radius-sm` / `--doru-radius-md` / `--doru-radius-lg` | 4 / 6 / 8 px radii |
| `--doru-control-height` | control height (28px) |
