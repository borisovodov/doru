import { app, ipcMain, shell } from 'electron';
import { generateText } from 'ai';
import Anthropic from '@anthropic-ai/sdk';
import { AI_PROVIDERS, buildLanguageModel, wireDialect } from '@doru/ai';
import {
  aiSettingsPayload,
  settingsWithOverrides,
  loadAiSettings,
} from './ai-settings';
import { userErrorMessage } from './ai-errors';
import { ensureLogFile, log, logFilePath } from './log';
import { nls } from './nls';
import { clearAiApiKey, saveAiApiKey } from './secrets';
import { writeSettingsEdits } from './settings';

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:ai:get', () => aiSettingsPayload(loadAiSettings()));

  ipcMain.handle('app:about', () => ({ version: app.getVersion() }));

  ipcMain.handle('logs:open', () => {
    ensureLogFile();
    return shell.openPath(logFilePath());
  });

  // Links from markdown replies: only web URLs ever reach the browser.
  ipcMain.handle('shell:openExternal', (_event, url: string) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    return shell.openExternal(url);
  });

  ipcMain.handle('settings:ai:providers', () =>
    AI_PROVIDERS.map((provider) => ({
      id: provider.id,
      label: provider.label,
      kind: provider.kind,
      doc: provider.doc,
      defaultBaseUrl: provider.defaultBaseUrl,
      requiresKey: provider.requiresKey,
      allowKey: provider.allowKey ?? false,
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
    }) => {
      const edits: Array<{ path: (string | number)[]; value?: unknown }> = [];
      if (options.provider !== undefined) {
        edits.push({ path: ['ai', 'provider'], value: options.provider });
      }
      // Every value except the active-provider flag is stored per provider,
      // so switching providers restores each one's own configuration.
      const providerId = options.provider ?? loadAiSettings().provider.id;
      const section = ['ai', 'providers', providerId];
      if (options.baseUrl !== undefined) {
        edits.push({ path: [...section, 'baseUrl'], value: options.baseUrl });
      }
      if (options.model !== undefined) {
        edits.push({ path: [...section, 'model'], value: options.model });
      }
      if (options.reasoning !== undefined) {
        if (options.reasoning === '') {
          edits.push({ path: [...section, 'reasoning'] });
        } else {
          edits.push({ path: [...section, 'reasoning'], value: options.reasoning });
        }
      }
      if (options.acpCommand !== undefined) {
        edits.push({ path: [...section, 'command'], value: options.acpCommand });
      }
      if (options.acpArgs !== undefined) {
        edits.push({ path: [...section, 'args'], value: options.acpArgs });
      }
      if (options.clearKey) {
        clearAiApiKey(providerId);
      } else if (options.apiKey !== undefined && options.apiKey !== '') {
        saveAiApiKey(providerId, options.apiKey);
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
        return {
          ok: settings.acpCommand !== '',
          error: settings.acpCommand !== '' ? undefined : nls.t('settings.ai.acp.commandEmpty'),
        };
      }
      if (!settings.model) {
        return { ok: false, error: nls.t('settings.ai.modelNotSet') };
      }
      if (!settings.baseUrl) {
        return { ok: false, error: nls.t('settings.ai.baseUrlNotSet') };
      }
      if (settings.provider.requiresKey && !settings.apiKey) {
        return { ok: false, error: nls.t('settings.ai.apiKeyNotSet') };
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
        // Raw text for the log; the renderer shows a localized explanation.
        log.debug('settings: ai test failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        return { ok: false, error: userErrorMessage(error) };
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
      if (settings.provider.kind === 'acp' || !settings.baseUrl || (settings.provider.requiresKey && !settings.apiKey)) {
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
          headers: settings.apiKey !== '' ? { authorization: `Bearer ${settings.apiKey}` } : {},
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
