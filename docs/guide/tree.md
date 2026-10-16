# Working with the tree

The tree opens as an interactive canvas. Everything below happens on the
canvas itself; the person list lives in the **People** view of the left
activity bar.

## Navigation

- **Pan** by dragging the background, **zoom** with the scroll wheel or
  trackpad; the zoom buttons and the minimap sit in the canvas corners.
- **Refocus** on a person by double-clicking their card. The toolbar keeps a
  history: back/forward arrows and a breadcrumb trail.
- **Charts**: switch between *Ancestors*, *Descendants*, *Hourglass* and
  *Family* views in the toolbar. The family view shows the focus couple, their
  children and both sides of parents.
- **Search**: type a name into the toolbar search box and pick a result to
  jump to that person.
- **Collapse** a branch with the chevron on a card (or collapse/expand all
  branches from the toolbar).

## Cards

Each card shows an initials avatar, the name, the years of life (with † for
deceased persons), and small badges counting notes, sources and media. The
left edge marks the father's (blue) and mother's (pink) line in ancestor
charts; the accent frame marks the focus person.

## Editing

Select a card to reveal the action toolbar:

- **Add child / spouse / parent** — opens a small form (name, sex, years).
- **Rename** — edits the name and dates right on the canvas.
- **Edit** — opens the full person editor as a tab: names, sex, birth/death
  dates with a quality marker (*Exact / About / Before / After*) and a
  free-text form (e.g. a calendar date “23 Nivôse” that does not map to
  Gregorian), families, events, sources, notes and media.
- **Delete** — removes the person from the tree and every family.
- **Reparent**: drag a card onto another person's card to move the dragged
  person as a child into that family (the valid target lights up while
  dragging).

An empty tree shows an **Add the first person** button; after that, grow the
tree from the cards themselves.

## Families

Inside the full person editor, add parents, a partner, or children. Type a
name to pick an existing person; chips show the members of each family.
Removing a person from a family or deleting a family is one click.

## Sources and notes

- **Sources**: attach sources to a person (with a title and author) or reuse
  an existing source. Each attachment is a citation and can be removed.
- **Notes**: free-form research notes attached to a person.

## Undo/redo

`Cmd+Z` / `Shift+Cmd+Z` (Ctrl on Windows/Linux). Every canvas action is one
undoable step — including adding a person together with their family link.
Edits made by agents can be undone as well.

## Command palette

`F1` — searchable list of commands (Open Project, Undo, Redo).
