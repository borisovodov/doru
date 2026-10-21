import { safeStorage } from 'electron';
import { findProvider, type AiProvider, type McpServerSettings } from '@doru/ai';
import { readSettings, writeSettingsEdits } from './settings';
import { log } from './log';

/** AI SDK reasoning levels Dóru exposes (provider default is the absence of a level). */
export type ReasoningLevel = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface ResolvedAiSettings {
  provider: AiProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** AI SDK reasoning level; empty means the provider default. */
  reasoning: ReasoningLevel | '';
  acpCommand: string;
  acpArgs: string[];
  mcpServers: McpServerSettings[];
  configured: boolean;
}

interface AiSettingsJson {
  provider?: string;
  baseUrl?: string;
  apiKey?: string;
  apiKeyEncrypted?: string;
  model?: string;
  reasoning?: string;
  command?: string;
  args?: string[];
}

export function loadAiSettings(): ResolvedAiSettings {
  const parsed = readSettings();
  const ai = (parsed['ai'] ?? {}) as AiSettingsJson;

  const provider = findProvider(ai.provider ?? 'openai');

  let apiKey = ai.apiKey ?? '';
  if (!apiKey && ai.apiKeyEncrypted) {
    try {
      apiKey = safeStorage.decryptString(Buffer.from(ai.apiKeyEncrypted, 'base64'));
    } catch {
      apiKey = '';
    }
  }
  const envKey = process.env['DORU_AI_API_KEY'];
  if (envKey) {
    apiKey = envKey;
  }

  if (ai.apiKey && !ai.apiKeyEncrypted && safeStorage.isEncryptionAvailable()) {
    writeSettingsEdits([
      { path: ['ai', 'apiKeyEncrypted'], value: safeStorage.encryptString(ai.apiKey).toString('base64') },
      { path: ['ai', 'apiKey'] },
    ]);
    log.info('migrated the plaintext API key into safeStorage');
  }

  const baseUrl = ai.baseUrl ?? provider.defaultBaseUrl ?? '';
  const model = process.env['DORU_AI_MODEL'] ?? ai.model ?? provider.defaultModels[0] ?? '';
  const reasoning = (ai.reasoning ?? '') as ReasoningLevel | '';
  const acpCommand = ai.command ?? '';
  const acpArgs = ai.args ?? [];
  const mcpServers = (parsed['mcp'] as { servers?: McpServerSettings[] } | undefined)?.servers ?? [];

  const configured =
    provider.kind === 'acp'
      ? acpCommand !== ''
      : model !== '' && baseUrl !== '' && (!provider.requiresKey || apiKey !== '');

  return { provider, baseUrl, apiKey, model, reasoning, acpCommand, acpArgs, mcpServers, configured };
}

export function aiSettingsPayload(settings: ResolvedAiSettings): {
  provider: string;
  baseUrl: string;
  model: string;
  reasoning: ReasoningLevel | '';
  hasKey: boolean;
  acpCommand: string;
  acpArgs: string[];
  mcpServers: McpServerSettings[];
  configured: boolean;
} {
  return {
    provider: settings.provider.id,
    baseUrl: settings.baseUrl,
    model: settings.model,
    reasoning: settings.reasoning,
    hasKey: settings.apiKey !== '',
    acpCommand: settings.acpCommand,
    acpArgs: settings.acpArgs,
    mcpServers: settings.mcpServers,
    configured: settings.configured,
  };
}

export function settingsWithOverrides(overrides: {
  provider?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}): ResolvedAiSettings {
  const settings = loadAiSettings();
  const provider = overrides.provider ? findProvider(overrides.provider) : settings.provider;
  const providerChanged = overrides.provider !== undefined && overrides.provider !== settings.provider.id;
  return {
    ...settings,
    provider,
    baseUrl: overrides.baseUrl ?? (providerChanged ? provider.defaultBaseUrl : settings.baseUrl),
    apiKey: overrides.apiKey !== undefined ? overrides.apiKey : settings.apiKey,
    model: overrides.model ?? settings.model,
  };
}
