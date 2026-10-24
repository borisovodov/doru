# Keyboard shortcuts

Dóru follows the usual editor conventions: on macOS shortcuts use ⌘, on
Linux and Windows Ctrl; Shift and Alt/Option (⌥) are the same everywhere.
Shortcut chords (with ⌘/Ctrl/Alt) work from anywhere, including text fields
and the chat input; plain typing never triggers a shortcut.

## Projects

| Action | macOS | Linux / Windows |
|---|---|---|
| New Project | `⌘N` | `Ctrl+N` |
| Open or Import GEDCOM… | `⌘O` | `Ctrl+O` |
| Save | `⌘S` | `Ctrl+S` |
| Export GEDCOM… | `⌘⇧E` | `Ctrl+Shift+E` |
| Open Settings | `⌘,` | `Ctrl+,` |

## Tabs

| Action | macOS | Linux / Windows |
|---|---|---|
| Close tab | `⌘W` | `Ctrl+W` |
| Next tab | `⌘⇧]` | `Ctrl+Tab` |
| Previous tab | `⌘⇧[` | `Ctrl+Shift+Tab` |
| Switch to tab 1–9 | `⌘1`…`⌘9` | `Ctrl+1`…`Ctrl+9` |

Tab switching wraps around at the ends. `⌘9` (`Ctrl+9`) always jumps to the
last tab, even when fewer than nine are open.

## Editing

| Action | macOS | Linux / Windows |
|---|---|---|
| Undo | `⌘Z` | `Ctrl+Z` |
| Redo | `⌘⇧Z` | `Ctrl+Shift+Z` |

Every canvas action — including adding a person together with their family
link — is one undoable step; edits made by AI agents can be undone too.

## Panels

| Action | macOS | Linux / Windows |
|---|---|---|
| Toggle the chat panel | `⌘⌥B` | `Ctrl+Alt+B` |

## While typing

A few keys behave specially inside inputs:

- **Chat**: `Enter` sends the message.
- **Tree search**: `Esc` clears the search box.
- **Person editor**: `Enter` in the notes box adds the note you typed.

## Standard menu shortcuts

The File/Edit/View/Window menus ship the platform-standard accelerators:
copy, cut, paste and select all; zoom in, zoom out and reset zoom;
fullscreen; reload and developer tools; minimize, close window and quit.
These follow your operating system's conventions and are not listed here.

## Cheat sheet

With all tabs closed, the empty editor shows a rotating sample of five
shortcuts as a reminder; close and reopen a tab to see another set.

## Notes

Opening a `.ged`/`.gdz` file through **Open or Import GEDCOM…** starts a
new, not-yet-saved project; the GEDCOM data import itself and exporting
(`⌘⇧E`) are not wired up yet (see [Quick start](getting-started.md)).
