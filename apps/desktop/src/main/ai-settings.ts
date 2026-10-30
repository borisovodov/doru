import {
  findProvider,
  normalizeReasoning,
  offeredReasoningLevels,
  OPENAI_WIRE_LEVELS,
  REASONING_LEVELS,
  type AiProvider,
  type ReasoningLevel,
} from '@doru/ai';
import { doruModelInstalled } from './local-model';
import { readSettings } from './settings';
import { loadAiApiKey } from './secrets';

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
  // A stored level survives only when the selected model actually offers it
  // (its catalog effort values, or the fallback of its wire dialect). ACP
  // has no reasoning control, so no level ever travels for it.
  const reasoning =
    provider.kind === 'acp'
      ? ''
      : normalizeReasoning(
          stored.reasoning ?? '',
          offeredReasoningLevels(
            provider.catalog?.models.find((entry) => entry.id === model)?.reasoning_options,
            provider.catalog?.npm === '@ai-sdk/anthropic' ? REASONING_LEVELS : OPENAI_WIRE_LEVELS,
          ),
        );
  const acpCommand = stored.command ?? '';
  const acpArgs = stored.args ?? [];
  const apiKey = loadAiApiKey(providerId);

  const configured =
    provider.kind === 'acp'
      ? acpCommand !== ''
      : provider.id === 'doru'
        ? // The offline assistant needs no endpoint or key: installed = ready.
          doruModelInstalled()
        : model !== '' && baseUrl !== '' && (!provider.requiresKey || apiKey !== '');

  return { provider, baseUrl, apiKey, model, reasoning, acpCommand, acpArgs, configured };
}

export function loadAiSettings(): ResolvedAiSettings {
  const parsed = readSettings();
  const ai = (parsed['ai'] ?? {}) as AiSettingsJson;
  // The offline assistant is the default: it needs no key, endpoint or
  // account, so a fresh install works with a single download.
  return resolveSettings(ai.provider ?? 'doru');
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
