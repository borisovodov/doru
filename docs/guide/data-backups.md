# Data and backups

- Your data is a plain folder — and it stays yours. Dóru has no accounts, no
  cloud backend, and no telemetry. Nothing is uploaded anywhere unless *you*
  configure an AI provider — and even then, only the content you send in chat
  leaves your machine. If you want to keep everything on your computer, local
  providers (Ollama, LM Studio) work fully offline.
- The folder is version-control friendly: `tree.doru` is a stable binary file —
  commit the whole folder to git if you like.
- To back up: copy the project folder. That's all there is. Restoring is
  copying it back.
- If something inside the project is missing, Dóru recreates it silently on
  open (the `media/` folder, an empty tree).

## Syncing between machines

Dóru has no built-in sync engine — projects are plain folders, and keeping
them in sync is your job: iCloud Drive, Dropbox, rclone, rsync, a USB stick,
whatever you prefer.

One caveat: `tree.doru` is a SQLite database, and live-syncing an **open**
project with a file-sync tool can copy the file in a half-written state and
corrupt it. The safe practice is: close the project (or the app) before
syncing. Copying a closed project is always safe.
