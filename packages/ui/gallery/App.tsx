import { createElement, useEffect, useState, type ReactNode } from 'react';
import themes from 'virtual:doru-gallery-themes';
import { nls } from '../src/nls';
import { DemoErrorBoundary } from './ErrorBoundary';
import { GALLERY_LOCALES } from './locales';
import { paletteToCss } from './themes';
import type { Demo, DemoDecorator, DemoMeta } from './types';

interface DemoModule {
  default?: unknown;
  [name: string]: unknown;
}

type Mode = 'light' | 'dark';

interface GalleryGroup {
  title: string;
  meta: DemoMeta;
  demos: Array<{ name: string; demo: Demo }>;
}

const demoModules = import.meta.glob<DemoModule>('../src/**/*.demo.tsx', { eager: true });

function isDemo(value: unknown): value is Demo {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDemoMeta(value: unknown): value is DemoMeta {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return typeof (value as { title?: unknown }).title === 'string';
}

function humanize(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase());
}

const GROUPS: GalleryGroup[] = (() => {
  const groups = new Map<string, GalleryGroup>();
  for (const module of Object.values(demoModules)) {
    const meta = module.default;
    if (!isDemoMeta(meta)) {
      continue;
    }
    const demos: Array<{ name: string; demo: Demo }> = [];
    for (const [name, value] of Object.entries(module)) {
      if (name !== 'default' && isDemo(value)) {
        demos.push({ name: value.name ?? humanize(name), demo: value });
      }
    }
    if (demos.length === 0) {
      continue;
    }
    const existing = groups.get(meta.title);
    if (existing) {
      existing.demos.push(...demos);
    } else {
      groups.set(meta.title, { title: meta.title, meta, demos });
    }
  }
  return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title));
})();

function defaultThemeId(): string {
  return themes.find((theme) => theme.id === 'doru')?.id ?? themes[0]?.id ?? '';
}

function stored(value: string, fallback: string): string {
  const saved = localStorage.getItem(value);
  return saved === null || saved === '' ? fallback : saved;
}

function initialMode(): Mode {
  const saved = localStorage.getItem('gallery.mode');
  if (saved === 'light' || saved === 'dark') {
    return saved;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const INITIAL_LOCALE = stored('gallery.locale', 'en');
nls.setLocale(INITIAL_LOCALE);

function applyDecorators(content: ReactNode, decorators: DemoDecorator[] | undefined): ReactNode {
  return (decorators ?? []).reduceRight<ReactNode>((child, decorator) => decorator(() => child), content);
}

function DemoCard({ name, demo, meta }: { name: string; demo: Demo; meta: DemoMeta }): ReactNode {
  const args = { ...(meta.args ?? {}), ...(demo.args ?? {}) };
  const render = demo.render ?? meta.render;
  let content: ReactNode = null;
  if (render) {
    content = render(args);
  } else if (meta.component) {
    content = createElement(meta.component, args);
  }
  return (
    <article className="demo-card">
      <header className="demo-card-header">
        <h2>{name}</h2>
      </header>
      <div className="demo-card-canvas">
        <DemoErrorBoundary>
          {applyDecorators(content, [...(meta.decorators ?? []), ...(demo.decorators ?? [])])}
        </DemoErrorBoundary>
      </div>
    </article>
  );
}

export function App(): ReactNode {
  const [selected, setSelected] = useState(GROUPS[0]?.title ?? '');
  const [themeId, setThemeId] = useState(() => stored('gallery.theme', defaultThemeId()));
  const [mode, setMode] = useState<Mode>(initialMode);
  const [locale, setLocale] = useState(INITIAL_LOCALE);

  const active = GROUPS.find((group) => group.title === selected) ?? GROUPS[0];

  useEffect(() => {
    const theme = themes.find((entry) => entry.id === themeId);
    if (!theme) {
      return;
    }
    let style = document.getElementById('gallery-theme');
    if (!(style instanceof HTMLStyleElement)) {
      style = document.createElement('style');
      style.id = 'gallery-theme';
      document.head.append(style);
    }
    style.textContent = paletteToCss(mode === 'dark' ? theme.dark : theme.light);
    document.documentElement.style.colorScheme = mode;
    localStorage.setItem('gallery.theme', themeId);
    localStorage.setItem('gallery.mode', mode);
  }, [themeId, mode]);

  const changeLocale = (next: string): void => {
    // Update the shared NLS service before React re-renders the demos;
    // an effect would run after the render and leave them one locale behind.
    nls.setLocale(next);
    setLocale(next);
    localStorage.setItem('gallery.locale', next);
  };

  if (!active) {
    return <div className="gallery-empty">No demos found.</div>;
  }

  return (
    <div className="gallery">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-brand">Dóru</span>
          <span className="sidebar-subtitle">Component gallery</span>
        </div>
        <nav className="sidebar-nav" aria-label="Components">
          {GROUPS.map((group) => (
            <button
              key={group.title}
              type="button"
              className="sidebar-item"
              aria-current={group.title === active.title ? 'page' : undefined}
              onClick={() => setSelected(group.title)}
            >
              <span>{group.title}</span>
              <span className="sidebar-count">{group.demos.length}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="workspace">
        <header className="toolbar">
          <h1 className="toolbar-title">{active.title}</h1>
          <div className="toolbar-controls">
            <label className="control">
              <span>Theme</span>
              <select value={themeId} onChange={(event) => setThemeId(event.target.value)}>
                {themes.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="mode-switch" role="group" aria-label="Color mode">
              <button type="button" aria-pressed={mode === 'light'} onClick={() => setMode('light')}>
                Light
              </button>
              <button type="button" aria-pressed={mode === 'dark'} onClick={() => setMode('dark')}>
                Dark
              </button>
            </div>

            <label className="control">
              <span>Locale</span>
              <select value={locale} onChange={(event) => changeLocale(event.target.value)}>
                {GALLERY_LOCALES.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        <main className="content">
          <div className="demo-grid">
            {active.demos.map(({ name, demo }) => (
              <DemoCard key={name} name={name} demo={demo} meta={active.meta} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
