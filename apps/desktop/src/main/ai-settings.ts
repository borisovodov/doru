import { safeStorage } from 'electron';
import { findProvider, type AiProviderPreset, type McpServerSettings } from '@doru/ai';
import { readSettings, writeSettingsEdits } from './settings';
import { log } from './log';

export type ResolvedAiSettings = {
  preset: AiProviderPreset;
  baseUrl: string;
  apiKey: string;
  model: string;
  acpCommand: string;
  acpArgs: string[];
  mcpServers: McpServerSettings[];
  configured: boolean;
};

interface AiSettingsJson {
  provider?: string;
  baseUrl?: string;
  apiKey?: string;
  apiKeyEncrypted?: string;
  model?: string;
  command?: string;
  args?: string[];
}

export function loadAiSettings(): ResolvedAiSettings {
  const parsed = readSettings();
  const ai = (parsed['ai'] ?? {}) as AiSettingsJson;

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

  const baseUrl = ai.baseUrl ?? preset.defaultBaseUrl ?? '';
  const model = process.env['DORU_AI_MODEL'] ?? ai.model ?? preset.defaultModels[0] ?? '';
  const acpCommand = ai.command ?? '';
  const acpArgs = ai.args ?? [];
  const mcpServers = (parsed['mcp'] as { servers?: McpServerSettings[] } | undefined)?.servers ?? [];

  const configured =
    preset.dialect === 'acp'
      ? acpCommand !== ''
      : model !== '' && baseUrl !== '' && (!preset.requiresKey || apiKey !== '');

  return { preset, baseUrl, apiKey, model, acpCommand, acpArgs, mcpServers, configured };
}

export function aiSettingsPayload(settings: ResolvedAiSettings): {
  provider: string;
  baseUrl: string;
  model: string;
  hasKey: boolean;
  acpCommand: string;
  acpArgs: string[];
  configured: boolean;
} {
  return {
    provider: settings.preset.id,
    baseUrl: settings.baseUrl,
    model: settings.model,
    hasKey: settings.apiKey !== '',
    acpCommand: settings.acpCommand,
    acpArgs: settings.acpArgs,
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
  const preset = overrides.provider ? findProvider(overrides.provider) : settings.preset;
  const providerChanged = overrides.provider !== undefined && overrides.provider !== settings.preset.id;
  return {
    ...settings,
    preset,
    baseUrl:
      overrides.baseUrl ??
      (providerChanged ? (preset.defaultBaseUrl ?? '') : settings.baseUrl),
    apiKey: overrides.apiKey !== undefined ? overrides.apiKey : settings.apiKey,
    model: overrides.model ?? settings.model,
  };
}
