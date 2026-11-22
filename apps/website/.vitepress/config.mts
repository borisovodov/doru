import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type DefaultTheme, type HeadConfig, type TransformContext } from 'vitepress';
import { LOCALES, type LocaleCode } from './i18n/index.ts';
import type { SearchText, SiteLocale } from './i18n/types.ts';

const SITE_URL = 'https://doru.family';
const RELEASES_URL = 'https://github.com/borisovodov/doru/releases';
const GITHUB_URL = 'https://github.com/borisovodov/doru';

const websiteRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function searchLocale(text: SearchText): {
  translations: NonNullable<DefaultTheme.LocalSearchOptions['translations']>;
} {
  return {
    translations: {
      button: { buttonText: text.buttonText, buttonAriaLabel: text.buttonAriaLabel },
      modal: {
        displayDetails: text.displayDetails,
        resetButtonTitle: text.resetButtonTitle,
        backButtonTitle: text.backButtonTitle,
        noResultsText: text.noResultsText,
        footer: {
          selectText: text.selectText,
          selectKeyAriaLabel: text.selectKeyAriaLabel,
          navigateText: text.navigateText,
          navigateUpKeyAriaLabel: text.navigateUpKeyAriaLabel,
          navigateDownKeyAriaLabel: text.navigateDownKeyAriaLabel,
          closeText: text.closeText,
          closeKeyAriaLabel: text.closeKeyAriaLabel,
        },
      },
    },
  };
}

function localeTheme(code: LocaleCode, d: SiteLocale): DefaultTheme.Config {
  const prefix = code === 'en' ? '' : `/${code}`;

  return {
    nav: [
      { text: d.nav.docs, link: `${prefix}/docs/` },
      { text: d.nav.releases, link: RELEASES_URL },
      { text: 'GitHub', link: GITHUB_URL },
    ],
    sidebar: {
      [`${prefix}/docs/`]: [
        { text: d.sidebar.intro, link: `${prefix}/docs/` },
        {
          text: d.sidebar.getStarted,
          collapsed: false,
          items: [
            { text: d.sidebar.installation, link: `${prefix}/docs/installation` },
            { text: d.sidebar.quickStart, link: `${prefix}/docs/getting-started` },
          ],
        },
        {
          text: d.sidebar.guide,
          collapsed: false,
          items: [
            { text: d.sidebar.tree, link: `${prefix}/docs/tree` },
            { text: d.sidebar.shortcuts, link: `${prefix}/docs/shortcuts` },
            { text: d.sidebar.settings, link: `${prefix}/docs/settings` },
            { text: d.sidebar.agents, link: `${prefix}/docs/agents` },
            { text: d.sidebar.themes, link: `${prefix}/docs/themes` },
          ],
        },
        {
          text: d.sidebar.reference,
          collapsed: false,
          items: [
            { text: d.sidebar.dataBackups, link: `${prefix}/docs/data-backups` },
            { text: d.sidebar.troubleshooting, link: `${prefix}/docs/troubleshooting` },
          ],
        },
      ],
    },
    outline: { label: d.ui.outline },
    docFooter: { prev: d.ui.prev, next: d.ui.next },
    returnToTopLabel: d.ui.returnToTop,
    skipToContentLabel: d.ui.skipToContent,
    sidebarMenuLabel: d.ui.menu,
    darkModeSwitchLabel: d.ui.appearance,
    lightModeSwitchTitle: d.ui.lightTheme,
    darkModeSwitchTitle: d.ui.darkTheme,
    langMenuLabel: d.ui.langMenu,
    navMenuLabel: d.ui.mainNavigation,
    mobileMenuLabel: d.ui.mobileMenu,
    extraMenuLabel: d.ui.moreOptions,
    notFound: d.notFound,
    footer: { message: d.footer },
  };
}

function localeConfig(code: LocaleCode, d: SiteLocale) {
  return {
    label: d.label,
    lang: d.lang,
    description: d.description,
    markdown: {
      codeCopyButton: d.markdown.codeCopyButton,
    },
    themeConfig: localeTheme(code, d),
  };
}

const localeConfigs = Object.fromEntries(
  (Object.keys(LOCALES) as LocaleCode[])
    .filter((code) => code !== 'en')
    .map((code) => [code, localeConfig(code, LOCALES[code])]),
);

// og:locale wants a language + region tag; the page's locale is encoded in
// the first segment of its path (ru/index.md, docs/…, index.md).
const OG_LOCALE: Record<LocaleCode, string> = {
  en: 'en_US',
  bg: 'bg_BG',
  cs: 'cs_CZ',
  de: 'de_DE',
  el: 'el_GR',
  es: 'es_ES',
  fr: 'fr_FR',
  hu: 'hu_HU',
  it: 'it_IT',
  ja: 'ja_JP',
  ko: 'ko_KR',
  pl: 'pl_PL',
  'pt-br': 'pt_BR',
  ru: 'ru_RU',
  tr: 'tr_TR',
  'zh-cn': 'zh_CN',
  'zh-tw': 'zh_TW',
};

// Maps a VitePress page path to its clean URL: index.md -> /,
// ru/index.md -> /ru/, docs/installation.md -> /docs/installation.
function pagePath(relativePath: string): string {
  const path = relativePath.replace(/\.md$/, '');
  if (path === 'index') return '/';
  if (path.endsWith('/index')) return `/${path.slice(0, -'/index'.length)}/`;
  return `/${path}`;
}

function pageLocale(relativePath: string): LocaleCode {
  const segment = relativePath.split('/')[0];
  if (segment !== undefined && segment in LOCALES) return segment as LocaleCode;
  return 'en';
}

function translatedPagePath(relativePath: string): string {
  const locale = pageLocale(relativePath);
  if (locale === 'en') return relativePath;
  return relativePath.slice(locale.length + 1);
}

function alternatePath(relativePath: string, target: LocaleCode): string {
  const rest = translatedPagePath(relativePath);
  return target === 'en' ? rest : `${target}/${rest}`;
}

// OpenGraph + Twitter Card tags. VitePress passes the fully composed page
// title ("Intro | Dóru") and resolved description (frontmatter description
// or the site-wide fallback) in the transformHead context, so the tags stay
// in sync with the <title>/<meta name="description"> tags automatically.
function openGraphHead({ pageData, title, description }: TransformContext): HeadConfig[] {
  const image = `${SITE_URL}/og-icon.png`;
  const locale = pageLocale(pageData.relativePath);
  const canonical = `${SITE_URL}${pagePath(pageData.relativePath)}`;
  const tags: HeadConfig[] = [
    ['meta', { property: 'og:site_name', content: 'Dóru' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: title }],
    ['meta', { property: 'og:description', content: description }],
    ['meta', { property: 'og:image', content: image }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { property: 'og:image:alt', content: 'Dóru — genealogy for the AI era' }],
    ['meta', { property: 'og:locale', content: OG_LOCALE[locale] }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: title }],
    ['meta', { name: 'twitter:description', content: description }],
    ['meta', { name: 'twitter:image', content: image }],
  ];

  if (pageData.isNotFound) return tags;

  tags.push(['meta', { property: 'og:url', content: canonical }]);
  tags.push(['link', { rel: 'canonical', href: canonical }]);

  for (const code of Object.keys(LOCALES) as LocaleCode[]) {
    if (code === locale) continue;
    if (!existsSync(join(websiteRoot, alternatePath(pageData.relativePath, code)))) continue;
    tags.push([
      'link',
      {
        rel: 'alternate',
        hreflang: LOCALES[code].lang,
        href: `${SITE_URL}${pagePath(alternatePath(pageData.relativePath, code))}`,
      },
    ]);
    tags.push(['meta', { property: 'og:locale:alternate', content: OG_LOCALE[code] }]);
  }

  const englishPath = alternatePath(pageData.relativePath, 'en');
  if (existsSync(join(websiteRoot, englishPath))) {
    tags.push([
      'link',
      {
        rel: 'alternate',
        hreflang: 'x-default',
        href: `${SITE_URL}${pagePath(englishPath)}`,
      },
    ]);
  }

  return tags;
}

export default defineConfig({
  lang: 'en-US',
  title: 'Dóru',
  description: LOCALES.en.description,
  cleanUrls: true,
  // Strict by default in VitePress; keep it explicit so a dead link always
  // fails the build instead of silently regressing.
  ignoreDeadLinks: false,
  appearance: 'force-auto',
  // VitePress resolves build-time flags (including local search) from the
  // top-level theme config, not from locales.root.themeConfig.
  themeConfig: {
    logo: '/icon.png',
    search: {
      provider: 'local',
      options: {
        locales: Object.fromEntries(
          (Object.keys(LOCALES) as LocaleCode[]).map((code) => [
            code === 'en' ? 'root' : code,
            searchLocale(LOCALES[code].search),
          ]),
        ),
      },
    },
  },
  transformHead: openGraphHead,
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/icon.png' }],
    // Preload the wordmark face so the hero name never paints in a
    // fallback font (font-display: swap without a preload flashes the
    // fallback for the first frames).
    [
      'link',
      {
        rel: 'preload',
        as: 'font',
        type: 'font/woff2',
        crossorigin: '',
        href: '/fonts/berkshire-swash-latin-400-normal.woff2',
      },
    ],
    [
      'script',
      {},
      `;(function () {
        var SUPPORTED = ['en', 'ru', 'fr', 'de', 'it', 'es', 'pt-br', 'cs', 'pl', 'hu', 'bg', 'el', 'tr', 'ja', 'ko', 'zh-cn', 'zh-tw'];
        var LANG_MAP = { zh: 'zh-cn', pt: 'pt-br' };
        function normalize(l) { return String(l || '').toLowerCase().replace('_', '-'); }
        function pick(langs) {
          for (var i = 0; i < langs.length; i++) {
            var l = normalize(langs[i]);
            if (SUPPORTED.indexOf(l) !== -1) return l;
            var base = l.split('-')[0];
            if (LANG_MAP[base]) return LANG_MAP[base];
            if (SUPPORTED.indexOf(base) !== -1) return base;
          }
          return null;
        }
        try {
          var saved = localStorage.getItem('doru-lang');
          var langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
          var target = saved ? normalize(saved) : pick(langs);
          if (target && target !== 'en' && location.pathname === '/') {
            location.replace('/' + target + '/');
          }
        } catch (e) {}
      })();`,
    ],
  ],
  locales: {
    root: localeConfig('en', LOCALES.en),
    ...localeConfigs,
  },
});
