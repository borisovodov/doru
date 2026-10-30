// Builds AI SDK language models from provider settings. The wire dialect is
// derived from the provider registry (Anthropic's native API vs the OpenAI
// chat-completions format used by everything else); the wire formats
// themselves are the provider SDKs' job — no hand-rolled requests here.
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { findProvider, wireDialect } from './providers';

export interface ModelConfig {
  /** Dóru provider id from the registry (AI_PROVIDERS). */
  providerId: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

/**
 * Request-body extras for the Dóru AI preset. Qwen3.5 thinks by default; the
 * eval gate (scripts/eval-ai) showed thinking wins no scenario on the agent
 * toolset while costing ~2.5x latency, so the shipped preset pins
 * non-thinking mode. The key "doru" is the openai-compatible provider name
 * from `createOpenAICompatible` — unknown fields merge into the request body.
 */
export const DORU_CHAT_PROVIDER_OPTIONS = {
  doru: { chat_template_kwargs: { enable_thinking: false } },
};

export function buildLanguageModel(config: ModelConfig): LanguageModel {
  const provider = findProvider(config.providerId);
  const dialect = wireDialect(provider);
  if (dialect === 'acp') {
    throw new Error(`Provider "${config.providerId}" is an ACP agent and has no language model`);
  }
  if (dialect === 'anthropic') {
    return createAnthropic({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
    })(config.model);
  }
  return createOpenAICompatible({
    name: 'doru',
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
  })(config.model);
}
