import { useEffect, useMemo, useState } from 'react';
import type { DoruModelError, DoruModelState } from '@doru/ai';
import type { MessageKey } from '@doru/platform';
import { nls } from '../nls';
import { offeredReasoningLevels, REASONING_LABELS } from './reasoning';
import type { AiProviderInfo, AiSettingsState, ModelFetchState } from './types';
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
  modelFetch: ModelFetchState;
  /** The Dóru AI offline model state; null while it is still loading. */
  doruModel: DoruModelState | null;
  onSetProvider: (id: string) => void;
  onSetModel: (model: string) => void;
  onSetBaseUrl: (url: string) => void;
  onSetReasoning: (level: string) => void;
  onSetApiKey: (key: string) => void;
  onClearApiKey: () => void;
  onSetAcpCommand: (command: string) => void;
  onSetAcpArgs: (args: string[]) => void;
  onTest: () => void;
  onFetchModels: (baseUrl?: string | undefined) => void;
  onDownloadDoruModel: () => void;
  onCancelDoruModelDownload: () => void;
  onDeleteDoruModel: () => void;
}

export interface SettingsViewProps {
  /** The active theme id. */
  theme: string;
  /** All available themes (bundled plus user themes). */
  themes: ThemeEntry[];
  onThemeChange: (id: string) => void;
  onOpenLogs: () => void;
  onOpenThemesFolder: () => void;
  /** Opens the third-party notices tab. */
  onOpenNotices: () => void;
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
  onOpenNotices,
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
        <button className="settings-link" onClick={onOpenNotices}>
          {nls.t('settings.about.notices')}
        </button>
      </div>
    </div>
  );
}

const REASONING_DEFAULT_LABEL = 'settings.ai.reasoning.default';

function ReasoningSelect(props: { value: string; levels: string[]; onChange: (level: string) => void }) {
  return (
    <label className="settings-field">
      <span>{nls.t('settings.ai.reasoning')}</span>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        aria-label={nls.t('settings.ai.reasoning')}
      >
        <option value="">{nls.t(REASONING_DEFAULT_LABEL)}</option>
        {props.levels.map((level) => (
          <option key={level} value={level}>
            {nls.t(REASONING_LABELS[level] ?? REASONING_DEFAULT_LABEL)}
          </option>
        ))}
      </select>
    </label>
  );
}

function AiSettingsSection(props: AiSettingsSectionProps) {
  const { settings, providers, test, fetchedModels, modelFetch } = props;
  const provider = providers.find((entry) => entry.id === settings.provider);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [baseUrlDraft, setBaseUrlDraft] = useState<string | null>(null);
  const [argsDraft, setArgsDraft] = useState<string | null>(null);

  // Drafts never survive a provider switch: a key or URL typed for one
  // provider must not leak into another's fields.
  useEffect(() => {
    setApiKeyDraft('');
    setBaseUrlDraft(null);
    setArgsDraft(null);
  }, [settings.provider]);

  const model = provider?.models.find((entry) => entry.id === settings.model);
  const hasCatalog = (provider?.models.length ?? 0) > 0;
  // The levels the selected model accepts: its catalog effort values, or the
  // fallback of the provider's wire dialect.
  const reasoningLevels = useMemo(() => offeredReasoningLevels(model, provider), [model, provider]);
  // Catalog models gate the control on their declared reasoning capability;
  // catalog-less providers (Ollama, LM Studio, custom) can't tell us, so the
  // control is offered once a model is chosen — the level passes through as
  // `reasoning_effort` and non-reasoning servers ignore it. ACP has no
  // reasoning control at all.
  const reasoningAvailable =
    provider?.kind !== 'acp' &&
    (hasCatalog
      ? model?.reasoning === true || (model?.reasoningOptions?.length ?? 0) > 0
      : settings.model !== '');
  // A stored level the selected model does not offer (a model switch, or a
  // hand-edited settings.json) is reset to the provider default instead of
  // being sent to the wire. When the control is hidden the value stays: the
  // previous choice survives a switch back to a reasoning model.
  useEffect(() => {
    if (!reasoningAvailable || settings.reasoning === '') {
      return;
    }
    if (!reasoningLevels.includes(settings.reasoning)) {
      props.onSetReasoning('');
    }
  }, [reasoningAvailable, reasoningLevels, settings.reasoning, props.onSetReasoning]);
  const modelOptions = [
    ...(provider?.models ?? []).map((entry) => entry.id),
    ...(!provider?.models.some((entry) => entry.id === settings.model) && settings.model !== ''
      ? [settings.model]
      : []),
  ];
  // For local providers the fetched list is the truth; while it refreshes or
  // after a failure, the saved model stays as the only option.
  const localModelOptions =
    modelFetch.status === 'ok'
      ? fetchedModels
      : [...new Set(settings.model !== '' ? [settings.model, ...fetchedModels] : fetchedModels)];
  const fetching = modelFetch.status === 'loading';
  const fetchLabel = fetching ? nls.t('settings.ai.modelFetching') : nls.t('settings.ai.modelRefresh');
  const testRow = (
    <div className="settings-inline">
      <button onClick={props.onTest} disabled={test.status === 'testing'}>
        {test.status === 'testing' ? nls.t('settings.ai.testing') : nls.t('settings.ai.test')}
      </button>
      {test.status === 'ok' ? <span className="settings-note">{nls.t('settings.ai.test.ok')}</span> : null}
      {test.status === 'fail' ? (
        <span className="settings-error">{test.message}</span>
      ) : null}
    </div>
  );

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

      {provider?.id === 'doru' ? (
        <DoruModelSection
          model={props.doruModel}
          onDownload={props.onDownloadDoruModel}
          onCancel={props.onCancelDoruModelDownload}
          onDelete={props.onDeleteDoruModel}
        />
      ) : provider?.kind === 'acp' ? (
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
          {settings.acpCommand !== '' ? (
            <label className="settings-field">
              <span>{nls.t('settings.ai.acp.args')}</span>
              {/* A draft while typing: splitting on every keystroke would
                  swallow the space that separates the next argument. */}
              <input
                value={argsDraft ?? settings.acpArgs.join(' ')}
                placeholder={nls.t('settings.ai.acp.argsHint')}
                onChange={(event) => setArgsDraft(event.target.value)}
                onBlur={() => {
                  const draft = argsDraft;
                  if (draft !== null && draft !== settings.acpArgs.join(' ')) {
                    props.onSetAcpArgs(draft.trim() === '' ? [] : draft.trim().split(/\s+/));
                  }
                  setArgsDraft(null);
                }}
              />
            </label>
          ) : null}
        </>
      ) : (
        <>
          {/* The endpoint and the key come before the model: the model list
              is fetched from them. Cloud presets keep their public default
              endpoint hidden until the key is saved. */}
          {(!hasCatalog || settings.hasKey) && (
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
          )}
          {provider?.requiresKey || provider?.allowKey ? (
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

          {hasCatalog ? (
            <>
              <label className="settings-field">
                <span>{nls.t('settings.ai.model')}</span>
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
              </label>
              {reasoningAvailable ? (
                <ReasoningSelect
                  value={settings.reasoning}
                  levels={reasoningLevels}
                  onChange={props.onSetReasoning}
                />
              ) : null}
              {settings.hasKey ? testRow : null}
            </>
          ) : (
            <>
              {settings.model === '' ? (
                <>
                  {/* Wizard step: no model chosen yet — the only task is to
                      reach the provider and pick from its list. */}
                  <button
                    className="settings-action"
                    disabled={fetching}
                    onClick={() => props.onFetchModels(baseUrlDraft ?? settings.baseUrl)}
                  >
                    {fetchLabel}
                  </button>
                  {modelFetch.status === 'error' ? (
                    <p className="settings-note">{nls.t('settings.ai.modelFetchError')}</p>
                  ) : null}
                </>
              ) : (
                <>
                  {modelFetch.status !== 'empty' ? (
                    <label className="settings-field">
                      <span>{nls.t('settings.ai.model')}</span>
                      <select
                        value={settings.model}
                        onChange={(event) => props.onSetModel(event.target.value)}
                        aria-label={nls.t('settings.ai.model')}
                      >
                        {localModelOptions.map((id) => (
                          <option key={id} value={id}>
                            {id}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <button
                    className="settings-link"
                    disabled={fetching}
                    onClick={() => props.onFetchModels(baseUrlDraft ?? settings.baseUrl)}
                  >
                    {fetchLabel}
                  </button>
                  {modelFetch.status === 'error' ? (
                    <p className="settings-note">{nls.t('settings.ai.modelStale')}</p>
                  ) : null}
                </>
              )}
              {modelFetch.status === 'empty' ? (
                <p className="settings-note">{nls.t('settings.ai.modelEmpty')}</p>
              ) : null}
              {reasoningAvailable ? (
                <ReasoningSelect
                  value={settings.reasoning}
                  levels={reasoningLevels}
                  onChange={props.onSetReasoning}
                />
              ) : null}
              {settings.model !== '' ? testRow : null}
            </>
          )}
        </>
      )}
    </div>
  );
}

/** Localized message key for a download error; null when nothing to show. */
function doruModelErrorKey(error: DoruModelError | undefined): MessageKey | null {
  switch (error) {
    case 'http':
    case 'network':
      return 'settings.ai.doruModel.error.download';
    case 'size-mismatch':
      return 'settings.ai.doruModel.error.incomplete';
    case 'sha256-mismatch':
      return 'settings.ai.doruModel.error.integrity';
    case 'disk-space':
      return 'settings.ai.doruModel.error.diskSpace';
    default:
      return null;
  }
}

function formatGigabytes(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

/**
 * The "Dóru AI" wizard step: one download button, no model choice. The
 * machine's RAM decides whether the model is offered at all.
 */
function DoruModelSection(props: {
  model: DoruModelState | null;
  onDownload: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const model = props.model;
  if (model === null) {
    return <p className="settings-note">{nls.t('settings.ai.modelFetching')}</p>;
  }
  if (model.downloading) {
    const percent = model.totalBytes > 0 ? Math.round(((model.bytes ?? 0) / model.totalBytes) * 100) : 0;
    return (
      <>
        <p className="settings-note">{nls.t('settings.ai.doruModel.downloading', `${percent}%`)}</p>
        <progress className="settings-progress" value={model.bytes ?? 0} max={model.totalBytes} />
        <button onClick={props.onCancel}>{nls.t('settings.ai.doruModel.cancel')}</button>
      </>
    );
  }
  if (model.installed) {
    return (
      <>
        <p className="settings-note">{nls.t('settings.ai.doruModel.installed')}</p>
        <button className="settings-link" onClick={props.onDelete}>
          {nls.t('settings.ai.doruModel.delete')}
        </button>
      </>
    );
  }
  const tooWeak = model.ramGb < model.minRamGb;
  const errorKey = doruModelErrorKey(model.error);
  return (
    <>
      <p className="settings-note">{nls.t('settings.ai.doruModel.description')}</p>
      <p className="settings-note">{nls.t('settings.ai.doruModel.size', formatGigabytes(model.totalBytes))}</p>
      <p className="settings-note">{nls.t('settings.ai.doruModel.license', model.license)}</p>
      {errorKey !== null ? <p className="settings-error">{nls.t(errorKey)}</p> : null}
      <button className="settings-action" disabled={tooWeak} onClick={props.onDownload}>
        {nls.t('settings.ai.doruModel.install')}
      </button>
      {tooWeak ? (
        <p className="settings-note">{nls.t('settings.ai.doruModel.tooWeak', String(model.minRamGb))}</p>
      ) : null}
    </>
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
