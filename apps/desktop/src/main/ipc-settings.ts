import { ipcMain, safeStorage } from 'electron';
import { AnthropicChatConnector, OpenAIChatConnector, AI_PROVIDERS } from '@doru/ai';
import {
  aiSettingsPayload,
  configWithOverrides,
  loadAiConfig,
} from './ai-config';
import { writeConfigEdits } from './config';

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:ai:get', () => aiSettingsPayload(loadAiConfig()));

  ipcMain.handle('settings:ai:providers', () =>
    AI_PROVIDERS.map((preset) => ({
      id: preset.id,
      label: preset.label,
      dialect: preset.dialect,
      defaultBaseUrl: preset.defaultBaseUrl ?? '',
      defaultModels: preset.defaultModels,
      requiresKey: preset.requiresKey,
    })),
  );

  ipcMain.handle(
    'settings:ai:set',
    (_event, options: {
      provider?: string;
      baseUrl?: string;
      model?: string;
      apiKey?: string;
      clearKey?: boolean;
      acpCommand?: string;
      acpArgs?: string[];
    }) => {
      const edits: Array<{ path: (string | number)[]; value?: unknown }> = [];
      if (options.provider !== undefined) {
        edits.push({ path: ['ai', 'provider'], value: options.provider });
      }
      if (options.baseUrl !== undefined) {
        edits.push({ path: ['ai', 'baseUrl'], value: options.baseUrl });
      }
      if (options.model !== undefined) {
        edits.push({ path: ['ai', 'model'], value: options.model });
      }
      if (options.acpCommand !== undefined) {
        edits.push({ path: ['ai', 'command'], value: options.acpCommand });
      }
      if (options.acpArgs !== undefined) {
        edits.push({ path: ['ai', 'args'], value: options.acpArgs });
      }
      if (options.clearKey) {
        edits.push({ path: ['ai', 'apiKeyEncrypted'] });
        edits.push({ path: ['ai', 'apiKey'] });
      } else if (options.apiKey !== undefined && options.apiKey !== '') {
        if (!safeStorage.isEncryptionAvailable()) {
          throw new Error('OS keychain is not available');
        }
        edits.push({
          path: ['ai', 'apiKeyEncrypted'],
          value: safeStorage.encryptString(options.apiKey).toString('base64'),
        });
        edits.push({ path: ['ai', 'apiKey'] });
      }
      if (edits.length > 0) {
        writeConfigEdits(edits);
      }
      return aiSettingsPayload(loadAiConfig());
    },
  );

  ipcMain.handle(
    'settings:ai:test',
    async (
      _event,
      options: {
        provider?: string;
        baseUrl?: string;
        apiKey?: string;
        model?: string;
      } = {},
    ) => {
      const config = configWithOverrides(options);
      if (config.preset.dialect === 'acp') {
        return { ok: config.acpCommand !== '', error: config.acpCommand !== '' ? undefined : 'ACP command is not set' };
      }
      if (!config.model) {
        return { ok: false, error: 'Model is not set' };
      }
      if (!config.baseUrl) {
        return { ok: false, error: 'Base URL is not set' };
      }
      if (config.preset.requiresKey && !config.apiKey) {
        return { ok: false, error: 'API key is not set' };
      }
      try {
        const model =
          config.preset.dialect === 'anthropic'
            ? new AnthropicChatConnector({ baseUrl: config.baseUrl, apiKey: config.apiKey, model: config.model })
            : new OpenAIChatConnector({ baseUrl: config.baseUrl, apiKey: config.apiKey, model: config.model });
        await model.complete([{ role: 'user', content: 'ping' }], []);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  );

  ipcMain.handle(
    'settings:ai:models',
    async (
      _event,
      options: {
        provider?: string;
        baseUrl?: string;
        apiKey?: string;
        model?: string;
      } = {},
    ) => {
      const config = configWithOverrides(options);
      if (config.preset.dialect === 'acp' || !config.baseUrl || !config.apiKey) {
        return { models: [] as string[], error: 'Provider is not configured' };
      }
      try {
        if (config.preset.dialect === 'anthropic') {
          const response = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/v1/models`, {
            headers: { 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01' },
          });
          if (!response.ok) {
            return { models: [] as string[], error: `HTTP ${response.status}` };
          }
          const data = (await response.json()) as { data?: Array<{ id: string }> };
          return { models: (data.data ?? []).map((model) => model.id) };
        }
        const response = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/models`, {
          headers: { authorization: `Bearer ${config.apiKey}` },
        });
        if (!response.ok) {
          return { models: [] as string[], error: `HTTP ${response.status}` };
        }
        const data = (await response.json()) as { data?: Array<{ id: string }> };
        return { models: (data.data ?? []).map((model) => model.id) };
      } catch (error) {
        return { models: [] as string[], error: error instanceof Error ? error.message : String(error) };
      }
    },
  );
}
