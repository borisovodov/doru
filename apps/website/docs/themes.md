# Themes

The interface is styled entirely through CSS custom properties, applied at the
app level — never per project.

- **Built-in theme** — `doru`, a single JSON palette file in the app's
  `themes/` directory: one file per theme, no CSS. The file holds both the
  `dark` and the `light` palette; the operating system appearance decides
  which one applies — switch your OS to light mode and Dóru follows
  instantly. The file name is the theme id (`doru.json`); the `name` field
  inside is the display name.
- Pick the theme in `settings.json` (see [Settings](settings.md)) with
  a single string, or from the in-app **Settings** page (Theme dropdown);
  the choice is stored in `settings.json` either way.
- The `colors` of the active palette are resolved to `--doru-*` CSS custom
  properties at startup.

## User themes

Drop a `<id>.json` file with `dark` and `light` palettes into the `themes`
directory inside the app's data directory (the same place where `settings.json`
lives — see [Settings](settings.md)), then pick it with
`"theme": "<id>"` in `settings.json`. Restart the app after adding a file so it
is picked up. The directory is created on first run; a user theme whose id
matches a bundled one overrides it. A theme file that is malformed or does not
match the schema is skipped (a warning is logged), like a missing one, and does
not appear in the theme list. Bundled themes carry a `$schema` reference
(`https://doru.family/theme.json`) — add the same line to your own
file to get autocompletion and validation in editors that understand JSON
Schema.

Bundled themes, each with a dark and a light palette:

| Theme id | Display name |
|---|---|
| `doru` (default) | Dóru |
| `one-dark` | One Dark |
| `github` | GitHub |
| `solarized` | Solarized |
| `gruvbox` | Gruvbox |
| `catppuccin` | Catppuccin |
| `ayu` | Ayu |
| `rose-pine` | Rosé Pine |
| `everforest` | Everforest |

The default Dóru palette follows the app icon: a deep forest green with warm
paper tones. The dark palette layers surfaces from a near-black green-tinted
canvas to lighter chrome and popovers; the light palette uses warm paper and
cream.

Available variables:

| Variable | Meaning |
|---|---|
| `--doru-bg-canvas` | editor background and tab strip |
| `--doru-bg-chrome` | activity bar, sidebars, floating-panel surface |
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
| `--doru-panel-gutter` | gap between the floating panels and the window edge (4px) |
| `--doru-panel-radius` | floating-panel corner radius (8px) |
