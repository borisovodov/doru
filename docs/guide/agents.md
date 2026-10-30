# AI and agents

## The in-app chat

The chat panel sits at the bottom of the window. Type a question and the agent
can read and edit the tree using built-in tools: `tree_query`, `tree_get`,
`tree_stats`, `tree_edit`, `tree_add_relative`, `sources_add`, `notes_write`.

Conversations are saved as **chat sessions**: the header of the chat panel
lists your sessions, and you can switch between them, start a new chat or
delete them. Sessions are stored per project in the app data directory
(not inside the `.doru` file), the title comes from your first message, and
everything survives app restarts. Every reply has a copy button that puts
its raw markdown on the system clipboard.

The provider is configured in the `ai` section of `settings.json` (see
[Settings](settings.md)):

- **Provider presets**: Ollama (local), LM Studio (local), a custom
  OpenAI-compatible endpoint, or an ACP agent. Cloud presets return one by
  one as their integrations are rebuilt. Set the id in `"provider"`; each
  preset provides a default base URL, while the model is picked in the
  Settings wizard — fetched from the provider for local endpoints, selected
  from the shipped catalog for cloud presets. Every provider keeps its own
  configuration (model, base URL, reasoning, key) under `"providers"` —
  switching providers restores each one's saved setup.
- **API keys** are stored in `secrets.json` (mode 0600) in the app data
  directory, keyed by provider id. The key never appears in the settings
  file.

## Dóru AI (offline assistant)

The default provider is **Dóru AI**: a local assistant that runs entirely on
your computer. Download it once in the AI settings (a single file, about
3 GB); after that the chat works with no account and no internet connection.
It is selected by default on a fresh install and needs at least 8 GB of RAM.

The downloaded model is Qwen3.5-4B (Q4_K_M quantized GGUF, Apache-2.0
license — see the [model card](https://huggingface.co/Qwen/Qwen3.5-4B)).
The weights are pinned by SHA-256 in the app manifest and verified after
every download.

## ACP agents

Set `"ai": { "provider": "acp", "providers": { "acp": { "command": "…",
"args": [] } } }` to talk to an agent that speaks the Agent Client Protocol
(Zed-style agents). Dóru passes the project to the agent as an MCP server, so
the agent can query and edit the tree just like the built-in chat.

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

Linux AppImage: the path to the AppImage file. Windows:
`"command": "C:\\Program Files\\Doru\\doru.exe"`. Tool names stay in English
regardless of the UI language.

The server is **headless and stateless**: no window, no dock icon, no chat
sessions — it reads and edits the tree file directly and exits when the client
disconnects. Any number of clients can point at the same file at once
(Claude Desktop, Cursor, several coding agents); concurrent writes queue
safely. If a client cannot start the server, run the command in a terminal —
the helper logs problems to stderr and its temporary profile is discarded on
exit.

## Example prompts

- *“Find everyone born before 1850 and list their sources.”*
- *“Add Ivan Ivanov, born about 1923, as a child of Petr and Maria.”*
- *“Write a research note on Anna about the 1901 census.”*
- *“Check my tree for people born after their parents died.”*
