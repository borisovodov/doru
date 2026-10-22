# AI and agents

## The in-app chat

The chat panel sits at the bottom of the window. Type a question and the agent
can read and edit the tree using built-in tools: `tree_query`, `tree_edit`,
`sources_add`, `notes_write`, `charts_render` (the last one renders a person's
ancestor chart as an SVG image).

The provider is configured in the `ai` section of `settings.json` (see
[Settings](settings.md)):

- **Provider presets**: OpenAI, Anthropic, Google Gemini, OpenRouter, Ollama
  (local), LM Studio (local), a custom OpenAI-compatible endpoint, or an ACP
  agent. Set the id in `"provider"`; each preset provides a default base URL
  and model, so `"baseUrl"` and `"model"` are optional overrides.
- **API keys** are stored encrypted in the OS keychain (macOS Keychain /
  Windows Credential Manager / libsecret). The key never appears in the
  settings file in plaintext.

## ACP agents

Set `"ai": { "provider": "acp", "command": "…", "args": [] }` to talk to an
agent that speaks the Agent Client Protocol (Zed-style agents). Dóru passes the
project to the agent as an MCP server, so the agent can query and edit the tree
just like the built-in chat.

## Dóru as an MCP server

Any MCP client — Claude Desktop, Cursor, coding agents — can work with your
tree. Run Dóru in server mode, pointing at the `.doru` file:

```sh
doru --mcp-server /absolute/path/to/family.doru
```

Claude Desktop configuration example
(`Claude → Settings → Developer → Edit Config`):

```json
{
  "mcpServers": {
    "doru": {
      "command": "/Applications/Doru.app/Contents/MacOS/doru",
      "args": ["--mcp-server", "/Users/you/FamilyHistory/family.doru"]
    }
  }
}
```

Windows: `"command": "C:\\Program Files\\Doru\\doru.exe"`. Linux AppImage: the
path to the AppImage file. Tool names stay in English regardless of the UI
language.

## Example prompts

- *“Find everyone born before 1850 and list their sources.”*
- *“Add Ivan Ivanov, born about 1923, as a child of Petr and Maria.”*
- *“Write a research note on Anna about the 1901 census.”*
- *“Check my tree for people born after their parents died.”*
