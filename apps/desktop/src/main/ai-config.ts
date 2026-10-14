import { safeStorage } from 'electron';
import { findProvider, type AiProviderPreset, type McpServerConfig } from '@doru/ai';
import { readConfig, writeConfigEdits } from './config';
import { log } from './log';

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

interface AiConfigJson {
  provider?: string;
  baseUrl?: string;
  apiKey?: string;
  apiKeyEncrypted?: string;
  model?: string;
  command?: string;
  args?: string[];
}

export function loadAiConfig(): ResolvedAiConfig {
  const parsed = readConfig();
  const ai = (parsed.ai ?? {}) as AiConfigJson;

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
    writeConfigEdits([
      { path: ['ai', 'apiKeyEncrypted'], value: safeStorage.encryptString(ai.apiKey).toString('base64') },
      { path: ['ai', 'apiKey'] },
    ]);
    log.info('migrated the plaintext API key into safeStorage');
  }

  const baseUrl = ai.baseUrl ?? preset.defaultBaseUrl ?? '';
  const model = process.env.DORU_AI_MODEL ?? ai.model ?? '';
  const acpCommand = ai.command ?? '';
  const acpArgs = ai.args ?? [];
  const mcpServers = (parsed.mcp as { servers?: McpServerConfig[] } | undefined)?.servers ?? [];

  const configured =
    preset.dialect === 'acp'
      ? acpCommand !== ''
      : model !== '' && baseUrl !== '' && (!preset.requiresKey || apiKey !== '');

  return { preset, baseUrl, apiKey, model, acpCommand, acpArgs, mcpServers, configured };
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
