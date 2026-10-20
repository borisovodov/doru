import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync, watch } from 'node:fs';
import { join } from 'node:path';
import { applyEdits, modify, parse } from 'jsonc-parser';
import { log } from './log';

export const APP_CONFIG_FILE = 'doru.json';

export const DEFAULT_CONFIG = `{
  // AI provider settings for the agent chat.
  // "provider": "openai-compatible" (default) or "acp" (Agent Client Protocol,
  // e.g. Zed-style coding agents).
  "ai": {
    "provider": "openai-compatible",
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "",
    "model": "gpt-4o-mini",
    // For "acp": the agent binary to spawn and its arguments.
    // "command": "my-agent",
    // "args": []
  },
  // Optional: external MCP servers whose tools the in-app agent can use
  // (web search, FamilySearch, filesystem, ...). Each server is spawned as a
  // subprocess; tools are prefixed with the server name, e.g. "web:search".
  // "mcp": {
  //   "servers": [
  //     { "name": "web", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-brave-search"], "env": { "BRAVE_API_KEY": "..." } }
  //   ]
  // },
  // The theme: one palette file with a dark and a light section. The
  // operating system appearance decides which palette applies.
  // "theme": "doru"
}
`;

/**
 * The single owner of the app config file (doru.json in userData).
 * Everything that needs config values goes through `readConfig`; there is
 * exactly one parser and one file watcher for the whole main process.
 */

export function configFilePath(): string {
  return join(app.getPath('userData'), APP_CONFIG_FILE);
}

export function readConfig(): Record<string, unknown> {
  const file = configFilePath();
  if (!existsSync(file)) {
    mkdirSync(app.getPath('userData'), { recursive: true });
    writeFileSync(file, DEFAULT_CONFIG);
  }
  const parsed = parse(readFileSync(file, 'utf8')) as Record<string, unknown> | undefined;
  return parsed ?? {};
}

/**
 * Applies JSONC edits sequentially (jsonc-parser keeps formatting and
 * comments intact) and writes the result back.
 */
export function writeConfigEdits(edits: Array<{ path: (string | number)[]; value?: unknown }>): void {
  const file = configFilePath();
  readConfig();
  let text = readFileSync(file, 'utf8');
  for (const edit of edits) {
    const next = modify(text, edit.path, edit.value, { formattingOptions: { insertSpaces: true, tabSize: 2 } });
    text = applyEdits(text, next);
  }
  writeFileSync(file, text);
}

export function watchConfig(onChange: () => void): void {
  try {
    const watcher = watch(configFilePath(), () => onChange());
    watcher.unref();
  } catch {
    log.warn('could not watch the app config file');
  }
}
