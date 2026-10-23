import { findProvider, type AiProvider } from '@doru/ai';
import { readSettings } from './settings';
import { loadAiApiKey } from './secrets';

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

interface ProviderSettingsJson {
  baseUrl?: string;
  model?: string;
  reasoning?: string;
  command?: string;
  args?: string[];
}

interface AiSettingsJson {
  provider?: string;
  providers?: Record<string, ProviderSettingsJson>;
}

/**
 * Resolves one provider's effective settings: its own stored entry (or the
 * preset defaults) plus its API key slot. The global `ai.provider` flag only
 * decides which entry is active.
 */
function resolveSettings(providerId: string): ResolvedAiSettings {
  const provider = findProvider(providerId);
  const parsed = readSettings();
  const ai = (parsed['ai'] ?? {}) as AiSettingsJson;
  const stored = ai.providers?.[providerId] ?? {};

  const baseUrl = stored.baseUrl ?? provider.defaultBaseUrl ?? '';
  const model = stored.model ?? provider.defaultModels[0] ?? '';
  const reasoning = normalizeReasoning(stored.reasoning ?? '');
  const acpCommand = stored.command ?? '';
  const acpArgs = stored.args ?? [];
  const apiKey = loadAiApiKey(providerId);

  const configured =
    provider.kind === 'acp'
      ? acpCommand !== ''
      : model !== '' && baseUrl !== '' && (!provider.requiresKey || apiKey !== '');

  return { provider, baseUrl, apiKey, model, reasoning, acpCommand, acpArgs, configured };
}

export function loadAiSettings(): ResolvedAiSettings {
  const parsed = readSettings();
  const ai = (parsed['ai'] ?? {}) as AiSettingsJson;
  return resolveSettings(ai.provider ?? 'ollama');
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

/**
 * Settings for an operation that targets a possibly different provider than
 * the active one (test connection, model-list fetch while switching). An
 * explicit override always wins; otherwise the targeted provider's own saved
 * values are used.
 */
export function settingsWithOverrides(overrides: {
  provider?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}): ResolvedAiSettings {
  const active = loadAiSettings();
  const base = overrides.provider !== undefined ? resolveSettings(overrides.provider) : active;
  return {
    ...base,
    baseUrl: overrides.baseUrl ?? base.baseUrl,
    apiKey: overrides.apiKey !== undefined ? overrides.apiKey : base.apiKey,
    model: overrides.model ?? base.model,
  };
}
