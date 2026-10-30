// The canonical reasoning-level vocabulary. The level union comes from the
// AI SDK (`LanguageModelV4CallOptions['reasoning']`), the per-model control
// shapes from models.dev (`ReasoningOption`) — Dóru adds only the
// wire-fallback sets, which no dependency exports.
import type { LanguageModelV4CallOptions } from '@ai-sdk/provider';
import type { ReasoningEffort, ReasoningOption } from '@opencode-ai/models';

/** AI SDK reasoning levels; Dóru represents 'provider-default' as the absence of a stored level. */
export type ReasoningLevel = NonNullable<LanguageModelV4CallOptions['reasoning']>;

/** Every level Dóru stores or offers, minus 'provider-default' (see ReasoningLevel). */
export const REASONING_LEVELS = [
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] as const satisfies readonly ReasoningLevel[];

/**
 * Fallback for OpenAI-shaped wires: the level passes through as
 * `reasoning_effort`; `xhigh`/`max` are Anthropic-only and would fail there.
 */
export const OPENAI_WIRE_LEVELS = [
  'none',
  'minimal',
  'low',
  'medium',
  'high',
] as const satisfies readonly ReasoningLevel[];

/**
 * The levels a model accepts: the effort values its catalog entry declares,
 * or the caller's fallback when the control is a toggle, a token budget, or
 * unspecified. Values outside the SDK vocabulary are dropped.
 */
export function offeredReasoningLevels(
  reasoningOptions: ReasoningOption[] | undefined,
  fallback: readonly ReasoningLevel[],
): ReasoningLevel[] {
  const effort = reasoningOptions?.find((option) => option.type === 'effort');
  const values = (effort?.type === 'effort' ? effort.values : []).filter(
    (value): value is Exclude<ReasoningEffort, null | 'default'> =>
      typeof value === 'string' && (REASONING_LEVELS as readonly string[]).includes(value),
  );
  return values.length > 0 ? values : [...fallback];
}

/**
 * A stored level degrades to the provider default (empty) when it is not a
 * known level or is not among the levels the selected model offers. Pass
 * `offered` as undefined for "no restrictions" — ACP has no reasoning
 * control at all, so its callers pass no level in the first place.
 */
export function normalizeReasoning(
  value: string,
  offered: readonly string[] | undefined,
): ReasoningLevel | '' {
  if (value === '' || !(REASONING_LEVELS as readonly string[]).includes(value)) {
    return '';
  }
  return offered !== undefined && !offered.includes(value) ? '' : (value as ReasoningLevel);
}
