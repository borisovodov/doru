import { catalogProvider, type CatalogModel } from './catalog';

export type AiDialect = 'openai' | 'anthropic' | 'acp';

export interface AiProviderPreset {
  id: string;
  label: string;
  dialect: AiDialect;
  defaultBaseUrl?: string;
  defaultModels: string[];
  requiresKey: boolean;
}

/**
 * Cloud presets are data-driven: models, base URLs and metadata come from
 * the vendored models.dev snapshot (refreshed at release time). Local and
 * ACP presets have no catalog entry and stay defined in code.
 */
interface CloudPreset {
  id: string;
  dialect: AiDialect;
  /** Base URL used when the catalog does not carry one. */
  fallbackBaseUrl: string;
  fallbackModels: string[];
}

const CLOUD_PRESETS: CloudPreset[] = [
  {
    id: 'openai',
    dialect: 'openai',
    fallbackBaseUrl: 'https://api.openai.com/v1',
    fallbackModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
  },
  {
    id: 'anthropic',
    dialect: 'anthropic',
    fallbackBaseUrl: 'https://api.anthropic.com',
    fallbackModels: ['claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-opus-4-5'],
  },
  {
    id: 'gemini',
    dialect: 'openai',
    fallbackBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    fallbackModels: ['gemini-2.5-flash', 'gemini-2.5-pro'],
  },
  {
    id: 'openrouter',
    dialect: 'openai',
    fallbackBaseUrl: 'https://openrouter.ai/api/v1',
    fallbackModels: ['openai/gpt-4o-mini', 'anthropic/claude-sonnet-4-5'],
  },
  {
    id: 'deepseek',
    dialect: 'openai',
    fallbackBaseUrl: 'https://api.deepseek.com',
    fallbackModels: ['deepseek-chat', 'deepseek-reasoner'],
  },
];

const LOCAL_PRESETS: AiProviderPreset[] = [
  {
    id: 'ollama',
    label: 'Ollama (local)',
    dialect: 'openai',
    defaultBaseUrl: 'http://localhost:11434/v1',
    defaultModels: ['llama3.3', 'qwen3'],
    requiresKey: false,
  },
  {
    id: 'lmstudio',
    label: 'LM Studio (local)',
    dialect: 'openai',
    defaultBaseUrl: 'http://localhost:1234/v1',
    defaultModels: [],
    requiresKey: false,
  },
  {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    dialect: 'openai',
    defaultModels: [],
    requiresKey: true,
  },
  {
    id: 'acp',
    label: 'ACP agent',
    dialect: 'acp',
    defaultModels: [],
    requiresKey: false,
  },
];

/** Suggestions: recent, tool-capable, non-deprecated, canonical (no aliases/variants). */
function pickDefaultModels(provider: ReturnType<typeof catalogProvider>, fallback: string[]): string[] {
  if (!provider) {
    return fallback;
  }
  const usable = (model: CatalogModel): boolean =>
    model.status !== 'deprecated' && !model.id.startsWith('~') && !model.id.includes(':');
  const preferred = provider.models.filter((model) => usable(model) && model.tool_call === true);
  const rest = provider.models.filter((model) => usable(model) && model.tool_call !== true);
  const picks = [...preferred, ...rest].slice(0, 3).map((model) => model.id);
  return picks.length > 0 ? picks : fallback;
}

function cloudPreset(preset: CloudPreset): AiProviderPreset {
  // The snapshot keys providers by their Dóru preset id ("gemini", not "google").
  const provider = catalogProvider(preset.id);
  return {
    id: preset.id,
    label: provider?.name ?? preset.id,
    dialect: preset.dialect,
    defaultBaseUrl: provider?.api ?? preset.fallbackBaseUrl,
    defaultModels: pickDefaultModels(provider, preset.fallbackModels),
    requiresKey: true,
  };
}

export const AI_PROVIDERS: AiProviderPreset[] = [
  ...CLOUD_PRESETS.map(cloudPreset),
  ...LOCAL_PRESETS,
];

export function findProvider(id: string): AiProviderPreset {
  return AI_PROVIDERS.find((preset) => preset.id === id) ?? AI_PROVIDERS[0]!;
}
