import { describe, expect, it } from 'vitest';
import { buildLanguageModel } from '../src/model';

describe('buildLanguageModel', () => {
  it('builds an Anthropic model for the anthropic preset', () => {
    const model = buildLanguageModel({
      providerId: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      apiKey: 'key',
      model: 'claude-sonnet-4-5',
    });
    expect(model.provider).toBe('anthropic.messages');
    expect(model.modelId).toBe('claude-sonnet-4-5');
  });

  it('builds an OpenAI-compatible model for every other preset', () => {
    for (const providerId of ['openai', 'gemini', 'openrouter', 'deepseek', 'ollama', 'lmstudio', 'custom']) {
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
