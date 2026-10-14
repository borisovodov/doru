import { app, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyEdits, modify, parse } from 'jsonc-parser';
import { findProvider, type AiProviderPreset, type McpServerConfig } from '@doru/ai';
import { log } from './log';

export const AI_CONFIG_FILE = 'doru.json';

export const DEFAULT_AI_CONFIG = `{
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
  // Built-in themes are chosen separately for dark and light mode; which one
  // is applied is decided by the operating system appearance.
  // "theme": {
  //   "dark": "doru-dark",
  //   "light": "doru-light"
  // }
}
`;

export type ResolvedAiConfig = {
  preset: AiProviderPreset;
  baseUrl: string;
  apiKey: string;
  model: string;
  acpCommand: string;
  acpArgs: string[];
  mcpServers: McpServerConfig[];
  configured: boolean;
};

export function configFilePath(): string {
  return join(app.getPath('userData'), AI_CONFIG_FILE);
}

export function loadAiConfig(): ResolvedAiConfig {
  const file = configFilePath();
  if (!existsSync(file)) {
    mkdirSync(app.getPath('userData'), { recursive: true });
    writeFileSync(file, DEFAULT_AI_CONFIG);
  }
  const text = readFileSync(file, 'utf8');
  const parsed = parse(text) as {
    ai?: {
      provider?: string;
      baseUrl?: string;
      apiKey?: string;
      apiKeyEncrypted?: string;
      model?: string;
      command?: string;
      args?: string[];
    };
    mcp?: { servers?: McpServerConfig[] };
  };
  const ai = parsed.ai ?? {};

  const presetId = ai.provider ?? 'openai';
  const preset = findProvider(presetId);

  let apiKey = ai.apiKey ?? '';
  if (!apiKey && ai.apiKeyEncrypted) {
    try {
      apiKey = safeStorage.decryptString(Buffer.from(ai.apiKeyEncrypted, 'base64'));
    } catch {
      apiKey = '';
    }
  }
  const envKey = process.env.DORU_AI_API_KEY;
  if (envKey) {
    apiKey = envKey;
  }

  if (ai.apiKey && !ai.apiKeyEncrypted && safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(ai.apiKey).toString('base64');
    const withEncrypted = applyEdits(
      text,
      modify(text, ['ai', 'apiKeyEncrypted'], encrypted, { formattingOptions: { insertSpaces: true, tabSize: 2 } }),
    );
    const migrated = applyEdits(
      withEncrypted,
      modify(withEncrypted, ['ai', 'apiKey'], undefined, { formattingOptions: { insertSpaces: true, tabSize: 2 } }),
    );
    writeFileSync(file, migrated);
    log.info('migrated the plaintext API key into safeStorage');
  }

  const baseUrl = ai.baseUrl ?? preset.defaultBaseUrl ?? '';
  const model = process.env.DORU_AI_MODEL ?? ai.model ?? '';
  const acpCommand = ai.command ?? '';
  const acpArgs = ai.args ?? [];
  const mcpServers = parsed.mcp?.servers ?? [];

  const configured =
    preset.dialect === 'acp'
      ? acpCommand !== ''
      : model !== '' && baseUrl !== '' && (!preset.requiresKey || apiKey !== '');

  return { preset, baseUrl, apiKey, model, acpCommand, acpArgs, mcpServers, configured };
}

export function writeAiConfig(edits: Array<{ path: (string | number)[]; value?: unknown }>): void {
  const file = configFilePath();
  loadAiConfig();
  let text = readFileSync(file, 'utf8');
  for (const edit of edits) {
    const next = modify(text, edit.path, edit.value, { formattingOptions: { insertSpaces: true, tabSize: 2 } });
    text = applyEdits(text, next);
  }
  writeFileSync(file, text);
}

export function aiSettingsPayload(config: ResolvedAiConfig): {
  provider: string;
  baseUrl: string;
  model: string;
  hasKey: boolean;
  acpCommand: string;
  acpArgs: string[];
  configured: boolean;
} {
  return {
    provider: config.preset.id,
    baseUrl: config.baseUrl,
    model: config.model,
    hasKey: config.apiKey !== '',
    acpCommand: config.acpCommand,
    acpArgs: config.acpArgs,
    configured: config.configured,
  };
}

export function configWithOverrides(overrides: {
  provider?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}): ResolvedAiConfig {
  const config = loadAiConfig();
  const preset = overrides.provider ? findProvider(overrides.provider) : config.preset;
  const providerChanged = overrides.provider !== undefined && overrides.provider !== config.preset.id;
  return {
    ...config,
    preset,
    baseUrl:
      overrides.baseUrl ??
      (providerChanged ? (preset.defaultBaseUrl ?? '') : config.baseUrl),
    apiKey: overrides.apiKey !== undefined ? overrides.apiKey : config.apiKey,
    model: overrides.model ?? config.model,
  };
}
