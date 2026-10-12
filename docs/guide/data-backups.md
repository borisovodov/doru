# Data and backups

- Your data is a plain folder — and it stays yours. Dóru has no accounts, no
  cloud backend, and no telemetry. Nothing is uploaded anywhere unless *you*
  configure an AI provider — and even then, only the content you send in chat
  leaves your machine. If you want to keep everything on your computer, local
  providers (Ollama, LM Studio) work fully offline.
- The folder is version-control friendly: `tree.doru` is a stable binary file,
  while `history.jsonl`, `settings.json` and `theme.css` are text — commit the
  whole folder to git if you like.
- To back up: copy the project folder. That's all there is. Restoring is
  copying it back.
- If some file inside the project is missing, Dóru recreates it silently on
  open (defaults for `settings.json`/`theme.css`, an empty tree, folders).

## Syncing between machines

Dóru has no built-in sync engine — projects are plain folders, and keeping
them in sync is your job: iCloud Drive, Dropbox, rclone, rsync, a USB stick,
whatever you prefer.

One caveat: `tree.doru` is a SQLite database, and live-syncing an **open**
project with a file-sync tool can copy the file in a half-written state and
corrupt it. The safe practice is: close the project (or the app) before
syncing. Copying a closed project is always safe.
