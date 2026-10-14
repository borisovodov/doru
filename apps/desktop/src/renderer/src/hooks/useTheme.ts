import { useCallback, useEffect, useState } from 'react';

/** Applies the built-in theme CSS and reacts to OS/theme-config changes. */
export function useTheme() {
  const [builtinThemeCss, setBuiltinThemeCss] = useState('');

  const applyBuiltinTheme = useCallback(async (systemDark: boolean, config: { dark: string; light: string }) => {
    const name = systemDark ? config.dark : config.light;
    setBuiltinThemeCss(await window.doru.getThemeCss(name));
  }, []);

  useEffect(() => {
    void (async () => {
      const state = await window.doru.getThemeState();
      await applyBuiltinTheme(state.systemDark, state.config);
    })();
    return window.doru.onThemeSystemChanged((info) => {
      void window.doru.getThemeState().then((state) => applyBuiltinTheme(info.systemDark, state.config));
    });
  }, [applyBuiltinTheme]);

  useEffect(() => {
    return window.doru.onThemeConfigChanged((config) => {
      void window.doru.getThemeState().then((state) => applyBuiltinTheme(state.systemDark, config));
    });
  }, [applyBuiltinTheme]);

  return builtinThemeCss;
}
