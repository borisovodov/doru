import { app, ipcMain, safeStorage, shell } from 'electron';
import { generateText } from 'ai';
import Anthropic from '@anthropic-ai/sdk';
import { AI_PROVIDERS, buildLanguageModel, wireDialect, type McpServerSettings } from '@doru/ai';
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
    AI_PROVIDERS.map((provider) => ({
      id: provider.id,
      label: provider.label,
      kind: provider.kind,
      doc: provider.doc,
      defaultBaseUrl: provider.defaultBaseUrl,
      requiresKey: provider.requiresKey,
      defaultModels: provider.defaultModels,
      models: (provider.catalog?.models ?? []).map((model) => ({
        id: model.id,
        name: model.name,
        description: model.description,
        reasoning: model.reasoning,
        reasoningOptions: model.reasoning_options,
        toolCall: model.tool_call,
        status: model.status,
        context: model.limit?.context,
        maxOutput: model.limit?.output,
        costInput: model.cost?.input,
        costOutput: model.cost?.output,
      })),
    })),
  );

  ipcMain.handle(
    'settings:ai:set',
    (_event, options: {
      provider?: string;
      baseUrl?: string;
      model?: string;
      reasoning?: string;
      apiKey?: string;
      clearKey?: boolean;
      acpCommand?: string;
      acpArgs?: string[];
      mcpServers?: McpServerSettings[];
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
      if (options.reasoning !== undefined) {
        if (options.reasoning === '') {
          edits.push({ path: ['ai', 'reasoning'] });
        } else {
          edits.push({ path: ['ai', 'reasoning'], value: options.reasoning });
        }
      }
      if (options.acpCommand !== undefined) {
        edits.push({ path: ['ai', 'command'], value: options.acpCommand });
      }
      if (options.acpArgs !== undefined) {
        edits.push({ path: ['ai', 'args'], value: options.acpArgs });
      }
      if (options.mcpServers !== undefined) {
        edits.push({ path: ['mcp', 'servers'], value: options.mcpServers });
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
      if (settings.provider.kind === 'acp') {
        return { ok: settings.acpCommand !== '', error: settings.acpCommand !== '' ? undefined : 'ACP command is not set' };
      }
      if (!settings.model) {
        return { ok: false, error: 'Model is not set' };
      }
      if (!settings.baseUrl) {
        return { ok: false, error: 'Base URL is not set' };
      }
      if (settings.provider.requiresKey && !settings.apiKey) {
        return { ok: false, error: 'API key is not set' };
      }
      try {
        const model = buildLanguageModel({
          providerId: settings.provider.id,
          baseUrl: settings.baseUrl,
          apiKey: settings.apiKey,
          model: settings.model,
        });
        await generateText({
          model,
          prompt: 'ping',
          maxOutputTokens: 8,
          ...(settings.reasoning !== '' ? { reasoning: settings.reasoning } : {}),
        });
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
      if (settings.provider.kind === 'acp' || !settings.baseUrl || !settings.apiKey) {
        return { models: [] as string[], error: 'Provider is not configured' };
      }
      try {
        if (wireDialect(settings.provider) === 'anthropic') {
          // The Anthropic SDK appends /v1/<path> to its base URL.
          const client = new Anthropic({
            apiKey: settings.apiKey,
            baseURL: settings.baseUrl.replace(/\/v1\/?$/, ''),
          });
          const page = await client.models.list({ limit: 200 });
          return { models: page.data.map((model) => model.id) };
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
