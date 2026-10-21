import { describe, expect, it } from 'vitest';
import { AI_PROVIDERS, findProvider, wireDialect } from '../src/providers';

describe('AI_PROVIDERS', () => {
  it('lists the nine presets with cloud providers backed by the catalog', () => {
    expect(AI_PROVIDERS.map((provider) => provider.id)).toEqual([
      'openai',
      'anthropic',
      'gemini',
      'openrouter',
      'deepseek',
      'ollama',
      'lmstudio',
      'custom',
      'acp',
    ]);
    for (const id of ['openai', 'anthropic', 'gemini', 'openrouter', 'deepseek']) {
      const provider = AI_PROVIDERS.find((entry) => entry.id === id)!;
      expect(provider.kind).toBe('cloud');
      expect(provider.catalog).toBeDefined();
      expect(provider.requiresKey).toBe(true);
      expect(provider.defaultModels.length).toBeGreaterThan(0);
      expect(provider.defaultBaseUrl).not.toBe('');
    }
  });

  it('keeps the local and ACP presets static', () => {
    const ollama = findProvider('ollama');
    expect(ollama.kind).toBe('local');
    expect(ollama.defaultBaseUrl).toBe('http://localhost:11434/v1');
    expect(ollama.requiresKey).toBe(false);

    const custom = findProvider('custom');
    expect(custom.kind).toBe('local');
    expect(custom.requiresKey).toBe(true);
    expect(custom.defaultModels).toEqual([]);

    const acp = findProvider('acp');
    expect(acp.kind).toBe('acp');
    expect(acp.defaultBaseUrl).toBe('');
  });

  it('derives the wire dialect from the registry', () => {
    expect(wireDialect(findProvider('anthropic'))).toBe('anthropic');
    expect(wireDialect(findProvider('openai'))).toBe('openai');
    expect(wireDialect(findProvider('gemini'))).toBe('openai');
    expect(wireDialect(findProvider('ollama'))).toBe('openai');
    expect(wireDialect(findProvider('acp'))).toBe('acp');
  });

  it('falls back to the first provider for unknown ids', () => {
    expect(findProvider('nope').id).toBe('openai');
  });
});
