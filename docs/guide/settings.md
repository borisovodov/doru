# Settings

Global settings live in `settings.json` in the app's data directory:

| OS | Path |
|---|---|
| macOS | `~/Library/Application Support/Doru/settings.json` |
| Windows | `%APPDATA%\Doru\settings.json` |
| Linux | `~/.config/Doru/settings.json` |

**Defaults live in the app; the file only records explicit overrides.** On
first run the app creates the file with just the `$schema` reference —
everything else falls back to built-in defaults, so new defaults ship to
existing users with app updates. The `$schema` reference is the single source
of documentation: editors with JSON Schema support (VS Code, Zed, JetBrains)
offer autocompletion, validation and field descriptions from it. The app
writes entries into the file only when you change a setting in **Settings**
(or a secret like the API key is stored); everything else stays untouched.
The file is plain JSON with comments allowed — edit it with any editor;
changes are picked up live while the app is running. The app validates the
file against the schema on load; if it does not parse or does not match the
schema, it is replaced with the empty template (a warning is logged). The AI
provider is configured in the `ai` section of this file — see
[AI and agents](agents.md).

Full reference:

```jsonc
{
  "$schema": "https://doru.family/settings.json",

  // AI provider — set from Settings (gear icon) or here directly.
  "ai": {
    // openai | anthropic | gemini | openrouter | ollama | lmstudio | custom | acp
    "provider": "openai",
    "baseUrl": "",   // optional override of the provider's default endpoint
    "model": "",
    // For "acp" only: the agent binary to spawn.
    // "command": "my-agent",
    // "args": []
  },

  // Theme: one palette file with a dark and a light section. The OS
  // appearance decides which palette applies.
  "theme": "doru"
}
```

Environment variables (useful for secrets): `DORU_AI_API_KEY` and
`DORU_AI_MODEL` override the corresponding values.

## Logs

The app appends diagnostics to `doru.log` in the data directory (next to
`settings.json`). The file rotates at 5 MB — the previous file is kept as
`doru.old.log`. The default verbosity is `warn` (development builds log at
`debug`); set `DORU_LOG_LEVEL=trace|debug|info|warn|error` to override it.
Schema-validation warnings (a settings or theme file that does not match its
schema) are logged here. The **Open log file** button in Settings creates the
file on demand if nothing has been logged yet.
