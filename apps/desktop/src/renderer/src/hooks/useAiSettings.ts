import { useCallback, useEffect, useState } from 'react';
import type { AiProviderInfo, AiSettingsState, AiTestState } from '@doru/features';

export function useAiSettings() {
  const [settings, setSettings] = useState<AiSettingsState | null>(null);
  const [providers, setProviders] = useState<AiProviderInfo[]>([]);
  const [test, setTest] = useState<AiTestState>({ status: 'idle' });
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);

  useEffect(() => {
    void window.doru.getAiSettings().then(setSettings);
    void window.doru.getAiProviders().then(setProviders);
  }, []);

  const update = useCallback(async (patch: Parameters<typeof window.doru.setAiSettings>[0]) => {
    setSettings(await window.doru.setAiSettings(patch));
  }, []);

  const setProvider = useCallback(
    async (id: string) => {
      const provider = providers.find((entry) => entry.id === id);
      await update({
        provider: id,
        baseUrl: provider?.defaultBaseUrl ?? '',
        model: provider?.defaultModels[0] ?? '',
      });
      setFetchedModels([]);
      setTest({ status: 'idle' });
    },
    [providers, update],
  );

  const setModel = useCallback(
    (model: string) => {
      void update({ model });
      setTest({ status: 'idle' });
    },
    [update],
  );

  const setReasoning = useCallback(
    (reasoning: string) => {
      void update({ reasoning });
      setTest({ status: 'idle' });
    },
    [update],
  );

  const setBaseUrl = useCallback(
    (baseUrl: string) => {
      void update({ baseUrl });
      setTest({ status: 'idle' });
    },
    [update],
  );

  const setApiKey = useCallback(
    (apiKey: string) => {
      void update({ apiKey }).catch((error: unknown) => {
        console.error('failed to save the API key', error);
      });
    },
    [update],
  );

  const clearApiKey = useCallback(() => {
    void update({ clearKey: true });
  }, [update]);

  const setAcpCommand = useCallback(
    (acpCommand: string) => {
      void update({ acpCommand });
    },
    [update],
  );

  const setAcpArgs = useCallback(
    (acpArgs: string[]) => {
      void update({ acpArgs });
    },
    [update],
  );

  const runTest = useCallback(async () => {
    if (!settings) {
      return;
    }
    setTest({ status: 'testing' });
    const result = await window.doru.testAiConnection({
      provider: settings.provider,
      baseUrl: settings.baseUrl,
      model: settings.model,
    });
    setTest(result.ok ? { status: 'ok' } : { status: 'fail', message: result.error ?? 'unknown error' });
  }, [settings]);

  const fetchModels = useCallback(async () => {
    if (!settings) {
      return;
    }
    const result = await window.doru.fetchAiModels({
      provider: settings.provider,
      baseUrl: settings.baseUrl,
      model: settings.model,
    });
    setFetchedModels(result.models ?? []);
    setTest({ status: 'idle' });
  }, [settings]);

  return {
    settings,
    providers,
    test,
    fetchedModels,
    setProvider,
    setModel,
    setReasoning,
    setBaseUrl,
    setApiKey,
    clearApiKey,
    setAcpCommand,
    setAcpArgs,
    runTest,
    fetchModels,
  };
}
