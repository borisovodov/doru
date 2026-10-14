import { useCallback, useEffect, useState } from 'react';
import type { AiProviderInfo, AiSettingsState } from '@doru/features';

export function useSettings() {
  const [aiSettings, setAiSettings] = useState<AiSettingsState | null>(null);
  const [aiProviders, setAiProviders] = useState<AiProviderInfo[]>([]);

  useEffect(() => {
    void (async () => {
      const [settings, providers] = await Promise.all([
        window.doru.getAiSettings(),
        window.doru.getAiProviders(),
      ]);
      setAiSettings(settings);
      setAiProviders(providers);
    })();
  }, []);

  const saveSettings = useCallback(async (options: Parameters<typeof window.doru.setAiSettings>[0]) => {
    const next = await window.doru.setAiSettings(options);
    setAiSettings(next);
    return next;
  }, []);

  return { aiSettings, aiProviders, saveSettings };
}
