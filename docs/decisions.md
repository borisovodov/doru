# Product Decisions

Deliberate decisions about what Doru is **not** doing, recorded so they are not
re-litigated by future contributors. Deferred work is tracked in GitHub issues.

## Not building

### Multiple trees per project folder

A project is one folder with exactly one `tree.doru`. Multiple independent
trees in a single folder add complexity without a user need; open several
projects in tabs instead.

### Mobile version

No iOS/Android version for now. The door stays open: `packages/core` and
`packages/platform` must not import Electron or browser APIs, so the service
layer could be reused by a future Capacitor-based client.

### Monetization

None. Doru is free software (MIT). If this ever changes, it must not compromise
the local-first guarantee: data stays in the user's folder.

### Manual locale switcher

The UI language always follows the operating system. All 17 locales are
shipped and selected automatically; there is no in-app language setting.

### Built-in cross-device sync (CRDT)

No built-in sync engine. Projects are plain folders, and keeping them in sync
between machines is the user's job — iCloud Drive, Dropbox, rclone, rsync, a
USB stick, whatever they prefer.

One caveat lives with this decision: `tree.doru` is a SQLite database, and
live-syncing an **open** project with a file-sync tool can copy the file in a
half-written state and corrupt it. Doru uses a single-file journal mode
(`journal_mode=DELETE`) to keep the folder clean, but the safe practice is:
close the project (or the app) before syncing. Copying a closed project is
always safe.
