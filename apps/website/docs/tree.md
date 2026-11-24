# Working with the tree

The tree opens as an interactive canvas. Everything below happens on the
canvas itself; the person list lives in the **People** view of the left
activity bar.

## Navigation

- **Pan** by dragging the background, **zoom** with the scroll wheel or
  trackpad; the zoom buttons sit in the canvas corner.
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

- **Add child / spouse / parent** — a new empty card appears next to the
  person; type the name right in the card and confirm it with the checkmark
  (the cross discards it).
- **Edit** — opens the full person editor as a tab: names, sex, birth/death
  dates with a quality marker (*Exact / About / Before / After*) and a
  free-text form (e.g. a calendar date “23 Nivôse” that does not map to
  Gregorian), families, events, sources, notes and media.
- **Delete** — removes the person from the tree and every family.
- **Reparent**: drag a card onto another person's card to move the dragged
  person as a child into that family (the valid target lights up while
  dragging).

A new (empty) tree shows one empty card: click it, type the name, confirm
with the checkmark, and the first person appears on the canvas. After that,
grow the tree from the cards themselves.

## Families

Inside the full person editor, add parents, a partner, or children. Type a
name to pick an existing person; chips show the members of each family.
Removing a person from a family or deleting a family is one click.

## Sources and notes

- **Sources**: attach sources to a person (with a title and author) or reuse
  an existing source. Each attachment is a citation and can be removed.
- **Notes**: free-form research notes attached to a person. A note can be
  attached to several records: use **Attach existing note** in another
  record's Notes section, then choose whether an edit should update the
  shared text everywhere or only the current record. **Detach from this
  record** removes one link; **Delete everywhere** removes the note.
- Facts and names carry their own Sources, Notes and Identifiers sections
  inside the person editor; facts also have Contacts.

## Addresses

The **Sources** view has an **Addresses** section. Use it to create, edit and
delete standalone addresses. Addresses used by facts, repositories or
submitters show their usage count; deleting one detaches it from those
records. A fact's address picker also has **New address** and **Edit address**
actions for editing an address in place.

## Tasks

Tasks have creation and closing dates in addition to the scheduled and
reminder dates. Every editor has a **Tasks** section: add a task there and it
is linked to that record automatically. Facts, names, citations and notes
carry their own Tasks section in their attachment panel. **Related to** links
a task to one or more records in the tree — a person, family, event, name,
citation, note, media, place, repository, address or title; leave it empty for
a free-standing task. A task is shared: editing it anywhere updates the same
record, and deleting one related record leaves the task in place.

Titles, addresses, associations and family partner/child links have the same
Notes, Sources, Identifiers, Contributors and Tasks sections as the main entity
tabs. Addresses also have Contacts. Tasks keep Notes, Identifiers, Contributors
and the legacy Tasks section, but have no Sources or Contacts.

## Media

Photos are ordinary files in the `media/` folder next to the project. Add them
from a person, family, source, place, repository, submitter, title, task or
address; the media tab's **Related to** section lets you attach an existing
record to additional targets. Click a preview to open the media tab, where you
can edit the title, manage files and edit link metadata such as the caption,
sequence, primary flag and exclusion flag.

A media record can be linked to several targets. **Detach from this record**
removes one link and deletes the record when it was the last one; **Delete
media** removes the record and its file copies. Deleting a target record
removes only its links, so a shared media record can remain without links.

## Ordering

Lists whose order matters — names, family partners and children, place names,
address lines, fact participants and template fields — have up/down controls.
The order is stored as the row position.
