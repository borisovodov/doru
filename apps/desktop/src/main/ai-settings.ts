import { safeStorage } from 'electron';
import { findProvider, type AiProvider } from '@doru/ai';
import { readSettings, writeSettingsEdits } from './settings';
import { log } from './log';

/** AI SDK reasoning levels Dóru exposes (provider default is the absence of a level). */
const REASONING_LEVELS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
export type ReasoningLevel = (typeof REASONING_LEVELS)[number];

/** Unknown reasoning levels degrade to the provider default instead of breaking the agent. */
function normalizeReasoning(value: string): ReasoningLevel | '' {
  return (REASONING_LEVELS as readonly string[]).includes(value) ? (value as ReasoningLevel) : '';
}

export interface ResolvedAiSettings {
  provider: AiProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** AI SDK reasoning level; empty means the provider default. */
  reasoning: ReasoningLevel | '';
  acpCommand: string;
  acpArgs: string[];
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

  const provider = findProvider(ai.provider ?? 'ollama');

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
  const reasoning = normalizeReasoning(ai.reasoning ?? '');
  const acpCommand = ai.command ?? '';
  const acpArgs = ai.args ?? [];

  const configured =
    provider.kind === 'acp'
      ? acpCommand !== ''
      : model !== '' && baseUrl !== '' && (!provider.requiresKey || apiKey !== '');

  return { provider, baseUrl, apiKey, model, reasoning, acpCommand, acpArgs, configured };
}

export function aiSettingsPayload(settings: ResolvedAiSettings): {
  provider: string;
  baseUrl: string;
  model: string;
  reasoning: ReasoningLevel | '';
  hasKey: boolean;
  acpCommand: string;
  acpArgs: string[];
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
