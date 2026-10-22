import { useState } from 'react';
import type { MessageKey } from '@doru/platform';
import { nls } from '../nls';
import type { AiProviderInfo, AiSettingsState } from './types';
import './SettingsView.css';

export interface ThemeEntry {
  id: string;
  name: string;
}

export type AiTestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok' }
  | { status: 'fail'; message: string };

export interface AiSettingsSectionProps {
  settings: AiSettingsState;
  providers: AiProviderInfo[];
  test: AiTestState;
  fetchedModels: string[];
  onSetProvider: (id: string) => void;
  onSetModel: (model: string) => void;
  onSetBaseUrl: (url: string) => void;
  onSetReasoning: (level: string) => void;
  onSetApiKey: (key: string) => void;
  onClearApiKey: () => void;
  onSetAcpCommand: (command: string) => void;
  onSetAcpArgs: (args: string[]) => void;
  onTest: () => void;
  onFetchModels: () => void;
}

export interface SettingsViewProps {
  /** The active theme id. */
  theme: string;
  /** All available themes (bundled plus user themes). */
  themes: ThemeEntry[];
  onThemeChange: (id: string) => void;
  onOpenLogs: () => void;
  onOpenThemesFolder: () => void;
  /** The app version shown in the About section. */
  version: string;
  /** AI settings section; null while the settings are still loading. */
  ai: AiSettingsSectionProps | null;
}

export function SettingsView({
  theme,
  themes,
  onThemeChange,
  onOpenLogs,
  onOpenThemesFolder,
  version,
  ai,
}: SettingsViewProps) {
  return (
    <div className="settings-view">
      {ai ? <AiSettingsSection {...ai} /> : null}
      <div className="settings-section">
        <h3>{nls.t('settings.theme.title')}</h3>
        <select
          value={theme}
          onChange={(event) => onThemeChange(event.target.value)}
          aria-label={nls.t('settings.theme.title')}
        >
          {themes.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
        <button className="settings-link" onClick={onOpenThemesFolder}>
          {nls.t('settings.theme.openThemesFolder')}
        </button>
      </div>
      <div className="settings-section">
        <h3>{nls.t('settings.diagnostics.title')}</h3>
        <button className="settings-link" onClick={onOpenLogs}>
          {nls.t('settings.diagnostics.openLog')}
        </button>
      </div>
      <div className="settings-section">
        <h3>{nls.t('settings.about.title')}</h3>
        <p className="settings-note">{nls.t('settings.about.version', version)}</p>
      </div>
    </div>
  );
}

const REASONING_LEVELS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;

const REASONING_LABELS: Record<(typeof REASONING_LEVELS)[number], MessageKey> = {
  none: 'settings.ai.reasoning.none',
  minimal: 'settings.ai.reasoning.minimal',
  low: 'settings.ai.reasoning.low',
  medium: 'settings.ai.reasoning.medium',
  high: 'settings.ai.reasoning.high',
  xhigh: 'settings.ai.reasoning.xhigh',
  max: 'settings.ai.reasoning.max',
};

function AiSettingsSection(props: AiSettingsSectionProps) {
  const { settings, providers, test, fetchedModels } = props;
  const provider = providers.find((entry) => entry.id === settings.provider);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [baseUrlDraft, setBaseUrlDraft] = useState<string | null>(null);

  const model = provider?.models.find((entry) => entry.id === settings.model);
  const hasCatalog = (provider?.models.length ?? 0) > 0;
  const modelOptions = [
    ...(provider?.models ?? []).map((entry) => entry.id),
    ...(!provider?.models.some((entry) => entry.id === settings.model) && settings.model !== ''
      ? [settings.model]
      : []),
  ];

  return (
    <div className="settings-section">
      <h3>{nls.t('settings.ai.title')}</h3>
      {!settings.configured ? <p className="settings-note">{nls.t('settings.ai.notConfigured')}</p> : null}

      <label className="settings-field">
        <span>{nls.t('settings.ai.provider')}</span>
        <select
          value={settings.provider}
          onChange={(event) => props.onSetProvider(event.target.value)}
          aria-label={nls.t('settings.ai.provider')}
        >
          {providers.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
      </label>

      {provider?.kind === 'acp' ? (
        <>
          <label className="settings-field">
            <span>{nls.t('settings.ai.acp.command')}</span>
            <input
              value={settings.acpCommand}
              onChange={(event) => props.onSetAcpCommand(event.target.value)}
              // nls-ignore: machine-facing command example, not translatable
              placeholder="npx @some/agent"
            />
          </label>
          <label className="settings-field">
            <span>{nls.t('settings.ai.acp.args')}</span>
            <input
              value={settings.acpArgs.join(' ')}
              placeholder={nls.t('settings.ai.acp.argsHint')}
              onChange={(event) => props.onSetAcpArgs(event.target.value.trim() === '' ? [] : event.target.value.trim().split(/\s+/))}
            />
          </label>
        </>
      ) : (
        <>
          <label className="settings-field">
            <span>{nls.t('settings.ai.model')}</span>
            {hasCatalog ? (
              <select
                value={settings.model}
                onChange={(event) => props.onSetModel(event.target.value)}
                aria-label={nls.t('settings.ai.model')}
              >
                {modelOptions.map((id) => {
                  const entry = provider?.models.find((candidate) => candidate.id === id);
                  const label = entry ? `${entry.name} — ${modelBadge(entry)}` : id;
                  return (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  );
                })}
              </select>
            ) : (
              // Providers without a catalog (Ollama, LM Studio, custom) have no
              // in-app model list: the model id is typed, with the provider's
              // own list as suggestions after an explicit fetch.
              <>
                <input
                  list="doru-model-suggestions"
                  value={settings.model}
                  onChange={(event) => props.onSetModel(event.target.value)}
                  aria-label={nls.t('settings.ai.model')}
                />
                <datalist id="doru-model-suggestions">
                  {fetchedModels.map((id) => (
                    <option key={id} value={id} />
                  ))}
                </datalist>
              </>
            )}
          </label>
          {!hasCatalog ? (
            <button className="settings-link" onClick={props.onFetchModels}>
              {nls.t('settings.ai.modelRefresh')}
            </button>
          ) : null}
          {!hasCatalog && fetchedModels.length === 0 && settings.model === '' ? (
            <p className="settings-note">{nls.t('settings.ai.modelEmpty')}</p>
          ) : null}

          {model?.reasoning || model?.reasoningOptions ? (
            <label className="settings-field">
              <span>{nls.t('settings.ai.reasoning')}</span>
              <select
                value={settings.reasoning}
                onChange={(event) => props.onSetReasoning(event.target.value)}
                aria-label={nls.t('settings.ai.reasoning')}
              >
                <option value="">{nls.t('settings.ai.reasoning.default')}</option>
                {REASONING_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {nls.t(REASONING_LABELS[level])}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="settings-field">
            <span>{nls.t('settings.ai.baseUrl')}</span>
            <input
              value={baseUrlDraft ?? settings.baseUrl}
              onChange={(event) => setBaseUrlDraft(event.target.value)}
              onBlur={() => {
                if (baseUrlDraft !== null && baseUrlDraft !== settings.baseUrl) {
                  props.onSetBaseUrl(baseUrlDraft);
                }
                setBaseUrlDraft(null);
              }}
            />
          </label>

          {provider?.requiresKey ? (
            <div className="settings-field">
              <span>{nls.t('settings.ai.apiKey')}</span>
              <div className="settings-inline">
                <input
                  type="password"
                  value={apiKeyDraft}
                  placeholder={settings.hasKey ? nls.t('settings.ai.apiKeySaved') : nls.t('settings.ai.apiKeyPlaceholder')}
                  onChange={(event) => setApiKeyDraft(event.target.value)}
                />
                <button
                  disabled={apiKeyDraft === ''}
                  onClick={() => {
                    props.onSetApiKey(apiKeyDraft);
                    setApiKeyDraft('');
                  }}
                >
                  {nls.t('settings.ai.apiKeySave')}
                </button>
                {settings.hasKey ? (
                  <button onClick={props.onClearApiKey}>{nls.t('settings.ai.apiKeyClear')}</button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="settings-inline">
            <button onClick={props.onTest} disabled={test.status === 'testing'}>
              {test.status === 'testing' ? nls.t('settings.ai.testing') : nls.t('settings.ai.test')}
            </button>
            {test.status === 'ok' ? <span className="settings-note">{nls.t('settings.ai.test.ok')}</span> : null}
            {test.status === 'fail' ? (
              <span className="settings-error">{nls.t('settings.ai.test.fail', test.message)}</span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function modelBadge(model: AiProviderInfo['models'][number]): string {
  const parts: string[] = [];
  if (model.context !== undefined) {
    parts.push(nls.t('settings.ai.model.context', formatTokens(model.context)));
  }
  if (model.costInput !== undefined && model.costOutput !== undefined) {
    parts.push(nls.t('settings.ai.model.cost', String(model.costInput), String(model.costOutput)));
  }
  return parts.join(' · ');
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${tokens / 1_000_000}M`;
  }
  if (tokens >= 1_000) {
    return `${Math.round(tokens / 1_000)}k`;
  }
  return String(tokens);
}
