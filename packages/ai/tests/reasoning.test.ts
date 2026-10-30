import { describe, expect, test } from 'vitest';
import type { ReasoningOption } from '@opencode-ai/models';
import {
  normalizeReasoning,
  offeredReasoningLevels,
  OPENAI_WIRE_LEVELS,
  REASONING_LEVELS,
} from '../src/reasoning';

const OPENAI_FALLBACK: readonly string[] = OPENAI_WIRE_LEVELS;

describe('offeredReasoningLevels', () => {
  test('uses the effort values a catalog model declares', () => {
    const options: ReasoningOption[] = [{ type: 'effort', values: ['low', 'high', 'max'] }];
    expect(offeredReasoningLevels(options, OPENAI_FALLBACK)).toEqual(['low', 'high', 'max']);
  });

  test('drops values outside the SDK vocabulary and the "default" marker', () => {
    // "made-up" simulates a future catalog value the running version does not know.
    const options: ReasoningOption[] = [
      { type: 'effort', values: ['low', 'default', null, 'made-up', 'high'] } as unknown as ReasoningOption,
    ];
    expect(offeredReasoningLevels(options, OPENAI_FALLBACK)).toEqual(['low', 'high']);
  });

  test('falls back when the control is a toggle, a token budget, or missing', () => {
    expect(offeredReasoningLevels(undefined, OPENAI_FALLBACK)).toEqual([...OPENAI_FALLBACK]);
    expect(offeredReasoningLevels([{ type: 'toggle' }], OPENAI_FALLBACK)).toEqual([...OPENAI_FALLBACK]);
    expect(offeredReasoningLevels([{ type: 'budget_tokens', min: 1, max: 4096 }], OPENAI_FALLBACK)).toEqual([
      ...OPENAI_FALLBACK,
    ]);
  });

  test('the OpenAI fallback excludes the Anthropic-only xhigh/max', () => {
    expect(OPENAI_WIRE_LEVELS).toEqual(['none', 'minimal', 'low', 'medium', 'high']);
  });

  test('the full set covers every SDK level Dóru offers', () => {
    expect(REASONING_LEVELS).toEqual(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']);
  });
});

describe('normalizeReasoning', () => {
  test('keeps levels the model offers', () => {
    expect(normalizeReasoning('high', ['low', 'medium', 'high'])).toBe('high');
  });

  test('degrades unknown levels and unoffered levels to the provider default', () => {
    expect(normalizeReasoning('', ['low', 'high'])).toBe('');
    expect(normalizeReasoning('made-up', ['low', 'high'])).toBe('');
    expect(normalizeReasoning('xhigh', ['low', 'medium', 'high'])).toBe('');
    expect(normalizeReasoning('provider-default', ['low', 'high'])).toBe('');
  });

  test('offered undefined means no per-model restrictions', () => {
    expect(normalizeReasoning('max', undefined)).toBe('max');
    expect(normalizeReasoning('made-up', undefined)).toBe('');
  });
});
