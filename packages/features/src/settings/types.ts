/** Static description of an AI provider preset. */
export interface AiProviderInfo {
  id: string;
  label: string;
  dialect: 'openai' | 'anthropic' | 'acp';
  defaultBaseUrl: string;
  defaultModels: string[];
  requiresKey: boolean;
}

/** Persisted AI provider configuration (mirrors the main-process state). */
export interface AiSettingsState {
  provider: string;
  baseUrl: string;
  model: string;
  hasKey: boolean;
  acpCommand: string;
  acpArgs: string[];
  configured: boolean;
}
