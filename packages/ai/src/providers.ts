import { catalogProvider, type CatalogProvider } from './catalog';

/** How a provider is served: from the models.dev catalog, a local endpoint, or an ACP agent. */
export type ProviderKind = 'cloud' | 'local' | 'acp';

/** The wire dialect used to talk to a provider. */
export type WireDialect = 'anthropic' | 'openai' | 'acp';

export interface AiProvider {
  id: string;
  label: string;
  kind: ProviderKind;
  /** URL of the provider's model documentation, when known. */
  doc?: string;
  /** Default API base URL; empty for ACP. */
  defaultBaseUrl: string;
  /** Suggested models (catalog defaults or static for local providers). */
  defaultModels: string[];
  requiresKey: boolean;
  /** The models.dev catalog entry when this provider ships catalog data. */
  catalog?: CatalogProvider;
}

interface CloudPreset {
  id: string;
  /** Base URL used when the catalog does not carry one. */
  fallbackBaseUrl: string;
  fallbackModels: string[];
}

const CLOUD_PRESETS: CloudPreset[] = [
  { id: 'openai', fallbackBaseUrl: 'https://api.openai.com/v1', fallbackModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'] },
  { id: 'anthropic', fallbackBaseUrl: 'https://api.anthropic.com', fallbackModels: ['claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-opus-4-5'] },
  {
    id: 'gemini',
    fallbackBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    fallbackModels: ['gemini-2.5-flash', 'gemini-2.5-pro'],
  },
  {
    id: 'openrouter',
    fallbackBaseUrl: 'https://openrouter.ai/api/v1',
    fallbackModels: ['openai/gpt-4o-mini', 'anthropic/claude-sonnet-4-5'],
  },
  { id: 'deepseek', fallbackBaseUrl: 'https://api.deepseek.com', fallbackModels: ['deepseek-chat', 'deepseek-reasoner'] },
];

const LOCAL_PRESETS: Array<Omit<AiProvider, 'catalog'>> = [
  {
    id: 'ollama',
    label: 'Ollama (local)',
    kind: 'local',
    defaultBaseUrl: 'http://localhost:11434/v1',
    defaultModels: ['llama3.3', 'qwen3'],
    requiresKey: false,
  },
  {
    id: 'lmstudio',
    label: 'LM Studio (local)',
    kind: 'local',
    defaultBaseUrl: 'http://localhost:1234/v1',
    defaultModels: [],
    requiresKey: false,
  },
  {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    kind: 'local',
    defaultBaseUrl: '',
    defaultModels: [],
    requiresKey: true,
  },
  {
    id: 'acp',
    label: 'ACP agent',
    kind: 'acp',
    defaultBaseUrl: '',
    defaultModels: [],
    requiresKey: false,
  },
];

/** Suggestions: recent, tool-capable, non-deprecated, canonical (no aliases/variants). */
function pickDefaultModels(provider: ReturnType<typeof catalogProvider>, fallback: string[]): string[] {
  if (!provider) {
    return fallback;
  }
  const usable = (model: (typeof provider.models)[number]): boolean =>
    model.status !== 'deprecated' && !model.id.startsWith('~') && !model.id.includes(':');
  const preferred = provider.models.filter((model) => usable(model) && model.tool_call === true);
  const rest = provider.models.filter((model) => usable(model) && model.tool_call !== true);
  const picks = [...preferred, ...rest].slice(0, 3).map((model) => model.id);
  return picks.length > 0 ? picks : fallback;
}

function cloudProvider(preset: CloudPreset): AiProvider {
  // The catalog keys providers by their Dóru provider id ("gemini", not "google").
  const catalog = catalogProvider(preset.id);
  const provider: AiProvider = {
    id: preset.id,
    label: catalog?.name ?? preset.id,
    kind: 'cloud',
    defaultBaseUrl: catalog?.api ?? preset.fallbackBaseUrl,
    defaultModels: pickDefaultModels(catalog, preset.fallbackModels),
    requiresKey: true,
    ...(catalog ? { catalog } : {}),
    ...(catalog?.doc ? { doc: catalog.doc } : {}),
  };
  return provider;
}

export const AI_PROVIDERS: AiProvider[] = [...CLOUD_PRESETS.map(cloudProvider), ...LOCAL_PRESETS];

export function findProvider(id: string): AiProvider {
  return AI_PROVIDERS.find((provider) => provider.id === id) ?? AI_PROVIDERS[0]!;
}

export function wireDialect(provider: AiProvider): WireDialect {
  if (provider.kind === 'acp') {
    return 'acp';
  }
  if (provider.catalog?.npm === '@ai-sdk/anthropic') {
    return 'anthropic';
  }
  return 'openai';
}
