import { defineConfig, type DefaultTheme } from 'vitepress';

const LOCALIZED = {
  en: { label: 'English', nav: 'Guide', footer: 'Dóru — local-first genealogy for the AI era.' },
  ru: { label: 'Русский', nav: 'Руководство', footer: 'Dóru — генеалогия local-first в эру ИИ' },
  fr: { label: 'Français', nav: 'Guide', footer: "Dóru — la généalogie local-first à l'ère de l'IA" },
  de: { label: 'Deutsch', nav: 'Anleitung', footer: 'Dóru — Local-first-Genealogie im KI-Zeitalter' },
  it: { label: 'Italiano', nav: 'Guida', footer: "Dóru — genealogia local-first nell'era dell'IA" },
  es: { label: 'Español', nav: 'Guía', footer: 'Dóru — genealogía local-first en la era de la IA' },
  'pt-br': { label: 'Português (Brasil)', nav: 'Guia', footer: 'Dóru — genealogia local-first na era da IA' },
  cs: { label: 'Čeština', nav: 'Průvodce', footer: 'Dóru — local-first genealogie v éře AI' },
  pl: { label: 'Polski', nav: 'Przewodnik', footer: 'Dóru — genealogia local-first w erze AI' },
  hu: { label: 'Magyar', nav: 'Útmutató', footer: 'Dóru — local-first családfakutatás a mesterséges intelligencia korában' },
  bg: { label: 'Български', nav: 'Ръководство', footer: 'Dóru — local-first генеалогия в ерата на ИИ' },
  el: { label: 'Ελληνικά', nav: 'Οδηγός', footer: 'Dóru — local-first γενεαλογία στην εποχή της τεχνητής νοημοσύνης' },
  tr: { label: 'Türkçe', nav: 'Rehber', footer: 'Dóru — yapay zekâ çağında local-first soy ağacı' },
  ja: { label: '日本語', nav: 'ガイド', footer: 'Dóru — AI時代のlocal-first系図' },
  ko: { label: '한국어', nav: '가이드', footer: 'Dóru — AI 시대의 local-first 계보' },
  'zh-cn': { label: '简体中文', nav: '指南', footer: 'Dóru — AI 时代的本地优先家谱' },
  'zh-tw': { label: '繁體中文', nav: '指南', footer: 'Dóru — AI 時代的本地優先家譜' },
} as const;

function themeConfig(nav: string, footer: string): DefaultTheme.Config {
  return {
    nav: [
      { text: nav, link: '/guide/user-guide' },
      { text: 'GitHub', link: 'https://github.com/borisovodov/doru' },
    ],
    sidebar: {
      '/guide/': [{ text: nav, link: '/guide/user-guide' }],
    },
    footer: { message: footer },
    search: { provider: 'local' },
  };
}

const localeConfig = Object.fromEntries(
  (Object.keys(LOCALIZED) as Array<keyof typeof LOCALIZED>).map((key) => {
    const { label, nav, footer } = LOCALIZED[key];
    return [key, { label, lang: key, themeConfig: themeConfig(nav, footer) }];
  }),
);

export default defineConfig({
  lang: 'en-US',
  title: 'Dóru',
  description: 'Local-first genealogy for the AI era.',
  cleanUrls: true,
  appearance: 'force-auto',
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' }],
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
    root: { label: 'English', lang: 'en-US', themeConfig: themeConfig('Guide', LOCALIZED.en.footer) },
    ...localeConfig,
  },
});
