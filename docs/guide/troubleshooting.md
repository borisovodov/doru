# Troubleshooting

- **“AI provider is not configured”** — open Settings (gear icon in the left
  bar), pick a provider, and enter a model (and a key where required).
- **Ollama connection fails** — select the Ollama preset (base URL
  `http://localhost:11434/v1`); no API key is needed. Make sure Ollama is
  running locally.
- **GEDCOM import looks incomplete** — dialects vary wildly between programs.
  The import is tolerant but not perfect; export to GEDCOM and re-import in
  the source program to verify. Notes on files that fail entirely are welcome
  as bug reports.
- **Windows SmartScreen warning** — Windows builds are unsigned and
  experimental; see [Installation](installation.md).
- **Theme looks broken** — a syntax error in `theme.css` stops the rest of the
  file from applying. Check the console (View → Toggle Developer Tools) or
  temporarily empty the file.
