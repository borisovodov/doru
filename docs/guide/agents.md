# AI and agents

## The in-app chat

The chat panel sits at the bottom of the window. Type a question and the agent
can read and edit the tree using built-in tools: `tree_query`, `tree_get`,
`tree_stats`, `tree_edit`, `sources_add`, `notes_write`, `charts_render`.

Set the provider up from **Settings** (gear icon in the left bar) → AI
Provider:

- **Provider presets**: OpenAI, Anthropic, Google Gemini, OpenRouter, Ollama
  (local), LM Studio (local), a custom OpenAI-compatible endpoint, or an ACP
  agent. Each preset pre-fills the base URL and suggests common models.
- **API keys** are entered in the UI and stored encrypted in the OS keychain
  (macOS Keychain / Windows Credential Manager / libsecret). The key never
  appears in the config file in plaintext.
- **Model**: type one or use the suggestions; with a key set, “Fetch models”
  lists the models available from the endpoint.
- **Test connection** sends a small request and reports whether the provider
  answers. Local providers (Ollama, LM Studio) need no key.
- **Permissions**: read-only tools run freely; mutating tools (`tree_edit`,
  `sources_add`, `notes_write`) ask for confirmation inline. External MCP tools
  always ask.
- **Audit trail**: every agent edit is recorded in `history.jsonl` with an
  actor like `agent:api.openai.com/gpt-4o-mini#a1b2c3d4e5f6` — you can always
  tell who changed what, and undo it.

## ACP agents

Set `"ai": { "provider": "acp", "command": "…", "args": [] }` to talk to an
agent that speaks the Agent Client Protocol (Zed-style agents). Dóru passes the
project to the agent as an MCP server, so the agent can query and edit the tree
just like the built-in chat. Permission prompts work the same way.

## Dóru as an MCP server

Any MCP client — Claude Desktop, Cursor, coding agents — can work with your
tree. Run Dóru in server mode:

```sh
doru --mcp-server /absolute/path/to/project
```

Claude Desktop configuration example
(`Claude → Settings → Developer → Edit Config`):

```json
{
  "mcpServers": {
    "doru": {
      "command": "/Applications/Doru.app/Contents/MacOS/doru",
      "args": ["--mcp-server", "/Users/you/FamilyHistory"]
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
- *“Check my tree for people born after their parents died.”* — the agent can
  combine tree tools with external tools (e.g. web search) if you configure
  them in `mcp.servers`.
