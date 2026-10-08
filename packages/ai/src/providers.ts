export type AiDialect = 'openai' | 'anthropic' | 'acp';

export interface AiProviderPreset {
  id: string;
  label: string;
  dialect: AiDialect;
  defaultBaseUrl?: string;
  defaultModels: string[];
  requiresKey: boolean;
}

export const AI_PROVIDERS: AiProviderPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    dialect: 'openai',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
    requiresKey: true,
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    dialect: 'anthropic',
    defaultBaseUrl: 'https://api.anthropic.com',
    defaultModels: ['claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-opus-4-5'],
    requiresKey: true,
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    dialect: 'openai',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModels: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    requiresKey: true,
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    dialect: 'openai',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModels: ['openai/gpt-4o-mini', 'anthropic/claude-sonnet-4-5'],
    requiresKey: true,
  },
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

export function findProvider(id: string): AiProviderPreset {
  return AI_PROVIDERS.find((preset) => preset.id === id) ?? AI_PROVIDERS[0]!;
}
