import { useCallback, useEffect, useState } from 'react';
import type { DoruModelState } from '@doru/ai';
import type { AiProviderInfo, AiSettingsState, AiTestState, ModelFetchState } from '@doru/features';

export function useAiSettings() {
  const [settings, setSettings] = useState<AiSettingsState | null>(null);
  const [providers, setProviders] = useState<AiProviderInfo[]>([]);
  const [test, setTest] = useState<AiTestState>({ status: 'idle' });
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [modelFetch, setModelFetch] = useState<ModelFetchState>({ status: 'idle' });
  const [doruModel, setDoruModel] = useState<DoruModelState | null>(null);

  useEffect(() => {
    void window.doru.getAiSettings().then(setSettings);
    void window.doru.getAiProviders().then(setProviders);
    void window.doru.getDoruModelState().then(setDoruModel);
  }, []);

  // The model download runs in the main process; its state arrives both as
  // pushed events (progress) and as invoke replies (authoritative). When the
  // installed/error state flips, `configured` for the doru provider changes
  // with it — refresh the settings so the chat placeholder follows.
  useEffect(() => {
    let previous: DoruModelState | null = null;
    return window.doru.onDoruModelState((state) => {
      const transitioned =
        previous === null ||
        previous.installed !== state.installed ||
        previous.downloading !== state.downloading ||
        previous.error !== state.error;
      previous = state;
      setDoruModel(state);
      if (transitioned) {
        void window.doru.getAiSettings().then(setSettings);
      }
    });
  }, []);

  // Settings writes can come from outside the Settings tab (direct IPC calls,
  // hand edits of settings.json); the main process broadcasts the fresh state.
  useEffect(() => {
    return window.doru.onAiSettingsChanged((state) => {
      setSettings(state);
    });
  }, []);

  const update = useCallback(async (patch: Parameters<typeof window.doru.setAiSettings>[0]) => {
    const next = await window.doru.setAiSettings(patch);
    setSettings(next);
    return next;
  }, []);

  /**
   * Fetches the model list for a catalog-less (local) provider. On success
   * with models, a saved model missing from the list is replaced by the
   * first entry and persisted — the fetched list is the truth. Failures and
   * empty lists never touch the saved settings.
   */
  const fetchModels = useCallback(
    async (overrides?: { provider?: string | undefined; baseUrl?: string | undefined; model?: string | undefined }) => {
      if (!settings) {
        return;
      }
      const provider = overrides?.provider ?? settings.provider;
      const baseUrl = overrides?.baseUrl ?? settings.baseUrl;
      const model = overrides?.model ?? settings.model;
      setModelFetch({ status: 'loading' });
      try {
        const result = await window.doru.fetchAiModels({
          provider,
          baseUrl,
          model,
        });
        setTest({ status: 'idle' });
        if (result.error) {
          setModelFetch({ status: 'error' });
          return;
        }
        const models = result.models ?? [];
        setFetchedModels(models);
        if (models.length === 0) {
          setModelFetch({ status: 'empty' });
          return;
        }
        setModelFetch({ status: 'ok' });
        if (model === '' || !models.includes(model)) {
          await update({ model: models[0]! });
        }
      } catch (error) {
        console.error('failed to fetch the model list', error);
        setModelFetch({ status: 'error' });
      }
    },
    [settings, update],
  );

  const setProvider = useCallback(
    async (id: string) => {
      const provider = providers.find((entry) => entry.id === id);
      const next = await update({ provider: id });
      setFetchedModels([]);
      setTest({ status: 'idle' });
      setModelFetch({ status: 'idle' });
      // Auto-fetch local model lists, but not for key-requiring endpoints
      // until the key exists — the fetch would only fail while the user is
      // still filling the form — and not for providers that start with an
      // empty base URL (custom endpoints need the user's URL first).
      if (provider?.kind === 'local' && next.baseUrl !== '' && !(provider.requiresKey && !next.hasKey)) {
        void fetchModels({ provider: id, baseUrl: next.baseUrl, model: next.model });
      }
    },
    [providers, update, fetchModels],
  );

  /** Quiet refresh when the Settings tab opens: only for a configured local provider. */
  const refreshModelsOnSettingsOpen = useCallback(() => {
    if (!settings || settings.model === '') {
      return;
    }
    const provider = providers.find((entry) => entry.id === settings.provider);
    if (provider?.kind === 'local' && !(provider.requiresKey && !settings.hasKey)) {
      void fetchModels();
    }
  }, [settings, providers, fetchModels]);

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

  const downloadDoruModel = useCallback(async () => {
    setDoruModel(await window.doru.downloadDoruModel());
  }, []);

  const cancelDoruModelDownload = useCallback(async () => {
    setDoruModel(await window.doru.cancelDoruModelDownload());
  }, []);

  const deleteDoruModel = useCallback(async () => {
    setDoruModel(await window.doru.deleteDoruModel());
  }, []);

  return {
    settings,
    providers,
    test,
    fetchedModels,
    modelFetch,
    doruModel,
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
    refreshModelsOnSettingsOpen,
    downloadDoruModel,
    cancelDoruModelDownload,
    deleteDoruModel,
  };
}
