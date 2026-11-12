import { useEffect, type ReactNode } from 'react';
import type { Decorator, Preview } from '@storybook/react-vite';
import '@fontsource-variable/inter';
import '@fontsource/berkshire-swash';
import '../src/styles/index.css';
import { nls } from '../src/nls';
import { paletteToCss, type ThemeDefinition } from '../src/storybook/themes';
import themes from 'virtual:doru-themes';

const LOCALES: Array<{ value: string; title: string }> = [
  { value: 'en', title: 'English' },
  { value: 'ru', title: 'Русский' },
  { value: 'fr', title: 'Français' },
  { value: 'de', title: 'Deutsch' },
  { value: 'it', title: 'Italiano' },
  { value: 'es', title: 'Español' },
  { value: 'pt-br', title: 'Português (Brasil)' },
  { value: 'cs', title: 'Čeština' },
  { value: 'pl', title: 'Polski' },
  { value: 'hu', title: 'Magyar' },
  { value: 'bg', title: 'Български' },
  { value: 'el', title: 'Ελληνικά' },
  { value: 'tr', title: 'Türkçe' },
  { value: 'ja', title: '日本語' },
  { value: 'ko', title: '한국어' },
  { value: 'zh-cn', title: '简体中文' },
  { value: 'zh-tw', title: '繁體中文' },
];

const SYSTEM_DARK =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : true;

function themeById(id: string): ThemeDefinition | undefined {
  return themes.find((theme) => theme.id === id);
}

function ThemeFrame({
  theme,
  mode,
  children,
}: {
  theme: ThemeDefinition;
  mode: 'dark' | 'light';
  children: ReactNode;
}) {
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'doru-story-theme';
    style.textContent = paletteToCss(mode === 'dark' ? theme.dark : theme.light);
    document.head.append(style);
    document.documentElement.style.colorScheme = mode;
    return () => style.remove();
  }, [theme, mode]);

  return <div style={{ padding: 24 }}>{children}</div>;
}

const withTheme: Decorator = (Story, context) => {
  const selected = themeById(String(context.globals['theme'] ?? 'doru')) ?? themes[0];
  const mode = context.globals['mode'] === 'light' ? 'light' : 'dark';
  const locale = String(context.globals['locale'] ?? 'en');
  nls.setLocale(locale);

  if (selected === undefined) {
    return <Story />;
  }

  return (
    <ThemeFrame theme={selected} mode={mode}>
      <Story />
    </ThemeFrame>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  initialGlobals: {
    theme: themeById('doru')?.id ?? themes[0]?.id ?? '',
    mode: SYSTEM_DARK ? 'dark' : 'light',
    locale: 'en',
  },
  globalTypes: {
    theme: {
      description: 'Bundled or user theme',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: themes.map((theme) => ({ value: theme.id, title: theme.name })),
        dynamicTitle: true,
      },
    },
    mode: {
      description: 'Dark or light palette',
      toolbar: {
        title: 'Mode',
        icon: 'circlehollow',
        items: [
          { value: 'dark', title: 'Dark', icon: 'moon' },
          { value: 'light', title: 'Light', icon: 'sun' },
        ],
        dynamicTitle: true,
      },
    },
    locale: {
      description: 'UI locale',
      toolbar: {
        title: 'Locale',
        icon: 'globe',
        items: LOCALES,
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    backgrounds: { disable: true },
    controls: { expanded: true },
    layout: 'centered',
  },
};

export default preview;
