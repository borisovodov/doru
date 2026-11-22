# Data and backups

- Your data is a plain file — and it stays yours. Dóru has no accounts, no
  cloud backend, and no telemetry. Nothing is uploaded anywhere unless *you*
  configure a remote AI provider — and even then, the chat messages and the
  tree data the assistant retrieves through its tools are sent to that
  provider. If you want to keep everything on your computer, local providers
  (Ollama, LM Studio) work fully offline.
- To back up: stop every process that can write to the project — close it in
  Dóru and stop any MCP clients or other tools — then copy the `.doru` file
  (and the `media/` folder next to it, if you have photos). That's all there
  is. Restoring is copying it back while the project is closed and no other
  writers are running.
- Chat sessions live in the app data directory, not inside the `.doru` file;
  back them up separately if you need them.
- The file is version-control friendly: it is a stable binary file — commit it
  to git if you like.

## Syncing between machines

Dóru has no built-in sync engine — projects are plain files, and keeping them
in sync is your job: iCloud Drive, Dropbox, rclone, rsync, a USB stick,
whatever you prefer.

One caveat: the `.doru` file is a SQLite database, and live-syncing an **open**
project with a file-sync tool can copy the file in a half-written state and
corrupt it. The safe practice is: close the project (or the app) and stop any
other writers before syncing. Copying a project that is closed and has no other
writers is always safe. After a crash, open the project once in Dóru so SQLite
can roll back any leftover journal, then close it before copying.
