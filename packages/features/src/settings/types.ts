/** Static description of an AI provider and its catalog models for the settings UI. */
export interface AiProviderInfo {
  id: string;
  label: string;
  kind: 'cloud' | 'local' | 'acp';
  doc?: string;
  defaultBaseUrl: string;
  /** The key is mandatory before the provider can be used. */
  requiresKey: boolean;
  /** The key is accepted but optional (custom OpenAI-compatible endpoints). */
  allowKey: boolean;
  defaultModels: string[];
  models: AiCatalogModelInfo[];
}

export interface AiCatalogModelInfo {
  id: string;
  name: string;
  description?: string;
  /** Supports reasoning / chain-of-thought. */
  reasoning?: boolean;
  /** How the provider exposes reasoning control (toggle, effort levels or token budget). */
  reasoningOptions?: Array<
    | { type: 'toggle' }
    | { type: 'effort'; values: string[] }
    | { type: 'budget_tokens'; min?: number; max?: number }
  >;
  toolCall?: boolean;
  status?: string;
  context?: number;
  maxOutput?: number;
  /** USD per million tokens. */
  costInput?: number;
  costOutput?: number;
}

/** Persisted AI configuration (mirrors the main-process state). */
export interface AiSettingsState {
  provider: string;
  baseUrl: string;
  model: string;
  /** AI SDK reasoning level; empty means the provider default. */
  reasoning: string;
  hasKey: boolean;
  acpCommand: string;
  acpArgs: string[];
  configured: boolean;
}

/** Fetch state of the provider's model list (catalog-less providers). */
export type ModelFetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok' }
  | { status: 'empty' }
  | { status: 'error' };
