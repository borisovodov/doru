import { describe, expect, it } from 'vitest';
import { catalogProvider, modelsDevCatalog } from '../src/catalog';

describe('modelsDevCatalog', () => {
  it('curates only the cloud providers Dóru ships', () => {
    expect(Object.keys(modelsDevCatalog.providers).sort()).toEqual([
      'anthropic',
      'deepseek',
      'gemini',
      'openai',
      'openrouter',
    ]);
    expect(modelsDevCatalog.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('maps models.dev "google" onto the gemini preset id', () => {
    const gemini = catalogProvider('gemini');
    expect(gemini?.id).toBe('gemini');
    expect(gemini?.name).toBe('Google');
    expect(gemini?.models.length).toBeGreaterThan(0);
  });

  it('carries the AI SDK package and documentation per provider', () => {
    const anthropic = catalogProvider('anthropic');
    expect(anthropic?.npm).toBe('@ai-sdk/anthropic');
    const openrouter = catalogProvider('openrouter');
    expect(openrouter?.api).toBe('https://openrouter.ai/api/v1');
    expect(openrouter?.env).toContain('OPENROUTER_API_KEY');
  });

  it('sorts models newest first with deprecated models last', () => {
    for (const provider of Object.values(modelsDevCatalog.providers)) {
      const statuses = provider.models.map((model) => model.status ?? '');
      const firstDeprecated = statuses.indexOf('deprecated');
      if (firstDeprecated !== -1) {
        expect(statuses.slice(firstDeprecated).every((status) => status === 'deprecated')).toBe(true);
      }
      const dates = provider.models
        .slice(0, firstDeprecated === -1 ? provider.models.length : firstDeprecated)
        .map((model) => model.release_date ?? '');
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i - 1]! >= dates[i]!).toBe(true);
      }
    }
  });

  it('keeps reasoning options, limits and pricing for catalog models', () => {
    const openai = catalogProvider('openai')!;
    const reasoningModel = openai.models.find((model) => model.reasoning === true);
    expect(reasoningModel?.reasoning_options).toBeDefined();

    const priced = openai.models.find((model) => model.cost?.input !== undefined);
    expect(priced?.limit?.context).toBeTypeOf('number');
  });

  it('returns undefined for providers outside the curation', () => {
    expect(catalogProvider('ollama')).toBeUndefined();
    expect(catalogProvider('nope')).toBeUndefined();
  });
});
