# Doru — User Guide

Doru is a local-first genealogy app for the AI era. Your family tree lives in
a plain folder on your disk, works fully offline, and can be driven by AI
agents — through the built-in chat or any MCP/ACP client.

- **Local-first.** Nothing leaves your computer unless you say so. A project
  is an ordinary folder; the tree is a single SQLite file inside it.
- **AI-native.** Talk to an agent in the app, or let external tools (Claude
  Desktop, Cursor, coding agents) work with your tree over MCP/ACP.
- **Auditable.** Every change — yours or an agent's — is recorded in a
  human-readable log with its author.
- **Plain-text configuration and themes.** Settings and themes are text files
  you can edit with any editor.

---

## 1. Installation

Download the latest release from the
[releases page](https://github.com/borisovodov/doru/releases) and pick your
platform and architecture (Apple Silicon or Intel):

| Platform | Installer |
|---|---|
| macOS (Apple Silicon) | `doru-mac-arm64.dmg` |
| Windows (x64) | `doru-windows-x64.exe` |
| Windows (arm64) | `doru-windows-arm64.exe` |
| Linux (x64) | `doru-linux-x86_64.AppImage` or `doru-linux-amd64.deb` |
| Linux (arm64) | `doru-linux-arm64.AppImage` or `doru-linux-arm64.deb` |

- **macOS**: open the `.dmg`, drag Doru to Applications. Builds are signed and
  notarized by Apple.
- **Windows**: run the installer. Builds are not code-signed yet, so SmartScreen
  may show a warning — click “More info → Run anyway”.
- **Linux**: `.deb` installs with `sudo apt install ./doru-*.deb`; the AppImage
  needs `chmod +x` and then just runs.

---

## 2. Getting started

1. Launch Doru and click **Open Project…** (or press `F1` → Open Project).
   Choose or create a folder — this folder *is* your project.
2. Doru creates the project skeleton automatically (silently):

```
My Family/
├── tree.doru         the tree itself (SQLite, branded with an app id)
├── settings.json     project settings (reserved for future use)
├── theme.css         your custom theme overrides (see section 7)
├── history.jsonl     audit log — every change with its author
├── media/            place photos and scanned documents here
└── export/           default location for GEDCOM exports
```

3. Get data in: click **Import GEDCOM…** and pick a `.ged` file (GEDCOM 5.5 /
   5.5.1 dialects are imported; exports are written as GEDCOM 7.0). Or start
   from scratch with **Add Person**.

Projects can be opened in tabs — several trees side by side. Recently used
projects are listed in the sidebar, and your open tabs are restored on the
next launch. Double-clicking a `*.doru` file (or opening a `doru://open?path=…`
link) opens it in the running app.

---

## 3. Working with the tree

- **Person list**: the editor area shows all persons; use the search box to
  filter by name.
- **Person card**: click a person to edit. Fields: given name, surname, sex,
  and full birth/death dates — year, month, day, a quality marker
  (*Exact / About / Before / After*) and a free-text form (e.g. a calendar
  date “23 Nivôse” that does not map to Gregorian).
- **Families**: inside a person card, add parents, a partner, or children.
  Type a name to pick an existing person; chips show the members of each
  family. Removing a person from a family or deleting a family is one click.
- **Sources**: attach sources to a person (with a title and author) or reuse
  an existing source. Each attachment is a citation and can be removed.
- **Notes**: free-form research notes attached to a person.
- **Undo/redo**: `Cmd+Z` / `Shift+Cmd+Z` (Ctrl on Windows/Linux). This includes
  whole GEDCOM imports and edits made by agents.
- **View GEDCOM**: the toolbar button shows the entire tree as read-only
  GEDCOM 7.0 text.
- **Command palette**: `F1` — searchable list of commands (Open Project, Undo,
  Redo).

---

## 4. Configuration

Global settings live in `doru.json` in the app's config directory:

| OS | Path |
|---|---|
| macOS | `~/Library/Application Support/Doru/doru.json` |
| Windows | `%APPDATA%\Doru\doru.json` |
| Linux | `~/.config/Doru/doru.json` |

The file is created with defaults on first run. It is plain JSON with comments
allowed — edit it with any editor; changes are picked up live while the app is
running. The AI provider is normally configured from the in-app **Settings**
(gear icon in the left bar) — see section 5.

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

---

## 5. AI and agents

### 5.1 The in-app chat

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

### 5.2 ACP agents

Set `"ai": { "provider": "acp", "command": "…", "args": [] }` to talk to an
agent that speaks the Agent Client Protocol (Zed-style agents). Doru passes the
project to the agent as an MCP server, so the agent can query and edit the tree
just like the built-in chat. Permission prompts work the same way.

### 5.3 Doru as an MCP server (external AI tools)

Any MCP client — Claude Desktop, Cursor, coding agents — can work with your
tree. Run Doru in server mode:

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

### 5.4 Example prompts

- *“Find everyone born before 1850 and list their sources.”*
- *“Add Ivan Ivanov, born about 1923, as a child of Petr and Maria.”*
- *“Write a research note on Anna about the 1901 census.”*
- *“Check my tree for people born after their parents died.”* — the agent can
  combine tree tools with external tools (e.g. web search) if you configure
  them in `mcp.servers`.

---

## 6. Data ownership and backups

- Your data is a plain folder. Nothing is uploaded anywhere unless *you*
  configure an AI provider — and even then, only the content you send in chat
  leaves your machine.
- The folder is version-control friendly: `tree.doru` is a stable binary file,
  while `history.jsonl`, `settings.json` and `theme.css` are text — commit the
  whole folder to git if you like.
- To back up: copy the project folder. That's all there is. Restoring is
  copying it back.
- If some file inside the project is missing, Doru recreates it silently on
  open (defaults for `settings.json`/`theme.css`, an empty tree, folders).

---

## 7. Themes

The interface is styled entirely through CSS custom properties. The cascade:

1. **Built-in theme** — `doru-dark` or `doru-light`, chosen per OS appearance
   in `doru.json` (section 4). Switch your OS to light mode and Doru follows
   instantly; no in-app toggle.
2. **Your overrides** — the project's `theme.css`, applied on top and
   hot-reloaded: edit the file in any editor and the app restyles immediately.

Example `theme.css` that gives the project a warmer look:

```css
:root {
  --doru-accent: #b08968;
  --doru-status-bar-bg: #7f5539;
  --doru-side-bar-bg: #1f1b18;
  --doru-editor-bg: #171310;
}
```

Available variables:

| Variable | Meaning |
|---|---|
| `--doru-activity-bar-bg` | leftmost icon strip background |
| `--doru-side-bar-bg` | sidebar background |
| `--doru-editor-bg` | main editor background |
| `--doru-panel-bg` | bottom panel (chat) background |
| `--doru-status-bar-bg` / `--doru-status-bar-fg` | bottom status bar colors |
| `--doru-fg` / `--doru-fg-dim` | main and muted text |
| `--doru-border` | borders and separators |
| `--doru-accent` | highlights, active tabs, buttons |
| `--doru-input-bg` | inputs, chips, code blocks |

---

## 8. Troubleshooting

- **“AI provider is not configured”** — open Settings (gear icon in the left
  bar), pick a provider, and enter a model (and a key where required).
- **Ollama connection fails** — select the Ollama preset (base URL
  `http://localhost:11434/v1`); no API key is needed. Make sure Ollama is
  running locally.
- **GEDCOM import looks incomplete** — dialects vary wildly between programs.
  The import is tolerant but not perfect; export to GEDCOM and re-import in
  the source program to verify. Notes on files that fail entirely are welcome
  as bug reports.
- **Windows SmartScreen warning** — Windows builds are unsigned for now; see
  section 1.
- **Theme looks broken** — a syntax error in `theme.css` stops the rest of the
  file from applying. Check the console (View → Toggle Developer Tools) or
  temporarily empty the file.
