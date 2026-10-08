import { useEffect, useState } from 'react';
import { nls } from '../nls';

export interface AiProviderInfo {
  id: string;
  label: string;
  dialect: 'openai' | 'anthropic' | 'acp';
  defaultBaseUrl: string;
  defaultModels: string[];
  requiresKey: boolean;
}

export interface AiSettingsState {
  provider: string;
  baseUrl: string;
  model: string;
  hasKey: boolean;
  acpCommand: string;
  acpArgs: string[];
  configured: boolean;
}

export interface SettingsViewProps {
  providers: AiProviderInfo[];
  settings: AiSettingsState | null;
  onSave: (options: {
    provider?: string;
    baseUrl?: string;
    model?: string;
    apiKey?: string;
    clearKey?: boolean;
    acpCommand?: string;
    acpArgs?: string[];
  }) => Promise<AiSettingsState>;
  onTest: (options: {
    provider?: string;
    baseUrl?: string;
    apiKey?: string;
    model?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onFetchModels: (options: {
    provider?: string;
    baseUrl?: string;
    apiKey?: string;
    model?: string;
  }) => Promise<{ models: string[]; error?: string }>;
}

export function SettingsView({ providers, settings, onSave, onTest, onFetchModels }: SettingsViewProps) {
  const [provider, setProvider] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [acpCommand, setAcpCommand] = useState('');
  const [acpArgs, setAcpArgs] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [extraModels, setExtraModels] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) {
      return;
    }
    setProvider(settings.provider);
    setBaseUrl(settings.baseUrl);
    setModel(settings.model);
    setAcpCommand(settings.acpCommand);
    setAcpArgs(settings.acpArgs.join('\n'));
    setHasKey(settings.hasKey);
    setConfigured(settings.configured);
    setApiKey('');
    if (settings.model === '') {
      const preset = providers.find((entry) => entry.id === settings.provider);
      const defaultModel = preset?.defaultModels[0];
      if (defaultModel) {
        setModel(defaultModel);
      }
    }
  }, [settings, providers]);

  if (!settings) {
    return null;
  }

  const preset = providers.find((entry) => entry.id === provider);
  const isAcp = preset?.dialect === 'acp';
  const needsKey = preset?.requiresKey ?? false;
  const defaultBaseUrl = preset?.defaultBaseUrl ?? '';
  const modelSuggestions = [...(preset?.defaultModels ?? []), ...extraModels];

  const switchProvider = (id: string) => {
    setProvider(id);
    const next = providers.find((entry) => entry.id === id);
    setBaseUrl(next?.defaultBaseUrl ?? '');
    const defaultModel = next?.defaultModels[0] ?? '';
    if (model === '' && defaultModel !== '') {
      setModel(defaultModel);
    }
  };

  const draft = () => ({
    provider,
    baseUrl: baseUrl || defaultBaseUrl,
    model,
    ...(apiKey !== '' ? { apiKey } : {}),
  });

  const save = async () => {
    const next = await onSave({
      provider,
      baseUrl: baseUrl || defaultBaseUrl,
      model,
      acpCommand,
      acpArgs: acpArgs.split('\n').map((arg) => arg.trim()).filter((arg) => arg !== ''),
      ...(apiKey !== '' ? { apiKey } : {}),
    });
    setHasKey(next.hasKey);
    setConfigured(next.configured);
    const hadKey = apiKey !== '' || hasKey;
    setApiKey('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    if (!isAcp && hadKey) {
      void fetchModels();
    }
  };

  const clearKey = async () => {
    const next = await onSave({ clearKey: true });
    setHasKey(next.hasKey);
    setConfigured(next.configured);
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await onTest(draft());
    setTesting(false);
    setTestResult(result.ok ? 'ok' : `fail:${result.error ?? ''}`);
  };

  const fetchModels = async () => {
    setModelsError(null);
    const result = await onFetchModels(draft());
    if (result.error) {
      setModelsError(result.error);
      return;
    }
    setExtraModels(result.models);
  };

  return (
    <div className="settings-view">
      <h2>{nls.t('workbench.settings')}</h2>
      <div className="settings-section">
        <h3>{nls.t('settings.ai.title')}</h3>
        {!configured && <p className="settings-hint">{nls.t('settings.ai.notConfigured')}</p>}
        <label>
          {nls.t('settings.ai.provider')}
          <select value={provider} onChange={(event) => switchProvider(event.target.value)}>
            {providers.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        {needsKey && (
          <>
            <label>
              {nls.t('settings.ai.apiKey')}
              <input
                type="password"
                value={apiKey}
                placeholder={hasKey ? '••••••••' : ''}
                onChange={(event) => setApiKey(event.target.value)}
              />
            </label>
            {hasKey && (
              <p className="settings-hint">
                {nls.t('settings.ai.keySet')}{' '}
                <button onClick={() => void clearKey()}>{nls.t('settings.ai.clearKey')}</button>
              </p>
            )}
          </>
        )}
        {!isAcp && (
          <>
            <label>
              {nls.t('settings.ai.baseUrl')}
              <input
                value={baseUrl || defaultBaseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
              />
            </label>
            <label>
              {nls.t('settings.ai.model')}
              <input
                list="doru-model-suggestions"
                value={model}
                onChange={(event) => setModel(event.target.value)}
              />
              <datalist id="doru-model-suggestions">
                {modelSuggestions.map((suggestion) => (
                  <option key={suggestion} value={suggestion} />
                ))}
              </datalist>
              <button onClick={() => void fetchModels()}>{nls.t('settings.ai.fetchModels')}</button>
              {extraModels.length > 0 && (
                <span className="settings-status ok">{extraModels.length} models</span>
              )}
              {modelsError && (
                <span className="settings-status fail">{nls.t('settings.ai.testFail', modelsError)}</span>
              )}
            </label>
          </>
        )}
        {isAcp && (
          <>
            <label>
              {nls.t('settings.ai.acpCommand')}
              <input value={acpCommand} onChange={(event) => setAcpCommand(event.target.value)} />
            </label>
            <label>
              {nls.t('settings.ai.acpArgs')}
              <textarea value={acpArgs} onChange={(event) => setAcpArgs(event.target.value)} rows={3} />
            </label>
          </>
        )}
        <div className="settings-actions">
          <button onClick={() => void save()}>{nls.t('settings.ai.save')}</button>
          <button disabled={testing} onClick={() => void test()}>
            {testing ? nls.t('settings.ai.testing') : nls.t('settings.ai.test')}
          </button>
          {saved && <span className="settings-status">{nls.t('settings.ai.saved')}</span>}
          {testResult === 'ok' && <span className="settings-status ok">{nls.t('settings.ai.testOk')}</span>}
          {testResult?.startsWith('fail:') && (
            <span className="settings-status fail">
              {nls.t('settings.ai.testFail', testResult.slice(5))}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
