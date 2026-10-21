// The AI model catalog. Dóru ships the offline snapshot embedded in
// `@opencode-ai/models` (the official models.dev package, MIT): provider and
// model data — pricing, limits, capabilities and reasoning options — come
// from that package and refresh whenever its version is bumped at release
// time. Nothing is fetched at runtime.
import { generatedAt, providers } from '@opencode-ai/models/snapshot';
import type { Model, Provider, ReasoningOption } from '@opencode-ai/models';

export interface CatalogModel {
  id: string;
  name: string;
  description?: string;
  /** Supports reasoning / chain-of-thought. */
  reasoning?: boolean;
  /** How the provider exposes reasoning control (toggle, effort levels or token budget). */
  reasoning_options?: ReasoningOption[];
  tool_call?: boolean;
  structured_output?: boolean;
  temperature?: boolean;
  attachment?: boolean;
  limit?: { context?: number; input?: number; output?: number };
  /** USD per million tokens. */
  cost?: { input?: number; output?: number; cache_read?: number; cache_write?: number };
  status?: string;
  release_date?: string;
  last_updated?: string;
}

export interface CatalogProvider {
  /** Dóru preset id (models.dev calls Gemini "google"). */
  id: string;
  name: string;
  /** The AI SDK package that serves this provider (models.dev "npm" field). */
  npm?: string;
  /** Default API base URL; absent when the npm package is first-party. */
  api?: string;
  env?: string[];
  doc?: string;
  /** Newest non-deprecated models first. */
  models: CatalogModel[];
}

export interface ModelsDevCatalog {
  fetchedAt: string;
  source: string;
  license: string;
  providers: Record<string, CatalogProvider>;
}

/** Snapshot provider id -> Dóru preset id. */
const CURATED: ReadonlyArray<{ sourceId: string; presetId: string }> = [
  { sourceId: 'openai', presetId: 'openai' },
  { sourceId: 'anthropic', presetId: 'anthropic' },
  { sourceId: 'google', presetId: 'gemini' },
  { sourceId: 'openrouter', presetId: 'openrouter' },
  { sourceId: 'deepseek', presetId: 'deepseek' },
];

function toCatalogModel(model: Model): CatalogModel {
  const trimmed: CatalogModel = { id: model.id, name: model.name };
  const description = model.description;
  if (description) trimmed['description'] = description;
  if (model.reasoning) trimmed['reasoning'] = true;
  if (model.reasoning_options) trimmed['reasoning_options'] = model.reasoning_options;
  if (model.tool_call) trimmed['tool_call'] = true;
  if (model.structured_output) trimmed['structured_output'] = true;
  if (model.temperature) trimmed['temperature'] = true;
  if (model.attachment) trimmed['attachment'] = true;
  const limit = model.limit;
  if (limit.context !== undefined || limit.input !== undefined || limit.output !== undefined) {
    trimmed['limit'] = {
      ...(limit.context !== undefined ? { context: limit.context } : {}),
      ...(limit.input !== undefined ? { input: limit.input } : {}),
      ...(limit.output !== undefined ? { output: limit.output } : {}),
    };
  }
  const cost = model.cost;
  if (cost) {
    trimmed['cost'] = {
      input: cost.input,
      output: cost.output,
      ...(cost.cache_read !== undefined ? { cache_read: cost.cache_read } : {}),
      ...(cost.cache_write !== undefined ? { cache_write: cost.cache_write } : {}),
    };
  }
  if (model.status) trimmed['status'] = model.status;
  if (model.release_date) trimmed['release_date'] = model.release_date;
  if (model.last_updated) trimmed['last_updated'] = model.last_updated;
  return trimmed;
}

function toCatalogProvider(presetId: string, provider: Provider): CatalogProvider {
  const models = Object.values(provider.models)
    .map(toCatalogModel)
    .sort((a, b) => {
      const aDeprecated = a.status === 'deprecated' ? 1 : 0;
      const bDeprecated = b.status === 'deprecated' ? 1 : 0;
      if (aDeprecated !== bDeprecated) {
        return aDeprecated - bDeprecated;
      }
      return (b.release_date ?? '').localeCompare(a.release_date ?? '');
    });
  const trimmed: CatalogProvider = {
    id: presetId,
    name: provider.name,
    models,
  };
  if (provider.npm) trimmed['npm'] = provider.npm;
  if (provider.api) trimmed['api'] = provider.api;
  if (provider.env.length > 0) trimmed['env'] = provider.env;
  if (provider.doc) trimmed['doc'] = provider.doc;
  return trimmed;
}

function buildCatalog(): ModelsDevCatalog {
  const curated: Record<string, CatalogProvider> = {};
  for (const { sourceId, presetId } of CURATED) {
    const provider = providers[sourceId];
    if (!provider) {
      throw new Error(`Provider "${sourceId}" is missing from the @opencode-ai/models snapshot`);
    }
    curated[presetId] = toCatalogProvider(presetId, provider);
  }
  return {
    fetchedAt: generatedAt.slice(0, 10),
    source: '@opencode-ai/models',
    license: 'MIT (models.dev) — see the @opencode-ai/models package.',
    providers: curated,
  };
}

export const modelsDevCatalog: ModelsDevCatalog = buildCatalog();

export function catalogProvider(id: string): CatalogProvider | undefined {
  return modelsDevCatalog.providers[id];
}
