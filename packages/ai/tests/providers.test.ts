import { describe, expect, it } from 'vitest';
import { AI_PROVIDERS, findProvider, wireDialect } from '../src/providers';

describe('AI_PROVIDERS', () => {
  it('lists only the local and ACP presets while cloud presets are unlisted', () => {
    expect(AI_PROVIDERS.map((provider) => provider.id)).toEqual([
      'ollama',
      'lmstudio',
      'custom',
      'acp',
    ]);
  });

  it('keeps the local and ACP presets static', () => {
    const ollama = findProvider('ollama');
    expect(ollama.kind).toBe('local');
    expect(ollama.defaultBaseUrl).toBe('http://localhost:11434/v1');
    expect(ollama.requiresKey).toBe(false);
    expect(ollama.defaultModels).toEqual([]);

    const lmstudio = findProvider('lmstudio');
    expect(lmstudio.kind).toBe('local');
    expect(lmstudio.requiresKey).toBe(false);
    expect(lmstudio.defaultModels).toEqual([]);

    const custom = findProvider('custom');
    expect(custom.kind).toBe('local');
    expect(custom.requiresKey).toBe(true);
    expect(custom.defaultModels).toEqual([]);

    const acp = findProvider('acp');
    expect(acp.kind).toBe('acp');
    expect(acp.defaultBaseUrl).toBe('');
  });

  it('derives the wire dialect from the registry', () => {
    expect(wireDialect(findProvider('ollama'))).toBe('openai');
    expect(wireDialect(findProvider('lmstudio'))).toBe('openai');
    expect(wireDialect(findProvider('custom'))).toBe('openai');
    expect(wireDialect(findProvider('acp'))).toBe('acp');
  });

  it('falls back to the first provider for unknown ids', () => {
    expect(findProvider('nope').id).toBe('ollama');
  });
});
