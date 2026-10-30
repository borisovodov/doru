import {
  OPENAI_WIRE_LEVELS,
  REASONING_LEVELS,
  offeredReasoningLevels as aiOfferedReasoningLevels,
} from '@doru/ai/reasoning';
import type { MessageKey } from '@doru/platform';
import type { AiCatalogModelInfo, AiProviderInfo } from './types';

/** Every level the canonical vocabulary offers has a localized label. */
export const REASONING_LABELS: Record<string, MessageKey> = {
  none: 'settings.ai.reasoning.none',
  minimal: 'settings.ai.reasoning.minimal',
  low: 'settings.ai.reasoning.low',
  medium: 'settings.ai.reasoning.medium',
  high: 'settings.ai.reasoning.high',
  xhigh: 'settings.ai.reasoning.xhigh',
  max: 'settings.ai.reasoning.max',
};

/**
 * The levels offered for the selected model: the effort values its catalog
 * entry declares, or the fallback of the provider's wire dialect (the
 * Anthropic range, or the OpenAI enum that passes through as
 * `reasoning_effort`).
 */
export function offeredReasoningLevels(
  model: AiCatalogModelInfo | undefined,
  provider: AiProviderInfo | undefined,
): string[] {
  const fallback = provider?.npm === '@ai-sdk/anthropic' ? REASONING_LEVELS : OPENAI_WIRE_LEVELS;
  return aiOfferedReasoningLevels(model?.reasoningOptions, fallback);
}
