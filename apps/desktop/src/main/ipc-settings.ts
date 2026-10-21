import { app, ipcMain, safeStorage, shell } from 'electron';
import { AnthropicChatConnector, OpenAIChatConnector, AI_PROVIDERS } from '@doru/ai';
import {
  aiSettingsPayload,
  settingsWithOverrides,
  loadAiSettings,
} from './ai-settings';
import { writeSettingsEdits } from './settings';
import { ensureLogFile, logFilePath } from './log';

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:ai:get', () => aiSettingsPayload(loadAiSettings()));

  ipcMain.handle('app:about', () => ({ version: app.getVersion() }));

  ipcMain.handle('logs:open', () => {
    ensureLogFile();
    return shell.openPath(logFilePath());
  });

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
        writeSettingsEdits(edits);
      }
      return aiSettingsPayload(loadAiSettings());
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
      const settings = settingsWithOverrides(options);
      if (settings.preset.dialect === 'acp') {
        return { ok: settings.acpCommand !== '', error: settings.acpCommand !== '' ? undefined : 'ACP command is not set' };
      }
      if (!settings.model) {
        return { ok: false, error: 'Model is not set' };
      }
      if (!settings.baseUrl) {
        return { ok: false, error: 'Base URL is not set' };
      }
      if (settings.preset.requiresKey && !settings.apiKey) {
        return { ok: false, error: 'API key is not set' };
      }
      try {
        const model =
          settings.preset.dialect === 'anthropic'
            ? new AnthropicChatConnector({ baseUrl: settings.baseUrl, apiKey: settings.apiKey, model: settings.model })
            : new OpenAIChatConnector({ baseUrl: settings.baseUrl, apiKey: settings.apiKey, model: settings.model });
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
      const settings = settingsWithOverrides(options);
      if (settings.preset.dialect === 'acp' || !settings.baseUrl || !settings.apiKey) {
        return { models: [] as string[], error: 'Provider is not configured' };
      }
      try {
        if (settings.preset.dialect === 'anthropic') {
          const response = await fetch(`${settings.baseUrl.replace(/\/+$/, '')}/v1/models`, {
            headers: { 'x-api-key': settings.apiKey, 'anthropic-version': '2023-06-01' },
          });
          if (!response.ok) {
            return { models: [] as string[], error: `HTTP ${response.status}` };
          }
          const data = (await response.json()) as { data?: Array<{ id: string }> };
          return { models: (data.data ?? []).map((model) => model.id) };
        }
        const response = await fetch(`${settings.baseUrl.replace(/\/+$/, '')}/models`, {
          headers: { authorization: `Bearer ${settings.apiKey}` },
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
