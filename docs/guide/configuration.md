# Configuration

Global settings live in `doru.json` in the app's config directory:

| OS | Path |
|---|---|
| macOS | `~/Library/Application Support/Doru/doru.json` |
| Windows | `%APPDATA%\Doru\doru.json` |
| Linux | `~/.config/Doru/doru.json` |

The file is created with defaults on first run. It is plain JSON with comments
allowed — edit it with any editor; changes are picked up live while the app is
running. The AI provider is normally configured from the in-app **Settings**
(gear icon in the left bar) — see [AI and agents](agents.md).

Full reference:

```jsonc
{
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

  // External MCP servers whose tools the in-app agent may use.
  "mcp": {
    "servers": [
      {
        "name": "web",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-brave-search"],
        "env": { "BRAVE_API_KEY": "…" }
      }
    ]
  },

  // Themes: pick one per OS appearance. The OS decides which is used.
  "theme": {
    "dark": "doru-dark",
    "light": "doru-light"
  }
}
```

Environment variables (useful for secrets): `DORU_AI_API_KEY` and
`DORU_AI_MODEL` override the corresponding values.
