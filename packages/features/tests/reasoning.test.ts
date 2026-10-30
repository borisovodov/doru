import { describe, expect, test } from 'vitest';
import type { AiProviderInfo } from '../src/settings/types';
import { offeredReasoningLevels, REASONING_LABELS } from '../src/settings/reasoning';

const provider = (overrides: Partial<AiProviderInfo> = {}): AiProviderInfo => ({
  id: 'ollama',
  label: 'Ollama',
  kind: 'local',
  defaultBaseUrl: 'http://localhost:11434/v1',
  requiresKey: false,
  allowKey: false,
  defaultModels: [],
  models: [],
  ...overrides,
});

describe('offeredReasoningLevels', () => {
  test('uses the effort values a catalog model declares', () => {
    const p = provider({
      kind: 'cloud',
      models: [
        { id: 'm', name: 'm', reasoning: true, reasoningOptions: [{ type: 'effort', values: ['low', 'high', 'max'] }] },
      ],
    });
    const model = p.models.find((entry) => entry.id === 'm');
    expect(offeredReasoningLevels(model, p)).toEqual(['low', 'high', 'max']);
  });

  test('falls back to the OpenAI enum for non-Anthropic providers', () => {
    expect(offeredReasoningLevels(undefined, provider())).toEqual([
      'none',
      'minimal',
      'low',
      'medium',
      'high',
    ]);
  });

  test('falls back to the full range for the Anthropic wire', () => {
    expect(offeredReasoningLevels(undefined, provider({ npm: '@ai-sdk/anthropic' }))).toEqual([
      'none',
      'minimal',
      'low',
      'medium',
      'high',
      'xhigh',
      'max',
    ]);
  });

  test('every offered level has a localized label', () => {
    const levels = offeredReasoningLevels(undefined, provider({ npm: '@ai-sdk/anthropic' }));
    for (const level of levels) {
      expect(REASONING_LABELS[level]).toBeDefined();
    }
  });
});
