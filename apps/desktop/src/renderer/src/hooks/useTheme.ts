import { useCallback, useEffect, useState } from 'react';

interface ThemeEntry {
  id: string;
  name: string;
}

/**
 * Applies the built-in theme CSS, reacts to OS/theme-setting changes, and
 * exposes the theme list and the current selection for the settings page.
 */
export function useTheme() {
  const [builtinThemeCss, setBuiltinThemeCss] = useState('');
  const [theme, setTheme] = useState('');
  const [themes, setThemes] = useState<ThemeEntry[]>([]);

  const applyBuiltinTheme = useCallback(async (systemDark: boolean, name: string) => {
    setBuiltinThemeCss(await window.doru.getThemeCss(name, systemDark ? 'dark' : 'light'));
  }, []);

  useEffect(() => {
    void (async () => {
      const state = await window.doru.getThemeState();
      setTheme(state.theme);
      setThemes(state.themes);
      await applyBuiltinTheme(state.systemDark, state.theme);
    })();
    return window.doru.onThemeSystemChanged((info) => {
      void window.doru.getThemeState().then((state) => applyBuiltinTheme(info.systemDark, state.theme));
    });
  }, [applyBuiltinTheme]);

  useEffect(() => {
    return window.doru.onThemeSettingsChanged((state) => {
      setTheme(state.theme);
      setThemes(state.themes);
      void applyBuiltinTheme(state.systemDark, state.theme);
    });
  }, [applyBuiltinTheme]);

  const selectTheme = useCallback((name: string) => {
    setTheme(name); // optimistic; the settings-changed event confirms
    void window.doru.setTheme(name);
  }, []);

  /** Re-reads the theme list (e.g. after the user drops a theme file). */
  const refreshThemes = useCallback(async () => {
    const state = await window.doru.getThemeState();
    setTheme(state.theme);
    setThemes(state.themes);
  }, []);

  return { builtinThemeCss, theme, themes, selectTheme, refreshThemes };
}
