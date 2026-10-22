import { describe, expect, it } from 'vitest';
import { buildLanguageModel } from '../src/model';

describe('buildLanguageModel', () => {
  it('builds an OpenAI-compatible model for the local presets', () => {
    // The anthropic wire branch has no preset while CLOUD_PRESETS is empty;
    // it gets coverage again when a cloud preset with the Anthropic SDK
    // package is added back.
    for (const providerId of ['ollama', 'lmstudio', 'custom']) {
      const model = buildLanguageModel({
        providerId,
        baseUrl: 'http://localhost:11434/v1',
        apiKey: '',
        model: 'some-model',
      });
      expect(model.provider).toBe('doru.chat');
      expect(model.modelId).toBe('some-model');
    }
  });

  it('rejects ACP providers, which have no language model', () => {
    expect(() =>
      buildLanguageModel({ providerId: 'acp', baseUrl: '', apiKey: '', model: '' }),
    ).toThrow(/ACP agent/);
  });
});
